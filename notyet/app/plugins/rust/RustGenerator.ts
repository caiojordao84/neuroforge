
import { ProgramNode, BaseNode, SourceMapEntry } from '../../system/types';

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
    const loop = funcs.find(f => f.attributes.name === 'loop');

    if (setup || loop) {
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
        if (loop) this.printComments(loop, lines, "    ");
        this.addLn(lines, "    loop {", loop);
        if (loop) {
            loop.children.forEach(c => this.genStmt(c, lines, "        "));
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
          node.leadingComments.forEach(c => this.addLn(lines, `${indent}${c}`, null));
      }
  }

  private genStmt(node: BaseNode, lines: string[], indent: string) {
      this.printComments(node, lines, indent);

      if (node.nodeType === 'VariableDeclaration') {
          const val = node.children.length > 0 ? this.genExpr(node.children[0]) : '0';
          this.addLn(lines, `${indent}let mut ${node.attributes.name} = ${val};`, node);
      }
      else if (node.nodeType === 'ExpressionStatement') {
          this.addLn(lines, `${indent}${this.genExpr(node.children[0])};`, node);
      }
      else if (node.nodeType === 'GpioSet') {
          this.addLn(lines, `${indent}gpio_set(${this.genExpr(node.children[0])}, ${this.genExpr(node.children[1])});`, node);
      }
      else if (node.nodeType === 'DelayMs') {
          this.addLn(lines, `${indent}delay.delay_ms(${this.genExpr(node.children[0])}u32);`, node);
      }
      else if (node.nodeType === 'IfStatement') {
          this.addLn(lines, `${indent}if ${this.genExpr(node.children[0])} {`, node);
          node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
          this.addLn(lines, `${indent}}`, node);
      }
      else if (node.nodeType === 'WhileLoop') {
          this.addLn(lines, `${indent}while ${this.genExpr(node.children[0])} {`, node);
          node.children.slice(1).forEach(c => this.genStmt(c, lines, indent + "    "));
          this.addLn(lines, `${indent}}`, node);
      }
      else if (node.nodeType === 'Print') {
          this.addLn(lines, `${indent}println!("{}", ${this.genExpr(node.children[0])});`, node);
      }
      else if (node.nodeType === 'HardwarePwm') {
          this.addLn(lines, `${indent}// HW PWM on Pin ${node.attributes.pin}, Duty: ${node.attributes.duty}`, node); 
      }
      else {
          this.addLn(lines, `${indent}// ${node.nodeType}`, node);
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
      if (node.nodeType === 'CallExpression') {
          const args = node.children.map(c => this.genExpr(c)).join(', ');
          return `${node.attributes.callee}(${args})`;
      }
      return "";
  }
}
