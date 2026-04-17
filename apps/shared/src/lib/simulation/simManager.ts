import initSimModule, { SimEngine } from '../wasm-sim/neuroforge_sim';

/**
 * SimManager - Layered Hybrid SAB Administrator
 * 
 * Allocates the root SharedArrayBuffer to be shared between:
 * 1. Layer 1: Svelte UI (for reading stats without blocking)
 * 2. Layer 2: OffscreenCanvas Render Worker (reads rapidly for rendering)
 * 3. Layer 3: Rust WASM Simulation Runtime (writes pin states rapidly)
 */

export class SimManager {
    public buffer: SharedArrayBuffer | null = null;
    public stateArray: Uint8Array | null = null;
    
    private engine: SimEngine | null = null;
    private logicLoopId: number | null = null;

    public async initialize() {
        if (!window.crossOriginIsolated) {
            console.error("SharedArrayBuffer is disabled. Ensure COOP/COEP headers are sent by Vite/Tauri.");
            throw new Error("Cross-Origin-Isolation required for Simulation");
        }

        // Initialize WASM instance
        const wasm = await initSimModule();

        this.engine = new SimEngine();

        // Get the internal memory array pointer exported by Rust
        const pointer = this.engine.get_buffer_pointer();
        
        // Grab the internal WASM memory exactly where SIM_BUFFER resides
        // Note: web_sys or our build naturally exposes `memory` on the exports but we can also copy 
        // to our own JS buffer if WASM doesn't export the memory buffer organically.
        // For zero-copy, since target web exports `wasm.memory`:
        this.buffer = wasm.memory.buffer as SharedArrayBuffer;
        this.stateArray = new Uint8Array(this.buffer, pointer, 1024 * 1024);

        console.log("[SimManager] Zero-copy SharedArrayBuffer attached to WASM pointer:", pointer);
    }

    public startLogicTicks() {
        if (!this.engine) throw new Error("Initialize WASM first");

        // The mock TOON string payload representing structural bindings
        this.engine.load_toon(JSON.stringify({ 
           nodes: [
             { id: "mcu-1", component_type: "RP2040" }
           ] 
        }));

        const tickLoop = () => {
            if (this.engine) {
                // Execute physics clock cycles
                // In production, we'd run this loop via setInterval or web worker without reqAnimFrame
                this.engine.tick();
            }
            this.logicLoopId = requestAnimationFrame(tickLoop);
        };

        tickLoop();
    }
}

export const simManager = new SimManager();
