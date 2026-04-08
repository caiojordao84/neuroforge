//! Ladder to ASL transformer
//!
//! This module provides bidirectional conversion between Ladder Logic (PLCopen XML)
//! and ASL IR (AslProgram).
//!
//! ## Architecture
//!
//! - `LadderToAslTransformer`: Parses PLCopen XML Ladder Diagram to AslProgram
//! - `AslToLadderGenerator`: Generates PLCopen XML Ladder Diagram from AslProgram
//! - `LadderToStConverter`: Converts Ladder Logic to Structured Text (IEC 61131-3)
//!
//! ## Usage
//!
//! ```rust,ignore
//! use neuroforge_asl::transforms::ladder_to_asl::{LadderToAslTransformer, LadderSource};
//!
//! // Parse Ladder from PLCopen XML
//! let xml = r#"<?xml version="1.0"?><project>...</project>"#;
//! let result = LadderToAslTransformer::transform(LadderSource::Xml(xml));
//! assert!(result.is_ok());
//! ```

use thiserror::Error;

use crate::types::asl_types::{AslMetadata, AslProgram};

/// Errors that can occur during ladder transformation
#[derive(Debug, Error)]
pub enum LadderTransformError {
    #[error("XML parsing error: {0}")]
    XmlError(String),

    #[error("Invalid ladder element: {0}")]
    InvalidElement(String),

    #[error("Empty ladder program")]
    EmptyProgram,

    #[error("Unsupported ladder element: {0}")]
    UnsupportedElement(String),
}

/// Source format for ladder input
#[derive(Debug, Clone)]
pub enum LadderSource<'a> {
    /// PLCopen XML format
    Xml(&'a str),

    /// Internal LadderProgram structure
    Internal(crate::asl_types::LadderProgram),
}

impl LadderSource<'_> {
    /// Get the source type name for error messages
    pub fn source_type(&self) -> &'static str {
        match self {
            LadderSource::Xml(_) => "PLCopen XML",
            LadderSource::Internal(_) => "LadderProgram",
        }
    }
}

/// Main transformer for Ladder to ASL conversion
pub struct LadderToAslTransformer;

impl LadderToAslTransformer {
    /// Transform Ladder source to ASL Program
    ///
    /// Supports both PLCopen XML and internal LadderProgram formats
    pub fn transform(source: LadderSource<'_>) -> Result<AslProgram, LadderTransformError> {
        match source {
            LadderSource::Xml(xml) => Self::parse_xml(xml),
            LadderSource::Internal(ladder) => Self::transform_internal(ladder),
        }
    }

    /// Parse PLCopen XML format to AslProgram
    fn parse_xml(xml: &str) -> Result<AslProgram, LadderTransformError> {
        use crate::plugins::plc::ld::parser::LdParser;

        LdParser::parse(xml).map_err(|e| LadderTransformError::XmlError(e.to_string()))
    }

    /// Transform internal LadderProgram to AslProgram
    fn transform_internal(
        ladder: crate::asl_types::LadderProgram,
    ) -> Result<AslProgram, LadderTransformError> {
        if ladder.rungs.is_empty() {
            return Err(LadderTransformError::EmptyProgram);
        }

        let mut stmts = Vec::new();

        // Process each rung
        for (idx, rung) in ladder.rungs.iter().enumerate() {
            let rung_stmts = Self::rung_to_asl(rung, idx as u32)?;
            stmts.extend(rung_stmts);
        }

        let mut func = crate::types::asl_types::AslFunction::default();
        func.name = ladder.name.clone();
        func.body = stmts;

        Ok(AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: Some(ladder.name.clone()),
                description: None,
                version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![],
            globals: ladder
                .variables
                .iter()
                .map(|v| {
                    crate::types::asl_types::AslGlobalVar {
                        name: v.name.clone(),
                        r#type: crate::types::asl_types::AslType::Bool, // default
                        value: v.initial_value.clone(),
                        struct_type: None,
                        mutable: false,
                        scope: "global".to_string(),
                        lifecycle: "normal".to_string(),
                        comments: v.comment.as_ref().map(|c| vec![c.clone()]),
                    }
                })
                .collect(),
            functions: vec![func],
            tasks: vec![],
            ..Default::default()
        })
    }

    /// Convert a single Ladder rung to ASL statements
    fn rung_to_asl(
        rung: &crate::asl_types::LadderRung,
        rung_num: u32,
    ) -> Result<Vec<crate::types::asl_types::AslStatement>, LadderTransformError> {
        let mut stmts = Vec::new();

        // Group elements into contacts (conditions) and coils (outputs)
        let mut contacts: Vec<&crate::asl_types::LadderElement> = Vec::new();
        let mut coils: Vec<&crate::asl_types::LadderElement> = Vec::new();

        for elem in &rung.elements {
            match elem {
                crate::asl_types::LadderElement::ContactNo(_)
                | crate::asl_types::LadderElement::ContactNc(_)
                | crate::asl_types::LadderElement::ContactRising(_)
                | crate::asl_types::LadderElement::ContactFalling(_) => {
                    contacts.push(elem);
                }
                crate::asl_types::LadderElement::CoilOutput(_)
                | crate::asl_types::LadderElement::CoilNegated(_)
                | crate::asl_types::LadderElement::CoilSet(_)
                | crate::asl_types::LadderElement::CoilReset(_) => {
                    coils.push(elem);
                }
                // Timers, counters, latches, FBs need special handling
                _ => {
                    // For now, add as comment
                    stmts.push(crate::types::asl_types::AslStatement::Comment(
                        crate::asl_types::AslComment {
                            text: format!("Rung {}: Unsupported element type", rung_num),
                        },
                    ));
                }
            }
        }

        // Build expression from contacts (series = AND, parallel = OR would need graph analysis)
        // For now, create sequential if-then structure
        if coils.is_empty() {
            return Ok(stmts);
        }

        // Create the main assignment for the first coil
        let coil = &coils[0];
        let target = match coil {
            crate::asl_types::LadderElement::CoilOutput(c) => c.variable.clone(),
            crate::asl_types::LadderElement::CoilNegated(c) => c.variable.clone(),
            crate::asl_types::LadderElement::CoilSet(c) => c.variable.clone(),
            crate::asl_types::LadderElement::CoilReset(c) => c.variable.clone(),
            _ => return Ok(stmts),
        };

        // Build condition from contacts
        let condition = Self::contacts_to_expr(&contacts);

        // Create if statement with coil as assignment
        let value = if contacts.is_empty() {
            crate::types::asl_types::AslExpr::Literal(crate::types::asl_types::AslLiteral {
                value: serde_json::json!(true),
            })
        } else {
            condition
        };

        stmts.push(crate::types::asl_types::AslStatement::Assign(
            crate::types::asl_types::AslAssign {
                target,
                value,
                ..Default::default()
            },
        ));

        // Process remaining coils
        for coil in coils.iter().skip(1) {
            let target = match coil {
                crate::asl_types::LadderElement::CoilOutput(c) => c.variable.clone(),
                crate::asl_types::LadderElement::CoilNegated(c) => c.variable.clone(),
                crate::asl_types::LadderElement::CoilSet(c) => c.variable.clone(),
                crate::asl_types::LadderElement::CoilReset(c) => c.variable.clone(),
                _ => continue,
            };

            stmts.push(crate::types::asl_types::AslStatement::Assign(
                crate::types::asl_types::AslAssign {
                    target,
                    value: crate::types::asl_types::AslExpr::Literal(
                        crate::types::asl_types::AslLiteral {
                            value: serde_json::json!(true),
                        },
                    ),
                    ..Default::default()
                },
            ));
        }

        Ok(stmts)
    }

    /// Convert contacts to ASL expression (simple series AND for now)
    fn contacts_to_expr(
        contacts: &[&crate::asl_types::LadderElement],
    ) -> crate::types::asl_types::AslExpr {
        use crate::types::asl_types::{AslBinary, AslExpr, AslVarRef, BinaryOp};

        if contacts.is_empty() {
            return AslExpr::Literal(crate::types::asl_types::AslLiteral {
                value: serde_json::json!(true),
            });
        }

        // Simple: series = AND
        let mut result: Option<AslExpr> = None;

        for contact in contacts {
            let var_name = match contact {
                crate::asl_types::LadderElement::ContactNo(c) => c.variable.clone(),
                crate::asl_types::LadderElement::ContactNc(c) => c.variable.clone(),
                crate::asl_types::LadderElement::ContactRising(c) => c.variable.clone(),
                crate::asl_types::LadderElement::ContactFalling(c) => c.variable.clone(),
                _ => continue,
            };

            let var_expr = AslExpr::Var(AslVarRef { name: var_name });

            let negated = matches!(contact, crate::asl_types::LadderElement::ContactNc(_));

            let expr = if negated {
                AslExpr::Unary(Box::new(crate::types::asl_types::AslUnary {
                    op: crate::types::asl_types::UnaryOp::Not,
                    expr: var_expr,
                }))
            } else {
                var_expr
            };

            result = Some(match result {
                None => expr,
                Some(prev) => AslExpr::Binary(Box::new(AslBinary {
                    op: BinaryOp::And,
                    left: prev,
                    right: expr,
                })),
            });
        }

        result.unwrap_or(AslExpr::Literal(crate::types::asl_types::AslLiteral {
            value: serde_json::json!(true),
        }))
    }
}

/// Generator for ASL to Ladder conversion
pub struct AslToLadderGenerator;

impl AslToLadderGenerator {
    /// Generate Ladder Diagram (PLCopen XML) from ASL Program
    pub fn generate(program: &AslProgram) -> String {
        use crate::plugins::plc::ld::generator::LdGenerator;

        LdGenerator::new().generate(program)
    }

    /// Generate internal LadderProgram from ASL Program
    pub fn generate_internal(program: &AslProgram) -> crate::asl_types::LadderProgram {
        let mut ladder = crate::asl_types::LadderProgram::new(
            program.metadata.name.as_deref().unwrap_or("Program"),
        );

        for func in &program.functions {
            for (idx, stmt) in func.body.iter().enumerate() {
                let mut rung = crate::asl_types::LadderRung::new(idx as u32 + 1);

                match stmt {
                    crate::types::asl_types::AslStatement::Assign(a) => {
                        // Convert expression back to contacts
                        let contacts = Self::expr_to_contacts(&a.value);

                        for contact in contacts {
                            rung.add_element(contact);
                        }

                        // Add coil
                        rung.add_element(crate::asl_types::LadderElement::coil_output(&a.target));
                    }
                    _ => {}
                }

                ladder.add_rung(rung);
            }
        }

        ladder
    }

    /// Convert ASL expression to Ladder contacts
    fn expr_to_contacts(
        expr: &crate::types::asl_types::AslExpr,
    ) -> Vec<crate::asl_types::LadderElement> {
        use crate::types::asl_types::{AslBinary, AslExpr, AslUnary, BinaryOp, UnaryOp};

        let mut contacts = Vec::new();

        match expr {
            AslExpr::Var(v) => {
                contacts.push(crate::asl_types::LadderElement::contact_no(&v.name));
            }
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    contacts.push(crate::asl_types::LadderElement::contact_nc(&v.name));
                }
            }
            AslExpr::Binary(b) if matches!(b.op, BinaryOp::And) => {
                contacts.extend(Self::expr_to_contacts(&b.left));
                contacts.extend(Self::expr_to_contacts(&b.right));
            }
            AslExpr::Binary(b) if matches!(b.op, BinaryOp::Or) => {
                // For parallel branches, we'd need branch support
                // For now, just take first branch
                contacts.extend(Self::expr_to_contacts(&b.left));
            }
            _ => {}
        }

        contacts
    }
}

/// Bidirectional conversion utilities
pub mod bidirectional {
    use super::*;

    /// Round-trip test: Ladder -> ASL -> Ladder
    pub fn roundtrip_xml(xml: &str) -> Result<String, LadderTransformError> {
        let program = LadderToAslTransformer::transform(LadderSource::Xml(xml))?;
        Ok(AslToLadderGenerator::generate(&program))
    }

    /// Round-trip test: LadderProgram -> ASL -> LadderProgram
    pub fn roundtrip_internal(
        ladder: crate::asl_types::LadderProgram,
    ) -> Result<crate::asl_types::LadderProgram, LadderTransformError> {
        let program = LadderToAslTransformer::transform(LadderSource::Internal(ladder))?;
        Ok(AslToLadderGenerator::generate_internal(&program))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_LADDER_XML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://www.plcopen.org/xml/tc6_0201">
  <fileHeader companyName="Test" productName="Test" productVersion="1" creationDateTime="2026-01-01T00:00:00"/>
  <contentHeader name="TestProject" modificationDateTime="2026-01-01T00:00:00">
    <coordinateInfo><fbd><scaling x="1" y="1"/></fbd><ld><scaling x="1" y="1"/></ld><sfc><scaling x="1" y="1"/></sfc></coordinateInfo>
  </contentHeader>
  <types>
    <pous>
      <pou name="Main" pouType="program">
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
              <variable>Start</variable>
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
"#;

    #[test]
    fn transform_xml_to_asl() {
        let result = LadderToAslTransformer::transform(LadderSource::Xml(SAMPLE_LADDER_XML));
        assert!(result.is_ok(), "Should parse successfully: {:?}", result);

        let program = result.unwrap();
        assert!(!program.functions.is_empty());
        assert_eq!(program.functions[0].name, "Main");
    }

    #[test]
    fn generate_ladder_from_asl() {
        let program =
            LadderToAslTransformer::transform(LadderSource::Xml(SAMPLE_LADDER_XML)).unwrap();

        let xml_out = AslToLadderGenerator::generate(&program);
        assert!(xml_out.contains("Main"));
        assert!(xml_out.contains("<LD>"));
    }

    #[test]
    fn roundtrip_preserves_name() {
        let result = bidirectional::roundtrip_xml(SAMPLE_LADDER_XML);
        assert!(result.is_ok());

        let out = result.unwrap();
        assert!(out.contains("Main"));
    }
}
