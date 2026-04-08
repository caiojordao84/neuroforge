//! Lua/NodeMCU code generator.
//!
//! Generates Lua code for NodeMCU (ESP8266/ESP32) devices.
//!
//! NodeMCU Lua API:
//!   - gpio module: gpio.mode(), gpio.write(), gpio.read()
//!   - tmr module: tmr.register(), tmr.delay(), tmr.start()
//!   - pwm module: pwm.setup(), pwm.start(), pwm.stop()
//!   - uart module: uart.setup(), uart.write(), uart.on()
//!   - i2c module: i2c.setup(), i2c.write(), i2c.read()
//!   - wifi module: wifi.sta.config(), wifi.sta.connect()
//!
//! ASL -> NodeMCU Lua mapping:
//!   AslFunction       function name(params) body end
//!   If                if cond then ... end
//!   While             while cond do ... end
//!   For               for i = start, stop, step do ... end
//!   Return            return [value]
//!   Break             break
//!   Continue          -- not supported in Lua
//!   Assign            target = value
//!   Declare           local name = value
//!   Delay             tmr.delay(ms)
//!   Print             print(val)
//!   PinMode           gpio.mode(pin, mode)
//!   DigitalWrite      gpio.write(pin, value)
//!   DigitalRead       gpio.read(pin)

use crate::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement};

use crate::plugins::core::{AslGenerator, GeneratorOutput};

/// Lua/NodeMCU code generator.
pub struct LuaGenerator {
    indent_size: usize,
}

impl Default for LuaGenerator {
    fn default() -> Self {
        Self { indent_size: 4 }
    }
}

impl LuaGenerator {
    pub fn new() -> Self {
        Self::default()
    }
}

impl AslGenerator for LuaGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        let mut out = String::new();

        let stringified = serde_json::to_string(program).unwrap_or_default();

        // Detect required NodeMCU modules
        let needs_gpio = stringified.contains("\"pinMode\"")
            || stringified.contains("\"digitalWrite\"")
            || stringified.contains("\"digitalRead\"");

        let needs_tmr = stringified.contains("\"delay\"")
            || stringified.contains("\"setInterval\"")
            || stringified.contains("\"setTimeout\"");

        let needs_pwm = stringified.contains("\"analogWrite\"")
            || stringified.contains("\"pwmInit\"")
            || stringified.contains("\"pwmSet\"");

        let needs_uart = stringified.contains("\"serialBegin\"")
            || stringified.contains("\"uartWrite\"")
            || stringified.contains("\"uartRead\"");

        let needs_i2c = stringified.contains("\"i2cWrite\"") || stringified.contains("\"i2cRead\"");

        let needs_wifi = stringified.contains("\"wifi\"");

        // Write header
        out.push_str("-- NodeMCU Lua\n");
        out.push_str("-- NodeMCU modules: gpio, tmr, pwm, uart, i2c, wifi, node, file, net\n\n");

        // Global constants
        if needs_gpio {
            out.push_str("gpio.HIGH = 1\n");
            out.push_str("gpio.LOW = 0\n");
            out.push_str("gpio.OUTPUT = gpio.OUTPUT\n");
            out.push_str("gpio.INPUT = gpio.INPUT\n");
            out.push_str("gpio.INPUT_PULLUP = gpio.INPUT_PULLUP\n\n");
        }

        // Module initialization comments
        if needs_uart {
            out.push_str("-- UART: uart.setup(id, baud, data_bits, stop_bits, parity)\n");
        }

        if needs_i2c {
            out.push_str("-- I2C: i2c.setup(id, speed, scl, sda)\n");
        }

        if needs_wifi {
            out.push_str("-- WiFi: wifi.sta.config(ssid, password)\n");
            out.push_str("-- WiFi: wifi.sta.connect()\n");
        }

        if needs_pwm {
            out.push_str("-- PWM: pwm.setup(pin, freq, duty), pwm.start(pin), pwm.stop(pin)\n");
        }

        // Generate global variables
        for global_var in &program.globals {
            out.push_str(&format!(
                "{} = {}\n",
                global_var.name,
                global_var
                    .value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "nil".to_string())
            ));
        }

        if !program.globals.is_empty() {
            out.push('\n');
        }

        // Helper for infinite while loops
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

        // Tasks - NodeMCU style
        let has_setup = program.tasks.iter().any(|t| t.name == "setup");
        let has_loop = program.tasks.iter().any(|t| t.name == "loop");

        if has_setup || has_loop {
            out.push_str("-- ASL Execution Sequence\n");

            if let Some(setup) = program.tasks.iter().find(|t| t.name == "setup") {
                out.push_str("function setup()\n");
                for stmt in &setup.body {
                    if is_infinite_while_loop(stmt) {
                        continue;
                    }
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }
                out.push_str("end\n\n");
            }

            if let Some(loop_task) = program.tasks.iter().find(|t| t.name == "loop") {
                out.push_str("function loop()\n");
                out.push_str("  while true do\n");
                for stmt in &loop_task.body {
                    out.push_str(&self.gen_stmt(stmt, 2));
                    out.push('\n');
                }
                out.push_str("  end\n");
                out.push_str("end\n\n");

                // Auto-start loop
                out.push_str("tmr.alarm(0, 100, 1, function()\n");
                out.push_str("  loop()\n");
                out.push_str("end)\n");
            }
        } else {
            // Standard task generation
            for task in &program.tasks {
                out.push_str(&format!("function {}()\n", task.name));

                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }

                out.push_str("end\n\n");
            }
        }

        GeneratorOutput::new(out)
    }
}

impl LuaGenerator {
    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_function(&self, func: &AslFunction, level: usize, _program: &AslProgram) -> String {
        let ind = self.indent(level);

        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();

        let mut out = format!("{}function {}({})\n", ind, func.name, params.join(", "));

        if func.body.is_empty() {
            out.push_str(&format!("{}  -- empty\n", ind));
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_stmt(stmt, level + 1));
                out.push('\n');
            }
        }

        out.push_str(&format!("{}end", ind));

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
                let lua_op = match op_sym {
                    "&&" => " and ",
                    "||" => " or ",
                    "==" => "==",
                    "~=" => "~=",
                    "<=" => "<=",
                    ">=" => ">=",
                    "<" => "<",
                    ">" => ">",
                    "+" => "+",
                    "-" => "-",
                    "*" => "*",
                    "/" => "/",
                    "%" => "%",
                    "^" => "^",
                    _ => op_sym,
                };
                format!(
                    "({} {} {})",
                    self.gen_expr(&b.left),
                    lua_op,
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
                        .unwrap_or_else(|| "0".into());
                    format!("gpio.read({})", pin)
                }

                "analogRead" => {
                    let pin = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "0".into());
                    format!("adc.read({})", pin)
                }

                "Serial.print" | "print" | "println" => {
                    let arg = c
                        .args
                        .first()
                        .map(|a| self.gen_expr(a))
                        .unwrap_or_else(|| "\"\"".into());
                    format!("print({})", arg)
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
                "{{{}}}",
                a.elements
                    .iter()
                    .map(|e| self.gen_expr(e))
                    .collect::<Vec<_>>()
                    .join(", ")
            ),

            _ => "nil".to_string(),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}  -- empty\n", self.indent(level));
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
                "{}local {} = {}",
                ind,
                d.name,
                d.value
                    .as_ref()
                    .map(|v| self.gen_expr(v))
                    .unwrap_or_else(|| "nil".to_string())
            ),

            AslStatement::If(s) => {
                let mut out = format!("{}if {} then\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.then_body, level + 1));

                for eb_if in &s.else_if {
                    out.push_str(&format!(
                        "{}elseif {} then\n",
                        ind,
                        self.gen_expr(&eb_if.condition)
                    ));
                    out.push_str(&self.gen_block(&eb_if.body, level + 1));
                }

                if let Some(eb) = &s.else_body {
                    out.push_str(&format!("{}else\n", ind));
                    out.push_str(&self.gen_block(eb, level + 1));
                }

                out.push_str(&format!("{}end", ind));

                out
            }

            AslStatement::While(s) => {
                let mut out = format!("{}while {} do\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}end", ind));
                out
            }

            AslStatement::DoWhile(s) => {
                let mut out = format!("{}repeat\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}until {}", ind, self.gen_expr(&s.condition)));
                out
            }

            AslStatement::For(s) => match s.as_ref() {
                crate::asl_types::AslFor::Range(r) => {
                    let step = self.gen_expr(&r.step);
                    let mut out = format!(
                        "{}for {} = {}, {}, {} do\n",
                        ind,
                        r.var,
                        self.gen_expr(&r.from),
                        self.gen_expr(&r.to),
                        step
                    );
                    out.push_str(&self.gen_block(&r.body, level + 1));
                    out.push_str(&format!("{}end", ind));
                    out
                }

                crate::asl_types::AslFor::Each(e) => {
                    let mut out = format!(
                        "{}for _, {} in pairs({}) do\n",
                        ind,
                        e.var,
                        self.gen_expr(&e.iterable)
                    );
                    out.push_str(&self.gen_block(&e.body, level + 1));
                    out.push_str(&format!("{}end", ind));
                    out
                }

                crate::asl_types::AslFor::CStyle(c) => {
                    let mut out = String::new();
                    // Lua doesn't have C-style for, convert to while
                    for stmt in &c.init {
                        out.push_str(&self.gen_stmt(stmt, level));
                        out.push('\n');
                    }
                    out.push_str(&format!(
                        "{}while {} do\n",
                        ind,
                        self.gen_expr(&c.condition)
                    ));
                    out.push_str(&self.gen_block(&c.body, level + 1));
                    for stmt in &c.update {
                        out.push_str(&self.gen_stmt(stmt, level + 1));
                        out.push('\n');
                    }
                    out.push_str(&format!("{}end", ind));
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

            AslStatement::Continue => format!("{}-- continue not supported", ind),

            AslStatement::Delay(d) => {
                format!("{}tmr.delay({})", ind, d.duration.total_ms())
            }

            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}print({})", ind, args.join(" .. \" \" .. "))
            }

            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    crate::asl_types::PinModeKind::Output => "gpio.OUTPUT",
                    crate::asl_types::PinModeKind::Input => "gpio.INPUT",
                    crate::asl_types::PinModeKind::InputPullup => "gpio.INPUT_PULLUP",
                    crate::asl_types::PinModeKind::InputPulldown => "gpio.INPUT_PULLDOWN",
                    _ => "gpio.INPUT",
                };
                let pin_expr = self.gen_expr(&p.pin);
                format!("{}gpio.mode({}, {})", ind, pin_expr, mode)
            }

            AslStatement::DigitalOutput(d) => {
                let pin_expr = self.gen_expr(&d.pin);
                let val_str = self.gen_expr(&d.value);
                let lua_val = if val_str == "HIGH" || val_str == "1" || val_str == "true" {
                    "gpio.HIGH"
                } else if val_str == "LOW" || val_str == "0" || val_str == "false" {
                    "gpio.LOW"
                } else {
                    &val_str
                };
                format!("{}gpio.write({}, {})", ind, pin_expr, lua_val)
            }

            AslStatement::AnalogOutput(a) => {
                let pin_expr = self.gen_expr(&a.pin);
                let value_expr = self.gen_expr(&a.value);
                // NodeMCU PWM: duty cycle 0-1023
                format!("{}pwm.setduty({}, {})", ind, pin_expr, value_expr)
            }

            AslStatement::DigitalInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                format!("{}local {} = gpio.read({})", ind, r.target, pin_expr)
            }

            AslStatement::AnalogInput(r) => {
                let pin_expr = self.gen_expr(&r.pin);
                format!("{}local {} = adc.read({})", ind, r.target, pin_expr)
            }

            AslStatement::SerialBegin(s) => {
                format!(
                    "{}uart.setup(0, {}, 8, 0, 0, 0)",
                    ind,
                    self.gen_expr(&s.baud)
                )
            }

            AslStatement::UartWrite(u) => {
                format!("{}uart.write(0, {})", ind, self.gen_expr(&u.data))
            }

            AslStatement::UartRead(_) => format!("{}uart.read(0)", ind),

            AslStatement::I2cWrite(i) => format!(
                "{}i2c.write(0, {}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.data)
            ),

            AslStatement::I2cRead(i) => format!(
                "{}i2c.read(0, {}, {})",
                ind,
                self.gen_expr(&i.address),
                self.gen_expr(&i.length)
            ),

            AslStatement::SpiTransfer(s) => {
                format!("{}spi.send(0, {})", ind, self.gen_expr(&s.tx_data))
            }

            AslStatement::Expr(e) => format!("{}{}", ind, self.gen_expr(&e.expr)),

            AslStatement::Comment(c) => format!("{}-- {}", ind, c.text),

            AslStatement::PwmInit(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let freq = self.gen_expr(&p.freq);
                format!("{}pwm.setup({}, {}, 0)", ind, pin_expr, freq)
            }

            AslStatement::PwmSetDuty(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                let duty = self.gen_expr(&p.duty);
                format!("{}pwm.setduty({}, {})", ind, pin_expr, duty)
            }

            AslStatement::PwmStop(p) => {
                let pin_expr = self.gen_expr(&p.pin);
                format!("{}pwm.stop({})", ind, pin_expr)
            }

            AslStatement::Log(l) => format!("{}print({})", ind, self.gen_expr(&l.message)),

            _ => format!("{}-- (unsupported: {:?})", ind, stmt),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lua_generator_empty_program() {
        let prog = AslProgram::default();
        let out = LuaGenerator::new().generate(&prog);
        assert!(out.code.contains("NodeMCU"));
    }
}
