import { Lexer } from '@/system/Lexer';
import type { Token } from '@/system/Lexer';
import { SymbolTable } from '@/system/SymbolTable';
import type { ProgramNode, BaseNode, AnalysisIssue, Symbol } from '@/system/types';

export class RecursiveDescentCParser {
    private tokens: Token[] = []; private pos: number = 0;
    private symbols = new SymbolTable(); private semanticErrors: AnalysisIssue[] = [];
    private pendingComments: { comment: string; line: number }[] = [];
    private libraries: { name: string; content: string }[] = [];
    private parsedHeaders = new Set<string>();
    private systemHeaders = new Set(['Arduino.h', 'Wire.h', 'SPI.h', 'SoftwareSerial.h', 'EEPROM.h', 'Servo.h', 'HID.h']);

    public setLibraries(libs: { name: string; content: string }[]) {
        this.libraries = libs;
    }

    private isType(token: Token): boolean {
        if (!token) return false;
        if (token.type === 'KEYWORD' && [
            'void', 'int', 'float', 'bool', 'boolean', 'String', 'File', 'char', 'byte', 'short', 'long',
            'unsigned', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t'
        ].includes(token.value)) return true;

        // Dynamic types (like enums and structs/classes)
        if (token.type === 'IDENTIFIER') {
            const sym = this.symbols.resolve(token.value);
            const isT = sym?.type === 'type' || sym?.type === 'struct' || sym?.type === 'class';
            if (isT) console.log(`[CParser] ID ${token.value} recognized as type`);
            return isT;
        }
        return false;
    }

    private isFunctionDecl(): boolean {
        const current = this.peek();
        if (!this.isType(current)) return false;

        let offset = 1;
        while (this.isType(this.peek(offset))) offset++;
        if (this.peek(offset).type !== 'IDENTIFIER') return false;
        if (this.peek(offset + 1).value !== '(') return false;

        // Check if it looks like a function declaration: Type name(Type1, ...)
        // vs a constructor call: Type name(expr, ...)
        // We look at the first thing after '('
        const afterParen = this.peek(offset + 2);
        if (afterParen.value === ')') return true; // void f() is always a function
        
        // If it's a known type keyword, it's likely a function
        if (afterParen.type === 'KEYWORD' && this.isType(afterParen)) return true;
        
        // If it's an identifier, it could be a type or a variable name.
        // This is the hard part. For simplicity, if we follow it with another identifier, it's a type.
        if (afterParen.type === 'IDENTIFIER' && this.isType(afterParen)) {
             // If next is another identifier or '*', it's definitely a function param
             const next = this.peek(offset + 3);
             if (next.type === 'IDENTIFIER' || next.value === '*') return true;
        }

        return false;
    }

    parse(code: string, isRoot: boolean = true): { ast: ProgramNode, symbols: Symbol[], errors: AnalysisIssue[] } {
        if (isRoot) {
            this.symbols = new SymbolTable();
            this.semanticErrors = [];
            this.parsedHeaders.clear();
        }

        // Handle #include before lexing
        const includeRegex = /#include\s+["<]([^">]+)[">]/g;
        let match;
        while ((match = includeRegex.exec(code)) !== null) {
            const headerName = match[1];
            if (!this.parsedHeaders.has(headerName)) {
                console.log(`[CParser] Resolving include: ${headerName}`);
                console.log(`[CParser] Total libraries available: ${this.libraries.length}`);
                if (this.libraries.length > 0) {
                    console.log(`[CParser] Library names: ${this.libraries.map(l => l.name).join(', ')}`);
                }
                const lib = this.libraries.find(l => 
                    l.name === headerName || 
                    l.name === headerName.replace(/\.h$/, '.cpp') ||
                    l.name.toLowerCase() === headerName.toLowerCase() ||
                    l.name.endsWith('/' + headerName)
                );
                if (lib) {
                    console.log(`[CParser] Found library file: ${lib.name}`);
                    this.parsedHeaders.add(headerName);
                    // Recursively parse the library content
                    this.parse(lib.content, false);
                } else if (!this.systemHeaders.has(headerName)) {
                    console.warn(`[CParser] Could not find library for: ${headerName}`);
                } else {
                    console.log(`[CParser] Skipping system header: ${headerName}`);
                }
            }
        }

        const lexer = new Lexer(code);
        const allTokens = lexer.tokenize();

        this.pendingComments = [];
        const filteredTokens: Token[] = [];
        for (const token of allTokens) {
            if (token.type === 'COMMENT') {
                this.pendingComments.push({ comment: token.value, line: token.line });
            } else if (token.type === 'KEYWORD' && ['public', 'private', 'protected'].includes(token.value)) {
                // Skip access specifiers for simplicity
                continue;
            } else if (token.value === ':') {
                // Skip colons if they follow an access specifier
                if (filteredTokens.length > 0 && ['public', 'private', 'protected'].includes(allTokens[allTokens.indexOf(token) - 1]?.value)) {
                    continue;
                }
                filteredTokens.push(token);
            } else {
                filteredTokens.push(token);
            }
        }

        const oldTokens = this.tokens;
        const oldPos = this.pos;

        this.tokens = filteredTokens; this.pos = 0;
        
        const program: ProgramNode = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
        try {
            while (this.peek().type !== 'EOF') {
                const t = this.peek();

                if (t.value === 'enum') {
                    program.children.push(this.parseEnum());
                } else if ((t.value === 'struct' || t.value === 'class') && this.peek(1)?.type === 'IDENTIFIER' && this.peek(2)?.value === '{') {
                    const decl = this.parseStruct();
                    if (decl) program.children.push(decl);
                } else if (t.value === 'void' || this.isFunctionDecl()) {
                    program.children.push(this.parseFunction());
                } else if (
                    this.isType(t) || 
                    ['struct', 'class', 'extern', 'std', 'const', 'static', 'volatile'].includes(t.value)
                ) {
                    const decl = this.parseVarDecl(); 
                    if (decl) {
                        console.log(`[CParser] Parsed VarDecl: ${decl.attributes.name} of type ${decl.attributes.type}`);
                        program.children.push(decl);
                    }
                } else {
                    this.consume();
                }
            }
        } catch (e: any) {
            console.error(`[CParser] Fatal error during parsing at line ${this.peek().line}:`, e);
            this.semanticErrors.push({ severity: 'CRITICAL', message: `Parser crashed: ${e.message}`, line: this.peek().line });
        }

        this.tokens = oldTokens;
        this.pos = oldPos;

        return { ast: program, symbols: this.symbols.getAllSymbols(), errors: this.semanticErrors };
    }

    private parseEnum(): BaseNode {
        this.consume('enum');
        const name = this.consume().value;
        this.symbols.define(name, 'type', this.peek(-1).line);
        this.consume('{');
        let val = 0;
        const members: { name: string, value: number }[] = [];
        do {
            if (this.peek().value === '}') break;
            const mName = this.consume().value;
            if (this.peek().value === '=') {
                this.consume('=');
                val = parseInt(this.consume().value);
            }
            members.push({ name: mName, value: val });
            this.symbols.define(mName, 'int', this.peek(-1).line, val++);
        } while (this.peek().value === ',' && this.consume());
        this.consume('}');
        if (this.peek().value === ';') this.consume(';');
        return { nodeType: 'EnumDeclaration', id: this.genId(), attributes: { name, members }, children: [] };
    }

    private parseStruct(): BaseNode | null {
        const line = this.peek().line;
        const kind = this.consume().value; // 'struct' or 'class'
        const name = this.consume().value;
        this.symbols.define(name, kind, line);
        this.consume('{');
        const fields: { type: string; name: string }[] = [];
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const t = this.peek();
            
            if (t.type === 'KEYWORD' && ['public', 'private', 'protected'].includes(t.value)) {
                this.consume();
                if (this.peek().value === ':') this.consume();
                continue;
            }

            if (this.isType(t) || t.value === 'struct' || t.value === 'class') {
                const typeLine = this.peek().line;
                let type = this.consume().value;
                
                // Handle std:: or other namespaces
                if (type === 'std' && this.peek().value === '::') {
                    this.consume('::');
                    type = this.consume().value;
                }

                while (this.peek().value === '::') {
                    this.consume('::');
                    type += '::' + this.consume().value;
                }

                while (this.isType(this.peek()) && this.peek().type === 'KEYWORD') {
                    type += ' ' + this.consume().value;
                }
                while (this.peek().value === '*') {
                    type += '*';
                    this.consume();
                }
                
                if (this.peek().type !== 'IDENTIFIER') {
                    // Might be a constructor or something we don't handle
                    this.skipToNextMember();
                    continue;
                }

                const fName = this.consume().value;
                
                // Handle method declaration vs variable
                if (this.peek().value === '(') {
                    // It's a method, skip it
                    this.skipToNextMember();
                } else {
                    if (this.peek().value === ';') this.consume();
                    fields.push({ type: type, name: fName });
                    this.symbols.define(fName, type, typeLine);
                }
            } else if (t.value === name && this.peek(1)?.value === '(') {
                // Constructor, skip it
                this.skipToNextMember();
            } else {
                this.consume();
            }
        }
        this.consume('}');
        let inlineInstance: string | null = null;
        if (this.peek().type === 'IDENTIFIER') {
            inlineInstance = this.consume().value;
        }
        if (this.peek().value === ';') this.consume(';');
        return {
            nodeType: 'StructDeclaration',
            id: this.genId(),
            attributes: { name, fields, inlineInstance, isClass: kind === 'class' },
            children: [],
            metadata: { line },
        };
    }

    private skipToNextMember() {
        let braceLevel = 0;
        let parenLevel = 0;
        while (this.peek().type !== 'EOF') {
            const v = this.peek().value;
            if (v === ';' && braceLevel === 0 && parenLevel === 0) {
                this.consume();
                break;
            }
            if (v === ':') {
                // Potential initializer list or access specifier
                if (braceLevel === 0 && parenLevel === 0 && this.peek(1)?.type === 'IDENTIFIER') {
                    // Skip to next { or ;
                    while (this.peek().type !== 'EOF' && this.peek().value !== '{' && this.peek().value !== ';') {
                        this.consume();
                    }
                    continue;
                }
            }
            if (v === '(') parenLevel++;
            if (v === ')') parenLevel--;
            if (v === '{') braceLevel++;
            if (v === '}') {
                braceLevel--;
                if (braceLevel === 0) {
                    this.consume();
                    break;
                }
            }
            this.consume();
        }
    }

    private parseFunction(): BaseNode {
        let returnType = this.consume().value;
        if (returnType === 'std' && this.peek().value === '::') {
            this.consume('::');
            returnType = 'std::' + this.consume().value;
        }
        while (this.peek().value === '::') {
            this.consume('::');
            returnType += '::' + this.consume().value;
        }
        while (this.isType(this.peek()) && this.peek().type === 'KEYWORD') returnType += ' ' + this.consume().value;
        while (this.peek().value === '*') { returnType += '*'; this.consume(); }

        const name = this.consume().value;
        const line = this.peek(-1).line;
        console.log(`[CParser] Starting to parse function: ${name} at line ${line}`);


        this.consume('(');
        const params: { type: string, name: string }[] = [];
        this.symbols.pushScope();

        if (this.peek().value !== ')') {
            do {
                if (this.peek().value === ')') break;
                let pType = this.consume().value;
                if (pType === 'std' && this.peek().value === '::') {
                    this.consume('::');
                    pType = 'std::' + this.consume().value;
                }
                while (this.peek().value === '::') {
                    this.consume('::');
                    pType += '::' + this.consume().value;
                }
                while (this.isType(this.peek()) && this.peek().type === 'KEYWORD') pType += ' ' + this.consume().value;
                while (this.peek().value === '*') { pType += '*'; this.consume(); }
                const pName = this.consume().value;
                params.push({ type: pType, name: pName });
                this.symbols.define(pName, pType, line); // Define parameter in current scope
                if (this.peek().value === '[') { this.consume('['); this.consume(']'); } // Handle array parameters
                console.log(`[CParser] Parsed parameter: ${pName} of type ${pType}`);
            } while (this.peek().value === ',' && this.consume());
        }
        if (this.peek().value !== ')') {
            console.error(`[CParser] Expected ')' in function ${name} but found '${this.peek().value}' at line ${this.peek().line}`);
        }
        this.consume(')');
        this.consume('{');

        const funcNode: BaseNode = {
            nodeType: 'Function',
            id: `func-${name}`,
            attributes: { name, returnType, params },
            children: [],
            metadata: { line },
        };
        this.attachComments(funcNode);
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement(); if (stmt) funcNode.children.push(stmt);
        }
        this.consume('}'); this.symbols.popScope();
        return funcNode;
    }

    private parseStatement(): BaseNode | null {
        const t = this.peek();
        const line = t.line;


        if (t.value === 'const') this.consume();

        if (t.value === 'if') return this.parseIf();
        if (t.value === 'while') return this.parseWhile();
        if (t.value === 'for') return this.parseFor();
        if (t.value === 'switch') return this.parseSwitch();
        if (t.value === 'do') return this.parseDoWhile();

        if (t.value === 'break') {
            this.consume('break');
            if (this.peek().value === ';') this.consume(';');
            const node: BaseNode = { nodeType: 'BreakStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        if (t.value === 'continue') {
            this.consume('continue');
            if (this.peek().value === ';') this.consume(';');
            const node: BaseNode = { nodeType: 'ContinueStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
            this.attachComments(node);
            return node;
        }

        if (t.value === 'return') {
            this.consume('return');
            if (this.peek().value === ';') {
                this.consume(';');
                const node: BaseNode = { nodeType: 'ReturnStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
                this.attachComments(node);
                return node;
            }
            const val = this.parseExpression(0);
            this.consume(';');
            const node: BaseNode = { nodeType: 'ReturnStatement', id: this.genId(), attributes: {}, children: [val], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        if (this.isType(t) || ['struct', 'extern', 'static', 'volatile', 'std'].includes(t.value)) {
            // Disambiguate: struct variable usage (p.x, p[0], p = ...) vs declaration (Point p)
            if (t.type === 'IDENTIFIER') {
                const next = this.peek(1);
                if (['.', '->', '[', '=', '+=', '-=', '*=', '/=', '++', '--'].includes(next.value)) {
                    // This is variable usage, not a type declaration — fall through to expression
                } else {
                    return this.parseVarDecl();
                }
            } else {
                return this.parseVarDecl();
            }
        }
        if (t.value === ';') { this.consume(); return null; }
        if (t.value === '{') {
            const node: BaseNode = { nodeType: 'Block', id: this.genId(), attributes: {}, children: this.parseBlock(), metadata: { line } };
            this.attachComments(node);
            return node;
        }
        if (t.value === '}') return null;

        const expr = this.parseExpression(0);
        this.consume(';');
        const node: BaseNode = { nodeType: 'ExpressionStatement', id: this.genId(), attributes: {}, children: [expr], metadata: { line } };
        this.attachComments(node);
        return node;
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

    private parseSwitch(): BaseNode {
        const line = this.peek().line;
        this.consume('switch');
        this.consume('(');
        const discriminant = this.parseExpression(0);
        this.consume(')');
        this.consume('{');

        const cases: { test: BaseNode | null, body: BaseNode[] }[] = [];

        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            if (this.peek().value === 'case') {
                this.consume('case');
                const test = this.parseExpression(0);
                this.consume(':');
                const body: BaseNode[] = [];
                while (!['case', 'default', '}'].includes(this.peek().value) && this.peek().type !== 'EOF') {
                    const s = this.parseStatement();
                    if (s) body.push(s);
                }
                cases.push({ test, body });
            } else if (this.peek().value === 'default') {
                this.consume('default');
                this.consume(':');
                const body: BaseNode[] = [];
                while (!['case', 'default', '}'].includes(this.peek().value) && this.peek().type !== 'EOF') {
                    const s = this.parseStatement();
                    if (s) body.push(s);
                }
                cases.push({ test: null, body });
            } else {
                this.consume();
            }
        }
        this.consume('}');

        const caseNodes: BaseNode[] = cases.map((c) => ({
            nodeType: 'CaseClause',
            id: this.genId(),
            attributes: { isDefault: c.test === null },
            children: c.test !== null ? [c.test, ...c.body] : [...c.body],
            metadata: { line },
        }));

        const node: BaseNode = {
            nodeType: 'SwitchStatement',
            id: this.genId(),
            attributes: { caseCount: cases.length },
            children: [discriminant, ...caseNodes],
            metadata: { line },
        };
        this.attachComments(node);
        return node;
    }

    private parseIf(): BaseNode {
        const line = this.peek().line;
        this.consume('if'); this.consume('('); const condition = this.parseExpression(0); this.consume(')');

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
        const node: BaseNode = { nodeType: 'IfStatement', id: this.genId(), attributes: {}, children: children, metadata: { line } };
        this.attachComments(node);
        return node;
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
        const bodyBlock: BaseNode = { nodeType: 'Block', id: this.genId(), attributes: {}, children: body, metadata: { line } };
        const node: BaseNode = { nodeType: 'WhileLoop', id: this.genId(), attributes: {}, children: [condition, bodyBlock], metadata: { line } };
        this.attachComments(node);
        return node;
    }

    private parseDoWhile(): BaseNode {
        const line = this.peek().line;
        this.consume('do');
        let body: BaseNode[];
        if (this.peek().value === '{') {
            body = this.parseBlock();
        } else {
            const stmt = this.parseStatement();
            body = stmt ? [stmt] : [];
        }
        this.consume('while');
        this.consume('(');
        const condition = this.parseExpression(0);
        this.consume(')');
        this.consume(';');
        const bodyBlock: BaseNode = { nodeType: 'Block', id: this.genId(), attributes: {}, children: body, metadata: { line } };
        const node: BaseNode = { nodeType: 'DoWhileLoop', id: this.genId(), attributes: {}, children: [condition, bodyBlock], metadata: { line } };
        this.attachComments(node);
        return node;
    }

    private parseFor(): BaseNode {
        const line = this.peek().line;
        this.consume('for'); this.consume('('); this.symbols.pushScope();
        
        // Check for range-based for loop: for (auto/Type var : iterable)
        const firstToken = this.peek();
        const secondToken = this.peek(1);
        
        if (secondToken?.value === ':') {
            // Range-based for: for (var : iterable) or for (auto var : iterable)
            const isAuto = firstToken.value === 'auto';
            const varName = isAuto ? (this.peek(2)?.value || 'i') : firstToken.value;
            this.consume(':'); // consume ':'
            const iterable = this.parseExpression(0);
            this.consume(')');
            
            let body: BaseNode[];
            if (this.peek().value === '{') {
                body = this.parseBlock();
            } else {
                const stmt = this.parseStatement();
                body = stmt ? [stmt] : [];
            }
            this.symbols.popScope();
            
            // For range-based for, create a ForIn node
            const bodyBlock: BaseNode = { nodeType: 'Block', id: this.genId(), attributes: {}, children: body, metadata: { line } };
            const node: BaseNode = { nodeType: 'ForIn', id: this.genId(), attributes: { varName, isAuto }, children: [iterable, bodyBlock], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        
        // Traditional for loop: for (init; condition; update)
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
        const bodyBlock: BaseNode = { nodeType: 'Block', id: this.genId(), attributes: {}, children: body, metadata: { line } };
        const node: BaseNode = { nodeType: 'ForLoop', id: this.genId(), attributes: { hasInit: !!init, hasUpdate: !!update }, children: [...(init ? [init] : []), condition as BaseNode, ...(update ? [update as BaseNode] : []), bodyBlock], metadata: { line } };
        this.attachComments(node);
        return node;
    }

    private parseVarDecl(): BaseNode | null {
        const line = this.peek().line;
        let isExtern = false;
        let isConst = false;
        let isVolatile = false;
        let isStatic = false;
        let isProgmem = false;

        while (['extern', 'const', 'volatile', 'static', '_progmem', 'PROGMEM', 'std'].includes(this.peek().value)) {
            const v = this.consume().value;
            if (v === 'extern') isExtern = true;
            if (v === 'const') isConst = true;
            if (v === 'volatile') isVolatile = true;
            if (v === 'static') isStatic = true;
            if (v === 'PROGMEM' || v === '_progmem') isProgmem = true;
            if (v === 'std') {
                if (this.peek().value === '::') this.consume('::');
                // We just skip 'std::' for now
            }
        }

        let structTypeName: string | null = null;
        let type = '';

        if (this.peek().value === 'struct' || this.peek().value === 'class') {
            this.consume();
            if (this.peek().type === 'IDENTIFIER') {
                structTypeName = this.consume().value;
                type = 'struct';
            } else {
                // Anonymous struct or something else?
                type = 'struct';
            }
        } else {
            type = this.consume().value;
        }
        
        while (this.peek().value === '::') {
            this.consume('::');
            type += '::' + this.consume().value;
        }

        while (this.isType(this.peek()) && this.peek().type === 'KEYWORD') {
            type += ' ' + this.consume().value;
        }

        let isPointer = false;
        while (this.peek().value === '*') {
            isPointer = true;
            this.consume();
            type += '*';
        }

        const name = this.consume().value;
        if (!this.symbols.define(name, type, this.peek().line))
            this.semanticErrors.push({ severity: 'WARNING', message: `Redeclaration of '${name}'` });

        let isArray = false;
        let isArray2D = false;
        let isPointerArray = false;
        let arraySizeExpr: BaseNode | null = null;
        let arraySize2Expr: BaseNode | null = null;

        if ((this as any)._stdArraySize) {
            isArray = true;
            arraySizeExpr = (this as any)._stdArraySize;
            delete (this as any)._stdArraySize;
        }

        if (this.peek().value === '[') {
            isArray = true;
            if (isPointer) isPointerArray = true;
            this.consume('[');
            if (this.peek().value !== ']') {
                arraySizeExpr = this.parseExpression(0);
            }
            this.consume(']');

            if (this.peek().value === '[') {
                isArray2D = true;
                this.consume('[');
                if (this.peek().value !== ']') {
                    arraySize2Expr = this.parseExpression(0);
                }
                this.consume(']');
            }
        }

        let value: BaseNode = {
            nodeType: 'Literal',
            id: this.genId(),
            attributes: { value: isArray ? [] : 0 },
            children: [],
        };

        if (this.peek().value === '=') {
            this.consume('=');
            if (this.peek().value === '{') {
                this.consume('{');
                const elements: BaseNode[] = [];
                while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
                    if (this.peek().value === '{') {
                        this.consume('{');
                        const row: BaseNode[] = [];
                        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
                            row.push(this.parseExpression(0));
                            if (this.peek().value === ',') this.consume(',');
                        }
                        this.consume('}');
                        elements.push({
                            nodeType: 'ArrayInitializer',
                            id: this.genId(),
                            attributes: { isRow: true },
                            children: row,
                        });
                    } else if (this.peek().value === '[') {
                        this.consume('[');
                        const designatedIdx = this.parseExpression(0);
                        this.consume(']');
                        this.consume('=');
                        const designatedVal = this.parseExpression(0);
                        elements.push({
                            nodeType: 'DesignatedInitializer',
                            id: this.genId(),
                            attributes: { index: designatedIdx },
                            children: [designatedVal],
                        });
                    } else {
                        elements.push(this.parseExpression(0));
                    }
                    if (this.peek().value === ',') this.consume(',');
                }
                this.consume('}');
                value = {
                    nodeType: 'ArrayInitializer',
                    id: this.genId(),
                    attributes: { isArray2D },
                    children: elements,
                };
            } else {
                value = this.parseExpression(0);
            }
        } else if (this.symbols.resolve(type)?.type === 'class' && this.peek().value === '(') {
            // Constructor call: Type name(args);
            this.consume('(');
            const args: BaseNode[] = [];
            if (this.peek().value !== ')') {
                do {
                    if (this.peek().value === ')') break;
                    args.push(this.parseExpression(0));
                } while (this.peek().value === ',' && this.consume());
            }
            this.consume(')');
            value = {
                nodeType: 'CallExpression',
                id: this.genId(),
                attributes: { callee: type },
                children: args,
            };
        } else {
            value = this.parseExpression(0);
        }

        this.consume(';');
        const node: BaseNode = {
            nodeType: 'VariableDeclaration',
            id: this.genId(),
            attributes: {
                name,
                type,
                isArray,
                isArray2D,
                isPointer,
                isPointerArray,
                isExtern,
                structType: structTypeName ?? undefined,
                isConst,
                isVolatile,
                isStatic,
                isProgmem,
                arraySizeExpr: arraySizeExpr ?? undefined,
                arraySize2Expr: arraySize2Expr ?? undefined,
                isConstructorCall: value.nodeType === 'CallExpression',
            },
            children: [value],
            metadata: { line },
        };
        this.attachComments(node);
        return node;
    }

    private parseExpression(minPrec: number): BaseNode {
        let left = this.parsePrefix();
        while (true) {
            const t = this.peek();
            if (t.type === 'EOF' || [';', ')', ',', ']', '}', ':'].includes(t.value)) break;
            const prec = this.getPrecedence(t.value);
            if (prec < minPrec) break;
            const op = this.consume().value;
            if (op === '?') {
                const whenTrue = this.parseExpression(0);
                this.consume(':');
                const whenFalse = this.parseExpression(0);
                left = {
                    nodeType: 'ConditionalExpression',
                    id: this.genId(),
                    attributes: {},
                    children: [left, whenTrue, whenFalse],
                    metadata: { line: t.line }
                };
            } else {
                const right = this.parseExpression(prec);
                left = { nodeType: 'BinaryExpression', id: this.genId(), attributes: { operator: op }, children: [left, right], metadata: { line: t.line } };
            }
        }
        return left;
    }

    private parsePrefix(): BaseNode {
        const t = this.peek();
        if (['!', '-', '~', '++', '--', '+', '&', '*'].includes(t.value)) {
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
            } else if (this.peek().value === '.' || this.peek().value === '->') {
                const line = this.peek().line;
                const op = this.consume().value;
                const member = this.consume().value;
                const meta = { line };
                if (this.peek().value === '(') {
                    this.consume('(');
                    const args: BaseNode[] = [];
                    if (this.peek().value !== ')') {
                        do {
                            if (this.peek().value === ')') break;
                            args.push(this.parseExpression(0));
                        } while (this.peek().value === ',' && this.consume());
                    }
                    this.consume(')');
                    node = this.mapMethodCall(node, member, args, meta);
                } else {
                    node = {
                        nodeType: 'MemberExpression',
                        id: this.genId(),
                        attributes: { property: member, operator: op },
                        children: [node],
                        metadata: meta
                    };
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
        if (t.type === 'NUMBER') return { nodeType: 'Literal', id: this.genId(), attributes: { value: parseFloat(t.value) }, children: [], metadata: { line } };
        if (t.type === 'STRING') return { nodeType: 'Literal', id: this.genId(), attributes: { value: t.value, isString: true }, children: [], metadata: { line } };
        if (t.value === '(') { const expr = this.parseExpression(0); this.consume(')'); return expr; }

        if ([
            'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP',
            'WL_CONNECTED', 'WL_IDLE_STATUS', 'FILE_WRITE', 'FILE_READ', 'FILE_APPEND',
            'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
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
            
            // Analog pins mapping (Standard Arduino Uno)
            if (t.value === 'A0') v = 14;
            if (t.value === 'A1') v = 15;
            if (t.value === 'A2') v = 16;
            if (t.value === 'A3') v = 17;
            if (t.value === 'A4') v = 18;
            if (t.value === 'A5') v = 19;
            if (t.value === 'A6') v = 20;
            if (t.value === 'A7') v = 21;

            return { nodeType: 'Literal', id: this.genId(), attributes: { value: v, isString: typeof v === 'string' }, children: [], metadata: { line } };
        }

        if (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') {
            if (this.peek().value === '(') {
                this.consume('('); const args: BaseNode[] = [];
                if (this.peek().value !== ')') {
                    do {
                        if (this.peek().value === ')') break;
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
                if (t.value === 'pinMode') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'pinMode' }, children: args, metadata: meta };
                if (t.value === 'attachInterrupt') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'attachInterrupt' }, children: args, metadata: meta };
                if (t.value === 'detachInterrupt') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'detachInterrupt' }, children: args, metadata: meta };
                if (t.value === 'pulseIn') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'pulseIn' }, children: args, metadata: meta };
                if (t.value === 'pulseInLong') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'pulseIn' }, children: args, metadata: meta };
                if (t.value === 'shiftOut') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'shiftOut' }, children: args, metadata: meta };
                if (t.value === 'shiftIn') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'shiftIn' }, children: args, metadata: meta };

                return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: t.value }, children: args, metadata: meta };
            }

            this.symbols.markUsage(t.value);
            return { nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: { line } };
        }
        throw new Error(`Unexpected token '${t.value}' at line ${line}`);
    }

    private mapMethodCall(target: BaseNode, member: string, args: BaseNode[], meta: any): BaseNode {
        const objName = (target.nodeType === 'Identifier' ? target.attributes.name : null) as string;
        let objType: string | null = null;
        if (objName) {
            const sym = this.symbols.resolve(objName);
            if (sym) objType = sym.type;
        }

        if (objName === 'Serial') {
            if (member === 'begin') return { nodeType: 'SerialBegin', id: this.genId(), attributes: {}, children: args, metadata: meta };
            if (member === 'print') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.print' }, children: args, metadata: meta };
            if (member === 'println') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'Serial.println' }, children: args, metadata: meta };
            if (member === 'available') return { nodeType: 'SerialAvailable', id: this.genId(), attributes: {}, children: [], metadata: meta };
            if (member === 'readString') return { nodeType: 'SerialReadString', id: this.genId(), attributes: {}, children: [], metadata: meta };
        }

        // Support for RGBLED library (type-aware or name-aware fallback)
        if (objType === 'RGBLED' || objName === 'rgb') {
            if (member === 'setColor') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'rgb.setColor' }, children: args, metadata: meta };
            if (member === 'off') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'rgb.setColor' }, children: [
                { nodeType: 'Literal', id: this.genId(), attributes: { value: 0 }, children: [] },
                { nodeType: 'Literal', id: this.genId(), attributes: { value: 0 }, children: [] },
                { nodeType: 'Literal', id: this.genId(), attributes: { value: 0 }, children: [] }
            ], metadata: meta };
        }

        if (objType === 'Servo') {
            if (member === 'attach') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'servo.attach', varName: objName }, children: args, metadata: meta };
            if (member === 'write') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'servo.write', varName: objName }, children: args, metadata: meta };
        }

        if (objName === 'SPIFFS') {
            if (member === 'begin') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.begin' }, children: [], metadata: meta };
            if (member === 'remove') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.remove' }, children: args, metadata: meta };
            if (member === 'open') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'SPIFFS.open' }, children: args, metadata: meta };
        }
        if (objName === 'lcd') {
            if (member === 'clear') return { nodeType: 'LcdClear', id: this.genId(), attributes: {}, children: [], metadata: meta };
            if (member === 'setCursor') return { nodeType: 'LcdCursor', id: this.genId(), attributes: {}, children: args, metadata: meta };
            if (member.startsWith('print')) return { nodeType: 'LcdPrint', id: this.genId(), attributes: {}, children: args, metadata: meta };
        }
        if (objName === 'oled') {
            if (member === 'text') return { nodeType: 'OledText', id: this.genId(), attributes: {}, children: args, metadata: meta };
            if (member === 'show') return { nodeType: 'OledShow', id: this.genId(), attributes: {}, children: [], metadata: meta };
            if (member === 'clear') return { nodeType: 'OledClear', id: this.genId(), attributes: {}, children: [], metadata: meta };
        }
        if (objName === 'sevseg') {
            if (member.startsWith('print') || member === 'setNumber' || member === 'setChars') {
                return { nodeType: 'SevSegPrint', id: this.genId(), attributes: {}, children: args, metadata: meta };
            }
        }
        if (objName === 'dht') {
            const callee = member === 'readTemperature' ? 'dht.readTemp' : 'dht.readHum';
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee }, children: [], metadata: meta };
        }
        if (objName === 'ultrasonic' && member === 'read') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ultrasonic.read' }, children: [], metadata: meta };
        if (objName === 'ldr' && member === 'read') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ldr.read' }, children: [], metadata: meta };
        if (objName === 'ir' && member === 'read') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'ir.read' }, children: [], metadata: meta };
        if (objName === 'motors' && member === 'move') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'motors.move' }, children: args, metadata: meta };
        if (objName === 'mpu' && member.startsWith('get')) {
            const axis = member.replace('get', '');
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'mpu.get', axis }, children: [], metadata: meta };
        }
        if (objName === 'neopixel') {
            const callee = member === 'setPixelColor' ? 'neopixel.set' : (member === 'show' ? 'neopixel.show' : 'neopixel.clear');
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee }, children: args, metadata: meta };
        }
        if (objName === 'keypad' && member === 'getKey') return { nodeType: 'KeypadRead', id: this.genId(), attributes: {}, children: [], metadata: meta };
        if (objName === 'WiFi') {
            if (member === 'begin') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'WiFi.begin' }, children: args, metadata: meta };
            if (member === 'status') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'WiFi.status' }, children: [], metadata: meta };
        }
        if (objName === 'HTTP' && member === 'get') return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'HTTP.get' }, children: args, metadata: meta };

        if (['println', 'print', 'write'].includes(member)) {
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.write', varName: objName, newLine: member === 'println' }, children: args, metadata: meta };
        }
        if (member === 'readString') {
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.readString', varName: objName }, children: [], metadata: meta };
        }
        if (member === 'close') {
            return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: 'file.close', varName: objName }, children: [], metadata: meta };
        }

        return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: objName ? `${objName}.${member}` : member }, children: args, metadata: meta };
    }

    private getPrecedence(op: string): number {
        if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=' || op === '&=' || op === '|=' || op === '^=' || op === '<<=' || op === '>>=') return 1;
        if (op === '?') return 2;
        if (['||'].includes(op)) return 3;
        if (['&&'].includes(op)) return 4;
        if (['|'].includes(op)) return 4;
        if (['^'].includes(op)) return 5;
        if (['&'].includes(op)) return 6;
        if (['==', '!='].includes(op)) return 7;
        if (['<', '>', '<=', '>='].includes(op)) return 8;
        if (['<<', '>>'].includes(op)) return 9;
        if (['+', '-'].includes(op)) return 10;
        if (['*', '/', '%'].includes(op)) return 11;
        return 0;
    }

    private consume(e?: string): Token {
        if (this.pos >= this.tokens.length) return { type: 'EOF', value: 'EOF', line: this.pos > 0 ? this.tokens[this.pos - 1].line : 0 };
        const t = this.tokens[this.pos];
        if (e && t.value !== e) {
            throw new Error(`Expected '${e}' but found '${t.value}' at line ${t.line}`);
        }
        this.pos++; return t;
    }
    private peek(o: number = 0): Token { return this.tokens[this.pos + o] || { type: 'EOF', value: 'EOF', line: 0 }; }

    private attachComments(node: BaseNode): void {
        const nodeLine = node.metadata?.line;
        if (!nodeLine) {
            if (this.pendingComments.length > 0) {
                node.leadingComments = this.pendingComments.map(c => c.comment);
                this.pendingComments = [];
            }
            return;
        }

        const commentsToAttach: string[] = [];
        this.pendingComments = this.pendingComments.filter(c => {
            if (c.line < nodeLine) {
                commentsToAttach.push(c.comment);
                return false;
            }
            return true;
        });

        if (commentsToAttach.length > 0) {
            node.leadingComments = commentsToAttach;
        }
    }

    private genId() { return Math.random().toString(36).substring(7); }
}
