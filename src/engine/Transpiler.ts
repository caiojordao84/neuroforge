// Stub temporario - transpilacao de codigo
import type { Language } from '@/types/index';

export interface TranspileResult {
  success: boolean;
  output?: string;
  errors?: string[];
}

class Transpiler {
  transpile(_code: string, _fromLang: Language, _toLang?: Language): string {
    // TODO: Integrar com arduino-cli ou compilador real
    console.log(`[Transpiler] Transpiling ${_fromLang} code...`);
    return _code; // Retorna codigo sem modificacao
  }
}

export const transpiler = new Transpiler();
