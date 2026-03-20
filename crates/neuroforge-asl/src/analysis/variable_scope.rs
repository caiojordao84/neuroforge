//! Análise de scope de variáveis para AslProgram.
//! Reporta:
//!   - uso de variável não declarada (error)
//!   - variável declarada mas nunca usada (warning)

use std::collections::{HashMap, HashSet};
use crate::types::asl_types::{AslProgram, AslStatement, AslExpr};
use super::type_checker::Diagnostic;

pub fn check_variable_scope(program: &AslProgram) -> Vec<Diagnostic> {
    let mut diags = Vec::new();

    let globals: HashSet<String> = program.globals.iter()
        .map(|g| g.name.clone())
        .collect();

    for func in &program.functions {
        let mut scope = ScopeChecker::new(&func.name, &globals);
        for p in &func.params { scope.declare(&p.name); }
        scope.check_body(&func.body, &mut diags);
        scope.report_unused(&mut diags);
    }

    for task in &program.tasks {
        let mut scope = ScopeChecker::new(&task.name, &globals);
        scope.check_body(&task.body, &mut diags);
        scope.report_unused(&mut diags);
    }

    diags
}

struct ScopeChecker<'a> {
    ctx:     &'a str,
    globals: &'a HashSet<String>,
    /// nome → (declarado, usado)
    vars: HashMap<String, (bool, bool)>,
}

impl<'a> ScopeChecker<'a> {
    fn new(ctx: &'a str, globals: &'a HashSet<String>) -> Self {
        Self { ctx, globals, vars: HashMap::new() }
    }

    fn declare(&mut self, name: &str) {
        self.vars.entry(name.to_string()).or_insert((true, false));
    }

    fn mark_used(&mut self, name: &str, diags: &mut Vec<Diagnostic>) {
        if self.globals.contains(name) { return; }
        match self.vars.get_mut(name) {
            Some((_, used)) => { *used = true; }
            None => {
                diags.push(Diagnostic::error(
                    self.ctx,
                    format!("Variável '{name}' usada antes de ser declarada"),
                ));
            }
        }
    }

    fn check_body(&mut self, body: &[AslStatement], diags: &mut Vec<Diagnostic>) {
        for stmt in body { self.check_stmt(stmt, diags); }
    }

    fn check_stmt(&mut self, stmt: &AslStatement, diags: &mut Vec<Diagnostic>) {
        match stmt {
            AslStatement::Declare(d) => {
                if let Some(val) = &d.value { self.check_expr(val, diags); }
                self.declare(&d.name);
            }
            AslStatement::Assign(a) => {
                self.mark_used(&a.target, diags);
                self.check_expr(&a.value, diags);
            }
            AslStatement::If(s) => {
                self.check_expr(&s.condition, diags);
                self.check_body(&s.then_branch, diags);
                if let Some(eb) = &s.else_branch { self.check_body(eb, diags); }
            }
            AslStatement::While(s) => {
                self.check_expr(&s.condition, diags);
                self.check_body(&s.body, diags);
            }
            AslStatement::For(s) => {
                if let Some(init) = &s.init { self.check_body(init, diags); }
                self.check_expr(&s.condition, diags);
                self.check_body(&s.body, diags);
                self.check_body(&s.update, diags);
            }
            AslStatement::Return(r) => {
                if let Some(e) = &r.value { self.check_expr(e, diags); }
            }
            AslStatement::Expr(e) => { self.check_expr(&e.expr, diags); }
            _ => {}
        }
    }

    fn check_expr(&mut self, expr: &AslExpr, diags: &mut Vec<Diagnostic>) {
        match expr {
            AslExpr::Var(v) => { self.mark_used(&v.name, diags); }
            AslExpr::Binary(b) => {
                self.check_expr(&b.left, diags);
                self.check_expr(&b.right, diags);
            }
            AslExpr::Call(c) => {
                for a in &c.args { self.check_expr(a, diags); }
            }
            AslExpr::Unary(u) => { self.check_expr(&u.expr, diags); }
            AslExpr::Conditional(c) => {
                self.check_expr(&c.condition, diags);
                self.check_expr(&c.when_true, diags);
                self.check_expr(&c.when_false, diags);
            }
            AslExpr::Index(i) => {
                self.check_expr(&i.target, diags);
                self.check_expr(&i.index, diags);
            }
            AslExpr::Member(m) => { self.check_expr(&m.target, diags); }
            AslExpr::PostfixInc(n) | AslExpr::PostfixDec(n) => {
                self.mark_used(n, diags);
            }
            _ => {}
        }
    }

    fn report_unused(&self, diags: &mut Vec<Diagnostic>) {
        for (name, (_decl, used)) in &self.vars {
            if !used {
                diags.push(Diagnostic::warning(
                    self.ctx,
                    format!("Variável '{name}' declarada mas nunca usada"),
                ));
            }
        }
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
        p
    }

    #[test]
    fn undeclared_var_is_error() {
        let stmt = AslStatement::Assign(AslAssign {
            target: "x".to_string(),
            value:  AslExpr::int(1),
        });
        let diags = check_variable_scope(&prog_with(vec![stmt]));
        assert!(diags.iter().any(|d| d.severity == "error"), "{:?}", diags);
    }

    #[test]
    fn unused_var_is_warning() {
        let stmt = AslStatement::Declare(AslDeclare {
            name: "y".to_string(),
            r#type: AslType::Int,
            value: None,
        });
        let diags = check_variable_scope(&prog_with(vec![stmt]));
        assert!(diags.iter().any(|d| d.severity == "warning"), "{:?}", diags);
    }

    #[test]
    fn declared_then_used_is_clean() {
        let decl = AslStatement::Declare(AslDeclare {
            name: "z".to_string(), r#type: AslType::Int, value: None,
        });
        let use_ = AslStatement::Assign(AslAssign {
            target: "z".to_string(), value: AslExpr::int(5),
        });
        let diags = check_variable_scope(&prog_with(vec![decl, use_]));
        assert!(diags.is_empty(), "{:?}", diags);
    }
}
