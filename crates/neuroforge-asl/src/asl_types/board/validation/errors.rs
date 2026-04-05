//! BoardProfile validation errors

use thiserror::Error;

/// Validation errors for BoardProfile
#[derive(Debug, Clone, Error)]
pub enum ValidationError {
    /// Required field is missing
    #[error("Missing required field: {field}")]
    MissingField { field: String },

    /// Duplicate GPIO pin number
    #[error("Duplicate GPIO pin number: {pin}")]
    DuplicatePin { pin: u8 },

    /// Duplicate physical pin
    #[error("Duplicate physical pin: {pin}")]
    DuplicatePhysicalPin { pin: u32 },

    /// Duplicate logical pin name
    #[error("Duplicate logical pin name: {name}")]
    DuplicateLogicalPin { name: String },

    /// Invalid confidence floor value (must be 0.0-1.0)
    #[error("Invalid confidence floor: {value} (must be between 0.0 and 1.0)")]
    InvalidConfidence { value: f32, target: String },

    /// Invalid power pin name
    #[error("Invalid power pin name: {name}")]
    InvalidPowerPin { name: String },

    /// Logical pin references non-existent physical pin
    #[error("Logical pin '{logical}' references non-existent physical pin '{physical}'")]
    InvalidPhysicalReference { logical: String, physical: String },

    /// ASL target missing required field
    #[error("ASL target '{target}' missing required field: {field}")]
    MissingAslTargetField { target: String, field: String },

    /// Duplicate ASL target platform
    #[error("Duplicate ASL target platform: {platform}")]
    DuplicateAslTarget { platform: String },

    /// Pin conflict detected
    #[error("Pin conflict: {pin} cannot be used with {conflicts}")]
    PinConflict { pin: String, conflicts: String },

    /// Empty pin map
    #[error("Pin map cannot be empty")]
    EmptyPinMap,

    /// Invalid voltage value
    #[error("Invalid voltage: {value} mV")]
    InvalidVoltage { value: i64 },

    /// Invalid clock frequency
    #[error("Invalid clock frequency: {value} Hz")]
    InvalidClockFrequency { value: i64 },

    /// Invalid memory size
    #[error("Invalid memory size: {name} = {value} bytes")]
    InvalidMemorySize { name: String, value: i64 },

    /// Empty gpio array
    #[error("GPIO array cannot be empty")]
    EmptyGpio,

    /// Reserved pin used
    #[error("Reserved pin used: {pin}")]
    ReservedPinUsed { pin: u8 },

    /// Strapping pin used without warning
    #[error("Strapping pin used without warning: {pin}")]
    StrappingPinUsed { pin: u8 },
}
