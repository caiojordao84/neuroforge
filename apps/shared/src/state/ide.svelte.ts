import { asl } from './asl.svelte.ts';

/** Maps internal language IDs to file extensions */
const langExtMap: Record<string, string> = {
  cpp: 'cpp', c: 'c', arduino: 'ino',
  rust: 'rs', python: 'py', micropython: 'py',
  upython: 'py', st: 'st', iec61131: 'st', plc: 'st',
  zig: 'zig', lua: 'lua', ada: 'adb', forth: 'f',
  asm: 'asm', espruino: 'js', circuitpython: 'py',
};

/** Canonical display languages for the selector (subset of what WASM supports) */
const DEFAULT_LANGUAGES = ['cpp', 'python', 'rust', 'st', 'arduino', 'zig', 'lua', 'circuitpython', 'espruino', 'ada', 'forth', 'asm'];

/** Display labels for each language */
export const langDisplayNames: Record<string, string> = {
  cpp: 'C / C++',
  python: 'Python',
  rust: 'Rust',
  st: 'ST (IEC 61131)',
  c: 'C',
  arduino: 'Arduino',
  micropython: 'MicroPython',
  zig: 'Zig',
  lua: 'Lua',
  circuitpython: 'CircuitPython',
  espruino: 'Espruino',
  ada: 'Ada',
  forth: 'Forth',
  asm: 'Assembly',
  ld: 'Ladder (LD)',
};

export type ActiveTab = 'main' | 'asl' | 'library';

class IDEState {
  code = $state('// NeuroForge — RP2040\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}');

  language = $state('cpp');
  activeTab = $state<ActiveTab>('main');
  isCodePanelOpen = $state(true);
  transpiledAsl = $state('');

  toggleCodePanel() {
    this.isCodePanelOpen = !this.isCodePanelOpen;
  }

  availableLanguages = $state<string[]>(DEFAULT_LANGUAGES);

  /** Computed main file name based on current language */
  mainFileName = $derived(`main.${langExtMap[this.language] ?? this.language}`);

  terminalLogs = $state<Array<{ time: string, msg: string, type: 'info' | 'error' | 'success' }>>([
    { time: new Date().toLocaleTimeString(), msg: 'IDE Initialized.', type: 'info' }
  ]);

  addLog(msg: string, type: 'info' | 'error' | 'success' = 'info') {
    this.terminalLogs = [...this.terminalLogs, {
      time: new Date().toLocaleTimeString(),
      msg,
      type
    }];
  }

  /** Initialize available languages from WASM engine */
  initLanguages() {
    if (!asl.ready) return;
    try {
      const raw = asl.supportedLangs();
      // Filter to canonical display languages only
      const canonical = raw.filter((l: string) => DEFAULT_LANGUAGES.includes(l));
      if (canonical.length > 0) {
        this.availableLanguages = canonical;
      }
    } catch {
      // keep defaults
    }
  }

  /**
   * Change language — transpile code via WASM pipeline:
   * 1. Parse current code to ASL IR (using current language parser)
   * 2. Generate new code from ASL IR (using target language generator)
   *
   * The WASM `transpile(source, to_lang)` only parses source using the TARGET
   * parser, so we can't use it for cross-language transpilation.
   * Instead, we use the `transpile(source, to_lang)` called twice:
   * The WASM API now exposes `wasm_cross_transpile(source, from, to)` which:
   *   1. Parses source with the `from` language parser → AslProgram
   *   2. Generates code with the `to` language generator
   *
   * Supported targets: python, st. For C/Rust targets, cross-transpilation
   * is not yet supported (AslProgram→BaseNode conversion needed).
   */
  async setLanguage(newLang: string) {
    if (newLang === this.language) return;

    const oldLang = this.language;
    this.language = newLang;

    if (!asl.ready) {
      this.addLog(`Switched to ${(langDisplayNames[newLang] ?? newLang).toUpperCase()} (engine not ready, code unchanged)`, 'info');
      return;
    }

    try {
      const transpiled = asl.crossTranspile(this.code, oldLang, newLang);
      this.code = transpiled;
      this.addLog(`Transpiled ${oldLang} → ${newLang} successfully.`, 'success');
    } catch (e) {
      const msg = String(e);
      if (msg.includes('not yet supported') || msg.includes('not supported')) {
        this.addLog(`Switched to ${(langDisplayNames[newLang] ?? newLang).toUpperCase()} (auto-transpile to this target not yet available)`, 'info');
      } else {
        this.addLog(`Transpilation error: ${msg}`, 'error');
      }
    }
  }

  /** Navigate to Main tab */
  showMain() {
    this.activeTab = 'main';
  }

  /**
   * Navigate to ASL tab — parse current code to ASL IR using parseToAsl.
   * This uses `wasm_parse_to_asl(source, lang)` which correctly parses
   * the source with the right parser for the current language.
   */
  async showAsl() {
    if (!asl.ready) {
      this.addLog('WASM Engine not ready yet...', 'error');
      return;
    }
    try {
      const parsed = asl.parseToAsl(this.code, this.language);
      this.transpiledAsl = JSON.stringify(parsed, null, 2);
      this.activeTab = 'asl';
      this.addLog('ASL IR generated successfully.', 'success');
    } catch (e) {
      this.addLog('ASL parse failed: ' + String(e), 'error');
    }
  }

  /** Navigate to library tab */
  showLibrary() {
    this.activeTab = 'library';
  }

  /** Replace Main code content (for import) */
  replaceMainCode(content: string, sourceName?: string) {
    this.code = content;
    this.activeTab = 'main';
    this.addLog(`Imported ${sourceName ?? 'file'} as main source.`, 'success');
  }

  async runSimulation() {
    this.addLog(`Starting simulation (${this.language})...`, 'info');
    if (!asl.ready) {
      this.addLog('Wait for engine initialization...', 'error');
      return;
    }

    try {
      // Transpile to the same language to validate syntax
      asl.transpile(this.code, this.language, this.language);
      this.addLog('Simulation build successful.', 'success');
      this.addLog('Running on virtual target...', 'info');
    } catch (e) {
      this.addLog('Simulation error: ' + String(e), 'error');
    }
  }
}

export const ideState = new IDEState();
