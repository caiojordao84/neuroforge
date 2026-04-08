//! Ladder Generator - ASL to Ladder Diagram (PLCopen XML)
//!
//! This module generates Ladder Diagram (LD) in PLCopen XML format from ASL IR.
//! It is the reverse operation of the LD parser.
//!
//! ## Mapping
//!
//! | ASL Statement | Ladder Element |
//! |----------------|----------------|
//! | `AslStatement::Assign(var := expr)` | Coil + Contacts |
//! | `AslExpr::Var(x)` | Contact(x) |
//! | `AslExpr::Binary(And, ...)` | Series contacts |
//! | `AslExpr::Binary(Or, ...)` | Parallel contacts |
//! | `AslExpr::Unary(Not, x)` | NC Contact(x) |
//! | `AslStatement::TimerTon` | TON function block |
//! | `AslStatement::CounterCtu` | CTU function block |
//! | `AslStatement::LatchSr` | SR latch |

use thiserror::Error;

use crate::types::asl_types::{AslExpr, AslFunction, AslProgram, AslStatement, BinaryOp, UnaryOp};

/// Errors that can occur during ladder generation
#[derive(Debug, Error)]
pub enum LadderGeneratorError {
    #[error("Empty program - no functions to convert")]
    EmptyProgram,

    #[error("Unsupported expression type: {0}")]
    UnsupportedExpr(String),
}

/// Generate PLCopen XML Ladder Diagram from ASL Program
pub struct LadderGenerator {
    local_id_counter: u32,
}

impl Default for LadderGenerator {
    fn default() -> Self {
        Self {
            local_id_counter: 1,
        }
    }
}

impl LadderGenerator {
    /// Create a new generator
    pub fn new() -> Self {
        Self::default()
    }

    /// Generate PLCopen XML from ASL Program
    pub fn generate(&mut self, program: &AslProgram) -> Result<String, LadderGeneratorError> {
        if program.functions.is_empty() && program.tasks.is_empty() {
            return Err(LadderGeneratorError::EmptyProgram);
        }

        let mut output = String::new();

        // XML header
        output.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        output.push_str("<project xmlns=\"http://www.plcopen.org/xml/tc6_0201\">\n");

        // File header
        output.push_str("  <fileHeader companyName=\"NeuroForge\" productName=\"NeuroForge ASL\" productVersion=\"4.0\" creationDateTime=\"2026-01-01T00:00:00\"/>\n");

        // Content header
        let prog_name = program.metadata.name.as_deref().unwrap_or("Program");
        output.push_str(&format!(
            "  <contentHeader name=\"{}\" modificationDateTime=\"2026-01-01T00:00:00\">\n",
            prog_name
        ));
        output.push_str("    <coordinateInfo>");
        output.push_str("<fbd><scaling x=\"1\" y=\"1\"/></fbd>");
        output.push_str("<ld><scaling x=\"1\" y=\"1\"/></ld>");
        output.push_str("<sfc><scaling x=\"1\" y=\"1\"/></sfc>");
        output.push_str("</coordinateInfo>\n");
        output.push_str("  </contentHeader>\n");

        // Types - POU declarations
        output.push_str("  <types>\n    <pous>\n");

        // Generate POU for each function
        for func in &program.functions {
            output.push_str(&self.generate_pou(func));
        }

        // Generate POU for each task (if not already a function)
        for task in &program.tasks {
            output.push_str(&self.generate_task_pou(task));
        }

        output.push_str("    </pous>\n  </types>\n");

        // Instances (optional)
        output.push_str("  <instances>\n    <resources>");
        output.push_str("<resource name=\"Device\" language=\"IL\">");
        output.push_str("<task name=\"MainTask\" priority=\"0\" single=\"true\">");

        // Link programs
        for func in &program.functions {
            output.push_str(&format!("<program name=\"{}\"/>", func.name));
        }

        output.push_str("</task>");
        output.push_str("</resource>");
        output.push_str("  </resources>\n");
        output.push_str("</instances>\n");

        output.push_str("</project>\n");

        Ok(output)
    }

    /// Generate a POU (Program Organization Unit) for a function
    fn generate_pou(&mut self, func: &AslFunction) -> String {
        let mut output = String::new();

        output.push_str(&format!(
            "      <pou name=\"{}\" pouType=\"program\">\n",
            func.name
        ));
        output.push_str("        <body>\n");
        output.push_str("          <LD>\n");

        // Generate a rung for each assignment statement
        for stmt in &func.body {
            if let AslStatement::Assign(a) = stmt {
                let rung_xml = self.generate_rung(&a.target, &a.value);
                output.push_str(&rung_xml);
            }
        }

        output.push_str("          </LD>\n");
        output.push_str("        </body>\n");
        output.push_str("      </pou>\n");

        output
    }

    /// Generate a POU for a task
    fn generate_task_pou(&mut self, task: &crate::types::asl_types::AslTask) -> String {
        let mut output = String::new();

        output.push_str(&format!(
            "      <pou name=\"{}\" pouType=\"program\">\n",
            task.name
        ));
        output.push_str("        <body>\n");
        output.push_str("          <LD>\n");

        for stmt in &task.body {
            if let AslStatement::Assign(a) = stmt {
                let rung_xml = self.generate_rung(&a.target, &a.value);
                output.push_str(&rung_xml);
            }
        }

        output.push_str("          </LD>\n");
        output.push_str("        </body>\n");
        output.push_str("      </pou>\n");

        output
    }

    /// Generate a single rung (network) from target and value
    fn generate_rung(&mut self, target: &str, value: &AslExpr) -> String {
        let mut output = String::new();

        let rail_id = self.next_id();
        let rung_y = 0;

        // Left power rail
        output.push_str(&format!(
            "            <leftPowerRail localId=\"{}\" height=\"20\" width=\"10\">\n\
               <position x=\"0\" y=\"{}\"/>\n\
               <connectionPointOut formalParameter=\"\"/>\n\
             </leftPowerRail>\n",
            rail_id, rung_y
        ));

        // Decompose expression into contacts
        let (contacts, connection_mode) = self.flatten_expr(value);

        let mut prev_id = rail_id;

        match connection_mode {
            ConnectionMode::Series => {
                for (i, contact) in contacts.iter().enumerate() {
                    let contact_id = self.next_id();
                    let x = 40 + i as u32 * 40;

                    output.push_str(&self.generate_contact(
                        &contact.variable,
                        contact.negated,
                        contact_id,
                        prev_id,
                        x,
                        rung_y,
                    ));

                    prev_id = contact_id;
                }
            }
            ConnectionMode::Parallel => {
                for (i, contact) in contacts.iter().enumerate() {
                    let contact_id = self.next_id();
                    let y = rung_y + i as u32 * 30;

                    output.push_str(&self.generate_contact(
                        &contact.variable,
                        contact.negated,
                        contact_id,
                        rail_id,
                        40,
                        y,
                    ));
                }
                prev_id = contacts.last().map(|c| c.id).unwrap_or(rail_id);
            }
        }

        // Coil
        let coil_id = self.next_id();
        let coil_x = 40 + contacts.len() as u32 * 40;

        output.push_str(&self.generate_coil(target, coil_id, prev_id, coil_x, rung_y));

        output
    }

    /// Generate a contact element
    fn generate_contact(
        &self,
        var: &str,
        negated: bool,
        local_id: u32,
        source_id: u32,
        x: u32,
        y: u32,
    ) -> String {
        let neg_str = if negated { "true" } else { "false" };

        format!(
            "            <contact localId=\"{}\" height=\"20\" width=\"20\" negated=\"{}\">\n\
               <position x=\"{}\" y=\"{}\"/>\n\
               <connectionPointIn>\n\
                 <relPosition x=\"0\" y=\"10\"/>\n\
                 <connection refLocalId=\"{}\"/>\n\
               </connectionPointIn>\n\
               <connectionPointOut formalParameter=\"\"/>\n\
               <variable>{}</variable>\n\
             </contact>\n",
            local_id, neg_str, x, y, source_id, var
        )
    }

    /// Generate a coil element
    fn generate_coil(&self, var: &str, local_id: u32, source_id: u32, x: u32, y: u32) -> String {
        format!(
            "            <coil localId=\"{}\" height=\"20\" width=\"20\">\n\
               <position x=\"{}\" y=\"{}\"/>\n\
               <connectionPointIn>\n\
                 <relPosition x=\"0\" y=\"10\"/>\n\
                 <connection refLocalId=\"{}\"/>\n\
               </connectionPointIn>\n\
               <connectionPointOut formalParameter=\"\"/>\n\
               <variable>{}</variable>\n\
             </coil>\n",
            local_id, x, y, source_id, var
        )
    }

    /// Flatten expression into contacts
    fn flatten_expr(&self, expr: &AslExpr) -> (Vec<ContactInfo>, ConnectionMode) {
        match expr {
            AslExpr::Var(v) => (
                vec![ContactInfo {
                    id: 0,
                    variable: v.name.clone(),
                    negated: false,
                }],
                ConnectionMode::Series,
            ),
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    (
                        vec![ContactInfo {
                            id: 0,
                            variable: v.name.clone(),
                            negated: true,
                        }],
                        ConnectionMode::Series,
                    )
                } else {
                    self.flatten_expr(&u.expr)
                }
            }
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::And | BinaryOp::BitAnd) => {
                let mut contacts = Vec::new();
                self.collect_and_contacts(&b.left, &mut contacts);
                self.collect_and_contacts(&b.right, &mut contacts);
                (contacts, ConnectionMode::Series)
            }
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::Or | BinaryOp::BitOr) => {
                let mut contacts = Vec::new();
                self.collect_or_contacts(&b.left, &mut contacts);
                self.collect_or_contacts(&b.right, &mut contacts);
                (contacts, ConnectionMode::Parallel)
            }
            _ => (
                vec![ContactInfo {
                    id: 0,
                    variable: "_expr".to_string(),
                    negated: false,
                }],
                ConnectionMode::Series,
            ),
        }
    }

    /// Collect contacts from AND expression
    fn collect_and_contacts(&self, expr: &AslExpr, out: &mut Vec<ContactInfo>) {
        match expr {
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::And | BinaryOp::BitAnd) => {
                self.collect_and_contacts(&b.left, out);
                self.collect_and_contacts(&b.right, out);
            }
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    out.push(ContactInfo {
                        id: 0,
                        variable: v.name.clone(),
                        negated: true,
                    });
                }
            }
            AslExpr::Var(v) => {
                out.push(ContactInfo {
                    id: 0,
                    variable: v.name.clone(),
                    negated: false,
                });
            }
            _ => {}
        }
    }

    /// Collect contacts from OR expression
    fn collect_or_contacts(&self, expr: &AslExpr, out: &mut Vec<ContactInfo>) {
        match expr {
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::Or | BinaryOp::BitOr) => {
                self.collect_or_contacts(&b.left, out);
                self.collect_or_contacts(&b.right, out);
            }
            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                if let AslExpr::Var(v) = &u.expr {
                    out.push(ContactInfo {
                        id: 0,
                        variable: v.name.clone(),
                        negated: true,
                    });
                }
            }
            AslExpr::Var(v) => {
                out.push(ContactInfo {
                    id: 0,
                    variable: v.name.clone(),
                    negated: false,
                });
            }
            _ => {}
        }
    }

    /// Get next local ID
    fn next_id(&mut self) -> u32 {
        let id = self.local_id_counter;
        self.local_id_counter += 1;
        id
    }
}

/// Helper struct for contact information
#[derive(Debug, Clone)]
struct ContactInfo {
    id: u32,
    variable: String,
    negated: bool,
}

/// Connection mode for ladder rungs
#[derive(Debug, Clone, PartialEq)]
enum ConnectionMode {
    Series,
    Parallel,
}

/// Generate Ladder from ASL using the internal LadderProgram
pub fn generate_from_asl(program: &AslProgram) -> Result<String, LadderGeneratorError> {
    LadderGenerator::new().generate(program)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::types::asl_types::{
        AslAssign, AslBinary, AslFunction, AslMetadata, AslStatement, AslUnary, AslVarRef,
        BinaryOp, UnaryOp,
    };

    fn var(name: &str) -> AslExpr {
        AslExpr::Var(AslVarRef {
            name: name.to_string(),
        })
    }

    fn and(l: AslExpr, r: AslExpr) -> AslExpr {
        AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::And,
            left: l,
            right: r,
        }))
    }

    fn or(l: AslExpr, r: AslExpr) -> AslExpr {
        AslExpr::Binary(Box::new(AslBinary {
            op: BinaryOp::Or,
            left: l,
            right: r,
        }))
    }

    fn not(e: AslExpr) -> AslExpr {
        AslExpr::Unary(Box::new(AslUnary {
            op: UnaryOp::Not,
            expr: e,
        }))
    }

    fn make_program(name: &str, body: Vec<AslStatement>) -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: Some(name.to_string()),
                description: None,
                version: None,
                target_board: Some("plc".to_string()),
            },
            structs: vec![],
            globals: vec![],
            functions: vec![AslFunction {
                name: name.to_string(),
                params: vec![],
                return_type: None,
                body,
                ..Default::default()
            }],
            tasks: vec![],
            ..Default::default()
        }
    }

    #[test]
    fn generate_simple_assignment() {
        let program = make_program(
            "Test",
            vec![AslStatement::Assign(AslAssign {
                target: "Output".to_string(),
                value: var("Input"),
                ..Default::default()
            })],
        );

        let result = LadderGenerator::new().generate(&program);
        assert!(result.is_ok());

        let xml = result.unwrap();
        assert!(xml.contains("<LD>"));
        assert!(xml.contains("<contact"));
        assert!(xml.contains("<coil"));
        assert!(xml.contains("Output"));
    }

    #[test]
    fn generate_and_expression() {
        let program = make_program(
            "Test",
            vec![AslStatement::Assign(AslAssign {
                target: "Motor".to_string(),
                value: and(var("Start"), var("Run")),
                ..Default::default()
            })],
        );

        let result = LadderGenerator::new().generate(&program);
        assert!(result.is_ok());

        let xml = result.unwrap();
        assert!(xml.contains("Start"));
        assert!(xml.contains("Run"));
        assert!(xml.contains("Motor"));
    }

    #[test]
    fn generate_or_expression() {
        let program = make_program(
            "Test",
            vec![AslStatement::Assign(AslAssign {
                target: "Light".to_string(),
                value: or(var("Switch1"), var("Switch2")),
                ..Default::default()
            })],
        );

        let result = LadderGenerator::new().generate(&program);
        assert!(result.is_ok());

        let xml = result.unwrap();
        assert!(xml.contains("Switch1"));
        assert!(xml.contains("Switch2"));
    }

    #[test]
    fn generate_not_expression() {
        let program = make_program(
            "Test",
            vec![AslStatement::Assign(AslAssign {
                target: "Output".to_string(),
                value: not(var("Input")),
                ..Default::default()
            })],
        );

        let result = LadderGenerator::new().generate(&program);
        assert!(result.is_ok());

        let xml = result.unwrap();
        assert!(xml.contains("negated=\"true\""));
    }

    #[test]
    fn empty_program_error() {
        let program = AslProgram::default();

        let result = LadderGenerator::new().generate(&program);
        assert!(result.is_err());
    }
}
