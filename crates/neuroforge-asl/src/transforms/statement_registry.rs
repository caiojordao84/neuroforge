//! statement_registry.rs — registry central de transforms de statements
//! Migrado de: src/engine/asl/transforms/statementRegistry.ts
//! Este é o módulo mais crítico da pipeline ProgramNode → AslProgram.

use crate::types::asl_types::*;
use crate::types::typed_nodes::{ProgramNode, StatementNode, StatementKind, FunctionNode};
use crate::transforms::context::TransformContext;
use crate::transforms::expr_transform::transform_expr;
use crate::transforms::call_transform::transform_call;
use crate::transforms::block_transform::{transform_block, transform_body};
use crate::transforms::postfix_utils::extract_postfix;

fn resolve_type(s: &str) -> AslType {
    match s {
        "int" => AslType::Int,
        "float" => AslType::Float,
        "bool" => AslType::Bool,
        "String" | "string" => AslType::String,
        "void" => AslType::Void,
        _ => AslType::Struct,
    }
}

/// Transforma um `ProgramNode` completo em `AslProgram`
pub fn program_to_asl(program: &ProgramNode, ctx: &mut TransformContext) -> AslProgram {
    let globals: Vec<AslGlobalVar> = program.globals.iter()
        .map(|v| transform_var_decl(v, ctx))
        .collect();

    let functions: Vec<AslFunction> = program.functions.iter()
        .map(|f| transform_function(f, ctx))
        .collect();

    // O programa principal (setup + loop ou main) torna-se a task "main"
    let main_body: Vec<AslStatement> = program.body.iter()
        .flat_map(|s| transform_statement(s, ctx))
        .collect();

    let main_task = AslTask {
        name: "main".to_string(),
        body: main_body,
    };

    AslProgram {
        asl_version: "4.0.0".to_string(),
        tasks: vec![main_task],
        globals,
        functions,
        ..Default::default()
    }
}

/// Transforma um `StatementNode` em zero ou mais `AslStatement`
pub fn transform_statement(node: &StatementNode, ctx: &mut TransformContext) -> Vec<AslStatement> {
    match &node.kind {

        // ── Declaração de variável ────────────────────────────────────────────
        StatementKind::VarDecl(crate::types::typed_nodes::VarDeclNode { name, var_type, value, is_const: _ }) => {
            let asl_type = resolve_type(var_type.as_deref().unwrap_or("int"));
            let init     = value.as_ref().map(|v| transform_expr(v, ctx));
            vec![AslStatement::Declare(AslDeclare {
                name: name.clone(),
                r#type: asl_type,
                value: init,
            })]
        }

        // ── Atribuição ────────────────────────────────────────────────────────
        StatementKind::Assign { target, value } => {
            let val = transform_expr(value, ctx);
            // Extrair postfix side-effects do target se necessário
            vec![AslStatement::Assign(AslAssign {
                target: target.clone(),
                value: val,
            })]
        }

        // ── Chamada de função / hardware ──────────────────────────────────────
        StatementKind::Call(call_node) => {
            if let Some(stmt) = transform_call(call_node, ctx) {
                vec![stmt]
            } else {
                vec![]
            }
        }

        // ── Expressão standalone (ex: i++, chamada sem retorno) ───────────────
        StatementKind::Expr(expr_node) => {
            let expr   = transform_expr(expr_node, ctx);
            let extracted = extract_postfix(expr.clone());
            let mut result = vec![];
            // Se é apenas um postfix standalone, converte em Assign
            if !extracted.post_stmts.is_empty() {
                result.extend(extracted.post_stmts);
            } else {
                result.push(AslStatement::Expr(AslExpressionStmt { expr }));
            }
            result
        }

        // ── Blocos de controlo de fluxo ───────────────────────────────────────
        StatementKind::Block(block_node) => {
            transform_block(block_node, ctx)
        }

        // ── Return ────────────────────────────────────────────────────────────
        StatementKind::Return(expr) => {
            let value = expr.as_ref().map(|e| transform_expr(e, ctx));
            vec![AslStatement::Return(AslReturn { value })]
        }

        // ── Break / Continue ─────────────────────────────────────────────────
        StatementKind::Break    => vec![AslStatement::Break],
        StatementKind::Continue => vec![AslStatement::Continue],

        // ── Comentário (preservado como metadata) ────────────────────────────
        StatementKind::Comment(text) => {
            vec![AslStatement::Comment(AslComment{text: text.clone()})]
        }
    }
}

fn transform_var_decl(v: &crate::types::typed_nodes::VarDeclNode, ctx: &mut TransformContext) -> AslGlobalVar {
    let _ = ctx;
    AslGlobalVar {
        name: v.name.clone(),
        r#type: resolve_type(v.var_type.as_deref().unwrap_or("int")),
        initial_value: None,
        struct_type: None,
        comments: None,
    }
}

fn transform_function(f: &FunctionNode, ctx: &mut TransformContext) -> AslFunction {
    let params: Vec<AslParam> = f.params.iter().map(|p| AslParam {
        name: p.name.clone(),
        r#type: p.param_type.clone(),
    }).collect();

    let body: Vec<AslStatement> = f.body.iter()
        .flat_map(|s| transform_statement(s, ctx))
        .collect();

    AslFunction {
        name: f.name.clone(),
        params,
        return_type: f.return_type.as_ref().map(|t| resolve_type(t)),
        body,
    }
}
