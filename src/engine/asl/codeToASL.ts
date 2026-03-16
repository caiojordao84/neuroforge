// src/engine/asl/codeToASL.ts
// Funil único: código textual (qualquer linguagem) → ProgramNode → ASLProgram.

import type { Language } from '@/types';
import type { ProgramNode, BaseNode } from '../../system/types';
import type {
  ASLProgram,
  ASLGlobalVar,
  ASLFunction,
  ASLTask,
  ASLStructDef,
} from './ASLTypes';
import { RecursiveDescentCParser } from './plugins/c/CParser';
import { PythonParser } from './plugins/python/PythonParser';
import { RustParser } from './plugins/rust/RustParser';
import { createTransformContext, type TransformContext } from './transforms/context';
import { transformBlock } from './transforms/blockTransform';
import { mapToASLType } from './helpers/typeUtils';
import { buildEmptyArray, deepCopyValue, resolveSize } from './helpers/arrayUtils';
import { transformExpr } from './transforms/exprTransform';
import { normalizeAST } from './transforms/astNormalizer';
import type { Library } from '@/stores/useLibraryStore';

export async function codeToASL(source: string, language: Language, libraries: Library[] = []): Promise<ASLProgram> {
  console.log(`[codeToASL] Starting transpilation for ${language}. Libraries: ${libraries.length}`);
  try {
    let programAst = await codeToAST(source, language, libraries);
    console.log(`[codeToASL] AST Generated. Top nodes: ${programAst.children.length}`);
    programAst = normalizeAST(programAst);
    const asl = astToASL(programAst, language);
    console.log(`[codeToASL] ASL Program generated. Globals: ${asl.globals.length}, Tasks: ${asl.tasks.length}`);
    return asl;
  } catch (e) {
    console.error(`[codeToASL] Critical failure:`, e);
    throw e;
  }
}

export async function codeToAST(source: string, language: Language, libraries: Library[] = []): Promise<ProgramNode> {
  switch (language) {
    case 'c':
    case 'cpp': {
      const parser = new RecursiveDescentCParser();
      if (libraries.length > 0) {
        parser.setLibraries(libraries.map(l => ({ name: l.name, content: l.content })));
      }
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

    case 'rust': {
      const parser = new RustParser();
      await parser.init();
      const { ast } = parser.parse(source);
      return ast;
    }

    default:
      return { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
  }
}

export function astToASL(program: ProgramNode, language?: Language): ASLProgram {
  const ctx = createTransformContext(language);
  ctx.transformBlock = transformBlock;
  const structs: ASLStructDef[] = [];
  const globals: ASLGlobalVar[] = [];
  const functions: ASLFunction[] = [];
  const tasks: ASLTask[] = [];

  const topLevelNodes: BaseNode[] = [];
  const isPython = language === 'micropython' || language === 'circuitpython' || language === 'python';

  program.children.forEach((node) => {
    if (!node) return;

    if (node.nodeType === 'StructDeclaration') {
      const def: ASLStructDef = {
        name: node.attributes.name,
        fields: node.attributes.fields || [],
      };
      structs.push(def);
      ctx.structDefs = ctx.structDefs ?? {};
      ctx.structDefs[def.name] = def;

      if (node.attributes.inlineInstance) {
        const instName = node.attributes.inlineInstance as string;
        const zeroObj: Record<string, any> = {};
        def.fields.forEach((f) => { zeroObj[f.name] = 0; });
        const initVal = deepCopyValue(zeroObj);
        globals.push({
          name: instName,
          type: 'struct',
          initialValue: initVal,
          structType: def.name,
        });
        ctx.globalsMap.set(instName, initVal);
      }
      return;
    }

    if (node.nodeType === 'EnumDeclaration') {
      const members = node.attributes.members || [];
      members.forEach((m: { name: string, value: number }) => {
        globals.push({
          name: m.name,
          type: 'int',
          initialValue: m.value,
        });
        ctx.globalsMap.set(m.name, m.value);
      });
      return;
    }

    if (node.nodeType === 'Function') {
      const name = node.attributes.name;
      const params: any[] = node.attributes.params || [];
      const body = transformBlock(node.children, ctx);

      if (node.leadingComments) {
        for (let i = node.leadingComments.length - 1; i >= 0; i--) {
          body.unshift({ kind: 'comment', text: node.leadingComments[i] });
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
      if (node.nodeType !== 'VariableDeclaration') {
        topLevelNodes.push(node);
      } else {
        if (node.attributes.isExtern) return;
        const valNode = node.children[0];
        // If it's a global with a complex initializer (not literal),
        // we must also emit it as a statement to ensures it's evaluated at runtime.
        if (valNode && valNode.nodeType !== 'Literal') {
          topLevelNodes.push(node);
        }
      }

      if (node.nodeType === 'VariableDeclaration') {
        const name = node.attributes.name;
        const type = mapToASLType(node.attributes.type || 'int');
        const isArray = node.attributes.isArray;
        const isArray2D = node.attributes.isArray2D;
        let initialValue: any = 0;

        const valNode = node.children[0];
        if (valNode) {
          // --- S5: Pre-register special objects (RGBLED, PWM) so functions can see them ---
          if (valNode.nodeType === 'CallExpression') {
            const callee = valNode.attributes.callee;
            if (callee === 'RGBLED') {
              let pins = valNode.attributes.pins;
              if (!pins && valNode.children.length >= 3) {
                pins = { r: valNode.children[0], g: valNode.children[1], b: valNode.children[2] };
              }
              if (pins) ctx.rgbPins?.set(name, pins);
              initialValue = {};
            } else if (callee === 'PWM') {
               const pinNode = valNode.children[0];
               let actualPin = pinNode;
               if (pinNode && pinNode.nodeType === 'CallExpression' && pinNode.attributes.callee === 'Pin') {
                 actualPin = pinNode.children[0];
               }
               if (actualPin) ctx.pwmPins?.set(name, actualPin);
               initialValue = 0;
            }
          }

          if (valNode.nodeType === 'ArrayInitializer') {
            const structType = node.attributes.structType;
            const structDef = structType ? ctx.structDefs?.[structType] : null;

            if (structDef && !isArray) {
              // Map array initializer to struct fields
              const obj: Record<string, any> = {};
              structDef.fields.forEach((f, i) => {
                const c = valNode.children[i];
                if (c) {
                  const e = transformExpr(c);
                  obj[f.name] = e.kind === 'literal' ? e.value : 0;
                } else {
                  obj[f.name] = 0;
                }
              });
              initialValue = obj;
            } else if (isArray2D && valNode.attributes.isArray2D) {
              const rows = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
              const cols = resolveSize(node.attributes.arraySize2Expr, ctx.globalsMap) || 0;

              initialValue = Array(rows).fill(null).map((_, i) => {
                const rowNode = valNode.children[i];
                const row = Array(cols).fill(0);
                if (rowNode && rowNode.nodeType === 'ArrayInitializer' && rowNode.attributes.isRow) {
                  rowNode.children.forEach((c, j) => {
                    if (j < cols) {
                      const e = transformExpr(c);
                      row[j] = e.kind === 'literal' ? e.value : 0;
                    }
                  });
                }
                return row;
              });
            } else if (structDef && isArray) {
              // Array of structs: map each row to an object with field names
              const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
              initialValue = Array(size).fill(null).map((_, i) => {
                const obj: Record<string, any> = {};
                structDef.fields.forEach(f => { obj[f.name] = 0; });
                const rowNode = valNode.children[i];
                if (rowNode && rowNode.nodeType === 'ArrayInitializer') {
                  rowNode.children.forEach((c, j) => {
                    if (j < structDef.fields.length) {
                      const e = transformExpr(c);
                      obj[structDef.fields[j].name] = e.kind === 'literal' ? e.value : 0;
                    }
                  });
                }
                return obj;
              });
            } else {
              const size = resolveSize(node.attributes.arraySizeExpr, ctx.globalsMap) || valNode.children.length;
              const evaluateArray = (arrNode: BaseNode): any => {
                if (arrNode.nodeType === 'ArrayInitializer') {
                  return arrNode.children.map(c => {
                    const e = transformExpr(c);
                    if (e.kind === 'literal') return e.value;
                    if (e.kind === 'array') return evaluateArray(c);
                    return 0;
                  });
                }
                const et = transformExpr(arrNode);
                return et.kind === 'literal' ? et.value : 0;
              };
              initialValue = evaluateArray(valNode);
            }
          } else if (valNode.nodeType === 'Literal') {
            if (isArray) {
              initialValue = buildEmptyArray(
                node.attributes.arraySizeExpr,
                node.attributes.arraySize2Expr,
                ctx.globalsMap,
              );
            } else {
              initialValue = valNode.attributes.value;
            }
          }
        } else if (isArray) {
          initialValue = buildEmptyArray(
            node.attributes.arraySizeExpr,
            node.attributes.arraySize2Expr,
            ctx.globalsMap,
          );
        }

        const safeInitialValue = deepCopyValue(initialValue);

        globals.push({
          name,
          type: type as any,
          initialValue: safeInitialValue,
          structType: node.attributes.structType,
          comments: node.leadingComments,
          ...(node.attributes.isPointerArray ? { isPointerArray: true } : {}),
        } as any);

        ctx.globalsMap.set(name, safeInitialValue);
      }
    }
  });

  if (topLevelNodes.length > 0) {
    const topLevelStmts = transformBlock(topLevelNodes, ctx);
    const existingLoop = tasks.find((t) => t.name === 'mainLoop');

    if (isPython) {
      // Python top-level statements (e.g. pin setup, last_blink_time = ticks_ms())
      // must run exactly once — like Arduino's setup(). They go into a dedicated
      // 'pythonSetup' task so the engine executes them before scheduling the loop,
      // preventing variables such as last_blink_time from being reset on every tick.
      const setupTask = tasks.find((t) => t.name === 'pythonSetup');
      if (setupTask) {
        setupTask.body.push(...topLevelStmts);
      } else {
        tasks.unshift({ name: 'pythonSetup', body: topLevelStmts });
      }

      // If there is no explicit loop task yet (no `while True` was found),
      // create an empty mainLoop so the engine still has something to schedule.
      if (!existingLoop) {
        tasks.push({ name: 'mainLoop', body: [] });
      }
    } else {
      const setupFunc = functions.find(f => f.name === 'setup');
      if (setupFunc) {
        setupFunc.body.unshift(...topLevelStmts);
      } else if (existingLoop) {
        // C++ root nodes are typically globals
      } else {
        tasks.push({ name: 'mainLoop', body: topLevelStmts });
      }
    }
  }

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
    structs,
    globals,
    functions,
    tasks,
  };
}
