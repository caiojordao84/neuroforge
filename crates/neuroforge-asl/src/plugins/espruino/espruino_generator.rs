//! Espruino JavaScript code generator.
//!
//! Generates JavaScript code that runs on Espruino devices (JS-based firmware for microcontrollers).
//!
//! Espruino-specific API:
//!   - Global `Digital` object for pin I/O
//!   - `Digital.write(pin, value)`, `Digital.read(pin)`
//!   - `Serial.setup(baud, data)`
//!   - `setInterval()`, `setTimeout()` for timing
//!   - `require('Flash')` for persistent storage
//!
//! ASL -> Espruino mapping:
//!   AslFunction       function name(params) { body }
//!   If                if (cond) { } else { }
//!   While             while (cond) { }
//!   ForIn             for (var in iterable) { }
//!   DoWhile           do { } while (cond)
//!   Return            return [value]
//!   Break             break
//!   Continue          continue
//!   Assign            target = value
//!   Declare           var name = value
//!   Delay             setTimeout(callback, ms)
//!   Print             console.log(val)
//!   PinMode           Digital.setPinMode(pin, mode)
//!   DigitalWrite      Digital.write(pin, value)
//!   DigitalRead       Digital.read(pin)
//!   UartWrite         Serial.write(val)
//!   I2cWrite          I2C.writeTo(addr, data)
//!   I2cRead           I2C.readFrom(addr, n)
//!   SpiTransfer       SPI.send(data)
//!   Expr              expr

use crate::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Espruino JavaScript code generator.
pub struct EspruinoGenerator {
    indent_size: usize,
    program_json: Option<String>,
}

impl Default for EspruinoGenerator {
    fn default() -> Self {
        Self {
            indent_size: 2,
            program_json: None,
        }
    }
}

impl EspruinoGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for EspruinoGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        // Store program JSON for PinMode heuristic
        self.program_json = Some(serde_json::to_string(program).unwrap_or_default());

        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        // Espruino uses built-in global objects, not imports
        // We add comments to document available APIs

        let needs_digital = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"digitalRead\"")
            || stringified.contains("\"digitalOutput\"")
            || stringified.contains("\"digitalInput\"");

        let needs_serial = stringified.contains("\"serialBegin\"")
            || stringified.contains("\"uartWrite\"")
            || stringified.contains("\"uartRead\"");

        let needs_timing = stringified.contains("\"delay\"")
            || stringified.contains("\"setInterval\"")
            || stringified.contains("\"setTimeout\"");

        let needs_storage = stringified.contains("\"flash\"");

        // Write header comments about Espruino APIs
        out.push_str("// Espruino JavaScript\n");
        out.push_str(
            "// Built-in globals: Digital, Serial, setInterval, setTimeout, require('Flash')\n",
        );

        if needs_digital || needs_serial || needs_timing || needs_storage {
            out.push('\n');
        }

        // Global constants for digital values
        if needs_digital {
            out.push_str("var HIGH = true;\n");
            out.push_str("var LOW = false;\n");
        }

        if needs_serial {
            out.push_str("// Use Serial.setup(baudrate) to initialize Serial\n");
        }

        if needs_storage {
            out.push_str("// Use require('Flash') for persistent storage\n");
        }

        out.push('\n');

        // Generate global variables
        for global_var in &program.globals {
            out.push_str(&format!(
                "var {} = {};\n",
                global_var.name,
                global_var
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "undefined".to_string())
            ));
        }

        if !program.globals.is_empty() {
            out.push('\n');
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

        // Generate functions
        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0, program));
            out.push_str("\n\n");
        }

        // Tasks R7 - Now supporting Flattening (setup + loop -> main sequence)

        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if has_setup || has_loop {
            out.push_str("// --- ASL Execution Sequence ---\n");

            if let Some(setup) = program.tasks.iter().find(|t| t.name == "setup") {
                out.push_str("// Setup\n");

                for stmt in &setup.body {
                    // Skip infinite while loops (loop {} in Rust) - they go to while True
                    if is_infinite_while_loop(stmt) {
                        continue;
                    }
                    out.push_str(&self.gen_stmt(stmt, 0));
                    out.push('\n');
                }

                out.push('\n');
            }

            if let Some(loop_task) = program.tasks.iter().find(|t| t.name == "loop") {
                out.push_str("while (true) {\n");

                for stmt in &loop_task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }

                out.push_str("}\n");
            }
        } else {
            // Standard task generation for other tasks
            for task in &program.tasks {
                out.push_str(&format!("function {}() {{\n", task.name));

                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }

                out.push_str("}\n\n");
            }
        }

        GeneratorOutput::new(out)
    }
}

impl EspruinoGenerator {
    fn get_pin_var(&self, pin_expr: &str) -> String {
        if pin_expr.chars().all(|c| c.is_ascii_digit()) {
            format!("pin_{}", pin_expr)
        } else {
            pin_expr.to_string()
        }
    }

    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_function(&self, func: &AslFunction, level: usize, _program: &AslProgram) -> String {
        let ind = self.indent(level);

        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();

        let mut out = format!("{}function {}({}) {{\n", ind, func.name, params.join(", "));

        if func.body.is_empty() {
            out.push_str(&format!("{}  ;\n", ind));
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_stmt(stmt, level + 1));
                out.push('\n');
            }
        }

        out.push_str(&format!("{}}}", ind));

        out
    }

    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => match &l.value {
                serde_json::Value::Bool(b) => {
                    if *b {
                        "true".to_string()
                    } else {
                        "false".to_string()
                    }
                }
                serde_json::Value::String(s) => format!("\"{}\"", s),
                _ => l.value.to_string(),
            },

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                let op_sym = b.op.to_symbol();

                let op = if op_sym == "&&" {
                    "&&"
                } else if op_sym == "||" {
                    "||"
                } else {
                    op_sym
                };

                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    op,
                    self.gen_expr(&b.right)
                )
            }

            AslExpr::Unary(u) => format!("{}{}", u.op.to_symbol(), self.gen_expr(&u.expr)),

            AslExpr::Call(c) => match c.callee.as_str() {
                "digitalRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".into());
                    format!("Digital.read({})", pin)
                }

                "analogRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".into());
                    format!("Analog.read({})", pin)
                }

                "Serial.print" | "print" | "println" | "Serial.println" => {
                    let arg = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "\"\"".into());

                    let newline = c.callee.contains("println");

                    if newline {
                        format!("console.log({})", arg)
                    } else {
                        format!("console.log({} + \" \")", arg)
                    }
                }

                _ => format!(
                    "{}({})",
                    c.callee,
                    c.args
                        .iter()
                        .map(|a| self.gen_expr(a))
                        .collect::<Vec<_>>()
                        .join(", ")
                ),
            },

            AslExpr::Member(m) => format!("{}.{}", self.gen_expr(&m.target), m.property),

            AslExpr::Index(i) => {
                format!("{}[{}]", self.gen_expr(&i.target), self.gen_expr(&i.index))
            }

            AslExpr::Array(a) => format!(
                "[{}]",
                a.elements
                    .iter()
                    .map(|e| self.gen_expr(e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ),

            _ => "undefined".to_string(),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}  ;\n", self.indent(level));
        }

        stmts
            .iter()
            .map(|s| {
                let mut line = self.gen_stmt(s, level);
                line.push('\n');
                line
            })
            .collect()
    }

    fn gen_stmt(&self, stmt: &AslStatement, level: usize) -> String {
        let ind = self.indent(level);

        match stmt {
            AslStatement::Assign(a) => format!("{}{} = {}", ind, a.target, self.gen_expr(&a.value)),

            AslStatement::Declare(d) => format!(
                "{}var {} = {}",
                ind,
                d.name,
                d.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "undefined".to_string())
            ),

            AslStatement::If(s) => {
                let mut out = format!("{}if ({}) {{\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.then_body, level + 1));

                for eb_if in &s.else_if {
                    out.push_str(&format!(
                        "{}}} else if ({}) {{\n",
                        ind,
                        self.gen_expr(&eb_if.condition)
                    ));
                    out.push_str(&self.gen_block(&eb_if.body, level + 1));
                }

                if let Some(eb) = &s.else_body {
                    out.push_str(&format!("{}}} else {{\n", ind));
                    out.push_str(&self.gen_block(eb, level + 1));
                }

                out.push_str(&format!("{}}}", ind));

                out
            }

            AslStatement::While(s) => {
                let mut out = format!("{}while ({}) {{\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}}}", ind));
                out
            }

            AslStatement::DoWhile(s) => {
                let mut out = format!("{}do {{\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!(
                    "{}}} while ({});",
                    ind,
                    self.gen_expr(&s.condition)
                ));
                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::asl_types::AslFor::Range(r) => {
                    let mut out = format!(
                        "{}for (var {} = {}; {} < {}; {} += {}) {{\n",
                        ind,
                        r.var,
                        self.gen_expr(&r.from),
                        r.var,
                        self.gen_expr(&r.to),
                        r.var,
                        self.gen_expr(&r.step)
                    );
                    out.push_str(&self.gen_block(&r.body, level + 1));
                    out.push_str(&format!("{}}}", ind));
                    out
                }

                crate::asl_types::AslFor::Each(e) => {
                    let mut out = format!(
                        "{}for (var {} in {}) {{\n",
                        ind,
                        e.var,
                        self.gen_expr(&e.iterable)
                    );
                    out.push_str(&self.gen_block(&e.body, level + 1));
                    out.push_str(&format!("{}}}", ind));
                    out
                }

                crate::asl_types::AslFor::CStyle(c) => {
                    let mut out = String::new();

                    for stmt in &c.init {
                        out.push_str(&self.gen_stmt(stmt, level));
                        out.push('\n');
                    }

                    out.push_str(&format!(
                        "{}while ({}) {{\n",
                        ind,
                        self.gen_expr(&c.condition)
                    ));
                    out.push_str(&self.gen_block(&c.body, level + 1));

                    for stmt in &c.update {
                        out.push_str(&self.gen_stmt(stmt, level + 1));
                        out.push('\n');
                    }

                    out.push_str(&format!("{}}}", ind));
                    out
                }
            },

            AslStatement::Return(r) => format!(
                "{}return {}",
                ind,
                r.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_default()
            ),

            AslStatement::Break => format!("{}break", ind),

            AslStatement::Continue => format!("{}continue", ind),

            AslStatement::Delay(d) => {
                // Espruino uses setTimeout for delays
                // However, for simple delays we can use a busy wait or setTimeout with callback
                // For simplicity in generated code, we use a function that blocks
                format!("{}E.delay({})", ind, d.duration.total_ms())
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}console.log({})", ind, args.join(", "))
            }

            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    crate::asl_types::PinModeKind::Output => "DigitalPin.OUTPUT",
                    crate::asl_types::PinModeKind::Input => "DigitalPin.INPUT",
                    crate::asl_types::PinModeKind::InputPullup => "DigitalPin.INPUT_PULLUP",
                    crate::asl_types::PinModeKind::InputPulldown => "DigitalPin.INPUT_PULLDOWN",
                    _ => "DigitalPin.INPUT",
                };

                let pin_expr = self.gen_expr(&p.pin);
                format!("{}Digital.setPinMode({}, {})", ind, pin_expr, mode)
            }

            AslStatement::DigitalOutput(d) => {
                let pin_expr = self.gen_expr(&d.pin);
                let val_str = self.gen_expr(&d.value);

                // Map 1/HIGH to true, 0/LOW to false for Espruino
                let espruino_val = if val_str == "HIGH" || val_str == "1" || val_str == "true" {
                    "true"
                } else if val_str == "LOW" || val_str == "0" || val_str == "false" {
                    "false"
                } else {
                    // For expressions, keep as-is
                    &val_str
                };

                format!("{}Digital.write({}, {})", ind, pin_expr, espruino_val)
            }

            // PWM output - Espruino uses analogWrite
            AslStatement::AnalogOutput(a) => {
                let pin_expr = self.gen_expr(&a.pin);
                let value_expr = self.gen_expr(&a.value);

                // Arduino 8-bit (0-255) -> Espruino uses 0-1 float
                format!("{}analogWrite({}, {}/255)", ind, pin_expr, value_expr)
            }

            AslStatement::DigitalInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                let var_name = self.get_pin_var(&pin_expr);

                format!("{}var {} = Digital.read({})", ind, var_name, pin_expr)
            }

            AslStatement::AnalogInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                format!("{}var {} = Analog.read({})", ind, r.target, pin_expr)
            }

            AslStatement::SerialBegin(s) => {
                format!("{}Serial.setup({});", ind, self.gen_expr(&s.baud))
            }

            AslStatement::UartWrite(u) => {
                format!("{}Serial.write({})", ind, self.gen_expr(&u.data))
            }

            AslStatement::UartRead(_) => format!("{}Serial.read()", ind),

            AslStatement::I2cWrite(i) => format!(
                "{}I2C.writeTo({}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.data)
            ),

            AslStatement::I2cRead(i) => format!(
                "{}I2C.readFrom({}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{}SPI.send({})", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Expr(e) => format!("{}{}", ind, self.gen_expr(&e.expr)),

            AslStatement::Comment(c) => format!("{}// {}", ind, c.text),

            // PWM init - Espruino uses analogWrite
            AslStatement::PwmInit(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);
                format!(
                    "{}analogWrite({}, 0, {{ frequency: {} }})",
                    ind, pin_expr, freq
                )
            }

            AslStatement::PwmSetDuty(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);
                format!("{}analogWrite({}, {}/255)", ind, pin_expr, duty)
            }

            // Storage - Espruino uses Flash module
            AslStatement::StorageWrite(s) => format!(
                "{}require('Flash').write({}, {})",
                ind,
                self.gen_expr(&s.address),
                self.gen_expr(&s.data)
            ),

            AslStatement::StorageRead(s) => format!(
                "{}var {} = require('Flash').read({}, {})",
                ind,
                s.target,
                self.gen_expr(&s.address),
                self.gen_expr(&s.length)
            ),

            // Serial logging - Espruino console.log
            AslStatement::Log(l) => format!("{}console.log({})", ind, self.gen_expr(&l.message)),

            _ => format!("{}// (unsupported statement: {:?})", ind, stmt),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_espruino_generator_empty_program() {
        let prog = AslProgram::default();
        let out = EspruinoGenerator::new().generate(&prog);
        // Just verify it generates something without panicking
        assert!(out.code.contains("Espruino"));
    }
}
