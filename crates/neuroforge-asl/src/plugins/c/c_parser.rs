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

        let mut setup_body = vec![];
        let mut loop_body = vec![];
        let mut has_loop = false;
        let mut regular_functions = vec![];

        for f in functions {
            if f.name == "setup" {
                setup_body.extend(f.body);
            } else if f.name == "loop" {
                loop_body.extend(f.body);
                has_loop = true;
            } else {
                regular_functions.push(f);
            }
        }

        Ok(ProgramNode { 
            node_type: NodeType::Program, 
            functions: regular_functions, 
            globals, 
            setup_body, 
            loop_body, 
            has_loop 
        })
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
            "expression_statement" => node.named_child(0).map(|inner| self.visit_expr(inner)),
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

    fn visit_expr(&mut self, node: Node) -> BaseNode {
        match node.kind() {
            "call_expression"       => self.visit_call(node),
            "assignment_expression" => self.visit_assignment(node),
            "update_expression"     => self.visit_update(node),
            _                       => BaseNode::raw(self.text(node)),
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
        
        let declarator = node.child_by_field_name("declarator");
        let (name, value) = if let Some(d) = declarator {
            if d.kind() == "init_declarator" {
                let identifier = d.child_by_field_name("declarator").map(|n| self.text(n).to_string()).unwrap_or_default();
                // Tenta "value" ou "initializer", senão pega o último filho (se não for o próprio declarador)
                let val_node = d.child_by_field_name("value").or(d.child_by_field_name("initializer"));
                let val_text = if let Some(v) = val_node {
                    let mut txt = self.text(v).to_string();
                    if txt.starts_with('=') {
                        txt = txt[1..].trim().to_string();
                    }
                    Some(txt)
                } else if d.child_count() >= 3 {
                    // Esperado: [declarator, '=', literal]
                    let idx = (d.child_count() as u32) - 1;
                    let last = d.child(idx).unwrap();
                    Some(self.text(last).to_string())
                } else {
                    None
                };
                (identifier, val_text)
            } else {
                (self.text(d).to_string(), None)
            }
        } else {
            ("".to_string(), None)
        };

        BaseNode::var_decl(type_name, name, value, node.start_position().row + 1)
    }

    fn visit_if(&mut self, node: Node) -> BaseNode {
        let cond      = node.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or_else(|| BaseNode::raw("true"));
        let then_body = node.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();
        let else_body = node.child_by_field_name("alternative").map(|b| self.visit_block(b));
        
        let mut n = BaseNode::new(NodeType::IfStatement);
        n.children.push(cond);
        
        let mut then_node = BaseNode::new(NodeType::Block);
        then_node.children = then_body;
        n.children.push(then_node);
        
        if let Some(eb) = else_body {
            let mut else_node = BaseNode::new(NodeType::Block);
            else_node.children = eb;
            n.children.push(else_node);
        }
        
        n.attributes.insert("line".to_string(), (node.start_position().row + 1).into());
        n
    }

    fn visit_for(&mut self, node: Node) -> BaseNode {
        let init = node.child_by_field_name("initializer").map(|n| self.visit_expr(n));
        let cond = node.child_by_field_name("condition").map(|n| self.visit_expr(n));
        let upd  = node.child_by_field_name("update").map(|n| self.visit_expr(n));
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        
        let mut n = BaseNode::new(NodeType::ForLoop);
        if let Some(i) = init { n.children.push(i); } else { n.children.push(BaseNode::raw("")); }
        if let Some(c) = cond { n.children.push(c); } else { n.children.push(BaseNode::raw("")); }
        if let Some(u) = upd  { n.children.push(u); } else { n.children.push(BaseNode::raw("")); }
        
        let mut body_node = BaseNode::new(NodeType::Block);
        body_node.children = body;
        n.children.push(body_node);
        n.attributes.insert("line".to_string(), (node.start_position().row + 1).into());
        n
    }

    fn visit_while(&mut self, node: Node) -> BaseNode {
        let cond = node.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or_else(|| BaseNode::raw("true"));
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        
        let mut n = BaseNode::new(NodeType::WhileLoop);
        n.children.push(cond);
        let mut body_node = BaseNode::new(NodeType::Block);
        body_node.children = body;
        n.children.push(body_node);
        n.attributes.insert("line".to_string(), (node.start_position().row + 1).into());
        n
    }

    fn visit_do_while(&mut self, node: Node) -> BaseNode {
        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();
        let cond = node.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or_else(|| BaseNode::raw("true"));
        
        let mut n = BaseNode::new(NodeType::DoWhile);
        n.children.push(cond);
        let mut body_node = BaseNode::new(NodeType::Block);
        body_node.children = body;
        n.children.push(body_node);
        n.attributes.insert("line".to_string(), (node.start_position().row + 1).into());
        n
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
