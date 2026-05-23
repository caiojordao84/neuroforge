//! tree_sitter_loader.rs     inicialização dos parsers tree-sitter por linguagem

//! Migrado de: src/engine/asl/TreeSitterLoader.ts

use tree_sitter::Language as TsLanguage;
use tree_sitter::Parser;
use std::sync::{Mutex, OnceLock};

/// Thread-safe global pool of parsers to avoid rebuilding parser engines.
static PARSER_POOL: OnceLock<Mutex<AslParserPool>> = OnceLock::new();

pub struct AslParserPool {
    cpp_parser: Parser,
    python_parser: Parser,
    rust_parser: Parser,
}

impl AslParserPool {
    pub fn new() -> Self {
        let mut cpp_parser = Parser::new();
        let cpp_lang: TsLanguage = tree_sitter_cpp::LANGUAGE.into();
        cpp_parser.set_language(&cpp_lang).expect("Error loading C++ grammar");

        let mut python_parser = Parser::new();
        let python_lang: TsLanguage = tree_sitter_python::LANGUAGE.into();
        python_parser.set_language(&python_lang).expect("Error loading Python grammar");

        let mut rust_parser = Parser::new();
        let rust_lang: TsLanguage = tree_sitter_rust::LANGUAGE.into();
        rust_parser.set_language(&rust_lang).expect("Error loading Rust grammar");

        Self {
            cpp_parser,
            python_parser,
            rust_parser,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetLang {
    Cpp,
    Python,
    Rust,
    StructuredText,
    AslToon,
}

/// Parses the user-provided code string into a generic Tree-sitter Tree.
pub fn parse_user_code(source: &str, lang: TargetLang) -> Result<tree_sitter::Tree, String> {
    let pool = PARSER_POOL.get_or_init(|| Mutex::new(AslParserPool::new()));
    let mut pool = pool.lock().unwrap();

    let tree = match lang {
        TargetLang::Cpp => pool.cpp_parser.parse(source, None),
        TargetLang::Python => pool.python_parser.parse(source, None),
        TargetLang::Rust => pool.rust_parser.parse(source, None),
        TargetLang::StructuredText | TargetLang::AslToon => {
            return Err(format!("{:?} is not handled by Tree-sitter.", lang));
        }
    };

    tree.ok_or_else(|| "Tree-sitter failed to build the AST.".to_string())
}

/// Retorna a linguagem tree-sitter para o ID dado.
/// Retorna `None` para linguagens sem grammar tree-sitter disponível.
pub fn get_ts_language(lang_id: &str) -> Option<TsLanguage> {
    match lang_id {
        "cpp" | "c" => Some(tree_sitter_cpp::LANGUAGE.into()),
        "micropython" => Some(tree_sitter_python::LANGUAGE.into()),
        "rust_std" | "rust_embassy" => Some(tree_sitter_rust::LANGUAGE.into()),
        "arduino" => {
            Some(tree_sitter_cpp::LANGUAGE.into())
        }
        _ => None,
    }
}

/// Verifica se um ID de linguagem tem parser tree-sitter disponível
pub fn is_ts_supported(lang_id: &str) -> bool {
    get_ts_language(lang_id).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpp_ts_available() {
        assert!(get_ts_language("cpp").is_some());
    }

    #[test]
    fn test_python_ts_available() {
        assert!(get_ts_language("micropython").is_some());
    }

    #[test]
    fn test_rust_ts_available() {
        assert!(get_ts_language("rust_std").is_some());
    }

    #[test]
    fn test_st_no_ts() {
        assert!(get_ts_language("st").is_none());
    }

    #[test]
    fn test_parse_user_code_cpp() {
        let code = "int main() { return 0; }";
        let tree = parse_user_code(code, TargetLang::Cpp);
        assert!(tree.is_ok());
    }
}
