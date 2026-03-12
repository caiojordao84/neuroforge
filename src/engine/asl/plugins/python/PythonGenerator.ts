import type { ProgramNode, BaseNode, SourceMapEntry } from '@/system/types';
import { ShimManager } from '../core/ShimManager';
import { pythonShims } from './shims';

export type PythonFlavor = 'MICROPYTHON' | 'CIRCUITPYTHON';

export class PythonGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLineNum: number = 0;
    private flavor: PythonFlavor = 'MICROPYTHON';
    private usedPins: Set<number> = new Set();
    private pwmPins: Set<number> = new Set();
    private shims: ShimManager;

    constructor() {
        this.shims = new ShimManager('python');
        this.shims.registerShims(pythonShims);
    }

    generate(ast: ProgramNode, flavor: PythonFlavor = 'MICROPYTHON'): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLineNum = 1;
        this.flavor = flavor;
        this.usedPins.clear();
        this.pwmPins.clear();
        this.shims.resetRuntime();

        // First pass to find used pins for CircuitPython setup
        this.scanForPins(ast);

        const output: string[] = [];

        // Imports
        if (this.flavor === 'MICROPYTHON') {
            this.addLn(output, 'import machine', null);
            this.addLn(output, 'import time', null);
            this.addLn(output, 'import utime', null);
            this.addLn(output, 'from machine import Pin, PWM, ADC', null);
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

        // --- INJECT SHIMS ---
        const shimCode = this.shims.getRequiredShimsCode();
        if (shimCode) {
            shimCode.split('\n').forEach(line => this.addLn(output, line, null));
        }

        this.addLn(output, '# Main Program', null);

        const finalNodes = ast.children;
        const setup = finalNodes.find(c => c.attributes.name === 'setup');
        const loops = finalNodes.find(c => c.attributes.name === 'loop');
        const mainFn = finalNodes.find(c => c.nodeType === 'Function' && c.attributes.name === 'main');
        const globals = finalNodes.filter(c => c.nodeType === 'VariableDeclaration');

        // Helper functions (não são setup/loop/main)
        const helperFuncs = finalNodes.filter(c =>
            c.nodeType === 'Function' &&
            c.attributes.name !== 'setup' &&
            c.attributes.name !== 'loop' &&
            c.attributes.name !== 'main'
        );

        // Globals and non-loop code
        const topLevelNodes = finalNodes.filter(c => c.nodeType !== 'Function' && c.nodeType !== 'VariableDeclaration');
        const setupBody: BaseNode[] = [];
        const loopBodies: BaseNode[] = [];

        topLevelNodes.forEach(n => {
            if (n.nodeType === 'WhileLoop' && n.attributes.isInfinite) {
                loopBodies.push(...n.children.slice(1));
            } else {
                setupBody.push(n);
            }
        });

        // Handle main function (standalone Python)
        if (mainFn) {
            // Standalone main — não Arduino/MicroPython
            // Emit helper functions before main
            helperFuncs.forEach(fn => {
                this.addLn(output, `def ${fn.attributes.name}():`, null);
                if (fn.children.length === 0) {
                    this.addLn(output, '    pass', null);
                } else {
                    fn.children.forEach(s => this.genStmt(s, '    ', output));
                }
                this.addLn(output, '', null);
            });

            globals.forEach(g => this.genStmt(g, '', output));
            this.addLn(output, '', null);
            this.addLn(output, 'def main():', null);
            if (mainFn.children.length === 0) {
                this.addLn(output, '    pass', null);
            } else {
                mainFn.children.forEach(s => this.genStmt(s, '    ', output));
            }
            this.addLn(output, '', null);
            this.addLn(output, "if __name__ == '__main__':", null);
            this.addLn(output, '    main()', null);
        } else {
            // Arduino/MicroPython path: setup + loop
            // Emit helper functions before setup/loop
            helperFuncs.forEach(fn => {
                this.addLn(output, `def ${fn.attributes.name}():`, null);
                if (fn.children.length === 0) {
                    this.addLn(output, '    pass', null);
                } else {
                    fn.children.forEach(s => this.genStmt(s, '    ', output));
                }
                this.addLn(output, '', null);
            });

            globals.forEach(g => this.genStmt(g, '', output));

            if (setup) {
                setup.children.forEach(s => this.genStmt(s, '', output));
            }
            setupBody.forEach(s => this.genStmt(s, '', output));

            this.addLn(output, '', null);
            this.addLn(output, 'while True:', null);

            if (loops && loops.children.length > 0) {
                loops.children.forEach(s => this.genStmt(s, '    ', output));
            }

            if (loopBodies.length > 0) {
                loopBodies.forEach(s => this.genStmt(s, '    ', output));
            }

            if (!(loops && loops.children.length > 0) && loopBodies.length === 0) {
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

        // --- Auto-detect Shims during early scan ---
        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee || '';
            if (callee.startsWith('sevseg.')) this.shims.requireShim('sevseg');
            if (callee.startsWith('EEPROM.')) this.shims.requireShim('EEPROM');
            if (callee.startsWith('lcd.') || callee.startsWith('lcd_')) this.shims.requireShim('LiquidCrystal_I2C');
            if (callee.startsWith('keypad.') || callee === 'keypad') this.shims.requireShim('Keypad');
        }
        if (node.nodeType === 'VariableDeclaration') {
            const type = node.attributes.type || '';
            if (type === 'LiquidCrystal_I2C') this.shims.requireShim('LiquidCrystal_I2C');
            if (type === 'Keypad') this.shims.requireShim('Keypad');
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
            node.leadingComments.forEach(c => {
                // Convert C-style // or /* */ to #
                let clean = c.replace(/^\/\//, '').replace(/^\/\* ?/, '').replace(/ ?\*\/$/, '').trim();
                if (clean) this.addLn(out, `${indent}# ${clean}`, null);
                else this.addLn(out, `${indent}#`, null);
            });
        }
    }

    private genStmt(n: BaseNode, i: string, out: string[]) {
        this.printComments(n, out, i);

        if (n.nodeType === 'Empty') return;

        if (n.nodeType === 'Block') {
            n.children.forEach(c => this.genStmt(c, i, out));
            return;
        }

        if (n.nodeType === 'BreakStatement') {
            return this.addLn(out, `${i}break`, n);
        }

        if (n.nodeType === 'ContinueStatement') {
            return this.addLn(out, `${i}continue`, n);
        }

        if (n.nodeType === 'ReturnStatement') {
            if (n.children.length > 0) {
                return this.addLn(out, `${i}return ${this.genExpr(n.children[0])}`, n);
            }
            return this.addLn(out, `${i}return`, n);
        }

        if (n.nodeType === 'VariableDeclaration') {
            const val = n.children.length > 0 ? this.genExpr(n.children[0]) : '0';
            return this.addLn(out, `${i}${n.attributes.name} = ${val}`, n);
        }

        if (n.nodeType === 'PinMode') {
            const pin = this.genExpr(n.children[0]);
            const mode = this.genExpr(n.children[1]);
            const pyMode = mode === '1' || mode === 'OUTPUT' ? 'machine.Pin.OUT' : 'machine.Pin.IN';
            return this.addLn(out, `${i}machine.Pin(${pin}, ${pyMode})`, n);
        }

        if (n.nodeType === 'GpioSet') {
            const pinNode = n.children[0];
            const val = this.genExpr(n.children[1]);
            const pinExpr = this.genExpr(pinNode);

            if (this.flavor === 'MICROPYTHON') {
                if (pinNode.nodeType === 'Identifier') {
                    return this.addLn(out, `${i}${pinExpr}.value(${val})`, n);
                }
                return this.addLn(out, `${i}machine.Pin(${pinExpr}, machine.Pin.OUT).value(${val})`, n);
            } else {
                const boolVal = val === '1' || val === 'HIGH' ? 'True' : val === '0' || val === 'LOW' ? 'False' : `(${val} != 0)`;
                const target = pinNode.nodeType === 'Identifier' ? pinExpr : `pin_${pinExpr}`;
                return this.addLn(out, `${i}${target}.value = ${boolVal}`, n);
            }
        }

        if (n.nodeType === 'AnalogRead') {
            const pin = this.evalLit(n.children[0]);
            if (this.flavor === 'MICROPYTHON') {
                return this.addLn(out, `${i}machine.ADC(machine.Pin(${pin})).read_u16()`, n);
            } else {
                return this.addLn(out, `${i}analog_in_${pin}.value`, n);
            }
        }

        if (n.nodeType === 'AnalogWrite') {
            const pin = this.evalLit(n.children[0]);
            const val = this.genExpr(n.children[1]);
            if (this.flavor === 'MICROPYTHON') {
                this.addLn(out, `${i}_pwm_${pin} = machine.PWM(machine.Pin(${pin}))`, n);
                return this.addLn(out, `${i}_pwm_${pin}.duty_u16(int(${val} * 64))`, n);
            } else {
                return this.addLn(out, `${i}pwm_${pin}.duty_cycle = int(${val} * 64)`, n);
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

            // then block — children[1]
            const thenNode = n.children[1];
            const thenChildren = thenNode
                ? (thenNode.nodeType === 'Block' ? thenNode.children : [thenNode])
                : [];
            if (thenChildren.length === 0) {
                this.addLn(out, `${i}    pass`, null);
            } else {
                thenChildren.forEach(c => this.genStmt(c, i + '    ', out));
            }

            // else / elif — children[2]
            if (n.children[2]) {
                const elseNode = n.children[2];
                if (elseNode.nodeType === 'IfStatement') {
                    // elif chain: generate into temp buffer, replace first 'if' with 'elif'
                    const tempOut: string[] = [];
                    const savedLineNum = this.currentLineNum;
                    this.genStmt(elseNode, i, tempOut);
                    this.currentLineNum = savedLineNum;
                    if (tempOut.length > 0) {
                        tempOut[0] = tempOut[0].replace(/^(\s*)if /, '$1elif ');
                        tempOut.forEach(l => { out.push(l); this.currentLineNum++; });
                    }
                } else {
                    // plain else block
                    this.addLn(out, `${i}else:`, null);
                    const elseChildren = elseNode.nodeType === 'Block'
                        ? elseNode.children
                        : [elseNode];
                    if (elseChildren.length === 0) {
                        this.addLn(out, `${i}    pass`, null);
                    } else {
                        elseChildren.forEach(c => this.genStmt(c, i + '    ', out));
                    }
                }
            }
            return;
        }

        if (n.nodeType === 'DoWhileLoop') {
            // Python: while True: <body> \n if not <cond>: break
            this.addLn(out, `${i}while True:`, n);
            n.children.slice(1).forEach(c => this.genStmt(c, i + '    ', out));
            this.addLn(out, `${i}    if not (${this.genExpr(n.children[0])}):`, null);
            this.addLn(out, `${i}        break`, null);
            return;
        }

        if (n.nodeType === 'WhileLoop') {
            this.addLn(out, `${i}while ${this.genExpr(n.children[0])}:`, n);
            const body = n.children.slice(1);
            if (body.length === 0) {
                this.addLn(out, `${i}    pass`, null);
            } else {
                body.forEach(c => this.genStmt(c, i + '    ', out));
            }
            return;
        }

        if (n.nodeType === 'ForLoop') {
            let childIdx = 0;
            if (n.attributes.hasInit && n.children[childIdx]) {
                this.genStmt(n.children[childIdx], i, out);
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

        if (n.nodeType === 'SerialBegin') {
            const baud = this.genExpr(n.children[0]);
            if (this.flavor === 'MICROPYTHON') {
                return this.addLn(out, `${i}uart = machine.UART(0, baudrate=${baud})`, n);
            } else {
                return this.addLn(out, `${i}import busio, board\n${i}uart = busio.UART(board.TX, board.RX, baudrate=${baud})`, n);
            }
        }

        if (n.nodeType === 'ForIn') {
            const iterable = this.genExpr(n.children[0]);
            this.addLn(out, `${i}for ${n.attributes.varName} in ${iterable}:`, n);
            const body = n.children.slice(1);
            if (body.length === 0) {
                this.addLn(out, `${i}    pass`, null);
            } else {
                body.forEach(c => this.genStmt(c, i + '    ', out));
            }
            return;
        }

        if (n.nodeType === 'Print') {
            return this.addLn(out, `${i}print(${this.genExpr(n.children[0])})`, n);
        }

        if (n.nodeType === 'ExpressionStatement') {
            const child = n.children[0];
            if (child.nodeType === 'CallExpression') {
                const callee = child.attributes.callee;
                if (callee === 'pinMode') {
                    const pin = this.genExpr(child.children[0]);
                    const mode = this.genExpr(child.children[1]);
                    const pyMode = mode === '1' || mode === 'OUTPUT' ? 'machine.Pin.OUT' : 'machine.Pin.IN';
                    return this.addLn(out, `${i}machine.Pin(${pin}, ${pyMode})`, n);
                }
                if (callee.startsWith('sevseg.')) {
                    this.shims.requireShim('sevseg');
                }
            }
            return this.addLn(out, `${i}${this.genExpr(child)}`, n);
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

                const body = caseNode.children.slice(1).filter(c => c.nodeType !== 'BreakStatement');
                if (body.length === 0) {
                    this.addLn(out, `${i}    pass`, caseNode);
                } else {
                    body.forEach(c => this.genStmt(c, i + '    ', out));
                }
                firstCase = false;
            }

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

        if (n.nodeType === 'StructDeclaration') {
            const name = n.attributes.name;
            const fields = n.attributes.fields || [];
            this.addLn(out, `${i}class ${name}:`, n);
            if (fields.length === 0) {
                this.addLn(out, `${i}    pass`, null);
            } else {
                fields.forEach((f: any) => {
                    this.addLn(out, `${i}    def __init__(self, ${f.name}=None):`, null);
                    this.addLn(out, `${i}        self.${f.name} = ${f.name}`, null);
                });
            }
            return;
        }

        if (n.nodeType === 'EnumDeclaration') {
            const name = n.attributes.name;
            const members = n.attributes.members || [];
            this.addLn(out, `${i}class ${name}:`, n);
            members.forEach((m: any) => {
                const val = m.value !== undefined ? ` = ${m.value}` : '';
                this.addLn(out, `${i}    ${m.name}${val}`, null);
            });
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
        if (n.nodeType === 'BinaryExpression') {
            let op = n.attributes.operator;
            if (op === '&&') op = 'and';
            else if (op === '||') op = 'or';
            else if (op === '!=') op = '!=';
            return `${this.genExpr(n.children[0])} ${op} ${this.genExpr(n.children[1])}`;
        }
        if (n.nodeType === 'UnaryExpression') {
            return n.attributes.prefix
                ? `${n.attributes.operator}${this.genExpr(n.children[0])}`
                : `${this.genExpr(n.children[0])}${n.attributes.operator}`;
        }
        if (n.nodeType === 'ConditionalExpression') {
            return `(${this.genExpr(n.children[1])} if ${this.genExpr(n.children[0])} else ${this.genExpr(n.children[2])})`;
        }
        if (n.nodeType === 'MemberExpression') {
            const op = n.attributes.operator || '.';
            return `${this.genExpr(n.children[0])}${op}${n.attributes.property}`;
        }
        if (n.nodeType === 'CallExpression') {
            if (n.attributes.callee === 'LIST_COMPREHENSION') {
                const expr = this.genExpr(n.children[0]);
                const iterable = this.genExpr(n.children[1]);
                return `[${expr} for ${n.attributes.varName} in ${iterable}]`;
            }
            if (n.attributes.callee === 'millis') {
                if (this.flavor === 'MICROPYTHON') return 'utime.ticks_ms()';
                return 'int(time.time() * 1000)';
            }
            if (n.attributes.callee === 'micros') {
                if (this.flavor === 'MICROPYTHON') return 'utime.ticks_us()';
                return 'int(time.time() * 1000000)';
            }
            if (n.attributes.callee === 'delayMicroseconds') {
                const us = n.children.map(c => this.genExpr(c)).join(', ');
                if (this.flavor === 'MICROPYTHON') return `utime.sleep_us(${us})`;
                return `time.sleep(${us} / 1000000)`;
            }
            const args = n.children.map(c => this.genExpr(c)).join(', ');
            return `${n.attributes.callee}(${args})`;
        }
        if (n.nodeType === 'ArrayInitializer') {
            const elements = n.children.map(c => this.genExpr(c)).join(', ');
            return `[${elements}]`;
        }
        if (n.nodeType === 'ObjectInitializer') {
            const fields = n.children.map(c => {
                const name = c.attributes?.name || 'field';
                const val = this.genExpr(c);
                return `"${name}": ${val}`;
            }).join(', ');
            return `{ ${fields} }`;
        }
        if (n.nodeType === 'SubscriptExpression') {
            return `${this.genExpr(n.children[0])}[${this.genExpr(n.children[1])}]`;
        }
        if (n.nodeType === 'CastExpression') {
            const targetType = n.attributes.targetType || 'int';
            const expr = this.genExpr(n.children[0]);
            if (targetType === 'float' || targetType === 'double') return `float(${expr})`;
            if (targetType === 'int') return `int(${expr})`;
            if (targetType === 'str') return `str(${expr})`;
            return `int(${expr})`;
        }
        if (n.nodeType === 'SizeofExpression') {
            return `len(${this.genExpr(n.children[0])})`;
        }
        if (n.nodeType === 'GpioRead') {
            const pin = this.evalLit(n.children[0]);
            if (this.flavor === 'MICROPYTHON') return `machine.Pin(${pin}).value()`;
            return `(1 if pin_${pin}.value else 0)`;
        }
        if (n.nodeType === 'AnalogRead') {
            const pin = this.evalLit(n.children[0]);
            if (this.flavor === 'MICROPYTHON') return `machine.ADC(machine.Pin(${pin})).read_u16()`;
            return `analog_in_${pin}.value`;
        }
        if (n.nodeType === 'SerialAvailable') {
            if (this.flavor === 'MICROPYTHON') return 'uart.any()';
            return 'uart.in_waiting';
        }
        if (n.nodeType === 'SerialReadString') {
            if (this.flavor === 'MICROPYTHON') return 'uart.read()';
            return 'uart.read()';
        }
        return '0';
    }

    private evalLit(n: BaseNode) { return n.attributes.value; }
    private genId() { return Math.random().toString(36).substring(7); }
}
