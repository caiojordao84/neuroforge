use neuroforge_asl::transpile::{transpile, transpile_with_map};

// The transpile() API parses `source` as the target `lang` language,
// then regenerates code in that same language.
// Real cross-language transpilation (C→Python, Python→C) requires the full
// Pipeline 2: source parser → AslProgram → target generator.
// These tests cover what the API actually does today.

// ── C roundtrip ────────────────────────────────────────────────────────────────

#[test]
fn c_roundtrip_has_setup() {
    let src = r#"
void setup() {
    pinMode(13, OUTPUT);
}
void loop() {
    digitalWrite(13, HIGH);
    delay(500);
}
"#;
    let out = transpile(src, "c").expect("C roundtrip falhou");
    assert!(
        out.contains("setup") || out.contains("pinMode"),
        "output C sem setup/pinMode: {out}"
    );
}

#[test]
fn c_roundtrip_void_main() {
    let src = "void setup() {}\nvoid loop() {}";
    let out = transpile(src, "c").expect("C roundtrip falhou");
    assert!(!out.is_empty(), "output não pode ser vazio");
}

// ── Python roundtrip ───────────────────────────────────────────────────────────

#[test]
fn python_roundtrip_has_def() {
    let src = r#"
import machine
import utime

def setup():
    pass

def loop():
    utime.sleep_ms(500)
"#;
    let out = transpile(src, "python").expect("Python roundtrip falhou");
    assert!(
        out.contains("sleep_ms"),
        "output Python sem sleep_ms: {out}"
    );
}

#[test]
fn python_roundtrip_has_while() {
    let src = "import utime\n\ndef loop():\n    while True:\n        utime.sleep_ms(100)\n";
    let out = transpile(src, "python").expect("Python roundtrip falhou");
    assert!(out.contains("while"), "output Python sem while: {out}");
}

// ── Rust roundtrip ─────────────────────────────────────────────────────────────

#[test]
fn rust_roundtrip_has_fn() {
    let src = r#"
fn main() {
    gpio_mode(13, 1);
    loop {
        gpio_set(13, 1);
        delay_ms(500);
    }
}
"#;
    let out = transpile(src, "rust").expect("Rust roundtrip falhou");
    assert!(out.contains("fn main"), "output Rust sem 'fn main': {out}");
}

// ── ST roundtrip ──────────────────────────────────────────────────────────────

#[test]
fn st_roundtrip_has_program() {
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
    let out = transpile(src, "st").expect("ST roundtrip falhou");
    assert!(out.contains("PROGRAM"), "output ST sem PROGRAM: {out}");
    assert!(out.contains("IF"), "output ST sem IF: {out}");
}

// ── Linguagem desconhecida ─────────────────────────────────────────────────────

#[test]
fn unknown_lang_returns_err() {
    let err = transpile("fn main() {}", "vhdl").unwrap_err();
    assert!(err.contains("desconhecida"), "mensagem inesperada: {err}");
}

// ── transpile_with_map não panics ─────────────────────────────────────────────

#[test]
fn transpile_with_map_c_does_not_panic() {
    let src = "void setup() { pinMode(13, OUTPUT); }\nvoid loop() {}";
    let (code, _map) = transpile_with_map(src, "c").expect("falhou");
    assert!(!code.is_empty());
}

#[test]
fn transpile_with_map_python_does_not_panic() {
    let src = "def loop():\n    pass\n";
    let (code, _map) = transpile_with_map(src, "python").expect("falhou");
    assert!(!code.is_empty());
}
