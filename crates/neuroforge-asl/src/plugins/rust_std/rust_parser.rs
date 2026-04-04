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



use tree_sitter::{Node, Parser, Tree};

use crate::types::asl_types::{

    AslProgram, AslFunction, AslParam, AslStatement, AslExpr, AslMetadata,

    AslIf, AslElseIf, AslWhile, AslDoWhile, AslSwitch, AslSwitchCase,

    AslAssign, AslReturn, AslExpressionStmt, AslType, AslCall,

    AslBinary, AslUnary, AslLiteral, AslFor, AslDuration,

    AslTask, AslLog, AslPinMode, AslDigitalOutput, AslAnalogOutput,

    AslDigitalInput, AslAnalogInput, AslDelay, AslPrint, AslSerialBegin,

    PinModeKind, BinaryOp, UnaryOp, AslDeclare,

};

use crate::parser::neuro_parser::{NeuroParser, NeuroParserExt, ParseError, ParseDiagnostic, DiagnosticSeverity, normalize};



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

        Self::validate_semantics(&program).map_err(|diags: Vec<crate::parser::neuro_parser::ParseDiagnostic>| {

            ParseError::Multiple(diags.iter().map(|d| d.to_string()).collect::<Vec<_>>().join("\n"))

        })?;



        Ok(program)

    }



    fn source_language() -> &'static str { "rust" }

}



impl NeuroParserExt for RustParser {}



struct RustVisitor<'src> { source: &'src str }



impl<'src> RustVisitor<'src> {

    fn new(source: &'src str) -> Self { Self { source } }



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

                    if func.name == "main" {

                        for stmt in func.body {

                            if let AslStatement::While(w) = &stmt {

                                // infinite loop heuristic

                                if matches!(w.condition, AslExpr::Literal(ref l) if l.value.as_bool() == Some(true)) {

                                    loop_body.extend(w.body.clone());

                                    continue;

                                }

                            }

                            setup_body.push(stmt);

                        }

                    } else {

                        functions.push(func);

                    }

                }

                "const_item" | "static_item" => {

                   if let Some(stmt) = self.visit_let(child) {

                       if let AslStatement::Declare(d) = stmt {

                           globals.push(crate::types::asl_types::AslGlobalVar {

                               name: d.name, r#type: d.r#type,

                               value: d.value, mutable: d.mutable, scope: d.scope, lifecycle: d.lifecycle,

                               ..Default::default() });

                       }

                   }

                }

                _ => {}

            }

        }



        AslProgram {

            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {

                name: None, description: None, version: None,

                target_board: Some("embedded-rust".to_string()),

            },

            structs: vec![],

            globals,

            functions,

            tasks: vec![

                AslTask { name: "setup".into(), body: setup_body, ..Default::default() },

                AslTask { name: "loop".into(), body: loop_body, ..Default::default() },

            ],

            ..Default::default()

        }

    }



    fn visit_function(&mut self, node: Node) -> AslFunction {

        let name        = node.child_by_field_name("name").map(|n| self.text(n).to_string()).unwrap_or_default();

        let return_type_str = node.child_by_field_name("return_type").map(|t| self.text(t).to_uppercase()).unwrap_or_else(|| "VOID".to_string());

        let return_type = Some(AslType::from_str(&return_type_str));

        

        let params      = node.child_by_field_name("parameters").map(|p| self.visit_params(p)).unwrap_or_default();

        let body        = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();

        AslFunction {

            name, params, body, return_type, doc: None, ..Default::default() }

    }



    fn visit_params(&self, node: Node) -> Vec<AslParam> {

        let mut params = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {

            if child.kind() == "parameter" {

                let name      = child.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();

                let type_name = child.child_by_field_name("type").map(|t| self.text(t).to_uppercase()).unwrap_or_else(|| "ANY".into());

                if !matches!(name.as_str(), "self" | "&self" | "&mut self") {

                    params.push(AslParam { name, r#type: type_name, default: None , ..Default::default() });

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

        match node.kind() {

            "expression_statement"     => { 

                let inner = node.named_child(0).unwrap();

                vec![self.visit_expr_stmt(inner)]

            }

            "let_declaration"          => self.visit_let(node).into_iter().collect(),

            "if_expression"            => vec![self.visit_if(node)],

            "while_expression"         => vec![self.visit_while(node)],

            "loop_expression"          => vec![self.visit_loop(node)],

            "for_expression"           => vec![self.visit_for(node)],

            "match_expression"         => vec![self.visit_match(node)],

            "return_expression"        => vec![self.visit_return(node)],

            "break_expression"         => vec![AslStatement::Break],

            "continue_expression"      => vec![AslStatement::Continue],

            "assignment_expression"    | "compound_assignment_expr" => vec![self.visit_assignment(node)],

            _                          => vec![],

        }

    }



    fn visit_expr_stmt(&mut self, node: Node) -> AslStatement {

        match node.kind() {

            "call_expression"          => self.visit_call(node),

            "assignment_expression"    | "compound_assignment_expr" => self.visit_assignment(node),

            "macro_invocation"         => self.visit_macro(node),

            _                          => AslStatement::Expr(AslExpressionStmt { expr: self.visit_expr(node) }),

        }

    }



    fn visit_expr(&mut self, node: Node) -> AslExpr {

        match node.kind() {

            "integer_literal" => AslExpr::int(self.text(node).parse().unwrap_or(0)),

            "float_literal"   => AslExpr::float(self.text(node).parse().unwrap_or(0.0)),

            "string_literal"  => AslExpr::str_val(self.text(node).trim_matches('"')),

            "boolean_literal" => AslExpr::bool_val(self.text(node) == "true"),

            "identifier"      => AslExpr::var(self.text(node)),

            _ => AslExpr::var(self.text(node)),

        }

    }



    fn visit_call(&mut self, node: Node) -> AslStatement {

        let callee = node.child_by_field_name("function").map(|f| self.text(f).to_string()).unwrap_or_default();

        let args = node.child_by_field_name("arguments").map(|a| self.collect_args(a)).unwrap_or_default();



        match callee.as_str() {

            "gpio_set" => AslStatement::DigitalOutput(AslDigitalOutput {

                pin: args.get(0).cloned().unwrap_or(AslExpr::int(0)),

                value: args.get(1).cloned().unwrap_or(AslExpr::int(0)),

            }),

            "gpio_mode" => AslStatement::PinMode(AslPinMode {

                pin: args.get(0).cloned().unwrap_or(AslExpr::int(0)),

                mode: PinModeKind::Output, // Simplified

            }),

            "delay_ms" => AslStatement::Delay(AslDelay {

                duration: AslDuration::from_ms(args.get(0).and_then(|a| a.as_literal())

                    .and_then(|l| l.value.as_i64()).map(|v| v.max(0) as u64).unwrap_or(0)),

            }),

            _ => AslStatement::Expr(AslExpressionStmt {

                expr: AslExpr::Call(Box::new(AslCall { callee: callee.to_string(), args })),

            }),

        }

    }



    fn visit_macro(&mut self, node: Node) -> AslStatement {

        let name_str = node.child_by_field_name("macro").map(|n| self.text(n).to_string()).unwrap_or_default();

        let args = self.collect_args_from_macro(node.child_by_field_name("token_tree").unwrap());

        match name_str.as_str() {

            "println" | "print" => AslStatement::Print(AslPrint {

                args, newline: name_str == "println",

            }),

            _ => AslStatement::Expr(AslExpressionStmt { expr: AslExpr::var(self.text(node)) }),

        }

    }



    fn collect_args(&mut self, node: Node) -> Vec<AslExpr> {

        let mut args = vec![];

        let mut cursor = node.walk();

        for child in node.children(&mut cursor) {

            if child.is_named() { args.push(self.visit_expr(child)); }

        }

        args

    }

    

    fn collect_args_from_macro(&mut self, node: Node) -> Vec<AslExpr> {

        // Simplified macro arg collection

        vec![AslExpr::str_val(self.text(node).trim_matches('(').trim_matches(')'))]

    }



    fn visit_let(&mut self, node: Node) -> Option<AslStatement> {

        let name  = node.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();

        let asl_type = node.child_by_field_name("type")

            .map(|t| AslType::from_str(&self.text(t).to_uppercase()))

            .unwrap_or(AslType::Auto);

        let value = node.child_by_field_name("value").map(|v| self.visit_expr(v));

        

        Some(AslStatement::Declare(AslDeclare {

            name, r#type: asl_type, value, mutable: true, scope: "local".into(), ..Default::default()

        }))

    }



    fn visit_assignment(&mut self, node: Node) -> AslStatement {

        let target  = node.child_by_field_name("left").map(|n| self.text(n).to_string()).unwrap_or_default();

        let value = node.child_by_field_name("right").map(|n| self.visit_expr(n)).unwrap_or(AslExpr::int(0));

        AslStatement::Assign(AslAssign { target, value })

    }



    fn visit_if(&mut self, node: Node) -> AslStatement {

        let condition = node.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or(AslExpr::bool_val(true));

        let then_body = node.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();

        let else_body = node.child_by_field_name("alternative").map(|b| self.visit_block(b));

        AslStatement::If(Box::new(AslIf {

            condition, then_body, else_if: vec![], else_body, ..Default::default() }))

    }



    fn visit_while(&mut self, node: Node) -> AslStatement {

        let condition = node.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or(AslExpr::bool_val(true));

        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();

        AslStatement::While(Box::new(AslWhile { condition, body }))

    }



    fn visit_loop(&mut self, node: Node) -> AslStatement {

        let body = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();

        AslStatement::While(Box::new(AslWhile { condition: AslExpr::bool_val(true), body }))

    }



    fn visit_for(&mut self, node: Node) -> AslStatement {

        let var_name = node.child_by_field_name("pattern").map(|n| self.text(n).to_string()).unwrap_or_default();

        let iterable = node.child_by_field_name("value").map(|n| self.visit_expr(n)).unwrap_or(AslExpr::int(0));

        let body     = node.child_by_field_name("body").map(|b| self.visit_block(b)).unwrap_or_default();

        AslStatement::For(Box::new(crate::types::asl_types::AslFor::Each(crate::types::asl_types::AslForEach {

            var: var_name,

            iterable,

            body,

        })))

    }



    fn visit_match(&mut self, node: Node) -> AslStatement {

        let discriminant = node.child_by_field_name("value").map(|v| self.visit_expr(v)).unwrap_or(AslExpr::int(0));

        let mut cases = vec![];

        if let Some(body) = node.child_by_field_name("body") {

            let mut cursor = body.walk();

            for child in body.children(&mut cursor) {

                if child.kind() == "match_arm" {

                    let test = child.child_by_field_name("pattern").map(|p| self.visit_expr(p));

                    let arm_body = child.child_by_field_name("value")

                        .map(|b| if b.kind() == "block" { self.visit_block(b) } else { self.visit_statement(b) })

                        .unwrap_or_default();

                    cases.push(AslSwitchCase { test, body: arm_body });

                }

            }

        }

        AslStatement::Switch(Box::new(AslSwitch { discriminant, cases }))

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

}

















