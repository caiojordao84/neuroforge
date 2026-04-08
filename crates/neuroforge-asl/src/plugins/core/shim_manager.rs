//! ShimManager     registo e emiss  o de shims partilhado por todos os plugins.

//! Migrado de: src/engine/asl/plugins/core/ShimManager.ts

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]

pub enum ShimLanguage {
    C,

    Python,

    Rust,

    Zig,
}

impl ShimLanguage {
    pub fn as_str(&self) -> &'static str {
        match self {
            ShimLanguage::C => "c",

            ShimLanguage::Python => "python",

            ShimLanguage::Rust => "rust",

            ShimLanguage::Zig => "zig",
        }
    }
}

/// Defini    o de um shim     bloco de c  digo injectado no topo do ficheiro gerado.

#[derive(Debug, Clone)]

pub struct ShimDefinition {
    pub name: String,

    pub code: String,

    pub description: Option<String>,

    /// Outros shims que este depende (resolvidos recursivamente).
    pub dependencies: Vec<String>,
}

impl ShimDefinition {
    pub fn new(name: &str, code: &str) -> Self {
        Self {
            name: name.to_string(),

            code: code.to_string(),

            description: None,

            dependencies: vec![],
        }
    }

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());

        self
    }

    pub fn with_deps(mut self, deps: Vec<&str>) -> Self {
        self.dependencies = deps.into_iter().map(|s| s.to_string()).collect();

        self
    }
}

/// Gestor de shims partilhado por todos os geradores de linguagem.

pub struct ShimManager {
    language: ShimLanguage,

    registry: HashMap<String, ShimDefinition>,

    required_shims: HashSet<String>,
}

impl ShimManager {
    pub fn new(language: ShimLanguage) -> Self {
        Self {
            language,

            registry: HashMap::new(),

            required_shims: HashSet::new(),
        }
    }

    /// Regista uma defini    o de shim.

    pub fn register_shim(&mut self, shim: ShimDefinition) {
        self.registry.insert(shim.name.clone(), shim);
    }

    /// Regista m  ltiplos shims de uma vez.

    pub fn register_shims(&mut self, shims: Vec<ShimDefinition>) {
        for shim in shims {
            self.register_shim(shim);
        }
    }

    /// Marca um shim como obrigat  rio para a gera    o actual.

    /// Resolve depend  ncias recursivamente. Ignora ciclos.

    pub fn require_shim(&mut self, name: &str) {
        if !self.registry.contains_key(name) {
            eprintln!(
                "[ShimManager] Aviso: shim '{}' pedido mas n  o registado para linguagem '{}'.",
                name,
                self.language.as_str()
            );

            return;
        }

        if self.required_shims.contains(name) {
            return; // J   requerido     evita ciclos infinitos
        }

        self.required_shims.insert(name.to_string());

        // Resolver depend  ncias (clone para evitar borrow conflict)

        let deps: Vec<String> = self
            .registry
            .get(name)
            .map(|d| d.dependencies.clone())
            .unwrap_or_default();

        for dep in deps {
            self.require_shim(&dep);
        }
    }

    /// Retorna o bloco de c  digo de todos os shims requeridos.

    pub fn get_required_shims_code(&self) -> String {
        if self.required_shims.is_empty() {
            return String::new();
        }

        let mut lines = Vec::new();

        lines.push(format!(
            "\n// --- ASL Auto-Generated Shims ({}) ---",
            self.language.as_str().to_uppercase()
        ));

        for shim_name in &self.required_shims {
            if let Some(def) = self.registry.get(shim_name) {
                if let Some(desc) = &def.description {
                    lines.push(format!("// Shim: {} - {}", def.name, desc));
                } else {
                    lines.push(format!("// Shim: {}", def.name));
                }

                lines.push(def.code.clone());

                lines.push(String::new());
            }
        }

        lines.push("// --- End of Shims ---\n".to_string());

        lines.join("\n")
    }

    /// Verifica se um shim foi pedido.

    pub fn has_requested(&self, name: &str) -> bool {
        self.required_shims.contains(name)
    }

    /// Limpa todos os shims requeridos (para reutilizar entre runs).

    pub fn reset_runtime(&mut self) {
        self.required_shims.clear();
    }
}

#[cfg(test)]

mod tests {

    use super::*;

    fn make_manager() -> ShimManager {
        let mut m = ShimManager::new(ShimLanguage::C);

        m.register_shim(
            ShimDefinition::new("servo", "#include <Servo.h>")
                .with_description("Arduino Servo library"),
        );

        m.register_shim(ShimDefinition::new("wire", "#include <Wire.h>").with_deps(vec![]));

        m.register_shim(
            ShimDefinition::new("lcd", "#include <LiquidCrystal_I2C.h>").with_deps(vec!["wire"]),
        );

        m
    }

    #[test]

    fn test_require_and_detect() {
        let mut m = make_manager();

        m.require_shim("servo");

        assert!(m.has_requested("servo"));

        assert!(!m.has_requested("wire"));
    }

    #[test]

    fn test_dependency_resolution() {
        let mut m = make_manager();

        m.require_shim("lcd");

        assert!(m.has_requested("lcd"));

        assert!(
            m.has_requested("wire"),
            "dep wire deve ser resolvida automaticamente"
        );
    }

    #[test]

    fn test_reset_runtime() {
        let mut m = make_manager();

        m.require_shim("servo");

        m.reset_runtime();

        assert!(!m.has_requested("servo"));
    }

    #[test]

    fn test_unknown_shim_does_not_panic() {
        let mut m = make_manager();

        m.require_shim("nonexistent"); // deve apenas emitir aviso, n  o panicar
    }

    #[test]

    fn test_code_generation() {
        let mut m = make_manager();

        m.require_shim("servo");

        let code = m.get_required_shims_code();

        assert!(code.contains("Servo"));

        assert!(code.contains("ASL Auto-Generated Shims"));
    }
}
