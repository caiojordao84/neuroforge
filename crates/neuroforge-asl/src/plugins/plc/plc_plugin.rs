//! PlcPlugin     ponto de entrada unificado para os 5 dialectos PLC IEC 61131-3.

//!

//! Dialectos suportados:

//!   St      Structured Text   (texto)

//!   Il      Instruction List  (texto)

//!   Ld      Ladder Diagram    (PLCopen XML)

//!   Fbd     Function Block    (PLCopen XML)

//!   Sfc     Sequential FC     (PLCopen XML)

use crate::types::asl_types::AslProgram;

use crate::parser::neuro_parser::NeuroParser;

use crate::plugins::plc::{
    fbd::generator::FbdGenerator, il::generator::IlGenerator, ld::generator::LdGenerator,
    sfc::generator::SfcGenerator, st_generator::StGenerator,
};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Dialecto IEC 61131-3 a gerar.

#[derive(Debug, Clone, PartialEq, Eq)]

pub enum PlcDialect {
    /// Structured Text
    St,

    /// Instruction List
    Il,

    /// Ladder Diagram (PLCopen XML)
    Ld,

    /// Function Block Diagram (PLCopen XML)
    Fbd,

    /// Sequential Function Chart (PLCopen XML)
    Sfc,
}

pub struct PlcPlugin;

impl PlcPlugin {
    /// Gera c  digo no dialecto pedido a partir de um `AslProgram`.

    pub fn generate(dialect: PlcDialect, program: &AslProgram) -> GeneratorOutput {
        match dialect {
            PlcDialect::St => StGenerator::new().generate(program),

            // As outras linguagens ainda v  o devolver strings diretas. Iremos embrulhar aqui por agora para manter a API.
            PlcDialect::Il => GeneratorOutput::new(IlGenerator::new().generate(program)),

            PlcDialect::Ld => GeneratorOutput::new(LdGenerator::new().generate(program)),

            PlcDialect::Fbd => GeneratorOutput::new(FbdGenerator::new().generate(program)),

            PlcDialect::Sfc => GeneratorOutput::new(SfcGenerator::new().generate(program, "st")),
        }
    }

    /// Parse ST textual     AslProgram.

    pub fn parse_st(
        src: &str,
    ) -> std::result::Result<AslProgram, crate::parser::neuro_parser::ParseError> {
        crate::plugins::plc::st_parser::StParser::parse(src)
    }

    /// Parse IL textual     AslProgram.

    pub fn parse_il(
        src: &str,
    ) -> std::result::Result<AslProgram, crate::parser::neuro_parser::ParseError> {
        crate::plugins::plc::il::parser::IlParser::parse(src).map_err(|e| {
            crate::parser::neuro_parser::ParseError::UnsupportedConstruct {
                description: e.to_string(),

                span: None,
            }
        })
    }
}

// ============================================================================

// Testes RT-12

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use crate::types::asl_types::{
        AslAssign, AslBinary, AslFunction, AslMetadata, AslProgram, AslStatement, AslVarRef,
        BinaryOp,
    };

    use crate::plugins::plc::sfc::parser::SfcParser;

    //           helpers

    fn var(name: &str) -> AslExpr {
        AslExpr::Var(AslVarRef {
            name: name.to_string(),
            ..Default::default()
        })
    }

    use crate::types::asl_types::AslExpr;

    fn binary_prog(name: &str, op: BinaryOp) -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {
                name: Some(name.to_string()),

                description: None,
                version: None,

                target_board: Some("plc".to_string()),
            },

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: name.to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Q".to_string(),

                    value: AslExpr::Binary(Box::new(AslBinary {
                        op,

                        left: var("A"),

                        right: var("B"),
                        ..Default::default()
                    })),

                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    //           testes generate por dialecto

    #[test]

    fn plugin_st_generate() {
        let prog = binary_prog("StProg", BinaryOp::And);

        let out = PlcPlugin::generate(PlcDialect::St, &prog);

        assert!(
            out.code.contains("PROGRAM"),
            "ST deve conter PROGRAM:\n{out:?}"
        );
    }

    #[test]

    fn plugin_il_generate() {
        let prog = binary_prog("IlProg", BinaryOp::And);

        let out = PlcPlugin::generate(PlcDialect::Il, &prog);

        assert!(
            out.code.contains("END_PROGRAM"),
            "IL deve conter END_PROGRAM:\n{out:?}"
        );
    }

    #[test]

    fn plugin_ld_generate() {
        let prog = binary_prog("LdProg", BinaryOp::And);

        let out = PlcPlugin::generate(PlcDialect::Ld, &prog);

        assert!(!out.code.is_empty(), "LD n  o deve produzir output vazio");
    }

    #[test]

    fn plugin_fbd_generate() {
        let prog = binary_prog("FbdProg", BinaryOp::And);

        let out = PlcPlugin::generate(PlcDialect::Fbd, &prog);

        assert!(!out.code.is_empty(), "FBD n  o deve produzir output vazio");
    }

    #[test]

    fn plugin_sfc_generate() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.plcopen.org/xml/tc6_0201">

  <types><pous><pou name="P" pouType="program"><body><SFC>

    <step localId="1" name="Init" initialStep="true" height="20" width="60"><position x="0" y="0"/></step>

  </SFC></body></pou></pous></types></project>"#;

        let prog = SfcParser::parse(xml).expect("parse SFC");

        let out = PlcPlugin::generate(PlcDialect::Sfc, &prog);

        assert!(!out.code.is_empty(), "SFC n  o deve produzir output vazio");

        assert!(
            out.code.contains("CASE") || out.code.contains("switch") || out.code.contains("match"),
            "SFC deve conter estrutura de controlo, output:\n{out:?}"
        );
    }

    //           roundtrip ST

    #[test]

    fn plugin_st_roundtrip() {
        let src = r#"

PROGRAM Main

  VAR

    Counter : INT := 0;

  END_VAR

  IF Counter > 0 THEN

    Counter := 0;

  END_IF;

END_PROGRAM

"#;

        let prog = PlcPlugin::parse_st(src).expect("parse ST falhou");

        let out = PlcPlugin::generate(PlcDialect::St, &prog);

        assert!(
            out.code.contains("PROGRAM loop"),
            "roundtrip ST deve normalizar para loop (R7):\n{out:?}"
        );

        assert!(
            out.code.contains("IF"),
            "roundtrip ST deve preservar IF:\n{out:?}"
        );
    }

    //           roundtrip IL

    #[test]

    fn plugin_il_roundtrip() {
        let src = r#"

PROGRAM RtIl

  VAR

    A : BOOL;

    B : BOOL;

    Q : BOOL;

  END_VAR

  LD    A

  AND   B

  ST    Q

END_PROGRAM

"#;

        let prog = PlcPlugin::parse_il(src).expect("parse IL falhou");

        let out = PlcPlugin::generate(PlcDialect::Il, &prog);

        assert!(
            out.code.contains("AND"),
            "roundtrip IL deve conter AND:\n{out:?}"
        );

        assert!(
            out.code.contains("ST"),
            "roundtrip IL deve conter ST:\n{out:?}"
        );
    }
}
