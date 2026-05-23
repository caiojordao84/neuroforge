//! SchemaSmith Tauri commands for board validation and export
//! Uses neuroforge-asl types for authoritative validation

use neuroforge_core::asl_types::board::{
    board_profile::BoardProfile, validation::ValidationError as BoardValidationError,
};
use neuroforge_core::asl_types::component::component_profile::ComponentProfile;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum SchemaSmithError {
    #[error("Failed to parse TOON: {0}")]
    ParseError(String),
    #[error("Failed to serialize TOON: {0}")]
    SerializeError(String),
    #[error("Validation failed: {0}")]
    ValidationError(String),
    #[error("IO error: {0}")]
    IoError(String),
    #[error("Invalid board: {0}")]
    InvalidBoard(String),
}

impl From<std::io::Error> for SchemaSmithError {
    fn from(e: std::io::Error) -> Self {
        SchemaSmithError::IoError(e.to_string())
    }
}

impl From<BoardValidationError> for SchemaSmithError {
    fn from(e: BoardValidationError) -> Self {
        SchemaSmithError::ValidationError(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardValidationResult {
    pub valid: bool,
    pub errors: Vec<BoardValidationErrorDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardValidationErrorDto {
    pub field: Option<String>,
    pub message: String,
    pub error_type: String,
}

impl From<BoardValidationError> for BoardValidationErrorDto {
    fn from(e: BoardValidationError) -> Self {
        let error_type = match &e {
            BoardValidationError::MissingField { .. } => "MissingField",
            BoardValidationError::DuplicatePin { .. } => "DuplicatePin",
            BoardValidationError::DuplicatePhysicalPin { .. } => "DuplicatePhysicalPin",
            BoardValidationError::DuplicateLogicalPin { .. } => "DuplicateLogicalPin",
            BoardValidationError::InvalidConfidence { .. } => "InvalidConfidence",
            BoardValidationError::InvalidPowerPin { .. } => "InvalidPowerPin",
            BoardValidationError::InvalidPhysicalReference { .. } => "InvalidPhysicalReference",
            BoardValidationError::OrphanedLogicalPin { .. } => "OrphanedLogicalPin",
            BoardValidationError::MissingAslTargetField { .. } => "MissingAslTargetField",
            BoardValidationError::DuplicateAslTarget { .. } => "DuplicateAslTarget",
            BoardValidationError::PinConflict { .. } => "PinConflict",
            BoardValidationError::EmptyPinMap => "EmptyPinMap",
            BoardValidationError::InvalidVoltage { .. } => "InvalidVoltage",
            BoardValidationError::InvalidClockFrequency { .. } => "InvalidClockFrequency",
            BoardValidationError::InvalidMemorySize { .. } => "InvalidMemorySize",
            BoardValidationError::EmptyGpio => "EmptyGpio",
            BoardValidationError::ReservedPinUsed { .. } => "ReservedPinUsed",
            BoardValidationError::StrappingPinUsed { .. } => "StrappingPinUsed",
        }
        .to_string();

        BoardValidationErrorDto {
            field: None,
            message: e.to_string(),
            error_type,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentValidationResult {
    pub valid: bool,
    pub errors: Vec<ComponentValidationErrorDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentValidationErrorDto {
    pub field: Option<String>,
    pub message: String,
    pub error_type: String,
}

/// Validate a board from TOON content using neuroforge-asl
/// Parses TOON to BoardProfile and runs validation
#[tauri::command]
pub fn validate_board(toon_content: String) -> Result<BoardValidationResult, SchemaSmithError> {
    // Try to parse as BoardProfile (neuroforge-asl format)
    let board_result: Result<BoardProfile, _> = BoardProfile::from_toon_str(&toon_content);

    match board_result {
        Ok(board) => {
            // Run validation using neuroforge-asl
            let errors: Vec<BoardValidationError> = board.validate();

            let error_dtos: Vec<BoardValidationErrorDto> = errors
                .into_iter()
                .map(BoardValidationErrorDto::from)
                .collect();

            let valid = error_dtos.is_empty();

            Ok(BoardValidationResult {
                valid,
                errors: error_dtos,
            })
        }
        Err(_) => {
            // Fallback: validate the legacy frontend format (ToonBoard)
            // This allows the frontend to continue working while migrating to the new format.
            //
            // NOTE: This fallback expects the old frontend format. If from_toon_str fails
            // on a valid BoardProfile .toon file (e.g., new format with board_family but
            // missing some field), errors will be incorrectly reported as "Missing 'board' object".
            // TODO: Remove this fallback when all boards are migrated to native BoardProfile format.
            let parsed: serde_json::Value = serde_json::from_str(&toon_content)
                .map_err(|e| SchemaSmithError::ParseError(e.to_string()))?;

            let mut errors = Vec::new();

            // Check for required fields in legacy format
            let board_obj = parsed
                .get("board")
                .and_then(|b| b.as_object())
                .ok_or_else(|| {
                    SchemaSmithError::ParseError("Missing 'board' object".to_string())
                })?;

            // Validate board ID
            let board_id = board_obj.get("id").and_then(|v| v.as_str()).unwrap_or("");

            if board_id.is_empty() {
                errors.push(BoardValidationErrorDto {
                    field: Some("board.id".to_string()),
                    message: "Board ID is required".to_string(),
                    error_type: "MissingField".to_string(),
                });
            } else if !board_id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c == '-' || c.is_ascii_digit())
            {
                errors.push(BoardValidationErrorDto {
                    field: Some("board.id".to_string()),
                    message: "Board ID must be lowercase kebab-case".to_string(),
                    error_type: "InvalidField".to_string(),
                });
            }

            // Validate MCU
            let mcu = board_obj.get("mcu").and_then(|v| v.as_str()).unwrap_or("");

            if mcu.is_empty() {
                errors.push(BoardValidationErrorDto {
                    field: Some("board.mcu".to_string()),
                    message: "MCU is required".to_string(),
                    error_type: "MissingField".to_string(),
                });
            }

            // Validate pins
            let pins = parsed
                .get("pins")
                .and_then(|p| p.as_array())
                .map(|arr| arr.len())
                .unwrap_or(0);

            if pins == 0 {
                errors.push(BoardValidationErrorDto {
                    field: Some("pins".to_string()),
                    message: "At least one pin is required".to_string(),
                    error_type: "EmptyPinMap".to_string(),
                });
            }

            // Check for duplicate pin numbers
            if let Some(pins_array) = parsed.get("pins").and_then(|p| p.as_array()) {
                let pin_numbers: Vec<u32> = pins_array
                    .iter()
                    .filter_map(|p| {
                        p.get("logical_pin")
                            .and_then(|v| v.as_u64())
                            .and_then(|n| n.try_into().ok())
                    })
                    .collect();

                let mut seen = std::collections::HashSet::new();
                for &num in &pin_numbers {
                    if !seen.insert(num) {
                        errors.push(BoardValidationErrorDto {
                            field: Some("pins.logical_pin".to_string()),
                            message: format!("Duplicate pin number: {}", num),
                            error_type: "DuplicatePin".to_string(),
                        });
                    }
                }
            }

            // Validate frequency
            let frequency = board_obj
                .get("frequency")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);

            if frequency == 0 {
                errors.push(BoardValidationErrorDto {
                    field: Some("board.frequency".to_string()),
                    message: "Frequency must be greater than 0".to_string(),
                    error_type: "InvalidClockFrequency".to_string(),
                });
            }

            let valid = errors.is_empty();

            Ok(BoardValidationResult { valid, errors })
        }
    }
}

/// Validate a component from TOON content using neuroforge-asl
/// Parses TOON to ComponentProfile and runs validation
#[tauri::command]
pub fn validate_component(
    toon_content: String,
) -> Result<ComponentValidationResult, SchemaSmithError> {
    // Parse TOON to ComponentProfile
    let component: ComponentProfile = serde_toon::from_str(&toon_content)
        .map_err(|e| SchemaSmithError::ParseError(e.to_string()))?;

    // Basic validation for component
    let mut errors = Vec::new();

    // Validate ID
    if component.id.is_empty() {
        errors.push(ComponentValidationErrorDto {
            field: Some("id".to_string()),
            message: "Component ID is required".to_string(),
            error_type: "MissingField".to_string(),
        });
    }

    // Validate name
    if component.name.is_empty() {
        errors.push(ComponentValidationErrorDto {
            field: Some("name".to_string()),
            message: "Component name is required".to_string(),
            error_type: "MissingField".to_string(),
        });
    }

    // Validate signals
    if component.signals.is_empty() {
        errors.push(ComponentValidationErrorDto {
            field: Some("signals".to_string()),
            message: "At least one signal is required".to_string(),
            error_type: "EmptySignals".to_string(),
        });
    }

    // Validate connections reference valid signals
    for conn in &component.connections {
        let signal_exists = component.signals.iter().any(|s| s.name == conn.name);
        if !signal_exists {
            errors.push(ComponentValidationErrorDto {
                field: Some("connections".to_string()),
                message: format!("Connection '{}' references non-existent signal", conn.name),
                error_type: "InvalidSignalReference".to_string(),
            });
        }
    }

    let valid = errors.is_empty();

    Ok(ComponentValidationResult { valid, errors })
}

/// Export a BoardProfile to TOON file
#[tauri::command]
pub fn export_board_toon(board: BoardProfile, path: String) -> Result<(), SchemaSmithError> {
    // Serialize to TOON
    let toon_content = board
        .to_toon()
        .map_err(|e: neuroforge_core::asl_types::board::BoardToonError| SchemaSmithError::SerializeError(e.to_string()))?;

    // Write to file
    std::fs::write(&path, toon_content).map_err(|e| SchemaSmithError::IoError(e.to_string()))?;

    Ok(())
}

/// Export a ComponentProfile to TOON file
#[tauri::command]
pub fn export_component_toon(
    component: ComponentProfile,
    path: String,
) -> Result<(), SchemaSmithError> {
    // Serialize to TOON
    let toon_content = serde_toon::to_string(&component)
        .map_err(|e| SchemaSmithError::SerializeError(e.to_string()))?;

    // Write to file
    std::fs::write(&path, toon_content).map_err(|e| SchemaSmithError::IoError(e.to_string()))?;

    Ok(())
}

/// Load board from TOON file
#[tauri::command]
pub fn load_board_from_file(path: String) -> Result<String, SchemaSmithError> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| SchemaSmithError::IoError(e.to_string()))?;

    // Validate it's valid TOON by parsing
    let _: BoardProfile = BoardProfile::from_toon_str(&content)
        .map_err(|e: neuroforge_core::asl_types::board::BoardToonError| SchemaSmithError::ParseError(e.to_string()))?;

    Ok(content)
}

/// Load component from TOON file
#[tauri::command]
pub fn load_component_from_file(path: String) -> Result<String, SchemaSmithError> {
    let content =
        std::fs::read_to_string(&path).map_err(|e| SchemaSmithError::IoError(e.to_string()))?;

    // Validate it's valid TOON by parsing
    let _: ComponentProfile =
        serde_toon::from_str(&content).map_err(|e| SchemaSmithError::ParseError(e.to_string()))?;

    Ok(content)
}
