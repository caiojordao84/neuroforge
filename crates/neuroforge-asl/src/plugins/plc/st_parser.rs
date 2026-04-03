//! Parser Structured Text (IEC 61131-3) via crate `iec61131` v0.7
//!
//! RT-4: Expression lowering real.
//!
//! Confirmado via diag:
//!   Variable Debug = Simple("X")  — extrair entre '("' e '")'.
//!   BinaryOp::Add / Gte mapeiam correctamente via Debug string.

#![allow(unused_imports)]

use crate::types::asl_types::{
    AslProgram, AslFunction, AslParam, AslStatement, AslExpr, AslMetadata,
    AslIf, AslWhile, AslDoWhile, AslSwitch, AslSwitchCase,
    AslAssign, AslReturn, AslExpressionStmt, AslType, AslCall,
    AslBinary, AslUnary, AslLiteral,
    BinaryOp, UnaryOp,
};
use iec61131::{
    Parser as IecParser,
    PouDeclaration,
    Statement,
    Expression,
    TypeSpec,
    VarDecl,
    Argument,
    StatementList,
    Variable,
};

#[derive(Debug, thiserror::Error)]
pub enum StParseError {
    #[error("iec61131: erro de parse: {0}")]
    ParseError(String),
    #[error("iec61131: source vazia")]
    EmptySource,
}

pub struct StParser;

impl StParser {
    pub fn parse(source: &str) -> Result<AslProgram, StParseError> {
        if source.trim().is_empty() {
            return Err(StParseError::EmptySource);
        }
        let mut parser = IecParser::new(source);
        let cu = parser.parse()
            .map_err(|e| StParseError::ParseError(e.to_string()))?;
        let mut visitor = StVisitor;
        Ok(visitor.visit_declarations(cu.declarations))
    }
}

struct StVisitor;

impl StVisitor {
    fn visit_declarations(&mut self, decls: Vec<PouDeclaration>) -> AslProgram {
        let mut functions = vec![];
        for decl in decls {
            match decl {
                PouDeclaration::Program(prog)     => functions.push(self.visit_program(prog)),
                PouDeclaration::FunctionBlock(fb) => functions.push(self.visit_fb(fb)),
                PouDeclaration::Function(func)    => functions.push(self.visit_function(func)),
                _ => {}
            }
        }
        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: None, description: None, version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![],
            globals: vec![],
            functions,
            tasks: vec![],
            ..Default::default()
        }
    }

    fn vars_to_params(vars: &[VarDecl]) -> Vec<AslParam> {
        vars.iter().map(|v| AslParam {
            name:   v.name.clone(),
            r#type: format!("{:?}", v.var_type),
        }).collect()
    }

    fn visit_program(&mut self, prog: iec61131::ProgramDecl) -> AslFunction {
        let params = Self::vars_to_params(&prog.vars);
        let body   = self.visit_stmts(prog.body);
        AslFunction { name: prog.name, return_type: None, params, body }
    }

    fn visit_fb(&mut self, fb: iec61131::FunctionBlockDecl) -> AslFunction {
        let body = self.visit_stmts(fb.body.unwrap_or_default());
        AslFunction { name: fb.name, return_type: None, params: vec![], body }
    }

    fn visit_function(&mut self, func: iec61131::FunctionDecl) -> AslFunction {
        let mut params = vec![];
        params.extend(Self::vars_to_params(&func.inputs));
        params.extend(Self::vars_to_params(&func.outputs));
        params.extend(Self::vars_to_params(&func.in_outs));
        let body        = self.visit_stmts(func.body);
        let return_type = func.return_type.map(|_| AslType::Int);
        AslFunction { name: func.name, return_type, params, body }
    }

    fn visit_stmts(&mut self, stmts: StatementList) -> Vec<AslStatement> {
        stmts.into_iter().flat_map(|s| self.visit_stmt(s)).collect()
    }

    // ── Variable name extraction ───────────────────────────────────────────────────
    //
    // Confirmado via diag: Variable Debug = Simple("X")
    // Extractors, por ordem de prioridade:
    //   1. Simple("X")      → extrai entre '("' e '")'
    //   2. name: "X"        → fallback para structs com campo name
    //   3. string debug raw → fallback final, nunca panic

    fn var_debug_name(v: &Variable) -> String {
        let dbg = format!("{:?}", v);
        Self::extract_var_name(&dbg)
    }

    fn extract_var_name(dbg: &str) -> String {
        // Padrão 1: Simple("X") ou Qualified("X") ou qualquer Variant("X")
        // Procura '("' seguido de conteúdo até '")'
        if let Some(start) = dbg.find("(\"")
        {
            let rest = &dbg[start + 2..];
            if let Some(end) = rest.find("\")") {
                return rest[..end].to_string();
            }
        }
        // Padrão 2: name: "X"
        if let Some(start) = dbg.find("name: \"") {
            let rest = &dbg[start + 7..];
            if let Some(end) = rest.find('"') {
                return rest[..end].to_string();
            }
        }
        // Fallback: debug completo
        dbg.to_string()
    }

    // ── BinaryOp / UnaryOp mapping via Debug string ───────────────────────────

    fn map_bin_op_str(op_dbg: &str) -> BinaryOp {
        let s = op_dbg.trim().to_lowercase();
        match s.as_str() {
            "add"                                      => BinaryOp::Add,
            "sub" | "subtract" | "minus"               => BinaryOp::Sub,
            "mul" | "multiply" | "times"               => BinaryOp::Mul,
            "div" | "divide" | "divides"               => BinaryOp::Div,
            "mod" | "modulo" | "rem" | "remainder"     => BinaryOp::Mod,
            "eq"  | "equal" | "equals"                 => BinaryOp::Eq,
            "ne"  | "neq" | "notequal" | "not_equal"
                | "noteq" | "unequal"                  => BinaryOp::Neq,
            "lt"  | "lessthan" | "less_than"           => BinaryOp::Lt,
            "le"  | "lte" | "lessorequal"
                | "less_or_equal" | "lessequal"        => BinaryOp::Lte,
            "gt"  | "greaterthan" | "greater_than"     => BinaryOp::Gt,
            "ge"  | "gte" | "greaterorequal"
                | "greater_or_equal" | "greaterequal"  => BinaryOp::Gte,
            "and"                                      => BinaryOp::And,
            "or"                                       => BinaryOp::Or,
            "xor"                                      => BinaryOp::BitXor,
            "power" | "pow" | "exponent" | "exp"       => BinaryOp::Mul,
            _                                          => BinaryOp::Add,
        }
    }

    fn map_un_op_str(op_dbg: &str) -> UnaryOp {
        let s = op_dbg.trim().to_lowercase();
        match s.as_str() {
            "not"                       => UnaryOp::Not,
            "neg" | "negate" | "minus" => UnaryOp::Neg,
            _                          => UnaryOp::Not,
        }
    }

    // ── Expression lowering ─────────────────────────────────────────────────────

    fn lower_expr(expr: Expression) -> AslExpr {
        match expr {
            Expression::Variable(v) => AslExpr::var(&Self::var_debug_name(&v)),

            Expression::Binary { op, left, right } => {
                let op_str = format!("{:?}", op);
                AslExpr::Binary(Box::new(AslBinary {
                    op:    Self::map_bin_op_str(&op_str),
                    left:  Self::lower_expr(*left),
                    right: Self::lower_expr(*right),
                }))
            }

            Expression::Unary { op, operand } => {
                let op_str = format!("{:?}", op);
                AslExpr::Unary(Box::new(AslUnary {
                    op:   Self::map_un_op_str(&op_str),
                    expr: Self::lower_expr(*operand),
                }))
            }

            Expression::Literal(l) => {
                let raw = format!("{:?}", l);
                let jv = if let Ok(i) = raw.parse::<i64>() {
                    serde_json::json!(i)
                } else if let Ok(f) = raw.parse::<f64>() {
                    serde_json::json!(f)
                } else if raw.eq_ignore_ascii_case("true") {
                    serde_json::json!(true)
                } else if raw.eq_ignore_ascii_case("false") {
                    serde_json::json!(false)
                } else {
                    serde_json::json!(raw)
                };
                AslExpr::Literal(AslLiteral { value: jv })
            }

            other => AslExpr::var(&format!("{:?}", other)),
        }
    }

    fn lower_argument(arg: Argument) -> AslExpr {
        match arg {
            Argument::Positional(e)           => Self::lower_expr(e),
            Argument::Named { value, .. }     => Self::lower_expr(value),
            Argument::Output { variable, .. } => AslExpr::var(&Self::var_debug_name(&variable)),
        }
    }

    fn var_str(v: &Variable) -> String { Self::var_debug_name(v) }

    fn visit_stmt(&mut self, stmt: Statement) -> Vec<AslStatement> {
        match stmt {
            Statement::Assignment { target, value, .. } => {
                vec![AslStatement::Assign(AslAssign {
                    target: Self::var_str(&target),
                    value:  Self::lower_expr(value),
                })]
            }
            Statement::If { condition, then_body, elsif_parts, else_body, .. } => {
                let cond_expr   = Self::lower_expr(condition);
                let then_branch = self.visit_stmts(then_body);
                
                let else_if: Vec<AslElseIf> = elsif_parts
                    .into_iter()
                    .map(|(cond, body)| AslElseIf {
                        condition: Self::lower_expr(cond),
                        body:      self.visit_stmts(body),
                    })
                    .collect();
                
                let else_body = else_body.map(|eb| self.visit_stmts(eb));

                vec![AslStatement::If(Box::new(AslIf {
                    condition: cond_expr,
                    then_body: then_branch,
                    else_if,
                    else_body,
                }))]
            }
            Statement::For { control_var, start, end, step, body, .. } => {
                let start_expr = Self::lower_expr(start);
                let end_expr   = Self::lower_expr(end);
                let step_expr  = step.map(Self::lower_expr)
                    .unwrap_or_else(|| AslExpr::int(1));
                let cond_expr = AslExpr::Binary(Box::new(AslBinary {
                    op:    BinaryOp::Lte,
                    left:  AslExpr::var(&control_var),
                    right: end_expr,
                }));
                let update_stmt = AslStatement::Assign(AslAssign {
                    target: control_var.clone(),
                    value:  AslExpr::Binary(Box::new(AslBinary {
                        op:    BinaryOp::Add,
                        left:  AslExpr::var(&control_var),
                        right: step_expr,
                    })),
                });
                let mut body_stmts = self.visit_stmts(body);
                body_stmts.push(update_stmt);
                vec![
                    AslStatement::Assign(AslAssign { target: control_var, value: start_expr }),
                    AslStatement::While(Box::new(AslWhile { condition: cond_expr, body: body_stmts })),
                ]
            }
            Statement::While { condition, body, .. } => {
                let body_stmts = self.visit_stmts(body);
                vec![AslStatement::While(Box::new(AslWhile {
                    condition: Self::lower_expr(condition),
                    body: body_stmts,
                }))]
            }
            Statement::Repeat { body, condition, .. } => {
                let body_stmts = self.visit_stmts(body);
                vec![AslStatement::DoWhile(Box::new(AslDoWhile {
                    condition: Self::lower_expr(condition),
                    body: body_stmts,
                }))]
            }
            Statement::Case { selector, cases, else_body, .. } => {
                let discriminant = Self::lower_expr(selector);
                let mut case_list: Vec<AslSwitchCase> = cases
                    .into_iter()
                    .map(|ci| {
                        let body_stmts = self.visit_stmts(ci.body);
                        let test = ci.selectors.first()
                            .map(|v| AslExpr::var(&format!("{:?}", v)));
                        AslSwitchCase { test, body: body_stmts }
                    })
                    .collect();
                if let Some(eb) = else_body {
                    let eb_stmts = self.visit_stmts(eb);
                    case_list.push(AslSwitchCase { test: None, body: eb_stmts });
                }
                vec![AslStatement::Switch(Box::new(AslSwitch { discriminant, cases: case_list }))]
            }
            Statement::Return { .. } =>
                vec![AslStatement::Return(AslReturn { value: None })],
            Statement::Exit { .. } =>
                vec![AslStatement::Break],
            Statement::FunctionCall { name, arguments, .. } => {
                let args = arguments.into_iter().map(Self::lower_argument).collect();
                vec![AslStatement::Expr(AslExpressionStmt {
                    expr: AslExpr::Call(Box::new(AslCall { callee: name, args })),
                })]
            }
            _ => vec![],
        }
    }
}

// ============================================================================
// Testes RT-4
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::{AslExpr, AslStatement, BinaryOp, UnaryOp};

    // Helpers: encontra o primeiro Assign/While/Unary no body (independente do índice)
    fn first_assign(body: &[AslStatement]) -> &AslAssign {
        body.iter().find_map(|s| if let AslStatement::Assign(a) = s { Some(a) } else { None })
            .expect("esperado pelo menos um Assign no body")
    }
    fn first_while(body: &[AslStatement]) -> &AslWhile {
        body.iter().find_map(|s| if let AslStatement::While(w) = s { Some(w.as_ref()) } else { None })
            .expect("esperado pelo menos um While no body")
    }

    const SIMPLE_ASSIGN: &str = r#"
PROGRAM Main
  VAR Motor : BOOL := FALSE; END_VAR
  IF Motor THEN Motor := FALSE; END_IF;
END_PROGRAM
"#;

    const BINARY_EXPR: &str = r#"
PROGRAM BinTest
  VAR A : INT; B : INT; C : INT; END_VAR
  C := A + B;
END_PROGRAM
"#;

    const COMPARE_EXPR: &str = r#"
PROGRAM CmpTest
  VAR Counter : INT; Limit : INT; Reached : BOOL; END_VAR
  Reached := Counter >= Limit;
END_PROGRAM
"#;

    const NOT_EXPR: &str = r#"
PROGRAM NotTest
  VAR Enable : BOOL; Out : BOOL; END_VAR
  Out := NOT Enable;
END_PROGRAM
"#;

    const AND_EXPR: &str = r#"
PROGRAM AndTest
  VAR A : BOOL; B : BOOL; Q : BOOL; END_VAR
  Q := A AND B;
END_PROGRAM
"#;

    const FOR_LOOP: &str = r#"
PROGRAM ForTest
  VAR i : INT; Sum : INT; END_VAR
  FOR i := 0 TO 9 DO Sum := Sum + i; END_FOR;
END_PROGRAM
"#;

    #[test]
    fn parse_st_program() {
        let prog = StParser::parse(SIMPLE_ASSIGN).expect("parse falhou");
        assert!(!prog.functions.is_empty());
        assert!(prog.functions.iter().any(|f| f.name == "Main"));
    }

    #[test]
    fn assignment_value_is_not_debug_string() {
        let prog   = StParser::parse(BINARY_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert_eq!(assign.target, "C");
        assert!(
            matches!(&assign.value, AslExpr::Binary(_)),
            "C := A + B deve produzir AslExpr::Binary, obtido: {:?}",
            assign.value
        );
    }

    #[test]
    fn binary_add_maps_to_binary_op_add() {
        let prog   = StParser::parse(BINARY_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        let AslExpr::Binary(bin) = &assign.value else { panic!("expected Binary") };
        assert!(matches!(bin.op, BinaryOp::Add), "+ deve mapear para BinaryOp::Add, op={:?}", bin.op);
    }

    #[test]
    fn compare_gte_maps_to_binary_op_gte() {
        let prog   = StParser::parse(COMPARE_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        let AslExpr::Binary(bin) = &assign.value else { panic!("expected Binary") };
        assert!(matches!(bin.op, BinaryOp::Gte), ">= deve mapear para BinaryOp::Gte, op={:?}", bin.op);
    }

    #[test]
    fn not_maps_to_unary_op_not() {
        let prog   = StParser::parse(NOT_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        let AslExpr::Unary(u) = &assign.value else {
            panic!("NOT Enable deve produzir AslExpr::Unary, obtido: {:?}", assign.value)
        };
        assert!(matches!(u.op, UnaryOp::Not));
    }

    #[test]
    fn and_maps_to_binary_op_and() {
        let prog   = StParser::parse(AND_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        let AslExpr::Binary(bin) = &assign.value else { panic!("expected Binary") };
        assert!(matches!(bin.op, BinaryOp::And), "AND deve mapear para BinaryOp::And, op={:?}", bin.op);
    }

    #[test]
    fn var_names_are_clean() {
        // Garante que nomes de variáveis não contêm Simple("...") ou outros wrappers
        let prog   = StParser::parse(BINARY_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert_eq!(assign.target, "C", "target deve ser 'C', obtido: {:?}", assign.target);
        // Os operandos devem ser Var("A") e Var("B")
        if let AslExpr::Binary(bin) = &assign.value {
            if let AslExpr::Var(v) = &bin.left  { assert_eq!(v.name, "A", "left deve ser 'A'") }
            if let AslExpr::Var(v) = &bin.right { assert_eq!(v.name, "B", "right deve ser 'B'") }
        }
    }

    #[test]
    fn for_loop_lowers_to_while() {
        let prog = StParser::parse(FOR_LOOP).expect("parse");
        let func = &prog.functions[0];
        let has_assign = func.body.iter().any(|s| matches!(s, AslStatement::Assign(_)));
        let has_while  = func.body.iter().any(|s| matches!(s, AslStatement::While(_)));
        assert!(has_assign, "FOR deve emitir Assign");
        assert!(has_while,  "FOR deve emitir While");
    }

    #[test]
    fn for_loop_while_condition_is_binary_lte() {
        let prog = StParser::parse(FOR_LOOP).expect("parse");
        let w    = first_while(&prog.functions[0].body);
        let AslExpr::Binary(bin) = &w.condition else {
            panic!("condição do FOR deve ser Binary, obtido: {:?}", w.condition)
        };
        assert!(matches!(bin.op, BinaryOp::Lte), "FOR deve usar BinaryOp::Lte, op={:?}", bin.op);
    }

    #[test]
    fn empty_source_returns_err() {
        assert!(StParser::parse("").is_err());
    }

    // Diagnóstico: mantém-se para calibrar mapeamentos em regressões
    #[test]
    fn debug_bin_op_repr() {
        let prog = StParser::parse(BINARY_EXPR).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        eprintln!("[RT-4 diag] binary assign = {:?}", assign);
        let prog2 = StParser::parse(COMPARE_EXPR).expect("parse");
        let assign2 = first_assign(&prog2.functions[0].body);
        eprintln!("[RT-4 diag] compare assign = {:?}", assign2);
    }
}
