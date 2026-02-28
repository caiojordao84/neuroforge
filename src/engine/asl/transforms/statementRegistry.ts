import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLExpr } from '../ASLTypes';
import type { TransformContext } from './context';
import { transformExpr } from './exprTransform';
import { transformCallToStmt, tryTransformRead } from './callTransform';
import { buildEmptyArray, deepCopyValue, resolveSize } from '../helpers/arrayUtils';

const HARDWARE_CALLEE_MAP: Record<string, string> = {
  'LcdPrint': 'lcd.print',
  'LcdCursor': 'lcd.setCursor',
  'LcdClear': 'lcd.clear',
  'OledText': 'oled.text',
  'OledShow': 'oled.show',
  'OledClear': 'oled.clear',
  'SevSegPrint': 'sevseg.print',
  'KeypadRead': 'KeypadRead'
};

const HARDWARE_NODES = ['LcdPrint', 'LcdCursor', 'LcdClear', 'OledText', 'OledShow', 'OledClear', 'SevSegPrint', 'KeypadRead'];

export type StatementHandler = (node: BaseNode, ctx: TransformContext) => ASLStatement[];

export const statementRegistry: Record<string, StatementHandler> = {
  IfStatement: handleIfStatement,
  WhileLoop: handleWhileLoop,
  DoWhileLoop: handleDoWhileLoop,
  ForLoop: handleForLoop,
  SwitchStatement: handleSwitchStatement,
  StructDeclaration: handleStructDeclaration,
  ReturnStatement: handleReturnStatement,
  BreakStatement: handleBreakStatement,
  ContinueStatement: handleContinueStatement,
  GpioSet: handleGpioSet,
  AnalogWrite: handleAnalogWrite,
  DelayMs: handleDelayMs,
  VariableDeclaration: handleVariableDeclaration,
  ExpressionStatement: handleExpressionStatement,
  Print: handlePrint,
  ...HARDWARE_NODES.reduce((acc, nodeType) => {
    acc[nodeType] = handleHardware;
    return acc;
  }, {} as Record<string, StatementHandler>)
};

/**
 * StructDeclaration — no-op handler.
 * Struct registration is handled upstream in codeToASL.ts (ASLProgram.structs[]).
 * This handler prevents spurious assign() statements when StructDeclaration
 * nodes appear inside function/loop blocks (e.g. from RustParser or CParser).
 */
function handleStructDeclaration(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [];
}

function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  // children[0] = discriminant expr
  // children[1..] = CaseClause nodes
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);

  const cases = caseNodes.map((caseNode) => {
    const isDefault = !!caseNode.attributes.isDefault;

    let test: ASLExpr | null = null;
    let bodyChildren: BaseNode[] = [];

    if (isDefault) {
      // Sem testExpr — todos os children são body
      bodyChildren = caseNode.children;
    } else {
      // children[0] = testExpr, children[1..] = body
      test = transformExpr(caseNode.children[0]);
      bodyChildren = caseNode.children.slice(1);
    }

    const body = ctx.transformBlock ? ctx.transformBlock(bodyChildren, ctx) : [];
    return { test, body };
  });

  return [
    {
      kind: 'switch',
      discriminant,
      cases,
    } as ASLStatement,
  ];
}

function handleIfStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const condition = transformExpr(node.children[0]);
  const thenBlock = node.children[1];
  const elseBranch = node.children[2];

  const thenBranch = thenBlock && thenBlock.nodeType === 'Block' && ctx.transformBlock
    ? ctx.transformBlock(thenBlock.children, ctx)
    : [];

  const elseBranchResult = elseBranch && ctx.transformBlock
    ? (elseBranch.nodeType === 'IfStatement'
      ? ctx.transformBlock([elseBranch], ctx)
      : (elseBranch.nodeType === 'Block' ? ctx.transformBlock(elseBranch.children, ctx) : []))
    : undefined;

  return [{
    kind: 'if',
    condition,
    thenBranch,
    elseBranch: elseBranchResult,
  } as ASLStatement];
}

function handleWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const bodyNodes = node.children.slice(1);
  const body = ctx.transformBlock ? ctx.transformBlock(bodyNodes, ctx) : [];

  return [{
    kind: 'while',
    condition: transformExpr(node.children[0]),
    body,
  } as ASLStatement];
}

function handleDoWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const bodyNodes = node.children.slice(1);
  const body = ctx.transformBlock ? ctx.transformBlock(bodyNodes, ctx) : [];

  return [{
    kind: 'doWhile',
    condition: transformExpr(node.children[0]),
    body,
  } as ASLStatement];
}

function handleForLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const result: ASLStatement[] = [];

  if (node.attributes.hasInit && node.children.length > 0 && ctx.transformBlock) {
    const initStmts = ctx.transformBlock([node.children[0]], ctx);
    result.push(...initStmts);
  }

  let idx = node.attributes.hasInit ? 1 : 0;
  const cond = node.children[idx];
  idx++;
  const update = node.attributes.hasUpdate ? node.children[idx] : null;
  if (node.attributes.hasUpdate) idx++;

  const bodyNodes = node.children.slice(idx);
  const bodyStmts = ctx.transformBlock ? ctx.transformBlock(bodyNodes, ctx) : [];

  // Build update statements separately so the executor can run them even on continue
  const updateStmts: ASLStatement[] = [];
  if (update && ctx.transformBlock) {
    updateStmts.push(...ctx.transformBlock([
      update.nodeType === 'ExpressionStatement'
        ? update
        : ({
          nodeType: 'ExpressionStatement',
          id: 'u',
          attributes: {},
          children: [update],
        } as BaseNode),
    ], ctx));
  }

  result.push({
    kind: 'for',
    condition: cond ? transformExpr(cond) : { kind: 'literal', value: true },
    body: bodyStmts,
    update: updateStmts,
  } as ASLStatement);

  return result;
}

function handleReturnStatement(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'return',
    value: node.children[0] ? transformExpr(node.children[0]) : undefined,
  } as ASLStatement];
}

function handleBreakStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'break' } as ASLStatement];
}

function handleContinueStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'continue' } as ASLStatement];
}

function handleGpioSet(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'digitalWrite',
    pin: transformExpr(node.children[0]),
    value: transformExpr(node.children[1]),
  } as ASLStatement];
}

function handleAnalogWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'analogWrite',
    pin: transformExpr(node.children[0]),
    value: transformExpr(node.children[1]),
  } as ASLStatement];
}

function handleDelayMs(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'delay',
    milliseconds: transformExpr(node.children[0]),
  } as ASLStatement];
}

function handleVariableDeclaration(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const name = node.attributes.name;
  const valNode = node.children[0];
  const isArray = node.attributes.isArray;
  const isArray2D = node.attributes.isArray2D;
  const structType = node.attributes.structType;
  const structDef = structType ? _ctx.structDefs?.[structType] : null;

  if (valNode && valNode.nodeType === 'CallExpression' && valNode.attributes.callee === 'Pin') {
    const pinExpr = transformExpr(valNode.children[0]);
    const modeNode = valNode.children[1];
    let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'INPUT';
    if (modeNode && modeNode.nodeType === 'Literal') {
      const v = modeNode.attributes.value;
      if (v === 1) mode = 'OUTPUT';
      if (v === 2) mode = 'INPUT_PULLUP';
    }

    return [
      { kind: 'pinMode', pin: pinExpr, mode } as ASLStatement,
      { kind: 'assign', target: name, value: pinExpr } as ASLStatement
    ];
  }

  const readStmt = tryTransformRead(name, valNode);
  if (readStmt) return [readStmt];

  const stmts: ASLStatement[] = [];

  if (valNode && valNode.nodeType === 'ArrayInitializer') {
    if (structDef && !isArray) {
      // Struct initialization
      const baseObj: Record<string, any> = {};
      structDef.fields.forEach(f => { baseObj[f.name] = 0; });
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: baseObj } });

      valNode.children.forEach((c, i) => {
        if (i < structDef.fields.length) {
          const field = structDef.fields[i];
          const expr = transformExpr(c);
          stmts.push({ kind: 'setMember', target: { kind: 'var', name }, property: field.name, value: expr });
        }
      });
      return stmts;
    }

    if (structDef && isArray) {
      // Array of Structs Initialization
      const size = resolveSize(node.attributes.arraySizeExpr, _ctx.globalsMap) || valNode.children.length;
      const emptyArr: any[] = [];

      for (let i = 0; i < size; i++) {
        const baseObj: Record<string, any> = {};
        structDef.fields.forEach(f => { baseObj[f.name] = 0; });
        emptyArr.push(baseObj);
      }

      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });

      valNode.children.forEach((rowNode, i) => {
        if (i < size && rowNode.nodeType === 'ArrayInitializer') {
          rowNode.children.forEach((c, j) => {
            if (j < structDef.fields.length) {
              const field = structDef.fields[j];
              const expr = transformExpr(c);
              stmts.push({
                kind: 'setMember',
                target: { kind: 'index', target: { kind: 'var', name }, index: { kind: 'literal', value: i } },
                property: field.name,
                value: expr
              });
            }
          });
        }
      });
      return stmts;
    }

    if (isArray2D && valNode.attributes.isArray2D) {
      const rows = resolveSize(node.attributes.arraySizeExpr, _ctx.globalsMap) || valNode.children.length;
      const cols = resolveSize(node.attributes.arraySize2Expr, _ctx.globalsMap) || 0;

      const emptyMatrix = Array(rows).fill(null).map(() => Array(cols).fill(0));
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyMatrix } });

      valNode.children.forEach((rowNode, i) => {
        if (i < rows && rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
          rowNode.children.forEach((c, j) => {
            if (j < cols) {
              stmts.push({
                kind: 'setIndex2D',
                target: name,
                rowIndex: { kind: 'literal', value: i },
                colIndex: { kind: 'literal', value: j },
                value: transformExpr(c)
              });
            }
          });
        }
      });
      return stmts;
    }

    const size = resolveSize(node.attributes.arraySizeExpr, _ctx.globalsMap) || valNode.children.length;
    const hasDesignated = valNode.children.some(c => c.nodeType === 'DesignatedInitializer');

    if (hasDesignated) {
      const emptyArr = Array(size).fill(0);
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });
      valNode.children.forEach(c => {
        if (c.nodeType === 'DesignatedInitializer') {
          const idxExpr = transformExpr(c.attributes.index as BaseNode);
          const valExpr = transformExpr(c.children[0]);
          stmts.push({ kind: 'setIndex', target: name, index: idxExpr, value: valExpr });
        }
      });
    } else {
      const emptyArr = Array(size).fill(0);
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });
      valNode.children.forEach((c, i) => {
        if (i < size) {
          stmts.push({ kind: 'setIndex', target: name, index: { kind: 'literal', value: i }, value: transformExpr(c) });
        }
      });
    }
    return stmts;
  }

  if (isArray && valNode?.nodeType === 'Literal' && Array.isArray(valNode.attributes.value) && valNode.attributes.value.length === 0) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, _ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (isArray && !valNode) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, _ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (valNode) {
    return [{ kind: 'assign', target: name, value: transformExpr(valNode) }];
  }

  return [];
}

function handleExpressionStatement(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const expr = node.children[0];
  if (!expr) return [];

  if (expr.nodeType === 'GpioSet') {
    return [{
      kind: 'digitalWrite',
      pin: transformExpr(expr.children[0]),
      value: transformExpr(expr.children[1]),
    } as ASLStatement];
  }

  if (expr.nodeType === 'AnalogWrite') {
    return [{
      kind: 'analogWrite',
      pin: transformExpr(expr.children[0]),
      value: transformExpr(expr.children[1]),
    } as ASLStatement];
  }

  if (expr.nodeType === 'DelayMs') {
    return [{
      kind: 'delay',
      milliseconds: transformExpr(expr.children[0]),
    } as ASLStatement];
  }

  if (expr.nodeType === 'BinaryExpression' && ['=', '+=', '-=', '*=', '/='].includes(expr.attributes.operator)) {
    return handleAssignment(expr);
  }

  if (expr.nodeType === 'UnaryExpression' && ['++', '--'].includes(expr.attributes.operator)) {
    const child = expr.children[0];
    if (child.nodeType === 'Identifier') {
      return [{
        kind: 'assign',
        target: child.attributes.name,
        value: {
          kind: 'binary',
          op: expr.attributes.operator === '++' ? '+' : '-',
          left: { kind: 'var', name: child.attributes.name },
          right: { kind: 'literal', value: 1 },
        },
      } as ASLStatement];
    }
  }

  if (expr.nodeType === 'CallExpression') {
    const stmt = transformCallToStmt(expr);
    if (stmt) return [stmt];
  }

  if (expr.nodeType === 'Print') {
    return [{
      kind: 'print',
      args: expr.children.map(transformExpr),
      newline: !!expr.attributes.newline,
    } as ASLStatement];
  }

  if (HARDWARE_NODES.includes(expr.nodeType)) {
    return handleHardware(expr);
  }

  return [];
}

function handleAssignment(expr: BaseNode): ASLStatement[] {
  const op = expr.attributes.operator as string;
  const left = expr.children[0];
  const right = expr.children[1];

  if (left.nodeType === 'Identifier') {
    const target = left.attributes.name;
    if (op === '=') {
      const readStmt = tryTransformRead(target, right);
      if (readStmt) return [readStmt];
      return [{
        kind: 'assign',
        target,
        value: transformExpr(right),
      } as ASLStatement];
    } else {
      const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
      return [{
        kind: 'assign',
        target,
        value: {
          kind: 'binary',
          op: binOp,
          left: { kind: 'var', name: target },
          right: transformExpr(right),
        },
      } as ASLStatement];
    }
  }

  if (left.nodeType === 'UnaryExpression' && left.attributes.operator === '*') {
    const ptrExpr = transformExpr(left.children[0]);
    if (op === '=') {
      return [{
        kind: 'setPointer',
        target: ptrExpr,
        value: transformExpr(right),
      } as any];
    } else {
      const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
      return [{
        kind: 'setPointer',
        target: ptrExpr,
        value: {
          kind: 'binary',
          op: binOp,
          left: { kind: 'unary', op: '*', expr: ptrExpr },
          right: transformExpr(right),
        },
      } as any];
    }
  }

  if (left.nodeType === 'SubscriptExpression') {
    const targetArr = left.children[0];
    const index = left.children[1];

    if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'SubscriptExpression' && targetArr.children[0].children[0].nodeType === 'Identifier') {
      const arrName = targetArr.children[0].children[0].attributes.name;
      const d1Index = transformExpr(targetArr.children[0].children[1]);
      const d2Index = transformExpr(targetArr.children[1]);
      const d3Index = transformExpr(index);
      return [{
        kind: 'setIndex3D',
        target: arrName,
        d1Index,
        d2Index,
        d3Index,
        value: transformExpr(right),
      } as ASLStatement];
    }

    if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'Identifier') {
      const arrName = targetArr.children[0].attributes.name;
      const rowIndex = transformExpr(targetArr.children[1]);
      const colIndex = transformExpr(index);
      return [{
        kind: 'setIndex2D',
        target: arrName,
        rowIndex,
        colIndex,
        value: transformExpr(right),
      } as ASLStatement];
    }

    if (targetArr.nodeType === 'Identifier') {
      if (op === '=') {
        return [{
          kind: 'setIndex',
          target: targetArr.attributes.name,
          index: transformExpr(index),
          value: transformExpr(right),
        } as ASLStatement];
      } else {
        const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
        const currentVal: ASLExpr = {
          kind: 'index',
          target: transformExpr(targetArr),
          index: transformExpr(index),
        };
        return [{
          kind: 'setIndex',
          target: targetArr.attributes.name,
          index: transformExpr(index),
          value: {
            kind: 'binary',
            op: binOp,
            left: currentVal,
            right: transformExpr(right),
          },
        } as ASLStatement];
      }
    }
  }

  if (left.nodeType === 'MemberExpression') {
    if (op === '=') {
      return [{
        kind: 'setMember',
        target: transformExpr(left.children[0]),
        property: left.attributes.property,
        value: transformExpr(right),
      } as ASLStatement];
    } else {
      const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
      const currentVal: ASLExpr = {
        kind: 'member',
        target: transformExpr(left.children[0]),
        property: left.attributes.property,
      };
      return [{
        kind: 'setMember',
        target: transformExpr(left.children[0]),
        property: left.attributes.property,
        value: {
          kind: 'binary',
          op: binOp,
          left: currentVal,
          right: transformExpr(right),
        },
      } as ASLStatement];
    }
  }

  return [];
}

function handlePrint(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'print',
    args: node.children.map(transformExpr),
    newline: !!node.attributes.newline,
  } as ASLStatement];
}

function handleHardware(node: BaseNode): ASLStatement[] {
  const callee = HARDWARE_CALLEE_MAP[node.nodeType];
  if (!callee) return [];

  return [{
    kind: 'expr',
    expr: {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr)
    }
  } as ASLStatement];
}
