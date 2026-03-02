import { codeToASL } from '../src/engine/asl/codeToASL.js';

console.log('=== Postfix ++/-- Desugar Tests ===\n');

// Test 1: arr[i++] - subscript index
console.log('--- Test 1: arr[i++] ---');
const code1 = `
int arr[5] = {1, 2, 3, 4, 5};
for (int i = 0; i < 5; i++) {
  Serial.print(arr[i++]);
}
`;
try {
  const asl1 = await codeToASL(code1, 'cpp');
  console.log('--- TEST 1 ASL ---');
  console.log(JSON.stringify(asl1, null, 2));
  const setupFn = asl1.functions.find(f => f.name === 'setup');
  const loopFn = asl1.functions.find(f => f.name === 'loop');

  // Find temp assignment in loop
  const hasTempAssign = loopFn?.body.some(s =>
    s.kind === 'assign' && s.target?.includes('__tmp')
  );
  const hasIncrement = loopFn?.body.some(s =>
    s.kind === 'assign' && s.target === 'i' && s.value?.op === '+'
  );

  console.log('Has temp assignment:', !!hasTempAssign);
  console.log('Has increment:', !!hasIncrement);
  console.log('Test 1:', hasTempAssign && hasIncrement ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 1 FAILED:', e.message);
}

console.log('');

// Test 2: x = i++ - assign RHS
console.log('--- Test 2: x = i++ ---');
const code2 = `
void setup() {
  int i = 5;
  int x = i++;
  Serial.print(x);
  Serial.print(i);
}
`;
try {
  const asl2 = await codeToASL(code2, 'cpp');
  const setupFn = asl2.functions.find(f => f.name === 'setup');

  const stmts = setupFn?.body || [];
  const hasTempAssign = stmts.some(s =>
    s.kind === 'assign' && s.target?.includes('__tmp')
  );
  const hasIncrement = stmts.some(s =>
    s.kind === 'assign' && s.target === 'i'
  );

  console.log('Has temp assignment:', !!hasTempAssign);
  console.log('Has increment:', !!hasIncrement);
  console.log('Test 2:', hasTempAssign && hasIncrement ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 2 FAILED:', e.message);
}

console.log('');

// Test 3: prefix ++i - should work without desugaring
console.log('--- Test 3: ++i (prefix) ---');
const code3 = `
void setup() {
  int i = 5;
  int x = ++i;
  Serial.print(x);
  Serial.print(i);
}
`;
try {
  const asl3 = await codeToASL(code3, 'cpp');
  const setupFn = asl3.functions.find(f => f.name === 'setup');

  // Prefix should NOT create temp var - it should transform to binary
  const hasTempAssign = setupFn?.body.some(s =>
    s.kind === 'assign' && s.target?.includes('__tmp')
  );

  console.log('Should NOT have temp (prefix):', !hasTempAssign);
  console.log('Test 3:', !hasTempAssign ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 3 FAILED:', e.message);
}

console.log('');

// Test 4: i-- in subscript
console.log('--- Test 4: arr[i--] ---');
const code4 = `
int arr[5] = {1, 2, 3, 4, 5};
for (int i = 4; i >= 0; i--) {
  Serial.print(arr[i--]);
}
`;
try {
  const asl4 = await codeToASL(code4, 'cpp');
  const loopFn = asl4.functions.find(f => f.name === 'loop');

  const hasTempAssign = loopFn?.body.some(s =>
    s.kind === 'assign' && s.target?.includes('__tmp')
  );
  const hasDecrement = loopFn?.body.some(s =>
    s.kind === 'assign' && s.target === 'i' && s.value?.op === '-'
  );

  console.log('Has temp assignment:', !!hasTempAssign);
  console.log('Has decrement:', !!hasDecrement);
  console.log('Test 4:', hasTempAssign && hasDecrement ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 4 FAILED:', e.message);
}

console.log('');

// Test 5: Multiple postfix in same expression
console.log('--- Test 5: Multiple postfix i++, j++ ---');
const code5 = `
void setup() {
  int i = 0;
  int j = 0;
  int a = i++;
  int b = j++;
}
`;
try {
  const asl5 = await codeToASL(code5, 'cpp');
  const setupFn = asl5.functions.find(f => f.name === 'setup');

  const stmts = setupFn?.body || [];
  const tempCount = stmts.filter(s =>
    s.kind === 'assign' && s.target?.includes('__tmp')
  ).length;

  console.log('Temp assignments found:', tempCount);
  console.log('Test 5:', tempCount >= 2 ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 5 FAILED:', e.message);
}

console.log('');

// Test 6: Nested postfix
console.log('--- Test 6: arr[i++ + j++] ---');
const code6 = `
void setup() {
  int arr[10] = {0,1,2,3,4,5,6,7,8,9};
  int i = 0;
  int j = 0;
  int x = arr[i++ + j++];
}
`;
try {
  const asl6 = await codeToASL(code6, 'cpp');
  const setupFn = asl6.functions.find(f => f.name === 'setup');

  const stmts = setupFn?.body || [];
  const hasTempI = stmts.some(s =>
    s.kind === 'assign' && s.target === '__tmp_i'
  );
  const hasTempJ = stmts.some(s =>
    s.kind === 'assign' && s.target === '__tmp_j'
  );

  console.log('Has temp_i:', !!hasTempI);
  console.log('Has temp_j:', !!hasTempJ);
  console.log('Test 6:', hasTempI && hasTempJ ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('Test 6 FAILED:', e.message);
}

console.log('\n=== Tests Finished ===');
