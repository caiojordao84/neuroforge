//! Verificador de tipos para AslProgram.
//! Percorre todas as funções e tarefas e valida tipos em expressões binárias.
//! Devolve Vec<Diagnostic> — nunca panic.

use crate::types::asl_types::{
    AslProgram, AslFunction, AslStatement, AslExpr,
    AslBinary, BinaryOp, AslType,
};

/// Diagnóstico de type-check — compatível com protocolo LSP/Monaco.
#[derive(Debug, Clone)]
pub struct Diagnostic {
    pub message:  String,
    /// "error" | "warning" | "info"
    pub severity: &'static str,
    /// Nome da função/tarefa onde ocorreu.
    pub context:  String,
}

impl Diagnostic {
    pub fn error(context: impl Into<String>, message: impl Into<String>) -> Self {
        Self { message: message.into(), severity: "error", context: context.into() }
    }
    pub fn warning(context: impl Into<String>, message: impl Into<String>) -> Self {
        Self { message: message.into(), severity: "warning", context: context.into() }
    }
}

/// Verifica tipos no `AslProgram` e devolve lista de diagnósticos.
/// Vec vazio = programa limpo.
pub fn check_types(program: &AslProgram) -> Vec<Diagnostic> {
    let mut diags = Vec::new();
    for func in &program.functions { check_function(func, &mut diags); }
    for task in &program.tasks     { check_body(&task.name, &task.body, &mut diags); }
    diags
}

fn check_function(func: &AslFunction, diags: &mut Vec<Diagnostic>) {
    check_body(&func.name, &func.body, diags);
}

fn check_body(ctx: &str, body: &[AslStatement], diags: &mut Vec<Diagnostic>) {
    for stmt in body { check_statement(ctx, stmt, diags); }
}

fn check_statement(ctx: &str, stmt: &AslStatement, diags: &mut Vec<Diagnostic>) {
    match stmt {
        AslStatement::If(s) => {
            check_expr_is_bool(ctx, &s.condition, diags);
            check_body(ctx, &s.then_branch, diags);
            if let Some(eb) = &s.else_branch { check_body(ctx, eb, diags); }
        }
        AslStatement::While(s) => {
            check_expr_is_bool(ctx, &s.condition, diags);
            check_body(ctx, &s.body, diags);
        }
        AslStatement::DoWhile(s) => {
            check_expr_is_bool(ctx, &s.condition, diags);
            check_body(ctx, &s.body, diags);
        }
        AslStatement::For(s) => {
            check_expr_is_bool(ctx, &s.condition, diags);
            check_body(ctx, &s.body, diags);
        }
        AslStatement::Declare(s) => {
            if let Some(val) = &s.value {
                check_assign_compat(ctx, &s.r#type, val, diags);
            }
        }
        AslStatement::Expr(s) => { check_expr(ctx, &s.expr, diags); }
        AslStatement::Return(s) => {
            if let Some(e) = &s.value { check_expr(ctx, e, diags); }
        }
        _ => {}
    }
}

fn check_expr(ctx: &str, expr: &AslExpr, diags: &mut Vec<Diagnostic>) {
    if let AslExpr::Binary(b) = expr { check_binary(ctx, b, diags); }
}

fn check_binary(ctx: &str, b: &AslBinary, diags: &mut Vec<Diagnostic>) {
    check_expr(ctx, &b.left, diags);
    check_expr(ctx, &b.right, diags);

    let arith = matches!(
        b.op,
        BinaryOp::Add | BinaryOp::Sub | BinaryOp::Mul
        | BinaryOp::Div | BinaryOp::Mod | BinaryOp::IntDiv
    );
    if arith && (is_string_literal(&b.left) || is_string_literal(&b.right)) {
        diags.push(Diagnostic::error(
            ctx,
            format!("Operador aritmético '{:?}' aplicado a literal string", b.op),
        ));
    }

    let logical = matches!(b.op, BinaryOp::And | BinaryOp::Or);
    if logical && (is_numeric_literal(&b.left) || is_numeric_literal(&b.right)) {
        diags.push(Diagnostic::warning(
            ctx,
            format!("Operador lógico '{:?}' aplicado a literal numérico", b.op),
        ));
    }
}

fn check_expr_is_bool(ctx: &str, expr: &AslExpr, diags: &mut Vec<Diagnostic>) {
    if is_numeric_literal(expr) {
        diags.push(Diagnostic::warning(
            ctx,
            "Condição booleana é um literal numérico (usar comparação explícita)".to_string(),
        ));
    }
    check_expr(ctx, expr, diags);
}

fn check_assign_compat(ctx: &str, ty: &AslType, val: &AslExpr, diags: &mut Vec<Diagnostic>) {
    if matches!(ty, AslType::Bool) && is_numeric_literal(val) {
        diags.push(Diagnostic::warning(
            ctx,
            "Variável Bool inicializada com literal numérico — usar true/false".to_string(),
        ));
    }
}

fn is_string_literal(expr: &AslExpr) -> bool {
    matches!(expr, AslExpr::Literal(l) if l.value.is_string())
}

fn is_numeric_literal(expr: &AslExpr) -> bool {
    matches!(expr, AslExpr::Literal(l) if l.value.is_number())
}

// ── Testes ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::*;

    fn prog_with(body: Vec<AslStatement>) -> AslProgram {
        let mut p = AslProgram::default();
        p.functions.push(AslFunction {
            name: "test".to_string(), params: vec![], return_type: None, body,
        });
        p
    }

    #[test]
    fn clean_program_no_diags() {
        assert!(check_types(&AslProgram::default()).is_empty());
    }

    #[test]
    fn arith_on_string_is_error() {
        let stmt = AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::Binary(Box::new(AslBinary {
                op: BinaryOp::Add,
                left:  AslExpr::str_val("hello"),
                right: AslExpr::int(1),
            })),
        });
        let diags = check_types(&prog_with(vec![stmt]));
        assert!(diags.iter().any(|d| d.severity == "error"), "{:?}", diags);
    }

    #[test]
    fn logical_on_number_is_warning() {
        let stmt = AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::Binary(Box::new(AslBinary {
                op: BinaryOp::And,
                left:  AslExpr::int(1),
                right: AslExpr::int(0),
            })),
        });
        let diags = check_types(&prog_with(vec![stmt]));
        assert!(diags.iter().any(|d| d.severity == "warning"), "{:?}", diags);
    }

    #[test]
    fn bool_var_numeric_init_is_warning() {
        let stmt = AslStatement::Declare(AslDeclare {
            name: "flag".to_string(),
            r#type: AslType::Bool,
            value: Some(AslExpr::int(1)),
        });
        let diags = check_types(&prog_with(vec![stmt]));
        assert!(diags.iter().any(|d| d.severity == "warning"), "{:?}", diags);
    }
}
