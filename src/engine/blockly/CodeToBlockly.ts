import type { ProgramNode, BaseNode } from '@/system/types';
export class CodeToBlockly {
    generate(ast: ProgramNode): string {
        let xml = '<xml xmlns="https://developers.google.com/blockly/xml">';

        // Process all children. If it's a function named 'setup' or 'loop', process its body.
        // Otherwise, process the node itself.
        const nodesToProcess: BaseNode[] = [];
        let loopBody: BaseNode[] | null = null;

        ast.children.forEach(child => {
            if (child.nodeType === 'Function') {
                if (child.attributes.name === 'setup') {
                    nodesToProcess.push(...child.children);
                } else if (child.attributes.name === 'loop') {
                    loopBody = child.children;
                }
            } else {
                nodesToProcess.push(child);
            }
        });

        if (nodesToProcess.length > 0) {
            xml += this.processStatementList(nodesToProcess);
        }

        if (loopBody && loopBody.length > 0) {
            const loopStatements = this.processStatementList(loopBody);
            const loopXml = `<block type="nf_loop"><statement name="DO">${loopStatements}</statement></block>`;

            // Append the loop block. If there were other blocks, find insertion point or just append.
            // Usually we want it chained or as a top level. Chaining it to the last block of nodesToProcess:
            if (nodesToProcess.length > 0) {
                // Find the insertion point in the existing XML
                const lastIdx = xml.lastIndexOf('</block>');
                if (lastIdx !== -1) {
                    xml = xml.substring(0, lastIdx) + `<next>${loopXml}</next>` + xml.substring(lastIdx);
                } else {
                    xml += loopXml;
                }
            } else {
                xml += loopXml;
            }
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
                // Find the insertion point for <next>
                // We must avoid putting <next> inside a <value> or <statement> tag of the current block.
                // The correct place for <next> is right before the FINAL </block> of the TOP-LEVEL block.
                const lastIdx = block.lastIndexOf('</block>');
                if (lastIdx !== -1) {
                    block = block.substring(0, lastIdx) + `<next>${nextXml}</next>` + block.substring(lastIdx);
                }
            }
        }
        return block;
    }

    private getLit(node: BaseNode): any {
        if (!node) return 0;
        if (node.nodeType === 'SubscriptExpression') {
            // simplified for dropdowns
            return this.getLit(node.children[0]) + '[' + this.getLit(node.children[1]) + ']';
        }
        if (node.nodeType === 'Literal') return node.attributes.value;
        if (node.nodeType === 'Identifier') return node.attributes.name;
        if (node.nodeType === 'MemberExpression') return (node.attributes.object || this.getLit(node.children[0])) + '.' + node.attributes.property;
        return 0;
    }

    private nodeToBlock(node: BaseNode): string | null {
        // GpioSet -> nf_gpio_set
        if (node.nodeType === 'GpioSet') {
            const pin = this.getPinVal(node.children[0]);
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
            const thenNode = node.children[1];
            const elseNode = node.children[2];

            const valueXml = this.exprToValue(cond);
            const statementsXml = thenNode ? (thenNode.nodeType === 'Block' ? this.chainNodes(thenNode.children) : this.nodeToBlock(thenNode)) : '';

            let block = `<block type="controls_if">`;
            if (valueXml) block += `<value name="IF0">${valueXml}</value>`;
            if (statementsXml) block += `<statement name="DO0">${statementsXml}</statement>`;

            if (elseNode) {
                // Simplified else: Doesn't handle else-if mutation fully yet, but prevents merging
                block = block.substring(0, block.length - 8); // remove </block>
                block += `<mutation else="1"></mutation>`;
                const elseXml = elseNode.nodeType === 'Block' ? this.chainNodes(elseNode.children) : this.nodeToBlock(elseNode);
                if (elseXml) block += `<statement name="ELSE">${elseXml}</statement>`;
                block += `</block>`;
            }
            return block;
        }

        // WhileLoop -> controls_whileUntil (or nf_loop if infinite)
        if (node.nodeType === 'WhileLoop') {
            const cond = node.children[0];
            const body = node.children.slice(1);
            const isInfinite = node.attributes.isInfinite || (cond.nodeType === 'Literal' && (cond.attributes.value === 1 || cond.attributes.value === true));

            if (isInfinite) {
                const statementsXml = this.chainNodes(body);
                let block = `<block type="nf_loop">`;
                if (statementsXml) block += `<statement name="DO">${statementsXml}</statement>`;
                block += `</block>`;
                return block;
            }

            // Use conditionToValue for boolean context (handles while True: -> logic_boolean TRUE)
            const valueXml = this.conditionToValue(cond);
            const statementsXml = this.chainNodes(body);

            let block = `<block type="controls_whileUntil"><field name="MODE">WHILE</field>`;
            if (valueXml) block += `<value name="BOOL">${valueXml}</value>`;
            if (statementsXml) block += `<statement name="DO">${statementsXml}</statement>`;
            block += `</block>`;
            return block;
        }

        // ForLoop -> controls_for
        if (node.nodeType === 'ForLoop') {
            const init = node.children[0];
            const cond = node.children[1];
            const update = node.children[2];
            const body = node.children.slice(3);

            let varName = 'i';
            let fromXml = '<block type="math_number"><field name="NUM">0</field></block>';
            let toXml = '<block type="math_number"><field name="NUM">10</field></block>';
            let byXml = '<block type="math_number"><field name="NUM">1</field></block>';

            if (init && (init.nodeType === 'VariableDeclaration' || (init.nodeType === 'BinaryExpression' && init.attributes.operator === '='))) {
                if (init.nodeType === 'VariableDeclaration') {
                    varName = init.attributes.name;
                    fromXml = this.exprToValue(init.children[0]) || fromXml;
                } else {
                    varName = (init.children[0] as any).attributes.name || 'i';
                    fromXml = this.exprToValue(init.children[1]) || fromXml;
                }
            }

            if (cond && cond.nodeType === 'BinaryExpression') {
                toXml = this.exprToValue(cond.children[1]) || toXml;
                // If it's < N, blocks usually expect N-1 or we just use N and let it be.
                // Blockly's controls_for is inclusive.
            }

            const statementsXml = this.chainNodes(body);

            return `<block type="controls_for">
                <field name="VAR">${varName}</field>
                <value name="FROM">${fromXml}</value>
                <value name="TO">${toXml}</value>
                <value name="BY">${byXml}</value>
                <statement name="DO">${statementsXml}</statement>
            </block>`;
        }

        // ForIn -> controls_forEach
        if (node.nodeType === 'ForIn') {
            const varName = node.attributes.varName;
            let iterableNode = node.children[0];
            let listXml: string | null = null;

            // Heuristic: if iterable is reversed(x), use lists_reverse block
            if (iterableNode.nodeType === 'CallExpression' && iterableNode.attributes.callee === 'reversed') {
                const inner = this.exprToValue(iterableNode.children[0]);
                listXml = `<block type="lists_reverse"><value name="LIST">${inner}</value></block>`;
            } else {
                listXml = this.exprToValue(iterableNode);
            }

            const body = node.children.slice(1);
            const statementsXml = this.chainNodes(body);

            let block = `<block type="controls_forEach">
                <field name="VAR">${varName}</field>`;
            if (listXml) block += `<value name="LIST">${listXml}</value>`;
            if (statementsXml) block += `<statement name="DO">${statementsXml}</statement>`;
            block += `</block>`;
            return block;
        }

        if (node.nodeType === 'ArrayInitializer') {
            const itemsXml = node.children.map((child, i) => `<value name="ADD${i}">${this.exprToValue(child)}</value>`).join('');
            return `<block type="lists_create_with">
                <mutation items="${node.children.length}"></mutation>
                ${itemsXml}
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
            // Support Pin().value() style or digitalWrite desugared
            if (callee === 'digitalWrite' || callee === 'Pin.value') {
                const pin = this.getPinVal(node.children[0]);
                const val = this.getLit(node.children[1]) == 1 ? 'HIGH' : 'LOW';
                return `<block type="nf_gpio_set"><field name="PIN">${pin}</field><field name="VALUE">${val}</field></block>`;
            }

            if (callee === 'servo') {
                const pin = this.getPinVal(node.children[0]);
                const angle = this.getLit(node.children[1]);
                return `<block type="nf_servo"><field name="PIN">${pin}</field><field name="ANGLE">${angle}</field></block>`;
            }
            if (callee === 'tone') {
                const pin = this.getPinVal(node.children[0]);
                const freq = this.getLit(node.children[1]);
                const dur = this.getLit(node.children[2]) || 500;
                return `<block type="nf_tone"><field name="PIN">${pin}</field><field name="FREQ">${freq}</field><field name="DUR">${dur}</field></block>`;
            }
            if (callee === 'noTone') {
                const pin = this.getPinVal(node.children[0]);
                return `<block type="nf_notone"><field name="PIN">${pin}</field></block>`;
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

        if (node.nodeType === 'Block') {
            return this.chainNodes(node.children);
        }

        return null;
    }

    private getPinVal(node: BaseNode): string {
        if (!node) return '0';
        // Handle Pin(13) or led (Identifier)
        if (node.nodeType === 'CallExpression' && node.attributes.callee === 'Pin') {
            return String(this.getLit(node.children[0]));
        }
        return String(this.getLit(node));
    }

    private conditionToValue(node: BaseNode): string | null {
        if (!node) return null;
        // In boolean context, map truthy/falsy literals to logic_boolean blocks
        if (node.nodeType === 'Literal') {
            if (node.attributes.value === 1 || node.attributes.value === true) {
                return `<block type="logic_boolean"><field name="BOOL">TRUE</field></block>`;
            }
            if (node.attributes.value === 0 || node.attributes.value === false) {
                return `<block type="logic_boolean"><field name="BOOL">FALSE</field></block>`;
            }
        }
        // For everything else (comparisons, identifiers, etc.), delegate to exprToValue
        return this.exprToValue(node);
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

        if (node.nodeType === 'SubscriptExpression') {
            const list = this.exprToValue(node.children[0]);
            const index = this.exprToValue(node.children[1]);
            if (list && index) {
                return `<block type="lists_getIndex">
                    <mutation statement="false" at="true"></mutation>
                    <field name="MODE">GET</field>
                    <field name="WHERE">FROM_START</field>
                    <value name="VALUE">${list}</value>
                    <value name="AT">${index}</value>
                </block>`;
            }
        }

        if (node.nodeType === 'MemberExpression') {
            const obj = node.attributes.object || this.getLit(node.children[0]);
            const prop = node.attributes.property;
            return `<block type="variables_get"><field name="VAR">${obj}.${prop}</field></block>`;
        }

        if (node.nodeType === 'ArrayInitializer') {
            const itemsXml = node.children.map((child, i) => {
                const val = this.exprToValue(child);
                return `<value name="ADD${i}">${val || ''}</value>`;
            }).join('');
            return `<block type="lists_create_with">
                <mutation items="${node.children.length}"></mutation>
                ${itemsXml}
            </block>`;
        }

        if (node.nodeType === 'GpioRead' || node.nodeType === 'AnalogRead') {
            const type = node.nodeType === 'GpioRead' ? 'nf_digital_read' : 'nf_analog_read';
            const pin = this.getPinVal(node.children[0]);
            return `<block type="${type}"><field name="PIN">${pin}</field></block>`;
        }

        if (node.nodeType === 'CallExpression') {
            const callee = node.attributes.callee;
            if (callee === 'Pin' || callee === 'machine.Pin') {
                return this.exprToValue(node.children[0]);
            }
            if (callee === 'len') {
                return `<block type="lists_length"><value name="VALUE">${this.exprToValue(node.children[0])}</value></block>`;
            }
            if (callee === 'reversed') {
                return `<block type="lists_reverse"><value name="LIST">${this.exprToValue(node.children[0])}</value></block>`;
            }
            if (callee === 'dht.readTemp') return `<block type="nf_dht_temp"></block>`;
            if (callee === 'dht.readHum') return `<block type="nf_dht_hum"></block>`;
            if (callee === 'ultrasonic.read') return `<block type="nf_ultrasonic_read"></block>`;
            if (callee === 'ldr.read') return `<block type="nf_ldr_read"></block>`;
            if (callee === 'keypad.read') return `<block type="nf_keypad_read"></block>`;
        }

        return null;
    }

}
