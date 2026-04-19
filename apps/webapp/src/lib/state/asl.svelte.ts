/**
 * Local ASL State using Stable Public Asset Engine
 */
export interface LibraryInput {
  name: string;
  source: string;
}

export interface WorkspaceInput {
  main_source: string;
  libraries: LibraryInput[];
}

class AslState {
  ready    = state(false);
  error    = state<string | null>(null);
  #mod: any = null;

  async init() {
    if (this.ready) return;
    try {
      // Load from public static asset - Zero resolution issues
      // @ts-ignore
      const mod = await import('/wasm/neuroforge_asl.js');
      await mod.default(); 
      this.#mod = mod;
      this.ready = true;
      console.log('[AslState] Public Engine Initialized successfully DEF-V5-SOVEREIGN');
      console.log('[NeuroForge] Motor ASL Ready v' + this.version());
    } catch (e) {
      console.error('Public Engine Init Error:', e);
      this.error = String(e);
    }
  }

  private assertReady() {
    if (!this.ready || !this.#mod) {
      throw new Error('[neuroforge-asl] Engine não pronto.');
    }
  }

  version(): string {
    return this.#mod?.wasm_version() ?? '—';
  }

  supportedLangs(): string[] {
    return (this.#mod?.wasm_supported_langs() ?? '').split(',').filter(Boolean);
  }

  toonToJson(toonContent: string): string {
    this.assertReady();
    return this.#mod.wasm_toon_to_json(toonContent);
  }

  transpile(source: string, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod.wasm_transpile(source, fromLang, toLang);
  }

  parseToToon(source: string, lang: string): string {
    this.assertReady();
    return this.#mod.wasm_parse_to_toon(source, lang);
  }

  crossTranspile(source: string, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod.wasm_cross_transpile(source, fromLang, toLang);
  }

  transpileWorkspace(workspace: WorkspaceInput, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod.wasm_cross_transpile_workspace(JSON.stringify(workspace), fromLang, toLang);
  }

  parseWorkspaceToToon(workspace: WorkspaceInput, lang: string): string {
    this.assertReady();
    return this.#mod.wasm_parse_workspace_to_toon(JSON.stringify(workspace), lang);
  }

  getDiagnostics(source: string, lang: string): Array<{ severity: string; context: string; message: string }> {
    this.assertReady();
    return JSON.parse(this.#mod.wasm_get_diagnostics(source, lang));
  }
}

export const asl = new AslState();
