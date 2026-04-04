//! statement_registry.rs     registry central de transforms de statements

//! Migrado de: src/engine/asl/transforms/statementRegistry.ts

//! Este    o m  dulo mais cr  tico da pipeline ProgramNode     AslProgram.



use crate::transforms::block_transform::transform_block;

use crate::transforms::call_transform::transform_call;

use crate::transforms::context::TransformContext;

use crate::transforms::expr_transform::transform_expr;

use crate::transforms::postfix_utils::extract_postfix;

use crate::types::asl_types::*;

use crate::types::typed_nodes::{FunctionNode, ProgramNode, StatementKind, StatementNode};



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

    let globals: Vec<AslGlobalVar> = program

        .globals

        .iter()

        .map(|v| transform_var_decl(v, ctx))

        .collect();



    let functions: Vec<AslFunction> = program

        .functions

        .iter()

        .map(|f| transform_function(f, ctx))

        .collect();



    let mut setup_body = vec![];

    let mut loop_body = vec![];

    let mut tasks = vec![];



    if !program.setup_body.is_empty() {

        let setup_stmts: Vec<AslStatement> = program.setup_body.iter().flat_map(|s| transform_statement(s, ctx)).collect();

        setup_body = setup_stmts.clone();

        tasks.push(AslTask {

            name: "setup".to_string(),

            body: setup_stmts, ..Default::default() });

    }



    if !program.loop_body.is_empty() {

        let loop_stmts: Vec<AslStatement> = program.loop_body.iter().flat_map(|s| transform_statement(s, ctx)).collect();

        loop_body = loop_stmts.clone();

        tasks.push(AslTask {

            name: "loop".to_string(),

            body: loop_stmts, ..Default::default() });

    }



    // Fallback: se ambos vazios e n  o h   fun    es (ex: scripts cursivos), tenta body se existisse...

    if tasks.is_empty() {

        tasks.push(AslTask { name: "main".to_string(), body: vec![] , ..Default::default() });

    }



    AslProgram {

        asl_version: "4.0.0".to_string(),

        metadata: AslMetadata {

            name: None,

            description: None,

            version: None,

            target_board: None,

        },

        globals,

        functions,

        tasks,

        setup_body,

        loop_body,

        ..Default::default()

    }

}



/// Transforma um `StatementNode` em zero ou mais `AslStatement`

pub fn transform_statement(node: &StatementNode, ctx: &mut TransformContext) -> Vec<AslStatement> {

    match &node.kind {

        //        Declara    o de vari  vel                                                                                                                                     

        StatementKind::VarDecl(crate::types::typed_nodes::VarDeclNode {

            name,

            var_type,

            value,

            is_const: _,

        }) => {

            let asl_type = resolve_type(var_type.as_deref().unwrap_or("int"));

            let init = value.as_ref().map(|v| transform_expr(v, ctx));

            vec![AslStatement::Declare(AslDeclare {

                name: name.clone(),

                r#type: asl_type,

                value: init,

            })]

        }



        //        Atribui    o                                                                                                                                                                         

        StatementKind::Assign { target, value } => {

            let val = transform_expr(value, ctx);

            // Extrair postfix side-effects do target se necess  rio

            vec![AslStatement::Assign(AslAssign {

                target: target.clone(),

                value: val,

            })]

        }



        //        Chamada de fun    o / hardware                                                                                                                   

        StatementKind::Call(call_node) => {

            if let Some(stmt) = transform_call(call_node, ctx) {

                vec![stmt]

            } else {

                vec![]

            }

        }



        //        Express  o standalone (ex: i++, chamada sem retorno)                                              

        StatementKind::Expr(expr_node) => {

            let expr = transform_expr(expr_node, ctx);

            let extracted = extract_postfix(expr.clone());

            let mut result = vec![];

            // Se    apenas um postfix standalone, converte em Assign

            if !extracted.post_stmts.is_empty() {

                result.extend(extracted.post_stmts);

            } else {

                result.push(AslStatement::Expr(AslExpressionStmt { expr }));

            }

            result

        }



        //        Blocos de controlo de fluxo                                                                                                                      

        StatementKind::Block(block_node) => transform_block(block_node, ctx),



        //        Return                                                                                                                                                                                     

        StatementKind::Return(expr) => {

            let value = expr.as_ref().map(|e| transform_expr(e, ctx));

            vec![AslStatement::Return(AslReturn { value })]

        }



        //        Break / Continue                                                                                                                                                    

        StatementKind::Break => vec![AslStatement::Break],

        StatementKind::Continue => vec![AslStatement::Continue],



        //        Coment  rio (preservado como metadata)                                                                                     

        StatementKind::Comment(text) => {

            vec![AslStatement::Comment(AslComment { text: text.clone() })]

        }

    }

}



fn transform_var_decl(

    v: &crate::types::typed_nodes::VarDeclNode,

    ctx: &mut TransformContext,

) -> AslGlobalVar {

    let value = v.value.as_ref().map(|e| {

        match transform_expr(e, ctx) {

            AslExpr::Literal(l) => l.value,

            _ => serde_json::Value::Null, ..Default::default() }

    });

    

    AslGlobalVar {

        name: v.name.clone(),

        r#type: resolve_type(v.var_type.as_deref().unwrap_or("int")),

        value,

        struct_type: None,

        comments: None, ..Default::default() }

}



fn transform_function(f: &FunctionNode, ctx: &mut TransformContext) -> AslFunction {

    let params: Vec<AslParam> = f

        .params

        .iter()

        .map(|p| AslParam {

            name: p.name.clone(),

            r#type: p.param_type.clone(), ..Default::default() })

        .collect();



    let body: Vec<AslStatement> = f

        .body

        .iter()

        .flat_map(|s| transform_statement(s, ctx))

        .collect();



    AslFunction {

        name: f.name.clone(),

        params,

        return_type: f.return_type.as_ref().map(|t| resolve_type(t)),

        body, ..Default::default() }

}













