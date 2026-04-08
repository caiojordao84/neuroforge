//! Ada/SPARK code generator.
//!
//! Generates Ada/SPARK code for embedded systems using the Ravenscar profile.
//!
//! Ravenscar Profile (no dynamic allocation):
//!   - No access types (pointers)
//!   - No tasking (single task)
//!   - No dynamic allocation
//!   - Fixed priority scheduling
//!
//! ASL -> Ada mapping:
//!   AslFunction       procedure name(params) is begin ... end name;
//!   If               if cond then ... end if;
//!   While            while cond loop ... end loop;
//!   For              for i in range loop ... end loop;
//!   Return           return [value];
//!   Break            exit;
//!   Continue         -- not directly supported
//!   Assign           target := value;
//!   Declare          name : type := value;
//!   Delay            Ada.Real_Time.Operations.sleep
//!   Print            Ada.Text_IO.Put_Line
//!   PinMode          HAL.GPIO (handled at setup)
//!   DigitalWrite     GPIO port write
//!   DigitalRead      GPIO port read

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement, PinModeKind};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Ada/SPARK code generator with Ravenscar profile.
pub struct AdaGenerator {
    indent_size: usize,
    uses_gpio: bool,
    uses_uart: bool,
    uses_i2c: bool,
    uses_spi: bool,
    uses_pwm: bool,
}

impl Default for AdaGenerator {
    fn default() -> Self {
        Self {
            indent_size: 3,
            uses_gpio: false,
            uses_uart: false,
            uses_i2c: false,
            uses_spi: false,
            uses_pwm: false,
        }
    }
}

impl AdaGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for AdaGenerator {
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

        self.uses_spi = stringified.contains("\"spi\"");

        self.uses_pwm = stringified.contains("\"analogWrite\"")
            || stringified.contains("\"pwmInit\"")
            || stringified.contains("\"pwmSet\"");

        // Ada header
        out.push_str("-- Ada/SPARK for embedded (Ravenscar profile)\n");
        out.push_str("-- Compile with: gprbuild -P ravenscar.gpr\n\n");

        // Pragma declarations
        out.push_str("pragma Profile (Ravenscar_Full);\n");
        out.push_str("pragma Partition_Elaboration_Policy (Sequential);\n\n");

        // Use clauses
        out.push_str("with Ada.Real_Time;          use Ada.Real_Time;\n");
        out.push_str("with Ada.Text_IO;            use Ada.Text_IO;\n");

        if self.uses_gpio {
            out.push_str("with HAL.GPIO;             use HAL.GPIO;\n");
        }

        if self.uses_uart {
            out.push_str("with HAL.UART;             use HAL.UART;\n");
        }

        if self.uses_i2c {
            out.push_str("with HAL.I2C;              use HAL.I2C;\n");
        }

        if self.uses_spi {
            out.push_str("with HAL.SPI;              use HAL.SPI;\n");
        }

        out.push_str("with System;\n\n");

        // Global variables
        for global_var in &program.globals {
            let val = global_var
                .value
                .as_ref()
                .map(|v| self.gen_expr(v))
                .unwrap_or_else(|| "0".to_string());
            out.push_str(&format!(
                "{} : constant Integer := {};\n",
                global_var.name, val
            ));
        }

        if !program.globals.is_empty() {
            out.push('\n');
        }

        // Generate functions
        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0, program));
            out.push_str("\n\n");
        }

        // Main procedure
        if !program.tasks.is_empty() {
            out.push_str("procedure Main is\n");
            out.push_str("begin\n");

            for task in &program.tasks {
                if task.name == "setup" {
                    for stmt in &task.body {
                        out.push_str(&self.gen_stmt(stmt, 1));
                        out.push('\n');
                    }
                    out.push_str("\n");
                }
            }

            // Generate loop as main task
            for task in &program.tasks {
                if task.name == "loop" {
                    out.push_str("   -- Main loop (infinite)\n");
                    out.push_str("   loop\n");
                    for stmt in &task.body {
                        out.push_str(&self.gen_stmt(stmt, 2));
                        out.push('\n');
                    }
                    out.push_str("   end loop;\n");
                }
            }

            out.push_str("end Main;\n");
        }

        GeneratorOutput::new(out)
    }
}

impl AdaGenerator {
    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_function(&self, func: &AslFunction, level: usize, _program: &AslProgram) -> String {
        let ind = self.indent(level);

        // Generate parameter declarations
        let params: Vec<String> = func
            .params
            .iter()
            .map(|p| format!("{} : in out Integer", p.name))
            .collect();

        let mut out = if params.is_empty() {
            format!("{}procedure {} is\n", ind, func.name)
        } else {
            format!("{}procedure {}({}) is\n", ind, func.name, params.join("; "))
        };

        // Local variables
        if !func.body.is_empty() {
            out.push_str(&format!("{}begin\n", ind));
            for stmt in &func.body {
                out.push_str(&self.gen_stmt(stmt, level + 1));
                out.push('\n');
            }
            out.push_str(&format!("{}end {};", ind, func.name));
        } else {
            out.push_str(&format!(
                "{}begin\n{}   null;\n{}end {};",
                ind, ind, ind, func.name
            ));
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
                serde_json::Value::String(s) => format!("\"{}\"", s),
                _ => l.value.to_string(),
            },

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Binary(b) => {
                let op_sym = b.op.to_symbol();
                let ada_op = match op_sym {
                    "&&" => " and ",
                    "||" => " or ",
                    "==" => "=",
                    "!=" => "/=",
                    _ => op_sym,
                };
                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    ada_op,
                    self.gen_expr(&b.right)
                )
            }

            AslExpr::Unary(u) => format!("{} {}", u.op.to_symbol(), self.gen_expr(&u.expr)),

            AslExpr::Call(c) => match c.callee.as_str() {
                "digitalRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".to_string());
                    format!("Digital_Read({})", pin)
                }
                "Serial.print" | "print" | "println" => {
                    let arg = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "\"\"".to_string());
                    format!("Put_Line({})", arg)
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
                format!("{}({})", self.gen_expr(&i.target), self.gen_expr(&i.index))
            }

            AslExpr::Array(a) => format!(
                "({}",
                a.elements
                    .iter()
                    .map(|e| self.gen_expr(e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ),

            _ => "0".to_string(),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}   null;\n", self.indent(level));
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
            AslStatement::Assign(a) => format!("{} := {};", a.target, self.gen_expr(&a.value)),

            AslStatement::Declare(d) => format!(
                "{} : Integer := {};",
                d.name,
                d.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "0".to_string())
            ),

            AslStatement::If(s) => {
                let mut out = format!("{}if {} then\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.then_body, level + 1));

                for eb_if in &s.else_if {
                    out.push_str(&format!(
                        "{}elsif {} then\n",
                        ind,
                        self.gen_expr(&eb_if.condition)
                    ));
                    out.push_str(&self.gen_block(&eb_if.body, level + 1));
                }

                if let Some(eb) = &s.else_body {
                    out.push_str(&format!("{}else\n", ind));
                    out.push_str(&self.gen_block(eb, level + 1));
                }

                out.push_str(&format!("{}end if;", ind));
                out
            }

            AslStatement::While(s) => {
                let mut out = format!("{}while {} loop\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}end loop;", ind));
                out
            }

            AslStatement::DoWhile(s) => {
                let mut out = format!("{}loop\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!(
                    "{}exit when {};\n",
                    ind,
                    self.gen_expr(&s.condition)
                ));
                out.push_str(&format!("{}end loop;", ind));
                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::types::asl_types::AslFor::Range(r) => {
                    let step = self.gen_expr(&r.step);
                    let mut out = format!(
                        "{}for {} in {} .. {} loop\n",
                        ind,
                        r.var,
                        self.gen_expr(&r.from),
                        self.gen_expr(&r.to)
                    );
                    out.push_str(&self.gen_block(&r.body, level + 1));
                    out.push_str(&format!("{}end loop;", ind));
                    out
                }
                _ => format!("{}-- unsupported for loop", ind),
            },

            AslStatement::Return(r) => format!(
                "{}return {};",
                ind,
                r.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_default()
            ),

            AslStatement::Break => format!("{}exit;", ind),

            AslStatement::Continue => format!("{}-- continue not supported", ind),

            AslStatement::Delay(d) => {
                // Convert to milliseconds for delay
                let ms = d.duration.total_ms();
                format!("{}delay {}; -- ms", ind, ms)
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}Put_Line({});", ind, args.join(" & \" \" & "))
            }

            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    PinModeKind::Output => "-- OUTPUT mode (configure at init)",
                    PinModeKind::Input => "-- INPUT mode (configure at init)",
                    PinModeKind::InputPullup => "-- INPUT_PULLUP mode",
                    _ => "-- mode",
                };
                format!("{}-- Pin {}: {}", ind, self.gen_expr(&p.pin), mode)
            }

            AslStatement::DigitalOutput(d) => {
                let pin_expr = self.gen_expr(&d.pin);
                let val_str = self.gen_expr(&d.value);
                // Generate GPIO write call
                format!("{}GPIO_Write({}, {});", ind, pin_expr, val_str)
            }

            AslStatement::DigitalInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                format!("{} := GPIO_Read({});", r.target, pin_expr)
            }

            AslStatement::AnalogOutput(a) => {
                let pin_expr = self.gen_expr(&a.pin);
                let value_expr = self.gen_expr(&a.value);
                format!("{}PWM_Set({}, {});", ind, pin_expr, value_expr)
            }

            AslStatement::AnalogInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                format!("{} := ADC_Read({});", r.target, pin_expr)
            }

            AslStatement::SerialBegin(s) => {
                format!("{}UART_Init({});", ind, self.gen_expr(&s.baud))
            }

            AslStatement::UartWrite(u) => {
                format!("{}UART_Write({});", ind, self.gen_expr(&u.data))
            }

            AslStatement::UartRead(_) => format!("{}UART_Read;", ind),

            AslStatement::I2cWrite(i) => format!(
                "{}I2C_Write({}, {});",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.data)
            ),

            AslStatement::I2cRead(i) => format!(
                "{}I2C_Read({}, {});",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{}SPI_Transfer({});", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Comment(c) => format!("{}-- {}", ind, c.text),

            AslStatement::Expr(e) => format!("{}{};", ind, self.gen_expr(&e.expr)),

            _ => format!("{}-- (unsupported: {:?})", ind, stmt),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ada_generator_empty_program() {
        let prog = AslProgram::default();
        let out = AdaGenerator::new().generate(&prog);
        assert!(out.code.contains("Ravenscar"));
    }
}
