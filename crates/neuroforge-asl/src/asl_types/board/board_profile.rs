//! Board-related types: BoardProfile, PinCapabilities, AslTarget
//!
//! These types define the target board configuration and pin mapping.

use serde::{Deserialize, Serialize};
use serde_toon::{from_str, to_string};
use std::collections::HashMap;

use super::validation::ValidationError;

/// Result type for toon operations
pub type ToonResult<T> = Result<T, BoardToonError>;

/// Error type for TOON operations
#[derive(Debug, thiserror::Error)]
pub enum BoardToonError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("TOON parse error: {0}")]
    Parse(String),
    #[error("TOON serialize error: {0}")]
    Serialize(String),
}

/// Complete board profile loaded from TOON schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardProfile {
    /// Unique board identifier (e.g., "arduino-uno", "esp32-devkitc-v4")
    pub id: String,
    /// Human-readable board name
    pub name: String,
    /// Board manufacturer
    pub manufacturer: Option<String>,
    /// Microcontroller family (e.g., "ATmega328P", "ESP32")
    pub mcu: Option<String>,
    /// CPU architecture
    pub architecture: Option<String>,
    /// Board family for skill selection (e.g., "avr-family", "rp2040-family", "esp32-family")
    pub board_family: Option<String>,
    /// Clock frequency in Hz
    pub clock_hz: Option<u32>,
    /// Flash memory size in bytes
    pub flash_bytes: Option<u64>,
    /// SRAM size in bytes
    pub sram_bytes: Option<u64>,
    /// EEPROM size in bytes
    pub eeprom_bytes: Option<u64>,
    /// Operating voltage in mV
    pub voltage_mv: Option<u32>,
    /// Pin mapping configuration
    pub pin_map: PinMap,
    /// Pin capabilities by logical name
    #[serde(default)]
    pub pin_capabilities: HashMap<String, PinCapabilities>,
    /// Boot configuration warnings
    #[serde(default)]
    pub boot_warnings: Vec<BootWarning>,
    /// Current limits per power rail
    #[serde(default)]
    pub current_limits: HashMap<String, CurrentLimit>,
    /// ASL target configuration
    pub asl_target: AslTarget,
    /// SVG map for visual representation
    pub svg_map: Option<SvgMap>,
}

/// Capabilities for a specific pin.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PinCapabilities {
    /// Supported pin modes
    #[serde(default)]
    pub modes: Vec<PinModeCapability>,
    /// Available functions on this pin
    #[serde(default)]
    pub functions: Vec<String>,
    /// PWM capability if available
    pub pwm: Option<PwmCapability>,
    /// ADC capability if available
    pub adc: Option<AdcCapability>,
    /// Interrupt capability if available
    pub interrupt: Option<InterruptCapability>,
    /// Associated hardware peripheral
    pub peripheral: Option<String>,
    /// Custom hints for ASL generation
    #[serde(default)]
    pub hints: Vec<PinHint>,
}

/// Supported pin mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PinModeCapability {
    Input,
    Output,
    InputPullup,
    InputPulldown,
    Analog,
    #[serde(rename = "openDrain")]
    OpenDrain,
}

/// PWM configuration for a pin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PwmCapability {
    /// Minimum frequency in Hz
    pub min_freq_hz: Option<u32>,
    /// Maximum frequency in Hz
    pub max_freq_hz: Option<u32>,
    /// Maximum resolution in bits
    pub resolution_bits: Option<u8>,
    /// Associated timer
    pub timer: Option<String>,
}

/// ADC configuration for a pin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdcCapability {
    /// Resolution in bits
    pub resolution_bits: u8,
    /// Reference voltage in mV
    pub ref_voltage_mv: Option<u32>,
    /// Associated ADC channel
    pub channel: Option<String>,
}

/// Interrupt configuration for a pin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct InterruptCapability {
    /// Available triggers
    #[serde(default)]
    pub triggers: Vec<InterruptTrigger>,
    /// Associated external interrupt
    pub exti_line: Option<String>,
}

/// Valid interrupt triggers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum InterruptTrigger {
    Rising,
    Falling,
    Change,
    Low,
    High,
}

/// Custom hint for a pin used in ASL generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinHint {
    pub name: String,
    pub value: Option<String>,
}

/// ASL target configuration for code generation.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTarget {
    /// Target platform (e.g., "arduino", "esp32", "stm32")
    pub platform: String,
    /// Framework version
    pub version: Option<String>,
    /// Default includes
    #[serde(default)]
    pub includes: Vec<String>,
    /// Preprocessor definitions
    #[serde(default)]
    pub defines: HashMap<String, String>,
    /// Board-specific pin mappings (logical to physical)
    #[serde(default)]
    pub pin_aliases: HashMap<String, String>,
    /// Agent skill file to use (e.g., "languages/arduino-cpp-avr.md")
    pub agent_skill: Option<String>,
    /// Minimum confidence level required for automatic transpilation
    pub confidence_floor: Option<f64>,
    /// Custom ASL extensions
    #[serde(default)]
    pub extensions: HashMap<String, serde_json::Value>,
}

/// Pin map defining logical to physical pin associations.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PinMap {
    /// Logical pin definitions
    #[serde(default)]
    pub logical_pins: Vec<LogicalPin>,
    /// Physical pin definitions
    #[serde(default)]
    pub physical_pins: Vec<PhysicalPin>,
}

impl PinMap {
    /// Find logical pin by name.
    pub fn find_logical(&self, name: &str) -> Option<&LogicalPin> {
        self.logical_pins.iter().find(|p| p.name == name)
    }

    /// Find physical pin by name.
    pub fn find_physical(&self, name: &str) -> Option<&PhysicalPin> {
        self.physical_pins.iter().find(|p| p.name == name)
    }

    /// Get all pins supporting a specific signal type.
    pub fn pins_by_signal(&self, signal_type: &str) -> Vec<&LogicalPin> {
        self.logical_pins
            .iter()
            .filter(|p| p.signal_type.as_deref() == Some(signal_type))
            .collect()
    }
}

/// Signal type for connection coloring.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalType {
    pub type_name: String,
    pub color: String,
}

/// Logical pin (user-facing name).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogicalPin {
    /// Logical pin name (e.g., "D13", "A0")
    pub name: String,
    /// Associated physical pin
    pub physical_name: String,
    /// Default mode for this pin
    pub default_mode: Option<String>,
    /// Pin restrictions
    pub restrictions: Option<PinRestriction>,
    /// Signal type for connection coloring
    pub signal_type: Option<String>,
}

/// Physical pin (chip pin).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicalPin {
    /// Physical pin name (e.g., "PB5", "GPIO23")
    pub name: String,
    /// Chip package type
    pub package: Option<String>,
    /// Pin number in package
    pub pin_number: Option<u32>,
}

/// Restrictions on pin usage.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PinRestriction {
    /// Pins that cannot be used simultaneously
    #[serde(default)]
    pub conflicts: Vec<String>,
    /// Boot-related warnings
    #[serde(default)]
    pub boot_warnings: Vec<String>,
    /// Maximum current in mA
    pub max_current_ma: Option<u32>,
    /// Required pull resistor
    pub pull_required: Option<String>,
}

/// Boot configuration warning.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BootWarning {
    pub message: String,
    pub severity: WarningSeverity,
    pub affected_pins: Option<Vec<String>>,
}

/// Warning severity level.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WarningSeverity {
    Info,
    Warning,
    Error,
}

/// Current limit for a power rail.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentLimit {
    pub rail: String, // e.g., "3.3V", "5V", "VIN"
    pub limit_ma: u32,
    pub description: Option<String>,
}

/// SVG map for visual representation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SvgMap {
    pub svg_content: String,
    pub view_box: Option<String>,
    pub pin_anchors: Vec<SvgPinAnchor>,
}

/// Pin anchor in SVG.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SvgPinAnchor {
    pub pin: String,
    pub x: f64,
    pub y: f64,
    pub label: Option<String>,
}

impl BoardProfile {
    /// Get pin capabilities by logical name.
    pub fn get_pin_capabilities(&self, pin_name: &str) -> Option<&PinCapabilities> {
        self.pin_capabilities.get(pin_name)
    }

    /// Get physical pin for a logical pin name.
    pub fn get_physical_pin(&self, logical_name: &str) -> Option<&PhysicalPin> {
        for lp in &self.pin_map.logical_pins {
            if lp.name == logical_name {
                return self
                    .pin_map
                    .physical_pins
                    .iter()
                    .find(|pp| pp.name == lp.physical_name);
            }
        }
        None
    }

    /// Get the board family, deriving from mcu if not explicitly set.
    pub fn get_board_family(&self) -> Option<&str> {
        if let Some(family) = &self.board_family {
            return Some(family);
        }
        // Derive from MCU if board_family not set
        self.mcu.as_deref().map(|mcu| {
            let mcu_lower = mcu.to_lowercase();
            if mcu_lower.contains("atmega") || mcu_lower.contains("attiny") {
                "avr-family"
            } else if mcu_lower.contains("rp2040") || mcu_lower.contains("rp2350") {
                "rp2040-family"
            } else if mcu_lower.contains("esp32") {
                "esp32-family"
            } else {
                "unknown-family"
            }
        })
    }

    /// Load a BoardProfile from a TOON file.
    pub fn from_toon(path: &str) -> ToonResult<Self> {
        let content = std::fs::read_to_string(path)?;
        Self::from_toon_str(&content)
    }

    /// Parse a BoardProfile from a TOON string.
    pub fn from_toon_str(content: &str) -> ToonResult<Self> {
        from_str(content).map_err(|e| BoardToonError::Parse(e.to_string()))
    }

    /// Serialize this BoardProfile to a TOON string.
    pub fn to_toon(&self) -> ToonResult<String> {
        to_string(self).map_err(|e| BoardToonError::Serialize(e.to_string()))
    }

    /// Validate the board profile.
    ///
    /// Returns a list of validation errors, or empty if valid.
    pub fn validate(&self) -> Vec<ValidationError> {
        let mut errors = Vec::new();

        // Validate required fields
        if self.id.is_empty() {
            errors.push(ValidationError::MissingField {
                field: "id".to_string(),
            });
        }
        if self.name.is_empty() {
            errors.push(ValidationError::MissingField {
                field: "name".to_string(),
            });
        }
        if self.mcu.is_none() {
            errors.push(ValidationError::MissingField {
                field: "mcu".to_string(),
            });
        }

        // Validate ASL target
        if self.asl_target.platform.is_empty() {
            errors.push(ValidationError::MissingAslTargetField {
                target: self.asl_target.platform.clone(),
                field: "platform".to_string(),
            });
        }

        // Validate confidence floor if present
        if let Some(confidence) = self.asl_target.confidence_floor {
            if !(0.0..=1.0).contains(&confidence) {
                errors.push(ValidationError::InvalidConfidence {
                    value: confidence as f32,
                    target: self.asl_target.platform.clone(),
                });
            }
        }

        // Validate pin map
        if self.pin_map.logical_pins.is_empty() && self.pin_map.physical_pins.is_empty() {
            errors.push(ValidationError::EmptyPinMap);
        }

        // Check for duplicate logical pin names
        let mut logical_names = std::collections::HashSet::new();
        for pin in &self.pin_map.logical_pins {
            if !logical_names.insert(&pin.name) {
                errors.push(ValidationError::DuplicateLogicalPin {
                    name: pin.name.clone(),
                });
            }
            // Check physical pin reference exists
            if self.pin_map.find_physical(&pin.physical_name).is_none() {
                errors.push(ValidationError::InvalidPhysicalReference {
                    logical: pin.name.clone(),
                    physical: pin.physical_name.clone(),
                });
            }
        }

        // Check for duplicate physical pin names
        let mut physical_names = std::collections::HashSet::new();
        for pin in &self.pin_map.physical_pins {
            if !physical_names.insert(&pin.name) {
                errors.push(ValidationError::DuplicatePhysicalPin {
                    pin: pin.pin_number.unwrap_or(0),
                });
            }
        }

        // Validate clock frequency (if present, must be positive)
        if let Some(clock) = self.clock_hz {
            if clock == 0 {
                errors.push(ValidationError::InvalidClockFrequency {
                    value: clock as i64,
                });
            }
        }

        // Validate voltage (if present, must be positive)
        if let Some(voltage) = self.voltage_mv {
            if voltage == 0 {
                errors.push(ValidationError::InvalidVoltage {
                    value: voltage as i64,
                });
            }
        }

        errors
    }
}
