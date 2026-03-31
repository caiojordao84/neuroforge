//! AslExecutor — despacho central parse → generate para todas as linguagens suportadas.
//!
//! Linguagens activas (Fase 1C) - Arquitetura Omni-direcional:
//! Todas as linguagens são parseadas para um AslProgram (JSON Tree)
//! e geradas DE UM AslProgram unicamente.
//!
//! Stubs Fase 2 PLC:
//!   IL, LD, FBD, SFC   → todo!()

use crate::plugins::c::CGenerator;
use crate::plugins::core::GeneratorOutput;
use crate::plugins::rust_std::RustGenerator;
use crate::plugins::python::python_parser::PythonParser;
use crate::plugins::python::python_generator::PythonGenerator;
use crate::plugins::core::AslGenerator;
use crate::plugins::plc::st_parser::StParser;
use crate::plugins::plc::st_generator::StGenerator;
use crate::plugins::c::c_parser::CParser;
use crate::plugins::rust_std::rust_parser::RustParser;

use crate::types::asl_types::AslProgram;
use crate::transforms::context::Language;
use crate::types::nodes_to_typed::nodes_to_typed;
use crate::transforms::code_to_asl::ast_to_asl;

/// Linguagem / plataforma alvo.
#[derive(Debug, Clone, PartialEq)]
pub enum TargetLanguage {
    /// C++ / Arduino sketch
    C,
    /// C++ genérico (alias)
    Cpp,
    /// Arduino (alias de C)
    Arduino,
    /// Rust (embassy / standalone)
    Rust,
    /// Python / MicroPython
    Python,
    /// MicroPython (alias)
    MicroPython,
    /// Structured Text IEC 61131-3
    St,
    /// Instruction List IEC 61131-3 — stub Fase 2
    Il,
    /// Ladder Diagram IEC 61131-3 — stub Fase 2
    Ld,
    /// Function Block Diagram IEC 61131-3 — stub Fase 2
    Fbd,
    /// Sequential Function Chart IEC 61131-3 — stub Fase 2
    Sfc,
}

impl TargetLanguage {
    /// Converte string case-insensitive para TargetLanguage.
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "c" | "c++" | "cpp"         => Some(Self::C),
            "arduino"                   => Some(Self::Arduino),
            "rust"                      => Some(Self::Rust),
            "python" | "py"             => Some(Self::Python),
            "micropython" | "upython"   => Some(Self::MicroPython),
            "st" | "structuredtext" | "iec61131" | "plc" => Some(Self::St),
            "il" | "instructionlist"    => Some(Self::Il),
            "ld" | "ladder"             => Some(Self::Ld),
            "fbd" | "functionblock"     => Some(Self::Fbd),
            "sfc" | "sequentialfunction"=> Some(Self::Sfc),
            _                           => None,
        }
    }
}

/// Resultado da transpilação.
#[derive(Debug)]
pub struct TranspileOutput {
    /// Código gerado.
    pub code: String,
    /// Source-map (linha gerada → linha fonte). Disponível para C e Rust.
    pub source_map: Vec<(u32, u32)>,
}

impl TranspileOutput {
    fn from_generator_output(out: GeneratorOutput) -> Self {
        Self {
            code: out.code,
            source_map: out.map.iter().map(|e| (e.generated_line, e.source_line)).collect(),
        }
    }
}

/// Motor de transpilação ASL.
pub struct AslExecutor;

impl AslExecutor {
    /// Transpila `source` para a linguagem `target` (Arquitetura NeuroForge Omni-direcional).
    /// Se `source` for um ASL JSON Tree válido, ele transcompila diretamente a partir do JSON (bypass de parser local).
    /// Caso contrário, utiliza o parser para gerar a AST Universal (AslProgram) primeiro.
    pub fn run(source: &str, target: &TargetLanguage) -> Result<TranspileOutput, String> {
        let trimmed_source = source.trim();
        
        let program = if trimmed_source.starts_with('{') && trimmed_source.contains("\"aslVersion\"") {
            // Se já recebemos a ASL Tree diretamente (SFC/Blockly Editor Frontend payload)
            serde_json::from_str::<AslProgram>(trimmed_source)
                .map_err(|e| format!("Erro ao fazer parse do ASL JSON: {}", e))?
        } else {
            // Fallback (ex: recebemos código fonte C++ para compilar para Rust)
            // Usa os novos pipes de transformação Universal
            match target {
                TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
                    let prog = CParser::parse(source).map_err(|e| format!("CParser: {e}"))?;
                    let typed = nodes_to_typed(&prog);
                    ast_to_asl(&typed, Language::Cpp)
                }
                TargetLanguage::Rust => {
                    let prog = RustParser::parse(source).map_err(|e| format!("RustParser: {e}"))?;
                    let typed = nodes_to_typed(&prog);
                    ast_to_asl(&typed, Language::Rust)
                }
                TargetLanguage::Python | TargetLanguage::MicroPython => {
                    PythonParser::parse(source).map_err(|e| format!("PythonParser: {e}"))?
                }
                TargetLanguage::St => {
                    StParser::parse(source).map_err(|e| format!("StParser: {e}"))?
                }
                TargetLanguage::Il | TargetLanguage::Ld | TargetLanguage::Fbd | TargetLanguage::Sfc => {
                    return Err(format!("O Parsing direto para {:?} não é suportado até a Fase 2", target));
                }
            }
        };

        // Geração é feita baseada na IR Omni-direcional unicamente (AslProgram)
        match target {
            TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
                let out = CGenerator::new().generate(&program);
                Ok(TranspileOutput::from_generator_output(out))
            }
            TargetLanguage::Rust => {
                let out = RustGenerator::new().generate(&program);
                Ok(TranspileOutput::from_generator_output(out))
            }
            TargetLanguage::Python | TargetLanguage::MicroPython => {
                let out = PythonGenerator::new().generate(&program);
                Ok(TranspileOutput::from_generator_output(out))
            }
            TargetLanguage::St => {
                let out = StGenerator::new().generate(&program);
                Ok(TranspileOutput::from_generator_output(out))
            }
            TargetLanguage::Il => Err("IL (Instruction List) ainda não implementado — Fase 2 PLC".to_string()),
            TargetLanguage::Ld => Err("LD (Ladder Diagram) ainda não implementado — Fase 2 PLC".to_string()),
            TargetLanguage::Fbd => Err("FBD (Function Block Diagram) ainda não implementado — Fase 2 PLC".to_string()),
            TargetLanguage::Sfc => Err("SFC (Sequential Function Chart) ainda não implementado — Fase 2 PLC".to_string()),
        }
    }
}

// ─── Testes integração end-to-end ────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── C / Arduino ──────────────────────────────────────────────────────────
    #[test]
    fn e2e_c_blink() {
        let src = r#"
void setup() {
    pinMode(13, OUTPUT);
}
void loop() {
    digitalWrite(13, HIGH);
    delay(1000);
    digitalWrite(13, LOW);
    delay(1000);
}
"#;
        let out = AslExecutor::run(src, &TargetLanguage::C).expect("falhou C blink");
        assert!(out.code.contains("digitalWrite") || out.code.contains("setup"),
            "código C deve ter setup ou digitalWrite: {}", out.code);
    }

    #[test]
    fn e2e_arduino_alias() {
        let src = "void setup() {}\nvoid loop() {}";
        let out = AslExecutor::run(src, &TargetLanguage::Arduino).expect("falhou Arduino alias");
        assert!(!out.code.is_empty(), "output não deve estar vazio");
    }

    // ── Rust ─────────────────────────────────────────────────────────────────
    #[test]
    fn e2e_rust_blink() {
        let src = r#"
fn main() {
    gpio_mode(13, 1);
    loop {
        gpio_set(13, 1);
        delay_ms(500);
        gpio_set(13, 0);
        delay_ms(500);
    }
}
"#;
        let out = AslExecutor::run(src, &TargetLanguage::Rust).expect("falhou Rust blink");
        assert!(out.code.contains("fn main"),
            "código Rust deve ter fn main: {}", out.code);
    }

    // ── Python / MicroPython ─────────────────────────────────────────────────
    #[test]
    fn e2e_python_blink() {
        let src = r#"
from machine import Pin
from time import sleep_ms

def main():
    while True:
        sleep_ms(500)
"#;
        let out = AslExecutor::run(src, &TargetLanguage::Python).expect("falhou Python blink");
        assert!(out.code.contains("from time import sleep_ms"),
            "código Python deve ter from time import sleep_ms: {}", out.code);
    }

    #[test]
    fn e2e_micropython_alias() {
        let src = "def setup():\n    pass\n";
        let out = AslExecutor::run(src, &TargetLanguage::MicroPython).expect("falhou MicroPython");
        assert!(!out.code.is_empty());
    }

    // ── ST ───────────────────────────────────────────────────────────────────
    #[test]
    fn e2e_st_program() {
        let src = r#"
PROGRAM Main
  VAR
    Counter : INT := 0;
  END_VAR
  IF Counter > 0 THEN
    Counter := 0;
  END_IF;
END_PROGRAM
"#;
        let out = AslExecutor::run(src, &TargetLanguage::St).expect("falhou ST");
        assert!(out.code.contains("PROGRAM"),
            "código ST deve ter PROGRAM: {}", out.code);
        assert!(out.code.contains("IF"),
            "código ST deve ter IF: {}", out.code);
    }

    // ── TargetLanguage::from_str ──────────────────────────────────────────────
    #[test]
    fn target_language_from_str() {
        assert_eq!(TargetLanguage::from_str("c"),           Some(TargetLanguage::C));
        assert_eq!(TargetLanguage::from_str("C++"),         Some(TargetLanguage::C));
        assert_eq!(TargetLanguage::from_str("arduino"),     Some(TargetLanguage::Arduino));
        assert_eq!(TargetLanguage::from_str("rust"),        Some(TargetLanguage::Rust));
        assert_eq!(TargetLanguage::from_str("python"),      Some(TargetLanguage::Python));
        assert_eq!(TargetLanguage::from_str("micropython"), Some(TargetLanguage::MicroPython));
        assert_eq!(TargetLanguage::from_str("st"),          Some(TargetLanguage::St));
        assert_eq!(TargetLanguage::from_str("plc"),         Some(TargetLanguage::St));
        assert_eq!(TargetLanguage::from_str("il"),          Some(TargetLanguage::Il));
        assert_eq!(TargetLanguage::from_str("ld"),          Some(TargetLanguage::Ld));
        assert_eq!(TargetLanguage::from_str("fbd"),         Some(TargetLanguage::Fbd));
        assert_eq!(TargetLanguage::from_str("sfc"),         Some(TargetLanguage::Sfc));
        assert_eq!(TargetLanguage::from_str("vhdl"),        None);
    }

    // ── Stubs Fase 2 devolvem Err ─────────────────────────────────────────────
    #[test]
    fn stubs_return_err() {
        assert!(AslExecutor::run("x", &TargetLanguage::Il).is_err());
        assert!(AslExecutor::run("x", &TargetLanguage::Ld).is_err());
        assert!(AslExecutor::run("x", &TargetLanguage::Fbd).is_err());
        assert!(AslExecutor::run("x", &TargetLanguage::Sfc).is_err());
    }
}
