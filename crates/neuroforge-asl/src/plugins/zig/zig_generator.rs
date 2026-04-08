//! ZigGenerator - Code generator for Zig (microzig framework).
//!
//! Generates Zig code targeting embedded systems using the microzig framework.
//! Supports pin operations, timing, UART/I2C/SPI via machine abstractions.

use crate::types::asl_types::*;

use crate::plugins::core::{AslGenerator, GeneratorOutput, SourceMapEntry};

use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};

use crate::types::asl_types::core::operators::{BinaryOp, UnaryOp};

pub struct ZigGenerator {
    source_map: Vec<SourceMapEntry>,
    current_line: u32,
    shims: ShimManager,
    /// Whether to use embedded mode (no_std + @import("machine"))
    embedded_mode: bool,
}

impl Default for ZigGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl ZigGenerator {
    pub fn new() -> Self {
        let mut shims = ShimManager::new(ShimLanguage::Zig);

        shims.register_shims(default_zig_shims());

        Self {
            source_map: vec![],
            current_line: 1,
            shims,
            embedded_mode: true,
        }
    }

    pub fn with_std_mode(mut self) -> Self {
        self.embedded_mode = false;
        self
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

        if stringified.contains("spi") || stringified.contains("SPI") {
            self.shims.require_shim("spi");
        }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str) {
        lines.push(text.to_string());
        self.current_line += text.lines().count().max(1) as u32;
    }

    /// Check if a statement uses a specific variable name
    fn stmt_uses_var(&self, stmt: &AslStatement, var_name: &str) -> bool {
        match stmt {
            AslStatement::Declare(d) => d.name == var_name,
            AslStatement::Assign(a) => a.target == var_name,
            AslStatement::If(i) => {
                self.expr_uses_var(&i.condition, var_name)
                    || i.then_body.iter().any(|s| self.stmt_uses_var(s, var_name))
                    || i.else_if
                        .iter()
                        .any(|ei| ei.body.iter().any(|s| self.stmt_uses_var(s, var_name)))
                    || i.else_body
                        .as_ref()
                        .is_some_and(|eb| eb.iter().any(|s| self.stmt_uses_var(s, var_name)))
            }
            AslStatement::While(w) => {
                self.expr_uses_var(&w.condition, var_name)
                    || w.body.iter().any(|s| self.stmt_uses_var(s, var_name))
            }
            AslStatement::For(f) => match f.as_ref() {
                AslFor::Range(r) => {
                    r.var == var_name
                        || self.expr_uses_var(&r.from, var_name)
                        || self.expr_uses_var(&r.to, var_name)
                        || self.expr_uses_var(&r.step, var_name)
                        || r.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
                AslFor::Each(e) => {
                    e.var == var_name
                        || self.expr_uses_var(&e.iterable, var_name)
                        || e.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
                AslFor::CStyle(c) => {
                    c.init.iter().any(|s| self.stmt_uses_var(s, var_name))
                        || self.expr_uses_var(&c.condition, var_name)
                        || c.update.iter().any(|s| self.stmt_uses_var(s, var_name))
                        || c.body.iter().any(|s| self.stmt_uses_var(s, var_name))
                }
            },
            AslStatement::Return(r) => r
                .value
                .as_ref()
                .is_some_and(|v| self.expr_uses_var(v, var_name)),
            AslStatement::Expr(e) => self.expr_uses_var(&e.expr, var_name),
            AslStatement::Break => false,
            AslStatement::Continue => false,
            AslStatement::Switch(s) => {
                self.expr_uses_var(&s.discriminant, var_name)
                    || s.cases
                        .iter()
                        .any(|c| c.body.iter().any(|s| self.stmt_uses_var(s, var_name)))
            }
            AslStatement::Delay(_d) => false,
            AslStatement::DigitalOutput(d) => {
                self.expr_uses_var(&d.pin, var_name) || self.expr_uses_var(&d.value, var_name)
            }
            AslStatement::DigitalInput(d) => self.expr_uses_var(&d.pin, var_name),
            AslStatement::AnalogOutput(a) => {
                self.expr_uses_var(&a.pin, var_name) || self.expr_uses_var(&a.value, var_name)
            }
            AslStatement::AnalogInput(a) => self.expr_uses_var(&a.pin, var_name),
            AslStatement::PwmInit(p) => {
                self.expr_uses_var(&p.pin, var_name) || self.expr_uses_var(&p.freq, var_name)
            }
            AslStatement::PwmSetDuty(p) => {
                self.expr_uses_var(&p.pin, var_name) || self.expr_uses_var(&p.duty, var_name)
            }
            AslStatement::Print(p) => p.args.iter().any(|a| self.expr_uses_var(a, var_name)),
            _ => false,
        }
    }

    fn expr_uses_var(&self, expr: &AslExpr, var_name: &str) -> bool {
        match expr {
            AslExpr::Var(v) => v.name == var_name,
            AslExpr::Binary(b) => {
                self.expr_uses_var(&b.left, var_name) || self.expr_uses_var(&b.right, var_name)
            }
            AslExpr::Unary(u) => self.expr_uses_var(&u.expr, var_name),
            AslExpr::Call(c) => c.args.iter().any(|a| self.expr_uses_var(a, var_name)),
            AslExpr::Member(m) => self.expr_uses_var(&m.target, var_name),
            AslExpr::Index(i) => {
                self.expr_uses_var(&i.target, var_name) || self.expr_uses_var(&i.index, var_name)
            }
            AslExpr::Array(a) => a.elements.iter().any(|e| self.expr_uses_var(e, var_name)),
            _ => false,
        }
    }

    fn gen_type(&self, t: &AslType) -> String {
        match t {
            AslType::Int | AslType::Int32 | AslType::Sint8 | AslType::Int16 | AslType::Short => {
                "i32".to_string()
            }
            AslType::Uint | AslType::Uint32 | AslType::Uint8 | AslType::Uint16 | AslType::Byte => {
                "u32".to_string()
            }
            AslType::Int64 | AslType::Long => "i64".to_string(),
            AslType::Uint64 => "u64".to_string(),
            AslType::Float | AslType::Double => "f32".to_string(),
            AslType::Bool => "bool".to_string(),
            AslType::String => "[]const u8".to_string(),
            AslType::Void => "void".to_string(),
            _ => "anytype".to_string(),
        }
    }

    fn gen_expr(&mut self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();

                if let Some(v) = l.value.as_f64() {
                    if v.fract() != 0.0 {
                        return format!("{}", v);
                    }
                    // Integer without decimal
                    return format!("{}", v as i64);
                }

                if let Some(s_val) = l.value.as_str() {
                    return format!("\"{}\"", s_val);
                }

                if let Some(b) = l.value.as_bool() {
                    return format!("{}", b);
                }

                s
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                let op = match b.op {
                    BinaryOp::Add => "+",
                    BinaryOp::Sub => "-",
                    BinaryOp::Mul => "*",
                    BinaryOp::Div => "/",
                    BinaryOp::Mod => "%",
                    BinaryOp::Eq => "==",
                    BinaryOp::Neq => "!=",
                    BinaryOp::Lt => "<",
                    BinaryOp::Gt => ">",
                    BinaryOp::Lte => "<=",
                    BinaryOp::Gte => ">=",
                    BinaryOp::And => "and",
                    BinaryOp::Or => "or",
                    BinaryOp::BitAnd => "&",
                    BinaryOp::BitOr => "|",
                    BinaryOp::BitXor => "^",
                    BinaryOp::Shl => "<<",
                    BinaryOp::Shr => ">>",
                    _ => "?",
                };
                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    op,
                    self.gen_expr(&b.right)
                )
            }

            AslExpr::Unary(u) => {
                let op = match u.op {
                    UnaryOp::Not => "!",
                    UnaryOp::Neg => "-",
                    UnaryOp::BitNot => "~",
                    UnaryOp::Pos => "+",
                    UnaryOp::Addr => "&",
                    UnaryOp::Deref => "*",
                };
                format!("({}{})", op, self.gen_expr(&u.expr))
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
                if self.embedded_mode {
                    format!("{{ {} }}", elems.join(", "))
                } else {
                    format!("&[_]{{ {} }}", elems.join(", "))
                }
            }

            _ => "0".to_string(),
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
                let val = d
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());

                let t_str = self.gen_type(&d.r#type);

                self.add_ln(
                    lines,
                    &format!("{}var {}: {} = {};", indent, d.name, t_str, val),
                );
            }

            AslStatement::Assign(a) => {
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}{} = {};", indent, a.target, val));
            }

            AslStatement::SetIndex(s) => {
                let idx = self.gen_expr(&s.index);
                let val = self.gen_expr(&s.value);
                self.add_ln(
                    lines,
                    &format!("{}{}[{}] = {};", indent, s.target, idx, val),
                );
            }

            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);

                let mode = match p.mode {
                    PinModeKind::Output => ".output",
                    PinModeKind::Input => ".input",
                    PinModeKind::InputPullup => ".input_pullup",
                    _ => ".input",
                };

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}pins.{}.setMode({});", indent, pin, mode));
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}gpio.setPinMode({}, {});", indent, pin, mode),
                    );
                }
            }

            AslStatement::DigitalOutput(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = self.gen_expr(&d.value);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}pins.{}.setOutput({});", indent, pin, val),
                    );
                } else {
                    self.add_ln(lines, &format!("{}gpio.write({}, {});", indent, pin, val));
                }
            }

            AslStatement::DigitalInput(r) => {
                let pin = self.gen_expr(&r.pin);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}{} = pins.{}.read();", indent, r.target, pin),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}{} = gpio.read({});", indent, r.target, pin),
                    );
                }
            }

            AslStatement::AnalogInput(r) => {
                let pin = self.gen_expr(&r.pin);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}{} = adcs.{}.read();", indent, r.target, pin),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}{} = adc.read({});", indent, r.target, pin),
                    );
                }
            }

            AslStatement::AnalogOutput(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}dacs.{}.write({});", indent, pin, val));
                } else {
                    self.add_ln(lines, &format!("{}dac.write({}, {});", indent, pin, val));
                }
            }

            AslStatement::Delay(d) => {
                let ms = d.duration.total_ms();

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}time.sleep({} * std.time.ns_per_ms);", indent, ms),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}std.time.sleep({} * std.time.ns_per_ms);", indent, ms),
                    );
                }
            }

            AslStatement::SerialBegin(s) => {
                let b = self.gen_expr(&s.baud);

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}serial.init({});", indent, b));
                } else {
                    self.add_ln(
                        lines,
                        &format!(
                            "{}std.debug.print(\"Serial init with baud: {{}}\\n\", .{{{}}});",
                            indent, b
                        ),
                    );
                    // In std mode, we'd use std.io
                    self.add_ln(lines, &format!("{}_ = {};", indent, b)); // Suppress unused warning
                }
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();

                if args.is_empty() {
                    return;
                }

                if self.embedded_mode {
                    if p.newline {
                        self.add_ln(
                            lines,
                            &format!(
                                "{}serial.print(\"{{}}\\n\", .{{{}}});",
                                indent,
                                args.join(", ")
                            ),
                        );
                    } else {
                        self.add_ln(
                            lines,
                            &format!(
                                "{}serial.print(\"{{}}\", .{{{}}});",
                                indent,
                                args.join(", ")
                            ),
                        );
                    }
                } else {
                    if p.newline {
                        self.add_ln(
                            lines,
                            &format!(
                                "{}std.debug.print(\"{{}}\\n\", .{{{}}});",
                                indent,
                                args.join(", ")
                            ),
                        );
                    } else {
                        self.add_ln(
                            lines,
                            &format!(
                                "{}std.debug.print(\"{{}}\", .{{{}}});",
                                indent,
                                args.join(", ")
                            ),
                        );
                    }
                }
            }

            AslStatement::If(i) => {
                let cond = self.gen_expr(&i.condition);

                self.add_ln(lines, &format!("{}if ({}) {{", indent, cond));

                for b in &i.then_body {
                    self.gen_stmt(b, lines, &format!("{}  ", indent));
                }

                for ei in &i.else_if {
                    let ei_cond = self.gen_expr(&ei.condition);
                    self.add_ln(lines, &format!("{}}} else if ({}) {{", indent, ei_cond));

                    for b in &ei.body {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }
                }

                if let Some(eb) = &i.else_body {
                    self.add_ln(lines, &format!("{}}} else {{", indent));

                    for b in eb {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }

                    self.add_ln(lines, &format!("{}}}", indent));
                } else {
                    self.add_ln(lines, &format!("{}}}", indent));
                }
            }

            AslStatement::While(w) => {
                let cond = self.gen_expr(&w.condition);

                self.add_ln(lines, &format!("{}while ({}) {{", indent, cond));

                for b in &w.body {
                    self.gen_stmt(b, lines, &format!("{}  ", indent));
                }

                self.add_ln(lines, &format!("{}}}", indent));
            }

            AslStatement::For(f) => {
                match f.as_ref() {
                    AslFor::Range(r) => {
                        let from = self.gen_expr(&r.from);
                        let to = self.gen_expr(&r.to);
                        let step = self.gen_expr(&r.step);

                        self.add_ln(
                            lines,
                            &format!(
                                "{}var {}: i32 = {}; while ({} < {}) : ({{ {} += {}; }}) {{",
                                indent, r.var, from, r.var, to, r.var, step
                            ),
                        );

                        for b in &r.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }

                    AslFor::Each(e) => {
                        let iter = self.gen_expr(&e.iterable);

                        self.add_ln(
                            lines,
                            &format!("{}for ({}.*, &{}) {{ |item|", indent, iter, e.var),
                        );

                        for b in &e.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }

                    AslFor::CStyle(c) => {
                        // C-style for loop - transform to while loop in Zig
                        if let Some(first) = c.init.first() {
                            self.gen_stmt(first, lines, indent);
                        }

                        let cond_str = self.gen_expr(&c.condition);
                        self.add_ln(lines, &format!("{}while ({}) {{", indent, cond_str));

                        for b in &c.body {
                            self.gen_stmt(b, lines, &format!("{}  ", indent));
                        }

                        if let Some(first) = c.update.first() {
                            let mut temp = vec![];
                            self.gen_stmt(first, &mut temp, "");
                            let up_str = temp.join(" ").trim_end_matches(';').to_string();
                            self.add_ln(lines, &format!("{}  {}", indent, up_str));
                        }

                        self.add_ln(lines, &format!("{}}}", indent));
                    }
                }
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
                self.add_ln(lines, &format!("{}{}_ = {};", indent, indent.trim(), ex));
            }

            AslStatement::ServoAttach(s) => {
                let pin = self.gen_expr(&s.pin);
                self.add_ln(
                    lines,
                    &format!("{}servo_{}.attach({});", indent, s.var_name, pin),
                );
            }

            AslStatement::ServoWrite(s) => {
                let angle_str = self.gen_expr(&s.angle);
                self.add_ln(
                    lines,
                    &format!("{}servo_{}.write({});", indent, s.var_name, angle_str),
                );
            }

            AslStatement::ServoDetach(s) => {
                self.add_ln(lines, &format!("{}servo_{}.detach();", indent, s.var_name));
            }

            AslStatement::UartWrite(u) => {
                let data = self.gen_expr(&u.data);

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}uart.write({});", indent, data));
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}std.debug.print(\"{{}}\\n\", .{{{}}});", indent, data),
                    );
                }
            }

            AslStatement::UartRead(u) => {
                let target = &u.target;

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}{} = uart.read();", indent, target));
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// UART read not available in std mode", indent),
                    );
                }
            }

            AslStatement::I2cWrite(i) => {
                let addr = self.gen_expr(&i.address);
                let data = self.gen_expr(&i.data);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}i2c.writeRegister({}, 0x00, {});", indent, addr, data),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// I2C write: addr={}, data={}", indent, addr, data),
                    );
                }
            }

            AslStatement::I2cRead(i) => {
                let addr = self.gen_expr(&i.address);
                let len = self.gen_expr(&i.length);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!(
                            "{}{} = i2c.readRegister({}, 0x00, {});",
                            indent, i.target, addr, len
                        ),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// I2C read: addr={}, len={}", indent, addr, len),
                    );
                }
            }

            AslStatement::SpiTransfer(s) => {
                let tx_data = self.gen_expr(&s.tx_data);
                let target = s.target.as_deref().unwrap_or("_result");

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}var {} = spi.transfer({});", indent, target, tx_data),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// SPI transfer: tx_data={}", indent, tx_data),
                    );
                }
            }

            // PWM statements
            AslStatement::PwmInit(p) => {
                let pin = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);

                if self.embedded_mode {
                    self.add_ln(
                        lines,
                        &format!("{}pwm_{}.init({}, {});", indent, pin, pin, freq),
                    );
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// PWM init: pin={}, freq={}", indent, pin, freq),
                    );
                }
            }

            AslStatement::PwmSetDuty(p) => {
                let pin = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);

                if self.embedded_mode {
                    self.add_ln(lines, &format!("{}pwm_{}.setDuty({});", indent, pin, duty));
                } else {
                    self.add_ln(
                        lines,
                        &format!("{}// PWM duty: pin={}, duty={}", indent, pin, duty),
                    );
                }
            }

            _ => {
                self.add_ln(lines, &format!("{}// Unhandled ASL Statement", indent));
            }
        }
    }
}

impl AslGenerator for ZigGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();

        let mut lines: Vec<String> = Vec::with_capacity(256);

        self.scan_for_shims(program);

        // Header
        self.add_ln(&mut lines, "// Generated Zig Code (microzig framework)");
        self.add_ln(&mut lines, "");

        if self.embedded_mode {
            self.add_ln(&mut lines, "const std = @import(\"std\");");
            self.add_ln(&mut lines, "const machine = @import(\"machine\");");
            self.add_ln(&mut lines, "");
            self.add_ln(&mut lines, "// Machine abstractions");
            self.add_ln(&mut lines, "const pins = machine.Pins;");
            self.add_ln(&mut lines, "const time = machine.Time;");
            self.add_ln(&mut lines, "const serial = machine.Serial;");
            self.add_ln(&mut lines, "const i2c = machine.I2C;");
            self.add_ln(&mut lines, "const spi = machine.SPI;");
            self.add_ln(&mut lines, "const adc = machine.ADC;");
            self.add_ln(&mut lines, "const dac = machine.DAC;");
        } else {
            self.add_ln(&mut lines, "const std = @import(\"std\");");
            self.add_ln(&mut lines, "const print = std.debug.print;");
        }

        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            self.add_ln(&mut lines, "");
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line);
            }
        }

        self.add_ln(&mut lines, "");

        // Globals
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if !(has_setup && has_loop) {
            for global in &program.globals {
                let val = global
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());

                let t_str = self.gen_type(&global.r#type);

                let var_name = if global.name.is_empty() {
                    "_UNNAMED".to_string()
                } else {
                    global.name.clone()
                };

                self.add_ln(
                    &mut lines,
                    &format!("var {}: {} = {};", var_name, t_str, val),
                );
            }

            if !program.globals.is_empty() {
                self.add_ln(&mut lines, "");
            }
        }

        // Helper for detecting infinite while loops
        fn is_infinite_while_loop(stmt: &AslStatement) -> bool {
            if let AslStatement::While(w) = stmt {
                if let AslExpr::Literal(l) = &w.condition {
                    if l.value.as_bool() == Some(true) {
                        return true;
                    }
                }
            }
            false
        }

        // Tasks
        for task in &program.tasks {
            if task.name == "setup" {
                self.add_ln(&mut lines, "pub fn setup() void {");

                for stmt in &task.body {
                    if is_infinite_while_loop(stmt) {
                        continue; // Skip infinite loop in setup - it goes to loop()
                    }
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            } else if task.name == "loop" {
                self.add_ln(&mut lines, "pub fn loop() void {");

                // Collect variables that need to persist in loop()
                let mut all_var_names: std::collections::HashSet<String> =
                    std::collections::HashSet::new();

                for global in &program.globals {
                    all_var_names.insert(global.name.clone());
                }

                if let Some(setup_task) = program.tasks.iter().find(|t| t.name == "setup") {
                    for stmt in &setup_task.body {
                        match stmt {
                            AslStatement::Declare(d) => {
                                all_var_names.insert(d.name.clone());
                            }
                            AslStatement::Assign(a) => {
                                all_var_names.insert(a.target.clone());
                            }
                            _ => {}
                        }
                    }
                }

                // Find which variables are used in the loop body
                let loop_task = program.tasks.iter().find(|t| t.name == "loop");
                let mut loop_var_names: Vec<String> = Vec::new();

                if let Some(lt) = loop_task {
                    for var_name in &all_var_names {
                        for stmt in &lt.body {
                            if self.stmt_uses_var(stmt, var_name) {
                                loop_var_names.push(var_name.clone());
                                break;
                            }
                        }
                    }
                }

                // Generate static var declarations for loop-persistent variables
                for var_name in &loop_var_names {
                    let (name, val, var_type) = if let Some(global) =
                        program.globals.iter().find(|g| &g.name == var_name)
                    {
                        let val = global
                            .value
                            .as_ref()
                            .map(|v| self.gen_expr(v))
                            .unwrap_or_else(|| "0".to_string());
                        (global.name.clone(), val, global.r#type.clone())
                    } else if let Some(setup_task) =
                        program.tasks.iter().find(|t| t.name == "setup")
                    {
                        if let Some(stmt) = setup_task.body.iter().find(|s| match s {
                            AslStatement::Declare(d) => &d.name == var_name,
                            AslStatement::Assign(a) => &a.target == var_name,
                            _ => false,
                        }) {
                            match stmt {
                                AslStatement::Declare(d) => {
                                    let val = d
                                        .value
                                        .as_ref()
                                        .map(|v| self.gen_expr(v))
                                        .unwrap_or_else(|| "0".to_string());
                                    (d.name.clone(), val, d.r#type.clone())
                                }
                                AslStatement::Assign(a) => {
                                    let val = self.gen_expr(&a.value);
                                    (a.target.clone(), val, AslType::Int)
                                }
                                _ => continue,
                            }
                        } else {
                            continue;
                        }
                    } else {
                        continue;
                    };

                    let t_str = self.gen_type(&var_type);
                    self.add_ln(&mut lines, &format!("  var {}: {} = {};", name, t_str, val));
                }

                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            } else {
                // Other tasks as functions
                self.add_ln(&mut lines, &format!("pub fn {}(", task.name));

                // params...
                self.add_ln(&mut lines, ") void {");

                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }

                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            }
        }

        // Functions
        for func in &program.functions {
            let params: Vec<String> = func
                .params
                .iter()
                .map(|p| format!("{}: {}", p.name, self.gen_type(&AslType::Int)))
                .collect();

            let ret = match &func.return_type {
                Some(AslType::Int) | Some(AslType::Int32) => "i32",
                Some(AslType::Float) => "f32",
                Some(AslType::Bool) => "bool",
                Some(AslType::String) => "[]const u8",
                _ => "void",
            };

            self.add_ln(
                &mut lines,
                &format!("pub fn {}({}) {} {{", func.name, params.join(", "), ret),
            );

            for stmt in &func.body {
                self.gen_stmt(stmt, &mut lines, "  ");
            }

            self.add_ln(&mut lines, "}");
            self.add_ln(&mut lines, "");
        }

        // Main entry point
        self.add_ln(&mut lines, "pub fn main() void {");
        self.add_ln(&mut lines, "    setup();");
        self.add_ln(&mut lines, "    while (true) {");
        self.add_ln(&mut lines, "        loop();");
        self.add_ln(&mut lines, "    }");
        self.add_ln(&mut lines, "}");

        GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
            files: None,
        }
    }
}

fn default_zig_shims() -> Vec<ShimDefinition> {
    vec![
        ShimDefinition::new("servo", "// Servo support via machine abstraction")
            .with_description("Servo motor support"),
        ShimDefinition::new("wire", "// I2C via machine.I2C")
            .with_description("I2C communication support"),
        ShimDefinition::new("spi", "// SPI via machine.SPI")
            .with_description("SPI communication support"),
        ShimDefinition::new("sevseg", "// Seven-segment display support")
            .with_description("Seven-segment display library"),
    ]
}
