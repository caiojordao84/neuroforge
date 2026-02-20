import { TreeSitterLoader } from '../../TreeSitterLoader';
import type { ProgramNode, BaseNode, AnalysisIssue } from '@/system/types';

// ---------------------------------------------------------------------------
// PythonParser — uses tree-sitter when available, falls back to regex parser
// ---------------------------------------------------------------------------

export class PythonParser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            this.parser = await TreeSitterLoader.createParser('python');
            this.ready = true;
        } catch (e) {
            console.warn('[PythonParser] tree-sitter WASM unavailable, will use regex fallback:', e);
            // ready stays false → parse() will use the fallback
        }
    }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (this.ready && this.parser) {
            return this._parseWithTreeSitter(code);
        }
        // Fallback: regex-based parser — always produces a valid AST
        return this._parseWithRegex(code);
    }

    // -----------------------------------------------------------------------
    // Tree-sitter path
    // -----------------------------------------------------------------------
    private _parseWithTreeSitter(code: string): { ast: ProgramNode; errors: AnalysisIssue[] } {
        const tree = this.parser.parse(code);
        const converter = new PythonCstToAst();
        const ast = converter.convert(tree.rootNode);

        const errors: AnalysisIssue[] = [];
        const findErrors = (n: any) => {
            if (!n) return;
            const isMissing = typeof n.isMissing === 'function' ? n.isMissing() : !!n.isMissing;
            if (n.type === 'ERROR' || isMissing) {
                const row = n.startPosition ? n.startPosition.row + 1 : '?';
                errors.push({ severity: 'CRITICAL', message: `Syntax error at line ${row}: ${n.text || ''}` });
            }
            if (n.children && Array.isArray(n.children)) {
                n.children.forEach(findErrors);
            }
        };
        findErrors(tree.rootNode);

        return { ast, errors };
    }

    // -----------------------------------------------------------------------
    // Regex-based fallback parser
    // Handles the most common MicroPython / CircuitPython patterns without WASM.
    // -----------------------------------------------------------------------
    private _parseWithRegex(code: string): { ast: ProgramNode; errors: AnalysisIssue[] } {
        const fallback = new RegexPythonParser();
        const ast = fallback.parse(code);
        return { ast, errors: [] };
    }
}

// ---------------------------------------------------------------------------
// RegexPythonParser — lightweight, zero-dependency
// Handles: imports, Pin assignments, digitalio, while True, if/elif/else,
// digitalWrite (pin.value), delay (sleep/sleep_ms), print, assignments.
// ---------------------------------------------------------------------------
class RegexPythonParser {
    private lines: string[] = [];
    private pos = 0;

    parse(source: string): ProgramNode {
        this.lines = source.split('\n');
        this.pos = 0;

        const setupNodes: BaseNode[] = [];
        const loopNodes: BaseNode[] = [];
        const globals: BaseNode[] = [];
        const functions: BaseNode[] = [];

        let inWhileTrue = false;
        let whileTrueIndent = 0;

        while (this.pos < this.lines.length) {
            const raw = this.lines[this.pos];
            const line = raw.trimEnd();
            const trimmed = line.trim();
            const indent = line.length - line.trimStart().length;

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) {
                this.pos++;
                continue;
            }

            // Skip imports
            if (/^(import|from)\s/.test(trimmed)) {
                this.pos++;
                continue;
            }

            // Detect while True / while 1: → main loop body follows
            if (/^while\s+(True|1)\s*:/.test(trimmed)) {
                inWhileTrue = true;
                whileTrueIndent = indent;
                this.pos++;
                continue;
            }

            // Once we're in while True, collect body until outdent
            if (inWhileTrue) {
                if (trimmed && indent <= whileTrueIndent && !trimmed.startsWith('#')) {
                    // We've exited the while True block
                    inWhileTrue = false;
                } else {
                    const node = this._parseLine(trimmed, this.pos + 1);
                    if (node) loopNodes.push(node);
                    this.pos++;
                    continue;
                }
            }

            // Top-level assignment / call / statement
            const node = this._parseLine(trimmed, this.pos + 1);
            if (node) {
                if (node.nodeType === 'VariableDeclaration') {
                    globals.push(node);
                    setupNodes.push(node);
                } else {
                    setupNodes.push(node);
                }
            }
            this.pos++;
        }

        return {
            nodeType: 'Program',
            id: 'root',
            attributes: {},
            children: [
                ...globals,
                ...functions,
                { nodeType: 'Function', id: 'setup', attributes: { name: 'setup' }, children: setupNodes },
                { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: loopNodes },
            ],
        };
    }

    private _parseLine(trimmed: string, lineNum: number): BaseNode | null {
        const meta = { line: lineNum };

        // ── import/from — skip ──────────────────────────────────────────────
        if (/^(import|from)\s/.test(trimmed)) return null;

        // ── print(...) ──────────────────────────────────────────────────────
        const printM = trimmed.match(/^print\s*\((.+)\)\s*$/);
        if (printM) {
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'Print', id: `print-${lineNum}`, attributes: {},
                    children: [this._parseExpr(printM[1].trim(), lineNum)]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── time.sleep_ms(n) / sleep_ms(n) ──────────────────────────────────
        const sleepMsM = trimmed.match(/^(?:time\.)?sleep_ms\s*\((.+)\)\s*$/);
        if (sleepMsM) {
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {},
                    children: [this._parseExpr(sleepMsM[1].trim(), lineNum)]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── time.sleep(n) / sleep(n) ─────────────────────────────────────────
        const sleepM = trimmed.match(/^(?:time\.)?sleep\s*\((.+)\)\s*$/);
        if (sleepM) {
            const arg = this._parseExpr(sleepM[1].trim(), lineNum);
            const msArg: BaseNode = arg.nodeType === 'Literal'
                ? { nodeType: 'Literal', id: `ms-${lineNum}`, attributes: { value: (arg.attributes.value as number) * 1000 }, children: [] }
                : { nodeType: 'Literal', id: `ms-${lineNum}`, attributes: { value: 1000 }, children: [] };
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{ nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {}, children: [msArg] } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── utime.sleep_ms(n) / utime.sleep(n) ───────────────────────────────
        const utimeSleepM = trimmed.match(/^utime\.sleep(?:_ms)?\s*\((.+)\)\s*$/);
        if (utimeSleepM) {
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{ nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {}, children: [this._parseExpr(utimeSleepM[1].trim(), lineNum)] } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── led.on() / led.off() ─────────────────────────────────────────────
        const pinOnM = trimmed.match(/^(\w+)\.on\(\)\s*$/);
        if (pinOnM) {
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: `on-${lineNum}`, attributes: { callee: 'Pin.on' },
                    children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinOnM[1] }, children: [] } as BaseNode]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }
        const pinOffM = trimmed.match(/^(\w+)\.off\(\)\s*$/);
        if (pinOffM) {
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: `off-${lineNum}`, attributes: { callee: 'Pin.off' },
                    children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinOffM[1] }, children: [] } as BaseNode]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── pin.value(0|1) ───────────────────────────────────────────────────
        const pinValSetM = trimmed.match(/^(\w+)\.value\(([^)]+)\)\s*$/);
        if (pinValSetM) {
            const objName = pinValSetM[1];
            const val = this._parseExpr(pinValSetM[2].trim(), lineNum);
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: `pinval-${lineNum}`, attributes: { callee: 'Pin.value' },
                    children: [
                        { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: objName }, children: [] } as BaseNode,
                        val
                    ]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── CircuitPython: led.value = True/False/0/1 ────────────────────────
        const cpDioM = trimmed.match(/^(\w+)\.value\s*=\s*(.+)\s*$/);
        if (cpDioM) {
            const objName = cpDioM[1];
            const val = this._parseBoolExpr(cpDioM[2].trim(), lineNum);
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: `pinval-${lineNum}`, attributes: { callee: 'Pin.value' },
                    children: [
                        { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: objName }, children: [] } as BaseNode,
                        val
                    ]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── MicroPython: var = Pin(n, Pin.OUT/IN) ────────────────────────────
        const pinAssignM = trimmed.match(/^(\w+)\s*=\s*(?:machine\.)?Pin\s*\(([^)]+)\)\s*$/);
        if (pinAssignM) {
            const varName = pinAssignM[1];
            const args = pinAssignM[2].split(',').map(s => s.trim());
            const pinNum = this._parseExpr(args[0], lineNum);
            const modeStr = args[1] || 'Pin.OUT';
            const mode = /IN/.test(modeStr) ? 0 : 1;
            const modeNode: BaseNode = { nodeType: 'Literal', id: `mode-${lineNum}`, attributes: { value: mode }, children: [] };

            return {
                nodeType: 'VariableDeclaration', id: `decl-${lineNum}`,
                attributes: { name: varName, type: 'auto' },
                children: [{
                    nodeType: 'CallExpression', id: `pin-${lineNum}`, attributes: { callee: 'Pin' },
                    children: [pinNum, modeNode]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── CircuitPython: var = digitalio.DigitalInOut(board.Xn) ──────────
        const cpPinAssignM = trimmed.match(/^(\w+)\s*=\s*digitalio\.DigitalInOut\s*\(([^)]+)\)\s*$/);
        if (cpPinAssignM) {
            const varName = cpPinAssignM[1];
            const boardPin = cpPinAssignM[2].trim();
            const pinNumMatch = boardPin.match(/\d+/);
            const pinNum: BaseNode = {
                nodeType: 'Literal', id: `pin-${lineNum}`,
                attributes: { value: pinNumMatch ? parseInt(pinNumMatch[0]) : 0 },
                children: []
            };
            return {
                nodeType: 'VariableDeclaration', id: `decl-${lineNum}`,
                attributes: { name: varName, type: 'auto' },
                children: [{
                    nodeType: 'CallExpression', id: `pin-${lineNum}`, attributes: { callee: 'Pin' },
                    children: [pinNum, { nodeType: 'Literal', id: `mode-${lineNum}`, attributes: { value: 1 }, children: [] } as BaseNode]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── CircuitPython: var.direction = digitalio.Direction.OUTPUT/INPUT ─
        const cpDirM = trimmed.match(/^(\w+)\.direction\s*=\s*digitalio\.Direction\.(OUTPUT|INPUT)\s*$/);
        if (cpDirM) {
            const varName = cpDirM[1];
            const mode = cpDirM[2] === 'OUTPUT' ? 'OUTPUT' : 'INPUT';
            return {
                nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: `mode-${lineNum}`, attributes: { callee: 'pinMode' },
                    children: [
                        { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: varName }, children: [] } as BaseNode,
                        { nodeType: 'Literal', id: `modelit-${lineNum}`, attributes: { value: mode === 'OUTPUT' ? 1 : 0 }, children: [] } as BaseNode
                    ]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── Generic assignment: var = expr ───────────────────────────────────
        const assignM = trimmed.match(/^(\w+)\s*=\s*(.+)\s*$/);
        if (assignM && !assignM[1].match(/^(if|while|for|def|class|import|from|return|pass)$/)) {
            const varName = assignM[1];
            const valExpr = this._parseExpr(assignM[2].trim(), lineNum);
            return {
                nodeType: 'VariableDeclaration', id: `decl-${lineNum}`,
                attributes: { name: varName, type: 'auto' },
                children: [valExpr],
                metadata: meta
            } as BaseNode;
        }

        // Everything else: skip silently
        return null;
    }

    private _parseBoolExpr(s: string, lineNum: number): BaseNode {
        if (s === 'True' || s === '1') return { nodeType: 'Literal', id: `b-${lineNum}`, attributes: { value: 1 }, children: [] };
        if (s === 'False' || s === '0') return { nodeType: 'Literal', id: `b-${lineNum}`, attributes: { value: 0 }, children: [] };
        return this._parseExpr(s, lineNum);
    }

    private _parseExpr(s: string, lineNum: number): BaseNode {
        s = s.trim();
        const meta = { line: lineNum };

        if (s === 'True' || s === 'HIGH') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (s === 'False' || s === 'LOW') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (s === 'None') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 0 }, children: [], metadata: meta };

        // Integer
        if (/^-?\d+$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseInt(s) }, children: [], metadata: meta };
        // Float
        if (/^-?\d+\.\d+$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseFloat(s) }, children: [], metadata: meta };
        // String literal
        if (/^['"].*['"]$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: s.slice(1, -1), isString: true }, children: [], metadata: meta };

        // Pin constant: Pin.OUT, Pin.IN, Pin.PULL_UP etc.
        if (s === 'Pin.OUT') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (s === 'Pin.IN') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (s === 'Pin.PULL_UP') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 2 }, children: [], metadata: meta };

        // board.Xn → extract number
        const boardM = s.match(/^board\..*?(\d+)$/);
        if (boardM) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseInt(boardM[1]) }, children: [], metadata: meta };

        // Identifier
        return { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: s }, children: [], metadata: meta };
    }
}

// ---------------------------------------------------------------------------
// PythonCstToAst — used when tree-sitter loads successfully
// ---------------------------------------------------------------------------

class PythonCstToAst {
    convert(node: any): ProgramNode {
        const children = this.visitBlockChildren(node);
        return { nodeType: 'Program', id: 'root', attributes: {}, children };
    }

    visit(node: any): BaseNode | null {
        switch (node.type) {
            case 'function_definition': return this.visitFunction(node);
            case 'expression_statement': {
                const child = node.namedChild(0);
                if (child && (child.type === 'assignment' || child.type === 'augmented_assignment')) {
                    return this.visitAssignment(child);
                }
                return this.visitExprStmt(node);
            }
            case 'if_statement': return this.visitIf(node);
            case 'while_statement': return this.visitWhile(node);
            case 'for_statement': return this.visitFor(node);
            case 'assignment': return this.visitAssignment(node);
            case 'augmented_assignment': return this.visitAssignment(node);
            case 'return_statement': return this.visitReturn(node);
            case 'import_statement':
            case 'import_from_statement':
                return { nodeType: 'Empty', id: `imp-${node.id}`, attributes: {}, children: [] };
            default:
                return { nodeType: 'Empty', id: `e-${node.id}`, attributes: {}, children: [] };
        }
    }

    visitReturn(node: any): BaseNode {
        const val = node.child(1) ? this.visitExpr(node.child(1)) : null;
        return {
            nodeType: 'ReturnStatement', id: `ret-${node.id}`, attributes: {}, children: val ? [val] : [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFunction(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'anon';
        const body = node.childForFieldName('body');
        const children = body ? this.visitBlockChildren(body) : [];
        return {
            nodeType: 'Function', id: `fn-${node.id}`, attributes: { name }, children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitExprStmt(node: any): BaseNode {
        const exprNode = node.namedChild(0);
        const expr = exprNode ? this.visitExpr(exprNode) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] } as BaseNode;
        return {
            nodeType: 'ExpressionStatement', id: `stmt-${node.id}`, attributes: {}, children: [expr],
            metadata: { line: node.startPosition.row + 1 }
        } as BaseNode;
    }

    visitAssignment(node: any): BaseNode {
        const leftExpr = node.childForFieldName('left');
        const rightExpr = node.childForFieldName('right');
        const operator = node.childForFieldName('operator')?.text || '=';

        const left = this.visitExpr(leftExpr!);
        const right = this.visitExpr(rightExpr!);
        const meta = { line: node.startPosition.row + 1 };

        // Handle augmented assignments: x += 1 -> x = x + 1
        if (operator !== '=') {
            const simpleOp = operator.replace('=', '');
            return {
                nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' },
                    children: [
                        left,
                        {
                            nodeType: 'BinaryExpression', id: `aug-${node.id}`, attributes: { operator: simpleOp },
                            children: [left, right]
                        } as BaseNode
                    ]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // Handle direct GPIO assignment: p2.value = 1 (MicroPython style)
        if (leftExpr && leftExpr.type === 'attribute') {
            const attr = leftExpr.childForFieldName('attribute')?.text;
            if (attr === 'value') {
                return {
                    nodeType: 'ExpressionStatement', id: `set-${node.id}`, attributes: {},
                    children: [{
                        nodeType: 'CallExpression', id: `v-${node.id}`, attributes: { callee: 'Pin.value' },
                        children: [this.visitExpr(leftExpr.childForFieldName('object')), right]
                    } as BaseNode],
                    metadata: meta
                } as BaseNode;
            }
            // CircuitPython: obj.direction = digitalio.Direction.OUTPUT
            if (attr === 'direction') {
                const rightText = rightExpr?.text || '';
                const mode = /OUTPUT/.test(rightText) ? 1 : 0;
                return {
                    nodeType: 'ExpressionStatement', id: `dir-${node.id}`, attributes: {},
                    children: [{
                        nodeType: 'CallExpression', id: `pm-${node.id}`, attributes: { callee: 'pinMode' },
                        children: [
                            this.visitExpr(leftExpr.childForFieldName('object')),
                            { nodeType: 'Literal', id: `m-${node.id}`, attributes: { value: mode }, children: [] } as BaseNode
                        ]
                    } as BaseNode],
                    metadata: meta
                } as BaseNode;
            }
        }

        // Top-level variable definition (hoistable)
        if (left.nodeType === 'Identifier') {
            return {
                nodeType: 'VariableDeclaration', id: `decl-${node.id}`,
                attributes: { name: left.attributes.name, type: 'auto' },
                children: [right],
                metadata: meta
            } as BaseNode;
        }

        return {
            nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {},
            children: [{
                nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' }, children: [left, right]
            } as BaseNode],
            metadata: meta
        } as BaseNode;
    }

    visitIf(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const cons = node.childForFieldName('consequence');
        const alt = node.childForFieldName('alternative');

        const thenBlock: BaseNode = {
            nodeType: 'Block',
            id: `blk-${node.id}-then`,
            attributes: {},
            children: cons ? this.visitBlockChildren(cons) : [],
            metadata: { line: node.startPosition.row + 1 }
        };

        const children = [cond, thenBlock];

        if (alt) {
            const body = alt.child(1);
            if (body && body.type === 'if_statement') {
                const nestedIf = this.visitIf(body);
                if (nestedIf) children.push(nestedIf);
            } else if (body) {
                const elseBlock: BaseNode = {
                    nodeType: 'Block',
                    id: `blk-${node.id}-else`,
                    attributes: {},
                    children: this.visitBlockChildren(body),
                    metadata: { line: alt.startPosition.row + 1 }
                };
                children.push(elseBlock);
            }
        }

        return {
            nodeType: 'IfStatement', id: `if-${node.id}`, attributes: {},
            children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitWhile(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const body = node.childForFieldName('body');
        return {
            nodeType: 'WhileLoop', id: `while-${node.id}`, attributes: {},
            children: [cond, ...(body ? this.visitBlockChildren(body) : [])],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFor(node: any): BaseNode {
        const left = node.childForFieldName('left')?.text || 'i';
        const right = node.childForFieldName('right');
        const body = node.childForFieldName('body');

        let maxVal = 10;
        if (right?.type === 'call' && right.childForFieldName('function')?.text === 'range') {
            const args = right.childForFieldName('arguments');
            if (args && args.firstChild) {
                const arg = args.children.find((c: any) => c.type === 'integer');
                if (arg) maxVal = parseInt(arg.text);
            }
        }

        const init: BaseNode = {
            nodeType: 'VariableDeclaration', id: 'init', attributes: { name: left, type: 'int' },
            children: [{ nodeType: 'Literal', id: 'l1', attributes: { value: 0 }, children: [] }]
        };
        const condition: BaseNode = {
            nodeType: 'BinaryExpression', id: 'cond', attributes: { operator: '<' },
            children: [
                { nodeType: 'Identifier', id: 'id', attributes: { name: left }, children: [] },
                { nodeType: 'Literal', id: 'l2', attributes: { value: maxVal }, children: [] }
            ]
        };
        const update: BaseNode = {
            nodeType: 'UnaryExpression', id: 'upd', attributes: { operator: '++', prefix: false },
            children: [{ nodeType: 'Identifier', id: 'id', attributes: { name: left }, children: [] }]
        };

        return {
            nodeType: 'ForLoop', id: `for-${node.id}`, attributes: { hasInit: true, hasUpdate: true },
            children: [init, condition, update, ...(body ? this.visitBlockChildren(body) : [])],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBlockChildren(node: any): BaseNode[] {
        const result: BaseNode[] = [];
        let pendingComments: string[] = [];

        node.children.forEach((c: any) => {
            if (c.type === 'comment') {
                pendingComments.push(c.text);
                return;
            }
            if (c.type === ':' || c.type === 'block') return;

            const visited = this.visit(c);
            if (visited) {
                if (pendingComments.length > 0) {
                    visited.leadingComments = [...pendingComments];
                    pendingComments = [];
                }
                result.push(visited);
            }
        });
        return result;
    }

    visitExpr(node: any): BaseNode {
        const meta = { line: node.startPosition.row + 1 };
        if (node.type === 'integer') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/['\"]/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };

        if (node.type === 'true' || node.type === 'True' || (node.type === 'identifier' && node.text === 'True'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false' || node.type === 'False' || (node.type === 'identifier' && node.text === 'False'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (node.type === 'none' || node.type === 'None' || (node.type === 'identifier' && node.text === 'None'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'parenthesized_expression') {
            const inner = node.namedChild(0);
            return inner ? this.visitExpr(inner) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        }

        if (node.type === 'unary_operator' || node.type === 'not_operator') {
            const op = node.childForFieldName('operator')?.text || (node.type === 'not_operator' ? 'not' : '-');
            const arg = this.visitExpr(node.childForFieldName('argument') || node.namedChild(0));
            return {
                nodeType: 'UnaryExpression', id: `un-${node.id}`,
                attributes: { operator: op === 'not' ? '!' : op, prefix: true },
                children: [arg], metadata: meta
            };
        }

        if (node.type === 'binary_operator' || node.type === 'boolean_operator') {
            const left = this.visitExpr(node.childForFieldName('left')!);
            const right = this.visitExpr(node.childForFieldName('right')!);
            let op = node.childForFieldName('operator')?.text || 'and';
            if (op === 'and') op = '&&';
            if (op === 'or') op = '||';
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'comparison_operator') {
            const left = this.visitExpr(node.child(0)!);
            const right = this.visitExpr(node.child(2)!);
            const op = node.child(1)?.text || '==';
            return { nodeType: 'BinaryExpression', id: `cmp-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'call') {
            const func = node.childForFieldName('function');
            const argsNode = node.childForFieldName('arguments');
            const args = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c)) : [];

            let callee = func?.text || '';

            if (func?.type === 'attribute') {
                const obj = func.childForFieldName('object')?.text || '';
                const attr = func.childForFieldName('attribute')?.text || '';
                callee = `${obj}.${attr}`;

                // MicroPython: led.on() → Pin.on, led.off() → Pin.off
                if (attr === 'on' && args.length === 0) {
                    return { nodeType: 'CallExpression', id: `on-${node.id}`, attributes: { callee: 'Pin.on' }, children: [this.visitExpr(func.childForFieldName('object'))], metadata: meta };
                }
                if (attr === 'off' && args.length === 0) {
                    return { nodeType: 'CallExpression', id: `off-${node.id}`, attributes: { callee: 'Pin.off' }, children: [this.visitExpr(func.childForFieldName('object'))], metadata: meta };
                }

                // MicroPython / CircuitPython: pin.value() / pin.value(val)
                if (attr === 'value') {
                    if (args.length === 1) {
                        return { nodeType: 'CallExpression', id: `set-${node.id}`, attributes: { callee: 'Pin.value' }, children: [this.visitExpr(func.childForFieldName('object')), args[0]], metadata: meta };
                    } else if (args.length === 0) {
                        return { nodeType: 'CallExpression', id: `get-${node.id}`, attributes: { callee: 'Pin.value' }, children: [this.visitExpr(func.childForFieldName('object'))], metadata: meta };
                    }
                }
            }

            if (callee === 'print') return { nodeType: 'Print', id: `p-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep_ms' || callee === 'sleep_ms' || callee === 'utime.sleep_ms') return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep' || callee === 'sleep' || callee === 'utime.sleep') {
                if (args.length > 0 && args[0].nodeType === 'Literal') {
                    const secs = args[0].attributes.value as number;
                    return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: secs * 1000 }, children: [] }], metadata: meta };
                }
                return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            }
            // machine.Pin or Pin
            if (callee === 'Pin' || callee === 'machine.Pin') {
                return { nodeType: 'CallExpression', id: `pin-${node.id}`, attributes: { callee: 'Pin' }, children: args, metadata: meta };
            }
            // CircuitPython: digitalio.DigitalInOut → Pin
            if (callee === 'digitalio.DigitalInOut') {
                // args[0] is the board pin expr (already visited)
                return { nodeType: 'CallExpression', id: `pin-${node.id}`, attributes: { callee: 'Pin' }, children: [...args, { nodeType: 'Literal', id: `m-${node.id}`, attributes: { value: 1 }, children: [] } as BaseNode], metadata: meta };
            }

            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee }, children: args, metadata: meta };
        }

        if (node.type === 'attribute') {
            const obj = node.childForFieldName('object')?.text;
            const attr = node.childForFieldName('attribute')?.text;

            // MicroPython Pin constants
            if (obj === 'Pin' || obj === 'machine.Pin') {
                if (attr === 'IN') return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
                if (attr === 'OUT') return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'PULL_UP') return { nodeType: 'Literal', id: 'pullup', attributes: { value: 2 }, children: [], metadata: meta };
            }

            // CircuitPython Direction constants
            if (obj === 'digitalio.Direction' || obj === 'Direction') {
                if (attr === 'OUTPUT') return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'INPUT') return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
            }

            // board.D2, board.GP0, board.LED, etc.
            if (obj === 'board' && attr) {
                const match = attr.match(/\d+/);
                if (match) {
                    return { nodeType: 'Literal', id: `pin-${node.id}`, attributes: { value: parseInt(match[0]) }, children: [], metadata: meta };
                }
                // board.LED → pin 25 (RP2040 default)
                if (attr === 'LED') return { nodeType: 'Literal', id: `pin-${node.id}`, attributes: { value: 25 }, children: [], metadata: meta };
            }
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }
}
