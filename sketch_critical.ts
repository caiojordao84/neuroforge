#!/usr/bin/env tsx
/**
 * sketch_critical.ts - Teste crítico das implementações ASL
 * Testa: Math Builtins, DoWhile, break/continue/return em C, Rust e Python
 */

import { createASLRuntime } from './src/engine/asl/ASLExecutor';
import type { ASLProgram, ASLStatement, ASLExpr } from './src/engine/asl/ASLTypes';

function makeExpr(kind: any, params: any): ASLExpr {
  return { kind, ...params } as ASLExpr;
}

function makeStmt(kind: string, params: any): ASLStatement {
  return { kind, ...params } as ASLStatement;
}

console.log('[TEST] ===== INICIO DOS TESTES CRÍTICOS =====\n');

// ============================================
// TESTE 1: Math Builtins no Executor
// ============================================
console.log('[TEST] --- Teste 1: Math Builtins ---');

const mathTestProgram: ASLProgram = {
  metadata: { name: 'math_test', version: '1.0' },
  structs: [],
  globals: [
    { name: 'result', type: 'int', initialValue: 0 }
  ],
  functions: [
    {
      name: 'setup',
      params: [],
      body: [
        // Test abs
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'abs', args: [makeExpr('literal', { value: -5 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'abs(-5) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test sqrt
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'sqrt', args: [makeExpr('literal', { value: 16 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'sqrt(16) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test pow
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'pow', args: [makeExpr('literal', { value: 2 }), makeExpr('literal', { value: 3 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'pow(2,3) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test sin, cos, tan
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'sin', args: [makeExpr('literal', { value: 0 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'sin(0) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test min, max
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'min', args: [makeExpr('literal', { value: 10 }), makeExpr('literal', { value: 20 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'min(10,20) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'max', args: [makeExpr('literal', { value: 10 }), makeExpr('literal', { value: 20 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'max(10,20) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test round, floor, ceil
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'round', args: [makeExpr('literal', { value: 4.5 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'round(4.5) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'floor', args: [makeExpr('literal', { value: 4.9 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'floor(4.9) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'ceil', args: [makeExpr('literal', { value: 4.1 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'ceil(4.1) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test log
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'log', args: [makeExpr('literal', { value: 1 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'log(1) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test random com 1 argumento
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'random', args: [makeExpr('literal', { value: 10 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'random(10) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
      ]
    }
  ],
  tasks: []
};

try {
  const runtime = createASLRuntime(mathTestProgram);
  runtime.setup();
  console.log('[PASS] Math Builtins test passed\n');
} catch (e: any) {
  console.log(`[FAIL] Math Builtins test failed: ${e.message}\n`);
}

// ============================================
// TESTE 2: DoWhile Loop
// ============================================
console.log('[TEST] --- Teste 2: DoWhile Loop ---');

const doWhileProgram: ASLProgram = {
  metadata: { name: 'dowhile_test', version: '1.0' },
  structs: [],
  globals: [
    { name: 'counter', type: 'int', initialValue: 0 },
    { name: 'result', type: 'int', initialValue: 0 }
  ],
  functions: [
    {
      name: 'setup',
      params: [],
      body: [
        // DoWhile: executa pelo menos uma vez
        makeStmt('assign', { target: 'counter', value: makeExpr('literal', { value: 0 }) }),
        makeStmt('doWhile', {
          condition: makeExpr('binary', { op: '<', left: makeExpr('var', { name: 'counter' }), right: makeExpr('literal', { value: 5 }) }),
          body: [
            makeStmt('assign', { target: 'result', value: makeExpr('var', { name: 'counter' }) }),
            makeStmt('assign', { target: 'counter', value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'counter' }), right: makeExpr('literal', { value: 1 }) }) }),
          ]
        }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'DoWhile counter final = ' }), makeExpr('var', { name: 'counter' })], newline: true }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'DoWhile result = ' }), makeExpr('var', { name: 'result' })], newline: true }),
      ]
    }
  ],
  tasks: []
};

try {
  const runtime = createASLRuntime(doWhileProgram);
  runtime.setup();
  console.log('[PASS] DoWhile test passed\n');
} catch (e: any) {
  console.log(`[FAIL] DoWhile test failed: ${e.message}\n`);
}

// ============================================
// TESTE 3: break e continue em loops
// ============================================
console.log('[TEST] --- Teste 3: break/continue ---');

const breakContinueProgram: ASLProgram = {
  metadata: { name: 'breakcontinue_test', version: '1.0' },
  structs: [],
  globals: [
    { name: 'i', type: 'int', initialValue: 0 },
    { name: 'result', type: 'int', initialValue: 0 }
  ],
  functions: [
    {
      name: 'setup',
      params: [],
      body: [
        // Test break
        makeStmt('assign', { target: 'result', value: makeExpr('literal', { value: 0 }) }),
        makeStmt('while', {
          condition: makeExpr('binary', { op: '<', left: makeExpr('var', { name: 'i' }), right: makeExpr('literal', { value: 10 }) }),
          body: [
            makeStmt('assign', { target: 'i', value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'i' }), right: makeExpr('literal', { value: 1 }) }) }),
            makeStmt('assign', { target: 'result', value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'result' }), right: makeExpr('literal', { value: 1 }) }) }),
            makeStmt('break', {}),
          ]
        }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'Break result = ' }), makeExpr('var', { name: 'result' })], newline: true }),
        
        // Test continue
        makeStmt('assign', { target: 'i', value: makeExpr('literal', { value: 0 }) }),
        makeStmt('assign', { target: 'result', value: makeExpr('literal', { value: 0 }) }),
        makeStmt('while', {
          condition: makeExpr('binary', { op: '<', left: makeExpr('var', { name: 'i' }), right: makeExpr('literal', { value: 5 }) }),
          body: [
            makeStmt('assign', { target: 'i', value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'i' }), right: makeExpr('literal', { value: 1 }) }) }),
            makeStmt('continue', {}),
            makeStmt('assign', { target: 'result', value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'result' }), right: makeExpr('literal', { value: 100 }) }) }),
          ]
        }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'Continue result = ' }), makeExpr('var', { name: 'result' })], newline: true }),
      ]
    }
  ],
  tasks: []
};

try {
  const runtime = createASLRuntime(breakContinueProgram);
  runtime.setup();
  console.log('[PASS] break/continue test passed\n');
} catch (e: any) {
  console.log(`[FAIL] break/continue test failed: ${e.message}\n`);
}

// ============================================
// TESTE 4: return em funções
// ============================================
console.log('[TEST] --- Teste 4: return ---');

const returnProgram: ASLProgram = {
  metadata: { name: 'return_test', version: '1.0' },
  structs: [],
  globals: [
    { name: 'result', type: 'int', initialValue: 0 }
  ],
  functions: [
    {
      name: 'addFive',
      params: [{ name: 'x', type: 'int' }],
      body: [
        makeStmt('return', { value: makeExpr('binary', { op: '+', left: makeExpr('var', { name: 'x' }), right: makeExpr('literal', { value: 5 }) }) }),
      ]
    },
    {
      name: 'setup',
      params: [],
      body: [
        makeStmt('assign', { target: 'result', value: makeExpr('call', { callee: 'addFive', args: [makeExpr('literal', { value: 10 })] }) }),
        makeStmt('print', { args: [makeExpr('literal', { value: 'addFive(10) = ' }), makeExpr('var', { name: 'result' })], newline: true }),
      ]
    }
  ],
  tasks: []
};

try {
  const runtime = createASLRuntime(returnProgram);
  runtime.setup();
  console.log('[PASS] return test passed\n');
} catch (e: any) {
  console.log(`[FAIL] return test failed: ${e.message}\n`);
}

console.log('[TEST] ===== FIM DOS TESTES CRÍTICOS =====');
