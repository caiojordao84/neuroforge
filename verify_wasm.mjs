import { wasm_cross_transpile, default as init } from './apps/shared/src/lib/wasm/neuroforge_asl.js';
import { readFileSync } from 'fs';

async function verify() {
    const wasmBuffer = readFileSync('./apps/shared/src/lib/wasm/neuroforge_asl_bg.wasm');
    await init(wasmBuffer);
    
    const source = `
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  if (digitalRead(14) == LOW) {
    digitalWrite(13, HIGH);
  }
}
`;
    const python = wasm_cross_transpile(source, "cpp", "python");
    console.log("--- Transpiled Python ---");
    console.log(python);
    
    if (python.includes("Pin(14).value() == False") || python.includes("(Pin(14).value() == False)")) {
        console.log("[\u2713] Transpilation fidelity confirmed!");
    } else {
        console.error("[x] Transpilation fidelity fail! Expected 'Pin(14).value() == False', got:");
        console.error(python);
        process.exit(1);
    }
}

verify().catch(console.error);
