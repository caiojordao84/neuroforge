//! Validation errors for ASL programs.
//!
//! Contains all validation error types used by the validator.

use serde::{Deserialize, Serialize};

/// Result of validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<AslValidationError>,
    pub warnings: Vec<String>,
    pub confidence: Option<crate::asl_types::agent::confidence::ConfidenceReport>,
}

/// Validation error types.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AslValidationError {
    /// Missing required field
    MissingField { field: String, message: String },
    /// Missing required task
    MissingTask { task: String, message: String },
    /// Duplicate task name
    DuplicateTask { task: String, message: String },
    /// Duplicate function name
    DuplicateFunction { function: String, message: String },
    /// Duplicate global variable
    DuplicateGlobal { variable: String, message: String },
    /// Pin conflict
    PinConflict { pin: String, message: String },
    /// Type error
    TypeError {
        expected: String,
        found: String,
        message: String,
    },
    /// Unknown identifier
    UnknownIdentifier { name: String, message: String },
    /// General error
    General { message: String },
}

impl AslValidationError {
    /// Create a general error.
    pub fn general(message: impl Into<String>) -> Self {
        AslValidationError::General {
            message: message.into(),
        }
    }

    /// Get the error message.
    pub fn message(&self) -> &str {
        match self {
            AslValidationError::MissingField { message, .. } => message,
            AslValidationError::MissingTask { message, .. } => message,
            AslValidationError::DuplicateTask { message, .. } => message,
            AslValidationError::DuplicateFunction { message, .. } => message,
            AslValidationError::DuplicateGlobal { message, .. } => message,
            AslValidationError::PinConflict { message, .. } => message,
            AslValidationError::TypeError { message, .. } => message,
            AslValidationError::UnknownIdentifier { message, .. } => message,
            AslValidationError::General { message, .. } => message,
        }
    }
}

/// Pin conflict details.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PinConflict {
    pub pin: String,
    pub conflicting_pins: Vec<String>,
    pub reason: String,
}

/// Type mismatch details.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TypeMismatch {
    pub expected: String,
    pub found: String,
    pub expression: Option<String>,
}

/// Undefined reference details.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UndefinedReference {
    pub name: String,
    pub reference_type: ReferenceType,
    pub suggestions: Vec<String>,
}

/// Type of reference.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReferenceType {
    Variable,
    Function,
    Struct,
    Enum,
    Task,
}
