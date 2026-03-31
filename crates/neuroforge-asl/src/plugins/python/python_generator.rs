//! Generator Python — percorre AslProgram e emite código MicroPython/Python
//!
//! Mapeamento AslStatement → Python:
//!   AslFunction      → def name(params): body
//!   If               → if cond: / else:
//!   While            → while cond:
//!   ForIn            → for var in iterable:
//!   DoWhile          → while True: body + if not cond: break
//!   Return           → return [value]
//!   Break            → break
//!   Continue         → continue
//!   Assign           → target = value
//!   Declare          → name = value
//!   Delay            → utime.sleep_ms(ms)
//!   Print            → print(val)
//!   PinMode          → machine.Pin(pin, mode)
//!   UartWrite        → uart.write(val)
//!   I2cWrite         → i2c.writeto(addr, data)
//!   I2cRead          → i2c.readfrom(addr, n)
//!   SpiTransfer      → spi.write(data)
//!   Expr             → expr

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement};
use crate::plugins::core::{AslGenerator, GeneratorOutput};

pub struct PythonGenerator {
    indent_size: usize,
}

impl Default for PythonGenerator {
    fn default() -> Self {
        Self { indent_size: 4 }
    }
}

impl PythonGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for PythonGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
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
            let mut imports = vec!["Pin"];
            if stringified.contains("\"analogWrite\"") || stringified.contains("\"pwm") { imports.push("PWM"); }
            if stringified.contains("\"read\"") || stringified.contains("analogRead") || stringified.contains("digitalRead") { imports.push("ADC"); }
            if stringified.contains("\"uart") || stringified.contains("\"serial") { imports.push("UART"); }
            out.push_str(&format!("from machine import {}\n", imports.join(", ")));
        }
        if needs_time {
            out.push_str("from time import sleep_ms\n");
        }
        if needs_machine || needs_time {
            out.push('\n');
        }

        for global_var in &program.globals {
            out.push_str(&format!(
                "{} = {}\n",
                global_var.name,
                global_var
                    .initial_value
                    .as_ref()
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| "None".to_string())
            ));
        }
        if !program.globals.is_empty() {
            out.push('\n');
        }

        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0));
            out.push_str("\n\n");
        }

        // Setup logic (top-level initialization)
        if !program.setup_body.is_empty() {
            out.push_str("# --- Initialization ---\n");
            for stmt in &program.setup_body {
                out.push_str(&self.gen_stmt(stmt, 0));
                out.push('\n');
            }
            out.push('\n');
        }

        // Loop logic (main loop)
        if !program.loop_body.is_empty() {
            out.push_str("# --- Main Loop ---\n");
            out.push_str("while True:\n");
            for stmt in &program.loop_body {
                out.push_str(&self.gen_stmt(stmt, 1));
                out.push('\n');
            }
            out.push('\n');
        }

        // Tasks fallback (for other tasks if any)
        for task in &program.tasks {
            if task.name != "setup" && task.name != "loop" && !task.body.is_empty() {
                out.push_str(&format!("# --- Task: {} ---\n", task.name));
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 0));
                    out.push('\n');
                }
                out.push('\n');
            }
        }

        GeneratorOutput::new(out)
    }
}

impl PythonGenerator {

    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_function(&self, func: &AslFunction, level: usize) -> String {
        let ind = self.indent(level);
        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();
        let mut out = format!("{}def {}({}):\n", ind, func.name, params.join(", "));
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
                serde_json::Value::Bool(b) => if *b { "True".to_string() } else { "False".to_string() },
                _ => l.value.to_string(),
            },
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => format!(
                "({} {} {})",
                self.gen_expr(&b.left),
                b.op.to_symbol(),
                self.gen_expr(&b.right)
            ),
            AslExpr::Unary(u) => format!("{}{}", u.op.to_symbol(), self.gen_expr(&u.expr)),
            AslExpr::Call(c) => {
                // println!("DEBUG gen_expr Call: callee='{}'", c.callee);
                match c.callee.as_str() {
                    "digitalRead" | "machine.digitalRead" => {
                        let pin = c.args.first().map(|a| self.gen_expr(a)).unwrap_or_else(|| "0".into());
                        format!("Pin({}).value()", pin)
                    }
                    "analogRead" | "machine.analogRead" => {
                        let pin = c.args.first().map(|a| self.gen_expr(a)).unwrap_or_else(|| "0".into());
                        format!("ADC(Pin({})).read_u16()", pin)
                    }
                    "Serial.print" | "print" | "println" | "Serial.println" => {
                        let arg = c.args.first().map(|a| self.gen_expr(a)).unwrap_or_else(|| "".into());
                        let newline = c.callee.contains("println");
                        if newline { format!("print({})", arg) } else { format!("print({}, end='')", arg) }
                    }
                    _ => format!(
                        "{}({})",
                        c.callee,
                        c.args
                            .iter()
                            .map(|a| self.gen_expr(a))
                            .collect::<Vec<_>>()
                            .join(", ")
                    )
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
                out.push_str(&self.gen_block(&s.then_branch, level + 1));
                if let Some(eb) = &s.else_branch {
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
            AslStatement::For(s) => {
                let mut out = String::new();
                if let Some(init) = &s.init {
                    for stmt in init {
                        out.push_str(&self.gen_stmt(stmt, level));
                        out.push('\n');
                    }
                }
                out.push_str(&format!("{}while {}:\n", ind, self.gen_expr(&s.condition)));
                out.push_str(&self.gen_block(&s.body, level + 1));
                for stmt in &s.update {
                    out.push_str(&self.gen_stmt(stmt, level + 1));
                    out.push('\n');
                }
                out
            }
            AslStatement::ForIn(s) => {
                let mut out = format!(
                    "{}for {} in {}:\n",
                    ind,
                    s.var_name,
                    self.gen_expr(&s.iterable)
                );
                out.push_str(&self.gen_block(&s.body, level + 1));
                out
            }
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
                format!("{}sleep_ms({})", ind, self.gen_expr(&d.milliseconds))
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
                };
                let pin_expr = self.gen_expr(&p.pin);
                let var_name = if pin_expr.chars().all(|c| c.is_ascii_digit()) {
                    format!("pin_{}", pin_expr)
                } else {
                    pin_expr.clone()
                };
                format!("{}{} = Pin({}, {})", ind, var_name, pin_expr, mode)
            }
            AslStatement::DigitalWrite(d) => {
                let pin_expr = self.gen_expr(&d.pin);
                let var_name = if pin_expr.chars().all(|c| c.is_ascii_digit()) {
                    format!("pin_{}", pin_expr)
                } else {
                    pin_expr.clone()
                };
                match &d.value {
                    crate::types::asl_types::DigitalValue::High => format!("{}.on()", var_name),
                    crate::types::asl_types::DigitalValue::Low => format!("{}.off()", var_name),
                    crate::types::asl_types::DigitalValue::Expr(e) => {
                        format!("{}.value({})", var_name, self.gen_expr(e))
                    }
                }
            }
            AslStatement::AnalogWrite(a) => {
                let pin_expr = self.gen_expr(&a.pin);
                // Arduino 8-bit (0-255) -> MicroPython 16-bit (0-65535)
                format!("{}PWM(Pin({})).duty_u16(int(({}) * 65535 / 255))", ind, pin_expr, self.gen_expr(&a.value))
            }
            AslStatement::PwmSetDuty(p) => {
                format!("{}PWM(Pin({})).duty_u16(int(({}) * 65535 / 255))", ind, self.gen_expr(&p.pin), self.gen_expr(&p.duty))
            }
            AslStatement::Read(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                let var_name = if pin_expr.parse::<i64>().is_ok() {
                    format!("pin_{}", pin_expr)
                } else {
                    pin_expr.clone()
                };
                match r.mode {
                    crate::types::asl_types::ReadMode::Digital => {
                        format!("{}{} = {}.value()", ind, r.target, var_name)
                    }
                    crate::types::asl_types::ReadMode::Analog => {
                        format!("{}{} = ADC(Pin({})).read_u16()", ind, r.target, pin_expr)
                    }
                }
            }
            AslStatement::SerialBegin(s) => format!(
                "{}uart = UART(0, baudrate={})",
                ind,
                self.gen_expr(&s.baud)
            ),
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
            _ => format!("{}# (stmt não suportado)", ind),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
