//! neuroforge-asl - Motor ASL universal do NeuroForge
//! Migração de TypeScript para Rust em curso (Fase 1+)

// Allow style warnings across the crate - these are purely cosmetic and don't affect functionality
#![allow(clippy::empty_line_after_doc_comments)]
#![allow(clippy::empty_line_after_outer_attr)]
#![allow(clippy::needless_update)]

pub mod executor;
pub mod flow;
pub mod helpers;
pub mod optimizer;
pub mod parser;
pub mod stdlib;
pub mod plugins;
pub mod transforms;
pub mod transpile;
pub mod types;


// New modular type system (Task 14)
pub mod asl_types;

// PyO3 Native Python Bindings
pub mod python_bindings;


// Re-export transpile functions for convenient access
pub use crate::transpile::transpile;
pub use crate::transpile::transpile_with_map;

// Re-export AwareTranspileOutput for the agent system
pub use crate::executor::asl_executor::AwareTranspileOutput;
