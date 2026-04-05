//! Core types for ASL programs: AslProgram, AslBlock, AslStatement
//!
//! This module contains the root program structure and all statement types
//! that make up the ASL AST.

use serde::{Deserialize, Serialize};

use crate::asl_types::core::types::{AslExpr, AslType};

/// Metadata do programa (2.1). `targetBoard` serializa em camelCase conforme 2.1 do Dicionário.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    /// targetBoard conforme 2.1 do Dicionário (camelCase)
    pub target_board: Option<String>,
}

/// Root do programa ASL (2). Contém todos os campos normativos do Dicionário v1.2.3.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AslProgram {
    /// Versão do schema ASL (ex: "4.0.0")
    pub asl_version: String,
    pub metadata: AslMetadata,
    /// 2.2     Dependências explícitas de biblioteca (ex: "wire", "servo", "mqtt")
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub includes: Vec<String>,
    /// 12     Definições de struct
    pub structs: Vec<AslStructDef>,
    /// 4     Definições de enum (novo em v1.2)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub enums: Vec<AslEnum>,
    /// Variáveis globais
    pub globals: Vec<AslGlobalVar>,
    /// 11     Funções puras (stateless)
    pub functions: Vec<AslFunction>,
    /// 5     Function Blocks stateful (novo em v1.2)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub function_blocks: Vec<AslFunctionBlock>,
    /// 2.3     Tasks (setup + loop + async tasks)
    pub tasks: Vec<AslTask>,
}

impl Default for AslProgram {
    fn default() -> Self {
        Self {
            asl_version: "4.0.0".to_string(),
            metadata: AslMetadata::default(),
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

/// Variável global – segue semântica de `declare` (9.1).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
    /// "normal" | "retain" | "persistent" (9.2)
    #[serde(default = "default_lifecycle")]
    pub lifecycle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<String>>,
}

fn default_lifecycle() -> String {
    "normal".to_string()
}

/// Parâmetro de função (11.1). O campo `default` é opcional.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslParam {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<AslExpr>,
}

/// Função pura – stateless (11). Não confundir com FunctionBlock (5).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslFunction {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub params: Vec<AslParam>,
    pub body: Vec<AslStatement>,
    pub return_type: Option<AslType>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attributes: Vec<AslAttribute>,
    #[serde(default)]
    pub is_async: bool,
}

/// Campo de entrada/saída/interna de um Function Block (5.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslFbField {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mutable: Option<bool>,
}

/// Definição de Function Block – stateful, com inputs/outputs/internals/body (5).
/// Entradas no array `functionBlocks` do root não levam `kind` (5.1 nota).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

/// Task de execução (2.3). `setup` e `loop` são obrigatórias (R7).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTask {
    pub name: String,
    /// true para tarefas async (25)
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

fn default_void() -> String {
    "void".to_string()
}

/// Campo de um struct. O campo `default` é opcional (12.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslStructField {
    pub name: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<AslExpr>,
}

/// Definição de struct (12). O campo `doc` é opcional (R8).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslStructDef {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub fields: Vec<AslStructField>,
}

/// Variante de enumeração (4.1 Dicionário).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslEnumVariant {
    pub name: String,
    pub value: i64,
}

/// Definição de enumeração (4). Serializa com `kind: "enum"`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslEnum {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<String>,
    pub variants: Vec<AslEnumVariant>,
}

// ============================================================================
// Attributes (for embedded Rust: #![no_std], #[embassy::main], etc.)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslAttribute {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub arguments: Vec<String>,
    pub is_inner: bool,
}

// ============================================================================
// Statements
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
    //          6     Pinos
    #[serde(rename = "pinMode")]
    PinMode(AslPinMode),
    #[serde(rename = "digitalOutput")]
    DigitalOutput(AslDigitalOutput),
    #[serde(rename = "analogOutput")]
    AnalogOutput(AslAnalogOutput),
    #[serde(rename = "digitalInput")]
    DigitalInput(AslDigitalInput),
    #[serde(rename = "analogInput")]
    AnalogInput(AslAnalogInput),
    //          8     Controlo de Fluxo
    #[serde(rename = "if")]
    If(Box<AslIf>),
    #[serde(rename = "while")]
    While(Box<AslWhile>),
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
    #[serde(rename = "tryCatch")]
    TryCatch(Box<AslTryCatch>),
    //          9     Variáveis
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
    //          7     Temporização
    #[serde(rename = "delay")]
    Delay(AslDelay),
    //          13     Print / Serial
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
    //        Expressão como statement
    #[serde(rename = "expr")]
    Expr(AslExpressionStmt),
    //        R8     Comentário
    #[serde(rename = "comment")]
    Comment(AslComment),
    //          22     Bus (UART / I2C / SPI)
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
    //          22.4     Modbus (novo em v1.2)
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
    //        PWM
    #[serde(rename = "pwmInit")]
    PwmInit(AslPwmInit),
    #[serde(rename = "pwmSetDuty")]
    PwmSetDuty(AslPwmSetDuty),
    #[serde(rename = "pwmSetFreq")]
    PwmSetFreq(AslPwmSetFreq),
    #[serde(rename = "pwmStop")]
    PwmStop(AslPwmStop),
    //        IEC 61131-3 Timers
    #[serde(rename = "timerTON")]
    TimerTon(AslTimerTon),
    #[serde(rename = "timerTOF")]
    TimerTof(AslTimerTof),
    #[serde(rename = "timerTP")]
    TimerTp(AslTimerTp),
    //        IEC Counters
    #[serde(rename = "counterCTU")]
    CounterCtu(AslCounterCtu),
    #[serde(rename = "counterCTD")]
    CounterCtd(AslCounterCtd),
    //        IEC Latches
    #[serde(rename = "latchSR")]
    LatchSr(AslLatchSr),
    #[serde(rename = "latchRS")]
    LatchRs(AslLatchRs),
    //        IEC Triggers
    #[serde(rename = "trigR")]
    TrigR(AslTrigR),
    #[serde(rename = "trigF")]
    TrigF(AslTrigF),
    //          23     Servo
    #[serde(rename = "servoAttach")]
    ServoAttach(AslServoAttach),
    #[serde(rename = "servoWrite")]
    ServoWrite(AslServoWrite),
    #[serde(rename = "servoDetach")]
    ServoDetach(AslServoDetach),
    //          24     RGB / NeoPixel
    #[serde(rename = "rgbSet")]
    RgbSet(AslRgbSet),
    //          26     Interrupts
    #[serde(rename = "attachInterrupt")]
    AttachInterrupt(AslAttachInterrupt),
    #[serde(rename = "timerInterrupt")]
    TimerInterrupt(AslTimerInterrupt),
    //          27     Concorrência e Sincronização (novo em v1.2)
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
    //          28     Sensores Industriais
    #[serde(rename = "sensorRead")]
    SensorRead(AslSensorRead),
    //          29     Energy Management (novo em v1.2)
    #[serde(rename = "sleepMode")]
    SleepMode(AslSleepMode),
    #[serde(rename = "watchdogTimer")]
    WatchdogTimer(AslWatchdogTimer),
    //          30     Persistent Storage (novo em v1.2)
    #[serde(rename = "storageWrite")]
    StorageWrite(AslStorageWrite),
    #[serde(rename = "storageRead")]
    StorageRead(AslStorageRead),
    #[serde(rename = "storageCommit")]
    StorageCommit,
    //          31     Network Communication (novo em v1.2)
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
    //          32     Displays (novo em v1.2)
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
    //          34     Logging (novo em v1.2)
    #[serde(rename = "log")]
    Log(AslLog),
    //          35     Testing and Simulation (novo em v1.2)
    #[serde(rename = "assert")]
    Assert(AslAssert),
    #[serde(rename = "simProbe")]
    SimProbe(AslSimProbe),
    //        SFC     State Machine
    #[serde(rename = "stateMachine")]
    StateMachine(Box<AslStateMachine>),
}

impl Default for AslStatement {
    fn default() -> Self {
        AslStatement::Delay(AslDelay::default())
    }
}

// ============================================================================
// Statement structs - 6 Pinos
// ============================================================================

/// 6.1     Configuração de modo de pino.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPinMode {
    pub pin: AslExpr,
    pub mode: PinModeKind,
}

/// Modos válidos conforme 6.2 do Dicionário.
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

impl Default for PinModeKind {
    fn default() -> Self {
        PinModeKind::Input
    }
}

/// 6.3     digitalOutput.
/// R4: value é AslExpr – HIGH/LOW devem ser normalizados para literal 1/0 pelo parser.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslDigitalOutput {
    pub pin: AslExpr,
    pub value: AslExpr,
}

/// 6.5     analogOutput.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslAnalogOutput {
    pub pin: AslExpr,
    pub value: AslExpr,
}

/// 6.4     digitalInput.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslDigitalInput {
    pub pin: AslExpr,
    pub target: String,
}

/// 6.6     analogInput.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslAnalogInput {
    pub pin: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs - 7 Temporização
// ============================================================================

/// 7.2     delay com duração estruturada (nunca ms raw).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslDelay {
    pub duration: AslDuration,
}

/// Duração estruturada conforme 7.1 do Dicionário.
/// O delay só aceita AslDuration – valores raw em ms não são permitidos (7.2).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
        Self::from_us(ms * 1000)
    }

    pub fn from_us(us: u64) -> Self {
        let mut rem = us;
        let days = (rem / 86_400_000_000) as u32;
        rem %= 86_400_000_000;
        let hours = (rem / 3_600_000_000) as u32;
        rem %= 3_600_000_000;
        let minutes = (rem / 60_000_000) as u32;
        rem %= 60_000_000;
        let seconds = (rem / 1_000_000) as u32;
        rem %= 1_000_000;
        let milliseconds = (rem / 1_000) as u32;
        let microseconds = (rem % 1_000) as u32;
        AslDuration {
            days,
            hours,
            minutes,
            seconds,
            milliseconds,
            microseconds,
        }
    }

    pub fn from_secs(s: u64) -> Self {
        Self::from_us(s * 1_000_000)
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

// ============================================================================
// Statement structs - 8 Controlo de Fluxo
// ============================================================================

/// 8.1     if/elseIf/else.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslIf {
    pub condition: AslExpr,
    pub then_body: Vec<AslStatement>,
    #[serde(default)]
    pub else_if: Vec<AslElseIf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub else_body: Option<Vec<AslStatement>>,
}

/// Uma cláusula elseIf (8.1).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslElseIf {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

/// 8.2     while.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslWhile {
    pub condition: AslExpr,
    pub body: Vec<AslStatement>,
}

/// 8.3     doWhile.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslDoWhile {
    pub body: Vec<AslStatement>,
    pub condition: AslExpr,
}

/// 8.4-8.6     for unificado com discriminante `pattern`.
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

impl Default for AslFor {
    fn default() -> Self {
        AslFor::Range(AslForRange::default())
    }
}

/// 8.4     for range. `to` é sempre exclusivo (convenção ASL).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslForRange {
    pub var: String,
    pub from: AslExpr,
    /// Sempre exclusivo (i < to). ST parser normaliza: TO 9 → to: 10.
    pub to: AslExpr,
    pub step: AslExpr,
    pub body: Vec<AslStatement>,
}

/// 8.5     for each.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslForEach {
    pub var: String,
    pub iterable: AslExpr,
    pub body: Vec<AslStatement>,
}

/// 8.6     for cStyle (apenas quando não mapeia para range/each).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslForCStyle {
    pub init: Vec<AslStatement>,
    pub condition: AslExpr,
    pub update: Vec<AslStatement>,
    pub body: Vec<AslStatement>,
}

/// 8.7     switch.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSwitch {
    pub discriminant: AslExpr,
    pub cases: Vec<AslSwitchCase>,
}

/// Caso de switch. `test: null` = default.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSwitchCase {
    pub test: Option<AslExpr>,
    pub body: Vec<AslStatement>,
}

/// 8.8     return.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslReturn {
    pub value: Option<AslExpr>,
}

/// 8.9     tryCatch.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTryCatch {
    pub try_body: Vec<AslStatement>,
    pub catch_param: String,
    pub catch_type: String,
    pub catch_body: Vec<AslStatement>,
}

// ============================================================================
// Statement structs - 9 Variáveis
// ============================================================================

/// 9.3     assign. Compound operators (+=, i++) são expandidos para assign+binary.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslAssign {
    pub target: String,
    pub value: AslExpr,
}

/// 9.1     declare. Versão completa com mutable/scope/lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslDeclare {
    pub name: String,
    pub r#type: AslType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<AslExpr>,
    /// Tipo concreto para array/struct/enum
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subtype: Option<String>,
    /// Tamanho para arrays (10.1)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<AslExpr>,
    /// false = const, true = mutable
    pub mutable: bool,
    /// "local" | "global" | "const"
    pub scope: String,
    /// "normal" | "retain" | "persistent" (9.2)
    #[serde(default = "default_lifecycle")]
    pub lifecycle: String,
}

/// 9.4     setIndex.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSetIndex {
    pub target: String,
    pub index: AslExpr,
    pub value: AslExpr,
}

/// 9.4     setIndex2D.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex2D {
    pub target: String,
    pub row_index: AslExpr,
    pub col_index: AslExpr,
    pub value: AslExpr,
}

/// setIndex3D (extensão consistente com setIndex2D).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSetIndex3D {
    pub target: String,
    pub d1_index: AslExpr,
    pub d2_index: AslExpr,
    pub d3_index: AslExpr,
    pub value: AslExpr,
}

/// 9.5     setMember.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSetMember {
    pub target: AslExpr,
    pub property: String,
    pub value: AslExpr,
}

/// setPointer (Rust/C – dereference assignment).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSetPointer {
    pub target: AslExpr,
    pub value: AslExpr,
}

/// expr como statement (11.2 – call como statement).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslExpressionStmt {
    pub expr: AslExpr,
}

// ============================================================================
// Statement structs - 13 Print / Serial
// ============================================================================

/// 13.1     print.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPrint {
    pub args: Vec<AslExpr>,
    pub newline: bool,
}

/// 13.2     serialBegin. `port: 0` por defeito.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSerialBegin {
    pub baud: AslExpr,
    #[serde(default)]
    pub port: u8,
}

/// 13.2     serialWrite.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSerialWrite {
    pub data: AslExpr,
}

/// 13.2     serialReadString (como statement – guarda em target).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSerialReadString {
    pub target: String,
}

/// 13.2     serialReadByte (como statement – guarda em target).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSerialReadByte {
    pub target: String,
}

/// Comentário inline (R8).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslComment {
    pub text: String,
}

// ============================================================================
// Statement structs - 22 Bus
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslUartWrite {
    pub port: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslUartRead {
    pub port: AslExpr,
    pub length: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslI2cWrite {
    pub bus: AslExpr,
    pub address: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslI2cRead {
    pub bus: AslExpr,
    pub address: AslExpr,
    pub length: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSpiTransfer {
    pub bus: AslExpr,
    pub cs_pin: AslExpr,
    pub tx_data: AslExpr,
    pub target: Option<String>,
}

// ============================================================================
// Statement structs - 22.4 Modbus (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadHoldingRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadInputRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteSingleRegister {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteMultipleRegisters {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusReadCoils {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub quantity: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslModbusWriteSingleCoil {
    pub unit_id: AslExpr,
    pub address: AslExpr,
    pub value: AslExpr,
}

// ============================================================================
// Statement structs - PWM
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPwmInit {
    pub pin: AslExpr,
    pub freq: AslExpr,
    pub duty: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPwmSetDuty {
    pub pin: AslExpr,
    pub duty: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPwmSetFreq {
    pub pin: AslExpr,
    pub freq: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslPwmStop {
    pub pin: AslExpr,
}

// ============================================================================
// Statement structs - IEC Timers / Counters / Latches / Triggers
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTon {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    pub out_q: AslExpr,
    pub out_et: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTof {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    pub out_q: AslExpr,
    pub out_et: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerTp {
    pub instance: String,
    pub r#in: AslExpr,
    pub pt: AslExpr,
    pub out_q: AslExpr,
    pub out_et: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslCounterCtu {
    pub instance: String,
    pub cu: AslExpr,
    pub r: AslExpr,
    pub pv: AslExpr,
    pub out_q: AslExpr,
    pub out_cv: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslCounterCtd {
    pub instance: String,
    pub cd: AslExpr,
    pub ld: AslExpr,
    pub pv: AslExpr,
    pub out_q: AslExpr,
    pub out_cv: AslExpr,
}

/// 19.3     CTUD Count Up/Down (novo em v1.2)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLatchSr {
    pub instance: String,
    pub s: AslExpr,
    pub r: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLatchRs {
    pub instance: String,
    pub r: AslExpr,
    pub s: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslTrigR {
    pub instance: String,
    pub r#in: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslTrigF {
    pub instance: String,
    pub r#in: AslExpr,
}

// ============================================================================
// Statement structs - 23 Servo
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslServoAttach {
    pub var_name: String,
    pub pin: AslExpr,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_pulse: Option<AslExpr>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_pulse: Option<AslExpr>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslServoWrite {
    pub var_name: String,
    pub angle: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslServoDetach {
    pub var_name: String,
}

// ============================================================================
// Statement structs - 24 RGB
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
// Statement structs - 26 Interrupts
// ============================================================================

/// Trigger válidos: "RISING" | "FALLING" | "CHANGE" | "LOW" | "HIGH"
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslAttachInterrupt {
    pub pin: AslExpr,
    pub handler: String,
    pub trigger: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslTimerInterrupt {
    pub period_ms: AslExpr,
    pub handler: String,
}

// ============================================================================
// Statement structs - 27 Concorrência (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslMutexOp {
    pub mutex_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslQueueSend {
    pub queue_name: String,
    pub value: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslQueueReceive {
    pub queue_name: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSemaphoreOp {
    pub semaphore_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslEventGroupOp {
    pub group: String,
    pub bits: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslEventGroupWaitBits {
    pub group: String,
    pub bits: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs - 28 Sensores Industriais
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSensorFaultDetect {
    pub threshold: f64,
    pub mode: String, // "outOfRange" | "stuck" | ...
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
// Statement structs - 29 Energy Management (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSleepMode {
    pub mode: String, // "IDLE" | "LIGHT_SLEEP" | "DEEP_SLEEP"
    pub duration: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslWatchdogTimer {
    pub timeout: AslExpr,
    pub enable: bool,
}

// ============================================================================
// Statement structs - 30 Persistent Storage (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslStorageWrite {
    pub address: AslExpr,
    pub data: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslStorageRead {
    pub address: AslExpr,
    pub length: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs - 31 Network Communication (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslWifiConnect {
    pub ssid: AslExpr,
    pub password: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslWifiStatus {
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslMqttConnect {
    pub broker: AslExpr,
    pub port: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslMqttPublish {
    pub topic: AslExpr,
    pub payload: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslMqttSubscribe {
    pub topic: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslHttpGet {
    pub url: AslExpr,
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslHttpPost {
    pub url: AslExpr,
    pub body: AslExpr,
    pub target: String,
}

// ============================================================================
// Statement structs - 32 Displays (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLcdInit {
    pub address: AslExpr,
    pub cols: u32,
    pub rows: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLcdPrint {
    pub col: u32,
    pub row: u32,
    pub text: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslLcdSetCursor {
    pub col: u32,
    pub row: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslOledInit {
    pub width: u32,
    pub height: u32,
    pub address: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslOledDrawText {
    pub x: u32,
    pub y: u32,
    pub text: AslExpr,
}

// ============================================================================
// Statement structs - 34 Logging (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslLog {
    pub level: String, // "DEBUG" | "INFO" | "WARN" | "ERROR"
    pub module: String,
    pub message: AslExpr,
}

// ============================================================================
// Statement structs - 35 Testing and Simulation (novo em v1.2)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslAssert {
    pub condition: AslExpr,
    pub message: AslExpr,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AslSimProbe {
    pub name: String,
    pub value: AslExpr,
}

// ============================================================================
// SFC - State Machine
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslStateMachine {
    pub name: String,
    pub state_var: String,
    pub initial_step: String,
    pub steps: Vec<AslSmStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSmStep {
    pub name: String,
    pub actions: Vec<AslStatement>,
    pub transitions: Vec<AslSmTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AslSmTransition {
    pub condition: AslExpr,
    pub target_step: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<u32>,
}
