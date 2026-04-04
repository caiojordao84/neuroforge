//! SFC Parser     PLCopen XML     AslProgram (AslStatement::StateMachine).

//!

//! RT-7: steps, transi    es, actions, condi    es inline ST parseadas via `iec61131`.

//!

//! ## Modelo de lowering

//!

//! Um body SFC    uma m  quina de estados com steps, transitions e action blocks.

//!

//! Tipos de n  s em `Body_SFC_Inline`:

//!   - `step`             estado; `.initial_step` marca o estado inicial

//!   - `transition`       aresta entre steps; `.condition` pode ser:

//!         reference (nome de vari  vel/fun    o)

//!         inline ST (texto ST bruto     parseado com `iec61131`)

//!         connectionPointIn (via FBD     tratado como opaque Var)

//!   - `action_block`     actions ligadas a steps via `.connection_point_in`

//!

//! Estrat  gia:

//!   1. Construir mapa  localId     SfcNode.

//!   2. Determinar initial_step (initialStep=="true" || primeiro step).

//!   3. Para cada step:

//!      a. Recolher action blocks cujo connectionPointIn.connection.refLocalId == step.localId

//!             converter cada action em AslStatement.

//!      b. Recolher transitions cujo connectionPointIn.connection.refLocalId == step.localId

//!             resolver condi    o     AslExpr

//!             encontrar step destino (step cujo connectionPointIn.ref == transition.localId)

//!             AslSmTransition { condition, target_step, priority }

//!   4. Emitir AslStatement::StateMachine.

//!

//! Condi    o inline ST:

//!   Envolve o texto numa FUNCTION wrapper m  nima, parseia com `iec61131::Parser`,

//!   extrai o Assignment.value do body e faz lowering para AslExpr.

//!   Usa FUNCTION (n  o PROGRAM) para evitar rejei    o de vari  veis n  o declaradas.

//!

//! Tipos PLCopen confirmados:

//!   body.sfc                : Option<Box<Body_SFC_Inline>>

//!   .step                   : Vec<SfcObjects_step_Inline>

//!       .local_id: String, .name: String, .initial_step: Option<String>

//!       .connection_point_in: Option<ConnectionPointIn>

//!   .transition             : Vec<SfcObjects_transition_Inline>

//!       .local_id: String, .priority: Option<String>

//!       .connection_point_in: Option<ConnectionPointIn>

//!       .condition: Option<SfcObjects_transition_InlineType_condition_Inline>

//!           .negated: Option<String> ("true"/"false")

//!           .reference: Option<...>     .name: String

//!           .inline: Option<...>        .st: Option<FormattedText>     .text: Option<String>

//!           .connection_point_in: Option<ConnectionPointIn>   (FBD     opaque)

//!   .action_block           : Vec<Box<CommonObjects_actionBlock_Inline>>

//!       .connection_point_in: Option<ConnectionPointIn>

//!       .action: Vec<Box<CommonObjects_actionBlock_InlineType_action_Inline>>

//!           .qualifier: Option<String>   ("N","S","R","L","D",...)

//!           .reference: Option<...>           .name: String

//!           .inline: Option<Box<Body>>        .st: Option<FormattedText>     .text

#![allow(dead_code, unused_imports)]
#![allow(clippy::doc_lazy_continuation, clippy::doc_overindented_list_items)]

use std::collections::HashMap;

use crate::types::asl_types::{
    AslAssign, AslBinary, AslCall, AslComment, AslExpr, AslExpressionStmt, AslFunction, AslLiteral,
    AslMetadata, AslProgram, AslSmStep, AslSmTransition, AslStateMachine, AslStatement, AslUnary,
    BinaryOp, UnaryOp,
};

use crate::plugins::plc::plcopen_xml::parse_project;

//           iec61131 re-exports

use iec61131::{
    Argument as StArg, BinaryOp as StBinOp, Expression as StExpr, Literal as StLit,
    Parser as StParser, PouDeclaration, Statement as StStmt, UnaryOp as StUnOp, Variable as StVar,
};

//           Error

#[derive(Debug, thiserror::Error)]

pub enum SfcParseError {
    #[error("XML error: {0}")]
    XmlError(String),

    #[error("SFC vazio")]
    Empty,
}

//           Parser p  blico

pub struct SfcParser;

impl SfcParser {
    pub fn parse(xml: &str) -> Result<AslProgram, SfcParseError> {
        if xml.trim().is_empty() {
            return Err(SfcParseError::Empty);
        }

        let project = parse_project(xml).map_err(|e| SfcParseError::XmlError(e.to_string()))?;

        let mut functions: Vec<AslFunction> = vec![];

        let Some(types) = project.types.as_ref() else {
            return Ok(empty_program());
        };

        let Some(pous) = types.pous.as_ref() else {
            return Ok(empty_program());
        };

        for pou in &pous.pou {
            let name = pou.name.as_str();

            let Some(body) = pou.body.first() else {
                continue;
            };

            let Some(sfc) = body.sfc.as_ref() else {
                continue;
            };

            let sm = Self::lower_sfc(name, sfc);

            functions.push(AslFunction {
                name: name.to_string(),

                return_type: None,

                params: vec![],

                body: vec![AslStatement::StateMachine(Box::new(sm))],
                ..Default::default()
            });
        }

        if functions.is_empty() {
            return Err(SfcParseError::Empty);
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

    //           SFC     AslStateMachine

    fn lower_sfc(pou_name: &str, sfc: &plcopen::Body_SFC_Inline) -> AslStateMachine {
        // 1. initial_step

        let initial_step = sfc
            .step
            .iter()
            .find(|s| {
                s.initial_step
                    .as_deref()
                    .unwrap_or("false")
                    .trim()
                    .eq_ignore_ascii_case("true")
            })
            .or_else(|| sfc.step.first())
            .map(|s| s.name.clone())
            .unwrap_or_else(|| "_init".to_string());

        // 2. Mapa localId     step name (reservado para uso futuro / debug)

        let _step_name_by_id: HashMap<u32, String> = sfc
            .step
            .iter()
            .map(|s| (parse_id(&s.local_id), s.name.clone()))
            .collect();

        // 3. Mapa step_local_id     Vec<transition> que partem desse step

        //    Uma transition parte de um step se step.localId     transition.connectionPointIn.connection[].refLocalId

        let mut trans_by_step: HashMap<u32, Vec<&plcopen::SfcObjects_transition_Inline>> =
            HashMap::new();

        for t in &sfc.transition {
            for src_id in collect_ref_ids(t.connection_point_in.as_ref()) {
                trans_by_step.entry(src_id).or_default().push(t);
            }
        }

        // 4. Mapa step_local_id     Vec<action_block> ligados a esse step

        let mut actions_by_step: HashMap<u32, Vec<&plcopen::CommonObjects_actionBlock_Inline>> =
            HashMap::new();

        for ab in &sfc.action_block {
            for src_id in collect_ref_ids(ab.connection_point_in.as_ref()) {
                actions_by_step.entry(src_id).or_default().push(ab);
            }
        }

        // 5. Construir steps

        let steps: Vec<AslSmStep> = sfc
            .step
            .iter()
            .map(|step| {
                let step_id = parse_id(&step.local_id);

                // 5a. Actions

                let actions: Vec<AslStatement> = actions_by_step
                    .get(&step_id)
                    .map(|abs| {
                        abs.iter()
                            .flat_map(|ab| Self::lower_action_block(ab))
                            .collect()
                    })
                    .unwrap_or_default();

                // 5b. Transitions

                let mut transitions: Vec<AslSmTransition> = trans_by_step
                    .get(&step_id)
                    .map(|ts| {
                        ts.iter()
                            .filter_map(|t| {
                                // target_step: step cujo connectionPointIn tem refLocalId == t.local_id

                                let t_id = parse_id(&t.local_id);

                                let target_step = sfc
                                    .step
                                    .iter()
                                    .find(|s| {
                                        collect_ref_ids(s.connection_point_in.as_ref())
                                            .contains(&t_id)
                                    })
                                    .map(|s| s.name.clone())?;

                                let condition = Self::lower_condition(t.condition.as_ref());

                                let priority = t
                                    .priority
                                    .as_deref()
                                    .and_then(|p| p.trim().parse::<u32>().ok());

                                Some(AslSmTransition {
                                    condition,
                                    target_step,
                                    priority,
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default();

                // Ordenar por prioridade (menor n  mero = maior prioridade)

                transitions.sort_by_key(|t| t.priority.unwrap_or(u32::MAX));

                AslSmStep {
                    name: step.name.clone(),
                    actions,
                    transitions,
                }
            })
            .collect();

        AslStateMachine {
            name: pou_name.to_string(),

            state_var: "_state".to_string(),

            initial_step,

            steps,
        }
    }

    //           Lowering de condi    o de transi    o

    fn lower_condition(
        cond: Option<&plcopen::SfcObjects_transition_InlineType_condition_Inline>,
    ) -> AslExpr {
        let Some(c) = cond else {
            return AslExpr::bool_val(true);
        };

        let expr = if let Some(ref_obj) = c.reference.as_ref() {
            AslExpr::var(&ref_obj.name)
        } else if let Some(inline) = c.inline.as_ref() {
            let st_text = inline
                .st
                .as_ref()
                .and_then(|st| st.text.as_deref())
                .unwrap_or("");

            Self::parse_st_expr(st_text.trim())
                .unwrap_or_else(|| AslExpr::var("_sfc_cond_parse_error"))
        } else if c.connection_point_in.is_some() {
            AslExpr::var("_sfc_fbd_cond")
        } else {
            AslExpr::bool_val(true)
        };

        let negated = c
            .negated
            .as_deref()
            .unwrap_or("false")
            .trim()
            .eq_ignore_ascii_case("true");

        if negated {
            AslExpr::Unary(Box::new(AslUnary {
                op: UnaryOp::Not,
                expr,
            }))
        } else {
            expr
        }
    }

    //           Parse de express  o ST isolada via iec61131

    //

    // FIX: usa wrapper FUNCTION (n  o PROGRAM) porque PROGRAM exige que todas as

    // vari  veis sejam declaradas no bloco VAR. FUNCTION aceita qualquer

    // identificador nas express  es sem declara    o pr  via.

    fn parse_st_expr(text: &str) -> Option<AslExpr> {
        if text.is_empty() {
            return None;
        }

        // Wrapper FUNCTION: n  o exige declara    o de vari  veis

        let src = format!(
            "FUNCTION _SfcCond : BOOL\n  _SfcCond := {};\nEND_FUNCTION",
            text
        );

        let mut parser = StParser::new(&src);

        let cu = parser.parse().ok()?;

        cu.declarations.into_iter().find_map(|decl| {
            if let PouDeclaration::Function(func) = decl {
                func.body.into_iter().find_map(|stmt| {
                    if let StStmt::Assignment { value, .. } = stmt {
                        Some(Self::lower_st_expr(value))
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        })
    }

    //           Lowering iec61131::Expression     AslExpr

    fn lower_st_expr(expr: StExpr) -> AslExpr {
        match expr {
            StExpr::Literal(lit) => Self::lower_st_literal(lit),

            StExpr::Variable(var) => Self::lower_st_var(var),

            StExpr::Unary { op, operand } => {
                let asl_op = match op {
                    StUnOp::Not => UnaryOp::Not,

                    StUnOp::Neg => UnaryOp::Neg,
                };

                AslExpr::Unary(Box::new(AslUnary {
                    op: asl_op,

                    expr: Self::lower_st_expr(*operand),
                }))
            }

            StExpr::Binary { op, left, right } => match op {
                StBinOp::Power => AslExpr::Call(Box::new(AslCall {
                    callee: "POW".to_string(),

                    args: vec![Self::lower_st_expr(*left), Self::lower_st_expr(*right)],
                })),

                _ => AslExpr::Binary(Box::new(AslBinary {
                    op: Self::map_binop(op),

                    left: Self::lower_st_expr(*left),

                    right: Self::lower_st_expr(*right),
                })),
            },

            StExpr::Call {
                function,
                arguments,
            } => {
                let args: Vec<AslExpr> = arguments
                    .into_iter()
                    .filter_map(|a| match a {
                        StArg::Positional(e) => Some(Self::lower_st_expr(e)),

                        StArg::Named { value, .. } => Some(Self::lower_st_expr(value)),

                        StArg::Output { .. } => None,
                    })
                    .collect();

                AslExpr::Call(Box::new(AslCall {
                    callee: function,
                    args,
                }))
            }

            StExpr::Parenthesized(inner) => Self::lower_st_expr(*inner),
        }
    }

    fn lower_st_literal(lit: StLit) -> AslExpr {
        match lit {
            StLit::Bool(b) => AslExpr::bool_val(b),

            StLit::Integer(n) => AslExpr::int(n),

            StLit::Real(f) => AslExpr::float(f),

            StLit::String(s) => AslExpr::str_val(&s),

            StLit::Time(t) => AslExpr::str_val(&t),

            StLit::Null => AslExpr::Literal(AslLiteral {
                value: serde_json::json!(null),
            }),
        }
    }

    fn lower_st_var(var: StVar) -> AslExpr {
        match var {
            StVar::Simple(name) => AslExpr::var(&name),

            StVar::MemberAccess { base, member } => {
                let base_name = match *base {
                    StVar::Simple(n) => n,

                    other => format!("{other:?}"),
                };

                AslExpr::var(&format!("{base_name}.{member}"))
            }

            StVar::ArrayAccess { base, indices } => {
                let base_expr = Self::lower_st_var(*base);

                let mut args = vec![base_expr];

                args.extend(indices.into_iter().map(Self::lower_st_expr));

                AslExpr::Call(Box::new(AslCall {
                    callee: "_idx".to_string(),
                    args,
                }))
            }

            StVar::Dereference { base } => AslExpr::Unary(Box::new(AslUnary {
                op: UnaryOp::Deref,

                expr: Self::lower_st_var(*base),
            })),

            StVar::Direct(dv) => AslExpr::var(&dv.location),
        }
    }

    fn map_binop(op: StBinOp) -> BinaryOp {
        match op {
            StBinOp::Add => BinaryOp::Add,

            StBinOp::Sub => BinaryOp::Sub,

            StBinOp::Mul => BinaryOp::Mul,

            StBinOp::Div => BinaryOp::Div,

            StBinOp::Mod => BinaryOp::Mod,

            StBinOp::Eq => BinaryOp::Eq,

            StBinOp::Ne => BinaryOp::Neq,

            StBinOp::Lt => BinaryOp::Lt,

            StBinOp::Le => BinaryOp::Lte,

            StBinOp::Gt => BinaryOp::Gt,

            StBinOp::Ge => BinaryOp::Gte,

            StBinOp::And => BinaryOp::And,

            StBinOp::Or => BinaryOp::Or,

            StBinOp::Xor => BinaryOp::BitXor,

            StBinOp::Power => BinaryOp::Mul,
        }
    }

    //           Lowering de action block

    fn lower_action_block(ab: &plcopen::CommonObjects_actionBlock_Inline) -> Vec<AslStatement> {
        ab.action
            .iter()
            .filter_map(|act| {
                if let Some(ref_obj) = act.reference.as_ref() {
                    Some(AslStatement::Expr(AslExpressionStmt {
                        expr: AslExpr::Call(Box::new(AslCall {
                            callee: ref_obj.name.clone(),

                            args: vec![],
                        })),
                    }))
                } else if let Some(inline_body) = act.inline.as_ref() {
                    let st_text = inline_body
                        .st
                        .as_ref()
                        .and_then(|st| st.text.as_deref())
                        .unwrap_or("");

                    if st_text.trim().is_empty() {
                        return None;
                    }

                    let stmts = Self::parse_st_stmts(st_text);

                    if stmts.is_empty() {
                        Some(AslStatement::Comment(AslComment {
                            text: format!("ST inline: {}", st_text.trim()),
                        }))
                    } else if stmts.len() == 1 {
                        Some(stmts.into_iter().next().unwrap())
                    } else {
                        Some(AslStatement::Comment(AslComment {
                            text: format!("ST inline ({} stmts): {}", stmts.len(), st_text.trim()),
                        }))
                    }
                } else {
                    None
                }
            })
            .collect()
    }

    //           Parse de lista de statements ST

    //

    // FIX: usa wrapper FUNCTION (n  o PROGRAM) para aceitar vari  veis n  o declaradas.

    fn parse_st_stmts(text: &str) -> Vec<AslStatement> {
        if text.trim().is_empty() {
            return vec![];
        }

        let src = format!("FUNCTION _SfcAction : BOOL\n{}\nEND_FUNCTION", text);

        let Ok(cu) = StParser::new(&src).parse() else {
            return vec![];
        };

        cu.declarations
            .into_iter()
            .find_map(|decl| {
                if let PouDeclaration::Function(func) = decl {
                    let stmts: Vec<AslStatement> = func
                        .body
                        .into_iter()
                        .filter_map(Self::lower_st_stmt)
                        .collect();

                    Some(stmts)
                } else {
                    None
                }
            })
            .unwrap_or_default()
    }

    //           Lowering de Statement ST     AslStatement

    fn lower_st_stmt(stmt: StStmt) -> Option<AslStatement> {
        match stmt {
            StStmt::Assignment { target, value, .. } => {
                let target_name = match target {
                    StVar::Simple(n) => n,

                    StVar::MemberAccess { base, member } => {
                        let b = match *base {
                            StVar::Simple(n) => n,
                            _ => "_base".to_string(),
                        };

                        format!("{b}.{member}")
                    }

                    other => format!("{other:?}"),
                };

                Some(AslStatement::Assign(AslAssign {
                    target: target_name,

                    value: Self::lower_st_expr(value),
                }))
            }

            StStmt::FunctionCall {
                name, arguments, ..
            } => {
                let args: Vec<AslExpr> = arguments
                    .into_iter()
                    .filter_map(|a| match a {
                        StArg::Positional(e) => Some(Self::lower_st_expr(e)),

                        StArg::Named { value, .. } => Some(Self::lower_st_expr(value)),

                        StArg::Output { .. } => None,
                    })
                    .collect();

                Some(AslStatement::Expr(AslExpressionStmt {
                    expr: AslExpr::Call(Box::new(AslCall { callee: name, args })),
                }))
            }

            other => Some(AslStatement::Comment(AslComment {
                text: format!("ST stmt: {other:?}"),
            })),
        }
    }
}

//           Helpers de m  dulo

fn parse_id(s: &str) -> u32 {
    s.trim().parse::<u32>().unwrap_or(0)
}

fn collect_ref_ids(cp_in: Option<&plcopen::ConnectionPointIn>) -> Vec<u32> {
    let Some(cp) = cp_in else {
        return vec![];
    };

    cp.connection
        .iter()
        .map(|conn| parse_id(&conn.ref_local_id))
        .collect()
}

fn empty_program() -> AslProgram {
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
        functions: vec![],
        tasks: vec![],

        ..Default::default()
    }
}

// ============================================================================

// Testes RT-7

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use crate::types::asl_types::{AslExpr, AslStatement, BinaryOp, UnaryOp};

    //           XMLs de teste

    //

    // SFC: Init    [StartBtn]    Running    [TRUE]    Init  (ciclo completo)

    //

    // FIX: step Init agora tem connectionPointIn com refLocalId="4" para que

    // a transi    o 4 (Running   Init) tenha target_step resolvido, e o step

    // Running seja inclu  do nas transi    es com condi    o TRUE.

    fn xml_simple_sfc() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.plcopen.org/xml/tc6_0201">

  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>

  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">

    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>

  </contentHeader>

  <types>

    <pous>

      <pou name="SimpleSFC" pouType="program">

        <body>

          <SFC>

            <step localId="1" name="Init" initialStep="true" height="20" width="60">

              <position x="100" y="20"/>

              <connectionPointIn>

                <relPosition x="30" y="0"/>

                <connection refLocalId="4"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

            </step>

            <step localId="2" name="Running" initialStep="false" height="20" width="60">

              <position x="100" y="80"/>

              <connectionPointIn>

                <relPosition x="30" y="0"/>

                <connection refLocalId="3"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

            </step>

            <transition localId="3" height="2" width="20">

              <position x="110" y="55"/>

              <connectionPointIn>

                <relPosition x="10" y="0"/>

                <connection refLocalId="1"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

              <condition>

                <reference name="StartBtn"/>

              </condition>

            </transition>

            <transition localId="4" height="2" width="20">

              <position x="110" y="110"/>

              <connectionPointIn>

                <relPosition x="10" y="0"/>

                <connection refLocalId="2"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

              <condition>

                <inline>

                  <ST>TRUE</ST>

                </inline>

              </condition>

            </transition>

          </SFC>

        </body>

      </pou>

    </pous>

  </types>

</project>

"#
    }

    // SFC com condi    o ST composta: SensorA AND NOT SensorB

    fn xml_complex_condition() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.plcopen.org/xml/tc6_0201">

  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>

  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">

    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>

  </contentHeader>

  <types>

    <pous>

      <pou name="ComplexCondSFC" pouType="program">

        <body>

          <SFC>

            <step localId="1" name="Idle" initialStep="true" height="20" width="60">

              <position x="100" y="20"/>

              <connectionPointOut formalParameter=""/>

            </step>

            <step localId="2" name="Active" initialStep="false" height="20" width="60">

              <position x="100" y="80"/>

              <connectionPointIn>

                <relPosition x="30" y="0"/>

                <connection refLocalId="3"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

            </step>

            <transition localId="3" height="2" width="20" priority="1">

              <position x="110" y="55"/>

              <connectionPointIn>

                <relPosition x="10" y="0"/>

                <connection refLocalId="1"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

              <condition>

                <inline>

                  <ST>SensorA AND NOT SensorB</ST>

                </inline>

              </condition>

            </transition>

          </SFC>

        </body>

      </pou>

    </pous>

  </types>

</project>

"#
    }

    // SFC com action reference

    fn xml_action_ref() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>

<project xmlns="http://www.plcopen.org/xml/tc6_0201">

  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>

  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">

    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>

  </contentHeader>

  <types>

    <pous>

      <pou name="ActionRefSFC" pouType="program">

        <body>

          <SFC>

            <step localId="1" name="Motor" initialStep="true" height="20" width="60">

              <position x="100" y="20"/>

              <connectionPointOut formalParameter=""/>

            </step>

            <transition localId="2" height="2" width="20">

              <position x="110" y="55"/>

              <connectionPointIn>

                <relPosition x="10" y="0"/>

                <connection refLocalId="1"/>

              </connectionPointIn>

              <connectionPointOut formalParameter=""/>

              <condition>

                <reference name="StopBtn"/>

              </condition>

            </transition>

            <actionBlock localId="3" height="30" width="60">

              <position x="180" y="20"/>

              <connectionPointIn>

                <relPosition x="0" y="15"/>

                <connection refLocalId="1"/>

              </connectionPointIn>

              <action localId="4" qualifier="N" height="20" width="55">

                <relPosition x="0" y="5"/>

                <reference name="StartMotor"/>

              </action>

            </actionBlock>

          </SFC>

        </body>

      </pou>

    </pous>

  </types>

</project>

"#
    }

    //           Helpers

    fn first_sm(stmts: &[AslStatement]) -> &AslStateMachine {
        stmts
            .iter()
            .find_map(|s| {
                if let AslStatement::StateMachine(sm) = s {
                    Some(sm.as_ref())
                } else {
                    None
                }
            })
            .expect("esperado StateMachine")
    }

    fn find_step<'a>(sm: &'a AslStateMachine, name: &str) -> &'a AslSmStep {
        sm.steps
            .iter()
            .find(|s| s.name == name)
            .unwrap_or_else(|| panic!("step '{}' n  o encontrado", name))
    }

    fn contains_binary(expr: &AslExpr, op: BinaryOp) -> bool {
        match expr {
            AslExpr::Binary(b) => {
                std::mem::discriminant(&b.op) == std::mem::discriminant(&op)
                    || contains_binary(&b.left, op.clone())
                    || contains_binary(&b.right, op.clone())
            }

            AslExpr::Unary(u) => contains_binary(&u.expr, op),

            _ => false,
        }
    }

    fn contains_not(expr: &AslExpr) -> bool {
        match expr {
            AslExpr::Unary(u) => matches!(u.op, UnaryOp::Not) || contains_not(&u.expr),

            AslExpr::Binary(b) => contains_not(&b.left) || contains_not(&b.right),

            _ => false,
        }
    }

    //           Testes

    #[test]

    fn empty_xml_returns_err() {
        assert!(SfcParser::parse("").is_err());
    }

    #[test]

    fn invalid_xml_returns_err() {
        assert!(SfcParser::parse("<not valid").is_err());
    }

    #[test]

    fn simple_sfc_parse_ok() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse simple SFC");

        assert!(!prog.functions.is_empty());

        assert_eq!(prog.functions[0].name, "SimpleSFC");
    }

    #[test]

    fn simple_sfc_emits_state_machine() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let body = &prog.functions[0].body;

        assert!(matches!(body[0], AslStatement::StateMachine(_)));
    }

    #[test]

    fn initial_step_is_init() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        assert_eq!(sm.initial_step, "Init");
    }

    #[test]

    fn simple_sfc_has_two_steps() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        assert_eq!(sm.steps.len(), 2);
    }

    #[test]

    fn transition_reference_condition_is_var() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let init = find_step(sm, "Init");

        assert!(!init.transitions.is_empty(), "Init deve ter transi    es");

        let t = &init.transitions[0];

        assert!(
            matches!(&t.condition, AslExpr::Var(v) if v.name == "StartBtn"),
            "condi    o reference deve ser Var(StartBtn), obtido: {:?}",
            t.condition
        );
    }

    #[test]

    fn transition_inline_true_is_literal() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let running = find_step(sm, "Running");

        assert!(
            !running.transitions.is_empty(),
            "Running deve ter transi    es"
        );

        let t = &running.transitions[0];

        assert!(
            matches!(&t.condition, AslExpr::Literal(l) if l.value == serde_json::json!(true)),
            "condi    o TRUE deve ser Literal(true), obtido: {:?}",
            t.condition
        );
    }

    #[test]

    fn complex_condition_contains_and() {
        let prog = SfcParser::parse(xml_complex_condition()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let idle = find_step(sm, "Idle");

        assert!(!idle.transitions.is_empty());

        let cond = &idle.transitions[0].condition;

        assert!(
            contains_binary(cond, BinaryOp::And),
            "SensorA AND NOT SensorB deve conter Binary(And), obtido: {:?}",
            cond
        );
    }

    #[test]

    fn complex_condition_contains_not() {
        let prog = SfcParser::parse(xml_complex_condition()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let idle = find_step(sm, "Idle");

        let cond = &idle.transitions[0].condition;

        assert!(
            contains_not(cond),
            "NOT SensorB deve produzir Unary(Not), obtido: {:?}",
            cond
        );
    }

    #[test]

    fn priority_is_parsed() {
        let prog = SfcParser::parse(xml_complex_condition()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let idle = find_step(sm, "Idle");

        let t = &idle.transitions[0];

        assert_eq!(t.priority, Some(1), "priority deve ser Some(1)");
    }

    #[test]

    fn action_reference_emits_call() {
        let prog = SfcParser::parse(xml_action_ref()).expect("parse action ref");

        let sm = first_sm(&prog.functions[0].body);

        let motor = find_step(sm, "Motor");

        assert!(!motor.actions.is_empty(), "Motor deve ter actions");

        assert!(
            matches!(&motor.actions[0],

                AslStatement::Expr(e) if matches!(&e.expr,

                    AslExpr::Call(c) if c.callee == "StartMotor")),
            "action reference deve emitir Call(StartMotor), obtido: {:?}",
            motor.actions[0]
        );
    }

    #[test]

    fn target_step_of_init_is_running() {
        let prog = SfcParser::parse(xml_simple_sfc()).expect("parse");

        let sm = first_sm(&prog.functions[0].body);

        let init = find_step(sm, "Init");

        let t = &init.transitions[0];

        assert_eq!(
            t.target_step, "Running",
            "transi    o de Init deve ir para Running, obtido: {}",
            t.target_step
        );
    }
}
