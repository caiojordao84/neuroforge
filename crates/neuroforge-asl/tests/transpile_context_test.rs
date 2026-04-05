//! Tests for TranspileContext and compute_ir_hash

use neuroforge_asl::asl_types::agent::{compute_ir_hash, TranspileContext};
use neuroforge_asl::asl_types::board::{AslTarget, BoardProfile};
use neuroforge_asl::asl_types::core::program::{AslMetadata, AslProgram, AslTask};

#[test]
fn test_compute_ir_hash_deterministic() {
    // Create two identical programs
    let program1 = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![AslTask {
            name: "setup".to_string(),
            is_async: false,
            priority: None,
            stack_size: None,
            params: vec![],
            return_type: "void".to_string(),
            body: vec![],
        }],
    };

    let program2 = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![AslTask {
            name: "setup".to_string(),
            is_async: false,
            priority: None,
            stack_size: None,
            params: vec![],
            return_type: "void".to_string(),
            body: vec![],
        }],
    };

    // Hash should be the same for identical programs
    let hash1 = compute_ir_hash(&program1);
    let hash2 = compute_ir_hash(&program2);
    assert_eq!(hash1, hash2, "Identical programs should produce same hash");
}

#[test]
fn test_compute_ir_hash_different_programs() {
    let program1 = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test1".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![],
    };

    let program2 = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test2".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![],
    };

    // Hash should be different for different programs
    let hash1 = compute_ir_hash(&program1);
    let hash2 = compute_ir_hash(&program2);
    assert_ne!(
        hash1, hash2,
        "Different programs should produce different hash"
    );
}

#[test]
fn test_transpile_context_new() {
    let program = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![],
    };

    let board_profile = BoardProfile {
        id: "arduino-uno".to_string(),
        name: "Arduino Uno".to_string(),
        manufacturer: Some("Arduino".to_string()),
        mcu: Some("ATmega328P".to_string()),
        architecture: Some("AVR".to_string()),
        board_family: Some("avr-family".to_string()),
        clock_hz: Some(16000000),
        flash_bytes: Some(32768),
        sram_bytes: Some(2048),
        eeprom_bytes: Some(1024),
        voltage_mv: Some(5000),
        pin_map: Default::default(),
        pin_capabilities: Default::default(),
        boot_warnings: Default::default(),
        current_limits: Default::default(),
        asl_target: AslTarget {
            platform: "arduino".to_string(),
            version: Some("1.8.0".to_string()),
            includes: vec![],
            defines: Default::default(),
            pin_aliases: Default::default(),
            agent_skill: Some("languages/arduino-cpp-avr.md".to_string()),
            confidence_floor: Some(0.8),
            extensions: Default::default(),
        },
        svg_map: None,
        languages: vec!["arduino".to_string()],
    };

    let target = AslTarget {
        platform: "arduino".to_string(),
        version: Some("1.8.0".to_string()),
        includes: vec![],
        defines: Default::default(),
        pin_aliases: Default::default(),
        agent_skill: Some("languages/arduino-cpp-avr.md".to_string()),
        confidence_floor: Some(0.8),
        extensions: Default::default(),
    };

    let context = TranspileContext::new(program.clone(), board_profile, target, vec![]);

    assert_eq!(context.asl_program.asl_version, "4.0.0");
    assert_eq!(context.asl_version, "4.0.0");
    assert!(context.ir_hash != 0, "IR hash should not be zero");
}

#[test]
fn test_transpile_context_to_toon() {
    let program = AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: Some("test".to_string()),
            description: None,
            version: None,
            target_board: Some("arduino-uno".to_string()),
        },
        includes: vec![],
        structs: vec![],
        enums: vec![],
        globals: vec![],
        functions: vec![],
        function_blocks: vec![],
        tasks: vec![],
    };

    let board_profile = BoardProfile {
        id: "arduino-uno".to_string(),
        name: "Arduino Uno".to_string(),
        manufacturer: Some("Arduino".to_string()),
        mcu: Some("ATmega328P".to_string()),
        architecture: Some("AVR".to_string()),
        board_family: Some("avr-family".to_string()),
        clock_hz: Some(16000000),
        flash_bytes: Some(32768),
        sram_bytes: Some(2048),
        eeprom_bytes: Some(1024),
        voltage_mv: Some(5000),
        pin_map: Default::default(),
        pin_capabilities: Default::default(),
        boot_warnings: Default::default(),
        current_limits: Default::default(),
        asl_target: AslTarget {
            platform: "arduino".to_string(),
            version: Some("1.8.0".to_string()),
            includes: vec![],
            defines: Default::default(),
            pin_aliases: Default::default(),
            agent_skill: Some("languages/arduino-cpp-avr.md".to_string()),
            confidence_floor: Some(0.8),
            extensions: Default::default(),
        },
        svg_map: None,
        languages: vec!["arduino".to_string()],
    };

    let target = AslTarget {
        platform: "arduino".to_string(),
        version: Some("1.8.0".to_string()),
        includes: vec![],
        defines: Default::default(),
        pin_aliases: Default::default(),
        agent_skill: Some("languages/arduino-cpp-avr.md".to_string()),
        confidence_floor: Some(0.8),
        extensions: Default::default(),
    };

    let context = TranspileContext::new(program, board_profile, target, vec![]);

    // Test that to_toon returns a valid string
    let toon_result = context.to_toon();
    assert!(toon_result.is_ok(), "to_toon should succeed");
    let toon_string = toon_result.unwrap();
    assert!(!toon_string.is_empty(), "TOON string should not be empty");
}
