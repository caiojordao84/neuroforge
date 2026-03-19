//! LD (Ladder Diagram) — IEC 61131-3 §6
//! Entrada: PLCopen XML  →  AslProgram
//!
//! RT-1: módulo declarado.
//! RT-4/5: parser com resolução de grafo AND/OR.
pub mod parser;
pub mod generator;
