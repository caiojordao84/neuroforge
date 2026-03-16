/**
 * Quick verification script: parse the user's Python LED code and transpile to C++.
 * Run with: npx tsx test_led_transpile.ts
 */
import { transpileCode } from './src/engine/asl/transpile';

const pythonCode = `from machine import Pin
import utime

leds = [Pin(i, Pin.OUT) for i in range(11, 14)]

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
        led.value(0)`;

async function main() {
    console.log("=== Python -> C++ Transpilation Test ===\n");
    console.log("--- Input Python ---");
    console.log(pythonCode);
    console.log("\n--- Output C++ ---");

    const result = await transpileCode(pythonCode, 'python', 'cpp');
    console.log(result.code);

    console.log("\n--- Checks ---");
    const checks = [
        { name: "Transpile succeeded", pass: result.success },
        { name: "Contains void setup()", pass: result.code.includes("void setup()") },
        { name: "Contains void loop()", pass: result.code.includes("void loop()") },
        { name: "Contains const int", pass: result.code.includes("const int") },
        { name: "Contains digitalWrite", pass: result.code.includes("digitalWrite") },
        { name: "Contains delay", pass: result.code.includes("delay(") },
        { name: "Contains pinMode", pass: result.code.includes("pinMode") },
        { name: "NO raw Pin() call", pass: !result.code.includes("Pin(") },
        { name: "NO auto leds[]", pass: !result.code.includes("auto leds[]") },
    ];

    let allPass = true;
    for (const c of checks) {
        console.log(`  ${c.pass ? "PASS" : "FAIL"} ${c.name}`);
        if (!c.pass) allPass = false;
    }

    if (result.warnings.length > 0) {
        console.log("\n--- Warnings ---");
        result.warnings.forEach(w => console.log(`  ${w}`));
    }

    console.log(allPass ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
    process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
