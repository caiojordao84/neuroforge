
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

        // Globals / Variables
        const vars = ast.children.filter(c => c.nodeType === 'VariableDeclaration');
        vars.forEach(v => this.genStmt(v, lines, ""));
        if (vars.length > 0) this.addLn(lines, "", null);

        // Functions
        const funcs = ast.children.filter(c => c.nodeType === 'Function');

        // Handle script-like programs by wrapping in setup/loop
        const orphans = ast.children.filter(c => c.nodeType !== 'Function' && c.nodeType !== 'VariableDeclaration');

        if (funcs.length === 0 && orphans.length > 0) {
            this.addLn(lines, "void setup() {", null);
            orphans.forEach(c => this.genStmt(c, lines, "  "));
            this.addLn(lines, "}", null);
            this.addLn(lines, "", null);
            this.addLn(lines, "void loop() {", null);
            this.addLn(lines, "}", null);
        } else {
            funcs.forEach(f => {
                const name = f.attributes.name;
                const type = (name === 'setup' || name === 'loop') ? 'void' : 'void';
                this.printComments(f, lines, "");
                this.addLn(lines, `${type} ${name}() {`, f);
                f.children.forEach(c => this.genStmt(c, lines, "  "));
                this.addLn(lines, "}", f);
                this.addLn(lines, "", null);
            });
        }

        return { code: lines.join('\n'), map: this.sourceMap };
    }

    private addLn(lines: string[], text: string, node: BaseNode | null) {
        lines.push(text);
        if (node && node.metadata && node.metadata.line) {
            this.sourceMap.push({ generatedLine: this.currentLine, sourceLine: node.metadata.line });
        }
        this.currentLine += text.split('\n').length;
    }

    private printComments(node: BaseNode, lines: string[], indent: string) {
        if (node.leadingComments) {
            node.leadingComments.forEach(c => this.addLn(lines, `${indent}${c}`, null));
        }
    }

    private genStmt(node: BaseNode, lines: string[], indent: string) {
        this.printComments(node, lines, indent);

        if (node.nodeType === 'VariableDeclaration') {
            const val = node.children.length > 0 ? this.genExpr(node.children[0]) : '0';
            const type = node.attributes.type || 'int';
            this.addLn(lines, `${indent}${type} ${node.attributes.name} = ${val};`, node);
        }
        else if (node.nodeType === 'ExpressionStatement') {
            this.addLn(lines, `${indent}${this.genExpr(node.children[0])};`, node);
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
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "  "));
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
            const args = node.children.map(c => this.genExpr(c)).join(', ');
            const callee = node.attributes.callee;
            if (callee === 'servo') return `servo.write(${args})`;
            return `${callee}(${args})`;
        }
        if (node.nodeType === 'AnalogRead') return `analogRead(${this.genExpr(node.children[0])})`;
        if (node.nodeType === 'SubscriptExpression') return `${this.genExpr(node.children[0])}[${this.genExpr(node.children[1])}]`;
        if (node.nodeType === 'ArrayInitializer') {
            const elements = node.children.map(c => this.genExpr(c)).join(', ');
            return `{ ${elements} }`;
        }

        return "";
    }
}
