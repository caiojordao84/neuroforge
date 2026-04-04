// Test script for transpiling the user's Rust LED fade code to C++ and MicroPython

use neuroforge_asl::transpile::transpile;

fn main() {
    // The user's Rust code (simplified for testing - the full embassy/esp-hal code won't parse as standard Rust)
    let rust_code = r#"
#![no_std]
#![no_main]

fn main() {
    let mut brightness: i32 = 0;
    let mut fade_amount: i32 = 5;
    
    loop {
        // Set the brightness
        brightness = brightness + fade_amount;
        
        // Reverse at boundaries
        if brightness <= 0 || brightness >= 255 {
            fade_amount = -fade_amount;
        }
        
        delay_ms(30);
    }
}
"#;

    println!("=== Testing Rust to C++ transpilation ===");
    match transpile(rust_code, "c++") {
        Ok(code) => {
            println!("C++ Output:\n{}", code);
            println!("\n---\n");
        }
        Err(e) => println!("C++ Error: {}", e),
    }

    println!("=== Testing Rust to MicroPython transpilation ===");
    match transpile(rust_code, "micropython") {
        Ok(code) => {
            println!("MicroPython Output:\n{}", code);
            println!("\n---\n");
        }
        Err(e) => println!("MicroPython Error: {}", e),
    }

    // Also try with a simpler C code to test the C++ generator
    println!("=== Testing C to C++ transpilation (baseline) ===");
    let c_code = r#"
void setup() {
    pinMode(9, OUTPUT);
}

void loop() {
    digitalWrite(9, HIGH);
    delay(30);
    digitalWrite(9, LOW);
    delay(30);
}
"#;
    match transpile(c_code, "c++") {
        Ok(code) => println!("C++ Output from C:\n{}", code),
        Err(e) => println!("C++ Error: {}", e),
    }

    // Test with C to MicroPython
    println!("\n=== Testing C to MicroPython transpilation ===");
    match transpile(c_code, "micropython") {
        Ok(code) => println!("MicroPython Output from C:\n{}", code),
        Err(e) => println!("MicroPython Error: {}", e),
    }
}
