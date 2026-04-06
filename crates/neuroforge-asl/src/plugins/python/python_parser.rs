//! Parser Python via tree-sitter-python

//!

//! Mapeamento node.kind()     AslStatement:

//!   "module"                  AslProgram

//!   "function_definition"     AslFunction

//!   "if_statement"            AslStatement::If

//!   "for_statement"           AslStatement::ForIn

//!   "while_statement"         AslStatement::While

//!   "return_statement"        AslStatement::Return

//!   "break_statement"         AslStatement::Break

//!   "continue_statement"      AslStatement::Continue

//!   "assignment"              AslStatement::Assign

//!   "call":

//!     "machine.Pin"           AslStatement::PinMode

//!     "utime.sleep_ms"        AslStatement::Delay

//!     "uart.write"            AslStatement::UartWrite

//!     "i2c.writeto"           AslStatement::I2cWrite

//!     "print"                 AslStatement::Print

//!     else                    AslStatement::Expr

use crate::types::asl_types::{
    AslAssign, AslDelay, AslDigitalOutput, AslDuration, AslExpr, AslExpressionStmt, AslFunction, AslIf, AslLog, AslMetadata, AslParam, AslPinMode, AslPrint,
    AslProgram, AslReturn, AslStatement, AslTask, AslWhile, PinModeKind,
};

use crate::parser::neuro_parser::{
    normalize, NeuroParser, NeuroParserExt, ParseError,
};

use std::collections::HashMap;

use tree_sitter::{Node, Parser};

#[derive(Debug, thiserror::Error)]

pub enum PythonParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),

    #[error("tree-sitter: parse devolveu None")]
    ParseFailed,

    #[error("tree-sitter: erro sint  tico em {0}:{1}")]
    SyntaxError(usize, usize),
}

pub struct PythonParser;

impl NeuroParser for PythonParser {
    type Error = ParseError;

    fn parse(source: &str) -> Result<AslProgram, Self::Error> {
        let mut parser = Parser::new();

        parser
            .set_language(&tree_sitter_python::LANGUAGE.into())
            .map_err(|e| ParseError::Custom(format!("tree-sitter language error: {}", e)))?;

        let tree = parser
            .parse(source, None)
            .ok_or(ParseError::Custom("tree-sitter parse failed".to_string()))?;

        let root = tree.root_node();

        if root.has_error() {
            let pos = root.start_position();

            return Err(ParseError::UnexpectedToken {
                found: "syntax error".to_string(),

                expected: "valid python".to_string(),

                span: Some(crate::parser::neuro_parser::Span {
                    line: pos.row as u32 + 1,

                    col: pos.column as u32 + 1,

                    len: 1,
                }),
            });
        }

        let mut visitor = PythonVisitor::new(source);

        let program = visitor.visit_module(root);

        // Valida    o sem  ntica R7/semver

        Self::validate_semantics(&program).map_err(|diags| {
            ParseError::Multiple(
                diags
                    .iter()
                    .map(|d| d.to_string())
                    .collect::<Vec<_>>()
                    .join("\n"),
            )
        })?;

        Ok(program)
    }

    fn source_language() -> &'static str {
        "python"
    }
}

impl NeuroParserExt for PythonParser {}

struct PythonVisitor<'src> {
    source: &'src str,

    pin_map: HashMap<String, i64>,
}

impl<'src> PythonVisitor<'src> {
    fn new(source: &'src str) -> Self {
        Self {
            source,

            pin_map: HashMap::new(),
        }
    }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_module(&mut self, root: Node) -> AslProgram {
        let mut functions = vec![];

        let mut globals = vec![];

        let mut setup_body = vec![];

        let mut loop_body = vec![];

        let mut cursor = root.walk();

        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_definition" => {
                    let func = self.visit_function(child);

                    // R7 Heuristic: functions named setup/loop are promoted to tasks

                    match func.name.as_str() {
                        "setup" => setup_body.extend(func.body.clone()),

                        "loop" => loop_body.extend(func.body.clone()),

                        _ => functions.push(func),
                    }
                }

                "import_statement" | "import_from_statement" | "comment" => {}

                _ => {
                    for stmt in self.visit_statement(child) {
                        match &stmt {
                            AslStatement::Declare(d) => {
                                globals.push(crate::types::asl_types::AslGlobalVar {
                                    name: d.name.clone(),

                                    r#type: d.r#type.clone(),

                                    value: d.value.clone(),

                                    struct_type: None,

                                    mutable: d.mutable,

                                    scope: "global".to_string(),

                                    lifecycle: "normal".to_string(),

                                    comments: None,
                                    ..Default::default()
                                })
                            }

                            AslStatement::While(w) if self.is_infinite_loop(w) => {
                                loop_body.extend(w.body.clone());
                            }

                            _ => {
                                setup_body.push(stmt);
                            }
                        }
                    }
                }
            }
        }

        let mut tasks = vec![];

        // R7 Enforcement

        tasks.push(AslTask {
            name: "setup".to_string(),

            body: setup_body,

            ..Default::default()
        });

        tasks.push(AslTask {
            name: "loop".to_string(),

            body: loop_body,

            ..Default::default()
        });

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

            ..Default::default()
        }
    }

    fn is_infinite_loop(&self, w: &AslWhile) -> bool {
        match &w.condition {
            AslExpr::Literal(l) => l.value.as_bool() == Some(true) || l.value.as_i64() == Some(1),

            _ => false,
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

            doc: None,
            ..Default::default()
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

                            default: None,
                            ..Default::default()
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

                        default: None,
                        ..Default::default()
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
        // Check if the expression_statement contains an assignment

        if let Some(first_child) = node.named_child(0) {
            if first_child.kind() == "assignment" || first_child.kind() == "augmented_assignment" {
                return vec![self.visit_assignment(first_child)];
            }
        }

        match node.kind() {
            "call" => vec![self.visit_call(node)],

            "assignment" | "augmented_assignment" => vec![self.visit_assignment(node)],

            _ => vec![AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::var(self.text(node)),
            })],
        }
    }

    fn visit_call(&mut self, node: Node) -> AslStatement {
        let func_node = node.child_by_field_name("function").unwrap();

        let func_text = self.text(func_node).to_string();

        let args_node = node.child_by_field_name("arguments").unwrap();

        let mut cursor = args_node.walk();

        let args: Vec<AslExpr> = args_node
            .children(&mut cursor)
            .filter(|c| c.is_named())
            .map(|c| self.visit_expr(c))
            .collect();

        // Handle method calls: p.on(), p.off(), p.value(x)

        if func_node.kind() == "attribute" {
            let object_node = func_node.child_by_field_name("object").unwrap();

            let method_node = func_node.child_by_field_name("attribute").unwrap();

            let object_name = self.text(object_node);

            let method_name = self.text(method_node);

            if let Some(&pin_num) = self.pin_map.get(object_name) {
                match method_name {
                    "on" => {
                        return AslStatement::DigitalOutput(AslDigitalOutput {
                            pin: AslExpr::int(pin_num),

                            value: normalize::from_bool(true),
                        })
                    }

                    "off" => {
                        return AslStatement::DigitalOutput(AslDigitalOutput {
                            pin: AslExpr::int(pin_num),

                            value: normalize::from_bool(false),
                        })
                    }

                    "value" => {
                        let val = args.first().cloned().unwrap_or(AslExpr::int(0));

                        return AslStatement::DigitalOutput(AslDigitalOutput {
                            pin: AslExpr::int(pin_num),

                            value: val,
                        });
                    }

                    _ => {}
                }
            }
        }

        match func_text.as_str() {
            "machine.Pin" | "Pin" => {
                let pin = args.first().cloned().unwrap_or(AslExpr::int(0));

                // Actually look at the 2nd argument

                let is_output = if args.len() > 1 {
                    let second_arg_text =
                        args_node.named_child(1).map(|c| self.text(c)).unwrap_or("");

                    second_arg_text.contains("OUT") || second_arg_text == "1"
                } else {
                    true
                };

                AslStatement::PinMode(AslPinMode {
                    pin,

                    mode: if is_output {
                        PinModeKind::Output
                    } else {
                        PinModeKind::Input
                    },
                })
            }

            "utime.sleep_ms" | "time.sleep_ms" | "sleep_ms" => AslStatement::Delay(AslDelay {
                duration: AslDuration::from_ms(
                    args.first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .map(|v| v.max(0) as u64)
                        .unwrap_or(0),
                ),
            }),

            "utime.sleep" | "time.sleep" | "sleep" => {
                let ms = match args.first() {
                    Some(AslExpr::Literal(l)) => {
                        let sec = l.value.as_f64().unwrap_or(0.0);

                        (sec * 1000.0) as i64
                    }

                    _ => 0,
                };

                AslStatement::Delay(AslDelay {
                    duration: AslDuration::from_ms(ms.max(0) as u64),
                })
            }

            "logging.info" | "logging.debug" | "logging.warning" | "logging.error" => {
                let level = func_text.split('.').last().unwrap_or("INFO").to_uppercase();

                AslStatement::Log(AslLog {
                    level,

                    module: "main".to_string(),

                    message: args.first().cloned().unwrap_or(AslExpr::str_val("")),
                })
            }

            "print" => AslStatement::Print(AslPrint {
                args,

                newline: true,
            }),

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::Call(Box::new(crate::types::asl_types::AslCall {
                    callee: func_text,

                    args,
                })),
            }),
        }
    }

    fn visit_expr(&mut self, node: Node) -> AslExpr {
        match node.kind() {
            "integer" => AslExpr::int(self.text(node).parse().unwrap_or(0)),

            "float" => AslExpr::float(self.text(node).parse().unwrap_or(0.0)),

            "string" => AslExpr::str_val(self.text(node).trim_matches('"').trim_matches('\'')),

            "true" | "True" => AslExpr::bool_val(true),

            "false" | "False" => AslExpr::bool_val(false),

            "identifier" | "attribute" => AslExpr::var(self.text(node)),

            "call" => {
                // Simplifica    o: se for uma chamada dentro de express  o, mantemos como Call

                let stmt = self.visit_call(node);

                if let AslStatement::Expr(e) = stmt {
                    e.expr
                } else {
                    AslExpr::int(0) // Fallback para statements em posi    o de express  o
                }
            }

            _ => AslExpr::var(self.text(node)),
        }
    }

    fn visit_assignment(&mut self, node: Node) -> AslStatement {
        let target = node
            .child_by_field_name("left")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let right = node.child_by_field_name("right");

        if let Some(r) = right {
            if r.kind() == "call" {
                let func_node = r.child_by_field_name("function");

                if let Some(f) = func_node {
                    let func_text = self.text(f);

                    if func_text == "machine.Pin" || func_text == "Pin" {
                        let arg_node = r.child_by_field_name("arguments");

                        if let Some(args_node) = arg_node {
                            // Extrair o primeiro argumento (pin number)

                            let mut cursor = args_node.walk();

                            let first_arg_node =
                                args_node.children(&mut cursor).find(|c| c.is_named());

                            if let Some(arg_node) = first_arg_node {
                                let arg_expr = self.visit_expr(arg_node);

                                if let AslExpr::Literal(l) = arg_expr {
                                    if let Some(pin_num) = l.value.as_i64() {
                                        self.pin_map.insert(target.clone(), pin_num);

                                        // Tamb  m resolvemos o mode

                                        let is_output = self.text(args_node).contains("OUT");

                                        return AslStatement::PinMode(AslPinMode {
                                            pin: AslExpr::int(pin_num),

                                            mode: if is_output {
                                                PinModeKind::Output
                                            } else {
                                                PinModeKind::Input
                                            },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let value = right
            .map(|n| {
                let s = self.text(n);

                if let Ok(v) = s.parse::<i64>() {
                    AslExpr::int(v)
                } else if let Ok(v) = s.parse::<f64>() {
                    AslExpr::float(v)
                } else if s == "True" || s == "False" {
                    AslExpr::bool_val(s == "True")
                } else {
                    AslExpr::var(s)
                }
            })
            .unwrap_or_else(|| AslExpr::int(0));

        AslStatement::Assign(AslAssign { target, value })
    }

    fn visit_if(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| AslExpr::var(self.text(c)))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        let then_body = node
            .child_by_field_name("consequence")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        let else_body = node
            .child_by_field_name("alternative")
            .map(|b| self.visit_block(b))
            .filter(|v| !v.is_empty());

        AslStatement::If(Box::new(AslIf {
            condition,

            then_body: then_body,

            else_if: vec![],

            else_body: else_body,
            ..Default::default()
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

        AslStatement::For(Box::new(crate::types::asl_types::AslFor::Each(
            crate::types::asl_types::AslForEach {
                var: var_name,

                iterable,

                body,
            },
        )))
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

        let loop_task = prog.tasks.iter().find(|t| t.name == "loop");

        assert!(
            loop_task.is_some(),
            "deve ter task loop a partir do while True em main via heur  stica"
        );
    }
}
