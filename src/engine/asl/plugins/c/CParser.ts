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
            if (t.value === 'const') this.consume();

            // Detect Multi-word types (unsigned long, etc.)
            let offset = 0;
            if (this.peek(offset).value === 'const') offset++;

            let isFunc = false;
            let current = this.peek(offset);
            if (this.isType(current) || current.value === 'void') {
                offset++;
                while (this.isType(this.peek(offset))) offset++;
                if (this.peek(offset).type === 'IDENTIFIER' && this.peek(offset + 1).value === '(') {
                    isFunc = true;
                }
            }

            if (isFunc) {
                program.children.push(this.parseFunction());
            } else if (this.isType(this.peek()) || this.peek().value === 'const') {
                const decl = this.parseVarDecl();
                if (decl) program.children.push(decl);
            } else {
                this.consume();
            }
        }
        return { ast: program, symbols: this.symbols.getAllSymbols(), errors: this.semanticErrors };
    }

    private parseFunction(): BaseNode {
        let returnType = this.consume().value;
        while (this.isType(this.peek())) {
            returnType += ' ' + this.consume().value;
        }
        const name = this.consume().value;
        const line = this.peek(-2).line;

        this.consume('(');
        const params: { type: string, name: string }[] = [];
        this.symbols.pushScope();

        if (this.peek().value !== ')') {
            do {
                let pType = this.consume().value;
                while (this.isType(this.peek())) {
                    pType += ' ' + this.consume().value;
                }
                const pName = this.consume().value;
                params.push({ type: pType, name: pName });
                this.symbols.define(pName, pType, line);
            } while (this.peek().value === ',' && this.consume());
        }
        this.consume(')');

        this.consume('{');
        const funcNode: BaseNode = {
            nodeType: 'Function',
            id: `func-${name}`,
            attributes: { name, returnType, params },
            children: [],
            metadata: { line }
        };

        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement();
            if (stmt) funcNode.children.push(stmt);
        }

        this.consume('}');
        this.symbols.popScope();
        return funcNode;
    }

    private parseStatement(): BaseNode | null {
        const t = this.peek();
        const line = t.line;

        if (t.value === 'const') this.consume(); // ignore const

        if (t.value === 'if' || t.value === 'If') return this.parseIf();
        if (t.value === 'while') return this.parseWhile();
        if (t.value === 'for') return this.parseFor();
        if (t.value === 'return') {
            this.consume('return');
            const value = this.peek().value !== ';' ? this.parseExpression(0) : null;
            this.consume(';');
            return {
                nodeType: 'ReturnStatement',
                id: this.genId(),
                attributes: {},
                children: value ? [value] : [],
                metadata: { line }
            };
        }
        if (t.value === 'break') {
            this.consume('break');
            this.consume(';');
            return { nodeType: 'BreakStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
        }
        if (t.value === 'continue') {
            this.consume('continue');
            this.consume(';');
            return { nodeType: 'ContinueStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
        }
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
        if (this.peek().value === 'if') this.consume('if');
        else this.consume('If');
        this.consume('('); const condition = this.parseExpression(0); this.consume(')');

        let thenChildren: BaseNode[];
        if (this.peek().value === '{') {
            thenChildren = this.parseBlock();
        } else {
            const stmt = this.parseStatement();
            thenChildren = stmt ? [stmt] : [];
        }

        const thenBlock: BaseNode = {
            nodeType: 'Block',
            id: this.genId(),
            attributes: {},
            children: thenChildren,
            metadata: { line }
        };

        const children = [condition, thenBlock];

        if (this.peek().value === 'else') {
            this.consume('else');
            if (this.peek().value === 'if') {
                children.push(this.parseIf());
            } else {
                let elseChildren: BaseNode[];
                if (this.peek().value === '{') {
                    elseChildren = this.parseBlock();
                } else {
                    const stmt = this.parseStatement();
                    elseChildren = stmt ? [stmt] : [];
                }

                const elseBlock: BaseNode = {
                    nodeType: 'Block',
                    id: this.genId(),
                    attributes: {},
                    children: elseChildren,
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
        let body: BaseNode[];
        if (this.peek().value === '{') {
            body = this.parseBlock();
        } else {
            const stmt = this.parseStatement();
            body = stmt ? [stmt] : [];
        }
        return { nodeType: 'WhileLoop', id: this.genId(), attributes: {}, children: [condition, ...body], metadata: { line } };
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

        let body: BaseNode[];
        if (this.peek().value === '{') {
            body = this.parseBlock();
        } else {
            const stmt = this.parseStatement();
            body = stmt ? [stmt] : [];
        }
        this.symbols.popScope();
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
                // Allow identifiers or numbers as array sizes
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
            } else if (this.peek().value === '.') {
                const line = this.peek().line;
                this.consume('.');
                const member = this.consume().value;
                const meta = { line };
                if (this.peek().value === '(') {
                    this.consume('(');
                    const args: BaseNode[] = [];
                    if (this.peek().value !== ')') {
                        do {
                            if (this.peek().value === ')') break; // Handle trailing comma
                            args.push(this.parseExpression(0));
                        } while (this.peek().value === ',' && this.consume());
                    }
                    this.consume(')');
                    node = this.mapMethodCall(node, member, args, meta);
                } else {
                    node = { nodeType: 'MemberExpression', id: this.genId(), attributes: { property: member }, children: [node], metadata: meta };
                }
            } else if (this.peek().value === '[') {
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
        if (t.type === 'KEYWORD' && this.isType(t)) {
            return { nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: { line } };
        }
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
                if (this.peek().value !== ')') {
                    do {
                        if (this.peek().value === ')') break; // Handle trailing comma
                        args.push(this.parseExpression(0));
                    } while (this.peek().value === ',' && this.consume());
                }
                this.consume(')');

                const meta = { line };
                if (t.value === 'digitalWrite') return { nodeType: 'GpioSet', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'analogWrite') return { nodeType: 'AnalogWrite', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'delay') return { nodeType: 'DelayMs', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'digitalRead') return { nodeType: 'GpioRead', id: this.genId(), attributes: {}, children: args, metadata: meta };
                if (t.value === 'analogRead') return { nodeType: 'AnalogRead', id: this.genId(), attributes: {}, children: args, metadata: meta };

                return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: t.value }, children: args, metadata: meta };
            }

            this.symbols.markUsage(t.value);
            return { nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: { line } };
        }
        throw new Error(`Unexpected token '${t.value}' at line ${t.line}`);
    }

    private mapMethodCall(target: BaseNode, member: string, args: BaseNode[], meta: any): BaseNode {
        const objName = (target.nodeType === 'Identifier' ? target.attributes.name : null) as string;

        if (objName === 'Serial') {
            if (member === 'begin') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.begin' }, children: args, metadata: meta };
            if (member.startsWith('print')) return { nodeType: 'Print', id: this.genId(), attributes: { newline: member === 'println' }, children: args, metadata: meta };
        }
        if (objName === 'SPIFFS') {
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: `SPIFFS.${member}` }, children: args, metadata: meta };
        }
        if (objName === 'lcd') {
            if (member === 'clear') return { nodeType: 'LcdClear', id: this.genId(), attributes: {}, children: [], metadata: meta };
            if (member === 'setCursor') return { nodeType: 'LcdCursor', id: this.genId(), attributes: {}, children: args, metadata: meta };
            if (member.startsWith('print')) return { nodeType: 'LcdPrint', id: this.genId(), attributes: {}, children: args, metadata: meta };
        }
        // General fallback: use the target as the object in the callee name if possible
        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: objName ? `${objName}.${member}` : member }, children: args, metadata: meta };
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
