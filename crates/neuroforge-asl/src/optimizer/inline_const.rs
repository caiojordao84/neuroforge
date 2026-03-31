//! Inline de constantes declaradas com valor literal imutável.
//! Remove a declaração e substitui todas as referências pelo valor.

use std::collections::HashMap;
use crate::types::asl_types::{
    AslProgram, AslFunction, AslTask, AslStatement, AslExpr, AslLiteral,
};

pub fn inline_constants(program: &mut AslProgram) {
    for func in &mut program.functions { inline_function(func); }
    for task in &mut program.tasks     { inline_task(task);     }
}

fn inline_function(func: &mut AslFunction) {
    let consts = collect_inlineable(&func.body);
    func.body = inline_body(std::mem::take(&mut func.body), &consts);
}

fn inline_task(task: &mut AslTask) {
    let consts = collect_inlineable(&task.body);
    task.body = inline_body(std::mem::take(&mut task.body), &consts);
}

fn collect_inlineable(body: &[AslStatement]) -> HashMap<String, serde_json::Value> {
    let mut candidates: HashMap<String, serde_json::Value> = HashMap::new();
    let mut reassigned: std::collections::HashSet<String> = std::collections::HashSet::new();

    for stmt in body {
        match stmt {
            AslStatement::Declare(d) => {
                if let Some(AslExpr::Literal(AslLiteral { value })) = &d.value {
                    candidates.insert(d.name.clone(), value.clone());
                }
            }
            AslStatement::Assign(a) => { reassigned.insert(a.target.clone()); }
            _ => {}
        }
    }
    for name in &reassigned { candidates.remove(name); }
    candidates
}

fn inline_body(
    stmts: Vec<AslStatement>,
    consts: &HashMap<String, serde_json::Value>,
) -> Vec<AslStatement> {
    let mut out = Vec::new();
    for stmt in stmts {
        match stmt {
            AslStatement::Declare(ref d) if consts.contains_key(&d.name) => {}
            AslStatement::Assign(mut a) => {
                inline_expr(&mut a.value, consts);
                out.push(AslStatement::Assign(a));
            }
            AslStatement::Expr(mut e) => {
                inline_expr(&mut e.expr, consts);
                out.push(AslStatement::Expr(e));
            }
            AslStatement::Return(mut r) => {
                if let Some(e) = &mut r.value { inline_expr(e, consts); }
                out.push(AslStatement::Return(r));
            }
            AslStatement::If(mut s) => {
                inline_expr(&mut s.condition, consts);
                s.then_branch = inline_body(std::mem::take(&mut s.then_branch), consts);
                s.else_branch = s.else_branch.map(|b| inline_body(b, consts));
                out.push(AslStatement::If(s));
            }
            AslStatement::While(mut s) => {
                inline_expr(&mut s.condition, consts);
                s.body = inline_body(std::mem::take(&mut s.body), consts);
                out.push(AslStatement::While(s));
            }
            other => out.push(other),
        }
    }
    out
}

fn inline_expr(expr: &mut AslExpr, consts: &HashMap<String, serde_json::Value>) {
    match expr {
        AslExpr::Var(v) => {
            if let Some(val) = consts.get(&v.name) {
                *expr = AslExpr::Literal(AslLiteral { value: val.clone() });
            }
        }
        AslExpr::Binary(b) => {
            inline_expr(&mut b.left, consts);
            inline_expr(&mut b.right, consts);
        }
        AslExpr::Unary(u) => { inline_expr(&mut u.expr, consts); }
        AslExpr::Call(c) => {
            for a in &mut c.args { inline_expr(a, consts); }
        }
        AslExpr::Conditional(c) => {
            inline_expr(&mut c.condition, consts);
            inline_expr(&mut c.when_true, consts);
            inline_expr(&mut c.when_false, consts);
        }
        _ => {}
    }
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
        AslProgram {
            functions: vec![AslFunction {
                name: "test".to_string(), params: vec![], return_type: None, body,
            }],
            ..Default::default()
        }
    }

    #[test]
    fn inlines_const_and_removes_declare() {
        let stmts = vec![
            AslStatement::Declare(AslDeclare {
                name: "MAX".to_string(), r#type: AslType::Int,
                value: Some(AslExpr::int(100)),
            }),
            AslStatement::Assign(AslAssign {
                target: "x".to_string(),
                value:  AslExpr::var("MAX"),
            }),
        ];
        let mut prog = prog_with(stmts);
        inline_constants(&mut prog);
        let body = &prog.functions[0].body;
        assert!(!body.iter().any(|s| matches!(s, AslStatement::Declare(d) if d.name == "MAX")));
        if let AslStatement::Assign(a) = &body[0] {
            assert!(matches!(&a.value, AslExpr::Literal(l) if l.value.as_f64() == Some(100.0)));
        } else {
            panic!("esperava Assign, obtido {:?}", body);
        }
    }

    #[test]
    fn does_not_inline_reassigned_var() {
        let stmts = vec![
            AslStatement::Declare(AslDeclare {
                name: "counter".to_string(), r#type: AslType::Int,
                value: Some(AslExpr::int(0)),
            }),
            AslStatement::Assign(AslAssign {
                target: "counter".to_string(), value: AslExpr::int(1),
            }),
        ];
        let mut prog = prog_with(stmts);
        inline_constants(&mut prog);
        assert!(prog.functions[0].body.iter()
            .any(|s| matches!(s, AslStatement::Declare(d) if d.name == "counter")));
    }
}
