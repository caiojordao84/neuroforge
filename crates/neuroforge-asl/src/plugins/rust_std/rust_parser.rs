//! Parser Rust via tree-sitter-rust
//!
//! Mapeamento node.kind() → NodeType:
//!   "source_file"           → raiz (ProgramNode)
//!   "function_item"         → Function
//!   "if_expression"         → IfStatement
//!   "while_expression"      → WhileLoop
//!   "loop_expression"       → WhileLoop (cond = "true")
//!   "for_expression"        → ForIn
//!   "match_expression"      → SwitchStatement
//!   "return_expression"     → Return
//!   "break_expression"      → Break
//!   "continue_expression"   → Continue
//!   "let_declaration"       → VarDeclaration
//!   "assignment_expression" → Assignment
//!   "compound_assignment_expr" → Assignment (+=, etc.)
//!   "call_expression" (callee):
//!     "gpio_set"           → GpioSet
//!     "gpio_get"           → GpioRead
//!     "gpio_mode"          → PinMode
//!     "delay_ms"           → DelayMs
//!     "delay_us"           → DelayUs
//!     "millis"             → Millis
//!     "serial_begin"       → SerialBegin
//!     "serial_print"       → Print
//!     "serial_println"     → PrintLn
//!     "serial_read"        → UartRead
//!     "i2c_write"          → I2cWrite
//!     "i2c_read"           → I2cRead
//!     "spi_transfer"       → SpiTransfer
//!     "pwm_init"           → PwmInit
//!     "pwm_set_duty"       → PwmSetDuty
//!     "pwm_set_freq"       → PwmSetFreq
//!     "pwm_stop"           → PwmStop
//!     else                 → FunctionCall

use tree_sitter::{Node, Parser, Tree};
use crate::types::nodes::{
    BaseNode, NodeType, ProgramNode, FunctionNode, ParamNode,
};

#[derive(Debug, thiserror::Error)]
pub enum RustParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),
    #[error("tree-sitter: parse devolveu None")]
    ParseFailed,
    #[error("tree-sitter: erro sintático em {0}:{1}")]
    SyntaxError(usize, usize),
}

pub struct RustParser;

impl RustParser {
    pub fn parse(source: &str) -> Result<ProgramNode, RustParseError> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_rust::LANGUAGE.into())
            .map_err(|e| RustParseError::LanguageError(e.to_string()))?;
        let tree: Tree = parser.parse(source, None).ok_or(RustParseError::ParseFailed)?;
        let root = tree.root_node();
        if root.has_error() {
            let pos = root.start_position();
            return Err(RustParseError::SyntaxError(pos.row + 1, pos.column + 1));
        }
        let mut visitor = RustVisitor::new(source);
        visitor.visit_source_file(root)
    }
}

struct RustVisitor<'src> { source: &'src str }

impl<'src> RustVisitor<'src> {
    fn new(source: &'src str) -> Self { Self { source } }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_source_file(&mut self, root: Node) -> Result<ProgramNode, RustParseError> {
        let mut functions = vec![];
        let mut globals: Vec<BaseNode> = vec![];
        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_item" => functions.push(self.visit_function(child)),
                "const_item" | "static_item" | "let_declaration" => globals.push(self.visit_let(child)),
                _ => {}
            }
        }
        Ok(ProgramNode { node_type: NodeType::Program, functions, globals, imports: vec![] })
    }

    fn visit_function(&mut self, node: Node) -> FunctionNode {
        let name        = node.child_by_field_name("name").map(|n| self.text(n).to_string()).unwrap_or_default();
        let return_type = node.child_by_field_name("return_type").map(|t| self.text(t).to_string()).unwrap_or_else(|| "()".to_string());
        let params      = node.child_by_field_name("parameters").map(|p| self.visit_params(p)).unwrap_or_default();
        let body        = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        FunctionNode {
            node_type: NodeType::Function,
            name, return_type, params, body,
            start_line: node.start_position().row + 1,
            end_line:   node.end_position().row + 1,
        }
    }

    fn visit_params(&self, node: Node) -> Vec<ParamNode> {
        let mut params = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "parameter" {
                let name      = child.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();
                let type_name = child.child_by_field_name("type").map(|t| self.text(t).to_string()).unwrap_or_default();
                if !matches!(name.as_str(), "self" | "&self" | "&mut self") {
                    params.push(ParamNode { node_type: NodeType::Param, name, param_type: type_name });
                }
            }
        }
        params
    }

    fn visit_block(&mut self, node: Node) -> Vec<BaseNode> {
        let mut stmts = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if let Some(s) = self.visit_statement(child) { stmts.push(s); }
        }
        stmts
    }

    fn visit_statement(&mut self, node: Node) -> Option<BaseNode> {
        match node.kind() {
            "expression_statement"     => { let inner = node.named_child(0)?; self.visit_expr_node(inner) }
            "let_declaration"          => Some(self.visit_let(node)),
            "if_expression"            => Some(self.visit_if(node)),
            "while_expression"         => Some(self.visit_while(node)),
            "loop_expression"          => Some(self.visit_loop(node)),
            "for_expression"           => Some(self.visit_for(node)),
            "match_expression"         => Some(self.visit_match(node)),
            "return_expression"        => Some(self.visit_return(node)),
            "break_expression"         => Some(BaseNode::leaf(NodeType::Break)),
            "continue_expression"      => Some(BaseNode::leaf(NodeType::Continue)),
            "assignment_expression"    => Some(self.visit_assignment(node)),
            "compound_assignment_expr" => Some(self.visit_assignment(node)),
            _                          => None,
        }
    }

    fn visit_expr_node(&mut self, node: Node) -> Option<BaseNode> {
        match node.kind() {
            "call_expression"          => Some(self.visit_call(node)),
            "assignment_expression"    => Some(self.visit_assignment(node)),
            "compound_assignment_expr" => Some(self.visit_assignment(node)),
            "macro_invocation"         => Some(self.visit_macro(node)),
            _                          => Some(BaseNode::raw(self.text(node))),
        }
    }

    fn visit_call(&mut self, node: Node) -> BaseNode {
        // Extrair callee como String owned ANTES de chamar collect_args,
        // para evitar E0500 (dois borrows de &self em closures encadeadas).
        let callee: String = node
            .child_by_field_name("function")
            .map(|f| self.text(f).to_string())
            .unwrap_or_default();

        let args = node
            .child_by_field_name("arguments")
            .map(|a| self.collect_args(a))
            .unwrap_or_default();

        let line = node.start_position().row + 1;

        match callee.as_str() {
            "gpio_set"       => BaseNode::hw(NodeType::GpioSet,     args, line),
            "gpio_get"       => BaseNode::hw(NodeType::GpioRead,    args, line),
            "gpio_mode"      => BaseNode::hw(NodeType::PinMode,     args, line),
            "analog_write"   => BaseNode::hw(NodeType::AnalogWrite, args, line),
            "analog_read"    => BaseNode::hw(NodeType::AnalogRead,  args, line),
            "delay_ms"       => BaseNode::hw(NodeType::DelayMs,     args, line),
            "delay_us"       => BaseNode::hw(NodeType::DelayUs,     args, line),
            "millis"         => BaseNode::hw(NodeType::Millis,      args, line),
            "micros"         => BaseNode::hw(NodeType::Micros,      args, line),
            "serial_begin"   => BaseNode::hw(NodeType::SerialBegin, args, line),
            "serial_print"   => BaseNode::hw(NodeType::Print,       args, line),
            "serial_println" => BaseNode::hw(NodeType::PrintLn,     args, line),
            "serial_read"    => BaseNode::hw(NodeType::UartRead,    args, line),
            "i2c_write"      => BaseNode::hw(NodeType::I2cWrite,    args, line),
            "i2c_read"       => BaseNode::hw(NodeType::I2cRead,     args, line),
            "spi_transfer"   => BaseNode::hw(NodeType::SpiTransfer, args, line),
            "pwm_init"       => BaseNode::hw(NodeType::PwmInit,     args, line),
            "pwm_set_duty"   => BaseNode::hw(NodeType::PwmSetDuty,  args, line),
            "pwm_set_freq"   => BaseNode::hw(NodeType::PwmSetFreq,  args, line),
            "pwm_stop"       => BaseNode::hw(NodeType::PwmStop,     args, line),
            _                => BaseNode::call(&callee, args, line),
        }
    }

    fn visit_macro(&mut self, node: Node) -> BaseNode {
        let name = node.child_by_field_name("macro").map(|n| self.text(n)).unwrap_or("");
        match name {
            "println" => {
                let args = node.child_by_field_name("token_tree")
                    .map(|t| vec![BaseNode::raw(self.text(t))])
                    .unwrap_or_default();
                BaseNode::hw(NodeType::PrintLn, args, node.start_position().row + 1)
            }
            "print" => {
                let args = node.child_by_field_name("token_tree")
                    .map(|t| vec![BaseNode::raw(self.text(t))])
                    .unwrap_or_default();
                BaseNode::hw(NodeType::Print, args, node.start_position().row + 1)
            }
            _ => BaseNode::raw(self.text(node)),
        }
    }

    fn collect_args(&mut self, node: Node) -> Vec<BaseNode> {
        let mut args = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if !matches!(child.kind(), "," | "(" | ")") && child.is_named() {
                args.push(BaseNode::raw(self.text(child)));
            }
        }
        args
    }

    fn visit_let(&mut self, node: Node) -> BaseNode {
        let name  = node.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();
        let type_ = node.child_by_field_name("type").map(|t| self.text(t).to_string());
        let value = node.child_by_field_name("value").map(|v| self.text(v).to_string());
        BaseNode::var_decl(type_.unwrap_or_default(), name, value, node.start_position().row + 1)
    }

    fn visit_assignment(&mut self, node: Node) -> BaseNode {
        let left  = node.child_by_field_name("left").map(|n| self.text(n).to_string()).unwrap_or_default();
        let right = node.child_by_field_name("right").map(|n| self.text(n).to_string()).unwrap_or_default();
        let op    = node.child_by_field_name("operator").map(|n| self.text(n).to_string()).unwrap_or_else(|| "=".to_string());
        BaseNode::assignment(left, op, right, node.start_position().row + 1)
    }

    fn visit_if(&mut self, node: Node) -> BaseNode {
        let cond      = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let then_body = node.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();
        let else_body = node.child_by_field_name("alternative").map(|b| self.visit_block(b));
        BaseNode::if_stmt(cond, then_body, else_body, node.start_position().row + 1)
    }

    fn visit_while(&mut self, node: Node) -> BaseNode {
        let cond = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::while_loop(cond, body, node.start_position().row + 1)
    }

    fn visit_loop(&mut self, node: Node) -> BaseNode {
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::while_loop("true".to_string(), body, node.start_position().row + 1)
    }

    fn visit_for(&mut self, node: Node) -> BaseNode {
        let pattern  = node.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();
        let iterable = node.child_by_field_name("value").map(|n| self.text(n).to_string()).unwrap_or_default();
        let body     = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::for_in(pattern, iterable, body, node.start_position().row + 1)
    }

    fn visit_match(&mut self, node: Node) -> BaseNode {
        let value = node.child_by_field_name("value").map(|v| self.text(v).to_string()).unwrap_or_default();
        let mut cases = vec![];
        if let Some(body) = node.child_by_field_name("body") {
            let mut cursor = body.walk();
            for child in body.children(&mut cursor) {
                if child.kind() == "match_arm" {
                    let pat      = child.child_by_field_name("pattern").map(|p| self.text(p).to_string());
                    let arm_body = child.child_by_field_name("value")
                        .map(|b| if b.kind() == "block" { self.visit_block(b) } else { vec![BaseNode::raw(self.text(b))] })
                        .unwrap_or_default();
                    cases.push(BaseNode::case(pat, arm_body, child.start_position().row + 1));
                }
            }
        }
        BaseNode::switch(value, cases, node.start_position().row + 1)
    }

    fn visit_return(&mut self, node: Node) -> BaseNode {
        let value = node.named_child(0).map(|v| self.text(v).to_string());
        BaseNode::return_stmt(value, node.start_position().row + 1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rust_blink() {
        let src = r#"
fn main() {
    gpio_mode(13, 1);
    loop {
        gpio_set(13, 1);
        delay_ms(500);
        gpio_set(13, 0);
        delay_ms(500);
    }
}
"#;
        let prog = RustParser::parse(src).expect("parse falhou");
        assert!(prog.functions.iter().any(|f| f.name == "main"));
    }
}
