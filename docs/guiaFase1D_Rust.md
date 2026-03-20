# Guia da Fase 1D — NeuroForge Rust

**Objectivo único:** criar o directório `tests/` com três ficheiros de integração que satisfazem os critérios de saída da Fase 1. O CI já está correcto e não precisa de alterações. 

***

## Estado confirmado no GitHub

| Item | Estado | Ref |
|---|---|---|
| `tests/` directory | ❌ **Não existe** |  |
| `transpile::transpile(src, lang)` | ✅ API pública disponível |  |
| `transforms::code_to_asl::ast_to_asl(program, lang)` | ✅ Disponível |  |
| `schema::migration::migrate_nfv(raw)` — v3→v4 e passthrough | ✅ Testados inline, faltam v1→v4 e v2→v4 externos |  |
| `AslProgram` struct — campos reais: `.tasks: Vec<AslTask>`, `.asl_version` | ✅ Confirmado |  |
| `AslStatement` — enum com variantes `PinMode`, `Delay`, `SerialBegin`, `While`... | ✅ Confirmado |  |
| `plugins::c::{CParser, CGenerator}` | ✅ `pub use` no `mod.rs` |  |
| `plugins::python::python_parser::PythonParser` | ✅ Existe mas **sem `pub use`** no `mod.rs` |  |
| `plugins::rust_std::{RustParser, RustGenerator}` | ✅ `pub use` no `mod.rs` |  |
| CI: `cargo test -p neuroforge-asl` + WASM build + size check | ✅ Já configurado |  |

***

## Antes de criar os testes: um fix necessário

O `plugins/python/mod.rs` não exporta `PythonParser` publicamente.  Actualiza o ficheiro antes de escrever os testes, caso contrário o `use` vai falhar com erro de visibilidade:

```rust
// crates/neuroforge-asl/src/plugins/python/mod.rs
pub mod python_parser;
pub mod python_generator;
pub use python_parser::PythonParser;
pub use python_generator::PythonGenerator;
```

***

## Estrutura a criar

```
crates/neuroforge-asl/
└── tests/
    ├── roundtrip_pipeline1.rs
    ├── roundtrip_pipeline2.rs
    └── schema_migration.rs
```

***

## `tests/roundtrip_pipeline1.rs`

Testa a Pipeline 1: código fonte → parser → normalizer → `ast_to_asl` → `AslProgram`. As asserções usam os tipos reais do enum `AslStatement`. 

```rust
use neuroforge_asl::{
    plugins::c::CParser,
    plugins::python::PythonParser,
    transforms::{
        ast_normalizer::normalize,
        code_to_asl::ast_to_asl,
        context::Language,
    },
    types::asl_types::AslStatement,
};

fn all_stmts(asl: &neuroforge_asl::types::asl_types::AslProgram) -> Vec<&AslStatement> {
    asl.tasks.iter().flat_map(|t| t.body.iter())
        .chain(asl.functions.iter().flat_map(|f| f.body.iter()))
        .collect()
}

// ── C / Arduino ───────────────────────────────────────────────────────────────

#[test]
fn c_blink_pipeline1_pinmode_and_delay() {
    let src = r#"
void setup() { pinMode(13, OUTPUT); }
void loop()  { digitalWrite(13, HIGH); delay(500); }
"#;
    let asl = ast_to_asl(&normalize(CParser::parse(src).unwrap()), Language::Cpp);

    assert_eq!(asl.asl_version, "4.0.0");
    assert!(asl.tasks.len() >= 1);

    let stmts = all_stmts(&asl);
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::PinMode(_))),
        "PinMode ausente: {stmts:?}");
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::Delay(_))),
        "Delay ausente");
}

#[test]
fn c_serial_begin_and_print() {
    let src = r#"
void setup() { Serial.begin(9600); }
void loop()  { Serial.println("ok"); }
"#;
    let asl = ast_to_asl(&normalize(CParser::parse(src).unwrap()), Language::Cpp);
    let stmts = all_stmts(&asl);
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::SerialBegin(_))));
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::Print(_))));
}

#[test]
fn c_empty_program_valid_asl() {
    let src = "void setup() {} void loop() {}";
    let asl = ast_to_asl(&normalize(CParser::parse(src).unwrap()), Language::Cpp);
    assert_eq!(asl.asl_version, "4.0.0");
    assert!(asl.tasks.len() >= 1);
}

// ── Python / MicroPython ──────────────────────────────────────────────────────

#[test]
fn python_blink_pipeline1_pinmode_and_delay() {
    let src = r#"
def setup():
    gpio_mode(13, 1)

def loop():
    gpio_set(13, 1)
    delay_ms(500)
    gpio_set(13, 0)
    delay_ms(500)
"#;
    let asl = ast_to_asl(
        &normalize(PythonParser::parse(src).unwrap()),
        Language::Python,
    );
    let stmts = all_stmts(&asl);
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::PinMode(_))));
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::Delay(_))));
}

#[test]
fn python_while_loop_in_asl() {
    let src = "def loop():\n    while True:\n        delay_ms(100)\n";
    let asl = ast_to_asl(&normalize(PythonParser::parse(src).unwrap()), Language::Python);
    let stmts = all_stmts(&asl);
    assert!(stmts.iter().any(|s| matches!(s, AslStatement::While(_))));
}
```

***

## `tests/roundtrip_pipeline2.rs`

Testa a Pipeline 2 via `transpile()`. As asserções são sobre a **forma** do output — não simulação semântica. 

```rust
use neuroforge_asl::transpile::{transpile, transpile_with_map};

// ── C → Rust ──────────────────────────────────────────────────────────────────

#[test]
fn c_to_rust_has_fn_or_entry() {
    let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() { delay(500); }";
    let out = transpile(src, "rust").expect("C→Rust falhou");
    assert!(out.contains("fn "), "output Rust sem 'fn': {out}");
}

#[test]
fn c_to_rust_delay_present() {
    let src = "void loop() { delay(1000); }";
    let out = transpile(src, "rust").expect("falhou");
    assert!(out.contains("delay"), "delay ausente no output Rust: {out}");
}

// ── C → Python ────────────────────────────────────────────────────────────────

#[test]
fn c_to_python_has_def() {
    let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() {}";
    let out = transpile(src, "python").expect("C→Python falhou");
    assert!(out.contains("def "), "output Python sem 'def': {out}");
}

// ── Python → C ────────────────────────────────────────────────────────────────

#[test]
fn python_to_c_has_void_or_setup() {
    let src = "def setup():\n    gpio_mode(13, 1)\ndef loop():\n    pass\n";
    let out = transpile(src, "c").expect("Python→C falhou");
    assert!(out.contains("void") || out.contains("setup"),
        "output C sem void/setup: {out}");
}

// ── C → ST ────────────────────────────────────────────────────────────────────

#[test]
fn c_to_st_has_program_keyword() {
    let src = "void setup() {}\nvoid loop() {}";
    let out = transpile(src, "st").expect("C→ST falhou");
    assert!(out.contains("PROGRAM"), "output ST sem PROGRAM: {out}");
}

// ── Linguagem desconhecida ─────────────────────────────────────────────────────

#[test]
fn unknown_lang_returns_err() {
    let err = transpile("fn main() {}", "vhdl").unwrap_err();
    assert!(err.contains("desconhecida"), "mensagem inesperada: {err}");
}

// ── transpile_with_map não panics ─────────────────────────────────────────────

#[test]
fn transpile_with_map_does_not_panic() {
    let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() {}";
    let (code, _map) = transpile_with_map(src, "arduino").expect("falhou");
    assert!(!code.is_empty());
}
```

***

## `tests/schema_migration.rs`

Os caminhos v3→v4 e passthrough v4 já estão cobertos inline em `migration.rs`.  Estes testes cobrem os caminhos que **faltam**: v1→v4, v2→v4, e JSON inválido.

```rust
use neuroforge_asl::schema::migration::migrate_nfv;

fn v1_json() -> &'static str {
    r#"{
        "schema_version": "1.0.0",
        "name": "Projecto Legado v1",
        "target_board": "arduino-uno",
        "nodes": [],
        "edges": []
    }"#
}

fn v2_json() -> &'static str {
    r#"{
        "schema_version": "2.0.0",
        "name": "Projecto v2",
        "target_board": "esp32-devkit",
        "target_language": "cpp",
        "nodes": [],
        "edges": []
    }"#
}

#[test]
fn migrate_v1_full_chain_to_v4() {
    let nfv = migrate_nfv(v1_json())
        .expect("migração v1→v4 falhou");
    assert_eq!(nfv.schema_version, "4.0.0");
    assert_eq!(nfv.asl_version,    "4.0.0");
    assert!(!nfv.project_id.is_empty(), "project_id não foi gerado");
}

#[test]
fn migrate_v2_to_v4() {
    let nfv = migrate_nfv(v2_json())
        .expect("migração v2→v4 falhou");
    assert_eq!(nfv.schema_version, "4.0.0");
    assert!(!nfv.project_id.is_empty());
}

#[test]
fn migrate_unknown_version_is_err() {
    let bad = r#"{"schema_version": "99.0.0", "nodes": [], "edges": []}"#;
    let err = migrate_nfv(bad).unwrap_err();
    assert!(err.to_string().contains("99.0.0"), "erro inesperado: {err}");
}

#[test]
fn migrate_malformed_json_is_err() {
    let err = migrate_nfv("{ isto não é json }").unwrap_err();
    let msg = err.to_string();
    assert!(
        msg.contains("deserialização") || msg.contains("expected"),
        "mensagem inesperada: {msg}"
    );
}
```

***

## Checklist de saída da Fase 1

- [ ] Fix ao `plugins/python/mod.rs` — adicionar `pub use python_parser::PythonParser`
- [ ] Criar `tests/roundtrip_pipeline1.rs`
- [ ] Criar `tests/roundtrip_pipeline2.rs`
- [ ] Criar `tests/schema_migration.rs`
- [ ] `cargo test -p neuroforge-asl` — zero falhas nos 3 sistemas (Ubuntu / Windows / macOS)
- [ ] `cargo clippy --workspace -- -D warnings` — zero warnings
- [ ] CI job `wasm` passa: `wasm-pack build --target web` + bundle ≤ 2 MB