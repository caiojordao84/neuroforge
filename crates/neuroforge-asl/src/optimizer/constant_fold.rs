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
