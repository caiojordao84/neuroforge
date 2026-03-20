//! language_registry.rs — registry de linguagens suportadas com metadata
//! Migrado de: src/engine/asl/LanguageRegistry.ts

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LanguageCategory {
    Mcu,
    Plc,
    Scripting,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageMeta {
    /// Identificador interno (ex: "cpp", "micropython", "st")
    pub id: String,
    /// Nome de exibição (ex: "C/C++ Arduino", "MicroPython")
    pub display_name: String,
    /// Extensão de ficheiro padrão (ex: ".ino", ".py", ".st")
    pub extension: String,
    /// ID de linguagem para Monaco Editor
    pub monaco_language: String,
    /// Categoria
    pub category: LanguageCategory,
    /// Suporte a geração ASL completa
    pub is_asl_supported: bool,
    /// Suporte a parsing (entrada) ASL
    pub is_parser_supported: bool,
}

pub struct LanguageRegistry {
    languages: HashMap<String, LanguageMeta>,
}

impl LanguageRegistry {
    pub fn new() -> Self {
        let mut reg = Self { languages: HashMap::new() };
        reg.register_defaults();
        reg
    }

    fn register_defaults(&mut self) {
        let langs = vec![
            LanguageMeta {
                id: "cpp".into(), display_name: "C/C++ Arduino".into(),
                extension: ".ino".into(), monaco_language: "cpp".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "micropython".into(), display_name: "MicroPython".into(),
                extension: ".py".into(), monaco_language: "python".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "rust_std".into(), display_name: "Rust embedded-hal".into(),
                extension: ".rs".into(), monaco_language: "rust".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "rust_embassy".into(), display_name: "Rust Embassy".into(),
                extension: ".rs".into(), monaco_language: "rust".into(),
                category: LanguageCategory::Mcu,
                is_asl_supported: false, is_parser_supported: false, // Fase 3
            },
            LanguageMeta {
                id: "st".into(), display_name: "Structured Text (IEC 61131-3)".into(),
                extension: ".st".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "ld".into(), display_name: "Ladder Diagram".into(),
                extension: ".ld".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "il".into(), display_name: "Instruction List".into(),
                extension: ".il".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "fbd".into(), display_name: "Function Block Diagram".into(),
                extension: ".fbd".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: true,
            },
            LanguageMeta {
                id: "sfc".into(), display_name: "Sequential Function Chart".into(),
                extension: ".sfc".into(), monaco_language: "plaintext".into(),
                category: LanguageCategory::Plc,
                is_asl_supported: true, is_parser_supported: false, // Fase 6
            },
        ];
        for lang in langs {
            self.languages.insert(lang.id.clone(), lang);
        }
    }

    pub fn get(&self, id: &str) -> Option<&LanguageMeta> {
        self.languages.get(id)
    }

    pub fn all(&self) -> Vec<&LanguageMeta> {
        self.languages.values().collect()
    }

    pub fn asl_supported(&self) -> Vec<&LanguageMeta> {
        self.languages.values()
            .filter(|l| l.is_asl_supported)
            .collect()
    }

    pub fn register(&mut self, lang: LanguageMeta) {
        self.languages.insert(lang.id.clone(), lang);
    }
}

impl Default for LanguageRegistry {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpp_registered() {
        let reg = LanguageRegistry::new();
        assert!(reg.get("cpp").is_some());
    }

    #[test]
    fn test_asl_supported_languages() {
        let reg = LanguageRegistry::new();
        let supported = reg.asl_supported();
        assert!(supported.iter().any(|l| l.id == "cpp"));
        assert!(supported.iter().any(|l| l.id == "st"));
    }
}
