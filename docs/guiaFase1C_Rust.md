Tenho tudo confirmado. Resumo dos tipos de retorno reais: 

- `CParser::parse()` → `Result<ProgramNode, CParseError>` — precisa de `ast_to_asl(&prog, Language::Cpp)`
- `RustParser::parse()` → `Result<ProgramNode, RustParseError>` — precisa de `ast_to_asl(&prog, Language::Rust)`  
- `PythonParser::parse()` → `Result<AslProgram, PythonParseError>` — já é `AslProgram`, só `Ok(prog)`
- `StParser::parse()` → `Result<AslProgram, StParseError>` — já é `AslProgram`, só `Ok(prog)`

Agora gero o guia completo e definitivo:

***

```markdown
# Guia Fase 1C — Analysis, Optimizer e WASM bindings completos
## NeuroForge ASL — Migração TypeScript → Rust

> **Pré-requisito:** Fase 1B concluída (commit `cb9657a`).
> **Crate alvo:** `crates/neuroforge-asl/`
> **Branch:** `preRust`
> **Verificação final:** `cargo check -p neuroforge-asl` + `cargo test -p neuroforge-asl`

---

## Estado de entrada (o que já existe)

| Módulo | Estado |
|---|---|
| `executor/asl_executor.rs` | ✅ Completo — C, Rust, Python, ST, stubs PLC |
| `transpile.rs` | ✅ Completo — API pública `transpile()` + `transpile_with_map()` |
| `wasm/mod.rs` | ✅ Completo — declara `pub mod bindings` |
| `wasm/bindings.rs` | ⚠️ Parcial — faltam `wasm_check_types`, `wasm_get_diagnostics`, `wasm_parse_to_asl` |
| `optimizer/mod.rs` | ❌ Placeholder vazio |
| `analysis/mod.rs` | ❌ Placeholder vazio |
| `lib.rs` | ✅ Já declara todos os módulos |

---

## Tipos de retorno dos parsers (confirmados)

| Parser | Retorna |
|---|---|
| `CParser::parse(src)` | `Result<ProgramNode, CParseError>` |
| `RustParser::parse(src)` | `Result<ProgramNode, RustParseError>` |
| `PythonParser::parse(src)` | `Result<AslProgram, PythonParseError>` |
| `StParser::parse(src)` | `Result<AslProgram, StParseError>` |

`ProgramNode → AslProgram` via: `ast_to_asl(&prog, Language::Cpp/Rust)`
(função em `crate::transforms::code_to_asl`, sem Result — retorna `AslProgram` directamente)

---

## Ficheiros a criar/modificar

```
crates/neuroforge-asl/src/
├── analysis/
│   ├── mod.rs                  ← MODIFICAR
│   ├── type_checker.rs         ← CRIAR
│   ├── variable_scope.rs       ← CRIAR
│   └── dependency_graph.rs     ← CRIAR
├── optimizer/
│   ├── mod.rs                  ← MODIFICAR
│   ├── constant_fold.rs        ← CRIAR
│   ├── dead_code.rs            ← CRIAR
│   └── inline_const.rs         ← CRIAR
└── wasm/
    └── bindings.rs             ← MODIFICAR (adicionar ao fim, antes dos testes)
```

---

## Passo 1 — `analysis/type_checker.rs` (CRIAR)

```rust
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
```

---

## Passo 2 — `analysis/variable_scope.rs` (CRIAR)

```rust
//! Análise de scope de variáveis para AslProgram.
//! Reporta:
//!   - uso de variável não declarada (error)
//!   - variável declarada mas nunca usada (warning)

use std::collections::{HashMap, HashSet};
use crate::types::asl_types::{AslProgram, AslFunction, AslStatement, AslExpr};
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
```

---

## Passo 3 — `analysis/dependency_graph.rs` (CRIAR)

```rust
//! Grafo de dependências entre funções do AslProgram.
//! Devolve HashMap<nome_função, Vec<nome_função_chamada>>.

use std::collections::{HashMap, HashSet};
use crate::types::asl_types::{AslProgram, AslStatement, AslExpr};

pub type CallGraph = HashMap<String, Vec<String>>;

/// Constrói o grafo de chamadas do programa.
pub fn build_call_graph(program: &AslProgram) -> CallGraph {
    let mut graph = CallGraph::new();

    for func in &program.functions {
        let mut called = HashSet::new();
        collect_calls_body(&func.body, &mut called);
        graph.insert(func.name.clone(), called.into_iter().collect());
    }
    for task in &program.tasks {
        let mut called = HashSet::new();
        collect_calls_body(&task.body, &mut called);
        graph.insert(task.name.clone(), called.into_iter().collect());
    }

    graph
}

/// Detecta funções declaradas mas nunca alcançadas a partir dos `entry_points`.
pub fn find_unreachable_functions(
    program: &AslProgram,
    entry_points: &[&str],
) -> Vec<String> {
    let graph = build_call_graph(program);
    let mut reachable: HashSet<String> = entry_points.iter().map(|s| s.to_string()).collect();
    let mut queue: Vec<String> = reachable.iter().cloned().collect();

    while let Some(node) = queue.pop() {
        if let Some(deps) = graph.get(&node) {
            for dep in deps {
                if reachable.insert(dep.clone()) {
                    queue.push(dep.clone());
                }
            }
        }
    }

    program.functions.iter()
        .map(|f| f.name.clone())
        .filter(|name| !reachable.contains(name))
        .collect()
}

fn collect_calls_body(body: &[AslStatement], out: &mut HashSet<String>) {
    for stmt in body { collect_calls_stmt(stmt, out); }
}

fn collect_calls_stmt(stmt: &AslStatement, out: &mut HashSet<String>) {
    match stmt {
        AslStatement::Expr(e)    => collect_calls_expr(&e.expr, out),
        AslStatement::Assign(a)  => collect_calls_expr(&a.value, out),
        AslStatement::Declare(d) => { if let Some(v) = &d.value { collect_calls_expr(v, out); } }
        AslStatement::If(s) => {
            collect_calls_expr(&s.condition, out);
            collect_calls_body(&s.then_branch, out);
            if let Some(eb) = &s.else_branch { collect_calls_body(eb, out); }
        }
        AslStatement::While(s) => {
            collect_calls_expr(&s.condition, out);
            collect_calls_body(&s.body, out);
        }
        AslStatement::Return(r) => {
            if let Some(e) = &r.value { collect_calls_expr(e, out); }
        }
        _ => {}
    }
}

fn collect_calls_expr(expr: &AslExpr, out: &mut HashSet<String>) {
    match expr {
        AslExpr::Call(c) => {
            out.insert(c.callee.clone());
            for a in &c.args { collect_calls_expr(a, out); }
        }
        AslExpr::Binary(b) => {
            collect_calls_expr(&b.left, out);
            collect_calls_expr(&b.right, out);
        }
        AslExpr::Unary(u) => collect_calls_expr(&u.expr, out),
        AslExpr::Conditional(c) => {
            collect_calls_expr(&c.condition, out);
            collect_calls_expr(&c.when_true, out);
            collect_calls_expr(&c.when_false, out);
        }
        _ => {}
    }
}

// ── Testes ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::*;

    #[test]
    fn call_graph_finds_dep() {
        let mut p = AslProgram::default();
        p.functions.push(AslFunction {
            name: "main".to_string(), params: vec![], return_type: None,
            body: vec![AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::Call(Box::new(AslCall {
                    callee: "helper".to_string(), args: vec![],
                })),
            })],
        });
        p.functions.push(AslFunction {
            name: "helper".to_string(), params: vec![], return_type: None, body: vec![],
        });
        let graph = build_call_graph(&p);
        assert!(graph["main"].contains(&"helper".to_string()));
    }

    #[test]
    fn unreachable_function_detected() {
        let mut p = AslProgram::default();
        p.functions.push(AslFunction {
            name: "main".to_string(), params: vec![], return_type: None, body: vec![],
        });
        p.functions.push(AslFunction {
            name: "orphan".to_string(), params: vec![], return_type: None, body: vec![],
        });
        let unreachable = find_unreachable_functions(&p, &["main"]);
        assert!(unreachable.contains(&"orphan".to_string()), "{:?}", unreachable);
    }
}
```

---

## Passo 4 — `analysis/mod.rs` (SUBSTITUIR)

```rust
//! Módulo de análise estática do ASL.

pub mod type_checker;
pub mod variable_scope;
pub mod dependency_graph;

pub use type_checker::{check_types, Diagnostic};
pub use variable_scope::check_variable_scope;
pub use dependency_graph::{build_call_graph, find_unreachable_functions, CallGraph};
```

---

## Passo 5 — `optimizer/constant_fold.rs` (CRIAR)

```rust
//! Constant folding — avalia AslExpr com dois literais numéricos em compile-time.
//! Binary(Add, Literal(2), Literal(2)) → Literal(4)

use crate::types::asl_types::{
    AslProgram, AslFunction, AslTask, AslStatement, AslExpr,
    AslBinary, BinaryOp, AslLiteral,
};

pub fn constant_fold(program: &mut AslProgram) {
    for func in &mut program.functions { fold_function(func); }
    for task in &mut program.tasks     { fold_task(task);     }
}

fn fold_function(func: &mut AslFunction) {
    for stmt in &mut func.body { fold_stmt(stmt); }
}

fn fold_task(task: &mut AslTask) {
    for stmt in &mut task.body { fold_stmt(stmt); }
}

fn fold_stmt(stmt: &mut AslStatement) {
    match stmt {
        AslStatement::Declare(d) => { if let Some(v) = &mut d.value { fold_expr(v); } }
        AslStatement::Assign(a)  => { fold_expr(&mut a.value); }
        AslStatement::Expr(e)    => { fold_expr(&mut e.expr); }
        AslStatement::Return(r)  => { if let Some(e) = &mut r.value { fold_expr(e); } }
        AslStatement::If(s) => {
            fold_expr(&mut s.condition);
            for st in &mut s.then_branch { fold_stmt(st); }
            if let Some(eb) = &mut s.else_branch { for st in eb { fold_stmt(st); } }
        }
        AslStatement::While(s) => {
            fold_expr(&mut s.condition);
            for st in &mut s.body { fold_stmt(st); }
        }
        _ => {}
    }
}

pub fn fold_expr(expr: &mut AslExpr) {
    if let AslExpr::Binary(b) = expr {
        fold_expr(&mut b.left);
        fold_expr(&mut b.right);
        if let Some(result) = try_fold_binary(b) {
            *expr = AslExpr::Literal(AslLiteral { value: serde_json::json!(result) });
        }
    }
}

fn try_fold_binary(b: &AslBinary) -> Option<f64> {
    let l = literal_f64(&b.left)?;
    let r = literal_f64(&b.right)?;
    Some(match b.op {
        BinaryOp::Add    => l + r,
        BinaryOp::Sub    => l - r,
        BinaryOp::Mul    => l * r,
        BinaryOp::Div    => { if r == 0.0 { return None; } l / r }
        BinaryOp::Mod    => { if r == 0.0 { return None; } l % r }
        BinaryOp::IntDiv => { if r == 0.0 { return None; } (l as i64 / r as i64) as f64 }
        BinaryOp::Eq     => (l == r) as i64 as f64,
        BinaryOp::Neq    => (l != r) as i64 as f64,
        BinaryOp::Lt     => (l <  r) as i64 as f64,
        BinaryOp::Lte    => (l <= r) as i64 as f64,
        BinaryOp::Gt     => (l >  r) as i64 as f64,
        BinaryOp::Gte    => (l >= r) as i64 as f64,
        _ => return None,
    })
}

fn literal_f64(expr: &AslExpr) -> Option<f64> {
    if let AslExpr::Literal(l) = expr { l.value.as_f64() } else { None }
}

// ── Testes ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::*;

    #[test]
    fn folds_add_two_ints() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add, left: AslExpr::int(2), right: AslExpr::int(3),
        }));
        fold_expr(&mut expr);
        assert!(matches!(&expr, AslExpr::Literal(l) if l.value.as_f64() == Some(5.0)));
    }

    #[test]
    fn folds_nested() {
        // (1 + 2) * 4 → 12
        let inner = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add, left: AslExpr::int(1), right: AslExpr::int(2),
        }));
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Mul, left: inner, right: AslExpr::int(4),
        }));
        fold_expr(&mut expr);
        assert!(matches!(&expr, AslExpr::Literal(l) if l.value.as_f64() == Some(12.0)));
    }

    #[test]
    fn div_by_zero_no_fold() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Div, left: AslExpr::int(4), right: AslExpr::int(0),
        }));
        fold_expr(&mut expr);
        assert!(matches!(expr, AslExpr::Binary(_)));
    }

    #[test]
    fn no_fold_with_var() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add, left: AslExpr::var("x"), right: AslExpr::int(1),
        }));
        fold_expr(&mut expr);
        assert!(matches!(expr, AslExpr::Binary(_)));
    }
}
```

---

## Passo 6 — `optimizer/dead_code.rs` (CRIAR)

```rust
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
        assert!(prog.functions.body.is_empty());
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
        assert_eq!(prog.functions.body.len(), 1);
        assert!(matches!(prog.functions.body, AslStatement::Break));
    }

    #[test]
    fn removes_while_false() {
        let stmt = AslStatement::While(Box::new(AslWhile {
            condition: AslExpr::bool_val(false),
            body: vec![AslStatement::Break],
        }));
        let mut prog = prog_with(vec![stmt]);
        eliminate_dead_code(&mut prog);
        assert!(prog.functions.body.is_empty());
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
        assert_eq!(prog.functions.body.len(), 1);
        assert!(matches!(prog.functions.body, AslStatement::Return(_)));
    }
}
```

---

## Passo 7 — `optimizer/inline_const.rs` (CRIAR)

```rust
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
        p
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
        let body = &prog.functions.body;
        assert!(!body.iter().any(|s| matches!(s, AslStatement::Declare(d) if d.name == "MAX")));
        if let AslStatement::Assign(a) = &body {
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
        assert!(prog.functions.body.iter()
            .any(|s| matches!(s, AslStatement::Declare(d) if d.name == "counter")));
    }
}
```

---

## Passo 8 — `optimizer/mod.rs` (SUBSTITUIR)

```rust
//! Optimizações sobre o AslProgram.
//! Pipeline recomendado: constant_fold → dead_code → inline_const.

pub mod constant_fold;
pub mod dead_code;
pub mod inline_const;

pub use constant_fold::constant_fold;
pub use dead_code::eliminate_dead_code;
pub use inline_const::inline_constants;

use crate::types::asl_types::AslProgram;

/// Aplica o pipeline completo de optimização (in-place).
/// Ordem: fold literals → elimina dead code → inline constantes.
pub fn optimize(program: &mut AslProgram) {
    constant_fold(program);
    eliminate_dead_code(program);
    inline_constants(program);
}
```

---

## Passo 9 — `wasm/bindings.rs` (ADICIONAR ao fim, antes do bloco `#[cfg(test)]`)

```rust
// ═══════════════════════════════════════════════════════════════════════════════
// Funções de análise WASM — adicionadas na Fase 1C
// ═══════════════════════════════════════════════════════════════════════════════

/// Verifica tipos no código fonte e devolve JSON com lista de diagnósticos.
///
/// Formato de retorno:
/// ```json
/// [{"severity":"error","context":"fn_name","message":"..."}]
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_check_types(source: &str, lang: &str) -> Result<String, JsValue> {
    use crate::analysis::check_types;
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    Ok(diags_to_json(&check_types(&prog)))
}

/// Devolve diagnósticos completos (type + scope) em JSON.
///
/// Formato de retorno:
/// ```json
/// [{"severity":"warning","context":"fn_name","message":"..."}]
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_get_diagnostics(source: &str, lang: &str) -> Result<String, JsValue> {
    use crate::analysis::{check_types, check_variable_scope};
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    let mut diags = check_types(&prog);
    diags.extend(check_variable_scope(&prog));
    Ok(diags_to_json(&diags))
}

/// Converte o código fonte para ASL IR em JSON (dev mode / debug no editor).
///
/// Formato de retorno: JSON serializado de `AslProgram`.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_to_asl(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    serde_json::to_string(&prog).map_err(|e| JsValue::from_str(&e.to_string()))
}

// ── helpers internos ──────────────────────────────────────────────────────────

/// Faz parse do source para AslProgram usando o parser correcto para o lang.
///
/// Mapeamento confirmado:
///   C | Cpp | Arduino → CParser::parse() → ProgramNode → ast_to_asl(&prog, Language::Cpp)
///   Rust               → RustParser::parse() → ProgramNode → ast_to_asl(&prog, Language::Rust)
///   Python | MicroPython → PythonParser::parse() → AslProgram directamente
///   St                 → StParser::parse() → AslProgram directamente
fn parse_to_asl_program(
    source: &str,
    target: &crate::executor::TargetLanguage,
) -> Result<crate::types::asl_types::AslProgram, String> {
    use crate::executor::TargetLanguage::*;
    use crate::transforms::code_to_asl::ast_to_asl;
    use crate::transforms::context::Language;

    match target {
        C | Cpp | Arduino => {
            let prog = crate::plugins::c::c_parser::CParser::parse(source)
                .map_err(|e| format!("CParser: {e}"))?;
            // ast_to_asl devolve AslProgram directamente (sem Result)
            Ok(ast_to_asl(&prog, Language::Cpp))
        }
        Rust => {
            let prog = crate::plugins::rust_std::rust_parser::RustParser::parse(source)
                .map_err(|e| format!("RustParser: {e}"))?;
            Ok(ast_to_asl(&prog, Language::Rust))
        }
        Python | MicroPython => {
            // PythonParser::parse() já devolve AslProgram
            crate::plugins::python::python_parser::PythonParser::parse(source)
                .map_err(|e| format!("PythonParser: {e}"))
        }
        St => {
            // StParser::parse() já devolve AslProgram
            crate::plugins::plc::st_parser::StParser::parse(source)
                .map_err(|e| format!("StParser: {e}"))
        }
        _ => Err(format!(
            "parse_to_asl_program: linguagem {target:?} não suportada em análise"
        )),
    }
}

fn diags_to_json(diags: &[crate::analysis::Diagnostic]) -> String {
    let items: Vec<String> = diags.iter().map(|d| {
        format!(
            "{{\"severity\":{},\"context\":{},\"message\":{}}}",
            serde_json::to_string(d.severity).unwrap_or_default(),
            serde_json::to_string(&d.context).unwrap_or_default(),
            serde_json::to_string(&d.message).unwrap_or_default(),
        )
    }).collect();
    format!("[{}]", items.join(","))
}
```

---

## Passo 10 — Verificação e commit

```powershell
# 1. Compilação
cargo check -p neuroforge-asl 2>&1 | Select-String "error" | Select-Object -First 20

# 2. Testes unitários
cargo test -p neuroforge-asl 2>&1 | Select-String "FAILED|test.*ok|error\[" | Select-Object -First 50

# 3. Check WASM target (não precisa de wasm-pack)
cargo check -p neuroforge-asl --target wasm32-unknown-unknown 2>&1 | Select-String "error" | Select-Object -First 20

# 4. Commit
git add crates/neuroforge-asl/src/analysis/ `
       crates/neuroforge-asl/src/optimizer/ `
       crates/neuroforge-asl/src/wasm/bindings.rs `
       docs/guiaFase1C_Rust.md
git commit -m "feat(asl): Fase 1C — analysis (type_checker, scope, deps), optimizer (fold, dce, inline), wasm bindings completos"
git push origin preRust
```

---

## Resumo de ficheiros e linhas

| Ficheiro | Acção | Linhas aprox. |
|---|---|---|
| `analysis/type_checker.rs` | CRIAR | ~140 |
| `analysis/variable_scope.rs` | CRIAR | ~155 |
| `analysis/dependency_graph.rs` | CRIAR | ~105 |
| `analysis/mod.rs` | SUBSTITUIR | 10 |
| `optimizer/constant_fold.rs` | CRIAR | ~115 |
| `optimizer/dead_code.rs` | CRIAR | ~120 |
| `optimizer/inline_const.rs` | CRIAR | ~130 |
| `optimizer/mod.rs` | SUBSTITUIR | 18 |
| `wasm/bindings.rs` | ADICIONAR ~80 linhas | +80 |
| **Total adições** | | **~873 linhas** |

---

## O que fica para a Fase 1D

| Módulo | Descrição |
|---|---|
| `wasm-pack build --target web` | Build WASM real para npm |
| `pkg/` | Publicar `neuroforge-asl` como pacote npm |
| Monaco integration | Ligar `wasm_get_diagnostics` aos markers do Monaco editor |
| `optimize()` pipeline | Expor `wasm_optimize(source, lang)` no WASM |
```