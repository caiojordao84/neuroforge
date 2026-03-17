//! Parser Structured Text (IEC 61131-3) via crate `iec61131` v0.7
//!
//! Mapeamento (API real do iec61131 v0.7.0):
//!   Program / FunctionBlock / Function → AslFunction
//!   IF / ELSIF / ELSE                  → AslStatement::If
//!   FOR / TO / BY / DO                 → AslStatement::For
//!   WHILE                              → AslStatement::While
//!   REPEAT / UNTIL                     → AslStatement::DoWhile
//!   CASE                               → AslStatement::Switch
//!   RETURN                             → AslStatement::Return
//!   EXIT                               → AslStatement::Break
//!   Assignment (:=)                    → AslStatement::Assign
//!   FunctionCall                       → AslStatement::Expr

use crate::types::asl_types::{
    AslProgram, AslFunction, AslParam, AslStatement, AslExpr, AslMetadata,
    AslIf, AslWhile, AslDoWhile, AslFor, AslSwitch, AslSwitchCase,
    AslAssign, AslReturn, AslExpressionStmt, AslType,
};
use iec61131::{
    generated::ast::{
        Item, ProgramDecl, FunctionBlockDecl, FunctionDecl,
        Statement, Expression, CaseItem, VarDecl, TypeSpec,
    },
    parser::parse,
};

#[derive(Debug, thiserror::Error)]
pub enum StParseError {
    #[error("iec61131: erro de parse: {0}")]
    ParseError(String),
    #[error("iec61131: source vazia")]
    EmptySource,
}

pub struct StParser;

impl StParser {
    pub fn parse(source: &str) -> Result<AslProgram, StParseError> {
        if source.trim().is_empty() {
            return Err(StParseError::EmptySource);
        }

        let items = parse(source)
            .map_err(|e| StParseError::ParseError(format!("{:?}", e)))?;

        let mut visitor = StVisitor;
        Ok(visitor.visit_items(items))
    }
}

struct StVisitor;

impl StVisitor {
    fn visit_items(&mut self, items: Vec<Item>) -> AslProgram {
        let mut functions = vec![];
        let mut globals = vec![];

        for item in items {
            match item {
                Item::Program(prog) => functions.push(self.visit_program(prog)),
                Item::FunctionBlock(fb) => functions.push(self.visit_fb(fb)),
                Item::Function(func) => functions.push(self.visit_function(func)),
                Item::GlobalVarDecl(gvl) => {
                    for var in gvl.vars {
                        globals.push(crate::types::asl_types::AslGlobalVar {
                            name: var.name.clone(),
                            r#type: AslType::Int,
                            initial_value: None,
                            struct_type: None,
                            comments: None,
                        });
                    }
                }
                _ => {}
            }
        }

        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: None,
                description: None,
                version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![],
            globals,
            functions,
            tasks: vec![],
        }
    }

    fn typespec_name(ts: &TypeSpec) -> String {
        format!("{:?}", ts)
    }

    fn visit_var_decls(vars: &[VarDecl]) -> Vec<AslParam> {
        vars.iter().map(|v| AslParam {
            name: v.name.clone(),
            r#type: Self::typespec_name(&v.ty),
        }).collect()
    }

    fn visit_program(&mut self, prog: ProgramDecl) -> AslFunction {
        let body = prog.body.into_iter()
            .flat_map(|s| self.visit_statement(s))
            .collect();
        AslFunction {
            name: prog.name,
            return_type: None,
            params: Self::visit_var_decls(&prog.vars),
            body,
        }
    }

    fn visit_fb(&mut self, fb: FunctionBlockDecl) -> AslFunction {
        // FunctionBlockDecl has var sections as fields
        let mut params = vec![];
        params.extend(Self::visit_var_decls(&fb.inputs));
        params.extend(Self::visit_var_decls(&fb.outputs));
        let body = fb.body.into_iter()
            .flat_map(|s| self.visit_statement(s))
            .collect();
        AslFunction {
            name: fb.name,
            return_type: None,
            params,
            body,
        }
    }

    fn visit_function(&mut self, func: FunctionDecl) -> AslFunction {
        let ret = func.return_type.as_ref().map(|t| Self::typespec_name(t));
        let mut params = vec![];
        params.extend(Self::visit_var_decls(&func.inputs));
        params.extend(Self::visit_var_decls(&func.outputs));
        params.extend(Self::visit_var_decls(&func.in_outs));
        let body = func.body.into_iter()
            .flat_map(|s| self.visit_statement(s))
            .collect();
        AslFunction {
            name: func.name,
            return_type: ret,
            params,
            body,
        }
    }

    fn expr_to_string(e: &Expression) -> String {
        format!("{:?}", e)
    }

    fn visit_statement(&mut self, stmt: Statement) -> Vec<AslStatement> {
        match stmt {
            Statement::Assignment { target, value, .. } => {
                vec![AslStatement::Assign(AslAssign {
                    target: Self::expr_to_string(&target),
                    value: AslExpr::var(&Self::expr_to_string(&value)),
                })]
            }
            Statement::If { condition, then_body, elsif_parts, else_body, .. } => {
                let cond_expr = AslExpr::var(&Self::expr_to_string(&condition));
                let then_branch: Vec<AslStatement> = then_body.into_iter()
                    .flat_map(|s| self.visit_statement(s)).collect();
                // elsif_parts como else encadeado
                let else_branch: Option<Vec<AslStatement>> = if !elsif_parts.is_empty() {
                    let mut chain: Vec<AslStatement> = elsif_parts.into_iter().map(|(cond, body)| {
                        let body_stmts: Vec<AslStatement> = body.into_iter()
                            .flat_map(|s| self.visit_statement(s)).collect();
                        AslStatement::If(Box::new(AslIf {
                            condition: AslExpr::var(&Self::expr_to_string(&cond)),
                            then_branch: body_stmts,
                            else_branch: None,
                        }))
                    }).collect();
                    if let Some(eb) = else_body {
                        let eb_stmts: Vec<AslStatement> = eb.into_iter()
                            .flat_map(|s| self.visit_statement(s)).collect();
                        chain.extend(eb_stmts);
                    }
                    Some(chain)
                } else if let Some(eb) = else_body {
                    let eb_stmts: Vec<AslStatement> = eb.into_iter()
                        .flat_map(|s| self.visit_statement(s)).collect();
                    if eb_stmts.is_empty() { None } else { Some(eb_stmts) }
                } else {
                    None
                };
                vec![AslStatement::If(Box::new(AslIf { condition: cond_expr, then_branch, else_branch }))]
            }
            Statement::For { control_var, start, end, step, body, .. } => {
                let init_str = format!("{} := {}", control_var, Self::expr_to_string(&start));
                let cond_str = format!("{} <= {}", control_var, Self::expr_to_string(&end));
                let upd_str  = step.as_ref()
                    .map(|s| format!("{} := {} + {}", control_var, control_var, Self::expr_to_string(s)))
                    .unwrap_or_else(|| format!("{} := {} + 1", control_var, control_var));
                let body_stmts: Vec<AslStatement> = body.into_iter()
                    .flat_map(|s| self.visit_statement(s)).collect();
                let mut init_stmts = vec![
                    AslStatement::Assign(AslAssign {
                        target: control_var.clone(),
                        value: AslExpr::var(&Self::expr_to_string(&start)),
                    })
                ];
                // Represent as While with manual update
                let mut while_body = body_stmts;
                while_body.push(AslStatement::Assign(AslAssign {
                    target: control_var.clone(),
                    value: AslExpr::var(&upd_str),
                }));
                let mut result = init_stmts;
                result.push(AslStatement::While(Box::new(AslWhile {
                    condition: AslExpr::var(&cond_str),
                    body: while_body,
                })));
                result
            }
            Statement::While { condition, body, .. } => {
                let cond_expr = AslExpr::var(&Self::expr_to_string(&condition));
                let body_stmts: Vec<AslStatement> = body.into_iter()
                    .flat_map(|s| self.visit_statement(s)).collect();
                vec![AslStatement::While(Box::new(AslWhile { condition: cond_expr, body: body_stmts }))]
            }
            Statement::Repeat { body, condition, .. } => {
                let cond_expr = AslExpr::var(&Self::expr_to_string(&condition));
                let body_stmts: Vec<AslStatement> = body.into_iter()
                    .flat_map(|s| self.visit_statement(s)).collect();
                vec![AslStatement::DoWhile(Box::new(AslDoWhile { condition: cond_expr, body: body_stmts }))]
            }
            Statement::Case { selector, cases, else_body, .. } => {
                let discriminant = AslExpr::var(&Self::expr_to_string(&selector));
                let mut case_list: Vec<AslSwitchCase> = cases.into_iter().map(|ci: CaseItem| {
                    let body: Vec<AslStatement> = ci.body.into_iter()
                        .flat_map(|s| self.visit_statement(s)).collect();
                    let test = ci.values.first().map(|v| AslExpr::var(&format!("{:?}", v)));
                    AslSwitchCase { test, body }
                }).collect();
                if let Some(eb) = else_body {
                    let eb_stmts: Vec<AslStatement> = eb.into_iter()
                        .flat_map(|s| self.visit_statement(s)).collect();
                    case_list.push(AslSwitchCase { test: None, body: eb_stmts });
                }
                vec![AslStatement::Switch(Box::new(AslSwitch { discriminant, cases: case_list }))]
            }
            Statement::Return { .. } =>
                vec![AslStatement::Return(AslReturn { value: None })],
            Statement::Exit { .. } =>
                vec![AslStatement::Break],
            Statement::FunctionCall { name, arguments, .. } => {
                let args: Vec<AslExpr> = arguments.into_iter()
                    .map(|a| AslExpr::var(&format!("{:?}", a)))
                    .collect();
                vec![AslStatement::Expr(AslExpressionStmt {
                    expr: AslExpr::Call(Box::new(crate::types::asl_types::AslCall {
                        callee: name,
                        args,
                    })),
                })]
            }
            _ => vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_st_program() {
        let src = r#"
PROGRAM Main
  VAR
    Motor : BOOL := FALSE;
  END_VAR
  IF Motor THEN
    Motor := FALSE;
  END_IF;
END_PROGRAM
"#;
        let prog = StParser::parse(src).expect("parse falhou");
        assert!(!prog.functions.is_empty());
        let main = prog.functions.iter().find(|f| f.name == "Main");
        assert!(main.is_some());
    }
}
