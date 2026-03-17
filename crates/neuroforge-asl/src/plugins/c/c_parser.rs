//! Parser C/Arduino via tree-sitter-arduino (fallback: tree-sitter-cpp)
//!
//! Fluxo:
//!   source (&str)
//!     → tree_sitter::Parser::parse()  → Tree (CST)
//!     → CVisitor::visit_program()     → ProgramNode
//!
//! Mapeamento node.kind() → BaseNode.node_type (subset principal):
//!   "function_definition"      → Function
//!   "if_statement"             → IfStatement
//!   "for_statement"            → ForLoop
//!   "while_statement"          → WhileLoop
//!   "do_statement"             → DoWhile
//!   "switch_statement"         → SwitchStatement
//!   "return_statement"         → Return
//!   "break_statement"          → Break
//!   "continue_statement"       → Continue
//!   "declaration"              → VarDeclaration
//!   "assignment_expression"    → Assignment
//!   "call_expression"          → Function call (mapeado por callee)
//!     callee = "digitalWrite"  → GpioSet
//!     callee = "digitalRead"   → GpioRead
//!     callee = "analogWrite"   → AnalogWrite
//!     callee = "analogRead"    → AnalogRead
//!     callee = "pinMode"       → PinMode
//!     callee = "delay"         → DelayMs
//!     callee = "delayMicroseconds" → DelayUs
//!     callee = "Serial.begin"  → SerialBegin
//!     callee = "Serial.print"  → Print
//!     callee = "Serial.println"→ Print (com newline)
//!     callee = "Serial.read"   → UartRead
//!     callee = "Wire.begin"    → I2cBegin
//!     callee = "Wire.write"    → I2cWrite
//!     callee = "Wire.read"     → I2cRead
//!     callee = "SPI.transfer"  → SpiTransfer
//!     callee = "servo.attach" / "servo.write" / "servo.detach" → Servo*
//!     callee = "tone" / "noTone" → Tone*
//!     callee = "millis" / "micros" → Millis / Micros
//!     else                     → FunctionCall (genérico)

use tree_sitter::{Node, Parser, Tree};
use crate::types::nodes::{
    BaseNode, NodeType, ProgramNode, FunctionNode, ParamNode,
};

// ─── Erros ────────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum CParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),
    #[error("tree-sitter: parse devolveu None (source vazia ou inválida)")]
    ParseFailed,
    #[error("tree-sitter: nó com erro sintático em {0}:{1}")]
    SyntaxError(usize, usize),
}

// ─── Entry point ──────────────────────────────────────────────────────────────

pub struct CParser;

impl CParser {
    pub fn parse(source: &str) -> Result<ProgramNode, CParseError> {
        match Self::parse_with_arduino(source) {
            Ok(prog) => Ok(prog),
            Err(_) => Self::parse_with_cpp(source),
        }
    }

    fn parse_with_arduino(source: &str) -> Result<ProgramNode, CParseError> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_arduino::LANGUAGE.into())
            .map_err(|e| CParseError::LanguageError(e.to_string()))?;
        Self::do_parse(&mut parser, source)
    }

    fn parse_with_cpp(source: &str) -> Result<ProgramNode, CParseError> {
        let mut parser = Parser::new();
        parser
            .set_language(&tree_sitter_cpp::LANGUAGE.into())
            .map_err(|e| CParseError::LanguageError(e.to_string()))?;
        Self::do_parse(&mut parser, source)
    }

    fn do_parse(parser: &mut Parser, source: &str) -> Result<ProgramNode, CParseError> {
        let tree: Tree = parser
            .parse(source, None)
            .ok_or(CParseError::ParseFailed)?;
        let root = tree.root_node();
        if root.has_error() {
            let pos = root.start_position();
            return Err(CParseError::SyntaxError(pos.row + 1, pos.column + 1));
        }
        let mut visitor = CVisitor::new(source);
        visitor.visit_program(root)
    }
}

// ─── Visitor ──────────────────────────────────────────────────────────────────

struct CVisitor<'src> {
    source: &'src str,
}

impl<'src> CVisitor<'src> {
    fn new(source: &'src str) -> Self { Self { source } }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_program(&mut self, root: Node) -> Result<ProgramNode, CParseError> {
        let mut functions = vec![];
        let mut globals: Vec<BaseNode> = vec![];
        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_definition" => functions.push(self.visit_function(child)),
                "declaration"        => globals.push(self.visit_declaration(child)),
                _ => {}
            }
        }
        Ok(ProgramNode { node_type: NodeType::Program, functions, globals, imports: vec![] })
    }

    fn visit_function(&mut self, node: Node) -> FunctionNode {
        let name = node
            .child_by_field_name("declarator")
            .and_then(|d| d.child_by_field_name("declarator"))
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();
        let return_type = node
            .child_by_field_name("type")
            .map(|t| self.text(t).to_string())
            .unwrap_or_else(|| "void".to_string());
        let params = node
            .child_by_field_name("declarator")
            .and_then(|d| d.child_by_field_name("parameters"))
            .map(|p| self.visit_params(p))
            .unwrap_or_default();
        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();
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
            if child.kind() == "parameter_declaration" {
                let type_name  = child.child_by_field_name("type").map(|t| self.text(t).to_string()).unwrap_or_default();
                let param_name = child.child_by_field_name("declarator").map(|d| self.text(d).to_string()).unwrap_or_default();
                params.push(ParamNode { node_type: NodeType::Param, name: param_name, param_type: type_name });
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
            "expression_statement" => { let inner = node.named_child(0)?; self.visit_expr(inner) }
            "if_statement"       => Some(self.visit_if(node)),
            "for_statement"      => Some(self.visit_for(node)),
            "while_statement"    => Some(self.visit_while(node)),
            "do_statement"       => Some(self.visit_do_while(node)),
            "switch_statement"   => Some(self.visit_switch(node)),
            "return_statement"   => Some(self.visit_return(node)),
            "break_statement"    => Some(BaseNode::leaf(NodeType::Break)),
            "continue_statement" => Some(BaseNode::leaf(NodeType::Continue)),
            "declaration"        => Some(self.visit_declaration(node)),
            _                    => None,
        }
    }

    fn visit_expr(&mut self, node: Node) -> Option<BaseNode> {
        match node.kind() {
            "call_expression"       => Some(self.visit_call(node)),
            "assignment_expression" => Some(self.visit_assignment(node)),
            "update_expression"     => Some(self.visit_update(node)),
            _                       => Some(BaseNode::raw(self.text(node))),
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
            "digitalWrite"           => BaseNode::hw(NodeType::GpioSet,              args, line),
            "digitalRead"            => BaseNode::hw(NodeType::GpioRead,             args, line),
            "analogWrite"            => BaseNode::hw(NodeType::AnalogWrite,          args, line),
            "analogRead"             => BaseNode::hw(NodeType::AnalogRead,           args, line),
            "pinMode"                => BaseNode::hw(NodeType::PinMode,              args, line),
            "delay"                  => BaseNode::hw(NodeType::DelayMs,              args, line),
            "delayMicroseconds"      => BaseNode::hw(NodeType::DelayUs,              args, line),
            "millis"                 => BaseNode::hw(NodeType::Millis,               args, line),
            "micros"                 => BaseNode::hw(NodeType::Micros,               args, line),
            "tone"                   => BaseNode::hw(NodeType::Tone,                 args, line),
            "noTone"                 => BaseNode::hw(NodeType::NoTone,               args, line),
            "Serial.begin"           => BaseNode::hw(NodeType::SerialBegin,          args, line),
            "Serial.print"           => BaseNode::hw(NodeType::Print,                args, line),
            "Serial.println"         => BaseNode::hw(NodeType::PrintLn,              args, line),
            "Serial.read"            => BaseNode::hw(NodeType::UartRead,             args, line),
            "Serial.available"       => BaseNode::hw(NodeType::UartAvailable,        args, line),
            "Serial.write"           => BaseNode::hw(NodeType::UartWrite,            args, line),
            "Wire.begin"             => BaseNode::hw(NodeType::I2cBegin,             args, line),
            "Wire.requestFrom"       => BaseNode::hw(NodeType::I2cRequestFrom,       args, line),
            "Wire.beginTransmission" => BaseNode::hw(NodeType::I2cBeginTransmission, args, line),
            "Wire.endTransmission"   => BaseNode::hw(NodeType::I2cEndTransmission,   args, line),
            "Wire.write"             => BaseNode::hw(NodeType::I2cWrite,             args, line),
            "Wire.read"              => BaseNode::hw(NodeType::I2cRead,              args, line),
            "SPI.begin"              => BaseNode::hw(NodeType::SpiBegin,             args, line),
            "SPI.transfer"           => BaseNode::hw(NodeType::SpiTransfer,          args, line),
            "SPI.end"                => BaseNode::hw(NodeType::SpiEnd,               args, line),
            c if c.ends_with(".attach") => BaseNode::hw(NodeType::ServoAttach, args, line),
            c if c.ends_with(".write")  => BaseNode::hw(NodeType::ServoWrite,  args, line),
            c if c.ends_with(".detach") => BaseNode::hw(NodeType::ServoDetach, args, line),
            _                           => BaseNode::call(&callee, args, line),
        }
    }

    fn collect_args(&mut self, node: Node) -> Vec<BaseNode> {
        let mut args = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if !matches!(child.kind(), "," | "(" | ")") {
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

    fn visit_update(&self, node: Node) -> BaseNode { BaseNode::raw(self.text(node)) }

    fn visit_declaration(&mut self, node: Node) -> BaseNode {
        let type_name  = node.child_by_field_name("type").map(|t| self.text(t).to_string()).unwrap_or_default();
        let name       = node.child_by_field_name("declarator").map(|d| self.text(d).to_string()).unwrap_or_default();
        let value      = node.child_by_field_name("value").map(|v| self.text(v).to_string());
        BaseNode::var_decl(type_name, name, value, node.start_position().row + 1)
    }

    fn visit_if(&mut self, node: Node) -> BaseNode {
        let cond      = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let then_body = node.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();
        let else_body = node.child_by_field_name("alternative").map(|b| self.visit_block(b));
        BaseNode::if_stmt(cond, then_body, else_body, node.start_position().row + 1)
    }

    fn visit_for(&mut self, node: Node) -> BaseNode {
        let init = node.child_by_field_name("initializer").map(|n| self.text(n).to_string()).unwrap_or_default();
        let cond = node.child_by_field_name("condition").map(|n| self.text(n).to_string()).unwrap_or_default();
        let upd  = node.child_by_field_name("update").map(|n| self.text(n).to_string()).unwrap_or_default();
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::for_loop(init, cond, upd, body, node.start_position().row + 1)
    }

    fn visit_while(&mut self, node: Node) -> BaseNode {
        let cond = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        BaseNode::while_loop(cond, body, node.start_position().row + 1)
    }

    fn visit_do_while(&mut self, node: Node) -> BaseNode {
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        let cond = node.child_by_field_name("condition").map(|c| self.text(c).to_string()).unwrap_or_default();
        BaseNode::do_while(body, cond, node.start_position().row + 1)
    }

    fn visit_switch(&mut self, node: Node) -> BaseNode {
        let value = node.child_by_field_name("value").map(|v| self.text(v).to_string()).unwrap_or_default();
        let mut cases = vec![];
        if let Some(body) = node.child_by_field_name("body") {
            let mut cursor = body.walk();
            for child in body.children(&mut cursor) {
                match child.kind() {
                    "case_statement" | "default_statement" => cases.push(self.visit_case(child)),
                    _ => {}
                }
            }
        }
        BaseNode::switch(value, cases, node.start_position().row + 1)
    }

    fn visit_case(&mut self, node: Node) -> BaseNode {
        let value = node.child_by_field_name("value").map(|v| self.text(v).to_string());
        let mut stmts = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if let Some(s) = self.visit_statement(child) { stmts.push(s); }
        }
        BaseNode::case(value, stmts, node.start_position().row + 1)
    }

    fn visit_return(&mut self, node: Node) -> BaseNode {
        let value = node.named_child(0).map(|v| self.text(v).to_string());
        BaseNode::return_stmt(value, node.start_position().row + 1)
    }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_blink_sketch() {
        let src = r#"
void setup() {
    pinMode(13, OUTPUT);
}
void loop() {
    digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
}
"#;
        let prog = CParser::parse(src).expect("parse falhou");
        assert!(!prog.functions.is_empty());
        assert!(prog.functions.iter().any(|f| f.name == "setup"));
        assert!(prog.functions.iter().any(|f| f.name == "loop"));
    }

    #[test]
    fn parse_serial_begin() {
        let src = r#"
void setup() { Serial.begin(9600); }
void loop() {}
"#;
        let prog = CParser::parse(src).expect("parse falhou");
        let setup_fn = prog.functions.iter().find(|f| f.name == "setup").unwrap();
        assert!(setup_fn.body.iter().any(|n| n.node_type == NodeType::SerialBegin));
    }
}
