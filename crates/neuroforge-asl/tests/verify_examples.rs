use neuroforge_core::transpile;
use std::fs;
use std::path::Path;

#[test]
fn verify_blink_asl() {
    let path = Path::new("../../scratch/asl_examples/blink.asl");
    let source = fs::read_to_string(path).expect("Failed to read blink.asl");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Blink ASL failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Blink ASL failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Blink ASL failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_button_toggle_asl() {
    let path = Path::new("../../scratch/asl_examples/button_toggle.asl");
    let source = fs::read_to_string(path).expect("Failed to read button_toggle.asl");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Button toggle ASL failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Button toggle ASL failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Button toggle ASL failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_sensor_threshold_asl() {
    let path = Path::new("../../scratch/asl_examples/sensor_threshold.asl");
    let source = fs::read_to_string(path).expect("Failed to read sensor_threshold.asl");
    
    // Test C
    let res_c = transpile(&source, "c");
    assert!(res_c.is_ok(), "Sensor threshold ASL failed to transpile to C: {:?}", res_c.err());
    
    // Test Arduino
    let res_arduino = transpile(&source, "arduino");
    assert!(res_arduino.is_ok(), "Sensor threshold ASL failed to transpile to Arduino: {:?}", res_arduino.err());

    // Test Python
    let res_python = transpile(&source, "python");
    assert!(res_python.is_ok(), "Sensor threshold ASL failed to transpile to Python: {:?}", res_python.err());
}

#[test]
fn verify_yaml_parsing() {
    let path = Path::new("../../scratch/asl_examples/blink.asl");
    let source = fs::read_to_string(path).expect("Failed to read blink.asl");
    
    let program: neuroforge_core::asl_types::AslProgram = serde_yaml::from_str(&source)
        .expect("Failed to parse blink.asl as YAML");
    
    assert!(!program.tasks.is_empty());
}
