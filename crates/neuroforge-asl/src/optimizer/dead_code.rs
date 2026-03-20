//! Dead code elimination.
//! Remove:
//!   - if(false){...}          → eliminado
//!   - if(true){A}else{B}      → substitui por A
//!   - while(false){...}       → eliminado
//!   - statements após return  → truncado

use crate::types::asl_types::{
    AslProgram, AslFunction, AslTask, AslStatement, AslExpr, AslLiteral,
};

pub fn eliminate_dead_code(program: &mut AslProgram) {
    for func in &mut program.functions { dce_function(func); }
    for task in &mut program.tasks     { dce_task(task);     }
}

fn dce_function(func: &mut AslFunction) {
    func.body = dce_body(std::mem::take(&mut func.body));
}

fn dce_task(task: &mut AslTask) {
    task.body = dce_body(std::mem::take(&mut task.body));
}

fn dce_body(stmts: Vec<AslStatement>) -> Vec<AslStatement> {
    let mut out = Vec::new();
    for stmt in stmts {
        match dce_stmt(stmt) {
            DceResult::Keep(s)       => { out.push(s); }
            DceResult::Replace(many) => { out.extend(many); }
            DceResult::Remove        => {}
        }
        if matches!(out.last(), Some(AslStatement::Return(_))) { break; }
    }
    out
}

enum DceResult {
    Keep(AslStatement),
    Replace(Vec<AslStatement>),
    Remove,
}

fn dce_stmt(stmt: AslStatement) -> DceResult {
    match stmt {
        AslStatement::If(mut s) => match bool_literal(&s.condition) {
            Some(true)  => DceResult::Replace(dce_body(s.then_branch)),
            Some(false) => {
                if let Some(eb) = s.else_branch {
                    DceResult::Replace(dce_body(eb))
                } else {
                    DceResult::Remove
                }
            }
            None => {
                s.then_branch = dce_body(std::mem::take(&mut s.then_branch));
                s.else_branch = s.else_branch.map(dce_body);
                DceResult::Keep(AslStatement::If(s))
            }
        },
        AslStatement::While(mut s) => {
            if bool_literal(&s.condition) == Some(false) {
                return DceResult::Remove;
            }
            s.body = dce_body(std::mem::take(&mut s.body));
            DceResult::Keep(AslStatement::While(s))
        }
        other => DceResult::Keep(other),
    }
}

fn bool_literal(expr: &AslExpr) -> Option<bool> {
    if let AslExpr::Literal(AslLiteral { value }) = expr {
        if let Some(b) = value.as_bool()  { return Some(b); }
        if let Some(n) = value.as_f64()   { return Some(n != 0.0); }
    }
    None
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
    fn removes_if_false() {
        let stmt = AslStatement::If(Box::new(AslIf {
            condition: AslExpr::bool_val(false),
            then_branch: vec![AslStatement::Break],
            else_branch: None,
        }));
        let mut prog = prog_with(vec![stmt]);
        eliminate_dead_code(&mut prog);
        assert!(prog.functions[0].body.is_empty());
    }

    #[test]
    fn replaces_if_true_with_then() {
        let stmt = AslStatement::If(Box::new(AslIf {
            condition: AslExpr::bool_val(true),
            then_branch: vec![AslStatement::Break],
            else_branch: Some(vec![AslStatement::Continue]),
        }));
        let mut prog = prog_with(vec![stmt]);
        eliminate_dead_code(&mut prog);
        assert_eq!(prog.functions[0].body.len(), 1);
        assert!(matches!(prog.functions[0].body[0], AslStatement::Break));
    }

    #[test]
    fn removes_while_false() {
        let stmt = AslStatement::While(Box::new(AslWhile {
            condition: AslExpr::bool_val(false),
            body: vec![AslStatement::Break],
        }));
        let mut prog = prog_with(vec![stmt]);
        eliminate_dead_code(&mut prog);
        assert!(prog.functions[0].body.is_empty());
    }

    #[test]
    fn trims_after_return() {
        let stmts = vec![
            AslStatement::Return(AslReturn { value: None }),
            AslStatement::Break,
            AslStatement::Continue,
        ];
        let mut prog = prog_with(stmts);
        eliminate_dead_code(&mut prog);
        assert_eq!(prog.functions[0].body.len(), 1);
        assert!(matches!(prog.functions[0].body[0], AslStatement::Return(_)));
    }
}
