//! Generator Python     percorre AslProgram e emite c  digo MicroPython/Python

//!

//! Mapeamento AslStatement     Python:

//!   AslFunction          def name(params): body

//!   If                   if cond: / else:

//!   While                while cond:

//!   ForIn                for var in iterable:

//!   DoWhile              while True: body + if not cond: break

//!   Return               return [value]

//!   Break                break

//!   Continue             continue

//!   Assign               target = value

//!   Declare              name = value

//!   Delay                utime.sleep_ms(ms)

//!   Print                print(val)

//!   PinMode              machine.Pin(pin, mode)

//!   UartWrite            uart.write(val)

//!   I2cWrite             i2c.writeto(addr, data)

//!   I2cRead              i2c.readfrom(addr, n)

//!   SpiTransfer          spi.write(data)

//!   Expr                 expr

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement, BinaryOp};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

pub struct PythonGenerator {
    indent_size: usize,
    program_json: Option<String>,
}

impl Default for PythonGenerator {
    fn default() -> Self {
        Self {
            indent_size: 4,
            program_json: None,
        }
    }
}

impl PythonGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for PythonGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        // Store program JSON for PinMode heuristic
        self.program_json = Some(serde_json::to_string(program).unwrap_or_default());

        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        let needs_machine = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"analogWrite\"")
            || stringified.contains("\"read\"")
            || stringified.contains("\"uart")
            || stringified.contains("\"i2c")
            || stringified.contains("\"spi")
            || stringified.contains("\"pwm");

        let needs_time = stringified.contains("\"delay\"");

        if needs_machine {
            out.push_str("from machine import Pin, PWM, ADC\n");
        }

        if needs_time {
            out.push_str("from time import sleep_ms\n");
        }

        if needs_machine || needs_time {
            if needs_machine {
                out.push_str("HIGH = 1\nLOW = 0\n");
            }

            out.push('\n');
        }

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

        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0, program));

            out.push_str("\n\n");
        }

        // Tasks R7 - Now supporting Flattening (setup + loop -> main sequence)

        let has_setup = program.tasks.iter().any(|t| t.name == "setup");

        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if has_setup || has_loop {
            out.push_str("# --- ASL Execution Sequence ---\n");

            if let Some(setup) = program.tasks.iter().find(|t| t.name == "setup") {
                out.push_str("# Setup\n");

                for stmt in &setup.body {
                    out.push_str(&self.gen_stmt(stmt, 0));

                    out.push('\n');
                }

                out.push('\n');
            }

            if let Some(loop_task) = program.tasks.iter().find(|t| t.name == "loop") {
                out.push_str("while True:\n");

                for stmt in &loop_task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));

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

impl PythonGenerator {
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
                        "HIGH".to_string()
                    } else {
                        "LOW".to_string()
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

            AslExpr::Call(c) => {
                // println!("DEBUG gen_expr Call: callee='{}'", c.callee);

                match c.callee.as_str() {
                    "digitalRead" | "machine.digitalRead" => {
                        let pin = c
                            .args
                            .first()
                            .map(|a| self.gen_expr(a))
                            .unwrap_or_else(|| "0".into());

                        format!("Pin({}).value()", pin)
                    }

                    "analogRead" | "machine.analogRead" => {
                        let pin = c
                            .args
                            .first()
                            .map(|a| self.gen_expr(a))
                            .unwrap_or_else(|| "0".into());

                        format!("ADC(Pin({})).read_u16()", pin)
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

                    _ => format!(
                        "{}({})",
                        c.callee,
                        c.args
                            .iter()
                            .map(|a| self.gen_expr(a))
                            .collect::<Vec<_>>()
                            .join(", ")
                    ),
                }
            }

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
                crate::types::asl_types::AslFor::Range(r) => {
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

                crate::types::asl_types::AslFor::Each(e) => {
                    let mut out =
                        format!("{}for {} in {}:\n", ind, e.var, self.gen_expr(&e.iterable));

                    out.push_str(&self.gen_block(&e.body, level + 1));

                    out
                }

                crate::types::asl_types::AslFor::CStyle(c) => {
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
                format!("{}sleep_ms({})", ind, d.duration.total_ms())
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();

                format!("{}print({})", ind, args.join(", "))
            }

            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    crate::types::asl_types::PinModeKind::Output => "Pin.OUT",

                    crate::types::asl_types::PinModeKind::Input => "Pin.IN",

                    crate::types::asl_types::PinModeKind::InputPullup => "Pin.IN, Pin.PULL_UP",

                    _ => "Pin.IN",
                };

                let pin_expr = self.gen_expr(&p.pin);

                let var_name = self.get_pin_var(&pin_expr);

                // Heur  stica: Se o programa usa analogWrite neste pino, inicializa como PWM agora

                let is_pwm = self
                    .program_json
                    .as_ref()
                    .map(|s| {
                        s.contains(&format!(
                            "\"pin\":{{\"kind\":\"var\",\"name\":\"{}\"}}",
                            var_name
                        )) && s.contains("\"analogOutput\"")
                    })
                    .unwrap_or(false);

                if is_pwm {
                    format!("{}{} = PWM(Pin({}), freq=1000)", ind, var_name, pin_expr)
                } else {
                    format!("{}{} = Pin({}, {})", ind, var_name, pin_expr, mode)
                }
            }

            AslStatement::DigitalOutput(d) => {
                let pin_expr = self.gen_expr(&d.pin);

                let var_name = if pin_expr.chars().all(|c| c.is_ascii_digit()) {
                    format!("pin_{}", pin_expr)
                } else {
                    pin_expr.clone()
                };

                let val_str = self.gen_expr(&d.value);

                if val_str == "HIGH" {
                    format!("{}.on()", var_name)
                } else if val_str == "LOW" {
                    format!("{}.off()", var_name)
                } else {
                    format!("{}.value({})", var_name, val_str)
                }
            }

            AslStatement::AnalogOutput(a) => {
                let pin_expr = self.gen_expr(&a.pin);

                let pwm_var = self.get_pin_var(&pin_expr);

                // Arduino 8-bit (0-255) -> MicroPython 16-bit (0-65535)

                // 255 * 257 = 65535

                format!("{}.duty_u16(int(({}) * 257))", ind, pwm_var)
            }

            AslStatement::DigitalInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);

                let var_name = if pin_expr.parse::<i64>().is_ok() {
                    format!("pin_{}", pin_expr)
                } else {
                    pin_expr.clone()
                };

                format!("{}{} = {}.value()", ind, r.target, var_name)
            }

            AslStatement::AnalogInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);

                format!("{}{} = ADC(Pin({})).read_u16()", ind, r.target, pin_expr)
            }

            AslStatement::SerialBegin(s) => {
                format!("{}uart = UART(0, baudrate={})", ind, self.gen_expr(&s.baud))
            }

            AslStatement::UartWrite(u) => format!("{}uart.write({})", ind, self.gen_expr(&u.data)),

            AslStatement::UartRead(_) => format!("{}uart.read()", ind),

            AslStatement::I2cWrite(i) => format!(
                "{}i2c.writeto({}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.data)
            ),

            AslStatement::I2cRead(i) => format!(
                "{}i2c.readfrom({}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{}spi.write({})", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Expr(e) => format!("{}{}", ind, self.gen_expr(&e.expr)),

            AslStatement::Comment(c) => format!("{}# {}", ind, c.text),

            _ => format!("{}# (stmt n  o suportado)", ind),
        }
    }
}

#[cfg(test)]

mod tests {

    use super::*;

    use crate::parser::neuro_parser::NeuroParser;

    use crate::plugins::python::python_parser::PythonParser;

    #[test]

    fn roundtrip_blink() {
        let src = r#"

from machine import Pin

from time import sleep_ms



def main():

    while True:

        sleep_ms(500)

"#;

        let prog = PythonParser::parse(src).expect("parse falhou");

        let out = PythonGenerator::new().generate(&prog);

        assert!(
            out.code.contains("sleep_ms"),
            "deve conter sleep_ms: {}",
            out.code
        );
    }
}
