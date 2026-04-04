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
    let nfv = migrate_nfv(v1_json()).expect("migração v1→v4 falhou");
    assert_eq!(nfv.schema_version, "4.0.0");
    assert_eq!(nfv.asl_version, "4.0.0");
    assert!(!nfv.project_id.is_empty(), "project_id não foi gerado");
}

#[test]
fn migrate_v2_to_v4() {
    let nfv = migrate_nfv(v2_json()).expect("migração v2→v4 falhou");
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
