//! Fase 1D — Bindings WASM para o browser.
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

use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use crate::transpile::{transpile, transpile_with_map};


// ─── helpers ──────────────────────────────────────────────────────────────────

/// Converte um `Result<T, String>` num `Result<T, JsValue>` para o boundary WASM.
/// `JsValue::from_str` só existe em wasm32 — esta função é compilada apenas nesse target.
#[cfg(target_arch = "wasm32")]
#[inline]
fn to_js_err(e: String) -> JsValue {
    JsValue::from_str(&e)
}

// ─── API pública ──────────────────────────────────────────────────────────────

/// Transpila `source` da linguagem `from_lang` para `to_lang`.
///
/// Linguagens aceites em `from_lang` / `to_lang`:
/// `c`, `c++`, `cpp`, `arduino`, `rust`, `python`, `py`,
/// `micropython`, `upython`, `st`, `iec61131`, `plc`.
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
    let _ = from_lang; // reservado para futura detecção explícita da língua fonte
    transpile(source, to_lang).map_err(to_js_err)
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
    let _ = from_lang;

    let (code, map) = transpile_with_map(source, to_lang).map_err(to_js_err)?;

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
///
/// Diferente de `wasm_transpile` que ignora `from_lang`, esta função
/// usa o parser correcto para a linguagem fonte e o generator correcto
/// para a linguagem destino.
///
/// Pipeline: source →(from_lang parser)→ AslProgram →(to_lang generator)→ código
///
/// Suporta todas as combinações onde o target tem AslGenerator:
///   - Python, MicroPython, ST, PLC (aceitam AslProgram directamente)
///   - C/C++/Arduino, Rust (via conversão AslProgram → BaseNode interna)
///
/// # Exemplo JS
/// ```js
/// const python = wasm_cross_transpile(cCode, 'cpp', 'python');
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_cross_transpile(
    source: &str,
    from_lang: &str,
    to_lang: &str,
) -> Result<String, JsValue> {
    use crate::executor::TargetLanguage;
    use crate::plugins::core::AslGenerator;

    // 1. Resolve linguagens
    let src_target = TargetLanguage::from_str(from_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown source language: {from_lang}")))?;
    let dst_target = TargetLanguage::from_str(to_lang)
        .ok_or_else(|| JsValue::from_str(&format!("Unknown target language: {to_lang}")))?;

    // 2. Se fonte == destino, usar o pipeline normal
    if src_target == dst_target {
        return crate::transpile::transpile(source, to_lang)
            .map_err(to_js_err);
    }

    // 3. Parse source → AslProgram (usando parser da lang fonte)
    let asl_program = parse_to_asl_program(source, &src_target).map_err(to_js_err)?;

    // 4. Generate de AslProgram → código na lang destino
    let output = match dst_target {
        TargetLanguage::Python | TargetLanguage::MicroPython => {
            crate::plugins::python::python_generator::PythonGenerator::new()
                .generate(&asl_program)
        }
        TargetLanguage::St => {
            crate::plugins::plc::st_generator::StGenerator::new()
                .generate(&asl_program)
        }
        TargetLanguage::C | TargetLanguage::Cpp | TargetLanguage::Arduino => {
            crate::plugins::c::c_generator::CGenerator::new()
                .generate(&asl_program)
        }
        TargetLanguage::Rust => {
            crate::plugins::rust_std::rust_generator::RustGenerator::new()
                .generate(&asl_program)
        }
        _ => return Err(JsValue::from_str(&format!(
            "Target language '{}' not supported for cross-transpilation",
            to_lang
        ))),
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
    "c,c++,cpp,arduino,rust,python,py,micropython,upython,st,iec61131,plc".to_string()
}


// ═══════════════════════════════════════════════════════════════════════════════
// Funções de análise WASM — adicionadas na Fase 1C
// ═══════════════════════════════════════════════════════════════════════════════

/// Verifica tipos no código fonte e devolve JSON com lista de diagnósticos.
///
/// Formato de retorno:
/// ```json
/// [{"severity":"error","context":"fn_name","message":"..."}]
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_check_types(source: &str, lang: &str) -> Result<String, JsValue> {
    use crate::analysis::check_types;
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    Ok(diags_to_json(&check_types(&prog)))
}

/// Devolve diagnósticos completos (type + scope) em JSON.
///
/// Formato de retorno:
/// ```json
/// [{"severity":"warning","context":"fn_name","message":"..."}]
/// ```
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_get_diagnostics(source: &str, lang: &str) -> Result<String, JsValue> {
    use crate::analysis::{check_types, check_variable_scope};
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    let mut diags = check_types(&prog);
    diags.extend(check_variable_scope(&prog));
    Ok(diags_to_json(&diags))
}

/// Converte o código fonte para ASL IR em JSON (dev mode / debug no editor).
///
/// Formato de retorno: JSON serializado de `AslProgram`.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn wasm_parse_to_asl(source: &str, lang: &str) -> Result<String, JsValue> {
    let target = crate::executor::TargetLanguage::from_str(lang)
        .ok_or_else(|| JsValue::from_str(&format!("Linguagem desconhecida: {lang}")))?;
    let prog = parse_to_asl_program(source, &target).map_err(to_js_err)?;
    serde_json::to_string(&prog).map_err(|e| JsValue::from_str(&e.to_string()))
}

// ── helpers internos ──────────────────────────────────────────────────────────

/// Faz parse do source para AslProgram usando o parser correcto para o lang.
///
/// Mapeamento confirmado:
///   C | Cpp | Arduino → CParser::parse() → ProgramNode → ast_to_asl(&prog, Language::Cpp)
///   Rust               → RustParser::parse() → ProgramNode → ast_to_asl(&prog, Language::Rust)
///   Python | MicroPython → PythonParser::parse() → AslProgram directamente
///   St                 → StParser::parse() → AslProgram directamente
fn parse_to_asl_program(
    source: &str,
    target: &crate::executor::TargetLanguage,
) -> Result<crate::types::asl_types::AslProgram, String> {
    use crate::executor::TargetLanguage::*;
    use crate::transforms::code_to_asl::ast_to_asl;
    use crate::transforms::context::Language;
    use crate::types::nodes_to_typed::nodes_to_typed;

    match target {
        C | Cpp | Arduino => {
            let prog = crate::plugins::c::c_parser::CParser::parse(source)
                .map_err(|e| format!("CParser: {e}"))?;
            let typed = nodes_to_typed(&prog);
            Ok(ast_to_asl(&typed, Language::Cpp))
        }
        Rust => {
            let prog = crate::plugins::rust_std::rust_parser::RustParser::parse(source)
                .map_err(|e| format!("RustParser: {e}"))?;
            let typed = nodes_to_typed(&prog);
            Ok(ast_to_asl(&typed, Language::Rust))
        }
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
        _ => Err(format!(
            "parse_to_asl_program: linguagem {target:?} não suportada em análise"
        )),
    }
}

fn diags_to_json(diags: &[crate::analysis::Diagnostic]) -> String {
    let items: Vec<String> = diags.iter().map(|d| {
        format!(
            "{{\"severity\":{},\"context\":{},\"message\":{}}}",
            serde_json::to_string(d.severity).unwrap_or_default(),
            serde_json::to_string(&d.context).unwrap_or_default(),
            serde_json::to_string(&d.message).unwrap_or_default(),
        )
    }).collect();
    format!("[{}]", items.join(","))
}

// ─── Testes ───────────────────────────────────────────────────────────────────

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

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen_test]
    fn cross_transpile_c_to_rust_works() {
        let src = "void setup() {}\nvoid loop(){ digitalWrite(13, HIGH); }";
        let result = wasm_cross_transpile(src, "cpp", "rust");
        assert!(result.is_ok(), "{:?}", result);
        let code = result.unwrap();
        assert!(code.contains("gpio_set"));
    }
}
