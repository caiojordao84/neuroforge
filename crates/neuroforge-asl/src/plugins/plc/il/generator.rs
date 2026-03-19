//! IL Generator — converte AslProgram para IL textual (IEC 61131-3 §3).
//!
//! AND/OR usam to_iec_symbol() que produz "AND" / "OR" conforme a norma.
//! Negação de operando é emitida como sufixo "N" (ex: ANDN, ORN).
//!
//! RT-11: completação — XOR/XORN, CALC/CALCN, RETC/RETCN, 10 testes.

use crate::types::asl_types::{
    AslBinary, AslExpr, AslFunction, AslProgram, AslStatement,
    BinaryOp, UnaryOp,
};

pub struct IlGenerator;

impl IlGenerator {
    pub fn new() -> Self { Self }

    pub fn generate(&self, program: &AslProgram) -> String {
        program.functions.iter()
            .map(|f| self.gen_function(f))
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    fn gen_function(&self, func: &AslFunction) -> String {
        let mut out = String::new();
        out.push_str(&format!("PROGRAM {}\n", func.name));

        if !func.params.is_empty() {
            out.push_str("VAR\n");
            for p in &func.params {
                out.push_str(&format!("  {} : {};\n", p.name, p.r#type));
            }
            out.push_str("END_VAR\n");
        }

        for stmt in &func.body {
            out.push_str(&self.gen_statement(stmt));
        }

        out.push_str("END_PROGRAM\n");
        out
    }

    fn gen_statement(&self, stmt: &AslStatement) -> String {
        match stmt {
            AslStatement::Assign(a) => {
                let mut lines = vec![];
                self.emit_expr(&a.value, &mut lines, true);
                lines.push(format!("  ST    {}\n", a.target));
                lines.join("")
            }
            AslStatement::Return(r) => {
                if let Some(val) = &r.value {
                    let mut lines = vec![];
                    self.emit_expr(val, &mut lines, true);
                    lines.push("  RET\n".to_string());
                    lines.join("")
                } else {
                    "  RET\n".to_string()
                }
            }
            AslStatement::If(i) => {
                // Verificar se o corpo é um CAL → CALC / CALCN
                if i.then_branch.len() == 1 {
                    match &i.then_branch[0] {
                        AslStatement::Expr(e) => {
                            if let AslExpr::Call(call) = &e.expr {
                                // Detectar se a condição é negada (CALCN)
                                let (cond_expr, negated) = Self::unwrap_not(&i.condition);
                                let mut lines = vec![];
                                self.emit_expr(cond_expr, &mut lines, true);
                                let instr = if negated { "CALCN" } else { "CALC" };
                                lines.push(format!("  {}  {}\n", instr, call.callee));
                                return lines.join("");
                            }
                        }
                        AslStatement::Return(_) => {
                            // RETC / RETCN
                            let (cond_expr, negated) = Self::unwrap_not(&i.condition);
                            let mut lines = vec![];
                            self.emit_expr(cond_expr, &mut lines, true);
                            let instr = if negated { "RETCN" } else { "RETC" };
                            lines.push(format!("  {}\n", instr));
                            return lines.join("");
                        }
                        _ => {}
                    }
                }
                // Caso geral: JMPC
                let mut lines = vec![];
                self.emit_expr(&i.condition, &mut lines, true);
                lines.push("  JMPC  _then\n".to_string());
                for s in &i.then_branch {
                    lines.push(self.gen_statement(s));
                }
                lines.push("_then:\n".to_string());
                lines.join("")
            }
            AslStatement::Expr(e) => {
                if let AslExpr::Call(call) = &e.expr {
                    format!("  CAL   {}\n", call.callee)
                } else {
                    String::new()
                }
            }
            AslStatement::Comment(c) => format!("(* {} *)\n", c.text),
            _ => String::new(),
        }
    }

    fn emit_expr(&self, expr: &AslExpr, out: &mut Vec<String>, is_first: bool) {
        match expr {
            AslExpr::Var(v) => {
                if is_first {
                    out.push(format!("  LD    {}\n", v.name));
                }
            }
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    if is_first {
                        out.push(format!("  LDN   {}\n", v.name));
                    } else {
                        out.push(format!("N_{}", v.name));
                    }
                }
            }
            AslExpr::Binary(b) => {
                self.emit_expr(&b.left, out, true);
                self.emit_binary_rhs(b, out);
            }
            AslExpr::Literal(lit) => {
                if is_first {
                    out.push(format!("  LD    {}\n", lit.value));
                }
            }
            _ => {}
        }
    }

    fn emit_binary_rhs(&self, b: &AslBinary, out: &mut Vec<String>) {
        let (il_op, negated, operand) = Self::extract_rhs_parts(&b.op, &b.right);
        let suffix = if negated { "N" } else { "" };
        out.push(format!("  {}{:<4}  {}\n", il_op, suffix, operand));
    }

    fn extract_rhs_parts(op: &BinaryOp, rhs: &AslExpr) -> (&'static str, bool, String) {
        let il_op = match op {
            BinaryOp::And | BinaryOp::BitAnd => "AND",
            BinaryOp::Or  | BinaryOp::BitOr  => "OR",
            BinaryOp::BitXor                 => "XOR",
            BinaryOp::Add                    => "ADD",
            BinaryOp::Sub                    => "SUB",
            BinaryOp::Mul                    => "MUL",
            BinaryOp::Div                    => "DIV",
            BinaryOp::Gt                     => "GT",
            BinaryOp::Gte                    => "GE",
            BinaryOp::Eq                     => "EQ",
            BinaryOp::Neq                    => "NE",
            BinaryOp::Lte                    => "LE",
            BinaryOp::Lt                     => "LT",
            _                                => "AND",
        };
        match rhs {
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    (il_op, true, v.name.clone())
                } else {
                    (il_op, false, "_unknown".to_string())
                }
            }
            AslExpr::Var(v)     => (il_op, false, v.name.clone()),
            AslExpr::Literal(l) => (il_op, false, l.value.to_string()),
            _                   => (il_op, false, "_complex".to_string()),
        }
    }

    /// Desembrulha NOT(expr) → (expr, true); caso contrário devolve (expr, false).
    fn unwrap_not(expr: &AslExpr) -> (&AslExpr, bool) {
        if let AslExpr::Unary(u) = expr {
            if matches!(u.op, UnaryOp::Not) {
                return (&u.expr, true);
            }
        }
        (expr, false)
    }
}

impl Default for IlGenerator {
    fn default() -> Self { Self::new() }
}

// ============================================================================
// Testes RT-11
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::plc::il::parser::IlParser;
    use crate::types::asl_types::{
        AslProgram, AslFunction, AslMetadata, AslStatement, AslAssign,
        AslReturn, AslExpressionStmt, AslIf,
        AslBinary, AslUnary, AslCall, AslVarRef,
        BinaryOp, UnaryOp,
    };

    // ─── helpers ────────────────────────────────────────────────────────────────

    fn var(name: &str) -> AslExpr {
        AslExpr::Var(AslVarRef { name: name.to_string() })
    }
    fn not(e: AslExpr) -> AslExpr {
        AslExpr::Unary(Box::new(AslUnary { op: UnaryOp::Not, expr: e }))
    }
    fn binary(op: BinaryOp, l: AslExpr, r: AslExpr) -> AslExpr {
        AslExpr::Binary(Box::new(AslBinary { op, left: l, right: r }))
    }
    fn simple_prog(name: &str, stmts: Vec<AslStatement>) -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: Some(name.to_string()),
                description: None, version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![], globals: vec![], tasks: vec![],
            functions: vec![AslFunction {
                name: name.to_string(),
                params: vec![], return_type: None,
                body: stmts,
            }],
        }
    }
    fn gen(prog: &AslProgram) -> String {
        IlGenerator::new().generate(prog)
    }

    // ─── testes herdados (RT anterior) ─────────────────────────────────────────

    const ROUNDTRIP_SRC: &str = r#"
PROGRAM RoundTrip
  VAR
    A : BOOL;
    B : BOOL;
    Q : BOOL;
  END_VAR
  LD    A
  AND   B
  ST    Q
END_PROGRAM
"#;

    #[test]
    fn generate_produces_nonempty_output() {
        let prog = IlParser::parse(ROUNDTRIP_SRC).unwrap();
        let out  = gen(&prog);
        assert!(!out.is_empty());
        assert!(out.contains("PROGRAM RoundTrip"));
        assert!(out.contains("END_PROGRAM"));
    }

    #[test]
    fn generate_contains_and_operator() {
        let prog = IlParser::parse(ROUNDTRIP_SRC).unwrap();
        let out  = gen(&prog);
        assert!(out.contains("AND"),
            "Generator deve emitir AND IEC — output:\n{out}");
    }

    #[test]
    fn generate_contains_st_instruction() {
        let prog = IlParser::parse(ROUNDTRIP_SRC).unwrap();
        let out  = gen(&prog);
        assert!(out.contains("ST"), "deve conter ST\n{out}");
    }

    // ─── testes novos RT-11 ─────────────────────────────────────────────────

    #[test]
    fn generate_ldn_for_not_operand() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  not(var("X")),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("LDN"),
            "NOT(x) como valor deve emitir LDN, output:\n{out}");
    }

    #[test]
    fn generate_andn_for_negated_rhs() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::And, var("A"), not(var("B"))),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("ANDN"),
            "AND com RHS negado deve emitir ANDN, output:\n{out}");
    }

    #[test]
    fn generate_or_operator() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::Or, var("A"), var("B")),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("OR"),
            "BinaryOp::Or deve emitir OR, output:\n{out}");
    }

    #[test]
    fn generate_arithmetic_add() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::Add, var("A"), var("B")),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("ADD"),
            "BinaryOp::Add deve emitir ADD, output:\n{out}");
    }

    #[test]
    fn generate_cmp_eq() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::Eq, var("A"), var("B")),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("EQ"),
            "BinaryOp::Eq deve emitir EQ, output:\n{out}");
    }

    #[test]
    fn generate_xor_operator() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::BitXor, var("A"), var("B")),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("XOR"),
            "BinaryOp::BitXor deve emitir XOR, output:\n{out}");
    }

    #[test]
    fn generate_cal_instruction() {
        let prog = simple_prog("P", vec![
            AslStatement::Expr(AslExpressionStmt {
                expr: AslExpr::Call(Box::new(AslCall {
                    callee: "MyFB".to_string(),
                    args: vec![],
                })),
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("CAL") && out.contains("MyFB"),
            "Expr(Call) deve emitir CAL, output:\n{out}");
    }

    #[test]
    fn generate_calc_for_conditional_call() {
        let prog = simple_prog("P", vec![
            AslStatement::If(Box::new(AslIf {
                condition: var("Enable"),
                then_branch: vec![
                    AslStatement::Expr(AslExpressionStmt {
                        expr: AslExpr::Call(Box::new(AslCall {
                            callee: "MyFB".to_string(),
                            args: vec![],
                        })),
                    }),
                ],
                else_branch: None,
            })),
        ]);
        let out = gen(&prog);
        assert!(out.contains("CALC"),
            "If {{ then: CAL }} deve emitir CALC, output:\n{out}");
    }

    #[test]
    fn generate_retc_for_conditional_return() {
        let prog = simple_prog("P", vec![
            AslStatement::If(Box::new(AslIf {
                condition: var("Done"),
                then_branch: vec![
                    AslStatement::Return(AslReturn { value: None }),
                ],
                else_branch: None,
            })),
        ]);
        let out = gen(&prog);
        assert!(out.contains("RETC"),
            "If {{ then: RET }} deve emitir RETC, output:\n{out}");
    }
}
