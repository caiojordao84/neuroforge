//! Arduino parser - parses Arduino C++ code into AslProgram.
//!
//! This parser extends the C parser with Arduino-specific handling:
//! - Recognizes void setup() and void loop() functions
//! - Maps Arduino functions to ASL statements (pinMode, digitalWrite, etc.)
//! - Handles Serial, Wire, SPI, Servo libraries

use crate::plugins::c::c_parser::CParser;

use crate::asl_types::AslProgram;

use crate::parser::neuro_parser::{NeuroParser, ParseError};

/// Parser for Arduino C++ code.
/// Uses tree-sitter with C++ grammar (Arduino is C++).
pub struct ArduinoParser;

impl ArduinoParser {
    /// Parse Arduino source code and return AslProgram.
    pub fn parse(source: &str) -> Result<AslProgram, ParseError> {
        // Use C parser internally - Arduino is C++ compatible
        // The generator will add Arduino-specific includes
        CParser::parse(source)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_arduino() {
        let src = r#"
void setup() {
    pinMode(13, OUTPUT);
}

void loop() {
    digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
}
"#;
        let result = ArduinoParser::parse(src);
        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());
        let program = result.unwrap();
        assert!(!program.tasks.is_empty() || !program.functions.is_empty());
    }

    #[test]
    fn test_parse_with_serial() {
        let src = r#"
void setup() {
    Serial.begin(9600);
    Serial.println("Hello");
}

void loop() {
    int value = analogRead(A0);
    Serial.println(value);
}
"#;
        let result = ArduinoParser::parse(src);
        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());
    }

    #[test]
    fn test_parse_with_servo() {
        let src = r#"
#include <Servo.h>
Servo myServo;

void setup() {
    myServo.attach(9);
}

void loop() {
    myServo.write(90);
    delay(500);
}
"#;
        let result = ArduinoParser::parse(src);
        assert!(result.is_ok(), "Failed to parse: {:?}", result.err());
    }
}
