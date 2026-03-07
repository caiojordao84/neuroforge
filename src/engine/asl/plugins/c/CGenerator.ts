
import type { ProgramNode, BaseNode, SourceMapEntry } from '@/system/types';
import { ShimManager } from '../core/ShimManager';
import { cShims } from './shims';

export class CGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLine: number = 1;
    private shims: ShimManager;

    constructor() {
        this.shims = new ShimManager('c');
        this.shims.registerShims(cShims);
    }

    generate(ast: ProgramNode): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLine = 1;
        this.shims.resetRuntime();
        const lines: string[] = [];

        // First pass to detect shims
        this.scanForShims(ast);

        // Header
        this.addLn(lines, "// Generated C++ / Arduino Code", null);
        this.addLn(lines, '#include <Arduino.h>', null);

        // --- INJECT SHIMS ---
        const shimCode = this.shims.getRequiredShimsCode();
        if (shimCode) {
            shimCode.split('\n').forEach(line => this.addLn(lines, line, null));
        }
        this.addLn(lines, '', null);

        const finalNodes: BaseNode[] = ast.children;

        // Check if the AST already has explicit setup/loop functions
        const hasSetupFn = finalNodes.some(n => n.nodeType === 'Function' && n.attributes.name === 'setup');
        const hasLoopFn = finalNodes.some(n => n.nodeType === 'Function' && n.attributes.name === 'loop');
        const hasMainFn = finalNodes.some(n => n.nodeType === 'Function' && n.attributes.name === 'main');

        if (hasSetupFn || hasLoopFn || hasMainFn) {
            // Already structured as Arduino — emit as-is
            finalNodes.forEach(node => {
                if (node.nodeType === 'VariableDeclaration') {
                    this.genStmt(node, lines, "");
                } else if (node.nodeType === 'Function') {
                    const name = node.attributes.name;
                    const comments = this.printComments(node);
                    if (comments) this.addLn(lines, comments, null);

                    if (name === 'main') {
                        // C standalone — não Arduino
                        this.addLn(lines, `int main() {`, node);
                        node.children.forEach(c => this.genStmt(c, lines, '  '));
                        this.addLn(lines, '  return 0;', null);
                        this.addLn(lines, `}`, node);
                    } else {
                        this.addLn(lines, `void ${name}() {`, node);
                        node.children.forEach(c => this.genStmt(c, lines, "  "));
                        this.addLn(lines, "}", node);
                    }
                    this.addLn(lines, "", null);
                } else {
                    this.genStmt(node, lines, "");
                }
            });
        } else {
            // Auto-wrap: partition top-level nodes into globals, setup, loop
            const globals: BaseNode[] = [];
            const setupBody: BaseNode[] = [];
            const loopBody: BaseNode[] = [];
            const functions: BaseNode[] = [];

            for (const node of finalNodes) {
                if (node.nodeType === 'Function') {
                    functions.push(node);
                } else if (node.nodeType === 'VariableDeclaration') {
                    globals.push(node);
                } else if (node.nodeType === 'WhileLoop' && node.attributes.isInfinite) {
                    // Infinite while True → becomes loop() body
                    loopBody.push(...node.children.slice(1)); // skip condition
                } else {
                    // Everything else → setup() body
                    setupBody.push(node);
                }
            }

            // Emit global variables
            globals.forEach(node => this.genGlobalVar(node, lines));

            // Emit any helper functions
            functions.forEach(node => {
                const name = node.attributes.name;
                const comments = this.printComments(node);
                if (comments) this.addLn(lines, comments, null);
                this.addLn(lines, `void ${name}() {`, node);
                node.children.forEach(c => this.genStmt(c, lines, "  "));
                this.addLn(lines, "}", node);
                this.addLn(lines, "", null);
            });

            // Emit setup()
            this.addLn(lines, "void setup() {", null);
            // Auto-generate pinMode calls for pin-array globals
            for (const g of globals) {
                if (this.isPinArrayDecl(g)) {
                    const arrName = g.attributes.name;
                    const numVar = `num_${arrName}`;
                    this.addLn(lines, `  for (int i = 0; i < ${numVar}; i++) {`, null);
                    this.addLn(lines, `    pinMode(${arrName}[i], OUTPUT);`, null);
                    this.addLn(lines, `  }`, null);
                }
            }
            setupBody.forEach(node => this.genStmt(node, lines, "  "));
            this.addLn(lines, "}", null);
            this.addLn(lines, "", null);

            // Emit loop()
            if (loopBody.length > 0) {
                this.addLn(lines, "void loop() {", null);
                loopBody.forEach(node => this.genStmt(node, lines, "  "));
                this.addLn(lines, "}", null);
                this.addLn(lines, "", null);
            }
        }

        return { code: lines.join('\n'), map: this.sourceMap };
    }

    /** Check if a VariableDeclaration's initializer is an ArrayInitializer of Pin(...) calls */
    private isPinArrayDecl(node: BaseNode): boolean {
        if (node.nodeType !== 'VariableDeclaration') return false;
        const init = node.children[0];
        if (!init || init.nodeType !== 'ArrayInitializer') return false;
        return init.children.length > 0 && init.children.every(
            c => c.nodeType === 'CallExpression' && c.attributes.callee === 'Pin'
        );
    }

    /** Emit a global variable with special handling for Pin arrays */
    private genGlobalVar(node: BaseNode, lines: string[]) {
        const comments = this.printComments(node);
        if (comments) this.addLn(lines, comments, null);

        const init = node.children[0];
        if (init && this.isPinArrayDecl(node)) {
            // Pin array: extract pin numbers → const int name[] = {pin1, pin2, ...};
            const pinNums = init.children.map(c => {
                if (c.children.length > 0) return this.genExpr(c.children[0]);
                return '0';
            });
            this.addLn(lines, `const int ${node.attributes.name}[] = { ${pinNums.join(', ')} };`, node);
            this.addLn(lines, `const int num_${node.attributes.name} = ${pinNums.length};`, null);
        } else {
            this.genStmt(node, lines, "");
        }
    }

    private scanForShims(node: BaseNode) {
        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee || '';
            if (callee.startsWith('sevseg.')) {
                this.shims.requireShim('sevseg');
            }
        }
        if (node.children) {
            node.children.forEach(c => this.scanForShims(c));
        }
    }

    private addLn(lines: string[], text: string, node: BaseNode | null) {
        lines.push(text);
        if (node && node.metadata && node.metadata.line) {
            this.sourceMap.push({ generatedLine: this.currentLine, sourceLine: node.metadata.line });
        }
        this.currentLine += text.split('\n').length;
    }

    private printComments(node: BaseNode): string {
        if (!node.leadingComments || node.leadingComments.length === 0) return '';
        return node.leadingComments
            .map(c => {
                let text = c.trim();
                if (text.startsWith('#')) {
                    text = '//' + text.substring(1);
                }
                if (!text.startsWith('//') && !text.startsWith('/*')) {
                    text = '// ' + text;
                }
                return text;
            })
            .join('\n');
    }

    private genStmt(node: BaseNode, lines: string[], indent: string) {
        if (node.nodeType === 'Empty') return;

        const comments = this.printComments(node);
        if (comments) this.addLn(lines, `${indent}${comments}`, null);

        if (node.nodeType === 'VariableDeclaration') {
            const initializer = node.children[0];
            const isArray = initializer?.nodeType === 'ArrayInitializer';
            const val = node.children.length > 0 ? this.genExpr(initializer) : '0';
            const type = node.attributes.type || 'int';
            const arraySuffix = isArray ? '[]' : '';
            this.addLn(lines, `${indent}${type} ${node.attributes.name}${arraySuffix} = ${val};`, node);
        }
        else if (node.nodeType === 'ExpressionStatement') {
            const expr = this.genExpr(node.children[0]);
            if (expr) this.addLn(lines, `${indent}${expr};`, node);
        }
        else if (node.nodeType === 'BreakStatement') {
            this.addLn(lines, `${indent}break;`, node);
        }
        else if (node.nodeType === 'ContinueStatement') {
            this.addLn(lines, `${indent}continue;`, node);
        }
        else if (node.nodeType === 'GpioSet') {
            this.addLn(lines, `${indent}digitalWrite(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])});`, node);
        }
        else if (node.nodeType === 'DelayMs') {
            this.addLn(lines, `${indent}delay(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'IfStatement') {
            this.addLn(lines, `${indent}if (${this.genExpr(node.children[0])}) {`, node);
            if (node.children[1]) {
                node.children[1].children.forEach(c => this.genStmt(c, lines, indent + "  "));
            }

            let current = node;
            while (current.children[2]) {
                const elseNode = current.children[2];
                if (elseNode.nodeType === 'IfStatement') {
                    this.addLn(lines, `${indent}} else if (${this.genExpr(elseNode.children[0])}) {`, elseNode);
                    if (elseNode.children[1]) {
                        elseNode.children[1].children.forEach(c => this.genStmt(c, lines, indent + "  "));
                    }
                    current = elseNode;
                } else {
                    this.addLn(lines, `${indent}} else {`, null);
                    elseNode.children.forEach(c => this.genStmt(c, lines, indent + "  "));
                    break;
                }
            }
            this.addLn(lines, `${indent}}`, current);
        }
        else if (node.nodeType === 'DoWhileLoop') {
            this.addLn(lines, `${indent}do {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "  "));
            this.addLn(lines, `${indent}} while (${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'ReturnStatement') {
            if (node.children.length > 0) {
                this.addLn(lines, `${indent}return ${this.genExpr(node.children[0])};`, node);
            } else {
                this.addLn(lines, `${indent}return;`, node);
            }
        }
        else if (node.nodeType === 'AnalogWrite') {
            this.addLn(lines, `${indent}analogWrite(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])});`, node);
        }
        else if (node.nodeType === 'GpioRead') {
            this.addLn(lines, `${indent}digitalRead(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'Loop') {
            this.addLn(lines, `${indent}for (;;) {`, node);
            node.children.forEach(c => this.genStmt(c, lines, indent + "  "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'WhileLoop') {
            this.addLn(lines, `${indent}while (${this.genExpr(node.children[0])}) {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "  "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'ForLoop') {
            let childIdx = 0;
            let init = "";
            if (node.attributes.hasInit && node.children[childIdx]) {
                const initNode = node.children[childIdx];
                if (initNode.nodeType === 'VariableDeclaration') {
                    const val = initNode.children.length > 0 ? this.genExpr(initNode.children[0]) : '0';
                    const type = initNode.attributes.type || 'int';
                    init = `${type} ${initNode.attributes.name} = ${val}`;
                } else {
                    init = this.genExpr(initNode);
                }
                childIdx++;
            }

            let cond = "";
            if (node.children[childIdx]) {
                cond = this.genExpr(node.children[childIdx]);
            }
            childIdx++;

            let update = "";
            if (node.attributes.hasUpdate && node.children[childIdx]) {
                const updateNode = node.children[childIdx];
                if (updateNode.nodeType === 'ExpressionStatement' && updateNode.children.length > 0) {
                    update = this.genExpr(updateNode.children[0]);
                } else {
                    update = this.genExpr(updateNode);
                }
                childIdx++;
            }

            this.addLn(lines, `${indent}for (${init}; ${cond}; ${update}) {`, node);
            node.children.slice(childIdx).forEach(c => this.genStmt(c, lines, indent + "  "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'Print') {
            this.addLn(lines, `${indent}Serial.println(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'HardwarePwm') {
            this.addLn(lines, `${indent}analogWrite(${node.attributes.pin}, ${Math.floor(node.attributes.duty / 4)}); // HW PWM`, node);
        }
        else if (node.nodeType === 'GpioBatch') {
            const ops = node.attributes.operations;
            this.addLn(lines, `${indent}// Batch Update`, node);
            ops.forEach((op: any) => this.addLn(lines, `${indent}digitalWrite(${op.pin}, ${op.val});`, node));
        }
        else if (node.nodeType === 'SwitchStatement') {
            const disc = this.genExpr(node.children[0]);
            this.addLn(lines, `${indent}switch (${disc}) {`, node);

            for (let i = 1; i < node.children.length; i++) {
                const caseNode = node.children[i];
                if (caseNode.attributes.isDefault) {
                    this.addLn(lines, `${indent}  default:`, caseNode);
                    caseNode.children.forEach(c => this.genStmt(c, lines, indent + "    "));
                } else {
                    this.addLn(lines, `${indent}  case ${this.genExpr(caseNode.children[0])}:`, caseNode);
                    caseNode.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
                }
            }
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'ForIn') {
            const varName = node.attributes.varName;
            const iterableNode = node.children[0];

            if (iterableNode.nodeType === 'CallExpression' && iterableNode.attributes.callee === 'reversed') {
                const target = this.genExpr(iterableNode.children[0]);
                this.addLn(lines, `${indent}for (int i = (sizeof(${target})/sizeof(${target}[0])) - 1; i >= 0; i--) {`, node);
                this.addLn(lines, `${indent}  auto ${varName} = ${target}[i];`, node);
                node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "  "));
                this.addLn(lines, `${indent}}`, node);
            } else {
                const iterable = this.genExpr(iterableNode);
                this.addLn(lines, `${indent}for (auto ${varName} : ${iterable}) {`, node);
                node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "  "));
                this.addLn(lines, `${indent}}`, node);
            }
        }
        else if (node.nodeType === 'Block') {
            node.children.forEach(c => this.genStmt(c, lines, indent));
        }
        else {
            this.addLn(lines, `${indent}// Unhandled Node: ${node.nodeType}`, node);
        }
    }

    private genExpr(node: BaseNode): string {
        if (node.nodeType === 'Literal') {
            if (node.attributes.isRaw) return String(node.attributes.value);
            if (node.attributes.isString) return `"${node.attributes.value}"`;
            return String(node.attributes.value);
        }
        if (node.nodeType === 'Identifier') return node.attributes.name;
        if (node.nodeType === 'BinaryExpression') {
            const op = node.attributes.operator;
            if (op === '=') {
                return `${this.genExpr(node.children[0])} = ${this.genExpr(node.children[1])}`;
            }
            return `(${this.genExpr(node.children[0])} ${op} ${this.genExpr(node.children[1])})`;
        }
        if (node.nodeType === 'UnaryExpression') {
            if (node.attributes.prefix) return `${node.attributes.operator}${this.genExpr(node.children[0])}`;
            return `${this.genExpr(node.children[0])}${node.attributes.operator}`;
        }
        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee;
            let args = node.children.map(c => this.genExpr(c)).join(', ');

            if (callee === 'pinMode') {
                args = node.children.map((c, idx) => {
                    const val = this.genExpr(c);
                    if (idx === 1) {
                        if (val === '1' || val === 'OUTPUT') return 'OUTPUT';
                        if (val === '0' || val === 'INPUT') return 'INPUT';
                    }
                    return val;
                }).join(', ');
            }

            if (callee === 'servo') return `servo.write(${args})`;
            if (callee === 'len') return `(sizeof(${args}) / sizeof(${args}[0]))`;
            return `${callee}(${args})`;
        }
        if (node.nodeType === 'AnalogRead') return `analogRead(${this.genExpr(node.children[0])})`;
        if (node.nodeType === 'GpioRead') return `digitalRead(${this.genExpr(node.children[0])})`;
        if (node.nodeType === 'SubscriptExpression') return `${this.genExpr(node.children[0])}[${this.genExpr(node.children[1])}]`;
        if (node.nodeType === 'ArrayInitializer') {
            const elements = node.children.map(c => this.genExpr(c)).join(', ');
            return `{ ${elements} }`;
        }
        if (node.nodeType === 'ConditionalExpression') {
            return `(${this.genExpr(node.children[0])} ? ${this.genExpr(node.children[1])} : ${this.genExpr(node.children[2])})`;
        }
        if (node.nodeType === 'SizeofExpression') {
            const target = node.children[0];
            if (!target) return '1';
            // Simple optimization for common Arduino pattern
            if (target.nodeType === 'Identifier') return `sizeof(${this.genExpr(target)})`;
            return `sizeof(${this.genExpr(target)})`;
        }
        if (node.nodeType === 'MemberExpression') {
            const op = node.attributes.operator || '.';
            return `${this.genExpr(node.children[0])}${op}${node.attributes.property}`;
        }
        if (node.nodeType === 'GpioSet') return `digitalWrite(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])})`;
        if (node.nodeType === 'DelayMs') return `delay(${this.genExpr(node.children[0])})`;
        if (node.nodeType === 'AnalogWrite') return `analogWrite(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])})`;
        if (node.nodeType === 'Print') return `Serial.println(${this.genExpr(node.children[0])})`;

        return "";
    }
}
