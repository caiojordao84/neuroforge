pub mod language_registry;
pub mod tree_sitter_loader;

pub use language_registry::{LanguageRegistry, LanguageMeta, LanguageCategory};
pub use tree_sitter_loader::{get_ts_language, is_ts_supported};
