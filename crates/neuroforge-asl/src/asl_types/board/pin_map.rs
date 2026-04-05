//! Pin mapping types: PinMap, PhysicalPin, LogicalPin
//!
//! These types handle the mapping between logical pin names
//! used in ASL and physical chip pins.
//!
//! Note: PinRestriction is defined in board_profile.rs

use serde::{Deserialize, Serialize};

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
    /// Connection color mappings
    #[serde(default)]
    pub connection_colors: Vec<ConnectionColor>,
}

/// Logical pin (user-facing name).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogicalPin {
    /// Logical pin name (e.g., "D13", "A0", "SCL")
    pub name: String,
    /// Associated physical pin
    pub physical_name: String,
    /// Default mode for this pin
    pub default_mode: Option<String>,
    /// Pin restrictions (reference to PinRestriction from board_profile)
    pub restrictions: Option<crate::asl_types::board::PinRestriction>,
    /// Signal type (for connection coloring)
    pub signal_type: Option<String>,
}

/// Physical pin (chip pin).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhysicalPin {
    /// Physical pin name (e.g., "PB5", "GPIO23", "PC0")
    pub name: String,
    /// Chip package type
    pub package: Option<String>,
    /// Pin number in package
    pub pin_number: Option<u32>,
    /// Alternate functions available
    #[serde(default)]
    pub alt_functions: Vec<String>,
}

/// Connection color for wire coloring.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionColor {
    /// Signal type this color applies to
    pub signal_type: String,
    /// Color hex code
    pub color: String,
    /// Color name for UI
    pub name: String,
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
