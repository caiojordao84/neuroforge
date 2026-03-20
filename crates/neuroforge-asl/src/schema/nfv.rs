//! nfv.rs — Schema do ficheiro .nfv (NeuroForge Visual)
//! Versão: 4.0.0

use serde::{Deserialize, Serialize};

/// Raiz do ficheiro .nfv
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvFile {
    /// Versão do schema .nfv (semver, ex: "4.0.0")
    pub schema_version: String,
    /// Versão do motor ASL que gerou este ficheiro
    pub asl_version: String,
    /// Identificador único do projecto (UUID v4)
    pub project_id: String,
    /// Placa alvo (ex: "arduino-uno", "esp32-devkit", "rp2040")
    pub target_board: String,
    /// Linguagem alvo (ex: "cpp", "micropython", "rust_embassy", "st")
    pub target_language: String,
    /// Nós do editor visual
    pub nodes: Vec<FlowNode>,
    /// Arestas do editor visual
    pub edges: Vec<FlowEdge>,
    /// Cache do AslProgram serializado (para preview instantâneo, opcional)
    pub asl_cache: Option<serde_json::Value>,
    /// Metadados do projecto
    pub metadata: NfvMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvMetadata {
    pub name: String,
    /// ISO 8601
    pub created_at: String,
    /// ISO 8601
    pub updated_at: String,
    pub author: Option<String>,
    pub description: Option<String>,
    /// Versão da app NeuroForge que criou o ficheiro
    pub neuroforge_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    /// "digitalWrite", "if", "timerTON", etc.
    #[serde(rename = "type")]
    pub node_type: String,
    pub position: Position,
    /// Dados específicos do nó (flexível por design)
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

impl NfvFile {
    /// Cria um ficheiro .nfv vazio com `project_id` gerado automaticamente
    pub fn new_empty(name: &str, target_board: &str, target_language: &str) -> Self {
        let now = chrono_now();
        Self {
            schema_version: "4.0.0".into(),
            asl_version: "4.0.0".into(),
            project_id: new_uuid(),
            target_board: target_board.into(),
            target_language: target_language.into(),
            nodes: vec![],
            edges: vec![],
            asl_cache: None,
            metadata: NfvMetadata {
                name: name.into(),
                created_at: now.clone(),
                updated_at: now,
                author: None,
                description: None,
                neuroforge_version: env!("CARGO_PKG_VERSION").into(),
            },
        }
    }
}

fn new_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn chrono_now() -> String {
    // ISO 8601 sem dependência de chrono — usa o formato básico
    // Em produção pode ser substituído por chrono::Utc::now().to_rfc3339()
    "2026-01-01T00:00:00Z".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nfv_new_empty() {
        let nfv = NfvFile::new_empty("Blink", "arduino-uno", "cpp");
        assert_eq!(nfv.schema_version, "4.0.0");
        assert_eq!(nfv.target_board, "arduino-uno");
        assert!(!nfv.project_id.is_empty());
    }

    #[test]
    fn test_nfv_roundtrip_json() {
        let nfv = NfvFile::new_empty("Test", "esp32-devkit", "micropython");
        let json  = serde_json::to_string(&nfv).unwrap();
        let back: NfvFile = serde_json::from_str(&json).unwrap();
        assert_eq!(back.project_id, nfv.project_id);
        assert_eq!(back.target_language, "micropython");
    }
}
