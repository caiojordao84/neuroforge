//! Módulo de parsing do NeuroForge ASL.
//!
//! Todos os parsers implementam a trait [`NeuroParser`] definida em [`neuro_parser`].

pub mod language_registry;
pub mod tree_sitter_loader;
pub mod neuro_parser;

pub use language_registry::{LanguageRegistry, LanguageMeta, LanguageCategory};
pub use tree_sitter_loader::{get_ts_language, is_ts_supported};
pub use neuro_parser::{
    NeuroParser,
    NeuroParserExt,
    ParseError,
    ParseDiagnostic,
    DiagnosticSeverity,
    Span,
    normalize,
};
