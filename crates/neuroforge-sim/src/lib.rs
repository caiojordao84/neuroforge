#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

// A simple structure representing the shared buffer we create or hook into.
// We'll expose memory from WASM to Javascript so Javascript can access the underlying SAB.
// To do this, the wasm module must be compiled with --target web --no-modules or with
// a specific WASM linker flag to export memory, and we use WebAssembly.Memory from js_sys.

use serde::{Deserialize, Serialize};

/// Simplified generic TOON representation
#[derive(Deserialize, Serialize)]
pub struct ToonProgram {
    pub nodes: Vec<ToonNode>,
}

#[derive(Deserialize, Serialize)]
pub struct ToonNode {
    pub id: String,
    pub component_type: String,
}

// Global buffer holding the runtime representation (Voltages, registers, etc.)
// Mapped to JS via getting the buffer pointer.
const SIM_BUFFER_SIZE: usize = 1024 * 1024; // 1MB
static mut SIM_BUFFER: [u8; SIM_BUFFER_SIZE] = [0; SIM_BUFFER_SIZE];

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct SimEngine {
    tick_count: u64,
    active_nodes: usize,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl SimEngine {
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> SimEngine {
        SimEngine {
            tick_count: 0,
            active_nodes: 0,
        }
    }


    /// Loads a TOON JSON payload to setup the simulation physics map.
    pub fn load_toon(&mut self, json_payload: &str) -> bool {
        match serde_json::from_str::<ToonProgram>(json_payload) {
            Ok(program) => {
                self.active_nodes = program.nodes.len();
                true
            },
            Err(_) => false
        }
    }

    /// Single simulation step.
    pub fn tick(&mut self) -> u64 {
        self.tick_count += 1;
        
        // Mock ticking logic: write deterministic toggles into SIM_BUFFER
        unsafe {
            if self.active_nodes > 0 {
                // E.g. Toggle the 0th byte (representing Edge 0 in the MVP)
                SIM_BUFFER[0] = if self.tick_count % 60 < 30 { 1 } else { 0 };
            }
        }
        
        self.tick_count
    }

    /// Retrieves a pointer for Javascript to find the buffer area.
    pub fn get_buffer_pointer(&self) -> *const u8 {
        unsafe { std::ptr::addr_of!(SIM_BUFFER) as *const u8 }
    }
}
