import type { BaseNode } from '@/system/types';
import type { ASLStatement, ASLExpr, ASLType } from '../ASLTypes';
import type { TransformContext } from './context';
import { transformExpr } from './exprTransform';
import { transformCallToStmt, tryTransformRead } from './callTransform';
import { buildEmptyArray, deepCopyValue, resolveSize } from '../helpers/arrayUtils';
import { extractPostfix, resetPostfixTempCounter } from './postfixUtils';

const HARDWARE_CALLEE_MAP: Record<string, string> = {
  'LcdPrint': 'lcd.print',
  'LcdCursor': 'lcd.setCursor',
  'LcdClear': 'lcd.clear',
  'OledText': 'oled.text',
  'OledShow': 'oled.show',
  'OledClear': 'oled.clear',
  'SevSegPrint': 'sevseg.print',
  'KeypadRead': 'KeypadRead',
  'DhtReadTemp': 'dht.readTemp',
  'DhtReadHum': 'dht.readHum',
  'UltrasonicRead': 'ultrasonic.read',
  'LdrRead': 'ldr.read',
  'IrRead': 'ir.read',
  'MotorsMove': 'motors.move',
  'MpuGet': 'mpu.get'
};

const HARDWARE_NODES = Object.keys(HARDWARE_CALLEE_MAP);

export type StatementHandler = (node: BaseNode, ctx: TransformContext) => ASLStatement[];

export const statementRegistry: Record<string, StatementHandler> = {
  Block: handleBlock,
  Empty: handleEmpty,
  EnumDeclaration: handleEmpty,
  Loop: handleLoop,
  IfStatement: handleIfStatement,
  WhileLoop: handleWhileLoop,
  DoWhileLoop: handleDoWhileLoop,
  ForLoop: handleForLoop,
  ForIn: handleForIn,
  SwitchStatement: handleSwitchStatement,
  StructDeclaration: handleStructDeclaration,
  ReturnStatement: handleReturnStatement,
  BreakStatement: handleBreakStatement,
  ContinueStatement: handleContinueStatement,
  GpioSet: handleGpioSet,
  AnalogWrite: handleAnalogWrite,
  DelayMs: handleDelayMs,
  GpioRead: handleGpioRead,
  AnalogRead: handleAnalogRead,
  HardwarePwm: handleHardwarePwm,
  GpioBatch: handleGpioBatch,
  VariableDeclaration: handleVariableDeclaration,
  ExpressionStatement: handleExpressionStatement,
  CallExpression: handleExpressionStatement,
  Print: handlePrint,
  // --- Service Handlers (S5) ---
  UartWrite: handleUartWrite,
  UartRead: handleUartRead,
  I2CWrite: handleI2CWrite,
  I2CRead: handleI2CRead,
  SpiTransfer: handleSpiTransfer,
  TimerTON: handleTimerTON,
  TimerTOF: handleTimerTOF,
  TimerTP: handleTimerTP,
  CounterCTU: handleCounterCTU,
  CounterCTD: handleCounterCTD,
  LatchSR: handleLatchSR,
  LatchRS: handleLatchRS,
  TrigR: handleTrigR,
  TrigF: handleTrigF,
  SerialBegin: handleSerialBegin,

  ...HARDWARE_NODES.reduce((acc, nodeType) => {
    acc[nodeType] = handleHardware;
    return acc;
  }, {} as Record<string, StatementHandler>)
};

function handleBlock(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  if (!ctx.transformBlock) return [];
  return ctx.transformBlock(node.children, ctx);
}

function handleEmpty(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [];
}

function handleLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const body = handleBlock(node, ctx);
  return [{ kind: 'for', condition: { kind: 'literal', value: true }, body, update: [] } as ASLStatement];
}

/**
 * StructDeclaration — no-op handler.
 */
function handleStructDeclaration(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [];
}

function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);

  const cases = caseNodes.map((caseNode) => {
    const isDefault = !!caseNode.attributes.isDefault;
    let test: ASLExpr | null = null;
    let bodyChildren: BaseNode[] = [];

    if (isDefault) {
      bodyChildren = caseNode.children;
    } else {
      test = transformExpr(caseNode.children[0]);
      bodyChildren = caseNode.children.slice(1);
    }

    const body = ctx.transformBlock ? ctx.transformBlock(bodyChildren, ctx) : [];
    return { test, body };
  });

  return [{ kind: 'switch', discriminant, cases } as ASLStatement];
}

function handleIfStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const condition = transformExpr(node.children[0]);
  const thenNode = node.children[1];
  const elseNode = node.children[2];

  const thenBranch = thenNode ? (thenNode.nodeType === 'Block' ? handleBlock(thenNode, ctx) : statementRegistry[thenNode.nodeType]?.(thenNode, ctx) || []) : [];

  let elseBranch: ASLStatement[] | undefined;
  if (elseNode) {
    if (elseNode.nodeType === 'Block') {
      elseBranch = handleBlock(elseNode, ctx);
    } else if (elseNode.nodeType === 'IfStatement') {
      elseBranch = handleIfStatement(elseNode, ctx);
    } else {
      elseBranch = statementRegistry[elseNode.nodeType]?.(elseNode, ctx);
    }
  }

  return [{ kind: 'if', condition, thenBranch, elseBranch: elseBranch } as ASLStatement];
}

function handleWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const condition = transformExpr(node.children[0]);
  const bodyNode = node.children[1];
  const body = bodyNode ? (bodyNode.nodeType === 'Block' ? handleBlock(bodyNode, ctx) : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || []) : [];
  return [{ kind: 'while', condition, body } as ASLStatement];
}

function handleDoWhileLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const bodyNode = node.children[1];
  const body = bodyNode ? (bodyNode.nodeType === 'Block' ? handleBlock(bodyNode, ctx) : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || []) : [];
  const condition = transformExpr(node.children[0]);
  return [{ kind: 'doWhile', condition, body } as ASLStatement];
}

function handleForLoop(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const result: ASLStatement[] = [];
  if (node.attributes.hasInit && node.children.length > 0 && ctx.transformBlock) {
    result.push(...ctx.transformBlock([node.children[0]], ctx));
  }

  let idx = node.attributes.hasInit ? 1 : 0;
  const cond = node.children[idx];
  idx++;
  const update = node.attributes.hasUpdate ? node.children[idx] : null;
  if (node.attributes.hasUpdate) idx++;

  const bodyNodes = node.children.slice(idx);
  const condSideEffects: BaseNode[] = [];
  resetPostfixTempCounter();
  const desugaredCond = cond ? extractPostfix(cond, condSideEffects) : null;

  const bodyStmts = ctx.transformBlock ? ctx.transformBlock(bodyNodes, ctx) : [];
  if (condSideEffects.length > 0) {
    condSideEffects.forEach(se => { bodyStmts.unshift(...handleAssignment(se)); });
  }

  // Build update statements separately
  const updateStmts: ASLStatement[] = [];
  if (update && ctx.transformBlock) {
    // Optimization: If update is a simple i++, i--, ++i, or --i, we don't need the __tmp_ variable.
    if (update.nodeType === 'UnaryExpression' && ['++', '--'].includes(update.attributes.operator)) {
      const child = update.children[0];
      if (child.nodeType === 'Identifier') {
        const varName = child.attributes.name;
        const op = update.attributes.operator === '++' ? '+' : '-';
        updateStmts.push({
          kind: 'assign', target: varName,
          value: { kind: 'binary', op, left: { kind: 'var', name: varName }, right: { kind: 'literal', value: 1 } }
        } as ASLStatement);
      }
    }

    if (updateStmts.length === 0) {
      const updateSideEffects: BaseNode[] = [];
      resetPostfixTempCounter();
      const desugaredUpdate = extractPostfix(update, updateSideEffects);

      updateStmts.push(...ctx.transformBlock([
        desugaredUpdate.nodeType === 'ExpressionStatement' ? desugaredUpdate : {
          nodeType: 'ExpressionStatement', id: 'u', attributes: {}, children: [desugaredUpdate],
        } as BaseNode,
      ], ctx));

      if (updateSideEffects.length > 0) {
        updateSideEffects.forEach(se => { updateStmts.push(...handleAssignment(se)); });
      }
    }
  }

  result.push({
    kind: 'for',
    condition: desugaredCond ? transformExpr(desugaredCond) : { kind: 'literal', value: true },
    body: bodyStmts,
    update: updateStmts,
  } as ASLStatement);
  return result;
}

function handleForIn(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const varName = node.attributes.varName || 'item';
  const iterable = transformExpr(node.children[0]);
  const bodyNode = node.children[1];
  const body = bodyNode ? (bodyNode.nodeType === 'Block' ? handleBlock(bodyNode, ctx) : statementRegistry[bodyNode.nodeType]?.(bodyNode, ctx) || []) : [];
  return [{ kind: 'forIn', varName, iterable, body } as any];
}

function handleGpioSet(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'digitalWrite', pin: transformExpr(node.children[0]), value: transformExpr(node.children[1]) } as ASLStatement];
}

function handleAnalogWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'analogWrite', pin: transformExpr(node.children[0]), value: transformExpr(node.children[1]) } as ASLStatement];
}

function handleDelayMs(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'delay', milliseconds: transformExpr(node.children[0]) } as ASLStatement];
}

function handleReturnStatement(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const expr = node.children[0];
  if (!expr) return [{ kind: 'return' } as ASLStatement];
  const sideEffects: BaseNode[] = [];
  const desugaredExpr = extractPostfix(expr, sideEffects);
  const stmts: ASLStatement[] = [];
  sideEffects.forEach(se => { stmts.push(...handleAssignment(se)); });
  stmts.push({ kind: 'return', value: transformExpr(desugaredExpr) } as ASLStatement);
  return stmts;
}

function handleBreakStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'break' } as ASLStatement];
}

function handleContinueStatement(_node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'continue' } as ASLStatement];
}

function handleGpioRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const target = node.attributes.target || '__tmp_read';
  return [{ kind: 'read', pin: transformExpr(node.children[0]), target, mode: 'DIGITAL' } as ASLStatement];
}

function handleAnalogRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const target = node.attributes.target || '__tmp_read';
  return [{ kind: 'read', pin: transformExpr(node.children[0]), target, mode: 'ANALOG' } as ASLStatement];
}

function handleHardwarePwm(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{
    kind: 'pwmInit',
    pin: { kind: 'literal', value: node.attributes.pin },
    freq: { kind: 'literal', value: node.attributes.freq || 1000 },
    duty: { kind: 'literal', value: node.attributes.duty }
  } as ASLStatement];
}

function handleGpioBatch(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  const ops = node.attributes.operations || [];
  return ops.map((op: any) => ({
    kind: 'digitalWrite',
    pin: { kind: 'literal', value: op.pin },
    value: { kind: 'literal', value: op.val }
  } as ASLStatement));
}

// --- Service Handlers Implementation ---

function handleUartWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'uartWrite', port: transformExpr(node.children[0]), data: transformExpr(node.children[1]) } as ASLStatement];
}

function handleUartRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'uartRead', port: transformExpr(node.children[0]), target: node.attributes.target, length: transformExpr(node.children[1]) } as ASLStatement];
}

function handleI2CWrite(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'i2cWrite', bus: transformExpr(node.children[0]), address: transformExpr(node.children[1]), data: transformExpr(node.children[2]) } as ASLStatement];
}

function handleI2CRead(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'i2cRead', bus: transformExpr(node.children[0]), address: transformExpr(node.children[1]), length: transformExpr(node.children[2]), target: node.attributes.target } as ASLStatement];
}

function handleSpiTransfer(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'spiTransfer', bus: transformExpr(node.children[0]), csPin: transformExpr(node.children[1]), txData: transformExpr(node.children[2]), target: node.attributes.target } as ASLStatement];
}

function handleTimerTON(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTON', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTimerTOF(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTOF', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTimerTP(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'timerTP', instance: node.attributes.instance, in: transformExpr(node.children[0]), pt: transformExpr(node.children[1]) } as ASLStatement];
}

function handleCounterCTU(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'counterCTU', instance: node.attributes.instance, cu: transformExpr(node.children[0]), r: transformExpr(node.children[1]), pv: transformExpr(node.children[2]) } as ASLStatement];
}

function handleCounterCTD(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'counterCTD', instance: node.attributes.instance, cd: transformExpr(node.children[0]), ld: transformExpr(node.children[1]), pv: transformExpr(node.children[2]) } as ASLStatement];
}

function handleLatchSR(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'latchSR', instance: node.attributes.instance, s: transformExpr(node.children[0]), r: transformExpr(node.children[1]) } as ASLStatement];
}

function handleLatchRS(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'latchRS', instance: node.attributes.instance, r: transformExpr(node.children[0]), s: transformExpr(node.children[1]) } as ASLStatement];
}

function handleTrigR(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'trigR', instance: node.attributes.instance, in: transformExpr(node.children[0]) } as ASLStatement];
}

function handleTrigF(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'trigF', instance: node.attributes.instance, in: transformExpr(node.children[0]) } as ASLStatement];
}

function handleSerialBegin(node: BaseNode, _ctx: TransformContext): ASLStatement[] {
  return [{ kind: 'serialBegin', baud: transformExpr(node.children[0]) } as ASLStatement];
}

function handleVariableDeclaration(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const name = node.attributes.name;
  const type = (node.attributes.type || 'int') as ASLType;
  const valNode = node.children[0];
  const isArray = node.attributes.isArray;
  const isArray2D = node.attributes.isArray2D;
  const structType = node.attributes.structType;
  const structDef = structType ? ctx.structDefs?.[structType] : null;

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

  if (isArray && valNode?.nodeType === 'Literal' && Array.isArray(valNode.attributes.value) && valNode.attributes.value.length === 0) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (isArray && !valNode) {
    const emptyArr = buildEmptyArray(node.attributes.arraySizeExpr, node.attributes.arraySize2Expr, ctx.globalsMap);
    return [{ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } }];
  }

  if (valNode && valNode.nodeType === 'ArrayInitializer') {
    if (structDef && !isArray) {
      const baseObj: Record<string, any> = {};
      structDef.fields.forEach(f => { baseObj[f.name] = 0; });
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: baseObj } });
      valNode.children.forEach((c, i) => {
        if (i < structDef.fields.length) {
          stmts.push({ kind: 'setMember', target: { kind: 'var', name }, property: structDef.fields[i].name, value: transformExpr(c) });
        }
      });
      return stmts;
    }

    if (structDef && isArray) {
      const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
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
              stmts.push({
                kind: 'setMember',
                target: { kind: 'index', target: { kind: 'var', name }, index: { kind: 'literal', value: i } },
                property: structDef.fields[j].name,
                value: transformExpr(c)
              });
            }
          });
        }
      });
      return stmts;
    }

    if (isArray2D && valNode.attributes.isArray2D) {
      const rows = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
      const cols = resolveSize(node.attributes.arraySize2Expr, ctx.globalsMap) || 0;
      const emptyMatrix = Array(rows).fill(null).map(() => Array(cols).fill(0));
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyMatrix } });
      valNode.children.forEach((rowNode, i) => {
        if (i < rows && rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
          rowNode.children.forEach((c, j) => {
            if (j < cols) {
              stmts.push({ kind: 'setIndex2D', target: name, rowIndex: { kind: 'literal', value: i }, colIndex: { kind: 'literal', value: j }, value: transformExpr(c) });
            }
          });
        }
      });
      return stmts;
    }

    const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
    const hasDesignated = valNode.children.some(c => c.nodeType === 'DesignatedInitializer');

    if (hasDesignated) {
      const emptyArr = Array(size).fill(0);
      stmts.push({ kind: 'assign', target: name, value: { kind: 'literal', value: emptyArr } });
      valNode.children.forEach((c) => {
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

  if (valNode) {
    const sideEffects: BaseNode[] = [];
    resetPostfixTempCounter();
    const desugaredVal = extractPostfix(valNode, sideEffects);
    const resultStmts: ASLStatement[] = [];
    sideEffects.forEach(se => {
      resultStmts.push(...handleAssignment(se));
    });
    resultStmts.push({ kind: 'assign', target: name, value: transformExpr(desugaredVal) });
    return resultStmts;
  }

  return [{ kind: 'assign', target: name, value: { kind: 'literal', value: 0 } }];
}

function handleExpressionStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const expr = node.nodeType === 'ExpressionStatement' ? node.children[0] : node;
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
      const varName = child.attributes.name;
      const isPostfix = expr.attributes.prefix === false;

      if (isPostfix) {
        // i++ -> i = i + 1
        return [{
          kind: 'assign',
          target: varName,
          value: {
            kind: 'binary',
            op: expr.attributes.operator === '++' ? '+' : '-',
            left: { kind: 'var', name: varName },
            right: { kind: 'literal', value: 1 },
          },
        } as ASLStatement];
      } else {
        // ++i as statement is the same as i++
        return [{
          kind: 'assign',
          target: varName,
          value: {
            kind: 'binary',
            op: expr.attributes.operator === '++' ? '+' : '-',
            left: { kind: 'var', name: varName },
            right: { kind: 'literal', value: 1 },
          },
        } as ASLStatement];
      }
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

  const sideEffects: BaseNode[] = [];
  resetPostfixTempCounter();
  extractPostfix(expr, sideEffects);
  const resultStmts: ASLStatement[] = [];
  sideEffects.forEach(se => { resultStmts.push(...handleAssignment(se)); });
  return resultStmts;
}

function handleAssignment(expr: BaseNode): ASLStatement[] {
  const op = expr.attributes.operator as string;
  const left = expr.children[0];
  const right = expr.children[1];

  if (left.nodeType === 'Identifier') {
    const target = left.attributes.name;
    if (op === '=') {
      const sideEffects: BaseNode[] = [];
      resetPostfixTempCounter();
      const desugaredRight = extractPostfix(right, sideEffects);
      const resStmts: ASLStatement[] = [];
      sideEffects.forEach(se => { resStmts.push(...handleAssignment(se)); });
      const readStmt = tryTransformRead(target, desugaredRight);
      if (readStmt) {
        resStmts.push(readStmt);
        return resStmts;
      }

      resStmts.push({
        kind: 'assign',
        target,
        value: transformExpr(desugaredRight),
      } as ASLStatement);
      return resStmts;
    } else {
      const binOp = op.charAt(0) as any;
      return [{ kind: 'assign', target, value: { kind: 'binary', op: binOp, left: { kind: 'var', name: target }, right: transformExpr(right) } } as ASLStatement];
    }
  }

  if (left.nodeType === 'UnaryExpression' && left.attributes.operator === '*') {
    const ptrExpr = transformExpr(left.children[0]);
    if (op === '=') return [{ kind: 'setPointer', target: ptrExpr, value: transformExpr(right) } as any];
    const binOp = op.charAt(0) as any;
    return [{ kind: 'setPointer', target: ptrExpr, value: { kind: 'binary', op: binOp, left: { kind: 'unary', op: '*', expr: ptrExpr }, right: transformExpr(right) } } as any];
  }

  if (left.nodeType === 'SubscriptExpression') {
    const targetArr = left.children[0];
    const index = left.children[1];

    if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'SubscriptExpression') {
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
      const arrName = (targetArr.children[0] as any).attributes.name;
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
      const targetName = targetArr.attributes.name;
      if (op === '=') return [{ kind: 'setIndex', target: targetName, index: transformExpr(index), value: transformExpr(right) } as ASLStatement];
      const binOp = op.charAt(0) as any;
      return [{ kind: 'setIndex', target: targetName, index: transformExpr(index), value: { kind: 'binary', op: binOp, left: { kind: 'index', target: transformExpr(targetArr), index: transformExpr(index) }, right: transformExpr(right) } } as ASLStatement];
    }
  }

  if (left.nodeType === 'MemberExpression') {
    const target = transformExpr(left.children[0]);
    const property = left.attributes.property;
    if (op === '=') {
      return [{
        kind: 'setMember',
        target,
        property,
        value: transformExpr(right),
      } as ASLStatement];
    } else {
      const binOp = op.charAt(0) as any;
      const currentVal: ASLExpr = {
        kind: 'member',
        target,
        property,
      };
      return [{
        kind: 'setMember',
        target,
        property,
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
  return [{ kind: 'print', args: node.children.map(transformExpr), newline: !!node.attributes.newline } as ASLStatement];
}

function handleHardware(node: BaseNode): ASLStatement[] {
  const callee = HARDWARE_CALLEE_MAP[node.nodeType];
  if (!callee) return [];
  return [{ kind: 'expr', expr: { kind: 'call', callee, args: node.children.map(transformExpr) } } as ASLStatement];
}
