import { transpileCode } from '../src/engine/asl/transpile';
import * as fs from 'fs';

async function runSerialTests() {
  let output = '=== Starting Serial Transpilation Tests ===\n\n';

  // Case 5: Serial functions (Python to C++)
  const pyCode5 = `
Serial.begin(115200)
while True:
    if Serial.available() > 0:
        msg = Serial.readString()
        print("Received: " + msg)
`;
  output += '--- Test 5: Python to C++ (Serial) ---\n';
  const res5 = await transpileCode(pyCode5, 'python', 'cpp');
  output += 'Result:\n' + res5.code + '\n';
  output += 'Success: ' + res5.success + '\n\n';

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
  output += '--- Test 6: Rust to C++ (Serial) ---\n';
  const res6 = await transpileCode(rustCode6, 'rust', 'cpp');
  output += 'Result:\n' + res6.code + '\n';
  output += 'Success: ' + res6.success + '\n\n';

  output += '=== Serial Transpilation Tests Finished ===';
  
  fs.writeFileSync('serial_test_results.txt', output);
  console.log('Results written to serial_test_results.txt');
}

runSerialTests().catch(err => {
  fs.writeFileSync('serial_test_results.txt', 'Tests failed: ' + err.toString());
  process.exit(1);
});
