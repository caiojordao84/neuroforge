//! CGenerator — gerador de código C++/Arduino a partir de ProgramNode (BaseNode).
//! Migrado de: src/engine/asl/plugins/c/CGenerator.ts

use crate::helpers::array_utils::BaseNode;
use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};
use serde_json::Value;

/// Mapeamento de linha gerada → linha fonte.
#[derive(Debug, Clone)]
pub struct SourceMapEntry {
    pub generated_line: u32,
    pub source_line: u32,
}

/// Resultado da geração de código.
#[derive(Debug)]
pub struct GeneratorOutput {
    pub code: String,
    pub map: Vec<SourceMapEntry>,
}

pub struct CGenerator {
    source_map: Vec<SourceMapEntry>,
    current_line: u32,
    shims: ShimManager,
}

impl CGenerator {
    pub fn new() -> Self {
        let mut shims = ShimManager::new(ShimLanguage::C);
        shims.register_shims(default_c_shims());
        Self {
            source_map: vec![],
            current_line: 1,
            shims,
        }
    }

    pub fn generate(&mut self, ast: &BaseNode) -> GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();
        let mut lines: Vec<String> = vec![];

        self.scan_for_shims(ast);

        self.add_ln(&mut lines, "// Generated C++ / Arduino Code", None);
        self.add_ln(&mut lines, "#include <Arduino.h>", None);

        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line, None);
            }
        }
        self.add_ln(&mut lines, "", None);

        let children = &ast.children;
        let has_setup = children.iter().any(|n| n.node_type == "Function" && attr_str(n, "name") == "setup");
        let has_loop  = children.iter().any(|n| n.node_type == "Function" && attr_str(n, "name") == "loop");
        let has_main  = children.iter().any(|n| n.node_type == "Function" && attr_str(n, "name") == "main");

        if has_setup || has_loop || has_main {
            for node in children {
                if node.node_type == "VariableDeclaration" {
                    self.gen_stmt(node, &mut lines, "");
                } else if node.node_type == "Function" {
                    let name = attr_str(node, "name").to_string();
                    self.print_comments(node, &mut lines, "");
                    if name == "main" {
                        self.add_ln(&mut lines, "int main() {", Some(node));
                        for c in &node.children { self.gen_stmt(c, &mut lines, "  "); }
                        self.add_ln(&mut lines, "  return 0;", None);
                        self.add_ln(&mut lines, "}", Some(node));
                    } else {
                        self.add_ln(&mut lines, &format!("void {}() {{", name), Some(node));
                        for c in &node.children { self.gen_stmt(c, &mut lines, "  "); }
                        self.add_ln(&mut lines, "}", Some(node));
                    }
                    self.add_ln(&mut lines, "", None);
                } else {
                    self.gen_stmt(node, &mut lines, "");
                }
            }
        } else {
            let mut globals: Vec<&BaseNode> = vec![];
            let mut setup_body: Vec<&BaseNode> = vec![];
            let mut loop_body: Vec<&BaseNode> = vec![];
            let mut functions: Vec<&BaseNode> = vec![];

            for node in children {
                if node.node_type == "Function" {
                    functions.push(node);
                } else if node.node_type == "VariableDeclaration" || node.node_type == "ServoDeclaration" {
                    globals.push(node);
                } else if node.node_type == "WhileLoop"
                    && node.attributes.get("isInfinite").and_then(|v| v.as_bool()) == Some(true)
                {
                    for c in node.children.iter().skip(1) { loop_body.push(c); }
                } else {
                    setup_body.push(node);
                }
            }

            // Globals
            for node in &globals { self.gen_global_var(node, &mut lines); }

            // Helper functions
            for node in &functions {
                let name = attr_str(node, "name").to_string();
                self.print_comments(node, &mut lines, "");
                self.add_ln(&mut lines, &format!("void {}() {{", name), Some(node));
                for c in &node.children { self.gen_stmt(c, &mut lines, "  "); }
                self.add_ln(&mut lines, "}", Some(node));
                self.add_ln(&mut lines, "", None);
            }

            // setup()
            self.add_ln(&mut lines, "void setup() {", None);
            for g in &globals {
                if self.is_pin_array_decl(g) {
                    let arr_name = attr_str(g, "name").to_string();
                    let num_var = format!("num_{arr_name}");
                    self.add_ln(&mut lines, &format!("  for (int i = 0; i < {num_var}; i++) {{"), None);
                    self.add_ln(&mut lines, &format!("    pinMode({arr_name}[i], OUTPUT);"), None);
                    self.add_ln(&mut lines, "  }", None);
                }
            }
            for node in &setup_body { self.gen_stmt(node, &mut lines, "  "); }
            self.add_ln(&mut lines, "}", None);
            self.add_ln(&mut lines, "", None);

            // loop()
            if !loop_body.is_empty() {
                self.add_ln(&mut lines, "void loop() {", None);
                for node in &loop_body { self.gen_stmt(node, &mut lines, "  "); }
                self.add_ln(&mut lines, "}", None);
                self.add_ln(&mut lines, "", None);
            }
        }

        GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
        }
    }

    fn is_pin_array_decl(&self, node: &BaseNode) -> bool {
        if node.node_type != "VariableDeclaration" { return false; }
        let Some(init) = node.children.first() else { return false; };
        if init.node_type != "ArrayInitializer" || init.children.is_empty() { return false; }
        init.children.iter().all(|c| {
            c.node_type == "CallExpression" && attr_str(c, "callee") == "Pin"
        })
    }

    fn gen_global_var(&mut self, node: &BaseNode, lines: &mut Vec<String>) {
        self.print_comments(node, lines, "");
        if node.node_type == "ServoDeclaration" {
            let name = attr_str(node, "name").to_string();
            self.add_ln(lines, &format!("Servo {name};"), Some(node));
            return;
        }
        if self.is_pin_array_decl(node) {
            let init = &node.children[0];
            let pin_nums: Vec<String> = init.children.iter().map(|c| {
                if let Some(first) = c.children.first() { self.gen_expr(first) }
                else { "0".to_string() }
            }).collect();
            let arr_name = attr_str(node, "name");
            self.add_ln(lines, &format!("const int {arr_name}[] = {{ {} }};", pin_nums.join(", ")), Some(node));
            self.add_ln(lines, &format!("const int num_{arr_name} = {};", pin_nums.len()), None);
        } else {
            self.gen_stmt(node, lines, "");
        }
    }

    fn scan_for_shims(&mut self, node: &BaseNode) {
        if node.node_type == "CallExpression" {
            let callee = attr_str(node, "callee");
            if callee.starts_with("sevseg.") { self.shims.require_shim("sevseg"); }
        }
        let is_servo = matches!(node.node_type.as_str(),
            "ServoDeclaration" | "ServoAttach" | "ServoWrite" | "ServoDetach"
            | "ServoRead" | "ServoAttached"
        ) || (node.node_type == "VariableDeclaration" && attr_str(node, "type") == "Servo")
          || (node.node_type == "CallExpression"
              && attr_str(node, "callee").to_lowercase().contains("servo"));

        if is_servo { self.shims.require_shim("servo"); }

        for child in &node.children { self.scan_for_shims(child); }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str, node: Option<&BaseNode>) {
        lines.push(text.to_string());
        if let Some(n) = node {
            if let Some(line) = n.attributes.get("line").and_then(|v| v.as_u64()) {
                self.source_map.push(SourceMapEntry {
                    generated_line: self.current_line,
                    source_line: line as u32,
                });
            }
        }
        self.current_line += text.lines().count().max(1) as u32;
    }

    fn print_comments(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        // Os nós leadingComments em BaseNode são string arrays guardados em attributes["leadingComments"]
        if let Some(Value::Array(comments)) = node.attributes.get("leadingComments") {
            for c in comments {
                if let Some(text) = c.as_str() {
                    let mut t = text.trim().to_string();
                    if t.starts_with('#') { t = format!("// {}", &t[1..]); }
                    if !t.starts_with("//") && !t.starts_with("/*") { t = format!("// {t}"); }
                    self.add_ln(lines, &format!("{indent}{t}"), None);
                }
            }
        }
    }

    fn gen_stmt(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        if node.node_type == "Empty" { return; }
        self.print_comments(node, lines, indent);

        match node.node_type.as_str() {
            "VariableDeclaration" => {
                let init = node.children.first();
                let is_array = init.map(|n| n.node_type == "ArrayInitializer").unwrap_or(false);
                let val = init.map(|n| self.gen_expr(n)).unwrap_or_else(|| "0".to_string());
                let ty = attr_str(node, "type");
                let arr = if is_array { "[]" } else { "" };
                self.add_ln(lines, &format!("{indent}{ty} {name}{arr} = {val};", name = attr_str(node, "name")), Some(node));
            }
            "ExpressionStatement" => {
                if let Some(child) = node.children.first() {
                    let expr = self.gen_expr(child);
                    if !expr.is_empty() { self.add_ln(lines, &format!("{indent}{expr};"), Some(node)); }
                }
            }
            "BreakStatement"    => self.add_ln(lines, &format!("{indent}break;"), Some(node)),
            "ContinueStatement" => self.add_ln(lines, &format!("{indent}continue;"), Some(node)),
            "GpioSet"   => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}digitalWrite({a}, {b});"), Some(node)); }
            "DelayMs"   => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}delay({a});"), Some(node)); }
            "AnalogWrite" => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}analogWrite({a}, {b});"), Some(node)); }
            "GpioRead"  => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}digitalRead({a});"), Some(node)); }
            "SerialBegin" => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}Serial.begin({a});"), Some(node)); }
            "Print"     => { let a = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}Serial.println({a});"), Some(node)); }
            "HardwarePwm" => {
                let pin  = attr_str(node, "pin").to_string();
                let duty = node.attributes.get("duty").and_then(|v| v.as_f64()).unwrap_or(0.0);
                self.add_ln(lines, &format!("{indent}analogWrite({pin}, {}); // HW PWM", (duty / 4.0) as u32), Some(node));
            }
            "PinMode" => { let a = self.gen_child(node, 0); let b = self.gen_child(node, 1); self.add_ln(lines, &format!("{indent}pinMode({a}, {b});"), Some(node)); }
            "ReturnStatement" => {
                if let Some(c) = node.children.first() {
                    let val = self.gen_expr(c); self.add_ln(lines, &format!("{indent}return {val};"), Some(node));
                } else {
                    self.add_ln(lines, &format!("{indent}return;"), Some(node));
                }
            }
            "IfStatement" => self.gen_if(node, lines, indent),
            "DoWhileLoop" => {
                self.add_ln(lines, &format!("{indent}do {{"), Some(node));
                for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}  ")); }
                let cond = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}}} while ({cond});"), Some(node));
            }
            "Loop" => {
                self.add_ln(lines, &format!("{indent}for (;;) {{"), Some(node));
                for c in &node.children { self.gen_stmt(c, lines, &format!("{indent}  ")); }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            "WhileLoop" => {
                let cond = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}while ({cond}) {{"), Some(node));
                for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}  ")); }
                self.add_ln(lines, &format!("{indent}}}"), Some(node));
            }
            "ForLoop" => self.gen_for(node, lines, indent),
            "ForIn"   => self.gen_for_in_c(node, lines, indent),
            "Block"   => { for c in &node.children { self.gen_stmt(c, lines, indent); } }
            "StructDeclaration" => {
                let name = attr_str(node, "name").to_string();
                let fields: Vec<Value> = node.attributes.get("fields")
                    .and_then(|v| v.as_array()).cloned().unwrap_or_default();
                self.add_ln(lines, &format!("{indent}struct {name} {{"), Some(node));
                for f in &fields {
                    let fn_ = f.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let ft  = f.get("type").and_then(|v| v.as_str()).unwrap_or("int");
                    self.add_ln(lines, &format!("{indent}  {ft} {fn_};"), None);
                }
                self.add_ln(lines, &format!("{indent}}};"), None);
            }
            "EnumDeclaration" => {
                let name    = attr_str(node, "name").to_string();
                let members: Vec<Value> = node.attributes.get("members")
                    .and_then(|v| v.as_array()).cloned().unwrap_or_default();
                self.add_ln(lines, &format!("{indent}enum {name} {{"), Some(node));
                for (idx, m) in members.iter().enumerate() {
                    let mn = m.get("name").and_then(|v| v.as_str()).unwrap_or("");
                    let mv = m.get("value").map(|v| format!(" = {v}")).unwrap_or_default();
                    let sep = if idx < members.len() - 1 { "," } else { "" };
                    self.add_ln(lines, &format!("{indent}  {mn}{mv}{sep}"), None);
                }
                self.add_ln(lines, &format!("{indent}}};"), None);
            }
            "SwitchStatement" => self.gen_switch_c(node, lines, indent),
            "GpioBatch" => {
                if let Some(Value::Array(ops)) = node.attributes.get("operations") {
                    self.add_ln(lines, &format!("{indent}// Batch Update"), Some(node));
                    for op in ops {
                        let pin = op.get("pin").map(|v| v.to_string()).unwrap_or_default();
                        let val = op.get("val").map(|v| v.to_string()).unwrap_or_default();
                        self.add_ln(lines, &format!("{indent}digitalWrite({pin}, {val});"), None);
                    }
                }
            }
            "ServoDeclaration" => {
                let name = attr_str(node, "name");
                self.add_ln(lines, &format!("{indent}Servo {name};"), Some(node));
            }
            "ServoAttach" => {
                let var_name = if !attr_str(node, "varName").is_empty() { attr_str(node, "varName").to_string() }
                               else { attr_str(node, "name").to_string() };
                let pin = node.children.first().map(|c| self.gen_expr(c)).unwrap_or_else(|| "9".to_string());
                if node.children.len() >= 3 {
                    let min_p = self.gen_expr(&node.children[1]);
                    let max_p = self.gen_expr(&node.children[2]);
                    self.add_ln(lines, &format!("{indent}{var_name}.attach({pin}, {min_p}, {max_p});"), Some(node));
                } else {
                    self.add_ln(lines, &format!("{indent}{var_name}.attach({pin});"), Some(node));
                }
            }
            "ServoWrite" => {
                let var_name = if !attr_str(node, "varName").is_empty() { attr_str(node, "varName").to_string() }
                               else { attr_str(node, "name").to_string() };
                let angle = node.children.first().map(|c| self.gen_expr(c))
                    .unwrap_or_else(|| attr_str(node, "angle").to_string());
                if node.attributes.get("rawMicroseconds").and_then(|v| v.as_bool()) == Some(true) {
                    self.add_ln(lines, &format!("{indent}{var_name}.writeMicroseconds({angle});"), Some(node));
                } else {
                    self.add_ln(lines, &format!("{indent}{var_name}.write({angle});"), Some(node));
                }
            }
            "ServoDetach" => {
                let var_name = if !attr_str(node, "varName").is_empty() { attr_str(node, "varName").to_string() }
                               else { attr_str(node, "name").to_string() };
                self.add_ln(lines, &format!("{indent}{var_name}.detach();"), Some(node));
            }
            _ => {} // nós não mapeados são silenciosamente ignorados (compatibilidade futura)
        }
    }

    fn gen_if(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let cond = self.gen_child(node, 0); self.add_ln(lines, &format!("{indent}if ({cond}) {{"), Some(node));
        if let Some(then_block) = node.children.get(1) {
            for c in &then_block.children { self.gen_stmt(c, lines, &format!("{indent}  ")); }
        }
        let mut current = node;
        // Loop de else/else-if
        while let Some(else_node) = current.children.get(2) {
            if else_node.node_type == "IfStatement" {
                let cond = self.gen_expr(&else_node.children[0]); self.add_ln(lines, &format!("{indent}}} else if ({cond}) {{"), Some(else_node));
                if let Some(eb) = else_node.children.get(1) {
                    for c in &eb.children { self.gen_stmt(c, lines, &format!("{indent}  ")); }
                }
                current = else_node;
            } else {
                self.add_ln(lines, &format!("{indent}}} else {{"), None);
                for c in &else_node.children { self.gen_stmt(c, lines, &format!("{indent}  ")); }
                break;
            }
        }
        self.add_ln(lines, &format!("{indent}}}"), Some(current));
    }

    fn gen_for(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let mut idx = 0usize;
        let init = if node.attributes.get("hasInit").and_then(|v| v.as_bool()) == Some(true) {
            let n = &node.children[idx]; idx += 1;
            if n.node_type == "VariableDeclaration" {
                let val = n.children.first().map(|c| self.gen_expr(c)).unwrap_or_else(|| "0".to_string());
                format!("{} {} = {}", attr_str(n, "type"), attr_str(n, "name"), val)
            } else { self.gen_expr(n) }
        } else { String::new() };

        let cond = node.children.get(idx).map(|n| self.gen_expr(n)).unwrap_or_default(); idx += 1;

        let update = if node.attributes.get("hasUpdate").and_then(|v| v.as_bool()) == Some(true) {
            let n = &node.children[idx]; idx += 1;
            if n.node_type == "ExpressionStatement" && n.children.first().is_some() {
                self.gen_expr(n.children.first().unwrap())
            } else { self.gen_expr(n) }
        } else { String::new() };

        self.add_ln(lines, &format!("{indent}for ({init}; {cond}; {update}) {{"), Some(node));
        for c in node.children.iter().skip(idx) { self.gen_stmt(c, lines, &format!("{indent}  ")); }
        self.add_ln(lines, &format!("{indent}}}"), Some(node));
    }

    fn gen_for_in_c(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let var_name = attr_str(node, "varName").to_string();
        let iter_node = &node.children[0];
        if iter_node.node_type == "CallExpression" && attr_str(iter_node, "callee") == "reversed" {
            let target = self.gen_expr(iter_node.children.first().unwrap());
            self.add_ln(lines, &format!("{indent}for (int i = (sizeof({target})/sizeof({target}[0])) - 1; i >= 0; i--) {{"), Some(node));
            self.add_ln(lines, &format!("{indent}  auto {var_name} = {target}[i];"), None);
        } else {
            let iterable = self.gen_expr(iter_node);
            self.add_ln(lines, &format!("{indent}for (auto {var_name} : {iterable}) {{"), Some(node));
        }
        for c in node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}  ")); }
        self.add_ln(lines, &format!("{indent}}}"), Some(node));
    }

    fn gen_switch_c(&mut self, node: &BaseNode, lines: &mut Vec<String>, indent: &str) {
        let disc = self.gen_child(node, 0);
        self.add_ln(lines, &format!("{indent}switch ({disc}) {{"), Some(node));
        for case_node in node.children.iter().skip(1) {
            if case_node.attributes.get("isDefault").and_then(|v| v.as_bool()) == Some(true) {
                self.add_ln(lines, &format!("{indent}  default:"), Some(case_node));
                for c in &case_node.children { self.gen_stmt(c, lines, &format!("{indent}    ")); }
            } else {
                let test = self.gen_expr(&case_node.children[0]);
                self.add_ln(lines, &format!("{indent}  case {test}:"), Some(case_node));
                for c in case_node.children.iter().skip(1) { self.gen_stmt(c, lines, &format!("{indent}    ")); }
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
                if node.attributes.get("isString").and_then(|v| v.as_bool()) == Some(true) {
                    return format!("\"{}\"", attr_str(node, "value"));
                }
                attr_str(node, "value").to_string()
            }
            "Identifier"       => attr_str(node, "name").to_string(),
            "BinaryExpression" => format!("({} {} {})",
                self.gen_child(node, 0), attr_str(node, "operator"), self.gen_child(node, 1)),
            "UnaryExpression"  => {
                let op = attr_str(node, "operator");
                if node.attributes.get("prefix").and_then(|v| v.as_bool()) == Some(true) {
                    format!("({op}{})", self.gen_child(node, 0))
                } else {
                    format!("({}{})", self.gen_child(node, 0), op)
                }
            }
            "CallExpression" => {
                let callee = attr_str(node, "callee");
                let args: Vec<String> = node.children.iter().map(|c| self.gen_expr(c)).collect();
                format!("{callee}({})", args.join(", "))
            }
            "ArrayInitializer"    => format!("{{ {} }}", node.children.iter().map(|c| self.gen_expr(c)).collect::<Vec<_>>().join(", ")),
            "SubscriptExpression" => format!("{}[{}]", self.gen_child(node, 0), self.gen_child(node, 1)),
            "ConditionalExpression" => format!("({} ? {} : {})",
                self.gen_child(node, 0), self.gen_child(node, 1), self.gen_child(node, 2)),
            "CastExpression"    => format!("({})({})", attr_str(node, "targetType"), self.gen_child(node, 0)),
            "SizeofExpression"  => format!("sizeof({})", self.gen_child(node, 0)),
            "MemberExpression"  => {
                let op = if attr_str(node, "operator").is_empty() { "." } else { attr_str(node, "operator") };
                format!("{}{op}{}", self.gen_child(node, 0), attr_str(node, "property"))
            }
            "GpioRead"          => format!("digitalRead({})", self.gen_child(node, 0)),
            "AnalogRead"        => format!("analogRead({})", self.gen_child(node, 0)),
            "SerialAvailable"   => "Serial.available()".to_string(),
            "SerialReadString"  => "Serial.readString()".to_string(),
            "GpioSet"           => format!("digitalWrite({}, {})", self.gen_child(node, 0), self.gen_child(node, 1)),
            "DelayMs"           => format!("delay({})", self.gen_child(node, 0)),
            "AnalogWrite"       => format!("analogWrite({}, {})", self.gen_child(node, 0), self.gen_child(node, 1)),
            "Print"             => format!("Serial.println({})", self.gen_child(node, 0)),
            "ServoRead"         => {
                let var = if !attr_str(node, "varName").is_empty() { attr_str(node, "varName") } else { attr_str(node, "name") };
                format!("{var}.read()")
            }
            "ServoAttached" => {
                let var = if !attr_str(node, "varName").is_empty() { attr_str(node, "varName") } else { attr_str(node, "name") };
                format!("{var}.attached()")
            }
            _ => {
                let fields: Vec<String> = node.children.iter().map(|c| {
                    let name = attr_str(c, "name");
                    let val = c.children.first().map(|cc| self.gen_expr(cc)).unwrap_or_else(|| self.gen_expr(c));
                    format!(".{name} = {val}")
                }).collect();
                format!("{{ {} }}", fields.join(", "))
            }
        }
    }
}

// Shims padrão C/Arduino
fn default_c_shims() -> Vec<ShimDefinition> {
    vec![
        ShimDefinition::new("servo", "#include <Servo.h>")
            .with_description("Arduino Servo library"),
        ShimDefinition::new("wire", "#include <Wire.h>")
            .with_description("I2C library"),
        ShimDefinition::new("sevseg", "#include <SevSeg.h>")
            .with_description("Seven-segment display library"),
    ]
}

// Helper: extrai atributo string com fallback vazio
fn attr_str<'a>(node: &'a BaseNode, key: &str) -> &'a str {
    node.attributes.get(key).and_then(|v| v.as_str()).unwrap_or("")
}
