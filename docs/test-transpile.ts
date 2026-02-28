import { transpileCode } from '../src/engine/asl/transpile';

async function runTests() {
    console.log('=== Starting Transpilation Tests ===\n');

    // Case 1: Python to C++ (Basic)
    const pyCode1 = 'print("Hello NeuroForge")';
    console.log('--- Test 1: Python to C++ (Basic) ---');
    const res1 = await transpileCode(pyCode1, 'python', 'cpp');
    console.log('Source:', pyCode1);
    console.log('Result:\n', res1.code);
    console.log('Success:', res1.success, '\n');

    // Case 2: C++ to Python (Basic)
    const cppCode2 = 'void setup() { digitalWrite(13, HIGH); }';
    console.log('--- Test 2: C++ to Python (Basic) ---');
    const res2 = await transpileCode(cppCode2, 'cpp', 'micropython');
    console.log('Source:', cppCode2);
    console.log('Result:\n', res2.code);
    console.log('Success:', res2.success, '\n');

    // Case 3: Complex (Analog, Loops, Arrays)
    const cppCode3 = `
void setup() {
  pinMode(A0, INPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  int sensorValue = analogRead(A0);
  int brightness = sensorValue / 4;
  analogWrite(13, brightness);
  
  int data[5] = {10, 20, 30, 40, 50};
  for (int i = 0; i < 5; i++) {
    Serial.println(data[i]);
    delay(100);
  }
}
`;
    console.log('--- Test 3: C++ to Python (Complex) ---');
    const res3 = await transpileCode(cppCode3, 'cpp', 'micropython');
    console.log('Source:', cppCode3);
    console.log('Result:\n', res3.code);
    console.log('Success:', res3.success, '\n');

    // Case 4: 2D Arrays
    const cppCode4 = `
int matrix[2][3] = {
  {1, 2, 3},
  {4, 5, 6}
};
`;
    console.log('--- Test 4: C++ to Python (2D Arrays) ---');
    const res4 = await transpileCode(cppCode4, 'cpp', 'micropython');
    console.log('Source:', cppCode4);
    console.log('Result:\n', res4.code);
    console.log('Success:', res4.success, '\n');

    console.log('=== Transpilation Tests Finished ===');
}

runTests().catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
});
