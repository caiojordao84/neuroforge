//! Board types module: BoardProfile, PinMap, PinCapabilities, restrictions

pub mod board_profile;
pub mod pin_map;
pub mod validation;

// Re-export from board_profile only to avoid ambiguity
pub use board_profile::{
    AslTarget, BoardProfile, BoardToonError, BootWarning, CurrentLimit, InterruptCapability,
    InterruptTrigger, LogicalPin, PhysicalPin, PinCapabilities, PinHint, PinMap, PinModeCapability,
    PinRestriction, SvgMap, SvgPinAnchor, ToonResult, WarningSeverity,
};

// Re-export validation
pub use validation::ValidationError;
