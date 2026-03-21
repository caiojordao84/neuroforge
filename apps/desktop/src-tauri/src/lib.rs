mod transport;
use transport::serial::{SerialState, serial_list_ports, serial_open, serial_close, serial_write};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialState::new())
        .invoke_handler(tauri::generate_handler![
            serial_list_ports,
            serial_open,
            serial_close,
            serial_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
