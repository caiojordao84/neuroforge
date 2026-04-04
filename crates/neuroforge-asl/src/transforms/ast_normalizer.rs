//! Normalizador de AST     expande postfix side-effects e simplifica n  s de hardware.

//! Migrado de: src/engine/asl/transforms/astNormalizer.ts



use serde_json::Value;

use std::sync::atomic::{AtomicU32, Ordering};



use crate::helpers::array_utils::BaseNode;



static TEMP_COUNTER: AtomicU32 = AtomicU32::new(0);



fn reset_counter() {

    TEMP_COUNTER.store(0, Ordering::SeqCst);

}

fn next_temp_id() -> String {

    let n = TEMP_COUNTER.fetch_add(1, Ordering::SeqCst);

    format!("__tmp_{n}")

}



// N  s de hardware cujo wrapper ExpressionStatement deve ser removido.

const HARDWARE_NODES: &[&str] = &[

    "GpioSet",

    "GpioRead",

    "AnalogRead",

    "AnalogWrite",

    "HardwarePwm",

    "LcdClear",

    "LcdCursor",

    "LcdPrint",

    "OledText",

    "OledShow",

    "OledClear",

    "SerialBegin",

    "SerialAvailable",

    "SerialReadString",

    "CallExpression",

];



// N  s de hardware que precisam de simplifica    o do pino `Pin(x)`     `x`.

const PIN_SIMPLIFY_NODES: &[&str] = &["GpioSet", "GpioRead", "AnalogRead", "AnalogWrite"];



/// Entry point p  blico     equivalente a `normalizeAST()` em TypeScript.

pub fn normalize_ast(mut node: BaseNode) -> BaseNode {

    reset_counter();

    normalize_recursive(&mut node);

    node

}



fn normalize_recursive(node: &mut BaseNode) {

    if node.node_type == "ForLoop" {

        return;

    }

    if !node.children.is_empty() {

        let children = std::mem::take(&mut node.children);

        node.children = normalize_list(children);

    }

}



fn normalize_list(nodes: Vec<BaseNode>) -> Vec<BaseNode> {

    let mut result = Vec::with_capacity(nodes.len());



    for node in nodes {

        let mut side_effects: Vec<BaseNode> = Vec::new();

        let transformed = process_postfix_in_expr(node, &mut side_effects);



        // Side-effects extra  dos do postfix v  o antes do n   original

        for (idx, effect) in side_effects.into_iter().enumerate() {

            let stmt_id = format!("pf_stmt_{}_{idx}", transformed.node_type);

            result.push(BaseNode {

                node_type: "ExpressionStatement".to_string(),

                attributes: std::collections::HashMap::new(),

                children: vec![effect],

            });

            let _ = stmt_id;

        }



        // Unwrap ExpressionStatement que envolve um n   de hardware

        let mut final_node = if transformed.node_type == "ExpressionStatement"

            && transformed.children.len() == 1

            && HARDWARE_NODES.contains(&transformed.children[0].node_type.as_str())

        {

            

            transformed.children.into_iter().next().unwrap()

        } else {

            transformed

        };



        // Simplifica    o Pin(x)     x nos n  s de hardware de GPIO

        if PIN_SIMPLIFY_NODES.contains(&final_node.node_type.as_str()) {

            for child in &mut final_node.children {

                if child.node_type == "CallExpression"

                    && child.attributes.get("callee").and_then(|v| v.as_str()) == Some("Pin")

                    && !child.children.is_empty()

                {

                    let first = child.children.remove(0);

                    *child = first;

                }

            }

        }



        normalize_recursive(&mut final_node);

        result.push(final_node);

    }



    result

}



fn process_postfix_in_expr(node: BaseNode, stmts: &mut Vec<BaseNode>) -> BaseNode {

    // Detecta postfix `i++` / `i--` sobre um Identifier simples

    if node.node_type == "UnaryExpression" {

        let is_postfix = node.attributes.get("prefix").and_then(|v| v.as_bool()) == Some(false);

        let op = node

            .attributes

            .get("operator")

            .and_then(|v| v.as_str())

            .unwrap_or("");



        if is_postfix && (op == "++" || op == "--") {

            if let Some(operand) = node.children.first() {

                if operand.node_type == "Identifier" {

                    let var_name = operand

                        .attributes

                        .get("name")

                        .and_then(|v| v.as_str())

                        .unwrap_or("")

                        .to_string();

                    let tid = next_temp_id();



                    // tmp = varName

                    stmts.push(make_assign_node(&tid, &var_name, &tid));



                    // varName = varName +/- 1

                    let arith_op = if op == "++" { "+" } else { "-" };

                    stmts.push(make_increment_node(&var_name, arith_op, &tid));



                    // Retorna refer  ncia ao tempor  rio

                    let mut attrs = std::collections::HashMap::new();

                    attrs.insert("name".to_string(), Value::String(tid.clone()));

                    return BaseNode {

                        node_type: "Identifier".to_string(),

                        attributes: attrs,

                        children: vec![],

                    };

                }

            }

        }

    }



    let structural = [

        "IfStatement",

        "WhileLoop",

        "ForLoop",

        "ReturnStatement",

        "ExpressionStatement",

        "Assignment",

        "Expression",

    ];



    if structural.contains(&node.node_type.as_str()) {

        let mut new_node = node;

        match new_node.node_type.as_str() {

            "ForLoop" => return new_node,

            "IfStatement"

            | "WhileLoop"

            | "ReturnStatement"

            | "ExpressionStatement"

            | "Expression" => {

                if !new_node.children.is_empty() {

                    let first = new_node.children.remove(0);

                    let processed = process_postfix_in_expr(first, stmts);

                    new_node.children.insert(0, processed);

                }

            }

            "Assignment" => {

                if new_node.children.len() >= 2 {

                    let rhs = new_node.children.remove(1);

                    let lhs = new_node.children.remove(0);

                    let new_lhs = process_postfix_in_expr(lhs, stmts);

                    let new_rhs = process_postfix_in_expr(rhs, stmts);

                    new_node.children.insert(0, new_lhs);

                    new_node.children.insert(1, new_rhs);

                }

            }

            _ => {}

        }

        return new_node;

    }



    // Processar filhos genericamente

    let mut new_node = node;

    let children = std::mem::take(&mut new_node.children);

    new_node.children = children

        .into_iter()

        .map(|child| process_postfix_in_expr(child, stmts))

        .collect();

    new_node

}



// Helpers internos para construir n  s de atribui    o

fn make_ident(name: &str, _id_prefix: &str) -> BaseNode {

    let mut attrs = std::collections::HashMap::new();

    attrs.insert("name".to_string(), Value::String(name.to_string()));

    BaseNode {

        node_type: "Identifier".to_string(),

        attributes: attrs,

        children: vec![],

    }

}



fn make_assign_node(tmp_name: &str, src_name: &str, _id: &str) -> BaseNode {

    BaseNode {

        node_type: "BinaryExpression".to_string(),

        attributes: {

            let mut m = std::collections::HashMap::new();

            m.insert("operator".to_string(), Value::String("=".to_string()));

            m

        },

        children: vec![make_ident(tmp_name, "tid"), make_ident(src_name, "oid")],

    }

}



fn make_increment_node(var_name: &str, op: &str, _tid: &str) -> BaseNode {

    let bin_inner = BaseNode {

        node_type: "BinaryExpression".to_string(),

        attributes: {

            let mut m = std::collections::HashMap::new();

            m.insert("operator".to_string(), Value::String(op.to_string()));

            m

        },

        children: vec![

            make_ident(var_name, "vr"),

            BaseNode {

                node_type: "Literal".to_string(),

                attributes: {

                    let mut m = std::collections::HashMap::new();

                    m.insert("value".to_string(), Value::Number(1.into()));

                    m

                },

                children: vec![],

            },

        ],

    };



    BaseNode {

        node_type: "BinaryExpression".to_string(),

        attributes: {

            let mut m = std::collections::HashMap::new();

            m.insert("operator".to_string(), Value::String("=".to_string()));

            m

        },

        children: vec![make_ident(var_name, "vid"), bin_inner],

    }

}



#[cfg(test)]

mod tests {

    use super::*;

    use std::collections::HashMap;



    fn ident(name: &str) -> BaseNode {

        let mut attrs = HashMap::new();

        attrs.insert("name".to_string(), Value::String(name.to_string()));

        BaseNode {

            node_type: "Identifier".to_string(),

            attributes: attrs,

            children: vec![],

        }

    }



    fn postfix_node(var: &str, op: &str) -> BaseNode {

        let mut attrs = HashMap::new();

        attrs.insert("operator".to_string(), Value::String(op.to_string()));

        attrs.insert("prefix".to_string(), Value::Bool(false));

        BaseNode {

            node_type: "UnaryExpression".to_string(),

            attributes: attrs,

            children: vec![ident(var)],

        }

    }



    #[test]

    fn test_postfix_increment_expands() {

        let node = postfix_node("i", "++");

        let mut stmts = vec![];

        let result = process_postfix_in_expr(node, &mut stmts);

        // Deve ter gerado 2 side-effects (tmp=i; i=i+1)

        assert_eq!(stmts.len(), 2);

        // O n   retornado deve ser Identifier (__tmp_0)

        assert_eq!(result.node_type, "Identifier");

    }



    #[test]

    fn test_forloop_passthrough() {

        let node = BaseNode {

            node_type: "ForLoop".to_string(),

            attributes: HashMap::new(),

            children: vec![postfix_node("x", "++")],

        };

        let mut stmts = vec![];

        let result = process_postfix_in_expr(node, &mut stmts);

        // ForLoop n  o deve ser processado     sem side-effects

        assert_eq!(stmts.len(), 0);

        assert_eq!(result.node_type, "ForLoop");

    }

}











