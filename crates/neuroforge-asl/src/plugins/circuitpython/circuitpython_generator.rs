//! Code generator for CircuitPython (Adafruit)
//!
//! CircuitPython-specific output:
//! - Uses `board` module for pin access
//! - Uses `digitalio` for GPIO direction
//! - Uses `analogio` for ADC
//! - Uses `pulseio` for PWM
//! - Uses `time.monotonic()` for timing
//! - Uses `adafruit_*` libraries for sensors

use crate::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

pub struct CircuitPythonGenerator {
    indent_size: usize,
    program_json: Option<String>,
}

impl Default for CircuitPythonGenerator {
    fn default() -> Self {
        Self {
            indent_size: 4,
            program_json: None,
        }
    }
}

impl CircuitPythonGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for CircuitPythonGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        // Store program JSON for PinMode heuristic
        self.program_json = Some(serde_json::to_string(program).unwrap_or_default());

        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        // CircuitPython imports
        let needs_digitalio = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"digitalInput\"");

        let needs_analogio = stringified.contains("\"analogRead\"")
            || stringified.contains("\"analogInput\"")
            || stringified.contains("\"analogOutput\"");

        let needs_pulseio = stringified.contains("\"pwm\"")
            || stringified.contains("\"analogOutput\"")
            || stringified.contains("\"pwmInit\"")
            || stringified.contains("\"pwmSetDuty\"");

        let needs_time =
            stringified.contains("\"delay\"") || stringified.contains("\"delayMicroseconds\"");

        let needs_board = needs_digitalio || needs_analogio || needs_pulseio;

        // Import section
        if needs_board {
            out.push_str("import board\n");
        }

        if needs_digitalio {
            out.push_str("import digitalio\n");
        }

        if needs_analogio {
            out.push_str("import analogio\n");
        }

        if needs_pulseio {
            out.push_str("import pulseio\n");
        }

        if needs_time {
            out.push_str("import time\n");
        }

        if needs_board || needs_time {
            out.push_str("\n");
        }

        // Global constants
        if needs_digitalio {
            out.push_str("HIGH = True\nLOW = False\n");
            out.push('\n');
        }

        // Global variables
        for global_var in &program.globals {
            out.push_str(&format!(
                "{} = {}\n",
                global_var.name,
                global_var
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "None".to_string())
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

        // Functions
        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0, program));
            out.push_str("\n\n");
        }

        // Tasks
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if has_setup || has_loop {
            out.push_str("# --- ASL Execution Sequence ---\n");

            if let Some(setup) = program.tasks.iter().find(|t| t.name == "setup") {
                out.push_str("# Setup\n");

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
                out.push_str("while True:\n");

                for stmt in &loop_task.body {
                    out.push_str(&self.gen_stmt(stmt, 2));
                    out.push('\n');
                }
            }
        } else {
            // Standard task generation for other tasks
            for task in &program.tasks {
                out.push_str(&format!("def {}():\n", task.name));

                for global in &program.globals {
                    out.push_str(&format!(
                        "{}    global {}\n",
                        " ".repeat(self.indent_size),
                        global.name
                    ));
                }

                if task.body.is_empty() {
                    out.push_str("    pass\n");
                } else {
                    for stmt in &task.body {
                        out.push_str(&self.gen_stmt(stmt, 1));
                        out.push('\n');
                    }
                }

                out.push('\n');
            }
        }

        GeneratorOutput::new(out)
    }
}

impl CircuitPythonGenerator {
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

    fn gen_function(&self, func: &AslFunction, level: usize, program: &AslProgram) -> String {
        let ind = self.indent(level);

        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();

        let mut out = format!("{}def {}({}):\n", ind, func.name, params.join(", "));

        // Add global declarations
        for global in &program.globals {
            out.push_str(&format!("{}    global {}\n", ind, global.name));
        }

        if func.body.is_empty() {
            out.push_str(&format!("{}    pass\n", ind));
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_stmt(stmt, level + 1));
                out.push('\n');
            }
        }

        out
    }

    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => match &l.value {
                serde_json::Value::Bool(b) => {
                    if *b {
                        "True".to_string()
                    } else {
                        "False".to_string()
                    }
                }

                _ => l.value.to_string(),
            },

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                let op_sym = b.op.to_symbol();

                let op = if op_sym == "&&" || op_sym == "and" {
                    "and"
                } else if op_sym == "||" || op_sym == "or" {
                    "or"
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

                    format!(
                        "digitalio.DigitalInOut(board.GP{}).value",
                        pin.replace("GP", "")
                    )
                }

                "analogRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".into());

                    format!("analogio.AnalogIn(board.GP{}).value", pin.replace("GP", ""))
                }

                "Serial.print" | "print" | "println" | "Serial.println" => {
                    let arg = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "".into());

                    let newline = c.callee.contains("println");

                    if newline {
                        format!("print({})", arg)
                    } else {
                        format!("print({}, end='')", arg)
                    }
                }

                "delay" | "sleep_ms" => {
                    let ms = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "1000".into());

                    format!("time.sleep({} / 1000)", ms)
                }

                "delayMicroseconds" => {
                    let us = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "1000".into());

                    format!("time.sleep({} / 1_000_000)", us)
                }

                "millis" => "int(time.monotonic() * 1000)".to_string(),

                "micros" => "int(time.monotonic() * 1_000_000)".to_string(),

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

            _ => "None".to_string(),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}pass\n", self.indent(level));
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
                "{}{} = {}",
                ind,
                d.name,
                d.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "None".to_string())
            ),

            AslStatement::If(s) => {
                let mut out = format!("{}if {}:\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.then_body, level + 1));

                for eb_if in &s.else_if {
                    out.push_str(&format!(
                        "{}elif {}:\n",
                        ind,
                        self.gen_expr(&eb_if.condition)
                    ));
                    out.push_str(&self.gen_block(&eb_if.body, level + 1));
                }

                if let Some(eb) = &s.else_body {
                    out.push_str(&format!("{}else:\n", ind));
                    out.push_str(&self.gen_block(eb, level + 1));
                }

                out
            }

            AslStatement::While(s) => {
                let mut out = format!("{}while {}:\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out
            }

            AslStatement::DoWhile(s) => {
                let mut out = format!("{}while True:\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!(
                    "{}    if not ({}):\n{}        break\n",
                    ind,
                    self.gen_expr(&s.condition),
                    ind
                ));
                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::asl_types::AslFor::Range(r) => {
                    let mut out = format!(
                        "{}for {} in range({}, {}, {}):\n",
                        ind,
                        r.var,
                        self.gen_expr(&r.from),
                        self.gen_expr(&r.to),
                        self.gen_expr(&r.step)
                    );
                    out.push_str(&self.gen_block(&r.body, level + 1));
                    out
                }

                crate::asl_types::AslFor::Each(e) => {
                    let mut out =
                        format!("{}for {} in {}:\n", ind, e.var, self.gen_expr(&e.iterable));
                    out.push_str(&self.gen_block(&e.body, level + 1));
                    out
                }

                crate::asl_types::AslFor::CStyle(c) => {
                    let mut out = String::new();

                    for stmt in &c.init {
                        out.push_str(&self.gen_stmt(stmt, level));
                        out.push('\n');
                    }

                    out.push_str(&format!("{}while {}:\n", ind, self.gen_expr(&c.condition)));
                    out.push_str(&self.gen_block(&c.body, level + 1));

                    for stmt in &c.update {
                        out.push_str(&self.gen_stmt(stmt, level + 1));
                        out.push('\n');
                    }

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
                // CircuitPython uses time.sleep() for delays
                format!("{}time.sleep({} / 1000)", ind, d.duration.total_ms())
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}print({})", ind, args.join(", "))
            }

            AslStatement::PinMode(p) => {
                // CircuitPython uses digitalio.DigitalInOut with direction
                let direction = match p.mode {
                    crate::asl_types::PinModeKind::Output => "OUT",
                    crate::asl_types::PinModeKind::Input => "IN",
                    crate::asl_types::PinModeKind::InputPullup => "IN",
                    _ => "IN",
                };

                let pin_expr = self.gen_expr(&p.pin);
                let var_name = self.get_pin_var(&pin_expr);

                // Parse pin number from board.GP or raw number
                let pin_num = if pin_expr.starts_with("GP") || pin_expr.starts_with("board.GP") {
                    pin_expr.replace("board.GP", "").replace("GP", "")
                } else {
                    pin_expr.clone()
                };

                format!(
                    "{}{} = digitalio.DigitalInOut(board.GP{})\n{}{}.direction = digitalio.Direction.{}",
                    ind, var_name, pin_num, ind, var_name, direction
                )
            }

            AslStatement::DigitalOutput(d) => {
                let pin_expr = self.gen_expr(&d.pin);
                let var_name = self.get_pin_var(&pin_expr);
                let val_str = self.gen_expr(&d.value);

                if val_str == "True" || val_str == "HIGH" {
                    format!("{}{}.value = True", ind, var_name)
                } else if val_str == "False" || val_str == "LOW" {
                    format!("{}{}.value = False", ind, var_name)
                } else {
                    format!("{}{}.value = {}", ind, var_name, val_str)
                }
            }

            AslStatement::PwmInit(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);
                let var_name = self.get_pin_var(&pin_expr);

                // Parse pin number
                let pin_num = if pin_expr.starts_with("GP") || pin_expr.starts_with("board.GP") {
                    pin_expr.replace("board.GP", "").replace("GP", "")
                } else {
                    pin_expr.clone()
                };

                format!(
                    "{}{} = pulseio.PWMOut(board.GP{}, duty_cycle=0, frequency={})",
                    ind, var_name, pin_num, freq
                )
            }

            AslStatement::PwmSetDuty(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);
                let var_name = self.get_pin_var(&pin_expr);

                // Convert 0-255 to 0-65535 (duty_cycle is 0-65535)
                format!("{}{}.duty_cycle = int({} * 257)", ind, var_name, duty)
            }

            AslStatement::AnalogOutput(a) => {
                let pin_expr = self.gen_expr(&a.pin);
                let pwm_var = self.get_pin_var(&pin_expr);
                let value_expr = self.gen_expr(&a.value);

                // Arduino 8-bit (0-255) -> CircuitPython 16-bit (0-65535)
                format!("{}{}.duty_cycle = int({} * 257)", ind, pwm_var, value_expr)
            }

            AslStatement::DigitalInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                let var_name = self.get_pin_var(&pin_expr);

                // Parse pin number
                let pin_num = if pin_expr.starts_with("GP") || pin_expr.starts_with("board.GP") {
                    pin_expr.replace("board.GP", "").replace("GP", "")
                } else {
                    pin_expr.clone()
                };

                // Create DigitalInOut if not exists
                format!(
                    "{}{} = digitalio.DigitalInOut(board.GP{})\n{}{}.direction = digitalio.Direction.IN\n{}{} = {}.value",
                    ind, r.target, pin_num, ind, r.target, ind, r.target, var_name
                )
            }

            AslStatement::AnalogInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);

                // Parse pin number
                let pin_num = if pin_expr.starts_with("GP") || pin_expr.starts_with("board.GP") {
                    pin_expr.replace("board.GP", "").replace("GP", "")
                } else {
                    pin_expr.clone()
                };

                format!(
                    "{}{} = analogio.AnalogIn(board.GP{}).value",
                    ind, r.target, pin_num
                )
            }

            AslStatement::SerialBegin(_s) => {
                format!("{}# UART setup - use board.UART() on supported boards", ind)
            }

            AslStatement::UartWrite(u) => {
                format!("{}# UART write: {}", ind, self.gen_expr(&u.data))
            }

            AslStatement::UartRead(_) => format!("{}# UART read", ind),

            AslStatement::I2cWrite(i) => {
                format!(
                    "{}# I2C write to addr {}: {}",
                    ind,
                    self.gen_expr(&i.address),
                    self.gen_expr(&i.data)
                )
            }

            AslStatement::I2cRead(i) => format!(
                "{}# I2C read from addr {}, {} bytes",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{}# SPI transfer: {}", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Expr(e) => format!("{}{}", ind, self.gen_expr(&e.expr)),

            AslStatement::Comment(c) => format!("{}# {}", ind, c.text),

            _ => format!("{}# (stmt não suportado)", ind),
        }
    }
}

#[cfg(test)]

mod tests {
    use super::*;

    use crate::parser::neuro_parser::NeuroParser;
    use crate::plugins::python::python_parser::PythonParser;

    #[test]
    fn test_circuitpython_blink() {
        // Parse MicroPython code as a proxy for testing
        let src = r#"
import board
import digitalio

def setup():
    led = digitalio.DigitalInOut(board.GP0)
    led.direction = digitalio.Direction.OUT

def loop():
    led.value = True
    time.sleep(0.5)
    led.value = False
    time.sleep(0.5)
"#;
        let prog = PythonParser::parse(src).expect("parse failed");

        let mut generator = CircuitPythonGenerator::new();
        let output = generator.generate(&prog);

        assert!(output.code.contains("digitalio"), "deve conter digitalio");
        assert!(output.code.contains("board"), "deve conter board");
    }
}
