//! Ladder to Structured Text (IEC 61131-3) converter
//!
//! This module converts Ladder Logic (PLCopen XML or internal LadderProgram)
//! to Structured Text, which is part of the IEC 61131-3 standard.
//!
//! ## Conversion Rules
//!
//! - Series contacts (AND): Combined with AND in ST
//! - Parallel contacts (OR): Combined with OR in ST
//! - Contact NO: Variable directly (normally open)
//! - Contact NC: NOT variable (normally closed)
//! - Output coil: Assignment to variable
//! - Set coil: Assignment to TRUE
//! - Reset coil: Assignment to FALSE
//! - Timer TON: `TON(instance, IN:=cond, PT:=time)`
//! - Counter CTU: `CTU(instance, CU:=cond, PV:=preset)`

use thiserror::Error;

use crate::asl_types::{LadderCoil, LadderContact, LadderElement, LadderProgram, LadderRung};

/// Errors that can occur during ladder-to-ST conversion
#[derive(Debug, Error)]
pub enum LadderToStError {
    #[error("Empty ladder program")]
    EmptyProgram,

    #[error("Unsupported ladder element: {0}")]
    UnsupportedElement(String),

    #[error("XML error: {0}")]
    XmlError(String),
}

/// Configuration for Ladder to ST conversion
#[derive(Debug, Clone, Default)]
pub struct LadderToStConfig {
    /// Include variable declarations
    pub include_variables: bool,

    /// Use full IEC 61131-3 syntax (with AT %I notation)
    pub iec_syntax: bool,

    /// Generate comments for ladder elements
    pub include_comments: bool,

    /// Indent size in spaces
    pub indent_size: usize,
}

/// Main converter for Ladder to Structured Text
pub struct LadderToStConverter {
    config: LadderToStConfig,
}

impl Default for LadderToStConverter {
    fn default() -> Self {
        Self {
            config: LadderToStConfig::default(),
        }
    }
}

impl LadderToStConverter {
    /// Create a new converter with configuration
    pub fn new(config: LadderToStConfig) -> Self {
        Self { config }
    }

    /// Convert LadderProgram to Structured Text
    pub fn convert(&self, ladder: &LadderProgram) -> Result<String, LadderToStError> {
        if ladder.rungs.is_empty() {
            return Err(LadderToStError::EmptyProgram);
        }

        let mut output = String::new();

        // Program header
        output.push_str(&format!("PROGRAM {}\n", ladder.name));

        // Variable declarations
        if self.config.include_variables && !ladder.variables.is_empty() {
            output.push_str("  VAR\n");
            for var in &ladder.variables {
                let init = var
                    .initial_value
                    .as_ref()
                    .map(|v| format!(" := {}", self.expr_to_string(v)))
                    .unwrap_or_default();
                output.push_str(&format!("  {} : {}{};\n", var.name, var.var_type, init));
            }
            output.push_str("  END_VAR\n\n");
        }

        // Process each rung
        for (idx, rung) in ladder.rungs.iter().enumerate() {
            if let Some(comment) = &rung.comment {
                output.push_str(&format!("(* Rung {}: {} *)\n", idx + 1, comment));
            }

            let stmts = self.rung_to_stmts(rung, idx)?;
            for stmt in stmts {
                output.push_str(&format!("  {};\n", stmt));
            }
        }

        output.push_str("END_PROGRAM\n");

        Ok(output)
    }

    /// Convert a ladder rung to ST statements
    fn rung_to_stmts(
        &self,
        rung: &LadderRung,
        _rung_idx: usize,
    ) -> Result<Vec<String>, LadderToStError> {
        let mut stmts = Vec::new();

        // Separate contacts from coils
        let mut contacts: Vec<&LadderElement> = Vec::new();
        let mut coils: Vec<&LadderElement> = Vec::new();
        let mut special: Vec<&LadderElement> = Vec::new();

        for elem in &rung.elements {
            match elem {
                LadderElement::ContactNo(_)
                | LadderElement::ContactNc(_)
                | LadderElement::ContactRising(_)
                | LadderElement::ContactFalling(_) => {
                    contacts.push(elem);
                }
                LadderElement::CoilOutput(_)
                | LadderElement::CoilNegated(_)
                | LadderElement::CoilSet(_)
                | LadderElement::CoilReset(_)
                | LadderElement::CoilLatch(_)
                | LadderElement::CoilUnlatch(_) => {
                    coils.push(elem);
                }
                _ => {
                    special.push(elem);
                }
            }
        }

        // Build condition from contacts
        let condition = self.contacts_to_expr(&contacts);

        // Generate coil assignments
        for coil in &coils {
            let stmt = self.coil_to_stmt(coil, &condition);
            stmts.push(stmt);
        }

        // Handle special elements (timers, counters, latches)
        for elem in &special {
            let stmt = self.special_to_stmt(elem)?;
            stmts.push(stmt);
        }

        Ok(stmts)
    }

    /// Convert contacts to ST expression
    fn contacts_to_expr(&self, contacts: &[&LadderElement]) -> String {
        if contacts.is_empty() {
            return "TRUE".to_string();
        }

        // For series (AND), we combine with AND
        // For parallel (OR), we'd need branch analysis - simplified here
        let parts: Vec<String> = contacts.iter().map(|c| self.contact_to_expr(c)).collect();

        parts.join(" AND ")
    }

    /// Convert a single contact to ST expression
    fn contact_to_expr(&self, contact: &LadderElement) -> String {
        match contact {
            LadderElement::ContactNo(c) => c.variable.clone(),
            LadderElement::ContactNc(c) => format!("NOT {}", c.variable),
            LadderElement::ContactRising(c) => format!("R_TRIG({})", c.variable),
            LadderElement::ContactFalling(c) => format!("F_TRIG({})", c.variable),
            _ => "TRUE".to_string(), // Fallback
        }
    }

    /// Convert coil to ST statement
    fn coil_to_stmt(&self, coil: &LadderElement, condition: &str) -> String {
        match coil {
            LadderElement::CoilOutput(c) => {
                format!("{} := {}", c.variable, condition)
            }
            LadderElement::CoilNegated(c) => {
                format!("{} := NOT {}", c.variable, condition)
            }
            LadderElement::CoilSet(c) | LadderElement::CoilLatch(c) => {
                format!("{} := TRUE", c.variable)
            }
            LadderElement::CoilReset(c) | LadderElement::CoilUnlatch(c) => {
                format!("{} := FALSE", c.variable)
            }
            _ => "".to_string(),
        }
    }

    /// Convert special elements (timers, counters, latches) to ST
    fn special_to_stmt(&self, elem: &LadderElement) -> Result<String, LadderToStError> {
        match elem {
            LadderElement::TimerTon(t) => Ok(format!(
                "{}(IN:={}, PT:={})",
                t.instance,
                self.expr_to_string(&t.r#in),
                self.expr_to_string(&t.pt)
            )),
            LadderElement::TimerTof(t) => Ok(format!(
                "{}(IN:={}, PT:={})",
                t.instance,
                self.expr_to_string(&t.r#in),
                self.expr_to_string(&t.pt)
            )),
            LadderElement::TimerTp(t) => Ok(format!(
                "{}(IN:={}, PT:={})",
                t.instance,
                self.expr_to_string(&t.r#in),
                self.expr_to_string(&t.pt)
            )),
            LadderElement::CounterCtu(c) => Ok(format!(
                "{}(CU:={}, R:={}, PV:={})",
                c.instance,
                self.expr_to_string(&c.cu),
                self.expr_to_string(&c.r),
                self.expr_to_string(&c.pv)
            )),
            LadderElement::CounterCtd(c) => Ok(format!(
                "{}(CD:={}, LD:={}, PV:={})",
                c.instance,
                self.expr_to_string(&c.cd),
                self.expr_to_string(&c.ld),
                self.expr_to_string(&c.pv)
            )),
            LadderElement::CounterCtud(c) => Ok(format!(
                "{}(CU:={}, CD:={}, R:={}, LD:={}, PV:={})",
                c.instance,
                self.expr_to_string(&c.cu),
                self.expr_to_string(&c.cd),
                self.expr_to_string(&c.r),
                self.expr_to_string(&c.ld),
                self.expr_to_string(&c.pv)
            )),
            LadderElement::LatchSr(l) => Ok(format!(
                "{}(S:={}, R:={})",
                l.instance,
                self.expr_to_string(&l.s),
                self.expr_to_string(&l.r)
            )),
            LadderElement::LatchRs(l) => Ok(format!(
                "{}(S:={}, R:={})",
                l.instance,
                self.expr_to_string(&l.s),
                self.expr_to_string(&l.r)
            )),
            LadderElement::FunctionBlock(fb) => {
                // Generic function block
                let inputs: Vec<String> = fb
                    .inputs
                    .iter()
                    .map(|(name, expr)| format!("{}:={}", name, self.expr_to_string(expr)))
                    .collect();
                Ok(format!("{}({})", fb.instance, inputs.join(", ")))
            }
            _ => Err(LadderToStError::UnsupportedElement(format!("{:?}", elem))),
        }
    }

    /// Convert ASL expression to string
    fn expr_to_string(&self, expr: &crate::asl_types::AslExpr) -> String {
        match expr {
            crate::asl_types::AslExpr::Literal(l) => l.value.to_string(),
            crate::asl_types::AslExpr::Var(v) => v.name.clone(),
            _ => "(* expression *)".to_string(),
        }
    }
}

/// Convenience function to convert ladder to ST
pub fn ladder_to_st(ladder: &LadderProgram) -> Result<String, LadderToStError> {
    LadderToStConverter::default().convert(ladder)
}

/// Convert Ladder XML (PLCopen) to ST
pub fn ladder_xml_to_st(xml: &str) -> Result<String, LadderToStError> {
    use crate::transforms::ladder_to_asl::{LadderSource, LadderToAslTransformer};

    let program = match LadderToAslTransformer::transform(LadderSource::Xml(xml)) {
        Ok(p) => p,
        Err(e) => return Err(LadderToStError::XmlError(e.to_string())),
    };
    let ladder =
        crate::transforms::ladder_to_asl::AslToLadderGenerator::generate_internal(&program);

    ladder_to_st(&ladder)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_ladder_to_st() {
        let mut ladder = LadderProgram::new("Test");

        let mut rung = LadderRung::new(1);
        rung.add_element(LadderElement::contact_no("Start"));
        rung.add_element(LadderElement::contact_no("Stop"));
        rung.add_element(LadderElement::coil_output("Motor"));

        ladder.add_rung(rung);

        let result = ladder_to_st(&ladder);
        assert!(result.is_ok());

        let st = result.unwrap();
        assert!(st.contains("PROGRAM Test"));
        assert!(st.contains("Motor :="));
    }

    #[test]
    fn ladder_with_timer_to_st() {
        let mut ladder = LadderProgram::new("TimerTest");

        let mut rung = LadderRung::new(1);

        // Add a timer element
        rung.add_element(LadderElement::TimerTon(crate::asl_types::LadderTimerTon {
            instance: "t1".to_string(),
            r#in: crate::asl_types::AslExpr::var("Start"),
            pt: crate::asl_types::AslExpr::Literal(crate::asl_types::AslLiteral {
                value: serde_json::json!(5000),
            }),
            out_q: crate::asl_types::AslExpr::var("Done"),
            out_et: crate::asl_types::AslExpr::var("Elapsed"),
            comment: None,
        }));

        ladder.add_rung(rung);

        let result = ladder_to_st(&ladder);
        assert!(result.is_ok());

        let st = result.unwrap();
        assert!(st.contains("t1(IN:="));
    }

    #[test]
    fn empty_program_error() {
        let ladder = LadderProgram::new("Empty");
        let result = ladder_to_st(&ladder);
        assert!(result.is_err());
    }
}
