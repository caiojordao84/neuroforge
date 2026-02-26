
import type { ProgramNode, BaseNode, SourceMapEntry } from '@/system/types';

export type PythonFlavor = 'MICROPYTHON' | 'CIRCUITPYTHON';

export class PythonGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLineNum: number = 0;
    private flavor: PythonFlavor = 'MICROPYTHON';
    private usedPins: Set<number> = new Set();
    private pwmPins: Set<number> = new Set();

    generate(ast: ProgramNode, flavor: PythonFlavor = 'MICROPYTHON'): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLineNum = 1;
        this.flavor = flavor;
        this.usedPins.clear();
        this.pwmPins.clear();

        // First pass to find used pins for CircuitPython setup
        this.scanForPins(ast);

        const output: string[] = [];

        // Imports
        if (this.flavor === 'MICROPYTHON') {
            this.addLn(output, 'import machine', null);
            this.addLn(output, 'import time', null);
            this.addLn(output, 'from machine import Pin, PWM', null);
        } else {
            this.addLn(output, 'import board', null);
            this.addLn(output, 'import digitalio', null);
            this.addLn(output, 'import time', null);
            this.addLn(output, 'import pwmio', null);
        }
        this.addLn(output, '', null);

        // Setup GPIO objects (Crucial for CircuitPython)
        if (this.flavor === 'CIRCUITPYTHON') {
            this.usedPins.forEach(pin => {
                // Check if it's PWM or Digital
                if (this.pwmPins.has(pin)) {
                    // PWM setup is usually done at call site or globally
                } else {
                    this.addLn(output, `pin_${pin} = digitalio.DigitalInOut(board.GP${pin} if hasattr(board, "GP${pin}") else getattr(board, "D${pin}", board.D${pin}))`, null);
                    this.addLn(output, `pin_${pin}.direction = digitalio.Direction.OUTPUT`, null);
                }
            });
            this.addLn(output, '', null);
        }

        this.addLn(output, '# Main Program', null);

        // Globals / Setup
        const setup = ast.children.find(c => c.attributes.name === 'setup');
        const loops = ast.children.find(c => c.attributes.name === 'loop');
        const globals = ast.children.filter(c => c.nodeType === 'VariableDeclaration');

        globals.forEach(g => this.genStmt(g, '', output));
        if (setup) {
            this.printComments(setup, output, "");
            setup.children.forEach(s => this.genStmt(s, '', output));
        }

        this.addLn(output, '', null);
        this.addLn(output, 'while True:', null);

        if (loops && loops.children.length > 0) {
            loops.children.forEach(s => this.genStmt(s, '    ', output));
        } else {
            // Fallback for empty loop or top-level script
            const topLevel = ast.children.filter(c => c.nodeType !== 'Function' && c.nodeType !== 'VariableDeclaration');
            if (topLevel.length > 0) {
                topLevel.forEach(s => this.genStmt(s, '    ', output));
            } else {
                this.addLn(output, this.flavor === 'MICROPYTHON' ? '    time.sleep_ms(100)' : '    time.sleep(0.1)', null);
            }
        }

        return { code: output.join('\n'), map: this.sourceMap };
    }

    private scanForPins(node: BaseNode) {
        if (node.nodeType === 'GpioSet' || node.nodeType === 'GpioRead') {
            const pin = node.children[0].attributes.value;
            if (typeof pin === 'number') this.usedPins.add(pin);
        }
        if (node.nodeType === 'HardwarePwm') {
            this.pwmPins.add(node.attributes.pin);
        }
        if (node.children) node.children.forEach(c => this.scanForPins(c));
    }

    private addLn(out: string[], text: string, node: BaseNode | null) {
        if (node && node.metadata && node.metadata.line) {
            this.sourceMap.push({ generatedLine: this.currentLineNum, sourceLine: node.metadata.line });
        }
        out.push(text);
        this.currentLineNum += text.split('\n').length;
    }

    private printComments(node: BaseNode, out: string[], indent: string) {
        if (node.leadingComments) {
            node.leadingComments.forEach(c => this.addLn(out, `${indent}${c}`, null));
        }
    }

    private genStmt(n: BaseNode, i: string, out: string[]) {
        this.printComments(n, out, i);

        if (n.nodeType === 'VariableDeclaration') {
            const val = n.children.length > 0 ? this.genExpr(n.children[0]) : '0';
            return this.addLn(out, `${i}${n.attributes.name} = ${val}`, n);
        }

        if (n.nodeType === 'GpioSet') {
            const pin = this.evalLit(n.children[0]);
            const val = this.genExpr(n.children[1]);
            if (this.flavor === 'MICROPYTHON') {
                return this.addLn(out, `${i}machine.Pin(${pin}, machine.Pin.OUT).value(${val})`, n);
            } else {
                const boolVal = val === '1' || val === 'HIGH' ? 'True' : val === '0' || val === 'LOW' ? 'False' : `(${val} != 0)`;
                return this.addLn(out, `${i}pin_${pin}.value = ${boolVal}`, n);
            }
        }

        if (n.nodeType === 'DelayMs') {
            const msStr = this.genExpr(n.children[0]);
            if (this.flavor === 'MICROPYTHON') {
                return this.addLn(out, `${i}time.sleep_ms(${msStr})`, n);
            } else {
                const isLit = n.children[0].nodeType === 'Literal';
                const sec = isLit ? (parseFloat(msStr) / 1000).toString() : `(${msStr} / 1000)`;
                return this.addLn(out, `${i}time.sleep(${sec})`, n);
            }
        }

        if (n.nodeType === 'HardwarePwm') {
            const p = n.attributes;
            if (this.flavor === 'MICROPYTHON') {
                const duty16 = Math.floor((p.duty / 1023) * 65535);
                this.addLn(out, `${i}pwm_${p.pin} = PWM(Pin(${p.pin}), freq=${p.freq})`, n);
                this.addLn(out, `${i}pwm_${p.pin}.duty_u16(${duty16})`, n);
            } else {
                const duty16 = Math.floor((p.duty / 1023) * 65535);
                this.addLn(out, `${i}pwm_${p.pin} = pwmio.PWMOut(board.GP${p.pin}, frequency=${p.freq}, duty_cycle=${duty16})`, n);
            }
            return;
        }

        if (n.nodeType === 'IfStatement') {
            this.addLn(out, `${i}if ${this.genExpr(n.children[0])}:`, n);
            n.children.slice(1).forEach(c => this.genStmt(c, i + '    ', out));
            return;
        }

        if (n.nodeType === 'WhileLoop') {
            this.addLn(out, `${i}while ${this.genExpr(n.children[0])}:`, n);
            n.children.slice(1).forEach(c => this.genStmt(c, i + '    ', out));
            return;
        }

        if (n.nodeType === 'ForLoop') {
            // Basic C-style for loop as while loop in Python
            let childIdx = 0;
            if (n.attributes.hasInit && n.children[childIdx]) {
                const initNode = n.children[childIdx];
                this.genStmt(initNode, i, out);
                childIdx++;
            }
            const cond = n.children[childIdx] ? this.genExpr(n.children[childIdx]) : 'True';
            childIdx++;

            const updateNode = n.attributes.hasUpdate ? n.children[childIdx] : null;
            if (updateNode) childIdx++;

            this.addLn(out, `${i}while ${cond}:`, n);
            const innerIndent = i + '    ';
            n.children.slice(childIdx).forEach(c => this.genStmt(c, innerIndent, out));
            if (updateNode) {
                this.genStmt(updateNode, innerIndent, out);
            }
            return;
        }

        if (n.nodeType === 'Print') {
            return this.addLn(out, `${i}print(${this.genExpr(n.children[0])})`, n);
        }

        if (n.nodeType === 'ExpressionStatement') {
            return this.addLn(out, `${i}${this.genExpr(n.children[0])}`, n);
        }

        if (n.nodeType === 'SwitchStatement') {
            const disc = this.genExpr(n.children[0]);
            const swDiscVar = `__sw_disc_${this.genId()}`;
            this.addLn(out, `${i}${swDiscVar} = ${disc}`, n);

            let firstCase = true;
            for (let j = 1; j < n.children.length; j++) {
                const caseNode = n.children[j];
                if (caseNode.attributes.isDefault) continue;

                const caseVal = this.genExpr(caseNode.children[0]);
                const ifStmt = firstCase ? 'if' : 'elif';
                this.addLn(out, `${i}${ifStmt} ${swDiscVar} == ${caseVal}:`, caseNode);

                // Filter out BreakStatements from the body
                const body = caseNode.children.slice(1).filter(c => c.nodeType !== 'BreakStatement');
                if (body.length === 0) {
                    this.addLn(out, `${i}    pass`, caseNode);
                } else {
                    body.forEach(c => this.genStmt(c, i + '    ', out));
                }
                firstCase = false;
            }

            // Default case
            const defaultCase = n.children.find(c => c.attributes.isDefault);
            if (defaultCase) {
                this.addLn(out, `${i}else:`, defaultCase);
                const body = defaultCase.children.filter(c => c.nodeType !== 'BreakStatement');
                if (body.length === 0) {
                    this.addLn(out, `${i}    pass`, defaultCase);
                } else {
                    body.forEach(c => this.genStmt(c, i + '    ', out));
                }
            }
            return;
        }

        this.addLn(out, `${i}pass # ${n.nodeType}`, n);
    }

    private genExpr(n: BaseNode): string {
        if (n.nodeType === 'Literal') {
            if (n.attributes.isRaw) return String(n.attributes.value);
            if (n.attributes.isString) return `"${n.attributes.value}"`;
            return n.attributes.value.toString();
        }
        if (n.nodeType === 'Identifier') return n.attributes.name;
        if (n.nodeType === 'BinaryExpression') return `${this.genExpr(n.children[0])} ${n.attributes.operator} ${this.genExpr(n.children[1])}`;

        if (n.nodeType === 'CallExpression') {
            const args = n.children.map(c => this.genExpr(c)).join(', ');
            return `${n.attributes.callee}(${args})`;
        }
        if (n.nodeType === 'ArrayInitializer') {
            const elements = n.children.map(c => this.genExpr(c)).join(', ');
            return `[${elements}]`;
        }
        if (n.nodeType === 'SubscriptExpression') {
            return `${this.genExpr(n.children[0])}[${this.genExpr(n.children[1])}]`;
        }

        if (n.nodeType === 'GpioRead') {
            const pin = this.evalLit(n.children[0]);
            if (this.flavor === 'MICROPYTHON') return `machine.Pin(${pin}).value()`;
            return `(1 if pin_${pin}.value else 0)`;
        }
        return '0';
    }

    private evalLit(n: BaseNode) { return n.attributes.value; }
    private genId() { return Math.random().toString(36).substring(7); }
}
