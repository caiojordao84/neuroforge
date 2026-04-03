//! nodes_to_typed.rs — Converte nodes::ProgramNode (legacy) → typed_nodes::ProgramNode
//!
//! Necessário para a pipeline parse_to_asl_program em WASM bindings:
//!   CParser::parse() → nodes::ProgramNode → typed_nodes::ProgramNode → ast_to_asl → AslProgram

use crate::types::nodes::{BaseNode, NodeType};
use crate::types::typed_nodes::{
    BlockKind, BlockNode, CallNode, ExprKind, ExprNode, FunctionNode, ParamNode, ProgramNode,
    StatementKind, StatementNode, VarDeclNode,
};

pub fn nodes_to_typed(prog: &crate::types::nodes::ProgramNode) -> ProgramNode {
    let globals: Vec<VarDeclNode> = prog
        .globals
        .iter()
        .filter_map(|g| base_to_var_decl(g))
        .collect();

    let functions: Vec<FunctionNode> = prog.functions.iter().map(|f| convert_function(f)).collect();

    // Tenta usar os corpos já separados no ProgramNode untyped.
    let mut setup_body: Vec<StatementNode> = prog
        .setup_body
        .iter()
        .filter_map(base_to_statement)
        .collect();
    let mut loop_body: Vec<StatementNode> = prog
        .loop_body
        .iter()
        .filter_map(base_to_statement)
        .collect();
    let mut has_loop = prog.has_loop;
    let mut other_fns: Vec<FunctionNode> = vec![];

    // Se os corpos estiverem vazios, tenta extrair das funções (fallback/compatibilidade).
    if setup_body.is_empty() && loop_body.is_empty() {
        for f in &functions {
            match f.name.as_str() {
                "setup" => {
                    setup_body.extend(f.body.clone());
                }
                "loop" => {
                    loop_body.extend(f.body.clone());
                    has_loop = true;
                }
                _ => other_fns.push(f.clone()),
            }
        }
    } else {
        // Se as funções setup/loop já foram "extraídas" para os corpos,
        // filtramos elas da lista de funções regulares.
        for f in functions {
            if f.name != "setup" && f.name != "loop" {
                other_fns.push(f);
            }
        }
    }

    ProgramNode {
        globals,
        functions: other_fns,
        setup_body,
        loop_body,
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
        NodeType::VarDeclaration => Some(StatementNode {
            kind: StatementKind::VarDecl(base_to_var_decl(node)?),
        }),
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
            let cond_node = node.children.get(0).expect("If condition missing");
            let then_node = node.children.get(1).expect("If consequence missing");
            let else_node = node.children.get(2);

            let condition = base_to_expr(cond_node);
            let then_body = then_node
                .children
                .iter()
                .filter_map(|n| base_to_statement(n))
                .collect();
            let else_body = else_node.map(|eb| {
                eb.children
                    .iter()
                    .filter_map(|n| base_to_statement(n))
                    .collect()
            });

            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::If {
                        condition,
                        then_body,
                        else_body,
                    },
                }),
            })
        }
        NodeType::WhileLoop => {
            let cond_node = node.children.get(0).expect("While condition missing");
            let body_node = node.children.get(1).expect("While body missing");

            let condition = base_to_expr(cond_node);
            let body = body_node
                .children
                .iter()
                .filter_map(|n| base_to_statement(n))
                .collect();

            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::While { condition, body },
                }),
            })
        }
        NodeType::DoWhile => {
            let cond_node = node.children.get(0).expect("DoWhile condition missing");
            let body_node = node.children.get(1).expect("DoWhile body missing");

            let condition = base_to_expr(cond_node);
            let body = body_node
                .children
                .iter()
                .filter_map(|n| base_to_statement(n))
                .collect();

            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::DoWhile { condition, body },
                }),
            })
        }
        NodeType::ForLoop => {
            let init_node = node.children.get(0);
            let cond_node = node.children.get(1);
            let upd_node = node.children.get(2);
            let body_node = node.children.get(3);

            let init = init_node.map(|n| base_to_expr(n));
            let condition = cond_node.map(|n| base_to_expr(n));
            let update = upd_node.map(|n| base_to_expr(n));

            let body = body_node
                .map(|b| {
                    b.children
                        .iter()
                        .filter_map(|n| base_to_statement(n))
                        .collect()
                })
                .unwrap_or_default();

            Some(StatementNode {
                kind: StatementKind::Block(BlockNode {
                    kind: BlockKind::For {
                        init,
                        condition,
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
        NodeType::FunctionCall => {
            let name = attr_str(node, "name");
            let args = node.children.iter().map(|n| base_to_expr(n)).collect();
            ExprNode {
                kind: ExprKind::Call(CallNode {
                    name,
                    object: None,
                    args,
                    result_var: None,
                }),
            }
        }
        nt if is_hw_call(nt) => {
            let (name, object) = hw_call_name(nt);
            let args = node.children.iter().map(|n| base_to_expr(n)).collect();
            ExprNode {
                kind: ExprKind::Call(CallNode {
                    name,
                    object,
                    args,
                    result_var: None,
                }),
            }
        }
        _ => ExprNode {
            kind: ExprKind::Identifier(
                attr_str_opt(node, "value").unwrap_or_else(|| format!("{:?}", node.node_type)),
            ),
        },
    }
}

fn parse_raw_expr(s: &str) -> ExprNode {
    let s = s.trim();
    if s.is_empty() {
        return ExprNode {
            kind: ExprKind::NullLiteral,
        };
    }
    // Try integer
    if let Ok(n) = s.parse::<i64>() {
        return ExprNode {
            kind: ExprKind::IntLiteral(n),
        };
    }
    // Try float
    if let Ok(f) = s.parse::<f64>() {
        return ExprNode {
            kind: ExprKind::FloatLiteral(f),
        };
    }
    // Boolean
    if s == "true" || s == "HIGH" || s == "1" {
        return ExprNode {
            kind: ExprKind::BoolLiteral(true),
        };
    }
    if s == "false" || s == "LOW" || s == "0" {
        return ExprNode {
            kind: ExprKind::BoolLiteral(false),
        };
    }

    if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
        return ExprNode {
            kind: ExprKind::StringLiteral(s[1..s.len() - 1].to_string()),
        };
    }

    if s.ends_with("++") {
        let name = s[..s.len() - 2].trim();
        if !name.is_empty() && !name.contains(' ') {
            return ExprNode {
                kind: ExprKind::PostfixInc(name.to_string()),
            };
        }
    }
    if s.ends_with("--") {
        let name = s[..s.len() - 2].trim();
        if !name.is_empty() && !name.contains(' ') {
            return ExprNode {
                kind: ExprKind::PostfixDec(name.to_string()),
            };
        }
    }

    // Operadores binários (simplificado)
    for op in [
        "==", "!=", ">=", "<=", ">", "<", "&&", "||", "+", "-", "*", "/",
    ] {
        if let Some(idx) = s.find(op) {
            // Evitar conflitos com operadores compostos (ex: = vs ==) e postfix (ex: i--)
            if (op == "==" || op == "!=" || op == ">=" || op == "<=")
                || (!s.get(idx..idx + 2).map_or(false, |next| {
                    next == "=="
                        || next == "!="
                        || next == ">="
                        || next == "<="
                        || next == "--"
                        || next == "++"
                }))
            {
                let left = s[..idx].trim();
                let right = s[idx + op.len()..].trim();

                if !left.is_empty() && !right.is_empty() {
                    // Verificamos se estamos a meio de parênteses (ex: "f(a == b)")
                    let open_count = left.chars().filter(|&c| c == '(').count();
                    let close_count = left.chars().filter(|&c| c == ')').count();

                    if open_count == close_count {
                        return ExprNode {
                            kind: ExprKind::BinaryOp {
                                op: op.to_string(),
                                left: Box::new(parse_raw_expr(left)),
                                right: Box::new(parse_raw_expr(right)),
                            },
                        };
                    }
                }
            }
        }
    }

    if s.starts_with("digitalRead(") && s.ends_with(')') {
        let pin_str = s[12..s.len() - 1].trim();
        return ExprNode {
            kind: ExprKind::Call(CallNode {
                name: "digitalRead".to_string(),
                object: None,
                args: vec![parse_raw_expr(pin_str)],
                result_var: None,
            }),
        };
    }
    if s.starts_with("analogRead(") && s.ends_with(')') {
        let pin_str = s[11..s.len() - 1].trim();
        return ExprNode {
            kind: ExprKind::Call(CallNode {
                name: "analogRead".to_string(),
                object: None,
                args: vec![parse_raw_expr(pin_str)],
                result_var: None,
            }),
        };
    }

    ExprNode {
        kind: ExprKind::Identifier(s.to_string()),
    }
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
        assert!(
            !typed.setup_body.is_empty() || !typed.loop_body.is_empty(),
            "body should not be empty"
        );
        assert!(typed.has_loop, "should detect loop function");

        // Should have a main-like structure with calls
        let call_count = typed
            .setup_body
            .iter()
            .chain(typed.loop_body.iter())
            .filter(|s| matches!(&s.kind, StatementKind::Call(_)))
            .count();
        assert!(
            call_count >= 3,
            "should have at least 3 calls (pinMode, digitalWrite, delay), got {call_count}"
        );
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
        assert!(
            typed.globals[0].name.contains("ledPin"),
            "global should contain ledPin, got: {}",
            typed.globals[0].name
        );
    }
}
