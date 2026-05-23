use tree_sitter::{Node, Tree};
use crate::asl_types::core::program::AslStatement;
use crate::parser::tree_sitter_loader::TargetLang;

pub struct AstNormalizer;

impl AstNormalizer {
    /// Translates a generic Tree-sitter AST into our unified ASL Statements.
    pub fn translate(tree: Tree, source: &str, lang: TargetLang) -> Result<Vec<AslStatement>, String> {
        let root = tree.root_node();
        let mut asl_body = Vec::new();

        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            let stmt_opt = match lang {
                TargetLang::Python => Self::visit_python_node(child, source)?,
                TargetLang::Cpp => Self::visit_cpp_node(child, source)?,
                TargetLang::Rust => Self::visit_rust_node(child, source)?,
                _ => return Err("Unsupported normalizer language target.".to_string()),
            };

            if let Some(stmt) = stmt_opt {
                asl_body.push(stmt);
            }
        }

        Ok(asl_body)
    }

    // --- Language Specific Visitors ---

    fn visit_python_node(node: Node, _source: &str) -> Result<Option<AslStatement>, String> {
        let kind = node.kind();
        
        match kind {
            "comment" | "pass_statement" => Ok(None), // Safely ignore
            "expression_statement" => {
                // TODO: Extract assignments, function calls, etc.
                // let text = &source[node.start_byte()..node.end_byte()];
                // println!("Found Python Expression: {}", text);
                Ok(None)
            }
            "if_statement" => {
                // TODO: Map to AslStatement::IfBlock
                Ok(None)
            }
            _ => {
                // Unmapped nodes fall through gracefully during active development
                // println!("Unmapped Python Node: {}", kind);
                Ok(None)
            }
        }
    }

    fn visit_cpp_node(_node: Node, _source: &str) -> Result<Option<AslStatement>, String> {
        // Implementation for C++ translation
        Ok(None)
    }

    fn visit_rust_node(_node: Node, _source: &str) -> Result<Option<AslStatement>, String> {
        // Implementation for Rust translation
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::tree_sitter_loader::{parse_user_code, TargetLang};

    #[test]
    fn test_normalizer_translate_cpp() {
        let code = "int main() { return 0; }";
        let tree = parse_user_code(code, TargetLang::Cpp).unwrap();
        let statements = AstNormalizer::translate(tree, code, TargetLang::Cpp);
        assert!(statements.is_ok());
    }
}
