//! Parser C/Arduino via tree-sitter-arduino (fallback: tree-sitter-cpp)

//!

//! Fluxo:

//!   source (&str)

//!         tree_sitter::Parser::parse()      Tree (CST)

//!         CVisitor::visit_program()         ProgramNode

//!

//! Mapeamento node.kind()     BaseNode.node_type (subset principal):

//!   "function_definition"          Function

//!   "if_statement"                 IfStatement

//!   "for_statement"                ForLoop

//!   "while_statement"              WhileLoop

//!   "do_statement"                 DoWhile

//!   "switch_statement"             SwitchStatement

//!   "return_statement"             Return

//!   "break_statement"              Break

//!   "continue_statement"           Continue

//!   "declaration"                  VarDeclaration

//!   "assignment_expression"        Assignment

//!   "call_expression"              Function call (mapeado por callee)

//!     callee = "digitalWrite"      GpioSet

//!     callee = "digitalRead"       GpioRead

//!     callee = "analogWrite"       AnalogWrite

//!     callee = "analogRead"        AnalogRead

//!     callee = "pinMode"           PinMode

//!     callee = "delay"             DelayMs

//!     callee = "delayMicroseconds"     DelayUs

//!     callee = "Serial.begin"      SerialBegin

//!     callee = "Serial.print"      Print

//!     callee = "Serial.println"    Print (com newline)

//!     callee = "Serial.read"       UartRead

//!     callee = "Wire.begin"        I2cBegin

//!     callee = "Wire.write"        I2cWrite

//!     callee = "Wire.read"         I2cRead

//!     callee = "SPI.transfer"      SpiTransfer

//!     callee = "servo.attach" / "servo.write" / "servo.detach"     Servo*

//!     callee = "tone" / "noTone"     Tone*

//!     callee = "millis" / "micros"     Millis / Micros

//!     else                         FunctionCall (gen  rico)

use crate::types::asl_types::{
    AslAnalogOutput, AslAssign, AslBinary, AslCall, AslDeclare, AslDelay, AslDigitalInput,
    AslDigitalOutput, AslDoWhile, AslDuration, AslExpr, AslExpressionStmt, AslFunction, AslIf,
    AslMetadata, AslParam, AslPinMode, AslPrint, AslProgram, AslReturn, AslSerialBegin,
    AslStatement, AslSwitch, AslSwitchCase, AslTask, AslType, AslWhile, BinaryOp, PinModeKind,
};

use crate::parser::neuro_parser::{normalize, NeuroParser, NeuroParserExt, ParseError};

use tree_sitter::{Node, Parser};

//           Erros

#[derive(Debug, thiserror::Error)]

pub enum CParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),

    #[error("tree-sitter: parse devolveu None (source vazia ou inv  lida)")]
    ParseFailed,

    #[error("tree-sitter: n   com erro sint  tico em {0}:{1}")]
    SyntaxError(usize, usize),

    #[error("Custom error: {0}")]
    Custom(String),
}

//           Entry point

pub struct CParser;

impl NeuroParser for CParser {
    type Error = ParseError;

    fn parse(source: &str) -> Result<AslProgram, ParseError> {
        let mut parser = Parser::new();

        // Tenta Arduino, fallback para CPP

        let tree = if parser
            .set_language(&tree_sitter_arduino::LANGUAGE.into())
            .is_ok()
        {
            parser.parse(source, None)
        } else {
            parser
                .set_language(&tree_sitter_cpp::LANGUAGE.into())
                .map_err(|e| ParseError::Custom(format!("C language error: {}", e)))?;

            parser.parse(source, None)
        }
        .ok_or(ParseError::Custom("C parse failed".to_string()))?;

        let root = tree.root_node();

        if root.has_error() {
            let pos = root.start_position();

            return Err(ParseError::UnexpectedToken {
                found: "syntax error".to_string(),

                expected: "valid C/Arduino".to_string(),

                span: Some(crate::parser::neuro_parser::Span {
                    line: pos.row as u32 + 1,

                    col: pos.column as u32 + 1,

                    len: 1,
                }),
            });
        }

        let mut visitor = CVisitor::new(source);

        let program = visitor.visit_program(root);

        // Valida    o sem  ntica R7/semver

        Self::validate_semantics(&program).map_err(
            |diags: Vec<crate::parser::neuro_parser::ParseDiagnostic>| {
                ParseError::Multiple(
                    diags
                        .iter()
                        .map(|d| d.to_string())
                        .collect::<Vec<_>>()
                        .join("\n"),
                )
            },
        )?;

        Ok(program)
    }

    fn source_language() -> &'static str {
        "c"
    }
}

impl NeuroParserExt for CParser {}

//           Visitor

struct CVisitor<'src> {
    source: &'src str,
}

impl<'src> CVisitor<'src> {
    fn new(source: &'src str) -> Self {
        Self { source }
    }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_program(&mut self, root: Node) -> AslProgram {
        let mut functions = vec![];

        let mut globals = vec![];

        let mut setup_body = vec![];

        let mut loop_body = vec![];

        let mut cursor = root.walk();

        for child in root.children(&mut cursor) {
            match child.kind() {
                "function_definition" => {
                    let func = self.visit_function(child);

                    // R7 Heuristic: setup/loop tasks

                    if func.name == "setup" {
                        setup_body.extend(func.params_to_decl());

                        setup_body.extend(func.body);
                    } else if func.name == "loop" {
                        loop_body.extend(func.params_to_decl());

                        loop_body.extend(func.body);
                    } else {
                        functions.push(func);
                    }
                }

                "declaration" => {
                    if let Some(stmt) = self.visit_declaration(child) {
                        if let AslStatement::Declare(d) = &stmt {
                            globals.push(crate::types::asl_types::AslGlobalVar {
                                name: d.name.clone(),

                                r#type: d.r#type.clone(),

                                value: d.value.clone(),

                                struct_type: d.subtype.clone(),

                                ..Default::default()
                            });
                        } else {
                            setup_body.push(stmt);
                        }
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

                target_board: Some("arduino".to_string()),
            },

            structs: vec![],

            globals,

            functions,

            tasks: vec![
                AslTask {
                    name: "setup".into(),
                    body: setup_body,
                    ..Default::default()
                },
                AslTask {
                    name: "loop".into(),
                    body: loop_body,
                    ..Default::default()
                },
            ],

            ..Default::default()
        }
    }

    fn visit_function(&mut self, node: Node) -> AslFunction {
        let name = node
            .child_by_field_name("declarator")
            .and_then(|d| d.child_by_field_name("declarator"))
            .map(|n| self.text(n).to_string())
            .unwrap_or_else(|| "unnamed".to_string());

        let return_type_str = node
            .child_by_field_name("type")
            .map(|t| self.text(t).to_uppercase())
            .unwrap_or_else(|| "VOID".to_string());

        let return_type = Some(AslType::parse(&return_type_str));

        let params = node
            .child_by_field_name("declarator")
            .and_then(|d| d.child_by_field_name("parameters"))
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
            return_type,
            doc: None,
            ..Default::default()
        }
    }

    fn visit_params(&self, node: Node) -> Vec<AslParam> {
        let mut params = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            if child.kind() == "parameter_declaration" {
                let type_name = child
                    .child_by_field_name("type")
                    .map(|t| self.text(t).to_uppercase())
                    .unwrap_or_else(|| "INT".into());

                let param_name = child
                    .child_by_field_name("declarator")
                    .map(|d| self.text(d).to_string())
                    .unwrap_or_else(|| "p".into());

                params.push(AslParam {
                    name: param_name,
                    r#type: type_name,
                    ..Default::default()
                });
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
                    vec![self.visit_expr_stmt(inner)]
                } else {
                    vec![]
                }
            }

            "if_statement" => vec![self.visit_if(node)],

            "for_statement" => vec![self.visit_for(node)],

            "while_statement" => vec![self.visit_while(node)],

            "do_statement" => vec![self.visit_do_while(node)],

            "switch_statement" => vec![self.visit_switch(node)],

            "return_statement" => vec![self.visit_return(node)],

            "break_statement" => vec![AslStatement::Break],

            "continue_statement" => vec![AslStatement::Continue],

            "declaration" => self.visit_declaration(node).into_iter().collect(),

            _ => vec![],
        }
    }

    fn visit_expr_stmt(&mut self, node: Node) -> AslStatement {
        match node.kind() {
            "call_expression" => self.visit_call(node),

            "assignment_expression" | "compound_assignment_expression" => {
                let left_node = node.child_by_field_name("left").unwrap();

                let right_node = node.child_by_field_name("right").unwrap();

                let op_text = self
                    .text(node.child_by_field_name("operator").unwrap())
                    .to_string();

                let target = self.text(left_node).to_string();

                let right_val = self.visit_expr(right_node);

                let final_value = if op_text == "=" {
                    right_val
                } else {
                    let op = match op_text.as_str() {
                        "+=" => BinaryOp::Add,

                        "-=" => BinaryOp::Sub,

                        "*=" => BinaryOp::Mul,

                        "/=" => BinaryOp::Div,

                        _ => BinaryOp::Add,
                    };

                    AslExpr::Binary(Box::new(AslBinary {
                        op,

                        left: AslExpr::var(&target),

                        right: right_val,
                    }))
                };

                AslStatement::Assign(AslAssign {
                    target,
                    value: final_value,
                })
            }

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: self.visit_expr(node),
            }),
        }
    }

    fn visit_expr(&mut self, node: Node) -> AslExpr {
        match node.kind() {
            "number_literal" => {
                let t = self.text(node);

                if t.contains('.') {
                    AslExpr::float(t.parse().unwrap_or(0.0))
                } else {
                    AslExpr::int(t.parse().unwrap_or(0))
                }
            }

            "identifier" => AslExpr::var(self.text(node)),

            "call_expression" => {
                let stmt = self.visit_call(node);

                if let AslStatement::Expr(e) = stmt {
                    e.expr
                } else {
                    AslExpr::null()
                }
            }

            "string_literal" => AslExpr::str_val(self.text(node).trim_matches('"')),

            "parenthesized_expression" => {
                let inner = node.named_child(0).or_else(|| {
                    // Fallback para child(1) se named_child(0) falhar (ex: em gram  ticas onde o interno n  o    'named')

                    if node.child_count() >= 3 {
                        node.child(1)
                    } else {
                        None
                    }
                });

                if let Some(n) = inner {
                    self.visit_expr(n)
                } else {
                    AslExpr::null()
                }
            }

            kind @ ("binary_expression" | "logical_expression" | "relational_expression") => {
                println!(
                    "DEBUG visit_expr: kind='{}' text='{}'",
                    kind,
                    self.text(node)
                );

                let mut operands = vec![];

                let mut op_node = None;

                let mut cursor = node.walk();

                for child in node.children(&mut cursor) {
                    if child.is_named() {
                        operands.push(child);
                    } else if child.kind().contains("||")
                        || child.kind().contains("&&")
                        || child.kind() == "+"
                        || child.kind() == "-"
                        || child.kind() == "*"
                        || child.kind() == "/"
                        || child.kind() == "=="
                        || child.kind() == "!="
                        || child.kind() == ">"
                        || child.kind() == ">="
                        || child.kind() == "<"
                        || child.kind() == "<="
                    {
                        op_node = Some(child);
                    }
                }

                if operands.len() >= 2 {
                    let op_text = op_node.map(|o| self.text(o)).unwrap_or("+");

                    AslExpr::Binary(Box::new(AslBinary {
                        op: match op_text {
                            "+" => BinaryOp::Add,
                            "-" => BinaryOp::Sub,
                            "*" => BinaryOp::Mul,
                            "/" => BinaryOp::Div,

                            "==" => BinaryOp::Eq,
                            "!=" => BinaryOp::Neq,
                            ">" => BinaryOp::Gt,
                            ">=" => BinaryOp::Gte,

                            "<" => BinaryOp::Lt,
                            "<=" => BinaryOp::Lte,

                            "&&" => BinaryOp::And,
                            "||" => BinaryOp::Or,

                            "and" | "AND" => BinaryOp::And,
                            "or" | "OR" => BinaryOp::Or,

                            _ => BinaryOp::Add,
                        },

                        left: self.visit_expr(operands[0]),

                        right: self.visit_expr(operands[1]),
                    }))
                } else {
                    AslExpr::var(self.text(node))
                }
            }

            _kind => {
                let text = self.text(node);

                // Heur  stica final: se cont  m operadores l  gicos/relacionais e n  o foi capturado, tenta decompor

                if text.contains("||")
                    || text.contains("&&")
                    || text.contains("<=")
                    || text.contains(">=")
                    || text.contains("==")
                {
                    // eprintln!("DEBUG visit_expr FALLBACK: kind='{}' text='{}'", kind, text);

                    // Tenta encontrar o operador manualmente se child(1) falhar

                    let op_sym = if text.contains("||") {
                        "||"
                    } else if text.contains("&&") {
                        "&&"
                    } else if text.contains("<=") {
                        "<="
                    } else if text.contains(">=") {
                        ">="
                    } else {
                        "=="
                    };

                    let parts: Vec<&str> = text.split(op_sym).collect();

                    if parts.len() == 2 {
                        return AslExpr::Binary(Box::new(AslBinary {
                            op: match op_sym {
                                "||" => BinaryOp::Or,
                                "&&" => BinaryOp::And,
                                "<=" => BinaryOp::Lte,
                                ">=" => BinaryOp::Gte,
                                _ => BinaryOp::Eq,
                            },

                            left: AslExpr::var(parts[0].trim()),

                            right: AslExpr::var(parts[1].trim()),
                        }));
                    }
                }

                if let Some(norm) = normalize::bool_like(text) {
                    norm
                } else {
                    AslExpr::var(text)
                }
            }
        }
    }

    fn visit_call(&mut self, node: Node) -> AslStatement {
        let callee = node
            .child_by_field_name("function")
            .map(|f| self.text(f).to_string())
            .unwrap_or_default();

        let args_node = node
            .child_by_field_name("arguments")
            .expect("Call must have arguments node");

        let args = self.collect_args(args_node);

        match callee.as_str() {
            "digitalWrite" => AslStatement::DigitalOutput(AslDigitalOutput {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),

                value: args.get(1).cloned().unwrap_or(AslExpr::int(0)),
            }),

            "digitalRead" => AslStatement::DigitalInput(AslDigitalInput {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),

                target: "temp".into(),
            }),

            "analogWrite" => AslStatement::AnalogOutput(AslAnalogOutput {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),

                value: args.get(1).cloned().unwrap_or(AslExpr::int(0)),
            }),

            "pinMode" => {
                let pin = args.first().cloned().unwrap_or(AslExpr::int(0));

                let mode_raw = args
                    .get(1)
                    .map(|a| match a {
                        AslExpr::Var(v) => v.name.clone(),

                        AslExpr::Literal(l) => l.value.to_string(),

                        _ => "INPUT".into(),
                    })
                    .unwrap_or_else(|| "INPUT".into());

                let mode = match mode_raw.as_str() {
                    "OUTPUT" | "1" => PinModeKind::Output,

                    "INPUT" | "0" => PinModeKind::Input,

                    "INPUT_PULLUP" | "2" => PinModeKind::InputPullup,

                    _ => PinModeKind::Input,
                };

                AslStatement::PinMode(AslPinMode { pin, mode })
            }

            "delay" => {
                let ms = match args.first() {
                    Some(AslExpr::Literal(l)) => l
                        .value
                        .as_u64()
                        .or_else(|| l.value.as_f64().map(|f| f as u64))
                        .unwrap_or(0),

                    _ => 0, // Por agora simplificamos, idealmente AslDelay suportaria AslExpr
                };

                AslStatement::Delay(AslDelay {
                    duration: AslDuration::from_ms(ms),
                })
            }

            "delayMicroseconds" => AslStatement::Delay(AslDelay {
                duration: AslDuration::from_us(
                    args.first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .unwrap_or(0) as u64,
                ),
            }),

            "Serial.begin" => AslStatement::SerialBegin(AslSerialBegin {
                baud: args.first().cloned().unwrap_or(AslExpr::int(9600)),

                port: 0,
            }),

            "Serial.print" | "Serial.println" => AslStatement::Print(AslPrint {
                args,
                newline: callee.contains("println"),
            }),

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::Call(Box::new(AslCall {
                    callee: callee.to_string(),
                    args,
                })),
            }),
        }
    }

    fn collect_args(&mut self, node: Node) -> Vec<AslExpr> {
        let mut args = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            if child.is_named() {
                args.push(self.visit_expr(child));
            }
        }

        args
    }

    #[allow(dead_code)]
    fn visit_assignment_parts(&mut self, node: Node) -> (String, AslExpr) {
        let left = self
            .text(node.child_by_field_name("left").unwrap())
            .to_string();

        let right = self.visit_expr(node.child_by_field_name("right").unwrap());

        (left, right)
    }

    #[allow(dead_code)]
    fn visit_update(&self, node: Node) -> AslStatement {
        // i++ -> i = i + 1

        let text = self.text(node);

        let var = text
            .trim_end_matches("++")
            .trim_end_matches("--")
            .to_string();

        let op = if text.ends_with("++") {
            BinaryOp::Add
        } else {
            BinaryOp::Sub
        };

        AslStatement::Assign(AslAssign {
            target: var.clone(),

            value: AslExpr::Binary(Box::new(AslBinary {
                op,
                left: AslExpr::var(&var),
                right: AslExpr::int(1),
            })),
        })
    }

    fn visit_declaration(&mut self, node: Node) -> Option<AslStatement> {
        let type_node = node.child_by_field_name("type")?;

        let type_name = self.text(type_node).to_uppercase();

        let asl_type = AslType::parse(&type_name);

        let declarator = node.child_by_field_name("declarator");

        if let Some(d) = declarator {
            let name = if d.kind() == "init_declarator" {
                self.text(d.child_by_field_name("declarator").unwrap())
                    .to_string()
            } else {
                self.text(d).to_string()
            };

            let value = d.child_by_field_name("value").map(|v| self.visit_expr(v));

            Some(AslStatement::Declare(AslDeclare {
                name,
                r#type: asl_type,
                value,
                mutable: true,
                scope: "local".into(),
                ..Default::default()
            }))
        } else {
            None
        }
    }

    fn visit_if(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .or_else(|| node.named_child(0))
            .map(|c| self.visit_expr(c))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        let then_body = node
            .child_by_field_name("consequence")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        let else_body = node
            .child_by_field_name("alternative")
            .map(|b| self.visit_block(b));

        AslStatement::If(Box::new(AslIf {
            condition,
            then_body,
            else_if: vec![],
            else_body,
            ..Default::default()
        }))
    }

    fn visit_for(&mut self, node: Node) -> AslStatement {
        // C-style for

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        let init = node
            .child_by_field_name("initializer")
            .map(|n| {
                if n.kind() == "declaration" {
                    self.visit_declaration(n).into_iter().collect()
                } else {
                    vec![self.visit_expr_stmt(n)]
                }
            })
            .unwrap_or_default();

        let cond = node
            .child_by_field_name("condition")
            .map(|n| self.visit_expr(n))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        let update = node
            .child_by_field_name("update")
            .map(|n| self.visit_expr_stmt(n));

        // Simplified: Convert C for to AslWhile for now or AslFor::CStyle

        let mut loop_body = body;

        if let Some(upd) = update {
            loop_body.push(upd);
        }

        let while_loop = AslStatement::While(Box::new(AslWhile {
            condition: cond,
            body: loop_body,
        }));

        if init.is_empty() {
            while_loop
        } else {
            // Block to contain init + while

            let mut outer = init;

            outer.push(while_loop);

            AslStatement::If(Box::new(AslIf {
                condition: AslExpr::bool_val(true),

                then_body: outer,

                else_if: vec![],

                else_body: None,

                ..Default::default()
            }))
        }
    }

    fn visit_while(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| self.visit_expr(c))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        AslStatement::While(Box::new(AslWhile { condition, body }))
    }

    fn visit_do_while(&mut self, node: Node) -> AslStatement {
        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        let condition = node
            .child_by_field_name("condition")
            .map(|c| self.visit_expr(c))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        AslStatement::DoWhile(Box::new(AslDoWhile { condition, body }))
    }

    fn visit_switch(&mut self, node: Node) -> AslStatement {
        let discriminant = node
            .child_by_field_name("value")
            .map(|v| self.visit_expr(v))
            .unwrap_or_else(|| AslExpr::int(0));

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

        AslStatement::Switch(Box::new(AslSwitch {
            discriminant,
            cases,
        }))
    }

    fn visit_case(&mut self, node: Node) -> AslSwitchCase {
        let test = node
            .child_by_field_name("value")
            .map(|v| self.visit_expr(v));

        let mut body = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            body.extend(self.visit_statement(child));
        }

        AslSwitchCase { test, body }
    }

    fn visit_return(&mut self, node: Node) -> AslStatement {
        let value = node.named_child(0).map(|v| self.visit_expr(v));

        AslStatement::Return(AslReturn { value })
    }
}

impl AslFunction {
    fn params_to_decl(&self) -> Vec<AslStatement> {
        self.params
            .iter()
            .map(|p| {
                AslStatement::Declare(AslDeclare {
                    name: p.name.clone(),

                    r#type: AslType::parse(&p.r#type),

                    value: None,

                    mutable: true,

                    scope: "local".into(),

                    ..Default::default()
                })
            })
            .collect()
    }
}

//           Testes

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

}

"#;

        let prog = CParser::parse(src).expect("parse falhou");

        assert!(!prog.tasks.is_empty());

        assert!(prog.tasks.iter().any(|t| t.name == "setup"));

        assert!(prog.tasks.iter().any(|t| t.name == "loop"));
    }

    #[test]

    fn parse_serial_begin() {
        let src = r#"

void setup() { Serial.begin(9600); }

void loop() {}

"#;

        let prog = CParser::parse(src).expect("parse falhou");

        let setup_task = prog.tasks.iter().find(|t| t.name == "setup").unwrap();

        assert!(setup_task
            .body
            .iter()
            .any(|s| matches!(s, AslStatement::SerialBegin(_))));
    }
}
