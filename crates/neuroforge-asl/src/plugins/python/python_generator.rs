//! Generator Python — percorre ProgramNode e emite código MicroPython/Python
//!
//! Mapeamento NodeType → código Python:
//!   Function         → def name(params): body
//!   IfStatement      → if cond: / elif / else:
//!   WhileLoop        → while cond:
//!   ForIn            → for var in iterable:
//!   ForLoop          → for init; converte em while equivalente
//!   DoWhile          → while True: body + if not cond: break
//!   SwitchStatement  → if/elif chain (Python não tem switch nativo)
//!   Return           → return [value]
//!   Break            → break
//!   Continue         → continue
//!   Assignment       → left op right
//!   VarDeclaration   → name = value  (tipos ignorados em Python)
//!   GpioSet          → pin.value(val)
//!   GpioRead         → pin.value()
//!   PinMode          → machine.Pin(pin, mode)
//!   AnalogWrite      → pwm.duty_u16(val)
//!   AnalogRead       → adc.read_u16()
//!   DelayMs          → utime.sleep_ms(ms)
//!   DelayUs          → utime.sleep_us(us)
//!   Millis           → utime.ticks_ms()
//!   SerialBegin      → uart = machine.UART(0, baudrate=baud)
//!   Print            → print(val)
//!   PrintLn          → print(val)
//!   UartWrite        → uart.write(val)
//!   UartRead         → uart.read()
//!   I2cWrite         → i2c.writeto(addr, data)
//!   I2cRead          → i2c.readfrom(addr, n)
//!   SpiTransfer      → spi.write(data)
//!   FunctionCall     → name(args)

use crate::types::nodes::{BaseNode, FunctionNode, NodeType, ProgramNode};

pub struct PythonGenerator {
    indent_size: usize,
}

impl Default for PythonGenerator {
    fn default() -> Self { Self { indent_size: 4 } }
}

impl PythonGenerator {
    pub fn new() -> Self { Self::default() }

    pub fn generate(&self, program: &ProgramNode) -> String {
        let mut out = String::new();
        out.push_str("import machine\nimport utime\n\n");

        for global in &program.globals {
            out.push_str(&self.gen_node(global, 0));
            out.push('\n');
        }
        if !program.globals.is_empty() { out.push('\n'); }

        for func in &program.functions {
            out.push_str(&self.gen_function(func, 0));
            out.push_str("\n\n");
        }
        out
    }

    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_function(&self, func: &FunctionNode, level: usize) -> String {
        let ind = self.indent(level);
        let params: Vec<&str> = func.params.iter().map(|p| p.name.as_str()).collect();
        let mut out = format!("{}def {}({}):\n", ind, func.name, params.join(", "));
        if func.body.is_empty() {
            out.push_str(&format!("{}    pass\n", ind));
        } else {
            for stmt in &func.body {
                out.push_str(&self.gen_node(stmt, level + 1));
                out.push('\n');
            }
        }
        out
    }

    fn gen_node(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        match node.node_type {
            NodeType::GpioSet     => format!("{}{}" , ind, self.gen_gpio_set(node)),
            NodeType::GpioRead    => format!("{}{}" , ind, self.gen_gpio_read(node)),
            NodeType::PinMode     => format!("{}{}", ind, self.gen_pin_mode(node)),
            NodeType::AnalogWrite => format!("{}pwm.duty_u16({})", ind, self.arg(node, 1)),
            NodeType::AnalogRead  => format!("{}adc.read_u16()", ind),
            NodeType::DelayMs     => format!("{}utime.sleep_ms({})", ind, self.arg(node, 0)),
            NodeType::DelayUs     => format!("{}utime.sleep_us({})", ind, self.arg(node, 0)),
            NodeType::Millis      => format!("{}utime.ticks_ms()", ind),
            NodeType::Micros      => format!("{}utime.ticks_us()", ind),
            NodeType::Print | NodeType::PrintLn => format!("{}print({})", ind, self.arg(node, 0)),
            NodeType::SerialBegin => format!("{}uart = machine.UART(0, baudrate={})", ind, self.arg(node, 0)),
            NodeType::UartWrite   => format!("{}uart.write({})", ind, self.arg(node, 0)),
            NodeType::UartRead    => format!("{}uart.read()", ind),
            NodeType::UartAvailable => format!("{}uart.any()", ind),
            NodeType::I2cWrite    => format!("{}i2c.writeto({}, {})", ind, self.arg(node, 0), self.arg(node, 1)),
            NodeType::I2cRead     => format!("{}i2c.readfrom({}, {})", ind, self.arg(node, 0), self.arg(node, 1)),
            NodeType::SpiTransfer => format!("{}spi.write({})", ind, self.arg(node, 0)),
            NodeType::IfStatement => self.gen_if(node, level),
            NodeType::WhileLoop   => self.gen_while(node, level),
            NodeType::ForIn       => self.gen_for_in(node, level),
            NodeType::ForLoop     => self.gen_for_as_while(node, level),
            NodeType::DoWhile     => self.gen_do_while(node, level),
            NodeType::SwitchStatement => self.gen_switch(node, level),
            NodeType::Return      => format!("{}return {}", ind, node.value.as_deref().unwrap_or("")),
            NodeType::Break       => format!("{}break", ind),
            NodeType::Continue    => format!("{}continue", ind),
            NodeType::Assignment  => format!("{}{} {} {}", ind,
                node.name.as_deref().unwrap_or(""),
                node.operator.as_deref().unwrap_or("="),
                node.value.as_deref().unwrap_or("")),
            NodeType::VarDeclaration => format!("{}{} = {}", ind,
                node.name.as_deref().unwrap_or(""),
                node.value.as_deref().unwrap_or("None")),
            NodeType::FunctionCall => format!("{}{}", ind, node.raw.as_deref().unwrap_or("")),
            NodeType::Tone        => format!("{}# tone({}, {})", ind, self.arg(node, 0), self.arg(node, 1)),
            NodeType::ServoAttach => format!("{}servo = Servo({})", ind, self.arg(node, 0)),
            NodeType::ServoWrite  => format!("{}servo.angle({})", ind, self.arg(node, 0)),
            NodeType::ServoDetach => format!("{}servo.deinit()", ind),
            _ => format!("{}{}", ind, node.raw.as_deref().unwrap_or("")),
        }
    }

    fn arg(&self, node: &BaseNode, idx: usize) -> String {
        node.children.get(idx).and_then(|c| c.raw.clone()).unwrap_or_default()
    }

    fn gen_gpio_set(&self, node: &BaseNode) -> String {
        let pin = self.arg(node, 0);
        let val = self.arg(node, 1);
        format!("pin_{}.value({})", pin, val)
    }

    fn gen_gpio_read(&self, node: &BaseNode) -> String {
        let pin = self.arg(node, 0);
        format!("pin_{}.value()", pin)
    }

    fn gen_pin_mode(&self, node: &BaseNode) -> String {
        let pin = self.arg(node, 0);
        let mode = self.arg(node, 1);
        let py_mode = match mode.as_str() {
            "OUTPUT" | "1" => "machine.Pin.OUT",
            "INPUT"  | "0" => "machine.Pin.IN",
            "INPUT_PULLUP" => "machine.Pin.IN, machine.Pin.PULL_UP",
            _ => "machine.Pin.OUT",
        };
        format!("pin_{} = machine.Pin({}, {})", pin, pin, py_mode)
    }

    fn gen_if(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("True");
        let mut out = format!("{}if {}:\n", ind, cond);
        for stmt in &node.then_body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        if let Some(else_body) = &node.else_body {
            out.push_str(&format!("{}else:\n", ind));
            for stmt in else_body {
                out.push_str(&self.gen_node(stmt, level + 1));
                out.push('\n');
            }
        }
        out
    }

    fn gen_while(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("True");
        let mut out = format!("{}while {}:\n", ind, cond);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out
    }

    fn gen_for_in(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let var = node.name.as_deref().unwrap_or("_");
        let iter = node.value.as_deref().unwrap_or("");
        let mut out = format!("{}for {} in {}:\n", ind, var, iter);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out
    }

    fn gen_for_as_while(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let init = node.init.as_deref().unwrap_or("");
        let cond = node.condition.as_deref().unwrap_or("True");
        let upd  = node.update.as_deref().unwrap_or("");
        let mut out = format!("{}{}\n", ind, init);
        out.push_str(&format!("{}while {}:\n", ind, cond));
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        if !upd.is_empty() {
            out.push_str(&format!("{}    {}\n", ind, upd));
        }
        out
    }

    fn gen_do_while(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("True");
        let mut out = format!("{}while True:\n", ind);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out.push_str(&format!("{}    if not ({}):\n{}        break\n", ind, cond, ind));
        out
    }

    fn gen_switch(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let val = node.value.as_deref().unwrap_or("");
        let mut out = String::new();
        let mut first = true;
        for case in &node.cases {
            if let Some(case_val) = &case.value {
                let kw = if first { "if" } else { "elif" };
                out.push_str(&format!("{}{} {} == {}:\n", ind, kw, val, case_val));
                first = false;
            } else {
                out.push_str(&format!("{}else:\n", ind));
            }
            for stmt in &case.body {
                out.push_str(&self.gen_node(stmt, level + 1));
                out.push('\n');
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::python::python_parser::PythonParser;

    #[test]
    fn roundtrip_blink() {
        let src = r#"
import machine
import utime

def main():
    while True:
        utime.sleep_ms(500)
"#;
        let prog = PythonParser::parse(src).expect("parse falhou");
        let out  = PythonGenerator::new().generate(&prog);
        assert!(out.contains("utime.sleep_ms"), "deve conter sleep_ms: {}", out);
    }
}
