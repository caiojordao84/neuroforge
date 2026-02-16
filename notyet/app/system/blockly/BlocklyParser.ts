
import { ProgramNode, BaseNode } from '../types';

export class BlocklyParser {
  private declaredVars = new Set<string>();

  parse(xmlText: string): ProgramNode {
    this.declaredVars.clear();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const program: ProgramNode = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
    const setup: BaseNode = { nodeType: 'Function', id: 'setup', attributes: { name: 'setup' }, children: [] };
    const loop: BaseNode = { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: [] };
    const topBlocks = Array.from(xmlDoc.documentElement.children).filter(el => el.tagName.toLowerCase() === 'block');
    if (topBlocks.length > 0) this.processBlockChain(topBlocks[0], loop.children, setup.children);
    program.children.push(setup, loop);
    return program;
  }

  private processBlockChain(block: Element, list: BaseNode[], setupList: BaseNode[]) {
      let curr: Element | null = block;
      while (curr) {
          const node = this.createNode(curr, setupList);
          if (node) list.push(node);
          const next = Array.from(curr.children).find(el => el.tagName === 'next');
          curr = next ? (next.querySelector('block') || null) : null;
      }
  }

  private createNode(block: Element, setupList: BaseNode[]): BaseNode | null {
      const type = block.getAttribute('type');

      // Variables
      if (type === 'variables_set') {
           const name = this.getF(block, 'VAR') || 'i';
           const val = this.parseVal(block, 'VALUE');
           
           if (!this.declaredVars.has(name)) {
               this.declaredVars.add(name);
               return { nodeType: 'VariableDeclaration', id: 'b', attributes: { name, type: 'int' }, children: [val] };
           } else {
               // Assignment: Represented as binary expr inside expression stmt
               return {
                   nodeType: 'ExpressionStatement', id: 'b', attributes: {}, 
                   children: [{
                       nodeType: 'BinaryExpression', id: 'b', attributes: { operator: '=' }, 
                       children: [ { nodeType: 'Identifier', id: 'i', attributes: { name }, children: [] }, val ]
                   }]
               };
           }
      }

      // Logic / Loops
      if (type === 'controls_if') {
          const cond = this.parseVal(block, 'IF0');
          const doStmt = block.querySelector('statement[name="DO0"] > block');
          const children: BaseNode[] = [];
          if (doStmt) this.processBlockChain(doStmt, children, setupList);
          return { nodeType: 'IfStatement', id: 'b', attributes: {}, children: [cond, ...children] };
      }
      if (type === 'controls_whileUntil') {
          const cond = this.parseVal(block, 'BOOL');
          const doStmt = block.querySelector('statement[name="DO"] > block');
          const children: BaseNode[] = [];
          if (doStmt) this.processBlockChain(doStmt, children, setupList);
          return { nodeType: 'WhileLoop', id: 'b', attributes: {}, children: [cond, ...children] };
      }
      if (type === 'controls_for') {
          const varName = this.getF(block, 'VAR') || 'i';
          const from = this.parseVal(block, 'FROM');
          const to = this.parseVal(block, 'TO');
          const by = this.parseVal(block, 'BY'); // Usually 1
          
          this.declaredVars.add(varName);

          const doStmt = block.querySelector('statement[name="DO"] > block');
          const body: BaseNode[] = [];
          if (doStmt) this.processBlockChain(doStmt, body, setupList);

          const init: BaseNode = { nodeType: 'VariableDeclaration', id: 'init', attributes: { name: varName, type: 'int' }, children: [from] };
          // Condition: i <= to (Blockly is inclusive)
          const cond: BaseNode = { nodeType: 'BinaryExpression', id: 'cond', attributes: { operator: '<=' }, children: [ {nodeType:'Identifier', id:'i', attributes:{name:varName}, children:[]}, to ] };
          // Update: i++
          const update: BaseNode = { nodeType: 'UnaryExpression', id: 'upd', attributes: { operator: '++', prefix: false }, children: [ {nodeType:'Identifier', id:'i', attributes:{name:varName}, children:[]} ] };

          return { nodeType: 'ForLoop', id: 'b', attributes: { hasInit: true, hasUpdate: true }, children: [init, cond, update, ...body] };
      }

      // Text Print
      if (type === 'text_print') {
          const val = this.parseVal(block, 'TEXT');
          return { nodeType: 'Print', id: 'b', attributes: {}, children: [val] };
      }
      
      // Delays
      if (type === 'nf_delay') {
          const ms = this.parseVal(block, 'MS');
          return { nodeType: 'DelayMs', id: 'b', attributes: {}, children: [ms] };
      }

      // Standard Nodes
      if (type === 'nf_gpio_set') {
          const pin = this.getF(block, 'PIN') || '2';
          const val = this.getF(block, 'VALUE') === 'HIGH' ? '1' : '0';
          return { nodeType: 'GpioSet', id: 'b', attributes: {}, children: [this.lit(pin), this.lit(val)] };
      }
      if (type === 'nf_lcd_print') {
          const text = this.parseVal(block, 'TEXT');
          return { nodeType: 'LcdPrint', id: 'b', attributes: {}, children: [text] };
      }
      if (type === 'nf_lcd_clear') return { nodeType: 'LcdClear', id: 'b', attributes: {}, children: [] };
      if (type === 'nf_lcd_cursor') {
          const col = this.getF(block, 'COL');
          const row = this.getF(block, 'ROW');
          return { nodeType: 'LcdCursor', id: 'b', attributes: {}, children: [this.lit(col), this.lit(row)] };
      }
      if (type === 'nf_oled_text') {
          const text = this.getF(block, 'TEXT');
          const x = this.getF(block, 'X');
          const y = this.getF(block, 'Y');
          return { nodeType: 'OledText', id: 'b', attributes: {}, children: [this.lit(text, true), this.lit(x), this.lit(y), this.lit(1)] };
      }
      if (type === 'nf_oled_show') return { nodeType: 'OledShow', id: 'b', attributes: {}, children: [] };
      if (type === 'nf_oled_clear') return { nodeType: 'OledClear', id: 'b', attributes: {}, children: [] };
      if (type === 'nf_rgb_set') {
          const r = this.getF(block, 'R');
          const g = this.getF(block, 'G');
          const b = this.getF(block, 'B');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'rgb.setColor' }, children: [this.lit(r), this.lit(g), this.lit(b)] };
      }
      if (type === 'nf_neopixel_set') {
          const i = this.getF(block, 'IDX');
          const r = this.getF(block, 'R');
          const g = this.getF(block, 'G');
          const b = this.getF(block, 'B');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'neopixel.set' }, children: [this.lit(i), this.lit(r), this.lit(g), this.lit(b)] };
      }
      if (type === 'nf_neopixel_show') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'neopixel.show' }, children: [] };
      if (type === 'nf_neopixel_clear') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'neopixel.clear' }, children: [] };
      if (type === 'nf_sevseg_print') {
          const val = this.parseVal(block, 'VAL');
          return { nodeType: 'SevSegPrint', id: 'b', attributes: {}, children: [val] };
      }
      if (type === 'nf_servo') {
          const pin = this.getF(block, 'PIN') || '4';
          const angle = this.getF(block, 'ANGLE');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'servo' }, children: [this.lit(pin), this.lit(angle)] };
      }
      if (type === 'nf_tone') {
          const pin = this.getF(block, 'PIN') || '5';
          const freq = this.getF(block, 'FREQ');
          const dur = this.getF(block, 'DUR');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'tone' }, children: [this.lit(pin), this.lit(freq), this.lit(dur)] };
      }
      if (type === 'nf_notone') {
          const pin = this.getF(block, 'PIN') || '5';
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'noTone' }, children: [this.lit(pin)] };
      }
      if (type === 'nf_motors_move') {
          const l = this.getF(block, 'LEFT');
          const r = this.getF(block, 'RIGHT');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'motors.move' }, children: [this.lit(l), this.lit(r)] };
      }
      if (type === 'nf_wifi_begin') {
          const ssid = this.getF(block, 'SSID');
          const pass = this.getF(block, 'PASS');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'WiFi.begin' }, children: [this.lit(ssid, true), this.lit(pass, true)] };
      }
      if (type === 'nf_wifi_status') {
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'WiFi.status' }, children: [] };
      }
      if (type === 'nf_http_get') {
          const url = this.getF(block, 'URL');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'HTTP.get' }, children: [this.lit(url, true)] };
      }
      if (type === 'nf_spiffs_open') {
          const path = this.getF(block, 'PATH');
          const mode = this.getF(block, 'MODE');
          const content = this.getF(block, 'CONTENT');
          return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'INTERNAL_WRITE_FILE' }, children: [this.lit(path, true), this.lit(mode, true), this.lit(content, true)] };
      }
      return null;
  }
  
  private parseVal(block: Element, name: string): BaseNode {
      const val = block.querySelector(`value[name="${name}"] > block`);
      if(!val) return this.lit(0);
      const type = val.getAttribute('type');
      
      // Variables
      if(type === 'variables_get') {
          return { nodeType: 'Identifier', id: 'b', attributes: { name: this.getF(val, 'VAR') }, children: [] };
      }

      // Logic / Math
      if(type === 'logic_compare') {
          const opMap: any = { 'GT': '>', 'LT': '<', 'EQ': '==', 'NEQ': '!=', 'GTE': '>=', 'LTE': '<=' };
          const op = opMap[this.getF(val, 'OP')] || '==';
          return { nodeType: 'BinaryExpression', id: 'b', attributes: { operator: op }, children: [this.parseVal(val, 'A'), this.parseVal(val, 'B')] };
      }
      if(type === 'logic_negate') {
          return { nodeType: 'UnaryExpression', id: 'b', attributes: { operator: '!', prefix: true }, children: [this.parseVal(val, 'BOOL')] };
      }
      if(type === 'math_arithmetic' || type === 'math_modulo') {
          const opMap: any = { 'ADD': '+', 'MINUS': '-', 'MULTIPLY': '*', 'DIVIDE': '/', 'MOD': '%' };
          const op = opMap[this.getF(val, 'OP')] || (type === 'math_modulo' ? '%' : '+');
          const aName = type === 'math_modulo' ? 'DIVIDEND' : 'A';
          const bName = type === 'math_modulo' ? 'DIVISOR' : 'B';
          return { nodeType: 'BinaryExpression', id: 'b', attributes: { operator: op }, children: [this.parseVal(val, aName), this.parseVal(val, bName)] };
      }
      if(type === 'math_single') {
          const op = this.getF(val, 'OP') === 'NEG' ? '-' : '';
          if(op === '-') return { nodeType: 'UnaryExpression', id: 'b', attributes: { operator: '-', prefix: true }, children: [this.parseVal(val, 'NUM')] };
      }

      if(type === 'math_number') return this.lit(this.getF(val, 'NUM') || 0);
      if(type === 'text') return { nodeType: 'Literal', id: 'l', attributes: { value: this.getF(val, 'TEXT'), isString: true }, children: [] };
      
      // Existing Sensors/Reads
      if(type === 'nf_dht_temp') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'dht.readTemp' }, children: [] };
      if(type === 'nf_dht_hum') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'dht.readHum' }, children: [] };
      if(type === 'nf_ultrasonic_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ultrasonic.read' }, children: [] };
      if(type === 'nf_ldr_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ldr.read' }, children: [] };
      if(type === 'nf_ir_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ir.read' }, children: [] };
      if(type === 'nf_keypad_read') return { nodeType: 'KeypadRead', id: 'b', attributes: {}, children: [] };
      if(type === 'nf_joystick_read') {
           const axis = this.getF(val, 'AXIS') === 'Y' ? '35' : '34';
           return { nodeType: 'AnalogRead', id: 'b', attributes: {}, children: [this.lit(axis)] };
      }
      if(type === 'nf_mpu_get') {
           const axis = this.getF(val, 'AXIS');
           return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'mpu.get', axis }, children: [] };
      }
      if(type === 'nf_analog_read') return { nodeType: 'AnalogRead', id: 'b', attributes: {}, children: [this.lit(this.getF(val, 'PIN') || 26)] };
      if(type === 'nf_digital_read') return { nodeType: 'GpioRead', id: 'b', attributes: {}, children: [this.lit(this.getF(val, 'PIN') || 13)] };
      return this.lit(0);
  }
  private lit(v: any, isStr=false) { return { nodeType: 'Literal', id: 'l', attributes: { value: v, isString: isStr || typeof v === 'string' }, children: [] } as BaseNode; }
  private getF(b: Element, n: string) { return b.querySelector(`field[name="${n}"]`)?.textContent; }
}
