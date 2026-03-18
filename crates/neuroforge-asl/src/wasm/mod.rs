//! Módulo WASM — só compilado quando o target é `wasm32-unknown-unknown`.
//!
//! Em builds nativos (Desktop / testes `cargo test`) este módulo é incluído
//! mas os símbolos `#[wasm_bindgen]` são ignorados pelo linker nativo.

pub mod bindings;
