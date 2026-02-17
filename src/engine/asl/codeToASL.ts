// src/engine/asl/codeToASL.ts
// Conversão de um subconjunto de Arduino C++ para ASLProgram (v0).

import type { Language } from '@/types';
import type { ASLProgram, ASLGlobalVar, ASLStatement, ASLExpr } from './ASLTypes';

export function codeToASL(code: string, language: Language): ASLProgram {
  if (language !== 'cpp') {
    throw new Error(`ASL codeToASL: language ${language} not supported yet`);
  }

  return cppToASL(code);
}

function cppToASL(code: string): ASLProgram {
  const globals = extractGlobalVarsToASL(code);
  const setupBody = extractFunctionBody(code, 'setup');
  const loopBody = extractFunctionBody(code, 'loop');

  const setupStmts = cppLinesToASLStatements(setupBody.split('\n'));
  const loopStmts = cppLinesToASLStatements(loopBody.split('\n'));

  return {
    metadata: {
      name: 'From C++',
      targetBoard: undefined,
    },
    globals,
    functions: [
      {
        name: 'setup',
        params: [],
        body: setupStmts,
      },
    ],
    tasks: [
      {
        name: 'mainLoop',
        body: loopStmts,
      },
    ],
  };
}

function extractGlobalVarsToASL(code: string): ASLGlobalVar[] {
  const globals: ASLGlobalVar[] = [];
  const lines = code.split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('void ') || line.startsWith('if') || line.startsWith('}')) continue;

    const m = line.match(/(?:const\s+)?(?:int|byte|long|float|double|bool)\s+(\w+)\s*=\s*([^;]+);/);
    if (m) {
      const name = m[1];
      const valStr = m[2].trim();
      const num = parseFloat(valStr);
      const initialValue = Number.isNaN(num) ? 0 : num;

      globals.push({
        name,
        type: 'int',
        initialValue,
      });
    }
  }

  return globals;
}

function extractFunctionBody(code: string, functionName: string): string {
  const funcRegex = new RegExp(`void\\s+${functionName}\\s*\\(\\s*\\)\\s*\\{`);
  const match = code.match(funcRegex);

  if (!match || match.index === undefined) {
    throw new Error(`Could not find ${functionName}() function`);
  }

  const startIndex = match.index + match[0].length;
  let braceCount = 1;
  let endIndex = startIndex;

  while (braceCount > 0 && endIndex < code.length) {
    if (code[endIndex] === '{') {
      braceCount++;
    } else if (code[endIndex] === '}') {
      braceCount--;
    }
    endIndex++;
  }

  if (braceCount !== 0) {
    throw new Error(`Unbalanced braces in ${functionName}()`);
  }

  return code.substring(startIndex, endIndex - 1);
}

function cppLinesToASLStatements(lines: string[]): ASLStatement[] {
  const stmts: ASLStatement[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    // Controle de fluxo ainda não suportado na v0: for/while/if
    if (line.startsWith('if') || line.startsWith('for') || line.startsWith('while')) {
      throw new Error('ASL v0: control flow not yet supported via codeToASL');
    }

    // pinMode(PIN, MODE)
    const pinModeMatch = line.match(/pinMode\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*;/);
    if (pinModeMatch) {
      const [, pinToken, modeToken] = pinModeMatch;
      stmts.push({
        kind: 'pinMode',
        pin: makeVarOrLiteral(pinToken),
        mode: modeToken as 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP',
      });
      continue;
    }

    // digitalWrite(PIN, VAL)
    const digitalWriteMatch = line.match(/digitalWrite\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*;/);
    if (digitalWriteMatch) {
      const [, pinToken, valueToken] = digitalWriteMatch;
      let value: 'HIGH' | 'LOW' | ASLExpr;
      if (valueToken === 'HIGH' || valueToken === 'LOW') {
        value = valueToken;
      } else {
        value = makeVarOrLiteral(valueToken);
      }
      stmts.push({
        kind: 'digitalWrite',
        pin: makeVarOrLiteral(pinToken),
        value,
      });
      continue;
    }

    // analogWrite(PIN, VAL)
    const analogWriteMatch = line.match(/analogWrite\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*;/);
    if (analogWriteMatch) {
      const [, pinToken, valueToken] = analogWriteMatch;
      stmts.push({
        kind: 'analogWrite',
        pin: makeVarOrLiteral(pinToken),
        value: makeVarOrLiteral(valueToken),
      });
      continue;
    }

    // delay(MS)
    const delayMatch = line.match(/delay\s*\(\s*(\w+)\s*\)\s*;/);
    if (delayMatch) {
      const [, msToken] = delayMatch;
      stmts.push({
        kind: 'delay',
        milliseconds: makeVarOrLiteral(msToken),
      });
      continue;
    }

    // int var = digitalRead(PIN);
    const declReadMatch = line.match(/^(?:int|byte|long)\s+(\w+)\s*=\s*digitalRead\s*\(\s*(\w+)\s*\)\s*;/);
    if (declReadMatch) {
      const [, varName, pinToken] = declReadMatch;
      stmts.push({
        kind: 'read',
        mode: 'DIGITAL',
        pin: makeVarOrLiteral(pinToken),
        target: varName,
      });
      continue;
    }

    // var = digitalRead(PIN);
    const assignReadMatch = line.match(/^(\w+)\s*=\s*digitalRead\s*\(\s*(\w+)\s*\)\s*;/);
    if (assignReadMatch) {
      const [, varName, pinToken] = assignReadMatch;
      stmts.push({
        kind: 'read',
        mode: 'DIGITAL',
        pin: makeVarOrLiteral(pinToken),
        target: varName,
      });
      continue;
    }

    // Outras linhas são ignoradas silenciosamente na v0.
    // Podemos adicionar logs de debug se necessário.
  }

  return stmts;
}

function makeVarOrLiteral(token: string): ASLExpr {
  const num = parseFloat(token);
  if (!Number.isNaN(num)) {
    return { kind: 'literal', value: num };
  }
  return { kind: 'var', name: token };
}
