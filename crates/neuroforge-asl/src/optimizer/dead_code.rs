//! Dead code elimination.

//! Remove:

//!   - if(false){...}              eliminado

//!   - if(true){A}else{B}          substitui por A

//!   - while(false){...}           eliminado

//!   - statements ap  s return      truncado

use std::collections::HashSet;

use crate::types::asl_types::{
    AslExpr, AslFor, AslFunction, AslLiteral, AslProgram, AslStatement, AslTask,
};

pub fn eliminate_dead_code(program: &mut AslProgram) {
    for func in &mut program.functions {
        dce_function(func);
    }

    for task in &mut program.tasks {
        dce_task(task);
    }

    eliminate_unused_globals(program);
}

pub fn eliminate_unused_globals(program: &mut AslProgram) {
    let mut refs = HashSet::new();

    for func in &program.functions {
        for stmt in &func.body {
            collect_stmt_refs(stmt, &mut refs);
        }
    }

    for task in &program.tasks {
        for stmt in &task.body {
            collect_stmt_refs(stmt, &mut refs);
        }
    }

    program.globals.retain(|g| {
        if refs.contains(&g.name) {
            return true;
        }
        // Keep special state/global/retain/persistent variables if not referenced
        if g.scope == "global" || g.scope == "state" || g.lifecycle == "retain" || g.lifecycle == "persistent" {
            return true;
        }
        false
    });
}

fn collect_expr_refs(expr: &AslExpr, refs: &mut HashSet<String>) {
    match expr {
        AslExpr::Var(v) => {
            refs.insert(v.name.clone());
        }
        AslExpr::PostfixInc(v) | AslExpr::PostfixDec(v) => {
            refs.insert(v.clone());
        }
        AslExpr::Binary(b) => {
            collect_expr_refs(&b.left, refs);
            collect_expr_refs(&b.right, refs);
        }
        AslExpr::Unary(u) => {
            collect_expr_refs(&u.expr, refs);
        }
        AslExpr::Call(c) => {
            for arg in &c.args {
                collect_expr_refs(arg, refs);
            }
        }
        AslExpr::Conditional(c) => {
            collect_expr_refs(&c.condition, refs);
            collect_expr_refs(&c.when_true, refs);
            collect_expr_refs(&c.when_false, refs);
        }
        AslExpr::Array(a) => {
            for element in &a.elements {
                collect_expr_refs(element, refs);
            }
        }
        AslExpr::Index(i) => {
            collect_expr_refs(&i.target, refs);
            collect_expr_refs(&i.index, refs);
        }
        AslExpr::Index2D(i) => {
            collect_expr_refs(&i.array, refs);
            collect_expr_refs(&i.row_index, refs);
            collect_expr_refs(&i.col_index, refs);
        }
        AslExpr::Index3D(i) => {
            collect_expr_refs(&i.array, refs);
            collect_expr_refs(&i.d1_index, refs);
            collect_expr_refs(&i.d2_index, refs);
            collect_expr_refs(&i.d3_index, refs);
        }
        AslExpr::Member(m) => {
            collect_expr_refs(&m.target, refs);
        }
        AslExpr::Cast(c) => {
            collect_expr_refs(&c.expr, refs);
        }
        AslExpr::NewStruct(n) => {
            for field in &n.fields {
                collect_expr_refs(&field.value, refs);
            }
        }
        AslExpr::ArrayLength(a) => {
            collect_expr_refs(&a.target, refs);
        }
        _ => {}
    }
}

fn collect_stmt_refs(stmt: &AslStatement, refs: &mut HashSet<String>) {
    match stmt {
        AslStatement::Assign(a) => {
            refs.insert(a.target.clone());
            collect_expr_refs(&a.value, refs);
        }
        AslStatement::Declare(d) => {
            if let Some(v) = &d.value {
                collect_expr_refs(v, refs);
            }
        }
        AslStatement::DigitalInput(inp) => {
            refs.insert(inp.target.clone());
            collect_expr_refs(&inp.pin, refs);
        }
        AslStatement::AnalogInput(inp) => {
            refs.insert(inp.target.clone());
            collect_expr_refs(&inp.pin, refs);
        }
        AslStatement::DigitalOutput(out) => {
            collect_expr_refs(&out.pin, refs);
            collect_expr_refs(&out.value, refs);
        }
        AslStatement::AnalogOutput(out) => {
            collect_expr_refs(&out.pin, refs);
            collect_expr_refs(&out.value, refs);
        }
        AslStatement::SetIndex(si) => {
            refs.insert(si.target.clone());
            collect_expr_refs(&si.index, refs);
            collect_expr_refs(&si.value, refs);
        }
        AslStatement::SetIndex2D(si) => {
            refs.insert(si.target.clone());
            collect_expr_refs(&si.row_index, refs);
            collect_expr_refs(&si.col_index, refs);
            collect_expr_refs(&si.value, refs);
        }
        AslStatement::SetIndex3D(si) => {
            refs.insert(si.target.clone());
            collect_expr_refs(&si.d1_index, refs);
            collect_expr_refs(&si.d2_index, refs);
            collect_expr_refs(&si.d3_index, refs);
            collect_expr_refs(&si.value, refs);
        }
        AslStatement::SetMember(sm) => {
            collect_expr_refs(&sm.target, refs);
            collect_expr_refs(&sm.value, refs);
        }
        AslStatement::SetPointer(sp) => {
            collect_expr_refs(&sp.target, refs);
            collect_expr_refs(&sp.value, refs);
        }
        AslStatement::Expr(e) => {
            collect_expr_refs(&e.expr, refs);
        }
        AslStatement::Return(r) => {
            if let Some(v) = &r.value {
                collect_expr_refs(v, refs);
            }
        }
        AslStatement::If(i) => {
            collect_expr_refs(&i.condition, refs);
            for st in &i.then_body {
                collect_stmt_refs(st, refs);
            }
            if let Some(eb) = &i.else_body {
                for st in eb {
                    collect_stmt_refs(st, refs);
                }
            }
        }
        AslStatement::While(w) => {
            collect_expr_refs(&w.condition, refs);
            for st in &w.body {
                collect_stmt_refs(st, refs);
            }
        }
        AslStatement::For(f) => match &**f {
            AslFor::Range(r) => {
                collect_expr_refs(&r.from, refs);
                collect_expr_refs(&r.to, refs);
                collect_expr_refs(&r.step, refs);
                for st in &r.body {
                    collect_stmt_refs(st, refs);
                }
            }
            AslFor::Each(e) => {
                collect_expr_refs(&e.iterable, refs);
                for st in &e.body {
                    collect_stmt_refs(st, refs);
                }
            }
            AslFor::CStyle(c) => {
                for st in &c.init {
                    collect_stmt_refs(st, refs);
                }
                collect_expr_refs(&c.condition, refs);
                for st in &c.update {
                    collect_stmt_refs(st, refs);
                }
                for st in &c.body {
                    collect_stmt_refs(st, refs);
                }
            }
        },
        _ => {}
    }
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
            DceResult::Keep(s) => {
                out.push(*s);
            }

            DceResult::Replace(many) => {
                out.extend(many);
            }

            DceResult::Remove => {}
        }

        if matches!(out.last(), Some(AslStatement::Return(_))) {
            break;
        }
    }

    out
}

enum DceResult {
    Keep(Box<AslStatement>),

    Replace(Vec<AslStatement>),

    Remove,
}

fn dce_stmt(stmt: AslStatement) -> DceResult {
    match stmt {
        AslStatement::If(mut s) => match bool_literal(&s.condition) {
            Some(true) => DceResult::Replace(dce_body(s.then_body)),

            Some(false) => {
                if let Some(eb) = s.else_body {
                    DceResult::Replace(dce_body(eb))
                } else {
                    DceResult::Remove
                }
            }

            None => {
                s.then_body = dce_body(std::mem::take(&mut s.then_body));

                s.else_body = s.else_body.map(dce_body);

                DceResult::Keep(Box::new(AslStatement::If(s)))
            }
        },

        AslStatement::While(mut s) => {
            if bool_literal(&s.condition) == Some(false) {
                return DceResult::Remove;
            }

            s.body = dce_body(std::mem::take(&mut s.body));

            DceResult::Keep(Box::new(AslStatement::While(s)))
        }

        AslStatement::For(mut s) => {
            match &mut *s {
                AslFor::Range(r) => {
                    r.body = dce_body(std::mem::take(&mut r.body));
                }

                AslFor::Each(e) => {
                    e.body = dce_body(std::mem::take(&mut e.body));
                }

                AslFor::CStyle(c) => {
                    if bool_literal(&c.condition) == Some(false) {
                        return DceResult::Remove;
                    }

                    c.body = dce_body(std::mem::take(&mut c.body));
                }
            }

            DceResult::Keep(Box::new(AslStatement::For(s)))
        }

        other => DceResult::Keep(Box::new(other)),
    }
}

fn bool_literal(expr: &AslExpr) -> Option<bool> {
    if let AslExpr::Literal(AslLiteral { value }) = expr {
        if let Some(b) = value.as_bool() {
            return Some(b);
        }

        if let Some(n) = value.as_f64() {
            return Some(n != 0.0);
        }
    }

    None
}

//        Testes

#[cfg(test)]

mod tests {

    use super::*;

    use crate::types::asl_types::*;

    fn prog_with(body: Vec<AslStatement>) -> AslProgram {
        let mut p = AslProgram::default();

        p.functions.push(AslFunction {
            name: "test".to_string(),
            params: vec![],
            return_type: None,
            body,
            doc: None,
            ..Default::default()
        });

        p
    }

    #[test]

    fn removes_if_false() {
        let stmt = AslStatement::If(Box::new(AslIf {
            condition: AslExpr::bool_val(false),

            then_body: vec![AslStatement::Break],

            else_if: vec![],

            else_body: None,
            ..Default::default()
        }));

        let mut prog = prog_with(vec![stmt]);

        eliminate_dead_code(&mut prog);

        assert!(prog.functions[0].body.is_empty());
    }

    #[test]

    fn replaces_if_true_with_then() {
        let stmt = AslStatement::If(Box::new(AslIf {
            condition: AslExpr::bool_val(true),

            then_body: vec![AslStatement::Break],

            else_if: vec![],

            else_body: Some(vec![AslStatement::Continue]),
            ..Default::default()
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

    #[test]
    fn removes_unused_globals() {
        let mut prog = AslProgram::default();
        prog.globals.push(AslGlobalVar {
            name: "unused_var".to_string(),
            r#type: AslType::Int,
            scope: "local".to_string(),
            lifecycle: "normal".to_string(),
            ..Default::default()
        });
        prog.globals.push(AslGlobalVar {
            name: "used_var".to_string(),
            r#type: AslType::Int,
            scope: "local".to_string(),
            lifecycle: "normal".to_string(),
            ..Default::default()
        });
        prog.globals.push(AslGlobalVar {
            name: "unused_state_but_kept".to_string(),
            r#type: AslType::Int,
            scope: "state".to_string(),
            lifecycle: "normal".to_string(),
            ..Default::default()
        });

        // Add a function that references "used_var"
        prog.functions.push(AslFunction {
            name: "test".to_string(),
            body: vec![AslStatement::Assign(AslAssign {
                target: "used_var".to_string(),
                value: AslExpr::int(1),
            })],
            ..Default::default()
        });

        eliminate_dead_code(&mut prog);

        assert_eq!(prog.globals.len(), 2);
        assert!(prog.globals.iter().any(|g| g.name == "used_var"));
        assert!(prog.globals.iter().any(|g| g.name == "unused_state_but_kept"));
        assert!(!prog.globals.iter().any(|g| g.name == "unused_var"));
    }
}
