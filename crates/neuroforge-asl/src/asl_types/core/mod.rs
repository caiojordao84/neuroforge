//! Core types module for ASL: AslProgram, AslStatement, types, operators
//!
//! This module contains the root program structure and all statement types
//! that make up the ASL AST.

pub mod operators;
pub mod program;
pub mod types;
pub mod ladder_types;

// Re-export ALL types at the module level for convenient access
pub use operators::*;
pub use program::*;
pub use types::*;
pub use ladder_types::*;

// ============================================================================
// Phase B.2 Master Document (TOON File)
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimer {
    pub timer_type: String, // "TON" or "TOF"
    pub preset_ms: u32,
    pub on_done_callback: Option<String>,
}

/// The absolute root of the Abstract Simulation Layer IR (TOON format).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslToonProgram {
    /// Dependency Injection: The hardware interface
    pub hardware_map: HashMap<u8, crate::asl_types::board::pin_map::LogicalPin>,
    
    /// Global Constants (from `data:`)
    pub constants: HashMap<String, crate::asl_types::core::types::AslVariable>,
    
    /// Global Mutable State (from `state:`)
    pub state_memory: HashMap<String, crate::asl_types::core::types::AslVariable>,
    
    /// Native IEC 61131-3 Timers (from `timers:`)
    pub timers: HashMap<String, AslTimer>,
    
    /// The parsed logic blocks
    pub routines: Vec<crate::asl_types::core::program::AslRoutine>,
}

impl AslToonProgram {
    /// Validates that all hardware calls in the routines reference valid pins
    /// in the hardware_map. (Implementation in B.2 validation phase).
    pub fn validate_hardware_bindings(&self) -> Result<(), String> {
        // Validation logic here
        Ok(())
    }
}
