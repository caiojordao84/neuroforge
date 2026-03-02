import { transpileCode } from '../src/engine/asl/transpile';

async function testRoundTrip() {
    const pythonCode = `
# Arduino LED Blink Example
# LED connected to pin 13

import machine
import time

# Initialize digital pin 13 as an output
machine.Pin(13, machine.Pin.OUT)

# Initialize Serial communication
# Serial.begin(9600)
print("Arduino started!")

while True:
    # Turn the LED on
    machine.Pin(13, machine.Pin.OUT).value(1)
    print("LED ON")
    time.sleep_ms(1000)
    
    # Turn the LED off
    machine.Pin(13, machine.Pin.OUT).value(0)
    print("LED OFF")
    time.sleep_ms(1000)
`;

    console.log("--- Input MicroPython ---");
    console.log(pythonCode);

    const result = await transpileCode(pythonCode, 'python', 'c');

    console.log("\n--- Transpiled C++ ---");
    if (result.success) {
        console.log(result.code);
    } else {
        console.warn("Transpilation failed!");
        console.warn(result.warnings);
    }
}

testRoundTrip().catch(console.error);
