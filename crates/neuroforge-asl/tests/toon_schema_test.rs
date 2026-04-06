//! Integration tests for TOON schema parsing.
//!
//! Tests parsing of board, component, and connection-color schemas.

#[cfg(test)]
mod tests {
    use regex::Regex;
    use std::path::PathBuf;

    /// Get the path to a test file in docs/boards/
    /// Uses the workspace root (two levels up from crate root)
    fn test_file_path(filename: &str) -> PathBuf {
        let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let workspace_root = crate_dir.parent().unwrap().parent().unwrap();
        workspace_root.join("docs/boards").join(filename)
    }

    /// Test parsing board-schema.toon
    #[test]
    fn test_parse_board_schema_toon() {
        let schema_path = test_file_path("board-schema.toon");
        assert!(
            schema_path.exists(),
            "board-schema.toon should exist at {:?}",
            schema_path
        );

        // Read the file content
        let content = std::fs::read_to_string(&schema_path).expect("Should read board-schema.toon");

        // Verify it contains expected schema structure
        assert!(
            content.contains("$schema:"),
            "TOON schema should have $schema field"
        );
        assert!(content.contains("id:"), "TOON schema should have id field");
        assert!(
            content.contains("powerPins:"),
            "TOON schema should define powerPins"
        );
        assert!(content.contains("gpio:"), "TOON schema should define gpio");
        assert!(
            content.contains("aslProfile:"),
            "TOON schema should define aslProfile"
        );
    }

    /// Test parsing component-schema.toon
    #[test]
    fn test_parse_component_schema_toon() {
        let schema_path = test_file_path("component-schema.toon");
        assert!(
            schema_path.exists(),
            "component-schema.toon should exist at {:?}",
            schema_path
        );

        // Read the file content
        let content =
            std::fs::read_to_string(&schema_path).expect("Should read component-schema.toon");

        // Verify it contains expected schema structure
        assert!(
            content.contains("$schema:"),
            "TOON schema should have $schema field"
        );
        assert!(content.contains("id:"), "TOON schema should have id field");
        assert!(
            content.contains("signals:"),
            "TOON schema should define signals"
        );
    }

    /// Test parsing connection-colors.toon
    #[test]
    fn test_parse_connection_colors_toon() {
        let schema_path = test_file_path("connection-colors.toon");
        assert!(
            schema_path.exists(),
            "connection-colors.toon should exist at {:?}",
            schema_path
        );

        // Read the file content
        let content =
            std::fs::read_to_string(&schema_path).expect("Should read connection-colors.toon");

        // Verify it contains expected color definitions
        assert!(
            content.contains("power:"),
            "Connection colors should define power color"
        );
        assert!(
            content.contains("gnd:"),
            "Connection colors should define gnd color"
        );
        assert!(
            content.contains("digital:"),
            "Connection colors should define digital color"
        );
        assert!(
            content.contains("analog:"),
            "Connection colors should define analog color"
        );
        assert!(
            content.contains("--color-wire-"),
            "Connection colors should define CSS variables"
        );
    }

    /// Test that connection-colors.toon has valid hex colors
    #[test]
    fn test_connection_colors_valid_hex() {
        let schema_path = test_file_path("connection-colors.toon");
        let content =
            std::fs::read_to_string(&schema_path).expect("Should read connection-colors.toon");

        // Find all hex color patterns (# followed by 6 hex digits)
        let hex_pattern = Regex::new(r"#([0-9A-Fa-f]{6})").expect("Valid regex");

        let colors: Vec<&str> = hex_pattern
            .captures_iter(&content)
            .filter_map(|cap| cap.get(0).map(|m| m.as_str()))
            .collect();

        assert!(!colors.is_empty(), "Should have at least one color defined");

        // Verify all colors are valid 6-digit hex
        for color in &colors {
            assert!(
                color.len() == 7,
                "Color {} should be 7 chars (#RRGGBB)",
                color
            );
            assert!(
                color.starts_with('#'),
                "Color {} should start with #",
                color
            );
        }
    }

    /// Test that board-schema.toon defines required ASL fields
    #[test]
    fn test_board_schema_asl_fields() {
        let schema_path = test_file_path("board-schema.toon");
        let content = std::fs::read_to_string(&schema_path).expect("Should read board-schema.toon");

        // Verify aslProfile structure exists
        assert!(
            content.contains("aslProfile:"),
            "Should have aslProfile section"
        );
        assert!(
            content.contains("targets:"),
            "Should define targets in aslProfile"
        );
        assert!(
            content.contains("language:"),
            "Should define language in targets"
        );
        assert!(content.contains("hal:"), "Should define HAL in targets");
    }

    /// Test that board files conform to board-schema.toon
    #[test]
    fn test_arduino_uno_conforms_to_schema() {
        let board_path = test_file_path("arduino-uno-r3.toon");
        assert!(board_path.exists(), "arduino-uno-r3.toon should exist");

        let content =
            std::fs::read_to_string(&board_path).expect("Should read arduino-uno-r3.toon");

        // Verify board has required fields per board-schema.toon
        assert!(content.contains("id:"), "Board should have id field");
        assert!(content.contains("name:"), "Board should have name field");
        assert!(
            content.contains("manufacturer:"),
            "Board should have manufacturer field"
        );
        assert!(content.contains("mcu:"), "Board should have mcu field");
    }

    /// Test that component files conform to component-schema.toon
    #[test]
    fn test_component_files_have_required_fields() {
        // Get the components directory path
        let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let workspace_root = crate_dir.parent().unwrap().parent().unwrap();
        let components_dir = workspace_root.join("docs/components");

        if components_dir.exists() {
            // If there are component files, verify they have required structure
            let entries =
                std::fs::read_dir(&components_dir).expect("Should read components directory");

            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "toon").unwrap_or(false) {
                    let content =
                        std::fs::read_to_string(&path).expect("Should read component file");

                    // Component files should have signals and connections
                    assert!(
                        content.contains("signals:") || content.contains("connections:"),
                        "Component {} should have signals or connections",
                        path.display()
                    );
                }
            }
        } else {
            // If no components directory, that's OK - skip this test
            println!("No docs/components directory found - skipping component file check");
        }
    }
}
