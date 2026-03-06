import { codeToAST } from './src/engine/asl/codeToASL';
import { normalizeAST } from './src/engine/asl/transforms/astNormalizer';

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
    const ast = await codeToAST(pythonCode, 'python');
    const normalized = normalizeAST(ast);

    // Find the VariableDeclaration for 'leds'
    for (const child of normalized.children) {
        if (child.nodeType === 'VariableDeclaration' && child.attributes.name === 'leds') {
            console.log("=== 'leds' VariableDeclaration AST ===");
            console.log(JSON.stringify(child, null, 2));
        }
    }
}

main().catch(e => console.error(e));
