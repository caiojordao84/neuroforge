//! TransformContext — contexto partilhado por todos os transforms ASL.
//! Migrado de: src/engine/asl/transforms/context.ts

use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// Linguagens suportadas pelo motor ASL.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    Cpp,
    Python,
    Rust,
    Arduino,
    St,
    Ladder,
}

impl Language {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "cpp" | "c" | "c++" | "arduino" => Some(Language::Cpp),
            "python" | "micropython" => Some(Language::Python),
            "rust" | "rust_std" | "rust_embassy" => Some(Language::Rust),
            "st" | "structured_text" => Some(Language::St),
            "ladder" => Some(Language::Ladder),
            _ => None,
        }
    }
}

use serde::{Deserialize, Serialize};

/// Pinos RGB agrupados por nome de variável.
#[derive(Debug, Clone)]
pub struct RgbPins {
    pub r: serde_json::Value,
    pub g: serde_json::Value,
    pub b: serde_json::Value,
}

/// Contexto partilhado por todos os transforms durante uma passagem de
/// código-fonte → AslProgram.
///
/// Equivalente directo de `TransformContext` em TypeScript.
#[derive(Debug, Clone)]
pub struct TransformContext {
    /// Mapa de variáveis globais: nome → valor inicial (qualquer JSON).
    pub globals_map: HashMap<String, Value>,

    /// Linguagem fonte activa durante esta passagem.
    pub language: Option<Language>,

    /// Definições de structs conhecidas: nome → campos.
    /// Populado pelo code_to_asl ao processar StructDeclaration.
    pub struct_defs: HashMap<String, crate::types::asl_types::AslStructDef>,

    /// Pinos RGB: nome da variável → { r, g, b }.
    pub rgb_pins: HashMap<String, RgbPins>,

    /// Pinos PWM: nome da variável → node JSON.
    pub pwm_pins: HashMap<String, Value>,

    /// Instâncias servo reconhecidas.
    /// Populado pelas 3 camadas de detecção no statement_registry:
    ///   Camada 1 — declaração explícita (type === 'Servo')
    ///   Camada 2 — inferência por callee (/servo/i)
    ///   Camada 3 — inferência lazy por método (.attach())
    pub servo_instances: HashSet<String>,
}

impl TransformContext {
    /// Cria um novo contexto vazio para a linguagem fornecida.
    pub fn new(language: Option<Language>) -> Self {
        Self {
            globals_map: HashMap::new(),
            language,
            struct_defs: HashMap::new(),
            rgb_pins: HashMap::new(),
            pwm_pins: HashMap::new(),
            servo_instances: HashSet::new(),
        }
    }

    /// Regista uma instância servo pelo nome da variável.
    pub fn add_servo(&mut self, name: &str) {
        self.servo_instances.insert(name.to_string());
    }

    /// Verifica se um nome é uma instância servo conhecida.
    pub fn is_servo(&self, name: &str) -> bool {
        self.servo_instances.contains(name)
    }

    /// Regista um grupo de pinos RGB.
    pub fn add_rgb(&mut self, var_name: &str, r: Value, g: Value, b: Value) {
        self.rgb_pins
            .insert(var_name.to_string(), RgbPins { r, g, b });
    }

    /// Regista um pino PWM.
    pub fn add_pwm(&mut self, var_name: &str, node: Value) {
        self.pwm_pins.insert(var_name.to_string(), node);
    }
}
