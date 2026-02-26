import { PythonParser } from './src/engine/asl/plugins/python/PythonParser';
import { codeToASL } from './src/engine/asl/codeToASL';

async function test() {
    const code = `
from machine import Pin
import utime

leds = [Pin(i, Pin.OUT) for i in range(2, 6)]

for led in leds:
    led.value(0)

while True:
    for led in leds:
        led.value(1)
        utime.sleep(0.5)
        led.value(0)

    for led in reversed(leds):
        led.value(1)
        utime.sleep(0.5)
        led.value(0)
`;

    console.log("=== Testing Python 5-LED Sequence ===");
    const parser = new PythonParser();
    await parser.init();
    const { ast, errors } = parser.parse(code);

    if (errors.length > 0) {
        console.error("Errors:", errors);
        return;
    }

    // console.log("AST:", JSON.stringify(ast, null, 2));

    const asl = await codeToASL(code, 'python');
    console.log("ASL Program generated successfully");

    // Check globals
    const ledsGlobal = asl.globals.find(g => g.name === 'leds');
    console.log("Global 'leds':", ledsGlobal ? "Found" : "NOT FOUND");

    // Check mainLoop
    const mainLoop = asl.tasks.find(t => t.name === 'mainLoop');
    console.log("Main Loop statements count:", mainLoop?.body.length);

    // Verify some specific structures
    const forLoops = JSON.stringify(asl).match(/"kind":"for"/g) || [];
    console.log("For loops found in ASL:", forLoops.length);

    // Check if reversed logic is present (should have a decrement loop)
    const reversedLoop = JSON.stringify(asl).includes('"op":"--"');
    console.log("Reversed loop (--) present:", reversedLoop ? "YES" : "NO");

    const lenCall = JSON.stringify(asl).includes('"callee":"len"');
    console.log("len() calls present:", lenCall ? "YES" : "NO");
}

test().catch(console.error);
