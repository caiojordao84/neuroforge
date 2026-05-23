//! Core types for ASL: AslType, AslValue, Duration, Condition
//!
//! This module contains the type system definitions per Section 3
//! of the ASL Semantic Dictionary v1.2.3.

use serde::{Deserialize, Serialize};

use crate::asl_types::core::operators::{BinaryOp, UnaryOp};
use crate::asl_types::core::program::AslDuration;

/// Tipos escalares, compostos e especiais conforme §3 do Dicionário ASL v1.2.3.
/// Serializa em lowercase (ex: "int32", "float", "bool", "array").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AslType {
    // §3.1     Inteiros explícitos
    Sint8,
    Int16,
    #[default]
    Int32,
    Int64,
    Uint8,
    Uint16,
    Uint32,
    Uint64,
    // §3.2     Aliases genéricos
    Int,   // alias → int32
    Uint,  // alias → uint32
    Short, // alias → int16
    Long,  // alias → int64
    Byte,  // alias → uint8
    // §3.3     Float, lógica, char, string, void
    Float,
    Double,
    Bool,
    Char,
    String,
    Void,
    Auto,
    // §3.4     Compostos e especiais
    Array,
    Struct,
    Enum,
    Option,
    // §3.5     Tipos IEC de tempo/data (novo em v1.2)
    Time,
    Date,
    #[serde(rename = "timeOfDay")]
    TimeOfDay,
    #[serde(rename = "dateTime")]
    DateTime,
}

impl AslType {
    /// Devolve o nome canônico conforme o Dicionário (used em serialização de campos `type`).
    pub fn as_str(&self) -> &'static str {
        match self {
            AslType::Sint8 => "sint8",
            AslType::Int16 => "int16",
            AslType::Int32 => "int32",
            AslType::Int64 => "int64",
            AslType::Uint8 => "uint8",
            AslType::Uint16 => "uint16",
            AslType::Uint32 => "uint32",
            AslType::Uint64 => "uint64",
            AslType::Int => "int",
            AslType::Uint => "uint",
            AslType::Short => "short",
            AslType::Long => "long",
            AslType::Byte => "byte",
            AslType::Float => "float",
            AslType::Double => "double",
            AslType::Bool => "bool",
            AslType::Char => "char",
            AslType::String => "string",
            AslType::Void => "void",
            AslType::Auto => "auto",
            AslType::Array => "array",
            AslType::Struct => "struct",
            AslType::Enum => "enum",
            AslType::Option => "option",
            AslType::Time => "time",
            AslType::Date => "date",
            AslType::TimeOfDay => "timeOfDay",
            AslType::DateTime => "dateTime",
        }
    }

    /// Parseia a partir de uma string canônica do Dicionário.
    pub fn parse(s: &str) -> Self {
        match s {
            "sint8" => AslType::Sint8,
            "int16" => AslType::Int16,
            "int32" => AslType::Int32,
            "int64" => AslType::Int64,
            "uint8" => AslType::Uint8,
            "uint16" => AslType::Uint16,
            "uint32" => AslType::Uint32,
            "uint64" => AslType::Uint64,
            "int" => AslType::Int,
            "uint" => AslType::Uint,
            "short" => AslType::Short,
            "long" => AslType::Long,
            "byte" => AslType::Byte,
            "float" => AslType::Float,
            "double" => AslType::Double,
            "bool" => AslType::Bool,
            "char" => AslType::Char,
            "string" => AslType::String,
            "void" => AslType::Void,
            "auto" => AslType::Auto,
            "array" => AslType::Array,
            "struct" => AslType::Struct,
            "enum" => AslType::Enum,
            "option" => AslType::Option,
            "time" => AslType::Time,
            "date" => AslType::Date,
            "timeOfDay" => AslType::TimeOfDay,
            "dateTime" => AslType::DateTime,
            // Aliases maiúsculas IEC 61131-3
            "BOOL" => AslType::Bool,
            "INT" => AslType::Int16,
            "DINT" => AslType::Int32,
            "LINT" => AslType::Int64,
            "SINT" => AslType::Sint8,
            "UINT" => AslType::Uint16,
            "UDINT" => AslType::Uint32,
            "ULINT" => AslType::Uint64,
            "REAL" => AslType::Float,
            "LREAL" => AslType::Double,
            "TIME" => AslType::Time,
            "DATE" => AslType::Date,
            "STRING" => AslType::String,
            "BYTE" => AslType::Byte,
            _ => AslType::Auto,
        }
    }
}

// ============================================================================
// Expressions
// ============================================================================

/// Expressões ASL. O campo `kind` é o discriminante (R3).
///
/// R5: operadores são sempre símbolos diretos em AslBinary/AslUnary.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslExpr {
    /// 14.1     literal
    #[serde(rename = "literal")]
    Literal(AslLiteral),
    /// 14.2     var
    #[serde(rename = "var")]
    Var(AslVarRef),
    /// 10.1     array (literal de array)
    #[serde(rename = "array")]
    Array(Box<AslArray>),
    /// object literal
    #[serde(rename = "object")]
    Object(Box<AslObject>),
    /// 10.2     index
    #[serde(rename = "index")]
    Index(Box<AslIndex>),
    /// index2D
    #[serde(rename = "index2D")]
    Index2D(Box<AslIndex2D>),
    /// index3D
    #[serde(rename = "index3D")]
    Index3D(Box<AslIndex3D>),
    /// 14.7     member
    #[serde(rename = "member")]
    Member(Box<AslMember>),
    /// 14.4     unary
    #[serde(rename = "unary")]
    Unary(Box<AslUnary>),
    /// 14.3     binary
    #[serde(rename = "binary")]
    Binary(Box<AslBinary>),
    /// 11.2     call
    #[serde(rename = "call")]
    Call(Box<AslCall>),
    /// 14.5     conditional (ternário)
    #[serde(rename = "conditional")]
    Conditional(Box<AslConditional>),
    /// 14.6     cast
    #[serde(rename = "cast")]
    Cast(Box<AslCast>),
    /// 12.2     newStruct
    #[serde(rename = "newStruct")]
    NewStruct(Box<AslNewStruct>),
    /// 10.3     arrayLength
    #[serde(rename = "arrayLength")]
    ArrayLength(Box<AslArrayLength>),
    /// 7.3     millis (expressão)
    #[serde(rename = "millis")]
    Millis,
    /// 7.3     micros (expressão)
    #[serde(rename = "micros")]
    Micros,
    /// 7.1     duration como expressão (para timers IEC)
    #[serde(rename = "duration")]
    Duration(AslDuration),
    /// 13.2     serialAvailable como expressão
    #[serde(rename = "serialAvailable")]
    SerialAvailable,
    /// 13.2     serialReadString como expressão
    #[serde(rename = "serialReadString")]
    SerialReadString,
    /// 13.2     serialReadByte como expressão
    #[serde(rename = "serialReadByte")]
    SerialReadByte,
    /// 14     Postfix increment
    #[serde(rename = "postfixInc")]
    PostfixInc(String),
    /// 14     Postfix decrement
    #[serde(rename = "postfixDec")]
    PostfixDec(String),
}

impl Default for AslExpr {
    fn default() -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::Value::Null,
        })
    }
}

impl AslExpr {
    /// Literal inteiro (R4 – nunca usar HIGH/LOW, usar int(1)/int(0))
    pub fn int(v: i64) -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::json!(v),
        })
    }

    pub fn float(v: f64) -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::json!(v),
        })
    }

    /// R4 – bool normalizado para 1/0 conforme o Dicionário
    pub fn bool_val(v: bool) -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::json!(v),
        })
    }

    pub fn str_val(v: &str) -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::json!(v),
        })
    }

    pub fn null() -> Self {
        AslExpr::Literal(AslLiteral {
            value: serde_json::Value::Null,
        })
    }

    pub fn var(name: &str) -> Self {
        AslExpr::Var(AslVarRef {
            name: name.to_string(),
        })
    }

    pub fn as_literal(&self) -> Option<&AslLiteral> {
        if let AslExpr::Literal(l) = self {
            Some(l)
        } else {
            None
        }
    }

    pub fn as_var(&self) -> Option<&AslVarRef> {
        if let AslExpr::Var(v) = self {
            Some(v)
        } else {
            None
        }
    }

    pub fn as_binary(&self) -> Option<&AslBinary> {
        if let AslExpr::Binary(b) = self {
            Some(b)
        } else {
            None
        }
    }
}

/// 14.1     literal. value é JSON Value (int, float, bool, string, null).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLiteral {
    pub value: serde_json::Value,
}

/// 14.2     var.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslVarRef {
    pub name: String,
}

/// 10.1     array literal.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslArray {
    pub elements: Vec<AslExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslObjectProp {
    pub key: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslObject {
    pub properties: Vec<AslObjectProp>,
}

/// 10.2     index.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslIndex {
    pub target: AslExpr,
    pub index: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex2D {
    pub array: AslExpr,
    pub row_index: AslExpr,
    pub col_index: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex3D {
    pub array: AslExpr,
    pub d1_index: AslExpr,
    pub d2_index: AslExpr,
    pub d3_index: AslExpr,
}

/// 14.7     member.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslMember {
    pub target: AslExpr,
    pub property: String,
}

/// 14.4     unary. `op` é símbolo direto (R5).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslUnary {
    pub op: UnaryOp,
    pub expr: AslExpr,
}

/// 14.3     binary. `op` é símbolo direto (R5).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslBinary {
    pub op: BinaryOp,
    pub left: AslExpr,
    pub right: AslExpr,
}

/// 11.2     call.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslCall {
    pub callee: String,
    pub args: Vec<AslExpr>,
}

/// 14.5     conditional (ternário).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslConditional {
    pub condition: AslExpr,
    pub when_true: AslExpr,
    pub when_false: AslExpr,
}

/// 14.6     cast.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslCast {
    pub target_type: String,
    pub expr: AslExpr,
}

/// 12.2     newStruct.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslNewStructField {
    pub name: String,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslNewStruct {
    pub r#struct: String,
    pub fields: Vec<AslNewStructField>,
}

/// 10.3     arrayLength.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslArrayLength {
    pub target: AslExpr,
}

// ============================================================================
// Value wrapper
// ============================================================================

/// Wrapper para valores ASL com tipo associado.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslValue {
    pub value: serde_json::Value,
    pub type_info: AslType,
}

// ============================================================================
// Condition helper
// ============================================================================

/// Helper para condições no transpiler.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub expr: AslExpr,
    pub negated: bool,
}

impl Condition {
    pub fn new(expr: AslExpr) -> Self {
        Self {
            expr,
            negated: false,
        }
    }

    pub fn toggle_negation(mut self) -> Self {
        self.negated = !self.negated;
        self
    }
}

// ============================================================================
// Phase B.2 Memory Models
// ============================================================================

/// Represents a variable defined in either the `data` (const) or `state` (mut) block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AslVariable {
    pub name: String,
    pub inferred_type: AslType,
    pub initial_value: String,
    pub is_constant: bool, // true if it comes from `data:`, false if from `state:`
}

impl AslVariable {
    /// Basic type inference based on literal strings during parsing
    pub fn infer_from_literal(val: &str) -> AslType {
        let val = val.trim();
        if val == "True" || val == "False" {
            AslType::Bool
        } else if val.contains('.') && val.parse::<f32>().is_ok() {
            AslType::Float
        } else if val.parse::<i32>().is_ok() {
            AslType::Int32
        } else {
            AslType::String
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
enum AslExprHelper {
    #[serde(rename = "literal")]
    Literal(AslLiteral),
    #[serde(rename = "var")]
    Var(AslVarRef),
    #[serde(rename = "array")]
    Array(Box<AslArray>),
    #[serde(rename = "object")]
    Object(Box<AslObject>),
    #[serde(rename = "index")]
    Index(Box<AslIndex>),
    #[serde(rename = "index2D")]
    Index2D(Box<AslIndex2D>),
    #[serde(rename = "index3D")]
    Index3D(Box<AslIndex3D>),
    #[serde(rename = "member")]
    Member(Box<AslMember>),
    #[serde(rename = "unary")]
    Unary(Box<AslUnary>),
    #[serde(rename = "binary")]
    Binary(Box<AslBinary>),
    #[serde(rename = "call")]
    Call(Box<AslCall>),
    #[serde(rename = "conditional")]
    Conditional(Box<AslConditional>),
    #[serde(rename = "cast")]
    Cast(Box<AslCast>),
    #[serde(rename = "newStruct")]
    NewStruct(Box<AslNewStruct>),
    #[serde(rename = "arrayLength")]
    ArrayLength(Box<AslArrayLength>),
    #[serde(rename = "millis")]
    Millis,
    #[serde(rename = "micros")]
    Micros,
}

impl From<AslExprHelper> for AslExpr {
    fn from(helper: AslExprHelper) -> Self {
        match helper {
            AslExprHelper::Literal(x) => AslExpr::Literal(x),
            AslExprHelper::Var(x) => AslExpr::Var(x),
            AslExprHelper::Array(x) => AslExpr::Array(x),
            AslExprHelper::Object(x) => AslExpr::Object(x),
            AslExprHelper::Index(x) => AslExpr::Index(x),
            AslExprHelper::Index2D(x) => AslExpr::Index2D(x),
            AslExprHelper::Index3D(x) => AslExpr::Index3D(x),
            AslExprHelper::Member(x) => AslExpr::Member(x),
            AslExprHelper::Unary(x) => AslExpr::Unary(x),
            AslExprHelper::Binary(x) => AslExpr::Binary(x),
            AslExprHelper::Call(x) => AslExpr::Call(x),
            AslExprHelper::Conditional(x) => AslExpr::Conditional(x),
            AslExprHelper::Cast(x) => AslExpr::Cast(x),
            AslExprHelper::NewStruct(x) => AslExpr::NewStruct(x),
            AslExprHelper::ArrayLength(x) => AslExpr::ArrayLength(x),
            AslExprHelper::Millis => AslExpr::Millis,
            AslExprHelper::Micros => AslExpr::Micros,
        }
    }
}

impl<'de> Deserialize<'de> for AslExpr {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        use serde::de::Error;
        let val = serde_json::Value::deserialize(deserializer)?;
        match val {
            serde_json::Value::Object(map) => {
                if map.contains_key("kind") {
                    let helper = serde_json::Value::Object(map);
                    let expr_helper = AslExprHelper::deserialize(helper).map_err(D::Error::custom)?;
                    Ok(expr_helper.into())
                } else {
                    let properties = map.into_iter().map(|(k, v)| {
                        let key_expr = AslExpr::Literal(AslLiteral { value: serde_json::Value::String(k) });
                        let val_expr = serde_json::from_value(v).unwrap_or(AslExpr::Literal(AslLiteral::default()));
                        AslObjectProp { key: key_expr, value: val_expr }
                    }).collect();
                    Ok(AslExpr::Object(Box::new(AslObject { properties })))
                }
            }
            serde_json::Value::Array(arr) => {
                let elements: Result<Vec<AslExpr>, _> = arr.into_iter().map(|v| serde_json::from_value(v).map_err(D::Error::custom)).collect();
                Ok(AslExpr::Array(Box::new(AslArray { elements: elements? })))
            }
            serde_json::Value::String(s) => {
                if s == "HIGH" || s == "LOW" || s == "INPUT" || s == "OUTPUT" {
                    Ok(AslExpr::Literal(AslLiteral { value: serde_json::Value::String(s) }))
                } else if (s.starts_with('"') && s.ends_with('"')) || (s.starts_with('\'') && s.ends_with('\'')) {
                    let inner = s[1..s.len()-1].to_string();
                    Ok(AslExpr::Literal(AslLiteral { value: serde_json::Value::String(inner) }))
                } else if s.chars().all(|c| c.is_alphanumeric() || c == '_') {
                    Ok(AslExpr::Var(AslVarRef { name: s }))
                } else {
                    Ok(AslExpr::Literal(AslLiteral { value: serde_json::Value::String(s) }))
                }
            }
            other => {
                Ok(AslExpr::Literal(AslLiteral { value: other }))
            }
        }
    }
}

