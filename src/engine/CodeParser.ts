import { simulationEngine } from './SimulationEngine';
import type { Language } from '@/types';

// Code Parser - Parses Arduino C++ and MicroPython
export class CodeParser {
  private language: Language = 'cpp';
  private variables: Map<string, number> = new Map();

  setLanguage(language: Language): void {
    this.language = language;
  }

  parse(code: string): { setup: () => void; loop: () => void } | null {
    // Reset variables for each parse
    this.variables.clear();
    
    if (this.language === 'cpp') {
      return this.parseCpp(code);
    } else {
      return this.parsePython(code);
    }
  }

  private parseCpp(code: string): { setup: () => void; loop: () => void } | null {
    try {
      // Extract global variable declarations first
      this.extractGlobalVariables(code);

      // Extract setup function - improved regex to handle various formatting
      const setupMatch = this.extractFunction(code, 'setup');
      const loopMatch = this.extractFunction(code, 'loop');

      if (!setupMatch) {
        throw new Error('Could not find setup() function');
      }
      if (!loopMatch) {
        throw new Error('Could not find loop() function');
      }

      const setupFn = this.createCppFunction(setupMatch);
      const loopFn = this.createCppFunction(loopMatch);

      return { setup: setupFn, loop: loopFn };
    } catch (error) {
      console.error('C++ parse error:', error);
      return null;
    }
  }

  // Extract global variable declarations
  private extractGlobalVariables(code: string): void {
    // Match patterns like: const int ledPin = 13;
    const globalVarRegex = /(?:const\s+)?(?:int|byte|long|float|double)\s+(\w+)\s*=\s*([\d.]+)\s*;/g;
    let match;

    while ((match = globalVarRegex.exec(code)) !== null) {
      const varName = match[1];
      const value = parseFloat(match[2]);
      this.variables.set(varName, value);
      console.log(`Extracted global variable: ${varName} = ${value}`);
    }
  }

  // Resolve variable name to value
  private resolveVariable(name: string): number | null {
    if (this.variables.has(name)) {
      return this.variables.get(name)!;
    }
    // Try to parse as number directly
    const num = parseInt(name, 10);
    return isNaN(num) ? null : num;
  }

  // Extract function body by finding matching braces
  private extractFunction(code: string, functionName: string): string | null {
    // Find the function declaration
    const funcRegex = new RegExp(`void\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`);
    const match = code.match(funcRegex);
    
    if (!match) {
      return null;
    }

    const startIndex = match.index! + match[0].length;
    let braceCount = 1;
    let endIndex = startIndex;

    // Find the matching closing brace
    while (braceCount > 0 && endIndex < code.length) {
      if (code[endIndex] === '{') {
        braceCount++;
      } else if (code[endIndex] === '}') {
        braceCount--;
      }
      endIndex++;
    }

    if (braceCount !== 0) {
      return null; // Unbalanced braces
    }

    return code.substring(startIndex, endIndex - 1);
  }

  private createCppFunction(body: string): () => void {
    const lines = body.split('\n').map((line) => line.trim()).filter((line) => line);

    return async () => {
      for (const line of lines) {
        await this.executeCppLine(line);
      }
    };
  }

  private async executeCppLine(line: string): Promise<void> {
    const cleanLine = line.replace(/\/\/.*$/, '').trim();
    if (!cleanLine) return;

    const serialBeginMatch = cleanLine.match(/Serial\.begin\s*\(\s*(\d+)\s*\)/);
    if (serialBeginMatch) {
      simulationEngine.serialBegin(parseInt(serialBeginMatch[1], 10));
      return;
    }

    const serialPrintlnMatch = cleanLine.match(/Serial\.println\s*\(\s*"([^"]*)"\s*\)/);
    if (serialPrintlnMatch) {
      simulationEngine.serialPrintln(serialPrintlnMatch[1]);
      return;
    }

    const serialPrintMatch = cleanLine.match(/Serial\.print\s*\(\s*"([^"]*)"\s*\)/);
    if (serialPrintMatch) {
      simulationEngine.serialPrint(serialPrintMatch[1]);
      return;
    }

    // pinMode with variable or literal
    const pinModeMatch = cleanLine.match(/pinMode\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (pinModeMatch) {
      const pinValue = this.resolveVariable(pinModeMatch[1]);
      if (pinValue !== null) {
        const mode = pinModeMatch[2] as 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
        simulationEngine.pinMode(pinValue, mode);
      } else {
        console.warn(`Could not resolve pin variable: ${pinModeMatch[1]}`);
      }
      return;
    }

    // digitalWrite with variable or literal
    const digitalWriteMatch = cleanLine.match(/digitalWrite\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (digitalWriteMatch) {
      const pinValue = this.resolveVariable(digitalWriteMatch[1]);
      if (pinValue !== null) {
        const value = digitalWriteMatch[2] as 'HIGH' | 'LOW';
        simulationEngine.digitalWrite(pinValue, value);
      } else {
        console.warn(`Could not resolve pin variable: ${digitalWriteMatch[1]}`);
      }
      return;
    }

    const analogWriteMatch = cleanLine.match(/analogWrite\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/);
    if (analogWriteMatch) {
      const pinValue = this.resolveVariable(analogWriteMatch[1]);
      if (pinValue !== null) {
        const value = parseInt(analogWriteMatch[2], 10);
        simulationEngine.analogWrite(pinValue, value);
      }
      return;
    }

    const delayMatch = cleanLine.match(/delay\s*\(\s*(\d+)\s*\)/);
    if (delayMatch) {
      const ms = parseInt(delayMatch[1], 10);
      await simulationEngine.delay(ms);
      return;
    }

    const delayUsMatch = cleanLine.match(/delayMicroseconds\s*\(\s*(\d+)\s*\)/);
    if (delayUsMatch) {
      simulationEngine.delayMicroseconds();
      return;
    }

    const digitalReadMatch = cleanLine.match(/digitalRead\s*\(\s*(\w+)\s*\)/);
    if (digitalReadMatch) {
      const pinValue = this.resolveVariable(digitalReadMatch[1]);
      if (pinValue !== null) {
        simulationEngine.digitalRead(pinValue);
      }
      return;
    }

    const analogReadMatch = cleanLine.match(/analogRead\s*\(\s*(\w+)\s*\)/);
    if (analogReadMatch) {
      const pin = analogReadMatch[1];
      if (pin.startsWith('A')) {
        const analogPin = 14 + parseInt(pin.slice(1), 10);
        simulationEngine.analogRead(analogPin);
      } else {
        const pinValue = this.resolveVariable(pin);
        if (pinValue !== null) {
          simulationEngine.analogRead(pinValue);
        }
      }
      return;
    }

    if (cleanLine.match(/^\s*(int|float|double|char|bool|byte|long|const)\s+/)) {
      return;
    }

    if (cleanLine.startsWith('if')) {
      return;
    }

    if (cleanLine.startsWith('for')) {
      return;
    }

    if (cleanLine.startsWith('while')) {
      return;
    }

    console.log('Unparsed C++ line:', cleanLine);
  }

  private parsePython(code: string): { setup: () => void; loop: () => void } | null {
    try {
      const whileMatch = code.match(/while\s+True\s*:\s*\n([\s\S]*?)(?=\n\n|$)/);

      if (!whileMatch) {
        throw new Error('Could not find while True: loop');
      }

      const loopBody = whileMatch[1];
      const initCode = code.substring(0, code.indexOf('while True:'));

      const setupFn = this.createPythonInitFunction(initCode);
      const loopFn = this.createPythonLoopFunction(loopBody);

      return { setup: setupFn, loop: loopFn };
    } catch (error) {
      console.error('Python parse error:', error);
      return null;
    }
  }

  private createPythonInitFunction(code: string): () => void {
    const lines = code.split('\n').map((line) => line.trim()).filter((line) => line);

    return async () => {
      for (const line of lines) {
        await this.executePythonLine(line);
      }
    };
  }

  private createPythonLoopFunction(body: string): () => void {
    const lines = body.split('\n').map((line) => line.trim()).filter((line) => line);

    return async () => {
      for (const line of lines) {
        await this.executePythonLine(line);
      }
    };
  }

  private async executePythonLine(line: string): Promise<void> {
    const cleanLine = line.replace(/#.*/, '').trim();
    if (!cleanLine) return;

    if (cleanLine.startsWith('from ') || cleanLine.startsWith('import ')) {
      return;
    }

    const pinInitMatch = cleanLine.match(/(\w+)\s*=\s*Pin\s*\(\s*(\d+)\s*,\s*Pin\.(\w+)\s*\)/);
    if (pinInitMatch) {
      const pin = parseInt(pinInitMatch[2], 10);
      const mode = pinInitMatch[3] === 'OUT' ? 'OUTPUT' : 
                   pinInitMatch[3] === 'IN' ? 'INPUT' : 
                   pinInitMatch[3] === 'IN_PULLUP' ? 'INPUT_PULLUP' : 'OUTPUT';
      simulationEngine.pinMode(pin, mode);
      return;
    }

    const pinValueMatch = cleanLine.match(/(\w+)\.value\s*\(\s*(\d+)\s*\)/);
    if (pinValueMatch) {
      const value = parseInt(pinValueMatch[2], 10);
      const varName = pinValueMatch[1];
      const pinMatch = varName.match(/(\d+)/);
      if (pinMatch) {
        const pin = parseInt(pinMatch[1], 10);
        simulationEngine.digitalWrite(pin, value === 1 ? 'HIGH' : 'LOW');
      }
      return;
    }

    const printMatch = cleanLine.match(/print\s*\(\s*"([^"]*)"\s*\)/);
    if (printMatch) {
      simulationEngine.serialPrintln(printMatch[1]);
      return;
    }

    const sleepMatch = cleanLine.match(/time\.sleep\s*\(\s*([\d.]+)\s*\)/);
    if (sleepMatch) {
      const seconds = parseFloat(sleepMatch[1]);
      await simulationEngine.delay(Math.round(seconds * 1000));
      return;
    }

    const sleepMsMatch = cleanLine.match(/time\.sleep_ms\s*\(\s*(\d+)\s*\)/);
    if (sleepMsMatch) {
      const ms = parseInt(sleepMsMatch[1], 10);
      await simulationEngine.delay(ms);
      return;
    }

    if (cleanLine.match(/^\w+\s*=/)) {
      return;
    }

    console.log('Unparsed Python line:', cleanLine);
  }

  analyzeCode(code: string, language: Language): { pins: number[]; errors: string[] } {
    const pins: number[] = [];
    const errors: string[] = [];

    if (language === 'cpp') {
      if (!code.includes('void setup()')) {
        errors.push('Missing setup() function');
      }
      if (!code.includes('void loop()')) {
        errors.push('Missing loop() function');
      }

      const pinModeRegex = /pinMode\s*\(\s*(\d+)\s*,/g;
      let match;
      while ((match = pinModeRegex.exec(code)) !== null) {
        pins.push(parseInt(match[1], 10));
      }
    } else {
      if (!code.includes('while True:')) {
        errors.push('Missing while True: loop');
      }

      const pinRegex = /Pin\s*\(\s*(\d+)\s*,/g;
      let match;
      while ((match = pinRegex.exec(code)) !== null) {
        pins.push(parseInt(match[1], 10));
      }
    }

    return { pins: [...new Set(pins)], errors };
  }
}

// Singleton instance
export const codeParser = new CodeParser();
