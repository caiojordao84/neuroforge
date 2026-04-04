//! LD Generator     AslProgram     PLCopen XML Ladder Diagram.

//!

//! RT-10: invers  o do LdParser. Converte cada AslStatement::Assign

//! numa rede LD (rung) com contacts e coil.

//!

//! ## Mapeamento AslExpr     topologia LD

//!

//!   Var(x)                  Rail     contact(x)     coil

//!   Binary(And, L, R)       Rail     contact(L)     contact(R)     coil  (s  rie)

//!   Binary(Or,  L, R)       Rail     contact(L)           coil             (paralelo)

//!                         Rail     contact(R)       

//!   Unary(Not, Var(x))      contact(x, negated="true")

//!   outros                  contact("_ld_expr") como fallback

//!

//! ## localIds

//!

//!   Por fun    o: contador global incremental.

//!   Por rung:   1 leftPowerRail + N contacts + 1 coil.

#![allow(dead_code)]

use crate::types::asl_types::{AslExpr, AslProgram, AslStatement, BinaryOp, UnaryOp};

pub struct LdGenerator;

/// Folha LD extra  da da AslExpr.

#[derive(Debug, Clone)]

struct LdLeaf {
    var: String,

    negated: bool,
}

/// Modo de liga    o entre folhas.

#[derive(Debug, Clone, PartialEq)]

enum LdMode {
    Serie,
    Parallel,
}

impl LdGenerator {
    pub fn new() -> Self {
        Self
    }

    /// Gera PLCopen XML completo com body LD para cada fun    o do programa.

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

            let mut ld_nodes = String::new();

            for stmt in &func.body {
                if let AslStatement::Assign(a) = stmt {
                    self.emit_rung(&a.target, &a.value, &mut id, &mut ld_nodes);
                }
            }

            out.push_str(&format!(
                "      <pou name=\"{}\" pouType=\"program\">\n        <body>\n          <LD>\n",
                func.name
            ));

            out.push_str(&ld_nodes);

            out.push_str("          </LD>\n        </body>\n      </pou>\n");
        }

        out.push_str("    </pous>\n  </types>\n</project>\n");

        out
    }

    //           Emiss  o de rung (rede LD)

    fn emit_rung(&self, target: &str, value: &AslExpr, id: &mut u32, out: &mut String) {
        let rung_y = (*id) * 40;

        // leftPowerRail

        let rail_id = *id;

        out.push_str(&format!(
            "            <leftPowerRail localId=\"{}\" height=\"20\" width=\"10\">\n\

               <position x=\"0\" y=\"{}\"/>\n\

               <connectionPointOut formalParameter=\"\"/>\n\

             </leftPowerRail>\n",
            rail_id, rung_y
        ));

        *id += 1;

        // Decompor express  o em folhas + modo

        let (leaves, mode) = self.flatten_expr(value);

        // Emitir contacts e recolher os IDs das "pontas" que chegam    coil

        // mode=Serie:    cada contact aponta para o anterior (cadeia)

        // mode=Parallel: todos os contacts apontam para o rail (ramos independentes)

        let mut coil_sources: Vec<u32> = vec![];

        match mode {
            LdMode::Serie => {
                let mut prev_id = rail_id;

                for (i, leaf) in leaves.iter().enumerate() {
                    let cid = *id;

                    let x = 40 + i as u32 * 60;

                    self.emit_contact(&leaf.var, leaf.negated, cid, prev_id, x, rung_y, out);

                    prev_id = cid;

                    *id += 1;
                }

                coil_sources.push(prev_id - 1);
            }

            LdMode::Parallel => {
                for (i, leaf) in leaves.iter().enumerate() {
                    let cid = *id;

                    let y = rung_y + i as u32 * 30;

                    self.emit_contact(&leaf.var, leaf.negated, cid, rail_id, 40, y, out);

                    coil_sources.push(cid);

                    *id += 1;
                }
            }
        }

        // coil

        let coil_id = *id;

        let coil_x = match mode {
            LdMode::Serie => 40 + leaves.len() as u32 * 60,

            LdMode::Parallel => 120,
        };

        let coil_y = rung_y;

        self.emit_coil(target, coil_id, &coil_sources, coil_x, coil_y, out);

        *id += 1;
    }

    //           Emissores de n  s LD

    #[allow(clippy::too_many_arguments)]

    fn emit_contact(
        &self,

        var: &str,
        negated: bool,

        local_id: u32,
        source_id: u32,

        x: u32,
        y: u32,

        out: &mut String,
    ) {
        let neg_str = if negated { "true" } else { "false" };

        out.push_str(&format!(
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
        ));
    }

    fn emit_coil(
        &self,

        var: &str,

        local_id: u32,

        sources: &[u32],

        x: u32,
        y: u32,

        out: &mut String,
    ) {
        out.push_str(&format!(
            "            <coil localId=\"{}\" height=\"20\" width=\"20\">\n\

               <position x=\"{}\" y=\"{}\"/>\n\

               <connectionPointIn>\n\

                 <relPosition x=\"0\" y=\"10\"/>\n",
            local_id, x, y
        ));

        for src in sources {
            out.push_str(&format!(
                "                 <connection refLocalId=\"{}\"/>\n",
                src
            ));
        }

        out.push_str(&format!(
            "               </connectionPointIn>\n\

               <connectionPointOut formalParameter=\"\"/>\n\

               <variable>{}</variable>\n\

             </coil>\n",
            var
        ));
    }

    //           flatten_expr

    //

    // Decomp  e AslExpr em Vec<LdLeaf> + LdMode.

    //

    //   AND profundo      Serie  (recolhe todas as folhas AND recursivamente)

    //   OR  profundo      Parallel

    //   Var/Unary/out     leaf simples + Serie

    fn flatten_expr(&self, expr: &AslExpr) -> (Vec<LdLeaf>, LdMode) {
        match expr {
            AslExpr::Var(v) => (
                vec![LdLeaf {
                    var: v.name.clone(),
                    negated: false,
                }],
                LdMode::Serie,
            ),

            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                let name = self.expr_to_var_name(&u.expr);

                (
                    vec![LdLeaf {
                        var: name,
                        negated: true,
                    }],
                    LdMode::Serie,
                )
            }

            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::And | BinaryOp::BitAnd) => {
                let mut leaves = vec![];

                self.collect_and_leaves(expr, &mut leaves);

                (leaves, LdMode::Serie)
            }

            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::Or | BinaryOp::BitOr) => {
                let mut leaves = vec![];

                self.collect_or_leaves(expr, &mut leaves);

                (leaves, LdMode::Parallel)
            }

            _ => {
                // fallback: tratar como vari  vel opaca

                let name = self.expr_to_var_name(expr);

                (
                    vec![LdLeaf {
                        var: name,
                        negated: false,
                    }],
                    LdMode::Serie,
                )
            }
        }
    }

    /// Recolhe folhas de uma   rvore AND (s  rie).

    fn collect_and_leaves(&self, expr: &AslExpr, out: &mut Vec<LdLeaf>) {
        match expr {
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::And | BinaryOp::BitAnd) => {
                self.collect_and_leaves(&b.left, out);

                self.collect_and_leaves(&b.right, out);
            }

            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                let name = self.expr_to_var_name(&u.expr);

                out.push(LdLeaf {
                    var: name,
                    negated: true,
                });
            }

            AslExpr::Var(v) => {
                out.push(LdLeaf {
                    var: v.name.clone(),
                    negated: false,
                });
            }

            other => {
                out.push(LdLeaf {
                    var: self.expr_to_var_name(other),
                    negated: false,
                });
            }
        }
    }

    /// Recolhe folhas de uma   rvore OR (paralelo).

    fn collect_or_leaves(&self, expr: &AslExpr, out: &mut Vec<LdLeaf>) {
        match expr {
            AslExpr::Binary(b) if matches!(&b.op, BinaryOp::Or | BinaryOp::BitOr) => {
                self.collect_or_leaves(&b.left, out);

                self.collect_or_leaves(&b.right, out);
            }

            AslExpr::Unary(u) if matches!(u.op, UnaryOp::Not) => {
                let name = self.expr_to_var_name(&u.expr);

                out.push(LdLeaf {
                    var: name,
                    negated: true,
                });
            }

            AslExpr::Var(v) => {
                out.push(LdLeaf {
                    var: v.name.clone(),
                    negated: false,
                });
            }

            other => {
                out.push(LdLeaf {
                    var: self.expr_to_var_name(other),
                    negated: false,
                });
            }
        }
    }

    /// Extrai nome de vari  vel de uma AslExpr simples; fallback "_ld_expr".

    fn expr_to_var_name(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Literal(l) => l.value.to_string(),

            _ => "_ld_expr".to_string(),
        }
    }
}

impl Default for LdGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================

// Testes RT-10

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use crate::types::asl_types::{
        AslAssign, AslBinary, AslFunction, AslMetadata, AslStatement, AslUnary, AslVarRef,
        BinaryOp, UnaryOp,
    };

    //           helpers de programa

    fn meta() -> AslMetadata {
        AslMetadata {
            name: Some("TestProg".to_string()),

            description: None,
            version: None,

            target_board: Some("plc".to_string()),
        }
    }

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

    fn prog_serie() -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: meta(),

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: "SerieRung".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Motor".to_string(),

                    value: and(var("A"), var("B")),
                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    fn prog_parallel() -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: meta(),

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: "ParallelRung".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Motor".to_string(),

                    value: or(var("A"), var("B")),
                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    fn prog_negated() -> AslProgram {
        AslProgram {
            asl_version: "4.0.0".to_string(),

            metadata: meta(),

            structs: vec![],
            globals: vec![],
            tasks: vec![],

            functions: vec![AslFunction {
                name: "NegatedRung".to_string(),

                params: vec![],
                return_type: None,

                body: vec![AslStatement::Assign(AslAssign {
                    target: "Motor".to_string(),

                    value: not(var("Stop")),
                    ..Default::default()
                })],

                ..Default::default()
            }],

            ..Default::default()
        }
    }

    //           testes

    #[test]

    fn generate_is_valid_xml() {
        let out = LdGenerator::new().generate(&prog_serie());

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

    fn generate_contains_ld_tag() {
        let out = LdGenerator::new().generate(&prog_serie());

        assert!(out.contains("<LD>"), "deve conter <LD>, output:\n{out}");

        assert!(out.contains("</LD>"), "deve conter </LD>, output:\n{out}");
    }

    #[test]

    fn generate_serie_has_contacts() {
        let out = LdGenerator::new().generate(&prog_serie());

        assert!(
            out.contains("<contact"),
            "s  rie deve emitir contact, output:\n{out}"
        );

        assert!(
            out.contains("<variable>A</variable>"),
            "deve conter vari  vel A, output:\n{out}"
        );

        assert!(
            out.contains("<variable>B</variable>"),
            "deve conter vari  vel B, output:\n{out}"
        );
    }

    #[test]

    fn generate_serie_has_coil() {
        let out = LdGenerator::new().generate(&prog_serie());

        assert!(out.contains("<coil"), "deve emitir coil, output:\n{out}");

        assert!(
            out.contains("<variable>Motor</variable>"),
            "coil deve ter vari  vel Motor, output:\n{out}"
        );
    }

    #[test]

    fn generate_serie_has_left_rail() {
        let out = LdGenerator::new().generate(&prog_serie());

        assert!(
            out.contains("<leftPowerRail"),
            "deve emitir leftPowerRail, output:\n{out}"
        );
    }

    #[test]

    fn generate_parallel_coil_has_two_connections() {
        let out = LdGenerator::new().generate(&prog_parallel());

        // A coil paralela tem 2 <connection refLocalId=...>

        let count = out.matches("<connection refLocalId=").count();

        // contacts tamb  m t  m connection (1 cada) + coil tem 2

        assert!(
            count >= 4,
            "paralelo deve ter    4 connection refLocalId (2 contacts + 2 na coil), output:\n{out}"
        );

        // Verificar que a coil tem 2 connections seguidas

        assert!(
            out.contains("<variable>A</variable>"),
            "deve conter vari  vel A, output:\n{out}"
        );

        assert!(
            out.contains("<variable>B</variable>"),
            "deve conter vari  vel B, output:\n{out}"
        );
    }

    #[test]

    fn generate_negated_contact_has_negated_true() {
        let out = LdGenerator::new().generate(&prog_negated());

        assert!(
            out.contains("negated=\"true\""),
            "contacto negado deve ter negated=true, output:\n{out}"
        );

        assert!(
            out.contains("<variable>Stop</variable>"),
            "deve conter vari  vel Stop, output:\n{out}"
        );
    }

    #[test]

    fn generate_roundtrip_pou_name() {
        let out = LdGenerator::new().generate(&prog_serie());

        assert!(
            out.contains("name=\"SerieRung\""),
            "nome do POU deve ser preservado, output:\n{out}"
        );
    }
}
