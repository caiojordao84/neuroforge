//! Transpile context types for code generation.
//!
//! This module contains the context passed through the transpilation pipeline,
//! including source information, options, and intermediate representation hash.

use serde::Serialize;

use crate::asl_types::board::{AslTarget, BoardProfile};
use crate::asl_types::component::ComponentProfile;
use crate::asl_types::core::program::AslProgram;

/// Context for transpilation with deterministic cache keys.
///
/// This is the core transpilation context used for generating cache keys
/// and passing program/board information through the transpilation pipeline.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranspileContext {
    /// Source ASL program
    pub asl_program: AslProgram,
    /// Target board profile
    pub board_profile: BoardProfile,
    /// Target configuration
    pub target: AslTarget,
    /// IR hash for caching (FNV-1a on canonical TOON)
    pub ir_hash: u64,
    /// ASL version string
    pub asl_version: String,
    /// Component profiles
    pub components: Vec<ComponentProfile>,
}

/// Error type for TOON serialization operations.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ToonError {
    pub message: String,
}

impl std::fmt::Display for ToonError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ToonError: {}", self.message)
    }
}

impl std::error::Error for ToonError {}

impl From<serde_toon::Error> for ToonError {
    fn from(err: serde_toon::Error) -> Self {
        ToonError {
            message: err.to_string(),
        }
    }
}

/// Compute FNV-1a hash of an ASL program for deterministic caching.
///
/// Uses canonical TOON serialization - same program produces same hash.
pub fn compute_ir_hash(program: &AslProgram) -> u64 {
    // Use serde_toon for canonical serialization
    // This provides deterministic output for the same program
    let canonical =
        serde_toon::to_string(program).expect("AslProgram must be serializable to TOON");

    // FNV-1a 64-bit hash
    let mut hash: u64 = 14695981039346656037; // FNV offset basis
    for byte in canonical.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211); // FNV prime
    }
    hash
}

impl TranspileContext {
    /// Create a new transpile context.
    pub fn new(
        asl_program: AslProgram,
        board_profile: BoardProfile,
        target: AslTarget,
        components: Vec<ComponentProfile>,
    ) -> Self {
        let ir_hash = compute_ir_hash(&asl_program);
        Self {
            asl_program,
            board_profile,
            target,
            ir_hash,
            asl_version: "4.0.0".to_string(),
            components,
        }
    }

    /// Serialize to TOON string.
    pub fn to_toon(&self) -> Result<String, ToonError> {
        Ok(serde_toon::to_string(self)?)
    }
}
