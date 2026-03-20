//! RustGenerator — gerador de código Rust (embassy + standalone) a partir de ProgramNode.
//! Migrado de: src/engine/asl/plugins/rust/RustGenerator.ts

use crate::helpers::array_utils::BaseNode;
use crate::plugins::c::SourceMapEntry;
use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};
use serde_json::Value;

pub struct RustGenerator {
    source_map: Vec<SourceMapEntry>,
    current_line: u32,
    shims: ShimManager,
}

impl Default for RustGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl RustGenerator {
    pub fn new() -> Self {
        let mut shims = ShimManager::new(ShimLanguage::Rust);
        shims.register_shims(default_rust_shims());
        Self { source_map: vec![], current_line: 1, shims }
    }

    pub fn generate(&mut self, ast: &BaseNode) -> crate::plugins::c::GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();
        let mut lines: Vec<String> = vec![];

        self.scan_for_shims(ast);

        let children = &ast.children;
        let funcs: Vec<&BaseNode> = children.iter().filter(|n| n.node_type == "Function").collect();
        let top_level: Vec<&BaseNode> = children.iter().filter(|n| n.node_type != "Function").collect();

        let setup  = funcs.iter().find(|f| attr_str(f, "name") == "setup").copied();
        let loop_  = funcs.iter().find(|f| attr_str(f, "name") == "loop").copied();
        let main_fn = funcs.iter().find(|f| attr_str(f, "name") == "main").copied();
        let is_embassy = setup.is_some() || loop_.is_some();

        if is_embassy {
            self.add_ln(&mut lines, "// Generated Rust Code", None);
            self.add_ln(&mut lines, "#![no_std]", None);
            self.add_ln(&mut lines, "#![no_main]", None);
            self.add_ln(&mut lines, "", None);
            self.add_ln(&mut lines, "use esp_hal::prelude::*;", None);
            self.add_ln(&mut lines, "", None);
        } else {
            self.add_ln(&mut lines, "// Generated Rust Code", None);
        }

        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            for line in shim_code.lines() { self.add_ln(&mut lines, line, None); }
            self.add_ln(&mut lines, "", None);
        }

        for node in &top_level { self.gen_stmt(node, &mut lines, ""); }
        if !top_level.is_empty() { self.add_ln(&mut lines, "", None); }

        // Helper functions (não são setup/loop/main)
        let helpers: Vec<&BaseNode> = funcs.iter().filter(|f| {
            let name = attr_str(f, "name");
            name != "setup" && name != "loop" && name != "main"
        }).copied().collect();

        for f in &helpers {
            self.print_comments(f, &mut lines, "");
            let name = attr_str(f, "name");
            self.add_ln(&mut lines, &format!("fn {name}() {{"), Some(f));
            for c in &f.children { self.gen_stmt(c, &mut lines, "    "); }
            self.add_ln(&mut lines, "}", Some(f));
            self.add_ln(&mut lines, "", None);
        }

        if is_embassy {
            self.add_ln(&mut lines, "#[entry]", None);
            self.add_ln(&mut lines, "fn main() -> ! {", None);
            self.add_ln(&mut lines, "    let peripherals = Peripherals::take();", None);
            self.add_ln(&mut lines, "    let system = peripherals.SYSTEM.split();", None);
            self.add_ln(&mut lines, "    let clocks = ClockControl::boot_defaults(system.clock_control).freeze();", None);
            self.add_ln(&mut lines, "    let mut delay = Delay::new(&clocks);", None);
            self.add_ln(&mut lines, "", None);

            if let Some(s) = setup {
                self.print_comments(s, &mut lines, "    ");
                self.add_ln(&mut lines, "    // Setup", Some(s));
                for c in &s.children { self.gen_stmt(c, &mut lines, "    "); }
            }

            self.add_ln(&mut lines, "", None);
            self.add_ln(&mut lines, "    loop {", loop_.map(|n| n as &BaseNode));
            if let Some(l) = loop_ {
                for c in &l.children { self.gen_stmt(c, &mut lines, "        "); }
            }
            self.add_ln(&mut lines, "    }", None);
            self.add_ln(&mut lines, "}", None);
        } else if let Some(mf) = main_fn {
            self.print_comments(mf, &mut lines, "");
            self.add_ln(&mut lines, "fn main() {", Some(mf));
            for c in &mf.children { self.gen_stmt(c, &mut lines, "    "); }
            self.add_ln(&mut lines, "}", Some(mf));
        } else {
            for f in &funcs {
                self.print_comments(f, &mut lines, "");
                let name = attr_str(f, "name");
                self.add_ln(&mut lines, &format!("fn {name}() {{"), Some(f));
                for c in &f.children { self.gen_stmt(c, &mut lines, "    "); }
                self.add_ln(&mut lines, "}", Some(f));
                self.add_ln(&mut lines, "", None);
            }
        }

        crate::plugins::c::GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
        }
    }

    fn scan_for_shims(&mut self, node: &BaseNode) {
        if node.node_type == "CallExpression" {
            let callee = attr_str(node, "callee");
            if callee.starts_with("EEPROM.")              { self.shims.require_shim("EEPROM"); }
            if callee.starts_with("lcd.") || callee.starts_with("lcd_") { self.shims.require_shim("LiquidCrystal_I2C"); }
            if callee.starts_with("keypad.") || callee == "keypad" { self.shims.require_shim("Keypad"); }
        }
        if node.node_type == "VariableDeclaration" {
            let ty = attr_str(node, "type");
            if ty == "LiquidCrystal_I2C" { self.shims.require_shim("LiquidCrystal_I2C"); }
            if ty == "Keypad"            { self.shims.require_shim("Keypad"); }
        }
        for child in &node.children { self.scan_for_shims(child); }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str, node: Option<&BaseNode>) {
        lines.push(text.to_string());
        if let Some(n) = node {
            if let Some(line) = n.attributes.get("line").and_then(|v| v.as_u64()) {
                self.source_map.push(SourceMapEntry { generated_line: self.current_line, source_line: line as u32 });
            }
        }
        self.current_line += text.lines().count().max(1) as u32;
    }

    fn print_comments(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        if let Some(Value::Array(comments)) = node.attributes.get("leadingComments") {
            for c in comments {
                if let Some(text) = c.as_str() {
                    let t = text.trim();
                    if t.starts_with("/*") || t.starts_with("//") {
                        self.add_ln(lines, &format!("{indent}{t}"), None);
                    } else {
                        self.add_ln(lines, &format!("{indent}// {t}"), None);
                    }
                }
            }
        }
    }

    fn gen_stmt(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        self.print_comments(node, lines, indent);
        if node.node_type == "Empty" { return; }

        match node.node_type.as_str() {
            "VariableDeclaration" => {
                let val = node.children.first().map(|c| self.gen_expr(c)).unwrap_or_else(|| "0".to_string());
                let name = attr_str(node, "name");
                self.add_ln(lines, &format!("{indent}let mut {name} = {val};"), Some(node));
            }
            "PinMode" => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}gpio_mode({a}, {b});"), Some(node)); }
            "ExpressionStatement" => {
                if let Some(child) = node.children.first() {
                    if child.node_type == "CallExpression" {
                        let callee = attr_str(child, "callee");
                        if callee == "attachInterrupt" {
                            let args: Vec<String> = child.children.iter().map(|c| self.gen_expr(c)).collect();
                            self.add_ln(lines, &format!("{indent}attach_interrupt({});", args.join(", ")), Some(node));
                            return;
                        }
                        if callee == "shiftOut" {
                            let args: Vec<String> = child.children.iter().map(|c| self.gen_expr(c)).collect();
                            self.add_ln(lines, &format!("{indent}shift_out({});", args.join(", ")), Some(node));
                            return;
                        }
                    }
                    let expr = self.gen_expr(child); self.add_ln(lines, &format!("{indent}{expr};"), Some(node));
                }
            }
            "Block"           => { for c in &node.children { self.gen_stmt(c, lines, indent); } }
            "GpioSet"         => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}gpio_set({a}, {b});"), Some(node)); }
            "GpioRead"        => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}gpio_get({a});"), Some(node)); }
            "AnalogRead"      => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}adc.read({a});"), Some(node)); }
            "AnalogWrite"     => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}pwm.set_duty({a}, {b});"), Some(node)); }
            "DelayMs"         => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}delay.delay_ms({a}u32);"), Some(node)); }
            "SerialBegin"     => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}Serial::begin({a});"), Some(node)); }
            "Print"           => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}println!(\"{{}}\", {a});"), Some(node)); }
            "BreakStatement"  => self.add_ln(lines, &format!("{indent}break;"), Some(node)),
            "ContinueStatement" => self.add_ln(lines, &format!("{indent}continue;"), Some(node)),
            "ReturnStatement" => {
                if let Some(c) = node.children.first() {
                    let val = self.gen_expr(c); self.add_ln(lines, &format!("{indent}return {val};"), Some(node));
                } else {
                    self.add_ln(lines, &format!("{indent}return;"), Some(node));
                }
            }
            "StructDeclaration" => {
                let name = attr_str(node, "name");
                self.add_ln(lines, &format!("{indent}struct {name} {{"), Some(node));
                for f in &node.children {
                    let fn_ = attr_str(f, "name");
                    let ft  = if attr_str(f, "type").is_empty() { "i32" } else { attr_str(f, "type") };
                    self.add_ln(lines, &format!("{indent}    {fn_}: {ft},"), Some(f));
                }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
                self.add_ln(lines, "", None);
            }
            "EnumDeclaration" => {
                let name = attr_str(node, "name");
                self.add_ln(lines, &format!("{indent}#[derive(Debug, Clone, Copy, PartialEq)]"), Some(node));
                self.add_ln(lines, &format!("{indent}enum {name} {{"), Some(node));
                for variant in &node.children {
                    let discrim = variant.children.first()
                        .map(|c| format!(" = {}", self.gen_expr(c)))
                        .unwrap_or_default();
                    let vn = attr_str(variant, "name");
                    self.add_ln(lines, &format!("{indent}    {vn}{discrim},"), Some(variant));
                }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
                self.add_ln(lines, "", None);
            }
            "IfStatement"  => self.gen_if_rust(node, lines, indent),
            "Loop"         => {
                self.add_ln(lines, &format!("{indent}loop {{"), Some(node));
                for c in &node.children { self.gen_stmt(c, lines, &format!("{indent}    ")); }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            "DoWhileLoop"  => {
                self.add_ln(lines, &format!("{indent}loop {{"), Some(node));
                for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}    ")); }
                let cond = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}    if !({cond}) {{ break; }}"), Some(node));
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            "WhileLoop" => {
                let cond = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}while {cond} {{"), Some(node));
                for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}    ")); }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            "ForLoop"  => self.gen_for_rust(node, lines, indent),
            "ForIn"    => self.gen_for_in_rust(node, lines, indent),
            "SwitchStatement" => self.gen_match_rust(node, lines, indent),
            "DesignatedInitializer" => {
                let struct_name = attr_str(node, "structName");
                let open = if struct_name.is_empty() { format!("{indent}{{") } else { format!("{indent}{struct_name} {{") };
                self.add_ln(lines, &open, Some(node));
                for f in &node.children {
                    let fv = f.children.first().map(|c| self.gen_expr(c)).unwrap_or_else(|| "0".to_string());
                    let fn_ = attr_str(f, "name");
                    self.add_ln(lines, &format!("{indent}    {fn_}: {fv},"), Some(f));
                }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            _ => self.add_ln(lines, &format!("{indent}// Unhandled Node: {}", node.node_type), Some(node)),
        }
    }

    fn gen_if_rust(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let cond = self.gen_child(node, 0);
        self.add_ln(lines, &format!("{indent}if {cond} {{"), Some(node));
        if let Some(then_block) = node.children.get(1) {
            let children = if then_block.node_type == "Block" { &then_block.children } else { &node.children };
            for c in children { self.gen_stmt(c, lines, &format!("{indent}    ")); }
        }
        if let Some(else_node) = node.children.get(2) {
            if else_node.node_type == "IfStatement" {
                // Patch last line to `} else if ...`
                if let Some(last) = lines.last_mut() { *last = format!("{indent}}} else "); }
                let mut temp: Vec<String> = vec![];
                self.gen_stmt(else_node, &mut temp, "");
                if let Some((first, rest)) = temp.split_first() {
                    if let Some(last) = lines.last_mut() { *last += first.trim_start(); }
                    for l in rest { lines.push(format!("{indent}{}", l.trim_start())); }
                    self.current_line += rest.len() as u32;
                }
            } else {
                if let Some(last) = lines.last_mut() { *last = format!("{indent}}} else {{"); }
                let ec = if else_node.node_type == "Block" { &else_node.children } else { std::slice::from_ref(else_node) };
                for c in ec { self.gen_stmt(c, lines, &format!("{indent}    ")); }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
        } else {
            self.add_ln(lines, &format!("{indent}}}"), Some(node));
        }
    }

    fn gen_for_rust(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let mut idx = 0usize;
        if node.attributes.get("hasInit").and_then(|v| v.as_bool()) == Some(true) {
            self.gen_stmt(&node.children[idx], lines, indent); idx += 1;
        }
        let cond = node.children.get(idx).map(|n| self.gen_expr(n)).unwrap_or_else(|| "true".to_string()); idx += 1;
        let update_node = if node.attributes.get("hasUpdate").and_then(|v| v.as_bool()) == Some(true) {
            let n = node.children.get(idx).cloned(); idx += 1; n
        } else { None };

        self.add_ln(lines, &format!("{indent}while {cond} {{"), Some(node));
        for c in node.children.iter().skip(idx) { self.gen_stmt(c, lines, &format!("{indent}    ")); }
        if let Some(ref u) = update_node { self.gen_stmt(u, lines, &format!("{indent}    ")); }
        self.add_ln(lines, &format!("{indent}}}"), Some(node));
    }

    fn gen_for_in_rust(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let var_name = attr_str(node, "varName");
        let iter_node = &node.children[0];
        if iter_node.node_type == "CallExpression" && attr_str(iter_node, "callee") == "reversed" {
            let target = self.gen_expr(iter_node.children.first().unwrap());
            self.add_ln(lines, &format!("{indent}for {var_name} in {target}.iter().rev() {{"), Some(node));
        } else {
            let iterable = self.gen_expr(iter_node);
            self.add_ln(lines, &format!("{indent}for {var_name} in {iterable} {{"), Some(node));
        }
        for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}    ")); }
        self.add_ln(lines, &format!("{indent}}}"), Some(node));
    }

    fn gen_match_rust(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let disc = self.gen_child(node, 0);
        self.add_ln(lines, &format!("{indent}match {disc} {{"), Some(node));
        for case_node in node.children.iter().skip(1) {
            if case_node.attributes.get("isDefault").and_then(|v| v.as_bool()) == Some(true) {
                self.add_ln(lines, &format!("{indent}    _ => {{"), Some(case_node));
                let body: Vec<&BaseNode> = case_node.children.iter().filter(|c| c.node_type != "BreakStatement").collect();
                for c in body { self.gen_stmt(c, lines, &format!("{indent}        ")); }
                self.add_ln(lines, &format!("{indent}    }}"), None);
            } else {
                let test = self.gen_expr(&case_node.children[0]);
                self.add_ln(lines, &format!("{indent}    {test} => {{"), Some(case_node));
                let body: Vec<&BaseNode> = case_node.children.iter().skip(1).filter(|c| c.node_type != "BreakStatement").collect();
                for c in body { self.gen_stmt(c, lines, &format!("{indent}        ")); }
                self.add_ln(lines, &format!("{indent}    }}"), None);
            }
        }
        self.add_ln(lines, &format!("{indent}}}"), Some(node));
    }

    fn gen_child(&mut self, node: &BaseNode, idx: usize) -> String {
        node.children.get(idx).map(|c| self.gen_expr(c)).unwrap_or_else(|| "0".to_string())
    }

    fn gen_expr(&mut self, node: &BaseNode) -> String {
        match node.node_type.as_str() {
            "Literal" => {
                if node.attributes.get("isRaw").and_then(|v| v.as_bool()) == Some(true) {
                    return attr_str(node, "value").to_string();
                }
                if node.attributes.get("isString").and_then(|v| v.as_bool()) == Some(true) {
                    return format!("\"{}\"", attr_str(node, "value"));
                }
                attr_str(node, "value").to_string()
            }
            "Identifier"       => attr_str(node, "name").to_string(),
            "BinaryExpression" => format!("{} {} {}",
                self.gen_child(node, 0), attr_str(node, "operator"), self.gen_child(node, 1)),
            "UnaryExpression"  => {
                let op = attr_str(node, "operator");
                if node.attributes.get("prefix").and_then(|v| v.as_bool()) == Some(true) {
                    format!("{op}{}", self.gen_child(node, 0))
                } else {
                    let suffix = if op == "++" { " += 1" } else { " -= 1" };
                    format!("{}{suffix}", self.gen_child(node, 0))
                }
            }
            "MemberExpression" => {
                let op = if attr_str(node, "operator").is_empty() { "." } else { attr_str(node, "operator") };
                format!("{}{op}{}", self.gen_child(node, 0), attr_str(node, "property"))
            }
            "ConditionalExpression" => format!("(if {} {{ {} }} else {{ {} }})",
                self.gen_child(node, 0), self.gen_child(node, 1), self.gen_child(node, 2)),
            "GpioRead"         => format!("gpio_get({})", self.gen_child(node, 0)),
            "AnalogRead"       => format!("adc.read({})", self.gen_child(node, 0)),
            "SerialAvailable"  => "Serial::available()".to_string(),
            "SerialReadString" => "Serial::read_string()".to_string(),
            "CallExpression"   => {
                let callee = attr_str(node, "callee");
                let args: Vec<String> = node.children.iter().map(|c| self.gen_expr(c)).collect();
                let args_str = args.join(", ");
                match callee {
                    "pulseIn"         => format!("pulse_in({args_str})"),
                    "shiftIn"         => format!("shift_in({args_str})"),
                    "shiftOut"        => format!("shift_out({args_str})"),
                    "attachInterrupt" => format!("attach_interrupt({args_str})"),
                    "len"             => format!("{args_str}.len()"),
                    _                 => format!("{callee}({args_str})"),
                }
            }
            "CastExpression" => format!("({}) as {}", self.gen_child(node, 0), attr_str(node, "targetType")),
            "ArrayInitializer" => {
                if node.attributes.get("repeat").and_then(|v| v.as_bool()) == Some(true) && node.children.len() == 2 {
                    return format!("[{}; {}]", self.gen_child(node, 0), self.gen_child(node, 1));
                }
                let elements: Vec<String> = node.children.iter().map(|c| self.gen_expr(c)).collect();
                format!("vec![{}]", elements.join(", "))
            }
            "SubscriptExpression" => format!("{}[{}]", self.gen_child(node, 0), self.gen_child(node, 1)),
            "DesignatedInitializer" => {
                let struct_name = attr_str(node, "structName");
                let fields: Vec<String> = node.children.iter().map(|f| {
                    let fv = f.children.first().map(|c| self.gen_expr(c)).unwrap_or_else(|| "0".to_string());
                    format!("{}: {fv}", attr_str(f, "name"))
                }).collect();
                if struct_name.is_empty() { format!("{{ {} }}", fields.join(", ")) }
                else { format!("{struct_name} {{ {} }}", fields.join(", ")) }
            }
            _ => String::new(),
        }
    }
}

fn default_rust_shims() -> Vec<ShimDefinition> {
    vec![
        ShimDefinition::new("EEPROM", "// use esp_hal::rom::ets_sys;").with_description("EEPROM shim"),
        ShimDefinition::new("LiquidCrystal_I2C", "// use lcd_i2c::LcdI2C;").with_description("LCD I2C shim"),
        ShimDefinition::new("Keypad", "// use keypad::Keypad;").with_description("Keypad shim"),
    ]
}

fn attr_str<'a>(node: &'a BaseNode, key: &str) -> &'a str {
    node.attributes.get(key).and_then(|v| v.as_str()).unwrap_or("")
}
