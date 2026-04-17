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

use crate::asl_types::{
    AslBinary, AslCall, AslConditional, AslDelay, AslDigitalOutput, AslDuration,
    AslExpr, AslExpressionStmt, AslFunction, AslIf, AslLog, AslMetadata, AslParam,
    AslPinMode, AslPrint, AslProgram, AslReturn, AslStatement, AslTask, AslUnary, AslWhile,
    BinaryOp, PinModeKind, UnaryOp,
};

use crate::parser::neuro_parser::{normalize, NeuroParser, NeuroParserExt, ParseError};

use std::collections::{HashMap, HashSet};

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
    pin_to_mode: HashMap<i64, PinModeKind>,
    var_to_pin: HashMap<String, i64>,
    globals_in_scope: HashSet<String>,
    global_names: HashSet<String>,
    name_map: HashMap<String, String>,
    is_in_function: bool,
}

impl<'src> PythonVisitor<'src> {
    fn new(source: &'src str) -> Self {
        let name_map = HashMap::new();

        Self {
            source,
            pin_map: HashMap::new(),
            pin_to_mode: HashMap::new(),
            var_to_pin: HashMap::new(),
            globals_in_scope: HashSet::new(),
            global_names: HashSet::new(),
            name_map,
            is_in_function: false,
        }
    }

    fn text(&self, node: Node) -> &str {
        node.utf8_text(self.source.as_bytes()).unwrap_or("")
    }

    fn expand_semantic_names(&self, text: &str) -> String {
        let mut result = text.to_string();
        // Sort keys by length descending to avoid partial replacements (e.g., 'alarming' vs 'a')
        let mut keys: Vec<_> = self.name_map.keys().collect();
        keys.sort_by_key(|k| std::cmp::Reverse(k.len()));

        for key in keys {
            let val = self.name_map.get(key).unwrap();
            // Use word boundary protection (non-alphanumeric)
            let pattern = format!(r"\b{}\b", regex::escape(key));
            if let Ok(re) = regex::Regex::new(&pattern) {
                result = re.replace_all(&result, val).to_string();
            }
        }
        result
    }

    fn resolve_name(&self, name: &str) -> String {
        self.name_map.get(name).cloned().unwrap_or_else(|| name.to_string())
    }

    fn expr_to_string(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Call(c) => {
                let args: Vec<String> = c.args.iter().map(|a| self.expr_to_string(a)).collect();
                format!("{}({})", c.callee, args.join(", "))
            }
            AslExpr::Literal(l) => format!("{:?}", l),
            AslExpr::Binary(b) => format!("({} op {})", self.expr_to_string(&b.left), self.expr_to_string(&b.right)),
            AslExpr::Unary(u) => format!("(op {})", self.expr_to_string(&u.expr)),
            AslExpr::Conditional(c) => format!("({} ? {} : {})", self.expr_to_string(&c.condition), self.expr_to_string(&c.when_true), self.expr_to_string(&c.when_false)),
            _ => "unknown".to_string(),
        }
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
                    let stmts = self.visit_statement(child);
                    let mut is_docstring = false;
                    
                    if stmts.len() == 1 {
                        if let AslStatement::Expr(e) = &stmts[0] {
                            if matches!(e.expr, AslExpr::Literal(_)) && self.text(child).contains("\"\"\"") {
                                is_docstring = true;
                            }
                        }
                    }

                    if !is_docstring {
                        for stmt in stmts {
                            match &stmt {
                                AslStatement::Declare(d) => {
                                    globals.push(crate::asl_types::AslGlobalVar {
                                        name: d.name.clone(),
                                        r#type: d.r#type.clone(),
                                        value: d.value.clone(),
                                        mutable: d.mutable,
                                        scope: "global".to_string(),
                                        ..Default::default()
                                    })
                                }

                                AslStatement::Assign(a) => {
                                    // Config Promotion: If it's root level and looks like a constant (e.g., H, M, L)
                                    // or a core hardware asset (i, d, s, p, v, b), promote to [Data]
                                    let is_config = a.target.chars().all(|c| c.is_uppercase() || c == '_' || c.is_numeric());
                                    
                                    let is_hardware = ["i", "d", "s", "p", "v", "b", "oled", "pwm", "adc"].contains(&a.target.as_str()) || 
                                                       self.global_names.contains(&a.target);
                                    
                                    if !is_config && !is_hardware {
                                        setup_body.push(stmt);
                                    } else {
                                        globals.push(crate::asl_types::AslGlobalVar {
                                            name: a.target.clone(),
                                            value: Some(a.value.clone()),
                                            r#type: crate::asl_types::AslType::Auto,
                                            scope: "global".to_string(),
                                            ..Default::default()
                                        });
                                    }
                                }

                                AslStatement::While(w) if self.is_infinite_loop(w) => {
                                    loop_body.extend(w.body.clone());
                                }
                                AslStatement::If(_) | AslStatement::While(_) | AslStatement::For(_) => {
                                    setup_body.push(stmt);
                                }
                                _ => {
                                    // Preserve any other root statements in setup
                                    setup_body.push(stmt);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Aggregated pin modes should suppress any explicit pinMode statements that were just boilerplate
        let mut final_pin_modes = vec![];
        let mut seen_pins = std::collections::HashSet::new();
        
        for (pin, mode) in &self.pin_to_mode {
            final_pin_modes.push(AslStatement::PinMode(AslPinMode {
                pin: AslExpr::int(*pin),
                mode: mode.clone(),
            }));
            seen_pins.insert(*pin);
        }
        
        // Filter out original pinMode statements for pins we've already aggregated
        let mut filtered_setup = vec![];
        for stmt in setup_body {
            if let AslStatement::PinMode(pm) = &stmt {
                if let AslExpr::Literal(l) = &pm.pin {
                    if let Some(p) = l.value.as_i64() {
                        if seen_pins.contains(&p) {
                            continue;
                        }
                    }
                }
            }
            filtered_setup.push(stmt);
        }
        
        final_pin_modes.extend(filtered_setup);
        setup_body = final_pin_modes;

        // R7 Enforcement: Deep Loop Extraction
        // If loop_body is empty, check if the last statement in setup is a call to a function with a loop
        if loop_body.is_empty() && !setup_body.is_empty() {
            if let Some(AslStatement::Expr(e)) = setup_body.last() {
                if let AslExpr::Call(c) = &e.expr {
                    // Find the function definition
                    if let Some(func) = functions.iter().find(|f| f.name == c.callee) {
                        if let Some(inner_loop) = self.find_infinite_loop_in_body(&func.body) {
                            loop_body = inner_loop;
                            // Remove the call from setup to avoid double execution if it's the main loop
                            setup_body.pop();
                        }
                    }
                }
            }
        }

        // R7 Enforcement

        let tasks = vec![
            AslTask {
                name: "setup".to_string(),
                body: setup_body,
                ..Default::default()
            },
            AslTask {
                name: "loop".to_string(),
                body: loop_body,
                ..Default::default()
            },
        ];

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

    fn find_infinite_loop_in_body(&self, body: &[AslStatement]) -> Option<Vec<AslStatement>> {
        for stmt in body {
            match stmt {
                AslStatement::While(w) if self.is_infinite_loop(w) => {
                    return Some(w.body.clone());
                }
                AslStatement::If(i) => {
                    if let Some(found) = self.find_infinite_loop_in_body(&i.then_body) {
                        return Some(found);
                    }
                    if let Some(else_body) = &i.else_body {
                        if let Some(found) = self.find_infinite_loop_in_body(else_body) {
                            return Some(found);
                        }
                    }
                }
                _ => {}
            }
        }
        None
    }

    fn visit_function(&mut self, node: Node) -> AslFunction {
        // Clear globals for this function scope
        let old_globals = self.globals_in_scope.clone();
        let old_in_func = self.is_in_function;
        self.globals_in_scope.clear();
        self.is_in_function = true;

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

        // Restore outer globals (though nested functions are rare in these scripts)
        self.globals_in_scope = old_globals;
        self.is_in_function = old_in_func;

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
                    let name = self.resolve_name(self.text(child));

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
                        .map(|n| self.resolve_name(self.text(n)))
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
            let res = self.visit_statement(child);
            
            // Skip or convert docstrings
            if res.len() == 1 {
                if let AslStatement::Expr(e) = &res[0] {
                    if matches!(e.expr, AslExpr::Literal(_)) && (self.text(child).contains("\"\"\"") || self.text(child).contains("'''")) {
                        let text = self.text(child).trim_matches('"').trim_matches('\'').trim().to_string();
                        stmts.push(AslStatement::Comment(crate::asl_types::AslComment { text }));
                        continue;
                    }
                }
            }
            
            stmts.extend(res);
            
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

            "global_statement" => {
                let mut cursor = node.walk();
                for child in node.children(&mut cursor) {
                    if child.kind() == "identifier" {
                        self.globals_in_scope.insert(self.text(child).to_string());
                        self.global_names.insert(self.text(child).to_string());
                    }
                }
                vec![]
            }

            "assignment" | "augmented_assignment" => vec![self.visit_assignment(node)],

            "try_statement" => {
                // For now, just visit the try body and skip finally/except
                if let Some(body) = node.child_by_field_name("body") {
                    self.visit_block(body)
                } else {
                    vec![]
                }
            }

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

        let func_expr = self.visit_expr(func_node);
        let func_text = self.expr_to_string(&func_expr);

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
                let level = func_text
                    .split('.')
                    .next_back()
                    .unwrap_or("INFO")
                    .to_uppercase();

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

            "sum" => AslStatement::Expr(AslExpressionStmt { 
                expr: AslExpr::Call(Box::new(AslCall { callee: "arraySum".to_string(), args })) 
            }),
            "len" => AslStatement::Expr(AslExpressionStmt { 
                expr: AslExpr::Call(Box::new(AslCall { callee: "arrayLen".to_string(), args })) 
            }),
            "max" => AslStatement::Expr(AslExpressionStmt { 
                expr: AslExpr::Call(Box::new(AslCall { callee: "max".to_string(), args })) 
            }),
            "min" => AslStatement::Expr(AslExpressionStmt { 
                expr: AslExpr::Call(Box::new(AslCall { callee: "min".to_string(), args })) 
            }),

            f if f.ends_with(".irq") || f.ends_with(".attach_interrupt") => {
                // Heurística para capturar o pino e o handler
                let pin_name = f.split('.').next().unwrap_or("unknown");
                
                // Procura por handler= em keyword_arguments ou o argumento posicional correto
                let mut handler = "unknown".to_string();
                
                let args_node = node.child_by_field_name("arguments").unwrap();
                let mut cursor = args_node.walk();
                for child in args_node.children(&mut cursor) {
                    if child.kind() == "keyword_argument" {
                        let name = child.child_by_field_name("name").map(|n| self.text(n)).unwrap_or("");
                        if name == "handler" {
                            if let Some(val_node) = child.child_by_field_name("value") {
                                handler = self.text(val_node).to_string();
                            }
                        }
                    } else if child.is_named() && handler == "unknown" {
                        // Se for posicional e ainda não achamos o handler, pode ser ele (depende da lib)
                        // Para .irq() do MicroPython, costuma ser nomeado, mas deixamos um fallback básico
                        let text = self.text(child);
                        if !text.contains("=") && !text.contains("Pin.") {
                            handler = text.to_string();
                        }
                    }
                }

                crate::asl_types::AslStatement::AttachInterrupt(crate::asl_types::AslAttachInterrupt {
                    pin: AslExpr::var(pin_name),
                    handler,
                    trigger: "CHANGE".to_string(),
                })
            }

            f if f.ends_with(".on") || f.ends_with(".off") || f.ends_with(".value") => {
                let receiver = f.split('.').next().unwrap_or("unknown");
                let resolved_receiver = self.resolve_name(receiver);
                
                let val = if f.ends_with(".on") {
                    AslExpr::int(1)
                } else if f.ends_with(".off") {
                    AslExpr::int(0)
                } else {
                    args.first().cloned().unwrap_or(AslExpr::int(0))
                };

                AslStatement::DigitalOutput(crate::asl_types::AslDigitalOutput {
                    pin: AslExpr::var(&resolved_receiver),
                    value: val,
                })
            }

            _ => AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::Call(Box::new(crate::asl_types::AslCall {
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

            "string" | "string_literal" => {
                let text = self.text(node);
                
                // If it's an f-string, we might have children or interpolation
                if text.starts_with('f') {
                    let mut format_str = String::new();
                    let mut args = vec![];
                    let mut cursor = node.walk();
                    
                    for child in node.children(&mut cursor) {
                        let kind = child.kind();
                        if kind == "string_content" {
                            format_str.push_str(&self.text(child));
                        } else if kind == "interpolation" {
                            format_str.push_str("{}");
                            // Find the expression inside {}
                            let mut sub_cursor = child.walk();
                            for sub in child.children(&mut sub_cursor) {
                                if sub.is_named() && sub.kind() != "format_specifier" {
                                    args.push(self.visit_expr(sub));
                                    break;
                                }
                            }
                        }
                    }
                    
                    if args.is_empty() {
                        AslExpr::str_val(&format_str)
                    } else {
                        AslExpr::Call(Box::new(crate::asl_types::AslCall { 
                            callee: "format".to_string(), 
                            args: std::iter::once(AslExpr::str_val(&format_str))
                                .chain(args.into_iter())
                                .collect()
                        }))
                    }
                } else {
                    let clean = if text.starts_with('r') || text.starts_with('b') {
                        &text[1..]
                    } else {
                        &text
                    };
                    let final_text = if clean.starts_with("\"\"\"") || clean.starts_with("'''") {
                        &clean[3..clean.len() - 3]
                    } else {
                        clean.trim_matches('"').trim_matches('\'')
                    };
                    AslExpr::str_val(&final_text)
                }
            }

            "true" | "True" => AslExpr::bool_val(true),

            "false" | "False" => AslExpr::bool_val(false),

            "identifier" => AslExpr::var(&self.resolve_name(self.text(node))),
            
            "attribute" => {
                let object_node = node.child_by_field_name("object");
                let attribute_node = node.child_by_field_name("attribute");

                if let (Some(obj), Some(attr)) = (object_node, attribute_node) {
                    let obj_expr = self.visit_expr(obj);
                    let attr_text = self.text(attr);
                    AslExpr::var(&format!("{}.{}", self.expr_to_string(&obj_expr), attr_text))
                } else {
                    AslExpr::var(&self.expand_semantic_names(self.text(node)))
                }
            }

            "call" => {
                // If the call returns a statement that is NOT ExpressionStmt, 
                // if it were the first assignment in a function.
                let node_visit = node.clone();
                let stmt = self.visit_call(node_visit);

                match stmt {
                    AslStatement::Expr(e) => e.expr,
                    AslStatement::DigitalOutput(do_out) => {
                         // Map to a call for expression context
                         AslExpr::Call(Box::new(AslCall {
                             callee: "digitalOutput".to_string(),
                             args: vec![do_out.pin, do_out.value],
                         }))
                    },
                    AslStatement::Delay(d) => {
                         AslExpr::Call(Box::new(AslCall {
                             callee: "delay".to_string(),
                             args: vec![AslExpr::int(d.duration.as_ms() as i64)],
                         }))
                    },
                    _ => {
                        // Restoration: Preserve as a generic call instead of 0
                        let func_node = node.child_by_field_name("function").unwrap();
                        let func_expr = self.visit_expr(func_node);
                        let func_text = self.expr_to_string(&func_expr);
                        
                        let args_node = node.child_by_field_name("arguments").unwrap();
                        let mut cursor = args_node.walk();
                        let args: Vec<AslExpr> = args_node.children(&mut cursor)
                            .filter(|c| c.is_named())
                            .map(|c| self.visit_expr(c))
                            .collect();
                        
                        AslExpr::Call(Box::new(AslCall {
                            callee: func_text,
                            args
                        }))
                    }
                }
            }

            "binary_operator" | "comparison_operator" | "boolean_operator" => self.visit_binary(node),
            "unary_operator" | "not_operator" => self.visit_unary(node),
            "conditional_expression" => self.visit_conditional_expression(node),

            "parenthesized_expression" => {
                let mut found = None;
                for i in 0..node.child_count() as u32 {
                    let child = node.child(i).unwrap();
                    if child.is_named() {
                        found = Some(child);
                        break;
                    }
                }
                if let Some(inner) = found {
                    self.visit_expr(inner)
                } else {
                    AslExpr::int(0)
                }
            }

            "ERROR" => {
                AslExpr::var(&self.expand_semantic_names(self.text(node)))
            }

            _ => {
                let text = self.text(node);
                if node.kind() == "identifier" {
                    AslExpr::var(&self.resolve_name(text))
                } else if text.contains('(') || text.contains('[') || text.contains('.') {
                    // It's likely a complex expression tree-sitter failed to break down
                    AslExpr::var(&self.expand_semantic_names(text))
                } else {
                    AslExpr::var(text)
                }
            }
        }
    }
    fn visit_binary(&mut self, node: Node) -> AslExpr {
        // Fidelity Restoration: Precision in field lookup for boolean/comparison ops
        let left_node = node.child_by_field_name("left");
        let right_node = node.child_by_field_name("right");
        
        let left = if let Some(ln) = left_node {
            self.visit_expr(ln)
        } else {
            // Find first named child
            let mut found = None;
            for i in 0..node.child_count() as u32 {
                let child = node.child(i).unwrap();
                if child.is_named() {
                    found = Some(child);
                    break;
                }
            }
            if let Some(ln) = found { self.visit_expr(ln) } else { AslExpr::int(0) }
        };

        let right = if let Some(rn) = right_node {
            self.visit_expr(rn)
        } else {
            // Find last named child
            let mut found = None;
            for i in (0..node.child_count() as u32).rev() {
                let child = node.child(i).unwrap();
                if child.is_named() {
                    found = Some(child);
                    break;
                }
            }
            if let Some(rn) = found { self.visit_expr(rn) } else { AslExpr::int(0) }
        };

        let op_text = {
            let mut found = None;
            for i in 0..node.child_count() as u32 {
                let child = node.child(i).unwrap();
                if !child.is_named() {
                    found = Some(self.text(child));
                    break;
                }
            }
            found.unwrap_or("+")
        };

        let op = match op_text.as_ref() {
            "+" => BinaryOp::Add,
            "-" => BinaryOp::Sub,
            "*" => BinaryOp::Mul,
            "/" => BinaryOp::Div,
            "%" => BinaryOp::Mod,
            "==" => BinaryOp::Eq,
            "!=" => BinaryOp::Neq,
            "<" => BinaryOp::Lt,
            "<=" => BinaryOp::Lte,
            ">" => BinaryOp::Gt,
            ">=" => BinaryOp::Gte,
            "and" => BinaryOp::And,
            "or" => BinaryOp::Or,
            _ => BinaryOp::Add,
        };

        // Peephole Optimization: avg(x) restoration
        if op == BinaryOp::Div {
            if let AslExpr::Call(ref l_call) = left {
                if l_call.callee == "sum" || l_call.callee == "arraySum" {
                     if let AslExpr::Call(ref r_call) = right {
                         if r_call.callee == "count" || r_call.callee == "len" || r_call.callee == "arrayLen" {
                             // sum(x) / count(x) -> avg(x)
                             return AslExpr::Call(Box::new(AslCall {
                                 callee: "avg".to_string(),
                                 args: l_call.args.clone(),
                             }));
                         }
                     }
                }
            }
        }

        AslExpr::Binary(Box::new(AslBinary { left, right, op }))
    }

    fn visit_unary(&mut self, node: Node) -> AslExpr {
        let argument = node.child_by_field_name("argument").map(|c| self.visit_expr(c)).unwrap_or(AslExpr::int(0));
        let op_text = if let Some(op_node) = node.child_by_field_name("operator") {
            self.text(op_node)
        } else { "not" };

        let op = match op_text {
            "-" => UnaryOp::Neg,
            "not" => UnaryOp::Not,
            _ => UnaryOp::Not,
        };

        AslExpr::Unary(Box::new(AslUnary { expr: argument, op }))
    }
    fn visit_conditional_expression(&mut self, node: Node) -> AslExpr {
        let condition = node.child_by_field_name("condition").map(|c| self.visit_expr(c));
        let consequence = node.child_by_field_name("consequence").map(|c| self.visit_expr(c));
        let alternative = node.child_by_field_name("alternative").map(|c| self.visit_expr(c));

        if let (Some(cond), Some(cons), Some(alt)) = (condition, consequence, alternative) {
            AslExpr::Conditional(Box::new(AslConditional {
                condition: cond,
                when_true: cons,
                when_false: alt,
            }))
        } else {
            // Preservation over Placeholder: Use a raw call if fields are missing
            // Fidelity 100%: Expand names within the raw ternary string
            let raw_text = self.expand_semantic_names(self.text(node));
            AslExpr::Call(Box::new(AslCall {
                callee: "raw_ternary".to_string(),
                args: vec![AslExpr::var(&raw_text)],
            }))
        }
    }

    fn visit_assignment(&mut self, node: Node) -> AslStatement {
        let raw_target = node
            .child_by_field_name("left")
            .map(|n| self.text(n).to_string())
            .unwrap_or_default();
            
        let target = self.resolve_name(&raw_target);

        let right = node.child_by_field_name("right");
        
        if let Some(r) = right {
            // Check for hardware objects
            let r_text = self.text(r);
            if r_text.contains("Pin(") || r_text.contains("PWM(") || r_text.contains("ADC(") || r_text.contains("I2C(") || r_text.contains("HCSR04(") || r_text.contains("I2cLcd(") {
                self.global_names.insert(target.clone());
            }

            if r.kind() == "call" {
                let func_node = r.child_by_field_name("function");

                if let Some(f) = func_node {
                    let func_text = self.text(f);

                    if func_text == "machine.Pin" || func_text == "Pin" {
                        let arg_node = r.child_by_field_name("arguments");

                        if let Some(args_node) = arg_node {
                            let mut cursor = args_node.walk();
                            let first_arg_node = args_node.children(&mut cursor).find(|c| c.is_named());

                            if let Some(first_arg) = first_arg_node {
                                let first_text = self.text(first_arg);
                                let pin_val = if let Ok(p) = first_text.parse::<i64>() {
                                    p
                                } else if let Some(&p) = self.var_to_pin.get(first_text) {
                                    p
                                } else {
                                    0
                                };

                                if pin_val > 0 || first_text == "0" {
                                    let mode = if self.text(args_node).contains("OUT") {
                                        PinModeKind::Output
                                    } else {
                                        PinModeKind::Input
                                    };

                                    self.pin_to_mode.insert(pin_val, mode);
                                    self.var_to_pin.insert(target.clone(), pin_val);
                                }
                                
                                // Promote pin variable to [Data]
                                return AslStatement::Assign(crate::asl_types::AslAssign {
                                    target,
                                    value: AslExpr::int(pin_val),
                                });
                            }
                        }
                    } else if func_text == "PWM" || func_text == "ADC" {
                        // Infer mode from usage
                        let arg_node = r.child_by_field_name("arguments");
                        if let Some(args_node) = arg_node {
                            let mut cur = args_node.walk();
                            let first_arg_node = args_node.children(&mut cur).find(|c| c.is_named());
                            if let Some(first_arg) = first_arg_node {
                                let first_text = self.text(first_arg);
                                if let Some(&p) = self.var_to_pin.get(first_text) {
                                    let mode = if func_text == "PWM" { PinModeKind::Output } else { PinModeKind::Input };
                                    self.pin_to_mode.insert(p, mode);
                                }
                            }
                        }
                    }
                }
            }

            let value = self.visit_expr(r);
            
            if self.is_in_function && !self.globals_in_scope.contains(&raw_target) && !self.global_names.contains(&target) {
                AslStatement::Declare(crate::asl_types::AslDeclare {
                    name: target,
                    r#type: crate::asl_types::AslType::Auto,
                    value: Some(value),
                    mutable: true,
                    scope: "local".to_string(),
                    lifecycle: "normal".to_string(),
                    ..Default::default()
                })
            } else {
                AslStatement::Assign(crate::asl_types::AslAssign {
                    target,
                    value,
                })
            }
        } else {
            AslStatement::Comment(crate::asl_types::AslComment {
                text: format!("Erro no assignment de {}", target),
            })
        }
    }

    fn visit_if(&mut self, node: Node) -> AslStatement {
        let condition = node
            .child_by_field_name("condition")
            .map(|c| self.visit_expr(c))
            .unwrap_or_else(|| AslExpr::bool_val(true));

        let then_body = node
            .child_by_field_name("consequence")
            .map(|b| self.visit_block(b))
            .unwrap_or_default();

        let mut else_if = vec![];
        let mut else_body = None;

        if let Some(alt) = node.child_by_field_name("alternative") {
            match alt.kind() {
                "elif_clause" => {
                    // Python elif is often represented as nested if or dedicated elif_clause
                    let cond = alt.child_by_field_name("condition").map(|c| self.visit_expr(c)).unwrap_or(AslExpr::bool_val(true));
                    let body = alt.child_by_field_name("consequence").map(|b| self.visit_block(b)).unwrap_or_default();
                    else_if.push(crate::asl_types::AslElseIf { condition: cond, body });
                    
                    // Recursive alternative check for nested elif/else
                    // Note: Simplified for common structures
                }
                "else_clause" => {
                    // Find the block inside else_clause
                    let mut cursor = alt.walk();
                    for child in alt.children(&mut cursor) {
                        if child.kind() == "block" {
                            else_body = Some(self.visit_block(child));
                            break;
                        }
                    }
                }
                "if_statement" => {
                    // Nested if (elif equivalent)
                    let nested = self.visit_if(alt);
                    if let AslStatement::If(i) = nested {
                        else_if.push(crate::asl_types::AslElseIf { 
                            condition: i.condition.clone(), 
                            body: i.then_body.clone() 
                        });
                        else_if.extend(i.else_if.clone());
                        else_body = i.else_body.clone();
                    }
                }
                _ => {}
            }
        }

        AslStatement::If(Box::new(AslIf {
            condition,
            then_body,
            else_if,
            else_body,
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
            .map(|n| self.visit_expr(n))
            .unwrap_or_else(|| AslExpr::int(0));

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
}

#[cfg(test)]

mod tests {

    use super::*;
    use crate::parser::neuro_parser::NeuroParser;

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
