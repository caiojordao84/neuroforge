//! postfix_utils.rs — extrai side-effects i++/i-- de expressões
//! Migrado de: src/engine/asl/transforms/postfixUtils.ts

use crate::types::asl_types::{AslExpr, AslStatement, AslAssign, AslBinary, BinaryOp};

/// Resultado da extracção de side-effects de uma expressão postfix
#[derive(Debug, Clone)]
pub struct PostfixExtraction {
    /// Expressão limpa (sem o side-effect)
    pub expr: AslExpr,
    /// Statements a emitir APÓS a expressão principal (ex: i = i + 1)
    pub post_stmts: Vec<AslStatement>,
}

/// Extrai `i++` → expr=`i`, post=[`i = i + 1`]
/// Extrai `i--` → expr=`i`, post=[`i = i - 1`]
/// Qualquer outra expressão é devolvida sem alteração.
pub fn extract_postfix(expr: AslExpr) -> PostfixExtraction {
    match &expr {
        AslExpr::PostfixInc(var) => {
            let post = AslStatement::Assign(AslAssign {
                target: var.clone(),
                value: AslExpr::Binary(Box::new(AslBinary {
                    op: BinaryOp::Add,
                    left: AslExpr::var(var),
                    right: AslExpr::int(1),
                })),
            });
            PostfixExtraction {
                expr: AslExpr::var(var),
                post_stmts: vec![post],
            }
        }
        AslExpr::PostfixDec(var) => {
            let post = AslStatement::Assign(AslAssign {
                target: var.clone(),
                value: AslExpr::Binary(Box::new(AslBinary {
                    op: BinaryOp::Sub,
                    left: AslExpr::var(var),
                    right: AslExpr::int(1),
                })),
            });
            PostfixExtraction {
                expr: AslExpr::var(var),
                post_stmts: vec![post],
            }
        }
        _ => PostfixExtraction {
            expr,
            post_stmts: vec![],
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_postfix_inc() {
        let expr = AslExpr::PostfixInc("i".to_string());
        let result = extract_postfix(expr);
        assert!(matches!(result.expr, AslExpr::Var(_)));
        assert_eq!(result.post_stmts.len(), 1);
    }

    #[test]
    fn test_extract_postfix_dec() {
        let expr = AslExpr::PostfixDec("i".to_string());
        let result = extract_postfix(expr);
        assert!(matches!(result.expr, AslExpr::Var(_)));
        assert_eq!(result.post_stmts.len(), 1);
    }

    #[test]
    fn test_passthrough_literal() {
        let expr = AslExpr::int(42);
        let result = extract_postfix(expr.clone());
        assert!(matches!(result.expr, AslExpr::Literal(_)));
        assert!(result.post_stmts.is_empty());
    }
}
