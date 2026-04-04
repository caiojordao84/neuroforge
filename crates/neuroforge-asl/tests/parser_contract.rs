use neuroforge_asl::parser::neuro_parser::{NeuroParser, NeuroParserExt, ParseError, DiagnosticSeverity};
use neuroforge_asl::types::asl_types::{AslProgram, AslTask};

struct ContractTestParser;

impl NeuroParser for ContractTestParser {
    type Error = ParseError;
    fn parse(_source: &str) -> Result<AslProgram, Self::Error> {
        // Implementação dummy para o teste
        Ok(AslProgram::default())
    }
    fn source_language() -> &'static str { "contract_test" }
}

impl NeuroParserExt for ContractTestParser {}

#[test]
fn test_neuro_parser_r7_enforcement() {
    let mut program = AslProgram::default();
    program.asl_version = "4.0.0".to_string();
    
    // 1. Programa vazio (deve falhar R7)
    let diag = <ContractTestParser as NeuroParserExt>::validate_semantics(&program);
    assert!(diag.is_err(), "Should have warnings for empty program");
    
    if let Err(diags) = diag {
        let has_r7_warning = diags.iter().any(|d| d.code.as_deref() == Some("W007"));
        assert!(has_r7_warning, "Should have W007 warning for missing tasks");
    }
}

#[test]
fn test_neuro_parser_semver_enforcement() {
    let mut program = AslProgram::default();
    program.asl_version = "v1".to_string(); // Inválido para semver
    program.tasks.push(AslTask { name: "setup".into(), ..AslTask::default() });
    program.tasks.push(AslTask { name: "loop".into(), ..AslTask::default() });
    
    if let Err(diags) = <ContractTestParser as NeuroParserExt>::validate_semantics(&program) {
        let has_semver_error = diags.iter().any(|d| d.severity == DiagnosticSeverity::Error && d.code.as_deref() == Some("E002"));
        assert!(has_semver_error, "Should have semver error for 'v1'");
    } else {
        panic!("Should have failed validation for invalid semver");
    }
}

#[test]
fn test_neuro_parser_valid_program() {
    let mut program = AslProgram::default();
    program.asl_version = "4.0.0".to_string();
    program.tasks.push(AslTask { name: "setup".into(), ..AslTask::default() });
    program.tasks.push(AslTask { name: "loop".into(), ..AslTask::default() });
    
    let result = <ContractTestParser as NeuroParserExt>::validate_semantics(&program);
    assert!(result.is_ok(), "Valid program should pass validation");
}
