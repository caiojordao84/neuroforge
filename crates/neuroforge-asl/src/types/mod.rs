//! Types module - re-exports from new modular type system
//!
//! This module re-exports types from the new asl_types module
//! for backward compatibility.

pub mod asl_types;

pub mod asl_plc_types;

// Re-export from both modules for backward compatibility
pub use asl_plc_types::*;
pub use asl_types::*;
