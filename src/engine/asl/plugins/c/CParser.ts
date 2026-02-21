import { Lexer } from '@/system/Lexer';
import type { Token } from '@/system/Lexer';
import { SymbolTable } from '@/system/SymbolTable';
import type { ProgramNode, BaseNode, AnalysisIssue, Symbol } from '@/system/types';

export class RecursiveDescentCParser {
    private tokens: Token[] = []; private pos: number = 0;
    private symbols = new SymbolTable(); private semanticErrors: AnalysisIssue[] = [];

    private isType(token: Token): boolean {
        return token.type === 'KEYWORD' && [
            'int', 'float', 'bool', 'boolean', 'String', 'File', 'char', 'byte', 'short', 'long',
            'unsigned', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t'
        ].includes(token.value);
    }

    parse(code: string): { ast: ProgramNode, symbols: Symbol[], errors: AnalysisIssue[] } {
        this.tokens = new Lexer(code).tokenize(); this.pos = 0;
        this.symbols = new SymbolTable(); this.semanticErrors = [];
        const program: ProgramNode = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
        while (this.peek().type !== 'EOF') {
            const t = this.peek();
            if (t.value === 'const') this.consume(); // ignore const for now

            if (this.peek().value === 'void') program.children.push(this.parseFunction());
            else if (this.isType(this.peek())) {
                const decl = this.parseVarDecl(); if (decl) program.children.push(decl);
            } else {
                // Skip unknown tokens at top level to recover
                this.consume();
            }
        }
        return { ast: program, symbols: this.symbols.getAllSymbols(), errors: this.semanticErrors };
    }

    private parseFunction(): BaseNode {
        this.consume('void'); const name = this.consume().value;
        const line = this.peek(-2).line;
        this.consume('('); this.consume(')'); this.consume('{');
        this.symbols.pushScope();
        const funcNode: BaseNode = { nodeType: 'Function', id: `func-${name}`, attributes: { name }, children: [], metadata: { line } };
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement(); if (stmt) funcNode.children.push(stmt);
        }
        this.consume('}'); this.symbols.popScope();
        return funcNode;
    }

    private parseStatement(): BaseNode | null {
        const t = this.peek();
        const line = t.line;

        if (t.value === 'const') this.consume(); // ignore const

        if (t.value === 'if') return this.parseIf();
        if (t.value === 'while') return this.parseWhile();
        if (t.value === 'for') return this.parseFor();
        if (this.isType(t)) return this.parseVarDecl();
        if (t.value === ';') { this.consume(); return null; }
        if (t.value === '}') return null;

        // Expression Statement (Assignments, Calls, Postfix ops)
        const expr = this.parseExpression(0);
        this.consume(';');
        return { nodeType: 'ExpressionStatement', id: this.genId(), attributes: {}, children: [expr], metadata: { line } };
    }

    private parseBlock(): BaseNode[] {
        this.consume('{'); this.symbols.pushScope();
        const nodes: BaseNode[] = [];
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement(); if (stmt) nodes.push(stmt);
        }
        this.consume('}'); this.symbols.popScope();
        return nodes;
    }

    private parseIf(): BaseNode {
        const line = this.peek().line;
        this.consume('if'); this.consume('('); const condition = this.parseExpression(0); this.consume(')');

        const thenBlock: BaseNode = {
            nodeType: 'Block',
            id: this.genId(),
            attributes: {},
            children: this.parseBlock(),
            metadata: { line }
        };

        const children = [condition, thenBlock];

        if (this.peek().value === 'else') {
            this.consume('else');
            if (this.peek().value === 'if') {
                children.push(this.parseIf());
            } else {
                const elseBlock: BaseNode = {
                    nodeType: 'Block',
                    id: this.genId(),
                    attributes: {},
                    children: this.parseBlock(),
                    metadata: { line: this.peek().line }
                };
                children.push(elseBlock);
            }
        }
        return { nodeType: 'IfStatement', id: this.genId(), attributes: {}, children: children, metadata: { line } };
    }

    private parseWhile(): BaseNode {
        const line = this.peek().line;
        this.consume('while'); this.consume('('); const condition = this.parseExpression(0); this.consume(')');
        return { nodeType: 'WhileLoop', id: this.genId(), attributes: {}, children: [condition, ...this.parseBlock()], metadata: { line } };
    }

    private parseFor(): BaseNode {
        const line = this.peek().line;
        this.consume('for'); this.consume('('); this.symbols.pushScope();
        let init: BaseNode | null = null;
        if (this.peek().type === 'KEYWORD') init = this.parseVarDecl();
        else if (this.peek().type === 'IDENTIFIER') init = this.parseStatement();
        else this.consume(';');
        const condition = this.peek().value !== ';' ? this.parseExpression(0) : { nodeType: 'Literal', id: 'true', attributes: { value: 1 }, children: [] };
        this.consume(';');
        const update = this.peek().value !== ')' ? this.parseExpression(0) : null;
        this.consume(')');
        const body = this.parseBlock(); this.symbols.popScope();
        return { nodeType: 'ForLoop', id: this.genId(), attributes: { hasInit: !!init, hasUpdate: !!update }, children: [...(init ? [init] : []), condition as BaseNode, ...(update ? [update as BaseNode] : []), ...body], metadata: { line } };
    }

    private parseVarDecl(): BaseNode {
        const line = this.peek().line;
        let type = this.consume().value;

        while (this.isType(this.peek()) && this.peek().type === 'KEYWORD') {
            type += ' ' + this.consume().value;
        }

        const name = this.consume().value;
        if (!this.symbols.define(name, type, this.peek().line))
            this.semanticErrors.push({ severity: 'WARNING', message: `Redeclaration of '${name}'` });

        // Detectar declaração de array: int arr[N]
        let isArray = false;
        let arraySize: number | null = null;
        if (this.peek().value === '[') {
            isArray = true;
            this.consume('[');
            if (this.peek().value !== ']') {
                const sizeTok = this.consume();
                arraySize = parseFloat(sizeTok.value) || null;
            }
            this.consume(']');
        }

        let value: BaseNode = {
            nodeType: 'Literal',
            id: this.genId(),
            attributes: { value: isArray ? [] : 0 },
            children: [],
        };

        if (this.peek().value === '=') {
            this.consume('=');
            if (isArray && this.peek().value === '{') {
                // Inicializador de array: = { 3, 5, 6, 9 }
                this.consume('{');
                const elements: BaseNode[] = [];
                while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
                    elements.push(this.parseExpression(0));
                    if (this.peek().value === ',') this.consume(',');
                }
                this.consume('}');
                value = {
                    nodeType: 'ArrayInitializer',
                    id: this.genId(),
                    attributes: { size: arraySize },
                    children: elements,
                };
            } else {
                value = this.parseExpression(0);
            }
        } else if (isArray) {
            // Array sem inicializador: preencher com zeros
            const size = arraySize ?? 0;
            value = {
                nodeType: 'ArrayInitializer',
                id: this.genId(),
                attributes: { size },
                children: Array.from({ length: size }, () => ({
                    nodeType: 'Literal',
                    id: this.genId(),
                    attributes: { value: 0 },
                    children: [],
                })),
            };
        }

        this.consume(';');
        return {
            nodeType: 'VariableDeclaration',
            id: this.genId(),
            attributes: { name, type, isArray, arraySize },
            children: [value],
            metadata: { line },
        };
    }

    private parseExpression(minPrec: number): BaseNode {
        let left = this.parsePrefix();
        while (true) {
            const t = this.peek();
            // '}' adicionado: impede consumo do fecho do ArrayInitializer
            if (t.type === 'EOF' || [';', ')', ',', ']', '}'].includes(t.value)) break;
            const prec = this.getPrecedence(t.value);
            if (prec < minPrec) break;
            const op = this.consume().value;
            const right = this.parseExpression(prec);
            left = { nodeType: 'BinaryExpression', id: this.genId(), attributes: { operator: op }, children: [left, right], metadata: { line: t.line } };
        }
        return left;
    }

    private parsePrefix(): BaseNode {
        const t = this.peek();
        if (['!', '-', '~'].includes(t.value)) {
            this.consume();
            const right = this.parsePrefix();
            return { nodeType: 'UnaryExpression', id: this.genId(), attributes: { operator: t.value, prefix: true }, children: [right], metadata: { line: t.line } };
        }
        return this.parsePostfix();
    }

    private parsePostfix(): BaseNode {
        let node = this.parseAtom();
        while (true) {
            if (this.peek().value === '++' || this.peek().value === '--') {
                const op = this.consume().value;
                node = {
                    nodeType: 'UnaryExpression',
                    id: this.genId(),
                    attributes: { operator: op, prefix: false },
                    children: [node],
                    metadata: { line: node.metadata?.line },
                };
            } else if (this.peek().value === '[') {
                // Subscript: arr[expr] — encadeável (ex: matriz[i][j])
                const line = this.peek().line;
                this.consume('[');
                const index = this.parseExpression(0);
                this.consume(']');
                node = {
                    nodeType: 'SubscriptExpression',
                    id: this.genId(),
                    attributes: {},
                    children: [node, index],
                    metadata: { line },
                };
            } else {
                break;
            }
        }
        return node;
    }

    private parseAtom(): BaseNode {
        const t = this.consume();
        const line = t.line;
        if (t.type === 'NUMBER') return { nodeType: 'Literal', id: this.genId(), attributes: { value: parseFloat(t.value) }, children: [], metadata: { line } };
        if (t.type === 'STRING') return { nodeType: 'Literal', id: this.genId(), attributes: { value: t.value, isString: true }, children: [], metadata: { line } };
        if (t.value === '(') { const expr = this.parseExpression(0); this.consume(')'); return expr; }

        if ([
            'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP',
            'WL_CONNECTED', 'WL_IDLE_STATUS', 'FILE_WRITE', 'FILE_READ', 'FILE_APPEND',
        ].includes(t.value)) {
            let v: any = 0;
            if (t.value === 'true' || t.value === 'HIGH') v = 1;
            if (t.value === 'false' || t.value === 'LOW') v = 0;
            if (t.value === 'INPUT') v = 0;
            if (t.value === 'OUTPUT') v = 1;
            if (t.value === 'INPUT_PULLUP') v = 2;
            if (t.value === 'WL_CONNECTED') v = 3;
            if (t.value === 'FILE_WRITE') v = 'w';
            if (t.value === 'FILE_READ') v = 'r';
            if (t.value === 'FILE_APPEND') v = 'a';
            return { nodeType: 'Literal', id: this.genId(), attributes: { value: v, isString: typeof v === 'string' }, children: [], metadata: { line } };
        }

        if (t.type === 'IDENTIFIER') {
            if (this.peek().value === '(') {
                this.consume('('); const args: BaseNode[] = [];
                if (this.peek().value !== ')') { do { args.push(this.parseExpression(0)); } while (this.peek().value === ',' && this.consume()); }
                this.consume(')');

                const meta = { line };
                if (t.value === 'digitalWrite') return { nodeType: 'GpioSet', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'analogWrite') return { nodeType: 'AnalogWrite', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'servo') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'servo' }, children: args, metadata: meta };
                if (t.value === 'tone') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'tone' }, children: args, metadata: meta };
                if (t.value === 'noTone') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'noTone' }, children: args, metadata: meta };
                if (t.value === 'delay') return { nodeType: 'DelayMs', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'digitalRead') return { nodeType: 'GpioRead', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'analogRead') return { nodeType: 'AnalogRead', id: this.genId(), attributes: {}, children: args, metadata: meta };

                return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: t.value }, children: args, metadata: meta };
            }

            if (this.peek().value === '.') {
                this.consume('.'); const member = this.consume().value;
                const meta = { line };

                // SPIFFS
                if (t.value === 'SPIFFS') {
                    if (member === 'begin') { this.consume('('); this.consume(')'); return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.begin' }, children: [], metadata: meta }; }
                    if (member === 'remove') { this.consume('('); const p = this.parseExpression(0); this.consume(')'); return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.remove' }, children: [p], metadata: meta }; }
                    if (member === 'open') {
                        this.consume('(');
                        const path = this.parseExpression(0); this.consume(',');
                        const mode = this.parseExpression(0);
                        this.consume(')');
                        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.open' }, children: [path, mode], metadata: meta };
                    }
                }

                if (['println', 'print', 'write'].includes(member)) {
                    this.consume('('); const arg = this.parseExpression(0); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.write', varName: t.value, newLine: member === 'println' }, children: [arg], metadata: meta };
                }
                if (member === 'readString') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.readString', varName: t.value }, children: [], metadata: meta };
                }
                if (member === 'close') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.close', varName: t.value }, children: [], metadata: meta };
                }

                // Serial — todos os métodos
                if (t.value === 'Serial') {
                    if (member === 'begin') {
                        this.consume('(');
                        if (this.peek().value !== ')') { this.parseExpression(0); }
                        this.consume(')');
                        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.begin' }, children: [], metadata: meta };
                    }
                    if (member.startsWith('print')) {
                        const newline = member === 'println';
                        this.consume('(');
                        const hasArg = this.peek().value !== ')';
                        const arg = hasArg ? this.parseExpression(0) : null;
                        this.consume(')');
                        return {
                            nodeType: 'Print',
                            id: this.genId(),
                            attributes: { newline },
                            children: arg ? [arg] : [],
                            metadata: meta,
                        };
                    }
                    if (member === 'available') {
                        this.consume('('); this.consume(')');
                        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.available' }, children: [], metadata: meta };
                    }
                    if (member === 'readString') {
                        this.consume('('); this.consume(')');
                        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.readString' }, children: [], metadata: meta };
                    }
                    // Fallback genérico para outros métodos Serial não mapeados
                    if (this.peek().value === '(') {
                        this.consume('(');
                        const args2: BaseNode[] = [];
                        if (this.peek().value !== ')') { do { args2.push(this.parseExpression(0)); } while (this.peek().value === ',' && this.consume()); }
                        this.consume(')');
                        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: `Serial.${member}` }, children: args2, metadata: meta };
                    }
                }

                if (t.value === 'lcd' && member.startsWith('print')) {
                    this.consume('('); const arg = this.parseExpression(0); this.consume(')');
                    return { nodeType: 'LcdPrint', id: this.genId(), attributes: {}, children: [arg], metadata: meta };
                }
                if (t.value === 'lcd' && member === 'clear') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'LcdClear', id: this.genId(), attributes: {}, children: [], metadata: meta };
                }
                if (t.value === 'lcd' && member === 'setCursor') {
                    this.consume('('); const col = this.parseExpression(0); this.consume(','); const row = this.parseExpression(0); this.consume(')');
                    return { nodeType: 'LcdCursor', id: this.genId(), attributes: {}, children: [col, row], metadata: meta };
                }
                if (t.value === 'oled' && member === 'text') {
                    this.consume('(');
                    const str = this.parseExpression(0); this.consume(',');
                    const x = this.parseExpression(0); this.consume(',');
                    const y = this.parseExpression(0); this.consume(',');
                    const c = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'OledText', id: this.genId(), attributes: {}, children: [str, x, y, c], metadata: meta };
                }
                if (t.value === 'oled' && member === 'show') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'OledShow', id: this.genId(), attributes: {}, children: [], metadata: meta };
                }
                if (t.value === 'oled' && member === 'clear') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'OledClear', id: this.genId(), attributes: {}, children: [], metadata: meta };
                }
                if (t.value === 'dht' && member === 'readTemperature') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'dht.readTemp' }, children: [], metadata: meta };
                }
                if (t.value === 'dht' && member === 'readHumidity') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'dht.readHum' }, children: [], metadata: meta };
                }
                if (t.value === 'ultrasonic' && member === 'read') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ultrasonic.read' }, children: [], metadata: meta };
                }
                if (t.value === 'ldr' && member === 'read') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ldr.read' }, children: [], metadata: meta };
                }
                if (t.value === 'ir' && member === 'read') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ir.read' }, children: [], metadata: meta };
                }
                if (t.value === 'motors' && member === 'move') {
                    this.consume('(');
                    const l = this.parseExpression(0); this.consume(',');
                    const r = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'motors.move' }, children: [l, r], metadata: meta };
                }
                if (t.value === 'mpu' && member.startsWith('get')) {
                    this.consume('('); this.consume(')');
                    const axis = member.replace('get', '');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'mpu.get', axis }, children: [], metadata: meta };
                }
                if (t.value === 'rgb' && member === 'setColor') {
                    this.consume('(');
                    const r = this.parseExpression(0); this.consume(',');
                    const g = this.parseExpression(0); this.consume(',');
                    const b = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'rgb.setColor' }, children: [r, g, b], metadata: meta };
                }
                if (t.value === 'neopixel' && member === 'setPixelColor') {
                    this.consume('(');
                    const i = this.parseExpression(0); this.consume(',');
                    const r = this.parseExpression(0); this.consume(',');
                    const g = this.parseExpression(0); this.consume(',');
                    const b = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'neopixel.set' }, children: [i, r, g, b], metadata: meta };
                }
                if (t.value === 'neopixel' && member === 'show') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'neopixel.show' }, children: [], metadata: meta };
                }
                if (t.value === 'neopixel' && member === 'clear') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'neopixel.clear' }, children: [], metadata: meta };
                }
                if (t.value === 'keypad' && member === 'getKey') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'KeypadRead', id: this.genId(), attributes: {}, children: [], metadata: meta };
                }
                if (t.value === 'WiFi' && member === 'begin') {
                    this.consume('(');
                    const ssid = this.parseExpression(0); this.consume(',');
                    const pass = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'WiFi.begin' }, children: [ssid, pass], metadata: meta };
                }
                if (t.value === 'WiFi' && member === 'status') {
                    this.consume('('); this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'WiFi.status' }, children: [], metadata: meta };
                }
                if (t.value === 'HTTP' && member === 'get') {
                    this.consume('(');
                    const url = this.parseExpression(0);
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'HTTP.get' }, children: [url], metadata: meta };
                }

                // Fallback genérico para obj.method() não mapeados
                if (this.peek().value === '(') {
                    this.consume('(');
                    const args2: BaseNode[] = [];
                    if (this.peek().value !== ')') { do { args2.push(this.parseExpression(0)); } while (this.peek().value === ',' && this.consume()); }
                    this.consume(')');
                    return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: `${t.value}.${member}` }, children: args2, metadata: meta };
                }

                // obj.property (sem chamada)
                return { nodeType: 'MemberExpression', id: this.genId(), attributes: { property: member }, children: [{ nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: meta }], metadata: meta };
            }

            this.symbols.markUsage(t.value);
            return { nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: { line } };
        }
        throw new Error(`Unexpected token '${t.value}' at line ${t.line}`);
    }

    private getPrecedence(op: string): number {
        if (op === '=' || op === '+=' || op === '-=') return 1;
        if (['||'].includes(op)) return 2;
        if (['&&'].includes(op)) return 3;
        if (['==', '!='].includes(op)) return 4;
        if (['<', '>', '<=', '>='].includes(op)) return 5;
        if (['+', '-'].includes(op)) return 6;
        if (['*', '/', '%'].includes(op)) return 7;
        return 0;
    }
    private consume(e?: string): Token {
        const t = this.tokens[this.pos];
        if (e && t.value !== e) {
            throw new Error(`Expected '${e}' but found '${t.value}' at line ${t.line}`);
        }
        this.pos++; return t;
    }
    private peek(o: number = 0): Token { return this.tokens[this.pos + o] || { type: 'EOF', value: 'EOF', line: 0 }; }
    private genId() { return Math.random().toString(36).substring(7); }
}
