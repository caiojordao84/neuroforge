use neuroforge_asl::{
    plugins::python::PythonParser,
    transforms::{ast_to_asl, Language},
    types::asl_types::AslProgram,
    types::asl_types::AslStatement,
    types::typed_nodes::{
        CallNode, ExprKind, ExprNode, FunctionNode, ProgramNode, StatementKind, StatementNode,
    },
};

fn all_stmts(asl: &AslProgram) -> Vec<&AslStatement> {
    asl.tasks
        .iter()
        .flat_map(|t| t.body.iter())
        .chain(asl.functions.iter().flat_map(|f| f.body.iter()))
        .collect()
}

fn int_lit(n: i64) -> ExprNode {
    ExprNode {
        kind: ExprKind::IntLiteral(n),
    }
}

// ── Python → AslProgram (Pipeline 1 via PythonParser) ─────────────────────────

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
    assert!(
        !asl.functions.is_empty(),
        "functions deve ter pelo menos 1: {:?}",
        asl.functions
    );
    let stmts = all_stmts(&asl);
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::PinMode(_))),
        "PinMode ausente: {stmts:?}"
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
    assert!(!asl.functions.is_empty(), "deve ter pelo menos setup");
}

// ── typed_nodes::ProgramNode → AslProgram (Pipeline 1 via ast_to_asl) ─────────

#[test]
fn typed_program_ast_to_asl_has_delay() {
    let program = ProgramNode {
        globals: vec![],
        functions: vec![
            FunctionNode {
                name: "setup".to_string(),
                params: vec![],
                return_type: None,
                body: vec![],
            },
            FunctionNode {
                name: "loop".to_string(),
                params: vec![],
                return_type: None,
                body: vec![
                    StatementNode {
                        kind: StatementKind::Call(CallNode {
                            name: "delay_ms".to_string(),
                            object: None,
                            args: vec![int_lit(500)],
                            result_var: None,
                        }),
                    },
                    StatementNode {
                        kind: StatementKind::Break,
                    },
                ],
            },
        ],
        body: vec![],
        has_loop: true,
    };

    let asl = ast_to_asl(&program, Language::Cpp);
    assert_eq!(asl.asl_version, "4.0.0");
    let stmts = all_stmts(&asl);
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::Break)),
        "Break ausente no asl: {stmts:?}"
    );
    assert!(
        stmts.iter().any(|s| matches!(s, AslStatement::Expr(_))),
        "Expr ausente no asl (esperado: delay_ms como Expr): {stmts:?}"
    );
}

#[test]
fn typed_program_ast_to_asl_empty() {
    let program = ProgramNode::empty();
    let asl = ast_to_asl(&program, Language::Cpp);
    assert_eq!(asl.asl_version, "4.0.0");
    assert!(asl.tasks.len() >= 1);
}
