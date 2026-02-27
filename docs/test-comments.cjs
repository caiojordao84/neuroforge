// Teste de comentários em C/C++
// Script inline com lexer e parser

// --- Lexer ---
class Lexer {
    constructor(src) {
        this.src = src;
        this.cursor = 0;
        this.line = 1;
    }
    
    tokenize() {
        const tokens = [];
        while (this.cursor < this.src.length) {
            const char = this.src[this.cursor];
            
            if (/\s/.test(char)) {
                if (char === '\n') this.line++;
                this.cursor++;
                continue;
            }
            
            if (char === '/' && this.src[this.cursor + 1] === '/') {
                const startLine = this.line;
                let comment = '';
                while (this.src[this.cursor] !== '\n' && this.cursor < this.src.length) {
                    comment += this.src[this.cursor++];
                }
                comment = comment.replace(/^\/\//, '').trim();
                tokens.push({ type: 'COMMENT', value: comment, line: startLine });
                continue;
            }
            
            if (char === '/' && this.src[this.cursor + 1] === '*') {
                const startLine = this.line;
                this.cursor += 2;
                let comment = '';
                while (this.cursor < this.src.length) {
                    if (this.src[this.cursor] === '*' && this.src[this.cursor + 1] === '/') {
                        this.cursor += 2;
                        break;
                    }
                    comment += this.src[this.cursor];
                    if (this.src[this.cursor] === '\n') this.line++;
                    this.cursor++;
                }
                comment = comment.replace(/^\* ?/, '').replace(/ ?\*$/, '').trim();
                tokens.push({ type: 'COMMENT', value: comment, line: startLine });
                continue;
            }
            
            if (char === '#') {
                while (this.src[this.cursor] !== '\n' && this.cursor < this.src.length) this.cursor++;
                continue;
            }
            
            if (/\d/.test(char)) {
                let num = '';
                while (/\d/.test(this.src[this.cursor])) num += this.src[this.cursor++];
                if (this.src[this.cursor] === '.' && /\d/.test(this.src[this.cursor + 1])) {
                    num += '.'; this.cursor++;
                    while (/\d/.test(this.src[this.cursor])) num += this.src[this.cursor++];
                }
                tokens.push({ type: 'NUMBER', value: num, line: this.line });
                continue;
            }
            
            if (/[a-zA-Z_]/.test(char)) {
                let word = '';
                while (/[a-zA-Z0-9_]/.test(this.src[this.cursor])) word += this.src[this.cursor++];
                const keywords = ['void', 'struct', 'int', 'float', 'bool', 'boolean', 'unsigned', 'long', 'short', 'char', 'byte', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t', 'String', 'File', 'if', 'else', 'while', 'for', 'return', 'true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'const', 'enum', 'static', 'volatile', 'PROGMEM', 'switch', 'case', 'default', 'auto', 'sizeof'];
                tokens.push({ type: keywords.includes(word) ? 'KEYWORD' : 'IDENTIFIER', value: word, line: this.line });
                continue;
            }
            
            if (char === '"') {
                this.cursor++;
                let str = '';
                while (this.src[this.cursor] !== '"' && this.cursor < this.src.length) {
                    if (this.src[this.cursor] === '\\' && this.src[this.cursor + 1] === '"') {
                        str += '"'; this.cursor += 2;
                    } else {
                        str += this.src[this.cursor++];
                    }
                }
                this.cursor++;
                tokens.push({ type: 'STRING', value: str, line: this.line });
                continue;
            }
            
            const symbols = ['<=', '>=', '==', '!=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '<<=', '>>=', '<<', '>>', '&=', '|=', '^=', '->', '::'];
            let matchedSym = symbols.find(s => this.src.substr(this.cursor, s.length) === s);
            if (matchedSym) {
                tokens.push({ type: 'SYMBOL', value: matchedSym, line: this.line });
                this.cursor += matchedSym.length;
                continue;
            }
            
            const singleSymbols = ['(', ')', '{', '}', '[', ']', ';', ',', '=', '<', '>', '+', '-', '*', '/', '!', '.', '&', '|', '^', '~', '%', '?', ':'];
            if (singleSymbols.includes(char)) {
                tokens.push({ type: 'SYMBOL', value: char, line: this.line });
                this.cursor++;
                continue;
            }
            
            this.cursor++;
        }
        tokens.push({ type: 'EOF', value: 'EOF', line: this.line });
        return tokens;
    }
}

// --- Simple Parser with comment support ---
class RecursiveDescentCParser {
    constructor() {
        this.tokens = [];
        this.pos = 0;
        this.pendingComments = [];
    }
    
    isType(token) {
        if (token.type === 'KEYWORD' && [
            'void', 'int', 'float', 'bool', 'boolean', 'String', 'File', 'char', 'byte', 'short', 'long',
            'unsigned', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t'
        ].includes(token.value)) return true;
        return false;
    }
    
    isFunctionDecl() {
        const current = this.peek();
        if (!this.isType(current)) return false;
        let offset = 1;
        while (this.isType(this.peek(offset))) offset++;
        return this.peek(offset).type === 'IDENTIFIER' && this.peek(offset + 1).value === '(';
    }
    
    parse(code) {
        const lexer = new Lexer(code);
        const allTokens = lexer.tokenize();
        
        this.pendingComments = [];
        const filteredTokens = [];
        for (const token of allTokens) {
            if (token.type === 'COMMENT') {
                this.pendingComments.push({ comment: token.value, line: token.line });
            } else {
                filteredTokens.push(token);
            }
        }
        
        this.tokens = filteredTokens;
        this.pos = 0;
        
        const program = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
        while (this.peek().type !== 'EOF') {
            const t = this.peek();
            
            if (t.value === 'const') this.consume();
            if (t.value === 'enum') {
                program.children.push(this.parseEnum());
            } else if (t.value === 'void' || this.isFunctionDecl()) {
                program.children.push(this.parseFunction());
            } else if (this.isType(this.peek())) {
                const decl = this.parseVarDecl();
                if (decl) program.children.push(decl);
            } else {
                this.consume();
            }
        }
        return { ast: program };
    }
    
    parseEnum() {
        this.consume('enum');
        const name = this.consume().value;
        this.consume('{');
        const members = [];
        let val = 0;
        do {
            if (this.peek().value === '}') break;
            const mName = this.consume().value;
            if (this.peek().value === '=') {
                this.consume('=');
                val = parseInt(this.consume().value);
            }
            members.push({ name: mName, value: val++ });
        } while (this.peek().value === ',' && this.consume());
        this.consume('}');
        if (this.peek().value === ';') this.consume(';');
        
        const node = { nodeType: 'EnumDeclaration', id: this.genId(), attributes: { name, members }, children: [] };
        this.attachComments(node);
        return node;
    }
    
    parseFunction() {
        let returnType = this.consume().value;
        while (this.isType(this.peek())) returnType += ' ' + this.consume().value;
        
        const name = this.consume().value;
        const line = this.peek(-1).line;
        
        this.consume('(');
        const params = [];
        if (this.peek().value !== ')') {
            do {
                if (this.peek().value === ')') break;
                let pType = this.consume().value;
                while (this.isType(this.peek())) pType += ' ' + this.consume().value;
                while (this.peek().value === '*') { pType += '*'; this.consume(); }
                const pName = this.consume().value;
                params.push({ type: pType, name: pName });
            } while (this.peek().value === ',' && this.consume());
        }
        this.consume(')');
        this.consume('{');
        
        const funcNode = {
            nodeType: 'Function',
            id: `func-${name}`,
            attributes: { name, returnType, params },
            children: [],
            metadata: { line },
        };
        this.attachComments(funcNode);
        
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement();
            if (stmt) funcNode.children.push(stmt);
        }
        this.consume('}');
        return funcNode;
    }
    
    parseStatement() {
        const t = this.peek();
        const line = t.line;
        
        if (t.value === 'const') this.consume();
        
        if (t.value === 'if') return this.parseIf();
        if (t.value === 'while') return this.parseWhile();
        if (t.value === 'for') return this.parseFor();
        if (t.value === 'switch') return this.parseSwitch();
        
        if (t.value === 'break') {
            this.consume('break');
            if (this.peek().value === ';') this.consume(';');
            const node = { nodeType: 'BreakStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        
        if (t.value === 'continue') {
            this.consume('continue');
            if (this.peek().value === ';') this.consume(';');
            const node = { nodeType: 'ContinueStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        
        if (t.value === 'return') {
            this.consume('return');
            if (this.peek().value === ';') { 
                this.consume(';'); 
                const node = { nodeType: 'ReturnStatement', id: this.genId(), attributes: {}, children: [], metadata: { line } };
                this.attachComments(node);
                return node;
            }
            const val = this.parseExpression(0);
            this.consume(';');
            const node = { nodeType: 'ReturnStatement', id: this.genId(), attributes: {}, children: [val], metadata: { line } };
            this.attachComments(node);
            return node;
        }
        
        if (this.isType(t)) {
            return this.parseVarDecl();
        }
        
        if (t.value === ';') { this.consume(); return null; }
        if (t.value === '{') {
            const node = { nodeType: 'Block', id: this.genId(), attributes: {}, children: this.parseBlock(), metadata: { line } };
            this.attachComments(node);
            return node;
        }
        if (t.value === '}') return null;
        
        const expr = this.parseExpression(0);
        this.consume(';');
        const node = { nodeType: 'ExpressionStatement', id: this.genId(), attributes: {}, children: [expr], metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseBlock() {
        this.consume('{');
        const nodes = [];
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            const stmt = this.parseStatement();
            if (stmt) nodes.push(stmt);
        }
        this.consume('}');
        return nodes;
    }
    
    parseIf() {
        const line = this.peek().line;
        this.consume('if'); this.consume('('); const condition = this.parseExpression(0); this.consume(')');
        
        let thenChildren = this.peek().value === '{' ? this.parseBlock() : [];
        if (thenChildren.length === 0) {
            const stmt = this.parseStatement();
            if (stmt) thenChildren = [stmt];
        }
        
        const thenBlock = { nodeType: 'Block', id: this.genId(), attributes: {}, children: thenChildren, metadata: { line } };
        const children = [condition, thenBlock];
        
        if (this.peek().value === 'else') {
            this.consume('else');
            let elseChildren = this.peek().value === '{' ? this.parseBlock() : [];
            if (elseChildren.length === 0) {
                const stmt = this.parseStatement();
                if (stmt) elseChildren = [stmt];
            }
            children.push({ nodeType: 'Block', id: this.genId(), attributes: {}, children: elseChildren, metadata: { line: this.peek().line } });
        }
        
        const node = { nodeType: 'IfStatement', id: this.genId(), attributes: {}, children, metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseWhile() {
        const line = this.peek().line;
        this.consume('while'); this.consume('('); const condition = this.parseExpression(0); this.consume(')');
        let body = this.peek().value === '{' ? this.parseBlock() : [];
        if (body.length === 0) {
            const stmt = this.parseStatement();
            if (stmt) body = [stmt];
        }
        const node = { nodeType: 'WhileLoop', id: this.genId(), attributes: {}, children: [condition, ...body], metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseFor() {
        const line = this.peek().line;
        this.consume('for'); this.consume('(');
        let init = null;
        if (this.isType(this.peek())) init = this.parseVarDecl();
        else if (this.peek().type === 'IDENTIFIER') init = this.parseStatement();
        else this.consume(';');
        const condition = this.peek().value !== ';' ? this.parseExpression(0) : { nodeType: 'Literal', id: 'true', attributes: { value: 1 }, children: [] };
        this.consume(';');
        const update = this.peek().value !== ')' ? this.parseExpression(0) : null;
        this.consume(')');
        
        let body = this.peek().value === '{' ? this.parseBlock() : [];
        if (body.length === 0) {
            const stmt = this.parseStatement();
            if (stmt) body = [stmt];
        }
        
        const node = { nodeType: 'ForLoop', id: this.genId(), attributes: { hasInit: !!init, hasUpdate: !!update }, children: [...(init ? [init] : []), condition, ...(update ? [update] : []), ...body], metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseSwitch() {
        const line = this.peek().line;
        this.consume('switch');
        this.consume('(');
        const discriminant = this.parseExpression(0);
        this.consume(')');
        this.consume('{');
        
        const cases = [];
        while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
            if (this.peek().value === 'case') {
                this.consume('case');
                const test = this.parseExpression(0);
                this.consume(':');
                const body = [];
                while (!['case', 'default', '}'].includes(this.peek().value) && this.peek().type !== 'EOF') {
                    const s = this.parseStatement();
                    if (s) body.push(s);
                }
                cases.push({ test, body });
            } else if (this.peek().value === 'default') {
                this.consume('default');
                this.consume(':');
                const body = [];
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
        
        const node = { nodeType: 'SwitchStatement', id: this.genId(), attributes: { caseCount: cases.length }, children: [discriminant, ...cases.map(c => ({ nodeType: 'CaseClause', id: this.genId(), attributes: { isDefault: c.test === null }, children: c.test !== null ? [c.test, ...c.body] : [...c.body], metadata: { line } }))], metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseVarDecl() {
        const line = this.peek().line;
        
        while (['const', 'volatile', 'static', 'PROGMEM'].includes(this.peek().value)) {
            this.consume();
        }
        
        let type = this.consume().value;
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
        
        let value = { nodeType: 'Literal', id: this.genId(), attributes: { value: 0 }, children: [] };
        
        if (this.peek().value === '=') {
            this.consume('=');
            if (this.peek().value === '{') {
                this.consume('{');
                const elements = [];
                while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
                    elements.push(this.parseExpression(0));
                    if (this.peek().value === ',') this.consume(',');
                }
                this.consume('}');
                value = { nodeType: 'ArrayInitializer', id: this.genId(), attributes: {}, children: elements };
            } else {
                value = this.parseExpression(0);
            }
        }
        
        this.consume(';');
        
        const node = { nodeType: 'VariableDeclaration', id: this.genId(), attributes: { name, type, isPointer }, children: [value], metadata: { line } };
        this.attachComments(node);
        return node;
    }
    
    parseExpression(minPrec) {
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
                left = { nodeType: 'ConditionalExpression', id: this.genId(), attributes: {}, children: [left, whenTrue, whenFalse], metadata: { line: t.line } };
            } else {
                const right = this.parseExpression(prec);
                left = { nodeType: 'BinaryExpression', id: this.genId(), attributes: { operator: op }, children: [left, right], metadata: { line: t.line } };
            }
        }
        return left;
    }
    
    parsePrefix() {
        const t = this.peek();
        if (['!', '-', '~', '++', '--', '+', '&', '*'].includes(t.value)) {
            this.consume();
            const right = this.parsePrefix();
            return { nodeType: 'UnaryExpression', id: this.genId(), attributes: { operator: t.value, prefix: true }, children: [right], metadata: { line: t.line } };
        }
        return this.parsePostfix();
    }
    
    parsePostfix() {
        let node = this.parseAtom();
        while (true) {
            if (this.peek().value === '++' || this.peek().value === '--') {
                const op = this.consume().value;
                node = { nodeType: 'UnaryExpression', id: this.genId(), attributes: { operator: op, prefix: false }, children: [node], metadata: { line: node.metadata?.line } };
            } else if (this.peek().value === '.' || this.peek().value === '->') {
                const op = this.consume().value;
                const member = this.consume().value;
                const meta = { line: this.peek().line };
                if (this.peek().value === '(') {
                    this.consume('(');
                    const args = [];
                    if (this.peek().value !== ')') {
                        do {
                            if (this.peek().value === ')') break;
                            args.push(this.parseExpression(0));
                        } while (this.peek().value === ',' && this.consume());
                    }
                    this.consume(')');
                    node = { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: member }, children: args, metadata: meta };
                } else {
                    node = { nodeType: 'MemberExpression', id: this.genId(), attributes: { property: member, operator: op }, children: [node], metadata: meta };
                }
            } else if (this.peek().value === '[') {
                this.consume('[');
                const index = this.parseExpression(0);
                this.consume(']');
                node = { nodeType: 'SubscriptExpression', id: this.genId(), attributes: {}, children: [node, index], metadata: { line: this.peek().line } };
            } else {
                break;
            }
        }
        return node;
    }
    
    parseAtom() {
        const t = this.consume();
        const line = t.line;
        if (t.type === 'NUMBER') return { nodeType: 'Literal', id: this.genId(), attributes: { value: parseFloat(t.value) }, children: [], metadata: { line } };
        if (t.type === 'STRING') return { nodeType: 'Literal', id: this.genId(), attributes: { value: t.value, isString: true }, children: [], metadata: { line } };
        if (t.value === '(') { const expr = this.parseExpression(0); this.consume(')'); return expr; }
        
        if (['true', 'false', 'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP'].includes(t.value)) {
            let v = 0;
            if (t.value === 'true' || t.value === 'HIGH') v = 1;
            if (t.value === 'false' || t.value === 'LOW') v = 0;
            if (t.value === 'INPUT') v = 0;
            if (t.value === 'OUTPUT') v = 1;
            if (t.value === 'INPUT_PULLUP') v = 2;
            return { nodeType: 'Literal', id: this.genId(), attributes: { value: v }, children: [], metadata: { line } };
        }
        
        if (t.type === 'IDENTIFIER' || t.type === 'KEYWORD') {
            if (this.peek().value === '(') {
                this.consume('(');
                const args = [];
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
                
                return { nodeType: 'CallExpression', id: this.genId(), attributes: { callee: t.value }, children: args, metadata: meta };
            }
            
            return { nodeType: 'Identifier', id: this.genId(), attributes: { name: t.value }, children: [], metadata: { line } };
        }
        
        throw new Error(`Unexpected token '${t.value}' at line ${line}`);
    }
    
    getPrecedence(op) {
        if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=') return 1;
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
    
    consume(e) {
        if (this.pos >= this.tokens.length) return { type: 'EOF', value: 'EOF', line: this.pos > 0 ? this.tokens[this.pos - 1].line : 0 };
        const t = this.tokens[this.pos];
        if (e && t.value !== e) {
            throw new Error(`Expected '${e}' but found '${t.value}' at line ${t.line}`);
        }
        this.pos++;
        return t;
    }
    
    peek(o = 0) {
        return this.tokens[this.pos + o] || { type: 'EOF', value: 'EOF', line: 0 };
    }
    
    genId() {
        return Math.random().toString(36).substring(7);
    }
    
    attachComments(node) {
        const nodeLine = node.metadata?.line;
        if (!nodeLine) {
            if (this.pendingComments.length > 0) {
                node.leadingComments = this.pendingComments.map(c => c.comment);
                this.pendingComments = [];
            }
            return;
        }
        
        const commentsToAttach = [];
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
}

// --- Test Code ---
const code = `
// Comentário global antes de tudo
int led = 13; // Comentário inline de variável

/* Comentário
   multilinha 
   antes da função */

// Função principal
void setup() {
    // Comentário dentro de setup
    pinMode(led, OUTPUT); // Configura LED
    
    /* Comentário de bloco
       dentro da função */
    digitalWrite(led, HIGH);
}

void loop() {
    // Liga LED
    digitalWrite(led, HIGH);
    delay(1000);
    
    // Desliga LED
    digitalWrite(led, LOW);
    delay(1000);
}
`;

const parser = new RecursiveDescentCParser();
const { ast } = parser.parse(code);

console.log('=== AST com comentários ===\n');
console.log(JSON.stringify(ast, null, 2));
