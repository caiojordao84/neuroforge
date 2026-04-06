//! ASL Validator for validating ASL programs against board profiles.
//!
//! Provides validation of ASL programs against board constraints,
//! pin conflicts, and type safety.

use serde::{Deserialize, Serialize};

use crate::asl_types::agent::confidence::ConfidenceReport;
use crate::asl_types::board::BoardProfile;
use crate::asl_types::core::program::AslProgram;
use crate::asl_types::core::types::{AslExpr, AslType};

/// Validator for ASL programs.
#[derive(Debug, Clone)]
pub struct AslValidator {
    /// Board profile for validation (optional)
    board: Option<BoardProfile>,
    /// Enable strict validation
    strict: bool,
}

impl AslValidator {
    /// Create a new validator.
    pub fn new() -> Self {
        Self {
            board: None,
            strict: false,
        }
    }

    /// Set the board profile for validation.
    pub fn with_board(mut self, board: BoardProfile) -> Self {
        self.board = Some(board);
        self
    }

    /// Enable strict validation.
    pub fn with_strict(mut self) -> Self {
        self.strict = true;
        self
    }

    /// Validate an ASL program.
    pub fn validate(&self, program: &AslProgram) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Validate program structure
        self.validate_program_structure(program, &mut errors, &mut warnings);

        // Validate tasks
        self.validate_tasks(program, &mut errors, &mut warnings);

        // Validate functions
        self.validate_functions(program, &mut errors, &mut warnings);

        // Validate global variables
        self.validate_globals(program, &mut errors, &mut warnings);

        // Validate against board if available
        if let Some(board) = &self.board {
            self.validate_against_board(program, board, &mut errors, &mut warnings);
        }

        let is_valid = errors.is_empty();

        ValidationResult {
            is_valid,
            errors,
            warnings,
            confidence: None,
        }
    }

    fn validate_program_structure(
        &self,
        program: &AslProgram,
        errors: &mut Vec<AslValidationError>,
        _warnings: &mut Vec<String>,
    ) {
        // Check ASL version
        if program.asl_version.is_empty() {
            errors.push(AslValidationError::MissingField {
                field: "asl_version".to_string(),
                message: "ASL version is required".to_string(),
            });
        }

        // Check for setup and loop tasks (R7)
        let task_names: Vec<_> = program.tasks.iter().map(|t| t.name.as_str()).collect();
        if !task_names.contains(&"setup") {
            errors.push(AslValidationError::MissingTask {
                task: "setup".to_string(),
                message: "Program must have a 'setup' task (R7)".to_string(),
            });
        }
        if !task_names.contains(&"loop") {
            errors.push(AslValidationError::MissingTask {
                task: "loop".to_string(),
                message: "Program must have a 'loop' task (R7)".to_string(),
            });
        }
    }

    fn validate_tasks(
        &self,
        program: &AslProgram,
        errors: &mut Vec<AslValidationError>,
        _warnings: &mut Vec<String>,
    ) {
        // Check for duplicate task names
        let mut seen = std::collections::HashSet::new();
        for task in &program.tasks {
            if !seen.insert(&task.name) {
                errors.push(AslValidationError::DuplicateTask {
                    task: task.name.clone(),
                    message: format!("Duplicate task name '{}'", task.name),
                });
            }
        }
    }

    fn validate_functions(
        &self,
        program: &AslProgram,
        errors: &mut Vec<AslValidationError>,
        _warnings: &mut Vec<String>,
    ) {
        // Check for duplicate function names
        let mut seen = std::collections::HashSet::new();
        for func in &program.functions {
            if !seen.insert(&func.name) {
                errors.push(AslValidationError::DuplicateFunction {
                    function: func.name.clone(),
                    message: format!("Duplicate function name '{}'", func.name),
                });
            }
        }
    }

    fn validate_globals(
        &self,
        program: &AslProgram,
        errors: &mut Vec<AslValidationError>,
        warnings: &mut Vec<String>,
    ) {
        // Check for duplicate global names
        let mut seen = std::collections::HashSet::new();
        for global in &program.globals {
            if !seen.insert(&global.name) {
                errors.push(AslValidationError::DuplicateGlobal {
                    variable: global.name.clone(),
                    message: format!("Duplicate global variable '{}'", global.name),
                });
            }

            // Check for valid scope
            if !["local", "global", "const"].contains(&global.scope.as_str()) {
                warnings.push(format!(
                    "Invalid scope '{}' for variable '{}', expected 'local', 'global', or 'const'",
                    global.scope, global.name
                ));
            }
        }
    }

    fn validate_against_board(
        &self,
        program: &AslProgram,
        board: &BoardProfile,
        errors: &mut Vec<AslValidationError>,
        warnings: &mut Vec<String>,
    ) {
        // Check target board compatibility
        if let Some(target) = &program.metadata.target_board {
            if &board.id != target {
                warnings.push(format!(
                    "Target board '{}' does not match loaded board '{}'",
                    target, board.id
                ));
            }
        }

        // Validate pin usage
        for task in &program.tasks {
            for stmt in &task.body {
                if let Some(pin) = self.extract_pin_from_statement(stmt) {
                    if let Some(logical_pin) = board.pin_map.find_logical(&pin) {
                        if let Some(restrictions) = &logical_pin.restrictions {
                            if !restrictions.conflicts.is_empty() {
                                errors.push(AslValidationError::PinConflict {
                                    pin: pin.clone(),
                                    message: format!(
                                        "Pin '{}' has conflicts with: {:?}",
                                        pin, restrictions.conflicts
                                    ),
                                });
                            }
                        }
                    } else {
                        warnings.push(format!("Unknown pin '{}' for board '{}'", pin, board.id));
                    }
                }
            }
        }
    }

    fn extract_pin_from_statement(
        &self,
        stmt: &crate::asl_types::core::program::AslStatement,
    ) -> Option<String> {
        use crate::asl_types::core::program::*;

        match stmt {
            AslStatement::PinMode(pm) => self.extract_expr_pin(&pm.pin),
            AslStatement::DigitalOutput(do_) => self.extract_expr_pin(&do_.pin),
            AslStatement::AnalogOutput(ao) => self.extract_expr_pin(&ao.pin),
            AslStatement::DigitalInput(di) => self.extract_expr_pin(&di.pin),
            AslStatement::AnalogInput(ai) => self.extract_expr_pin(&ai.pin),
            _ => None,
        }
    }

    fn extract_expr_pin(&self, expr: &AslExpr) -> Option<String> {
        if let AslExpr::Var(v) = expr {
            Some(v.name.clone())
        } else {
            None
        }
    }
}

impl Default for AslValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Result of validation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<AslValidationError>,
    pub warnings: Vec<String>,
    pub confidence: Option<ConfidenceReport>,
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
        expected: AslType,
        found: AslType,
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
