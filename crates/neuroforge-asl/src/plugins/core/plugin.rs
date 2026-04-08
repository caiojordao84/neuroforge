//! Plugin interface for language targets.
//!
//! P1.4: Defines the trait that all language plugins must implement
//! for parsing, generation, and metadata.

use crate::parser::language_registry::LanguageMeta;
use crate::types::asl_types::AslProgram;

/// Result type for plugin operations.
pub type PluginResult<T> = Result<T, PluginError>;

/// Errors that can occur in plugin operations.
#[derive(Debug, thiserror::Error)]
pub enum PluginError {
    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Generation error: {0}")]
    GenerationError(String),

    #[error("Language not supported: {0}")]
    UnsupportedLanguage(String),

    #[error("Plugin error: {0}")]
    Other(String),
}

/// Trait that defines the interface for language plugins.
///
/// All plugins that support ASL transpilation must implement this trait.
/// It provides unified access to parsing, code generation, and metadata.
pub trait LanguagePlugin: Send + Sync {
    /// Unique identifier for the plugin (e.g., "cpp", "python", "zig").
    fn plugin_id(&self) -> &str;

    /// Get language metadata for the registry.
    fn metadata(&self) -> &LanguageMeta;

    /// Parse source code in the target language and return an AslProgram.
    /// Returns Err if parsing fails.
    fn parse(&self, source: &str) -> PluginResult<AslProgram>;

    /// Generate target code from an AslProgram.
    /// Returns the generated code as a String.
    fn generate(&self, program: &AslProgram) -> PluginResult<String>;

    /// Get the default file extension for generated code.
    fn default_extension(&self) -> &str {
        self.metadata().extension.as_str()
    }

    /// Check if this plugin supports parsing (input).
    fn supports_parsing(&self) -> bool {
        self.metadata().is_parser_supported
    }

    /// Check if this plugin supports code generation (output).
    fn supports_generation(&self) -> bool {
        self.metadata().is_asl_supported
    }
}

/// Trait for generators only (output-only plugins).
/// Implement this if the plugin only generates code but doesn't parse.
pub trait AslGeneratorPlugin: Send + Sync {
    /// Unique identifier for the generator.
    fn generator_id(&self) -> &str;

    /// Generate target code from AslProgram.
    fn generate(&self, program: &AslProgram) -> PluginResult<String>;

    /// Get the target language metadata.
    fn metadata(&self) -> &LanguageMeta;
}

/// Trait for parsers only (input-only plugins).
/// Implement this if the plugin only parses source code but doesn't generate.
pub trait AslParserPlugin: Send + Sync {
    /// Unique identifier for the parser.
    fn parser_id(&self) -> &str;

    /// Parse source code and return AslProgram.
    fn parse(&self, source: &str) -> PluginResult<AslProgram>;

    /// Get the source language metadata.
    fn metadata(&self) -> &LanguageMeta;
}

/// Dynamic plugin container for runtime plugin management.
/// Allows storing and invoking plugins without compile-time knowledge.
pub struct DynamicPlugin {
    pub id: String,
    pub parse_fn: Box<dyn Fn(&str) -> PluginResult<AslProgram> + Send + Sync>,
    pub generate_fn: Box<dyn Fn(&AslProgram) -> PluginResult<String> + Send + Sync>,
    pub metadata: LanguageMeta,
}

impl DynamicPlugin {
    pub fn new(
        id: String,
        metadata: LanguageMeta,
        parse_fn: Box<dyn Fn(&str) -> PluginResult<AslProgram> + Send + Sync>,
        generate_fn: Box<dyn Fn(&AslProgram) -> PluginResult<String> + Send + Sync>,
    ) -> Self {
        Self {
            id,
            parse_fn,
            generate_fn,
            metadata,
        }
    }

    pub fn parse(&self, source: &str) -> PluginResult<AslProgram> {
        (self.parse_fn)(source)
    }

    pub fn generate(&self, program: &AslProgram) -> PluginResult<String> {
        (self.generate_fn)(program)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_error_display() {
        let err = PluginError::ParseError("test error".to_string());
        assert_eq!(err.to_string(), "Parse error: test error");

        let err = PluginError::GenerationError("gen failed".to_string());
        assert_eq!(err.to_string(), "Generation error: gen failed");
    }

    #[test]
    fn test_dynamic_plugin() {
        let meta = LanguageMeta {
            id: "test".into(),
            display_name: "Test Language".into(),
            extension: ".test".into(),
            monaco_language: "plaintext".into(),
            category: crate::parser::language_registry::LanguageCategory::Mcu,
            is_asl_supported: true,
            is_parser_supported: true,
        };

        let plugin = DynamicPlugin::new(
            "test".into(),
            meta,
            Box::new(|_| Ok(AslProgram::default())),
            Box::new(|_| Ok("generated".to_string())),
        );

        let result = plugin.parse("test source");
        assert!(result.is_ok());

        let result = plugin.generate(&AslProgram::default());
        assert!(result.is_ok());
    }
}
