//! Confidence scoring types: ConfidenceScore, ConfidenceReport, Deduction
//!
//! These types support the AI agent's confidence assessment during transpilation.

use serde::{Deserialize, Serialize};

use crate::asl_types::board::board_profile::{AslTarget, BoardProfile};
use crate::asl_types::component::component_profile::ComponentProfile;
use crate::asl_types::core::program::AslProgram;

// ============================================================================
// Existing Types (kept for backward compatibility)
// ============================================================================

/// Confidence score for a transpilation decision.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConfidenceScore {
    /// Overall confidence value (0.0 to 1.0)
    pub score: f64,
    /// Confidence level category
    pub level: ConfidenceLevel,
    /// Reasoning for this score
    pub reasoning: String,
    /// Contributing factors
    #[serde(default)]
    pub factors: Vec<ConfidenceFactor>,
}

/// Confidence level categories.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ConfidenceLevel {
    /// Very confident (0.9-1.0)
    High,
    /// Moderately confident (0.7-0.9)
    Medium,
    /// Low confidence (0.5-0.7)
    Low,
    /// Very low confidence (<0.5)
    #[default]
    Unknown,
}

impl ConfidenceScore {
    /// Create a new confidence score.
    pub fn new(score: f64, reasoning: impl Into<String>) -> Self {
        let level = match score {
            s if s >= 0.9 => ConfidenceLevel::High,
            s if s >= 0.7 => ConfidenceLevel::Medium,
            s if s >= 0.5 => ConfidenceLevel::Low,
            _ => ConfidenceLevel::Unknown,
        };
        Self {
            score,
            level,
            reasoning: reasoning.into(),
            factors: Vec::new(),
        }
    }

    /// High confidence factory.
    pub fn high(reasoning: impl Into<String>) -> Self {
        Self::new(0.95, reasoning)
    }

    /// Medium confidence factory.
    pub fn medium(reasoning: impl Into<String>) -> Self {
        Self::new(0.8, reasoning)
    }

    /// Low confidence factory.
    pub fn low(reasoning: impl Into<String>) -> Self {
        Self::new(0.5, reasoning)
    }

    /// Unknown confidence factory.
    pub fn unknown(reasoning: impl Into<String>) -> Self {
        Self::new(0.2, reasoning)
    }

    /// Add a contributing factor.
    pub fn with_factor(mut self, factor: ConfidenceFactor) -> Self {
        self.factors.push(factor);
        self
    }
}

/// A factor that contributes to confidence assessment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfidenceFactor {
    /// Factor name
    pub name: String,
    /// Impact on confidence (-1.0 to 1.0)
    pub impact: f64,
    /// Description
    pub description: String,
}

/// Detailed confidence report for a transpilation operation.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConfidenceReport {
    /// Overall confidence
    pub overall: ConfidenceScore,
    /// Confidence per statement
    #[serde(default)]
    pub per_statement: Vec<StatementConfidence>,
    /// Deductions applied
    #[serde(default)]
    pub deductions: Vec<Deduction>,
    /// Warnings generated
    #[serde(default)]
    pub warnings: Vec<String>,
    /// Suggestions for improvement
    #[serde(default)]
    pub suggestions: Vec<String>,
}

/// Confidence for a specific statement.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementConfidence {
    /// Statement index
    pub index: usize,
    /// Statement kind
    pub kind: String,
    /// Confidence for this statement
    pub confidence: ConfidenceScore,
    /// Issues found
    #[serde(default)]
    pub issues: Vec<String>,
}

/// Deduction from confidence score - contains both original variants and new board-based variants.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Deduction {
    // =========================================================================
    // Original variants (kept for backward compatibility)
    // =========================================================================
    /// Ambiguous statement structure
    AmbiguousStructure {
        message: String,
        alternatives: Vec<String>,
    },
    /// Missing type information
    MissingType { variable: String },
    /// Unresolved reference
    UnresolvedReference { name: String, context: String },
    /// Platform-specific feature
    PlatformSpecific { feature: String, platform: String },
    /// Potential runtime error
    PotentialRuntimeError {
        statement: String,
        error_type: String,
    },
    /// Deprecated syntax
    Deprecated { syntax: String, replacement: String },

    // =========================================================================
    // NEW: Board-based deduction variants (Task 18)
    // =========================================================================
    /// Pin used in ASL but board doesn't have it
    PinNotAvailable {
        /// Logical pin name (e.g., "D13", "A0")
        pin_name: String,
        /// Physical pin number if known
        physical_pin: Option<u8>,
        reason: String,
        penalty: f32,
    },
    /// Program uses I2C/SPI/UART but board lacks it
    PeripheralMissing { peripheral: String, penalty: f32 },
    /// Program size exceeds board memory
    MemoryInsufficient {
        required: u32,
        available: u32,
        penalty: f32,
    },
    /// Target language not in board's languages[]
    LanguageUnsupported { language: String, penalty: f32 },
    /// Using ESP32 strapping pins
    StrappingPinUsed { pin: u8, penalty: f32 },
    /// Writing to input-only pins
    InputOnlyPinOutput { pin: u8, penalty: f32 },
    /// Component requirements not met
    ComponentIncompatible {
        component_id: String,
        reason: String,
        penalty: f32,
    },
    /// Using include not available for target
    IncludeNotSupported {
        include: String,
        target: String,
        penalty: f32,
    },
}

impl Deduction {
    /// Create an ambiguous structure deduction.
    pub fn ambiguous(message: impl Into<String>, alternatives: Vec<String>) -> Self {
        Deduction::AmbiguousStructure {
            message: message.into(),
            alternatives,
        }
    }

    /// Create a missing type deduction.
    pub fn missing_type(variable: impl Into<String>) -> Self {
        Deduction::MissingType {
            variable: variable.into(),
        }
    }

    /// Create an unresolved reference deduction.
    pub fn unresolved(name: impl Into<String>, context: impl Into<String>) -> Self {
        Deduction::UnresolvedReference {
            name: name.into(),
            context: context.into(),
        }
    }

    /// Get the penalty value for this deduction.
    pub fn penalty(&self) -> f32 {
        match self {
            // Original variants - default penalties
            Deduction::AmbiguousStructure { .. } => 0.20,
            Deduction::MissingType { .. } => 0.15,
            Deduction::UnresolvedReference { .. } => 0.25,
            Deduction::PlatformSpecific { .. } => 0.10,
            Deduction::PotentialRuntimeError { .. } => 0.30,
            Deduction::Deprecated { .. } => 0.05,
            // Board-based variants - use their penalty field
            Deduction::PinNotAvailable { penalty, .. } => *penalty,
            Deduction::PeripheralMissing { penalty, .. } => *penalty,
            Deduction::MemoryInsufficient { penalty, .. } => *penalty,
            Deduction::LanguageUnsupported { penalty, .. } => *penalty,
            Deduction::StrappingPinUsed { penalty, .. } => *penalty,
            Deduction::InputOnlyPinOutput { penalty, .. } => *penalty,
            Deduction::ComponentIncompatible { penalty, .. } => *penalty,
            Deduction::IncludeNotSupported { penalty, .. } => *penalty,
        }
    }

    /// Get the impact of this deduction on confidence (legacy method, returns penalty as f64).
    pub fn impact(&self) -> f64 {
        self.penalty() as f64
    }
}

// ============================================================================
// Board-based Confidence Report (Task 18)
// ============================================================================

/// Confidence report based on board/program compatibility.
/// This calculates a confidence score by checking various hardware constraints.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardConfidenceReport {
    /// Starting confidence score from target
    pub base_score: f32,
    /// Deductions applied due to incompatibilities
    pub deductions: Vec<Deduction>,
    /// Warnings for non-critical issues
    pub warnings: Vec<String>,
    /// Final calculated score
    pub final_score: f32,
    /// Whether the transpilation is likely to succeed
    pub passed: bool,
}

impl BoardConfidenceReport {
    /// Calculate confidence based on board, target, program, and components.
    pub fn calculate(
        board: &BoardProfile,
        target: &AslTarget,
        program: &AslProgram,
        components: &[ComponentProfile],
    ) -> Self {
        // Start with target's confidence_floor as base (default 0.85 if not set)
        let base_score = target.confidence_floor.unwrap_or(0.85) as f32;
        let mut deductions = Vec::new();
        let mut warnings = Vec::new();

        // Run all validation checks
        Self::check_pin_availability(board, program, &mut deductions, &mut warnings);
        Self::check_peripherals(board, program, &mut deductions, &mut warnings);
        Self::check_memory(board, program, &mut deductions, &mut warnings);
        Self::check_language_support(board, target, &mut deductions, &mut warnings);
        Self::check_strapping_pins(board, program, &mut deductions, &mut warnings);
        Self::check_input_only_pins(board, program, &mut deductions, &mut warnings);
        Self::check_component_compatibility(board, components, &mut deductions, &mut warnings);
        Self::check_includes(target, program, &mut deductions, &mut warnings);

        // Calculate final score
        let total_deductions: f32 = deductions.iter().map(|d| d.penalty()).sum();
        let final_score = (base_score - total_deductions).max(0.0);
        let passed = final_score >= 0.85;

        Self {
            base_score,
            deductions,
            warnings,
            final_score,
            passed,
        }
    }

    /// Check if used pins are available on the board.
    fn check_pin_availability(
        board: &BoardProfile,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        // Collect all pins used in the program
        let used_pins = Self::collect_used_pins(program);
        let available_pins: std::collections::HashSet<_> = board
            .pin_map
            .logical_pins
            .iter()
            .map(|p| p.name.clone())
            .collect();

        for pin in used_pins {
            if !available_pins.contains(&pin) {
                // Try to get physical pin number from pin capabilities
                let physical_pin = board.pin_capabilities.get(&pin).and_then(|caps| {
                    caps.hints
                        .iter()
                        .find(|h| h.name == "gpio")
                        .and_then(|h| h.value.as_ref())
                        .and_then(|v| v.parse::<u8>().ok())
                });

                deductions.push(Deduction::PinNotAvailable {
                    pin_name: pin.clone(),
                    physical_pin,
                    reason: format!("Pin '{}' is not available on board '{}'", pin, board.id),
                    penalty: 0.05,
                });
            }
        }
    }

    /// Check if required peripherals are available.
    fn check_peripherals(
        board: &BoardProfile,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        let required_peripherals = Self::detect_required_peripherals(program);

        // Check for I2C
        if required_peripherals.contains(&"i2c") {
            let has_i2c = board.pin_capabilities.values().any(|caps| {
                caps.peripheral
                    .as_ref()
                    .map(|p| p.contains("i2c"))
                    .unwrap_or(false)
            });
            if !has_i2c {
                deductions.push(Deduction::PeripheralMissing {
                    peripheral: "I2C".to_string(),
                    penalty: 0.10,
                });
            }
        }

        // Check for SPI
        if required_peripherals.contains(&"spi") {
            let has_spi = board.pin_capabilities.values().any(|caps| {
                caps.peripheral
                    .as_ref()
                    .map(|p| p.contains("spi"))
                    .unwrap_or(false)
            });
            if !has_spi {
                deductions.push(Deduction::PeripheralMissing {
                    peripheral: "SPI".to_string(),
                    penalty: 0.10,
                });
            }
        }

        // Check for UART
        if required_peripherals.contains(&"uart") {
            let has_uart = board.pin_capabilities.values().any(|caps| {
                caps.peripheral
                    .as_ref()
                    .map(|p| p.contains("uart"))
                    .unwrap_or(false)
            });
            if !has_uart {
                deductions.push(Deduction::PeripheralMissing {
                    peripheral: "UART".to_string(),
                    penalty: 0.10,
                });
            }
        }
    }

    /// Check if program fits in board memory.
    fn check_memory(
        board: &BoardProfile,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        // Estimate program size
        let estimated_size = Self::estimate_program_size(program);

        // Check flash memory
        if let Some(flash) = board.flash_bytes {
            // Apply 50% safety margin for bootloader and filesystem
            let available = (flash as f64 * 0.5) as u32;
            if estimated_size > available {
                deductions.push(Deduction::MemoryInsufficient {
                    required: estimated_size,
                    available,
                    penalty: 0.15,
                });
            }
        }

        // Estimate RAM usage
        let estimated_ram = Self::estimate_ram_usage(program);

        if let Some(sram) = board.sram_bytes {
            if estimated_ram > sram as u32 {
                deductions.push(Deduction::MemoryInsufficient {
                    required: estimated_ram,
                    available: sram as u32,
                    penalty: 0.15,
                });
            }
        }
    }

    /// Check if target language is supported.
    fn check_language_support(
        board: &BoardProfile,
        target: &AslTarget,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        // Check against board's supported languages
        let supported_languages = &board.languages;

        // If board has explicit languages list, use it
        if !supported_languages.is_empty() {
            let target_lang = target.platform.to_lowercase();
            if !supported_languages
                .iter()
                .any(|l| l.to_lowercase() == target_lang)
            {
                deductions.push(Deduction::LanguageUnsupported {
                    language: target.platform.clone(),
                    penalty: 0.20,
                });
            }
        } else {
            // Fallback: check against known platform families
            let known_platforms = [
                "arduino",
                "esp32",
                "stm32",
                "microbit",
                "rp2040",
                "avr",
                "circuitpython",
            ];
            if !known_platforms
                .iter()
                .any(|p| target.platform.to_lowercase().contains(p))
            {
                deductions.push(Deduction::LanguageUnsupported {
                    language: target.platform.clone(),
                    penalty: 0.20,
                });
            }
        }
    }

    /// Check if strapping pins are used (ESP32 specific).
    fn check_strapping_pins(
        board: &BoardProfile,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        // Only check for ESP32 boards
        if !board
            .mcu
            .as_ref()
            .map(|m| m.contains("ESP32"))
            .unwrap_or(false)
        {
            return;
        }

        // ESP32 strapping pins: 0, 2, 4, 5, 12, 15
        let strapping_pins = [0, 2, 4, 5, 12, 15];
        let used_pins = Self::collect_used_pins(program);

        // Note: This is a simplified check - we'd need to map logical to physical pins
        for pin_name in &used_pins {
            // Try to find the physical pin number
            if let Some(caps) = board.pin_capabilities.get(pin_name) {
                // Check hints for pin number info
                for hint in &caps.hints {
                    if hint.name == "gpio" {
                        if let Some(num_str) = &hint.value {
                            if let Ok(num) = num_str.parse::<u8>() {
                                if strapping_pins.contains(&num) {
                                    deductions.push(Deduction::StrappingPinUsed {
                                        pin: num,
                                        penalty: 0.08,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Check if output is written to input-only pins.
    fn check_input_only_pins(
        board: &BoardProfile,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        // ESP32 input-only pins: 34-39
        let input_only_pins = [34, 35, 36, 37, 38, 39];
        let output_pins = Self::collect_output_pins(program);

        for pin_name in &output_pins {
            if let Some(caps) = board.pin_capabilities.get(pin_name) {
                for hint in &caps.hints {
                    if hint.name == "gpio" {
                        if let Some(num_str) = &hint.value {
                            if let Ok(num) = num_str.parse::<u8>() {
                                if input_only_pins.contains(&num) {
                                    deductions.push(Deduction::InputOnlyPinOutput {
                                        pin: num,
                                        penalty: 0.08,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Check if components are compatible with the board.
    fn check_component_compatibility(
        board: &BoardProfile,
        components: &[ComponentProfile],
        deductions: &mut Vec<Deduction>,
        warnings: &mut Vec<String>,
    ) {
        let board_voltage = board.voltage_mv.unwrap_or(3300);

        for component in components {
            // Check voltage compatibility
            for signal in &component.signals {
                if let Some(voltage) = signal.voltage_mv {
                    if voltage != board_voltage && voltage != 0 {
                        // Voltage mismatch - check if within tolerance
                        let tolerance = board_voltage / 10; // 10% tolerance
                        if (voltage as i32 - board_voltage as i32).abs() > tolerance as i32 {
                            deductions.push(Deduction::ComponentIncompatible {
                                component_id: component.id.clone(),
                                reason: format!(
                                    "Voltage mismatch: component requires {}mV, board provides {}mV",
                                    voltage, board_voltage
                                ),
                                penalty: 0.05,
                            });
                        }
                    }
                }
            }

            // Check PWM requirements using as_str() method
            for signal in &component.signals {
                let signal_type_str = signal.signal_type.as_str();
                if signal_type_str.contains("Pwm") || signal_type_str.contains("pwm") {
                    if let Some(caps) = board.pin_capabilities.get(&signal.pin) {
                        if caps.pwm.is_none() {
                            warnings.push(format!(
                                "Component '{}' requires PWM on pin '{}' but pin does not support PWM",
                                component.id, signal.pin
                            ));
                        }
                    }
                }
            }
        }
    }

    /// Check if includes are supported for the target.
    fn check_includes(
        target: &AslTarget,
        program: &AslProgram,
        deductions: &mut Vec<Deduction>,
        _warnings: &mut Vec<String>,
    ) {
        let default_includes: std::collections::HashSet<_> =
            target.includes.iter().map(|s| s.as_str()).collect();

        for include in &program.includes {
            if !default_includes.contains(include.as_str()) {
                // Check for common unsupported includes
                let unsupported = ["espidf", "freertos", "arduino-esp32"];
                if unsupported
                    .iter()
                    .any(|u| include.to_lowercase().contains(u))
                {
                    deductions.push(Deduction::IncludeNotSupported {
                        include: include.clone(),
                        target: target.platform.clone(),
                        penalty: 0.10,
                    });
                }
            }
        }
    }

    /// Collect all pins used in the program.
    fn collect_used_pins(program: &AslProgram) -> Vec<String> {
        let mut pins = Vec::new();

        // Iterate through all statements in all tasks
        for task in &program.tasks {
            for stmt in &task.body {
                Self::extract_pins_from_statement(stmt, &mut pins);
            }
        }

        // Also check functions
        for func in &program.functions {
            for stmt in &func.body {
                Self::extract_pins_from_statement(stmt, &mut pins);
            }
        }

        pins
    }

    /// Extract pins from a statement recursively.
    fn extract_pins_from_statement(
        stmt: &crate::asl_types::core::program::AslStatement,
        pins: &mut Vec<String>,
    ) {
        use crate::asl_types::core::program::*;
        use crate::asl_types::core::types::AslExpr;

        // Helper to extract pin from expression
        fn extract_pin_from_expr(expr: &AslExpr) -> Option<String> {
            match expr {
                AslExpr::Var(v) => Some(v.name.clone()),
                _ => None,
            }
        }

        match stmt {
            AslStatement::PinMode(pm) => {
                if let Some(p) = extract_pin_from_expr(&pm.pin) {
                    pins.push(p);
                }
            }
            AslStatement::DigitalOutput(do_) => {
                if let Some(p) = extract_pin_from_expr(&do_.pin) {
                    pins.push(p);
                }
            }
            AslStatement::AnalogOutput(ao) => {
                if let Some(p) = extract_pin_from_expr(&ao.pin) {
                    pins.push(p);
                }
            }
            AslStatement::DigitalInput(di) => {
                if let Some(p) = extract_pin_from_expr(&di.pin) {
                    pins.push(p);
                }
            }
            AslStatement::AnalogInput(ai) => {
                if let Some(p) = extract_pin_from_expr(&ai.pin) {
                    pins.push(p);
                }
            }
            AslStatement::PwmInit(pi) => {
                if let Some(p) = extract_pin_from_expr(&pi.pin) {
                    pins.push(p);
                }
            }
            AslStatement::PwmSetDuty(ps) => {
                if let Some(p) = extract_pin_from_expr(&ps.pin) {
                    pins.push(p);
                }
            }
            AslStatement::PwmStop(ps) => {
                if let Some(p) = extract_pin_from_expr(&ps.pin) {
                    pins.push(p);
                }
            }
            AslStatement::ServoAttach(sa) => {
                if let Some(p) = extract_pin_from_expr(&sa.pin) {
                    pins.push(p);
                }
            }
            AslStatement::RgbSet(rs) => {
                if let Some(p) = extract_pin_from_expr(&rs.pin_r) {
                    pins.push(p);
                }
                if let Some(p) = extract_pin_from_expr(&rs.pin_g) {
                    pins.push(p);
                }
                if let Some(p) = extract_pin_from_expr(&rs.pin_b) {
                    pins.push(p);
                }
            }
            AslStatement::AttachInterrupt(ai) => {
                if let Some(p) = extract_pin_from_expr(&ai.pin) {
                    pins.push(p);
                }
            }
            _ => {}
        }
    }

    /// Collect pins used for output operations.
    fn collect_output_pins(program: &AslProgram) -> Vec<String> {
        let mut pins = Vec::new();

        for task in &program.tasks {
            for stmt in &task.body {
                Self::extract_output_pins_from_statement(stmt, &mut pins);
            }
        }

        for func in &program.functions {
            for stmt in &func.body {
                Self::extract_output_pins_from_statement(stmt, &mut pins);
            }
        }

        pins
    }

    /// Extract output pins from a statement.
    fn extract_output_pins_from_statement(
        stmt: &crate::asl_types::core::program::AslStatement,
        pins: &mut Vec<String>,
    ) {
        use crate::asl_types::core::program::*;
        use crate::asl_types::core::types::AslExpr;

        fn extract_pin_from_expr(expr: &AslExpr) -> Option<String> {
            match expr {
                AslExpr::Var(v) => Some(v.name.clone()),
                _ => None,
            }
        }

        match stmt {
            AslStatement::DigitalOutput(do_) => {
                if let Some(p) = extract_pin_from_expr(&do_.pin) {
                    pins.push(p);
                }
            }
            AslStatement::AnalogOutput(ao) => {
                if let Some(p) = extract_pin_from_expr(&ao.pin) {
                    pins.push(p);
                }
            }
            AslStatement::PwmInit(pi) => {
                if let Some(p) = extract_pin_from_expr(&pi.pin) {
                    pins.push(p);
                }
            }
            AslStatement::PwmSetDuty(ps) => {
                if let Some(p) = extract_pin_from_expr(&ps.pin) {
                    pins.push(p);
                }
            }
            AslStatement::RgbSet(rs) => {
                if let Some(p) = extract_pin_from_expr(&rs.pin_r) {
                    pins.push(p);
                }
                if let Some(p) = extract_pin_from_expr(&rs.pin_g) {
                    pins.push(p);
                }
                if let Some(p) = extract_pin_from_expr(&rs.pin_b) {
                    pins.push(p);
                }
            }
            _ => {}
        }
    }

    /// Detect required peripherals from program statements.
    fn detect_required_peripherals(
        program: &AslProgram,
    ) -> std::collections::HashSet<&'static str> {
        let mut peripherals = std::collections::HashSet::new();

        fn check_stmt_peripherals(
            stmt: &crate::asl_types::core::program::AslStatement,
            peripherals: &mut std::collections::HashSet<&'static str>,
        ) {
            use crate::asl_types::core::program::*;

            match stmt {
                AslStatement::I2cWrite(_) | AslStatement::I2cRead(_) => {
                    peripherals.insert("i2c");
                }
                AslStatement::SpiTransfer(_) => {
                    peripherals.insert("spi");
                }
                AslStatement::UartWrite(_) | AslStatement::UartRead(_) => {
                    peripherals.insert("uart");
                }
                AslStatement::SerialBegin(_) => {
                    peripherals.insert("uart");
                }
                AslStatement::LcdInit(_) => {
                    peripherals.insert("i2c");
                }
                AslStatement::OledInit(_) => {
                    peripherals.insert("i2c");
                }
                _ => {}
            }
        }

        for task in &program.tasks {
            for stmt in &task.body {
                check_stmt_peripherals(stmt, &mut peripherals);
            }
        }

        for func in &program.functions {
            for stmt in &func.body {
                check_stmt_peripherals(stmt, &mut peripherals);
            }
        }

        peripherals
    }

    /// Estimate program size in bytes.
    fn estimate_program_size(program: &AslProgram) -> u32 {
        // Rough estimate: ~100 bytes per statement + overhead
        let mut count = 0;

        for task in &program.tasks {
            count += task.body.len();
        }

        for func in &program.functions {
            count += func.body.len();
        }

        // Base overhead + per-statement estimate
        (count as u32 * 100) + 1024
    }

    /// Estimate RAM usage in bytes.
    fn estimate_ram_usage(program: &AslProgram) -> u32 {
        // Estimate global variables + stack usage
        let mut size = 0;

        for var in &program.globals {
            size += Self::estimate_type_size(&var.r#type);
        }

        // Add stack estimate per task
        for task in &program.tasks {
            size += (task.body.len() * 16) as u32; // ~16 bytes per stack frame
        }

        size
    }

    /// Estimate size of a type in bytes.
    fn estimate_type_size(type_: &crate::asl_types::core::types::AslType) -> u32 {
        use crate::asl_types::core::types::AslType;

        match type_ {
            AslType::Bool => 1,
            AslType::Sint8 => 1,
            AslType::Int16 => 2,
            AslType::Int32 => 4,
            AslType::Int64 => 8,
            AslType::Uint8 => 1,
            AslType::Uint16 => 2,
            AslType::Uint32 => 4,
            AslType::Uint64 => 8,
            AslType::Float => 4,
            AslType::Double => 8,
            AslType::String => 32, // Approximate
            AslType::Array => 64,  // Approximate
            AslType::Struct => 32, // Approximate
            AslType::Enum => 4,
            _ => 4,
        }
    }
}
