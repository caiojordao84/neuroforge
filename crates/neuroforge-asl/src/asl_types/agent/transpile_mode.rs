//! Transpile mode types for controlling the transpilation strategy.
//!
//! Defines different modes that affect how the transpiler processes ASL code.

use serde::{Deserialize, Serialize};

/// Transpile mode controlling the overall transpilation strategy.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum TranspileMode {
    /// Automatic selection based on context
    #[default]
    Auto,
    /// Direct one-to-one translation
    Direct,
    /// Conservative - preserve original behavior exactly
    Conservative,
    /// Aggressive - optimize for size/speed
    Aggressive,
    /// Strict - fail on any ambiguity
    Strict,
    /// Safe - add safety checks
    Safe,
    /// Legacy compatibility mode
    Legacy,
    /// Debug mode with verbose output
    Debug,
}

impl TranspileMode {
    /// Get the confidence threshold for this mode.
    pub fn confidence_threshold(&self) -> f64 {
        match self {
            TranspileMode::Strict => 0.95,
            TranspileMode::Safe => 0.9,
            TranspileMode::Conservative => 0.85,
            TranspileMode::Auto => 0.7,
            TranspileMode::Direct => 0.8,
            TranspileMode::Aggressive => 0.6,
            TranspileMode::Legacy => 0.5,
            TranspileMode::Debug => 0.0,
        }
    }

    /// Whether to enable optimizations.
    pub fn enables_optimizations(&self) -> bool {
        matches!(self, TranspileMode::Auto | TranspileMode::Aggressive)
    }

    /// Whether to add safety checks.
    pub fn adds_safety_checks(&self) -> bool {
        matches!(
            self,
            TranspileMode::Safe | TranspileMode::Conservative | TranspileMode::Strict
        )
    }

    /// Whether to preserve comments.
    pub fn preserves_comments(&self) -> bool {
        matches!(
            self,
            TranspileMode::Conservative | TranspileMode::Direct | TranspileMode::Debug
        )
    }

    /// Human-readable description.
    pub fn description(&self) -> &'static str {
        match self {
            TranspileMode::Auto => "Automatically select best transpilation strategy",
            TranspileMode::Direct => "Direct translation with minimal transformations",
            TranspileMode::Conservative => "Preserve original behavior with maximum compatibility",
            TranspileMode::Aggressive => "Optimize for size and performance",
            TranspileMode::Strict => "Fail on any ambiguity, maximum safety",
            TranspileMode::Safe => "Add safety checks and bounds validation",
            TranspileMode::Legacy => "Compatibility mode for legacy ASL versions",
            TranspileMode::Debug => "Verbose output for debugging",
        }
    }
}

/// Optimization level for transpilation.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum OptimizationLevel {
    /// No optimizations
    None,
    /// Basic optimizations
    Basic,
    /// Standard optimizations
    #[default]
    Standard,
    /// Aggressive optimizations
    Aggressive,
}

impl OptimizationLevel {
    /// Get the numeric level.
    pub fn level(&self) -> u8 {
        match self {
            OptimizationLevel::None => 0,
            OptimizationLevel::Basic => 1,
            OptimizationLevel::Standard => 2,
            OptimizationLevel::Aggressive => 3,
        }
    }

    /// Create from numeric level.
    pub fn from_level(level: u8) -> Self {
        match level {
            0 => OptimizationLevel::None,
            1 => OptimizationLevel::Basic,
            2 => OptimizationLevel::Standard,
            _ => OptimizationLevel::Aggressive,
        }
    }
}

/// Specific optimizations to apply.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationOptions {
    /// Inline simple functions
    pub inline_functions: bool,
    /// Remove unused variables
    pub dead_code_elimination: bool,
    /// Combine constant expressions
    pub constant_folding: bool,
    /// Simplify boolean expressions
    pub boolean_simplification: bool,
    /// Optimize loops
    pub loop_optimization: bool,
    /// Reduce temporary variables
    pub temp_elimination: bool,
}

impl OptimizationOptions {
    /// Recommended options for Standard level.
    pub fn standard() -> Self {
        Self {
            inline_functions: true,
            dead_code_elimination: true,
            constant_folding: true,
            boolean_simplification: true,
            loop_optimization: false,
            temp_elimination: true,
        }
    }

    /// Recommended options for Aggressive level.
    pub fn aggressive() -> Self {
        Self {
            inline_functions: true,
            dead_code_elimination: true,
            constant_folding: true,
            boolean_simplification: true,
            loop_optimization: true,
            temp_elimination: true,
        }
    }
}
