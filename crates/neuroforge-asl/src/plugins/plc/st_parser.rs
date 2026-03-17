//! Parser Structured Text (IEC 61131-3) via crate `iec61131`
//!
//! O crate `iec61131` entrega um AST IEC 61131-3 completo (OOP, FB, Program, Function).
//! Este módulo converte esse AST para o ProgramNode interno do NeuroForge.
//!
//! Mapeamento:
//!   Program / Function_Block → Function
//!   IF / ELSIF / ELSE        → IfStatement
//!   FOR / TO / BY / DO       → ForLoop
//!   WHILE / DO               → WhileLoop
//!   REPEAT / UNTIL           → DoWhile
//!   CASE                     → SwitchStatement
//!   RETURN                   → Return
//!   EXIT                     → Break
//!   Assignment (:=)          → Assignment
//!   FB call (TON, CTU, etc.) → FunctionCall (mapeado para tipo ASL IEC)

use iec61131::parse;
use crate::types::nodes::{
    BaseNode, NodeType, ProgramNode, FunctionNode, ParamNode,
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
    pub fn parse(source: &str) -> Result<ProgramNode, StParseError> {
        if source.trim().is_empty() {
            return Err(StParseError::EmptySource);
        }

        let ast = parse(source)
            .map_err(|e| StParseError::ParseError(format!("{:?}", e)))?;

        let mut visitor = StVisitor;
        Ok(visitor.visit_root(ast))
    }
}

struct StVisitor;

impl StVisitor {
    fn visit_root(&mut self, ast: iec61131::Ast) -> ProgramNode {
        let mut functions = vec![];
        let mut globals: Vec<BaseNode> = vec![];

        for item in ast.items {
            match item {
                iec61131::Item::Program(prog) => {
                    functions.push(self.visit_program_block(prog));
                }
                iec61131::Item::FunctionBlock(fb) => {
                    functions.push(self.visit_fb_block(fb));
                }
                iec61131::Item::Function(func) => {
                    functions.push(self.visit_function_block(func));
                }
                iec61131::Item::GlobalVarDecl(gvl) => {
                    for var in gvl.vars {
                        globals.push(BaseNode::var_decl(
                            var.var_type.to_string(),
                            var.name,
                            var.initial_value.map(|v| format!("{:?}", v)),
                            0,
                        ));
                    }
                }
                _ => {}
            }
        }

        ProgramNode {
            node_type: NodeType::Program,
            functions,
            globals,
            imports: vec![],
        }
    }

    fn visit_program_block(&mut self, prog: iec61131::ProgramDecl) -> FunctionNode {
        FunctionNode {
            node_type: NodeType::Function,
            name: prog.name,
            return_type: "VOID".to_string(),
            params: prog.var_input.into_iter().map(|v| ParamNode {
                node_type: NodeType::Param,
                name: v.name,
                param_type: v.var_type.to_string(),
            }).collect(),
            body: prog.body.into_iter()
                .filter_map(|s| self.visit_statement(s))
                .collect(),
            start_line: 0,
            end_line: 0,
        }
    }

    fn visit_fb_block(&mut self, fb: iec61131::FunctionBlockDecl) -> FunctionNode {
        FunctionNode {
            node_type: NodeType::Function,
            name: fb.name,
            return_type: "VOID".to_string(),
            params: fb.var_input.into_iter().map(|v| ParamNode {
                node_type: NodeType::Param,
                name: v.name,
                param_type: v.var_type.to_string(),
            }).collect(),
            body: fb.body.into_iter()
                .filter_map(|s| self.visit_statement(s))
                .collect(),
            start_line: 0,
            end_line: 0,
        }
    }

    fn visit_function_block(&mut self, func: iec61131::FunctionDecl) -> FunctionNode {
        let ret = func.return_type.map(|t| t.to_string()).unwrap_or_else(|| "VOID".to_string());
        FunctionNode {
            node_type: NodeType::Function,
            name: func.name,
            return_type: ret,
            params: func.var_input.into_iter().map(|v| ParamNode {
                node_type: NodeType::Param,
                name: v.name,
                param_type: v.var_type.to_string(),
            }).collect(),
            body: func.body.into_iter()
                .filter_map(|s| self.visit_statement(s))
                .collect(),
            start_line: 0,
            end_line: 0,
        }
    }

    fn visit_statement(&mut self, stmt: iec61131::Statement) -> Option<BaseNode> {
        use iec61131::Statement as S;
        match stmt {
            S::Assignment { variable, expression } => {
                Some(BaseNode::assignment(
                    format!("{:?}", variable),
                    ":=".to_string(),
                    format!("{:?}", expression),
                    0,
                ))
            }
            S::If { condition, then_stmts, elsif_stmts, else_stmts } => {
                let cond_str = format!("{:?}", condition);
                let then_body: Vec<BaseNode> = then_stmts.into_iter()
                    .filter_map(|s| self.visit_statement(s)).collect();
                let else_body: Option<Vec<BaseNode>> = if let Some(stmts) = else_stmts {
                    let body: Vec<BaseNode> = stmts.into_iter()
                        .filter_map(|s| self.visit_statement(s)).collect();
                    if body.is_empty() { None } else { Some(body) }
                } else if !elsif_stmts.is_empty() {
                    let body: Vec<BaseNode> = elsif_stmts.into_iter()
                        .filter_map(|(_, stmts)| {
                            Some(BaseNode::leaf(NodeType::IfStatement))
                        }).collect();
                    Some(body)
                } else {
                    None
                };
                Some(BaseNode::if_stmt(cond_str, then_body, else_body, 0))
            }
            S::For { variable, from, to, by, body } => {
                let init = format!("{} := {:?}", format!("{:?}", variable), from);
                let cond = format!("{} <= {:?}", format!("{:?}", variable), to);
                let upd  = format!("{} := {} + {:?}", format!("{:?}", variable), format!("{:?}", variable), by.unwrap_or(iec61131::Expression::Literal(iec61131::Literal::Int(1))));
                let stmts: Vec<BaseNode> = body.into_iter()
                    .filter_map(|s| self.visit_statement(s)).collect();
                Some(BaseNode::for_loop(init, cond, upd, stmts, 0))
            }
            S::While { condition, body } => {
                let cond = format!("{:?}", condition);
                let stmts: Vec<BaseNode> = body.into_iter()
                    .filter_map(|s| self.visit_statement(s)).collect();
                Some(BaseNode::while_loop(cond, stmts, 0))
            }
            S::Repeat { body, condition } => {
                let cond = format!("{:?}", condition);
                let stmts: Vec<BaseNode> = body.into_iter()
                    .filter_map(|s| self.visit_statement(s)).collect();
                Some(BaseNode::do_while(stmts, cond, 0))
            }
            S::Case { expression, cases, else_stmts } => {
                let val = format!("{:?}", expression);
                let mut case_nodes: Vec<BaseNode> = cases.into_iter().map(|(vals, stmts)| {
                    let body: Vec<BaseNode> = stmts.into_iter()
                        .filter_map(|s| self.visit_statement(s)).collect();
                    let case_val = vals.first().map(|v| format!("{:?}", v));
                    BaseNode::case(case_val, body, 0)
                }).collect();
                if let Some(stmts) = else_stmts {
                    let else_body: Vec<BaseNode> = stmts.into_iter()
                        .filter_map(|s| self.visit_statement(s)).collect();
                    case_nodes.push(BaseNode::case(None, else_body, 0));
                }
                Some(BaseNode::switch(val, case_nodes, 0))
            }
            S::Return => Some(BaseNode::return_stmt(None, 0)),
            S::Exit   => Some(BaseNode::leaf(NodeType::Break)),
            S::FunctionCall { name, params } => {
                let args: Vec<BaseNode> = params.into_iter()
                    .map(|p| BaseNode::raw(format!("{:?}", p)))
                    .collect();
                let node_type = Self::map_fb_call(&name);
                Some(BaseNode::hw(node_type, args, 0))
            }
            _ => None,
        }
    }

    fn map_fb_call(name: &str) -> NodeType {
        match name.to_uppercase().as_str() {
            "TON"  => NodeType::TimerTON,
            "TOF"  => NodeType::TimerTOF,
            "TP"   => NodeType::TimerTP,
            "CTU"  => NodeType::CounterCTU,
            "CTD"  => NodeType::CounterCTD,
            "SR"   => NodeType::LatchSR,
            "RS"   => NodeType::LatchRS,
            "R_TRIG" => NodeType::TrigR,
            "F_TRIG" => NodeType::TrigF,
            _ => NodeType::FunctionCall,
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
  VAR_INPUT
    Start : BOOL;
  END_VAR
  VAR
    Motor : BOOL := FALSE;
  END_VAR
  IF Start THEN
    Motor := TRUE;
  END_IF;
END_PROGRAM
"#;
        let prog = StParser::parse(src).expect("parse falhou");
        assert!(!prog.functions.is_empty());
        let main = prog.functions.iter().find(|f| f.name == "Main");
        assert!(main.is_some());
    }
}
