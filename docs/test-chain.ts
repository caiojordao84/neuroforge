import { transpileCode } from '../src/engine/asl/transpile';

async function testChain() {
    const originalRust = `
// Generated Rust Code
#![no_std]
#![no_main]

use esp_hal::prelude::*;

#[entry]
fn main() -> ! {
    let peripherals = Peripherals::take();
    let system = peripherals.SYSTEM.split();
    let clocks = ClockControl::boot_defaults(system.clock_control).freeze();
    let mut delay = Delay::new(&clocks);

    // Arduino LED Blink Example
    // LED connected to pin 13
    // Setup
    // Initialize digital pin 13 as an output
    pinMode(13, 1);
    // Initialize Serial communication
    Serial.begin(9600);
    println!("{}", "Arduino started!");

    loop {
        // Turn the LED on
        gpio_set(13, 1);
        println!("{}", "LED ON");
        delay.delay_ms(1000u32);
        // Turn the LED off
        gpio_set(13, 0);
        println!("{}", "LED OFF");
        delay.delay_ms(1000u32);
    }
}
`;

    console.log("=== STEP 0: Original Rust ===");
    console.log(originalRust);

    // Step 1: Rust -> MicroPython
    const step1 = await transpileCode(originalRust, 'rust', 'python');
    console.log("\n=== STEP 1: Transpiled to MicroPython ===");
    console.log(step1.code);

    // Step 2: MicroPython -> Rust
    const step2 = await transpileCode(step1.code, 'python', 'rust');
    console.log("\n=== STEP 2: Transpiled back to Rust ===");
    console.log(step2.code);

    // Step 3: Rust -> C++
    const step3 = await transpileCode(step2.code, 'rust', 'c');
    console.log("\n=== STEP 3: Transpiled to C++ ===");
    console.log(step3.code);

    // Step 4: C++ -> MicroPython
    const step4 = await transpileCode(step3.code, 'c', 'python');
    console.log("\n=== STEP 4: Transpiled to MicroPython ===");
    console.log(step4.code);
}

testChain().catch(console.error);
