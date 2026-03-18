/**
 * Fase 1D — Wrapper TypeScript para o bundle WASM do crate neuroforge-asl.
 *
 * O bundle é gerado por:
 *   cd crates/neuroforge-asl
 *   wasm-pack build --target web --out-dir ../../../../apps/webapp/src/lib/wasm
 *
 * Uso:
 *   import { initWasm, transpile, transpileWithMap } from '$lib/wasm';
 *
 *   await initWasm();   // chamar uma vez no bootstrap da app
 *
 *   const python = transpile('void setup(){}', 'c', 'python');
 *   const { output, source_map } = transpileWithMap('void loop(){}', 'c', 'rust');
 */

import type { InitOutput } from './neuroforge_asl';
import init, {
    wasm_transpile,
    wasm_transpile_with_map,
    wasm_version,
    wasm_supported_langs,
} from './neuroforge_asl';

// ─── Estado interno ────────────────────────────────────────────────────────────

let _wasm: InitOutput | null = null;

// ─── Inicialização ─────────────────────────────────────────────────────────────

/**
 * Inicializa o módulo WASM.
 * Idempotente — pode ser chamado múltiplas vezes sem custo.
 */
export async function initWasm(): Promise<void> {
    if (_wasm) return;
    _wasm = await init();
}

/**
 * Garante que o WASM está pronto. Lança se `initWasm()` não foi chamado antes.
 */
function assertReady(): void {
    if (!_wasm) {
        throw new Error('[neuroforge-asl] WASM não inicializado. Chama initWasm() primeiro.');
    }
}

// ─── API pública ───────────────────────────────────────────────────────────────

export interface TranspileResult {
    output: string;
    source_map: [number, number][];
}

/**
 * Transpila `source` de `fromLang` para `toLang`.
 *
 * @throws Error com a mensagem do compilador Rust em caso de falha.
 */
export function transpile(source: string, fromLang: string, toLang: string): string {
    assertReady();
    return wasm_transpile(source, fromLang, toLang);
}

/**
 * Transpila e devolve código + source-map.
 *
 * @throws Error com a mensagem do compilador Rust em caso de falha.
 */
export function transpileWithMap(
    source: string,
    fromLang: string,
    toLang: string,
): TranspileResult {
    assertReady();
    const raw = wasm_transpile_with_map(source, fromLang, toLang);
    return JSON.parse(raw) as TranspileResult;
}

/**
 * Versão do crate `neuroforge-asl` embebida no bundle WASM.
 * Útil para diagnóstico e UI "About".
 */
export function aslVersion(): string {
    assertReady();
    return wasm_version();
}

/**
 * Lista de linguagens suportadas separadas por vírgula.
 */
export function supportedLangs(): string[] {
    assertReady();
    return wasm_supported_langs().split(',');
}
