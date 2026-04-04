//! # NeuroParser     Trait central de parsing do NeuroForge

//!

//! Define o contrato que TODOS os parsers devem honrar para produzir

//! um `AslProgram` can  nico conforme o ASL Semantic Dictionary v1.2.3.

use std::fmt;

use thiserror::Error;

use crate::types::asl_types::{AslExpr, AslLiteral, AslProgram};

// ============================================================================

// Span and Diagnostic types

// ============================================================================

/// Posi    o textual num ficheiro fonte.

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]

pub struct Span {
    pub line: u32,

    pub col: u32,

    pub len: u32,
}

impl fmt::Display for Span {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.line, self.col)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]

pub enum DiagnosticSeverity {
    Error,
    Warning,
    Note,
}

impl fmt::Display for DiagnosticSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiagnosticSeverity::Error => write!(f, "error"),

            DiagnosticSeverity::Warning => write!(f, "warning"),

            DiagnosticSeverity::Note => write!(f, "note"),
        }
    }
}

#[derive(Debug, Clone)]

pub struct ParseDiagnostic {
    pub severity: DiagnosticSeverity,

    pub message: String,

    pub span: Option<Span>,

    pub code: Option<String>,
}

impl ParseDiagnostic {
    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            severity: DiagnosticSeverity::Error,
            message: msg.into(),
            span: None,
            code: None,
        }
    }

    pub fn warning(msg: impl Into<String>) -> Self {
        Self {
            severity: DiagnosticSeverity::Warning,
            message: msg.into(),
            span: None,
            code: None,
        }
    }

    pub fn with_span(mut self, span: Span) -> Self {
        self.span = Some(span);
        self
    }

    pub fn with_code(mut self, code: impl Into<String>) -> Self {
        self.code = Some(code.into());
        self
    }
}

impl fmt::Display for ParseDiagnostic {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let code = self.code.as_deref().unwrap_or("-");

        if let Some(span) = &self.span {
            write!(
                f,
                "[{}] {} at {}: {}",
                self.severity, code, span, self.message
            )
        } else {
            write!(f, "[{}] {}: {}", self.severity, code, self.message)
        }
    }
}

// ============================================================================

// ParseError     Tipo de erro idiom  tico usando thiserror

// ============================================================================

#[derive(Error, Debug)]

pub enum ParseError {
    #[error("Unexpected token '{found}' at {span:?}, expected: {expected}")]
    UnexpectedToken {
        found: String,

        expected: String,

        span: Option<Span>,
    },

    #[error("Unsupported construct at {span:?}: {description}")]
    UnsupportedConstruct {
        description: String,

        span: Option<Span>,
    },

    #[error("Missing field '{field}' in node '{node}'")]
    MissingField { node: String, field: String },

    #[error("Invalid or unrecognised type: '{raw}'")]
    InvalidType { raw: String },

    #[error("Normalisation error (R4/R5): {description}")]
    NormalizationError { description: String },

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Custom(String),

    #[error("{0} parse error(s) encountered")]
    Multiple(String),
}

// ============================================================================

// NeuroParser     Trait principal (Contrato Central)

// ============================================================================

pub trait NeuroParser: Sized {
    type Error: std::error::Error + Send + Sync + 'static + From<ParseError>;

    /// Ponto   nico de entrada para produzir um AslProgram can  nico.

    fn parse(source: &str) -> Result<AslProgram, Self::Error>;

    /// Linguagem fonte (ex: "st", "c", "python").

    fn source_language() -> &'static str;

    fn validate(source: &str) -> Result<(), Self::Error> {
        Self::parse(source).map(|_| ())
    }

    fn parse_to_json(source: &str) -> Result<String, Self::Error> {
        let program = Self::parse(source)?;

        serde_json::to_string_pretty(&program).map_err(|e| ParseError::Custom(e.to_string()).into())
    }
}

// ============================================================================

// NeuroParserExt     Valida    o sem  ntica v1.2.3

// ============================================================================

pub trait NeuroParserExt: NeuroParser {
    fn validate_semantics(program: &AslProgram) -> Result<(), Vec<ParseDiagnostic>> {
        let mut diags = Vec::new();

        // R7     setup e loop obrigat  rias

        if !program.tasks.iter().any(|t| t.name == "setup") {
            diags.push(ParseDiagnostic::warning("Missing 'setup' task (R7)").with_code("W007"));
        }

        if !program.tasks.iter().any(|t| t.name == "loop") {
            diags.push(ParseDiagnostic::warning("Missing 'loop' task (R7)").with_code("W007"));
        }

        // Valida    o sem  ntica da vers  o ASL

        if let Err(e) = semver::Version::parse(&program.asl_version) {
            diags.push(
                ParseDiagnostic::error(format!("Invalid asl_version format: {}", e))
                    .with_code("E002"),
            );
        }

        if diags.is_empty() {
            Ok(())
        } else {
            Err(diags)
        }
    }
}

// ============================================================================

// M  dulo normalize     Helpers R4 / R5

// ============================================================================

pub mod normalize {

    use super::*;

    /// Normaliza literais booleanos/digitais (R4) usando match para performance.

    pub fn bool_like(raw: &str) -> Option<AslExpr> {
        match raw {
            "HIGH" | "high" | "True" | "true" | "TRUE" | "1" | "set_high" | "SET_HIGH" | "SET"
            | "set" => Some(AslExpr::Literal(AslLiteral {
                value: serde_json::json!(true),
                ..Default::default()
            })),

            "LOW" | "low" | "False" | "false" | "FALSE" | "0" | "set_low" | "SET_LOW" | "RESET"
            | "reset" => Some(AslExpr::Literal(AslLiteral {
                value: serde_json::json!(false),
                ..Default::default()
            })),

            _ => None,
        }
    }

    pub fn from_bool(v: bool) -> AslExpr {
        AslExpr::Literal(AslLiteral {
            value: serde_json::json!(v),
            ..Default::default()
        })
    }

    pub fn is_canonical_op(op: &str) -> bool {
        matches!(
            op,
            "+" | "-"
                | "*"
                | "/"
                | "%"
                | "//"
                | "**"
                | "=="
                | "!="
                | "<"
                | "<="
                | ">"
                | ">="
                | "&&"
                | "||"
                | "&"
                | "|"
                | "^"
                | "<<"
                | ">>"
                | "!"
                | "~"
        )
    }

    pub fn assert_asl_op(op: &str) -> Result<(), ParseError> {
        if is_canonical_op(op) {
            Ok(())
        } else {
            Err(ParseError::NormalizationError {
                description: format!("Operator '{}' is not a canonical ASL symbol (R5)", op),
            })
        }
    }

    pub fn st_for_to_exclusive(to_expr: &AslExpr) -> Option<AslExpr> {
        if let AslExpr::Literal(lit) = to_expr {
            if let Some(v) = lit.value.as_i64() {
                return Some(AslExpr::Literal(AslLiteral {
                    value: serde_json::json!(v + 1),
                }));
            }
        }

        None
    }
}

// ============================================================================

// Testes unit  rios integrados

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use super::normalize::*;

    #[test]

    fn test_r4_bool_like() {
        assert_eq!(
            bool_like("HIGH").unwrap().as_literal().unwrap().value,
            serde_json::json!(true)
        );

        assert_eq!(
            bool_like("low").unwrap().as_literal().unwrap().value,
            serde_json::json!(false)
        );
    }

    #[test]

    fn test_r5_canonical_ops() {
        assert!(is_canonical_op("+"));

        assert!(!is_canonical_op("AND"));
    }

    #[test]

    fn test_semver_validation() {
        let mut program = AslProgram::default();

        program.asl_version = "invalid".to_string();

        struct Dummy;

        impl NeuroParser for Dummy {
            type Error = ParseError;

            fn parse(_: &str) -> Result<AslProgram, Self::Error> {
                Ok(AslProgram::default())
            }

            fn source_language() -> &'static str {
                "dummy"
            }
        }

        impl NeuroParserExt for Dummy {}

        let res = <Dummy as NeuroParserExt>::validate_semantics(&program);

        assert!(res.is_err());
    }
}
