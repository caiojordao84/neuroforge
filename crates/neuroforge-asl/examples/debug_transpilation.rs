use neuroforge_asl::plugins::c::c_parser::CParser;
use neuroforge_asl::parser::neuro_parser::NeuroParser;
use neuroforge_asl::plugins::python::python_generator::PythonGenerator;
use neuroforge_asl::plugins::core::AslGenerator;

fn main() {
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

    let ir = CParser::parse(src).expect("C parse failed");
    let out = PythonGenerator::new().generate(&ir);

    println!("--- PWM Output ---\n{}", out.code);
}
