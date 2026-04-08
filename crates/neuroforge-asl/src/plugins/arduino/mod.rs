//! Arduino language plugin module.
//!
//! This plugin generates Arduino-compatible C++ code from ASL programs.
//! It extends the C generator with Arduino-specific features:
//! - Uses void setup() and void loop() structure
//! - GPIO mapping with pinMode, digitalWrite, digitalRead, analogWrite, analogRead
//! - Serial communication (Serial.begin, Serial.print, Serial.println)
//! - I2C (Wire library)
//! - SPI library
//! - Servo control

pub mod arduino_generator;

pub mod arduino_parser;

pub use arduino_generator::ArduinoGenerator;

pub use arduino_parser::ArduinoParser;
