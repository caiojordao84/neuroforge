import type { ProgramNode, BaseNode } from '@/system/types';
export class BlocklyParser {
    private declaredVars = new Set<string>();

    parse(xmlText: string): ProgramNode {
        this.declaredVars.clear();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const program: ProgramNode = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };

        // Processa TODOS os top-level blocks de forma independente.
        // Antes: só topBlocks[0] era processado (chain); agora cada bloco de topo
        // (nf_setup, nf_loop, variáveis globais, etc.) é tratado separadamente,
        // permitindo nf_setup e nf_loop coexistirem como blocos raiz distintos.
        // TODO (Fase 3): BoardProfile.getSetupNodes(boardId) será injetado em
        //   Function(name:'setup') antes dos nodes do utilizador. Ex.:
        //   Arduino  → Serial.begin(9600)
        //   ESP32    → WiFi.begin(ssid, pass)
        //   S7-1200  → OB100 startup block (sem serial)
        //   PLC RS485→ ModbusTCP.begin(ip, port)
        const topBlocks = Array.from(xmlDoc.documentElement.children)
            .filter(el => el.tagName.toLowerCase() === 'block');

        for (const topBlock of topBlocks) {
            const node = this.createNode(topBlock, []);
            if (node) program.children.push(node);
        }

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

        // nf_setup: bloco contentor de setup. Gera Function(name:'setup') com os blocos
        // filhos dentro do slot DO. Sem injeção automática de Serial.begin ou
        // qualquer outro init — o utilizador controla 100% o conteúdo.
        if (type === 'nf_setup') {
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            return {
                nodeType: 'Function', id: 'b',
                attributes: { name: 'setup' },
                children
            };
        }

        // nf_loop: bloco contentor de loop. Gera Function(name:'loop') tal como nf_setup
        // gera Function(name:'setup') — o CGenerator trata ambos no ramo "already structured".
        // Antes gerava WhileLoop(isInfinite:true), o que causava while(1){} fora de função
        // quando nf_setup coexistia como top-level block (CGenerator entrava no ramo structured
        // mas só tratava nós Function, deixando o WhileLoop cair para genStmt no top-level).
        if (type === 'nf_loop') {
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            return {
                nodeType: 'Function', id: 'b',
                attributes: { name: 'loop' },
                children
            };
        }

        // nf_main: bloco contentor para targets não-Arduino (plain C, plain Rust, Python standalone).
        // Gera Function(name:'main') — os generators detectam este nome e emitem a assinatura correta:
        //   C        → int main() { ... return 0; }
        //   Python   → def main(): ... if __name__ == '__main__': main()
        //   Rust     → fn main() { ... }  (sem no_std/no_main)
        if (type === 'nf_main') {
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            return {
                nodeType: 'Function', id: 'b',
                attributes: { name: 'main' },
                children
            };
        }

        // nf_function: bloco de definição de função auxiliar.
        // Gera Function(name: X) — CGenerator emite void X(){}, Python emite def X():, Rust emite fn X(){}.
        if (type === 'nf_function') {
            const name = this.getF(block, 'NAME') || 'myFunc';
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            return {
                nodeType: 'Function', id: 'b',
                attributes: { name },
                children
            };
        }

        // nf_call_function: bloco de chamada a uma função auxiliar definida com nf_function.
        if (type === 'nf_call_function') {
            const name = this.getF(block, 'NAME') || 'myFunc';
            return {
                nodeType: 'ExpressionStatement', id: 'b', attributes: {},
                children: [{
                    nodeType: 'CallExpression', id: 'c',
                    attributes: { callee: name },
                    children: []
                }]
            };
        }

        // nf_struct: bloco de definição de struct/class.
        // Gera StructDeclaration — CGenerator emite struct {}, PythonGenerator emite class.
        if (type === 'nf_struct') {
            const name = this.getF(block, 'NAME') || 'MyStruct';
            const fields: { name: string; type: string }[] = [];
            const fieldCount = parseInt(block.getAttribute('usearrfields') || '0');
            for (let i = 0; i < fieldCount; i++) {
                const fieldName = this.getF(block, `FIELD_NAME_${i}`);
                const fieldType = this.getF(block, `FIELD_TYPE_${i}`) || 'int';
                if (fieldName) fields.push({ name: fieldName, type: fieldType });
            }
            return {
                nodeType: 'StructDeclaration', id: 'b',
                attributes: { name, fields },
                children: []
            };
        }

        // nf_enum: bloco de definição de enum.
        // Gera EnumDeclaration — CGenerator emite enum {}, PythonGenerator emite class.
        if (type === 'nf_enum') {
            const name = this.getF(block, 'NAME') || 'MyEnum';
            const members: { name: string; value?: number }[] = [];
            const memberCount = parseInt(block.getAttribute('usemembers') || '0');
            for (let i = 0; i < memberCount; i++) {
                const memberName = this.getF(block, `MEMBER_NAME_${i}`);
                const memberValue = this.getF(block, `MEMBER_VALUE_${i}`);
                if (memberName) {
                    members.push({ 
                        name: memberName, 
                        value: memberValue !== undefined ? parseInt(memberValue) : undefined 
                    });
                }
            }
            return {
                nodeType: 'EnumDeclaration', id: 'b',
                attributes: { name, members },
                children: []
            };
        }

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
                        children: [{ nodeType: 'Identifier', id: 'i', attributes: { name }, children: [] }, val]
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
            const thenBlock: BaseNode = { nodeType: 'Block', id: 'b', attributes: {}, children };
            return { nodeType: 'IfStatement', id: 'b', attributes: {}, children: [cond, thenBlock] };
        }
        if (type === 'controls_whileUntil') {
            const cond = this.parseVal(block, 'BOOL');
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            const bodyBlock: BaseNode = { nodeType: 'Block', id: 'b', attributes: {}, children };
            return { nodeType: 'WhileLoop', id: 'b', attributes: { isInfinite: false }, children: [cond, bodyBlock] };
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
            const cond: BaseNode = { nodeType: 'BinaryExpression', id: 'cond', attributes: { operator: '<=' }, children: [{ nodeType: 'Identifier', id: 'i', attributes: { name: varName }, children: [] }, to] };
            // Update: i++
            const update: BaseNode = { nodeType: 'UnaryExpression', id: 'upd', attributes: { operator: '++', prefix: false }, children: [{ nodeType: 'Identifier', id: 'i', attributes: { name: varName }, children: [] }] };

            const bodyBlock: BaseNode = { nodeType: 'Block', id: 'b', attributes: {}, children: body };
            return { nodeType: 'ForLoop', id: 'b', attributes: { hasInit: true, hasUpdate: true }, children: [init, cond, update, bodyBlock] };
        }
        if (type === 'controls_forEach') {
            const varName = this.getF(block, 'VAR') || 'i';
            const iterable = this.parseVal(block, 'LIST');
            const doStmt = block.querySelector('statement[name="DO"] > block');
            const body: BaseNode[] = [];
            if (doStmt) this.processBlockChain(doStmt, body, setupList);
            const bodyBlock: BaseNode = { nodeType: 'Block', id: 'b', attributes: {}, children: body };
            return {
                nodeType: 'ForIn', id: 'b', attributes: { varName },
                children: [iterable, bodyBlock]
            };
        }

        // nf_dowhile: Do-While loop
        if (type === 'nf_dowhile') {
            const cond = this.parseVal(block, 'COND');
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            const bodyBlock: BaseNode = { nodeType: 'Block', id: 'b', attributes: {}, children };
            return { nodeType: 'DoWhileLoop', id: 'b', attributes: {}, children: [cond, bodyBlock] };
        }

        // nf_switch: Switch statement
        if (type === 'nf_switch') {
            const expr = this.parseVal(block, 'EXPR');
            return { nodeType: 'SwitchStatement', id: 'b', attributes: {}, children: [expr] };
        }

        // nf_case: Case clause
        if (type === 'nf_case') {
            const val = this.parseVal(block, 'VALUE');
            const children: BaseNode[] = [];
            const doStmt = block.querySelector('statement[name="DO"] > block');
            if (doStmt) this.processBlockChain(doStmt, children, setupList);
            children.push({ nodeType: 'BreakStatement', id: 'b', attributes: {}, children: [] });
            return { nodeType: 'CaseClause', id: 'b', attributes: {}, children: [val, ...children] };
        }

        // nf_return: Return statement
        if (type === 'nf_return') {
            const val = this.parseVal(block, 'VALUE');
            return { nodeType: 'ReturnStatement', id: 'b', attributes: {}, children: val ? [val] : [] };
        }

        // nf_member: Member expression (obj.prop)
        if (type === 'nf_member') {
            const obj = this.getF(block, 'OBJECT') || 'obj';
            const prop = this.getF(block, 'PROPERTY') || 'prop';
            return {
                nodeType: 'MemberExpression',
                id: 'b',
                attributes: { object: obj, property: prop, operator: '.' },
                children: [{ nodeType: 'Identifier', id: 'i', attributes: { name: obj }, children: [] }]
            };
        }

        // nf_conditional: Ternary conditional (condition ? trueVal : falseVal)
        if (type === 'nf_conditional') {
            const cond = this.parseVal(block, 'CONDITION');
            const trueVal = this.parseVal(block, 'TRUE_VALUE');
            const falseVal = this.parseVal(block, 'FALSE_VALUE');
            return {
                nodeType: 'ConditionalExpression',
                id: 'b',
                attributes: {},
                children: [cond, trueVal, falseVal]
            };
        }

        // nf_struct_init: Struct initializer { .field = value, ... }
        if (type === 'nf_struct_init') {
            const name = this.getF(block, 'NAME') || 'MyStruct';
            const fieldCount = parseInt(block.getAttribute('usefields') || '0');
            const children: any[] = [];
            for (let i = 0; i < fieldCount; i++) {
                const fieldName = this.getF(block, `FIELD_NAME_${i}`);
                const fieldValue = this.parseVal(block, `FIELD_VALUE_${i}`);
                if (fieldName) {
                    children.push({
                        nodeType: 'Identifier',
                        id: `f-${i}`,
                        attributes: { name: fieldName },
                        children: fieldValue ? [fieldValue] : []
                    });
                }
            }
            return {
                nodeType: 'DesignatedInitializer',
                id: 'b',
                attributes: { name },
                children
            };
        }

        // nf_cast: Type cast (int)x, (float)x
        if (type === 'nf_cast') {
            const targetType = this.getF(block, 'TYPE') || 'int';
            const value = this.parseVal(block, 'VALUE');
            return {
                nodeType: 'CastExpression',
                id: 'b',
                attributes: { targetType },
                children: value ? [value] : []
            };
        }

        // nf_unary: Unary operators (&, *, !, -, ++, --)
        if (type === 'nf_unary') {
            const op = this.getF(block, 'OP') || '!';
            const value = this.parseVal(block, 'VALUE');
            const prefix = op !== '++' && op !== '--';
            return {
                nodeType: 'UnaryExpression',
                id: 'b',
                attributes: { operator: op, prefix },
                children: value ? [value] : []
            };
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
            const pinVal = this.getF(block, 'PIN') || '2';
            const val = this.getF(block, 'VALUE') === 'HIGH' ? '1' : '0';
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum ? this.lit(pinVal) : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }) as BaseNode;
            return { nodeType: 'GpioSet', id: 'b', attributes: {}, children: [pinNode, this.lit(val)] };
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
            const pinVal = this.getF(block, 'PIN') || '2';
            const angleVal = this.getF(block, 'ANGLE') || '90';
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum ? this.lit(pinVal) : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }) as BaseNode;
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'servo' }, children: [pinNode, this.lit(angleVal)] };
        }
        if (type === 'nf_tone') {
            const pinVal = this.getF(block, 'PIN') || '2';
            const freqVal = this.getF(block, 'FREQ') || '440';
            const durVal = this.getF(block, 'DUR') || '500';
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum ? this.lit(pinVal) : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }) as BaseNode;
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'tone' }, children: [pinNode, this.lit(freqVal), this.lit(durVal)] };
        }
        if (type === 'nf_notone') {
            const pinVal = this.getF(block, 'PIN') || '2';
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum ? this.lit(pinVal) : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }) as BaseNode;
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'noTone' }, children: [pinNode] };
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

        // --- S5: Break / Continue ---
        if (type === 'controls_flow_statements') {
            const flow = this.getF(block, 'FLOW');
            if (flow === 'BREAK') return { nodeType: 'BreakStatement', id: 'b', attributes: {}, children: [] };
            if (flow === 'CONTINUE') return { nodeType: 'ContinueStatement', id: 'b', attributes: {}, children: [] };
            return null;
        }

        // --- S5: AnalogWrite / PWM ---
        if (type === 'nf_analog_write') {
            const pinVal = this.getF(block, 'PIN') || '0';
            const pwmVal = this.parseVal(block, 'VALUE');
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum
                ? this.lit(pinVal)
                : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }
            ) as BaseNode;
            return { nodeType: 'AnalogWrite', id: 'b', attributes: {}, children: [pinNode, pwmVal] };
        }

        // --- S5: pinMode ---
        if (type === 'nf_pinmode') {
            const pinVal = this.getF(block, 'PIN') || '0';
            const mode = this.getF(block, 'MODE') || 'OUTPUT';
            const isNum = /^\d+$/.test(pinVal);
            const pinNode = (isNum
                ? this.lit(pinVal)
                : { nodeType: 'Identifier', id: 'i', attributes: { name: pinVal }, children: [] }
            ) as BaseNode;
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'pinMode' }, children: [pinNode, this.lit(mode, true)] };
        }

        // --- S5: Serial ---
        if (type === 'nf_serial_begin') {
            const baud = this.getF(block, 'BAUD') || '9600';
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'Serial.begin' }, children: [this.lit(parseInt(baud) || 9600)] };
        }
        if (type === 'nf_serial_print') {
            const printVal = this.parseVal(block, 'VALUE');
            return { nodeType: 'Print', id: 'b', attributes: {}, children: [printVal] };
        }
        if (type === 'nf_serial_read') {
            const varName = this.getF(block, 'VAR') || 'serialData';
            return {
                nodeType: 'ExpressionStatement', id: 'b', attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: 'b2', attributes: { operator: '=' },
                    children: [
                        { nodeType: 'Identifier', id: 'i', attributes: { name: varName }, children: [] },
                        { nodeType: 'CallExpression', id: 'c', attributes: { callee: 'Serial.readString' }, children: [] }
                    ]
                }]
            };
        }

        // --- S5: Timing extras ---
        if (type === 'nf_delay_us') {
            const usVal = this.parseVal(block, 'US');
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'delayMicroseconds' }, children: [usVal] };
        }

        // --- S5: Arrays ---
        if (type === 'lists_create_with') {
            const count = parseInt(block.querySelector('mutation')?.getAttribute('items') || '0');
            const elements: BaseNode[] = [];
            for (let i = 0; i < count; i++) {
                elements.push(this.parseVal(block, `ADD${i}`));
            }
            return { nodeType: 'ArrayInitializer', id: 'b', attributes: { length: count }, children: elements };
        }
        return null;
    }

    private parseVal(block: Element, name: string): BaseNode {
        const val = block.querySelector(`value[name="${name}"] > block`);
        if (!val) return this.lit(0);
        const type = val.getAttribute('type');

        // Variables
        if (type === 'variables_get') {
            return { nodeType: 'Identifier', id: 'b', attributes: { name: this.getF(val, 'VAR') }, children: [] };
        }

        // Logic / Math
        if (type === 'logic_compare') {
            const opMap: any = { 'GT': '>', 'LT': '<', 'EQ': '==', 'NEQ': '!=', 'GTE': '>=', 'LTE': '<=' };
            const op = opMap[this.getF(val, 'OP')] || '==';
            return { nodeType: 'BinaryExpression', id: 'b', attributes: { operator: op }, children: [this.parseVal(val, 'A'), this.parseVal(val, 'B')] };
        }
        if (type === 'logic_negate') {
            return { nodeType: 'UnaryExpression', id: 'b', attributes: { operator: '!', prefix: true }, children: [this.parseVal(val, 'BOOL')] };
        }
        if (type === 'math_arithmetic' || type === 'math_modulo') {
            const opMap: any = { 'ADD': '+', 'MINUS': '-', 'MULTIPLY': '*', 'DIVIDE': '/', 'MOD': '%' };
            const op = opMap[this.getF(val, 'OP')] || (type === 'math_modulo' ? '%' : '+');
            const aName = type === 'math_modulo' ? 'DIVIDEND' : 'A';
            const bName = type === 'math_modulo' ? 'DIVISOR' : 'B';
            return { nodeType: 'BinaryExpression', id: 'b', attributes: { operator: op }, children: [this.parseVal(val, aName), this.parseVal(val, bName)] };
        }
        if (type === 'math_single') {
            const op = this.getF(val, 'OP') === 'NEG' ? '-' : '';
            if (op === '-') return { nodeType: 'UnaryExpression', id: 'b', attributes: { operator: '-', prefix: true }, children: [this.parseVal(val, 'NUM')] };
        }

        if (type === 'math_number') return this.lit(this.getF(val, 'NUM') || 0);
        if (type === 'text') return { nodeType: 'Literal', id: 'l', attributes: { value: this.getF(val, 'TEXT'), isString: true }, children: [] };

        // Existing Sensors/Reads
        if (type === 'nf_dht_temp') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'dht.readTemp' }, children: [] };
        if (type === 'nf_dht_hum') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'dht.readHum' }, children: [] };
        if (type === 'nf_ultrasonic_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ultrasonic.read' }, children: [] };
        if (type === 'nf_ldr_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ldr.read' }, children: [] };
        if (type === 'nf_ir_read') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'ir.read' }, children: [] };
        if (type === 'nf_keypad_read') return { nodeType: 'KeypadRead', id: 'b', attributes: {}, children: [] };
        if (type === 'nf_joystick_read') {
            const axis = this.getF(val, 'AXIS') === 'Y' ? '35' : '34';
            return { nodeType: 'AnalogRead', id: 'b', attributes: {}, children: [this.lit(axis)] };
        }
        if (type === 'nf_mpu_get') {
            const axis = this.getF(val, 'AXIS');
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'mpu.get', axis }, children: [] };
        }
        if (type === 'nf_analog_read') return { nodeType: 'AnalogRead', id: 'b', attributes: {}, children: [this.lit(this.getF(val, 'PIN') || 26)] };
        if (type === 'nf_digital_read') return { nodeType: 'GpioRead', id: 'b', attributes: {}, children: [this.lit(this.getF(val, 'PIN') || 13)] };

        // --- S5: Booleans ---
        if (type === 'logic_boolean') {
            const boolStr = this.getF(val, 'BOOL');
            return this.lit(boolStr === 'TRUE' ? 1 : 0);
        }

        // --- S5: Logic AND / OR ---
        if (type === 'logic_operation') {
            const logicOp = this.getF(val, 'OP') === 'OR' ? '||' : '&&';
            return {
                nodeType: 'BinaryExpression', id: 'b', attributes: { operator: logicOp },
                children: [this.parseVal(val, 'A'), this.parseVal(val, 'B')]
            };
        }

        // --- S5: Timing values ---
        if (type === 'nf_millis') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'millis' }, children: [] };
        if (type === 'nf_micros') return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'micros' }, children: [] };

        // --- S5: Random ---
        if (type === 'nf_random') {
            const rMin = this.parseVal(val, 'MIN');
            const rMax = this.parseVal(val, 'MAX');
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'random' }, children: [rMin, rMax] };
        }

        // --- S5: Serial available (value) ---
        if (type === 'nf_serial_available') {
            return { nodeType: 'CallExpression', id: 'b', attributes: { callee: 'Serial.available' }, children: [] };
        }

        // --- S5: Array index ---
        if (type === 'lists_getIndex') {
            const listVal = this.parseVal(val, 'VALUE');
            const idxVal = this.parseVal(val, 'AT');
            // Blockly é 1-based; converter para 0-based
            const zeroIdx: BaseNode = {
                nodeType: 'BinaryExpression', id: 'bi', attributes: { operator: '-' },
                children: [idxVal, this.lit(1)]
            };
            return { nodeType: 'SubscriptExpression', id: 'b', attributes: {}, children: [listVal, zeroIdx] };
        }
        return this.lit(0);
    }
    private lit(v: any, isStr = false) { return { nodeType: 'Literal', id: 'l', attributes: { value: v, isString: isStr || typeof v === 'string' }, children: [] } as BaseNode; }
    private getF(b: Element, n: string) { return b.querySelector(`field[name="${n}"]`)?.textContent; }
}
