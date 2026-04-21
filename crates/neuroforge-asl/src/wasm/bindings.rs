//! Fase 1D - Bindings WASM para o browser.
//!
//! Funções expostas ao JavaScript via `wasm-bindgen`:
//!
//! ```js
//! import init, { wasm_transpile, wasm_transpile_with_map } from './neuroforge_asl';
//! await init();
//!
//! const python = wasm_transpile('void setup(){}', 'c', 'python');
//! const { output, source_map } = JSON.parse(
//!     wasm_transpile_with_map('void setup(){}', 'c', 'python')
//! );
//! ```

#![allow(dead_code, unused_imports)]

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Deserialize, Serialize)]
pub struct LibraryInput {
    pub name: String,
    pub source: String,
}

#[derive(Deserialize, Serialize)]
pub struct WorkspaceInput {
    pub main_source: String,
    pub libraries: Vec<LibraryInput>,
}

use crate::parser::neuro_parser::NeuroParser;

#[cfg(target_arch = "wasm32")]
use crate::transpile::{transpile, transpile_with_map};

use crate::executor::TargetLanguage;
use crate::plugins::core::{AslGenerator, GeneratorOutput};

// ============================================================================
// Helpers
// ============================================================================

/// Converte um `Result<T, String>` num `Result<T, JsValue>` para o boundary WASM.
/// `JsValue::from_str` só existe em wasm32 - esta função é compilada apenas nesse target.

#[cfg(target_arch = "wasm32")]
#[inline]
fn to_js_err(e: String) -> JsValue {
    JsValue::from_str(&e)
}

/// Detecta a linguagem fonte a partir de `from_lang` ou por heurística do código.
///
/// Se `from_lang` for válido e não for "auto", usa-o diretamente.
/// Caso contrário, analisa o código para detectar a linguagem:
/// - Python: `def `, `import `, `from ... import`, `print()`
/// - Rust: `fn `, `let mut`, `impl `, `pub fn`, `->`
/// - Arduino/C: `void setup()`, `void loop()`, `pinMode`, `digitalWrite`, `#include`
/// - ST/PLC: `PROGRAM `, `FUNCTION `, `END_FUNCTION`, `VAR `
/// - Default: Arduino/C
///
/// # Errors
///
/// Retorna erro se `from_lang` for especificado mas inválido.

#[cfg(target_arch = "wasm32")]
fn infer_source_language(source: &str, from_lang: &str) -> Result<TargetLanguage, JsValue> {
    // Se用户提供 explicit language e não é "auto", tenta usar
    if !from_lang.is_empty() && from_lang.to_lowercase() != "auto" {
        return TargetLanguage::parse(from_lang)
            .ok_or_else(|| JsValue::from_str(&format!("Unknown source language: {from_lang}")));
    }

    // Heurística de detecção por padrões sintáticos
    let src_lower = source.to_lowercase();

    // Python: def, import, from ... import, print()
    if src_lower.contains("def ")
        || src_lower.contains("import ")
        || src_lower.contains("from ") && src_lower.contains(" import")
        || src_lower.contains("print(")
    {
        return Ok(TargetLanguage::Python);
    }

    // Rust: fn , let mut, impl , pub fn, ->
    if src_lower.contains("fn ")
        || src_lower.contains("let mut")
        || src_lower.contains("impl ")
        || src_lower.contains("pub fn")
        || source.contains("->")
    {
        return Ok(TargetLanguage::Rust);
    }

    // ST/PLC: PROGRAM , FUNCTION , END_FUNCTION, VAR
    if src_lower.contains("program ")
        || src_lower.contains("function ")
        || src_lower.contains("end_function")
        || src_lower.contains("var ")
    {
        return Ok(TargetLanguage::St);
    }

    // Ladder: < LD>, <contact>, <coil>
    if source.contains("<LD>") || source.contains("<contact") || source.contains("<coil") {
        return Ok(TargetLanguage::Ld);
    }

    // Arduino/C: void setup(), void loop(), pinMode, digitalWrite, #include
    if src_lower.contains("void setup()")
        || src_lower.contains("void loop()")
        || src_lower.contains("pinmode")
        || src_lower.contains("digitalwrite")
        || src_lower.contains("digitalread")
        || src_lower.contains("analogread")
        || src_lower.contains("analogwrite")
        || src_lower.contains("#include")
    {
        return Ok(TargetLanguage::Arduino);
    }

    // Default: Arduino/C (mais comum para embedded)
    Ok(TargetLanguage::Arduino)
}

// ============================================================================
// API Pública - Existing Transpile Functions
// ============================================================================

/// Transpila `source` da linguagem `from_lang` para `to_lang`.
///
/// Linguagens aceites em `from_lang` / `to_lang`:
/// `c`, `c++`, `cpp`, `arduino`, `rust`, `python`, `py`,
/// `micropython`, `upython`, `st`, `iec61131`, `plc`, `ladder`.
///
/// Em caso de erro devolve uma `Error` JavaScript com a mensagem.
///
/// # Exemplo JS
/// ```js
/// const code = wasm_transpile('void setup(){}\nvoid loop(){}', 'c', 'python');
/// ```

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_transpile(source: &str, from_lang: &str, to_lang: &str) -> Result<String, JsValue> {
    // Deteta ou usa a linguagem fonte
    let src_lang = infer_source_language(source, from_lang)?;

    // Se fonte == destino, usa transpile simples
    let dst_lang = TargetLanguage::parse(to_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown target language: {to_lang}")))?;

    if src_lang == dst_lang {
        return transpile(source, to_lang).map_err(to_js_err);
    }

    // Cross-transpile: parse com linguagem detectada → gera com target
    let asl_program = parse_to_asl_program(source, &src_lang).map_err(to_js_err)?;

    let output = match dst_lang {
        TargetLanguage::Python | TargetLanguage::MicroPython => {
            crate::plugins::python::python_generator::PythonGenerator::new().generate(&asl_program)
        }
        TargetLanguage::St => {
            crate::plugins::plc::st_generator::StGenerator::new().generate(&asl_program)
        }
        TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
            crate::plugins::c::c_generator::CGenerator::new().generate(&asl_program)
        }
        TargetLanguage::Rust => {
            crate::plugins::rust_std::rust_generator::RustGenerator::new().generate(&asl_program)
        }
        TargetLanguage::Ld => GeneratorOutput::new(
            crate::plugins::plc::ld::generator::LdGenerator::new().generate(&asl_program),
        ),
        _ => {
            return Err(JsValue::from_str(&format!(
                "Target language '{}' not supported",
                to_lang
            )))
        }
    };

    Ok(output.code)
}

/// Transpila e devolve um objecto JSON com a forma:
/// ```json
/// { "output": "...", "source_map": [[1,1],[2,3], ...] }
/// ```
/// `source_map` é um array de pares `[linha_fonte, linha_destino]`.
/// Para linguagens que ainda não geram source-map é `[]`.
///
/// Em caso de erro devolve uma `Error` JavaScript com a mensagem.

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_transpile_with_map(
    source: &str,
    from_lang: &str,
    to_lang: &str,
) -> Result<String, JsValue> {
    // Deteta ou usa a linguagem fonte
    let src_lang = infer_source_language(source, from_lang)?;

    // Se fonte == destino, usa transpile_with_map simples
    let dst_lang = TargetLanguage::parse(to_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown target language: {to_lang}")))?;

    let (code, map) = if src_lang == dst_lang {
        // Same language - use simple transpile
        transpile_with_map(source, to_lang).map_err(to_js_err)?
    } else {
        // Cross-transpile: need to compute source map manually
        let asl_program = parse_to_asl_program(source, &src_lang).map_err(to_js_err)?;

        let output = match dst_lang {
            TargetLanguage::Python | TargetLanguage::MicroPython => {
                crate::plugins::python::python_generator::PythonGenerator::new()
                    .generate(&asl_program)
            }
            TargetLanguage::St => {
                crate::plugins::plc::st_generator::StGenerator::new().generate(&asl_program)
            }
            TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
                crate::plugins::c::c_generator::CGenerator::new().generate(&asl_program)
            }
            TargetLanguage::Rust => crate::plugins::rust_std::rust_generator::RustGenerator::new()
                .generate(&asl_program),
            TargetLanguage::Ld => GeneratorOutput::new(
                crate::plugins::plc::ld::generator::LdGenerator::new().generate(&asl_program),
            ),
            _ => {
                return Err(JsValue::from_str(&format!(
                    "Target language '{}' not supported",
                    to_lang
                )))
            }
        };

        // Cross-transpile source map not available - return empty
        (output.code, vec![])
    };

    let pairs: Vec<String> = map
        .iter()
        .map(|(src, dst)| format!("[{src},{dst}]"))
        .collect();

    let json = format!(
        "{{\"output\":{},\"source_map\":[{}]}}",
        serde_json::to_string(&code).unwrap_or_else(|_| "\"\"".to_string()),
        pairs.join(",")
    );

    Ok(json)
}

/// Transpilação cross-linguagem: parse com `from_lang`, gera com `to_lang`.
/// Diferente de `wasm_transpile` que ignora `from_lang`, esta função
/// usa o parser correcto para a linguagem fonte e o generator correcto
/// para a linguagem destino.
/// Pipeline: source -> (from_lang parser) -> AslProgram -> (to_lang generator) -> código

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_cross_transpile(
    source: &str,
    from_lang: &str,
    to_lang: &str,
) -> Result<String, JsValue> {
    // 1. Resolve linguagens
    let src_target = TargetLanguage::parse(from_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown source language: {from_lang}")))?;

    let dst_target = TargetLanguage::parse(to_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown target language: {to_lang}")))?;

    // 2. Se fonte == destino, usar o pipeline normal
    if src_target == dst_target {
        return crate::transpile::transpile(source, to_lang).map_err(to_js_err);
    }

    // 3. Parse source -> AslProgram (usando parser da lang fonte)
    let asl_program = parse_to_asl_program(source, &src_target).map_err(to_js_err)?;

    // 4. Generate de AslProgram -> código na lang destino
    let output = match dst_target {
        TargetLanguage::Python | TargetLanguage::MicroPython => {
            crate::plugins::python::python_generator::PythonGenerator::new().generate(&asl_program)
        }

        TargetLanguage::St => {
            crate::plugins::plc::st_generator::StGenerator::new().generate(&asl_program)
        }

        TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
            crate::plugins::c::c_generator::CGenerator::new().generate(&asl_program)
        }

        TargetLanguage::Rust => {
            crate::plugins::rust_std::rust_generator::RustGenerator::new().generate(&asl_program)
        }

        TargetLanguage::Ld => {
            // Ladder Diagram - generate PLCopen XML (String -> GeneratorOutput)
            GeneratorOutput::new(
                crate::plugins::plc::ld::generator::LdGenerator::new().generate(&asl_program),
            )
        }

        _ => {
            return Err(JsValue::from_str(&format!(
                "Target language '{}' not supported for cross-transpilation",
                to_lang
            )))
        }
    };

    Ok(output.code)
}

/// Transpilação multi-ficheiro (VFS) com AST Linker.
/// Recebe um JSON WorkspaceInput e gera o ficheiro final compilado.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_cross_transpile_workspace(
    workspace_json: &str,
    from_lang: &str,
    to_lang: &str,
) -> Result<String, JsValue> {
    let src_target = TargetLanguage::parse(from_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown source language: {from_lang}")))?;
    let dst_target = TargetLanguage::parse(to_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown target language: {to_lang}")))?;

    let asl_program =
        parse_workspace_to_asl_program(workspace_json, &src_target).map_err(to_js_err)?;

    let output = match dst_target {
        TargetLanguage::Python | TargetLanguage::MicroPython => {
            crate::plugins::python::python_generator::PythonGenerator::new().generate(&asl_program)
        }
        TargetLanguage::St => {
            crate::plugins::plc::st_generator::StGenerator::new().generate(&asl_program)
        }
        TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
            crate::plugins::c::c_generator::CGenerator::new().generate(&asl_program)
        }
        TargetLanguage::Rust => {
            crate::plugins::rust_std::rust_generator::RustGenerator::new().generate(&asl_program)
        }
        TargetLanguage::Ld => GeneratorOutput::new(
            crate::plugins::plc::ld::generator::LdGenerator::new().generate(&asl_program),
        ),
        _ => {
            return Err(JsValue::from_str(&format!(
                "Target language '{}' not supported for cross-transpilation",
                to_lang
            )))
        }
    };

    Ok(output.code)
}

/// Devolve a versão do crate como string, útil para diagnóstico.
/// Disponível em todos os targets (não usa JsValue).

#[wasm_bindgen]
pub fn wasm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Devolve as linguagens suportadas separadas por vírgula.
/// Disponível em todos os targets (não usa JsValue).

#[wasm_bindgen]
pub fn wasm_supported_langs() -> String {
    "c,c++,cpp,arduino,rust,python,py,micropython,upython,st,iec61131".to_string()
}

// ============================================================================
// Ladder-specific WASM API (P1.5)
// ============================================================================

/// Parse Ladder Diagram (XML) and convert to ASL Program
/// Input: PLCopen XML format
/// Output: ASL Program JSON

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_ld_to_asl(xml_source: &str) -> Result<String, JsValue> {
    use crate::plugins::plc::ld::parser::LdParser;

    let program = LdParser::parse(xml_source).map_err(|e| to_js_err(e.to_string()))?;

    serde_json::to_string(&program).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Parse ASL Program and generate Ladder Diagram (PLCopen XML)
/// Input: ASL Program JSON
/// Output: PLCopen XML

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_asl_to_ld(asl_json: &str) -> Result<String, JsValue> {
    use crate::plugins::plc::ld::generator::LdGenerator;

    let program: crate::types::asl_types::AslProgram = serde_json::from_str(asl_json)
        .map_err(|e| JsValue::from_str(&format!("Invalid ASL JSON: {}", e)))?;

    let output = LdGenerator::new().generate(&program);

    Ok(output)
}

/// Parse ST (Structured Text) and convert to Ladder Diagram
/// Input: ST source code
/// Output: PLCopen XML

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_st_to_ld(st_source: &str) -> Result<String, JsValue> {
    // Parse ST to ASL
    let program = crate::plugins::plc::st_parser::StParser::parse(st_source)
        .map_err(|e| to_js_err(e.to_string()))?;

    // Generate LD from ASL
    use crate::plugins::plc::ld::generator::LdGenerator;
    let output = LdGenerator::new().generate(&program);

    Ok(output)
}

/// Cross-transpile to Ladder Diagram
/// Parse from any supported language and generate Ladder XML

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_to_ld(source: &str, from_lang: &str) -> Result<String, JsValue> {
    let src_target = TargetLanguage::parse(from_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown source language: {from_lang}")))?;

    // Parse source to ASL Program
    let asl_program = parse_to_asl_program(source, &src_target).map_err(to_js_err)?;

    // Generate Ladder Diagram
    use crate::plugins::plc::ld::generator::LdGenerator;
    let output = LdGenerator::new().generate(&asl_program);

    Ok(output)
}

/// Validate Ladder Diagram and return diagnostics
/// Input: PLCopen XML
/// Output: JSON array of diagnostics

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_validate_ld(xml_source: &str) -> Result<String, JsValue> {
    use crate::plugins::plc::ld::parser::LdParser;

    // Parse to check for validation errors
    match LdParser::parse(xml_source) {
        Ok(_) => Ok("[]".to_string()),
        Err(e) => {
            let diag = serde_json::json!([
                {
                    "severity": "error",
                    "context": "ld_parser",
                    "message": e.to_string()
                }
            ]);
            Ok(diag.to_string())
        }
    }
}

// ============================================================================
// Analysis Functions
// ============================================================================

/// Verifica tipos no código fonte e devolve JSON com lista de diagnósticos.
/// Formato de retorno:
/// ```json
/// [{"severity":"error","context":"fn_name","message":"..."}]
/// ```

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_check_types(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let _prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;

    // Type checking not yet implemented - return empty diagnostics
    Ok("[]".to_string())
}

/// Devolve diagnóstivos completos (type + scope) em JSON.

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_get_diagnostics(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let _prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;

    // Full diagnostics not yet implemented - return empty list
    Ok("[]".to_string())
}

/// Converte o código fonte para ASL IR em JSON (dev mode / debug no editor).

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_to_asl(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;

    serde_json::to_string(&prog).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Converte o código fonte para ASL IR em formato TOON (human-readable).
/// Usa `serde_toon` para serialização determinística e legível.

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_to_toon(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;

    use crate::plugins::core::toon_generator::ToonGenerator;
    let mut gen = ToonGenerator::new();
    Ok(gen.generate_to_string(&prog))
}

/// Parse VFS workspace to ASL IR JSON.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_workspace_to_asl(workspace_json: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let prog = parse_workspace_to_asl_program(workspace_json, &target).map_err(to_js_err)?;
    serde_json::to_string(&prog).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Parse VFS workspace to TOON format.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_workspace_to_toon(workspace_json: &str, lang: &str) -> Result<String, JsValue> {
    let target = TargetLanguage::parse(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;

    let prog = parse_workspace_to_asl_program(workspace_json, &target).map_err(to_js_err)?;
    use crate::plugins::core::toon_generator::ToonGenerator;
    let mut gen = ToonGenerator::new();
    Ok(gen.generate_to_string(&prog))
}

/// Converte uma BoardProfile em formato TOON para JSON.
/// Útil para o frontend ler ficheiros .toon e processá-los como objectos JS.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_toon_to_json(toon_content: &str) -> Result<String, JsValue> {
    use crate::asl_types::board::board_profile::BoardProfile;

    let profile = BoardProfile::from_toon_str(toon_content)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse TOON: {}", e)))?;

    serde_json::to_string(&profile)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize to JSON: {}", e)))
}

// ============================================================================
// Internal Helpers
// ============================================================================

/// Faz parse do source para AslProgram usando o parser correcto para o lang.
/// Mapeamento confirmado:
///   C | Cpp | Arduino -> CParser::parse() -> ProgramNode -> ast_to_asl(&prog, Language::Cpp)
///   Rust -> RustParser::parse() -> ProgramNode -> ast_to_asl(&prog, Language::Rust)
///   Python | MicroPython -> PythonParser::parse() -> AslProgram directamente
///   St -> StParser::parse() -> AslProgram directamente
///   Ld -> LdParser::parse() -> AslProgram directamente

fn parse_to_asl_program(
    source: &str,
    target: &crate::executor::TargetLanguage,
) -> Result<crate::asl_types::AslProgram, String> {
    use crate::executor::TargetLanguage::*;

    use crate::transforms::context::Language;

    match target {
        C | Cpp | Arduino => {
            crate::plugins::c::c_parser::CParser::parse(source).map_err(|e| format!("CParser: {e}"))
        }

        Rust => crate::plugins::rust_std::rust_parser::RustParser::parse(source)
            .map_err(|e| format!("RustParser: {e}")),

        Python | MicroPython => {
            // PythonParser::parse() já devolve AslProgram
            crate::plugins::python::python_parser::PythonParser::parse(source)
                .map_err(|e| format!("PythonParser: {e}"))
        }

        St => {
            // StParser::parse() já devolve AslProgram
            crate::plugins::plc::st_parser::StParser::parse(source)
                .map_err(|e| format!("StParser: {e}"))
        }

        Ld => {
            // Ladder Parser returns AslProgram
            crate::plugins::plc::ld::parser::LdParser::parse(source)
                .map_err(|e| format!("LdParser: {e}"))
        }

        _ => Err(format!(
            "parse_to_asl_program: linguagem {target:?} não suportada em análise"
        )),
    }
}

/// Parses a full VFS workspace (JSON) into a single linked ASL Program.
fn parse_workspace_to_asl_program(
    workspace_json: &str,
    target: &crate::executor::TargetLanguage,
) -> Result<crate::asl_types::AslProgram, String> {
    let input: WorkspaceInput = serde_json::from_str(workspace_json)
        .map_err(|e| format!("Invalid JSON workspace: {}", e))?;

    // Parse main source
    let mut main_program = parse_to_asl_program(&input.main_source, target)?;

    // Parse libraries
    let mut lib_programs = Vec::new();
    for lib in input.libraries {
        match parse_to_asl_program(&lib.source, target) {
            Ok(prog) => lib_programs.push(prog),
            // Attribute error to specific library file
            Err(e) => return Err(format!("Error in '{}': {}", lib.name, e)),
        }
    }

    // Link libraries into the main ASL graph
    main_program.link(lib_programs);

    Ok(main_program)
}

fn diags_to_json(_diags: &[serde_json::Value]) -> String {
    "[]".to_string()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_not_empty() {
        assert!(!wasm_version().is_empty());
    }

    #[test]
    fn supported_langs_contains_rust() {
        assert!(wasm_supported_langs().contains("rust"));
    }

    #[test]
    fn supported_langs_contains_st() {
        assert!(wasm_supported_langs().contains("st"));
    }

    #[cfg(target_arch = "wasm32")]
    use wasm_bindgen_test::wasm_bindgen_test;

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn transpile_c_to_python() {
        let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }";

        let result = wasm_transpile(src, "c", "python");

        assert!(result.is_ok(), "{:?}", result);

        assert!(!result.unwrap().is_empty());
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn transpile_with_map_returns_json() {
        let src = "void setup() {}\nvoid loop() {}";

        let result = wasm_transpile_with_map(src, "c", "c");

        assert!(result.is_ok(), "{:?}", result);

        let json = result.unwrap();

        assert!(json.contains("output"), "{}", json);

        assert!(json.contains("source_map"), "{}", json);
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn transpile_unknown_lang_returns_err() {
        let result = wasm_transpile("x", "c", "vhdl");

        assert!(result.is_err());
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn cross_transpile_c_to_python_returns_valid() {
        let src = "void setup() { }\nvoid loop() { digitalWrite(13, HIGH); }";

        let result = wasm_cross_transpile(src, "cpp", "python");

        assert!(result.is_ok(), "{:?}", result);

        let code = result.unwrap();

        assert!(code.contains("def loop():"));

        assert!(code.contains("digitalWrite(13, HIGH)"));
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn cross_transpile_rust_to_st_returns_valid() {
        let src = "fn setup() {}\nfn loop() { digitalRead(11); }";

        let result = wasm_cross_transpile(src, "rust", "st");

        assert!(result.is_ok(), "{:?}", result);

        let code = result.unwrap();

        assert!(code.contains("PROGRAM main"));

        assert!(code.contains("digitalRead"));
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn parse_to_asl_returns_serializeable_json() {
        let src = "void setup() { delay(100); }\nvoid loop() { }";

        let result = wasm_parse_to_asl(src, "cpp");

        assert!(result.is_ok(), "{:?}", result);

        let json = result.unwrap();

        assert!(json.starts_with('{'));

        assert!(json.contains("\"asl_version\":\"4.0.0\""));

        assert!(json.contains("\"tasks\":"));

        assert!(json.contains("\"delay\""));
    }

    #[test]
    fn test_parse_workspace_merges_functions() {
        let input = WorkspaceInput {
            main_source: "void setup() { my_lib_func(); }\nvoid loop(){}".to_string(),
            libraries: vec![LibraryInput {
                name: "mylib.cpp".to_string(),
                source: "void my_lib_func() { delay(10); }".to_string(),
            }],
        };
        let target = crate::executor::TargetLanguage::Cpp;
        let json = serde_json::to_string(&input).unwrap();

        let result = parse_workspace_to_asl_program(&json, &target);
        assert!(result.is_ok(), "Error: {:?}", result.err());

        let prog = result.unwrap();
        // Should have tasks from main and function merged from library
        assert!(
            prog.functions.iter().any(|f| f.name == "my_lib_func"),
            "my_lib_func not found in merged program"
        );
        assert!(
            prog.tasks.iter().any(|t| t.name == "setup"),
            "setup task not found"
        );

        // Verify body of my_lib_func contains the delay
        let lib_func = prog
            .functions
            .iter()
            .find(|f| f.name == "my_lib_func")
            .unwrap();
        assert!(
            !lib_func.body.is_empty(),
            "my_lib_func body should not be empty"
        );
    }
}
