//! Skill selector types for AI agent transpilation decisions.
//!
//! Defines how the AI agent selects transpilation skills based on context.

use serde::{Deserialize, Serialize};

use crate::asl_types::board::{AslTarget, BoardProfile};
use crate::asl_types::component::ComponentProfile;

/// Skill selector for determining transpilation approach.
///
/// This selector chooses the appropriate agent skill file based on
/// board + target language combination.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSelector {
    /// Base path for skill files (e.g., "agent_skills/")
    #[serde(default = "default_skill_base_path")]
    pub skill_base_path: String,
    /// Minimum confidence floor for skill selection
    #[serde(default = "default_confidence_floor")]
    pub confidence_floor: f64,
}

/// Default skill base path.
fn default_skill_base_path() -> String {
    "agent_skills".to_string()
}

/// Default confidence floor.
fn default_confidence_floor() -> f64 {
    0.5
}

impl SkillSelector {
    /// Create a new skill selector with the given base path.
    pub fn new(skill_base_path: String) -> Self {
        Self {
            skill_base_path,
            confidence_floor: default_confidence_floor(),
        }
    }

    /// Create with custom confidence floor.
    pub fn with_confidence_floor(mut self, floor: f64) -> Self {
        self.confidence_floor = floor;
        self
    }

    /// Select the appropriate skill file based on board and target.
    ///
    /// Returns the path to the appropriate skill file relative to skill_base_path.
    /// e.g., "languages/arduino-cpp-avr.md"
    pub fn select(&self, board: &BoardProfile, target: &AslTarget) -> String {
        // If specific agent skill is requested, use it
        if !target.agent_skill.is_empty() {
            return target.agent_skill.clone();
        }

        // 2. Check confidence floor - if below threshold, use base skill
        if let Some(floor) = target.confidence_floor {
            if floor < self.confidence_floor {
                return Self::base_asl_fundamentals();
            }
        }

        // 3. Construct skill from language + board family
        let platform = target.platform.to_lowercase();
        let board_family = board.get_board_family().unwrap_or("unknown-family");

        let language_skill = self.derive_language_skill(&platform, board_family);
        format!("languages/{language_skill}.md")
    }

    /// Select skill for a component.
    ///
    /// Returns component-specific skill path.
    /// e.g., "components/servo.md"
    pub fn select_for_component(&self, component: &ComponentProfile) -> String {
        // Use category and subcategory to determine skill
        let category = component.category.as_deref().unwrap_or("unknown");

        let skill_name = match category.to_lowercase().as_str() {
            // Actuators
            "servo" | "servo-motor" | "motor" => "servo",
            "stepper" | "stepper-motor" => "stepper-motor",
            "relay" | "solid-state-relay" => "relay",

            // Sensors - I2C
            "temperature" | "humidity" | "pressure" => {
                // Check for I2C-specific sensors
                if component.signals.iter().any(|s| {
                    s.signal_type.as_str() == "i2cSda" || s.signal_type.as_str() == "i2cScl"
                }) {
                    "i2c-sensor"
                } else {
                    "analog-sensor"
                }
            }
            "i2c" | "i2c-sensor" => "i2c-sensor",
            "spi" | "spi-sensor" => "spi-sensor",

            // Display
            "oled" | "lcd" | "tft" | "display" => "display",
            "led" | "rgb-led" | "rgb-led-strip" => "rgb-led",

            // Communication
            "bluetooth" | "ble" => "bluetooth",
            "wifi" | "esp-now" => "wifi",
            "serial" | "uart" => "uart",
            "can" | "can-bus" => "can-bus",

            // Storage
            "sd-card" | "eeprom" | "flash" => "storage",

            // Input
            "button" | "switch" | "keypad" => "button-input",
            "encoder" | "rotary-encoder" => "rotary-encoder",
            "joystick" => "joystick",

            // Power
            "battery" | "power" => "power-management",

            // Default to generic component skill
            _ => "generic-component",
        };

        format!("components/{skill_name}.md")
    }

    /// Get the base ASL fundamentals skill path.
    pub fn base_asl_fundamentals() -> String {
        "base/asl_fundamentals.md".to_string()
    }

    /// Get board family skill path.
    ///
    /// Note: Currently returns a stub path. The boards/ directory does not exist
    /// in agent_skills. Board family skills should be derived from language skills
    /// rather than having separate board-specific files.
    pub fn board_family_skill(_family: &str) -> String {
        // Board-specific skills don't exist - return language-based fallback instead
        // This provides a sensible default rather than a broken path
        "languages/arduino-cpp-generic.md".to_string()
    }

    /// Derive language skill filename from platform and board family.
    fn derive_language_skill(&self, platform: &str, board_family: &str) -> String {
        // Map platform + board family to language skill
        match (platform, board_family) {
            // AVR Family boards
            ("arduino", "avr-family") => "arduino-cpp-avr".to_string(),
            ("rust", "avr-family") => "rust-embassy-avr".to_string(),
            // Note: micropython-avr.md does not exist - AVR doesn't support micropython
            // Fall back to generic micropython skill
            ("micropython", "avr-family") => "micropython-rp2040".to_string(),

            // RP2040 Family boards
            ("arduino", "rp2040-family") => "arduino-cpp-rp2040".to_string(),
            ("rust", "rp2040-family") => "rust-embassy-rp".to_string(),
            ("micropython", "rp2040-family") => "micropython-rp2040".to_string(),
            ("circuitpython", "rp2040-family") => "circuitpython-rp2040".to_string(),

            // ESP32 Family boards
            ("arduino", "esp32-family") => "arduino-cpp-esp32".to_string(),
            ("rust", "esp32-family") => "rust-embassy-esp".to_string(),
            ("micropython", "esp32-family") => "micropython-esp32".to_string(),
            ("circuitpython", "esp32-family") => "circuitpython-esp32".to_string(),

            // ESP32-C3/C6 (RISC-V variant)
            ("arduino", "esp32-c3-family") => "arduino-cpp-esp32c3".to_string(),
            ("rust", "esp32-c3-family") => "rust-embassy-esp32c3".to_string(),
            ("micropython", "esp32-c3-family") => "micropython-esp32c3".to_string(),

            // STM32 Family
            ("arduino", "stm32-family") => "arduino-cpp-stm32".to_string(),
            ("rust", "stm32-family") => "rust-embassy-stm32".to_string(),
            ("micropython", "stm32-family") => "micropython-stm32".to_string(),

            // IEC 61131-3 Structured Text (platform-agnostic)
            ("structured-text" | "st" | "iec61131", _) => "iec-st".to_string(),

            // Python variants
            ("micropython", _) => format!("micropython-{}", Self::normalize_family(board_family)),
            ("circuitpython", _) => {
                format!("circuitpython-{}", Self::normalize_family(board_family))
            }

            // Default fallbacks by platform
            ("arduino", _) => "arduino-cpp-generic".to_string(),
            ("rust", _) => "rust-embassy-generic".to_string(),
            ("c" | "cpp", _) => "c-cpp-generic".to_string(),
            ("python", _) => "python-generic".to_string(),

            // Ultimate fallback
            _ => "arduino-cpp-generic".to_string(),
        }
    }

    /// Normalize board family string for skill filename.
    fn normalize_family(family: &str) -> String {
        // Remove "-family" suffix and convert to lowercase
        family.trim_end_matches("-family").to_lowercase()
    }

    /// Build full path to skill file.
    pub fn skill_path(&self, relative_path: &str) -> String {
        let base = self.skill_base_path.trim_end_matches('/');
        format!("{}/{}", base, relative_path)
    }
}

impl Default for SkillSelector {
    fn default() -> Self {
        Self {
            skill_base_path: default_skill_base_path(),
            confidence_floor: default_confidence_floor(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_board(family: &str, mcu: &str) -> BoardProfile {
        BoardProfile {
            id: "test-board".to_string(),
            name: "Test Board".to_string(),
            manufacturer: None,
            mcu: Some(mcu.to_string()),
            architecture: None,
            board_family: Some(family.to_string()),
            clock_hz: None,
            flash_bytes: None,
            sram_bytes: None,
            eeprom_bytes: None,
            voltage_mv: None,
            pin_map: Default::default(),
            pin_capabilities: Default::default(),
            boot_warnings: Default::default(),
            current_limits: Default::default(),
            asl_target: AslTarget {
                platform: "arduino".to_string(),
                version: None,
                includes: vec![],
                defines: Default::default(),
                pin_aliases: Default::default(),
                agent_skill: None,
                confidence_floor: None,
                extensions: Default::default(),
            },
            svg_map: None,
            languages: vec![],
        }
    }

    #[test]
    fn test_derive_language_skill_avr_arduino() {
        let selector = SkillSelector::default();
        let result = selector.derive_language_skill("arduino", "avr-family");
        assert_eq!(result, "arduino-cpp-avr");
    }

    #[test]
    fn test_derive_language_skill_rp2040_micropython() {
        let selector = SkillSelector::default();
        let result = selector.derive_language_skill("micropython", "rp2040-family");
        assert_eq!(result, "micropython-rp2040");
    }

    #[test]
    fn test_derive_language_skill_esp32_circuitpython() {
        let selector = SkillSelector::default();
        let result = selector.derive_language_skill("circuitpython", "esp32-family");
        assert_eq!(result, "circuitpython-esp32");
    }

    #[test]
    fn test_derive_language_skill_iec_st() {
        let selector = SkillSelector::default();
        let result = selector.derive_language_skill("structured-text", "avr-family");
        assert_eq!(result, "iec-st");
    }

    #[test]
    fn test_select_with_explicit_agent_skill() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let board = create_test_board("avr-family", "ATmega328P");
        let mut target = board.asl_target.clone();
        target.agent_skill = Some("languages/custom-skill.md".to_string());

        let result = selector.select(&board, &target);
        assert_eq!(result, "languages/custom-skill.md");
    }

    #[test]
    fn test_select_derives_from_platform_and_family() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let board = create_test_board("avr-family", "ATmega328P");
        let target = board.asl_target().clone();

        let result = selector.select(&board, &target);
        assert_eq!(result, "languages/arduino-cpp-avr.md");
    }

    #[test]
    fn test_select_derives_rp2040_circuitpython() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let mut board = create_test_board("rp2040-family", "RP2040");
        board.asl_target_mut().platform = "circuitpython".to_string();
        let target = board.asl_target().clone();

        let result = selector.select(&board, &target);
        assert_eq!(result, "languages/circuitpython-rp2040.md");
    }

    #[test]
    fn test_select_falls_back_on_low_confidence() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let board = create_test_board("avr-family", "ATmega328P");
        let mut target = board.asl_target.clone();
        target.confidence_floor = Some(0.3); // Below default floor of 0.5

        let result = selector.select(&board, &target);
        assert_eq!(result, "base/asl_fundamentals.md");
    }

    #[test]
    fn test_select_component_servo() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let component = ComponentProfile {
            id: "servo-sg90".to_string(),
            name: "SG90 Servo".to_string(),
            manufacturer: None,
            category: Some("servo".to_string()),
            description: None,
            datasheet: None,
            signals: vec![],
            connections: vec![],
            asl_hint: Default::default(),
            parameters: Default::default(),
            requires_libraries: vec![],
        };

        let result = selector.select_for_component(&component);
        assert_eq!(result, "components/servo.md");
    }

    #[test]
    fn test_select_component_i2c_sensor() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let component = ComponentProfile {
            id: "bme280".to_string(),
            name: "BME280".to_string(),
            manufacturer: None,
            category: Some("temperature".to_string()),
            description: None,
            datasheet: None,
            signals: vec![],
            connections: vec![],
            asl_hint: Default::default(),
            parameters: Default::default(),
            requires_libraries: vec![],
        };

        // Default category doesn't have I2C signals, so returns analog-sensor
        let result = selector.select_for_component(&component);
        assert_eq!(result, "components/analog-sensor.md");
    }

    #[test]
    fn test_select_component_i2c_explicit() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let component = ComponentProfile {
            id: "bme280".to_string(),
            name: "BME280".to_string(),
            manufacturer: None,
            category: Some("i2c-sensor".to_string()),
            description: None,
            datasheet: None,
            signals: vec![],
            connections: vec![],
            asl_hint: Default::default(),
            parameters: Default::default(),
            requires_libraries: vec![],
        };

        let result = selector.select_for_component(&component);
        assert_eq!(result, "components/i2c-sensor.md");
    }

    #[test]
    fn test_skill_path() {
        let selector = SkillSelector::new("agent_skills".to_string());
        let result = selector.skill_path("languages/arduino-cpp-avr.md");
        assert_eq!(result, "agent_skills/languages/arduino-cpp-avr.md");
    }

    #[test]
    fn test_board_profile_derives_family_from_mcu() {
        // Test that get_board_family derives from mcu when board_family is not set
        let board = BoardProfile {
            id: "arduino-uno".to_string(),
            name: "Arduino Uno".to_string(),
            manufacturer: None,
            mcu: Some("ATmega328P".to_string()),
            architecture: None,
            board_family: None, // Not set, should derive from mcu
            clock_hz: None,
            flash_bytes: None,
            sram_bytes: None,
            eeprom_bytes: None,
            voltage_mv: None,
            pin_map: Default::default(),
            pin_capabilities: Default::default(),
            boot_warnings: Default::default(),
            current_limits: Default::default(),
            asl_target: AslTarget::default(),
            svg_map: None,
            languages: vec![],
        };

        assert_eq!(board.get_board_family(), Some("avr-family"));
    }

    #[test]
    fn test_board_profile_explicit_family_takes_precedence() {
        let board = BoardProfile {
            id: "custom-board".to_string(),
            name: "Custom Board".to_string(),
            manufacturer: None,
            mcu: Some("RP2040".to_string()),
            architecture: None,
            board_family: Some("custom-family".to_string()),
            clock_hz: None,
            flash_bytes: None,
            sram_bytes: None,
            eeprom_bytes: None,
            voltage_mv: None,
            pin_map: Default::default(),
            pin_capabilities: Default::default(),
            boot_warnings: Default::default(),
            current_limits: Default::default(),
            asl_target: AslTarget::default(),
            svg_map: None,
            languages: vec![],
        };

        // Explicit board_family should take precedence over derived from mcu
        assert_eq!(board.get_board_family(), Some("custom-family"));
    }

    #[test]
    fn test_derive_esp32_family() {
        let selector = SkillSelector::default();
        let result = selector.derive_language_skill("rust", "esp32-family");
        assert_eq!(result, "rust-embassy-esp");
    }
}
