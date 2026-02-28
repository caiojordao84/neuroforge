
import type { ProgramNode, BaseNode, SourceMapEntry } from '@/system/types';

export class CGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLine: number = 1;

    generate(ast: ProgramNode): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLine = 1;
        const lines: string[] = [];

        // Header
        this.addLn(lines, "// Generated C++ / Arduino Code", null);
        this.addLn(lines, "#include <Arduino.h>", null);
        this.addLn(lines, "", null);

        // Top-level nodes (Variables, Functions, etc.)
        let finalNodes: BaseNode[] = ast.children;

        finalNodes.forEach(node => {
            if (node.nodeType === 'VariableDeclaration') {
                this.genStmt(node, lines, "");
            } else if (node.nodeType === 'Function') {
                const name = node.attributes.name;
                const type = (name === 'setup' || name === 'loop') ? 'void' : 'void';
                const comments = this.printComments(node);
                if (comments) this.addLn(lines, comments, null);
                this.addLn(lines, `${type} ${name}() {`, node);
                node.children.forEach(c => this.genStmt(c, lines, "  "));
                this.addLn(lines, "}", node);
                this.addLn(lines, "", null);
            } else {
                // Other top-level nodes (should be rare after wrapping)
                this.genStmt(node, lines, "");
            }
        });

        return { code: lines.join('\n'), map: this.sourceMap };
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
                // Convert Python-style comments to C++ style
                if (text.startsWith('#')) {
                    text = '//' + text.substring(1);
                }
                // Ensure C++ style comments have //
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
            const val = node.children.length > 0 ? this.genExpr(node.children[0]) : '0';
            const type = node.attributes.type || 'int';
            this.addLn(lines, `${indent}${type} ${node.attributes.name} = ${val};`, node);
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
        // ... rest of the method
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
                update = this.genExpr(node.children[childIdx]);
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
            return `(${this.genExpr(node.children[0])} ${node.attributes.operator} ${this.genExpr(node.children[1])})`;
        }
        if (node.nodeType === 'UnaryExpression') {
            if (node.attributes.prefix) return `${node.attributes.operator}${this.genExpr(node.children[0])}`;
            return `${this.genExpr(node.children[0])}${node.attributes.operator}`;
        }
        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee;
            let args = node.children.map(c => this.genExpr(c)).join(', ');

            if (callee === 'pinMode') {
                // Map mode constants
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
        if (node.nodeType === 'MemberExpression') {
            const op = node.attributes.operator || '.';
            return `${this.genExpr(node.children[0])}${op}${node.attributes.property}`;
        }

        return "";
    }
}
