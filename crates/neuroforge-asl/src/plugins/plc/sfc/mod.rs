//! SFC (Sequential Function Chart) — IEC 61131-3 §8
//! Entrada: PLCopen XML  →  AslStateMachine (via AslStatement::StateMachine)
//!
//! RT-1: módulo declarado.
//! RT-7/8: parser com steps, transitions, divergências seletivas/simultâneas.
pub mod parser;
pub mod generator;
