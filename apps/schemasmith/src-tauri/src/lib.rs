mod commands;

use commands::{
    export_board_toon, export_component_toon, load_board_from_file, load_component_from_file,
    validate_board, validate_component,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            validate_board,
            validate_component,
            export_board_toon,
            export_component_toon,
            load_board_from_file,
            load_component_from_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
