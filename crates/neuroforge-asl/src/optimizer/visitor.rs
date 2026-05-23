use crate::asl_types::core::program::AslStatement;
use crate::asl_types::core::types::AslExpr;

pub trait AslVisitor {
    /// Otimiza uma expressão (Constant Folding)
    fn fold_expr(&mut self, expr: AslExpr) -> AslExpr;
    
    /// Otimiza uma instrução (Dead Code Elimination ou Inlining)
    fn fold_statement(&mut self, stmt: AslStatement) -> AslStatement;
}
