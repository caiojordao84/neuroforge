//! Parser Python via tree-sitter-python
//!
//! Mapeamento node.kind() → AslStatement:
//!   "module"              → AslProgram
//!   "function_definition" → AslFunction
//!   "if_statement"        → AslStatement::If
//!   "for_statement"       → AslStatement::ForIn
//!   "while_statement"     → AslStatement::While
//!   "return_statement"    → AslStatement::Return
//!   "break_statement"     → AslStatement::Break
//!   "continue_statement"  → AslStatement::Continue
//!   "assignment"          → AslStatement::Assign
//!   "call":
//!     "machine.Pin"       → AslStatement::PinMode
//!     "utime.sleep_ms"    → AslStatement::Delay
//!     "uart.write"        → AslStatement::UartWrite
//!     "i2c.writeto"       → AslStatement::I2cWrite
//!     "print"             → AslStatement::Print
//!     else                → AslStatement::Expr

use crate::types::asl_types::{
    AslAssign, AslDelay, AslExpr, AslExpressionStmt, AslForIn, AslFunction, AslI2cRead,
    AslI2cWrite, AslIf, AslMetadata, AslParam, AslPinMode, AslPrint, AslProgram, AslReturn,
    AslSpiTransfer, AslStatement, AslUartWrite, AslWhile, PinModeKind,
};
use tree_sitter::{Node, Parser, Tree};

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
    pub fn parse(source: &str) -> Result<AslProgram, PythonParseError> {
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
        Ok(visitor.visit_module(root))
    }
}

struct PythonVisitor<'src> {
    source: &'src str,
}

impl<'src> PythonVisitor<'src> {
    fn new(source: &'src str) -> Self {
        Self { source }
    }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_module(&mut self, root: Node) -> AslProgram {
        let mut functions = vec![];
        let tasks = vec![];
        let mut globals = vec![];

        let mut cursor = root.walk();
        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_definition" => functions.push(self.visit_function(child)),
                "import_statement" | "import_from_statement" | "comment" => {}
                _ => {
                    for stmt in self.visit_statement(child) {
                        if let AslStatement::Declare(d) = stmt {
                            globals.push(crate::types::asl_types::AslGlobalVar {
                                name: d.name,
                                r#type: d.r#type,
                                initial_value: d.value.map(|e| match e {
                                    AslExpr::Literal(l) => l.value,
                                    _ => serde_json::Value::Null,
                                }),
                                struct_type: None,
                                comments: None,
                            })
                        }
                    }
                }
            }
        }

        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: None,
                description: None,
                version: None,
                target_board: Some("micropython".to_string()),
            },
            structs: vec![],
            globals,
            functions,
            tasks,
        }
    }

    fn visit_function(&mut self, node: Node) -> AslFunction {
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

        AslFunction {
            name,
            params,
            body,
            return_type: None,
        }
    }

    fn visit_params(&self, node: Node) -> Vec<AslParam> {
        let mut params = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            match child.kind() {
                "identifier" => {
                    let name = self.text(child).to_string();
                    if name != "self" {
                        params.push(AslParam {
                            name,
                            r#type: "Any".to_string(),
                        });
                    }
                }
                "typed_parameter" => {
                    let name = child
                        .named_child(0)
                        .map(|n| self.text(n).to_string())
                        .unwrap_or_default();
                    let type_name = child
                        .child_by_field_name("type")
                        .map(|t| self.text(t).to_string())
                        .unwrap_or_else(|| "Any".to_string());
                    params.push(AslParam {
                        name,
                        r#type: type_name,
                    });
                }
                _ => {}
            }
        }
        params
    }

    fn visit_block(&mut self, node: Node) -> Vec<AslStatement> {
        let mut stmts = vec![];
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            stmts.extend(self.visit_statement(child));
        }
        stmts
    }

    fn visit_statement(&mut self, node: Node) -> Vec<AslStatement> {
        match node.kind() {
            "expression_statement" => {
                if let Some(inner) = node.named_child(0) {
                    self.visit_expr_stmt(inner)
                } else {
                    vec![]
                }
            }
            "if_statement" => vec![self.visit_if(node)],
            "for_statement" => vec![self.visit_for(node)],
            "while_statement" => vec![self.visit_while(node)],
            "return_statement" => {
                let value = node.named_child(0).map(|v| AslExpr::var(self.text(v)));
                vec![AslStatement::Return(AslReturn { value })]
            }
            "break_statement" => vec![AslStatement::Break],
            "continue_statement" => vec![AslStatement::Continue],
            "assignment" | "augmented_assignment" => vec![self.visit_assignment(node)],
            _ => vec![],
        }
    }

    fn visit_expr_stmt(&mut self, node: Node) -> Vec<AslStatement> {
        match node.kind() {
            "call" => vec![self.visit_call(node)],
            _ => vec![AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::var(self.text(node)),
            })],
        }
    }

    fn visit_call(&mut self, node: Node) -> AslStatement {
        let func_text = node
            .child_by_field_name("function")
            .map(|f| self.text(f).to_string())
            .unwrap_or_default();

        let raw_args: Vec<String> = node
            .child_by_field_name("arguments")
            .map(|a| {
                let mut cursor = a.walk();
                a.children(&mut cursor)
                    .filter(|c| !matches!(c.kind(), "," | "(" | ")") && c.is_named())
                    .map(|c| self.text(c).to_string())
                    .collect()
            })
            .unwrap_or_default();

        let arg = |idx: usize| -> AslExpr {
            raw_args
                .get(idx)
                .map(|s| AslExpr::var(s))
                .unwrap_or_else(|| AslExpr::int(0))
        };

        match func_text.as_str() {
            "machine.Pin" => AslStatement::PinMode(AslPinMode {
                pin: arg(0),
                mode: PinModeKind::Output,
            }),
            f if f == "utime.sleep_ms" || f == "time.sleep_ms" => AslStatement::Delay(AslDelay {
                milliseconds: arg(0),
            }),
            "print" => AslStatement::Print(AslPrint {
                args: raw_args.iter().map(|s| AslExpr::var(s)).collect(),
                newline: true,
            }),
            "uart.write" => AslStatement::UartWrite(AslUartWrite {
                port: AslExpr::int(0),
                data: arg(0),
            }),
            "i2c.writeto" => AslStatement::I2cWrite(AslI2cWrite {
                bus: AslExpr::int(0),
                address: arg(0),
                data: arg(1),
            }),
            "i2c.readfrom" => AslStatement::I2cRead(AslI2cRead {
                bus: AslExpr::int(0),
                address: arg(0),
                length: arg(1),
                target: "_buf".to_string(),
            }),
            "spi.write" => AslStatement::SpiTransfer(AslSpiTransfer {
                bus: AslExpr::int(0),
                cs_pin: AslExpr::int(0),
                tx_data: arg(0),
                target: None,
            }),
            _ => AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::var(&func_text),
            }),
        }
    }

    fn visit_assignment(&mut self, node: Node) -> AslStatement {
        let target = node
            .child_by_field_name("left")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();
        let value = node
            .child_by_field_name("right")
            .map(|n| AslExpr::var(self.text(n)))
            .unwrap_or_else(|| AslExpr::int(0));
        AslStatement::Assign(AslAssign { target, value })
    }

    fn visit_if(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| AslExpr::var(self.text(c)))
            .unwrap_or_else(|| AslExpr::bool_val(true));
        let then_branch = node
            .child_by_field_name("consequence")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();
        let else_branch = node
            .child_by_field_name("alternative")
            .map(|b| self.visit_block(b))
            .filter(|v| !v.is_empty());
        AslStatement::If(Box::new(AslIf {
            condition,
            then_branch,
            else_branch,
        }))
    }

    fn visit_for(&mut self, node: Node) -> AslStatement {
        let var_name = node
            .child_by_field_name("left")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();
        let iterable = node
            .child_by_field_name("right")
            .map(|n| AslExpr::var(self.text(n)))
            .unwrap_or_else(|| AslExpr::int(0));
        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();
        AslStatement::ForIn(Box::new(AslForIn {
            var_name,
            iterable,
            body,
        }))
    }

    fn visit_while(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| AslExpr::var(self.text(c)))
            .unwrap_or_else(|| AslExpr::bool_val(true));
        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();
        AslStatement::While(Box::new(AslWhile { condition, body }))
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

def main():
    while True:
        utime.sleep_ms(500)
"#;
        let prog = PythonParser::parse(src).expect("parse falhou");
        let main_fn = prog.functions.iter().find(|f| f.name == "main");
        assert!(main_fn.is_some(), "deve ter função main");
    }
}
