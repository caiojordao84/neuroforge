//! Parser Structured Text (IEC 61131-3) via crate `iec61131` v0.7

//!

//! RT-4: Expression lowering real.

//!

//! Confirmado via diag:

//!   Variable Debug = Simple("X")      extrair entre '("' e '")'.

//!   BinaryOp::Add / Gte mapeiam correctamente via Debug string.

#![allow(unused_imports)]

use crate::types::asl_types::{
    AslAssign, AslBinary, AslCall, AslDoWhile, AslDuration, AslElseIf, AslExpr, AslExpressionStmt,
    AslFbField, AslFor, AslForRange, AslFunction, AslFunctionBlock, AslIf, AslLiteral, AslMetadata,
    AslParam, AslProgram, AslReturn, AslStatement, AslSwitch, AslSwitchCase, AslTask, AslType,
    AslUnary, AslWhile, BinaryOp, UnaryOp,
};

use crate::parser::neuro_parser::{
    normalize, DiagnosticSeverity, NeuroParser, NeuroParserExt, ParseDiagnostic, ParseError,
};

use iec61131::{
    Argument, Expression, Parser as IecParser, PouDeclaration, Statement, StatementList, TypeSpec,
    VarDecl, Variable,
};

pub struct StParser;

impl NeuroParser for StParser {
    type Error = ParseError;

    fn parse(source: &str) -> std::result::Result<AslProgram, Self::Error> {
        if source.trim().is_empty() {
            return Err(ParseError::Custom("iec61131: source vazia".to_string()));
        }

        let mut parser = IecParser::new(source);

        let cu = parser
            .parse()
            .map_err(|e| ParseError::Custom(format!("iec61131: {}", e)))?;

        let mut visitor = StVisitor;

        let program = visitor.visit_declarations(cu.declarations);

        // Valida    o sem  ntica v1.2.3 (R7/semver)

        if let Err(diags) = Self::validate_semantics(&program) {
            if diags
                .iter()
                .any(|d| d.severity == DiagnosticSeverity::Error)
            {
                return Err(ParseError::Multiple(
                    diags
                        .iter()
                        .map(|d| d.to_string())
                        .collect::<Vec<_>>()
                        .join("\n"),
                ));
            }
        }

        Ok(program)
    }

    fn source_language() -> &'static str {
        "st"
    }
}

impl NeuroParserExt for StParser {}

struct StVisitor;

impl StVisitor {
    fn visit_declarations(&mut self, decls: Vec<PouDeclaration>) -> AslProgram {
        let mut functions = vec![];

        let mut function_blocks = vec![];

        let mut tasks = vec![];

        for decl in decls {
            match decl {
                PouDeclaration::Program(prog) => {
                    // ST Program maps to a Task (loop) or Function

                    let body = self.visit_stmts(prog.body);

                    tasks.push(AslTask {
                        name: prog.name,

                        is_async: false,

                        priority: None,

                        stack_size: None,

                        params: vec![],

                        return_type: "void".into(),

                        body,
                        ..Default::default()
                    });
                }

                PouDeclaration::FunctionBlock(fb) => function_blocks.push(self.visit_fb_direct(fb)),

                PouDeclaration::Function(func) => functions.push(self.visit_function(func)),

                _ => {}
            }
        }

        // R7 Enforcement: Ensure setup and loop exist

        if !tasks.iter().any(|t| t.name == "setup") {
            tasks.push(AslTask {
                name: "setup".into(),
                body: vec![],
                ..Default::default()
            });
        }

        // If there's no loop task but we have programs, rename the first one to loop or wrap

        if !tasks.iter().any(|t| t.name == "loop") {
            if let Some(first_task) = tasks.iter_mut().find(|t| t.name != "setup") {
                first_task.name = "loop".into();
            } else {
                tasks.push(AslTask {
                    name: "loop".into(),
                    body: vec![],
                    ..Default::default()
                });
            }
        }

        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {
                name: None,
                description: None,
                version: None,

                target_board: Some("plc".to_string()),
            },

            structs: vec![],

            globals: vec![],

            functions,

            function_blocks,

            tasks,

            ..Default::default()
        }
    }

    fn visit_fb_direct(&mut self, fb: iec61131::FunctionBlockDecl) -> AslFunctionBlock {
        let body = self.visit_stmts(fb.body.unwrap_or_default());

        AslFunctionBlock {
            name: fb.name,

            doc: None,

            inputs: Self::vars_to_fb_fields(&fb.inputs),

            outputs: Self::vars_to_fb_fields(&fb.outputs),

            internals: Self::vars_to_fb_fields(&fb.vars),

            body,
        }
    }

    fn vars_to_fb_fields(vars: &[VarDecl]) -> Vec<AslFbField> {
        vars.iter()
            .map(|v| AslFbField {
                name: v.name.clone(),

                r#type: Self::map_type(&v.var_type).as_str().to_string(),

                mutable: Some(true),
            })
            .collect()
    }

    fn map_type(spec: &TypeSpec) -> AslType {
        let dbg = format!("{:?}", spec).to_uppercase();

        AslType::from_str(&dbg)
    }

    fn vars_to_params(vars: &[VarDecl]) -> Vec<AslParam> {
        vars.iter()
            .map(|v| AslParam {
                name: v.name.clone(),

                r#type: format!("{:?}", v.var_type),

                default: None,
            })
            .collect()
    }

    fn visit_program(&mut self, prog: iec61131::ProgramDecl) -> AslFunction {
        let params = Self::vars_to_params(&prog.vars);

        let body = self.visit_stmts(prog.body);

        AslFunction {
            name: prog.name,
            return_type: None,
            params,
            body,
            doc: None,
            ..Default::default()
        }
    }

    fn visit_fb(&mut self, fb: iec61131::FunctionBlockDecl) -> AslFunction {
        let body = self.visit_stmts(fb.body.unwrap_or_default());

        AslFunction {
            name: fb.name,
            return_type: None,
            params: vec![],
            body,
            doc: None,
            ..Default::default()
        }
    }

    fn visit_function(&mut self, func: iec61131::FunctionDecl) -> AslFunction {
        let mut params = vec![];

        params.extend(Self::vars_to_params(&func.inputs));

        params.extend(Self::vars_to_params(&func.outputs));

        params.extend(Self::vars_to_params(&func.in_outs));

        let body = self.visit_stmts(func.body);

        let return_type = func.return_type.map(|ts| Self::map_type(&ts));

        AslFunction {
            name: func.name,
            return_type,
            params,
            body,
            doc: None,
            ..Default::default()
        }
    }

    fn visit_stmts(&mut self, stmts: StatementList) -> Vec<AslStatement> {
        stmts.into_iter().flat_map(|s| self.visit_stmt(s)).collect()
    }

    //        Variable name extraction

    //

    // Confirmado via diag: Variable Debug = Simple("X")

    // Extractors, por ordem de prioridade:

    //   1. Simple("X")          extrai entre '("' e '")'

    //   2. name: "X"            fallback para structs com campo name

    //   3. string debug raw     fallback final, nunca panic

    fn var_debug_name(v: &Variable) -> String {
        let dbg = format!("{:?}", v);

        Self::extract_var_name(&dbg)
    }

    fn extract_var_name(dbg: &str) -> String {
        // Padr  o 1: Simple("X") ou Qualified("X") ou qualquer Variant("X")

        // Procura '("' seguido de conte  do at   '")'

        if let Some(start) = dbg.find("(\"") {
            let rest = &dbg[start + 2..];

            if let Some(end) = rest.find("\")") {
                return rest[..end].to_string();
            }
        }

        // Padr  o 2: name: "X"

        if let Some(start) = dbg.find("name: \"") {
            let rest = &dbg[start + 7..];

            if let Some(end) = rest.find('"') {
                return rest[..end].to_string();
            }
        }

        // Fallback: debug completo

        dbg.to_string()
    }

    //        BinaryOp / UnaryOp mapping via Debug string

    fn map_bin_op_str(op_dbg: &str) -> BinaryOp {
        let s = op_dbg.trim().to_lowercase();

        match s.as_str() {
            "add" => BinaryOp::Add,

            "sub" | "subtract" | "minus" => BinaryOp::Sub,

            "mul" | "multiply" | "times" => BinaryOp::Mul,

            "div" | "divide" | "divides" => BinaryOp::Div,

            "mod" | "modulo" | "rem" | "remainder" => BinaryOp::Mod,

            "eq" | "equal" | "equals" => BinaryOp::Eq,

            "ne" | "neq" | "notequal" | "not_equal" | "noteq" | "unequal" => BinaryOp::Neq,

            "lt" | "lessthan" | "less_than" => BinaryOp::Lt,

            "le" | "lte" | "lessorequal" | "less_or_equal" | "lessequal" => BinaryOp::Lte,

            "gt" | "greaterthan" | "greater_than" => BinaryOp::Gt,

            "ge" | "gte" | "greaterorequal" | "greater_or_equal" | "greaterequal" => BinaryOp::Gte,

            "and" => BinaryOp::And,

            "or" => BinaryOp::Or,

            "xor" => BinaryOp::BitXor,

            "power" | "pow" | "exponent" | "exp" => BinaryOp::Mul,

            _ => BinaryOp::Add,
        }
    }

    fn map_un_op_str(op_dbg: &str) -> UnaryOp {
        let s = op_dbg.trim().to_lowercase();

        match s.as_str() {
            "not" => UnaryOp::Not,

            "neg" | "negate" | "minus" => UnaryOp::Neg,

            _ => UnaryOp::Not,
        }
    }

    //        Expression lowering

    fn lower_expr(expr: Expression) -> AslExpr {
        match expr {
            Expression::Variable(v) => AslExpr::var(&Self::var_debug_name(&v)),

            Expression::Binary { op, left, right } => {
                let op_str = format!("{:?}", op);

                AslExpr::Binary(Box::new(AslBinary {
                    op: Self::map_bin_op_str(&op_str),

                    left: Self::lower_expr(*left),

                    right: Self::lower_expr(*right),
                }))
            }

            Expression::Unary { op, operand } => {
                let op_str = format!("{:?}", op);

                AslExpr::Unary(Box::new(AslUnary {
                    op: Self::map_un_op_str(&op_str),

                    expr: Self::lower_expr(*operand),
                }))
            }

            Expression::Literal(l) => {
                let raw_dbg = format!("{:?}", l);

                // R4 Normalization: bool_like (agora retorna bool JSON real)

                if let Some(normalized) = normalize::bool_like(&raw_dbg) {
                    return normalized;
                }

                // Extra    o de valor num  rico: as variantes s  o Literal::Integer(i), Literal::Float(f), etc.

                let val_str = if let Some(start) = raw_dbg.find('(') {
                    let rest = &raw_dbg[start + 1..];

                    if let Some(end) = rest.rfind(')') {
                        rest[..end].to_string()
                    } else {
                        raw_dbg.clone()
                    }
                } else {
                    raw_dbg.clone()
                };

                let jv = if let Ok(i) = val_str.parse::<i64>() {
                    serde_json::json!(i)
                } else if let Ok(f) = val_str.parse::<f64>() {
                    serde_json::json!(f)
                } else if let Ok(b) = val_str.parse::<bool>() {
                    serde_json::json!(b)
                } else {
                    serde_json::json!(val_str)
                };

                AslExpr::Literal(AslLiteral {
                    value: jv,
                    ..Default::default()
                })
            }

            other => AslExpr::var(&format!("{:?}", other)),
        }
    }

    fn lower_argument(arg: Argument) -> AslExpr {
        match arg {
            Argument::Positional(e) => Self::lower_expr(e),

            Argument::Named { value, .. } => Self::lower_expr(value),

            Argument::Output { variable, .. } => AslExpr::var(&Self::var_debug_name(&variable)),
        }
    }

    fn var_str(v: &Variable) -> String {
        Self::var_debug_name(v)
    }

    fn visit_stmt(&mut self, stmt: Statement) -> Vec<AslStatement> {
        match stmt {
            Statement::Assignment { target, value, .. } => {
                vec![AslStatement::Assign(AslAssign {
                    target: Self::var_str(&target),

                    value: Self::lower_expr(value),
                })]
            }

            Statement::If {
                condition,
                then_body,
                elsif_parts,
                else_body,
                ..
            } => {
                let cond_expr = Self::lower_expr(condition);

                let then_body = self.visit_stmts(then_body);

                let else_if: Vec<AslElseIf> = elsif_parts
                    .into_iter()
                    .map(|(cond, body)| AslElseIf {
                        condition: Self::lower_expr(cond),

                        body: self.visit_stmts(body),
                    })
                    .collect();

                let else_body = else_body.map(|eb| self.visit_stmts(eb));

                vec![AslStatement::If(Box::new(AslIf {
                    condition: cond_expr,

                    then_body: then_body,

                    else_if,

                    else_body,
                    ..Default::default()
                }))]
            }

            Statement::For {
                control_var,
                start,
                end,
                step,
                body,
                ..
            } => {
                let start_expr = Self::lower_expr(start);

                let end_expr = Self::lower_expr(end);

                let step_expr = step
                    .map(Self::lower_expr)
                    .unwrap_or_else(|| AslExpr::int(1));

                //   8.4     for range. ST uses 'TO' (inclusive).

                // Use normalize::st_for_to_exclusive to increment end_expr if it's a literal.

                let to_exclusive = normalize::st_for_to_exclusive(&end_expr).unwrap_or_else(|| {
                    // Fallback fallback: Binary(end + 1) if not literal

                    AslExpr::Binary(Box::new(AslBinary {
                        op: BinaryOp::Add,

                        left: end_expr,

                        right: AslExpr::int(1),
                    }))
                });

                let body_stmts = self.visit_stmts(body);

                vec![AslStatement::For(Box::new(AslFor::Range(AslForRange {
                    var: control_var,

                    from: start_expr,

                    to: to_exclusive,

                    step: step_expr,

                    body: body_stmts,
                })))]
            }

            Statement::While {
                condition, body, ..
            } => {
                let body_stmts = self.visit_stmts(body);

                vec![AslStatement::While(Box::new(AslWhile {
                    condition: Self::lower_expr(condition),

                    body: body_stmts,
                }))]
            }

            Statement::Repeat {
                body, condition, ..
            } => {
                let body_stmts = self.visit_stmts(body);

                vec![AslStatement::DoWhile(Box::new(AslDoWhile {
                    condition: Self::lower_expr(condition),

                    body: body_stmts,
                }))]
            }

            Statement::Case {
                selector,
                cases,
                else_body,
                ..
            } => {
                let discriminant = Self::lower_expr(selector);

                let mut case_list: Vec<AslSwitchCase> = cases
                    .into_iter()
                    .map(|ci| {
                        let body_stmts = self.visit_stmts(ci.body);

                        let test = ci
                            .selectors
                            .first()
                            .map(|v| AslExpr::var(&format!("{:?}", v)));

                        AslSwitchCase {
                            test,
                            body: body_stmts,
                        }
                    })
                    .collect();

                if let Some(eb) = else_body {
                    let eb_stmts = self.visit_stmts(eb);

                    case_list.push(AslSwitchCase {
                        test: None,
                        body: eb_stmts,
                    });
                }

                vec![AslStatement::Switch(Box::new(AslSwitch {
                    discriminant,
                    cases: case_list,
                }))]
            }

            Statement::Return { .. } => vec![AslStatement::Return(AslReturn { value: None })],

            Statement::Exit { .. } => vec![AslStatement::Break],

            Statement::FunctionCall {
                name, arguments, ..
            } => {
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

    // Helpers: encontra o primeiro Assign/For no body (independente do   ndice)

    fn first_assign(body: &[AslStatement]) -> &AslAssign {
        body.iter()
            .find_map(|s| {
                if let AslStatement::Assign(a) = s {
                    Some(a)
                } else {
                    None
                }
            })
            .expect("esperado pelo menos um Assign no body")
    }

    fn first_for_range(body: &[AslStatement]) -> &crate::types::asl_types::AslForRange {
        body.iter()
            .find_map(|s| {
                if let AslStatement::For(f) = s {
                    if let crate::types::asl_types::AslFor::Range(r) = f.as_ref() {
                        Some(r)
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .expect("esperado pelo menos um For Range no body")
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

        assert!(!prog.tasks.is_empty());

        assert!(prog
            .tasks
            .iter()
            .any(|t| t.name == "Main" || t.name == "loop"));
    }

    #[test]

    fn assignment_value_is_not_debug_string() {
        let prog = StParser::parse(BINARY_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        assert_eq!(assign.target, "C");

        assert!(
            matches!(&assign.value, AslExpr::Binary(_)),
            "C := A + B deve produzir AslExpr::Binary, obtido: {:?}",
            assign.value
        );
    }

    #[test]

    fn binary_add_maps_to_binary_op_add() {
        let prog = StParser::parse(BINARY_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(
            matches!(bin.op, BinaryOp::Add),
            "+ deve mapear para BinaryOp::Add, op={:?}",
            bin.op
        );
    }

    #[test]

    fn compare_gte_maps_to_binary_op_gte() {
        let prog = StParser::parse(COMPARE_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(
            matches!(bin.op, BinaryOp::Gte),
            ">= deve mapear para BinaryOp::Gte, op={:?}",
            bin.op
        );
    }

    #[test]

    fn not_maps_to_unary_op_not() {
        let prog = StParser::parse(NOT_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        let AslExpr::Unary(u) = &assign.value else {
            panic!(
                "NOT Enable deve produzir AslExpr::Unary, obtido: {:?}",
                assign.value
            )
        };

        assert!(matches!(u.op, UnaryOp::Not));
    }

    #[test]

    fn and_maps_to_binary_op_and() {
        let prog = StParser::parse(AND_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(
            matches!(bin.op, BinaryOp::And),
            "AND deve mapear para BinaryOp::And, op={:?}",
            bin.op
        );
    }

    #[test]

    fn var_names_are_clean() {
        // Garante que nomes de vari  veis n  o cont  m Simple("...") ou outros wrappers

        let prog = StParser::parse(BINARY_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        assert_eq!(
            assign.target, "C",
            "target deve ser 'C', obtido: {:?}",
            assign.target
        );

        // Os operandos devem ser Var("A") e Var("B")

        if let AslExpr::Binary(bin) = &assign.value {
            if let AslExpr::Var(v) = &bin.left {
                assert_eq!(v.name, "A", "left deve ser 'A'")
            }

            if let AslExpr::Var(v) = &bin.right {
                assert_eq!(v.name, "B", "right deve ser 'B'")
            }
        }
    }

    #[test]

    fn for_loop_emits_range_with_exclusive_to() {
        let prog = StParser::parse(FOR_LOOP).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let r = first_for_range(&task.body);

        assert_eq!(r.var, "i");

        //   8.4     TO 9 deve tornar-se literal 10 (exclusivo)

        if let AslExpr::Literal(lit) = &r.to {
            assert_eq!(
                lit.value,
                serde_json::json!(10),
                "TO 9 deve ser normalizado para 10 exclusivo"
            );
        } else {
            panic!("to deve ser um literal 10, obtido: {:?}", r.to);
        }
    }

    #[test]

    fn empty_source_returns_err() {
        assert!(StParser::parse("").is_err());
    }

    // Diagn  stico: mant  m-se para calibrar mapeamentos em regress  es

    #[test]

    fn debug_bin_op_repr() {
        let prog = StParser::parse(BINARY_EXPR).expect("parse");

        let task = prog
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign = first_assign(&task.body);

        eprintln!("[RT-4 diag] binary assign = {:?}", assign);

        let prog2 = StParser::parse(COMPARE_EXPR).expect("parse");

        let task2 = prog2
            .tasks
            .iter()
            .find(|t| t.name != "setup")
            .expect("task de loop");

        let assign2 = first_assign(&task2.body);

        eprintln!("[RT-4 diag] compare assign = {:?}", assign2);
    }
}
