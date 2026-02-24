// src/engine/asl/codeToASL.ts
// Funil único: código textual (qualquer linguagem) → ProgramNode → ASLProgram.

import type { Language } from '@/types';
import type { ProgramNode, BaseNode } from '../../system/types';
import type {
  ASLProgram,
  ASLGlobalVar,
  ASLFunction,
  ASLTask,
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
      const { ast, symbols } = parser.parse(source);
      (globalThis as any).__cpParserSymbols = symbols;
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

/**
 * Simple evaluator for constant global initializers.
 * Supports literals, references to other globals, and basic arithmetic.
 */
function evaluateInitializer(node: BaseNode | undefined, globalsMap: Map<string, any>): any {
  if (!node) return 0;

  if (node.nodeType === 'Literal') {
    return node.attributes.value;
  }

  if (node.nodeType === 'Identifier') {
    return globalsMap.get(node.attributes.name) ?? 0;
  }

  if (node.nodeType === 'BinaryExpression') {
    const left = evaluateInitializer(node.children[0], globalsMap);
    const right = evaluateInitializer(node.children[1], globalsMap);
    const op = node.attributes.operator;
    switch (op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '/': return left / right;
      default: return 0;
    }
  }

  if (node.nodeType === 'ArrayInitializer') {
    return node.children.map(c => evaluateInitializer(c, globalsMap));
  }

  if (node.nodeType === 'UnaryExpression' && node.attributes.operator === '&') {
    const child = node.children[0];
    if (child.nodeType === 'Identifier') {
      return { __isPtr: true, target: child.attributes.name };
    }
    if (child.nodeType === 'SubscriptExpression') {
      const arrName = (child.children[0] as any).attributes.name;
      const idx = evaluateInitializer(child.children[1], globalsMap);
      return { __isPtr: true, target: arrName, index: idx };
    }
  }

  return 0;
}

export function astToASL(program: ProgramNode, language?: Language): ASLProgram {
  const ctx = createTransformContext(language);
  const globals: ASLGlobalVar[] = [];
  const functions: ASLFunction[] = [];
  const tasks: ASLTask[] = [];

  // Add macros from the parser (not in AST as nodes)
  const cParserSymbols = (globalThis as any).__cpParserSymbols;
  if (cParserSymbols) {
    cParserSymbols.forEach((sym: any) => {
      if (sym.isMacro && sym.value !== undefined) {
        ctx.globalsMap.set(sym.name, sym.value);
        globals.push({
          name: sym.name,
          type: 'int',
          initialValue: sym.value,
        });
      }
    });
  }

  const isPython = language === 'micropython' || language === 'circuitpython' || language === 'python';
  const topLevelNodes: BaseNode[] = [];

  program.children.forEach((node) => {
    if (!node) return;

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

    if (node.nodeType === 'StructDeclaration') {
      const name = node.attributes.name;
      const members = node.attributes.members || [];
      if (name) {
        ctx.structs.set(name, { members });
      }
      // If the struct declaration also has an instance (e.g., struct { ... } p;)
      if (node.children.length > 0) {
        node.children.forEach(child => {
          if (child.nodeType === 'VariableDeclaration') {
            // This will be handled in the VariableDeclaration branch if we don't return here
            // but let's just let it fall through or handle it explicitly.
          }
        });
      }
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
    } else if (node.nodeType === 'VariableDeclaration') {
      const name = node.attributes.name;
      const type = mapToASLType(node.attributes.type || 'int');
      const isArray = node.attributes.isArray;
      const isArray2D = node.attributes.isArray2D;

      let initialValue: any = 0;
      const valNode = node.children[0];

      if (valNode) {
        if (isArray && valNode.nodeType === 'ArrayInitializer') {
          initialValue = evaluateInitializer(valNode, ctx.globalsMap);
        } else {
          initialValue = evaluateInitializer(valNode, ctx.globalsMap);
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
        comments: node.leadingComments,
        progmem: node.attributes.isProgmem,
      } as any);

      ctx.globalsMap.set(name, safeInitialValue);
    } else {
      topLevelNodes.push(node);
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
      } else if (!existingLoop) {
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
    globals,
    functions,
    tasks,
  };
}
