// src/engine/asl/codeToASL.ts
// Conversão de um subconjunto de Arduino C++ para ASLProgram (v0/v1 controle de fluxo).

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

  // Normalizações de controle de fluxo para facilitar o parser linha‑a‑linha
  const normalizedSetup = normalizeElseBlocks(normalizeIfHeaders(setupBody));
  const normalizedLoop = normalizeElseBlocks(normalizeIfHeaders(loopBody));

  const setupStmts = cppLinesToASLStatements(normalizedSetup.split('\n'));
  const loopStmts = cppLinesToASLStatements(normalizedLoop.split('\n'));

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

function normalizeElseBlocks(body: string): string {
  // Transforma "} else" em duas linhas: "}" e "else"
  // para que o scanner de linha encontre o else no índice seguinte.
  return body.replace(/}\s*else\b/g, '}\nelse');
}

function normalizeIfHeaders(body: string): string {
  // Transforma:
  //   if (COND)
  //   {
  //     ...
  //   }
  // em:
  //   if (COND) {
  //     ...
  //   }
  return body.replace(/if\s*\(([^)]+)\)\s*\n\s*{/g, 'if ($1) {');
}

function cppLinesToASLStatements(lines: string[]): ASLStatement[] {
  const stmts: ASLStatement[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    // If de uma linha: if (COND) STATEMENT;
    const singleLineIf = line.match(/^if\s*\((.+)\)\s*([^;{]+);$/);
    if (singleLineIf) {
      const conditionSrc = singleLineIf[1].trim();
      const stmtSrc = singleLineIf[2].trim();

      const conditionExpr = parseConditionExpr(conditionSrc);
      const thenBranch = cppLinesToASLStatements([stmtSrc + ';']);

      stmts.push({
        kind: 'if',
        condition: conditionExpr,
        thenBranch,
      });

      continue;
    }

    // If/else/else-if em bloco
    if (line.startsWith('if')) {
      const { stmt, nextIndex } = parseIfBlock(lines, i);
      stmts.push(stmt);
      i = nextIndex;
      continue;
    }

    // While (COND) { ... } simples
    if (line.startsWith('while')) {
      const { stmt, nextIndex } = parseWhileBlock(lines, i);
      stmts.push(stmt);
      i = nextIndex;
      continue;
    }

    // for (init; cond; inc) { ... } simples
    if (line.startsWith('for')) {
      const { stmts: forStmts, nextIndex } = parseForBlock(lines, i);
      stmts.push(...forStmts);
      i = nextIndex;
      continue;
    }

    // Declaração local simples: int i = 0;
    const localDeclMatch = line.match(
      /^(?:int|byte|long|float|double|bool)\s+(\w+)\s*=\s*([^;]+);$/
    );
    if (localDeclMatch) {
      const [, varName, exprSrc] = localDeclMatch;

      // Passo 1: só literais/constantes simples (HIGH/LOW, true/false, números)
      const valueExpr = makeVarOrLiteral(exprSrc.trim());

      stmts.push({
        kind: 'assign',
        target: varName,
        value: valueExpr,
      });

      continue;
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

    // Atribuição de incremento/decremento simples: i = i + 1; / i = i - 1;
    const incDecMatch = line.match(/^(\w+)\s*=\s*(\w+)\s*([+-])\s*([^;]+);$/);
    if (incDecMatch) {
      const [, target, rightVar, op, rhsRaw] = incDecMatch;

      // Apenas quando é a mesma variável dos dois lados
      if (target === rightVar && (op === '+' || op === '-')) {
        const rightExpr = makeVarOrLiteral(rhsRaw.trim());

        stmts.push({
          kind: 'assign',
          target,
          value: {
            kind: 'binary',
            op: op as '+' | '-',
            left: { kind: 'var', name: target },
            right: rightExpr,
          },
        });

        continue;
      }
    }

    // Outras linhas são ignoradas silenciosamente na v1.
  }

  return stmts;
}

function parseIfBlock(
  lines: string[],
  startIndex: number
): { stmt: ASLStatement; nextIndex: number } {
  const headerRaw = lines[startIndex];
  const header = headerRaw.replace(/\/\/.*$/, '').trim();

  // Suporta: if (COND) {
  const m = header.match(/^if\s*\((.+)\)\s*\{/);
  if (!m) {
    throw new Error('ASL v1: unsupported if header format');
  }

  const conditionSrc = m[1].trim();
  const conditionExpr = parseConditionExpr(conditionSrc);

  // Encontrar fim do bloco THEN, respeitando blocos aninhados
  let braceCount = 1;
  let i = startIndex + 1;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\/\/.*$/, '');
    for (let j = 0; j < stripped.length; j++) {
      const ch = stripped[j];
      if (ch === '{') braceCount++;
      else if (ch === '}') braceCount--;
    }
    if (braceCount === 0) {
      break;
    }
  }

  if (braceCount !== 0) {
    throw new Error('ASL v1: unmatched braces in if block');
  }

  const thenLines = lines.slice(startIndex + 1, i);
  const thenBranch = cppLinesToASLStatements(thenLines);

  let elseBranch: ASLStatement[] | undefined;
  let lastIndex = i;

  // Verifica se há else ou else-if logo após o bloco THEN, pulando comentários e linhas vazias
  let elseIndex = i + 1;
  while (elseIndex < lines.length) {
    const nextRaw = lines[elseIndex];
    const nextLine = nextRaw.replace(/\/\/.*$/, '').trim();

    if (!nextLine) {
      elseIndex++;
      continue;
    }

    if (nextLine.startsWith('else')) {
      const elseIfMatch = nextLine.match(/^else\s+if\s*\((.+)\)\s*\{/);
      if (elseIfMatch) {
        // else if (COND) { ... }  ->  else { if (COND) { ... } ... }
        const patchedLines = [...lines];
        patchedLines[elseIndex] = nextRaw.replace(/else\s+if/, 'if');

        const { stmt: nestedIf, nextIndex: nestedLastIndex } = parseIfBlock(
          patchedLines,
          elseIndex
        );

        elseBranch = [nestedIf];
        lastIndex = nestedLastIndex;
      } else {
        // else { ... }
        if (!nextLine.match(/^else\s*\{/)) {
          throw new Error('ASL v1: unsupported else header format');
        }

        braceCount = 1;
        let j = elseIndex + 1;
        for (; j < lines.length; j++) {
          const raw = lines[j];
          const stripped = raw.replace(/\/\/.*$/, '');
          for (let k = 0; k < stripped.length; k++) {
            const ch = stripped[k];
            if (ch === '{') braceCount++;
            else if (ch === '}') braceCount--;
          }
          if (braceCount === 0) {
            break;
          }
        }

        if (braceCount !== 0) {
          throw new Error('ASL v1: unmatched braces in else block');
        }

        const elseLines = lines.slice(elseIndex + 1, j);
        elseBranch = cppLinesToASLStatements(elseLines);
        lastIndex = j;
      }
    }
    // Para no primeiro statement não-else encontrado fora do bloco
    break;
  }

  const stmt: ASLStatement = {
    kind: 'if',
    condition: conditionExpr,
    thenBranch,
    elseBranch,
  };

  // nextIndex deve ser o último índice de linha consumido
  return { stmt, nextIndex: lastIndex };
}

function parseWhileBlock(
  lines: string[],
  startIndex: number
): { stmt: ASLStatement; nextIndex: number } {
  const headerRaw = lines[startIndex];
  const header = headerRaw.replace(/\/\/.*$/, '').trim();

  // Suporta: while (COND) {
  const m = header.match(/^while\s*\((.+)\)\s*\{/);
  if (!m) {
    throw new Error('ASL v1: unsupported while header format');
  }

  const conditionSrc = m[1].trim();
  const conditionExpr = parseConditionExpr(conditionSrc);

  // Encontrar fim do bloco WHILE, respeitando blocos aninhados
  let braceCount = 1;
  let i = startIndex + 1;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\/\/.*$/, '');
    for (let j = 0; j < stripped.length; j++) {
      const ch = stripped[j];
      if (ch === '{') braceCount++;
      else if (ch === '}') braceCount--;
    }
    if (braceCount === 0) {
      break;
    }
  }

  if (braceCount !== 0) {
    throw new Error('ASL v1: unmatched braces in while block');
  }

  const bodyLines = lines.slice(startIndex + 1, i);
  const body = cppLinesToASLStatements(bodyLines);

  const stmt: ASLStatement = {
    kind: 'while',
    condition: conditionExpr,
    body,
  };

  return { stmt, nextIndex: i };
}

function parseForBlock(
  lines: string[],
  startIndex: number
): { stmts: ASLStatement[]; nextIndex: number } {
  const headerRaw = lines[startIndex];
  const header = headerRaw.replace(/\/\/.*$/, '').trim();

  // Suporta: for (init; cond; inc) {
  const m = header.match(/^for\s*\((.+)\)\s*\{/);
  if (!m) {
    throw new Error('ASL v1: unsupported for header format');
  }

  const parts = m[1].split(';');
  if (parts.length !== 3) {
    throw new Error('ASL v1: for header must have 3 parts: init; cond; inc');
  }

  const initSrc = parts[0].trim();
  const condSrc = parts[1].trim();
  const incSrc = parts[2].trim();

  const resultStmts: ASLStatement[] = [];

  // init;
  if (initSrc) {
    const initStmts = cppLinesToASLStatements([initSrc + ';']);
    resultStmts.push(...initStmts);
  }

  // cond
  if (!condSrc) {
    throw new Error('ASL v1: for without condition not supported yet');
  }
  const conditionExpr = parseConditionExpr(condSrc);

  // Encontrar fim do bloco FOR/WHILE, respeitando blocos aninhados
  let braceCount = 1;
  let i = startIndex + 1;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\/\/.*$/, '');
    for (let j = 0; j < stripped.length; j++) {
      const ch = stripped[j];
      if (ch === '{') braceCount++;
      else if (ch === '}') braceCount--;
    }
    if (braceCount === 0) {
      break;
    }
  }

  if (braceCount !== 0) {
    throw new Error('ASL v1: unmatched braces in for block');
  }

  const bodyLines = lines.slice(startIndex + 1, i);
  const bodyStmts = cppLinesToASLStatements(bodyLines);

  // inc;
  let incStmts: ASLStatement[] = [];
  if (incSrc) {
    incStmts = cppLinesToASLStatements([incSrc + ';']);
  }

  const whileStmt: ASLStatement = {
    kind: 'while',
    condition: conditionExpr,
    body: [...bodyStmts, ...incStmts],
  };

  resultStmts.push(whileStmt);

  return { stmts: resultStmts, nextIndex: i };
}

function parseConditionExpr(src: string): ASLExpr {
  const trimmed = src.trim();

  // !EXPR -> unary not
  const notMatch = trimmed.match(/^!\s*(.+)$/);
  if (notMatch) {
    return {
      kind: 'unary',
      op: '!',
      expr: makeVarOrLiteral(notMatch[1].trim()),
    };
  }

  // Suporta: a == b, a != b, a < b, a <= b, a > b, a >= b
  const eqMatch = trimmed.match(/^(.+)==(.+)$/);
  if (eqMatch) {
    const leftToken = eqMatch[1].trim();
    const rightToken = eqMatch[2].trim();
    return {
      kind: 'binary',
      op: '==',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  const neqMatch = trimmed.match(/^(.+)!=(.+)$/);
  if (neqMatch) {
    const leftToken = neqMatch[1].trim();
    const rightToken = neqMatch[2].trim();
    return {
      kind: 'binary',
      op: '!=',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  const lteMatch = trimmed.match(/^(.+)<=(.+)$/);
  if (lteMatch) {
    const leftToken = lteMatch[1].trim();
    const rightToken = lteMatch[2].trim();
    return {
      kind: 'binary',
      op: '<=',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  const gteMatch = trimmed.match(/^(.+)>=(.+)$/);
  if (gteMatch) {
    const leftToken = gteMatch[1].trim();
    const rightToken = gteMatch[2].trim();
    return {
      kind: 'binary',
      op: '>=',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  const ltMatch = trimmed.match(/^(.+)<(.+)$/);
  if (ltMatch) {
    const leftToken = ltMatch[1].trim();
    const rightToken = ltMatch[2].trim();
    return {
      kind: 'binary',
      op: '<',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  const gtMatch = trimmed.match(/^(.+)>(.+)$/);
  if (gtMatch) {
    const leftToken = gtMatch[1].trim();
    const rightToken = gtMatch[2].trim();
    return {
      kind: 'binary',
      op: '>',
      left: makeVarOrLiteral(leftToken),
      right: makeVarOrLiteral(rightToken),
    };
  }

  // Fallback: trata expressão inteira como algo a ser convertido diretamente
  return makeVarOrLiteral(trimmed);
}

function makeVarOrLiteral(token: string): ASLExpr {
  const t = token.trim();

  // Constantes lógicas/Arduino comuns
  if (t === 'LOW') {
    return { kind: 'literal', value: 0 };
  }
  if (t === 'HIGH') {
    return { kind: 'literal', value: 1 };
  }
  if (t === 'true') {
    return { kind: 'literal', value: true };
  }
  if (t === 'false') {
    return { kind: 'literal', value: false };
  }

  const num = parseFloat(t);
  if (!Number.isNaN(num)) {
    return { kind: 'literal', value: num };
  }

  return { kind: 'var', name: t };
}
