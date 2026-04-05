//! Component types module: ComponentProfile, Signal, AslHint, HmiWidget

pub mod asl_hint;
pub mod component_profile;

// Re-export commonly used types
pub use asl_hint::*;
pub use component_profile::*;
