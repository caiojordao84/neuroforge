//! LD Parser — PLCopen XML → AslProgram.
//!
//! RT-5: paralelos (OR) e série (AND).
//!
//! ## Modelo de lowering
//!
//! Uma rede LD (rung) é representada em PLCopen XML como grafos de nós
//! ligados por `connectionPointIn/connection/@refLocalId`.
//!
//! Estratégia adoptada (conservadora, sem crate de grafo):
//!
//!   1. Parsear o XML com `plcopen::from_str::<Project>`.
//!   2. Para cada POU do tipo "program", percorrer os seus bodies LD.
//!   3. Por cada body LD:
//!      a. Construir um mapa  localId → LdNode  (contact | coil | leftPowerRail).
//!      b. Para cada coil, calcular a expressão booleana dos seus inputs:
//!         - recolher todos os contactos que chegam directamente à coil → OR
//!         - para cada caminho, seguir a cadeia de ligações → AND
//!      c. Emitir `AslStatement::Assign` com o resultado.
//!   4. Emitir `AslProgram` com uma função por POU.
//!
//! Tipos PLCopen confirmados em RT-2 / plcopen_xml.rs e gerados pelo XSD:
//!   plcopen::Project
//!   plcopen::from_str::<Project>
//!   pou.body  : Vec<Box<Body>>               (Vec, não Option!)
//!   body.ld   : Option<Box<Body_LD_Inline>>  (snake_case, tipo correcto)
//!
//! Body_LD_Inline fields (gerados pelo XSD):
//!   .left_power_rail : Vec<LdObjects_leftPowerRail_Inline>  — .local_id: String
//!   .contact         : Vec<LdObjects_contact_Inline>
//!       .local_id: String, .variable: Option<String>, .negated: Option<String> ("true"/"false")
//!       .connection_point_in: Option<ConnectionPointIn>
//!   .coil            : Vec<LdObjects_coil_Inline>
//!       .local_id: String, .variable: Option<String>
//!       .connection_point_in: Option<ConnectionPointIn>
//!
//! ConnectionPointIn fields:
//!   .connection: Vec<Connection>
//!       .ref_local_id: String  (não Option, não camelCase)

#![allow(dead_code, unused_imports)]
#![allow(clippy::doc_lazy_continuation, clippy::doc_overindented_list_items)]

use std::collections::HashMap;

use crate::types::asl_types::{
    AslProgram, AslFunction, AslStatement, AslExpr, AslMetadata,
    AslAssign, AslBinary, AslUnary, BinaryOp, UnaryOp,
    AslLiteral,
};
use crate::plugins::plc::plcopen_xml::parse_project;

#[derive(Debug, thiserror::Error)]
pub enum LdParseError {
    #[error("XML error: {0}")] XmlError(String),
    #[error("LD vazio")]        Empty,
}

// ─── Estruturas internas de IR ────────────────────────────────────────────────

/// Nó interno de grafo LD.
#[derive(Debug, Clone)]
enum LdNode {
    LeftRail,
    Contact { var: String, negated: bool, inputs: Vec<u32> },
    Coil    { var: String,               inputs: Vec<u32> },
}

// ─── Parser público ───────────────────────────────────────────────────────────

pub struct LdParser;

impl LdParser {
    /// Parse PLCopen XML com redes LD → AslProgram.
    pub fn parse(xml: &str) -> Result<AslProgram, LdParseError> {
        if xml.trim().is_empty() {
            return Err(LdParseError::Empty);
        }
        let project = parse_project(xml)
            .map_err(|e| LdParseError::XmlError(e.to_string()))?;

        let mut functions: Vec<AslFunction> = vec![];

        let Some(types) = project.types.as_ref() else {
            return Ok(empty_program());
        };
        let Some(pous) = types.pous.as_ref() else {
            return Ok(empty_program());
        };

        for pou in &pous.pou {
            let name = pou.name.as_str();

            // pou.body é Vec<Box<Body>> — usar o primeiro body disponível
            let Some(body) = pou.body.first() else { continue; };

            // campo snake_case: body.ld  (não body.LD)
            let Some(ld) = body.ld.as_ref() else { continue; };

            let body_stmts = Self::lower_ld(ld);
            functions.push(AslFunction {
                name:        name.to_string(),
                return_type: None,
                params:      vec![],
                body:        body_stmts,
            });
        }

        if functions.is_empty() {
            return Err(LdParseError::Empty);
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
            ..Default::default()
        })
    }

    // ── LD → Vec<AslStatement> ────────────────────────────────────────────────

    fn lower_ld(ld: &plcopen::Body_LD_Inline) -> Vec<AslStatement> {
        // 1. Construir mapa  localId → LdNode
        let mut nodes: HashMap<u32, LdNode> = HashMap::new();

        // leftPowerRail — campo: left_power_rail
        for rail in &ld.left_power_rail {
            let id = Self::parse_id(&rail.local_id);
            nodes.insert(id, LdNode::LeftRail);
        }

        // contacts — .variable: Option<String>, .negated: Option<String>
        for c in &ld.contact {
            let id      = Self::parse_id(&c.local_id);
            let var     = c.variable.as_deref().unwrap_or("").trim().to_string();
            // negated é serializado como string "true"/"false" pelo XSD
            let negated = c.negated.as_deref().unwrap_or("false").trim().eq_ignore_ascii_case("true");
            let inputs  = Self::collect_inputs(c.connection_point_in.as_ref());
            nodes.insert(id, LdNode::Contact { var, negated, inputs });
        }

        // coils — .variable: Option<String>
        for coil in &ld.coil {
            let id     = Self::parse_id(&coil.local_id);
            let var    = coil.variable.as_deref().unwrap_or("").trim().to_string();
            let inputs = Self::collect_inputs(coil.connection_point_in.as_ref());
            nodes.insert(id, LdNode::Coil { var, inputs });
        }

        // 2. Para cada coil emitir um Assign
        let mut stmts: Vec<AslStatement> = vec![];

        for coil in &ld.coil {
            let target = coil.variable.as_deref().unwrap_or("").trim().to_string();
            let inputs = Self::collect_inputs(coil.connection_point_in.as_ref());

            // Cada input directo da coil é uma rama OR
            let branches: Vec<AslExpr> = inputs.iter()
                .map(|&src_id| Self::build_expr(src_id, &nodes, 0))
                .collect();

            let value = Self::or_exprs(branches);
            stmts.push(AslStatement::Assign(AslAssign { target, value }));
        }

        stmts
    }

    // ── Construção recursiva de expressão ────────────────────────────────────
    //
    // Percorre o grafo para trás a partir de um nó, construindo:
    //   - LeftRail       → AslExpr::bool_true (fonte, sempre activo)
    //   - Contact(x)     → x AND expr_dos_inputs  (ou NOT x se negated)
    //   - Coil / outro   → fallback Var
    //
    // max_depth evita loops em grafos mal formados.

    fn build_expr(node_id: u32, nodes: &HashMap<u32, LdNode>, depth: u8) -> AslExpr {
        if depth > 32 {
            return AslExpr::var("_ld_depth_limit");
        }
        match nodes.get(&node_id) {
            None => AslExpr::var(&format!("_ld_unknown_{node_id}")),

            Some(LdNode::LeftRail) => {
                AslExpr::Literal(crate::types::asl_types::AslLiteral {
                    value: serde_json::json!(true),
                })
            }

            Some(LdNode::Contact { var, negated, inputs }) => {
                let var     = var.clone();
                let negated = *negated;
                let inputs  = inputs.clone();

                let input_expr = if inputs.is_empty() {
                    AslExpr::Literal(crate::types::asl_types::AslLiteral {
                        value: serde_json::json!(true),
                    })
                } else {
                    let branches: Vec<AslExpr> = inputs.iter()
                        .map(|&id| Self::build_expr(id, nodes, depth + 1))
                        .collect();
                    Self::or_exprs(branches)
                };

                let var_expr = if negated {
                    AslExpr::Unary(Box::new(crate::types::asl_types::AslUnary {
                        op:   UnaryOp::Not,
                        expr: AslExpr::var(&var),
                    }))
                } else {
                    AslExpr::var(&var)
                };

                if Self::is_true_lit(&input_expr) {
                    var_expr
                } else {
                    AslExpr::Binary(Box::new(crate::types::asl_types::AslBinary {
                        op:    BinaryOp::And,
                        left:  input_expr,
                        right: var_expr,
                    }))
                }
            }

            Some(LdNode::Coil { var, .. }) => AslExpr::var(var),
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// Combina uma lista de expressões com OR.
    /// Lista vazia → FALSE; singleton → a própria expressão.
    fn or_exprs(mut exprs: Vec<AslExpr>) -> AslExpr {
        if exprs.is_empty() {
            return AslExpr::Literal(crate::types::asl_types::AslLiteral {
                value: serde_json::json!(false),
            });
        }
        let first = exprs.remove(0);
        exprs.into_iter().fold(first, |acc, e| {
            AslExpr::Binary(Box::new(crate::types::asl_types::AslBinary {
                op:    BinaryOp::Or,
                left:  acc,
                right: e,
            }))
        })
    }

    fn is_true_lit(e: &AslExpr) -> bool {
        matches!(e, AslExpr::Literal(l) if l.value == serde_json::json!(true))
    }

    /// Parse seguro de localId (String → u32, 0 em caso de falha).
    fn parse_id(s: &str) -> u32 {
        s.trim().parse::<u32>().unwrap_or(0)
    }

    /// Recolhe os ref_local_id de todos os connection points de entrada.
    /// ConnectionPointIn.connection: Vec<Connection>
    /// Connection.ref_local_id: String  (não Option, não camelCase)
    fn collect_inputs(cp_in: Option<&plcopen::ConnectionPointIn>) -> Vec<u32> {
        let Some(cp) = cp_in else { return vec![]; };
        cp.connection.iter()
            .map(|conn| Self::parse_id(&conn.ref_local_id))
            .collect()
    }
}

fn empty_program() -> AslProgram {
    AslProgram {
        asl_version: "4.0.0".to_string(),
        metadata: AslMetadata {
            name: None, description: None, version: None,
            target_board: Some("plc".to_string()),
        },
        structs: vec![], globals: vec![], functions: vec![], tasks: vec![],
        ..Default::default()
    }
}

// ============================================================================
// Testes RT-5
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::asl_types::{AslExpr, AslStatement, BinaryOp, UnaryOp};

    // ── XMLs de teste ─────────────────────────────────────────────────────────
    //
    // Estrutura mínima PLCopen TC6 XML válida.
    // Rede série:    Rail(1) → A(2) → B(3) → Motor(coil 4)
    // Rede paralela: Rail(1) → A(2) ─┬─→ Motor(coil 4)
    //                                  └─ Rail(1) → B(3) ─┘

    fn xml_serie() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="TestProject" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="SerieRung" pouType="program">
        <body>
          <LD>
            <leftPowerRail localId="1" height="20" width="10">
              <position x="0" y="0"/>
              <connectionPointOut formalParameter=""/>
            </leftPowerRail>
            <contact localId="2" height="20" width="20" negated="false">
              <position x="40" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="1"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>A</variable>
            </contact>
            <contact localId="3" height="20" width="20" negated="false">
              <position x="80" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="2"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>B</variable>
            </contact>
            <coil localId="4" height="20" width="20">
              <position x="120" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="3"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>Motor</variable>
            </coil>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    fn xml_parallel() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="TestProject" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="ParallelRung" pouType="program">
        <body>
          <LD>
            <leftPowerRail localId="1" height="20" width="10">
              <position x="0" y="0"/>
              <connectionPointOut formalParameter=""/>
            </leftPowerRail>
            <contact localId="2" height="20" width="20" negated="false">
              <position x="40" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="1"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>A</variable>
            </contact>
            <contact localId="3" height="20" width="20" negated="false">
              <position x="40" y="30"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="1"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>B</variable>
            </contact>
            <coil localId="4" height="20" width="20">
              <position x="120" y="15"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="2"/>
                <connection refLocalId="3"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>Motor</variable>
            </coil>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    fn xml_negated() -> &'static str {
        r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="TestProject" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="NegatedRung" pouType="program">
        <body>
          <LD>
            <leftPowerRail localId="1" height="20" width="10">
              <position x="0" y="0"/>
              <connectionPointOut formalParameter=""/>
            </leftPowerRail>
            <contact localId="2" height="20" width="20" negated="true">
              <position x="40" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="1"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>Stop</variable>
            </contact>
            <coil localId="3" height="20" width="20">
              <position x="80" y="0"/>
              <connectionPointIn>
                <relPosition x="0" y="10"/>
                <connection refLocalId="2"/>
              </connectionPointIn>
              <connectionPointOut formalParameter=""/>
              <variable>Motor</variable>
            </coil>
          </LD>
        </body>
      </pou>
    </pous>
  </types>
</project>
"#
    }

    // ── Helpers de teste ──────────────────────────────────────────────────────

    fn first_assign(stmts: &[AslStatement]) -> &AslAssign {
        stmts.iter().find_map(|s| if let AslStatement::Assign(a) = s { Some(a) } else { None })
            .expect("esperado Assign")
    }

    // ── Testes ────────────────────────────────────────────────────────────────

    #[test]
    fn empty_xml_returns_err() {
        assert!(LdParser::parse("").is_err());
    }

    #[test]
    fn invalid_xml_returns_err() {
        assert!(LdParser::parse("<not valid").is_err());
    }

    #[test]
    fn serie_parse_emits_assign() {
        let prog = LdParser::parse(xml_serie()).expect("parse serie");
        assert!(!prog.functions.is_empty());
        let func = &prog.functions[0];
        assert_eq!(func.name, "SerieRung");
        let assign = first_assign(&func.body);
        assert_eq!(assign.target, "Motor");
    }

    #[test]
    fn serie_value_is_binary_and() {
        let prog   = LdParser::parse(xml_serie()).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert!(
            contains_and(&assign.value),
            "rede série deve produzir Binary(And), obtido: {:?}",
            assign.value
        );
    }

    #[test]
    fn parallel_parse_emits_assign() {
        let prog = LdParser::parse(xml_parallel()).expect("parse parallel");
        let func = &prog.functions[0];
        assert_eq!(func.name, "ParallelRung");
        let assign = first_assign(&func.body);
        assert_eq!(assign.target, "Motor");
    }

    #[test]
    fn parallel_value_is_binary_or() {
        let prog   = LdParser::parse(xml_parallel()).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert!(
            matches!(&assign.value, AslExpr::Binary(b) if matches!(b.op, BinaryOp::Or)),
            "rede paralela deve produzir Binary(Or) no topo, obtido: {:?}",
            assign.value
        );
    }

    #[test]
    fn negated_contact_produces_unary_not() {
        let prog   = LdParser::parse(xml_negated()).expect("parse");
        let assign = first_assign(&prog.functions[0].body);
        assert!(
            contains_not(&assign.value),
            "contacto negado deve produzir Unary(Not), obtido: {:?}",
            assign.value
        );
    }

    fn contains_and(e: &AslExpr) -> bool {
        match e {
            AslExpr::Binary(b) =>
                matches!(b.op, BinaryOp::And)
                || contains_and(&b.left)
                || contains_and(&b.right),
            AslExpr::Unary(u) => contains_and(&u.expr),
            _ => false,
        }
    }

    fn contains_not(e: &AslExpr) -> bool {
        match e {
            AslExpr::Unary(u) =>
                matches!(u.op, UnaryOp::Not) || contains_not(&u.expr),
            AslExpr::Binary(b) => contains_not(&b.left) || contains_not(&b.right),
            _ => false,
        }
    }
}
