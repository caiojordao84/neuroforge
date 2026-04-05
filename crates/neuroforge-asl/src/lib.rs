//! neuroforge-asl - Motor ASL universal do NeuroForge
//! Migração de TypeScript para Rust em curso (Fase 1+)

pub mod executor;
pub mod flow;
pub mod helpers;
pub mod optimizer;
pub mod parser;
pub mod plugins;
pub mod transforms;
pub mod transpile;
pub mod types;
pub mod wasm;

// New modular type system (Task 14)
pub mod asl_types;

// Re-export transpile functions for convenient access
pub use crate::transpile::transpile;
pub use crate::transpile::transpile_with_map;
