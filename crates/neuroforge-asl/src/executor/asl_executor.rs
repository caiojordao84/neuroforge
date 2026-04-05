//! AslExecutor     despacho central parse     generate para todas as linguagens suportadas.

//!

//! Linguagens activas (Fase 1C) - Arquitetura Omni-direcional:

//! Todas as linguagens s  o parseadas para um AslProgram (JSON Tree)

//! e geradas DE UM AslProgram unicamente.

//!

//! Stubs Fase 2 PLC:

//!   IL, LD, FBD, SFC       todo!()

use crate::asl_types::agent::confidence::BoardConfidenceReport;

use crate::asl_types::agent::skill_selector::SkillSelector;

use crate::asl_types::agent::transpile_context::TranspileContext;

use crate::asl_types::board::AslTarget;

use crate::plugins::c::c_parser::CParser;

use crate::plugins::c::CGenerator;

use crate::plugins::core::AslGenerator;

use crate::plugins::core::GeneratorOutput;

use crate::plugins::plc::st_generator::StGenerator;

use crate::plugins::plc::st_parser::StParser;

use crate::plugins::python::python_generator::PythonGenerator;

use crate::plugins::python::python_parser::PythonParser;

use crate::plugins::rust_std::rust_parser::RustParser;

use crate::plugins::rust_std::RustGenerator;

use crate::parser::neuro_parser::NeuroParser;

use crate::types::asl_types::AslProgram;

/// Linguagem / plataforma alvo.

#[derive(Debug, Clone, PartialEq)]

pub enum TargetLanguage {
    /// C++ / Arduino sketch
    C,

    /// C++ gen  rico (alias)
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

    /// Instruction List IEC 61131-3     stub Fase 2
    Il,

    /// Ladder Diagram IEC 61131-3     stub Fase 2
    Ld,

    /// Function Block Diagram IEC 61131-3     stub Fase 2
    Fbd,

    /// Sequential Function Chart IEC 61131-3     stub Fase 2
    Sfc,
}

impl TargetLanguage {
    /// Converte string case-insensitive para TargetLanguage.

    #[allow(clippy::should_implement_trait)]

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "c" | "c++" | "cpp" => Some(Self::C),

            "arduino" => Some(Self::Arduino),

            "rust" => Some(Self::Rust),

            "python" | "py" => Some(Self::Python),

            "micropython" | "upython" => Some(Self::MicroPython),

            "st" | "structuredtext" | "iec61131" | "plc" => Some(Self::St),

            "il" | "instructionlist" => Some(Self::Il),

            "ld" | "ladder" => Some(Self::Ld),

            "fbd" | "functionblock" => Some(Self::Fbd),

            "sfc" | "sequentialfunction" => Some(Self::Sfc),

            _ => None,
        }
    }
}

/// Resultado da transpila    o.

#[derive(Debug)]

pub struct TranspileOutput {
    /// C  digo gerado.
    pub code: String,

    /// Source-map (linha gerada     linha fonte). Dispon  vel para C e Rust.
    pub source_map: Vec<(u32, u32)>,
}

/// Resultado da transpila    o com informa   es de confian   a e skill usada.
#[derive(Debug)]
pub struct AwareTranspileOutput {
    /// C  digo gerado.
    pub code: String,
    /// Source-map (linha gerada     linha fonte).
    pub source_map: Vec<(u32, u32)>,
    /// Relat  rio de confian   a do board.
    pub confidence: BoardConfidenceReport,
    /// Caminho do arquivo .md de skill usado.
    pub skill_used: String,
}

impl TranspileOutput {
    fn from_generator_output(out: GeneratorOutput) -> Self {
        Self {
            code: out.code,

            source_map: out
                .map
                .iter()
                .map(|e| (e.generated_line, e.source_line))
                .collect(),
        }
    }
}

/// Motor de transpila    o ASL.

pub struct AslExecutor;

impl AslExecutor {
    /// Transpila `source` para a linguagem `target` (Arquitetura NeuroForge Omni-direcional).

    /// Se `source` for um ASL JSON Tree v  lido, ele transcompila diretamente a partir do JSON (bypass de parser local).

    /// Caso contr  rio, utiliza o parser para gerar a AST Universal (AslProgram) primeiro.

    pub fn run(source: &str, target: &TargetLanguage) -> Result<TranspileOutput, String> {
        let trimmed_source = source.trim();

        // Detect source language for cross-compilation

        let source_is_python = trimmed_source.contains("from machine")
            || trimmed_source.contains("from time")
            || trimmed_source.contains("import machine")
            || trimmed_source.contains("import utime");

        // Detect if source is Rust (for embedded Rust transpilation)
        let source_is_rust = trimmed_source.contains("fn main")
            || trimmed_source.contains("let mut")
            || trimmed_source.contains("#![no_std]")
            || trimmed_source.contains("use embassy");

        // Detect if source is C/Arduino
        let source_is_c = trimmed_source.contains("void setup")
            || trimmed_source.contains("void loop")
            || trimmed_source.contains("digitalWrite")
            || trimmed_source.contains("pinMode");

        let program =
            if trimmed_source.starts_with('{') && trimmed_source.contains("\"aslVersion\"") {
                // Se j   recebemos a ASL Tree diretamente (SFC/Blockly Editor Frontend payload)

                serde_json::from_str::<AslProgram>(trimmed_source)
                    .map_err(|e| format!("Erro ao fazer parse do ASL JSON: {}", e))?
            } else {
                // Determine which parser to use based on SOURCE language, not target
                // Phase 1C: Universal AST from any supported source

                // First, detect the source language
                let source_lang = if source_is_python {
                    "python"
                } else if source_is_rust {
                    "rust"
                } else if source_is_c {
                    "c"
                } else {
                    // Default based on target if source detection is ambiguous
                    match target {
                        TargetLanguage::Python | TargetLanguage::MicroPython => "python",
                        TargetLanguage::Rust => "rust",
                        _ => "c",
                    }
                };

                // Use the appropriate parser for the SOURCE language
                match source_lang {
                    "python" => {
                        PythonParser::parse(source).map_err(|e| format!("PythonParser: {e}"))?
                    }
                    "rust" => RustParser::parse(source).map_err(|e| format!("RustParser: {e}"))?,
                    "c" => CParser::parse(source).map_err(|e| format!("CParser: {e}"))?,
                    _ => {
                        // Fallback to C parser
                        CParser::parse(source).map_err(|e| format!("CParser: {e}"))?
                    }
                }
            };

        // Gera    o    feita baseada na IR Omni-direcional unicamente (AslProgram)

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

            TargetLanguage::Il => {
                Err("IL (Instruction List) ainda n  o implementado     Fase 2 PLC".to_string())
            }

            TargetLanguage::Ld => {
                Err("LD (Ladder Diagram) ainda n  o implementado     Fase 2 PLC".to_string())
            }

            TargetLanguage::Fbd => Err(
                "FBD (Function Block Diagram) ainda n  o implementado     Fase 2 PLC".to_string(),
            ),

            TargetLanguage::Sfc => Err(
                "SFC (Sequential Function Chart) ainda n  o implementado     Fase 2 PLC"
                    .to_string(),
            ),
        }
    }

    /// Transpila usando contexto completo (board, target, program, components).
    ///
    /// Este m  todo  a nova entrada que integra o sistema de agentes com o motor de transpila  o.
    pub fn run_with_context(ctx: &TranspileContext) -> Result<AwareTranspileOutput, String> {
        // 1. Selecionar skill usando SkillSelector
        let selector = SkillSelector::default();
        let skill_relative = selector.select(&ctx.board_profile, &ctx.target);
        let skill_path = selector.skill_path(&skill_relative);

        // 2. Calcular confian  a do board
        let confidence = BoardConfidenceReport::calculate(
            &ctx.board_profile,
            &ctx.target,
            &ctx.asl_program,
            &ctx.components,
        );

        // 3. Converter AslTarget para TargetLanguage
        let target = Self::convert_target(&ctx.target)?;

        // 4. Executar transpila  o usando o m  todo existente
        let transpile_output = Self::run_asl_program(&ctx.asl_program, &target)?;

        // 5. Retornar resultado com confian  a e skill usada
        Ok(AwareTranspileOutput {
            code: transpile_output.code,
            source_map: transpile_output.source_map,
            confidence,
            skill_used: skill_path,
        })
    }

    /// Converte AslTarget para TargetLanguage.
    fn convert_target(asl_target: &AslTarget) -> Result<TargetLanguage, String> {
        let platform = asl_target.platform.to_lowercase();

        // Mapear plataforma para TargetLanguage
        match platform.as_str() {
            "c" | "cpp" | "arduino" | "arduino-cpp" => Ok(TargetLanguage::C),
            "rust" | "embassy" => Ok(TargetLanguage::Rust),
            "python" | "micropython" => Ok(TargetLanguage::Python),
            "circuitpython" => Ok(TargetLanguage::Python),
            "st" | "structuredtext" | "iec61131" => Ok(TargetLanguage::St),
            "il" => Ok(TargetLanguage::Il),
            "ld" | "ladder" => Ok(TargetLanguage::Ld),
            "fbd" | "functionblock" => Ok(TargetLanguage::Fbd),
            "sfc" | "sequentialfunction" => Ok(TargetLanguage::Sfc),
            _ => Err(format!("Plataforma n  o suportada: {}", platform)),
        }
    }

    /// Executa transpila  o a partir de um AslProgram j  parseado.
    fn run_asl_program(
        program: &AslProgram,
        target: &TargetLanguage,
    ) -> Result<TranspileOutput, String> {
        match target {
            TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
                let out = CGenerator::new().generate(program);
                Ok(TranspileOutput::from_generator_output(out))
            }

            TargetLanguage::Rust => {
                let out = RustGenerator::new().generate(program);
                Ok(TranspileOutput::from_generator_output(out))
            }

            TargetLanguage::Python | TargetLanguage::MicroPython => {
                let out = PythonGenerator::new().generate(program);
                Ok(TranspileOutput::from_generator_output(out))
            }

            TargetLanguage::St => {
                let out = StGenerator::new().generate(program);
                Ok(TranspileOutput::from_generator_output(out))
            }

            TargetLanguage::Il => {
                Err("IL (Instruction List) ainda n  o implementado     Fase 2 PLC".to_string())
            }

            TargetLanguage::Ld => {
                Err("LD (Ladder Diagram) ainda n  o implementado     Fase 2 PLC".to_string())
            }

            TargetLanguage::Fbd => Err(
                "FBD (Function Block Diagram) ainda n  o implementado     Fase 2 PLC".to_string(),
            ),

            TargetLanguage::Sfc => Err(
                "SFC (Sequential Function Chart) ainda n  o implementado     Fase 2 PLC"
                    .to_string(),
            ),
        }
    }
}

//           Testes integra    o end-to-end

#[cfg(test)]

mod tests {

    use super::*;

    //        C / Arduino

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

        assert!(
            out.code.contains("digitalWrite") || out.code.contains("setup"),
            "c  digo C deve ter setup ou digitalWrite: {}",
            out.code
        );
    }

    #[test]

    fn e2e_arduino_alias() {
        let src = "void setup() {}\nvoid loop() {}";

        let out = AslExecutor::run(src, &TargetLanguage::Arduino).expect("falhou Arduino alias");

        assert!(!out.code.is_empty(), "output n  o deve estar vazio");
    }

    //        Rust

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

        assert!(
            out.code.contains("fn main"),
            "c  digo Rust deve ter fn main: {}",
            out.code
        );
    }

    //        Python / MicroPython

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

        assert!(
            out.code.contains("from time import sleep_ms"),
            "c  digo Python deve ter from time import sleep_ms: {}",
            out.code
        );
    }

    #[test]

    fn e2e_micropython_alias() {
        let src = "def setup():\n    pass\n";

        let out = AslExecutor::run(src, &TargetLanguage::MicroPython).expect("falhou MicroPython");

        assert!(!out.code.is_empty());
    }

    //        ST

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

        assert!(
            out.code.contains("PROGRAM"),
            "c  digo ST deve ter PROGRAM: {}",
            out.code
        );

        assert!(
            out.code.contains("IF"),
            "c  digo ST deve ter IF: {}",
            out.code
        );
    }

    //        TargetLanguage::from_str

    #[test]

    fn target_language_from_str() {
        assert_eq!(TargetLanguage::from_str("c"), Some(TargetLanguage::C));

        assert_eq!(TargetLanguage::from_str("C++"), Some(TargetLanguage::C));

        assert_eq!(
            TargetLanguage::from_str("arduino"),
            Some(TargetLanguage::Arduino)
        );

        assert_eq!(TargetLanguage::from_str("rust"), Some(TargetLanguage::Rust));

        assert_eq!(
            TargetLanguage::from_str("python"),
            Some(TargetLanguage::Python)
        );

        assert_eq!(
            TargetLanguage::from_str("micropython"),
            Some(TargetLanguage::MicroPython)
        );

        assert_eq!(TargetLanguage::from_str("st"), Some(TargetLanguage::St));

        assert_eq!(TargetLanguage::from_str("plc"), Some(TargetLanguage::St));

        assert_eq!(TargetLanguage::from_str("il"), Some(TargetLanguage::Il));

        assert_eq!(TargetLanguage::from_str("ld"), Some(TargetLanguage::Ld));

        assert_eq!(TargetLanguage::from_str("fbd"), Some(TargetLanguage::Fbd));

        assert_eq!(TargetLanguage::from_str("sfc"), Some(TargetLanguage::Sfc));

        assert_eq!(TargetLanguage::from_str("vhdl"), None);
    }

    //        Stubs Fase 2 devolvem Err

    #[test]

    fn stubs_return_err() {
        assert!(AslExecutor::run("x", &TargetLanguage::Il).is_err());

        assert!(AslExecutor::run("x", &TargetLanguage::Ld).is_err());

        assert!(AslExecutor::run("x", &TargetLanguage::Fbd).is_err());

        assert!(AslExecutor::run("x", &TargetLanguage::Sfc).is_err());
    }
}
