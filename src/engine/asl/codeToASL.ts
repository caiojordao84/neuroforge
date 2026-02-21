// src/engine/asl/codeToASL.ts
// Funil único: código textual (qualquer linguagem) → ProgramNode → ASLProgram.

import type { Language } from '@/types';
import type { ProgramNode, BaseNode } from '../../system/types';
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
  return astToASL(programAst, language);
}

/**
 * Delegador para os parsers por linguagem.
 */
async function parseToProgramNode(source: string, language: Language): Promise<ProgramNode> {
  switch (language) {
    case 'c':
    case 'cpp': {
      const parser = new RecursiveDescentCParser();
      const { ast } = parser.parse(source);
      return ast;
    }

    case 'micropython':
    case 'circuitpython':
    case 'python': {
      const parser = new PythonParser();
      await parser.init();
      const { ast } = parser.parse(source);
      return ast;
    }

    default:
      // Return empty program for unsupported languages
      return { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
  }
}

// -----------------------------------------------------------------------------
// Helpers para resolução de tamanho de arrays
// -----------------------------------------------------------------------------

/**
 * Resolve uma expressão de tamanho (Literal ou Identifier) para número.
 * globalsMap: mapa name → initialValue dos globals já processados.
 */
function resolveSize(expr: BaseNode | undefined, globalsMap: Map<string, any>): number {
  if (!expr) return 0;
  if (expr.nodeType === 'Literal') {
    const v = expr.attributes.value;
    return typeof v === 'number' ? Math.floor(v) : 0;
  }
  if (expr.nodeType === 'Identifier') {
    const val = globalsMap.get(expr.attributes.name);
    if (typeof val === 'number') return Math.floor(val);
  }
  return 0;
}

/**
 * Constrói array JS vazio com o tamanho correcto.
 * 1D: Array(N).fill(0)
 * 2D: Array(N).fill(null).map(() => Array(M).fill(0))
 */
function buildEmptyArray(
  sizeExpr: BaseNode | undefined,
  size2Expr: BaseNode | undefined,
  globalsMap: Map<string, any>,
): any {
  const n = resolveSize(sizeExpr, globalsMap) || 0;
  if (size2Expr) {
    const m = resolveSize(size2Expr, globalsMap) || 0;
    return Array(n).fill(null).map(() => Array(m).fill(0));
  }
  return Array(n).fill(0);
}

/**
 * Deep copy segura para arrays (1D e 2D).
 * Evita referências partilhadas entre chamadas de função.
 */
function deepCopyValue(val: any): any {
  if (Array.isArray(val)) return JSON.parse(JSON.stringify(val));
  return val;
}

// -----------------------------------------------------------------------------
// AST (ProgramNode) → ASLProgram
// -----------------------------------------------------------------------------

export function astToASL(program: ProgramNode, language?: Language): ASLProgram {
  const globals: ASLGlobalVar[] = [];
  const functions: ASLFunction[] = [];
  const tasks: ASLTask[] = [];

  // Mapa name → initialValue para resolver arraySizeExpr que referencia constantes globais
  const globalsMap = new Map<string, any>();

  function mapToASLType(cppType: string): any {
    const lower = cppType.toLowerCase();
    if (lower.includes('int') || lower.includes('long') || lower === 'short' || lower === 'byte' || lower === 'char') return 'int';
    if (lower.includes('float') || lower === 'double') return 'float';
    if (lower === 'bool' || lower === 'boolean') return 'bool';
    if (lower === 'string') return 'string';
    return 'int'; // Enum values etc
  }

  const topLevelNodes: BaseNode[] = [];
  const isPython = language === 'micropython' || language === 'circuitpython' || language === 'python';

  program.children.forEach((node) => {
    if (!node) return;

    // 0. Enums
    if (node.nodeType === 'EnumDeclaration') {
      const members = node.attributes.members || [];
      members.forEach((m: { name: string, value: number }) => {
        globals.push({
          name: m.name,
          type: 'int',
          initialValue: m.value,
        });
        globalsMap.set(m.name, m.value);
      });
      return;
    }

    // 1. Functions / Tasks
    if (node.nodeType === 'Function') {
      const name = node.attributes.name;
      const params: any[] = node.attributes.params || [];
      const body = transformBlock(node.children, globalsMap);

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
    } else {
      // 2. Top-level statements (Loops, assignments, calls, etc.)
      topLevelNodes.push(node);

      // Still identify globals for the ASL meta-info
      if (node.nodeType === 'VariableDeclaration') {
        const name = node.attributes.name;
        const type = mapToASLType(node.attributes.type || 'int');
        const isArray = node.attributes.isArray;
        const isArray2D = node.attributes.isArray2D;
        let initialValue: any = 0;

        const valNode = node.children[0];
        if (valNode) {
          if (valNode.nodeType === 'ArrayInitializer') {
            if (isArray2D && valNode.attributes.isArray2D) {
              // 2D com inicializador: int m[N][M] = {{1,2},{3,4}}
              initialValue = valNode.children.map((rowNode) => {
                if (rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
                  return rowNode.children.map((c) => {
                    const e = transformExpr(c);
                    return e.kind === 'literal' ? e.value : 0;
                  });
                }
                const e = transformExpr(rowNode);
                return e.kind === 'literal' ? e.value : 0;
              });
            } else {
              // 1D com inicializador
              initialValue = valNode.children.map((c) => {
                const e = transformExpr(c);
                if (e.kind === 'literal') return e.value;
                return 0;
              });
            }
          } else if (valNode.nodeType === 'Literal') {
            if (isArray) {
              // Array sem inicializador: int arr[N] → zeros com tamanho resolvido
              initialValue = buildEmptyArray(
                node.attributes.arraySizeExpr,
                node.attributes.arraySize2Expr,
                globalsMap,
              );
            } else {
              initialValue = valNode.attributes.value;
            }
          }
        } else if (isArray) {
          // Sem children: fallback para array vazio com tamanho resolvido
          initialValue = buildEmptyArray(
            node.attributes.arraySizeExpr,
            node.attributes.arraySize2Expr,
            globalsMap,
          );
        }

        // Deep copy para evitar referências partilhadas
        const safeInitialValue = deepCopyValue(initialValue);

        globals.push({
          name,
          type: type as any,
          initialValue: safeInitialValue,
          comments: node.leadingComments,
        } as any);

        globalsMap.set(name, safeInitialValue);
      }
    }
  });

  // 3. Process top-level code into the main task
  if (topLevelNodes.length > 0) {
    const topLevelStmts = transformBlock(topLevelNodes, globalsMap);
    const existingLoop = tasks.find((t) => t.name === 'mainLoop');

    if (isPython) {
      // For Python, top-level code IS the unified task (often containing its own while loop)
      if (existingLoop) {
        existingLoop.body.unshift(...topLevelStmts);
      } else {
        tasks.push({ name: 'mainLoop', body: topLevelStmts });
      }
    } else {
      // For C++, root level code that is NOT a function is usually illegal or setup-like.
      // However, we should check if there's a setup() function.
      const setupFunc = functions.find(f => f.name === 'setup');
      if (setupFunc) {
        // Prepend any illegal root statements to setup
        setupFunc.body.unshift(...topLevelStmts);
      } else if (existingLoop) {
        // If no setup, prepend to loop (this is where it was going before, causing regression)
        // But for C++, we should be careful. We only prepend if it's NOT a repeat.
        // Actually, let's NO LONGER prepend root nodes to existingLoop for C++ 
        // because root nodes in C are GLOBALS which are already in 'globals' section.
      } else {
        tasks.push({ name: 'mainLoop', body: topLevelStmts });
      }
    }
  }

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

function transformBlock(nodes: BaseNode[], globalsMap: Map<string, any> = new Map()): ASLStatement[] {
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
      const condition = transformExpr(node.children[0]);
      const thenBlock = node.children[1];
      const elseBranch = node.children[2];

      stmts.push({
        kind: 'if',
        condition,
        thenBranch: thenBlock && thenBlock.nodeType === 'Block' ? transformBlock(thenBlock.children, globalsMap) : [],
        elseBranch: elseBranch
          ? (elseBranch.nodeType === 'IfStatement'
            ? transformBlock([elseBranch], globalsMap)
            : (elseBranch.nodeType === 'Block' ? transformBlock(elseBranch.children, globalsMap) : []))
          : undefined,
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'WhileLoop') {
      stmts.push({
        kind: 'while',
        condition: transformExpr(node.children[0]),
        body: transformBlock(node.children.slice(1), globalsMap),
      } as ASLStatement);
      continue;
    }

    if (node.nodeType === 'ForLoop') {
      // Init
      if (node.attributes.hasInit && node.children.length > 0) {
        stmts.push(...transformBlock([node.children[0]], globalsMap));
      }

      // Loop
      let idx = node.attributes.hasInit ? 1 : 0;
      const cond = node.children[idx];
      idx++;
      const update = node.attributes.hasUpdate ? node.children[idx] : null;
      if (node.attributes.hasUpdate) idx++;

      const bodyNodes = node.children.slice(idx);
      const bodyStmts = transformBlock(bodyNodes, globalsMap);
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
          ], globalsMap),
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
      const isArray = node.attributes.isArray;
      const isArray2D = node.attributes.isArray2D;

      // MicroPython Pin Init: x = Pin(pin, mode)
      if (valNode && valNode.nodeType === 'CallExpression' && valNode.attributes.callee === 'Pin') {
        const pinExpr = transformExpr(valNode.children[0]);
        const modeNode = valNode.children[1];
        let mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' = 'INPUT';
        if (modeNode && modeNode.nodeType === 'Literal') {
          const v = modeNode.attributes.value;
          if (v === 1) mode = 'OUTPUT';
          if (v === 2) mode = 'INPUT_PULLUP';
        }

        // 1. Emit pinMode
        stmts.push({
          kind: 'pinMode',
          pin: pinExpr,
          mode,
        } as ASLStatement);

        // 2. Emit assignment so x stores the pin number
        stmts.push({
          kind: 'assign',
          target: node.attributes.name,
          value: pinExpr,
        } as ASLStatement);
        continue;
      }

      const readStmt = tryTransformRead(node.attributes.name, valNode);
      if (readStmt) {
        stmts.push(readStmt);
      } else if (valNode) {
        if (valNode.nodeType === 'ArrayInitializer') {
          let arrayVal: ASLExpr;
          if (isArray2D && valNode.attributes.isArray2D) {
            // 2D local com inicializador
            arrayVal = {
              kind: 'literal',
              value: valNode.children.map((rowNode) => {
                if (rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
                  return rowNode.children.map((c) => {
                    const e = transformExpr(c);
                    return e.kind === 'literal' ? e.value : 0;
                  });
                }
                const e = transformExpr(rowNode);
                return e.kind === 'literal' ? e.value : 0;
              }),
            };
          } else {
            // 1D local com inicializador
            arrayVal = {
              kind: 'literal',
              value: valNode.children.map((c) => {
                const e = transformExpr(c);
                return e.kind === 'literal' ? e.value : 0;
              }),
            };
          }
          stmts.push({
            kind: 'assign',
            target: node.attributes.name,
            value: { kind: 'literal', value: deepCopyValue((arrayVal as any).value) },
          } as ASLStatement);
        } else if (isArray && valNode.nodeType === 'Literal' && Array.isArray(valNode.attributes.value) && valNode.attributes.value.length === 0) {
          // Array local sem inicializador: int arr[N] → zeros com tamanho resolvido
          const emptyArr = buildEmptyArray(
            node.attributes.arraySizeExpr,
            node.attributes.arraySize2Expr,
            globalsMap,
          );
          stmts.push({
            kind: 'assign',
            target: node.attributes.name,
            value: { kind: 'literal', value: emptyArr },
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

      // Hardware nodes embrulhados em ExpressionStatement
      if (expr.nodeType === 'GpioSet') {
        stmts.push({
          kind: 'digitalWrite',
          pin: transformExpr(expr.children[0]),
          value: transformExpr(expr.children[1]),
        } as ASLStatement);
        continue;
      }

      if (expr.nodeType === 'AnalogWrite') {
        stmts.push({
          kind: 'analogWrite',
          pin: transformExpr(expr.children[0]),
          value: transformExpr(expr.children[1]),
        } as ASLStatement);
        continue;
      }

      if (expr.nodeType === 'DelayMs') {
        stmts.push({
          kind: 'delay',
          milliseconds: transformExpr(expr.children[0]),
        } as ASLStatement);
        continue;
      }

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
        // Array assignment: arr[i] = ... ou arr[i][j] = ...
        else if (left.nodeType === 'SubscriptExpression') {
          const targetArr = left.children[0];
          const index = left.children[1];

          // 2D: arr[i][j] = val — targetArr é SubscriptExpression(Identifier, i)
          if (targetArr.nodeType === 'SubscriptExpression' && targetArr.children[0].nodeType === 'Identifier') {
            const arrName = targetArr.children[0].attributes.name;
            const rowIndex = transformExpr(targetArr.children[1]);
            const colIndex = transformExpr(index);
            stmts.push({
              kind: 'setIndex2D',
              target: arrName,
              rowIndex,
              colIndex,
              value: transformExpr(right),
            } as ASLStatement);
          }
          // 1D: arr[i] = val
          else if (targetArr.nodeType === 'Identifier') {
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
          newline: !!expr.attributes.newline,
        } as ASLStatement);
        continue;
      }

      // Handle Specialized Hardware Nodes
      if (['LcdPrint', 'LcdCursor', 'LcdClear', 'OledText', 'OledShow', 'OledClear', 'SevSegPrint', 'KeypadRead'].includes(expr.nodeType)) {
        const calleeMap: Record<string, string> = {
          'LcdPrint': 'lcd.print',
          'LcdCursor': 'lcd.setCursor',
          'LcdClear': 'lcd.clear',
          'OledText': 'oled.text',
          'OledShow': 'oled.show',
          'OledClear': 'oled.clear',
          'SevSegPrint': 'sevseg.print',
          'KeypadRead': 'KeypadRead'
        };
        stmts.push({
          kind: 'expr',
          expr: {
            kind: 'call',
            callee: calleeMap[expr.nodeType],
            args: expr.children.map(transformExpr)
          }
        } as ASLStatement);
        continue;
      }
    }

    // Explicit Nodes at Block Level
    if (['LcdPrint', 'LcdCursor', 'LcdClear', 'OledText', 'OledShow', 'OledClear', 'SevSegPrint', 'KeypadRead'].includes(node.nodeType)) {
      const calleeMap: Record<string, string> = {
        'LcdPrint': 'lcd.print',
        'LcdCursor': 'lcd.setCursor',
        'LcdClear': 'lcd.clear',
        'OledText': 'oled.text',
        'OledShow': 'oled.show',
        'OledClear': 'oled.clear',
        'SevSegPrint': 'sevseg.print',
        'KeypadRead': 'KeypadRead'
      };
      stmts.push({
        kind: 'expr',
        expr: {
          kind: 'call',
          callee: calleeMap[node.nodeType],
          args: node.children.map(transformExpr)
        }
      } as ASLStatement);
      continue;
    }

    // Explicit Print Node
    if (node.nodeType === 'Print') {
      stmts.push({
        kind: 'print',
        args: node.children.map(transformExpr),
        newline: !!node.attributes.newline,
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

  // MicroPython Pin.value(v) -> digitalWrite
  if (callee === 'Pin.value' && node.children.length === 2) {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: transformExpr(node.children[1]),
    } as ASLStatement;
  }

  // MicroPython led.on() -> digitalWrite(pin, HIGH)
  if (callee === 'Pin.on') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 1 } as ASLExpr,
    } as ASLStatement;
  }

  // MicroPython led.off() -> digitalWrite(pin, LOW)
  if (callee === 'Pin.off') {
    return {
      kind: 'digitalWrite',
      pin: transformExpr(node.children[0]),
      value: { kind: 'literal', value: 0 } as ASLExpr,
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
    // MicroPython Pin.value() -> digitalRead
    if (valueNode.attributes.callee === 'Pin.value') {
      return {
        kind: 'read',
        mode: 'DIGITAL',
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

    // MicroPython Pin.value() in expressions -> digitalRead
    if (callee === 'Pin.value') {
      return {
        kind: 'call',
        callee: 'digitalRead',
        args: [transformExpr(node.children[0])],
      } as ASLExpr;
    }

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

  if (node.nodeType === 'KeypadRead') {
    return {
      kind: 'call',
      callee: 'KeypadRead',
      args: [],
    } as ASLExpr;
  }

  if (node.nodeType === 'SubscriptExpression') {
    const arrayNode = node.children[0];
    const indexNode = node.children[1];
    // 2D: arr[i][j] → SubscriptExpression(SubscriptExpression(Identifier, i), j)
    if (arrayNode.nodeType === 'SubscriptExpression') {
      return {
        kind: 'index2D',
        array: transformExpr(arrayNode.children[0]),
        rowIndex: transformExpr(arrayNode.children[1]),
        colIndex: transformExpr(indexNode),
      } as ASLExpr;
    }
    return {
      kind: 'index',
      target: transformExpr(arrayNode),
      index: transformExpr(indexNode),
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
