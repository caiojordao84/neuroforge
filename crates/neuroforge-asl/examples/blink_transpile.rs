use neuroforge_asl::executor::{AslExecutor, TargetLanguage};
use neuroforge_asl::parser::neuro_parser::NeuroParser;
use neuroforge_asl::plugins::c::c_parser::CParser;

fn main() {
    // Input C/Arduino source code
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

    println!("=== INPUT C/Arduino Source ===");
    println!("{}", src);
    
    // Parse to ASL (intermediate representation)
    let program = CParser::parse(src).expect("parse failed");
    let asl_json = serde_json::to_string_pretty(&program).expect("serialization failed");
    
    println!("\n=== ASL (Intermediate Representation) ===");
    println!("{}", asl_json);
    
    // Transpile to Arduino C++ output
    let result = AslExecutor::run(src, &TargetLanguage::Arduino)
        .expect("transpile failed");
    
    println!("\n=== OUTPUT Arduino C++ (ino) ===");
    println!("{}", result.code);
}