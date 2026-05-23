use neuroforge_core::parser::neuro_parser::NeuroParser;
use neuroforge_core::plugins::c::c_parser::CParser;
use serde_toon;

fn main() {
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

    let program = CParser::parse(src).expect("parse failed");
    let toon = serde_toon::to_string(&program).expect("serialization failed");
    println!("{}", toon);
}
