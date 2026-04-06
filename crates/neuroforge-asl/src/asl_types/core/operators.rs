//! Operators for ASL expressions: UnaryOp, BinaryOp
//!
//! Per Rule R5: operators are always direct symbols ("+", ">=", "&&")
//! never name-based ("add", "gte").

use serde::{Deserialize, Serialize};

/// Operador unário. Serializa como símbolo direto (R5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum UnaryOp {
    #[default]
    #[serde(rename = "-")]
    Neg,
    #[serde(rename = "!")]
    Not,
    #[serde(rename = "~")]
    BitNot,
    #[serde(rename = "+")]
    Pos,
    #[serde(rename = "&")]
    Addr,
    #[serde(rename = "*")]
    Deref,
}

impl UnaryOp {
    pub fn parse(s: &str) -> Self {
        match s {
            "-" => UnaryOp::Neg,
            "!" => UnaryOp::Not,
            "~" => UnaryOp::BitNot,
            "+" => UnaryOp::Pos,
            "&" => UnaryOp::Addr,
            "*" => UnaryOp::Deref,
            // IEC aliases
            "NOT" | "not" => UnaryOp::Not,
            "NEG" | "neg" => UnaryOp::Neg,
            _ => UnaryOp::Neg,
        }
    }

    /// Símbolo canônico ASL (R5).
    pub fn to_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Neg => "-",
            UnaryOp::Not => "!",
            UnaryOp::BitNot => "~",
            UnaryOp::Pos => "+",
            UnaryOp::Addr => "&",
            UnaryOp::Deref => "*",
        }
    }

    /// Símbolo IEC 61131-3 (para o ST generator).
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Not | UnaryOp::BitNot => "NOT ",
            UnaryOp::Neg => "-",
            other => other.to_symbol(),
        }
    }
}

/// Operador binário. Serializa como símbolo direto (R5 – "+" não "add", ">=" não "gte").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub enum BinaryOp {
    #[default]
    #[serde(rename = "+")]
    Add,
    #[serde(rename = "-")]
    Sub,
    #[serde(rename = "*")]
    Mul,
    #[serde(rename = "/")]
    Div,
    #[serde(rename = "%")]
    Mod,
    #[serde(rename = "//")]
    IntDiv,
    #[serde(rename = "**")]
    Pow,
    #[serde(rename = "==")]
    Eq,
    #[serde(rename = "!=")]
    Neq,
    #[serde(rename = "++")]
    PostfixInc,
    #[serde(rename = "--")]
    PostfixDec,
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = "<=")]
    Lte,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = ">=")]
    Gte,
    #[serde(rename = "&&")]
    And,
    #[serde(rename = "||")]
    Or,
    #[serde(rename = "&")]
    BitAnd,
    #[serde(rename = "|")]
    BitOr,
    #[serde(rename = "^")]
    BitXor,
    #[serde(rename = "<<")]
    Shl,
    #[serde(rename = ">>")]
    Shr,
}

impl BinaryOp {
    pub fn parse(s: &str) -> Self {
        match s {
            "+" => BinaryOp::Add,
            "-" => BinaryOp::Sub,
            "*" => BinaryOp::Mul,
            "/" => BinaryOp::Div,
            "%" => BinaryOp::Mod,
            "//" => BinaryOp::IntDiv,
            "**" => BinaryOp::Pow,
            "==" => BinaryOp::Eq,
            "!=" => BinaryOp::Neq,
            "<" => BinaryOp::Lt,
            "<=" => BinaryOp::Lte,
            ">" => BinaryOp::Gt,
            ">=" => BinaryOp::Gte,
            "&&" => BinaryOp::And,
            "||" => BinaryOp::Or,
            "&" => BinaryOp::BitAnd,
            "|" => BinaryOp::BitOr,
            "^" => BinaryOp::BitXor,
            "<<" => BinaryOp::Shl,
            ">>" => BinaryOp::Shr,
            // IEC 61131-3 text operators
            "AND" | "and" => BinaryOp::And,
            "OR" | "or" => BinaryOp::Or,
            "XOR" | "xor" => BinaryOp::BitXor,
            "MOD" | "mod" => BinaryOp::Mod,
            "EXPT" | "expt" => BinaryOp::Pow,
            _ => BinaryOp::Add,
        }
    }

    /// Símbolo canônico ASL (R5).
    pub fn to_symbol(&self) -> &'static str {
        match self {
            BinaryOp::Add => "+",
            BinaryOp::Sub => "-",
            BinaryOp::Mul => "*",
            BinaryOp::Div => "/",
            BinaryOp::Mod => "%",
            BinaryOp::IntDiv => "//",
            BinaryOp::Pow => "**",
            BinaryOp::Eq => "==",
            BinaryOp::Neq => "!=",
            BinaryOp::Lt => "<",
            BinaryOp::Lte => "<=",
            BinaryOp::Gt => ">",
            BinaryOp::Gte => ">=",
            BinaryOp::And => "&&",
            BinaryOp::Or => "||",
            BinaryOp::BitAnd => "&",
            BinaryOp::BitOr => "|",
            BinaryOp::BitXor => "^",
            BinaryOp::Shl => "<<",
            BinaryOp::Shr => ">>",
            BinaryOp::PostfixInc => " ++",
            BinaryOp::PostfixDec => "--",
        }
    }

    /// Símbolo IEC 61131-3 ST (para o ST generator).
    /// Eq="=", Neq="<>", And="AND", Or="OR", BitXor="XOR", Mod="MOD", Pow="EXPT"
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            BinaryOp::Eq => "=",
            BinaryOp::Neq => "<>",
            BinaryOp::And => "AND",
            BinaryOp::Or => "OR",
            BinaryOp::BitAnd => "AND",
            BinaryOp::BitOr => "OR",
            BinaryOp::BitXor => "XOR",
            BinaryOp::Mod => "MOD",
            BinaryOp::Pow => "EXPT",
            BinaryOp::IntDiv => "/",
            other => other.to_symbol(),
        }
    }
}
