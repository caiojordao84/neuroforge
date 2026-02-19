
import { ProgramNode, BaseNode, SourceMapEntry } from '../../system/types';

export class ZigGenerator {
    private sourceMap: SourceMapEntry[] = [];
    private currentLine: number = 1;
    private usedPins: Set<number> = new Set();

    generate(ast: ProgramNode): { code: string, map: SourceMapEntry[] } {
        this.sourceMap = [];
        this.currentLine = 1;
        this.usedPins.clear();

        // Scan for used pins to initialize them
        this.scanPins(ast);

        const lines: string[] = [];

        this.addLn(lines, "const std = @import(\"std\");", null);
        this.addLn(lines, "const microzig = @import(\"microzig\");", null);
        this.addLn(lines, "", null);

        const funcs = ast.children.filter(c => c.nodeType === 'Function');
        const setup = funcs.find(f => f.attributes.name === 'setup');
        const loop = funcs.find(f => f.attributes.name === 'loop');
        const globals = ast.children.filter(c => c.nodeType === 'VariableDeclaration');

        // Zig doesn't have global mutable variables in the same way C does for simple scripts
        // We will put them inside main for this generator scope or use a struct if needed.
        // For simplicity, everything goes into main.

        this.addLn(lines, "pub fn main() !void {", null);

        // Initialize Pins found in AST
        this.usedPins.forEach(pin => {
            this.addLn(lines, `    const pin_${pin} = microzig.Gpio(microzig.board.pin${pin}, .{ .mode = .output, .initial_state = .low });`, null);
            this.addLn(lines, `    pin_${pin}.init();`, null);
        });
        this.addLn(lines, "", null);

        // Globals (as locals in main)
        globals.forEach(g => this.genStmt(g, lines, "    "));

        if (setup) {
            this.addLn(lines, "    // Setup", setup);
            setup.children.forEach(c => this.genStmt(c, lines, "    "));
        }

        if (loop) {
            this.addLn(lines, "", null);
            this.addLn(lines, "    while (true) {", loop);
            loop.children.forEach(c => this.genStmt(c, lines, "        "));
            // Add a small delay if loop is empty to prevent lockup
            if (loop.children.length === 0) {
                this.addLn(lines, "        microzig.cpu.delay_ms(10);", null);
            }
            this.addLn(lines, "    }", null);
        } else {
            // Fallback for linear script
            const orphans = ast.children.filter(c => c.nodeType !== 'Function' && c.nodeType !== 'VariableDeclaration');
            orphans.forEach(c => this.genStmt(c, lines, "    "));
        }

        this.addLn(lines, "}", null);

        return { code: lines.join('\n'), map: this.sourceMap };
    }

    private scanPins(node: BaseNode) {
        if (node.nodeType === 'GpioSet' || node.nodeType === 'GpioRead') {
            const first = node.children[0];
            if (first && first.nodeType === 'Literal' && typeof first.attributes.value === 'number') {
                this.usedPins.add(first.attributes.value);
            }
        }
        if (node.children) node.children.forEach(c => this.scanPins(c));
    }

    private addLn(lines: string[], text: string, node: BaseNode | null) {
        lines.push(text);
        if (node && node.metadata && node.metadata.line) {
            this.sourceMap.push({ generatedLine: this.currentLine, sourceLine: node.metadata.line });
        }
        this.currentLine += text.split('\n').length;
    }

    private genStmt(node: BaseNode, lines: string[], indent: string) {
        if (node.leadingComments) {
            node.leadingComments.forEach(c => this.addLn(lines, `${indent}${c}`, null));
        }

        if (node.nodeType === 'VariableDeclaration') {
            const val = node.children.length > 0 ? this.genExpr(node.children[0]) : '0';
            // Use var for everything to be safe, inferred type
            this.addLn(lines, `${indent}var ${node.attributes.name} = ${val};`, node);
        }
        else if (node.nodeType === 'ExpressionStatement') {
            this.addLn(lines, `${indent}${this.genExpr(node.children[0])};`, node);
        }
        else if (node.nodeType === 'GpioSet') {
            const pinNode = node.children[0];
            const valNode = node.children[1];
            let pinStr = "";
            if (pinNode.nodeType === 'Literal') pinStr = `pin_${pinNode.attributes.value}`;
            else pinStr = this.genExpr(pinNode); // Fallback if dynamic, might break in Zig without lookup table

            const val = this.genExpr(valNode);
            const method = (val === '1' || val === 'true') ? 'put(1)' : 'put(0)';

            if (pinNode.nodeType === 'Literal') {
                this.addLn(lines, `${indent}${pinStr}.${method};`, node);
            } else {
                // Dynamic pin handling is hard in static Zig without map. Commenting out.
                this.addLn(lines, `${indent}// Dynamic pin set not fully supported: ${pinStr} -> ${val}`, node);
            }
        }
        else if (node.nodeType === 'DelayMs') {
            this.addLn(lines, `${indent}microzig.cpu.delay_ms(${this.genExpr(node.children[0])});`, node);
        }
        else if (node.nodeType === 'IfStatement') {
            this.addLn(lines, `${indent}if (${this.genExpr(node.children[0])}) {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'WhileLoop') {
            this.addLn(lines, `${indent}while (${this.genExpr(node.children[0])}) {`, node);
            node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
            this.addLn(lines, `${indent}}`, node);
        }
        else if (node.nodeType === 'Print') {
            // Zig print is complex, using std.debug.print
            this.addLn(lines, `${indent}std.debug.print("{}", .{${this.genExpr(node.children[0])}});`, node);
        }
        else {
            this.addLn(lines, `${indent}// ${node.nodeType}`, node);
        }
    }

    private genExpr(node: BaseNode): string {
        if (node.nodeType === 'Literal') {
            if (node.attributes.isString) return `"${node.attributes.value}"`;
            // Zig requires explicit float types sometimes, but literals are okay
            return String(node.attributes.value);
        }
        if (node.nodeType === 'Identifier') return node.attributes.name;
        if (node.nodeType === 'BinaryExpression') {
            let op = node.attributes.operator;
            if (op === '&&') op = 'and';
            if (op === '||') op = 'or';
            // Zig doesn't like mixing bools and ints for logic, assumes AST is correct types
            return `${this.genExpr(node.children[0])} ${op} ${this.genExpr(node.children[1])}`;
        }
        if (node.nodeType === 'UnaryExpression') {
            if (node.attributes.operator === '!') return `!${this.genExpr(node.children[0])}`;
            return `${node.attributes.operator}${this.genExpr(node.children[0])}`;
        }
        if (node.nodeType === 'CallExpression') {
            const args = node.children.map(c => this.genExpr(c)).join(', ');
            return `${node.attributes.callee}(${args})`;
        }
        if (node.nodeType === 'GpioRead') {
            const p = node.children[0];
            if (p.nodeType === 'Literal') return `pin_${p.attributes.value}.read()`;
            return '0';
        }
        return "";
    }
}
