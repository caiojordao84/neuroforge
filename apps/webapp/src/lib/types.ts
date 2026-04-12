export enum SupportedLanguage {
  ASSEMBLY_8051 = 'Assembly (8051)',
  ASSEMBLY_ARM = 'Assembly (ARM)',
  ASSEMBLY_AVR = 'Assembly (AVR)',
  C_EMBEDDED = 'C (Embedded/HAL)',
  CPP_EMBEDDED = 'C++ (Embedded)',
  ARDUINO = 'Arduino C/C++',
  MICROPYTHON = 'MicroPython',
  CIRCUITPYTHON = 'CircuitPython',
  RUST = 'Rust (embedded-hal)',
  JAVASCRIPT = 'JavaScript (Espruino)',
  LUA = 'Lua (NodeMCU)',
  ZIG = 'Zig (microzig)',
  ADA = 'Ada (GNAT)',
  FORTH = 'Forth (mecrisp)',
  STRUCTURED_TEXT = 'Structured Text (IEC 61131-3)',
  SFC = 'Sequential Function Chart (SFC)',
  LADDER_DIAGRAM = 'Ladder Diagram (LD)'
}

export const LANGUAGES = Object.values(SupportedLanguage);

export interface TranspileResult {
  code: string;
  notes: string;
  optimizations?: string;
  warnings?: string;
  verification: string;
  raw: string;
}

export interface TranspileRequest {
  sourceLang: string;
  targetLang: string;
  targetPlatform: string;
  code: string;
}
