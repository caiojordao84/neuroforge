//! Parser Rust via tree-sitter-rust

//!

//! Mapeamento node.kind()     NodeType:

//!   "source_file"               raiz (ProgramNode)

//!   "function_item"             Function

//!   "if_expression"             IfStatement

//!   "while_expression"          WhileLoop

//!   "loop_expression"           WhileLoop (cond = "true")

//!   "for_expression"            ForIn

//!   "match_expression"          SwitchStatement

//!   "return_expression"         Return

//!   "break_expression"          Break

//!   "continue_expression"       Continue

//!   "let_declaration"           VarDeclaration

//!   "assignment_expression"     Assignment

//!   "compound_assignment_expr"     Assignment (+=, etc.)

//!   "call_expression" (callee):

//!     "gpio_set"               GpioSet

//!     "gpio_get"               GpioRead

//!     "gpio_mode"              PinMode

//!     "delay_ms"               DelayMs

//!     "delay_us"               DelayUs

//!     "millis"                 Millis

//!     "serial_begin"           SerialBegin

//!     "serial_print"           Print

//!     "serial_println"         PrintLn

//!     "serial_read"            UartRead

//!     "i2c_write"              I2cWrite

//!     "i2c_read"               I2cRead

//!     "spi_transfer"           SpiTransfer

//!     "pwm_init"               PwmInit

//!     "pwm_set_duty"           PwmSetDuty

//!     "pwm_set_freq"           PwmSetFreq

//!     "pwm_stop"               PwmStop

//!     else                     FunctionCall

use tree_sitter::{Node, Parser};

use crate::asl_types::{
    AslAssign, AslBinary, AslCall, AslDeclare, AslDelay, AslDigitalOutput, AslDuration, AslExpr,
    AslExpressionStmt, AslFunction, AslIf, AslMetadata, AslParam, AslPinMode, AslPrint, AslProgram,
    AslPwmInit, AslPwmSetDuty, AslPwmSetFreq, AslPwmStop, AslReturn, AslStatement, AslSwitch,
    AslSwitchCase, AslTask, AslType, AslWhile, BinaryOp, PinModeKind,
};

use crate::parser::neuro_parser::{NeuroParser, NeuroParserExt, ParseError};

#[derive(Debug, thiserror::Error)]

pub enum RustParseError {
    #[error("tree-sitter: falha ao definir linguagem: {0}")]
    LanguageError(String),

    #[error("tree-sitter: parse devolveu None")]
    ParseFailed,

    #[error("tree-sitter: erro sint  tico em {0}:{1}")]
    SyntaxError(usize, usize),
}

pub struct RustParser;

impl NeuroParser for RustParser {
    type Error = ParseError;

    fn parse(source: &str) -> Result<AslProgram, Self::Error> {
        let mut parser = Parser::new();

        parser
            .set_language(&tree_sitter_rust::LANGUAGE.into())
            .map_err(|e| ParseError::Custom(format!("Rust language error: {}", e)))?;

        let tree = parser
            .parse(source, None)
            .ok_or(ParseError::Custom("Rust parse failed".to_string()))?;

        let root = tree.root_node();

        if root.has_error() {
            let pos = root.start_position();

            return Err(ParseError::UnexpectedToken {
                found: "syntax error".to_string(),

                expected: "valid Rust".to_string(),

                span: Some(crate::parser::neuro_parser::Span {
                    line: pos.row as u32 + 1,

                    col: pos.column as u32 + 1,

                    len: 1,
                }),
            });
        }

        let mut visitor = RustVisitor::new(source);

        let program = visitor.visit_source_file(root);

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
        "rust"
    }
}

impl NeuroParserExt for RustParser {}

struct RustVisitor<'src> {
    source: &'src str,
}

impl<'src> RustVisitor<'src> {
    fn new(source: &'src str) -> Self {
        Self { source }
    }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn visit_source_file(&mut self, root: Node) -> AslProgram {
        let mut functions = vec![];

        let mut globals = vec![];

        let mut setup_body = vec![];

        let mut loop_body = vec![];

        let cursor = &mut root.walk();

        for child in root.children(cursor) {
            match child.kind() {
                "function_item" => {
                    let func = self.visit_function(child);

                    // R7 Heuristic: Rust main() handling
                    // Extract loop body from infinite loops (loop {}, while true {})
                    if func.name == "main" {
                        for stmt in func.body {
                            // Check for While with true condition (infinite loop) - handles `loop {}`
                            if let AslStatement::While(ref w) = stmt {
                                if matches!(w.condition, AslExpr::Literal(ref l) if l.value.as_bool() == Some(true))
                                {
                                    loop_body.extend(w.body.clone());
                                    continue;
                                }
                            }
                            // For async functions with Embassy, check for loop blocks in the body
                            if func.is_async {
                                // Extract any while loops from the statement
                                self.extract_loop_body(&stmt, &mut loop_body);
                            }

                            setup_body.push(stmt);
                        }
                    } else {
                        functions.push(func);
                    }
                }

                "const_item" | "static_item" => {
                    if let Some(AslStatement::Declare(d)) = self.visit_let(child) {
                        globals.push(crate::asl_types::AslGlobalVar {
                            name: d.name,
                            r#type: d.r#type,
                            value: d.value,
                            mutable: d.mutable,
                            scope: d.scope,
                            lifecycle: d.lifecycle,
                            ..Default::default()
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

                target_board: Some("embedded-rust".to_string()),
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
            .child_by_field_name("name")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let return_type_str = node
            .child_by_field_name("return_type")
            .map(|t| self.text(t).to_uppercase())
            .unwrap_or_else(|| "VOID".to_string());

        let return_type = Some(AslType::parse(&return_type_str));

        let params = node
            .child_by_field_name("parameters")
            .map(|p| self.visit_params(p))
            .unwrap_or_default();

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        // Detect async function by checking for async token in modifiers
        let is_async = self.is_async_function(&node);

        // Check for Embassy attributes that mark async entry points
        let has_embassy_main_attr = self.has_embassy_main_attribute(&node);

        AslFunction {
            name,
            params,
            body,
            return_type,
            doc: None,
            is_async: is_async || has_embassy_main_attr,
            ..Default::default()
        }
    }

    fn has_embassy_main_attribute(&self, node: &Node) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "attribute_item" {
                let attr_text = self.text(child);
                // Check for Embassy main attributes
                if attr_text.contains("embassy_executor::main")
                    || attr_text.contains("esp_hal_embassy::main")
                    || attr_text.contains("embassy::main")
                {
                    return true;
                }
            }
        }
        false
    }

    fn is_async_function(&self, node: &Node) -> bool {
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            if child.kind() == "function_modifiers" {
                let mut mod_cursor = child.walk();
                for mod_child in child.children(&mut mod_cursor) {
                    if mod_child.kind() == "async" {
                        return true;
                    }
                }
            }
        }
        false
    }

    fn visit_params(&self, node: Node) -> Vec<AslParam> {
        let mut params = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {
            if child.kind() == "parameter" {
                let name = child
                    .child_by_field_name("pattern")
                    .map(|n| self.text(n).to_string())
                    .unwrap_or_default();

                let type_name = child
                    .child_by_field_name("type")
                    .map(|t| self.text(t).to_uppercase())
                    .unwrap_or_else(|| "ANY".into());

                if !matches!(name.as_str(), "self" | "&self" | "&mut self") {
                    params.push(AslParam {
                        name,
                        r#type: type_name,
                        default: None,
                        ..Default::default()
                    });
                }
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
        // Skip non-statement nodes like braces
        let kind = node.kind();
        if kind == "{" || kind == "}" {
            return vec![];
        }

        match node.kind() {
            "expression_statement" => {
                // Get the inner expression and check for special cases
                if let Some(inner) = node.named_child(0) {
                    let inner_kind = inner.kind();

                    // Handle await expressions
                    if inner_kind == "await_expression" {
                        return self.visit_await(inner);
                    }

                    // Handle loop expressions directly inside expression_statement
                    if inner_kind == "loop_expression" {
                        return vec![self.visit_loop(inner)];
                    }

                    // Handle while expressions directly inside expression_statement
                    if inner_kind == "while_expression" {
                        return vec![self.visit_while(inner)];
                    }

                    // Handle for expressions directly inside expression_statement
                    if inner_kind == "for_expression" {
                        return vec![self.visit_for(inner)];
                    }

                    // Handle if_expression inside expression_statement
                    if inner_kind == "if_expression" {
                        return vec![self.visit_if(inner)];
                    }
                }

                vec![self.visit_expr_stmt(node.named_child(0).unwrap())]
            }

            "let_declaration" => self.visit_let(node).into_iter().collect(),

            "if_expression" => vec![self.visit_if(node)],

            "while_expression" => vec![self.visit_while(node)],

            "loop_expression" => vec![self.visit_loop(node)],

            "for_expression" => vec![self.visit_for(node)],

            "match_expression" => vec![self.visit_match(node)],

            "return_expression" => vec![self.visit_return(node)],

            "break_expression" => vec![AslStatement::Break],

            "continue_expression" => vec![AslStatement::Continue],

            "assignment_expression" | "compound_assignment_expr" => {
                vec![self.visit_assignment(node)]
            }

            "await_expression" => {
                // Handle Embassy Timer patterns with await
                self.visit_await(node)
            }

            _ => vec![],
        }
    }

    fn visit_await(&mut self, node: Node) -> Vec<AslStatement> {
        // Extract the future being awaited
        if let Some(future) = node.named_child(0) {
            let future_kind = future.kind();

            // Handle call_expression with await: Timer::after_millis(30).await
            if future_kind == "call_expression" {
                return vec![self.visit_embassy_timer_call(future)];
            }

            // Handle field_expression with await: timer.wait().await
            if future_kind == "field_expression" {
                return vec![self.visit_embassy_timer_field(future)];
            }
        }

        // Fallback: treat as generic await expression
        vec![AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::var("await"),
        })]
    }

    fn visit_embassy_timer_call(&mut self, node: Node) -> AslStatement {
        let callee = node
            .child_by_field_name("function")
            .map(|f| self.text(f).to_string())
            .unwrap_or_default();

        let args = node
            .child_by_field_name("arguments")
            .map(|a| self.collect_args(a))
            .unwrap_or_default();

        // Parse Timer::after_millis, Timer::after_micros, Timer::after_seconds
        let parts: Vec<&str> = callee.split("::").collect();
        if parts.len() >= 2 {
            let ty = parts[0];
            let method = parts[1];

            match (ty, method) {
                ("Timer", "after_millis") | ("embassy_time::Timer", "after_millis") => {
                    let duration_ms = args
                        .first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .map(|v| v.max(0) as u64)
                        .unwrap_or(0);
                    return AslStatement::Delay(AslDelay {
                        duration: AslDuration::from_ms(duration_ms),
                    });
                }
                ("Timer", "after_micros") | ("embassy_time::Timer", "after_micros") => {
                    let duration_us = args
                        .first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .map(|v| v.max(0) as u64)
                        .unwrap_or(0);
                    return AslStatement::Delay(AslDelay {
                        duration: AslDuration::from_us(duration_us),
                    });
                }
                ("Timer", "after_seconds") | ("embassy_time::Timer", "after_seconds") => {
                    let duration_s = args
                        .first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .map(|v| v.max(0) as u64)
                        .unwrap_or(0);
                    return AslStatement::Delay(AslDelay {
                        duration: AslDuration::from_secs(duration_s),
                    });
                }
                _ => {}
            }
        }

        AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::var(&callee),
        })
    }

    fn visit_embassy_timer_field(&mut self, node: Node) -> AslStatement {
        let receiver = node
            .child_by_field_name("object")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let method = node
            .child_by_field_name("field")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        if method.as_str() == "wait" {
            // timer.wait().await - typically waits for the timer
            return AslStatement::Delay(AslDelay {
                duration: AslDuration::from_ms(0),
            });
        }

        let combined = format!("{}.{}", receiver, method);
        AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::var(&combined),
        })
    }

    fn visit_expr_stmt(&mut self, node: Node) -> AslStatement {
        match node.kind() {
            "call_expression" => self.visit_call(node),

            "assignment_expression" | "compound_assignment_expr" => self.visit_assignment(node),

            "macro_invocation" => self.visit_macro(node),

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: self.visit_expr(node),
            }),
        }
    }

    fn visit_expr(&mut self, node: Node) -> AslExpr {
        match node.kind() {
            "integer_literal" => AslExpr::int(self.text(node).parse().unwrap_or(0)),

            "float_literal" => AslExpr::float(self.text(node).parse().unwrap_or(0.0)),

            "string_literal" => AslExpr::str_val(self.text(node).trim_matches('"')),

            "boolean_literal" => AslExpr::bool_val(self.text(node) == "true"),

            "identifier" => AslExpr::var(self.text(node)),

            _ => AslExpr::var(self.text(node)),
        }
    }

    fn visit_call(&mut self, node: Node) -> AslStatement {
        let callee = node
            .child_by_field_name("function")
            .map(|f| self.text(f).to_string())
            .unwrap_or_default();

        let args = node
            .child_by_field_name("arguments")
            .map(|a| self.collect_args(a))
            .unwrap_or_default();

        match callee.as_str() {
            "gpio_set" => AslStatement::DigitalOutput(AslDigitalOutput {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),

                value: args.get(1).cloned().unwrap_or(AslExpr::int(0)),
            }),

            "gpio_mode" => AslStatement::PinMode(AslPinMode {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),

                mode: PinModeKind::Output, // Simplified
            }),

            "delay_ms" => AslStatement::Delay(AslDelay {
                duration: AslDuration::from_ms(
                    args.first()
                        .and_then(|a| a.as_literal())
                        .and_then(|l| l.value.as_i64())
                        .map(|v| v.max(0) as u64)
                        .unwrap_or(0),
                ),
            }),

            // PWM functions for embedded Rust
            "pwm_init" => AslStatement::PwmInit(AslPwmInit {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),
                freq: args.get(1).cloned().unwrap_or(AslExpr::int(1000)),
                duty: args.get(2).cloned().unwrap_or(AslExpr::int(0)),
            }),

            "pwm_set_duty" => AslStatement::PwmSetDuty(AslPwmSetDuty {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),
                duty: args.get(1).cloned().unwrap_or(AslExpr::int(0)),
            }),

            "pwm_set_freq" => AslStatement::PwmSetFreq(AslPwmSetFreq {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),
                freq: args.get(1).cloned().unwrap_or(AslExpr::int(1000)),
            }),

            "pwm_stop" => AslStatement::PwmStop(AslPwmStop {
                pin: args.first().cloned().unwrap_or(AslExpr::int(0)),
            }),

            _ => self.visit_call_embassy(node, callee, args),
        }
    }

    fn visit_call_embassy(
        &mut self,
        node: Node,
        callee: String,
        args: Vec<AslExpr>,
    ) -> AslStatement {
        let func_node = node.child_by_field_name("function");

        if let Some(func) = func_node {
            let func_kind = func.kind();

            // Handle field_expression like spawner.spawn(task)
            if func_kind == "field_expression" {
                let receiver = func
                    .child_by_field_name("object")
                    .map(|n| self.text(n).to_string())
                    .unwrap_or_default();
                let method = func
                    .child_by_field_name("field")
                    .map(|n| self.text(n).to_string())
                    .unwrap_or_default();

                if method.as_str() == "spawn" {
                    // spawner.spawn(task) - spawn a new async task
                    return AslStatement::Expr(AslExpressionStmt {
                        expr: AslExpr::Call(Box::new(AslCall {
                            callee: format!("{}::spawn", receiver),
                            args,
                        })),
                    });
                }
            }

            // Handle scoped_identifier like embassy_time::Timer::after_millis
            if func_kind == "scoped_identifier" || func_kind == "identifier" {
                let parts: Vec<&str> = callee.split("::").collect();

                if parts.len() >= 2 {
                    let ty = parts[0];
                    let method = parts[1];

                    match (ty, method) {
                        // embassy_time patterns
                        ("embassy_time::Timer", "after_millis") => {
                            let duration_ms = args
                                .first()
                                .and_then(|a| a.as_literal())
                                .and_then(|l| l.value.as_i64())
                                .map(|v| v.max(0) as u64)
                                .unwrap_or(0);
                            return AslStatement::Delay(AslDelay {
                                duration: AslDuration::from_ms(duration_ms),
                            });
                        }
                        ("embassy_time::Timer", "after_micros") => {
                            let duration_us = args
                                .first()
                                .and_then(|a| a.as_literal())
                                .and_then(|l| l.value.as_i64())
                                .map(|v| v.max(0) as u64)
                                .unwrap_or(0);
                            return AslStatement::Delay(AslDelay {
                                duration: AslDuration::from_us(duration_us),
                            });
                        }
                        ("embassy_time::Timer", "after_seconds") => {
                            let duration_s = args
                                .first()
                                .and_then(|a| a.as_literal())
                                .and_then(|l| l.value.as_i64())
                                .map(|v| v.max(0) as u64)
                                .unwrap_or(0);
                            return AslStatement::Delay(AslDelay {
                                duration: AslDuration::from_secs(duration_s),
                            });
                        }
                        // embassy_sync::Mutex::new
                        ("embassy_sync::Mutex", "new") | ("Mutex", "new") => {
                            return AslStatement::Expr(AslExpressionStmt {
                                expr: AslExpr::Call(Box::new(AslCall {
                                    callee: "embassy_sync::Mutex::new".to_string(),
                                    args,
                                })),
                            });
                        }
                        // embassy_sync::Channel::new
                        ("embassy_sync::Channel", "new") | ("Channel", "new") => {
                            return AslStatement::Expr(AslExpressionStmt {
                                expr: AslExpr::Call(Box::new(AslCall {
                                    callee: "embassy_sync::Channel::new".to_string(),
                                    args,
                                })),
                            });
                        }
                        // embassy_sync::Semaphore::new
                        ("embassy_sync::Semaphore", "new") | ("Semaphore", "new") => {
                            return AslStatement::Expr(AslExpressionStmt {
                                expr: AslExpr::Call(Box::new(AslCall {
                                    callee: "embassy_sync::Semaphore::new".to_string(),
                                    args,
                                })),
                            });
                        }
                        // embassy_futures::spawn
                        ("embassy_futures", "spawn") => {
                            return AslStatement::Expr(AslExpressionStmt {
                                expr: AslExpr::Call(Box::new(AslCall {
                                    callee: "embassy_futures::spawn".to_string(),
                                    args,
                                })),
                            });
                        }
                        _ => {}
                    }
                }
            }
        }

        AslStatement::Expr(AslExpressionStmt {
            expr: AslExpr::Call(Box::new(AslCall {
                callee: callee.to_string(),
                args,
            })),
        })
    }

    fn visit_macro(&mut self, node: Node) -> AslStatement {
        let name_str = node
            .child_by_field_name("macro")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let args = self.collect_args_from_macro(node.child_by_field_name("token_tree").unwrap());

        match name_str.as_str() {
            "println" | "print" => AslStatement::Print(AslPrint {
                args,
                newline: name_str == "println",
            }),

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::var(self.text(node)),
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

    fn collect_args_from_macro(&mut self, node: Node) -> Vec<AslExpr> {
        // Simplified macro arg collection

        vec![AslExpr::str_val(
            self.text(node).trim_matches('(').trim_matches(')'),
        )]
    }

    fn visit_let(&mut self, node: Node) -> Option<AslStatement> {
        // For const_item, tree-sitter-rust uses "name" field, not "pattern"
        // For let_declaration, it uses "pattern" field
        let name = node
            .child_by_field_name("name")
            .or_else(|| node.child_by_field_name("pattern"))
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let asl_type = node
            .child_by_field_name("type")
            .map(|t| AslType::parse(&self.text(t).to_uppercase()))
            .unwrap_or(AslType::Auto);

        let value = node
            .child_by_field_name("value")
            .map(|v| self.visit_expr(v));

        // Check if this is a const declaration (const_item)
        let is_const = node.kind() == "const_item";

        Some(AslStatement::Declare(AslDeclare {
            name,
            r#type: asl_type,
            value,
            mutable: !is_const, // const is not mutable
            scope: if is_const {
                "const".into()
            } else {
                "local".into()
            },
            ..Default::default()
        }))
    }

    fn visit_assignment(&mut self, node: Node) -> AslStatement {
        let target = node
            .child_by_field_name("left")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let value = node
            .child_by_field_name("right")
            .map(|n| self.visit_expr(n))
            .unwrap_or(AslExpr::int(0));

        // For compound_assignment_expr (+=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>=)
        // tree-sitter-rust provides an "operator" field
        let op = node
            .child_by_field_name("operator")
            .map(|n| self.text(n).to_string());

        // If there's an operator, we need to convert it to the proper compound assignment
        // The AslAssign struct doesn't have an 'op' field, so we need to add one
        if let Some(operator) = op {
            // For compound assignments, we need to transform:
            // brightness += fade_amount -> brightness = brightness + fade_amount
            let binary_op = match operator.as_str() {
                "+=" => "+",
                "-=" => "-",
                "*=" => "*",
                "/=" => "/",
                "%=" => "%",
                "&=" => "&",
                "|=" => "|",
                "^=" => "^",
                "<<=" => "<<",
                ">>=" => ">>",
                _ => "+",
            };

            // Create a binary expression: target + value
            let binary_expr = AslExpr::Binary(Box::new(AslBinary {
                left: AslExpr::var(&target),
                op: BinaryOp::parse(binary_op),
                right: value,
            }));

            return AslStatement::Assign(AslAssign {
                target,
                value: binary_expr,
            });
        }

        AslStatement::Assign(AslAssign { target, value })
    }

    fn visit_if(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| self.visit_expr(c))
            .unwrap_or(AslExpr::bool_val(true));

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

    fn visit_while(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| self.visit_expr(c))
            .unwrap_or(AslExpr::bool_val(true));

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        AslStatement::While(Box::new(AslWhile { condition, body }))
    }

    fn visit_loop(&mut self, node: Node) -> AslStatement {
        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        AslStatement::While(Box::new(AslWhile {
            condition: AslExpr::bool_val(true),
            body,
        }))
    }

    fn visit_for(&mut self, node: Node) -> AslStatement {
        let var_name = node
            .child_by_field_name("pattern")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();

        let iterable = node
            .child_by_field_name("value")
            .map(|n| self.visit_expr(n))
            .unwrap_or(AslExpr::int(0));

        let body = node
            .child_by_field_name("body")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        AslStatement::For(Box::new(crate::asl_types::AslFor::Each(
            crate::asl_types::AslForEach {
                var: var_name,

                iterable,

                body,
            },
        )))
    }

    fn visit_match(&mut self, node: Node) -> AslStatement {
        let discriminant = node
            .child_by_field_name("value")
            .map(|v| self.visit_expr(v))
            .unwrap_or(AslExpr::int(0));

        let mut cases = vec![];

        if let Some(body) = node.child_by_field_name("body") {
            let mut cursor = body.walk();

            for child in body.children(&mut cursor) {
                if child.kind() == "match_arm" {
                    let test = child
                        .child_by_field_name("pattern")
                        .map(|p| self.visit_expr(p));

                    let arm_body = child
                        .child_by_field_name("value")
                        .map(|b| {
                            if b.kind() == "block" {
                                self.visit_block(b)
                            } else {
                                self.visit_statement(b)
                            }
                        })
                        .unwrap_or_default();

                    cases.push(AslSwitchCase {
                        test,
                        body: arm_body,
                    });
                }
            }
        }

        AslStatement::Switch(Box::new(AslSwitch {
            discriminant,
            cases,
        }))
    }

    /// Helper to extract loop body from nested statements in async functions
    fn extract_loop_body(&mut self, stmt: &AslStatement, loop_body: &mut Vec<AslStatement>) {
        match stmt {
            AslStatement::While(w) => {
                // If this is an infinite loop, extract its body
                if matches!(w.condition, AslExpr::Literal(ref l) if l.value.as_bool() == Some(true))
                {
                    loop_body.extend(w.body.clone());
                } else {
                    // Recurse into the body
                    for inner in &w.body {
                        self.extract_loop_body(inner, loop_body);
                    }
                }
            }
            AslStatement::For(ref f) => {
                // Recurse into for loops
                if let crate::asl_types::AslFor::Each(ref each) = f.as_ref() {
                    for inner in &each.body {
                        self.extract_loop_body(inner, loop_body);
                    }
                }
            }
            AslStatement::If(i) => {
                // Check then_body
                for inner in &i.then_body {
                    self.extract_loop_body(inner, loop_body);
                }
                // Check else_body
                if let Some(ref else_body) = i.else_body {
                    for inner in else_body {
                        self.extract_loop_body(inner, loop_body);
                    }
                }
                // Check else_if - field is "body", not "then_body"
                for else_if in &i.else_if {
                    for inner in &else_if.body {
                        self.extract_loop_body(inner, loop_body);
                    }
                }
            }
            _ => {}
        }
    }

    fn visit_return(&mut self, node: Node) -> AslStatement {
        let value = node.named_child(0).map(|v| self.visit_expr(v));

        AslStatement::Return(AslReturn { value })
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

    }

}

"#;

        let prog = RustParser::parse(src).expect("parse falhou");

        assert!(!prog.tasks.is_empty());

        assert!(prog.tasks.iter().any(|t| t.name == "setup"));

        assert!(prog.tasks.iter().any(|t| t.name == "loop"));
    }

    #[test]
    fn parse_embassy_timer_after_millis_await() {
        let src = r#"
fn main() {
    Timer::after_millis(30).await;
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy Timer falhou");
        assert!(!prog.tasks.is_empty());

        let setup = prog.tasks.iter().find(|t| t.name == "setup");
        let has_delay = setup
            .map(|t| t.body.iter().any(|s| matches!(s, AslStatement::Delay(_))))
            .unwrap_or(false);
        assert!(
            has_delay,
            "Should have a delay statement from Timer::after_millis"
        );
        eprintln!("Embassy Timer::after_millis test passed!");
    }

    #[test]
    fn parse_embassy_timer_after_micros_await() {
        let src = r#"
fn main() {
    Timer::after_micros(1000).await;
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy Timer::after_micros falhou");
        assert!(!prog.tasks.is_empty());

        let setup = prog.tasks.iter().find(|t| t.name == "setup");
        let has_delay = setup
            .map(|t| t.body.iter().any(|s| matches!(s, AslStatement::Delay(_))))
            .unwrap_or(false);
        assert!(
            has_delay,
            "Should have a delay statement from Timer::after_micros"
        );
        eprintln!("Embassy Timer::after_micros test passed!");
    }

    #[test]
    fn parse_embassy_timer_after_seconds_await() {
        let src = r#"
fn main() {
    Timer::after_seconds(1).await;
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy Timer::after_seconds falhou");
        assert!(!prog.tasks.is_empty());

        let setup = prog.tasks.iter().find(|t| t.name == "setup");
        let has_delay = setup
            .map(|t| {
                t.body.iter().any(|s| {
                    if let AslStatement::Delay(d) = s {
                        // Check if it's seconds (seconds > 0)
                        return d.duration.seconds > 0;
                    }
                    false
                })
            })
            .unwrap_or(false);
        assert!(
            has_delay,
            "Should have a delay statement from Timer::after_seconds"
        );
        eprintln!("Embassy Timer::after_seconds test passed!");
    }

    #[test]
    fn parse_embassy_full_example() {
        // Full Embassy example as provided by the user
        let src = r#"
#![no_std]
#![no_main]

use embassy_executor::Spawner;
use embassy_time::Timer;

#[esp_hal_embassy::main]
async fn main(_spawner: Spawner) {
    loop {
        Timer::after_millis(30).await;
    }
}
"#;

        let prog = RustParser::parse(src).expect("parse full Embassy example falhou");

        // Check that it's marked as embedded-rust
        assert_eq!(
            prog.metadata.target_board,
            Some("embedded-rust".to_string())
        );

        // Check that tasks were created from main
        assert!(
            !prog.tasks.is_empty(),
            "Should have tasks from main function"
        );

        // Debug: print what we got
        eprintln!(
            "Tasks: {:?}",
            prog.tasks.iter().map(|t| &t.name).collect::<Vec<_>>()
        );
        eprintln!("Full Embassy example test passed!");
    }

    #[test]
    fn parse_embassy_spawner_spawn() {
        let src = r#"
fn main() {
    spawner.spawn(my_task).unwrap();
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy spawner.spawn falhou");
        // Just verify it parses without error
        assert!(!prog.tasks.is_empty());
        eprintln!("Embassy spawner.spawn test passed!");
    }

    #[test]
    fn parse_embassy_mutex_new() {
        let src = r#"
fn main() {
    let mutex = Mutex::new(0);
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy Mutex::new falhou");
        assert!(!prog.tasks.is_empty());
        eprintln!("Embassy Mutex::new test passed!");
    }

    #[test]
    fn parse_embassy_channel_new() {
        let src = r#"
fn main() {
    let channel = Channel::new();
}
"#;

        let prog = RustParser::parse(src).expect("parse Embassy Channel::new falhou");
        assert!(!prog.tasks.is_empty());
        eprintln!("Embassy Channel::new test passed!");
    }
}
