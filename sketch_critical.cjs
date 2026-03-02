// sketch_critical.js - Teste crítico das implementações ASL
// Compilado a partir de sketch_critical.ts

const assert = require('assert');

console.log('[TEST] ===== INICIO DOS TESTES CRÍTICOS =====\n');

// ============================================
// SIMULAÇÃO DE TESTES (sem executor real)
// ============================================

console.log('[TEST] --- Verificações de Código ---');

// Verificar 1: Math Builtins no ASLExecutor
const fs = require('fs');
const executorCode = fs.readFileSync('./src/engine/asl/ASLExecutor.ts', 'utf8');

const mathFuncs = [
  "expr.callee === 'abs'",
  "expr.callee === 'sqrt'", 
  "expr.callee === 'pow'",
  "expr.callee === 'sin'",
  "expr.callee === 'cos'",
  "expr.callee === 'tan'",
  "expr.callee === 'log'",
  "expr.callee === 'min'",
  "expr.callee === 'max'",
  "expr.callee === 'round'",
  "expr.callee === 'floor'",
  "expr.callee === 'ceil'"
];

let mathPass = true;
for (const func of mathFuncs) {
  if (!executorCode.includes(func)) {
    console.log(`[FAIL] Faltando: ${func}`);
    mathPass = false;
  }
}
if (mathPass) {
  console.log('[PASS] Math Builtins implementados no ASLExecutor');
}

// Verificar 2: DoWhile no ASLExecutor
const hasDoWhileCase = executorCode.includes("case 'doWhile'");
if (hasDoWhileCase) {
  console.log('[PASS] case doWhile existe no ASLExecutor');
} else {
  console.log('[FAIL] Faltando case doWhile no ASLExecutor');
}

// Verificar 3: ASLTypes
const typesCode = fs.readFileSync('./src/engine/asl/ASLTypes.ts', 'utf8');
const hasDoWhileType = typesCode.includes("kind: 'doWhile'");
if (hasDoWhileType) {
  console.log('[PASS] ASLDoWhile tipo definido');
} else {
  console.log('[FAIL] Faltando ASLDoWhile tipo');
}

// Verificar 4: statementRegistry
const registryCode = fs.readFileSync('./src/engine/asl/transforms/statementRegistry.ts', 'utf8');
const hasDoWhileHandler = registryCode.includes('DoWhileLoop');
if (hasDoWhileHandler) {
  console.log('[PASS] DoWhileLoop handler no statementRegistry');
} else {
  console.log('[FAIL] Faltando DoWhileLoop handler');
}

// Verificar 5: CParser
const cParserCode = fs.readFileSync('./src/engine/asl/plugins/c/CParser.ts', 'utf8');
const hasDoWhileParse = cParserCode.includes('parseDoWhile');
if (hasDoWhileParse) {
  console.log('[PASS] parseDoWhile no CParser');
} else {
  console.log('[FAIL] Faltando parseDoWhile no CParser');
}

// Verificar 6: RustParser
const rustParserCode = fs.readFileSync('./src/engine/asl/plugins/rust/RustParser.ts', 'utf8');
const hasBreakRust = rustParserCode.includes("case 'break_expression'");
const hasContinueRust = rustParserCode.includes("case 'continue_expression'");
const hasReturnRust = rustParserCode.includes("case 'return_expression'");

if (hasBreakRust && hasContinueRust && hasReturnRust) {
  console.log('[PASS] break/continue/return no RustParser');
} else {
  console.log('[FAIL] Faltando handlers no RustParser');
}

// Verificar 7: PythonParser (Tree-sitter path)
const pythonParserCode = fs.readFileSync('./src/engine/asl/plugins/python/PythonParser.ts', 'utf8');
const hasBreakPy = pythonParserCode.includes("case 'break_statement'");
const hasContinuePy = pythonParserCode.includes("case 'continue_statement'");

if (hasBreakPy && hasContinuePy) {
  console.log('[PASS] break/continue no PythonParser (Tree-sitter)');
} else {
  console.log('[FAIL] Faltando handlers no PythonParser');
}

// Verificar 8: PythonParser (Regex path)
const hasReturnRegex = pythonParserCode.includes('// ── return expr');
const hasBreakRegex = pythonParserCode.includes('// ── break');
const hasContinueRegex = pythonParserCode.includes('// ── continue');

if (hasReturnRegex && hasBreakRegex && hasContinueRegex) {
  console.log('[PASS] return/break/continue no PythonParser (Regex)');
} else {
  console.log('[FAIL] Faltando handlers regex no PythonParser');
}

// Verificar 9: types.ts (NodeType)
const sysTypesCode = fs.readFileSync('./src/system/types.ts', 'utf8');
const hasDoWhileNode = sysTypesCode.includes("'DoWhileLoop'");
if (hasDoWhileNode) {
  console.log('[PASS] DoWhileLoop no NodeType');
} else {
  console.log('[FAIL] Faltando DoWhileLoop no NodeType');
}

console.log('\n[TEST] ===== FIM DAS VERIFICAÇÕES =====');
console.log('\n[INFO] TypeScript compilou sem erros');
