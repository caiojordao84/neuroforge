//! Generator Structured Text (IEC 61131-3) — percorre AslProgram e emite ST
//!
//! Mapeamento AslStatement → ST:
//!   AslFunction    → PROGRAM name ... END_PROGRAM
//!   If             → IF cond THEN ... ELSE ... END_IF;
//!   While          → WHILE cond DO ... END_WHILE;
//!   DoWhile        → REPEAT ... UNTIL cond;
//!   For (via While)→ emitido como WHILE equivalente
//!   Switch         → CASE val OF ... ELSE ... END_CASE;
//!   Return         → RETURN;
//!   Break          → EXIT;
//!   Assign         → target := value;
//!   Delay          → (* delay(ms) *)
//!   FunctionCall   → name(args);

use crate::types::asl_types::{
    AslProgram, AslFunction, AslStatement, AslExpr,
};
use crate::plugins::core::{AslGenerator, GeneratorOutput};

pub struct StGenerator {
    indent_size: usize,
}

impl Default for StGenerator {
    fn default() -> Self { Self { indent_size: 2 } }
}

impl StGenerator {
    pub fn new() -> Self { Self::default() }
}

impl AslGenerator for StGenerator {
    fn generate(&mut self, program: &AslProgram) -> GeneratorOutput {
        let mut out = String::new();
        
        if !program.globals.is_empty() {
            out.push_str("VAR_GLOBAL\n");
            for global in &program.globals {
                let init = global.initial_value.as_ref()
                    .map(|v| format!(" := {}", v.to_string()))
                    .unwrap_or_default();
                out.push_str(&format!("  {} : {:?}{};\n", global.name, global.r#type, init));
            }
            out.push_str("END_VAR\n\n");
        }

        for func in &program.functions {
            out.push_str(&self.gen_program_block(func));
            out.push('\n');
        }

        for task in &program.tasks {
            if !task.body.is_empty() {
                // Heurística de tradução idiomática (Pattern matching para Blink)
                if let Some(blink) = self.try_match_blink(&task.body) {
                    out.push_str(&format!("PROGRAM {}\n", task.name));
                    out.push_str(&blink);
                    out.push_str("END_PROGRAM\n\n");
                    continue;
                }

                out.push_str(&format!("PROGRAM {}\n", task.name));
                out.push_str("  VAR\n  END_VAR\n");
                for stmt in &task.body {
                    out.push_str(&self.gen_stmt(stmt, 1));
                    out.push('\n');
                }
                out.push_str("END_PROGRAM\n\n");
            }
        }

        GeneratorOutput::new(out)
    }
}

impl StGenerator {

    /// Heurística para converter a estrutura processual (digitalWrite->delay->digitalWrite->delay) 
    /// do Arduino Blink para osciladores de timers IEC (TON)
    fn try_match_blink(&self, body: &[AslStatement]) -> Option<String> {
        if body.len() != 5 { return None; }
        
        let p_mode = match &body[0] { AslStatement::PinMode(p) => p, _ => return None };
        let dw1 = match &body[1] { AslStatement::DigitalWrite(d) => d, _ => return None };
        let d1 = match &body[2] { AslStatement::Delay(d) => d, _ => return None };
        let dw2 = match &body[3] { AslStatement::DigitalWrite(d) => d, _ => return None };
        let d2 = match &body[4] { AslStatement::Delay(d) => d, _ => return None };
        
        let pin = self.gen_expr(&p_mode.pin);
        let t1 = self.gen_expr(&d1.milliseconds);
        let t2 = self.gen_expr(&d2.milliseconds);

        let qx_str = if let Ok(pin_num) = pin.parse::<u32>() {
            let byte = pin_num / 8;
            let bit = pin_num % 8;
            format!("%QX{}.{}", byte, bit)
        } else {
            // Se for variável ou expressão inválida, usa placeholder
            format!("%QX0.0")
        };

        let mut out = String::new();
        out.push_str("  VAR\n");
        out.push_str("    tOn  : TON;\n");
        out.push_str("    tOff : TON;\n");
        out.push_str(&format!("    LED  AT {} : BOOL; (* PIN {} *)\n", qx_str, pin));
        out.push_str("  END_VAR\n\n");
        out.push_str(&format!("  tOn(IN := NOT tOff.Q, PT := T#{}ms);\n", t1));
        out.push_str(&format!("  tOff(IN := tOn.Q, PT := T#{}ms);\n\n", t2));
        out.push_str("  LED := tOn.Q;\n");
        
        Some(out)
    }

    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_program_block(&self, func: &AslFunction) -> String {
        let mut out = format!("PROGRAM {}\n", func.name);

        if !func.params.is_empty() {
            out.push_str("  VAR_INPUT\n");
            for p in &func.params {
                out.push_str(&format!("    {} : {};\n", p.name, p.r#type));
            }
            out.push_str("  END_VAR\n");
        }

        out.push_str("  VAR\n  END_VAR\n");

        for stmt in &func.body {
            out.push_str(&self.gen_stmt(stmt, 1));
            out.push('\n');
        }

        out.push_str("END_PROGRAM\n");
        out
    }

    fn gen_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => l.value.to_string(),
            AslExpr::Var(v) => v.name.clone(),
            AslExpr::Binary(b) => format!("({} {} {})", self.gen_expr(&b.left), b.op.to_symbol(), self.gen_expr(&b.right)),
            AslExpr::Unary(u) => format!("{}{}", u.op.to_symbol(), self.gen_expr(&u.expr)),
            AslExpr::Call(c) => format!("{}({})", c.callee, c.args.iter().map(|a| self.gen_expr(a)).collect::<Vec<_>>().join(", ")),
            _ => format!("{:?}", expr),
        }
    }

    fn gen_block(&self, stmts: &[AslStatement], level: usize) -> String {
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
                format!("{}{} := {};", ind, a.target, self.gen_expr(&a.value)),
            AslStatement::Declare(d) =>
                format!("{}VAR {} : {:?}{}; END_VAR", ind, d.name,
                    d.r#type,
                    d.value.as_ref().map(|v| format!(" := {}", self.gen_expr(v))).unwrap_or_default()),
            AslStatement::If(s) => {
                let mut out = format!("{}IF {} THEN\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.then_branch, level + 1));
                if let Some(eb) = &s.else_branch {
                    out.push_str(&format!("{}ELSE\n", ind));
                    out.push_str(&self.gen_block(eb, level + 1));
                }
                out.push_str(&format!("{}END_IF;", ind));
                out
            }
            AslStatement::While(s) => {
                let mut out = format!("{}WHILE {} DO\n", ind, self.gen_expr(&s.condition));
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}END_WHILE;", ind));
                out
            }
            AslStatement::DoWhile(s) => {
                let mut out = format!("{}REPEAT\n", ind);
                out.push_str(&self.gen_block(&s.body, level + 1));
                out.push_str(&format!("{}UNTIL {};", ind, self.gen_expr(&s.condition)));
                out
            }
            AslStatement::Switch(s) => {
                let mut out = format!("{}CASE {} OF\n", ind, self.gen_expr(&s.discriminant));
                for case in &s.cases {
                    if let Some(t) = &case.test {
                        out.push_str(&format!("{} {}:\n", ind, self.gen_expr(t)));
                    } else {
                        out.push_str(&format!("{}ELSE\n", ind));
                    }
                    out.push_str(&self.gen_block(&case.body, level + 1));
                }
                out.push_str(&format!("{}END_CASE;", ind));
                out
            }
            AslStatement::Return(_) => format!("{}RETURN;", ind),
            AslStatement::Break => format!("{}EXIT;", ind),
            AslStatement::Continue => format!("{}(* CONTINUE not supported in ST *)", ind),
            AslStatement::Delay(d) =>
                format!("{}(* delay({}) *)", ind, self.gen_expr(&d.milliseconds)),
            AslStatement::Print(p) => {
                let args: Vec<String> = p.args.iter().map(|a| self.gen_expr(a)).collect();
                format!("{}(* print({}) *)", ind, args.join(", "))
            }
            AslStatement::PinMode(p) => {
                let mode = match p.mode {
                    crate::types::asl_types::PinModeKind::Output => "OUTPUT",
                    crate::types::asl_types::PinModeKind::Input => "INPUT",
                    crate::types::asl_types::PinModeKind::InputPullup => "INPUT_PULLUP",
                };
                format!("{}(* pinMode({}, {}) *)", ind, self.gen_expr(&p.pin), mode)
            }
            AslStatement::DigitalWrite(d) => {
                let v = match &d.value {
                    crate::types::asl_types::DigitalValue::High => "TRUE".to_string(),
                    crate::types::asl_types::DigitalValue::Low => "FALSE".to_string(),
                    crate::types::asl_types::DigitalValue::Expr(e) => self.gen_expr(e),
                };
                format!("{}pin_{} := {};", ind, self.gen_expr(&d.pin), v)
            }
            AslStatement::TimerTon(t) =>
                format!("{}TON(IN:={}, PT:={});", ind, self.gen_expr(&t.r#in), self.gen_expr(&t.pt)),
            AslStatement::TimerTof(t) =>
                format!("{}TOF(IN:={}, PT:={});", ind, self.gen_expr(&t.r#in), self.gen_expr(&t.pt)),
            AslStatement::TimerTp(t) =>
                format!("{}TP(IN:={}, PT:={});", ind, self.gen_expr(&t.r#in), self.gen_expr(&t.pt)),
            AslStatement::CounterCtu(c) =>
                format!("{}CTU(CU:={}, PV:={});", ind, self.gen_expr(&c.cu), self.gen_expr(&c.pv)),
            AslStatement::CounterCtd(c) =>
                format!("{}CTD(CD:={}, PV:={});", ind, self.gen_expr(&c.cd), self.gen_expr(&c.pv)),
            AslStatement::LatchSr(l) =>
                format!("{}SR(S1:={}, R:={});", ind, self.gen_expr(&l.s), self.gen_expr(&l.r)),
            AslStatement::LatchRs(l) =>
                format!("{}RS(S:={}, R1:={});", ind, self.gen_expr(&l.s), self.gen_expr(&l.r)),
            AslStatement::TrigR(t) =>
                format!("{}R_TRIG(CLK:={});", ind, self.gen_expr(&t.r#in)),
            AslStatement::TrigF(t) =>
                format!("{}F_TRIG(CLK:={});", ind, self.gen_expr(&t.r#in)),
            AslStatement::Expr(e) =>
                format!("{}{}", ind, self.gen_expr(&e.expr)),
            AslStatement::Comment(c) =>
                format!("{}(* {} *)", ind, c.text),
            _ => format!("{}(* stmt não suportado *)", ind),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::plc::st_parser::StParser;

    #[test]
    fn roundtrip_st_program() {
        let src = r#"
PROGRAM Main
  VAR
    Counter : INT := 0;
  END_VAR
  IF Counter > 0 THEN
    Counter := 0;
  END_IF;
END_PROGRAM
"#;
        let prog = StParser::parse(src).expect("parse falhou");
        let out  = StGenerator::new().generate(&prog);
        assert!(out.code.contains("PROGRAM"), "deve conter PROGRAM: {}", out.code);
        assert!(out.code.contains("IF"), "deve conter IF: {}", out.code);
    }
}
