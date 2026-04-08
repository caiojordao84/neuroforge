//! Forth code generator.
//!
//! Generates Forth code for embedded systems (e.g., Mecrisp, amForth).
//!
//! Forth is a stack-based language where operations consume and produce
//! stack values. Each word is defined with colon syntax.
//!
//! ASL -> Forth mapping:
//!   AslFunction       : name ( params -- ) ... ;
//!   If               if ... then / if ... else ... then
//!   While            begin ... while ... repeat
//!   For              do ... loop
//!   Return           (no explicit return - value on stack)
//!   Break            unloop exit
//!   Assign           !
//!   Declare          variable name
//!   Delay            ms
//!   Print            .
//!   PinMode          pin-mode
//!   DigitalWrite    pin!
//!   DigitalRead      pin@
//!
//! Stack operations:
//!   DROP    - discard top stack item
//!   DUP     - duplicate top stack item
//!   SWAP    - swap top two stack items
//!   OVER    - copy second stack item to top
//!   ROT     - rotate third stack item to top
//!   DEPTH   - get current stack depth
//!
//! Memory operations:
//!   @       - fetch (read) from address
//!   !       - store (write) to address
//!   C@      - fetch byte
//!   C!      - store byte
//!   +!      - add to address contents
//!
//! Control structures:
//!   BEGIN...UNTIL   - loop until condition true
//!   BEGIN...WHILE...REPEAT - while loop
//!   DO...LOOP       - counted loop
//!   IF...THEN       - conditional
//!   IF...ELSE...THEN - if-else

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Forth code generator for embedded systems.
pub struct ForthGenerator {
    uses_gpio: bool,
    uses_uart: bool,
    uses_i2c: bool,
    uses_time: bool,
    variable_count: usize,
}

impl Default for ForthGenerator {
    fn default() -> Self {
        Self {
            uses_gpio: false,
            uses_uart: false,
            uses_i2c: false,
            uses_time: false,
            variable_count: 0,
        }
    }
}

impl ForthGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for ForthGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        // Detect required features
        self.uses_gpio = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"digitalRead\"")
            || stringified.contains("\"analogWrite\"")
            || stringified.contains("\"analogRead\"");

        self.uses_uart = stringified.contains("\"uart\"")
            || stringified.contains("\"serialBegin\"")
            || stringified.contains("\"uartWrite\"")
            || stringified.contains("\"uartRead\"");

        self.uses_i2c = stringified.contains("\"i2cWrite\"") || stringified.contains("\"i2cRead\"");

        self.uses_time = stringified.contains("\"delay\"")
            || stringified.contains("\"setInterval\"")
            || stringified.contains("\"setTimeout\"");

        // Forth header with comments
        out.push_str("\\ Forth code for embedded\n");
        out.push_str("\\ Target: Mecrisp, amForth, or similar\n\n");

        // Constant definitions for GPIO modes
        if self.uses_gpio {
            out.push_str("\\ GPIO Constants\n");
            out.push_str("1 constant OUTPUT\n");
            out.push_str("0 constant INPUT\n");
            out.push_str("1 constant HIGH\n");
            out.push_str("0 constant LOW\n\n");
        }

        // UART setup
        if self.uses_uart {
            out.push_str("\\ UART setup: uart-init ( baud -- )\n");
            out.push_str(": uart-init 9600 8N1 uart-config ;\n\n");
        }

        // I2C setup
        if self.uses_i2c {
            out.push_str("\\ I2C setup: i2c-init ( speed -- )\n");
            out.push_str(": i2c-init i2c-config ;\n\n");
        }

        // Global variables (Forth variables)
        out.push_str("\\ Global Variables\n");
        for global_var in &program.globals {
            let val = global_var
                .value
                .as_ref()
                .map(|v| self.gen_expr(v))
                .unwrap_or_else(|| "0".to_string());
            out.push_str(&format!(
                "variable {}  {} {} !\n",
                global_var.name, val, global_var.name
            ));
        }

        if !program.globals.is_empty() {
            out.push('\n');
        }

        // User-defined words (functions)
        for func in &program.functions {
            out.push_str(&self.gen_function(func));
            out.push('\n');
        }

        // Main initialization
        out.push_str("\\ --- Main Execution ---\n");
        out.push_str(": init\n");

        // Setup task
        for task in &program.tasks {
            if task.name == "setup" {
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }
            }
        }

        out.push_str(";\n\n");

        // Loop task (for embedded, typically infinite loop)
        for task in &program.tasks {
            if task.name == "loop" {
                out.push_str(": loop\n");
                out.push_str("  begin\n");
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 2));
                    out.push('\n');
                }
                out.push_str("  again\n");
                out.push_str(";\n\n");
            }
        }

        // Run initialization and loop if present
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if has_setup && has_loop {
            out.push_str("\\ Auto-start\n");
            out.push_str("init\n");
            out.push_str("begin loop again\n");
        } else if has_loop {
            out.push_str("\\ Auto-start loop\n");
            out.push_str("begin loop again\n");
        }

        GeneratorOutput::new(out)
    }
}

impl ForthGenerator {
    /// Generate a Forth word (function definition)
    fn gen_function(&self, func: &AslFunction) -> String {
        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();
        let param_decl = if params.is_empty() {
            "".to_string()
        } else {
            format!(" ( {} -- )", params.join(" "))
        };

        let mut out = format!(": {}{}\n", func.name, param_decl);

        if func.body.is_empty() {
            out.push_str("  \\ empty\n");
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_stmt(stmt, 1));
                out.push('\n');
            }
        }

        out.push_str(";");
        out
    }

    /// Generate an expression - for Forth, expressions often consume stack
    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => match &l.value {
                serde_json::Value::Bool(b) => {
                    if *b {
                        "TRUE".to_string()
                    } else {
                        "FALSE".to_string()
                    }
                }
                serde_json::Value::String(s) => format!("s\"{}\"", s),
                _ => l.value.to_string(),
            },

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                let op_sym = b.op.to_symbol();
                let left = self.gen_expr(&b.left);
                let right = self.gen_expr(&b.right);
                match op_sym {
                    "+" => format!("{} {} +", left, right),
                    "-" => format!("{} {} -", left, right),
                    "*" => format!("{} {} *", left, right),
                    "/" => format!("{} {} /", left, right),
                    "=" => format!("{} {} =", left, right),
                    "<>" => format!("{} {} <>", left, right),
                    "<" => format!("{} {} <", left, right),
                    ">" => format!("{} {} >", left, right),
                    "and" | "&&" => format!("{} {} and", left, right),
                    "or" | "||" => format!("{} {} or", left, right),
                    _ => format!("{} {} {}", left, op_sym, right),
                }
            }

            AslExpr::Unary(u) => {
                let inner = self.gen_expr(&u.expr);
                match u.op.to_symbol() {
                    "-" => format!("{} negate", inner),
                    "not" => format!("{} not", inner),
                    _ => format!("{} {}", u.op.to_symbol(), inner),
                }
            }

            AslExpr::Call(c) => match c.callee.as_str() {
                "digitalRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".to_string());
                    format!("{} pin@", pin)
                }
                "analogRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".to_string());
                    format!("{} adc@", pin)
                }
                "Serial.print" | "print" | "println" => {
                    let arg = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "\"\"".to_string());
                    format!("{} .", arg)
                }
                _ => format!(
                    "{}",
                    c.args
                        .iter()
                        .map(|a| self.gen_expr(a))
                        .collect::<Vec<_>>()
                        .join(" ")
                ),
            },

            AslExpr::Member(m) => format!("{} {}", self.gen_expr(&m.target), m.property),

            AslExpr::Array(_a) => "{ }".to_string(),

            _ => "0".to_string(),
        }
    }

    /// Generate a statement
    fn gen_stmt(&self, stmt: &AslStatement, level: usize) -> String {
        let ind = "  ".repeat(level);

        match stmt {
            AslStatement::Assign(a) => {
                // For assignment, we need to evaluate the value and store it
                let val = self.gen_expr(&a.value);
                format!("{} {} !", ind, val)
            }

            AslStatement::Declare(d) => {
                // Create a variable
                format!("{}variable {}", ind, d.name)
            }

            AslStatement::If(s) => {
                let mut out = format!("{}if ", ind);
                out.push_str(&self.gen_expr(&s.condition));
                out.push_str(" then\n");
                out.push_str(&self.gen_block(&s.then_body, level + 1));

                if !s.else_if.is_empty() || s.else_body.is_some() {
                    out.push_str(&format!("{}else\n", ind));
                    if let Some(eb) = &s.else_body {
                        out.push_str(&self.gen_block(eb, level + 1));
                    }
                    out.push_str(&format!("{}then", ind));
                } else {
                    out.push_str(&format!("{}then", ind));
                }
                out
            }

            AslStatement::While(s) => {
                let mut out = format!("{}begin\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}  {} until", ind, self.gen_expr(&s.condition)));
                out
            }

            AslStatement::DoWhile(s) => {
                // do-while in Forth: execute body, then check condition
                let mut out = format!("{}begin\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}  {} until", ind, self.gen_expr(&s.condition)));
                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::types::asl_types::AslFor::Range(r) => {
                    let from = self.gen_expr(&r.from);
                    let to = self.gen_expr(&r.to);
                    let mut out = format!("{}do\n", ind);
                    for stmt in &r.body {
                        out.push_str(&self.gen_stmt(stmt, level + 1));
                        out.push('\n');
                    }
                    out.push_str(&format!("{}  {} {} +loop", ind, to, from));
                    out
                }
                _ => format!("{}-- unsupported for", ind),
            },

            AslStatement::Return(r) => {
                // In Forth, return by leaving value on stack
                if let Some(v) = &r.value {
                    self.gen_expr(v)
                } else {
                    "".to_string()
                }
            }

            AslStatement::Break => format!("{}unloop exit", ind),

            AslStatement::Continue => format!("{}-- continue", ind),

            AslStatement::Delay(d) => {
                let ms = d.duration.total_ms();
                format!("{} {} ms", ind, ms)
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                // Emit multiple values
                args.iter()
                    .map(|a| format!("{} {}", ind, a))
                    .collect::<Vec<_>>()
                    .join("\n")
            }

            AslStatement::PinMode(p) => {
                let pin = self.gen_expr(&p.pin);
                let mode = match p.mode {
                    crate::types::asl_types::PinModeKind::Output => "OUTPUT",
                    crate::types::asl_types::PinModeKind::Input => "INPUT",
                    _ => "INPUT",
                };
                format!("{} {} {} pin-mode!", ind, pin, mode)
            }

            AslStatement::DigitalOutput(d) => {
                let pin = self.gen_expr(&d.pin);
                let val = self.gen_expr(&d.value);
                format!("{} {} {} pin!", ind, pin, val)
            }

            AslStatement::DigitalInput(r) => {
                let pin = self.gen_expr(&r.pin);
                format!("{} {} pin@ {}", ind, pin, r.target)
            }

            AslStatement::AnalogOutput(a) => {
                let pin = self.gen_expr(&a.pin);
                let val = self.gen_expr(&a.value);
                format!("{} {} {} pwm!", ind, pin, val)
            }

            AslStatement::AnalogInput(r) => {
                let pin = self.gen_expr(&r.pin);
                format!("{} {} adc@ {}", ind, pin, r.target)
            }

            AslStatement::SerialBegin(s) => {
                format!("{} {} uart-init", ind, self.gen_expr(&s.baud))
            }

            AslStatement::UartWrite(u) => {
                format!("{} {} uart-emit", ind, self.gen_expr(&u.data))
            }

            AslStatement::UartRead(_) => format!("{} uart-key", ind),

            AslStatement::I2cWrite(i) => format!(
                "{} {} {} i2c!",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.data)
            ),

            AslStatement::I2cRead(i) => format!(
                "{} {} {} i2c@",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{} {} spi!", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Comment(c) => format!("{} \\ {}", ind, c.text),

            AslStatement::Expr(e) => self.gen_expr(&e.expr),

            _ => format!("{} -- (unsupported: {:?})", ind, stmt),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}  \\ empty\n", "  ".repeat(level));
        }

        stmts
            .iter()
            .map(|s| {
                let line = self.gen_stmt(s, level);
                line
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_forth_generator_empty_program() {
        let prog = AslProgram::default();
        let out = ForthGenerator::new().generate(&prog);
        assert!(out.code.contains("Forth"));
    }
}
