//! TransformContext     contexto partilhado por todos os transforms ASL.

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

/// Pinos RGB agrupados por nome de vari  vel.

#[derive(Debug, Clone)]

pub struct RgbPins {
    pub r: serde_json::Value,

    pub g: serde_json::Value,

    pub b: serde_json::Value,
}

/// Contexto partilhado por todos os transforms durante uma passagem de

/// c  digo-fonte     AslProgram.

///

/// Equivalente directo de `TransformContext` em TypeScript.

#[derive(Debug, Clone)]

pub struct TransformContext {
    /// Mapa de vari  veis globais: nome     valor inicial (qualquer JSON).
    pub globals_map: HashMap<String, Value>,

    /// Linguagem fonte activa durante esta passagem.
    pub language: Option<Language>,

    /// Defini    es de structs conhecidas: nome     campos.

    /// Populado pelo ast_normalizer ao processar StructDeclaration.
    pub struct_defs: HashMap<String, crate::types::asl_types::AslStructDef>,

    /// Pinos RGB: nome da vari  vel     { r, g, b }.
    pub rgb_pins: HashMap<String, RgbPins>,

    /// Pinos PWM: nome da vari  vel     node JSON.
    pub pwm_pins: HashMap<String, Value>,

    /// Inst  ncias servo reconhecidas.

    /// Populado pelas 3 camadas de detec    o no statement_registry:

    ///   Camada 1     declara    o expl  cita (type === 'Servo')

    ///   Camada 2     infer  ncia por callee (/servo/i)

    ///   Camada 3     infer  ncia lazy por m  todo (.attach())
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

    /// Regista uma inst  ncia servo pelo nome da vari  vel.

    pub fn add_servo(&mut self, name: &str) {
        self.servo_instances.insert(name.to_string());
    }

    /// Verifica se um nome    uma inst  ncia servo conhecida.

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
