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
import { createTransformContext, type TransformContext } from './transforms/context';
import { transformBlock } from './transforms/blockTransform';
import { mapToASLType } from './helpers/typeUtils';
import { buildEmptyArray, deepCopyValue } from './helpers/arrayUtils';
import { transformExpr } from './transforms/exprTransform';

export async function codeToASL(source: string, language: Language): Promise<ASLProgram> {
  const programAst = await parseToProgramNode(source, language);
  return astToASL(programAst, language);
}

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
      return { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
  }
}

export function astToASL(program: ProgramNode, language?: Language): ASLProgram {
  const ctx = createTransformContext(language);
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
      topLevelNodes.push(node);

      if (node.nodeType === 'VariableDeclaration') {
        if (node.attributes.isExtern) return;

        const name = node.attributes.name;
        const type = mapToASLType(node.attributes.type || 'int');
        const isArray = node.attributes.isArray;
        const isArray2D = node.attributes.isArray2D;
        let initialValue: any = 0;

        const valNode = node.children[0];
        if (valNode) {
          if (valNode.nodeType === 'ArrayInitializer') {
            if (isArray2D && valNode.attributes.isArray2D) {
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
              initialValue = valNode.children.map((c) => {
                const e = transformExpr(c);
                if (e.kind === 'literal') return e.value;
                return 0;
              });
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
        } as any);

        ctx.globalsMap.set(name, safeInitialValue);
      }
    }
  });

  if (topLevelNodes.length > 0) {
    const topLevelStmts = transformBlock(topLevelNodes, ctx);
    const existingLoop = tasks.find((t) => t.name === 'mainLoop');

    if (isPython) {
      if (existingLoop) {
        existingLoop.body.unshift(...topLevelStmts);
      } else {
        tasks.push({ name: 'mainLoop', body: topLevelStmts });
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
