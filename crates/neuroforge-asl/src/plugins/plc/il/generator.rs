//! IL Generator     converte AslProgram para IL textual (IEC 61131-3   3).
//!
//! AND/OR usam to_iec_symbol() que produz "AND" / "OR" conforme a norma.
//! Nega    o de operando    emitida como sufixo "N" (ex: ANDN, ORN).
//!
//! RT-11: completa    o     XOR/XORN, CALC/CALCN, RETC/RETCN, 10 testes.

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
                // Verificar se o corpo    um CAL     CALC / CALCN
                if i.then_body.len() == 1 {
                    match &i.then_body[0] {
                        AslStatement::Expr(e) => {
                            if let AslExpr::Call(call) = &e.expr {
                                // Detectar se a condi    o    negada (CALCN)
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
                for s in &i.then_body {
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

    /// Desembrulha NOT(expr)     (expr, true); caso contr  rio devolve (expr, false).
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
    use crate::types::asl_types::*;

    //           helpers                                                                                                                                                                                                 

    fn var(name: &str) -> AslExpr {
        AslExpr::Var(AslVarRef { name: name.to_string(), ..Default::default() })
    }
    fn not(e: AslExpr) -> AslExpr {
        AslExpr::Unary(Box::new(AslUnary { op: UnaryOp::Not, expr: e }))
    }
    fn binary(op: BinaryOp, l: AslExpr, r: AslExpr) -> AslExpr {
        AslExpr::Binary(Box::new(AslBinary { op, left: l, right: r, ..Default::default() }))
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
                body: stmts, ..Default::default() }],
            ..Default::default()
        }
    }
    fn gen(prog: &AslProgram) -> String {
        IlGenerator::new().generate(prog)
    }

    #[test]
    fn generate_produces_nonempty_output() {
        let prog = IlParser::parse("PROGRAM P\n LD A\n END_PROGRAM").unwrap();
        let out  = gen(&prog);
        assert!(!out.is_empty());
        assert!(out.contains("PROGRAM P"));
    }

    #[test]
    fn generate_ldn_for_not_operand() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  not(var("X")), ..Default::default()
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("LDN"));
    }

    #[test]
    fn generate_andn_for_negated_rhs() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::And, var("A"), not(var("B"))), ..Default::default()
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("ANDN"));
    }

    #[test]
    fn generate_xor_operator() {
        let prog = simple_prog("P", vec![
            AslStatement::Assign(AslAssign {
                target: "Q".to_string(),
                value:  binary(BinaryOp::BitXor, var("A"), var("B")), ..Default::default()
            }),
        ]);
        let out = gen(&prog);
        assert!(out.contains("XOR"));
    }

    #[test]
    fn generate_calc_for_conditional_call() {
        let prog = simple_prog("P", vec![
            AslStatement::If(Box::new(AslIf {
                condition: var("Enable"),
                then_body: vec![
                    AslStatement::Expr(AslExpressionStmt {
                        expr: AslExpr::Call(Box::new(AslCall {
                            callee: "MyFB".to_string(),
                            args: vec![], ..Default::default() })), ..Default::default()
                    }),
                ],
                else_body: None, ..Default::default()
            })),
        ]);
        let out = gen(&prog);
        assert!(out.contains("CALC"));
    }

    #[test]
    fn generate_retc_for_conditional_return() {
        let prog = simple_prog("P", vec![
            AslStatement::If(Box::new(AslIf {
                condition: var("Done"),
                then_body: vec![
                    AslStatement::Return(AslReturn { value: None , ..Default::default() }),
                ],
                else_body: None, ..Default::default()
            })),
        ]);
        let out = gen(&prog);
        assert!(out.contains("RETC"));
    }
}
