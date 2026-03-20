//! migration.rs — migração automática de ficheiros .nfv entre versões
//! Chamado sempre que um ficheiro .nfv é carregado

use crate::schema::nfv::NfvFile;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("Versão de schema desconhecida: {0}")]
    UnknownVersion(String),
    #[error("Erro de deserialização: {0}")]
    Deserialize(#[from] serde_json::Error),
}

/// Ponto de entrada: carrega e migra um ficheiro .nfv de qualquer versão
/// suportada para a versão actual (4.x).
pub fn migrate_nfv(raw: &str) -> Result<NfvFile, MigrationError> {
    // 1. Lê apenas schema_version sem desserializar o resto
    let probe: serde_json::Value = serde_json::from_str(raw)?;
    let version = probe["schema_version"]
        .as_str()
        .unwrap_or("1.0.0");

    if version.starts_with("4.") {
        // Versão actual — desserializar directamente
        Ok(serde_json::from_str(raw)?)
    } else if version.starts_with("3.") {
        migrate_v3_to_v4(raw)
    } else if version.starts_with("2.") {
        let v3_json = migrate_v2_to_v3_raw(raw)?;
        migrate_v3_to_v4(&v3_json)
    } else if version.starts_with("1.") {
        let v2_json = migrate_v1_to_v2_raw(raw)?;
        let v3_json = migrate_v2_to_v3_raw(&v2_json)?;
        migrate_v3_to_v4(&v3_json)
    } else {
        Err(MigrationError::UnknownVersion(version.to_string()))
    }
}

// ── v3 → v4 ──────────────────────────────────────────────────────────────────
// v4 acrescenta: project_id (UUID), asl_version, metadata.neuroforge_version
fn migrate_v3_to_v4(raw: &str) -> Result<NfvFile, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["project_id"].is_null() || val["project_id"].as_str().unwrap_or("").is_empty() {
        val["project_id"] = uuid::Uuid::new_v4().to_string().into();
    }
    if val["asl_version"].is_null() {
        val["asl_version"] = "4.0.0".into();
    }
    if val["metadata"]["neuroforge_version"].is_null() {
        val["metadata"]["neuroforge_version"] = env!("CARGO_PKG_VERSION").into();
    }
    val["schema_version"] = "4.0.0".into();

    Ok(serde_json::from_value(val)?)
}

// ── v2 → v3 ──────────────────────────────────────────────────────────────────
// v3 acrescenta: metadata block
fn migrate_v2_to_v3_raw(raw: &str) -> Result<String, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["metadata"].is_null() {
        val["metadata"] = serde_json::json!({
            "name": val["name"].as_str().unwrap_or("Projecto sem título"),
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
            "neuroforge_version": "3.0.0"
        });
    }
    val["schema_version"] = "3.0.0".into();

    Ok(serde_json::to_string(&val)?)
}

// ── v1 → v2 ──────────────────────────────────────────────────────────────────
// v2 acrescenta: target_language
fn migrate_v1_to_v2_raw(raw: &str) -> Result<String, MigrationError> {
    let mut val: serde_json::Value = serde_json::from_str(raw)?;

    if val["target_language"].is_null() {
        val["target_language"] = "cpp".into(); // default histórico
    }
    val["schema_version"] = "2.0.0".into();

    Ok(serde_json::to_string(&val)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_migrate_v3_to_v4() {
        let v3 = r#"{
            "schema_version": "3.0.0",
            "asl_version": null,
            "target_board": "arduino-uno",
            "target_language": "cpp",
            "nodes": [],
            "edges": [],
            "metadata": {
                "name": "Blink",
                "created_at": "2025-01-01T00:00:00Z",
                "updated_at": "2025-01-01T00:00:00Z",
                "neuroforge_version": "3.0.0"
            }
        }"#;
        let result = migrate_nfv(v3);
        assert!(result.is_ok());
        let nfv = result.unwrap();
        assert_eq!(nfv.schema_version, "4.0.0");
        assert!(!nfv.project_id.is_empty());
    }

    #[test]
    fn test_migrate_v4_passthrough() {
        let v4 = r#"{
            "schema_version": "4.0.0",
            "asl_version": "4.0.0",
            "project_id": "test-uuid-1234",
            "target_board": "esp32-devkit",
            "target_language": "micropython",
            "nodes": [],
            "edges": [],
            "metadata": {
                "name": "Teste",
                "created_at": "2026-01-01T00:00:00Z",
                "updated_at": "2026-01-01T00:00:00Z",
                "neuroforge_version": "4.0.0"
            }
        }"#;
        let result = migrate_nfv(v4);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().project_id, "test-uuid-1234");
    }

    #[test]
    fn test_unknown_version_errors() {
        let unknown = r#"{"schema_version": "99.0.0", "nodes": [], "edges": []}"#;
        assert!(migrate_nfv(unknown).is_err());
    }
}
