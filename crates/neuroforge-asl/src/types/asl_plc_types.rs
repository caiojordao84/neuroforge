//! Tipos ASL para IEC 61131-3 (PLC)

//! Corresponde a asl_plc_types no plano v4.2

use serde::{Deserialize, Serialize};

use crate::types::asl_types::AslExpr;

//        Programa PLC

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslPlcProgram {
    pub name: String,

    pub variables: Vec<AslPlcVar>,

    pub networks: Vec<AslNetwork>,

    pub functions: Vec<AslPlcFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslPlcVar {
    pub name: String,

    pub var_type: String,

    pub value: Option<AslExpr>,

    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslPlcFunction {
    pub name: String,

    pub return_type: Option<String>,

    pub params: Vec<AslPlcVar>,

    pub body: Vec<AslNetwork>,
}

//        Rede / Rung

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslNetwork {
    pub id: u32,

    pub comment: Option<String>,

    pub kind: NetworkKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub enum NetworkKind {
    Ladder(AslRung),

    St(String), // Structured Text inline

    Fbd(Vec<AslFbdBlock>),

    Sfc(Vec<AslSfcStep>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslRung {
    pub number: u32,

    pub comment: Option<String>,

    pub elements: Vec<AslLadderElement>,
}

//        Elementos Ladder

#[derive(Debug, Clone, Serialize, Deserialize)]

pub enum AslLadderElement {
    Contact(AslContact),

    NegContact(AslContact),

    TrigR(AslContact), // Detec    o borda subida P

    TrigF(AslContact), // Detec    o borda descida N

    Coil(AslCoil),

    NegCoil(AslCoil),

    SetCoil(AslCoil),

    ResetCoil(AslCoil),

    TimerTon(AslTimerTON),

    TimerTof(AslTimerTOF),

    TimerTp(AslTimerTP),

    CounterCtu(AslCounterCTU),

    CounterCtd(AslCounterCTD),

    LatchSr(AslLatchSR),

    LatchRs(AslLatchRS),

    FunctionBlock(AslFbCall),

    BranchStart,

    BranchEnd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslContact {
    pub variable: String,

    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslCoil {
    pub variable: String,

    pub comment: Option<String>,
}

//        Blocos de Fun    o IEC

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslTimerTON {
    pub tag: String,

    pub preset: AslExpr,

    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslTimerTOF {
    pub tag: String,

    pub preset: AslExpr,

    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslTimerTP {
    pub tag: String,

    pub preset: AslExpr,

    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslCounterCTU {
    pub tag: String,

    pub preset: AslExpr,

    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslCounterCTD {
    pub tag: String,

    pub preset: AslExpr,

    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslLatchSR {
    pub tag: String,

    pub set: AslExpr,

    pub reset: AslExpr,

    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslLatchRS {
    pub tag: String,

    pub set: AslExpr,

    pub reset: AslExpr,

    pub output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslFbCall {
    pub instance: String,

    pub fb_type: String,

    pub inputs: Vec<(String, AslExpr)>,

    pub outputs: Vec<(String, String)>,
}

//        FBD

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslFbdBlock {
    pub id: String,

    pub block_type: String,

    pub inputs: Vec<(String, AslExpr)>,

    pub outputs: Vec<(String, String)>,

    pub position: (f64, f64),
}

//        SFC

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslSfcStep {
    pub name: String,

    pub is_initial: bool,

    pub actions: Vec<AslSfcAction>,

    pub transitions: Vec<AslSfcTransition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslSfcAction {
    pub qualifier: String, // "N", "S", "R", "P", "L", etc.

    pub name: String,

    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]

pub struct AslSfcTransition {
    pub target_step: String,

    pub condition: AslExpr,
}
