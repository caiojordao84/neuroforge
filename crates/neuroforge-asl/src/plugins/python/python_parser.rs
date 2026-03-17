//! Parser Python via tree-sitter-python
//!
//! Mapeamento node.kind() → NodeType (subset principal):
//!   "module"                   → raiz (ProgramNode)
//!   "function_definition"      → Function
//!   "if_statement"             → IfStatement
//!   "for_statement"            → ForIn
//!   "while_statement"          → WhileLoop
//!   "return_statement"         → Return
//!   "break_statement"          → Break
//!   "continue_statement"       → Continue
//!   "assignment"               → Assignment
//!   "augmented_assignment"     → Assignment (+=, -=, etc.)
//!   "expression_statement"     → delega a visit_expr
//!   "call" (callee):
//!     "machine.Pin(...).value" → GpioSet / GpioRead
//!     "machine.Pin"            → PinMode
//!     "utime.sleep_ms"         → DelayMs
//!     "utime.sleep_us"         → DelayUs
//!     "utime.ticks_ms"         → Millis
//!     "uart.write"             → UartWrite
//!     "uart.read"              → UartRead
//!     "i2c.writeto"            → I2cWrite
//!     "i2c.readfrom"           → I2cRead
//!     "spi.write"              → SpiTransfer
//!     "print"                  → Print
//!     else                     → FunctionCall

use tree_sitter::{Node, Parser, Tree};
use crate::types::nodes::{
    BaseNode, NodeType, ProgramNode, FunctionNode, ParamNode,
};

#[derive(Debug, thiserror::Error)]
pub enum PythonParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),
    #[error("tree-sitter: parse devolveu None")]
    ParseFailed,
    #[error("tree-sitter: erro sintático em {0}:{1}")]
    SyntaxError(usize, usize),
}

pub struct PythonParser;

impl PythonParser {
    pub fn parse(source: &str) -> Result<ProgramNode, PythonParseError> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_python::LANGUAGE.into())
            .map_err(|e| PythonParseError::LanguageError(e.to_string()))?;

        let tree: Tree = parser
            .parse(source, None)
            .ok_or(PythonParseError::ParseFailed)?;

        let root = tree.root_node();
        if root.has_error() {
            let pos = root.start_position();
            return Err(PythonParseError::SyntaxError(pos.row + 1, pos.column + 1));
        }

        let mut visitor = PythonVisitor::new(source);
        visitor.visit_module(root)
    }
}

struct PythonVisitor<'src> {
    source: &'src str,
}

impl<'src> PythonVisitor<'src> {
    fn new(source: &'src str) -> Self { Self { source } }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_module(&mut self, root: Node) -> Result<ProgramNode, PythonParseError> {
        let mut functions = vec![];
        let mut globals: Vec<BaseNode> = vec![];

        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_definition" => functions.push(self.visit_function(child)),
                "import_statement" | "import_from_statement" => {}
                "comment" => {}
                _ => {
                    if let Some(stmt) = self.visit_statement(child) {
                        globals.push(stmt);
                    }
                }
            }
        }

        Ok(ProgramNode {
            node_type: NodeType::Program,
            functions,
            globals,
            imports: vec![],
        })
    }

    fn visit_function(&mut self, node: Node) -> FunctionNode {
        let name = node
            .child_by_field_name("name")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let params = node
            .child_by_field_name("parameters")
            .map(|p| self.visit_params(p))
            .unwrap_or_default();

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        FunctionNode {
            node_type: NodeType::Function,
            name,
            return_type: "None".to_string(),
            params,
            body,
            start_line: node.start_position().row + 1,
            end_line: node.end_position().row + 1,
        }
    }

    fn visit_params(&self, node: Node) -> Vec<ParamNode> {
        let mut params = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "identifier" => {
                    let name = self.text(child).to_string();
                    if name != "self" {
                        params.push(ParamNode {
                            node_type: NodeType::Param,
                            name,
                            param_type: "Any".to_string(),
                        });
                    }
                }
                "typed_parameter" => {
                    let name = child.named_child(0).map(|n| self.text(n).to_string()).unwrap_or_default();
                    let type_name = child.child_by_field_name("type").map(|t| self.text(t).to_string()).unwrap_or_else(|| "Any".to_string());
                    params.push(ParamNode { node_type: NodeType::Param, name, param_type: type_name });
                }
                _ => {}
            }
        }
        params
    }

    fn visit_block(&mut self, node: Node) -> Vec<BaseNode> {
        let mut stmts = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if let Some(s) = self.visit_statement(child) {
                stmts.push(s);
            }
        }
        stmts
    }

    fn visit_statement(&mut self, node: Node) -> Option<BaseNode> {
        match node.kind() {
            "expression_statement" => {
                let inner = node.named_child(0)?;
                self.visit_expr(inner)
            }
            "if_statement"     => Some(self.visit_if(node)),
            "for_statement"    => Some(self.visit_for(node)),
            "while_statement"  => Some(self.visit_while(node)),
            "return_statement" => Some(self.visit_return(node)),
            "break_statement"  => Some(BaseNode::leaf(NodeType::Break)),
            "continue_statement" => Some(BaseNode::leaf(NodeType::Continue)),
            "assignment"       => Some(self.visit_assignment(node)),
            "augmented_assignment" => Some(self.visit_assignment(node)),
            "comment"          => None,
            _                  => None,
        }
    }

    fn visit_expr(&mut self, node: Node) -> Option<BaseNode> {
        match node.kind() {
            "call"       => Some(self.visit_call(node)),
            "assignment" => Some(self.visit_assignment(node)),
            _            => Some(BaseNode::raw(self.text(node))),
        }
    }

    fn visit_call(&mut self, node: Node) -> BaseNode {
        let func_text = node
            .child_by_field_name("function")
            .map(|f| self.text(f))
            .unwrap_or("");

        let args = node
            .child_by_field_name("arguments")
            .map(|a| self.collect_args(a))
            .unwrap_or_default();

        let line = node.start_position().row + 1;

        match func_text {
            "machine.Pin"           => BaseNode::hw(NodeType::PinMode,      args, line),
            "utime.sleep_ms" | "time.sleep_ms" => BaseNode::hw(NodeType::DelayMs, args, line),
            "utime.sleep_us" | "time.sleep_us" => BaseNode::hw(NodeType::DelayUs, args, line),
            "utime.ticks_ms" | "time.ticks_ms" => BaseNode::hw(NodeType::Millis,  args, line),
            "print"                 => BaseNode::hw(NodeType::Print,        args, line),
            "uart.write"            => BaseNode::hw(NodeType::UartWrite,    args, line),
            "uart.read"             => BaseNode::hw(NodeType::UartRead,     args, line),
            "uart.any"              => BaseNode::hw(NodeType::UartAvailable, args, line),
            "i2c.writeto"           => BaseNode::hw(NodeType::I2cWrite,     args, line),
            "i2c.readfrom"          => BaseNode::hw(NodeType::I2cRead,      args, line),
            "spi.write"             => BaseNode::hw(NodeType::SpiTransfer,  args, line),
            f if f.ends_with(".value") => BaseNode::hw(NodeType::GpioSet,  args, line),
            f if f.ends_with(".read_u16") => BaseNode::hw(NodeType::AnalogRead, args, line),
            _ => BaseNode::call(func_text, args, line),
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

    fn visit_assignment(&mut self, node: Node) -> BaseNode {
        let left  = node.child_by_field_name("left").map(|n| self.text(n).to_string()).unwrap_or_default();
        let right = node.child_by_field_name("right").map(|n| self.text(n).to_string()).unwrap_or_default();
        let op    = node.child_by_field_name("operator").map(|n| self.text(n).to_string()).unwrap_or_else(|| "=".to_string());
        BaseNode::assignment(left, op, right, node.start_position().row + 1)
    }

    fn visit_if(&mut self, node: Node) -> BaseNode {
        let cond = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let then_body = node.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();
        let else_body = node.child_by_field_name("alternative").map(|b| self.visit_block(b));
        BaseNode::if_stmt(cond, then_body, else_body, node.start_position().row + 1)
    }

    fn visit_for(&mut self, node: Node) -> BaseNode {
        let left  = node.child_by_field_name("left").map(|n| self.text(n).to_string()).unwrap_or_default();
        let right = node.child_by_field_name("right").map(|n| self.text(n).to_string()).unwrap_or_default();
        let body  = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::for_in(left, right, body, node.start_position().row + 1)
    }

    fn visit_while(&mut self, node: Node) -> BaseNode {
        let cond = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::while_loop(cond, body, node.start_position().row + 1)
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
    fn parse_micropython_blink() {
        let src = r#"
import machine
import utime

led = machine.Pin(25, machine.Pin.OUT)

def main():
    while True:
        led.value(1)
        utime.sleep_ms(500)
        led.value(0)
        utime.sleep_ms(500)
"#;
        let prog = PythonParser::parse(src).expect("parse falhou");
        let main_fn = prog.functions.iter().find(|f| f.name == "main");
        assert!(main_fn.is_some(), "deve ter função main");
    }
}
