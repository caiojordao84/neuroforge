//! SFC Generator     AslProgram (AslStatement::StateMachine)     ST / C++ / Rust / MicroPython.

//!

//! RT-8: gera    o de c  digo alvo a partir de AslStateMachine.

//!

//! ## Targets suportados

//!

//!  | target         | estrutura de controlo                              |

//!  |----------------|----------------------------------------------------|

//!  | "st"           | CASE _state OF     END_CASE  (IEC 61131-3   3)       |

//!  | "cpp"          | enum State + switch(_state) { case STATE_X:     }   |

//!  | "rust"         | enum State (derive) + match self._state {     }     |

//!  | "micropython"  | if self._state == "X":     (strings como estado)    |

//!

//! ## Emiss  o de express  es

//!

//!  - ST:           BinaryOp::to_iec_symbol()       AND / OR / = / <> / NOT

//!  - C++ / Rust:   BinaryOp::to_symbol()           && / || / == / != / !

//!  - MicroPython:  and / or / not em min  sculas; True / False

#![allow(dead_code)]

use crate::types::asl_types::{
    AslExpr, AslProgram, AslStateMachine, AslStatement, BinaryOp, UnaryOp,
};

pub struct SfcGenerator;

impl SfcGenerator {
    pub fn new() -> Self {
        Self
    }

    /// Gera c  digo para o target especificado.

    /// `target`: "st" | "cpp" | "rust" | "micropython"

    /// Devolve string vazia se n  o houver StateMachine no programa.

    pub fn generate(&self, program: &AslProgram, target: &str) -> String {
        program
            .functions
            .iter()
            .flat_map(|f| f.body.iter())
            .filter_map(|stmt| {
                if let AslStatement::StateMachine(sm) = stmt {
                    Some(sm.as_ref())
                } else {
                    None
                }
            })
            .map(|sm| match target {
                "cpp" => self.gen_cpp(sm),

                "rust" => self.gen_rust(sm),

                "micropython" => self.gen_micropython(sm),

                _ => self.gen_st(sm), // "st" + fallback
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }

    //           ST

    //

    // Gera:

    //   CASE _state OF

    //     0: (* Init *)

    //       <actions>

    //       IF cond THEN _state := 1; END_IF;

    //

    //   END_CASE;

    fn gen_st(&self, sm: &AslStateMachine) -> String {
        let mut out = String::new();

        // Constantes de estado: STATE_Init := 0;

        for (i, step) in sm.steps.iter().enumerate() {
            out.push_str(&format!("(* {} = {} *)\n", step.name, i));
        }

        out.push('\n');

        // Vari  vel de estado e inicializa    o

        out.push_str(&format!(
            "VAR\n  {} : INT := {};\nEND_VAR\n\n",
            sm.state_var,
            sm.steps
                .iter()
                .position(|s| s.name == sm.initial_step)
                .unwrap_or(0)
        ));

        out.push_str(&format!("CASE {} OF\n", sm.state_var));

        for (i, step) in sm.steps.iter().enumerate() {
            out.push_str(&format!("  {}: (* {} *)\n", i, step.name));

            // Actions

            for action in &step.actions {
                let line = self.emit_action_st(action);

                if !line.is_empty() {
                    out.push_str(&format!("    {}\n", line));
                }
            }

            // Transi    es

            for trans in &step.transitions {
                let target_idx = sm
                    .steps
                    .iter()
                    .position(|s| s.name == trans.target_step)
                    .unwrap_or(0);

                let cond = self.emit_expr_st(&trans.condition);

                out.push_str(&format!(
                    "    IF {} THEN {} := {}; END_IF;\n",
                    cond, sm.state_var, target_idx
                ));
            }
        }

        out.push_str("END_CASE;\n");

        out
    }

    //           C++

    //

    // Gera:

    //   enum State_<name> { STATE_Init = 0, STATE_Running,     };

    //   State_<name> _state = STATE_Init;

    //   void <name>_update() {

    //     switch (_state) {

    //       case STATE_Init:

    //         if (cond) { _state = STATE_Running; } break;

    //

    //     }

    //   }

    fn gen_cpp(&self, sm: &AslStateMachine) -> String {
        let mut out = String::new();

        let enum_name = format!("State_{}", sm.name);

        // Enum

        out.push_str(&format!("enum {} {{\n", enum_name));

        for (i, step) in sm.steps.iter().enumerate() {
            let sep = if i + 1 < sm.steps.len() { "," } else { "" };

            out.push_str(&format!("  STATE_{} = {}{}\n", step.name, i, sep));
        }

        out.push_str("}\n\n");

        // Vari  vel de estado

        let initial_enum = format!("STATE_{}", sm.initial_step);

        out.push_str(&format!(
            "{} {} = {};\n\n",
            enum_name, sm.state_var, initial_enum
        ));

        // Fun    o de update

        out.push_str(&format!("void {}_update() {{\n", sm.name));

        out.push_str(&format!("  switch ({}) {{\n", sm.state_var));

        for step in &sm.steps {
            out.push_str(&format!("    case STATE_{}: {{\n", step.name));

            for action in &step.actions {
                let line = self.emit_action_cpp(action);

                if !line.is_empty() {
                    out.push_str(&format!("      {}\n", line));
                }
            }

            for trans in &step.transitions {
                let cond = self.emit_expr_cpp(&trans.condition);

                out.push_str(&format!(
                    "      if ({}) {{ {} = STATE_{}; }}\n",
                    cond, sm.state_var, trans.target_step
                ));
            }

            out.push_str("      break;\n");

            out.push_str("    }\n");
        }

        out.push_str("  }\n");

        out.push_str("}\n");

        out
    }

    //           Rust

    //

    // Gera:

    //   #[derive(Debug, Clone, PartialEq)]

    //   enum State<name> { Init, Running,     }

    //   struct <name> { _state: State<name> }

    //   impl <name> {

    //     fn new() -> Self { Self { _state: State<name>::Init } }

    //     fn update(&mut self) {

    //       match self._state {

    //         State<name>::Init => { if cond { self._state = State<name>::Running; } }

    //

    //       }

    //     }

    //   }

    fn gen_rust(&self, sm: &AslStateMachine) -> String {
        let mut out = String::new();

        let enum_name = format!("State{}", sm.name);

        // Enum

        out.push_str("#[derive(Debug, Clone, PartialEq)]\n");

        out.push_str(&format!("enum {} {{\n", enum_name));

        for step in &sm.steps {
            out.push_str(&format!("    {},\n", step.name));
        }

        out.push_str("}\n\n");

        // Struct

        out.push_str(&format!("struct {} {{\n", sm.name));

        out.push_str(&format!("    {}: {},\n", sm.state_var, enum_name));

        out.push_str("}\n\n");

        // impl

        out.push_str(&format!("impl {} {{\n", sm.name));

        // new()

        out.push_str("    fn new() -> Self {\n");

        out.push_str(&format!(
            "        Self {{ {}: {}::{} }}\n",
            sm.state_var, enum_name, sm.initial_step
        ));

        out.push_str("    }\n\n");

        // update()

        out.push_str("    fn update(&mut self) {\n");

        out.push_str(&format!("        match self.{} {{\n", sm.state_var));

        for step in &sm.steps {
            out.push_str(&format!("            {}::{} => {{\n", enum_name, step.name));

            for action in &step.actions {
                let line = self.emit_action_rust(action);

                if !line.is_empty() {
                    out.push_str(&format!("                {}\n", line));
                }
            }

            for trans in &step.transitions {
                let cond = self.emit_expr_rust(&trans.condition);

                out.push_str(&format!(
                    "                if {} {{ self.{} = {}::{}; }}\n",
                    cond, sm.state_var, enum_name, trans.target_step
                ));
            }

            out.push_str("            }\n");
        }

        out.push_str("        }\n");

        out.push_str("    }\n");

        out.push_str("}\n");

        out
    }

    //           MicroPython

    //

    // Gera:

    //   class <name>:

    //     def __init__(self):

    //       self._state = "Init"

    //     def update(self):

    //       if self._state == "Init":

    //         if cond:

    //           self._state = "Running"

    fn gen_micropython(&self, sm: &AslStateMachine) -> String {
        let mut out = String::new();

        out.push_str(&format!("class {}:\n", sm.name));

        out.push_str("    def __init__(self):\n");

        out.push_str(&format!(
            "        self.{} = \"{}\"\n",
            sm.state_var, sm.initial_step
        ));

        out.push('\n');

        out.push_str("    def update(self):\n");

        for (i, step) in sm.steps.iter().enumerate() {
            let kw = if i == 0 { "if" } else { "elif" };

            out.push_str(&format!(
                "        {} self.{} == \"{}\":\n",
                kw, sm.state_var, step.name
            ));

            // Actions

            let mut has_body = false;

            for action in &step.actions {
                let line = self.emit_action_py(action);

                if !line.is_empty() {
                    out.push_str(&format!("            {}\n", line));

                    has_body = true;
                }
            }

            // Transi    es

            for trans in &step.transitions {
                let cond = self.emit_expr_py(&trans.condition);

                out.push_str(&format!(
                    "            if {}:\n                self.{} = \"{}\"\n",
                    cond, sm.state_var, trans.target_step
                ));

                has_body = true;
            }

            if !has_body {
                out.push_str("            pass\n");
            }
        }

        out
    }

    //           emit_expr por target

    fn emit_expr_st(&self, expr: &AslExpr) -> String {
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
                let sym = u.op.to_iec_symbol();

                format!("{}({})", sym, self.emit_expr_st(&u.expr))
            }

            AslExpr::Binary(b) => {
                let sym = b.op.to_iec_symbol();

                format!(
                    "({} {} {})",
                    self.emit_expr_st(&b.left),
                    sym,
                    self.emit_expr_st(&b.right)
                )
            }

            AslExpr::Call(c) => {
                let args = c
                    .args
                    .iter()
                    .map(|a| self.emit_expr_st(a))
                    .collect::<Vec<_>>()
                    .join(", ");

                format!("{}({})", c.callee, args)
            }

            _ => "_unknown".to_string(),
        }
    }

    fn emit_expr_cpp(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                if l.value == serde_json::json!(true) {
                    return "true".to_string();
                }

                if l.value == serde_json::json!(false) {
                    return "false".to_string();
                }

                l.value.to_string()
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Unary(u) => {
                let sym = match u.op {
                    UnaryOp::Not => "!",

                    UnaryOp::Neg => "-",

                    _ => "!",
                };

                format!("{}({})", sym, self.emit_expr_cpp(&u.expr))
            }

            AslExpr::Binary(b) => {
                let sym = match &b.op {
                    BinaryOp::And | BinaryOp::BitAnd => "&&",

                    BinaryOp::Or | BinaryOp::BitOr => "||",

                    BinaryOp::Eq => "==",

                    BinaryOp::Neq => "!=",

                    other => other.to_symbol(),
                };

                format!(
                    "({} {} {})",
                    self.emit_expr_cpp(&b.left),
                    sym,
                    self.emit_expr_cpp(&b.right)
                )
            }

            AslExpr::Call(c) => {
                let args = c
                    .args
                    .iter()
                    .map(|a| self.emit_expr_cpp(a))
                    .collect::<Vec<_>>()
                    .join(", ");

                format!("{}({})", c.callee, args)
            }

            _ => "_unknown".to_string(),
        }
    }

    fn emit_expr_rust(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                if l.value == serde_json::json!(true) {
                    return "true".to_string();
                }

                if l.value == serde_json::json!(false) {
                    return "false".to_string();
                }

                l.value.to_string()
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Unary(u) => {
                let sym = match u.op {
                    UnaryOp::Not => "!",

                    UnaryOp::Neg => "-",

                    _ => "!",
                };

                format!("{}({})", sym, self.emit_expr_rust(&u.expr))
            }

            AslExpr::Binary(b) => {
                let sym = match &b.op {
                    BinaryOp::And | BinaryOp::BitAnd => "&&",

                    BinaryOp::Or | BinaryOp::BitOr => "||",

                    BinaryOp::Eq => "==",

                    BinaryOp::Neq => "!=",

                    other => other.to_symbol(),
                };

                format!(
                    "({} {} {})",
                    self.emit_expr_rust(&b.left),
                    sym,
                    self.emit_expr_rust(&b.right)
                )
            }

            AslExpr::Call(c) => {
                let args = c
                    .args
                    .iter()
                    .map(|a| self.emit_expr_rust(a))
                    .collect::<Vec<_>>()
                    .join(", ");

                format!("{}({})", c.callee, args)
            }

            _ => "_unknown".to_string(),
        }
    }

    fn emit_expr_py(&self, expr: &AslExpr) -> String {
        match expr {
            AslExpr::Literal(l) => {
                if l.value == serde_json::json!(true) {
                    return "True".to_string();
                }

                if l.value == serde_json::json!(false) {
                    return "False".to_string();
                }

                l.value.to_string()
            }

            AslExpr::Var(v) => v.name.clone(),

            AslExpr::Unary(u) => {
                let sym = match u.op {
                    UnaryOp::Not => "not ",

                    UnaryOp::Neg => "-",

                    _ => "not ",
                };

                format!("{}({})", sym, self.emit_expr_py(&u.expr))
            }

            AslExpr::Binary(b) => {
                let sym = match &b.op {
                    BinaryOp::And | BinaryOp::BitAnd => "and",

                    BinaryOp::Or | BinaryOp::BitOr => "or",

                    BinaryOp::Eq => "==",

                    BinaryOp::Neq => "!=",

                    other => other.to_symbol(),
                };

                format!(
                    "({} {} {})",
                    self.emit_expr_py(&b.left),
                    sym,
                    self.emit_expr_py(&b.right)
                )
            }

            AslExpr::Call(c) => {
                let args = c
                    .args
                    .iter()
                    .map(|a| self.emit_expr_py(a))
                    .collect::<Vec<_>>()
                    .join(", ");

                format!("{}({})", c.callee, args)
            }

            _ => "_unknown".to_string(),
        }
    }

    //           emit_action por target

    fn emit_action_st(&self, stmt: &AslStatement) -> String {
        match stmt {
            AslStatement::Assign(a) => format!("{} := {};", a.target, self.emit_expr_st(&a.value)),

            AslStatement::Expr(e) => {
                if let AslExpr::Call(c) = &e.expr {
                    let args = c
                        .args
                        .iter()
                        .map(|a| self.emit_expr_st(a))
                        .collect::<Vec<_>>()
                        .join(", ");

                    format!("{}({});", c.callee, args)
                } else {
                    String::new()
                }
            }

            AslStatement::Comment(c) => format!("(* {} *)", c.text),

            _ => String::new(),
        }
    }

    fn emit_action_cpp(&self, stmt: &AslStatement) -> String {
        match stmt {
            AslStatement::Assign(a) => format!("{} = {};", a.target, self.emit_expr_cpp(&a.value)),

            AslStatement::Expr(e) => {
                if let AslExpr::Call(c) = &e.expr {
                    let args = c
                        .args
                        .iter()
                        .map(|a| self.emit_expr_cpp(a))
                        .collect::<Vec<_>>()
                        .join(", ");

                    format!("{}({});", c.callee, args)
                } else {
                    String::new()
                }
            }

            AslStatement::Comment(c) => format!("// {}", c.text),

            _ => String::new(),
        }
    }

    fn emit_action_rust(&self, stmt: &AslStatement) -> String {
        match stmt {
            AslStatement::Assign(a) => {
                format!("self.{} = {};", a.target, self.emit_expr_rust(&a.value))
            }

            AslStatement::Expr(e) => {
                if let AslExpr::Call(c) = &e.expr {
                    let args = c
                        .args
                        .iter()
                        .map(|a| self.emit_expr_rust(a))
                        .collect::<Vec<_>>()
                        .join(", ");

                    format!("{}({});", c.callee, args)
                } else {
                    String::new()
                }
            }

            AslStatement::Comment(c) => format!("// {}", c.text),

            _ => String::new(),
        }
    }

    fn emit_action_py(&self, stmt: &AslStatement) -> String {
        match stmt {
            AslStatement::Assign(a) => {
                format!("self.{} = {}", a.target, self.emit_expr_py(&a.value))
            }

            AslStatement::Expr(e) => {
                if let AslExpr::Call(c) = &e.expr {
                    let args = c
                        .args
                        .iter()
                        .map(|a| self.emit_expr_py(a))
                        .collect::<Vec<_>>()
                        .join(", ");

                    format!("{}({})", c.callee, args)
                } else {
                    String::new()
                }
            }

            AslStatement::Comment(c) => format!("# {}", c.text),

            _ => String::new(),
        }
    }
}

impl Default for SfcGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================

// Testes RT-8

// ============================================================================

#[cfg(test)]

mod tests {

    use super::*;

    use crate::plugins::plc::sfc::parser::SfcParser;

    // XML m  nimo reutilizado do RT-7: Init    [StartBtn]    Running    [TRUE]    Init

    fn xml_simple() -> &'static str {
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

    fn make_prog() -> AslProgram {
        SfcParser::parse(xml_simple()).expect("parse RT-8 test")
    }

    //           ST

    #[test]

    fn generate_st_contains_case() {
        let out = SfcGenerator::new().generate(&make_prog(), "st");

        assert!(out.contains("CASE"), "ST deve conter CASE, output:\n{out}");

        assert!(
            out.contains("END_CASE"),
            "ST deve conter END_CASE, output:\n{out}"
        );
    }

    #[test]

    fn generate_st_initial_state() {
        let out = SfcGenerator::new().generate(&make_prog(), "st");

        assert!(
            out.contains("Init"),
            "ST deve referenciar o step Init, output:\n{out}"
        );
    }

    #[test]

    fn generate_st_condition_reference() {
        let out = SfcGenerator::new().generate(&make_prog(), "st");

        assert!(
            out.contains("StartBtn"),
            "ST deve conter a condi    o StartBtn, output:\n{out}"
        );
    }

    #[test]

    fn generate_st_true_literal() {
        let out = SfcGenerator::new().generate(&make_prog(), "st");

        assert!(
            out.contains("TRUE"),
            "ST deve conter literal TRUE, output:\n{out}"
        );
    }

    //           C++

    #[test]

    fn generate_cpp_contains_switch() {
        let out = SfcGenerator::new().generate(&make_prog(), "cpp");

        assert!(
            out.contains("switch"),
            "C++ deve conter switch, output:\n{out}"
        );
    }

    #[test]

    fn generate_cpp_contains_enum() {
        let out = SfcGenerator::new().generate(&make_prog(), "cpp");

        assert!(out.contains("enum"), "C++ deve conter enum, output:\n{out}");

        assert!(
            out.contains("STATE_Init"),
            "C++ deve conter STATE_Init, output:\n{out}"
        );
    }

    //           Rust

    #[test]

    fn generate_rust_contains_match() {
        let out = SfcGenerator::new().generate(&make_prog(), "rust");

        assert!(
            out.contains("match"),
            "Rust deve conter match, output:\n{out}"
        );
    }

    #[test]

    fn generate_rust_contains_enum() {
        let out = SfcGenerator::new().generate(&make_prog(), "rust");

        assert!(
            out.contains("enum State"),
            "Rust deve conter enum State, output:\n{out}"
        );

        assert!(
            out.contains("::Init"),
            "Rust deve conter ::Init, output:\n{out}"
        );
    }

    //           MicroPython

    #[test]

    fn generate_py_contains_class() {
        let out = SfcGenerator::new().generate(&make_prog(), "micropython");

        assert!(
            out.contains("class "),
            "MicroPython deve conter class, output:\n{out}"
        );
    }

    #[test]

    fn generate_py_contains_state() {
        let out = SfcGenerator::new().generate(&make_prog(), "micropython");

        assert!(
            out.contains("_state"),
            "MicroPython deve conter _state, output:\n{out}"
        );

        assert!(
            out.contains("\"Init\""),
            "MicroPython deve conter \"Init\", output:\n{out}"
        );
    }

    //           Todos os targets

    #[test]

    fn generate_all_targets_nonempty() {
        let prog = make_prog();

        let gen = SfcGenerator::new();

        for target in &["st", "cpp", "rust", "micropython"] {
            let out = gen.generate(&prog, target);

            assert!(
                !out.is_empty(),
                "target '{}' n  o deve produzir output vazio",
                target
            );
        }
    }
}
