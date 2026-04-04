//! block_transform.rs     transforma blocos de controlo de fluxo em AslStatement

//! Migrado de: src/engine/asl/transforms/blockTransform.ts



use crate::transforms::context::TransformContext;

use crate::transforms::expr_transform::transform_expr;

use crate::transforms::statement_registry::transform_statement;

use crate::types::asl_types::*;

use crate::types::typed_nodes::{BlockKind, BlockNode, StatementNode};



/// Transforma um `BlockNode` em zero ou mais `AslStatement`

pub fn transform_block(block: &BlockNode, ctx: &mut TransformContext) -> Vec<AslStatement> {

    match &block.kind {

        BlockKind::If {

            condition,

            then_body,

            else_body,

        } => {

            let cond = transform_expr(condition, ctx);

            let then_stmts = transform_body(then_body, ctx);

            let else_stmts = else_body

                .as_ref()

                .map(|b| transform_body(b, ctx))

                .unwrap_or_default();

            vec![AslStatement::If(Box::new(AslIf {

                condition: cond,

                then_body: then_stmts,

                else_if: vec![],

                else_body: if else_stmts.is_empty() {

                    None

 ..Default::default() } else {

                    Some(else_stmts)

                },

            }))]

        }



        BlockKind::While { condition, body } => {

            let cond = transform_expr(condition, ctx);

            let stmts = transform_body(body, ctx);

            vec![AslStatement::While(Box::new(AslWhile {

                condition: cond,

                body: stmts,

            }))]

        }



        BlockKind::DoWhile { condition, body } => {

            let cond = transform_expr(condition, ctx);

            let stmts = transform_body(body, ctx);

            vec![AslStatement::DoWhile(Box::new(AslDoWhile {

                condition: cond,

                body: stmts,

            }))]

        }



        BlockKind::For {

            init,

            condition,

            update,

            body,

        } => {

            let init_stmt = init.as_ref().map(|e| {

                vec![AslStatement::Expr(AslExpressionStmt {

                    expr: transform_expr(e, ctx),

                })]

            });

            let cond = condition

                .as_ref()

                .map(|e| transform_expr(e, ctx))

                .unwrap_or_else(|| AslExpr::bool_val(true));

            let update_stmt = update

                .as_ref()

                .map(|e| {

                    vec![AslStatement::Expr(AslExpressionStmt {

                        expr: transform_expr(e, ctx),

                    })]

                })

                .unwrap_or_default();

            let stmts = transform_body(body, ctx);

            vec![AslStatement::For(Box::new(AslFor::CStyle(AslForCStyle {

                init: init_stmt.unwrap_or_default(),

                condition: cond,

                update: update_stmt,

                body: stmts,

            })))]

        }



        BlockKind::ForIn {

            variable,

            iterable,

            body,

        } => {

            let iter = transform_expr(iterable, ctx);

            let stmts = transform_body(body, ctx);

            vec![AslStatement::For(Box::new(AslFor::Each(AslForEach {

                var: variable.clone(),

                iterable: iter,

                body: stmts,

            })))]

        }



        BlockKind::Switch {

            discriminant,

            cases,

            default,

        } => {

            let disc = transform_expr(discriminant, ctx);

            let mut asl_cases: Vec<AslSwitchCase> = cases

                .iter()

                .map(|c| AslSwitchCase {

                    test: Some(transform_expr(&c.value, ctx)),

                    body: transform_body(&c.body, ctx),

                })

                .collect();

            if let Some(def_body) = default {

                asl_cases.push(AslSwitchCase {

                    test: None,

                    body: transform_body(def_body, ctx),

                });

            }

            vec![AslStatement::Switch(Box::new(AslSwitch {

                discriminant: disc,

                cases: asl_cases,

            }))]

        }



        BlockKind::Break => vec![AslStatement::Break],

        BlockKind::Continue => vec![AslStatement::Continue],



        BlockKind::Return(expr) => {

            let value = expr.as_ref().map(|e| transform_expr(e, ctx));

            vec![AslStatement::Return(AslReturn { value })]

        }

    }

}



/// Transforma uma lista de n  s de express  o/statement em Vec<AslStatement>

pub fn transform_body(nodes: &[StatementNode], ctx: &mut TransformContext) -> Vec<AslStatement> {

    let mut stmts = Vec::new();

    for n in nodes {

        stmts.extend(transform_statement(n, ctx));

    }

    stmts

}













