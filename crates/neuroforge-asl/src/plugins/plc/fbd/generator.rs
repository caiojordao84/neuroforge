//! FBD Generator     AslProgram     PLCopen XML FBD.

//!

//! RT-9: invers  o do FbdParser. Converte cada AslStatement numa rede FBD:

//!

//!   Assign(Var)       inVariable + outVariable com connection

//!   Assign(Call)      inVariable(args) + block + outVariable

//!   TimerTon/Tof/Tp     inVariable(IN,PT) + block(TON/TOF/TP)

//!   CounterCtu/Ctd      inVariable(CU/CD,R/LD,PV) + block(CTU/CTD)

//!   LatchSr/Rs          inVariable(S1/R1,R/S) + block(SR/RS)

//!   TrigR/F             inVariable(CLK) + block(R_TRIG/F_TRIG)

//!

//! ## Formato de sa  da

//!

//! XML PLCopen TC6 completo com fileHeader, contentHeader e coordinateInfo.

//! localIds s  o contadores globais incrementais por fun    o.

//! Posi    es calculadas automaticamente (espa  amento fixo).

#![allow(dead_code)]

use crate::asl_types::{AslExpr, AslProgram, AslStatement, BinaryOp, UnaryOp};

pub struct FbdGenerator;

impl FbdGenerator {
    pub fn new() -> Self {
        Self
    }

    /// Gera PLCopen XML completo com body FBD para cada fun    o do programa.

    pub fn generate(&self, program: &AslProgram) -> String {
        let prog_name = program.metadata.name.as_deref().unwrap_or("Program");

        let mut out = String::new();

        out.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");

        out.push_str("<project xmlns=\"http://www.plcopen.org/xml/tc6_0201\">\n");

        out.push_str("  <fileHeader companyName=\"NeuroForge\" productName=\"NeuroForge ASL\" productVersion=\"1\" creationDateTime=\"2026-01-01T00:00:00\"/>\n");

        out.push_str(&format!(
            "  <contentHeader name=\"{}\" modificationDateTime=\"2026-01-01T00:00:00\">\n",
            prog_name
        ));

        out.push_str("    <coordinateInfo>");

        out.push_str("<fbd><scaling x=\"1\" y=\"1\"/></fbd>");

        out.push_str("<ld><scaling x=\"1\" y=\"1\"/></ld>");

        out.push_str("<sfc><scaling x=\"1\" y=\"1\"/></sfc>");

        out.push_str("</coordinateInfo>\n");

        out.push_str("  </contentHeader>\n");

        out.push_str("  <types>\n    <pous>\n");

        for func in &program.functions {
            let mut id = 1u32;

            let mut fbd_nodes = String::new();

            for stmt in &func.body {
                self.emit_stmt(stmt, &mut id, &mut fbd_nodes);
            }

            out.push_str(&format!(
                "      <pou name=\"{}\" pouType=\"program\">\n        <body>\n          <FBD>\n",
                func.name
            ));

            out.push_str(&fbd_nodes);

            out.push_str("          </FBD>\n        </body>\n      </pou>\n");
        }

        out.push_str("    </pous>\n  </types>\n</project>\n");

        out
    }

    //           Despacho de statements

    fn emit_stmt(&self, stmt: &AslStatement, id: &mut u32, out: &mut String) {
        match stmt {
            AslStatement::Assign(a) => self.emit_assign(&a.target, &a.value, id, out),

            AslStatement::TimerTon(t) => {
                let in_id = self.emit_in_var(&self.emit_expr(&t.r#in), id, out);

                let pt_id = self.emit_in_var(&self.emit_expr(&t.pt), id, out);

                self.emit_iec_block(
                    "TON",
                    &t.instance,
                    &[("IN", in_id), ("PT", pt_id)],
                    &["Q"],
                    id,
                    out,
                );
            }

            AslStatement::TimerTof(t) => {
                let in_id = self.emit_in_var(&self.emit_expr(&t.r#in), id, out);

                let pt_id = self.emit_in_var(&self.emit_expr(&t.pt), id, out);

                self.emit_iec_block(
                    "TOF",
                    &t.instance,
                    &[("IN", in_id), ("PT", pt_id)],
                    &["Q"],
                    id,
                    out,
                );
            }

            AslStatement::TimerTp(t) => {
                let in_id = self.emit_in_var(&self.emit_expr(&t.r#in), id, out);

                let pt_id = self.emit_in_var(&self.emit_expr(&t.pt), id, out);

                self.emit_iec_block(
                    "TP",
                    &t.instance,
                    &[("IN", in_id), ("PT", pt_id)],
                    &["Q"],
                    id,
                    out,
                );
            }

            AslStatement::CounterCtu(c) => {
                let cu_id = self.emit_in_var(&self.emit_expr(&c.cu), id, out);

                let r_id = self.emit_in_var(&self.emit_expr(&c.r), id, out);

                let pv_id = self.emit_in_var(&self.emit_expr(&c.pv), id, out);

                self.emit_iec_block(
                    "CTU",
                    &c.instance,
                    &[("CU", cu_id), ("R", r_id), ("PV", pv_id)],
                    &["Q", "CV"],
                    id,
                    out,
                );
            }

            AslStatement::CounterCtd(c) => {
                let cd_id = self.emit_in_var(&self.emit_expr(&c.cd), id, out);

                let ld_id = self.emit_in_var(&self.emit_expr(&c.ld), id, out);

                let pv_id = self.emit_in_var(&self.emit_expr(&c.pv), id, out);

                self.emit_iec_block(
                    "CTD",
                    &c.instance,
                    &[("CD", cd_id), ("LD", ld_id), ("PV", pv_id)],
                    &["Q", "CV"],
                    id,
                    out,
                );
            }

            AslStatement::LatchSr(l) => {
                let s_id = self.emit_in_var(&self.emit_expr(&l.s), id, out);

                let r_id = self.emit_in_var(&self.emit_expr(&l.r), id, out);

                self.emit_iec_block(
                    "SR",
                    &l.instance,
                    &[("S1", s_id), ("R", r_id)],
                    &["Q1"],
                    id,
                    out,
                );
            }

            AslStatement::LatchRs(l) => {
                let r_id = self.emit_in_var(&self.emit_expr(&l.r), id, out);

                let s_id = self.emit_in_var(&self.emit_expr(&l.s), id, out);

                self.emit_iec_block(
                    "RS",
                    &l.instance,
                    &[("R1", r_id), ("S", s_id)],
                    &["Q1"],
                    id,
                    out,
                );
            }

            AslStatement::TrigR(t) => {
                let clk_id = self.emit_in_var(&self.emit_expr(&t.r#in), id, out);

                self.emit_iec_block("R_TRIG", &t.instance, &[("CLK", clk_id)], &["Q"], id, out);
            }

            AslStatement::TrigF(t) => {
                let clk_id = self.emit_in_var(&self.emit_expr(&t.r#in), id, out);

                self.emit_iec_block("F_TRIG", &t.instance, &[("CLK", clk_id)], &["Q"], id, out);
            }

            AslStatement::Expr(e) => {
                if let AslExpr::Call(c) = &e.expr {
                    let arg_ids: Vec<(String, u32)> = c
                        .args
                        .iter()
                        .enumerate()
                        .map(|(i, arg)| {
                            let aid = self.emit_in_var(&self.emit_expr(arg), id, out);

                            (format!("IN{}", i + 1), aid)
                        })
                        .collect();

                    let pins: Vec<(&str, u32)> =
                        arg_ids.iter().map(|(f, id)| (f.as_str(), *id)).collect();

                    self.emit_iec_block(&c.callee, &c.callee, &pins, &["OUT"], id, out);
                }
            }

            // outros statements n  o t  m representa    o FBD directa
            _ => {}
        }
    }

    //           Assign

    fn emit_assign(&self, target: &str, value: &AslExpr, id: &mut u32, out: &mut String) {
        match value {
            AslExpr::Call(c) => {
                // Args     inVariable nodes

                let arg_ids: Vec<(String, u32)> = c
                    .args
                    .iter()
                    .enumerate()
                    .map(|(i, arg)| {
                        let aid = self.emit_in_var(&self.emit_expr(arg), id, out);

                        (format!("IN{}", i + 1), aid)
                    })
                    .collect();

                // Block

                let pins: Vec<(&str, u32)> =
                    arg_ids.iter().map(|(f, i)| (f.as_str(), *i)).collect();

                let blk_id = self.emit_block(&c.callee, &c.callee, &pins, &["OUT"], id, out);

                // outVariable ligado ao block

                self.emit_out_var(target, blk_id, id, out);
            }

            _ => {
                // Caso simples: inVariable     outVariable

                let expr_str = self.emit_expr(value);

                let src_id = self.emit_in_var(&expr_str, id, out);

                self.emit_out_var(target, src_id, id, out);
            }
        }
    }

    //           Emissores de n  s FBD

    /// Emite `<inVariable>` e devolve o localId atribu  do.

    fn emit_in_var(&self, expression: &str, id: &mut u32, out: &mut String) -> u32 {
        let cur = *id;

        let x = 10u32;

        let y = 10 + cur * 40;

        out.push_str(&format!(
            "            <inVariable localId=\"{}\" height=\"20\" width=\"60\">\n\

                           <position x=\"{}\" y=\"{}\"/>\n\

                           <connectionPointOut formalParameter=\"\"/>\n\

                           <expression>{}</expression>\n\

                         </inVariable>\n",
            cur, x, y, expression
        ));

        *id += 1;

        cur
    }

    /// Emite `<outVariable>` ligado a `source_id` e devolve o localId.

    fn emit_out_var(
        &self,
        expression: &str,
        source_id: u32,
        id: &mut u32,
        out: &mut String,
    ) -> u32 {
        let cur = *id;

        let x = 250u32;

        let y = 10 + source_id * 40;

        out.push_str(&format!(
            "            <outVariable localId=\"{}\" height=\"20\" width=\"60\">\n\

                           <position x=\"{}\" y=\"{}\"/>\n\

                           <connectionPointIn>\n\

                 <relPosition x=\"0\" y=\"10\"/>\n\

                 <connection refLocalId=\"{}\"/>\n\

               </connectionPointIn>\n\

             <expression>{}</expression>\n\

           </outVariable>\n",
            cur, x, y, source_id, expression
        ));

        *id += 1;

        cur
    }

    /// Emite `<block>` com pins de entrada e sa  da; devolve o localId do bloco.

    fn emit_block(
        &self,

        type_name: &str,

        instance_name: &str,

        inputs: &[(&str, u32)],

        outputs: &[&str],

        id: &mut u32,

        out: &mut String,
    ) -> u32 {
        let cur = *id;

        let h = 20 + inputs.len() as u32 * 20;

        let x = 130u32;

        let y = 10 + cur * 40;

        out.push_str(&format!(

            "            <block localId=\"{}\" typeName=\"{}\" instanceName=\"{}\" height=\"{}\" width=\"80\">\n\

               <position x=\"{}\" y=\"{}\"/>\n",

            cur, type_name, instance_name, h, x, y

        ));

        // inputVariables

        out.push_str("              <inputVariables>\n");

        for (i, (formal, src_id)) in inputs.iter().enumerate() {
            let rel_y = 10 + i as u32 * 20;

            out.push_str(&format!(
                "                <variable formalParameter=\"{}\">\n\

                   <connectionPointIn>\n\

                     <relPosition x=\"0\" y=\"{}\"/>\n\

                     <connection refLocalId=\"{}\"/>\n\

                   </connectionPointIn>\n\

                 </variable>\n",
                formal, rel_y, src_id
            ));
        }

        out.push_str("              </inputVariables>\n");

        // inOutVariables (vazio)

        out.push_str("              <inOutVariables/>\n");

        // outputVariables

        out.push_str("              <outputVariables>\n");

        for formal in outputs {
            out.push_str(&format!(
                "                <variable formalParameter=\"{}\">\n\

                   <connectionPointOut formalParameter=\"{}\"/>\n\

                 </variable>\n",
                formal, formal
            ));
        }

        out.push_str("              </outputVariables>\n");

        out.push_str("            </block>\n");

        *id += 1;

        cur
    }

    /// Atalho: emit_block + n  o emite outVariable (para FBs IEC sem assign expl  cito).

    fn emit_iec_block(
        &self,

        type_name: &str,

        instance_name: &str,

        inputs: &[(&str, u32)],

        outputs: &[&str],

        id: &mut u32,

        out: &mut String,
    ) {
        self.emit_block(type_name, instance_name, inputs, outputs, id, out);
    }

    //           emit_expr

    fn emit_expr(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                if l.value == serde_json::json!(true) {
                    return "TRUE".to_string();
                }

                if l.value == serde_json::json!(false) {
                    return "FALSE".to_string();
                }

                l.value.to_string()
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Unary(u) => {
                let sym = match u.op {
                    UnaryOp::Not => "NOT ",

                    UnaryOp::Neg => "-",

                    UnaryOp::BitNot => "NOT ",

                    _ => "",
                };

                format!("{}({})", sym, self.emit_expr(&u.expr))
            }

            AslExpr::Binary(b) => {
                let sym = match &b.op {
                    BinaryOp::And | BinaryOp::BitAnd => "AND",

                    BinaryOp::Or | BinaryOp::BitOr => "OR",

                    BinaryOp::BitXor => "XOR",

                    BinaryOp::Eq => "=",

                    BinaryOp::Neq => "<>",

                    other => other.to_symbol(),
                };

                format!(
                    "({} {} {})",
                    self.emit_expr(&b.left),
                    sym,
                    self.emit_expr(&b.right)
                )
            }

            AslExpr::Call(c) => {
                let args = c
                    .args
                    .iter()
                    .map(|a| self.emit_expr(a))
                    .collect::<Vec<_>>()
                    .join(", ");

                format!("{}({})", c.callee, args)
            }

            _ => "_unknown".to_string(),
        }
    }
}

impl Default for FbdGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================

// Testes RT-9

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use crate::asl_types::{AslAssign, AslCall, AslFunction, AslMetadata, AslStatement, AslVarRef};

    fn prog_passthrough() -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {
                name: Some("TestProg".to_string()),

                description: None,
                version: None,

                target_board: Some("plc".to_string()),
            },

            structs: vec![],
            globals: vec![],

            tasks: vec![],

            functions: vec![AslFunction {
                name: "PassthroughPOU".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Motor".to_string(),

                    value: AslExpr::Var(AslVarRef {
                        name: "SensorA".to_string(),
                        ..Default::default()
                    }),

                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    fn prog_call() -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {
                name: Some("CallProg".to_string()),

                description: None,
                version: None,

                target_board: Some("plc".to_string()),
            },

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: "GenericBlockPOU".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Result".to_string(),

                    value: AslExpr::Call(Box::new(AslCall {
                        callee: "AND".to_string(),

                        args: vec![
                            AslExpr::Var(AslVarRef {
                                name: "A".to_string(),
                                ..Default::default()
                            }),
                            AslExpr::Var(AslVarRef {
                                name: "B".to_string(),
                                ..Default::default()
                            }),
                        ],

                        ..Default::default()
                    })),

                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    fn prog_ton() -> AslProgram {
        use crate::asl_types::AslTimerTon;

        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: AslMetadata {
                name: Some("TonProg".to_string()),

                description: None,
                version: None,

                target_board: Some("plc".to_string()),
            },

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: "TonPOU".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::TimerTon(AslTimerTon {
                    instance: "Timer1".to_string(),

                    r#in: AslExpr::Var(AslVarRef {
                        name: "Start".to_string(),
                        ..Default::default()
                    }),

                    pt: AslExpr::Var(AslVarRef {
                        name: "Preset".to_string(),
                        ..Default::default()
                    }),

                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    //           Testes

    #[test]

    fn generate_is_valid_xml() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(
            out.starts_with("<?xml"),
            "deve come  ar com <?xml, output:\n{out}"
        );

        assert!(
            out.contains("</project>"),
            "deve conter </project>, output:\n{out}"
        );
    }

    #[test]

    fn generate_contains_fbd_tag() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(out.contains("<FBD>"), "deve conter <FBD>, output:\n{out}");

        assert!(out.contains("</FBD>"), "deve conter </FBD>, output:\n{out}");
    }

    #[test]

    fn generate_passthrough_has_in_variable() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(
            out.contains("<inVariable"),
            "Assign simples deve emitir inVariable, output:\n{out}"
        );
    }

    #[test]

    fn generate_passthrough_has_out_variable() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(
            out.contains("<outVariable"),
            "Assign simples deve emitir outVariable, output:\n{out}"
        );
    }

    #[test]

    fn generate_passthrough_expression_sensora() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(
            out.contains("<expression>SensorA</expression>"),
            "deve conter expression SensorA, output:\n{out}"
        );
    }

    #[test]

    fn generate_call_emits_block() {
        let out = FbdGenerator::new().generate(&prog_call());

        assert!(
            out.contains("<block"),
            "Call deve emitir block, output:\n{out}"
        );
    }

    #[test]

    fn generate_ton_emits_block_ton() {
        let out = FbdGenerator::new().generate(&prog_ton());

        assert!(
            out.contains("typeName=\"TON\""),
            "TimerTon deve emitir typeName=TON, output:\n{out}"
        );

        assert!(
            out.contains("instanceName=\"Timer1\""),
            "TimerTon deve emitir instanceName=Timer1, output:\n{out}"
        );
    }

    #[test]

    fn generate_roundtrip_pou_name() {
        let out = FbdGenerator::new().generate(&prog_passthrough());

        assert!(
            out.contains("name=\"PassthroughPOU\""),
            "nome do POU deve ser preservado, output:\n{out}"
        );
    }
}
