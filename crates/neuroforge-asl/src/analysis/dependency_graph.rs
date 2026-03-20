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
