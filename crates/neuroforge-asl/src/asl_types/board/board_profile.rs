//! Board-related types: BoardProfile, PinCapabilities, AslTarget
//!
//! These types define the target board configuration and pin mapping.

use serde::{Deserialize, Serialize};
use serde_json::Value as ToonValue;
use serde_toon::to_string;
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

/// NeuroForge-specific integration metadata.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NeuroForgeMetadata {
    /// ID of the board family skill (e.g., "avr-family")
    pub board_family_skill_id: Option<String>,
    /// Rust BoardProfile identifier (e.g., "arduino-uno")
    pub board_profile_id: Option<String>,
    /// Preferred language skill IDs
    #[serde(default)]
    pub default_language_skills: Vec<String>,
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
    #[serde(default)]
    pub manufacturer: String,
    /// Microcontroller family (e.g., "ATmega328P", "ESP32")
    #[serde(default)]
    pub mcu: String,
    /// CPU architecture
    #[serde(default)]
    pub architecture: String,
    /// Board family for skill selection (e.g., "avr-family", "rp2040-family", "esp32-family")
    #[serde(default)]
    pub board_family: String,
    /// Clock frequency in Hz
    #[serde(default)]
    pub clock_hz: u32,
    /// Flash memory size in bytes
    #[serde(alias = "flashMemory", default)]
    pub flash_bytes: u64,
    /// SRAM size in bytes
    #[serde(alias = "sram", default)]
    pub sram_bytes: u64,
    /// EEPROM size in bytes
    #[serde(default)]
    pub eeprom_bytes: u64,
    /// Voltage in mV
    #[serde(default)]
    pub voltage_mv: u32,
    /// Category (e.g., "maker", "plc")
    #[serde(default)]
    pub category: String,
    /// Family (e.g., "avr-family")
    #[serde(default)]
    pub family: String,
    /// Image path
    #[serde(default)]
    pub image: String,
    /// URL
    #[serde(default)]
    pub url: String,
    /// Specifications
    pub specs: Option<ToonValue>,
    /// Dimensions
    pub dimensions: Option<ToonValue>,
    /// I/O config
    pub io: Option<ToonValue>,
    /// GPIO table/map
    pub gpio: Option<ToonValue>,
    /// Peripherals
    pub peripherals: Option<ToonValue>,
    /// PLC-specific features
    #[serde(rename = "plcFeatures")]
    pub plc_features: Option<ToonValue>,
    /// PLC profile
    #[serde(rename = "plcProfile")]
    pub plc_profile: Option<ToonValue>,
    
    /// Legacy/Internal: Pin mapping configuration
    #[serde(default)]
    pub pin_map: PinMap,
    /// Legacy/Internal: Pin capabilities by logical name
    #[serde(default)]
    pub pin_capabilities: HashMap<String, PinCapabilities>,
    /// Legacy/Internal: Boot configuration warnings
    #[serde(default)]
    pub boot_warnings: Vec<BootWarning>,
    /// Legacy/Internal: Current limits per power rail
    #[serde(default)]
    pub current_limits: HashMap<String, CurrentLimit>,

    /// ASL target configuration
    #[serde(rename = "aslProfile", alias = "asl_target", default)]
    pub asl_profile: AslProfile,

    /// Languages supported
    #[serde(default)]
    pub languages: Vec<String>,
    /// Bootloader info
    #[serde(default)]
    pub bootloader: String,
    /// NeuroForge-specific integration metadata
    #[serde(default)]
    pub neuroforge: NeuroForgeMetadata,
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
    /// Logical roles this pin can serve
    #[serde(default)]
    pub roles: Vec<String>,
    /// Custom hints for ASL generation
    #[serde(default)]
    pub hints: Vec<PinHint>,
    /// Vendor-specific metadata
    #[serde(default)]
    pub meta: HashMap<String, ToonValue>,
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
    Ground,
    Special,
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
    /// Target platform (e.g., "arduino", "esp32", "micropython")
    #[serde(alias = "language", alias = "platform")]
    pub platform: String,
    /// Path to the agent skill for this target
    #[serde(alias = "agentSkill")]
    pub agent_skill: String,
    /// Confidence floor for this target
    #[serde(alias = "confidenceFloor")]
    pub confidence_floor: Option<f64>,
    /// Hardware Abstraction Layer used
    pub hal: Option<String>,
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
    /// Custom ASL extensions (arbitrary TOON values)
    #[serde(default)]
    pub extensions: HashMap<String, ToonValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslProfile {
    /// List of supported targets
    #[serde(default)]
    pub targets: Vec<AslTarget>,
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
    /// Alternate functions available
    #[serde(default)]
    pub alt_functions: Vec<String>,
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
    /// Content of SVG or path to SVG file
    #[serde(alias = "file", alias = "svg_file")]
    pub svg_content: String,
    /// SVG viewBox
    pub view_box: Option<String>,
    /// Pin anchors on the board image
    #[serde(rename = "pins", alias = "pin_anchors")]
    pub pin_anchors: Vec<SvgPinAnchor>,
}

/// Pin anchor in SVG.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SvgPinAnchor {
    /// SVG element ID
    pub id: String,
    /// Logical pin name connecting to this anchor
    #[serde(alias = "logicalPin")]
    pub pin: String,
    /// X coordinate in SVG
    #[serde(alias = "cx")]
    pub x: f64,
    /// Y coordinate in SVG
    #[serde(alias = "cy")]
    pub y: f64,
    /// Visual label
    pub label: Option<String>,
    /// Physical side (top, bottom, left, right)
    pub side: Option<String>,
}

impl BoardProfile {
    /// Get the primary ASL target for backward compatibility.
    pub fn asl_target(&self) -> &AslTarget {
        self.asl_profile.targets.first().expect("BoardProfile must have at least one ASL target")
    }

    /// Get the primary ASL target for mutation (backward compatibility).
    pub fn asl_target_mut(&mut self) -> &mut AslTarget {
        if self.asl_profile.targets.is_empty() {
            self.asl_profile.targets.push(AslTarget::default());
        }
        &mut self.asl_profile.targets[0]
    }

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
        if !self.board_family.is_empty() {
            return Some(&self.board_family);
        }
        // Derive from MCU if board_family not set
        if self.mcu.is_empty() {
            return None;
        }
        
        let mcu = &self.mcu;
        if mcu.starts_with("ATmega") {
            Some("avr-family")
        } else if mcu.starts_with("ESP32") {
            Some("esp32-family")
        } else if mcu.starts_with("RP2040") {
            Some("rp2040-family")
        } else {
            Some("generic-mcu")
        }
    }

    /// Load a BoardProfile from a TOON file.
    pub fn from_toon(path: &str) -> ToonResult<Self> {
        let content = std::fs::read_to_string(path)?;
        Self::from_toon_str(&content)
    }

    /// Parse a BoardProfile from a TOON string.
    pub fn from_toon_str(content: &str) -> ToonResult<Self> {
        let cleaned = Self::preprocess_toon(content);
        let mut profile: Self = serde_toon::from_str(&cleaned).map_err(|e| BoardToonError::Parse(e.to_string()))?;
        profile.sync_v3();
        Ok(profile)
    }

    /// Synchronize v3 fields (gpio, svgMap) to legacy fields (pinMap, pinCapabilities)
    pub fn sync_v3(&mut self) {
        // 1. Sync GPIO table to logical_pins
        if let Some(gpio_val) = &self.gpio {
            if let Some(gpio_array) = gpio_val.as_array() {
                if self.pin_map.logical_pins.is_empty() {
                    for item in gpio_array {
                        if let Some(pin_num) = item.get("pin").and_then(|v| v.as_u64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))) {
                            let label = item.get("label").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let physical = item.get("physicalPin").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            
                            self.pin_map.logical_pins.push(LogicalPin {
                                name: pin_num.to_string(),
                                physical_name: physical.clone(),
                                default_mode: Some("digital".to_string()),
                                restrictions: None,
                                signal_type: None,
                            });

                            // Add to physical pins if it has a physical pin
                            if !physical.is_empty() && self.pin_map.find_physical(&physical).is_none() {
                                self.pin_map.physical_pins.push(PhysicalPin {
                                    name: physical.clone(),
                                    package: None,
                                    pin_number: Some(pin_num as u32),
                                    alt_functions: Vec::new(),
                                });
                            }

                            // Sync capabilities
                            let mut caps = PinCapabilities::default();
                            
                            // PWM
                            if item.get("pwm").and_then(|v| v.as_bool()).unwrap_or(false) {
                                caps.pwm = Some(PwmCapability {
                                    min_freq_hz: None,
                                    max_freq_hz: None,
                                    resolution_bits: Some(8), // Default PWM resolution
                                    timer: None,
                                });
                            }

                            // ADC
                            if item.get("adc").and_then(|v| v.as_bool()).unwrap_or(false) {
                                caps.adc = Some(AdcCapability {
                                    resolution_bits: 10, // Default 10-bit ADC
                                    ref_voltage_mv: None,
                                    channel: None,
                                });
                            }

                            // Interrupt
                            if item.get("interrupt").and_then(|v| v.as_bool()).unwrap_or(false) {
                                caps.interrupt = Some(InterruptCapability {
                                    triggers: vec![InterruptTrigger::Rising, InterruptTrigger::Falling, InterruptTrigger::Change],
                                    exti_line: None,
                                });
                            }
                            
                            self.pin_capabilities.insert(pin_num.to_string(), caps);
                        }
                    }
                }
            }
        }

        // 2. Sync SvgMap side to PinCapabilities (physical hint)
        if let Some(svg) = &self.svg_map {
            for anchor in &svg.pin_anchors {
                if let Some(caps) = self.pin_capabilities.get_mut(&anchor.pin) {
                    // Update meta or physical hints based on side
                }
            }
        }
    }

    /// Pre-process TOON string to make it compatible with YAML parser.
    /// Strips comments and converts pipe tables to YAML lists.
    fn preprocess_toon(content: &str) -> String {
        let mut result = String::new();
        let mut in_table = false;
        let mut headers: Vec<String> = Vec::new();

        for line in content.lines() {
            let trimmed = line.trim();
            
            // Skip comments and empty lines (DON'T reset table state yet)
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            // Handle pipe tables
            if trimmed.starts_with('|') && trimmed.ends_with('|') {
                let parts: Vec<String> = trimmed[1..trimmed.len()-1]
                    .split('|')
                    .map(|s| s.trim().to_string())
                    .collect();

                if !in_table {
                    // Start of table: first line is headers
                    headers = parts;
                    in_table = true;
                } else if parts == headers {
                    // Skip repeated header rows
                    continue;
                } else {
                    // Row of data
                    result.push_str("  - ");
                    for (i, val) in parts.iter().enumerate() {
                        if i < headers.len() {
                            let key = &headers[i];
                            if !key.is_empty() {
                                // Decide whether to quote
                                let should_quote = !(val.parse::<f64>().is_ok() || val == "true" || val == "false" || val.is_empty());
                                
                                if i == 0 {
                                    if should_quote {
                                        result.push_str(&format!("{}: \"{}\"\n", key, val));
                                    } else {
                                        let final_val = if val.is_empty() { "null" } else { val };
                                        result.push_str(&format!("{}: {}\n", key, final_val));
                                    }
                                } else {
                                    if should_quote {
                                        result.push_str(&format!("    {}: \"{}\"\n", key, val));
                                    } else {
                                        let final_val = if val.is_empty() { "null" } else { val };
                                        result.push_str(&format!("    {}: {}\n", key, final_val));
                                    }
                                }
                            }
                        }
                    }
                }
                continue;
            }

            // Regular YAML key-value or other (RESET table state here)
            in_table = false;
            headers.clear();
            result.push_str(line);
            result.push('\n');
        }
        result
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
        if self.mcu.is_empty() {
            errors.push(ValidationError::MissingField {
                field: "mcu".to_string(),
            });
        }

        // Validate ASL target (using the primary one for now)
        let target = self.asl_target();
        if target.platform.is_empty() {
            errors.push(ValidationError::MissingAslTargetField {
                target: target.platform.clone(),
                field: "platform".to_string(),
            });
        }

        // Validate confidence floor if present
        if let Some(confidence) = target.confidence_floor {
            if !(0.0..=1.0).contains(&confidence) {
                errors.push(ValidationError::InvalidConfidence {
                    value: confidence as f32,
                    target: target.platform.clone(),
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
                errors.push(ValidationError::OrphanedLogicalPin {
                    logical: pin.name.clone(),
                    physical: pin.physical_name.clone(),
                });
            }
        }

        errors
    }
}
