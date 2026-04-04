//! SFC (Sequential Function Chart)     IEC 61131-3   8

//! Entrada: PLCopen XML       AslStateMachine (via AslStatement::StateMachine)

//!

//! RT-1: m  dulo declarado.

//! RT-7/8: parser com steps, transitions, diverg  ncias seletivas/simult  neas.

pub mod parser;

pub mod generator;
