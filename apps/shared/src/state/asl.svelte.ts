type WasmModule = typeof import('../lib/wasm/neuroforge_asl.js');

class AslState {
  ready    = $state(false);
  error    = $state<string | null>(null);
  #mod: WasmModule | null = null;

  async init() {
    if (this.ready) return;
    try {
      // @ts-ignore - gerado pelo wasm-pack
      const mod = await import('../lib/wasm/neuroforge_asl.js');
      await mod.default(); // chama init() do wasm-bindgen
      this.#mod = mod;
      this.ready = true;
    } catch (e) {
      console.error('WASM Init Error:', e);
      this.error = String(e);
    }
  }

  version(): string {
    return this.#mod?.wasm_version() ?? '—';
  }

  supportedLangs(): string[] {
    return (this.#mod?.wasm_supported_langs() ?? '').split(',').filter(Boolean);
  }

  transpile(source: string, fromLang: string, toLang: string): string {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return this.#mod.wasm_transpile(source, fromLang, toLang);
  }

  transpileWithMap(source: string, fromLang: string, toLang: string): { output: string; source_map: [number, number][] } {
    if (!this.#mod) throw new Error('WASM não inicializado');
    return JSON.parse(this.#mod.wasm_transpile_with_map(source, fromLang, toLang));
  }

  parseToAsl(source: string, lang: string): unknown {
    if (!this.#mod) throw new Error('WASM não inicializado');
    // @ts-ignore
    return JSON.parse(this.#mod.wasm_parse_to_asl(source, lang));
  }

  getDiagnostics(source: string, lang: string): Array<{ severity: string; context: string; message: string }> {
    if (!this.#mod) throw new Error('WASM não inicializado');
    // @ts-ignore
    return JSON.parse(this.#mod.wasm_get_diagnostics(source, lang));
  }
}

export const asl = new AslState();
