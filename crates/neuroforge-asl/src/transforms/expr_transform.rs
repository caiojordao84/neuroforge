//! expr_transform.rs     transforma n  s de express  o AST em AslExpr

//! Migrado de: src/engine/asl/transforms/exprTransform.ts



use crate::transforms::context::TransformContext;

use crate::types::asl_types::{

    AslBinary, AslCall, AslConditional, AslExpr, AslIndex, AslMember, AslUnary, BinaryOp, UnaryOp,

};

use crate::types::typed_nodes::{ExprKind, ExprNode};



/// Transforma um `ExprNode` (AST) em `AslExpr` (IR ASL)

#[allow(clippy::only_used_in_recursion)]

pub fn transform_expr(node: &ExprNode, ctx: &TransformContext) -> AslExpr {

    match &node.kind {

        ExprKind::IntLiteral(v) => AslExpr::int(*v),

        ExprKind::FloatLiteral(v) => AslExpr::float(*v),

        ExprKind::BoolLiteral(v) => AslExpr::bool_val(*v),

        ExprKind::StringLiteral(v) => AslExpr::str_val(v),

        ExprKind::NullLiteral => AslExpr::int(0), // Fallback para NULL em ASL



        ExprKind::Identifier(name) => AslExpr::var(name),



        ExprKind::ArrayAccess { object, index } => {

            let obj = transform_expr(object, ctx);

            let idx = transform_expr(index, ctx);

            AslExpr::Index(Box::new(AslIndex {

                target: obj,

                index: idx,

            }))

        }



        ExprKind::BinaryOp { op, left, right } => {

            let l = transform_expr(left, ctx);

            let r = transform_expr(right, ctx);

            AslExpr::Binary(Box::new(AslBinary {

                op: BinaryOp::from_str(op),

                left: l,

                right: r,

            }))

        }



        ExprKind::CompareOp { op, left, right } => {

            let l = transform_expr(left, ctx);

            let r = transform_expr(right, ctx);

            AslExpr::Binary(Box::new(AslBinary {

                op: BinaryOp::from_str(op),

                left: l,

                right: r,

            }))

        }



        ExprKind::BoolOp { op, left, right } => {

            let l = transform_expr(left, ctx);

            let r = transform_expr(right, ctx);

            AslExpr::Binary(Box::new(AslBinary {

                op: BinaryOp::from_str(op),

                left: l,

                right: r,

            }))

        }



        ExprKind::Not(inner) => AslExpr::Unary(Box::new(AslUnary {

            op: UnaryOp::Not,

            expr: transform_expr(inner, ctx),

        })),



        ExprKind::PostfixInc(name) => AslExpr::PostfixInc(name.clone()),

        ExprKind::PostfixDec(name) => AslExpr::PostfixDec(name.clone()),



        ExprKind::Call(call_node) => {

            let transformed_args: Vec<AslExpr> = call_node

                .args

                .iter()

                .map(|a| transform_expr(a, ctx))

                .collect();

            AslExpr::Call(Box::new(AslCall {

                callee: call_node.name.clone(),

                args: transformed_args,

            }))

        }



        ExprKind::MemberAccess { object, member } => {

            let obj = transform_expr(object, ctx);

            AslExpr::Member(Box::new(AslMember {

                target: obj,

                property: member.clone(),

            }))

        }



        ExprKind::Cast { target_type, expr } => AslExpr::Cast {

            target_type: target_type.clone(),

            expr: Box::new(transform_expr(expr, ctx)),

        },



        ExprKind::Ternary {

            condition,

            then_expr,

            else_expr,

        } => AslExpr::Conditional(Box::new(AslConditional {

            condition: transform_expr(condition, ctx),

            when_true: transform_expr(then_expr, ctx),

            when_false: transform_expr(else_expr, ctx),

        })),

    }

}











