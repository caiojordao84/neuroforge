//! Arduino code generator - generates Arduino-compatible C++ code from AslProgram.
//!
//! This generator extends the C generator with Arduino-specific features:
//! - Uses void setup() and void loop() structure
//! - Maps GPIO to Arduino functions (pinMode, digitalWrite, digitalRead, analogWrite, analogRead, delay)
//! - Serial communication (Serial.begin, Serial.print, Serial.println)
//! - I2C (Wire library)
//! - SPI library
//! - Servo control

use crate::asl_types::*;

use crate::plugins::core::{AslGenerator, GeneratorOutput, SourceMapEntry};

use crate::plugins::core::{ShimDefinition, ShimLanguage, ShimManager};

/// Arduino-specific shim definitions
fn default_arduino_shims() -> Vec<ShimDefinition> {
    vec![
        ShimDefinition::new("servo", "#include <Servo.h>")
            .with_description("Arduino Servo library"),
        ShimDefinition::new("wire", "#include <Wire.h>").with_description("I2C/TWI library"),
        ShimDefinition::new("spi", "#include <SPI.h>").with_description("SPI library"),
        ShimDefinition::new("sevseg", "#include <SevSeg.h>")
            .with_description("Seven-segment display library"),
    ]
}

pub struct ArduinoGenerator {
    source_map: Vec<SourceMapEntry>,
    current_line: u32,
    shims: ShimManager,
    /// Whether to use Arduino framework specific features
    use_arduino_framework: bool,
}

impl Default for ArduinoGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl ArduinoGenerator {
    pub fn new() -> Self {
        let mut shims = ShimManager::new(ShimLanguage::C);
        shims.register_shims(default_arduino_shims());

        Self {
            source_map: vec![],
            current_line: 1,
            shims,
            use_arduino_framework: true,
        }
    }

    /// Create an ArduinoGenerator with custom configuration
    pub fn with_framework(use_framework: bool) -> Self {
        let mut shims = ShimManager::new(ShimLanguage::C);
        shims.register_shims(default_arduino_shims());

        Self {
            source_map: vec![],
            current_line: 1,
            shims,
            use_arduino_framework: use_framework,
        }
    }

    fn scan_for_shims(&mut self, program: &AslProgram) {
        let stringified = serde_json::to_string(program).unwrap_or_default();

        // Scan for required Arduino libraries
        if stringified.contains("sevseg") {
            self.shims.require_shim("sevseg");
        }

        if stringified.contains("servo")
            || stringified.contains("Servo")
            || stringified.contains("servo_attach")
            || stringified.contains("servo_write")
        {
            self.shims.require_shim("servo");
        }

        if stringified.contains("Wire")
            || stringified.contains("i2c")
            || stringified.contains("i2c_write")
            || stringified.contains("i2c_read")
        {
            self.shims.require_shim("wire");
        }

        if stringified.contains("SPI")
            || stringified.contains("spi_transfer")
            || stringified.contains("spi_begin")
        {
            self.shims.require_shim("spi");
        }
    }

    fn add_ln(&mut self, lines: &mut Vec<String>, text: &str) {
        lines.push(text.to_string());
        self.current_line += text.lines().count().max(1) as u32;
    }

    /// Generate type string for Arduino C++
    fn arduino_type(&self, asl_type: &AslType) -> &'static str {
        match asl_type {
            AslType::Int | AslType::Int32 | AslType::Sint8 | AslType::Int16 | AslType::Short => {
                "int"
            }

            AslType::Uint | AslType::Uint32 | AslType::Uint8 | AslType::Uint16 | AslType::Byte => {
                "unsigned int"
            }

            AslType::Int64 | AslType::Long => "long",

            AslType::Uint64 => "unsigned long",

            AslType::Float | AslType::Double => "float",

            AslType::Bool => "bool",

            AslType::String => "String",

            AslType::Void => "void",

            _ => "int",
        }
    }

    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                let s = l.value.to_string();
                if let Some(v) = l.value.as_f64() {
                    if v.fract() != 0.0 {
                        return format!("{}", v);
                    }
                }
                if let Some(s_val) = l.value.as_str() {
                    return format!("\"{}\"", s_val);
                }
                s
            }
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => format!(
                "({} {} {})",
                self.gen_expr(&b.left),
                b.op.to_symbol(),
                self.gen_expr(&b.right)
            ),
            AslExpr::Unary(u) => format!("({}{})", u.op.to_symbol(), self.gen_expr(&u.expr)),
            AslExpr::Call(c) => {
                let args: Vec<String> = c.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}({})", c.callee, args.join(", "))
            }
            AslExpr::Member(m) => format!("{}.{}", self.gen_expr(&m.target), m.property),
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
                let text = if let Some(stripped) = text.strip_prefix('#') {
                    format!("//{}", stripped)
                } else {
                    text.to_string()
                };
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
                let t_str = self.arduino_type(&d.r#type);
                self.add_ln(lines, &format!("{}{} {} = {};", indent, t_str, d.name, val));
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
                    PinModeKind::Output => "OUTPUT",
                    PinModeKind::Input => "INPUT",
                    PinModeKind::InputPullup => "INPUT_PULLUP",
                    PinModeKind::InputPulldown => "INPUT_PULLDOWN",
                    _ => "INPUT",
                };
                self.add_ln(lines, &format!("{}pinMode({}, {});", indent, pin, mode));
            }

            AslStatement::DigitalOutput(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = self.gen_expr(&d.value);
                self.add_ln(lines, &format!("{}digitalWrite({}, {});", indent, pin, val));
            }

            AslStatement::DigitalInput(r) => {
                let pin = self.gen_expr(&r.pin);
                self.add_ln(
                    lines,
                    &format!("{}{} = digitalRead({});", indent, r.target, pin),
                );
            }

            AslStatement::AnalogInput(r) => {
                let pin = self.gen_expr(&r.pin);
                self.add_ln(
                    lines,
                    &format!("{}{} = analogRead({});", indent, r.target, pin),
                );
            }

            AslStatement::AnalogOutput(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);
                self.add_ln(lines, &format!("{}analogWrite({}, {});", indent, pin, val));
            }

            AslStatement::Delay(d) => {
                let ms = d.duration.total_ms();
                self.add_ln(lines, &format!("{}delay({});", indent, ms));
            }

            AslStatement::SerialBegin(s) => {
                let b = self.gen_expr(&s.baud);
                self.add_ln(lines, &format!("{}Serial.begin({});", indent, b));
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                if args.is_empty() {
                    return;
                }
                if p.newline {
                    self.add_ln(lines, &format!("{}Serial.println({});", indent, args[0]));
                } else {
                    self.add_ln(lines, &format!("{}Serial.print({});", indent, args[0]));
                }
            }

            AslStatement::UartWrite(u) => {
                let data = self.gen_expr(&u.data);
                self.add_ln(lines, &format!("{}Serial.write({});", indent, data));
            }

            AslStatement::I2cWrite(i) => {
                let addr = self.gen_expr(&i.address);
                let data = self.gen_expr(&i.data);
                self.add_ln(
                    lines,
                    &format!("{}Wire.beginTransmission({});", indent, addr),
                );
                self.add_ln(lines, &format!("{}Wire.write({});", indent, data));
                self.add_ln(lines, &format!("{}Wire.endTransmission();", indent));
            }

            AslStatement::I2cRead(i) => {
                let addr = self.gen_expr(&i.address);
                let len = self.gen_expr(&i.length);
                self.add_ln(
                    lines,
                    &format!("{}Wire.requestFrom({}, {});", indent, addr, len),
                );
                self.add_ln(lines, &format!("{}{} = Wire.read();", indent, i.target));
            }

            AslStatement::SpiTransfer(s) => {
                let tx_data = self.gen_expr(&s.tx_data);
                self.add_ln(lines, &format!("{}SPI.transfer({});", indent, tx_data));
            }

            AslStatement::ServoAttach(s) => {
                let pin = self.gen_expr(&s.pin);
                self.add_ln(lines, &format!("{}{}.attach({});", indent, s.var_name, pin));
            }

            AslStatement::ServoWrite(s) => {
                let angle_str = self.gen_expr(&s.angle);
                self.add_ln(
                    lines,
                    &format!("{}{}.write({});", indent, s.var_name, angle_str),
                );
            }

            AslStatement::ServoDetach(s) => {
                self.add_ln(lines, &format!("{}{}.detach();", indent, s.var_name));
            }

            AslStatement::PwmInit(p) => {
                let pin = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);
                self.add_ln(
                    lines,
                    &format!("{}// PWM init: pin={}, freq={}", indent, pin, freq),
                );
                self.add_ln(lines, &format!("{}pinMode({}, OUTPUT);", indent, pin));
            }

            AslStatement::PwmSetDuty(p) => {
                let pin = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);
                self.add_ln(lines, &format!("{}analogWrite({}, {});", indent, pin, duty));
            }

            // Note: Tone and NoTone statements are handled via function calls
            // in the expression statement handler
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

            AslStatement::For(f) => match f.as_ref() {
                AslFor::Range(r) => {
                    let from = self.gen_expr(&r.from);
                    let to = self.gen_expr(&r.to);
                    let step = self.gen_expr(&r.step);
                    self.add_ln(
                        lines,
                        &format!(
                            "{}for (int {} = {}; {} < {}; {} += {}) {{",
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
                        &format!("{}for (auto {} : {}) {{", indent, e.var, iter),
                    );
                    for b in &e.body {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }
                    self.add_ln(lines, &format!("{}}}", indent));
                }
                AslFor::CStyle(c) => {
                    self.add_ln(lines, &format!("{}for (", indent));
                    if let Some(first) = c.init.first() {
                        let mut temp = vec![];
                        self.gen_stmt(first, &mut temp, "");
                        let init_str = temp.join(" ").trim_end_matches(';').to_string();
                        if let Some(last) = lines.last_mut() {
                            *last += &init_str;
                        }
                    }
                    if let Some(last) = lines.last_mut() {
                        *last += &format!("; {}; ", self.gen_expr(&c.condition));
                    }
                    if let Some(first) = c.update.first() {
                        let mut temp = vec![];
                        self.gen_stmt(first, &mut temp, "");
                        let _up_str = temp.join(" ").trim_end_matches(';').to_string();
                        if let Some(last) = lines.last_mut() {
                            *last += ") {";
                        }
                    } else if let Some(last) = lines.last_mut() {
                        *last += ") {";
                    }
                    for b in &c.body {
                        self.gen_stmt(b, lines, &format!("{}  ", indent));
                    }
                    self.add_ln(lines, &format!("{}}}", indent));
                }
            },

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

            _ => {
                self.add_ln(
                    lines,
                    &format!("{}// Unhandled ASL Statement: {:?}", indent, stmt),
                );
            }
        }
    }
}

impl AslGenerator for ArduinoGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        self.source_map.clear();
        self.current_line = 1;
        self.shims.reset_runtime();

        let mut lines: Vec<String> = Vec::with_capacity(256);

        self.scan_for_shims(program);

        // Arduino-specific header
        self.add_ln(&mut lines, "// Generated Arduino Code");
        self.add_ln(&mut lines, "#include <Arduino.h>");

        // Add required shim includes
        let shim_code = self.shims.get_required_shims_code();
        if !shim_code.is_empty() {
            for line in shim_code.lines() {
                self.add_ln(&mut lines, line);
            }
        }

        self.add_ln(&mut lines, "");

        // Check for setup/loop task structure
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        // Generate global variables (only if not using setup/loop pattern)
        if !(has_setup && has_loop) {
            for global in &program.globals {
                let val = global
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string());
                let t_str = self.arduino_type(&global.r#type);
                let var_name = if global.name.is_empty() {
                    "_UNNAMED".to_string()
                } else {
                    global.name.clone()
                };
                self.add_ln(&mut lines, &format!("{} {} = {};", t_str, var_name, val));
            }
            if !program.globals.is_empty() {
                self.add_ln(&mut lines, "");
            }
        }

        // Helper to detect infinite while loops
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

        // Generate tasks (Arduino setup/loop)
        for task in &program.tasks {
            if task.name == "setup" {
                self.add_ln(&mut lines, "void setup() {");
                for stmt in &task.body {
                    if is_infinite_while_loop(stmt) {
                        continue;
                    }
                    self.gen_stmt(stmt, &mut lines, "  ");
                }
                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            } else if task.name == "loop" {
                self.add_ln(&mut lines, "void loop() {");
                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }
                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            } else {
                // Other tasks as void functions
                self.add_ln(&mut lines, &format!("void {}(", task.name));
                self.add_ln(&mut lines, ") {");
                for stmt in &task.body {
                    self.gen_stmt(stmt, &mut lines, "  ");
                }
                self.add_ln(&mut lines, "}");
                self.add_ln(&mut lines, "");
            }
        }

        // Generate functions
        for func in &program.functions {
            let params: Vec<String> = func
                .params
                .iter()
                .map(|p| format!("{} {}", p.r#type, p.name))
                .collect();
            let ret = func
                .return_type
                .as_ref()
                .map(|t| self.arduino_type(t))
                .unwrap_or("void");
            self.add_ln(
                &mut lines,
                &format!("{} {}({}) {{", ret, func.name, params.join(", ")),
            );
            for stmt in &func.body {
                self.gen_stmt(stmt, &mut lines, "  ");
            }
            self.add_ln(&mut lines, "}");
            self.add_ln(&mut lines, "");
        }

        GeneratorOutput {
            code: lines.join("\n"),
            map: self.source_map.clone(),
            files: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_simple_blink() {
        let program = AslProgram {
            tasks: vec![
                AslTask {
                    name: "setup".to_string(),
                    body: vec![AslStatement::PinMode(AslPinMode {
                        pin: AslExpr::Literal(AslLiteral {
                            value: serde_json::json!(13),
                        }),
                        mode: PinModeKind::Output,
                    })],
                    ..Default::default()
                },
                AslTask {
                    name: "loop".to_string(),
                    body: vec![
                        AslStatement::DigitalOutput(AslDigitalOutput {
                            pin: AslExpr::Literal(AslLiteral {
                                value: serde_json::json!(13),
                            }),
                            value: AslExpr::Literal(AslLiteral {
                                value: serde_json::json!(1),
                            }),
                        }),
                        AslStatement::Delay(AslDelay {
                            duration: AslDuration::from_ms(1000),
                        }),
                        AslStatement::DigitalOutput(AslDigitalOutput {
                            pin: AslExpr::Literal(AslLiteral {
                                value: serde_json::json!(13),
                            }),
                            value: AslExpr::Literal(AslLiteral {
                                value: serde_json::json!(0),
                            }),
                        }),
                        AslStatement::Delay(AslDelay {
                            duration: AslDuration::from_ms(1000),
                        }),
                    ],
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        let mut generator = ArduinoGenerator::new();
        let output = generator.generate(&program);

        assert!(output.code.contains("void setup()"));
        assert!(output.code.contains("void loop()"));
        assert!(output.code.contains("pinMode"));
        assert!(output.code.contains("digitalWrite"));
        assert!(output.code.contains("delay"));
    }

    #[test]
    fn test_generate_with_serial() {
        let program = AslProgram {
            tasks: vec![AslTask {
                name: "setup".to_string(),
                body: vec![
                    AslStatement::SerialBegin(AslSerialBegin {
                        baud: AslExpr::Literal(AslLiteral {
                            value: serde_json::json!(9600),
                        }),
                        port: 0,
                    }),
                    AslStatement::Print(AslPrint {
                        args: vec![AslExpr::Literal(AslLiteral {
                            value: serde_json::json!("Hello"),
                        })],
                        newline: true,
                    }),
                ],
                ..Default::default()
            }],
            ..Default::default()
        };

        let mut generator = ArduinoGenerator::new();
        let output = generator.generate(&program);

        assert!(output.code.contains("Serial.begin"));
        assert!(output.code.contains("Serial.println"));
    }

    #[test]
    fn test_generate_with_servo() {
        let program = AslProgram {
            globals: vec![AslGlobalVar {
                name: "myServo".to_string(),
                r#type: AslType::Int,
                value: Some(AslExpr::Literal(AslLiteral {
                    value: serde_json::json!(0),
                })),
                mutable: true,
                scope: "global".to_string(),
                lifecycle: "normal".to_string(),
                struct_type: None,
                comments: None,
            }],
            tasks: vec![
                AslTask {
                    name: "setup".to_string(),
                    body: vec![AslStatement::ServoAttach(AslServoAttach {
                        var_name: "myServo".to_string(),
                        pin: AslExpr::Literal(AslLiteral {
                            value: serde_json::json!(9),
                        }),
                        min_pulse: None,
                        max_pulse: None,
                    })],
                    ..Default::default()
                },
                AslTask {
                    name: "loop".to_string(),
                    body: vec![AslStatement::ServoWrite(AslServoWrite {
                        var_name: "myServo".to_string(),
                        angle: AslExpr::Literal(AslLiteral {
                            value: serde_json::json!(90),
                        }),
                    })],
                    ..Default::default()
                },
            ],
            ..Default::default()
        };

        let mut generator = ArduinoGenerator::new();
        let output = generator.generate(&program);

        assert!(output.code.contains("#include <Servo.h>"));
        assert!(output.code.contains("myServo.attach"));
        assert!(output.code.contains("myServo.write"));
    }
}
