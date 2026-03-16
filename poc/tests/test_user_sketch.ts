import { codeToASL } from './src/engine/asl/codeToASL';
import { createASLRuntime } from './src/engine/asl/ASLExecutor';
import { EventEmitter } from 'events';

async function test() {
    const code = `
from machine import Pin
import utime

# Define nomes para cada LED
led_names = {
    2: "LED Vermelho",
    3: "LED Verde",
    4: "LED Azul",
    5: "LED Amarelo",
    6: "LED Branco"
}

# Inicializa os pinos dos LEDs (GPIOs 2 a 6)
leds = [Pin(i, Pin.OUT) for i in range(2, 7)]

# Garante que todos os LEDs comecem apagados
for led in leds:
    led.value(0)

while True:
    # Sequência direta
    for led in leds:
        print("Acendendo:", led_names[led.id()])
        led.value(1)
        utime.sleep(0.1) # Reduzido para teste
        led.value(0)

    # Sequência reversa
    for led in reversed(leds):
        print("Acendendo:", led_names[led.id()])
        led.value(1)
        utime.sleep(0.1) # Reduzido para teste
        led.value(0)
`;

    console.log("=== Testing User's 2nd Sketch (Dictionaries & led.id()) ===");
    try {
        const asl = await codeToASL(code, 'python');
        console.log("ASL Program generated successfully");
        console.log(JSON.stringify(asl, null, 2));

        // Mock engine
        const engine = new EventEmitter() as any;
        engine.pins = new Map();
        engine.digitalWrite = (pin: number, val: string) => {
            const v = val === 'HIGH' ? 1 : 0;
            engine.pins.set(pin, v);
        };
        engine.pinMode = (pin: number, mode: string) => { };
        engine.log = (msg: string) => console.log(`[PYTHON PRINT] ${msg}`);
        engine.digitalRead = (pin: number) => engine.pins.get(pin) === 1 ? 'HIGH' : 'LOW';
        engine.delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms / 10));

        const runtime = createASLRuntime(asl, { engine });

        console.log("Running simulation for 2 seconds...");

        runtime.setup();
        runtime.loop();

        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("Simulation test finished.");
        process.exit(0);

    } catch (err) {
        console.error("Test failed:", err);
        process.exit(1);
    }
}

test();
