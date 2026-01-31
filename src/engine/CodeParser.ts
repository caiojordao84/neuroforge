// Stub temporario - parsing de codigo Arduino

export interface ParsedCode {
  variables: string[];
  functions: string[];
  pins: number[];
  setup?: string;
  loop?: string;
}

class CodeParser {
  private currentLanguage: string = 'cpp';

  setLanguage(language: string) {
    this.currentLanguage = language;
  }

  parse(code: string): ParsedCode {
    const variables: string[] = [];
    const functions: string[] = [];
    const pins: number[] = [];

    // Extrair funcoes
    const funcMatches = code.matchAll(/(?:void|int|float|bool)\s+(\w+)\s*\(/g);
    for (const match of funcMatches) {
      functions.push(match[1]);
    }

    // Extrair setup
    const setupMatch = code.match(/void\s+setup\s*\(\)\s*{([^}]*)}/s);
    const setup = setupMatch ? setupMatch[1] : '';

    // Extrair loop
    const loopMatch = code.match(/void\s+loop\s*\(\)\s*{([^}]*)}/s);
    const loop = loopMatch ? loopMatch[1] : '';

    // Extrair pinos
    const pinMatches = code.matchAll(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite)\s*\(\s*(\d+)/g);
    for (const match of pinMatches) {
      const pin = parseInt(match[2]);
      if (!pins.includes(pin)) {
        pins.push(pin);
      }
    }

    return { variables, functions, pins, setup, loop };
  }
}

export const codeParser = new CodeParser();
