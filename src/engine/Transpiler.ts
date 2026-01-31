// Stub temporario - transpilacao de codigo

export interface TranspileResult {
  success: boolean;
  output?: string;
  errors?: string[];
}

class Transpiler {
  async transpile(code: string, language: 'cpp' | 'python'): Promise<TranspileResult> {
    // TODO: Integrar com arduino-cli ou compilador real
    console.log(`[Transpiler] Transpiling ${language} code...`);
    
    return {
      success: true,
      output: 'Compiled successfully (stub)'
    };
  }
}

export const transpiler = new Transpiler();
