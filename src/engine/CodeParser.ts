// Stub temporario - parsing basico de codigo Arduino

export interface ParsedCode {
  variables: string[];
  functions: string[];
  pins: number[];
}

class CodeParser {
  parse(code: string): ParsedCode {
    const variables: string[] = [];
    const functions: string[] = [];
    const pins: number[] = [];

    // Extrair funcoes
    const funcMatches = code.matchAll(/(?:void|int|float|bool)\s+(\w+)\s*\(/g);
    for (const match of funcMatches) {
      functions.push(match[1]);
    }

    // Extrair pinos (pinMode, digitalWrite, etc)
    const pinMatches = code.matchAll(/\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite)\s*\(\s*(\d+)/g);
    for (const match of pinMatches) {
      const pin = parseInt(match[2]);
      if (!pins.includes(pin)) {
        pins.push(pin);
      }
    }

    return { variables, functions, pins };
  }
}

export const codeParser = new CodeParser();
