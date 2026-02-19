
import type { ProgramNode, BaseNode } from '../types';

export class CodeToBlockly {
    generate(ast: ProgramNode): string {
        const setupNode = ast.children.find(c => c.attributes.name === 'setup');
        const loopNode = ast.children.find(c => c.attributes.name === 'loop');

        let xml = '<xml xmlns="https://developers.google.com/blockly/xml">';

        if (setupNode && setupNode.children.length > 0) {
            xml += this.processStatementList(setupNode.children);
        }

        if (loopNode && loopNode.children.length > 0) {
            xml += this.processStatementList(loopNode.children);
        }

        xml += '</xml>';
        return xml;
    }

    private processStatementList(nodes: BaseNode[]): string {
        if (nodes.length === 0) return '';

        // We must chain them: Node1 -> <next>Node2 -> <next>Node3...</next></next>
        // Recursive approach to ensure correct nesting
        return this.chainNodes(nodes);
    }

    private chainNodes(nodes: BaseNode[]): string {
        if (nodes.length === 0) return '';
        const [first, ...rest] = nodes;

        let block = this.nodeToBlock(first);
        if (!block) return this.chainNodes(rest); // Skip unknown, process rest

        if (rest.length > 0) {
            const nextXml = this.chainNodes(rest);
            if (nextXml) {
                // Insert next into the block's end
                block = block.replace('</block>', `<next>${nextXml}</next></block>`);
            }
        }
        return block;
    }

    private nodeToBlock(node: BaseNode): string | null {
        // GpioSet -> nf_gpio_set
        if (node.nodeType === 'GpioSet') {
            const pin = this.getLit(node.children[0]);
            const val = this.getLit(node.children[1]) == 1 ? 'HIGH' : 'LOW';
            return `<block type="nf_gpio_set"><field name="PIN">${pin}</field><field name="VALUE">${val}</field></block>`;
        }

        // DelayMs -> nf_delay
        if (node.nodeType === 'DelayMs') {
            const val = this.exprToValue(node.children[0]);
            let block = `<block type="nf_delay">`;
            if (val) block += `<value name="MS">${val}</value>`;
            block += `</block>`;
            return block;
        }

        // VariableDeclaration -> variables_set
        if (node.nodeType === 'VariableDeclaration') {
            const name = node.attributes.name;
            const val = this.exprToValue(node.children[0]);
            let block = `<block type="variables_set"><field name="VAR">${name}</field>`;
            if (val) block += `<value name="VALUE">${val}</value>`;
            block += `</block>`;
            return block;
        }

        // ExpressionStatement containing Assignment or Binary
        if (node.nodeType === 'ExpressionStatement') {
            return this.nodeToBlock(node.children[0]);
        }

        // Assignment (via BinaryExpression or specialized node in some parsers)
        if (node.nodeType === 'BinaryExpression' && node.attributes.operator === '=') {
            const left = node.children[0];
            const right = node.children[1];
            if (left.nodeType === 'Identifier') {
                const name = left.attributes.name;
                const val = this.exprToValue(right);
                let block = `<block type="variables_set"><field name="VAR">${name}</field>`;
                if (val) block += `<value name="VALUE">${val}</value>`;
                block += `</block>`;
                return block;
            }
        }

        // IfStatement -> controls_if
        if (node.nodeType === 'IfStatement') {
            const cond = node.children[0];
            const thenNodes = node.children.slice(1);
            // Handling else is tricky with simple structure, ignoring else for simple mapping
            // But logic supports else if passed properly in AST. Current parsers just put all children flat?
            // Actually parsers flatten if/else children into list? No, children structure is [cond, ...then, ...else]
            // We need to know where then ends. Current parsers implementation is imperfect for full restoration.
            // Simplified: Assume all children after 0 are THEN.

            const valueXml = this.exprToValue(cond);
            const statementsXml = this.chainNodes(thenNodes);

            let block = `<block type="controls_if">`;
            if (valueXml) block += `<value name="IF0">${valueXml}</value>`;
            if (statementsXml) block += `<statement name="DO0">${statementsXml}</statement>`;
            block += `</block>`;
            return block;
        }

        // WhileLoop -> controls_whileUntil
        if (node.nodeType === 'WhileLoop') {
            const cond = node.children[0];
            const body = node.children.slice(1);
            const valueXml = this.exprToValue(cond);
            const statementsXml = this.chainNodes(body);

            let block = `<block type="controls_whileUntil"><field name="MODE">WHILE</field>`;
            if (valueXml) block += `<value name="BOOL">${valueXml}</value>`;
            if (statementsXml) block += `<statement name="DO">${statementsXml}</statement>`;
            block += `</block>`;
            return block;
        }

        // ForLoop -> controls_for
        if (node.nodeType === 'ForLoop') {
            const init = node.children[0]; // VariableDeclaration or Assignment
            const cond = node.children[1]; // Binary <
            const update = node.children[2]; // Unary ++
            const body = node.children.slice(3);

            let varName = 'i';
            let from = '0';
            let to = '10';
            let by = '1';

            if (init.nodeType === 'VariableDeclaration') {
                varName = init.attributes.name;
                from = String(this.getLit(init.children[0]));
            } else if (init.nodeType === 'BinaryExpression' && init.attributes.operator === '=') {
                varName = (init.children[0] as any).attributes.name;
                from = String(this.getLit(init.children[1]));
            }

            if (cond.nodeType === 'BinaryExpression' && cond.children[1].nodeType === 'Literal') {
                to = String(cond.children[1].attributes.value);
                // Adjust for < vs <=
                if (cond.attributes.operator === '<') to = String(parseInt(to) - 1);
            }

            // Standard Blockly loop is inclusive TO
            const statementsXml = this.chainNodes(body);

            return `<block type="controls_for">
                <field name="VAR">${varName}</field>
                <value name="FROM"><block type="math_number"><field name="NUM">${from}</field></block></value>
                <value name="TO"><block type="math_number"><field name="NUM">${to}</field></block></value>
                <value name="BY"><block type="math_number"><field name="NUM">${by}</field></block></value>
                <statement name="DO">${statementsXml}</statement>
            </block>`;
        }

        // Print -> text_print
        if (node.nodeType === 'Print') {
            const val = this.exprToValue(node.children[0]);
            let block = `<block type="text_print">`;
            if (val) block += `<value name="TEXT">${val}</value>`;
            block += `</block>`;
            return block;
        }

        // LCD Print
        if (node.nodeType === 'LcdPrint') {
            const val = this.exprToValue(node.children[0]);
            let block = `<block type="nf_lcd_print">`;
            if (val) block += `<value name="TEXT">${val}</value>`;
            block += `</block>`;
            return block;
        }

        // CallExpressions
        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee;
            if (callee === 'servo') {
                return `<block type="nf_servo"><field name="PIN">${this.getLit(node.children[0])}</field><field name="ANGLE">${this.getLit(node.children[1])}</field></block>`;
            }
            if (callee === 'tone') {
                return `<block type="nf_tone"><field name="PIN">${this.getLit(node.children[0])}</field><field name="FREQ">${this.getLit(node.children[1])}</field><field name="DUR">${this.getLit(node.children[2]) || 500}</field></block>`;
            }
            if (callee === 'noTone') {
                return `<block type="nf_notone"><field name="PIN">${this.getLit(node.children[0])}</field></block>`;
            }
            if (callee === 'neopixel.set') {
                return `<block type="nf_neopixel_set"><field name="IDX">${this.getLit(node.children[0])}</field><field name="R">${this.getLit(node.children[1])}</field><field name="G">${this.getLit(node.children[2])}</field><field name="B">${this.getLit(node.children[3])}</field></block>`;
            }
            if (callee === 'neopixel.show') return `<block type="nf_neopixel_show"></block>`;
            if (callee === 'neopixel.clear') return `<block type="nf_neopixel_clear"></block>`;
            if (callee === 'rgb.setColor') {
                return `<block type="nf_rgb_set"><field name="R">${this.getLit(node.children[0])}</field><field name="G">${this.getLit(node.children[1])}</field><field name="B">${this.getLit(node.children[2])}</field></block>`;
            }
            if (callee === 'oled.text') {
                return `<block type="nf_oled_text"><field name="TEXT">${this.getLit(node.children[0])}</field><field name="X">${this.getLit(node.children[1])}</field><field name="Y">${this.getLit(node.children[2])}</field></block>`;
            }
            if (callee === 'oled.show') return `<block type="nf_oled_show"></block>`;
            if (callee === 'oled.clear') return `<block type="nf_oled_clear"></block>`;
        }

        return null;
    }

    private exprToValue(node: BaseNode): string | null {
        if (!node) return null;

        if (node.nodeType === 'Literal') {
            if (node.attributes.isString) {
                return `<block type="text"><field name="TEXT">${node.attributes.value}</field></block>`;
            }
            return `<block type="math_number"><field name="NUM">${node.attributes.value}</field></block>`;
        }

        if (node.nodeType === 'Identifier') {
            return `<block type="variables_get"><field name="VAR">${node.attributes.name}</field></block>`;
        }

        if (node.nodeType === 'BinaryExpression') {
            const opMap: Record<string, string> = {
                '>': 'GT', '<': 'LT', '==': 'EQ', '!=': 'NEQ', '>=': 'GTE', '<=': 'LTE',
                '+': 'ADD', '-': 'MINUS', '*': 'MULTIPLY', '/': 'DIVIDE', '%': 'MOD'
            };
            const op = opMap[node.attributes.operator];

            const left = this.exprToValue(node.children[0]);
            const right = this.exprToValue(node.children[1]);

            if (left && right) {
                if (['ADD', 'MINUS', 'MULTIPLY', 'DIVIDE', 'MOD'].includes(op)) {
                    // math_arithmetic or math_modulo
                    if (op === 'MOD') return `<block type="math_modulo"><value name="DIVIDEND">${left}</value><value name="DIVISOR">${right}</value></block>`;
                    return `<block type="math_arithmetic"><field name="OP">${op}</field><value name="A">${left}</value><value name="B">${right}</value></block>`;
                }
                return `<block type="logic_compare"><field name="OP">${op || 'EQ'}</field><value name="A">${left}</value><value name="B">${right}</value></block>`;
            }
        }

        if (node.nodeType === 'UnaryExpression') {
            const op = node.attributes.operator;
            const child = this.exprToValue(node.children[0]);
            if (child) {
                if (op === '!') return `<block type="logic_negate"><value name="BOOL">${child}</value></block>`;
                if (op === '-') return `<block type="math_single"><field name="OP">NEG</field><value name="NUM">${child}</value></block>`;
            }
        }

        if (node.nodeType === 'GpioRead' || node.nodeType === 'AnalogRead') {
            const type = node.nodeType === 'GpioRead' ? 'nf_digital_read' : 'nf_analog_read';
            const pin = this.getLit(node.children[0]);
            return `<block type="${type}"><field name="PIN">${pin}</field></block>`;
        }

        if (node.nodeType === 'CallExpression') {
            // Return value blocks
            if (node.attributes.callee === 'dht.readTemp') return `<block type="nf_dht_temp"></block>`;
            if (node.attributes.callee === 'dht.readHum') return `<block type="nf_dht_hum"></block>`;
            if (node.attributes.callee === 'ultrasonic.read') return `<block type="nf_ultrasonic_read"></block>`;
        }

        return null;
    }

    private getLit(node: BaseNode): any {
        if (!node) return 0;
        if (node.nodeType === 'Literal') return node.attributes.value;
        return 0;
    }
}
