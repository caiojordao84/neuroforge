//! ASL v4 — Tipos unificados do motor ASL do NeuroForge.
//! Migrado de: src/engine/asl/ASLTypes.ts

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Tipo escalar
// ============================================================================

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AslType {
    Int,
    Float,
    Bool,
    String,
    Void,
    Struct,
}

impl Default for AslType {
    fn default() -> Self { AslType::Int }
}

// ============================================================================
// Structs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStructField {
    pub name: String,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStructDef {
    pub name: String,
    pub fields: Vec<AslStructField>,
}

// ============================================================================
// Programa ASL
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub target_board: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslProgram {
    /// Versão do schema ASL — semver (ex: "4.0.0")
    pub asl_version: String,
    pub metadata: AslMetadata,
    pub structs: Vec<AslStructDef>,
    pub globals: Vec<AslGlobalVar>,
    pub functions: Vec<AslFunction>,
    pub tasks: Vec<AslTask>,
}

impl Default for AslProgram {
    fn default() -> Self {
        Self {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata {
                name: None,
                description: None,
                version: None,
                target_board: None,
            },
            structs: vec![],
            globals: vec![],
            functions: vec![],
            tasks: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslGlobalVar {
    pub name: String,
    pub r#type: AslType,
    pub initial_value: Option<serde_json::Value>,
    pub struct_type: Option<String>,
    pub comments: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslParam {
    pub name: String,
    pub r#type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFunction {
    pub name: String,
    pub params: Vec<AslParam>,
    pub body: Vec<AslStatement>,
    pub return_type: Option<AslType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTask {
    pub name: String,
    pub body: Vec<AslStatement>,
}

// ============================================================================
// Statements
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslStatement {
    // Controlo de pinos
    #[serde(rename = "pinMode")]
    PinMode(AslPinMode),
    #[serde(rename = "digitalWrite")]
    DigitalWrite(AslDigitalWrite),
    #[serde(rename = "analogWrite")]
    AnalogWrite(AslAnalogWrite),
    #[serde(rename = "read")]
    Read(AslRead),

    // Controlo de fluxo
    #[serde(rename = "if")]
    If(Box<AslIf>),
    #[serde(rename = "while")]
    While(Box<AslWhile>),
    #[serde(rename = "for")]
    For(Box<AslFor>),
    #[serde(rename = "forIn")]
    ForIn(Box<AslForIn>),
    #[serde(rename = "doWhile")]
    DoWhile(Box<AslDoWhile>),
    #[serde(rename = "switch")]
    Switch(Box<AslSwitch>),
    #[serde(rename = "break")]
    Break,
    #[serde(rename = "continue")]
    Continue,
    #[serde(rename = "return")]
    Return(AslReturn),

    // Variáveis
    #[serde(rename = "assign")]
    Assign(AslAssign),
    #[serde(rename = "declare")]
    Declare(AslDeclare),
    #[serde(rename = "setIndex")]
    SetIndex(AslSetIndex),
    #[serde(rename = "setIndex2D")]
    SetIndex2D(AslSetIndex2D),
    #[serde(rename = "setIndex3D")]
    SetIndex3D(AslSetIndex3D),
    #[serde(rename = "setMember")]
    SetMember(AslSetMember),
    #[serde(rename = "setPointer")]
    SetPointer(AslSetPointer),

    // I/O
    #[serde(rename = "delay")]
    Delay(AslDelay),
    #[serde(rename = "print")]
    Print(AslPrint),
    #[serde(rename = "serialBegin")]
    SerialBegin(AslSerialBegin),

    // Expressão como statement
    #[serde(rename = "expr")]
    Expr(AslExpressionStmt),

    // Comentário
    #[serde(rename = "comment")]
    Comment(AslComment),

    // Bus
    #[serde(rename = "uartWrite")]
    UartWrite(AslUartWrite),
    #[serde(rename = "uartRead")]
    UartRead(AslUartRead),
    #[serde(rename = "i2cWrite")]
    I2cWrite(AslI2cWrite),
    #[serde(rename = "i2cRead")]
    I2cRead(AslI2cRead),
    #[serde(rename = "spiTransfer")]
    SpiTransfer(AslSpiTransfer),

    // PWM
    #[serde(rename = "pwmInit")]
    PwmInit(AslPwmInit),
    #[serde(rename = "pwmSetDuty")]
    PwmSetDuty(AslPwmSetDuty),
    #[serde(rename = "pwmSetFreq")]
    PwmSetFreq(AslPwmSetFreq),
    #[serde(rename = "pwmStop")]
    PwmStop(AslPwmStop),

    // IEC 61131-3 Timers
    #[serde(rename = "timerTON")]
    TimerTon(AslTimerTon),
    #[serde(rename = "timerTOF")]
    TimerTof(AslTimerTof),
    #[serde(rename = "timerTP")]
    TimerTp(AslTimerTp),

    // IEC Counters
    #[serde(rename = "counterCTU")]
    CounterCtu(AslCounterCtu),
    #[serde(rename = "counterCTD")]
    CounterCtd(AslCounterCtd),

    // IEC Latches
    #[serde(rename = "latchSR")]
    LatchSr(AslLatchSr),
    #[serde(rename = "latchRS")]
    LatchRs(AslLatchRs),

    // IEC Triggers
    #[serde(rename = "trigR")]
    TrigR(AslTrigR),
    #[serde(rename = "trigF")]
    TrigF(AslTrigF),

    // Servo
    #[serde(rename = "servoAttach")]
    ServoAttach(AslServoAttach),
    #[serde(rename = "servoWrite")]
    ServoWrite(AslServoWrite),
    #[serde(rename = "servoDetach")]
    ServoDetach(AslServoDetach),

    // RGB
    #[serde(rename = "rgbSet")]
    RgbSet(AslRgbSet),

    // ── IEC 61131-3 State Machine (SFC) ────────────────────────────────────
    /// Máquina de estados tipada gerada a partir de SFC (Sequential Function Chart).
    /// Preserva steps, actions e transições condicionais com AND/OR estruturados.
    #[serde(rename = "stateMachine")]
    StateMachine(Box<AslStateMachine>),
}

// ============================================================================
// Statement structs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslPinMode {
    pub pin: AslExpr,
    pub mode: PinModeKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PinModeKind { Input, Output, InputPullup }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslDigitalWrite {
    pub pin: AslExpr,
    pub value: DigitalValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DigitalValue {
    High,
    Low,
    Expr(AslExpr),
}

impl DigitalValue {
    pub fn is_high(&self) -> bool { matches!(self, DigitalValue::High) }
    pub fn is_low(&self)  -> bool { matches!(self, DigitalValue::Low)  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAnalogWrite { pub pin: AslExpr, pub value: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslRead {
    pub pin: AslExpr,
    pub target: String,
    pub mode: ReadMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReadMode { Digital, Analog }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIf {
    pub condition: AslExpr,
    pub then_branch: Vec<AslStatement>,
    pub else_branch: Option<Vec<AslStatement>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslWhile {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFor {
    pub init: Option<Vec<AslStatement>>,
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
    pub update: Vec<AslStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslForIn {
    pub var_name: String,
    pub iterable: AslExpr,
    pub body: Vec<AslStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDoWhile {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDelay {
    pub milliseconds: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAssign {
    pub target: String,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDeclare {
    pub name: String,
    pub r#type: AslType,
    pub value: Option<AslExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetIndex {
    pub target: String,
    pub index: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex2D {
    pub target: String,
    pub row_index: AslExpr,
    pub col_index: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex3D {
    pub target: String,
    pub d1_index: AslExpr,
    pub d2_index: AslExpr,
    pub d3_index: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetMember {
    pub target: AslExpr,
    pub property: String,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetPointer {
    pub target: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslExpressionStmt {
    pub expr: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslReturn {
    pub value: Option<AslExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPrint {
    pub args: Vec<AslExpr>,
    pub newline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslComment {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSwitchCase {
    pub test: Option<AslExpr>,
    pub body: Vec<AslStatement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSwitch {
    pub discriminant: AslExpr,
    pub cases: Vec<AslSwitchCase>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSerialBegin { pub baud: AslExpr }

// Bus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUartWrite  { pub port: AslExpr, pub data: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUartRead   { pub port: AslExpr, pub target: String, pub length: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslI2cWrite   { pub bus: AslExpr, pub address: AslExpr, pub data: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslI2cRead    { pub bus: AslExpr, pub address: AslExpr, pub length: AslExpr, pub target: String }
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSpiTransfer { pub bus: AslExpr, pub cs_pin: AslExpr, pub tx_data: AslExpr, pub target: Option<String> }

// PWM
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmInit    { pub pin: AslExpr, pub freq: AslExpr, pub duty: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmSetDuty { pub pin: AslExpr, pub duty: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmSetFreq { pub pin: AslExpr, pub freq: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmStop    { pub pin: AslExpr }

// IEC Timers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTon { pub instance: String, pub r#in: AslExpr, pub pt: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTof { pub instance: String, pub r#in: AslExpr, pub pt: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTimerTp  { pub instance: String, pub r#in: AslExpr, pub pt: AslExpr }

// IEC Counters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCounterCtu { pub instance: String, pub cu: AslExpr, pub r: AslExpr, pub pv: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCounterCtd { pub instance: String, pub cd: AslExpr, pub ld: AslExpr, pub pv: AslExpr }

// IEC Latches
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchSr { pub instance: String, pub s: AslExpr, pub r: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchRs { pub instance: String, pub r: AslExpr, pub s: AslExpr }

// IEC Triggers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTrigR { pub instance: String, pub r#in: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTrigF { pub instance: String, pub r#in: AslExpr }

// Servo
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoAttach {
    pub var_name: String,
    pub pin: AslExpr,
    pub min_pulse: Option<AslExpr>,
    pub max_pulse: Option<AslExpr>,
    pub continuous: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoWrite {
    pub var_name: String,
    pub angle: AslExpr,
    pub raw_microseconds: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoDetach { pub var_name: String }

// RGB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslRgbSet {
    pub pin_r: AslExpr,
    pub pin_g: AslExpr,
    pub pin_b: AslExpr,
    pub r: AslExpr,
    pub g: AslExpr,
    pub b: AslExpr,
}

// ============================================================================
// AslStateMachine — SFC (Sequential Function Chart)
// ============================================================================

/// Máquina de estados tipada gerada a partir de SFC.
/// Preserva a semântica completa: steps, actions (inline ST ou referência),
/// transições condicionais com AslExpr::Binary (AND/OR estruturados),
/// divergências seletivas (prioridade) e simultâneas (paralelas).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslStateMachine {
    /// Nome do POU SFC de origem
    pub name: String,
    /// Nome da variável de estado interno (padrão: "_state")
    pub state_var: String,
    /// Nome do step inicial
    pub initial_step: String,
    /// Lista ordenada de steps
    pub steps: Vec<AslSmStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSmStep {
    /// Nome do step (ex: "Init", "Running", "Fault")
    pub name: String,
    /// Actions executadas enquanto o step está ativo
    pub actions: Vec<AslStatement>,
    /// Transições de saída avaliadas em ordem (first-match)
    pub transitions: Vec<AslSmTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSmTransition {
    /// Condição booleana estruturada — usa AslExpr::Binary para AND/OR compostos.
    /// Nunca uma string crua: garante transpilação correta para qualquer alvo.
    pub condition: AslExpr,
    /// Nome do step destino
    pub target_step: String,
    /// Prioridade para divergências seletivas (0 = maior prioridade)
    pub priority: Option<u32>,
}

// ============================================================================
// Expressões
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslExpr {
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
    #[serde(rename = "serialAvailable")]
    SerialAvailable,
    #[serde(rename = "serialReadString")]
    SerialReadString,
    #[serde(rename = "postfixInc")]
    PostfixInc(String),
    #[serde(rename = "postfixDec")]
    PostfixDec(String),
    #[serde(rename = "cast")]
    Cast { target_type: String, expr: Box<AslExpr> },
}

impl AslExpr {
    pub fn int(v: i64) -> Self { AslExpr::Literal(AslLiteral { value: serde_json::json!(v) }) }
    pub fn float(v: f64) -> Self { AslExpr::Literal(AslLiteral { value: serde_json::json!(v) }) }
    pub fn bool_val(v: bool) -> Self { AslExpr::Literal(AslLiteral { value: serde_json::json!(v) }) }
    pub fn str_val(v: &str) -> Self { AslExpr::Literal(AslLiteral { value: serde_json::json!(v) }) }
    pub fn var(name: &str) -> Self { AslExpr::Var(AslVarRef { name: name.to_string() }) }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLiteral { pub value: serde_json::Value }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslVarRef { pub name: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslArray { pub elements: Vec<AslExpr> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslObjectProp { pub key: AslExpr, pub value: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslObject { pub properties: Vec<AslObjectProp> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslIndex { pub target: AslExpr, pub index: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex2D { pub array: AslExpr, pub row_index: AslExpr, pub col_index: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex3D { pub array: AslExpr, pub d1_index: AslExpr, pub d2_index: AslExpr, pub d3_index: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslMember { pub target: AslExpr, pub property: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUnary {
    pub op: UnaryOp,
    pub expr: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UnaryOp { Neg, Not, BitNot, Pos, Addr, Deref }

impl UnaryOp {
    pub fn from_str(s: &str) -> Self {
        match s {
            "-" => UnaryOp::Neg,
            "!" => UnaryOp::Not,
            "~" => UnaryOp::BitNot,
            "+" => UnaryOp::Pos,
            "&" => UnaryOp::Addr,
            "*" => UnaryOp::Deref,
            _   => UnaryOp::Neg,
        }
    }
    pub fn to_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Neg    => "-",
            UnaryOp::Not    => "!",
            UnaryOp::BitNot => "~",
            UnaryOp::Pos    => "+",
            UnaryOp::Addr   => "&",
            UnaryOp::Deref  => "*",
        }
    }
    /// Símbolo conforme IEC 61131-3 (ST/IL)
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Not    => "NOT ",
            UnaryOp::Neg    => "-",
            UnaryOp::BitNot => "NOT ",
            other => other.to_symbol(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslBinary { pub op: BinaryOp, pub left: AslExpr, pub right: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BinaryOp {
    Add, Sub, Mul, Div, Mod,
    Eq, Neq, Lt, Lte, Gt, Gte,
    And, Or,
    BitAnd, BitOr, BitXor,
    Shl, Shr,
    IntDiv,
}

impl BinaryOp {
    pub fn from_str(s: &str) -> Self {
        match s {
            "+"  => BinaryOp::Add,  "-"  => BinaryOp::Sub,
            "*"  => BinaryOp::Mul,  "/"  => BinaryOp::Div,
            "%"  => BinaryOp::Mod,  "//" => BinaryOp::IntDiv,
            "==" => BinaryOp::Eq,   "!=" => BinaryOp::Neq,
            "<"  => BinaryOp::Lt,   "<=" => BinaryOp::Lte,
            ">"  => BinaryOp::Gt,   ">=" => BinaryOp::Gte,
            "&&" => BinaryOp::And,  "||" => BinaryOp::Or,
            "&"  => BinaryOp::BitAnd, "|" => BinaryOp::BitOr,
            "^"  => BinaryOp::BitXor,
            "<<" => BinaryOp::Shl,  ">>" => BinaryOp::Shr,
            // IEC 61131-3 text operators
            "AND" | "and" => BinaryOp::And,
            "OR"  | "or"  => BinaryOp::Or,
            "XOR" | "xor" => BinaryOp::BitXor,
            _    => BinaryOp::Add,
        }
    }
    pub fn to_symbol(&self) -> &'static str {
        match self {
            BinaryOp::Add    => "+",  BinaryOp::Sub    => "-",
            BinaryOp::Mul    => "*",  BinaryOp::Div    => "/",
            BinaryOp::Mod    => "%",  BinaryOp::IntDiv => "//",
            BinaryOp::Eq     => "==", BinaryOp::Neq    => "!=",
            BinaryOp::Lt     => "<",  BinaryOp::Lte    => "<=",
            BinaryOp::Gt     => ">",  BinaryOp::Gte    => ">=",
            BinaryOp::And    => "&&", BinaryOp::Or     => "||",
            BinaryOp::BitAnd => "&",  BinaryOp::BitOr  => "|",
            BinaryOp::BitXor => "^",
            BinaryOp::Shl    => "<<", BinaryOp::Shr    => ">>",
        }
    }
    /// Símbolo conforme IEC 61131-3 (ST/IL/SFC).
    /// Difere de to_symbol() em: Eq="=", Neq="<>", And="AND", Or="OR", XOR="XOR".
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            BinaryOp::And    => "AND",
            BinaryOp::Or     => "OR",
            BinaryOp::BitAnd => "AND",
            BinaryOp::BitOr  => "OR",
            BinaryOp::BitXor => "XOR",
            BinaryOp::Eq     => "=",
            BinaryOp::Neq    => "<>",
            BinaryOp::Gte    => ">=",
            BinaryOp::Lte    => "<=",
            other            => other.to_symbol(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCall { pub callee: String, pub args: Vec<AslExpr> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslConditional {
    pub condition: AslExpr,
    pub when_true: AslExpr,
    pub when_false: AslExpr,
}

// ============================================================================
// Tipos PLC (IEC 61131-3) — usados no .nfladder
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPlcProgram {
    pub name: String,
    pub variables: Vec<AslPlcVar>,
    pub networks: Vec<AslNetwork>,
    pub functions: Vec<AslFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPlcVar {
    pub name: String,
    pub r#type: AslType,
    pub initial: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslNetwork {
    pub rungs: Vec<AslRung>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslRung {
    pub number: u32,
    pub comment: Option<String>,
    pub elements: Vec<AslLadderElement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslLadderElement {
    Contact(AslContact),
    NegContact(AslContact),
    Coil(AslCoil),
    NegCoil(AslCoil),
    SetCoil(AslCoil),
    ResetCoil(AslCoil),
    TimerTon(AslTimerTon),
    TimerTof(AslTimerTof),
    TimerTp(AslTimerTp),
    CounterCtu(AslCounterCtu),
    CounterCtd(AslCounterCtd),
    LatchSr(AslLatchSr),
    LatchRs(AslLatchRs),
    FunctionBlock(AslFbCall),
    BranchStart,
    BranchEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslContact { pub variable: String, pub comment: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCoil    { pub variable: String, pub comment: Option<String> }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFbCall  { pub name: String, pub inputs: HashMap<String, AslExpr> }
