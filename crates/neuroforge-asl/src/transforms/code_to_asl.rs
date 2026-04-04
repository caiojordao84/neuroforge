//! code_to_asl.rs     Pipeline 1: ProgramNode     AslProgram (Universal Omni-directional IR)

//! Entry point p  blico: fn ast_to_asl(program: &ProgramNode, language: Language) -> AslProgram

//! Migrado de: src/engine/asl/codeToASL.ts (fun    o astToASL)

//!

//! REGRA DE OURO DA ARQUITETURA NEUROFORGE:

//! AslProgram (ASL v4 JSON Tree)    a representa    o intermedi  ria (IR) *universal* e *omnidirecional*.

//! Ele serve tanto para SIMULA    O quanto como piv   principal para a TRANSCOMPILA    O cruzada entre qualquer linguagem.



use crate::transforms::context::{Language, TransformContext};

use crate::transforms::statement_registry::program_to_asl;

use crate::types::asl_types::AslProgram;

use crate::types::typed_nodes::ProgramNode;



/// Converte um `ProgramNode` normalizado em `AslProgram`.

///

/// # Argumentos

/// * `program`      AST normalizado (sa  da de `ast_normalizer::normalize`)

/// * `language`     Linguagem de origem (para resolu    o de tipos e shims)

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











