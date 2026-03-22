//! nodes_to_typed.rs — Converte nodes::ProgramNode (legacy) → typed_nodes::ProgramNode
//!
//! Necessário para a pipeline parse_to_asl_program em WASM bindings:
//!   CParser::parse() → nodes::ProgramNode → typed_nodes::ProgramNode → ast_to_asl → AslProgram

use crate::types::nodes::{BaseNode, NodeType};
use crate::types::typed_nodes::{
    BlockKind, BlockNode, CallNode, ExprKind, ExprNode, FunctionNode, ParamNode, ProgramNode,
    StatementKind, StatementNode, VarDeclNode,
};

/// Converte `nodes::ProgramNode` → `typed_nodes::ProgramNode`
pub fn nodes_to_typed(prog: &crate::types::nodes::ProgramNode) -> ProgramNode {
    let globals: Vec<VarDeclNode> = prog
        .globals
        .iter()
        .filter_map(|g| base_to_var_decl(g))
        .collect();

    let functions: Vec<FunctionNode> = prog
        .functions
        .iter()
        .map(|f| convert_function(f))
        .collect();

    // Funções "setup" e "loop" são transformadas em body statements.
    // Outras funções ficam em `functions`.
    let mut body: Vec<StatementNode> = vec![];
    let mut other_fns: Vec<FunctionNode> = vec![];

    for f in &functions {
        match f.name.as_str() {
            "setup" | "loop" => {
                // Inline the body of setup/loop into the program body
                body.extend(f.body.clone());
            }
            _ => other_fns.push(f.clone()),
        }
    }

    let has_loop = functions.iter().any(|f| f.name == "loop");

    ProgramNode {
        globals,
        functions: other_fns,
        body,
        has_loop,
    }
}

fn convert_function(f: &crate::types::nodes::FunctionNode) -> FunctionNode {
    let params: Vec<ParamNode> = f
        .params
        .iter()
        .map(|p| ParamNode {
            name: p.name.clone(),
            param_type: p.param_type.clone(),
        })
        .collect();

    let body: Vec<StatementNode> = f.body.iter().filter_map(base_to_statement).collect();

    let return_type = if f.return_type == "void" {
        None
    } else {
        Some(f.return_type.clone())
    };

    FunctionNode {
        name: f.name.clone(),
        params,
        return_type,
        body,
    }
}

fn base_to_statement(node: &BaseNode) -> Option<StatementNode> {
    match &node.node_type {
        NodeType::VarDeclaration => {
            Some(StatementNode {
                kind: StatementKind::VarDecl(base_to_var_decl(node)?),
            })
        }
        NodeType::Assignment => {
            let left = attr_str(node, "left");
            let right = attr_str(node, "right");
            Some(StatementNode {
                kind: StatementKind::Assign {
                    target: left,
                    value: parse_raw_expr(&right),
                },
            })
        }
        NodeType::FunctionCall => {
            let callee = attr_str(node, "callee");
            let args: Vec<ExprNode> = node.children.iter().map(base_to_expr).collect();
            Some(StatementNode {
                kind: StatementKind::Call(CallNode {
                    name: callee,
                    object: None,
                    args,
                    result_var: None,
                }),
            })
        }
        // Hardware calls (GpioSet, PinMode, DelayMs, etc.) → mapped as Call
        nt if is_hw_call(nt) => {
            let (name, object) = hw_call_name(nt);
            let args: Vec<ExprNode> = node.children.iter().map(base_to_expr).collect();
            Some(StatementNode {
                kind: StatementKind::Call(CallNode {
                    name,
                    object,
                    args,
                    result_var: None,
                }),
            })
        }
        NodeType::IfStatement => {
            let cond_str = attr_str(node, "condition");
            let then_body = node
                .children
                .first()
                .map(|b| b.children.iter().filter_map(|c| base_to_block_node(c)).collect())
                .unwrap_or_default();
            let else_body = node
                .children
                .get(1)
                .map(|b| b.children.iter().filter_map(|c| base_to_block_node(c)).collect());
            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::If {
                        condition: parse_raw_expr(&cond_str),
                        then_body,
                        else_body,
                    },
                }),
            })
        }
        NodeType::WhileLoop => {
            let cond_str = attr_str(node, "condition");
            let body = node
                .children
                .first()
                .map(|b| b.children.iter().filter_map(|c| base_to_block_node(c)).collect())
                .unwrap_or_default();
            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::While {
                        condition: parse_raw_expr(&cond_str),
                        body,
                    },
                }),
            })
        }
        NodeType::DoWhile => {
            let cond_str = attr_str(node, "condition");
            let body = node
                .children
                .first()
                .map(|b| b.children.iter().filter_map(|c| base_to_block_node(c)).collect())
                .unwrap_or_default();
            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::DoWhile {
                        condition: parse_raw_expr(&cond_str),
                        body,
                    },
                }),
            })
        }
        NodeType::ForLoop => {
            let init = attr_str_opt(node, "init").map(|s| parse_raw_expr(&s));
            let cond = attr_str_opt(node, "cond").map(|s| parse_raw_expr(&s));
            let update = attr_str_opt(node, "update").map(|s| parse_raw_expr(&s));
            let body = node
                .children
                .first()
                .map(|b| b.children.iter().filter_map(|c| base_to_block_node(c)).collect())
                .unwrap_or_default();
            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::For {
                        init,
                        condition: cond,
                        update,
                        body,
                    },
                }),
            })
        }
        NodeType::Return => {
            let val = attr_str_opt(node, "value").map(|s| parse_raw_expr(&s));
            Some(StatementNode {
                kind: StatementKind::Return(val),
            })
        }
        NodeType::Break => Some(StatementNode {
            kind: StatementKind::Break,
        }),
        NodeType::Continue => Some(StatementNode {
            kind: StatementKind::Continue,
        }),
        NodeType::Raw => {
            let text = attr_str(node, "value");
            Some(StatementNode {
                kind: StatementKind::Expr(parse_raw_expr(&text)),
            })
        }
        _ => None,
    }
}

fn base_to_block_node(node: &BaseNode) -> Option<BlockNode> {
    // Convert statement to block node (wrapping non-block statements)
    let stmt = base_to_statement(node)?;
    match stmt.kind {
        StatementKind::Block(bn) => Some(bn),
        // Non-block statements need to be wrapped — use a pass-through pattern
        other => {
            // For non-block statements within block contexts, we wrap them
            // as Return/Break/Continue which are valid BlockKind variants
            match other {
                StatementKind::Return(val) => Some(BlockNode { kind: BlockKind::Return(val) }),
                StatementKind::Break => Some(BlockNode { kind: BlockKind::Break }),
                StatementKind::Continue => Some(BlockNode { kind: BlockKind::Continue }),
                _ => None, // Other statement types (calls, assigns) are not BlockNode
            }
        }
    }
}

fn base_to_var_decl(node: &BaseNode) -> Option<VarDeclNode> {
    if node.node_type != NodeType::VarDeclaration {
        return None;
    }
    let name = attr_str(node, "name");
    let var_type = attr_str_opt(node, "type");
    let value = attr_str_opt(node, "value").map(|s| parse_raw_expr(&s));
    Some(VarDeclNode {
        name,
        var_type,
        value,
        is_const: false,
    })
}

fn base_to_expr(node: &BaseNode) -> ExprNode {
    match &node.node_type {
        NodeType::Raw => {
            let val = attr_str(node, "value");
            parse_raw_expr(&val)
        }
        _ => ExprNode {
            kind: ExprKind::Identifier(format!("{:?}", node.node_type)),
        },
    }
}

fn parse_raw_expr(s: &str) -> ExprNode {
    let s = s.trim();
    if s.is_empty() {
        return ExprNode { kind: ExprKind::NullLiteral };
    }
    // Try integer
    if let Ok(n) = s.parse::<i64>() {
        return ExprNode { kind: ExprKind::IntLiteral(n) };
    }
    // Try float
    if let Ok(f) = s.parse::<f64>() {
        return ExprNode { kind: ExprKind::FloatLiteral(f) };
    }
    // Boolean
    if s == "true" {
        return ExprNode { kind: ExprKind::BoolLiteral(true) };
    }
    if s == "false" {
        return ExprNode { kind: ExprKind::BoolLiteral(false) };
    }
    // String literal
    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        return ExprNode {
            kind: ExprKind::StringLiteral(s[1..s.len() - 1].to_string()),
        };
    }
    // Constants like OUTPUT, HIGH, LOW, INPUT
    // Default: treat as identifier
    ExprNode { kind: ExprKind::Identifier(s.to_string()) }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

fn attr_str(node: &BaseNode, key: &str) -> String {
    node.attributes
        .get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn attr_str_opt(node: &BaseNode, key: &str) -> Option<String> {
    node.attributes
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

fn is_hw_call(nt: &NodeType) -> bool {
    matches!(
        nt,
        NodeType::GpioSet
            | NodeType::GpioRead
            | NodeType::AnalogWrite
            | NodeType::AnalogRead
            | NodeType::PinMode
            | NodeType::DelayMs
            | NodeType::DelayUs
            | NodeType::Millis
            | NodeType::Micros
            | NodeType::Tone
            | NodeType::NoTone
            | NodeType::SerialBegin
            | NodeType::Print
            | NodeType::PrintLn
            | NodeType::UartRead
            | NodeType::UartWrite
            | NodeType::UartAvailable
            | NodeType::I2cBegin
            | NodeType::I2cWrite
            | NodeType::I2cRead
            | NodeType::I2cRequestFrom
            | NodeType::I2cBeginTransmission
            | NodeType::I2cEndTransmission
            | NodeType::SpiBegin
            | NodeType::SpiTransfer
            | NodeType::SpiEnd
            | NodeType::PwmInit
            | NodeType::PwmSetDuty
            | NodeType::PwmSetFreq
            | NodeType::PwmStop
            | NodeType::ServoAttach
            | NodeType::ServoWrite
            | NodeType::ServoDetach
            | NodeType::ServoRead
    )
}

fn hw_call_name(nt: &NodeType) -> (String, Option<String>) {
    match nt {
        NodeType::GpioSet => ("digitalWrite".into(), None),
        NodeType::GpioRead => ("digitalRead".into(), None),
        NodeType::AnalogWrite => ("analogWrite".into(), None),
        NodeType::AnalogRead => ("analogRead".into(), None),
        NodeType::PinMode => ("pinMode".into(), None),
        NodeType::DelayMs => ("delay".into(), None),
        NodeType::DelayUs => ("delayMicroseconds".into(), None),
        NodeType::Millis => ("millis".into(), None),
        NodeType::Micros => ("micros".into(), None),
        NodeType::Tone => ("tone".into(), None),
        NodeType::NoTone => ("noTone".into(), None),
        NodeType::SerialBegin => ("begin".into(), Some("Serial".into())),
        NodeType::Print => ("print".into(), Some("Serial".into())),
        NodeType::PrintLn => ("println".into(), Some("Serial".into())),
        NodeType::UartRead => ("read".into(), Some("Serial".into())),
        NodeType::UartWrite => ("write".into(), Some("Serial".into())),
        NodeType::UartAvailable => ("available".into(), Some("Serial".into())),
        NodeType::I2cBegin => ("begin".into(), Some("Wire".into())),
        NodeType::I2cWrite => ("write".into(), Some("Wire".into())),
        NodeType::I2cRead => ("read".into(), Some("Wire".into())),
        NodeType::I2cRequestFrom => ("requestFrom".into(), Some("Wire".into())),
        NodeType::I2cBeginTransmission => ("beginTransmission".into(), Some("Wire".into())),
        NodeType::I2cEndTransmission => ("endTransmission".into(), Some("Wire".into())),
        NodeType::SpiBegin => ("begin".into(), Some("SPI".into())),
        NodeType::SpiTransfer => ("transfer".into(), Some("SPI".into())),
        NodeType::SpiEnd => ("end".into(), Some("SPI".into())),
        NodeType::PwmInit => ("pwmInit".into(), None),
        NodeType::PwmSetDuty => ("pwmSetDuty".into(), None),
        NodeType::PwmSetFreq => ("pwmSetFreq".into(), None),
        NodeType::PwmStop => ("pwmStop".into(), None),
        NodeType::ServoAttach => ("attach".into(), Some("Servo".into())),
        NodeType::ServoWrite => ("write".into(), Some("Servo".into())),
        NodeType::ServoDetach => ("detach".into(), Some("Servo".into())),
        NodeType::ServoRead => ("read".into(), Some("Servo".into())),
        _ => ("unknown".into(), None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugins::c::c_parser::CParser;

    #[test]
    fn convert_blink_sketch() {
        let src = r#"
void setup() {
    pinMode(13, OUTPUT);
}
void loop() {
    digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
}
"#;
        let prog = CParser::parse(src).expect("parse failed");
        let typed = nodes_to_typed(&prog);

        // setup + loop bodies are inlined into body
        assert!(!typed.body.is_empty(), "body should not be empty");
        assert!(typed.has_loop, "should detect loop function");

        // Should have a main-like structure with calls
        let call_count = typed
            .body
            .iter()
            .filter(|s| matches!(&s.kind, StatementKind::Call(_)))
            .count();
        assert!(call_count >= 3, "should have at least 3 calls (pinMode, digitalWrite, delay), got {call_count}");
    }

    #[test]
    fn convert_with_globals() {
        let src = r#"
int ledPin = 13;
void setup() {
    pinMode(ledPin, OUTPUT);
}
void loop() {}
"#;
        let prog = CParser::parse(src).expect("parse failed");
        let typed = nodes_to_typed(&prog);

        assert!(!typed.globals.is_empty(), "should have globals");
        // CParser includes initializer in decl name: "ledPin = 13"
        assert!(typed.globals[0].name.contains("ledPin"), "global should contain ledPin, got: {}", typed.globals[0].name);
    }
}
