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

use crate::types::asl_types::{
    AslProgram, AslFunction, AslStatement, AslExpr,
};

pub struct PythonGenerator {
    indent_size: usize,
}

impl Default for PythonGenerator {
    fn default() -> Self { Self { indent_size: 4 } }
}

impl PythonGenerator {
    pub fn new() -> Self { Self::default() }

    pub fn generate(&self, program: &AslProgram) -> String {
        let mut out = String::new();
        out.push_str("import machine\nimport utime\n\n");

        for global in &program.globals {
            out.push_str(&format!("{} = {}\n",
                global.name,
                global.initial_value.as_ref().map(|v| v.to_string()).unwrap_or_else(|| "None".to_string())
            ));
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
            AslExpr::Literal(l) => l.value.to_string(),
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => format!("({} {} {})", self.gen_expr(&b.left), b.op.to_symbol(), self.gen_expr(&b.right)),
            AslExpr::Unary(u) => format!("{}{}", u.op.to_symbol(), self.gen_expr(&u.expr)),
            AslExpr::Call(c) => format!("{}({})", c.callee, c.args.iter().map(|a| self.gen_expr(a)).collect::<Vec<_>>().join(", ")),
            AslExpr::Member(m) => format!("{}.{}", self.gen_expr(&m.target), m.property),
            AslExpr::Index(i) => format!("{}[{}]", self.gen_expr(&i.target), self.gen_expr(&i.index)),
            AslExpr::Array(a) => format!("[{}]", a.elements.iter().map(|e| self.gen_expr(e)).collect::<Vec<_>>().join(", ")),
            _ => "None".to_string(),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
        if stmts.is_empty() {
            return format!("{}pass\n", self.indent(level));
        }
        stmts.iter().map(|s| {
            let mut line = self.gen_stmt(s, level);
            line.push('\n');
            line
        }).collect()
    }

    fn gen_stmt(&self, stmt: &AslStatement, level: usize) -> String {
        let ind = self.indent(level);
        match stmt {
            AslStatement::Assign(a) =>
                format!("{}{} = {}", ind, a.target, self.gen_expr(&a.value)),
            AslStatement::Declare(d) =>
                format!("{}{} = {}", ind, d.name,
                    d.value.as_ref().map(|v| self.gen_expr(v)).unwrap_or_else(|| "None".to_string())),
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
                out.push_str(&format!("{}    if not ({}):\n{}        break\n", ind, self.gen_expr(&s.condition), ind));
                out
            }
            AslStatement::ForIn(s) => {
                let mut out = format!("{}for {} in {}:\n", ind, s.var_name, self.gen_expr(&s.iterable));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out
            }
            AslStatement::Return(r) =>
                format!("{}return {}", ind, r.value.as_ref().map(|v| self.gen_expr(v)).unwrap_or_default()),
            AslStatement::Break => format!("{}break", ind),
            AslStatement::Continue => format!("{}continue", ind),
            AslStatement::Delay(d) =>
                format!("{}utime.sleep_ms({})", ind, self.gen_expr(&d.milliseconds)),
            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}print({})", ind, args.join(", "))
            }
            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    crate::types::asl_types::PinModeKind::Output => "machine.Pin.OUT",
                    crate::types::asl_types::PinModeKind::Input => "machine.Pin.IN",
                    crate::types::asl_types::PinModeKind::InputPullup => "machine.Pin.IN, machine.Pin.PULL_UP",
                };
                format!("{}{} = machine.Pin({}, {})", ind,
                    self.gen_expr(&p.pin), self.gen_expr(&p.pin), mode)
            }
            AslStatement::SerialBegin(s) =>
                format!("{}uart = machine.UART(0, baudrate={})", ind, self.gen_expr(&s.baud)),
            AslStatement::UartWrite(u) =>
                format!("{}uart.write({})", ind, self.gen_expr(&u.data)),
            AslStatement::UartRead(_) =>
                format!("{}uart.read()", ind),
            AslStatement::I2cWrite(i) =>
                format!("{}i2c.writeto({}, {})", ind, self.gen_expr(&i.address), self.gen_expr(&i.data)),
            AslStatement::I2cRead(i) =>
                format!("{}i2c.readfrom({}, {})", ind, self.gen_expr(&i.address), self.gen_expr(&i.length)),
            AslStatement::SpiTransfer(s) =>
                format!("{}spi.write({})", ind, self.gen_expr(&s.tx_data)),
            AslStatement::Expr(e) =>
                format!("{}{}", ind, self.gen_expr(&e.expr)),
            AslStatement::Comment(c) =>
                format!("{}# {}", ind, c.text),
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
