import { PythonParser } from './src/engine/asl/plugins/python/PythonParser';
import { createASLRuntime } from './src/engine/asl/ASLExecutor';
import { SimulationEngine } from './src/engine/SimulationEngine';
import { codeToASL } from './src/engine/asl/codeToASL';

async function run() {
    const code = `
import time
print("Start")
time.sleep_us(1500000)
a = time.ticks_ms()
b = time.ticks_us()
print("Millis:", a)
print("Micros:", b)
`;

    let program;
    try {
        program = await codeToASL(code, 'python');
        console.log(JSON.stringify(program, null, 2));
    } catch (e) {
        console.error("Compilation error:", e);
        return;
    }

    const engine = new SimulationEngine();
    let outputs: any[] = [];
    engine.serialPrint = (x) => outputs.push(x);
    engine.serialPrintln = (x) => outputs.push(x + '\\n');

    const runtime = createASLRuntime(program, { engine });

    // We expect the script to pause for ~1ms.
    const start = Date.now();
    await runtime.setup();
    await runtime.loop();
    const end = Date.now();

    console.log("Time elapsed:", end - start);
    console.log("Outputs: " + JSON.stringify(outputs));
}

run();
