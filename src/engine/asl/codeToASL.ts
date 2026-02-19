// src/engine/asl/codeToASL.ts
// Funil único: código textual (qualquer linguagem) → ProgramNode → ASLProgram.

import type { Language } from '@/types';
import type { ProgramNode, BaseNode } from '@/system/types';
import type {
  ASLProgram,
  ASLGlobalVar,
  ASLStatement,
  ASLExpr,
  ASLFunction,
  ASLTask,
} from './ASLTypes';
import { RecursiveDescentCParser } from './plugins/c/CParser';
import { PythonParser } from './plugins/python/PythonParser';

/**
 * Ponto de entrada único para qualquer código textual.
 * Agora assíncrono, pois o parser de Python usa tree-sitter com init async.
 */
export async function codeToASL(source: string, language: Language): Promise<ASLProgram> {
  const programAst = await parseToProgramNode(source, language);
  return astToASL(programAst);
}

/**
 * Delegador para os parsers por linguagem.
 */
async function parseToProgramNode(source: string, language: Language): Promise<ProgramNode> {
  switch (language) {
    case 'c':
    case 'cpp': {
      const parser = new RecursiveDescentCParser();
      const { ast /* symbols, errors */ } = parser.parse(source);
      return ast;
    }

    case 'micropython':
    case 'python': {
      const parser = new PythonParser();
      await parser.init();
      const { ast /* errors */ } = parser.parse(source);
      return ast;
    }

    case 'rust':
      throw new Error(`ASL codeToASL: language ${language} parser not wired yet`);

    default:
      throw new Error(`ASL codeToASL: language ${String(language)} not supported`);
  }
}

// -----------------------------------------------------------------------------
// AST (ProgramNode) → ASLProgram
// -----------------------------------------------------------------------------

export function astToASL(program: ProgramNode): ASLProgram {
  const globals: ASLGlobalVar[] = [];
  const functions: ASLFunction[] = [];
  const tasks: ASLTask[] = [];

  program.children.forEach((node) => {
    // 1. Globals
    if (node.nodeType === 'VariableDeclaration') {
      const name = node.attributes.name;
      const type = node.attributes.type || 'int';
      let initialValue: any = 0;

      const valNode = node.children[0];
      if (valNode) {
        if (valNode.nodeType === 'ArrayInitializer') {
          // Convert initializer list to literal array
          initialValue = valNode.children.map((c) => {
            const e = transformExpr(c);
            if (e.kind === 'literal') return e.value;
            return 0;
          });
        } else if (valNode.nodeType === 'Literal') {
          initialValue = valNode.attributes.value;
        }
      }

      globals.push({
        name,
        type: type as any,
        initialValue,
        // Requer ASLGlobalVar.comments?: string[]
        comments: node.leadingComments,
      } as any);
    }

    // 2. Functions
    if (node.nodeType === 'Function') {
      const name = node.attributes.name;
      const params: any[] = node.attributes.params || [];
      const body = transformBlock(node.children);

      // Prepend function-level comments to body
      if (node.leadingComments) {
        for (let i = node.leadingComments.length - 1; i >= 0; i--) {
          body.unshift({ kind: 'comment', text: node.leadingComments[i] } as ASLStatement);
        }
      }

      if (name === 'loop') {
        tasks.push({ name: 'mainLoop', body });
      } else {
        functions.push({
          name,
          params: params.map((p) => ({ name: p.name, type: p.type || 'int' })),
          body,
        });
      }
    }
  });

  // Fallback: se não houver 'loop' (ex.: Rust/Zig 'main'), usa 'main' como task
  if (tasks.length === 0) {
    const mainFunc = functions.find((f) => f.name === 'main');
    if (mainFunc) {
      tasks.push({ name: 'mainLoop', body: mainFunc.body });
      const idx = functions.indexOf(mainFunc);
      if (idx > -1) functions.splice(idx, 1);
    }
  }

  return {
    metadata: { name: 'AST Generated' },
    globals,
    functions,
    tasks,
  };
}

function transformBlock(nodes: BaseNode[]): ASLStatement[] {
  const stmts: ASLStatement[] = [];

  for (const node of nodes) {
    if (!node) continue;

    // --- Comments ---
    if (node.leadingComments) {
      node.leadingComments.forEach((text: string) => {
        stmts.push({ kind: 'comment', text } as ASLStatement);
      });
    }

    // --- Control Flow ---
    if (node.nodeType === 'IfStatement') {
      stmts.push({
        kind: 'if',
        condition: transformExpr(node.children[0]),
        thenBranch: transformBlock(node.children.slice(1)),
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'WhileLoop') {
      stmts.push({
        kind: 'while',
        condition: transformExpr(node.children[0]),
        body: transformBlock(node.children.slice(1)),
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'ForLoop') {
      // Init
      if (node.attributes.hasInit && node.children.length > 0) {
        stmts.push(...transformBlock([node.children[0]]));
      }

      // Loop
      let idx = node.attributes.hasInit ? 1 : 0;
      const cond = node.children[idx];
      idx++;
      const update = node.attributes.hasUpdate ? node.children[idx] : null;
      if (node.attributes.hasUpdate) idx++;

      const bodyNodes = node.children.slice(idx);
      const bodyStmts = transformBlock(bodyNodes);
      if (update) {
        bodyStmts.push(
          ...transformBlock([
            update.nodeType === 'ExpressionStatement'
              ? update
              : ({
                nodeType: 'ExpressionStatement',
                id: 'u',
                attributes: {},
                children: [update],
              } as BaseNode),
          ]),
        );
      }

      stmts.push({
        kind: 'while',
        condition: transformExpr(cond),
        body: bodyStmts,
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'ReturnStatement') {
      stmts.push({
        kind: 'return',
        value: node.children[0] ? transformExpr(node.children[0]) : undefined,
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'BreakStatement') {
      stmts.push({ kind: 'break' } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'ContinueStatement') {
      stmts.push({ kind: 'continue' } as ASLStatement);
      continue;
    }

    // --- GPIO / Hardware ---
    if (node.nodeType === 'GpioSet') {
      stmts.push({
        kind: 'digitalWrite',
        pin: transformExpr(node.children[0]),
        value: transformExpr(node.children[1]),
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'AnalogWrite') {
      stmts.push({
        kind: 'analogWrite',
        pin: transformExpr(node.children[0]),
        value: transformExpr(node.children[1]),
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'DelayMs') {
      stmts.push({
        kind: 'delay',
        milliseconds: transformExpr(node.children[0]),
      } as ASLStatement);
      continue;
    }

    // --- Assignments / Variables ---
    if (node.nodeType === 'VariableDeclaration') {
      const valNode = node.children[0];
      const readStmt = tryTransformRead(node.attributes.name, valNode);
      if (readStmt) {
        stmts.push(readStmt);
      } else if (valNode) {
        // Handle array init in local scope
        if (valNode.nodeType === 'ArrayInitializer') {
          const arrayVal: ASLExpr = {
            kind: 'literal',
            value: valNode.children.map((c) => {
              const e = transformExpr(c);
              return e.kind === 'literal' ? e.value : 0;
            }),
          };
          stmts.push({
            kind: 'assign',
            target: node.attributes.name,
            value: arrayVal,
          } as ASLStatement);
        } else {
          stmts.push({
            kind: 'assign',
            target: node.attributes.name,
            value: transformExpr(valNode),
          } as ASLStatement);
        }
      }
      continue;
    }

    if (node.nodeType === 'ExpressionStatement') {
      const expr = node.children[0];

      // Handle Assignments
      if (
        expr.nodeType === 'BinaryExpression' &&
        ['=', '+=', '-=', '*=', '/='].includes(expr.attributes.operator)
      ) {
        const op = expr.attributes.operator as string;
        const left = expr.children[0];
        const right = expr.children[1];

        // Identifier assignment: x = ...
        if (left.nodeType === 'Identifier') {
          const target = left.attributes.name;
          if (op === '=') {
            const readStmt = tryTransformRead(target, right);
            if (readStmt) {
              stmts.push(readStmt);
              continue;
            }
            stmts.push({
              kind: 'assign',
              target,
              value: transformExpr(right),
            } as ASLStatement);
          } else {
            const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
            stmts.push({
              kind: 'assign',
              target,
              value: {
                kind: 'binary',
                op: binOp,
                left: { kind: 'var', name: target },
                right: transformExpr(right),
              },
            } as ASLStatement);
          }
        }
        // Array assignment: arr[i] = ...
        else if (left.nodeType === 'SubscriptExpression') {
          const targetArr = left.children[0];
          const index = left.children[1];
          if (targetArr.nodeType === 'Identifier') {
            if (op === '=') {
              stmts.push({
                kind: 'setIndex',
                target: targetArr.attributes.name,
                index: transformExpr(index),
                value: transformExpr(right),
              } as ASLStatement);
            } else {
              const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
              const currentVal: ASLExpr = {
                kind: 'index',
                target: transformExpr(targetArr),
                index: transformExpr(index),
              };
              stmts.push({
                kind: 'setIndex',
                target: targetArr.attributes.name,
                index: transformExpr(index),
                value: {
                  kind: 'binary',
                  op: binOp,
                  left: currentVal,
                  right: transformExpr(right),
                },
              } as ASLStatement);
            }
          }
        }
        // Member assignment: obj.prop = ...
        else if (left.nodeType === 'MemberExpression') {
          if (op === '=') {
            stmts.push({
              kind: 'setMember',
              target: transformExpr(left.children[0]),
              property: left.attributes.property,
              value: transformExpr(right),
            } as ASLStatement);
          } else {
            const binOp = op.charAt(0) as '+' | '-' | '*' | '/';
            const currentVal: ASLExpr = {
              kind: 'member',
              target: transformExpr(left.children[0]),
              property: left.attributes.property,
            };
            stmts.push({
              kind: 'setMember',
              target: transformExpr(left.children[0]),
              property: left.attributes.property,
              value: {
                kind: 'binary',
                op: binOp,
                left: currentVal,
                right: transformExpr(right),
              },
            } as ASLStatement);
          }
        }
        continue;
      }

      // Handle Unary updates (i++, i--)
      if (expr.nodeType === 'UnaryExpression' && ['++', '--'].includes(expr.attributes.operator)) {
        const child = expr.children[0];
        if (child.nodeType === 'Identifier') {
          stmts.push({
            kind: 'assign',
            target: child.attributes.name,
            value: {
              kind: 'binary',
              op: expr.attributes.operator === '++' ? '+' : '-',
              left: { kind: 'var', name: child.attributes.name },
              right: { kind: 'literal', value: 1 },
            },
          } as ASLStatement);
        }
        continue;
      }

      // Handle Calls as Statements (Serial.print, func calls)
      if (expr.nodeType === 'CallExpression') {
        const stmt = transformCallToStmt(expr);
        if (stmt) stmts.push(stmt);
        continue;
      }

      // Handle Print Node
      if (expr.nodeType === 'Print') {
        stmts.push({
          kind: 'print',
          args: expr.children.map(transformExpr),
          newline: true,
        } as ASLStatement);
        continue;
      }
    }

    // Explicit Print Node
    if (node.nodeType === 'Print') {
      stmts.push({
        kind: 'print',
        args: node.children.map(transformExpr),
        newline: true,
      } as ASLStatement);
      continue;
    }
  }

  return stmts;
}

function transformCallToStmt(node: BaseNode): ASLStatement | null {
  const callee = node.attributes.callee;

  if (callee === 'pinMode') {
    // Attempt to extract mode. If literal, easy.
    // INPUT=0, OUTPUT=1, INPUT_PULLUP=2
    const modeNode = node.children[1];
    let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'OUTPUT';

    if (modeNode.nodeType === 'Literal') {
      const v = modeNode.attributes.value;
      if (v === 0) mode = 'INPUT';
      if (v === 2) mode = 'INPUT_PULLUP';
    }

    return {
      kind: 'pinMode',
      pin: transformExpr(node.children[0]),
      mode,
    } as ASLStatement;
  }

  if (callee === 'digitalWrite') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  // Serial
  if (callee === 'Serial.print' || callee === 'Serial.println') {
    return {
      kind: 'print',
      args: node.children.map(transformExpr),
      newline: callee === 'Serial.println',
    } as ASLStatement;
  }

  // Void Function Calls (genérico)
  return {
    kind: 'expr',
    expr: {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr),
    },
  } as ASLStatement;
}

function tryTransformRead(targetVar: string, valueNode: BaseNode | undefined): ASLStatement | null {
  if (!valueNode) return null;

  if (valueNode.nodeType === 'GpioRead') {
    return {
      kind: 'read',
      mode: 'DIGITAL',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'AnalogRead') {
    return {
      kind: 'read',
      mode: 'ANALOG',
      target: targetVar,
      pin: transformExpr(valueNode.children[0]),
    } as ASLStatement;
  }
  if (valueNode.nodeType === 'CallExpression') {
    if (valueNode.attributes.callee === 'digitalRead') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
    if (valueNode.attributes.callee === 'analogRead') {
      return {
        kind: 'read',
        mode: 'ANALOG',
        target: targetVar,
        pin: transformExpr(valueNode.children[0]),
      } as ASLStatement;
    }
  }
  return null;
}

function transformExpr(node: BaseNode | undefined): ASLExpr {
  if (!node) return { kind: 'literal', value: 0 };

  if (node.nodeType === 'Literal') {
    return { kind: 'literal', value: node.attributes.value };
  }

  if (node.nodeType === 'Identifier') {
    return { kind: 'var', name: node.attributes.name };
  }

  if (node.nodeType === 'BinaryExpression') {
    return {
      kind: 'binary',
      op: node.attributes.operator,
      left: transformExpr(node.children[0]),
      right: transformExpr(node.children[1]),
    } as ASLExpr;
  }

  if (node.nodeType === 'UnaryExpression') {
    return {
      kind: 'unary',
      op: node.attributes.operator as any,
      expr: transformExpr(node.children[0]),
    } as ASLExpr;
  }

  if (node.nodeType === 'CallExpression') {
    const callee = node.attributes.callee;
    return {
      kind: 'call',
      callee,
      args: node.children.map(transformExpr),
    } as ASLExpr;
  }

  if (node.nodeType === 'GpioRead') {
    return {
      kind: 'call',
      callee: 'digitalRead',
      args: [transformExpr(node.children[0])],
    } as ASLExpr;
  }

  if (node.nodeType === 'AnalogRead') {
    return {
      kind: 'call',
      callee: 'analogRead',
      args: [transformExpr(node.children[0])],
    } as ASLExpr;
  }

  if (node.nodeType === 'SubscriptExpression') {
    return {
      kind: 'index',
      target: transformExpr(node.children[0]),
      index: transformExpr(node.children[1]),
    } as ASLExpr;
  }

  if (node.nodeType === 'MemberExpression') {
    return {
      kind: 'member',
      target: transformExpr(node.children[0]),
      property: node.attributes.property,
    } as ASLExpr;
  }

  return { kind: 'literal', value: 0 };
}
