//! # NeuroParser — Trait central de parsing do NeuroForge
//!
//! Define o contrato que TODOS os parsers devem honrar para produzir
//! um `AslProgram` canónico conforme o ASL Semantic Dictionary v1.2.3.
//!
//! ## Regras fundamentais enforçadas por esta trait
//!
//! | Regra | Enforcement |
//! |-------|-------------|
//! | R1 — Nomes semânticos | A saída usa `digitalOutput`, não `digitalWrite` |
//! | R3 — `kind` como discriminante | Garantido pelo `#[serde(tag = "kind")]` em `AslStatement`/`AslExpr` |
//! | R4 — Valores numéricos, nunca constantes nomeadas | `normalize_bool_like()` converte HIGH/LOW/True/False → literal 1/0 |
//! | R5 — Operadores como símbolos directos | `BinaryOp`/`UnaryOp` serializam `"+"`, `">="`, `"&&"` — nunca `"add"`, `"gte"` |
//! | R7 — setup + loop em tasks | `validate_program()` verifica a presença de ambas |

use std::fmt;
use crate::types::asl_types::{AslProgram, AslExpr, AslLiteral};

// ============================================================================
// ParseDiagnostic — posição e severidade
// ============================================================================

/// Posição textual num ficheiro fonte.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Span {
    /// Linha 1-indexada
    pub line: u32,
    /// Coluna 1-indexada
    pub col: u32,
    /// Comprimento em caracteres (0 = ponto)
    pub len: u32,
}

impl fmt::Display for Span {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}", self.line, self.col)
    }
}

/// Severidade de um diagnóstico.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiagnosticSeverity {
    /// Erro fatal — o programa produzido pode estar incompleto.
    Error,
    /// Aviso — o programa foi produzido mas pode ter comportamento inesperado.
    Warning,
    /// Nota informativa — sem impacto na correcção.
    Note,
}

impl fmt::Display for DiagnosticSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DiagnosticSeverity::Error   => write!(f, "error"),
            DiagnosticSeverity::Warning => write!(f, "warning"),
            DiagnosticSeverity::Note    => write!(f, "note"),
        }
    }
}

/// Diagnóstico emitido durante o parse.
/// Cada parser deve emitir diagnósticos em vez de silenciar problemas.
#[derive(Debug, Clone)]
pub struct ParseDiagnostic {
    pub severity: DiagnosticSeverity,
    pub message: String,
    /// Posição opcional no source (None para erros globais).
    pub span: Option<Span>,
    /// Código identificador do diagnóstico (ex: "E001", "W042").
    pub code: Option<String>,
}

impl ParseDiagnostic {
    pub fn error(message: impl Into<String>) -> Self {
        Self { severity: DiagnosticSeverity::Error, message: message.into(), span: None, code: None }
    }
    pub fn warning(message: impl Into<String>) -> Self {
        Self { severity: DiagnosticSeverity::Warning, message: message.into(), span: None, code: None }
    }
    pub fn note(message: impl Into<String>) -> Self {
        Self { severity: DiagnosticSeverity::Note, message: message.into(), span: None, code: None }
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
        if let Some(span) = &self.span {
            write!(f, "[{}] {} at {}: {}", self.severity, self.code.as_deref().unwrap_or("-"), span, self.message)
        } else {
            write!(f, "[{}] {}: {}", self.severity, self.code.as_deref().unwrap_or("-"), self.message)
        }
    }
}

// ============================================================================
// ParseError — tipo de erro tipado
// ============================================================================

/// Erro tipado de parsing.
/// Usado como `type Error` na trait `NeuroParser`.
#[derive(Debug)]
pub enum ParseError {
    /// Token inesperado: encontrado, esperado, posição.
    UnexpectedToken { found: String, expected: String, span: Option<Span> },
    /// Construção sintática não suportada neste parser.
    UnsupportedConstruct { description: String, span: Option<Span> },
    /// Campo obrigatório ausente no AST.
    MissingField { node: String, field: String },
    /// Tipo inválido ou não reconhecido.
    InvalidType { raw: String },
    /// Falha na normalização (R4/R5): valor que não pode ser normalizado.
    NormalizationError { description: String },
    /// Erro de I/O (leitura de ficheiro, etc.).
    Io(std::io::Error),
    /// Erro genérico com mensagem.
    Custom(String),
    /// Múltiplos erros acumulados durante o parse.
    Multiple(Vec<ParseDiagnostic>),
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ParseError::UnexpectedToken { found, expected, span } => {
                if let Some(s) = span {
                    write!(f, "Unexpected token '{}' at {}, expected: {}", found, s, expected)
                } else {
                    write!(f, "Unexpected token '{}', expected: {}", found, expected)
                }
            }
            ParseError::UnsupportedConstruct { description, span } => {
                if let Some(s) = span {
                    write!(f, "Unsupported construct at {}: {}", s, description)
                } else {
                    write!(f, "Unsupported construct: {}", description)
                }
            }
            ParseError::MissingField { node, field } =>
                write!(f, "Missing field '{}' in node '{}'", field, node),
            ParseError::InvalidType { raw } =>
                write!(f, "Invalid or unrecognised type: '{}'", raw),
            ParseError::NormalizationError { description } =>
                write!(f, "Normalisation error (R4/R5): {}", description),
            ParseError::Io(e) =>
                write!(f, "I/O error: {}", e),
            ParseError::Custom(msg) =>
                write!(f, "{}", msg),
            ParseError::Multiple(diags) => {
                write!(f, "{} parse error(s):", diags.len())?;
                for d in diags {
                    write!(f, "\n  {}", d)?;
                }
                Ok(())
            }
        }
    }
}

impl std::error::Error for ParseError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        if let ParseError::Io(e) = self { Some(e) } else { None }
    }
}

impl From<std::io::Error> for ParseError {
    fn from(e: std::io::Error) -> Self { ParseError::Io(e) }
}

impl From<String> for ParseError {
    fn from(s: String) -> Self { ParseError::Custom(s) }
}

impl From<&str> for ParseError {
    fn from(s: &str) -> Self { ParseError::Custom(s.to_string()) }
}

// ============================================================================
// NeuroParser — trait principal
// ============================================================================

/// Contrato que todos os parsers NeuroForge devem implementar.
///
/// ## Garantias obrigatórias na implementação
///
/// 1. A saída é **sempre** `AslProgram` — nunca IR intermediária.
/// 2. **R1**: statements usam nomes semânticos (`digitalOutput`, `analogOutput`, etc.).
/// 3. **R4**: `HIGH`/`LOW`/`True`/`False`/`TRUE`/`FALSE`/`set_high()` são sempre
///    normalizados para `AslExpr::Literal { value: 1 }` / `AslExpr::Literal { value: 0 }`.
///    Usar [`normalize::bool_like`] para garantir conformidade.
/// 4. **R5**: operadores são sempre símbolos directos (`+`, `>=`, `&&`).
///    `BinaryOp`/`UnaryOp` garantem isto por serialização — nunca usar strings de debug.
/// 5. **R7**: o programa produzido contém sempre tasks `"setup"` e `"loop"`.
///    Se a linguagem não as distingue, o parser separa por heurística.
/// 6. **for** range: `to` é sempre exclusivo (`i < to`).
///    ST parser: `TO 9` → `to: 10`.
pub trait NeuroParser: Sized {
    /// Tipo de erro específico deste parser.
    /// Deve implementar `std::error::Error + Send + Sync + 'static`.
    type Error: std::error::Error + Send + Sync + 'static + From<ParseError>;

    /// Ponto único de entrada.
    ///
    /// Recebe o source text e devolve um `AslProgram` canónico.
    /// Todos os invariantes do Dicionário devem estar satisfeitos na saída.
    fn parse(source: &str) -> Result<AslProgram, Self::Error>;

    /// Identifica a linguagem fonte deste parser.
    ///
    /// Deve coincidir com os IDs do `LanguageRegistry` (ex: `"cpp"`, `"python"`, `"st"`, `"rust"`).
    fn source_language() -> &'static str;

    /// Valida se o source é parseável sem produzir o programa completo.
    ///
    /// Implementação por defeito: tenta fazer parse e descarta o resultado.
    /// Parsers podem sobrescrever com uma validação mais leve.
    fn validate(source: &str) -> Result<(), Self::Error> {
        Self::parse(source).map(|_| ())
    }

    /// Produz o `AslProgram` serializado como JSON canónico.
    ///
    /// Implementação por defeito via serde_json. Não é necessário sobrescrever.
    fn parse_to_json(source: &str) -> Result<String, Self::Error>
    where
        Self::Error: From<ParseError>,
    {
        let program = Self::parse(source)?;
        serde_json::to_string_pretty(&program)
            .map_err(|e| Self::Error::from(ParseError::Custom(e.to_string())))
    }
}

// ============================================================================
// NeuroParserExt — validação semântica pós-parse
// ============================================================================

/// Extensão opcional para validação semântica sobre `AslProgram`.
///
/// Implementar em parsers que precisam de verificação adicional
/// após a produção do `AslProgram`.
pub trait NeuroParserExt: NeuroParser {
    /// Valida o `AslProgram` produzido contra as regras do Dicionário.
    ///
    /// Devolve `Ok(())` se conforme, ou uma lista de diagnósticos.
    /// Não é fatal — um programa com avisos ainda é utilizável.
    fn validate_program(program: &AslProgram) -> Result<(), Vec<ParseDiagnostic>> {
        let mut diags: Vec<ParseDiagnostic> = Vec::new();

        // R7 — setup e loop obrigatórias
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop  = program.tasks.iter().any(|t| t.name == "loop");

        if !has_setup {
            diags.push(
                ParseDiagnostic::warning("Task 'setup' not found — R7 requires every program to have setup and loop tasks")
                    .with_code("W007")
            );
        }
        if !has_loop {
            diags.push(
                ParseDiagnostic::warning("Task 'loop' not found — R7 requires every program to have setup and loop tasks")
                    .with_code("W007")
            );
        }

        // asl_version presente
        if program.asl_version.is_empty() {
            diags.push(
                ParseDiagnostic::error("'asl_version' field is empty — must be a semver string (e.g. \"4.0.0\")")
                    .with_code("E002")
            );
        }

        if diags.iter().any(|d| d.severity == DiagnosticSeverity::Error) {
            Err(diags)
        } else {
            Ok(())
        }
    }
}

// ============================================================================
// Módulo normalize — helpers R4 / R5
// ============================================================================

/// Helpers de normalização partilhados por todos os parsers.
///
/// **R4** — Qualquer representação de verdadeiro/falso deve ser
/// normalizada para `{"kind":"literal","value":1}` ou `{"kind":"literal","value":0}`.
/// Nunca emitir `true`/`false` JSON como AslLiteral — usar 1/0 inteiros.
pub mod normalize {
    use super::*;

    /// Conjunto de strings que representam verdadeiro (HIGH/True/TRUE/1/set_high).
    /// R4: todos mapeiam para `AslExpr::Literal { value: 1 }`.
    const TRUTHY_LITERALS: &[&str] = &[
        "HIGH", "high", "True", "true", "TRUE",
        "1", "set_high", "SET_HIGH", "SET", "set",
    ];

    /// Conjunto de strings que representam falso (LOW/False/FALSE/0/set_low).
    /// R4: todos mapeiam para `AslExpr::Literal { value: 0 }`.
    const FALSY_LITERALS: &[&str] = &[
        "LOW", "low", "False", "false", "FALSE",
        "0", "set_low", "SET_LOW", "RESET", "reset",
    ];

    /// Normaliza um literal booleano/digital para `AslExpr::Literal` 1 ou 0 (R4).
    ///
    /// # Uso
    /// ```rust,ignore
    /// // No parser, ao encontrar um valor HIGH/LOW/True/False:
    /// let value = normalize::bool_like("HIGH").unwrap_or_else(|| AslExpr::var("HIGH"));
    /// ```
    ///
    /// Devolve `None` se a string não é um literal booleano reconhecido.
    pub fn bool_like(raw: &str) -> Option<AslExpr> {
        if TRUTHY_LITERALS.contains(&raw) {
            Some(AslExpr::Literal(AslLiteral { value: serde_json::json!(1) }))
        } else if FALSY_LITERALS.contains(&raw) {
            Some(AslExpr::Literal(AslLiteral { value: serde_json::json!(0) }))
        } else {
            None
        }
    }

    /// Normaliza um valor booleano Rust para `AslExpr::Literal` 1 ou 0 (R4).
    pub fn from_bool(v: bool) -> AslExpr {
        AslExpr::Literal(AslLiteral { value: serde_json::json!(if v { 1 } else { 0 }) })
    }

    /// Verifica se uma string de operador está no formato canónico ASL (R5).
    ///
    /// Útil em parsers para asserção em modo debug.
    /// Operadores válidos: `+`, `-`, `*`, `/`, `%`, `//`, `**`,
    /// `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`,
    /// `&`, `|`, `^`, `<<`, `>>`.
    pub fn is_canonical_op(op: &str) -> bool {
        matches!(
            op,
            "+"  | "-"  | "*"  | "/"  | "%"  | "//" | "**" |
            "==" | "!=" | "<"  | "<=" | ">"  | ">=" |
            "&&" | "||" | "&"  | "|"  | "^"  | "<<" | ">>" |
            "-"  | "!"  | "~"
        )
    }

    /// Asserta que um operador é canónico (R5). Emite `ParseError` se não for.
    ///
    /// # Uso
    /// ```rust,ignore
    /// normalize::assert_asl_op(op_str)?;  // falha em modo debug se "add"/"gte"/etc.
    /// ```
    pub fn assert_asl_op(op: &str) -> Result<(), ParseError> {
        if is_canonical_op(op) {
            Ok(())
        } else {
            Err(ParseError::NormalizationError {
                description: format!(
                    "Operator '{}' is not a canonical ASL symbol (R5). \
                     Use '+', '>=', '&&', etc. Never 'add', 'gte', 'and'.",
                    op
                ),
            })
        }
    }

    /// Normaliza o `for` range para `to` exclusivo (convenção ASL, §8.4).
    ///
    /// ST usa `TO` inclusivo (i <= to). Esta função converte para exclusivo (i < to).
    /// Apenas aplica quando `to` é um literal inteiro — caso contrário devolve `None`
    /// e o parser deve emitir um aviso.
    ///
    /// Exemplo: `FOR i := 0 TO 9 BY 1` → `to = 10`
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

    /// Constrói o `AslDuration` a partir de milissegundos (helper para parsers).
    /// Evita que cada parser reimplemente a conversão.
    pub fn duration_from_ms(ms: u64) -> crate::types::asl_types::AslDuration {
        crate::types::asl_types::AslDuration::from_ms(ms)
    }

    /// Constrói o `AslDuration` a partir de microssegundos.
    pub fn duration_from_us(us: u64) -> crate::types::asl_types::AslDuration {
        let ms = us / 1000;
        let remaining_us = (us % 1000) as u32;
        let mut d = crate::types::asl_types::AslDuration::from_ms(ms);
        d.microseconds = remaining_us;
        d
    }
}

// ============================================================================
// Testes unitários
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use super::normalize::*;
    use crate::types::asl_types::AslExpr;

    #[test]
    fn test_r4_bool_like_truthy() {
        for s in &["HIGH", "True", "true", "TRUE", "1", "set_high", "SET"] {
            let expr = bool_like(s).expect(&format!("'{}' should be truthy", s));
            if let AslExpr::Literal(lit) = expr {
                assert_eq!(lit.value, serde_json::json!(1), "'{}' should map to 1", s);
            } else {
                panic!("Expected Literal for '{}'", s);
            }
        }
    }

    #[test]
    fn test_r4_bool_like_falsy() {
        for s in &["LOW", "False", "false", "FALSE", "0", "set_low", "RESET"] {
            let expr = bool_like(s).expect(&format!("'{}' should be falsy", s));
            if let AslExpr::Literal(lit) = expr {
                assert_eq!(lit.value, serde_json::json!(0), "'{}' should map to 0", s);
            } else {
                panic!("Expected Literal for '{}'", s);
            }
        }
    }

    #[test]
    fn test_r4_bool_like_unknown() {
        assert!(bool_like("MY_VAR").is_none());
        assert!(bool_like("").is_none());
    }

    #[test]
    fn test_r4_from_bool() {
        let t = from_bool(true);
        let f = from_bool(false);
        if let AslExpr::Literal(lit) = t { assert_eq!(lit.value, serde_json::json!(1)); }
        if let AslExpr::Literal(lit) = f { assert_eq!(lit.value, serde_json::json!(0)); }
    }

    #[test]
    fn test_r5_canonical_ops() {
        for op in &["+", "-", "*", "/", "%", "==", "!=", "<", "<=", ">", ">=", "&&", "||"] {
            assert!(is_canonical_op(op), "'{}' should be canonical", op);
        }
    }

    #[test]
    fn test_r5_non_canonical_ops() {
        for op in &["add", "sub", "AND", "OR", "gte", "lte", "eq", "neq"] {
            assert!(!is_canonical_op(op), "'{}' should NOT be canonical", op);
        }
    }

    #[test]
    fn test_r5_assert_asl_op_ok() {
        assert!(assert_asl_op("+").is_ok());
        assert!(assert_asl_op(">=").is_ok());
        assert!(assert_asl_op("&&").is_ok());
    }

    #[test]
    fn test_r5_assert_asl_op_err() {
        assert!(assert_asl_op("add").is_err());
        assert!(assert_asl_op("AND").is_err());
        assert!(assert_asl_op("gte").is_err());
    }

    #[test]
    fn test_st_for_to_exclusive() {
        let to = AslExpr::int(9);
        let excl = st_for_to_exclusive(&to).expect("Should convert literal");
        if let AslExpr::Literal(lit) = excl {
            assert_eq!(lit.value, serde_json::json!(10));
        }
    }

    #[test]
    fn test_st_for_to_exclusive_non_literal() {
        // Expressão não-literal: deve devolver None
        let to = AslExpr::var("limit");
        assert!(st_for_to_exclusive(&to).is_none());
    }

    #[test]
    fn test_duration_from_ms() {
        let d = duration_from_ms(1500);
        assert_eq!(d.seconds, 1);
        assert_eq!(d.milliseconds, 500);
        assert_eq!(d.total_ms(), 1500);
    }

    #[test]
    fn test_duration_from_us() {
        let d = duration_from_us(2_001_500);
        assert_eq!(d.seconds, 2);
        assert_eq!(d.milliseconds, 1);
        assert_eq!(d.microseconds, 500);
    }

    #[test]
    fn test_parse_error_display() {
        let e = ParseError::UnexpectedToken {
            found: ";".to_string(),
            expected: "expression".to_string(),
            span: Some(Span { line: 3, col: 10, len: 1 }),
        };
        let s = format!("{}", e);
        assert!(s.contains("3:10"));
        assert!(s.contains(";"));
    }

    #[test]
    fn test_validate_program_missing_tasks() {
        use crate::types::asl_types::AslProgram;

        struct DummyParser;
        impl NeuroParser for DummyParser {
            type Error = ParseError;
            fn parse(_: &str) -> Result<AslProgram, Self::Error> {
                Ok(AslProgram::default())
            }
            fn source_language() -> &'static str { "test" }
        }
        impl NeuroParserExt for DummyParser {}

        let program = AslProgram::default(); // sem tasks
        let result = DummyParser::validate_program(&program);
        // deve produzir avisos W007
        assert!(result.is_ok()); // avisos não são erros fatais
    }
}
