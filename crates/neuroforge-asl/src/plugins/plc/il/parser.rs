//! IL Parser     converte IL textual (IEC 61131-3   3) para AslProgram.

//!

//! Modelo de execu    o IL: acumulador + pilha para par  nteses.

//! AND/OR s  o tratados como BinaryOp estruturado     nunca string crua.

use pest::Parser;

use pest_derive::Parser;

use crate::asl_types::{
    AslAssign, AslBinary, AslExpr, AslExpressionStmt, AslFunction, AslMetadata, AslParam,
    AslProgram, AslReturn, AslStatement, AslUnary, BinaryOp, UnaryOp,
};

#[derive(Parser)]
#[grammar = "plugins/plc/il/grammar.pest"]
struct IlPestParser;

#[derive(Debug, thiserror::Error)]

pub enum IlParseError {
    #[error("IL parse error: {0}")]
    ParseError(String),

    #[error("IL source vazia")]
    EmptySource,
}

#[derive(Debug, Clone)]

enum IlOp {
    Ld {
        operand: String,
        negated: bool,
    },

    St {
        operand: String,
        negated: bool,
    },

    /// AND obrigatoriamente tipado como BinaryOp::And     nunca string.
    And {
        operand: String,
        negated: bool,
    },

    /// OR obrigatoriamente tipado como BinaryOp::Or     nunca string.
    Or {
        operand: String,
        negated: bool,
    },

    Xor {
        operand: String,
        negated: bool,
    },

    Add(String),
    Sub(String),
    Mul(String),
    Div(String),

    Cmp {
        kind: CmpKind,
        operand: String,
    },

    // _label e _cond prefixados: guardados para uso futuro (JMP resolution RT-9)
    Jmp {
        _label: String,
        _cond: JmpCond,
    },

    Cal {
        name: String,
        cond: JmpCond,
    },

    Ret {
        cond: JmpCond,
    },

    Set {
        operand: String,
    },

    Rst {
        operand: String,
    },

    Push,

    Pop,
}

#[derive(Debug, Clone, PartialEq)]

enum CmpKind {
    Gt,
    Ge,
    Eq,
    Ne,
    Le,
    Lt,
}

#[derive(Debug, Clone, PartialEq)]

enum JmpCond {
    Unconditional,
    IfTrue,
    IfFalse,
}

#[derive(Debug, Clone)]

struct IlInst {
    // _label prefixado: guardado para futura resolu    o de JMP targets (RT-9)
    _label: Option<String>,

    op: IlOp,
}

pub struct IlParser;

impl IlParser {
    pub fn parse(source: &str) -> Result<AslProgram, IlParseError> {
        if source.trim().is_empty() {
            return Err(IlParseError::EmptySource);
        }

        let pairs = IlPestParser::parse(Rule::file, source)
            .map_err(|e| IlParseError::ParseError(e.to_string()))?;

        let mut functions = vec![];

        for pair in pairs {
            if pair.as_rule() == Rule::pou {
                functions.push(Self::lower_pou(pair));
            }
        }

        Ok(AslProgram {
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

            tasks: vec![],

            ..Default::default()
        })
    }

    fn lower_pou(pair: pest::iterators::Pair<Rule>) -> AslFunction {
        let mut inner = pair.into_inner();

        let _pou_type = inner.next();

        let name = inner
            .next()
            .map(|p| p.as_str().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let mut params: Vec<AslParam> = vec![];

        let mut raw_insts: Vec<IlInst> = vec![];

        for p in inner {
            match p.as_rule() {
                Rule::var_block => params.extend(Self::parse_var_block(p)),

                Rule::instruction => {
                    if let Some(inst) = Self::parse_instruction(p) {
                        raw_insts.push(inst);
                    }
                }

                Rule::paren_open => raw_insts.push(IlInst {
                    _label: None,
                    op: IlOp::Push,
                }),

                Rule::paren_close => raw_insts.push(IlInst {
                    _label: None,
                    op: IlOp::Pop,
                }),

                Rule::pou_end | Rule::pou_type | Rule::return_type => {}

                _ => {}
            }
        }

        let body = Self::lower_instructions(&raw_insts);

        AslFunction {
            name,
            return_type: None,
            params,
            body,
            ..Default::default()
        }
    }

    fn parse_var_block(pair: pest::iterators::Pair<Rule>) -> Vec<AslParam> {
        let mut params = vec![];

        for p in pair.into_inner() {
            if p.as_rule() == Rule::var_decl {
                let mut inner = p.into_inner();

                let name = inner
                    .next()
                    .map(|p| p.as_str().to_string())
                    .unwrap_or_default();

                let typ = inner
                    .next()
                    .map(|p| p.as_str().to_string())
                    .unwrap_or_else(|| "BOOL".to_string());

                params.push(AslParam {
                    name,
                    r#type: typ,
                    ..Default::default()
                });
            }
        }

        params
    }

    fn parse_instruction(pair: pest::iterators::Pair<Rule>) -> Option<IlInst> {
        let mut label = None;

        let mut op_str = String::new();

        let mut operand_str = String::new();

        for p in pair.into_inner() {
            match p.as_rule() {
                Rule::label => {
                    label = p.into_inner().next().map(|q| q.as_str().to_string());
                }

                Rule::op => op_str = p.as_str().to_ascii_uppercase(),

                Rule::operand => operand_str = p.as_str().to_string(),

                _ => {}
            }
        }

        let op = Self::build_op(&op_str, operand_str)?;

        Some(IlInst { _label: label, op })
    }

    fn build_op(op: &str, o: String) -> Option<IlOp> {
        Some(match op {
            "LD" => IlOp::Ld {
                operand: o,
                negated: false,
            },

            "LDN" => IlOp::Ld {
                operand: o,
                negated: true,
            },

            "ST" => IlOp::St {
                operand: o,
                negated: false,
            },

            "STN" => IlOp::St {
                operand: o,
                negated: true,
            },

            "AND" => IlOp::And {
                operand: o,
                negated: false,
            },

            "ANDN" => IlOp::And {
                operand: o,
                negated: true,
            },

            "OR" => IlOp::Or {
                operand: o,
                negated: false,
            },

            "ORN" => IlOp::Or {
                operand: o,
                negated: true,
            },

            "XOR" => IlOp::Xor {
                operand: o,
                negated: false,
            },

            "XORN" => IlOp::Xor {
                operand: o,
                negated: true,
            },

            "ADD" => IlOp::Add(o),

            "SUB" => IlOp::Sub(o),

            "MUL" => IlOp::Mul(o),

            "DIV" => IlOp::Div(o),

            "GT" => IlOp::Cmp {
                kind: CmpKind::Gt,
                operand: o,
            },

            "GE" => IlOp::Cmp {
                kind: CmpKind::Ge,
                operand: o,
            },

            "EQ" => IlOp::Cmp {
                kind: CmpKind::Eq,
                operand: o,
            },

            "NE" => IlOp::Cmp {
                kind: CmpKind::Ne,
                operand: o,
            },

            "LE" => IlOp::Cmp {
                kind: CmpKind::Le,
                operand: o,
            },

            "LT" => IlOp::Cmp {
                kind: CmpKind::Lt,
                operand: o,
            },

            "JMP" => IlOp::Jmp {
                _label: o,
                _cond: JmpCond::Unconditional,
            },

            "JMPC" => IlOp::Jmp {
                _label: o,
                _cond: JmpCond::IfTrue,
            },

            "JMPCN" => IlOp::Jmp {
                _label: o,
                _cond: JmpCond::IfFalse,
            },

            "CAL" => IlOp::Cal {
                name: o,
                cond: JmpCond::Unconditional,
            },

            "CALC" => IlOp::Cal {
                name: o,
                cond: JmpCond::IfTrue,
            },

            "CALCN" => IlOp::Cal {
                name: o,
                cond: JmpCond::IfFalse,
            },

            "RET" => IlOp::Ret {
                cond: JmpCond::Unconditional,
            },

            "RETC" => IlOp::Ret {
                cond: JmpCond::IfTrue,
            },

            "RETCN" => IlOp::Ret {
                cond: JmpCond::IfFalse,
            },

            "S" => IlOp::Set { operand: o },

            "R" => IlOp::Rst { operand: o },

            _ => return None,
        })
    }

    fn lower_instructions(insts: &[IlInst]) -> Vec<AslStatement> {
        let mut stmts: Vec<AslStatement> = vec![];

        let mut acc: Option<AslExpr> = None;

        let mut stack: Vec<(Option<AslExpr>, BinaryOp)> = vec![];

        for inst in insts {
            match &inst.op {
                IlOp::Ld { operand, negated } => {
                    let base = AslExpr::var(operand);

                    acc = Some(if *negated { Self::negate(base) } else { base });
                }

                IlOp::St { operand, negated } => {
                    if let Some(val) = acc.clone() {
                        let rhs = if *negated { Self::negate(val) } else { val };

                        stmts.push(AslStatement::Assign(AslAssign {
                            target: operand.clone(),

                            value: rhs,
                        }));
                    }
                }

                IlOp::Set { operand } => {
                    if let Some(val) = acc.clone() {
                        stmts.push(AslStatement::Assign(AslAssign {
                            target: operand.clone(),

                            value: val,
                        }));
                    }
                }

                IlOp::Rst { operand } => {
                    if let Some(val) = acc.clone() {
                        stmts.push(AslStatement::Assign(AslAssign {
                            target: operand.clone(),

                            value: Self::negate(val),
                        }));
                    }
                }

                IlOp::And { operand, negated } => {
                    let rhs = Self::maybe_negate(AslExpr::var(operand), *negated);

                    acc = Some(Self::combine(acc, BinaryOp::And, rhs));
                }

                IlOp::Or { operand, negated } => {
                    let rhs = Self::maybe_negate(AslExpr::var(operand), *negated);

                    acc = Some(Self::combine(acc, BinaryOp::Or, rhs));
                }

                IlOp::Xor { operand, negated } => {
                    let rhs = Self::maybe_negate(AslExpr::var(operand), *negated);

                    acc = Some(Self::combine(acc, BinaryOp::BitXor, rhs));
                }

                IlOp::Add(o) => acc = Some(Self::combine(acc, BinaryOp::Add, AslExpr::var(o))),

                IlOp::Sub(o) => acc = Some(Self::combine(acc, BinaryOp::Sub, AslExpr::var(o))),

                IlOp::Mul(o) => acc = Some(Self::combine(acc, BinaryOp::Mul, AslExpr::var(o))),

                IlOp::Div(o) => acc = Some(Self::combine(acc, BinaryOp::Div, AslExpr::var(o))),

                IlOp::Cmp { kind, operand } => {
                    let op = match kind {
                        CmpKind::Gt => BinaryOp::Gt,
                        CmpKind::Ge => BinaryOp::Gte,

                        CmpKind::Eq => BinaryOp::Eq,
                        CmpKind::Ne => BinaryOp::Neq,

                        CmpKind::Le => BinaryOp::Lte,
                        CmpKind::Lt => BinaryOp::Lt,
                    };

                    acc = Some(Self::combine(acc, op, AslExpr::var(operand)));
                }

                IlOp::Push => {
                    stack.push((acc.take(), BinaryOp::And));
                }

                IlOp::Pop => {
                    if let Some((saved_acc, pending_op)) = stack.pop() {
                        let inner_val = acc.take();

                        if let (Some(outer), Some(inner)) = (saved_acc, inner_val) {
                            acc = Some(Self::combine(Some(outer), pending_op, inner));
                        }
                    }
                }

                IlOp::Ret { cond } => match cond {
                    JmpCond::Unconditional => {
                        stmts.push(AslStatement::Return(AslReturn { value: acc.clone() }));
                    }

                    JmpCond::IfTrue | JmpCond::IfFalse => {
                        if let Some(cond_expr) = acc.clone() {
                            let cond_final = if *cond == JmpCond::IfFalse {
                                Self::negate(cond_expr)
                            } else {
                                cond_expr
                            };

                            stmts.push(AslStatement::If(Box::new(crate::asl_types::AslIf {
                                condition: cond_final,

                                then_body: vec![AslStatement::Return(AslReturn {
                                    value: None,
                                    ..Default::default()
                                })],

                                else_if: vec![],

                                else_body: None,
                            })));
                        }
                    }
                },

                IlOp::Cal { name, cond } => {
                    let call_expr = AslExpr::Call(Box::new(crate::asl_types::AslCall {
                        callee: name.clone(),
                        args: vec![],
                    }));

                    let stmt = AslStatement::Expr(AslExpressionStmt { expr: call_expr });

                    match cond {
                        JmpCond::Unconditional => stmts.push(stmt),

                        JmpCond::IfTrue | JmpCond::IfFalse => {
                            if let Some(cond_expr) = acc.clone() {
                                let cond_final = if *cond == JmpCond::IfFalse {
                                    Self::negate(cond_expr)
                                } else {
                                    cond_expr
                                };

                                stmts.push(AslStatement::If(Box::new(crate::asl_types::AslIf {
                                    condition: cond_final,

                                    then_body: vec![stmt],

                                    else_if: vec![],

                                    else_body: None,
                                })));
                            }
                        }
                    }
                }

                // JMP: guardado com _     sem representa    o ASL nesta fase
                IlOp::Jmp { .. } => {}
            }
        }

        stmts
    }

    fn combine(acc: Option<AslExpr>, op: BinaryOp, rhs: AslExpr) -> AslExpr {
        match acc {
            None => rhs,

            Some(lhs) => AslExpr::Binary(Box::new(AslBinary {
                op,
                left: lhs,
                right: rhs,
            })),
        }
    }

    fn negate(expr: AslExpr) -> AslExpr {
        AslExpr::Unary(Box::new(AslUnary {
            op: UnaryOp::Not,
            expr,
        }))
    }

    fn maybe_negate(expr: AslExpr, negated: bool) -> AslExpr {
        if negated {
            Self::negate(expr)
        } else {
            expr
        }
    }
}

#[cfg(test)]

mod tests {

    use super::*;

    use crate::asl_types::{AslExpr, AslStatement, BinaryOp};

    const SIMPLE_PROGRAM: &str = r#"

PROGRAM Main

  VAR

    Start : BOOL;

    Stop  : BOOL;

    Motor : BOOL;

  END_VAR

  LD    Start

  ANDN  Stop

  ST    Motor

END_PROGRAM

"#;

    const AND_OR_PROGRAM: &str = r#"

PROGRAM LogicTest

  VAR

    A : BOOL;

    B : BOOL;

    C : BOOL;

    Out1 : BOOL;

    Out2 : BOOL;

  END_VAR

  LD   A

  AND  B

  ST   Out1

  LD   A

  OR   C

  ST   Out2

END_PROGRAM

"#;

    const TIMER_PROGRAM: &str = r#"

PROGRAM TimerTest

  VAR

    Enable  : BOOL;

    TimerQ  : BOOL;

    Counter : INT;

  END_VAR

  LD    Enable

  ST    TimerQ

END_PROGRAM

"#;

    #[test]

    fn parse_simple_program() {
        let prog = IlParser::parse(SIMPLE_PROGRAM).unwrap();

        assert_eq!(prog.functions.len(), 1);

        let func = &prog.functions[0];

        assert_eq!(func.name, "Main");

        assert_eq!(func.params.len(), 3);

        assert_eq!(func.body.len(), 1);
    }

    #[test]

    fn parse_and_produces_binary_and() {
        let prog = IlParser::parse(AND_OR_PROGRAM).unwrap();

        let func = &prog.functions[0];

        let AslStatement::Assign(assign) = &func.body[0] else {
            panic!("expected Assign")
        };

        assert_eq!(assign.target, "Out1");

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(
            matches!(bin.op, BinaryOp::And),
            "AND deve produzir BinaryOp::And, n  o string"
        );
    }

    #[test]

    fn parse_or_produces_binary_or() {
        let prog = IlParser::parse(AND_OR_PROGRAM).unwrap();

        let func = &prog.functions[0];

        let AslStatement::Assign(assign) = &func.body[1] else {
            panic!("expected Assign")
        };

        assert_eq!(assign.target, "Out2");

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(
            matches!(bin.op, BinaryOp::Or),
            "OR deve produzir BinaryOp::Or, n  o string"
        );
    }

    #[test]

    fn parse_andn_negates_operand() {
        let prog = IlParser::parse(SIMPLE_PROGRAM).unwrap();

        let func = &prog.functions[0];

        let AslStatement::Assign(assign) = &func.body[0] else {
            panic!("expected Assign")
        };

        let AslExpr::Binary(bin) = &assign.value else {
            panic!("expected Binary")
        };

        assert!(matches!(bin.op, BinaryOp::And));

        assert!(
            matches!(&bin.right, AslExpr::Unary(_)),
            "ANDN deve negar o operando direito"
        );
    }

    #[test]

    fn parse_empty_source_returns_err() {
        assert!(IlParser::parse("").is_err());

        assert!(IlParser::parse("   \n  ").is_err());
    }

    #[test]

    fn parse_timer_program() {
        let prog = IlParser::parse(TIMER_PROGRAM).unwrap();

        assert_eq!(prog.functions[0].name, "TimerTest");

        assert_eq!(prog.functions[0].params.len(), 3);
    }

    #[test]

    fn metadata_target_is_plc() {
        let prog = IlParser::parse(SIMPLE_PROGRAM).unwrap();

        assert_eq!(prog.metadata.target_board.as_deref(), Some("plc"));
    }
}
