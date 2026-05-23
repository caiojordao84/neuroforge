use neuroforge_core::transpile;
use std::fs;
use std::path::Path;

#[test]
fn verify_blink_asl() {
    let path = Path::new("../../dendriforge/core/asl/v010/examples/basic-blink-logic.toon");
    let source = fs::read_to_string(path).expect("Failed to read basic-blink-logic.toon");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Basic blink logic TOON failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Basic blink logic TOON failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Basic blink logic TOON failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_button_toggle_asl() {
    let path = Path::new("../../dendriforge/core/asl/v010/examples/dual-button-led-control.toon");
    let source = fs::read_to_string(path).expect("Failed to read dual-button-led-control.toon");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Dual button led control TOON failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Dual button led control TOON failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Dual button led control TOON failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_sensor_threshold_asl() {
    let path = Path::new("../../dendriforge/core/asl/v010/examples/rain-alarm-analog-logic.toon");
    let source = fs::read_to_string(path).expect("Failed to read rain-alarm-analog-logic.toon");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Rain alarm analog logic TOON failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Rain alarm analog logic TOON failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Rain alarm analog logic TOON failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_yaml_parsing() {
    use pest::Parser;
    let path = Path::new("../../dendriforge/core/asl/v010/examples/basic-blink-logic.toon");
    let source = fs::read_to_string(path).expect("Failed to read basic-blink-logic.toon");
    
    // Parse using Pest
    let parsed = neuroforge_core::parser::asl_parser::AslPestParser::parse(
        neuroforge_core::parser::asl_parser::Rule::asl_document,
        &source
    ).expect("Failed to parse TOON with Pest");
    
    let pair = parsed.into_iter().next().unwrap();
    let toon_prog = neuroforge_core::parser::asl_builder::AslBuilder::build_program(pair)
        .expect("Failed to build TOON program");
    
    let program = neuroforge_core::asl_types::AslProgram::from(toon_prog);
    
    // Serialize to YAML
    let yaml_str = serde_yaml::to_string(&program).expect("Failed to serialize to YAML");
    
    // Deserialize back
    let program_back: neuroforge_core::asl_types::AslProgram = serde_yaml::from_str(&yaml_str)
        .expect("Failed to deserialize from YAML");
        
    assert_eq!(program.tasks.len(), program_back.tasks.len());
}

