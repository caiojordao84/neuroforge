//! API pública de transpilação do crate neuroforge-asl.
//!
//! Uso:
//!   use neuroforge_asl::transpile;
//!   let code = transpile(source, "c")?;
//!   let code = transpile(source, "rust")?;
//!   let code = transpile(source, "python")?;
//!   let code = transpile(source, "st")?;

use crate::executor::{AslExecutor, TargetLanguage};

/// Transpila `source` para a linguagem indicada por `lang` (case-insensitive).
/// O workflow passa sempre pela criação de uma AST unificada e omnidirecional (`AslProgram` - ASL JSON Tree).
///
/// Linguagens suportadas: `c`, `c++`, `cpp`, `arduino`, `rust`,
/// `python`, `py`, `micropython`, `upython`, `st`, `iec61131`, `plc`.
///
/// Stubs (devolvem Err): `il`, `ld`, `fbd`, `sfc`.
///
/// # Errors
/// - `"Linguagem desconhecida: ..."` se `lang` não for reconhecido.
/// - Erros de parse ou geração propagados como `String`.
pub fn transpile(source: &str, lang: &str) -> Result<String, String> {
    let target = TargetLanguage::from_str(lang)
        .ok_or_else(|| format!("Linguagem desconhecida: {lang}"))?;
    let output = AslExecutor::run(source, &target)?;
    Ok(output.code)
}

/// Transpila e devolve código + source-map como `Vec<(u32, u32)>`.
/// O source-map está disponível para C e Rust; para outras linguagens é `[]`.
pub fn transpile_with_map(
    source: &str,
    lang: &str,
) -> Result<(String, Vec<(u32, u32)>), String> {
    let target = TargetLanguage::from_str(lang)
        .ok_or_else(|| format!("Linguagem desconhecida: {lang}"))?;
    let output = AslExecutor::run(source, &target)?;
    Ok((output.code, output.source_map))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transpile_c_ok() {
        let src = "void setup() {}\nvoid loop() {}";
        let code = transpile(src, "c").expect("c falhou");
        assert!(!code.is_empty());
    }

    #[test]
    fn transpile_rust_ok() {
        let src = "fn main() { delay_ms(100); }";
        let code = transpile(src, "rust").expect("rust falhou");
        assert!(code.contains("fn main"), "{}", code);
    }

    #[test]
    fn transpile_python_ok() {
        let src = "def main():\n    pass\n";
        let code = transpile(src, "python").expect("python falhou");
        assert!(!code.is_empty());
    }

    #[test]
    fn transpile_st_ok() {
        let src = "PROGRAM P\n  VAR\n  END_VAR\nEND_PROGRAM\n";
        let code = transpile(src, "st").expect("st falhou");
        assert!(code.contains("PROGRAM"), "{}", code);
    }

    #[test]
    fn transpile_unknown_lang() {
        let err = transpile("x", "vhdl").unwrap_err();
        assert!(err.contains("desconhecida"), "{}", err);
    }

    #[test]
    fn transpile_with_map_c() {
        let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() {}";
        let (code, map) = transpile_with_map(src, "arduino").expect("arduino falhou");
        assert!(!code.is_empty());
        // source-map pode ser vazio se não houver nós com linha, mas não deve falhar
        let _ = map;
    }
}
