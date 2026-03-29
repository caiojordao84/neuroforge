//! RustGenerator — gerador de código Rust (embassy + standalone) a partir de AslProgram.
//! Migrado para a Arquitetura NeuroForge Fase 1C (Consome ASL JSON Tree Omni-direcional).

use crate::types::asl_types::*;
use crate::plugins::core::{AslGenerator, GeneratorOutput, SourceMapEntry};
use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};

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
        Self {
            source_map: vec![],
            current_line: 1,
            shims,
        }
    }

    fn scan_for_shims(&mut self, program: &AslProgram) {
        // Implementação simplificada para rastreio de shims.
        // O ideal é varrer iterativamente ou via Visitor tipado.
        // Aqui checamos se determinadas funções/tipos são usados.
        let stringified = serde_json::to_string(program).unwrap_or_default();
        if stringified.contains("EEPROM") {
            self.shims.require_shim("EEPROM");
        }
        if stringified.contains("lcd.") || stringified.contains("LiquidCrystal_I2C") {
            self.shims.require_shim("LiquidCrystal_I2C");
        }
        if stringified.contains("keypad") || stringified.contains("Keypad") {
            self.shims.require_shim("Keypad");
        }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str) {
        lines.push(text.to_string());
        // Na nova implementação sem Node lines diretos, o source mapping exato 
        // seria feito associando metadados dos `AslStatement`.
        // Para simplificar a performance agora, omitimos linhas exatas se não vierem no AST.
        self.current_line += text.lines().count().max(1) as u32;
    }

    fn gen_expr(&mut self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();
                if let Some(v) = l.value.as_f64() {
                    if v.fract() != 0.0 {
                        return format!("{}f32", v);
                    }
                }
                if let Some(s_val) = l.value.as_str() {
                    return format!("\"{}\"", s_val); 
                }
                s
            }
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => {
                format!("{} {} {}", self.gen_expr(&b.left), b.op.to_symbol(), self.gen_expr(&b.right))
            }
            AslExpr::Unary(u) => {
                format!("{}{}", u.op.to_symbol(), self.gen_expr(&u.expr))
            }
            AslExpr::Call(c) => {
                let args: Vec<String> = c.args.iter().map(|a| self.gen_expr(a)).collect();
                let args_str = args.join(", ");
                match c.callee.as_str() {
                    "pulseIn" => format!("pulse_in({})", args_str),
                    "shiftIn" => format!("shift_in({})", args_str),
                    "shiftOut" => format!("shift_out({})", args_str),
                    "attachInterrupt" => format!("attach_interrupt({})", args_str),
                    "len" => format!("{}.len()", args_str),
                    _ => format!("{}({})", c.callee, args_str),
                }
            }
            AslExpr::Member(m) => {
                format!("{}.{}", self.gen_expr(&m.target), m.property)
            }
            AslExpr::Index(i) => {
                let tgt = self.gen_expr(&i.target);
                let idx = self.gen_expr(&i.index);
                format!("{}[{} as usize]", tgt, idx)
            }
            AslExpr::Array(a) => {
                let elems: Vec<String> = a.elements.iter().map(|e| self.gen_expr(e)).collect();
                format!("vec![{}]", elems.join(", "))
            }
            _ => "0".to_string(), // Fallback (DesignatedStruct etc. pode ser expandido depois)
        }
    }

    fn gen_stmt(&mut self, stmt: &AslStatement, lines: &mut Vec<String>, indent: &str) {
        match stmt {
            AslStatement::Comment(c) => {
                let text = c.text.trim();
                if text.starts_with("/*") || text.starts_with("//") {
                    self.add_ln(lines, &format!("{}{}", indent, text));
                } else {
                    self.add_ln(lines, &format!("{}// {}", indent, text));
                }
            }
            AslStatement::Declare(d) => {
                let val = d.value.as_ref().map(|v| self.gen_expr(v)).unwrap_or_else(|| "0".to_string());
                self.add_ln(lines, &format!("{}let mut {} = {};", indent, d.name, val));
            }
            AslStatement::Assign(a) => {
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}{} = {};", indent, a.target, val));
            }
            AslStatement::SetIndex(s) => {
                let idx = self.gen_expr(&s.index);
                let val = self.gen_expr(&s.value);
                self.add_ln(lines, &format!("{}{}[{} as usize] = {};", indent, s.target, idx, val));
            }
            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);
                let mode = match p.mode {
                    PinModeKind::Output => "Output",
                    PinModeKind::Input => "Input",
                    PinModeKind::InputPullup => "InputPullUp",
                };
                self.add_ln(lines, &format!("{}gpio_mode({}, {});", indent, pin, mode));
            }
            AslStatement::DigitalWrite(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = match &d.value {
                    DigitalValue::High => "1".to_string(),
                    DigitalValue::Low => "0".to_string(),
                    DigitalValue::Expr(e) => self.gen_expr(e),
                };
                self.add_ln(lines, &format!("{}gpio_set({}, {});", indent, pin, val));
            }
            AslStatement::Read(r) => {
                let pin = self.gen_expr(&r.pin);
                if matches!(r.mode, ReadMode::Analog) {
                    self.add_ln(lines, &format!("{}{} = adc.read({});", indent, r.target, pin));
                } else {
                    self.add_ln(lines, &format!("{}{} = gpio_get({});", indent, r.target, pin));
                }
            }
            AslStatement::AnalogWrite(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}pwm.set_duty({}, {});", indent, pin, val));
            }
            AslStatement::Delay(d) => {
                let ms = self.gen_expr(&d.milliseconds);
                self.add_ln(lines, &format!("{}delay.delay_ms({}u32);", indent, ms));
            }
            AslStatement::SerialBegin(s) => {
                let b = self.gen_expr(&s.baud);
                self.add_ln(lines, &format!("{}Serial::begin({});", indent, b));
            }
            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                if args.is_empty() { return; }
                if p.newline {
                    self.add_ln(lines, &format!("{}println!(\"{{}}\", {});", indent, args[0]));
                } else {
                    self.add_ln(lines, &format!("{}print!(\"{{}}\", {});", indent, args[0]));
                }
            }
            AslStatement::If(i) => {
                let cond = self.gen_expr(&i.condition);
                self.add_ln(lines, &format!("{}if {} {{", indent, cond));
                for b in &i.then_branch {
                    self.gen_stmt(b, lines, &format!("{}    ", indent));
                }
                if let Some(eb) = &i.else_branch {
                    if eb.len() == 1 && matches!(eb[0], AslStatement::If(_)) {
                        self.add_ln(lines, &format!("{}}} else {{", indent));
                        self.gen_stmt(&eb[0], lines, indent);
                        self.add_ln(lines, &format!("{}}}", indent));
                    } else {
                        self.add_ln(lines, &format!("{}}} else {{", indent));
                        for b in eb {
                            self.gen_stmt(b, lines, &format!("{}    ", indent));
                        }
                        self.add_ln(lines, &format!("{}}}", indent));
                    }
                } else {
                    self.add_ln(lines, &format!("{}}}", indent));
                }
            }
            AslStatement::While(w) => {
                let cond = self.gen_expr(&w.condition);
                self.add_ln(lines, &format!("{}while {} {{", indent, cond));
                for b in &w.body {
                    self.gen_stmt(b, lines, &format!("{}    ", indent));
                }
                self.add_ln(lines, &format!("{}}}", indent));
            }
            AslStatement::ForIn(f) => {
                let iter = self.gen_expr(&f.iterable);
                self.add_ln(lines, &format!("{}for {} in {} {{", indent, f.var_name, iter));
                for b in &f.body {
                    self.gen_stmt(b, lines, &format!("{}    ", indent));
                }
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
            AslStatement::Break => {
                self.add_ln(lines, &format!("{}break;", indent));
            }
            AslStatement::Continue => {
                self.add_ln(lines, &format!("{}continue;", indent));
            }
            AslStatement::Expr(e) => {
                let ex = self.gen_expr(&e.expr);
                self.add_ln(lines, &format!("{}{};", indent, ex));
            }
            AslStatement::UartWrite(u) => {
                let port = self.gen_expr(&u.port);
                let data = self.gen_expr(&u.data);
                self.add_ln(lines, &format!("{}uart_write({}, {});", indent, port, data));
            }
            AslStatement::I2cWrite(i) => {
                let addr = self.gen_expr(&i.address);
                let data = self.gen_expr(&i.data);
                self.add_ln(lines, &format!("{}i2c_write({}, {});", indent, addr, data));
            }
            AslStatement::I2cRead(i) => {
                let addr = self.gen_expr(&i.address);
                let len = self.gen_expr(&i.length);
                self.add_ln(lines, &format!("{}{} = i2c_read({}, {});", indent, i.target, addr, len));
            }
            AslStatement::SpiTransfer(s) => {
                let cs = self.gen_expr(&s.cs_pin);
                let val = self.gen_expr(&s.tx_data);
                self.add_ln(lines, &format!("{}spi_transfer({}, {});", indent, cs, val));
            }
            _ => {
                self.add_ln(lines, &format!("{}// Unhandled ASL Statement", indent));
            }
        }
    }
}

impl AslGenerator for RustGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();
        let mut lines: Vec<String> = Vec::with_capacity(256);

        self.scan_for_shims(program);

        // Detect se é um sketch estilo Arduino
        let setup = program.functions.iter().find(|f| f.name == "setup");
        let loop_ = program.functions.iter().find(|f| f.name == "loop");
        let main_fn = program.functions.iter().find(|f| f.name == "main");
        let is_embassy = setup.is_some() || loop_.is_some();

        if is_embassy {
            self.add_ln(&mut lines, "// Generated Rust Code (Embassy/ESP32)");
            self.add_ln(&mut lines, "#![no_std]");
            self.add_ln(&mut lines, "#![no_main]");
            self.add_ln(&mut lines, "");
            self.add_ln(&mut lines, "use esp_hal::prelude::*;");
            self.add_ln(&mut lines, "");
        } else {
            self.add_ln(&mut lines, "// Generated Rust Code (Standard)");
        }

        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line);
            }
            self.add_ln(&mut lines, "");
        }

        // Globais
        for global in &program.globals {
            let val = global.initial_value.as_ref().map(|v| v.to_string()).unwrap_or_else(|| "0".to_string());
            let t_str = match global.r#type {
                AslType::Int => "i32",
                AslType::Float => "f32",
                AslType::Bool => "bool",
                AslType::String => "String",
                AslType::Void => "()",
                AslType::Struct => "struct",
            };
            self.add_ln(&mut lines, &format!("static mut {}: {} = {};", global.name, t_str, val));
        }
        if !program.globals.is_empty() {
            self.add_ln(&mut lines, "");
        }

        // Helper functions
        let helpers = program.functions.iter().filter(|f| f.name != "setup" && f.name != "loop" && f.name != "main");
        for f in helpers {
            let params: Vec<String> = f.params.iter().map(|p| format!("{}: {}", p.name, p.r#type)).collect();
            let ret = match &f.return_type {
                Some(AslType::Int) => " -> i32".to_string(),
                Some(AslType::Float) => " -> f32".to_string(),
                Some(AslType::Bool) => " -> bool".to_string(),
                Some(AslType::String) => " -> String".to_string(),
                Some(AslType::Void) | None => "".to_string(),
                Some(AslType::Struct) => " -> struct".to_string(),
            };
            self.add_ln(&mut lines, &format!("fn {}({}){} {{", f.name, params.join(", "), ret));
            for stmt in &f.body {
                self.gen_stmt(stmt, &mut lines, "    ");
            }
            self.add_ln(&mut lines, "}");
            self.add_ln(&mut lines, "");
        }

        if is_embassy {
            self.add_ln(&mut lines, "#[entry]");
            self.add_ln(&mut lines, "fn main() -> ! {");
            self.add_ln(&mut lines, "    let peripherals = Peripherals::take();");
            self.add_ln(&mut lines, "    let system = peripherals.SYSTEM.split();");
            self.add_ln(&mut lines, "    let clocks = ClockControl::boot_defaults(system.clock_control).freeze();");
            self.add_ln(&mut lines, "    let mut delay = Delay::new(&clocks);");
            self.add_ln(&mut lines, "");

            if let Some(s) = setup {
                self.add_ln(&mut lines, "    // Setup");
                for stmt in &s.body {
                    self.gen_stmt(stmt, &mut lines, "    ");
                }
            }

            self.add_ln(&mut lines, "");
            self.add_ln(&mut lines, "    loop {");
            if let Some(l) = loop_ {
                for stmt in &l.body {
                    self.gen_stmt(stmt, &mut lines, "        ");
                }
            }
            self.add_ln(&mut lines, "    }");
            self.add_ln(&mut lines, "}");
        } else if let Some(mf) = main_fn {
            self.add_ln(&mut lines, "fn main() {");
            for stmt in &mf.body {
                self.gen_stmt(stmt, &mut lines, "    ");
            }
            self.add_ln(&mut lines, "}");
        }

        GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
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
