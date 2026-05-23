use neuroforge_core::parser::NeuroParser;
use neuroforge_core::plugins::c::CParser;
use neuroforge_core::plugins::core::AslGenerator;
use neuroforge_core::plugins::python::PythonGenerator;
use neuroforge_core::plugins::rust_std::RustGenerator;

#[test]
fn test_arduino_fade_transpilation() {
    let src = r#"
#include <Arduino.h>

const int ledPin = 9; // Pin connected to the LED
int brightness = 0;    // Initial brightness
int fadeAmount = 5;    // Amount to change the brightness each cycle

void setup() {
    pinMode(ledPin, OUTPUT);
}

void loop() {
    analogWrite(ledPin, brightness); // Set the brightness of the LED

    brightness += fadeAmount; // Change the brightness for the next iteration

    // Reverse the direction of the fading at the ends
    if (brightness <= 0 || brightness >= 255) {
        fadeAmount = -fadeAmount;
    }

    delay(30); // Wait for 30 milliseconds to see the effect
}
"#;

    // 1. Parse C to ASL IR
    let ir = CParser::parse(src).expect("C parse failed");
    println!(
        "--- ASL IR JSON ---\n{}",
        serde_json::to_string_pretty(&ir).unwrap()
    );

    // 2. Generate Python
    let mut py_gen = PythonGenerator::default();
    let py_out = py_gen.generate(&ir);
    println!("--- Python Fade Output ---\n{}", py_out.code);

    // Assert Python fidelity (Flat script, duty_u16, flattening)
    assert!(py_out.code.contains("from machine import Pin, PWM"));
    assert!(py_out.code.contains("brightness = 0"));
    assert!(py_out.code.contains("ledPin = PWM(Pin(ledPin), freq=1000)"));
    assert!(py_out.code.contains("while True:"));
    assert!(py_out
        .code
        .contains("ledPin.duty_u16(int((brightness) * 257))"));
    assert!(py_out
        .code
        .contains("if ((brightness <= 0 or brightness >= 255)):"));
    assert!(py_out.code.contains("sleep_ms(30)"));

    // 3. Generate Rust
    let mut rust_gen = RustGenerator::default();
    let rust_out = rust_gen.generate(&ir);

    // Agora o output do Rust é multi-arquivo
    assert!(rust_out.files.is_some());
    let files = rust_out.files.as_ref().unwrap();
    assert!(files.contains_key("Cargo.toml"));
    assert!(files.contains_key("src/main.rs"));

    let main_rs = &rust_out.code;
    println!("--- Rust Fade Output (main.rs) ---\n{}", main_rs);

    // Assert Rust fidelity (no_std, Monolithic Main, Ledc)
    assert!(main_rs.contains("#![no_std]"));
    assert!(main_rs.contains("#![no_main]"));
    assert!(main_rs.contains("brightness"));
    assert!(main_rs.contains("fadeAmount"));
    assert!(main_rs.contains("Timer::after_millis(30).await"));

    // Verificar Cargo.toml
    let cargo_toml = files.get("Cargo.toml").unwrap();
    assert!(cargo_toml.contains("esp-hal"));
    assert!(cargo_toml.contains("esp-hal-embassy"));
}
