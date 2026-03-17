//! Generator Structured Text (IEC 61131-3) — percorre ProgramNode e emite ST
//!
//! Mapeamento NodeType → ST:
//!   Function       → PROGRAM / FUNCTION_BLOCK name ... END_PROGRAM
//!   IfStatement    → IF cond THEN ... ELSE ... END_IF;
//!   WhileLoop      → WHILE cond DO ... END_WHILE;
//!   ForLoop        → FOR init TO limit BY step DO ... END_FOR;
//!   ForIn          → FOR var IN range DO ... END_FOR;
//!   DoWhile        → REPEAT ... UNTIL cond;
//!   SwitchStatement→ CASE val OF ... ELSE ... END_CASE;
//!   Return         → RETURN;
//!   Break/Exit     → EXIT;
//!   Assignment     → left := right;
//!   VarDeclaration → VAR name : type := value; END_VAR
//!   GpioSet        → digitalWrite(pin, val);
//!   GpioRead       → digitalRead(pin)
//!   PinMode        → pinMode(pin, mode);
//!   DelayMs        → delay(ms);
//!   TimerTON       → ton(IN:=en, PT:=t);
//!   TimerTOF       → tof(IN:=en, PT:=t);
//!   CounterCTU     → ctu(CU:=pulse, PV:=preset);
//!   LatchSR        → sr(S1:=set, R:=reset);
//!   FunctionCall   → name(args);

use crate::types::nodes::{BaseNode, FunctionNode, NodeType, ProgramNode};

pub struct StGenerator {
    indent_size: usize,
}

impl Default for StGenerator {
    fn default() -> Self { Self { indent_size: 2 } }
}

impl StGenerator {
    pub fn new() -> Self { Self::default() }

    pub fn generate(&self, program: &ProgramNode) -> String {
        let mut out = String::new();
        for func in &program.functions {
            out.push_str(&self.gen_program_block(func));
            out.push_str("\n");
        }
        out
    }

    fn indent(&self, level: usize) -> String {
        " ".repeat(level * self.indent_size)
    }

    fn gen_program_block(&self, func: &FunctionNode) -> String {
        let mut out = format!("PROGRAM {}\n", func.name);

        if !func.params.is_empty() {
            out.push_str("  VAR_INPUT\n");
            for p in &func.params {
                out.push_str(&format!("    {} : {};\n", p.name, p.param_type));
            }
            out.push_str("  END_VAR\n");
        }

        out.push_str("  VAR\n");
        out.push_str("  END_VAR\n");

        for stmt in &func.body {
            out.push_str(&self.gen_node(stmt, 1));
            out.push('\n');
        }

        out.push_str(&format!("END_PROGRAM\n"));
        out
    }

    fn gen_node(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        match node.node_type {
            NodeType::GpioSet     => format!("{}digitalWrite({}, {});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::GpioRead    => format!("{}digitalRead({})", ind, self.arg(node,0)),
            NodeType::PinMode     => format!("{}pinMode({}, {});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::AnalogWrite => format!("{}analogWrite({}, {});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::AnalogRead  => format!("{}analogRead({})", ind, self.arg(node,0)),
            NodeType::DelayMs     => format!("{}delay({});", ind, self.arg(node,0)),
            NodeType::Print | NodeType::PrintLn => format!("{}(* print: {} *)", ind, self.arg(node,0)),
            NodeType::SerialBegin => format!("{}(* Serial.begin({}) *)", ind, self.arg(node,0)),
            NodeType::TimerTON    => format!("{}TON(IN:={}, PT:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::TimerTOF    => format!("{}TOF(IN:={}, PT:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::TimerTP     => format!("{}TP(IN:={}, PT:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::CounterCTU  => format!("{}CTU(CU:={}, PV:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::CounterCTD  => format!("{}CTD(CD:={}, PV:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::LatchSR     => format!("{}SR(S1:={}, R:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::LatchRS     => format!("{}RS(S:={}, R1:={});", ind, self.arg(node,0), self.arg(node,1)),
            NodeType::TrigR       => format!("{}R_TRIG(CLK:={});", ind, self.arg(node,0)),
            NodeType::TrigF       => format!("{}F_TRIG(CLK:={});", ind, self.arg(node,0)),
            NodeType::IfStatement => self.gen_if(node, level),
            NodeType::WhileLoop   => self.gen_while(node, level),
            NodeType::ForLoop     => self.gen_for(node, level),
            NodeType::ForIn       => self.gen_for_in(node, level),
            NodeType::DoWhile     => self.gen_repeat(node, level),
            NodeType::SwitchStatement => self.gen_case(node, level),
            NodeType::Return      => format!("{}RETURN;", ind),
            NodeType::Break       => format!("{}EXIT;", ind),
            NodeType::Continue    => format!("{}(* CONTINUE not supported in ST *)", ind),
            NodeType::Assignment  => format!("{}{} := {};\n", ind,
                node.name.as_deref().unwrap_or(""),
                node.value.as_deref().unwrap_or("")),
            NodeType::VarDeclaration => format!("{}VAR {} : {}{}; END_VAR", ind,
                node.name.as_deref().unwrap_or(""),
                node.var_type.as_deref().unwrap_or("ANY"),
                node.value.as_ref().map(|v| format!(" := {}", v)).unwrap_or_default()),
            NodeType::FunctionCall => format!("{}{};\n", ind, node.raw.as_deref().unwrap_or("")),
            _ => format!("{}{}", ind, node.raw.as_deref().unwrap_or("")),
        }
    }

    fn arg(&self, node: &BaseNode, idx: usize) -> String {
        node.children.get(idx).and_then(|c| c.raw.clone()).unwrap_or_default()
    }

    fn gen_if(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("TRUE");
        let mut out = format!("{}IF {} THEN\n", ind, cond);
        for stmt in &node.then_body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        if let Some(else_body) = &node.else_body {
            out.push_str(&format!("{}ELSE\n", ind));
            for stmt in else_body {
                out.push_str(&self.gen_node(stmt, level + 1));
                out.push('\n');
            }
        }
        out.push_str(&format!("{}END_IF;\n", ind));
        out
    }

    fn gen_while(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("TRUE");
        let mut out = format!("{}WHILE {} DO\n", ind, cond);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out.push_str(&format!("{}END_WHILE;\n", ind));
        out
    }

    fn gen_for(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let init = node.init.as_deref().unwrap_or("");
        let cond = node.condition.as_deref().unwrap_or("");
        let upd  = node.update.as_deref().unwrap_or("1");
        let mut out = format!("{}FOR {} TO {} BY {} DO\n", ind, init, cond, upd);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out.push_str(&format!("{}END_FOR;\n", ind));
        out
    }

    fn gen_for_in(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let var  = node.name.as_deref().unwrap_or("_");
        let iter = node.value.as_deref().unwrap_or("");
        let mut out = format!("{}FOR {} IN {} DO\n", ind, var, iter);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out.push_str(&format!("{}END_FOR;\n", ind));
        out
    }

    fn gen_repeat(&self, node: &BaseNode, level: usize) -> String {
        let ind  = self.indent(level);
        let cond = node.condition.as_deref().unwrap_or("TRUE");
        let mut out = format!("{}REPEAT\n", ind);
        for stmt in &node.body {
            out.push_str(&self.gen_node(stmt, level + 1));
            out.push('\n');
        }
        out.push_str(&format!("{}UNTIL {};\n", ind, cond));
        out
    }

    fn gen_case(&self, node: &BaseNode, level: usize) -> String {
        let ind = self.indent(level);
        let val = node.value.as_deref().unwrap_or("");
        let mut out = format!("{}CASE {} OF\n", ind, val);
        for case in &node.cases {
            if let Some(v) = &case.value {
                out.push_str(&format!("{} {}:\n", ind, v));
            } else {
                out.push_str(&format!("{}ELSE\n", ind));
            }
            for stmt in &case.body {
                out.push_str(&self.gen_node(stmt, level + 1));
                out.push('\n');
            }
        }
        out.push_str(&format!("{}END_CASE;\n", ind));
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::plc::st_parser::StParser;

    #[test]
    fn roundtrip_st_program() {
        let src = r#"
PROGRAM Main
  VAR_INPUT
    Enable : BOOL;
  END_VAR
  VAR
    Counter : INT := 0;
  END_VAR
  IF Enable THEN
    Counter := Counter + 1;
  END_IF;
END_PROGRAM
"#;
        let prog = StParser::parse(src).expect("parse falhou");
        let out  = StGenerator::new().generate(&prog);
        assert!(out.contains("PROGRAM"), "deve conter PROGRAM: {}", out);
        assert!(out.contains("IF"), "deve conter IF: {}", out);
    }
}
