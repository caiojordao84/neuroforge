//! code_to_asl.rs — Pipeline 1: ProgramNode → AslProgram (IR de simulação)
//! Entry point público: fn ast_to_asl(program: &ProgramNode, language: Language) -> AslProgram
//! Migrado de: src/engine/asl/codeToASL.ts (função astToASL)
//!
//! REGRA DE OURO: AslProgram é estritamente o IR de SIMULAÇÃO.
//! Nunca é usado na transpilação (Pipeline 2 usa ProgramNode directamente).

use crate::transforms::context::{Language, TransformContext};
use crate::transforms::statement_registry::program_to_asl;
use crate::types::asl_types::AslProgram;
use crate::types::typed_nodes::ProgramNode;

/// Converte um `ProgramNode` normalizado em `AslProgram`.
///
/// # Argumentos
/// * `program`  — AST normalizado (saída de `ast_normalizer::normalize`)
/// * `language` — Linguagem de origem (para resolução de tipos e shims)
///
/// # Retorna
/// `AslProgram` com `asl_version = "4.0.0"`
pub fn ast_to_asl(program: &ProgramNode, language: Language) -> AslProgram {
    let mut ctx = TransformContext::new(Some(language));
    program_to_asl(program, &mut ctx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transforms::context::Language;
    use crate::types::typed_nodes::ProgramNode;

    #[test]
    fn test_empty_program_produces_valid_asl() {
        let program = ProgramNode::empty();
        let asl = ast_to_asl(&program, Language::Cpp);
        assert_eq!(asl.asl_version, "4.0.0");
        assert!(asl.tasks.len() >= 1);
    }
}
