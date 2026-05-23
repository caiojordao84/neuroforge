//! Constant folding     avalia AslExpr com dois literais num  ricos em compile-time.

//! Binary(Add, Literal(2), Literal(2))     Literal(4)

use crate::types::asl_types::{
    AslBinary, AslExpr, AslFor, AslFunction, AslLiteral, AslProgram, AslStatement, AslTask,
    BinaryOp,
};

pub fn constant_fold(program: &mut AslProgram) {
    for func in &mut program.functions {
        fold_function(func);
    }

    for task in &mut program.tasks {
        fold_task(task);
    }
}

fn fold_function(func: &mut AslFunction) {
    for stmt in &mut func.body {
        fold_stmt(stmt);
    }
}

fn fold_task(task: &mut AslTask) {
    for stmt in &mut task.body {
        fold_stmt(stmt);
    }
}

fn fold_stmt(stmt: &mut AslStatement) {
    match stmt {
        AslStatement::Declare(d) => {
            if let Some(v) = &mut d.value {
                fold_expr(v);
            }
        }

        AslStatement::Assign(a) => {
            fold_expr(&mut a.value);
        }

        AslStatement::Expr(e) => {
            fold_expr(&mut e.expr);
        }

        AslStatement::Return(r) => {
            if let Some(e) = &mut r.value {
                fold_expr(e);
            }
        }

        AslStatement::If(s) => {
            fold_expr(&mut s.condition);

            for st in &mut s.then_body {
                fold_stmt(st);
            }

            if let Some(eb) = &mut s.else_body {
                for st in eb {
                    fold_stmt(st);
                }
            }
        }

        AslStatement::While(s) => {
            fold_expr(&mut s.condition);

            for st in &mut s.body {
                fold_stmt(st);
            }
        }

        AslStatement::For(s) => match &mut **s {
            AslFor::Range(r) => {
                fold_expr(&mut r.from);

                fold_expr(&mut r.to);

                fold_expr(&mut r.step);

                for st in &mut r.body {
                    fold_stmt(st);
                }
            }

            AslFor::Each(e) => {
                fold_expr(&mut e.iterable);

                for st in &mut e.body {
                    fold_stmt(st);
                }
            }

            AslFor::CStyle(c) => {
                for st in &mut c.init {
                    fold_stmt(st);
                }

                fold_expr(&mut c.condition);

                for st in &mut c.update {
                    fold_stmt(st);
                }

                for st in &mut c.body {
                    fold_stmt(st);
                }
            }
        },

        _ => {}
    }
}

pub fn fold_expr(expr: &mut AslExpr) {
    if let AslExpr::Binary(b) = expr {
        fold_expr(&mut b.left);

        fold_expr(&mut b.right);

        if let Some(result) = try_fold_binary(b) {
            *expr = AslExpr::Literal(AslLiteral {
                value: result,
            });
        }
    }
}

fn try_fold_binary(b: &AslBinary) -> Option<serde_json::Value> {
    if b.op == BinaryOp::And || b.op == BinaryOp::Or {
        let l = literal_bool(&b.left)?;
        let r = literal_bool(&b.right)?;
        return Some(match b.op {
            BinaryOp::And => serde_json::Value::Bool(l && r),
            BinaryOp::Or => serde_json::Value::Bool(l || r),
            _ => unreachable!(),
        });
    }

    let l = literal_f64(&b.left)?;
    let r = literal_f64(&b.right)?;

    Some(match b.op {
        BinaryOp::Add => serde_json::json!(l + r),

        BinaryOp::Sub => serde_json::json!(l - r),

        BinaryOp::Mul => serde_json::json!(l * r),

        BinaryOp::Div => {
            if r == 0.0 {
                return None;
            }
            serde_json::json!(l / r)
        }

        BinaryOp::Mod => {
            if r == 0.0 {
                return None;
            }
            serde_json::json!(l % r)
        }

        BinaryOp::IntDiv => {
            if r == 0.0 {
                return None;
            }
            serde_json::json!(l as i64 / r as i64)
        }

        BinaryOp::Eq => serde_json::json!(l == r),

        BinaryOp::Neq => serde_json::json!(l != r),

        BinaryOp::Lt => serde_json::json!(l < r),

        BinaryOp::Lte => serde_json::json!(l <= r),

        BinaryOp::Gt => serde_json::json!(l > r),

        BinaryOp::Gte => serde_json::json!(l >= r),

        BinaryOp::BitAnd => serde_json::json!(l as i64 & r as i64),

        BinaryOp::BitOr => serde_json::json!(l as i64 | r as i64),

        BinaryOp::BitXor => serde_json::json!(l as i64 ^ r as i64),

        _ => return None,
    })
}

fn literal_bool(expr: &AslExpr) -> Option<bool> {
    if let AslExpr::Literal(l) = expr {
        if let Some(b) = l.value.as_bool() {
            return Some(b);
        }
        if let Some(n) = l.value.as_f64() {
            return Some(n != 0.0);
        }
    }
    None
}

fn literal_f64(expr: &AslExpr) -> Option<f64> {
    if let AslExpr::Literal(l) = expr {
        if let Some(n) = l.value.as_f64() {
            Some(n)
        } else if let Some(b) = l.value.as_bool() {
            Some(if b { 1.0 } else { 0.0 })
        } else {
            None
        }
    } else {
        None
    }
}

//        Testes

#[cfg(test)]

mod tests {

    use super::*;

    use crate::types::asl_types::*;

    #[test]

    fn folds_add_two_ints() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add,
            left: AslExpr::int(2),
            right: AslExpr::int(3),
        }));

        fold_expr(&mut expr);

        assert!(matches!(&expr, AslExpr::Literal(l) if l.value.as_f64() == Some(5.0)));
    }

    #[test]

    fn folds_nested() {
        // (1 + 2) * 4     12

        let inner = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add,
            left: AslExpr::int(1),
            right: AslExpr::int(2),
        }));

        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Mul,
            left: inner,
            right: AslExpr::int(4),
        }));

        fold_expr(&mut expr);

        assert!(matches!(&expr, AslExpr::Literal(l) if l.value.as_f64() == Some(12.0)));
    }

    #[test]

    fn div_by_zero_no_fold() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Div,
            left: AslExpr::int(4),
            right: AslExpr::int(0),
        }));

        fold_expr(&mut expr);

        assert!(matches!(expr, AslExpr::Binary(_)));
    }

    #[test]

    fn no_fold_with_var() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Add,
            left: AslExpr::var("x"),
            right: AslExpr::int(1),
        }));

        fold_expr(&mut expr);

        assert!(matches!(expr, AslExpr::Binary(_)));
    }

    #[test]
    fn folds_logical_operators() {
        let mut expr = AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::And,
            left: AslExpr::bool_val(true),
            right: AslExpr::bool_val(false),
        }));

        fold_expr(&mut expr);

        assert!(matches!(&expr, AslExpr::Literal(l) if l.value.as_bool() == Some(false)));
    }
}
