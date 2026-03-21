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
        for func in &program.functions {
            out.push_str(&self.gen_program_block(func));
            out.push('\n');
        }
        GeneratorOutput::new(out)
    }
}

impl StGenerator {

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
