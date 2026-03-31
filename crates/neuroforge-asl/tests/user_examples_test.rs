use neuroforge_asl::executor::{AslExecutor, TargetLanguage};

#[test]
fn test_user_blink_transpilation() {
    let src = r#"
// NeuroForge — RP2040
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
"#;
    use neuroforge_asl::plugins::c::c_parser::CParser;
    use neuroforge_asl::types::nodes_to_typed::nodes_to_typed;
    use neuroforge_asl::transforms::code_to_asl::ast_to_asl;
    use neuroforge_asl::transforms::context::Language;
    use neuroforge_asl::plugins::python::python_generator::PythonGenerator;
    use neuroforge_asl::plugins::core::AslGenerator;

    let p = CParser::parse(src).expect("C parse failed");
    let t = nodes_to_typed(&p);
    let ir = ast_to_asl(&t, Language::Cpp);
    let out = PythonGenerator::new().generate(&ir);
    
    println!("--- Blink Output ---\n{}", out.code);
    assert!(out.code.contains("from machine import Pin"));
    assert!(out.code.contains("while True:"));
    assert!(out.code.contains("pin_13.on()"));
    assert!(out.code.contains("sleep_ms(500)"));
}

#[test]
fn test_user_pwm_transpilation() {
    let src = r#"
// NeuroForge — RP2040
const int ledPin = 13;
const int buttonPin = 14;
const int pwmMax = 255;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(115200);
}

void loop() {
  if (digitalRead(buttonPin) == LOW) {
    for (int i = 0; i <= pwmMax; i++) {
      analogWrite(ledPin, i);
      delay(1000 / pwmMax);
    }

    Serial.println("Light!");

    delay(1000);

    for (int i = pwmMax; i >= 0; i--) {
      analogWrite(ledPin, i);
      delay(1000 / pwmMax);
    }

    Serial.println("Dark!");

    delay(1000);

    while (digitalRead(buttonPin) == LOW) {
      delay(10);
    }
  }
}
"#;
    use neuroforge_asl::plugins::c::c_parser::CParser;
    use neuroforge_asl::types::nodes_to_typed::nodes_to_typed;
    use neuroforge_asl::transforms::code_to_asl::ast_to_asl;
    use neuroforge_asl::transforms::context::Language;
    use neuroforge_asl::plugins::python::python_generator::PythonGenerator;
    use neuroforge_asl::plugins::core::AslGenerator;

    let p = CParser::parse(src).expect("C parse failed");
    let t = nodes_to_typed(&p);
    let ir = ast_to_asl(&t, Language::Cpp);
    let out = PythonGenerator::new().generate(&ir);

    println!("--- PWM Output ---\n{}", out.code);
    
    // Check that identifiers are correctly extracted
    assert!(out.code.contains("ledPin = 13"));
    assert!(out.code.contains("buttonPin = 14"));
    assert!(out.code.contains("pwmMax = 255"));
    
    // Check hardware nodes
    assert!(out.code.contains("from machine import Pin, PWM, ADC"));
    assert!(out.code.contains("while True:"));
    assert!(out.code.contains("PWM(Pin(ledPin)).duty_u16"));
    
    // Check idiomatic mapping in if
    assert!(out.code.contains("if (Pin(buttonPin).value() == LOW):"));
}
