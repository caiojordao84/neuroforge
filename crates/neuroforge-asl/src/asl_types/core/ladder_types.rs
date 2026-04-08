//! Ladder Logic types for ASL (IEC 61131-3)
//!
//! This module contains the type definitions for Ladder Diagram (LD) elements
//! including contacts, coils, timers, counters, and function blocks.

use serde::{Deserialize, Serialize};

use crate::asl_types::core::types::AslExpr;

/// Ladder Diagram element types (IEC 61131-3)
/// These types represent the fundamental building blocks of Ladder Logic
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LadderElement {
    /// Normally Open Contact (ex: --| |--)
    ContactNo(LadderContact),
    /// Normally Closed Contact (ex: --|/|--)
    ContactNc(LadderContact),
    /// Contact for positive edge detection (R_TRIG)
    ContactRising(LadderContact),
    /// Contact for negative edge detection (F_TRIG)
    ContactFalling(LadderContact),
    /// Output Coil (ex: --( )--)
    CoilOutput(LadderCoil),
    /// Negated Output Coil (ex: --( / )--)
    CoilNegated(LadderCoil),
    /// Set Coil (ex: --(S)--) - latches output to 1
    CoilSet(LadderCoil),
    /// Reset Coil (ex: --(R)--) - latches output to 0
    CoilReset(LadderCoil),
    /// Latch Coil - alternative syntax for Set
    CoilLatch(LadderCoil),
    /// Unlatch Coil - alternative syntax for Reset
    CoilUnlatch(LadderCoil),
    /// Timer ON Delay (TON)
    TimerTon(LadderTimerTon),
    /// Timer OFF Delay (TOF)
    TimerTof(LadderTimerTof),
    /// Timer Pulse (TP)
    TimerTp(LadderTimerTp),
    /// Counter Up (CTU)
    CounterCtu(LadderCounterCtu),
    /// Counter Down (CTD)
    CounterCtd(LadderCounterCtd),
    /// Counter Up/Down (CTUD)
    CounterCtud(LadderCounterCtud),
    /// Set-Reset Latch (dominant Set)
    LatchSr(LadderLatchSr),
    /// Reset-Set Latch (dominant Reset)
    LatchRs(LadderLatchRs),
    /// Function Block Instance
    FunctionBlock(LadderFbInstance),
}

// ============================================================================
// Contact Types
// ============================================================================

/// Base contact structure - used by both NO and NC contacts
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderContact {
    /// Variable name being monitored (e.g., "StartButton", "Sensor1")
    pub variable: String,
    /// Optional comment/description
    pub comment: Option<String>,
    /// Position in rung for visual layout
    pub position: Option<LadderPosition>,
}

/// Position in the Ladder Diagram grid
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LadderPosition {
    pub x: u32,
    pub y: u32,
}

// ============================================================================
// Coil Types
// ============================================================================

/// Base coil structure - used by all coil types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderCoil {
    /// Target variable to write to (e.g., "Motor", "Valve1")
    pub variable: String,
    /// Optional comment/description
    pub comment: Option<String>,
    /// Position in rung for visual layout
    pub position: Option<LadderPosition>,
}

// ============================================================================
// Timer Types (IEC 61131-3)
// ============================================================================

/// Timer ON Delay (TON) - output true after preset time
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderTimerTon {
    /// Instance name (e.g., "Timer1", "Delay_5s")
    pub instance: String,
    /// Input trigger (boolean expression)
    pub r#in: AslExpr,
    /// Preset Time (duration)
    pub pt: AslExpr,
    /// Output Q (elapsed time >= preset)
    pub out_q: AslExpr,
    /// Output ET (elapsed time)
    pub out_et: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

/// Timer OFF Delay (TOF) - output false after preset time after input goes low
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderTimerTof {
    /// Instance name
    pub instance: String,
    /// Input trigger
    pub r#in: AslExpr,
    /// Preset Time
    pub pt: AslExpr,
    /// Output Q
    pub out_q: AslExpr,
    /// Output ET (elapsed time)
    pub out_et: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

/// Timer Pulse (TP) - output true for preset duration regardless of input
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderTimerTp {
    /// Instance name
    pub instance: String,
    /// Input trigger
    pub r#in: AslExpr,
    /// Preset Time (pulse duration)
    pub pt: AslExpr,
    /// Output Q (pulse output)
    pub out_q: AslExpr,
    /// Output ET (elapsed time)
    pub out_et: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

// ============================================================================
// Counter Types (IEC 61131-3)
// ============================================================================

/// Counter Up (CTU) - increments on each rising edge
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderCounterCtu {
    /// Instance name
    pub instance: String,
    /// Count Up input (rising edge triggers)
    pub cu: AslExpr,
    /// Reset input
    pub r: AslExpr,
    /// Preset Value
    pub pv: AslExpr,
    /// Output Q (counter >= preset)
    pub out_q: AslExpr,
    /// Output CV (current value)
    pub out_cv: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

/// Counter Down (CTD) - decrements on each rising edge
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderCounterCtd {
    /// Instance name
    pub instance: String,
    /// Count Down input
    pub cd: AslExpr,
    /// Load input (loads preset value)
    pub ld: AslExpr,
    /// Preset Value
    pub pv: AslExpr,
    /// Output Q (counter <= 0)
    pub out_q: AslExpr,
    /// Output CV (current value)
    pub out_cv: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

/// Counter Up/Down (CTUD) - bidirectional counter
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderCounterCtud {
    /// Instance name
    pub instance: String,
    /// Count Up input
    pub cu: AslExpr,
    /// Count Down input
    pub cd: AslExpr,
    /// Reset input
    pub r: AslExpr,
    /// Load input
    pub ld: AslExpr,
    /// Preset Value
    pub pv: AslExpr,
    /// Output QU (up counter >= preset)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_qu: Option<String>,
    /// Output QD (down counter <= 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_qd: Option<String>,
    /// Output CV (current value)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_cv: Option<String>,
    /// Optional comment
    pub comment: Option<String>,
}

// ============================================================================
// Latch Types (SR / RS)
// ============================================================================

/// Set-Reset Latch (dominant Set)
/// When S=True, output=True. When both S and R are True, S dominates.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderLatchSr {
    /// Instance name
    pub instance: String,
    /// Set input
    pub s: AslExpr,
    /// Reset input
    pub r: AslExpr,
    /// Output variable
    pub output: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

/// Reset-Set Latch (dominant Reset)
/// When R=True, output=False. When both S and R are True, R dominates.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderLatchRs {
    /// Instance name
    pub instance: String,
    /// Reset input
    pub r: AslExpr,
    /// Set input
    pub s: AslExpr,
    /// Output variable
    pub output: AslExpr,
    /// Optional comment
    pub comment: Option<String>,
}

// ============================================================================
// Function Block Types
// ============================================================================

/// Function Block instance (generic FB call)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderFbInstance {
    /// Instance name (e.g., "MyTON", "MotorCtrl1")
    pub instance: String,
    /// Function Block type (e.g., "TON", "CTU", "R_TRIG", "自定义FB")
    pub fb_type: String,
    /// Input connections (variable name -> expression)
    pub inputs: Vec<(String, AslExpr)>,
    /// Output connections (output name -> target variable)
    pub outputs: Vec<(String, String)>,
    /// Optional position in ladder
    pub position: Option<LadderPosition>,
    /// Optional comment
    pub comment: Option<String>,
}

// ============================================================================
// Rung / Network
// ============================================================================

/// A single rung (network) in Ladder Diagram
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderRung {
    /// Rung number (1-based)
    pub number: u32,
    /// Optional comment/description
    pub comment: Option<String>,
    /// Elements in this rung (left to right evaluation)
    pub elements: Vec<LadderElement>,
}

/// Complete Ladder Diagram program
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderProgram {
    /// Program name
    pub name: String,
    /// All rungs in the program
    pub rungs: Vec<LadderRung>,
    /// Variable declarations
    pub variables: Vec<LadderVariable>,
}

/// Variable declaration in Ladder
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderVariable {
    pub name: String,
    pub var_type: String, // "BOOL", "INT", "TIMER", "COUNTER", etc.
    pub initial_value: Option<AslExpr>,
    pub comment: Option<String>,
}

// ============================================================================
// Ladder-specific Expression Types
// ============================================================================

/// Expression type for ladder logic combining elements
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LadderExpr {
    /// Direct variable reference
    Var(String),
    /// Contact with optional negation
    Contact { variable: String, negated: bool },
    /// Timer/counter output
    TimerOutput {
        instance: String,
        output: String, // "Q" or "ET"
    },
    /// Counter output
    CounterOutput {
        instance: String,
        output: String, // "Q" or "CV"
    },
    /// Latch output
    LatchOutput { instance: String },
    /// FB output
    FbOutput { instance: String, output: String },
    /// Binary operation (AND, OR)
    Binary {
        op: LadderLogicOp,
        left: Box<LadderExpr>,
        right: Box<LadderExpr>,
    },
    /// Unary operation (NOT)
    Unary {
        op: LadderLogicOp,
        expr: Box<LadderExpr>,
    },
}

/// Logical operations in Ladder
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LadderLogicOp {
    And,
    Or,
    Xor,
    Not,
}

// ============================================================================
// Branch Support
// ============================================================================

/// Branch in Ladder (parallel execution path)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderBranch {
    /// Branch ID for tracking connections
    pub id: u32,
    /// Elements in the branch
    pub elements: Vec<LadderElement>,
    /// Parent branch ID (None for root branches)
    pub parent: Option<u32>,
}

/// Connection point in Ladder diagram
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LadderConnection {
    /// Source element ID
    pub from_id: u32,
    /// Target element ID
    pub to_id: u32,
    /// Connection type
    pub conn_type: ConnectionType,
}

/// Type of connection between elements
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionType {
    #[default]
    /// Serial connection (next element in series)
    Series,
    /// Parallel connection (branch)
    Parallel,
    /// Output connection (driving next element)
    Output,
}

// ============================================================================
// Helper Functions
// ============================================================================

impl LadderElement {
    /// Creates a Normally Open contact
    pub fn contact_no(variable: &str) -> Self {
        LadderElement::ContactNo(LadderContact {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates a Normally Closed contact
    pub fn contact_nc(variable: &str) -> Self {
        LadderElement::ContactNc(LadderContact {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates a Rising edge contact (R_TRIG equivalent)
    pub fn contact_rising(variable: &str) -> Self {
        LadderElement::ContactRising(LadderContact {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates a Falling edge contact (F_TRIG equivalent)
    pub fn contact_falling(variable: &str) -> Self {
        LadderElement::ContactFalling(LadderContact {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates an Output coil
    pub fn coil_output(variable: &str) -> Self {
        LadderElement::CoilOutput(LadderCoil {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates a Set coil (latch)
    pub fn coil_set(variable: &str) -> Self {
        LadderElement::CoilSet(LadderCoil {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }

    /// Creates a Reset coil (unlatch)
    pub fn coil_reset(variable: &str) -> Self {
        LadderElement::CoilReset(LadderCoil {
            variable: variable.to_string(),
            comment: None,
            position: None,
        })
    }
}

impl LadderProgram {
    /// Creates a new empty Ladder program
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            rungs: vec![],
            variables: vec![],
        }
    }

    /// Adds a rung to the program
    pub fn add_rung(&mut self, rung: LadderRung) {
        self.rungs.push(rung);
    }
}

impl LadderRung {
    /// Creates a new empty rung
    pub fn new(number: u32) -> Self {
        Self {
            number,
            comment: None,
            elements: vec![],
        }
    }

    /// Adds an element to the rung
    pub fn add_element(&mut self, element: LadderElement) {
        self.elements.push(element);
    }
}
