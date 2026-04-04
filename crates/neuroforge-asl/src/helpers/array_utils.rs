//! Utilit  rios de arrays para os transforms ASL.

//! Migrado de: src/engine/asl/helpers/arrayUtils.ts



use serde_json::Value;



/// Representa um n   base do AST TypeScript (equivalente de BaseNode).

/// Usado apenas neste m  dulo para manter compatibilidade sem  ntica com o TS.

#[derive(Debug, Clone)]

pub struct BaseNode {

    pub node_type: String,

    pub attributes: std::collections::HashMap<String, Value>,

    pub children: Vec<BaseNode>,

}



/// Resolve o tamanho de uma express  o de dimens  o de array.

/// Suporta Literal (inteiro) e Identifier (lookup no globalsMap).

/// Equivalente a `resolveSize()` em TypeScript.

pub fn resolve_size(

    expr: Option<&BaseNode>,

    globals_map: &std::collections::HashMap<String, Value>,

) -> usize {

    let Some(node) = expr else { return 0 };



    if node.node_type == "Literal" {

        if let Some(v) = node.attributes.get("value") {

            if let Some(n) = v.as_f64() {

                return n.floor() as usize;

            }

        }

    }



    if node.node_type == "Identifier" {

        if let Some(name) = node.attributes.get("name").and_then(|v| v.as_str()) {

            if let Some(val) = globals_map.get(name) {

                if let Some(n) = val.as_f64() {

                    return n.floor() as usize;

                }

            }

        }

    }



    0

}



/// Constr  i um array JSON multidimensional inicializado a zero.

/// Suporta 1D, 2D e 3D     equivalente a `buildEmptyArray()` em TypeScript.

pub fn build_empty_array(

    size_expr: Option<&BaseNode>,

    size2_expr: Option<&BaseNode>,

    globals_map: &std::collections::HashMap<String, Value>,

    size3_expr: Option<&BaseNode>,

) -> Value {

    let n = resolve_size(size_expr, globals_map);



    if let Some(_s3) = size3_expr {

        let o = resolve_size(size3_expr, globals_map);

        if size2_expr.is_some() {

            let m = resolve_size(size2_expr, globals_map);

            return Value::Array(

                (0..n)

                    .map(|_| {

                        Value::Array(

                            (0..m)

                                .map(|_| Value::Array(vec![Value::Number(0.into()); o]))

                                .collect(),

                        )

                    })

                    .collect(),

            );

        }

        return Value::Array(

            (0..n)

                .map(|_| Value::Array(vec![Value::Number(0.into()); o]))

                .collect(),

        );

    }



    if size2_expr.is_some() {

        let m = resolve_size(size2_expr, globals_map);

        return Value::Array(

            (0..n)

                .map(|_| Value::Array(vec![Value::Number(0.into()); m]))

                .collect(),

        );

    }



    Value::Array(vec![Value::Number(0.into()); n])

}



/// C  pia profunda de um valor JSON.

/// Equivalente a `deepCopyValue()` em TypeScript.

/// Em Rust, `Value::clone()` j      uma c  pia profunda     esta fun    o existe

/// apenas para manter a mesma API p  blica.

pub fn deep_copy_value(val: &Value) -> Value {

    val.clone()

}



#[cfg(test)]

mod tests {

    use super::*;

    use std::collections::HashMap;



    fn lit_node(n: i64) -> BaseNode {

        let mut attrs = HashMap::new();

        attrs.insert("value".to_string(), Value::Number(n.into()));

        BaseNode { node_type: "Literal".to_string(), attributes: attrs, children: vec![] }

    }



    #[test]

    fn test_resolve_literal() {

        assert_eq!(resolve_size(Some(&lit_node(5)), &HashMap::new()), 5);

    }



    #[test]

    fn test_resolve_none() {

        assert_eq!(resolve_size(None, &HashMap::new()), 0);

    }



    #[test]

    fn test_1d_array() {

        let arr = build_empty_array(Some(&lit_node(3)), None, &HashMap::new(), None);

        assert_eq!(arr, Value::Array(vec![Value::Number(0.into()); 3]));

    }



    #[test]

    fn test_2d_array() {

        let arr = build_empty_array(Some(&lit_node(2)), Some(&lit_node(3)), &HashMap::new(), None);

        if let Value::Array(rows) = arr {

            assert_eq!(rows.len(), 2);

            if let Value::Array(cols) = &rows[0] {

                assert_eq!(cols.len(), 3);

            }

        }

    }

}











