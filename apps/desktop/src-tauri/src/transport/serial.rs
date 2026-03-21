use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct SerialPortInfo {
    pub name:  String,
    pub r#type: String,
}

/// Lista todas as portas série disponíveis no sistema.
#[command]
pub fn serial_list_ports() -> Result<Vec<SerialPortInfo>, String> {
    serialport::available_ports()
        .map_err(|e| e.to_string())?
        .into_iter()
        .map(|p| {
            let kind = match p.port_type {
                serialport::SerialPortType::UsbPort(_)    => "usb",
                serialport::SerialPortType::BluetoothPort => "bluetooth",
                serialport::SerialPortType::PciPort       => "pci",
                serialport::SerialPortType::Unknown       => "unknown",
            };
            Ok(SerialPortInfo { name: p.port_name, r#type: kind.to_string() })
        })
        .collect()
}

/// Estado partilhado da porta aberta (gerido pelo AppState do Tauri)
use std::sync::Mutex;

pub struct SerialState {
    pub port: Mutex<Option<Box<dyn serialport::SerialPort>>>,
}

impl SerialState {
    pub fn new() -> Self {
        Self { port: Mutex::new(None) }
    }
}

/// Abre uma porta série com o baud rate especificado.
#[command]
pub fn serial_open(
    state: tauri::State<SerialState>,
    port_name: String,
    baud_rate: u32,
) -> Result<(), String> {
    let port = serialport::new(&port_name, baud_rate)
        .timeout(std::time::Duration::from_millis(10))
        .open()
        .map_err(|e| e.to_string())?;
    *state.port.lock().unwrap() = Some(port);
    Ok(())
}

/// Fecha a porta série activa.
#[command]
pub fn serial_close(state: tauri::State<SerialState>) -> Result<(), String> {
    *state.port.lock().unwrap() = None;
    Ok(())
}

/// Envia dados pela porta série.
#[command]
pub fn serial_write(
    state: tauri::State<SerialState>,
    data: Vec<u8>,
) -> Result<usize, String> {
    let mut guard = state.port.lock().unwrap();
    let port = guard.as_mut().ok_or("Porta serial não aberta")?;
    port.write(&data).map_err(|e| e.to_string())
}
