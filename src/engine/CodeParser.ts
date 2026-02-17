import { simulationEngine } from './SimulationEngine';
import type { Language } from '@/types';

// Code Parser - Parses Arduino C++ and MicroPython
export class CodeParser {
  private language: Language = 'cpp';
  private globalVariables: Map<string, number> = new Map();
  private localVariables: Map<string, number> = new Map();

  // Execution state for control flow
  // Stack of scopes to handle nested if/else
  private executionStack: {
    isExecuting: boolean; // Is the current block active?
    hasExecuted: boolean; // Has any branch in this if/else chain executed yet?
  }[] = [];

  setLanguage(language: Language): void {
    this.language = language;
  }

  parse(code: string): { setup: () => void; loop: () => void } | null {
    // Reset variables for each parse
    this.globalVariables.clear();
    this.localVariables.clear();
    this.executionStack = [];

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
    const lines = code.split('\n');
    for (const line of lines) {
      const cleanLine = line.trim();
      // Match patterns like: const int ledPin = 13; or int val = 0;
      // Ignoring function starts or control flow
      if (cleanLine.startsWith('//') || cleanLine.startsWith('void') || cleanLine.startsWith('if') || cleanLine.startsWith('}')) continue;

      const varMatch = cleanLine.match(/(?:const\s+)?(?:int|byte|long|float|double|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (varMatch) {
        const varName = varMatch[1];
        const valueStr = varMatch[2].trim();
        const value = this.evaluateExpression(valueStr);
        this.globalVariables.set(varName, value);
        // console.log(`Extracted global variable: ${varName} = ${value}`);
      }
    }
  }

  // Resolve variable name to value (Local > Global)
  private resolveVariable(name: string): number | null {
    if (this.localVariables.has(name)) {
      return this.localVariables.get(name)!;
    }
    if (this.globalVariables.has(name)) {
      return this.globalVariables.get(name)!;
    }

    // Check for constants
    if (name === 'HIGH') return 1;
    if (name === 'LOW') return 0;
    if (name === 'true') return 1;
    if (name === 'false') return 0;

    // Try to parse as number directly
    const num = parseFloat(name); // parseFloat handles '2.5' better than parseInt
    return isNaN(num) ? null : num;
  }

  // Evaluate simple expressions: 1, val, digitalRead(2), 1 + 2
  // Currently supports: Literal, Variable, digitalRead(v), analogRead(v), simple comparison (==, !=, <, >)
  // For assignments, we mostly care about values. For if, we care about truthy.
  private evaluateExpression(expr: string): number {
    expr = expr.trim();

    // Handle digitalRead(pin)
    const digitReadMatch = expr.match(/digitalRead\s*\(\s*(\w+)\s*\)/);
    if (digitReadMatch) {
      const pin = this.resolveVariable(digitReadMatch[1]);
      if (pin !== null) {
        // We need to access the engine's read function synchronously? 
        // SimulationEngine digitalRead returns 'HIGH' | 'LOW'
        const val = simulationEngine.digitalRead(pin);
        return val === 'HIGH' ? 1 : 0;
      }
      return 0;
    }

    // Handle analogRead(pin)
    const analogReadMatch = expr.match(/analogRead\s*\(\s*(\w+)\s*\)/);
    if (analogReadMatch) {
      const pin = this.resolveVariable(analogReadMatch[1]);
      // TODO: Handle 'A0' parsing if passed as string literal, but resolveVariable handles A0 if we map it?
      // For now assume variable or number. A0 is usually 14 on Uno.
      if (pin !== null) {
        return simulationEngine.analogRead(pin);
      }
      return 0;
    }

    // Handle pure variable or literal
    // If it contains operators, we might want to do a simple eval (dangerous? no, we are in sandbox-ish)
    // But safely:

    // Equality
    if (expr.includes('==')) {
      const [left, right] = expr.split('==').map(s => s.trim());
      const lVal = this.evaluateExpression(left);
      const rVal = this.evaluateExpression(right);
      return lVal === rVal ? 1 : 0;
    }
    if (expr.includes('!=')) {
      const [left, right] = expr.split('!=').map(s => s.trim());
      const lVal = this.evaluateExpression(left);
      const rVal = this.evaluateExpression(right);
      return lVal !== rVal ? 1 : 0;
    }

    // Simple pass-through if no complex operators
    const val = this.resolveVariable(expr);
    return val !== null ? val : 0;
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
      // Reset local variables at start of function call? 
      // Actually standard C++ preserves static, but re-creates stack vars. 
      // For simplicity in loop(), we might want to keep them if defined outside?
      // No, variables defined INSIDE loop() are re-created. 
      // Variables defined parsing-global are global.
      // But we need a way to clear 'loop' locals without clearing 'global' locals.
      // For now, since we only parse once, we just clear localVariables at start of loop to be safe if they are block scoped.
      // However, typically setup() runs once, loop() runs many times.
      // Variables in loop() should be reset.

      // To properly handle scoping we would need a scope stack for variables too.
      // For this simple parser, we'll just clear locals at the start of the function execution 
      // IF it is the loop function. But we don't know which one this is easily here.
      // Let's rely on declarations overwriting them.

      // We start fresh with execution stack
      this.executionStack = [];

      for (const line of lines) {
        await this.executeCppLine(line);
      }
    };
  }

  private async executeCppLine(line: string): Promise<void> {
    const cleanLine = line.replace(/\/\/.*$/, '').trim();
    if (!cleanLine) return;

    // --- Control Flow Handling ---

    // Handle Closing Brace '}'
    // Check for '} else {' first as it is a specific compound token in our simplified line-by-line parser
    if (cleanLine.startsWith('} else {')) {
      // Transition from IF -> ELSE
      if (this.executionStack.length > 0) {
        const currentScope = this.executionStack[this.executionStack.length - 1];
        // If the previous if/else-if RAN, then we skip the else
        // If it didn't run, AND the parent is executing, then we run the else

        // We need to know if the parent is executing to decide if ELSE enters 'executing' state
        const parentExecuting = this.executionStack.length > 1 ? this.executionStack[this.executionStack.length - 2].isExecuting : true;

        currentScope.isExecuting = !currentScope.hasExecuted && parentExecuting;
        currentScope.hasExecuted = true; // Mark that we've passed the chain now (else is the end)
      }
      return;
    } else if (cleanLine === '}' || cleanLine.startsWith('}')) {
      // End of scope
      // If it's just '}' it pops. 
      // Ideally we only pop if we pushed. For simple parser, we assume balanced braces match our pushes.
      // We only push on 'if'. We should also push on 'else' if it was on a separate line?
      // But we handled '} else {' as a transition.
      // If we see 'else {' on its own line after a '}', we have a problem because we already popped.
      // For this specific 'Sketch' format, '} else {' is common.
      // If the user writes:
      // }
      // else {
      // We need to handle that.

      // Let's assume '}' pops.
      if (this.executionStack.length > 0) {
        // Only pop if this '}' closes a block we tracked.
        // Since we don't track all blocks (like function body braces are stripped), 
        // the '}' we see here are likely control flow or standard blocks.
        // If the line is EXACTLY '}', we pop.
        if (cleanLine === '}') {
          this.executionStack.pop();
          return;
        }
      }
    }

    // Handle 'if'
    if (cleanLine.startsWith('if')) {
      const conditionMatch = cleanLine.match(/if\s*\((.+)\)\s*\{/);
      if (conditionMatch) {
        const condition = conditionMatch[1];
        const isTruthy = this.evaluateExpression(condition) !== 0;

        // Are we currently enabled?
        const currentExecuting = this.executionStack.length > 0 ? this.executionStack[this.executionStack.length - 1].isExecuting : true;

        const shouldExecute = currentExecuting && isTruthy;

        this.executionStack.push({
          isExecuting: shouldExecute,
          hasExecuted: isTruthy // If it was true, we mark it as having executed so 'else' knows to skip
        });
        return;
      }
    }

    // Handle 'else {' on its own line (rare in this simple parser if '}' came before, but possible)
    if (cleanLine.startsWith('else {')) {
      // Logic: This is separate from '} else {'.
      // If we popped the 'if' stack, we lost the state. 
      // This simple parser LIMITATION: 'else' must be on the same line as '}' like '} else {' 
      // OR we need to track 'lastClosedScope' to handle standard style.
      // For now, let's assume valid Arduino examples often use K&R or we prioritize '} else {'.
      // If we hit 'else {' execution checks will fail or be wrong if we popped.
      // Let's warn or try to support it?
      // Support: We need a 'zombie' stack frame or similar. 
      // SKIP for now, focus on verifying the USER's code which uses '} else {' or standard one-liners.
      // Actually the user's logs showed:
      // } else {
      // So lines handle that.
    }

    // --- Execution Checks ---

    // If we are int a block that is NOT executing, return immediately
    if (this.executionStack.length > 0 && !this.executionStack[this.executionStack.length - 1].isExecuting) {
      return;
    }

    // --- Command Execution ---

    // Variable Assignment: int val = ...; or int val = 1;
    // Regex to match "type name = value;"
    // We already have 'extractGlobalVariables', but this is for LOCAL variables inside loop/setup
    const varDeclMatch = cleanLine.match(/^(?:int|byte|long|float|double|bool)\s+(\w+)\s*=\s*([^;]+);/);
    if (varDeclMatch) {
      const varName = varDeclMatch[1];
      const valExpr = varDeclMatch[2];
      const value = this.evaluateExpression(valExpr);
      this.localVariables.set(varName, value);
      return;
    }

    // Variable Re-assignment: val = ...;
    const varAssignMatch = cleanLine.match(/^(\w+)\s*=\s*([^;]+);/);
    if (varAssignMatch) {
      if (!cleanLine.startsWith('int ') && !cleanLine.startsWith('const ')) { // avoid double matching declaration
        const varName = varAssignMatch[1];
        const valExpr = varAssignMatch[2];
        const value = this.evaluateExpression(valExpr);

        // Update existing
        if (this.localVariables.has(varName)) {
          this.localVariables.set(varName, value);
        } else if (this.globalVariables.has(varName)) {
          this.globalVariables.set(varName, value);
        }
        return;
      }
    }


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
        // Resolve value from variable (e.g. HIGH, LOW, 0, 1) or literal
        let valStr = digitalWriteMatch[2];
        let state: 'HIGH' | 'LOW' = 'LOW';

        if (valStr === 'HIGH' || valStr === 'LOW') {
          state = valStr;
        } else {
          // Try resolving logic
          const resolved = this.resolveVariable(valStr);
          if (resolved !== null) {
            state = resolved > 0 ? 'HIGH' : 'LOW';
          }
        }

        simulationEngine.digitalWrite(pinValue, state);
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

    // digitalRead/analogRead standalone calls (ignored mostly if not assigned, but good for completeness)
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
