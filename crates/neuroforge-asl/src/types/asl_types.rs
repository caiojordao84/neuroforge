//! ASL v4 — Tipos unificados do motor ASL do NeuroForge.
//!
//! **Fonte normativa:** ASL Semantic Dictionary v1.2.3
//!
//! Regras fundamentais (§1 do Dicionário):
//!   R1 — Nomes semânticos, nunca nomes de API.  (digitalOutput, não digitalWrite)
//!   R2 — camelCase para termos compostos.
//!   R3 — `kind` é o discriminante de todos os nós.
//!   R4 — Valores numéricos, nunca constantes nomeadas. (HIGH→1, LOW→0)
//!   R5 — Operadores como símbolos directos. ("+", ">=", "&&")
//!   R6 — includes explícitos no root.
//!   R7 — Todo o programa tem setup e loop em tasks.
//!   R8 — Comentários preservados como statements inline.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// §3 — Sistema de Tipos (AslType)
// ============================================================================

/// Tipos escalares, compostos e especiais conforme §3 do Dicionário ASL v1.2.3.
/// Serializa em lowercase (ex: "int32", "float", "bool", "array").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum AslType {
    // §3.1 — Inteiros explícitos
    Sint8,
    Int16,
    Int32,
    Int64,
    Uint8,
    Uint16,
    Uint32,
    Uint64,

    // §3.2 — Aliases genéricos
    #[default]
    Int,    // alias → int32
    Uint,   // alias → uint32
    Short,  // alias → int16
    Long,   // alias → int64
    Byte,   // alias → uint8

    // §3.3 — Float, lógica, char, string, void
    Float,
    Double,
    Bool,
    Char,
    String,
    Void,
    Auto,

    // §3.4 — Compostos e especiais
    Array,
    Struct,
    Enum,
    Option,

    // §3.5 — Tipos IEC de tempo/data (novo em v1.2)
    Time,
    Date,
    #[serde(rename = "timeOfDay")]
    TimeOfDay,
    #[serde(rename = "dateTime")]
    DateTime,
}

impl AslType {
    /// Devolve o nome canónico conforme o Dicionário (used em serialização de campos `type`).
    pub fn as_str(&self) -> &'static str {
        match self {
            AslType::Sint8    => "sint8",   AslType::Int16    => "int16",
            AslType::Int32    => "int32",   AslType::Int64    => "int64",
            AslType::Uint8    => "uint8",   AslType::Uint16   => "uint16",
            AslType::Uint32   => "uint32",  AslType::Uint64   => "uint64",
            AslType::Int      => "int",     AslType::Uint     => "uint",
            AslType::Short    => "short",   AslType::Long     => "long",
            AslType::Byte     => "byte",    AslType::Float    => "float",
            AslType::Double   => "double",  AslType::Bool     => "bool",
            AslType::Char     => "char",    AslType::String   => "string",
            AslType::Void     => "void",    AslType::Auto     => "auto",
            AslType::Array    => "array",   AslType::Struct   => "struct",
            AslType::Enum     => "enum",    AslType::Option   => "option",
            AslType::Time     => "time",    AslType::Date     => "date",
            AslType::TimeOfDay => "timeOfDay", AslType::DateTime => "dateTime",
        }
    }

    /// Parseia a partir de uma string canónica do Dicionário.
    pub fn from_str(s: &str) -> Self {
        match s {
            "sint8"     => AslType::Sint8,   "int16"     => AslType::Int16,
            "int32"     => AslType::Int32,   "int64"     => AslType::Int64,
            "uint8"     => AslType::Uint8,   "uint16"    => AslType::Uint16,
            "uint32"    => AslType::Uint32,  "uint64"    => AslType::Uint64,
            "int"       => AslType::Int,     "uint"      => AslType::Uint,
            "short"     => AslType::Short,   "long"      => AslType::Long,
            "byte"      => AslType::Byte,    "float"     => AslType::Float,
            "double"    => AslType::Double,  "bool"      => AslType::Bool,
            "char"      => AslType::Char,    "string"    => AslType::String,
            "void"      => AslType::Void,    "auto"      => AslType::Auto,
            "array"     => AslType::Array,   "struct"    => AslType::Struct,
            "enum"      => AslType::Enum,    "option"    => AslType::Option,
            "time"      => AslType::Time,    "date"      => AslType::Date,
            "timeOfDay" => AslType::TimeOfDay, "dateTime"=> AslType::DateTime,
            // Aliases maiúsculos IEC 61131-3
            "BOOL"  => AslType::Bool,  "INT"   => AslType::Int16,
            "DINT"  => AslType::Int32, "LINT"  => AslType::Int64,
            "SINT"  => AslType::Sint8, "UINT"  => AslType::Uint16,
            "UDINT" => AslType::Uint32,"ULINT" => AslType::Uint64,
            "REAL"  => AslType::Float, "LREAL" => AslType::Double,
            "TIME"  => AslType::Time,  "DATE"  => AslType::Date,
            "STRING"=> AslType::String,"BYTE"  => AslType::Byte,
            _       => AslType::Auto,
        }
    }
}

// ============================================================================
// §12 — Structs
// ============================================================================

/// Campo de um struct. O campo `default` é opcional (§12.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStructField {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<AslExpr>,
}

/// Definição de struct (§12). O campo `doc` é opcional (R8).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStructDef {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub fields: Vec<AslStructField>,
}

// ============================================================================
// §4 — Enums
// ============================================================================

/// Variante de enumeração (§4.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslEnumVariant {
    pub name: String,
    pub value: i64,
}

/// Definição de enumeração (§4). Serializa com `kind: "enum"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslEnum {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub variants: Vec<AslEnumVariant>,
}

// ============================================================================
// §5 — Function Blocks (novo em v1.2)
// ============================================================================

/// Campo de entrada/saída/interna de um Function Block (§5.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslFbField {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mutable: Option<bool>,
}

/// Definição de Function Block — stateful, com inputs/outputs/internals/body (§5).
/// Entradas no array `functionBlocks` do root — não levam `kind` (§5.1 nota).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslFunctionBlock {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub inputs: Vec<AslFbField>,
    pub outputs: Vec<AslFbField>,
    pub internals: Vec<AslFbField>,
    pub body: Vec<AslStatement>,
}

// ============================================================================
// §2 — Programa ASL (root)
// ============================================================================

/// Metadata do programa (§2.1). `targetBoard` serializa em camelCase.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub target_board: Option<String>,
}

/// Root do programa ASL (§2). Contém todos os campos normativos do Dicionário v1.2.3.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslProgram {
    /// Versão do schema ASL (ex: "4.0.0")
    pub asl_version: String,
    pub metadata: AslMetadata,
    /// §2.2 — Dependências explícitas de biblioteca (ex: "wire", "servo", "mqtt")
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub includes: Vec<String>,
    /// §12 — Definições de struct
    pub structs: Vec<AslStructDef>,
    /// §4 — Definições de enum (novo em v1.2)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub enums: Vec<AslEnum>,
    /// Variáveis globais
    pub globals: Vec<AslGlobalVar>,
    /// §11 — Funções puras (stateless)
    pub functions: Vec<AslFunction>,
    /// §5 — Function Blocks stateful (novo em v1.2)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub function_blocks: Vec<AslFunctionBlock>,
    /// §2.3 — Tasks (setup + loop + async tasks)
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
            includes: vec![],
            structs: vec![],
            enums: vec![],
            globals: vec![],
            functions: vec![],
            function_blocks: vec![],
            tasks: vec![],
        }
    }
}

/// Variável global — segue semântica de `declare` (§9.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslGlobalVar {
    pub name: String,
    pub r#type: AslType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<AslExpr>,
    /// Tipo concreto quando `type` é "struct" ou "enum"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub struct_type: Option<String>,
    pub mutable: bool,
    /// "local" | "global" | "const"
    pub scope: String,
    /// "normal" | "retain" | "persistent" (§9.2)
    #[serde(default = "default_lifecycle")]
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<String>>,
}

fn default_lifecycle() -> String { "normal".to_string() }

/// Parâmetro de função (§11.1). O campo `default` é opcional.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslParam {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<AslExpr>,
}

/// Função pura — stateless (§11). Não confundir com FunctionBlock (§5).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslFunction {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub params: Vec<AslParam>,
    pub body: Vec<AslStatement>,
    pub return_type: Option<AslType>,
}

/// Task de execução (§2.3). `setup` e `loop` são obrigatórias (R7).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTask {
    pub name: String,
    /// true para tarefas async (§25)
    #[serde(default)]
    pub is_async: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack_size: Option<u32>,
    pub params: Vec<AslParam>,
    /// "void" por defeito
    #[serde(default = "default_void")]
    pub return_type: String,
    pub body: Vec<AslStatement>,
}

fn default_void() -> String { "void".to_string() }

// ============================================================================
// §6–§27 — Statements
// ============================================================================

/// Todos os statements ASL. O campo `kind` é o discriminante (R3).
///
/// Regra R1 aplicada:
///   - `digitalOutput` (não `digitalWrite`)
///   - `analogOutput`  (não `analogWrite`)
///   - `digitalInput`  (não `read` com mode=Digital)
///   - `analogInput`   (não `read` com mode=Analog)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslStatement {
    // ── §6 — Pinos ─────────────────────────────────────────────────────────
    #[serde(rename = "pinMode")]
    PinMode(AslPinMode),
    /// §6.3 — digitalOutput
    #[serde(rename = "digitalOutput")]
    DigitalOutput(AslDigitalOutput),
    /// §6.5 — analogOutput
    #[serde(rename = "analogOutput")]
    AnalogOutput(AslAnalogOutput),
    /// §6.4 — digitalInput
    #[serde(rename = "digitalInput")]
    DigitalInput(AslDigitalInput),
    /// §6.6 — analogInput
    #[serde(rename = "analogInput")]
    AnalogInput(AslAnalogInput),

    // ── §8 — Controlo de Fluxo ─────────────────────────────────────────────
    #[serde(rename = "if")]
    If(Box<AslIf>),
    #[serde(rename = "while")]
    While(Box<AslWhile>),
    /// §8.4–8.6 — for com pattern: "range" | "each" | "cStyle"
    #[serde(rename = "for")]
    For(Box<AslFor>),
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
    /// §8.9 — tryCatch
    #[serde(rename = "tryCatch")]
    TryCatch(Box<AslTryCatch>),

    // ── §9 — Variáveis ──────────────────────────────────────────────────────
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

    // ── §7 — Temporização ───────────────────────────────────────────────────
    /// delay aceita apenas AslDuration (§7.2 — raw ms não permitido)
    #[serde(rename = "delay")]
    Delay(AslDelay),

    // ── §13 — Print / Serial ────────────────────────────────────────────────
    #[serde(rename = "print")]
    Print(AslPrint),
    #[serde(rename = "serialBegin")]
    SerialBegin(AslSerialBegin),
    #[serde(rename = "serialWrite")]
    SerialWrite(AslSerialWrite),
    #[serde(rename = "serialReadString")]
    SerialReadString(AslSerialReadString),
    #[serde(rename = "serialReadByte")]
    SerialReadByte(AslSerialReadByte),

    // ── Expressão como statement ─────────────────────────────────────────────
    #[serde(rename = "expr")]
    Expr(AslExpressionStmt),

    // ── R8 — Comentário ──────────────────────────────────────────────────────
    #[serde(rename = "comment")]
    Comment(AslComment),

    // ── §22 — Bus (UART / I2C / SPI) ────────────────────────────────────────
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

    // ── §22.4 — Modbus (novo em v1.2) ───────────────────────────────────────
    #[serde(rename = "modbusReadHoldingRegisters")]
    ModbusReadHoldingRegisters(AslModbusReadHoldingRegisters),
    #[serde(rename = "modbusReadInputRegisters")]
    ModbusReadInputRegisters(AslModbusReadInputRegisters),
    #[serde(rename = "modbusWriteSingleRegister")]
    ModbusWriteSingleRegister(AslModbusWriteSingleRegister),
    #[serde(rename = "modbusWriteMultipleRegisters")]
    ModbusWriteMultipleRegisters(AslModbusWriteMultipleRegisters),
    #[serde(rename = "modbusReadCoils")]
    ModbusReadCoils(AslModbusReadCoils),
    #[serde(rename = "modbusWriteSingleCoil")]
    ModbusWriteSingleCoil(AslModbusWriteSingleCoil),

    // ── PWM ─────────────────────────────────────────────────────────────────
    #[serde(rename = "pwmInit")]
    PwmInit(AslPwmInit),
    #[serde(rename = "pwmSetDuty")]
    PwmSetDuty(AslPwmSetDuty),
    #[serde(rename = "pwmSetFreq")]
    PwmSetFreq(AslPwmSetFreq),
    #[serde(rename = "pwmStop")]
    PwmStop(AslPwmStop),

    // ── IEC 61131-3 Timers ───────────────────────────────────────────────────
    #[serde(rename = "timerTON")]
    TimerTon(AslTimerTon),
    #[serde(rename = "timerTOF")]
    TimerTof(AslTimerTof),
    #[serde(rename = "timerTP")]
    TimerTp(AslTimerTp),

    // ── IEC Counters ─────────────────────────────────────────────────────────
    #[serde(rename = "counterCTU")]
    CounterCtu(AslCounterCtu),
    #[serde(rename = "counterCTD")]
    CounterCtd(AslCounterCtd),

    // ── IEC Latches ──────────────────────────────────────────────────────────
    #[serde(rename = "latchSR")]
    LatchSr(AslLatchSr),
    #[serde(rename = "latchRS")]
    LatchRs(AslLatchRs),

    // ── IEC Triggers ─────────────────────────────────────────────────────────
    #[serde(rename = "trigR")]
    TrigR(AslTrigR),
    #[serde(rename = "trigF")]
    TrigF(AslTrigF),

    // ── §23 — Servo ──────────────────────────────────────────────────────────
    #[serde(rename = "servoAttach")]
    ServoAttach(AslServoAttach),
    #[serde(rename = "servoWrite")]
    ServoWrite(AslServoWrite),
    #[serde(rename = "servoDetach")]
    ServoDetach(AslServoDetach),

    // ── §24 — RGB / NeoPixel ─────────────────────────────────────────────────
    #[serde(rename = "rgbSet")]
    RgbSet(AslRgbSet),

    // ── §26 — Interrupts ─────────────────────────────────────────────────────
    #[serde(rename = "attachInterrupt")]
    AttachInterrupt(AslAttachInterrupt),
    #[serde(rename = "timerInterrupt")]
    TimerInterrupt(AslTimerInterrupt),

    // ── §27 — Concorrência e Sincronização (novo em v1.2) ────────────────────
    #[serde(rename = "mutexLock")]
    MutexLock(AslMutexOp),
    #[serde(rename = "mutexUnlock")]
    MutexUnlock(AslMutexOp),
    #[serde(rename = "queueSend")]
    QueueSend(AslQueueSend),
    #[serde(rename = "queueReceive")]
    QueueReceive(AslQueueReceive),
    #[serde(rename = "semaphoreGive")]
    SemaphoreGive(AslSemaphoreOp),
    #[serde(rename = "semaphoreTake")]
    SemaphoreTake(AslSemaphoreOp),
    #[serde(rename = "eventGroupSetBits")]
    EventGroupSetBits(AslEventGroupOp),
    #[serde(rename = "eventGroupWaitBits")]
    EventGroupWaitBits(AslEventGroupWaitBits),

    // ── §28 — Sensores Industriais ───────────────────────────────────────────
    #[serde(rename = "sensorRead")]
    SensorRead(AslSensorRead),

    // ── §29 — Energy Management (novo em v1.2) ───────────────────────────────
    #[serde(rename = "sleepMode")]
    SleepMode(AslSleepMode),
    #[serde(rename = "watchdogTimer")]
    WatchdogTimer(AslWatchdogTimer),

    // ── §30 — Persistent Storage (novo em v1.2) ──────────────────────────────
    #[serde(rename = "storageWrite")]
    StorageWrite(AslStorageWrite),
    #[serde(rename = "storageRead")]
    StorageRead(AslStorageRead),
    #[serde(rename = "storageCommit")]
    StorageCommit,

    // ── §31 — Network Communication (novo em v1.2) ──────────────────────────
    #[serde(rename = "wifiConnect")]
    WifiConnect(AslWifiConnect),
    #[serde(rename = "wifiDisconnect")]
    WifiDisconnect,
    #[serde(rename = "wifiStatus")]
    WifiStatus(AslWifiStatus),
    #[serde(rename = "mqttConnect")]
    MqttConnect(AslMqttConnect),
    #[serde(rename = "mqttSubscribe")]
    MqttSubscribe(AslMqttSubscribe),
    #[serde(rename = "mqttPublish")]
    MqttPublish(AslMqttPublish),
    #[serde(rename = "mqttDisconnect")]
    MqttDisconnect,
    #[serde(rename = "httpGet")]
    HttpGet(AslHttpGet),
    #[serde(rename = "httpPost")]
    HttpPost(AslHttpPost),

    // ── §32 — Displays (novo em v1.2) ────────────────────────────────────────
    #[serde(rename = "lcdInit")]
    LcdInit(AslLcdInit),
    #[serde(rename = "lcdPrint")]
    LcdPrint(AslLcdPrint),
    #[serde(rename = "lcdClear")]
    LcdClear,
    #[serde(rename = "lcdSetCursor")]
    LcdSetCursor(AslLcdSetCursor),
    #[serde(rename = "oledInit")]
    OledInit(AslOledInit),
    #[serde(rename = "oledDrawText")]
    OledDrawText(AslOledDrawText),
    #[serde(rename = "oledDisplay")]
    OledDisplay,
    #[serde(rename = "oledClear")]
    OledClear,

    // ── §34 — Logging (novo em v1.2) ─────────────────────────────────────────
    #[serde(rename = "log")]
    Log(AslLog),

    // ── §35 — Testing and Simulation (novo em v1.2) ─────────────────────────
    #[serde(rename = "assert")]
    Assert(AslAssert),
    #[serde(rename = "simProbe")]
    SimProbe(AslSimProbe),

    // ── SFC — State Machine ──────────────────────────────────────────────────
    #[serde(rename = "stateMachine")]
    StateMachine(Box<AslStateMachine>),
}

// ============================================================================
// Statement structs — §6 Pinos
// ============================================================================

/// §6.1 — Configuração de modo de pino.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPinMode {
    pub pin: AslExpr,
    pub mode: PinModeKind,
}

/// Modos válidos conforme §6.2 do Dicionário.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PinModeKind {
    Input,
    Output,
    #[serde(rename = "INPUT_PULLUP")]
    InputPullup,
    #[serde(rename = "INPUT_PULLDOWN")]
    InputPulldown,
    Analog,
    #[serde(rename = "OPEN_DRAIN")]
    OpenDrain,
}

/// §6.3 — digitalOutput.
/// R4: value é AslExpr — HIGH/LOW devem ser normalizados para literal 1/0 pelo parser.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDigitalOutput {
    pub pin: AslExpr,
    pub value: AslExpr,
}

/// §6.5 — analogOutput.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAnalogOutput {
    pub pin: AslExpr,
    pub value: AslExpr,
}

/// §6.4 — digitalInput.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDigitalInput {
    pub pin: AslExpr,
    pub target: String,
}

/// §6.6 — analogInput.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAnalogInput {
    pub pin: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs — §7 Temporização
// ============================================================================

/// Duração estruturada conforme §7.1 do Dicionário.
/// O delay só aceita AslDuration — valores raw em ms não são permitidos (§7.2).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDuration {
    pub days: u32,
    pub hours: u32,
    pub minutes: u32,
    pub seconds: u32,
    pub milliseconds: u32,
    pub microseconds: u32,
}

impl AslDuration {
    pub fn from_ms(ms: u64) -> Self {
        let total_us = ms * 1000;
        AslDuration {
            days: 0, hours: 0, minutes: 0,
            seconds: (ms / 1000) as u32,
            milliseconds: (ms % 1000) as u32,
            microseconds: (total_us % 1000) as u32,
        }
    }
    pub fn total_ms(&self) -> u64 {
        (self.days as u64 * 86_400_000)
            + (self.hours as u64 * 3_600_000)
            + (self.minutes as u64 * 60_000)
            + (self.seconds as u64 * 1_000)
            + self.milliseconds as u64
    }
    pub fn total_us(&self) -> u64 {
        self.total_ms() * 1000 + self.microseconds as u64
    }
}

/// §7.2 — delay com duração estruturada (nunca ms raw).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDelay {
    pub duration: AslDuration,
}

// ============================================================================
// Statement structs — §8 Controlo de Fluxo
// ============================================================================

/// §8.1 — if/elseIf/else.
/// `else_if` é sempre array (vazio se ausente). `else_body` é null se ausente.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIf {
    pub condition: AslExpr,
    pub then_body: Vec<AslStatement>,
    #[serde(default)]
    pub else_if: Vec<AslElseIf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub else_body: Option<Vec<AslStatement>>,
}

/// Uma cláusula elseIf (§8.1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslElseIf {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

/// §8.2 — while.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslWhile {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

/// §8.3 — doWhile.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslDoWhile {
    pub body: Vec<AslStatement>,
    pub condition: AslExpr,
}

/// §8.4–8.6 — for unificado com discriminante `pattern`.
///
/// - "range": var, from, to (exclusivo), step (§8.4)
/// - "each":  var, iterable (§8.5)
/// - "cStyle": init, condition, update (§8.6)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "pattern", rename_all = "camelCase")]
pub enum AslFor {
    #[serde(rename = "range")]
    Range(AslForRange),
    #[serde(rename = "each")]
    Each(AslForEach),
    #[serde(rename = "cStyle")]
    CStyle(AslForCStyle),
}

/// §8.4 — for range. `to` é sempre exclusivo (convenção ASL).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslForRange {
    pub var: String,
    pub from: AslExpr,
    /// Sempre exclusivo (i < to). ST parser normaliza: TO 9 → to: 10.
    pub to: AslExpr,
    pub step: AslExpr,
    pub body: Vec<AslStatement>,
}

/// §8.5 — for each.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslForEach {
    pub var: String,
    pub iterable: AslExpr,
    pub body: Vec<AslStatement>,
}

/// §8.6 — for cStyle (apenas quando não mapeia para range/each).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslForCStyle {
    pub init: Vec<AslStatement>,
    pub condition: AslExpr,
    pub update: Vec<AslStatement>,
    pub body: Vec<AslStatement>,
}

/// §8.7 — switch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSwitch {
    pub discriminant: AslExpr,
    pub cases: Vec<AslSwitchCase>,
}

/// Caso de switch. `test: null` = default.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSwitchCase {
    pub test: Option<AslExpr>,
    pub body: Vec<AslStatement>,
}

/// §8.8 — return.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslReturn {
    pub value: Option<AslExpr>,
}

/// §8.9 — tryCatch.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTryCatch {
    pub try_body: Vec<AslStatement>,
    pub catch_param: String,
    pub catch_type: String,
    pub catch_body: Vec<AslStatement>,
}

// ============================================================================
// Statement structs — §9 Variáveis
// ============================================================================

/// §9.3 — assign. Compound operators (+=, i++) são expandidos para assign+binary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAssign {
    pub target: String,
    pub value: AslExpr,
}

/// §9.1 — declare. Versão completa com mutable/scope/lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslDeclare {
    pub name: String,
    pub r#type: AslType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<AslExpr>,
    /// Tipo concreto para array/struct/enum
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtype: Option<String>,
    /// Tamanho para arrays (§10.1)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<AslExpr>,
    /// false = const, true = mutable
    pub mutable: bool,
    /// "local" | "global" | "const"
    pub scope: String,
    /// "normal" | "retain" | "persistent" (§9.2)
    #[serde(default = "default_lifecycle")]
    pub lifecycle: String,
}

/// §9.4 — setIndex.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetIndex {
    pub target: String,
    pub index: AslExpr,
    pub value: AslExpr,
}

/// §9.4 — setIndex2D.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex2D {
    pub target: String,
    pub row_index: AslExpr,
    pub col_index: AslExpr,
    pub value: AslExpr,
}

/// setIndex3D (extensão consistente com setIndex2D).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex3D {
    pub target: String,
    pub d1_index: AslExpr,
    pub d2_index: AslExpr,
    pub d3_index: AslExpr,
    pub value: AslExpr,
}

/// §9.5 — setMember.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetMember {
    pub target: AslExpr,
    pub property: String,
    pub value: AslExpr,
}

/// setPointer (Rust/C — dereference assignment).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSetPointer {
    pub target: AslExpr,
    pub value: AslExpr,
}

/// expr como statement (§11.2 — call como statement).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslExpressionStmt {
    pub expr: AslExpr,
}

// ============================================================================
// Statement structs — §13 Print / Serial
// ============================================================================

/// §13.1 — print.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPrint {
    pub args: Vec<AslExpr>,
    pub newline: bool,
}

/// §13.2 — serialBegin. `port: 0` por defeito.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSerialBegin {
    pub baud: AslExpr,
    #[serde(default)]
    pub port: u8,
}

/// §13.2 — serialWrite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSerialWrite {
    pub data: AslExpr,
}

/// §13.2 — serialReadString (como statement — guarda em target).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSerialReadString {
    pub target: String,
}

/// §13.2 — serialReadByte (como statement — guarda em target).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSerialReadByte {
    pub target: String,
}

/// Comentário inline (R8).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslComment {
    pub text: String,
}

// ============================================================================
// Statement structs — §22 Bus
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUartWrite  { pub port: AslExpr, pub data: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUartRead   { pub port: AslExpr, pub length: AslExpr, pub target: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslI2cWrite   { pub bus: AslExpr, pub address: AslExpr, pub data: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslI2cRead    { pub bus: AslExpr, pub address: AslExpr, pub length: AslExpr, pub target: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSpiTransfer { pub bus: AslExpr, pub cs_pin: AslExpr, pub tx_data: AslExpr, pub target: Option<String> }

// ============================================================================
// Statement structs — §22.4 Modbus (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadHoldingRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadInputRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteSingleRegister {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteMultipleRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadCoils {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteSingleCoil {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub value: AslExpr,
}

// ============================================================================
// Statement structs — PWM
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmInit    { pub pin: AslExpr, pub freq: AslExpr, pub duty: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmSetDuty { pub pin: AslExpr, pub duty: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmSetFreq { pub pin: AslExpr, pub freq: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslPwmStop    { pub pin: AslExpr }

// ============================================================================
// Statement structs — IEC Timers / Counters / Latches / Triggers
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTon {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_et: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTof {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_et: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTp {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_et: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslCounterCtu {
    pub instance: String,
    pub cu: AslExpr,
    pub r: AslExpr,
    pub pv: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_cv: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslCounterCtd {
    pub instance: String,
    pub cd: AslExpr,
    pub ld: AslExpr,
    pub pv: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_cv: Option<String>,
}

/// §19.3 — CTUD Count Up/Down (novo em v1.2)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslCounterCtud {
    pub instance: String,
    pub cu: AslExpr,
    pub cd: AslExpr,
    pub r: AslExpr,
    pub ld: AslExpr,
    pub pv: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub out_cv: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchSr { pub instance: String, pub s: AslExpr, pub r: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLatchRs { pub instance: String, pub r: AslExpr, pub s: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTrigR { pub instance: String, pub r#in: AslExpr }
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTrigF { pub instance: String, pub r#in: AslExpr }

// ============================================================================
// Statement structs — §23 Servo
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoAttach {
    pub var_name: String,
    pub pin: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_pulse: Option<AslExpr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_pulse: Option<AslExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoWrite {
    pub var_name: String,
    pub angle: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslServoDetach { pub var_name: String }

// ============================================================================
// Statement structs — §24 RGB
// ============================================================================

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
// Statement structs — §26 Interrupts
// ============================================================================

/// Trigger válidos: "RISING" | "FALLING" | "CHANGE" | "LOW" | "HIGH"
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAttachInterrupt {
    pub pin: AslExpr,
    pub handler: String,
    pub trigger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerInterrupt {
    pub period_ms: AslExpr,
    pub handler: String,
}

// ============================================================================
// Statement structs — §27 Concorrência (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslMutexOp      { pub mutex_name: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslQueueSend    { pub queue_name: String, pub value: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslQueueReceive { pub queue_name: String, pub target: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSemaphoreOp  { pub semaphore_name: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslEventGroupOp { pub group: String, pub bits: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslEventGroupWaitBits { pub group: String, pub bits: AslExpr, pub target: String }

// ============================================================================
// Statement structs — §28 Sensores Industriais
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSensorFaultDetect {
    pub threshold: f64,
    pub mode: String, // "outOfRange" | "stuck" | ...
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSensorRead {
    pub name: String,
    pub pin: AslExpr,
    pub signal_type: String, // "analog" | "digital" | "i2c" | "spi"
    pub range_min: f64,
    pub range_max: f64,
    pub unit_min: f64,
    pub unit_max: f64,
    pub unit: String,
    pub interpolation: String, // "linear" | "none"
    pub target: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fault_detect: Option<AslSensorFaultDetect>,
}

// ============================================================================
// Statement structs — §29 Energy Management (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSleepMode {
    pub mode: String, // "IDLE" | "LIGHT_SLEEP" | "DEEP_SLEEP"
    pub duration: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslWatchdogTimer {
    pub timeout: AslExpr,
    pub enable: bool,
}

// ============================================================================
// Statement structs — §30 Persistent Storage (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStorageWrite {
    pub address: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslStorageRead {
    pub address: AslExpr,
    pub length: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs — §31 Network Communication (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslWifiConnect {
    pub ssid: AslExpr,
    pub password: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslWifiStatus {
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslMqttConnect {
    pub broker: AslExpr,
    pub port: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslMqttPublish {
    pub topic: AslExpr,
    pub payload: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslMqttSubscribe {
    pub topic: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslHttpGet {
    pub url: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslHttpPost {
    pub url: AslExpr,
    pub body: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs — §32 Displays (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLcdInit {
    pub address: AslExpr,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLcdPrint {
    pub col: u32,
    pub row: u32,
    pub text: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslLcdSetCursor {
    pub col: u32,
    pub row: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslOledInit {
    pub width: u32,
    pub height: u32,
    pub address: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslOledDrawText {
    pub x: u32,
    pub y: u32,
    pub text: AslExpr,
}

// ============================================================================
// Statement structs — §34 Logging (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLog {
    pub level: String, // "DEBUG" | "INFO" | "WARN" | "ERROR"
    pub module: String,
    pub message: AslExpr,
}

// ============================================================================
// Statement structs — §35 Testing and Simulation (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslAssert {
    pub condition: AslExpr,
    pub message: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslSimProbe {
    pub name: String,
    pub value: AslExpr,
}

// ============================================================================
// SFC — State Machine
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslStateMachine {
    pub name: String,
    pub state_var: String,
    pub initial_step: String,
    pub steps: Vec<AslSmStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSmStep {
    pub name: String,
    pub actions: Vec<AslStatement>,
    pub transitions: Vec<AslSmTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslSmTransition {
    pub condition: AslExpr,
    pub target_step: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
}

// ============================================================================
// §14 — Expressões
// ============================================================================

/// Expressões ASL. O campo `kind` é o discriminante (R3).
///
/// R5: operadores são sempre símbolos directos em AslBinary/AslUnary.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AslExpr {
    /// §14.1 — literal
    #[serde(rename = "literal")]
    Literal(AslLiteral),
    /// §14.2 — var
    #[serde(rename = "var")]
    Var(AslVarRef),
    /// §10.1 — array (literal de array)
    #[serde(rename = "array")]
    Array(Box<AslArray>),
    /// object literal
    #[serde(rename = "object")]
    Object(Box<AslObject>),
    /// §10.2 — index
    #[serde(rename = "index")]
    Index(Box<AslIndex>),
    /// index2D
    #[serde(rename = "index2D")]
    Index2D(Box<AslIndex2D>),
    /// index3D
    #[serde(rename = "index3D")]
    Index3D(Box<AslIndex3D>),
    /// §14.7 — member
    #[serde(rename = "member")]
    Member(Box<AslMember>),
    /// §14.4 — unary
    #[serde(rename = "unary")]
    Unary(Box<AslUnary>),
    /// §14.3 — binary
    #[serde(rename = "binary")]
    Binary(Box<AslBinary>),
    /// §11.2 — call
    #[serde(rename = "call")]
    Call(Box<AslCall>),
    /// §14.5 — conditional (ternário)
    #[serde(rename = "conditional")]
    Conditional(Box<AslConditional>),
    /// §14.6 — cast
    #[serde(rename = "cast")]
    Cast(Box<AslCast>),
    /// §12.2 — newStruct
    #[serde(rename = "newStruct")]
    NewStruct(Box<AslNewStruct>),
    /// §10.3 — arrayLength
    #[serde(rename = "arrayLength")]
    ArrayLength(Box<AslArrayLength>),
    /// §7.3 — millis (expressão)
    #[serde(rename = "millis")]
    Millis,
    /// §7.3 — micros (expressão)
    #[serde(rename = "micros")]
    Micros,
    /// §7.1 — duration como expressão (para timers IEC)
    #[serde(rename = "duration")]
    Duration(AslDuration),
    /// §13.2 — serialAvailable como expressão
    #[serde(rename = "serialAvailable")]
    SerialAvailable,
    /// §13.2 — serialReadString como expressão
    #[serde(rename = "serialReadString")]
    SerialReadString,
    /// §13.2 — serialReadByte como expressão
    #[serde(rename = "serialReadByte")]
    SerialReadByte,
}

impl AslExpr {
    /// Literal inteiro (R4 — nunca usar HIGH/LOW, usar int(1)/int(0))
    pub fn int(v: i64) -> Self {
        AslExpr::Literal(AslLiteral { value: serde_json::json!(v) })
    }
    pub fn float(v: f64) -> Self {
        AslExpr::Literal(AslLiteral { value: serde_json::json!(v) })
    }
    /// R4 — bool normalizado para 1/0 conforme o Dicionário
    pub fn bool_val(v: bool) -> Self {
        AslExpr::Literal(AslLiteral { value: serde_json::json!(if v { 1 } else { 0 }) })
    }
    pub fn str_val(v: &str) -> Self {
        AslExpr::Literal(AslLiteral { value: serde_json::json!(v) })
    }
    pub fn null() -> Self {
        AslExpr::Literal(AslLiteral { value: serde_json::Value::Null })
    }
    pub fn var(name: &str) -> Self {
        AslExpr::Var(AslVarRef { name: name.to_string() })
    }
}

// ============================================================================
// Structs de expressão
// ============================================================================

/// §14.1 — literal. value é JSON Value (int, float, bool, string, null).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslLiteral { pub value: serde_json::Value }

/// §14.2 — var.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslVarRef { pub name: String }

/// §10.1 — array literal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslArray { pub elements: Vec<AslExpr> }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslObjectProp { pub key: AslExpr, pub value: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslObject { pub properties: Vec<AslObjectProp> }

/// §10.2 — index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslIndex { pub target: AslExpr, pub index: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex2D { pub array: AslExpr, pub row_index: AslExpr, pub col_index: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslIndex3D { pub array: AslExpr, pub d1_index: AslExpr, pub d2_index: AslExpr, pub d3_index: AslExpr }

/// §14.7 — member.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslMember { pub target: AslExpr, pub property: String }

/// §14.4 — unary. `op` é símbolo directo (R5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslUnary {
    pub op: UnaryOp,
    pub expr: AslExpr,
}

/// §14.3 — binary. `op` é símbolo directo (R5).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslBinary { pub op: BinaryOp, pub left: AslExpr, pub right: AslExpr }

/// §11.2 — call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslCall { pub callee: String, pub args: Vec<AslExpr> }

/// §14.5 — conditional (ternário).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslConditional {
    pub condition: AslExpr,
    pub when_true: AslExpr,
    pub when_false: AslExpr,
}

/// §14.6 — cast.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslCast {
    pub target_type: String,
    pub expr: AslExpr,
}

/// §12.2 — newStruct.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslNewStructField { pub name: String, pub value: AslExpr }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslNewStruct {
    pub r#struct: String,
    pub fields: Vec<AslNewStructField>,
}

/// §10.3 — arrayLength.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslArrayLength { pub target: AslExpr }

// ============================================================================
// §14.3/14.4 — Operadores (R5: símbolo directo, nunca "add"/"gte")
// ============================================================================

/// Operador unário. Serializa como símbolo directo (R5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum UnaryOp {
    #[serde(rename = "-")]  Neg,
    #[serde(rename = "!")]  Not,
    #[serde(rename = "~")]  BitNot,
    #[serde(rename = "+")]  Pos,
    #[serde(rename = "&")]  Addr,
    #[serde(rename = "*")]  Deref,
}

impl UnaryOp {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "-" => UnaryOp::Neg,  "!" => UnaryOp::Not,
            "~" => UnaryOp::BitNot, "+" => UnaryOp::Pos,
            "&" => UnaryOp::Addr, "*" => UnaryOp::Deref,
            // IEC aliases
            "NOT" | "not" => UnaryOp::Not,
            "NEG" | "neg" => UnaryOp::Neg,
            _             => UnaryOp::Neg,
        }
    }

    /// Símbolo canónico ASL (R5).
    pub fn to_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Neg    => "-", UnaryOp::Not    => "!",
            UnaryOp::BitNot => "~", UnaryOp::Pos    => "+",
            UnaryOp::Addr   => "&", UnaryOp::Deref  => "*",
        }
    }

    /// Símbolo IEC 61131-3 (para o ST generator).
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            UnaryOp::Not | UnaryOp::BitNot => "NOT ",
            UnaryOp::Neg                   => "-",
            other                          => other.to_symbol(),
        }
    }
}

/// Operador binário. Serializa como símbolo directo (R5 — "+" não "add", ">=" não "gte").
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum BinaryOp {
    #[serde(rename = "+")]  Add,
    #[serde(rename = "-")]  Sub,
    #[serde(rename = "*")]  Mul,
    #[serde(rename = "/")]  Div,
    #[serde(rename = "%")]  Mod,
    #[serde(rename = "//")]  IntDiv,
    #[serde(rename = "**")]  Pow,
    #[serde(rename = "==")]  Eq,
    #[serde(rename = "!=")]  Neq,
    #[serde(rename = "<")]   Lt,
    #[serde(rename = "<=")]  Lte,
    #[serde(rename = ">")]   Gt,
    #[serde(rename = ">=")]  Gte,
    #[serde(rename = "&&")]  And,
    #[serde(rename = "||")]  Or,
    #[serde(rename = "&")]   BitAnd,
    #[serde(rename = "|")]   BitOr,
    #[serde(rename = "^")]   BitXor,
    #[serde(rename = "<<")]  Shl,
    #[serde(rename = ">>")]  Shr,
}

impl BinaryOp {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "+"   => BinaryOp::Add,    "-"   => BinaryOp::Sub,
            "*"   => BinaryOp::Mul,    "/"   => BinaryOp::Div,
            "%"   => BinaryOp::Mod,    "//"  => BinaryOp::IntDiv,
            "**"  => BinaryOp::Pow,    "=="  => BinaryOp::Eq,
            "!="  => BinaryOp::Neq,    "<"   => BinaryOp::Lt,
            "<="  => BinaryOp::Lte,    ">"   => BinaryOp::Gt,
            ">="  => BinaryOp::Gte,    "&&"  => BinaryOp::And,
            "||"  => BinaryOp::Or,     "&"   => BinaryOp::BitAnd,
            "|"   => BinaryOp::BitOr,  "^"   => BinaryOp::BitXor,
            "<<"  => BinaryOp::Shl,    ">>"  => BinaryOp::Shr,
            // IEC 61131-3 text operators
            "AND" | "and" => BinaryOp::And,
            "OR"  | "or"  => BinaryOp::Or,
            "XOR" | "xor" => BinaryOp::BitXor,
            "MOD" | "mod" => BinaryOp::Mod,
            "EXPT"| "expt"=> BinaryOp::Pow,
            _             => BinaryOp::Add,
        }
    }

    /// Símbolo canónico ASL (R5).
    pub fn to_symbol(&self) -> &'static str {
        match self {
            BinaryOp::Add    => "+",   BinaryOp::Sub    => "-",
            BinaryOp::Mul    => "*",   BinaryOp::Div    => "/",
            BinaryOp::Mod    => "%",   BinaryOp::IntDiv => "//",
            BinaryOp::Pow    => "**",  BinaryOp::Eq     => "==",
            BinaryOp::Neq    => "!=",  BinaryOp::Lt     => "<",
            BinaryOp::Lte    => "<=",  BinaryOp::Gt     => ">",
            BinaryOp::Gte    => ">=",  BinaryOp::And    => "&&",
            BinaryOp::Or     => "||",  BinaryOp::BitAnd => "&",
            BinaryOp::BitOr  => "|",   BinaryOp::BitXor => "^",
            BinaryOp::Shl    => "<<",  BinaryOp::Shr    => ">>",
        }
    }

    /// Símbolo IEC 61131-3 ST (para o ST generator).
    /// Eq="=", Neq="<>", And="AND", Or="OR", BitXor="XOR", Mod="MOD", Pow="EXPT"
    pub fn to_iec_symbol(&self) -> &'static str {
        match self {
            BinaryOp::Eq     => "=",    BinaryOp::Neq    => "<>",
            BinaryOp::And    => "AND",  BinaryOp::Or     => "OR",
            BinaryOp::BitAnd => "AND",  BinaryOp::BitOr  => "OR",
            BinaryOp::BitXor => "XOR",  BinaryOp::Mod    => "MOD",
            BinaryOp::Pow    => "EXPT", BinaryOp::IntDiv => "/",
            other            => other.to_symbol(),
        }
    }
}

// ============================================================================
// Tipos PLC (IEC 61131-3) — .nfladder — mantidos intactos
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
