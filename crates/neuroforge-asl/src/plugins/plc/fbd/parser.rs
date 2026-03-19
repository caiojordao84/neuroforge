//! FBD Parser — PLCopen XML → AslProgram.
//!
//! RT-6: blocos funcionais, inVariable/outVariable, IEC FB especiais.
//!
//! ## Modelo de lowering
//!
//! Um body FBD é um grafo de nós ligados por `connectionPointIn/connection/@refLocalId`.
//!
//! Tipos de nós em `Body_FBD_Inline`:
//!   - `inVariable`    → fonte de valor (expression: Option<String>)
//!   - `outVariable`   → destino (expression), consome connectionPointIn
//!   - `inOutVariable` → bidirecional (expression), tem ambos os connection points
//!   - `block`         → função/FB (typeName, instanceName, inputVariables, outputVariables)
//!
//! Estratégia:
//!   1. Construir mapa  localId → FbdNode.
//!   2. Para cada outVariable (e inOutVariable como saída):
//!        a. Seguir connectionPointIn → nó fonte.
//!        b. Resolver recursivamente a expressão ASL.
//!        c. Emitir AslStatement::Assign.
//!   3. Para blocos IEC especiais (TON, TOF, TP, CTU, CTD, SR, RS, R_TRIG, F_TRIG):
//!        emitir o AslStatement IEC especializado.
//!   4. Para outros blocos: AslExpr::Call genérico.
//!
//! Tipos PLCopen confirmados em generated_body.rs / generated_variables.rs:
//!   body.fbd  : Option<Box<Body_FBD_Inline>>
//!
//! Body_FBD_Inline fields:
//!   .in_variable    : Vec<FbdObjects_inVariable_Inline>
//!       .local_id: String, .expression: Option<String>
//!       .connection_point_out: Option<ConnectionPointOut>  (sem ref_local_id — é fonte)
//!   .out_variable   : Vec<FbdObjects_outVariable_Inline>
//!       .local_id: String, .expression: Option<String>
//!       .connection_point_in: Option<ConnectionPointIn>    → .connection[].ref_local_id: String
//!   .in_out_variable: Vec<FbdObjects_inOutVariable_Inline>
//!       .local_id: String, .expression: Option<String>
//!       .connection_point_in / .connection_point_out
//!   .block          : Vec<FbdObjects_block_Inline>
//!       .local_id: String, .type_name: String, .instance_name: Option<String>
//!       .input_variables:  Option<FbdObjects_block_InlineType_inputVariables_Inline>
//!           .variable: Vec<...>  →  .formal_parameter: String
//!                                    .connection_point_in: Option<ConnectionPointIn>
//!       .output_variables: Option<FbdObjects_block_InlineType_outputVariables_Inline>
//!           .variable: Vec<...>  →  .formal_parameter: String
//!                                    .connection_point_out: Option<ConnectionPointOut>

#![allow(dead_code, unused_imports)]

use std::collections::HashMap;

use crate::types::asl_types::{
    AslProgram, AslFunction, AslStatement, AslExpr, AslMetadata,
    AslAssign, AslBinary, AslUnary, AslCall, AslExpressionStmt,
    BinaryOp, UnaryOp, AslLiteral,
    AslTimerTon, AslTimerTof, AslTimerTp,
    AslCounterCtu, AslCounterCtd,
    AslLatchSr, AslLatchRs,
    AslTrigR, AslTrigF,
};
use crate::plugins::plc::plcopen_xml::parse_project;

#[derive(Debug, thiserror::Error)]
pub enum FbdParseError {
    #[error("XML error: {0}")] XmlError(String),
    #[error("FBD vazio")]       Empty,
}

// ─── IR interno ───────────────────────────────────────────────────────────────

/// Pin de entrada de um bloco: nome formal + lista de localIds que o alimentam.
#[derive(Debug, Clone)]
struct InputPin {
    formal: String,
    sources: Vec<u32>,
}

/// Pin de saída de um bloco: nome formal + localId sintético deste pin.
#[derive(Debug, Clone)]
struct OutputPin {
    formal: String,
}

#[derive(Debug, Clone)]
enum FbdNode {
    /// inVariable: fonte de expressão escalar
    InVar { expr: String },
    /// outVariable / inOutVariable: destino de assign
    OutVar { expression: String, sources: Vec<u32> },
    /// Bloco funcional genérico ou IEC especial
    Block {
        type_name:     String,
        instance_name: Option<String>,
        inputs:        Vec<InputPin>,
        outputs:       Vec<OutputPin>,
    },
}

// ─── Parser público ────────────────────────────────────────────────────────────

pub struct FbdParser;

impl FbdParser {
    /// Parse PLCopen XML com bodies FBD → AslProgram.
    pub fn parse(xml: &str) -> Result<AslProgram, FbdParseError> {
        if xml.trim().is_empty() {
            return Err(FbdParseError::Empty);
        }
        let project = parse_project(xml)
            .map_err(|e| FbdParseError::XmlError(e.to_string()))?;

        let mut functions: Vec<AslFunction> = vec![];

        let Some(types) = project.types.as_ref() else {
            return Ok(empty_program());
        };
        let Some(pous) = types.pous.as_ref() else {
            return Ok(empty_program());
        };

        for pou in &pous.pou {
            let name = pou.name.as_str();

            // pou.body é Vec<Box<Body>> — usar o primeiro body
            let Some(body) = pou.body.first() else { continue; };

            // campo: body.fbd  (Option<Box<Body_FBD_Inline>>)
            let Some(fbd) = body.fbd.as_ref() else { continue; };

            let body_stmts = Self::lower_fbd(fbd);
            functions.push(AslFunction {
                name:        name.to_string(),
                return_type: None,
                params:      vec![],
                body:        body_stmts,
            });
        }

        if functions.is_empty() {
            return Err(FbdParseError::Empty);
        }

        Ok(AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name:         None,
                description:  None,
                version:      None,
                target_board: Some("plc".to_string()),
            },
            structs:   vec![],
            globals:   vec![],
            functions,
            tasks:     vec![],
        })
    }

    // ─── FBD → Vec<AslStatement> ───────────────────────────────────────────────

    fn lower_fbd(fbd: &plcopen::Body_FBD_Inline) -> Vec<AslStatement> {
        // 1. Construir mapa localId → FbdNode
        let mut nodes: HashMap<u32, FbdNode> = HashMap::new();

        // inVariable — fonte (.expression: Option<String>)
        for iv in &fbd.in_variable {
            let id   = parse_id(&iv.local_id);
            let expr = iv.expression.as_deref().unwrap_or("").trim().to_string();
            nodes.insert(id, FbdNode::InVar { expr });
        }

        // inOutVariable — registar como OutVar (o lado de saída é tratado igual)
        for iov in &fbd.in_out_variable {
            let id         = parse_id(&iov.local_id);
            let expression = iov.expression.as_deref().unwrap_or("").trim().to_string();
            let sources    = collect_inputs(iov.connection_point_in.as_ref());
            nodes.insert(id, FbdNode::OutVar { expression, sources });
        }

        // block — FB genérico ou IEC especial
        for blk in &fbd.block {
            let id            = parse_id(&blk.local_id);
            let type_name     = blk.type_name.clone();
            let instance_name = blk.instance_name.clone();

            let inputs: Vec<InputPin> = blk.input_variables.as_ref()
                .map(|iv| iv.variable.iter().map(|v| InputPin {
                    formal:  v.formal_parameter.clone(),
                    sources: collect_inputs(v.connection_point_in.as_ref()),
                }).collect())
                .unwrap_or_default();

            let outputs: Vec<OutputPin> = blk.output_variables.as_ref()
                .map(|ov| ov.variable.iter().map(|v| OutputPin {
                    formal: v.formal_parameter.clone(),
                }).collect())
                .unwrap_or_default();

            nodes.insert(id, FbdNode::Block { type_name, instance_name, inputs, outputs });
        }

        // outVariable — destino (.expression: Option<String>)
        // Inserir por último para não sobrescrever inOutVariable com mesmo id
        for ov in &fbd.out_variable {
            let id         = parse_id(&ov.local_id);
            let expression = ov.expression.as_deref().unwrap_or("").trim().to_string();
            let sources    = collect_inputs(ov.connection_point_in.as_ref());
            nodes.insert(id, FbdNode::OutVar { expression, sources });
        }

        // 2. Emitir statements
        let mut stmts: Vec<AslStatement> = vec![];

        // 2a. Blocos IEC especiais — emitir statement especializado
        for blk in &fbd.block {
            if let Some(stmt) = Self::try_iec_block(blk, &nodes) {
                stmts.push(stmt);
            }
        }

        // 2b. outVariable → Assign
        for ov in &fbd.out_variable {
            let target  = ov.expression.as_deref().unwrap_or("").trim().to_string();
            let sources = collect_inputs(ov.connection_point_in.as_ref());
            if sources.is_empty() { continue; }

            let value = Self::resolve_expr(sources[0], &nodes, 0);
            stmts.push(AslStatement::Assign(AslAssign { target, value }));
        }

        // 2c. inOutVariable → Assign (lado de escrita)
        for iov in &fbd.in_out_variable {
            let target  = iov.expression.as_deref().unwrap_or("").trim().to_string();
            let sources = collect_inputs(iov.connection_point_in.as_ref());
            if sources.is_empty() { continue; }

            let value = Self::resolve_expr(sources[0], &nodes, 0);
            stmts.push(AslStatement::Assign(AslAssign { target, value }));
        }

        stmts
    }

    // ─── Resolução recursiva de expressão ─────────────────────────────────────
    //
    // Segue o grafo para trás a partir de um nó e constrói a AslExpr:
    //   InVar        → AslExpr::Var(expr)
    //   OutVar       → AslExpr::Var(expression)   (passthrough)
    //   Block genérico → AslExpr::Call(type_name|instance, args)
    //   desconhecido → AslExpr::Var("_fbd_unknown_{id}")

    fn resolve_expr(node_id: u32, nodes: &HashMap<u32, FbdNode>, depth: u8) -> AslExpr {
        if depth > 32 {
            return AslExpr::var("_fbd_depth_limit");
        }
        match nodes.get(&node_id) {
            None => AslExpr::var(&format!("_fbd_unknown_{node_id}")),

            Some(FbdNode::InVar { expr }) => {
                if expr.is_empty() {
                    AslExpr::Literal(AslLiteral { value: serde_json::json!(null) })
                } else {
                    AslExpr::var(expr)
                }
            }

            Some(FbdNode::OutVar { expression, .. }) => AslExpr::var(expression),

            Some(FbdNode::Block { type_name, instance_name, inputs, outputs: _ }) => {
                // Bloco genérico: callee = instanceName ?? typeName
                let callee = instance_name.as_deref()
                    .filter(|s| !s.is_empty())
                    .unwrap_or(type_name.as_str())
                    .to_string();

                let args: Vec<AslExpr> = inputs.iter().map(|pin| {
                    if pin.sources.is_empty() {
                        AslExpr::var(&format!("_fbd_unconnected_{}", pin.formal))
                    } else {
                        Self::resolve_expr(pin.sources[0], nodes, depth + 1)
                    }
                }).collect();

                AslExpr::Call(Box::new(AslCall { callee, args }))
            }
        }
    }

    // ─── Dispatch de blocos IEC especiais ─────────────────────────────────────
    //
    // Reconhece type_name (case-insensitive) e emite o AslStatement correcto.
    // Retorna None se o bloco não é um FB IEC especial (será tratado como Call).

    fn try_iec_block(
        blk: &plcopen::FbdObjects_block_Inline,
        nodes: &HashMap<u32, FbdNode>,
    ) -> Option<AslStatement> {
        let instance = blk.instance_name.as_deref()
            .filter(|s| !s.is_empty())
            .unwrap_or(blk.type_name.as_str())
            .to_string();

        /// Helper: resolve o primeiro source do pin com dado formalParameter.
        fn pin_expr(
            blk: &plcopen::FbdObjects_block_Inline,
            formal: &str,
            nodes: &HashMap<u32, FbdNode>,
        ) -> AslExpr {
            blk.input_variables.as_ref()
                .and_then(|iv| iv.variable.iter().find(|v| v.formal_parameter.eq_ignore_ascii_case(formal)))
                .and_then(|v| {
                    let srcs = collect_inputs(v.connection_point_in.as_ref());
                    srcs.first().copied()
                })
                .map(|id| FbdParser::resolve_expr(id, nodes, 0))
                .unwrap_or_else(|| AslExpr::var(&format!("_fbd_{formal}_unconnected")))
        }

        match blk.type_name.to_ascii_uppercase().as_str() {
            "TON" => Some(AslStatement::TimerTon(AslTimerTon {
                instance,
                r#in: pin_expr(blk, "IN", nodes),
                pt:   pin_expr(blk, "PT", nodes),
            })),
            "TOF" => Some(AslStatement::TimerTof(AslTimerTof {
                instance,
                r#in: pin_expr(blk, "IN", nodes),
                pt:   pin_expr(blk, "PT", nodes),
            })),
            "TP" => Some(AslStatement::TimerTp(AslTimerTp {
                instance,
                r#in: pin_expr(blk, "IN", nodes),
                pt:   pin_expr(blk, "PT", nodes),
            })),
            "CTU" => Some(AslStatement::CounterCtu(AslCounterCtu {
                instance,
                cu: pin_expr(blk, "CU", nodes),
                r:  pin_expr(blk, "R",  nodes),
                pv: pin_expr(blk, "PV", nodes),
            })),
            "CTD" => Some(AslStatement::CounterCtd(AslCounterCtd {
                instance,
                cd: pin_expr(blk, "CD", nodes),
                ld: pin_expr(blk, "LD", nodes),
                pv: pin_expr(blk, "PV", nodes),
            })),
            "SR" => Some(AslStatement::LatchSr(AslLatchSr {
                instance,
                s: pin_expr(blk, "S1", nodes),
                r: pin_expr(blk, "R",  nodes),
            })),
            "RS" => Some(AslStatement::LatchRs(AslLatchRs {
                instance,
                r: pin_expr(blk, "R1", nodes),
                s: pin_expr(blk, "S",  nodes),
            })),
            "R_TRIG" => Some(AslStatement::TrigR(AslTrigR {
                instance,
                r#in: pin_expr(blk, "CLK", nodes),
            })),
            "F_TRIG" => Some(AslStatement::TrigF(AslTrigF {
                instance,
                r#in: pin_expr(blk, "CLK", nodes),
            })),
            _ => None,
        }
    }
}

// ─── Helpers de módulo ────────────────────────────────────────────────────────

/// Parse seguro de localId String → u32.
fn parse_id(s: &str) -> u32 {
    s.trim().parse::<u32>().unwrap_or(0)
}

/// Recolhe ref_local_id de todos os connection points de entrada.
/// ConnectionPointIn.connection: Vec<Connection>  →  .ref_local_id: String
fn collect_inputs(cp_in: Option<&plcopen::ConnectionPointIn>) -> Vec<u32> {
    let Some(cp) = cp_in else { return vec![]; };
    cp.connection.iter()
        .map(|conn| parse_id(&conn.ref_local_id))
        .collect()
}

fn empty_program() -> AslProgram {
    AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: None, description: None, version: None,
            target_board: Some("plc".to_string()),
        },
        structs: vec![], globals: vec![], functions: vec![], tasks: vec![],
    }
}

// ============================================================================
// Testes RT-6
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::{AslExpr, AslStatement};

    // ─── XMLs de teste ────────────────────────────────────────────────────────
    //
    // Estrutura PLCopen TC6 XML mínima e válida.

    /// inVariable(1, "SensorA") → outVariable(2, "Motor")
    fn xml_passthrough() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="PassthroughPOU" pouType="program">
        <body>
          <FBD>
            <inVariable localId="1" height="20" width="60">
              <position x="10" y="10"/>
              <connectionPointOut formalParameter=""/>
              <expression>SensorA</expression>
            </inVariable>
            <outVariable localId="2" height="20" width="60">
              <position x="120" y="10"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="1"/>
              </connectionPointIn>
              <expression>Motor</expression>
            </outVariable>
          </FBD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    /// inVariable(1,"A") + inVariable(2,"B") → block AND(3) → outVariable(4,"Result")
    fn xml_generic_block() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="GenericBlockPOU" pouType="program">
        <body>
          <FBD>
            <inVariable localId="1" height="20" width="40">
              <position x="10" y="10"/>
              <connectionPointOut formalParameter=""/>
              <expression>A</expression>
            </inVariable>
            <inVariable localId="2" height="20" width="40">
              <position x="10" y="40"/>
              <connectionPointOut formalParameter=""/>
              <expression>B</expression>
            </inVariable>
            <block localId="3" typeName="AND" instanceName="AndBlock1" height="40" width="60">
              <position x="80" y="10"/>
              <inputVariables>
                <variable formalParameter="IN1">
                  <connectionPointIn>
                    <relPosition x="0" y="10"/>
                    <connection refLocalId="1"/>
                  </connectionPointIn>
                </variable>
                <variable formalParameter="IN2">
                  <connectionPointIn>
                    <relPosition x="0" y="30"/>
                    <connection refLocalId="2"/>
                  </connectionPointIn>
                </variable>
              </inputVariables>
              <inOutVariables/>
              <outputVariables>
                <variable formalParameter="OUT">
                  <connectionPointOut formalParameter="OUT"/>
                </variable>
              </outputVariables>
            </block>
            <outVariable localId="4" height="20" width="60">
              <position x="180" y="20"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="3"/>
              </connectionPointIn>
              <expression>Result</expression>
            </outVariable>
          </FBD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    /// TON block com IN=Start, PT=Preset → statement TimerTon
    fn xml_ton_block() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="P" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="TonPOU" pouType="program">
        <body>
          <FBD>
            <inVariable localId="1" height="20" width="40">
              <position x="10" y="10"/>
              <connectionPointOut formalParameter=""/>
              <expression>Start</expression>
            </inVariable>
            <inVariable localId="2" height="20" width="40">
              <position x="10" y="40"/>
              <connectionPointOut formalParameter=""/>
              <expression>Preset</expression>
            </inVariable>
            <block localId="3" typeName="TON" instanceName="Timer1" height="60" width="60">
              <position x="80" y="10"/>
              <inputVariables>
                <variable formalParameter="IN">
                  <connectionPointIn>
                    <relPosition x="0" y="10"/>
                    <connection refLocalId="1"/>
                  </connectionPointIn>
                </variable>
                <variable formalParameter="PT">
                  <connectionPointIn>
                    <relPosition x="0" y="30"/>
                    <connection refLocalId="2"/>
                  </connectionPointIn>
                </variable>
              </inputVariables>
              <inOutVariables/>
              <outputVariables>
                <variable formalParameter="Q">
                  <connectionPointOut formalParameter="Q"/>
                </variable>
              </outputVariables>
            </block>
          </FBD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    fn first_assign(stmts: &[AslStatement]) -> &AslAssign {
        stmts.iter().find_map(|s| if let AslStatement::Assign(a) = s { Some(a) } else { None })
            .expect("esperado Assign")
    }

    fn first_timer_ton(stmts: &[AslStatement]) -> &AslTimerTon {
        stmts.iter().find_map(|s| if let AslStatement::TimerTon(t) = s { Some(t) } else { None })
            .expect("esperado TimerTon")
    }

    // ─── Testes ───────────────────────────────────────────────────────────────

    #[test]
    fn empty_xml_returns_err() {
        assert!(FbdParser::parse("").is_err());
    }

    #[test]
    fn invalid_xml_returns_err() {
        assert!(FbdParser::parse("<not valid").is_err());
    }

    #[test]
    fn passthrough_parse_ok() {
        let prog = FbdParser::parse(xml_passthrough()).expect("parse passthrough");
        assert!(!prog.functions.is_empty());
        let func = &prog.functions[0];
        assert_eq!(func.name, "PassthroughPOU");
        let assign = first_assign(&func.body);
        assert_eq!(assign.target, "Motor");
    }

    #[test]
    fn passthrough_value_is_var_sensora() {
        let prog   = FbdParser::parse(xml_passthrough()).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert!(
            matches!(&assign.value, AslExpr::Var(v) if v.name == "SensorA"),
            "valor esperado Var(SensorA), obtido: {:?}", assign.value
        );
    }

    #[test]
    fn generic_block_produces_assign_with_call() {
        let prog   = FbdParser::parse(xml_generic_block()).expect("parse generic block");
        let assign = first_assign(&prog.functions[0].body);
        assert_eq!(assign.target, "Result");
        assert!(
            matches!(&assign.value, AslExpr::Call(c) if c.callee == "AndBlock1"),
            "esperado Call(AndBlock1), obtido: {:?}", assign.value
        );
    }

    #[test]
    fn generic_block_call_has_two_args() {
        let prog   = FbdParser::parse(xml_generic_block()).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        if let AslExpr::Call(c) = &assign.value {
            assert_eq!(c.args.len(), 2, "AND block deve ter 2 args");
        } else {
            panic!("esperado Call");
        }
    }

    #[test]
    fn ton_block_emits_timer_ton_statement() {
        let prog  = FbdParser::parse(xml_ton_block()).expect("parse TON");
        let timer = first_timer_ton(&prog.functions[0].body);
        assert_eq!(timer.instance, "Timer1");
    }

    #[test]
    fn ton_in_pin_resolves_to_start() {
        let prog  = FbdParser::parse(xml_ton_block()).expect("parse");
        let timer = first_timer_ton(&prog.functions[0].body);
        assert!(
            matches!(&timer.r#in, AslExpr::Var(v) if v.name == "Start"),
            "IN deve ser Var(Start), obtido: {:?}", timer.r#in
        );
    }

    #[test]
    fn ton_pt_pin_resolves_to_preset() {
        let prog  = FbdParser::parse(xml_ton_block()).expect("parse");
        let timer = first_timer_ton(&prog.functions[0].body);
        assert!(
            matches!(&timer.pt, AslExpr::Var(v) if v.name == "Preset"),
            "PT deve ser Var(Preset), obtido: {:?}", timer.pt
        );
    }
}
