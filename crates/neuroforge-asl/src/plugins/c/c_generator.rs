//! CGenerator — gerador de código C++/Arduino a partir de AslProgram.
//! Migrado para a Arquitetura NeuroForge Fase 1C (Consome ASL JSON Tree Omni-direcional).

use crate::types::asl_types::*;
use crate::plugins::core::{AslGenerator, GeneratorOutput, SourceMapEntry};
use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};

pub struct CGenerator {
    source_map: Vec<SourceMapEntry>,
    current_line: u32,
    shims: ShimManager,
}

impl Default for CGenerator {
    fn default() -> Self {
        Self::new()
    }
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

    fn scan_for_shims(&mut self, program: &AslProgram) {
        let stringified = serde_json::to_string(program).unwrap_or_default();
        if stringified.contains("sevseg") {
            self.shims.require_shim("sevseg");
        }
        if stringified.contains("servo") || stringified.contains("Servo") {
            self.shims.require_shim("servo");
        }
        if stringified.contains("Wire") || stringified.contains("i2c") {
            self.shims.require_shim("wire");
        }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str) {
        lines.push(text.to_string());
        self.current_line += text.lines().count().max(1) as u32;
    }

    fn gen_expr(&mut self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();
                if let Some(v) = l.value.as_f64() {
                    if v.fract() != 0.0 { return format!("{}", v); }
                }
                if let Some(s_val) = l.value.as_str() { return format!("\"{}\"", s_val); }
                s
            }
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => {
                format!("({} {} {})", self.gen_expr(&b.left), b.op.to_symbol(), self.gen_expr(&b.right))
            }
            AslExpr::Unary(u) => {
                format!("({}{})", u.op.to_symbol(), self.gen_expr(&u.expr))
            }
            AslExpr::Call(c) => {
                let args: Vec<String> = c.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}({})", c.callee, args.join(", "))
            }
            AslExpr::Member(m) => {
                format!("{}.{}", self.gen_expr(&m.target), m.property)
            }
            AslExpr::Index(i) => {
                format!("{}[{}]", self.gen_expr(&i.target), self.gen_expr(&i.index))
            }
            AslExpr::Array(a) => {
                let elems: Vec<String> = a.elements.iter().map(|e| self.gen_expr(e)).collect();
                format!("{{ {} }}", elems.join(", "))
            }
            _ => "0".to_string(),
        }
    }

    fn gen_stmt(&mut self, stmt: &AslStatement, lines: &mut Vec<String>, indent: &str) {
        match stmt {
            AslStatement::Comment(c) => {
                let text = c.text.trim();
                let text = if text.starts_with('#') { format!("//{}", &text[1..]) } else { text.to_string() };
                if text.starts_with("/*") || text.starts_with("//") {
                    self.add_ln(lines, &format!("{}{}", indent, text));
                } else {
                    self.add_ln(lines, &format!("{}// {}", indent, text));
                }
            }
            AslStatement::Declare(d) => {
                let val = d.value.as_ref().map(|v| self.gen_expr(v)).unwrap_or_else(|| "0".to_string());
                let is_array = d.value.as_ref().map(|v| matches!(v, AslExpr::Array(_))).unwrap_or(false);
                let arr_suffix = if is_array { "[]" } else { "" };
                let t_str = match d.r#type {
                    AslType::Int => "int",
                    AslType::Float => "float",
                    AslType::Bool => "bool",
                    AslType::String => "String",
                    AslType::Void => "void",
                    AslType::Struct => "struct",
                };
                self.add_ln(lines, &format!("{}{} {}{} = {};", indent, t_str, d.name, arr_suffix, val));
            }
            AslStatement::Assign(a) => {
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}{} = {};", indent, a.target, val));
            }
            AslStatement::SetIndex(s) => {
                let idx = self.gen_expr(&s.index);
                let val = self.gen_expr(&s.value);
                self.add_ln(lines, &format!("{}{}[{}] = {};", indent, s.target, idx, val));
            }
            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);
                let mode = match p.mode {
                    PinModeKind::Output => "OUTPUT",
                    PinModeKind::Input => "INPUT",
                    PinModeKind::InputPullup => "INPUT_PULLUP",
                };
                self.add_ln(lines, &format!("{}pinMode({}, {});", indent, pin, mode));
            }
            AslStatement::DigitalWrite(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = match &d.value {
                    DigitalValue::High => "HIGH".to_string(),
                    DigitalValue::Low => "LOW".to_string(),
                    DigitalValue::Expr(e) => self.gen_expr(e),
                };
                self.add_ln(lines, &format!("{}digitalWrite({}, {});", indent, pin, val));
            }
            AslStatement::Read(r) => {
                let pin = self.gen_expr(&r.pin);
                if matches!(r.mode, ReadMode::Analog) {
                    self.add_ln(lines, &format!("{}{} = analogRead({});", indent, r.target, pin));
                } else {
                    self.add_ln(lines, &format!("{}{} = digitalRead({});", indent, r.target, pin));
                }
            }
            AslStatement::AnalogWrite(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}analogWrite({}, {});", indent, pin, val));
            }
            AslStatement::Delay(d) => {
                let ms = self.gen_expr(&d.milliseconds);
                self.add_ln(lines, &format!("{}delay({});", indent, ms));
            }
            AslStatement::SerialBegin(s) => {
                let b = self.gen_expr(&s.baud);
                self.add_ln(lines, &format!("{}Serial.begin({});", indent, b));
            }
            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                if args.is_empty() { return; }
                if p.newline {
                    self.add_ln(lines, &format!("{}Serial.println({});", indent, args[0]));
                } else {
                    self.add_ln(lines, &format!("{}Serial.print({});", indent, args[0]));
                }
            }
            AslStatement::If(i) => {
                let cond = self.gen_expr(&i.condition);
                self.add_ln(lines, &format!("{}if ({}) {{", indent, cond));
                for b in &i.then_branch { self.gen_stmt(b, lines, &format!("{}  ", indent)); }
                
                if let Some(eb) = &i.else_branch {
                    if eb.len() == 1 && matches!(eb[0], AslStatement::If(_)) {
                        self.add_ln(lines, &format!("{}}} else ", indent));
                        // Redução de indentação manual para encadear `else if`
                        let mut temp = vec![];
                        self.gen_stmt(&eb[0], &mut temp, indent);
                        if let Some((first, rest)) = temp.split_first() {
                            if let Some(last) = lines.last_mut() { *last += first.trim_start(); }
                            lines.extend(rest.iter().map(|l| format!("{}{}", indent, l.trim_start())));
                        }
                    } else {
                        self.add_ln(lines, &format!("{}}} else {{", indent));
                        for b in eb { self.gen_stmt(b, lines, &format!("{}  ", indent)); }
                        self.add_ln(lines, &format!("{}}}", indent));
                    }
                } else {
                    self.add_ln(lines, &format!("{}}}", indent));
                }
            }
            AslStatement::While(w) => {
                let cond = self.gen_expr(&w.condition);
                self.add_ln(lines, &format!("{}while ({}) {{", indent, cond));
                for b in &w.body { self.gen_stmt(b, lines, &format!("{}  ", indent)); }
                self.add_ln(lines, &format!("{}}}", indent));
            }
            AslStatement::ForIn(f) => {
                let iter = self.gen_expr(&f.iterable);
                self.add_ln(lines, &format!("{}for (auto {} : {}) {{", indent, f.var_name, iter));
                for b in &f.body { self.gen_stmt(b, lines, &format!("{}  ", indent)); }
                self.add_ln(lines, &format!("{}}}", indent));
            }
            AslStatement::Return(r) => {
                if let Some(v) = &r.value {
                    let val = self.gen_expr(v);
                    self.add_ln(lines, &format!("{}return {};", indent, val));
                } else {
                    self.add_ln(lines, &format!("{}return;", indent));
                }
            }
            AslStatement::Break => { self.add_ln(lines, &format!("{}break;", indent)); }
            AslStatement::Continue => { self.add_ln(lines, &format!("{}continue;", indent)); }
            AslStatement::Expr(e) => {
                let ex = self.gen_expr(&e.expr);
                self.add_ln(lines, &format!("{}{};", indent, ex));
            }
            AslStatement::ServoAttach(s) => {
                let pin = self.gen_expr(&s.pin);
                self.add_ln(lines, &format!("{}{}.attach({});", indent, s.var_name, pin));
            }
            AslStatement::ServoWrite(s) => {
                let angle_str = self.gen_expr(&s.angle);
                if s.raw_microseconds.unwrap_or(false) {
                    self.add_ln(lines, &format!("{}{}.writeMicroseconds({});", indent, s.var_name, angle_str));
                } else {
                    self.add_ln(lines, &format!("{}{}.write({});", indent, s.var_name, angle_str));
                }
            }
            AslStatement::ServoDetach(s) => {
                self.add_ln(lines, &format!("{}{}.detach();", indent, s.var_name));
            }
            AslStatement::UartWrite(u) => {
                let data = self.gen_expr(&u.data);
                self.add_ln(lines, &format!("{}Serial.write({});", indent, data));
            }
            AslStatement::I2cWrite(i) => {
                let addr = self.gen_expr(&i.address);
                let data = self.gen_expr(&i.data);
                self.add_ln(lines, &format!("{}Wire.beginTransmission({});", indent, addr));
                self.add_ln(lines, &format!("{}Wire.write({});", indent, data));
                self.add_ln(lines, &format!("{}Wire.endTransmission();", indent));
            }
            AslStatement::I2cRead(i) => {
                let addr = self.gen_expr(&i.address);
                let len = self.gen_expr(&i.length);
                self.add_ln(lines, &format!("{}Wire.requestFrom({}, {});", indent, addr, len));
                self.add_ln(lines, &format!("{}{} = Wire.read();", indent, i.target));
            }
            _ => {
                self.add_ln(lines, &format!("{}// Unhandled ASL Statement", indent));
            }
        }
    }
}

impl AslGenerator for CGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();
        let mut lines: Vec<String> = Vec::with_capacity(256);

        self.scan_for_shims(program);

        self.add_ln(&mut lines, "// Generated C++ / Arduino Code");
        self.add_ln(&mut lines, "#include <Arduino.h>");

        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line);
            }
        }
        self.add_ln(&mut lines, "");

        let has_setup = program.functions.iter().any(|f| f.name == "setup");
        let has_loop = program.functions.iter().any(|f| f.name == "loop");
        let has_main = program.functions.iter().any(|f| f.name == "main");

        for global in &program.globals {
            let val = global.initial_value.as_ref().map(|v| v.to_string()).unwrap_or_else(|| "0".to_string());
            let t_str = match global.r#type {
                AslType::Int => "int",
                AslType::Float => "float",
                AslType::Bool => "bool",
                AslType::String => "String",
                AslType::Void => "void",
                AslType::Struct => "struct",
            };
            self.add_ln(&mut lines, &format!("{} {} = {};", t_str, global.name, val));
        }
        if !program.globals.is_empty() {
            self.add_ln(&mut lines, "");
        }

        if has_setup || has_loop || has_main {
            for func in &program.functions {
                let params: Vec<String> = func.params.iter().map(|p| format!("{} {}", p.r#type, p.name)).collect();
                let ret = match &func.return_type {
                    Some(AslType::Int) => "int",
                    Some(AslType::Float) => "float",
                    Some(AslType::Bool) => "bool",
                    Some(AslType::String) => "String",
                    Some(AslType::Void) | None => "void",
                    Some(AslType::Struct) => "struct",
                };
                
                self.add_ln(&mut lines, &format!("{} {}({}) {{", ret, func.name, params.join(", ")));
                for stmt in &func.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }
                
                if func.name == "main" {
                    self.add_ln(&mut lines, "  return 0;");
                }
                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            }
        } else {
            // Se for um bloco puro (ou ASL Task-based), gera um setup/loop padrão para Arduino
            self.add_ln(&mut lines, "void setup() {");
            for task in &program.tasks {
                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }
            }
            self.add_ln(&mut lines, "}");
            self.add_ln(&mut lines, "");

            self.add_ln(&mut lines, "void loop() {");
            self.add_ln(&mut lines, "}");
            self.add_ln(&mut lines, "");
        }

        GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
        }
    }
}

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
