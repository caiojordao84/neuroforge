//! Parser Structured Text (IEC 61131-3) via crate `iec61131` v0.7
//!
//! Campos reais confirmados pelo compilador:
//!   ProgramDecl        { name, vars: Vec<VarDecl>, body: Vec<Statement>, span }
//!   FunctionBlockDecl  { name, extends, implements, is_final, is_abstract, ... body: Option<Vec<Statement>> }
//!   FunctionDecl       { name, return_type, inputs, outputs, in_outs, body, ... }
//!   Statement::Assignment { target: Variable, value: Expression }
//!   CaseItem           { selectors, body }  (NÃO .values)

#![allow(unused_imports)]

use crate::types::asl_types::{
    AslProgram, AslFunction, AslParam, AslStatement, AslExpr, AslMetadata,
    AslIf, AslWhile, AslDoWhile, AslSwitch, AslSwitchCase,
    AslAssign, AslReturn, AslExpressionStmt, AslType, AslCall,
};
use iec61131::{
    Parser as IecParser,
    PouDeclaration,
    Statement,
    Expression,
    TypeSpec,
    VarDecl,
    Argument,
    StatementList,
    Variable,
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
        let mut parser = IecParser::new(source);
        let cu = parser.parse()
            .map_err(|e| StParseError::ParseError(e.to_string()))?;
        let mut visitor = StVisitor;
        Ok(visitor.visit_declarations(cu.declarations))
    }
}

struct StVisitor;

impl StVisitor {
    fn visit_declarations(&mut self, decls: Vec<PouDeclaration>) -> AslProgram {
        let mut functions = vec![];
        for decl in decls {
            match decl {
                PouDeclaration::Program(prog)     => functions.push(self.visit_program(prog)),
                PouDeclaration::FunctionBlock(fb) => functions.push(self.visit_fb(fb)),
                PouDeclaration::Function(func)    => functions.push(self.visit_function(func)),
                _ => {}
            }
        }
        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: None, description: None, version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![],
            globals: vec![],
            functions,
            tasks: vec![],
        }
    }

    fn vars_to_params(vars: &[VarDecl]) -> Vec<AslParam> {
        vars.iter().map(|v| AslParam {
            name: v.name.clone(),
            r#type: format!("{:?}", v.var_type),
        }).collect()
    }

    fn visit_program(&mut self, prog: iec61131::ProgramDecl) -> AslFunction {
        let params = Self::vars_to_params(&prog.vars);
        let body   = self.visit_stmts(prog.body);
        AslFunction { name: prog.name, return_type: None, params, body }
    }

    fn visit_fb(&mut self, fb: iec61131::FunctionBlockDecl) -> AslFunction {
        let params: Vec<AslParam> = vec![];
        let body = self.visit_stmts(fb.body.unwrap_or_default());
        AslFunction { name: fb.name, return_type: None, params, body }
    }

    fn visit_function(&mut self, func: iec61131::FunctionDecl) -> AslFunction {
        let mut params = vec![];
        params.extend(Self::vars_to_params(&func.inputs));
        params.extend(Self::vars_to_params(&func.outputs));
        params.extend(Self::vars_to_params(&func.in_outs));
        let body = self.visit_stmts(func.body);
        let return_type = func.return_type.map(|_| AslType::Int);
        AslFunction { name: func.name, return_type, params, body }
    }

    fn visit_stmts(&mut self, stmts: StatementList) -> Vec<AslStatement> {
        stmts.into_iter().flat_map(|s| self.visit_stmt(s)).collect()
    }

    fn expr_str(e: &Expression) -> String { format!("{:?}", e) }
    fn var_str(v: &Variable)    -> String { format!("{:?}", v) }

    fn visit_stmt(&mut self, stmt: Statement) -> Vec<AslStatement> {
        match stmt {
            Statement::Assignment { target, value, .. } => {
                vec![AslStatement::Assign(AslAssign {
                    target: Self::var_str(&target),
                    value:  AslExpr::var(&Self::expr_str(&value)),
                })]
            }
            Statement::If { condition, then_body, elsif_parts, else_body, .. } => {
                let cond_expr   = AslExpr::var(&Self::expr_str(&condition));
                let then_branch = self.visit_stmts(then_body);

                let elsif_list: Vec<(Expression, StatementList)> = elsif_parts;
                let else_branch: Option<Vec<AslStatement>> = if !elsif_list.is_empty() {
                    let mut chain: Vec<AslStatement> = elsif_list
                        .into_iter()
                        .map(|(cond, body): (Expression, StatementList)| {
                            let body_stmts = self.visit_stmts(body);
                            AslStatement::If(Box::new(AslIf {
                                condition: AslExpr::var(&Self::expr_str(&cond)),
                                then_branch: body_stmts,
                                else_branch: None,
                            }))
                        })
                        .collect();
                    if let Some(eb) = else_body {
                        chain.extend(self.visit_stmts(eb));
                    }
                    Some(chain)
                } else if let Some(eb) = else_body {
                    let stmts = self.visit_stmts(eb);
                    if stmts.is_empty() { None } else { Some(stmts) }
                } else {
                    None
                };

                vec![AslStatement::If(Box::new(AslIf { condition: cond_expr, then_branch, else_branch }))]
            }
            Statement::For { control_var, start, end, step, body, .. } => {
                let start_str = Self::expr_str(&start);
                let end_str   = Self::expr_str(&end);
                let step_str  = step.as_ref().map(|s| Self::expr_str(s)).unwrap_or_else(|| "1".to_string());
                let cond_str  = format!("{} <= {}", control_var, end_str);
                let upd_str   = format!("{} := {} + {}", control_var, control_var, step_str);

                let mut body_stmts = self.visit_stmts(body);
                body_stmts.push(AslStatement::Assign(AslAssign {
                    target: control_var.clone(),
                    value:  AslExpr::var(&upd_str),
                }));

                vec![
                    AslStatement::Assign(AslAssign {
                        target: control_var,
                        value:  AslExpr::var(&start_str),
                    }),
                    AslStatement::While(Box::new(crate::types::asl_types::AslWhile {
                        condition: AslExpr::var(&cond_str),
                        body: body_stmts,
                    })),
                ]
            }
            Statement::While { condition, body, .. } => {
                let body_stmts = self.visit_stmts(body);
                vec![AslStatement::While(Box::new(crate::types::asl_types::AslWhile {
                    condition: AslExpr::var(&Self::expr_str(&condition)),
                    body: body_stmts,
                }))]
            }
            Statement::Repeat { body, condition, .. } => {
                let body_stmts = self.visit_stmts(body);
                vec![AslStatement::DoWhile(Box::new(AslDoWhile {
                    condition: AslExpr::var(&Self::expr_str(&condition)),
                    body: body_stmts,
                }))]
            }
            Statement::Case { selector, cases, else_body, .. } => {
                let discriminant = AslExpr::var(&Self::expr_str(&selector));
                // CaseItem: campos reais sao .selectors e .body
                let mut case_list: Vec<AslSwitchCase> = cases
                    .into_iter()
                    .map(|ci| {
                        let body_stmts = self.visit_stmts(ci.body);
                        let test = ci.selectors.first()
                            .map(|v| AslExpr::var(&format!("{:?}", v)));
                        AslSwitchCase { test, body: body_stmts }
                    })
                    .collect();
                if let Some(eb) = else_body {
                    let eb_stmts = self.visit_stmts(eb);
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
                    expr: AslExpr::Call(Box::new(AslCall { callee: name, args })),
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
        assert!(prog.functions.iter().any(|f| f.name == "Main"));
    }
}
