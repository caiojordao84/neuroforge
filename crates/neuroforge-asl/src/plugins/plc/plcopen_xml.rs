//! PLCopen XML wrapper sobre a crate `plcopen` 0.3.1.

//! RT-2: usa exclusivamente a crate oficial, sem fallback manual.

//!

//! A crate j   exp  e `Project`, `Body`, `LdObjects`, `FbdObjects`, `SfcObjects`,

//! `from_str` e `to_string`, cobrindo ST / IL / LD / FBD / SFC.

//!

//! Nomes gerados pelo schema XSD s  o verbosos mas est  veis:

//!   Root_project_InlineType_types_InlineType_pous_InlineType_pou_Inline (sem sufixo Type)

//!   pou.name e pou.pou_type s  o String diretos (n  o Option).

use crate::types::{AslPlcProgram, AslType};

pub use plcopen::to_string as project_to_xml_string;

pub use plcopen::Project;

// Alias local para o tipo verboso gerado pelo schema XSD da crate `plcopen`.

type PlcPou = plcopen::Root_project_InlineType_types_InlineType_pous_InlineType_pou_Inline;

#[derive(Debug, thiserror::Error)]

pub enum PlcOpenXmlError {
    #[error("PLCopen XML parse error: {0}")]
    Parse(String),

    #[error("PLCopen XML serialize error: {0}")]
    Serialize(String),
}

/// Parse seguro e tipado de um ficheiro PLCopen TC6 XML.

pub fn parse_project(xml: &str) -> Result<Project, PlcOpenXmlError> {
    plcopen::from_str::<Project>(xml).map_err(|e| PlcOpenXmlError::Parse(e.to_string()))
}

/// Serializa o `Project` tipado de volta para XML PLCopen.

pub fn serialize_project(project: &Project) -> Result<String, PlcOpenXmlError> {
    plcopen::to_string(project).map_err(|e| PlcOpenXmlError::Serialize(e.to_string()))
}

/// Visitor simples para percorrer todos os POUs tipados do projeto.

///

/// `name` e `pou_type` s  o `String` diretos na struct gerada (n  o `Option`).

pub fn for_each_pou<F>(project: &Project, mut f: F)
where
    F: FnMut(&str, &str, &PlcPou),
{
    let Some(types) = project.types.as_ref() else {
        return;
    };

    let Some(pous) = types.pous.as_ref() else {
        return;
    };

    for pou in &pous.pou {
        let name = pou.name.as_str();

        let pou_type = pou.pou_type.as_str();

        f(name, pou_type, pou);
    }
}

/// Helper m  nimo para criar um `AslPlcProgram` a partir de metadados do POU.

///

/// Os parsers LD/FBD/SFC completam depois `variables`, `networks` e `functions`.

pub fn make_plc_program(name: &str) -> AslPlcProgram {
    AslPlcProgram {
        name: name.to_string(),

        variables: vec![],

        networks: vec![],

        functions: vec![],
    }
}

/// Mapeamento conservador dos tipos IEC textuais mais comuns para `AslType`.

/// Tipos desconhecidos ficam em `Struct` para evitar perda sem  ntica precoce.

pub fn map_iec_type(type_name: &str) -> AslType {
    match type_name.trim().to_ascii_uppercase().as_str() {
        "BOOL" => AslType::Bool,

        "REAL" | "LREAL" => AslType::Float,

        "STRING" | "WSTRING" | "CHAR" | "WCHAR" => AslType::String,

        "INT" | "SINT" | "DINT" | "LINT" | "USINT" | "UINT" | "UDINT" | "ULINT" | "BYTE"
        | "WORD" | "DWORD" | "LWORD" => AslType::Int,

        _ => AslType::Struct,
    }
}

// ============================================================================

// Testes RT-2

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    #[test]

    fn map_iec_bool() {
        assert!(matches!(map_iec_type("BOOL"), AslType::Bool));
    }

    #[test]

    fn map_iec_int_variants() {
        for t in &["INT", "DINT", "UINT", "BYTE", "WORD"] {
            assert!(matches!(map_iec_type(t), AslType::Int), "failed for {t}");
        }
    }

    #[test]

    fn map_iec_float() {
        assert!(matches!(map_iec_type("REAL"), AslType::Float));

        assert!(matches!(map_iec_type("LREAL"), AslType::Float));
    }

    #[test]

    fn map_iec_unknown_is_struct() {
        assert!(matches!(map_iec_type("MY_CUSTOM_TYPE"), AslType::Struct));
    }

    #[test]

    fn make_plc_program_name() {
        let prog = make_plc_program("TestPOU");

        assert_eq!(prog.name, "TestPOU");

        assert!(prog.variables.is_empty());

        assert!(prog.networks.is_empty());
    }

    #[test]

    fn parse_invalid_xml_returns_err() {
        let result = parse_project("<not_valid_xml");

        assert!(result.is_err());
    }
}
