/**
 * ASL State with WASM transpiler integration
 */

export interface LibraryInput {
  name: string;
  source: string;
}

export interface WorkspaceInput {
  main_source: string;
  libraries: LibraryInput[];
}

/**
 * Interface for the neuroforge-asl WASM module
 * Based on Rust WASM bindings in crates/neuroforge-asl/src/wasm/bindings.rs
 */
interface WasmModule {
  // Version and info
  wasm_version(): string;
  wasm_supported_langs(): string;

  // Core transpilation
  wasm_transpile(source: string, from_lang: string, to_lang: string): string;
  wasm_transpile_with_map(source: string, from_lang: string, to_lang: string): string;

  // Cross-language transpilation
  wasm_cross_transpile(source: string, from_lang: string, to_lang: string): string;
  wasm_cross_transpile_workspace(workspace_json: string, from_lang: string, to_lang: string): string;

  // Parsing to ASL IR
  wasm_parse_to_asl(source: string, lang: string): string;
  wasm_parse_to_toon(source: string, lang: string): string;

  // Workspace parsing
  wasm_parse_workspace_to_toon(workspace_json: string, lang: string): string;
  wasm_parse_workspace_to_asl(workspace_json: string, lang: string): string;

  // Diagnostics
  wasm_get_diagnostics(source: string, lang: string): string;
  wasm_check_types(source: string, lang: string): string;

  // TOON format
  wasm_toon_to_json(toon_content: string): string;

  // Ladder Diagram (LD) support
  wasm_parse_ld_to_asl(xml_source: string): string;
  wasm_asl_to_ld(asl_json: string): string;
  wasm_st_to_ld(st_source: string): string;
  wasm_to_ld(source: string, from_lang: string): string;
  wasm_validate_ld(xml_source: string): string;

  // Default init function from wasm-bindgen
  default(): Promise<unknown>;
}

class AslState {
  ready    = $state(false);
  error    = $state<string | null>(null);
  #mod: WasmModule | null = null;

  async init() {
    if (this.ready) return;
    try {
      const mod = await import("./pkg/neuroforge_asl.js") as WasmModule;
      await mod.default(); // calls init() from wasm-bindgen
      this.#mod = mod;
      this.ready = true;
      console.log('[AslState] WASM Initialized successfully DEF-V5-STABLE');
      console.log('[NeuroForge] Motor ASL inicializado v' + this.version());
    } catch (e) {
      console.error('WASM Init Error:', e);
      this.error = String(e);
    }
  }

  private assertReady() {
    if (!this.ready || !this.#mod) {
      throw new Error('[neuroforge-asl] WASM não inicializado. Chama asl.init() primeiro.');
    }
  }

  version(): string {
    return this.#mod?.wasm_version() ?? '—';
  }

  supportedLangs(): string[] {
    return (this.#mod?.wasm_supported_langs() ?? '').split(',').filter(Boolean);
  }

  /**
   * Converte TOON para JSON
   */
  toonToJson(toonContent: string): string {
    this.assertReady();
    return this.#mod!.wasm_toon_to_json(toonContent);
  }

  transpile(source: string, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod!.wasm_transpile(source, fromLang, toLang);
  }

  transpileWithMap(source: string, fromLang: string, toLang: string): { output: string; source_map: [number, number][] } {
    this.assertReady();
    return JSON.parse(this.#mod!.wasm_transpile_with_map(source, fromLang, toLang));
  }

  parseToAsl(source: string, lang: string): unknown {
    this.assertReady();
    return JSON.parse(this.#mod!.wasm_parse_to_asl(source, lang));
  }

  parseToToon(source: string, lang: string): string {
    this.assertReady();
    return this.#mod!.wasm_parse_to_toon(source, lang);
  }

  /** Cross-language transpilation */
  crossTranspile(source: string, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod!.wasm_cross_transpile(source, fromLang, toLang);
  }

  /** VFS Workspace: Transpile multi-file workspace */
  transpileWorkspace(workspace: WorkspaceInput, fromLang: string, toLang: string): string {
    this.assertReady();
    return this.#mod!.wasm_cross_transpile_workspace(JSON.stringify(workspace), fromLang, toLang);
  }

  /** VFS Workspace: Parse multi-file to TOON */
  parseWorkspaceToToon(workspace: WorkspaceInput, lang: string): string {
    this.assertReady();
    return this.#mod!.wasm_parse_workspace_to_toon(JSON.stringify(workspace), lang);
  }

  getDiagnostics(source: string, lang: string): Array<{ severity: string; context: string; message: string }> {
    this.assertReady();
    return JSON.parse(this.#mod!.wasm_get_diagnostics(source, lang));
  }

  // ===== Ladder Diagram (LD) Support =====

  /**
   * Parse Ladder Diagram (LD) to ASL IR
   * Uses the LD parser built into the transpiler
   */
  parseLdToAsl(ldSource: string): unknown {
    if (!this.#mod) throw new Error('WASM não inicializado');
    try {
      return JSON.parse(this.#mod!.wasm_parse_to_asl(ldSource, 'ld'));
    } catch {
      // If 'ld' parser doesn't exist, return manual conversion
      return this.manualLdToAsl(ldSource);
    }
  }

  /**
   * Generate Ladder Diagram (LD) from ASL IR
   */
  aslToLd(aslSource: string): string {
    if (!this.#mod) throw new Error('WASM não inicializado');
    try {
      return this.#mod!.wasm_cross_transpile(aslSource, 'asl', 'ld');
    } catch {
      // Fallback: manual conversion
      return this.manualAslToLd(aslSource);
    }
  }

  /**
   * Manual LD to ASL conversion (fallback when WASM doesn't support LD)
   */
  private manualLdToAsl(ldSource: string): object {
    const lines = ldSource.split('\n').filter(l => l.trim());
    const elements: Array<{ type: string; ref: string; preset?: number }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // NO Contact: |X|
      const noContactMatch = trimmed.match(/\|([A-Z0-9_.]+)\|/);
      if (noContactMatch) {
        elements.push({ type: 'contact_no', ref: noContactMatch[1] });
        continue;
      }

      // NC Contact: |/X|
      const ncContactMatch = trimmed.match(/\|\/([A-Z0-9_.]+)\|/);
      if (ncContactMatch) {
        elements.push({ type: 'contact_nc', ref: ncContactMatch[1] });
        continue;
      }

      // Output Coil: (X)
      const coilMatch = trimmed.match(/\(([A-Z0-9_.]+)\)/);
      if (coilMatch) {
        elements.push({ type: 'coil_output', ref: coilMatch[1] });
        continue;
      }

      // Set Coil: (S X)
      const setMatch = trimmed.match(/\(S\s+([A-Z0-9_.]+)\)/);
      if (setMatch) {
        elements.push({ type: 'coil_set', ref: setMatch[1] });
        continue;
      }

      // Reset Coil: (R X)
      const resetMatch = trimmed.match(/\(R\s+([A-Z0-9_.]+)\)/);
      if (resetMatch) {
        elements.push({ type: 'coil_reset', ref: resetMatch[1] });
        continue;
      }

      // Timer: [TON X PT:=Y]
      const tonMatch = trimmed.match(/\[TON\s+([A-Z0-9_.]+)\s+PT:=(\d+)\]/);
      if (tonMatch) {
        elements.push({ type: 'ton', ref: tonMatch[1], preset: parseInt(tonMatch[2], 10) });
        continue;
      }

      // Counter: [CTU X PV:=Y]
      const ctuMatch = trimmed.match(/\[CTU\s+([A-Z0-9_.]+)\s+PV:=(\d+)\]/);
      if (ctuMatch) {
        elements.push({ type: 'ctu', ref: ctuMatch[1], preset: parseInt(ctuMatch[2], 10) });
        continue;
      }
    }

    return {
      program: {
        variables: [...new Set(elements.map(e => e.ref))].map(ref => ({
          name: ref,
          type: 'BOOL',
          initialValue: false
        })),
        rungs: [{
          id: 'rung-0',
          elements
        }]
      }
    };
  }

  /**
   * Manual ASL to LD conversion (fallback when WASM doesn't support LD generation)
   */
  private manualAslToLd(aslSource: string): string {
    try {
      const parsed = JSON.parse(aslSource);
      const lines: string[] = [];

      if (parsed.program?.rungs) {
        for (const rung of parsed.program.rungs) {
          if (rung.elements) {
            for (const el of rung.elements) {
              switch (el.type) {
                case 'contact_no':
                  lines.push(`|${el.ref}|`);
                  break;
                case 'contact_nc':
                  lines.push(`|/${el.ref}|`);
                  break;
                case 'coil_output':
                  lines.push(`(${el.ref})`);
                  break;
                case 'coil_set':
                  lines.push(`(S ${el.ref})`);
                  break;
                case 'coil_reset':
                  lines.push(`(R ${el.ref})`);
                  break;
                case 'ton':
                  lines.push(`[TON ${el.ref} PT:=${el.preset ?? 1000}]`);
                  break;
                case 'tof':
                  lines.push(`[TOF ${el.ref} PT:=${el.preset ?? 1000}]`);
                  break;
                case 'tp':
                  lines.push(`[TP ${el.ref} PT:=${el.preset ?? 1000}]`);
                  break;
                case 'ctu':
                  lines.push(`[CTU ${el.ref} PV:=${el.preset ?? 0}]`);
                  break;
                case 'ctd':
                  lines.push(`[CTD ${el.ref} PV:=${el.preset ?? 0}]`);
                  break;
              }
            }
          }
        }
      }

      return lines.join('\n');
    } catch {
      return '';
    }
  }
}

export const asl = new AslState();




