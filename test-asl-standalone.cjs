// test-asl-standalone.js (Runnable with node)
const fs = require('fs');
const path = require('path');

// Basic duplication of necessary logic from codeToASL.ts to avoid ESM/TS issues
function makeVarOrLiteral(token) {
    const t = token.trim();
    if (t === 'LOW') return { kind: 'literal', value: 0 };
    if (t === 'HIGH') return { kind: 'literal', value: 1 };
    if (t === 'true') return { kind: 'literal', value: true };
    if (t === 'false') return { kind: 'literal', value: false };
    const num = parseFloat(t);
    if (!Number.isNaN(num)) return { kind: 'literal', value: num };
    return { kind: 'var', name: t };
}

function parseConditionExpr(src) {
    const trimmed = src.trim();
    const eqMatch = trimmed.match(/^(.+)==(.+)$/);
    if (eqMatch) {
        return {
            kind: 'binary',
            op: '==',
            left: makeVarOrLiteral(eqMatch[1].trim()),
            right: makeVarOrLiteral(eqMatch[2].trim()),
        };
    }
    return makeVarOrLiteral(trimmed);
}

function cppLinesToASLStatements(lines) {
    const stmts = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.replace(/\/\/.*$/, '').trim();
        if (!line) continue;

        if (line.startsWith('if')) {
            const { stmt, nextIndex } = parseIfBlock(lines, i);
            stmts.push(stmt);
            i = nextIndex;
            continue;
        }

        if (line.match(/digitalWrite\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*;/)) {
            const m = line.match(/digitalWrite\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*;/);
            stmts.push({
                kind: 'digitalWrite',
                pin: makeVarOrLiteral(m[1]),
                value: (m[2] === 'HIGH' || m[2] === 'LOW') ? m[2] : makeVarOrLiteral(m[2])
            });
            continue;
        }

        if (line.match(/^(?:int|byte|long)\s+(\w+)\s*=\s*digitalRead\s*\(\s*(\w+)\s*\)\s*;/)) {
            const m = line.match(/^(?:int|byte|long)\s+(\w+)\s*=\s*digitalRead\s*\(\s*(\w+)\s*\)\s*;/);
            stmts.push({
                kind: 'read',
                mode: 'DIGITAL',
                pin: makeVarOrLiteral(m[2]),
                target: m[1]
            });
            continue;
        }
    }
    return stmts;
}

function parseIfBlock(lines, startIndex) {
    const header = lines[startIndex].replace(/\/\/.*$/, '').trim();
    const m = header.match(/^if\s*\((.+)\)\s*\{/);
    const conditionExpr = parseConditionExpr(m[1]);

    let braceCount = 1;
    let i = startIndex + 1;
    for (; i < lines.length; i++) {
        const stripped = lines[i].replace(/\/\/.*$/, '');
        for (let j = 0; j < stripped.length; j++) {
            if (stripped[j] === '{') braceCount++;
            else if (stripped[j] === '}') braceCount--;
        }
        if (braceCount === 0) break;
    }

    const thenLines = lines.slice(startIndex + 1, i);
    const thenBranch = cppLinesToASLStatements(thenLines);

    let elseBranch;
    let lastIndex = i;

    let elseIndex = i + 1;
    while (elseIndex < lines.length) {
        const nextLine = lines[elseIndex].replace(/\/\/.*$/, '').trim();
        if (!nextLine) { elseIndex++; continue; }

        if (nextLine.startsWith('else')) {
            const elseIfMatch = nextLine.match(/^else\s+if\s*\((.+)\)\s*\{/);
            if (elseIfMatch) {
                const patchedLines = [...lines];
                patchedLines[elseIndex] = lines[elseIndex].replace(/else\s+if/, 'if');
                const { stmt: nestedIf, nextIndex: nestedLastIndex } = parseIfBlock(patchedLines, elseIndex);
                elseBranch = [nestedIf];
                lastIndex = nestedLastIndex;
            } else {
                braceCount = 1;
                let j = elseIndex + 1;
                for (; j < lines.length; j++) {
                    const stripped = lines[j].replace(/\/\/.*$/, '');
                    for (let k = 0; k < stripped.length; k++) {
                        if (stripped[k] === '{') braceCount++;
                        else if (stripped[k] === '}') braceCount--;
                    }
                    if (braceCount === 0) break;
                }
                const elseLines = lines.slice(elseIndex + 1, j);
                elseBranch = cppLinesToASLStatements(elseLines);
                lastIndex = j;
            }
        }
        break;
    }

    return { stmt: { kind: 'if', condition: conditionExpr, thenBranch, elseBranch }, nextIndex: lastIndex };
}

const code = `
  int btnOnState  = digitalRead(BTN_ON);
  int btnOffState = digitalRead(BTN_OFF);

  if (btnOnState == LOW) {
    digitalWrite(LED_PIN, HIGH);
  }
  else if (btnOffState == LOW) {
    digitalWrite(LED_PIN, LOW);
  }
`;

const result = cppLinesToASLStatements(code.split('\n'));
console.log(JSON.stringify(result, null, 2));
