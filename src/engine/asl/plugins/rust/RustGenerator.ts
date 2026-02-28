import type { ProgramNode, BaseNode, SourceMapEntry } from '@/system/types';

export class RustGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLine: number = 1;

    generate(ast: ProgramNode): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLine = 1;
        const lines: string[] = [];

        this.addLn(lines, "// Generated Rust Code", null);
        this.addLn(lines, "#![no_std]", null);
        this.addLn(lines, "#![no_main]", null);
        this.addLn(lines, "", null);
        this.addLn(lines, "use esp_hal::prelude::*;", null);
        this.addLn(lines, "", null);

        const funcs = ast.children.filter(c => c.nodeType === 'Function');
        const setup = funcs.find(f => f.attributes.name === 'setup');
        const loop_ = funcs.find(f => f.attributes.name === 'loop');

        if (setup || loop_) {
            this.addLn(lines, "#[entry]", null);
            this.addLn(lines, "fn main() -> ! {", null);
            this.addLn(lines, "    let peripherals = Peripherals::take();", null);
            this.addLn(lines, "    let system = peripherals.SYSTEM.split();", null);
            this.addLn(lines, "    let clocks = ClockControl::boot_defaults(system.clock_control).freeze();", null);
            this.addLn(lines, "    let mut delay = Delay::new(&clocks);", null);
            this.addLn(lines, "", null);

            if (setup) {
                this.printComments(setup, lines, "    ");
                this.addLn(lines, "    // Setup", setup);
                setup.children.forEach(c => this.genStmt(c, lines, "    "));
            }

            this.addLn(lines, "", null);
            if (loop_) this.printComments(loop_, lines, "    ");
            this.addLn(lines, "    loop {", loop_ ?? null);
            if (loop_) {
                loop_.children.forEach(c => this.genStmt(c, lines, "        "));
            }
            this.addLn(lines, "    }", null);
            this.addLn(lines, "}", null);
        } else {
            funcs.forEach(f => {
                this.printComments(f, lines, "");
                this.addLn(lines, `fn ${f.attributes.name}() {`, f);
                f.children.forEach(c => this.genStmt(c, lines, "    "));
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
            node.leadingComments.forEach(c => {
                let clean = c.trim();
                if (clean.startsWith('/*')) {
                    this.addLn(lines, `${indent}${clean}`, null);
                } else if (clean.startsWith('//')) {
                    this.addLn(lines, `${indent}${clean}`, null);
                } else {
                    this.addLn(lines, `${indent}// ${clean}`, null);
                }
            });
        }
    }

    private genStmt(node: BaseNode, lines: string[], indent: string) {
        this.printComments(node, lines, indent);

        if (node.nodeType === 'Empty') return;

        if (node.nodeType === 'VariableDeclaration') {
            const val = node.children.length > 0 ? this.genExpr(node.children[0]) : '0';
            this.addLn(lines, `${indent}let mut ${node.attributes.name} = ${val};`, node);
        }
        else if (node.nodeType === 'ExpressionStatement') {
            const child = node.children[0];
            if (child.nodeType === 'CallExpression') {
                const callee = child.attributes.callee;
                if (callee === 'pinMode') {
                    return this.addLn(lines, `${indent}gpio_mode(${this.genExpr(child.children[0])}, ${this.genExpr(child.children[1])});`, node);
                }
                if (callee === 'Serial.begin') {
                    return this.addLn(lines, `${indent}// Serial.begin(${this.genExpr(child.children[0])});`, node);
                }
            }
            this.addLn(lines, `${indent}${this.genExpr(child)};`, node);
        }
        else if (node.nodeType === 'Block') {
            node.children.forEach(c => this.genStmt(c, lines, indent));
        }
        else if (node.nodeType === 'GpioSet') {
            this.addLn(lines, `${indent}gpio_set(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])});`, node);
        }
        else if (node.nodeType === 'GpioRead') {
            this.addLn(lines, `${indent}gpio_get(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'AnalogRead') {
            this.addLn(lines, `${indent}adc.read(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'AnalogWrite') {
            this.addLn(lines, `${indent}pwm.set_duty(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])});`, node);
        }
        else if (node.nodeType === 'DelayMs') {
            this.addLn(lines, `${indent}delay.delay_ms(${this.genExpr(node.children[0])}u32);`, node);
        }
        else if (node.nodeType === 'Print') {
            this.addLn(lines, `${indent}println!("{}", ${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'BreakStatement') {
            this.addLn(lines, `${indent}break;`, node);
        }
        else if (node.nodeType === 'ContinueStatement') {
            this.addLn(lines, `${indent}continue;`, node);
        }
        else if (node.nodeType === 'ReturnStatement') {
            if (node.children.length > 0) {
                this.addLn(lines, `${indent}return ${this.genExpr(node.children[0])};`, node);
            } else {
                this.addLn(lines, `${indent}return;`, node);
            }
        }
        else if (node.nodeType === 'IfStatement') {
            // children[0] = condition
            // children[1] = Block (then)
            // children[2] = Block (else) | IfStatement (else if) — optional
            const cond = this.genExpr(node.children[0]);
            this.addLn(lines, `${indent}if ${cond} {`, node);
            if (node.children[1]) {
                const thenBlock = node.children[1];
                const thenChildren = thenBlock.nodeType === 'Block' ? thenBlock.children : [thenBlock];
                thenChildren.forEach(c => this.genStmt(c, lines, indent + "    "));
            }
            this.addLn(lines, `${indent}}`, node);

            if (node.children[2]) {
                const elseNode = node.children[2];
                if (elseNode.nodeType === 'IfStatement') {
                    // else if — rewrite last closing brace
                    lines[lines.length - 1] = `${indent}} else `;
                    const tempLines: string[] = [];
                    this.genStmt(elseNode, tempLines, "");
                    // attach first line inline, rest as new lines
                    const [first, ...rest] = tempLines;
                    lines[lines.length - 1] += first.trim();
                    rest.forEach(l => lines.push(indent + l.trimStart()));
                    this.currentLine += rest.length;
                } else {
                    // plain else block
                    lines[lines.length - 1] = `${indent}} else {`;
                    const elseChildren = elseNode.nodeType === 'Block' ? elseNode.children : [elseNode];
                    elseChildren.forEach(c => this.genStmt(c, lines, indent + "    "));
                    this.addLn(lines, `${indent}}`, node);
                }
            }
        }
        else if (node.nodeType === 'Loop') {
            // Infinite loop
            this.addLn(lines, `${indent}loop {`, node);
            node.children.forEach(c => this.genStmt(c, lines, indent + "    "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'DoWhileLoop') {
            // Rust has no do-while — emulate with loop + trailing condition break
            // children[0] = condition, children[1..] = body
            this.addLn(lines, `${indent}loop {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
            this.addLn(lines, `${indent}    if !(${this.genExpr(node.children[0])}) { break; }`, node);
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'WhileLoop') {
            this.addLn(lines, `${indent}while ${this.genExpr(node.children[0])} {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'ForLoop') {
            let childIdx = 0;
            if (node.attributes.hasInit && node.children[childIdx]) {
                const initNode = node.children[childIdx];
                this.genStmt(initNode, lines, indent);
                childIdx++;
            }
            const cond = node.children[childIdx] ? this.genExpr(node.children[childIdx]) : 'true';
            childIdx++;

            const updateNode = node.attributes.hasUpdate ? node.children[childIdx] : null;
            if (updateNode) childIdx++;

            this.addLn(lines, `${indent}while ${cond} {`, node);
            const innerIndent = indent + "    ";
            node.children.slice(childIdx).forEach(c => this.genStmt(c, lines, innerIndent));
            if (updateNode) {
                this.genStmt(updateNode, lines, innerIndent);
            }
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'DesignatedInitializer') {
            const fields = node.attributes.fields;
            this.addLn(lines, `${indent}{`, node);
            fields.forEach((f: any) => this.addLn(lines, `${indent}    ${f.name}: ${this.genExpr(f.value)},`, node));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'SwitchStatement') {
            const disc = this.genExpr(node.children[0]);
            this.addLn(lines, `${indent}match ${disc} {`, node);

            for (let ci = 1; ci < node.children.length; ci++) {
                const caseNode = node.children[ci];
                if (caseNode.attributes.isDefault) {
                    this.addLn(lines, `${indent}    _ => {`, caseNode);
                    const body = caseNode.children.filter(c => c.nodeType !== 'BreakStatement');
                    body.forEach(c => this.genStmt(c, lines, indent + '        '));
                    this.addLn(lines, `${indent}    }`, null);
                } else {
                    const testExpr = this.genExpr(caseNode.children[0]);
                    this.addLn(lines, `${indent}    ${testExpr} => {`, caseNode);
                    const body = caseNode.children.slice(1).filter(c => c.nodeType !== 'BreakStatement');
                    body.forEach(c => this.genStmt(c, lines, indent + '        '));
                    this.addLn(lines, `${indent}    }`, null);
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
            return `${this.genExpr(node.children[0])} ${node.attributes.operator} ${this.genExpr(node.children[1])}`;
        }
        if (node.nodeType === 'UnaryExpression') {
            if (node.attributes.prefix) return `${node.attributes.operator}${this.genExpr(node.children[0])}`;
            // postfix ++ / -- not native in Rust — emit as += 1 / -= 1
            const op = node.attributes.operator === '++' ? ' += 1' : ' -= 1';
            return `${this.genExpr(node.children[0])}${op}`;
        }
        if (node.nodeType === 'MemberExpression') {
            const op = node.attributes.operator || '.';
            return `${this.genExpr(node.children[0])}${op}${node.attributes.property}`;
        }
        if (node.nodeType === 'ConditionalExpression') {
            // Rust has no ternary — use if/else expression
            return `(if ${this.genExpr(node.children[0])} { ${this.genExpr(node.children[1])} } else { ${this.genExpr(node.children[2])} })`;
        }
        if (node.nodeType === 'GpioRead') {
            return `gpio_get(${this.genExpr(node.children[0])})`;
        }
        if (node.nodeType === 'AnalogRead') {
            return `adc.read(${this.genExpr(node.children[0])})`;
        }
        if (node.nodeType === 'CallExpression') {
            const args = node.children.map(c => this.genExpr(c)).join(', ');
            return `${node.attributes.callee}(${args})`;
        }
        if (node.nodeType === 'ArrayInitializer') {
            const elements = node.children.map(c => this.genExpr(c)).join(', ');
            return `vec![${elements}]`;
        }
        if (node.nodeType === 'SubscriptExpression') {
            return `${this.genExpr(node.children[0])}[${this.genExpr(node.children[1])}]`;
        }
        return "";
    }
}
