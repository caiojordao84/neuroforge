import { transpileCode } from '../src/engine/asl/transpile.ts';

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

  // Case 5: Serial functions (Python to C++)
  const pyCode5 = `
Serial.begin(115200)
while True:
    if Serial.available() > 0:
        msg = Serial.readString()
        print("Received: " + msg)
`;
  console.log('--- Test 5: Python to C++ (Serial) ---');
  const res5 = await transpileCode(pyCode5, 'python', 'cpp');
  console.log('Source:', pyCode5);
  console.log('Result:\n', res5.code);
  console.log('Success:', res5.success, '\n');

  // Case 6: Serial functions (Rust to C++)
  const rustCode6 = `
fn setup() {
    Serial::begin(9600);
}
fn loop() {
    if Serial::available() > 0 {
        let s = Serial::read_string();
        println!("Got: {}", s);
    }
}
`;
  console.log('--- Test 6: Rust to C++ (Serial) ---');
  const res6 = await transpileCode(rustCode6, 'rust', 'cpp');
  console.log('Source:', rustCode6);
  console.log('Result:\n', res6.code);
  console.log('Success:', res6.success, '\n');

  console.log('=== Transpilation Tests Finished ===');
}

runTests().catch(err => {
  console.error('Tests failed:', err);
  process.exit(1);
});
