// src/engine/asl/plugins/python/PythonParser.ts
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
        }
    }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (this.ready && this.parser) {
            return this._parseWithTreeSitter(code);
        }
        return this._parseWithRegex(code);
    }

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
            if (n.children && Array.isArray(n.children)) n.children.forEach(findErrors);
        };
        findErrors(tree.rootNode);
        return { ast, errors };
    }

    private _parseWithRegex(code: string): { ast: ProgramNode; errors: AnalysisIssue[] } {
        const fallback = new RegexPythonParser();
        const ast = fallback.parse(code);
        return { ast, errors: [] };
    }
}

// ---------------------------------------------------------------------------
// RegexPythonParser
// ---------------------------------------------------------------------------
class RegexPythonParser {
    private lines: string[] = [];
    private pos = 0;

    parse(source: string): ProgramNode {
        this.lines = source.split('\n');
        this.pos = 0;

        const rootNodes: BaseNode[] = [];
        const setupNodes: BaseNode[] = [];
        const loopNodes: BaseNode[] = [];
        let pendingComments: string[] = [];

        interface BlockContext {
            node: BaseNode;
            indent: number;
            type: 'while' | 'for' | 'match' | 'case' | 'if';
        }
        const stack: BlockContext[] = [];

        const getActiveChildren = () => {
            if (stack.length > 0) return stack[stack.length - 1].node.children;
            return setupNodes;
        };

        while (this.pos < this.lines.length) {
            const raw = this.lines[this.pos];
            const line = raw.trimEnd();
            const trimmed = line.trim();
            const indent = line.length - line.trimStart().length;

            if (!trimmed) { this.pos++; continue; }

            if (trimmed.startsWith('#')) {
                pendingComments.push(trimmed);
                this.pos++;
                continue;
            }

            while (stack.length > 0 && indent <= stack[stack.length - 1].indent) stack.pop();

            if (/^(import|from)\s/.test(trimmed)) { this.pos++; continue; }

            // ── Enum-like class (class X: A=0; B=1) ─────────────────────────
            const classM = trimmed.match(/^class\s+(\w+)\s*(?:\([^)]*\))?\s*:/);
            if (classM) {
                const className = classM[1];
                const members: { name: string; value: number }[] = [];
                let j = this.pos + 1;
                while (j < this.lines.length) {
                    const cl = this.lines[j].trim();
                    if (!cl || cl.startsWith('#')) { j++; continue; }
                    const memberM = cl.match(/^(\w+)\s*=\s*(\d+)\s*$/);
                    if (memberM) { members.push({ name: memberM[1], value: parseInt(memberM[2]) }); j++; }
                    else break;
                }
                const enumNode: BaseNode = {
                    nodeType: 'EnumDeclaration', id: `enum-${this.pos}`,
                    attributes: { name: className, members }, children: [],
                    metadata: { line: this.pos + 1 }
                };
                getActiveChildren().push(enumNode);
                this.pos = j;
                continue;
            }

            if (/^while\s+(True|1)\s*:/.test(trimmed)) {
                const whileNode: BaseNode = {
                    nodeType: 'WhileLoop', id: `while-${this.pos}`, attributes: {}, children: [
                        { nodeType: 'Literal', id: `lit-true-${this.pos}`, attributes: { value: 1 }, children: [] }
                    ]
                };
                if (stack.length === 0) loopNodes.push(whileNode);
                else getActiveChildren().push(whileNode);
                stack.push({ node: whileNode, indent, type: 'while' });
                this.pos++;
                continue;
            }

            const forM = trimmed.match(/^for\s+(\w+)\s+in\s+([^:]+):/);
            if (forM) {
                const varName = forM[1];
                let iterableStr = forM[2].trim();
                const forNode: BaseNode = { nodeType: 'ForLoop', id: `for-${this.pos}`, attributes: { hasInit: true, hasUpdate: true }, children: [] };

                if (iterableStr.startsWith('range(')) {
                    const argStr = iterableStr.substring(6, iterableStr.length - 1);
                    const args = argStr.split(',').map(s => s.trim());
                    let start = 0, stop = 10;
                    if (args.length === 1) stop = parseInt(args[0]) || 0;
                    else if (args.length >= 2) { start = parseInt(args[0]) || 0; stop = parseInt(args[1]) || 0; }
                    forNode.children.push(
                        { nodeType: 'VariableDeclaration', id: `init-${this.pos}`, attributes: { name: varName, type: 'int' }, children: [{ nodeType: 'Literal', id: `l0-${this.pos}`, attributes: { value: start }, children: [] }] },
                        { nodeType: 'BinaryExpression', id: `cond-${this.pos}`, attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: `id-${this.pos}`, attributes: { name: varName }, children: [] }, { nodeType: 'Literal', id: `l1-${this.pos}`, attributes: { value: stop }, children: [] }] },
                        { nodeType: 'UnaryExpression', id: `upd-${this.pos}`, attributes: { operator: '++', prefix: false }, children: [{ nodeType: 'Identifier', id: `id-u-${this.pos}`, attributes: { name: varName }, children: [] }] }
                    );
                } else {
                    let target = iterableStr;
                    let isReversed = false;
                    if (iterableStr.startsWith('reversed(')) { target = iterableStr.substring(9, iterableStr.length - 1); isReversed = true; }
                    const indexVar = `__i_${this.pos}`;
                    const lenExpr: BaseNode = { nodeType: 'CallExpression', id: `len-${this.pos}`, attributes: { callee: 'len' }, children: [{ nodeType: 'Identifier', id: `target-${this.pos}`, attributes: { name: target }, children: [] }] };
                    if (!isReversed) {
                        forNode.children.push(
                            { nodeType: 'VariableDeclaration', id: `init-${this.pos}`, attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'Literal', id: `l0-${this.pos}`, attributes: { value: 0 }, children: [] }] },
                            { nodeType: 'BinaryExpression', id: `cond-${this.pos}`, attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: `id-${this.pos}`, attributes: { name: indexVar }, children: [] }, lenExpr] },
                            { nodeType: 'UnaryExpression', id: `upd-${this.pos}`, attributes: { operator: '++', prefix: false }, children: [{ nodeType: 'Identifier', id: `id-u-${this.pos}`, attributes: { name: indexVar }, children: [] }] }
                        );
                    } else {
                        forNode.children.push(
                            { nodeType: 'VariableDeclaration', id: `init-${this.pos}`, attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'BinaryExpression', id: `s-${this.pos}`, attributes: { operator: '-' }, children: [lenExpr, { nodeType: 'Literal', id: `lit1-${this.pos}`, attributes: { value: 1 }, children: [] }] } as BaseNode] },
                            { nodeType: 'BinaryExpression', id: `cond-${this.pos}`, attributes: { operator: '>=' }, children: [{ nodeType: 'Identifier', id: `id-${this.pos}`, attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: `l0-${this.pos}`, attributes: { value: 0 }, children: [] }] },
                            { nodeType: 'UnaryExpression', id: `upd-${this.pos}`, attributes: { operator: '--', prefix: false }, children: [{ nodeType: 'Identifier', id: `id-u-${this.pos}`, attributes: { name: indexVar }, children: [] }] }
                        );
                    }
                    if (varName.includes(',')) {
                        const vars = varName.split(',').map(v => v.trim());
                        const tmpVar = `__val_${this.pos}`;
                        forNode.children.push({ nodeType: 'VariableDeclaration', id: `map-tmp-${this.pos}`, attributes: { name: tmpVar, type: 'auto' }, children: [{ nodeType: 'SubscriptExpression', id: `sub-${this.pos}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-t-${this.pos}`, attributes: { name: target }, children: [] }, { nodeType: 'Identifier', id: `id-ix-${this.pos}`, attributes: { name: indexVar }, children: [] }] } as BaseNode] });
                        vars.forEach((v, idx) => { forNode.children.push({ nodeType: 'ExpressionStatement', id: `map-${this.pos}-${idx}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `map-ass-${this.pos}-${idx}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-v-${this.pos}-${idx}`, attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: `sub-v-${this.pos}-${idx}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-tmp-${this.pos}-${idx}`, attributes: { name: tmpVar }, children: [] }, { nodeType: 'Literal', id: `lit-ix-${this.pos}-${idx}`, attributes: { value: idx }, children: [] }] } as BaseNode] } as BaseNode] } as BaseNode); });
                    } else {
                        forNode.children.push({ nodeType: 'ExpressionStatement', id: `map-${this.pos}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `map-ass-${this.pos}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-v-${this.pos}`, attributes: { name: varName }, children: [] }, { nodeType: 'SubscriptExpression', id: `sub-${this.pos}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-t-${this.pos}`, attributes: { name: target }, children: [] }, { nodeType: 'Identifier', id: `id-ix-${this.pos}`, attributes: { name: indexVar }, children: [] }] } as BaseNode] } as BaseNode] } as BaseNode);
                    }
                }
                getActiveChildren().push(forNode);
                stack.push({ node: forNode, indent, type: 'for' });
                this.pos++;
                continue;
            }

            const matchM = trimmed.match(/^match\s+(.+)\s*:/);
            if (matchM) {
                const subject = this._parseExpr(matchM[1].trim(), this.pos + 1);
                const matchNode: BaseNode = { nodeType: 'SwitchStatement', id: `sw-${this.pos}`, attributes: {}, children: [subject] };
                getActiveChildren().push(matchNode);
                stack.push({ node: matchNode, indent, type: 'match' });
                this.pos++;
                continue;
            }

            if (stack.length > 0 && stack[stack.length - 1].type === 'match') {
                const caseM = trimmed.match(/^case\s+(.+)\s*:/);
                if (caseM) {
                    const pattern = caseM[1].trim();
                    const isDefault = pattern === '_';
                    const caseNode: BaseNode = { nodeType: 'CaseClause', id: `case-${this.pos}`, attributes: { isDefault }, children: [] };
                    if (!isDefault) caseNode.children.push(this._parseExpr(pattern, this.pos + 1));
                    stack[stack.length - 1].node.children.push(caseNode);
                    stack.push({ node: caseNode, indent, type: 'case' });
                    this.pos++;
                    continue;
                }
            }

            const node = this._parseLine(trimmed, this.pos + 1);
            if (node) {
                if (pendingComments.length > 0) { node.leadingComments = [...pendingComments]; pendingComments = []; }
                getActiveChildren().push(node);
                if (node.nodeType === 'VariableDeclaration' && stack.length === 0) rootNodes.push(node);
            }
            this.pos++;
        }

        const addBreaks = (nodes: BaseNode[]) => {
            nodes.forEach(n => {
                if (n.nodeType === 'SwitchStatement') {
                    n.children.slice(1).forEach(c => {
                        if (c.nodeType === 'CaseClause') c.children.push({ nodeType: 'BreakStatement', id: `brk-post-${c.id}`, attributes: {}, children: [] });
                    });
                }
            });
        };
        addBreaks(setupNodes);
        addBreaks(loopNodes);

        return {
            nodeType: 'Program', id: 'root', attributes: {},
            children: [
                ...rootNodes,
                { nodeType: 'Function', id: 'setup', attributes: { name: 'setup' }, children: setupNodes },
                { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: loopNodes },
            ],
        };
    }

    private _parseLine(trimmed: string, lineNum: number): BaseNode | null {
        const meta = { line: lineNum };

        if (/^(import|from)\s/.test(trimmed)) return null;

        // ── print(...) ──────────────────────────────────────────────────────
        const printM = trimmed.match(/^print\s*\((.+)\)\s*$/);
        if (printM) return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'Print', id: `print-${lineNum}`, attributes: { newline: true }, children: [this._parseExpr(printM[1].trim(), lineNum)] } as BaseNode], metadata: meta } as BaseNode;

        // ── time.sleep_ms / sleep_ms ─────────────────────────────────────────
        const sleepMsM = trimmed.match(/^(?:time\.)?sleep_ms\s*\((.+)\)\s*$/);
        if (sleepMsM) return { nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {}, children: [this._parseExpr(sleepMsM[1].trim(), lineNum)], metadata: meta } as BaseNode;

        const sleepM = trimmed.match(/^(?:time\.)?sleep\s*\((.+)\)\s*$/);
        if (sleepM) {
            const arg = this._parseExpr(sleepM[1].trim(), lineNum);
            const msArg: BaseNode = arg.nodeType === 'Literal' ? { nodeType: 'Literal', id: `ms-${lineNum}`, attributes: { value: (arg.attributes.value as number) * 1000 }, children: [] } : { nodeType: 'Literal', id: `ms-${lineNum}`, attributes: { value: 1000 }, children: [] };
            return { nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {}, children: [msArg], metadata: meta } as BaseNode;
        }

        const utimeSleepM = trimmed.match(/^utime\.sleep(?:_ms)?\s*\((.+)\)\s*$/);
        if (utimeSleepM) return { nodeType: 'DelayMs', id: `delay-${lineNum}`, attributes: {}, children: [this._parseExpr(utimeSleepM[1].trim(), lineNum)], metadata: meta } as BaseNode;

        // ── NEW: millis() / micros() ─────────────────────────────────────────
        if (/^(?:time|utime)\.ticks_ms\(\)/.test(trimmed)) return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `ms-${lineNum}`, attributes: { callee: 'millis' }, children: [] }], metadata: meta } as BaseNode;
        if (/^(?:time|utime)\.ticks_us\(\)/.test(trimmed)) return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `us-${lineNum}`, attributes: { callee: 'micros' }, children: [] }], metadata: meta } as BaseNode;

        // ── NEW: GpioRead: var = pin.value() ─────────────────────────────────
        const pinReadM = trimmed.match(/^(\w+)\s*=\s*(\w+)\.value\(\)\s*$/);
        if (pinReadM) return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: pinReadM[1], type: 'auto' }, children: [{ nodeType: 'GpioRead', id: `gr-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinReadM[2] }, children: [] }] }], metadata: meta } as BaseNode;

        // ── NEW: random.randint / randrange ──────────────────────────────────
        const randAssignM = trimmed.match(/^(\w+)\s*=\s*random\.rand(?:int|range)\s*\(([^)]+)\)\s*$/);
        if (randAssignM) {
            const args = randAssignM[2].split(',').map(a => this._parseExpr(a.trim(), lineNum));
            return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: randAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: `rnd-${lineNum}`, attributes: { callee: 'random' }, children: args }], metadata: meta } as BaseNode;
        }

        // ── NEW: Serial.available stub ────────────────────────────────────────
        if (/^(?:\w+\.any\(\)|Serial\.available\(\))/.test(trimmed)) return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `sa-${lineNum}`, attributes: { callee: 'Serial.available' }, children: [] }], metadata: meta } as BaseNode;

        // ── NEW: Serial.readString stub ───────────────────────────────────────
        const serialReadM = trimmed.match(/^(\w+)\s*=\s*(?:\w+\.read\(\)|Serial\.readString\(\))\s*$/);
        if (serialReadM) return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: serialReadM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: `sr-${lineNum}`, attributes: { callee: 'Serial.readString' }, children: [] }], metadata: meta } as BaseNode;

        const serialBeginM = trimmed.match(/^(?:#\s*)?Serial\.begin\s*\((.+)\)\s*$/);
        if (serialBeginM) return { nodeType: 'ExpressionStatement', id: `serial-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `call-${lineNum}`, attributes: { callee: 'Serial.begin' }, children: [this._parseExpr(serialBeginM[1].trim(), lineNum)] } as BaseNode], metadata: meta } as BaseNode;

        const chainedPinM = trimmed.match(/^(?:machine\.)?Pin\s*\(([^)]+)\)\.value\(([^)]+)\)\s*$/);
        if (chainedPinM) {
            const pinArgs = chainedPinM[1].split(',').map(s => s.trim());
            return { nodeType: 'GpioSet', id: `pinval-${lineNum}`, attributes: {}, children: [this._parseExpr(pinArgs[0], lineNum), this._parseExpr(chainedPinM[2].trim(), lineNum)], metadata: meta } as BaseNode;
        }

        const standalonePinM = trimmed.match(/^(?:machine\.)?Pin\s*\(([^)]+)\)\s*$/);
        if (standalonePinM) {
            const args = standalonePinM[1].split(',').map(s => s.trim());
            const pinNum = this._parseExpr(args[0], lineNum);
            const mode = /IN/.test(args[1] || 'Pin.OUT') ? 0 : 1;
            return { nodeType: 'ExpressionStatement', id: `pin-stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `pin-call-${lineNum}`, attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: `mode-${lineNum}`, attributes: { value: mode }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
        }

        const pinOnM = trimmed.match(/^(\w+)\.on\(\)\s*$/);
        if (pinOnM) return { nodeType: 'GpioSet', id: `on-${lineNum}`, attributes: { value: 1 }, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinOnM[1] }, children: [] } as BaseNode], metadata: meta } as BaseNode;

        const pinOffM = trimmed.match(/^(\w+)\.off\(\)\s*$/);
        if (pinOffM) return { nodeType: 'GpioSet', id: `off-${lineNum}`, attributes: { value: 0 }, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinOffM[1] }, children: [] } as BaseNode], metadata: meta } as BaseNode;

        const pinValSetM = trimmed.match(/^(\w+)\.value\(([^)]+)\)\s*$/);
        if (pinValSetM) return { nodeType: 'GpioSet', id: `pinval-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinValSetM[1] }, children: [] } as BaseNode, this._parseExpr(pinValSetM[2].trim(), lineNum)], metadata: meta } as BaseNode;

        const adcReadM = trimmed.match(/^(\w+)\.read(?:_u16)?\(\)\s*$/);
        if (adcReadM) return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'AnalogRead', id: `adc-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: adcReadM[1] }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;

        const cpDioM = trimmed.match(/^(\w+)\.value\s*=\s*(.+)\s*$/);
        if (cpDioM) return { nodeType: 'GpioSet', id: `pinval-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: cpDioM[1] }, children: [] } as BaseNode, this._parseBoolExpr(cpDioM[2].trim(), lineNum)], metadata: meta } as BaseNode;

        const pinAssignM = trimmed.match(/^(\w+)\s*=\s*(?:machine\.)?Pin\s*\(([^)]+)\)\s*$/);
        if (pinAssignM) {
            const args = pinAssignM[2].split(',').map(s => s.trim());
            const pinNum = this._parseExpr(args[0], lineNum);
            const mode = /IN/.test(args[1] || 'Pin.OUT') ? 0 : 1;
            return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: pinAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: `pin-${lineNum}`, attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: `mode-${lineNum}`, attributes: { value: mode }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
        }

        const cpPinAssignM = trimmed.match(/^(\w+)\s*=\s*digitalio\.DigitalInOut\s*\(([^)]+)\)\s*$/);
        if (cpPinAssignM) {
            const pinNumMatch = cpPinAssignM[2].match(/\d+/);
            const pinNum: BaseNode = { nodeType: 'Literal', id: `pin-${lineNum}`, attributes: { value: pinNumMatch ? parseInt(pinNumMatch[0]) : 0 }, children: [] };
            return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: cpPinAssignM[1], type: 'auto' }, children: [{ nodeType: 'CallExpression', id: `pin-${lineNum}`, attributes: { callee: 'Pin' }, children: [pinNum, { nodeType: 'Literal', id: `mode-${lineNum}`, attributes: { value: 1 }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
        }

        const cpDirM = trimmed.match(/^(\w+)\.direction\s*=\s*digitalio\.Direction\.(OUTPUT|INPUT)\s*$/);
        if (cpDirM) {
            const mode = cpDirM[2] === 'OUTPUT' ? 1 : 0;
            return { nodeType: 'ExpressionStatement', id: `stmt-${lineNum}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `mode-${lineNum}`, attributes: { callee: 'pinMode' }, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: cpDirM[1] }, children: [] } as BaseNode, { nodeType: 'Literal', id: `modelit-${lineNum}`, attributes: { value: mode }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
        }

        const returnM = trimmed.match(/^return\s*(.*)$/);
        if (returnM) {
            const val = returnM[1].trim();
            const child = val ? this._parseExpr(val, lineNum) : null;
            return { nodeType: 'ReturnStatement', id: `ret-${lineNum}`, attributes: {}, children: child ? [child] : [], metadata: meta } as BaseNode;
        }

        if (trimmed === 'break') return { nodeType: 'BreakStatement', id: `brk-${lineNum}`, attributes: {}, children: [], metadata: meta } as BaseNode;
        if (trimmed === 'continue') return { nodeType: 'ContinueStatement', id: `cont-${lineNum}`, attributes: {}, children: [], metadata: meta } as BaseNode;

        // ── Augmented assignment: var += expr ────────────────────────────────
        const augM = trimmed.match(/^(\w+)\s*(\+=|-=|\*=|\/=|%=|&=|\|=|\^=)\s*(.+)$/);
        if (augM) {
            const simpleOp = augM[2].replace('=', '');
            const left: BaseNode = { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: augM[1] }, children: [] };
            const right = this._parseExpr(augM[3].trim(), lineNum);
            return {
                nodeType: 'ExpressionStatement', id: `aug-${lineNum}`, attributes: {},
                children: [{ nodeType: 'BinaryExpression', id: `op-${lineNum}`, attributes: { operator: '=' }, children: [left, { nodeType: 'BinaryExpression', id: `aug-inner-${lineNum}`, attributes: { operator: simpleOp }, children: [left, right] } as BaseNode] } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // ── Generic assignment ───────────────────────────────────────────────
        const assignM = trimmed.match(/^(\w+)\s*=\s*(.+)\s*$/);
        if (assignM && !/^(if|while|for|def|class|import|from|return|pass)$/.test(assignM[1])) {
            return { nodeType: 'VariableDeclaration', id: `decl-${lineNum}`, attributes: { name: assignM[1], type: 'auto' }, children: [this._parseExpr(assignM[2].trim(), lineNum)], metadata: meta } as BaseNode;
        }

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

        // ── NEW: millis / micros inline ──────────────────────────────────────
        if (/^(?:time|utime)\.ticks_ms\(\)$/.test(s)) return { nodeType: 'CallExpression', id: `ms-${lineNum}`, attributes: { callee: 'millis' }, children: [], metadata: meta };
        if (/^(?:time|utime)\.ticks_us\(\)$/.test(s)) return { nodeType: 'CallExpression', id: `us-${lineNum}`, attributes: { callee: 'micros' }, children: [], metadata: meta };

        // ── NEW: random inline ───────────────────────────────────────────────
        const randInlineM = s.match(/^random\.rand(?:int|range)\s*\(([^)]+)\)$/);
        if (randInlineM) {
            const args = randInlineM[1].split(',').map(a => this._parseExpr(a.trim(), lineNum));
            return { nodeType: 'CallExpression', id: `rnd-${lineNum}`, attributes: { callee: 'random' }, children: args, metadata: meta };
        }

        // ── NEW: GpioRead inline — pin.value() ───────────────────────────────
        const pinValueM = s.match(/^(\w+)\.value\(\)$/);
        if (pinValueM) return { nodeType: 'GpioRead', id: `gr-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pinValueM[1] }, children: [] }], metadata: meta };

        // ── NEW: ConditionalExpression — val if cond else other ───────────────
        const condM = s.match(/^(.+?)\s+if\s+(.+?)\s+else\s+(.+)$/);
        if (condM) {
            return {
                nodeType: 'ConditionalExpression', id: `cond-${lineNum}`, attributes: {},
                children: [
                    this._parseExpr(condM[2].trim(), lineNum),
                    this._parseExpr(condM[1].trim(), lineNum),
                    this._parseExpr(condM[3].trim(), lineNum),
                ],
                metadata: meta
            };
        }

        // ── NEW: Unary ────────────────────────────────────────────────────────
        if (s.startsWith('not ')) return { nodeType: 'UnaryExpression', id: `un-${lineNum}`, attributes: { operator: '!', prefix: true }, children: [this._parseExpr(s.substring(4).trim(), lineNum)], metadata: meta };
        if (s.startsWith('-') && s.length > 1 && !/^-[\d]/.test(s)) return { nodeType: 'UnaryExpression', id: `un-${lineNum}`, attributes: { operator: '-', prefix: true }, children: [this._parseExpr(s.substring(1).trim(), lineNum)], metadata: meta };

        // ── NEW: Binary & Comparison — all operators ─────────────────────────
        for (const op of ['==', '!=', '<=', '>=', ' and ', ' or ', ' < ', ' > ', ' + ', ' - ', ' * ', ' / ', ' % ', ' & ', ' | ', ' ^ ']) {
            const idx = s.indexOf(op);
            if (idx > 0) {
                const left = s.substring(0, idx).trim();
                const right = s.substring(idx + op.length).trim();
                let aslOp = op.trim();
                if (aslOp === 'and') aslOp = '&&';
                if (aslOp === 'or') aslOp = '||';
                return { nodeType: 'BinaryExpression', id: `bin-${lineNum}`, attributes: { operator: aslOp }, children: [this._parseExpr(left, lineNum), this._parseExpr(right, lineNum)], metadata: meta };
            }
        }

        // Dictionary Literal
        if (s.startsWith('{') && s.endsWith('}')) {
            const inner = s.slice(1, -1).trim();
            const pairs = inner.split(',').filter(p => p.trim());
            const children: BaseNode[] = [];
            for (const p of pairs) {
                const parts = p.split(':');
                if (parts.length >= 2) { children.push(this._parseExpr(parts[0].trim(), lineNum)); children.push(this._parseExpr(parts.slice(1).join(':').trim(), lineNum)); }
            }
            return { nodeType: 'ObjectInitializer', id: `dict-${lineNum}`, attributes: {}, children, metadata: meta };
        }

        // Subscript access: obj[key]
        const subscriptM = s.match(/^(\w+)\s*\[(.*)\]$/);
        if (subscriptM) return { nodeType: 'SubscriptExpression', id: `sub-${lineNum}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: subscriptM[1] }, children: [] }, this._parseExpr(subscriptM[2].trim(), lineNum)], metadata: meta };

        const idCallM = s.match(/^(\w+)\.id\(\)$/);
        if (idCallM) return { nodeType: 'CallExpression', id: `id-${lineNum}`, attributes: { callee: 'Pin.id' }, children: [{ nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: idCallM[1] }, children: [] }], metadata: meta };

        if (/^-?\d+$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseInt(s) }, children: [], metadata: meta };
        if (/^-?\d+\.\d+$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseFloat(s) }, children: [], metadata: meta };
        if (/^['"].*['"]$/.test(s)) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: s.slice(1, -1), isString: true }, children: [], metadata: meta };

        if (s === 'Pin.OUT') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (s === 'Pin.IN') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (s === 'Pin.PULL_UP') return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: 2 }, children: [], metadata: meta };

        const boardM = s.match(/^board\..*?(\d+)$/);
        if (boardM) return { nodeType: 'Literal', id: `l-${lineNum}`, attributes: { value: parseInt(boardM[1]) }, children: [], metadata: meta };

        const formatM = s.match(/^(['"].*?['"])\.format\((.*)\)$/);
        if (formatM) {
            const strLiteral = this._parseExpr(formatM[1], lineNum);
            const args = formatM[2].split(',').filter(x => x.trim()).map(a => this._parseExpr(a.trim(), lineNum));
            return { nodeType: 'CallExpression', id: `fmt-${lineNum}`, attributes: { callee: 'format' }, children: [strLiteral, ...args], metadata: meta };
        }

        return { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: s }, children: [], metadata: meta };
    }
}

// ---------------------------------------------------------------------------
// PythonCstToAst — tree-sitter path
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
                if (child && (child.type === 'assignment' || child.type === 'augmented_assignment')) return this.visitAssignment(child);
                return this.visitExprStmt(node);
            }
            case 'if_statement': return this.visitIf(node);
            case 'while_statement': return this.visitWhile(node);
            case 'for_statement': return this.visitFor(node);
            case 'assignment': return this.visitAssignment(node);
            case 'augmented_assignment': return this.visitAssignment(node);
            case 'return_statement': return this.visitReturn(node);
            case 'break_statement': return this.visitBreak(node);
            case 'continue_statement': return this.visitContinue(node);
            case 'match_statement': return this.visitMatch(node);
            case 'list_comprehension': return this.visitListComprehension(node);
            // ── NEW: EnumDeclaration via class_definition ─────────────────────
            case 'class_definition': return this.visitClass(node);
            case 'import_statement':
            case 'import_from_statement':
                return { nodeType: 'Empty', id: `imp-${node.id}`, attributes: {}, children: [] };
            default:
                return { nodeType: 'Empty', id: `e-${node.id}`, attributes: {}, children: [] };
        }
    }

    visitReturn(node: any): BaseNode {
        const val = node.child(1) ? this.visitExpr(node.child(1)) : null;
        return { nodeType: 'ReturnStatement', id: `ret-${node.id}`, attributes: {}, children: val ? [val] : [], metadata: { line: node.startPosition.row + 1 } };
    }

    visitBreak(node: any): BaseNode {
        return { nodeType: 'BreakStatement', id: `brk-${node.id}`, attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
    }

    visitContinue(node: any): BaseNode {
        return { nodeType: 'ContinueStatement', id: `cont-${node.id}`, attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
    }

    visitFunction(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'anon';
        const body = node.childForFieldName('body');
        return { nodeType: 'Function', id: `fn-${node.id}`, attributes: { name }, children: body ? this.visitBlockChildren(body) : [], metadata: { line: node.startPosition.row + 1 } };
    }

    // ── NEW: visitClass — EnumDeclaration ─────────────────────────────────────
    visitClass(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'Unknown';
        const body = node.childForFieldName('body');
        const meta = { line: node.startPosition.row + 1 };
        const members: { name: string; value: number }[] = [];
        if (body) {
            body.children.forEach((c: any) => {
                if (c.type === 'expression_statement') {
                    const a = c.namedChild(0);
                    if (a?.type === 'assignment') {
                        const lname = a.childForFieldName('left')?.text;
                        const rval = a.childForFieldName('right');
                        if (lname && rval?.type === 'integer') members.push({ name: lname, value: parseInt(rval.text) });
                    }
                }
            });
        }
        return { nodeType: 'EnumDeclaration', id: `enum-${node.id}`, attributes: { name, members }, children: [], metadata: meta };
    }

    visitExprStmt(node: any): BaseNode {
        const exprNode = node.namedChild(0);
        const expr = exprNode ? this.visitExpr(exprNode) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] } as BaseNode;
        return { nodeType: 'ExpressionStatement', id: `stmt-${node.id}`, attributes: {}, children: [expr], metadata: { line: node.startPosition.row + 1 } } as BaseNode;
    }

    visitAssignment(node: any): BaseNode {
        const leftExpr = node.childForFieldName('left');
        const rightExpr = node.childForFieldName('right');
        const operator = node.childForFieldName('operator')?.text || '=';
        const left = this.visitExpr(leftExpr!);
        const right = this.visitExpr(rightExpr!);
        const meta = { line: node.startPosition.row + 1 };

        if (operator !== '=') {
            const simpleOp = operator.replace('=', '');
            return { nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' }, children: [left, { nodeType: 'BinaryExpression', id: `aug-${node.id}`, attributes: { operator: simpleOp }, children: [left, right] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
        }

        if (leftExpr && leftExpr.type === 'attribute') {
            const attr = leftExpr.childForFieldName('attribute')?.text;
            if (attr === 'value') return { nodeType: 'GpioSet', id: `set-${node.id}`, attributes: {}, children: [this.visitExpr(leftExpr.childForFieldName('object')), right], metadata: meta } as BaseNode;
            if (attr === 'direction') {
                const mode = /OUTPUT/.test(rightExpr?.text || '') ? 1 : 0;
                return { nodeType: 'ExpressionStatement', id: `dir-${node.id}`, attributes: {}, children: [{ nodeType: 'CallExpression', id: `pm-${node.id}`, attributes: { callee: 'pinMode' }, children: [this.visitExpr(leftExpr.childForFieldName('object')), { nodeType: 'Literal', id: `m-${node.id}`, attributes: { value: mode }, children: [] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode;
            }
        }

        if (leftExpr && (leftExpr.type === 'pattern_list' || leftExpr.type === 'tuple' || leftExpr.text.includes(','))) {
            const vars = leftExpr.text.split(',').map(v => v.trim());
            const tmpVar = `__tmp_${node.id}`;
            const result: BaseNode[] = [{ nodeType: 'VariableDeclaration', id: `tmp-${node.id}`, attributes: { name: tmpVar, type: 'auto' }, children: [right], metadata: meta }];
            vars.forEach((v, idx) => { result.push({ nodeType: 'ExpressionStatement', id: `unpack-${node.id}-${idx}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `ass-${node.id}-${idx}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-${node.id}-${idx}`, attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: `sub-${node.id}-${idx}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `target-${node.id}-${idx}`, attributes: { name: tmpVar }, children: [] }, { nodeType: 'Literal', id: `idx-${node.id}-${idx}`, attributes: { value: idx }, children: [] }] } as BaseNode] } as BaseNode], metadata: meta } as BaseNode); });
            return { nodeType: 'Block', id: `unpack-blk-${node.id}`, attributes: {}, children: result, metadata: meta } as BaseNode;
        }

        if (left.nodeType === 'Identifier') return { nodeType: 'VariableDeclaration', id: `decl-${node.id}`, attributes: { name: left.attributes.name, type: 'auto' }, children: [right], metadata: meta } as BaseNode;
        return { nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' }, children: [left, right] } as BaseNode], metadata: meta } as BaseNode;
    }

    visitIf(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const cons = node.childForFieldName('consequence');
        const alt = node.childForFieldName('alternative');
        const thenBlock: BaseNode = { nodeType: 'Block', id: `blk-${node.id}-then`, attributes: {}, children: cons ? this.visitBlockChildren(cons) : [], metadata: { line: node.startPosition.row + 1 } };
        const children = [cond, thenBlock];
        if (alt) {
            const body = alt.child(1);
            if (body && body.type === 'if_statement') { const nestedIf = this.visitIf(body); if (nestedIf) children.push(nestedIf); }
            else if (body) children.push({ nodeType: 'Block', id: `blk-${node.id}-else`, attributes: {}, children: this.visitBlockChildren(body), metadata: { line: alt.startPosition.row + 1 } });
        }
        return { nodeType: 'IfStatement', id: `if-${node.id}`, attributes: {}, children, metadata: { line: node.startPosition.row + 1 } };
    }

    visitWhile(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const body = node.childForFieldName('body');
        return { nodeType: 'WhileLoop', id: `while-${node.id}`, attributes: {}, children: [cond, ...(body ? this.visitBlockChildren(body) : [])], metadata: { line: node.startPosition.row + 1 } };
    }

    visitFor(node: any): BaseNode {
        const leftExpr = node.childForFieldName('left');
        const rightExpr = node.childForFieldName('right');
        const body = node.childForFieldName('body');
        const meta = { line: node.startPosition.row + 1 };
        const leftText = leftExpr?.text || 'i';
        const indexVar = `__i_${node.id % 1000000}`;
        let init: BaseNode, condition: BaseNode, update: BaseNode;
        let extraBody: BaseNode[] = [];

        if (rightExpr?.type === 'call' && rightExpr.childForFieldName('function')?.text === 'range') {
            const argsNode = rightExpr.childForFieldName('arguments');
            const vArgs = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c)) : [];
            let start = 0, stop = 10, step = 1;
            if (vArgs.length === 1) { if (vArgs[0].nodeType === 'Literal') stop = vArgs[0].attributes.value; }
            else if (vArgs.length >= 2) { if (vArgs[0].nodeType === 'Literal') start = vArgs[0].attributes.value; if (vArgs[1].nodeType === 'Literal') stop = vArgs[1].attributes.value; if (vArgs.length >= 3 && vArgs[2].nodeType === 'Literal') step = vArgs[2].attributes.value; }
            init = { nodeType: 'VariableDeclaration', id: `init-${node.id}`, attributes: { name: leftText, type: 'int' }, children: [{ nodeType: 'Literal', id: `lit-0-${node.id}`, attributes: { value: start }, children: [] }] };
            condition = { nodeType: 'BinaryExpression', id: `cond-${node.id}`, attributes: { operator: step > 0 ? '<' : '>' }, children: [{ nodeType: 'Identifier', id: `id-${node.id}`, attributes: { name: leftText }, children: [] }, vArgs.length >= 2 ? vArgs[1] : (vArgs.length === 1 ? vArgs[0] : { nodeType: 'Literal', id: 'l', attributes: { value: 10 }, children: [] })] };
            update = { nodeType: 'ExpressionStatement', id: `upd-${node.id}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `u-${node.id}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-u-${node.id}`, attributes: { name: leftText }, children: [] }, { nodeType: 'BinaryExpression', id: `add-${node.id}`, attributes: { operator: '+' }, children: [{ nodeType: 'Identifier', id: `id-u2-${node.id}`, attributes: { name: leftText }, children: [] }, { nodeType: 'Literal', id: `step-${node.id}`, attributes: { value: step }, children: [] }] } as BaseNode] } as BaseNode] };
        } else {
            const iterable = this.visitExpr(rightExpr!);
            init = { nodeType: 'VariableDeclaration', id: `init-${node.id}`, attributes: { name: indexVar, type: 'int' }, children: [{ nodeType: 'Literal', id: `lit-0-${node.id}`, attributes: { value: 0 }, children: [] }] };
            condition = { nodeType: 'BinaryExpression', id: `cond-${node.id}`, attributes: { operator: '<' }, children: [{ nodeType: 'Identifier', id: `idx-${node.id}`, attributes: { name: indexVar }, children: [] }, { nodeType: 'CallExpression', id: `len-${node.id}`, attributes: { callee: 'len' }, children: [iterable] }] };
            update = { nodeType: 'ExpressionStatement', id: `upd-${node.id}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `u-${node.id}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-idx-${node.id}`, attributes: { name: indexVar }, children: [] }, { nodeType: 'BinaryExpression', id: `add-${node.id}`, attributes: { operator: '+' }, children: [{ nodeType: 'Identifier', id: `id-idx2-${node.id}`, attributes: { name: indexVar }, children: [] }, { nodeType: 'Literal', id: `step-${node.id}`, attributes: { value: 1 }, children: [] }] } as BaseNode] } as BaseNode] };
            if (leftText.includes(',')) {
                const vars = leftText.split(',').map(v => v.trim());
                const tmpVar = `__val_${node.id}`;
                extraBody.push({ nodeType: 'VariableDeclaration', id: `map-${node.id}`, attributes: { name: tmpVar, type: 'auto' }, children: [{ nodeType: 'SubscriptExpression', id: `sub-${node.id}`, attributes: {}, children: [iterable, { nodeType: 'Identifier', id: `idx-a-${node.id}`, attributes: { name: indexVar }, children: [] }] } as BaseNode] });
                vars.forEach((v, idx) => { extraBody.push({ nodeType: 'ExpressionStatement', id: `map-${node.id}-${idx}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `map-ass-${node.id}-${idx}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-v-${node.id}-${idx}`, attributes: { name: v }, children: [] }, { nodeType: 'SubscriptExpression', id: `sub-v-${node.id}-${idx}`, attributes: {}, children: [{ nodeType: 'Identifier', id: `id-tmp-${node.id}-${idx}`, attributes: { name: tmpVar }, children: [] }, { nodeType: 'Literal', id: `lit-ix-${node.id}-${idx}`, attributes: { value: idx }, children: [] }] } as BaseNode] } as BaseNode] }); });
            } else {
                extraBody.push({ nodeType: 'ExpressionStatement', id: `map-${node.id}`, attributes: {}, children: [{ nodeType: 'BinaryExpression', id: `map-ass-${node.id}`, attributes: { operator: '=' }, children: [{ nodeType: 'Identifier', id: `id-v-${node.id}`, attributes: { name: leftText }, children: [] }, { nodeType: 'SubscriptExpression', id: `sub-${node.id}`, attributes: {}, children: [iterable, { nodeType: 'Identifier', id: `idx-a-${node.id}`, attributes: { name: indexVar }, children: [] }] } as BaseNode] } as BaseNode] });
            }
        }
        return { nodeType: 'ForLoop', id: `for-${node.id}`, attributes: { hasInit: true, hasUpdate: true }, children: [init, condition, update, ...extraBody, ...(body ? this.visitBlockChildren(body) : [])], metadata: meta } as BaseNode;
    }

    visitMatch(node: any): BaseNode {
        const subject = node.childForFieldName('subject');
        const discriminant = subject ? this.visitExpr(subject) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };
        const cases: BaseNode[] = [];
        node.children.forEach((c: any) => {
            if (c.type === 'case_clause') {
                const pattern = c.childForFieldName('pattern');
                const body = c.childForFieldName('body');
                const isDefault = pattern?.text === '_' || pattern?.type === 'wildcard_pattern';
                const test = isDefault ? null : (pattern ? this.visitExpr(pattern) : null);
                cases.push({ nodeType: 'CaseClause', id: `case-${c.id}`, attributes: { isDefault }, children: [...(test ? [test as BaseNode] : []), ...(body ? this.visitBlockChildren(body) : []), { nodeType: 'BreakStatement', id: `brk-${c.id}`, attributes: {}, children: [] } as BaseNode], metadata: { line: c.startPosition.row + 1 } });
            }
        });
        return { nodeType: 'SwitchStatement', id: `sw-${node.id}`, attributes: {}, children: [discriminant as BaseNode, ...cases], metadata: { line: node.startPosition.row + 1 } };
    }

    visitListComprehension(node: any): BaseNode {
        const bodyNode = node.childForFieldName('body');
        const forIn = node.namedChild(1);
        const meta = { line: node.startPosition.row + 1 };
        if (bodyNode && forIn && forIn.type === 'for_in_clause') {
            const left = forIn.childForFieldName('left');
            const right = forIn.childForFieldName('right');
            const varName = left?.text;
            if (right?.type === 'call' && right.childForFieldName('function')?.text === 'range' && varName) {
                const argsNode = right.childForFieldName('arguments');
                if (argsNode) {
                    const argsNodes = argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',');
                    let start = 0, stop = 10;
                    const vArgs = argsNodes.map(a => this.visitExpr(a));
                    if (vArgs.length === 1 && vArgs[0].nodeType === 'Literal') stop = vArgs[0].attributes.value;
                    else if (vArgs.length >= 2) { if (vArgs[0].nodeType === 'Literal') start = vArgs[0].attributes.value; if (vArgs[1].nodeType === 'Literal') stop = vArgs[1].attributes.value; }
                    if (stop - start >= 0 && stop - start < 50) {
                        const elements: BaseNode[] = [];
                        for (let i = start; i < stop; i++) {
                            const env = new Map<string, BaseNode>();
                            env.set(varName, { nodeType: 'Literal', id: `lit-${i}`, attributes: { value: i }, children: [] });
                            elements.push(this.visitExpr(bodyNode, env));
                        }
                        return { nodeType: 'ArrayInitializer', id: `lc-${node.id}`, attributes: { isArray: true }, children: elements, metadata: meta };
                    }
                }
            }
        }
        return { nodeType: 'ArrayInitializer', id: `lc-${node.id}`, attributes: { isArray: true }, children: [], metadata: meta };
    }

    visitBlockChildren(node: any): BaseNode[] {
        const result: BaseNode[] = [];
        let pendingComments: string[] = [];
        node.children.forEach((c: any) => {
            if (c.type === 'comment') { pendingComments.push(c.text); return; }
            if (c.type === ':' || c.type === 'block') return;
            const visited = this.visit(c);
            if (visited) {
                if (pendingComments.length > 0) { visited.leadingComments = [...pendingComments]; pendingComments = []; }
                result.push(visited);
            }
        });
        return result;
    }

    visitExpr(node: any, env?: Map<string, BaseNode>): BaseNode {
        const meta = { line: node.startPosition.row + 1 };

        // ── NEW: conditional_expression — val if cond else other ──────────────
        if (node.type === 'conditional_expression') {
            const body = node.child(0);
            const cond = node.child(2);
            const alt = node.child(4);
            return {
                nodeType: 'ConditionalExpression', id: `tern-${node.id}`, attributes: {},
                children: [
                    cond ? this.visitExpr(cond, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] },
                    body ? this.visitExpr(body, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] },
                    alt ? this.visitExpr(alt, env) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] },
                ],
                metadata: meta
            };
        }

        if (node.type === 'integer') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/['\"]/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') {
            if (env?.has(node.text)) return env.get(node.text)!;
            return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };
        }

        if (node.type === 'list') {
            return { nodeType: 'ArrayInitializer', id: `list-${node.id}`, attributes: { isArray: true }, children: node.namedChildren.map((c: any) => this.visitExpr(c, env)) as BaseNode[], metadata: meta };
        }

        if (node.type === 'true' || (node.type === 'identifier' && node.text === 'True')) return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false' || (node.type === 'identifier' && node.text === 'False')) return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (node.type === 'none' || (node.type === 'identifier' && node.text === 'None')) return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'parenthesized_expression') {
            const inner = node.namedChild(0);
            return inner ? this.visitExpr(inner, env) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        }

        if (node.type === 'unary_operator' || node.type === 'not_operator') {
            const op = node.childForFieldName('operator')?.text || (node.type === 'not_operator' ? 'not' : '-');
            const arg = this.visitExpr(node.childForFieldName('argument') || node.namedChild(0), env);
            return { nodeType: 'UnaryExpression', id: `un-${node.id}`, attributes: { operator: op === 'not' ? '!' : op, prefix: true }, children: [arg], metadata: meta };
        }

        if (node.type === 'binary_operator' || node.type === 'boolean_operator') {
            const left = this.visitExpr(node.childForFieldName('left')!, env);
            const right = this.visitExpr(node.childForFieldName('right')!, env);
            let op = node.childForFieldName('operator')?.text || 'and';
            if (op === 'and') op = '&&';
            if (op === 'or') op = '||';
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'comparison_operator') {
            const left = this.visitExpr(node.child(0)!, env);
            const right = this.visitExpr(node.child(2)!, env);
            const op = node.child(1)?.text || '==';
            return { nodeType: 'BinaryExpression', id: `cmp-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'list_comprehension') return this.visitListComprehension(node);
        if (node.type === 'dictionary') return this.visitDictionary(node, env);
        if (node.type === 'subscript') return this.visitSubscript(node, env);

        if (node.type === 'call') {
            const func = node.childForFieldName('function');
            const argsNode = node.childForFieldName('arguments');
            const args = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c, env)) : [];
            let callee = func?.text || '';

            if (func?.type === 'attribute') {
                const objNode = func.childForFieldName('object');
                const objText = objNode?.text || '';
                const attr = func.childForFieldName('attribute')?.text || '';
                callee = `${objText}.${attr}`;

                if (attr === 'format' && objNode?.type === 'string') return { nodeType: 'CallExpression', id: `fmt-${node.id}`, attributes: { callee: 'format' }, children: [this.visitExpr(objNode, env), ...args], metadata: meta };
                if (attr === 'on' && args.length === 0) return { nodeType: 'GpioSet', id: `on-${node.id}`, attributes: { value: 1 }, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                if (attr === 'off' && args.length === 0) return { nodeType: 'GpioSet', id: `off-${node.id}`, attributes: { value: 0 }, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                if (attr === 'value') {
                    if (args.length === 1) return { nodeType: 'GpioSet', id: `set-${node.id}`, attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env), args[0]], metadata: meta };
                    if (args.length === 0) return { nodeType: 'GpioRead', id: `gr-${node.id}`, attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                }
                if (attr === 'id' && args.length === 0) return { nodeType: 'CallExpression', id: `id-${node.id}`, attributes: { callee: 'Pin.id' }, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };
                if ((attr === 'read_u16' || attr === 'read') && args.length === 0) return { nodeType: 'AnalogRead', id: `adc-${node.id}`, attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env)], metadata: meta };

                // ── NEW: AnalogWrite — pwm.duty / duty_u16 / duty_cycle ──────
                if (attr === 'duty' || attr === 'duty_u16' || attr === 'duty_cycle') return { nodeType: 'AnalogWrite', id: `aw-${node.id}`, attributes: {}, children: [this.visitExpr(func.childForFieldName('object'), env), ...args], metadata: meta };

                // ── NEW: Serial stubs ────────────────────────────────────────
                if (attr === 'any') return { nodeType: 'CallExpression', id: `sa-${node.id}`, attributes: { callee: 'Serial.available' }, children: [], metadata: meta };
            }

            if (callee === 'print') return { nodeType: 'Print', id: `p-${node.id}`, attributes: { newline: true }, children: args, metadata: meta };
            if (callee === 'enumerate') return { nodeType: 'CallExpression', id: `enum-${node.id}`, attributes: { callee: 'enumerate' }, children: args, metadata: meta };
            if (callee === 'reversed') return { nodeType: 'CallExpression', id: `rev-${node.id}`, attributes: { callee: 'reversed' }, children: args, metadata: meta };
            if (callee === 'len') return { nodeType: 'CallExpression', id: `len-${node.id}`, attributes: { callee: 'len' }, children: args, metadata: meta };
            if (callee === 'time.sleep_ms' || callee === 'sleep_ms' || callee === 'utime.sleep_ms') return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep' || callee === 'sleep' || callee === 'utime.sleep') {
                if (args.length > 0 && args[0].nodeType === 'Literal') return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: (args[0].attributes.value as number) * 1000 }, children: [] }], metadata: meta };
                return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            }
            if (callee === 'Pin' || callee === 'machine.Pin') return { nodeType: 'CallExpression', id: `pin-${node.id}`, attributes: { callee: 'Pin' }, children: args, metadata: meta };
            if (callee === 'digitalio.DigitalInOut') return { nodeType: 'CallExpression', id: `pin-${node.id}`, attributes: { callee: 'Pin' }, children: [...args, { nodeType: 'Literal', id: `m-${node.id}`, attributes: { value: 1 }, children: [] } as BaseNode], metadata: meta };

            // ── NEW: millis / micros ─────────────────────────────────────────
            if (callee === 'time.ticks_ms' || callee === 'utime.ticks_ms') return { nodeType: 'CallExpression', id: `ms-${node.id}`, attributes: { callee: 'millis' }, children: [], metadata: meta };
            if (callee === 'time.ticks_us' || callee === 'utime.ticks_us') return { nodeType: 'CallExpression', id: `us-${node.id}`, attributes: { callee: 'micros' }, children: [], metadata: meta };

            // ── NEW: random ──────────────────────────────────────────────────
            if (callee === 'random.randint' || callee === 'random.randrange' || callee === 'urandom.randint') return { nodeType: 'CallExpression', id: `rnd-${node.id}`, attributes: { callee: 'random' }, children: args, metadata: meta };
            if (callee === 'random.random') return { nodeType: 'CallExpression', id: `rnd-${node.id}`, attributes: { callee: 'random' }, children: [], metadata: meta };

            // ── NEW: tone — pyb.Timer ────────────────────────────────────────
            if (callee === 'pyb.Timer' || callee === 'machine.PWM') return { nodeType: 'CallExpression', id: `tone-${node.id}`, attributes: { callee: 'tone' }, children: args, metadata: meta };

            // ── NEW: Serial stubs ────────────────────────────────────────────
            if (callee === 'Serial.begin' || callee === 'UART' || callee === 'machine.UART') return { nodeType: 'CallExpression', id: `sb-${node.id}`, attributes: { callee: 'Serial.begin' }, children: [], metadata: meta };
            if (callee === 'Serial.readString') return { nodeType: 'CallExpression', id: `sr-${node.id}`, attributes: { callee: 'Serial.readString' }, children: [], metadata: meta };

            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee }, children: args, metadata: meta };
        }

        if (node.type === 'attribute') {
            const obj = node.childForFieldName('object')?.text;
            const attr = node.childForFieldName('attribute')?.text;
            if (obj === 'Pin' || obj === 'machine.Pin') {
                if (attr === 'IN') return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
                if (attr === 'OUT') return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'PULL_UP') return { nodeType: 'Literal', id: 'pullup', attributes: { value: 2 }, children: [], metadata: meta };
            }
            if (obj === 'digitalio.Direction' || obj === 'Direction') {
                if (attr === 'OUTPUT') return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'INPUT') return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
            }
            if (obj === 'board' && attr) {
                const match = attr.match(/\d+/);
                if (match) return { nodeType: 'Literal', id: `pin-${node.id}`, attributes: { value: parseInt(match[0]) }, children: [], metadata: meta };
                if (attr === 'LED') return { nodeType: 'Literal', id: `pin-${node.id}`, attributes: { value: 25 }, children: [], metadata: meta };
            }
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }

    visitDictionary(node: any, env?: Map<string, BaseNode>): BaseNode {
        const meta = { line: node.startPosition.row + 1 };
        const pairs = node.namedChildren.filter((c: any) => c.type === 'pair');
        const children: BaseNode[] = [];
        for (const pair of pairs) {
            const key = pair.childForFieldName('key');
            const val = pair.childForFieldName('value');
            if (key && val) { children.push(this.visitExpr(key, env)); children.push(this.visitExpr(val, env)); }
        }
        return { nodeType: 'ObjectInitializer', id: `dict-${node.id}`, attributes: {}, children, metadata: meta };
    }

    visitSubscript(node: any, env?: Map<string, BaseNode>): BaseNode {
        const meta = { line: node.startPosition.row + 1 };
        return { nodeType: 'SubscriptExpression', id: `sub-${node.id}`, attributes: {}, children: [this.visitExpr(node.childForFieldName('value'), env), this.visitExpr(node.childForFieldName('subscript'), env)], metadata: meta };
    }
}
