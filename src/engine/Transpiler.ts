// Stub temporario - transpilacao de codigo

export interface TranspileResult {
  success: boolean;
  output?: string;
  errors?: string[];
}

type Language = 'cpp' | 'python' | 'micropython';

class Transpiler {
  transpile(_code: string, _fromLang: Language, _toLang?: Language): string {
    // TODO: Integrar com arduino-cli ou compilador real
    console.log(`[Transpiler] Transpiling ${_fromLang} code...`);
    return _code; // Retorna codigo sem modificacao
  }
}

export const transpiler = new Transpiler();
