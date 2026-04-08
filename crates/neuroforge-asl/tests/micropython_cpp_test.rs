use neuroforge_asl::parser::NeuroParser;
use neuroforge_asl::plugins::c::CParser;
use neuroforge_asl::plugins::core::AslGenerator;
use neuroforge_asl::plugins::python::PythonGenerator;

#[test]
fn test_micropython_transpilation() {
    // Test transpilation from C to MicroPython
    let src = r#"
#include <Arduino.h>

const int ledPin = 9;
int brightness = 0;
int fadeAmount = 5;

void setup() {
    pinMode(ledPin, OUTPUT);
}

void loop() {
    analogWrite(ledPin, brightness);
    brightness += fadeAmount;
    if (brightness <= 0 || brightness >= 255) {
        fadeAmount = -fadeAmount;
    }
    delay(30);
}
"#;

    let ir = CParser::parse(src).expect("C parse failed");
    println!(
        "--- ASL IR JSON ---\n{}",
        serde_json::to_string_pretty(&ir).unwrap()
    );

    let mut py_gen = PythonGenerator::default();
    let py_out = py_gen.generate(&ir);
    println!("--- MicroPython Output ---\n{}", py_out.code);

    assert!(py_out.code.contains("from machine import Pin, PWM, ADC"));
    assert!(py_out.code.contains("from time import sleep_ms"));
    assert!(py_out.code.contains("brightness = 0"));
    assert!(py_out.code.contains("while True:"));
}
