// fase5_serial_buffer_test.cjs - Teste das Serial Extensions
const fs = require('fs');

console.log('[TEST] ===== FASE 5: SERIAL BUFFER EXTENSIONS =====\n');

console.log('[TEST] --- Verificações de Código ---\n');

// Verificar SimulationEngine.ts
const simEngineCode = fs.readFileSync('./src/engine/SimulationEngine.ts', 'utf8');

const simChecks = [
  { name: 'serialRxBuffer propriedade privada', pattern: 'private serialRxBuffer' },
  { name: 'serialAvailable() usa buffer', pattern: 'return this.serialRxBuffer.length' },
  { name: 'serialRead() usa shift()', pattern: 'this.serialRxBuffer.shift()' },
  { name: 'serialWrite() método', pattern: 'serialWrite(value: number | string)' },
  { name: 'serialParseInt() método', pattern: 'serialParseInt(): number' },
  { name: 'serialInject() método', pattern: 'serialInject(text: string)' },
  { name: 'stop() limpa buffer', pattern: 'this.serialRxBuffer = []' },
];

let simPass = true;
for (const check of simChecks) {
  if (simEngineCode.includes(check.pattern)) {
    console.log(`[PASS] ${check.name}`);
  } else {
    console.log(`[FAIL] ${check.name} - não encontrado`);
    simPass = false;
  }
}

console.log('\n--- Verificações ASLExecutor ---\n');

// Verificar ASLExecutor.ts
const executorCode = fs.readFileSync('./src/engine/asl/ASLExecutor.ts', 'utf8');

const execChecks = [
  { name: 'Serial.available no executor', pattern: "expr.callee === 'Serial.available'" },
  { name: 'Serial.read no executor', pattern: "expr.callee === 'Serial.read'" },
  { name: 'Serial.write no executor', pattern: "expr.callee === 'Serial.write'" },
  { name: 'Serial.readString no executor', pattern: "expr.callee === 'Serial.readString'" },
  { name: 'Serial.parseInt no executor', pattern: "expr.callee === 'Serial.parseInt'" },
];

let execPass = true;
for (const check of execChecks) {
  if (executorCode.includes(check.pattern)) {
    console.log(`[PASS] ${check.name}`);
  } else {
    console.log(`[FAIL] ${check.name} - não encontrado`);
    execPass = false;
  }
}

// Verificar que random duplicado foi removido
const randomCount = (executorCode.match(/expr.callee === 'random'/g) || []).length;
if (randomCount === 1) {
  console.log(`[PASS] random sem duplicado (${randomCount} ocorrência)`);
} else {
  console.log(`[WARN] random tem ${randomCount} ocorrências (esperado: 1)`);
}

console.log('\n[TEST] ===== FIM DAS VERIFICAÇÕES =====\n');

if (simPass && execPass) {
  console.log('[SUCCESS] Todas as verificações passaram!');
} else {
  console.log('[ERROR] Algumas verificações falharam.');
  process.exit(1);
}
