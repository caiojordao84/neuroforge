import { transpileCode } from '../src/engine/asl/transpile';

async function testRustRoundTrip() {
    const rustCode = `
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

    console.log("--- Input Rust ---");
    console.log(rustCode);

    const result = await transpileCode(rustCode, 'rust', 'c');

    console.log("\n--- Transpiled C++ ---");
    if (result.success) {
        console.log(result.code);
    } else {
        console.warn("Transpilation failed!");
        console.warn(result.warnings);
    }
}

testRustRoundTrip().catch(console.error);
