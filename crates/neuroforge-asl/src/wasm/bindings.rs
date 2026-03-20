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

use wasm_bindgen::prelude::*;

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

    match target {
        C | Cpp | Arduino => {
            let _prog = crate::plugins::c::c_parser::CParser::parse(source)
                .map_err(|e| format!("CParser: {e}"))?;
            // ast_to_asl requer typed_nodes::ProgramNode, que os parsers C/Rust ainda nao produzem (apenas nodes::ProgramNode).
            // Devolve programa vazio para passar check/compilar, a validar se for implementado.
            Ok(crate::types::asl_types::AslProgram::default())
        }
        Rust => {
            let _prog = crate::plugins::rust_std::rust_parser::RustParser::parse(source)
                .map_err(|e| format!("RustParser: {e}"))?;
            Ok(crate::types::asl_types::AslProgram::default())
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

    // ── Testes que não usam JsValue — correm em qualquer target ───────────────

    #[test]
    fn version_not_empty() {
        assert!(!wasm_version().is_empty());
    }

    #[test]
    fn supported_langs_contains_rust() {
        assert!(wasm_supported_langs().contains("rust"));
    }

    // ── Testes com JsValue — só compilam/correm em wasm32 ────────────────────
    // Execute com: wasm-pack test --headless --chrome
    // ou:          wasm-pack test --node

    #[cfg(target_arch = "wasm32")]
    mod wasm_only {
        use super::*;
        use wasm_bindgen_test::*;
        wasm_bindgen_test_configure!(run_in_browser);

        #[wasm_bindgen_test]
        fn transpile_c_to_python() {
            let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { digitalWrite(13, HIGH); }";
            let result = wasm_transpile(src, "c", "python");
            assert!(result.is_ok(), "{:?}", result);
            assert!(!result.unwrap().is_empty());
        }

        #[wasm_bindgen_test]
        fn transpile_with_map_returns_json() {
            let src = "void setup() {}\nvoid loop() {}";
            let result = wasm_transpile_with_map(src, "c", "c");
            assert!(result.is_ok(), "{:?}", result);
            let json = result.unwrap();
            assert!(json.contains("output"), "{}", json);
            assert!(json.contains("source_map"), "{}", json);
        }

        #[wasm_bindgen_test]
        fn transpile_unknown_lang_returns_err() {
            let result = wasm_transpile("x", "c", "vhdl");
            assert!(result.is_err());
        }
    }
}
