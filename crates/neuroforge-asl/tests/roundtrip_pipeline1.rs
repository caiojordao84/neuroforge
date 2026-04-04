use neuroforge_asl::{
    parser::neuro_parser::NeuroParser,
    plugins::python::python_parser::PythonParser,
    types::asl_types::AslProgram,
    types::asl_types::AslStatement,
};

fn all_stmts(asl: &AslProgram) -> Vec<&AslStatement> {
    asl.tasks
        .iter()
        .flat_map(|t| t.body.iter())
        .chain(asl.functions.iter().flat_map(|f| f.body.iter()))
        .collect()
}

// ── Python → AslProgram (Pipeline 1 via NeuroParser) ─────────────────────────

#[test]
fn python_blink_pipeline1_pinmode_and_delay() {
    let src = r#"
import machine
import utime

def setup():
    machine.Pin(13, 1)

def loop():
    machine.Pin(13, 0)
    utime.sleep_ms(500)
"#;
    let asl = PythonParser::parse(src).expect("parse falhou");
    assert_eq!(asl.asl_version, "4.0.0");
    
    let stmts = all_stmts(&asl);
    // Nota: O parser de Python mapeia Pin(13, 1) para pinMode(13, OUTPUT) ou digitalOutput(13, 1)
    // conforme as regras de v1.2.3.
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::PinMode(_)) || matches!(s, AslStatement::DigitalOutput(_))),
        "PinMode/DigitalOutput ausente: {stmts:?}"
    );
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::Delay(_))),
        "Delay ausente: {stmts:?}"
    );
}

#[test]
fn python_while_loop_in_asl() {
    let src = "def loop():\n    while True:\n        delay_ms(100)\n";
    let asl = PythonParser::parse(src).expect("parse falhou");
    let stmts = all_stmts(&asl);
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::While(_))),
        "While ausente: {stmts:?}"
    );
}

#[test]
fn python_empty_program_valid_asl() {
    let src = "def setup():\n    pass\n";
    let asl = PythonParser::parse(src).expect("parse falhou");
    assert_eq!(asl.asl_version, "4.0.0");
    assert!(!asl.tasks.is_empty(), "deve ter pelo menos setup");
}
