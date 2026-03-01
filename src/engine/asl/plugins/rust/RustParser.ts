import { TreeSitterLoader } from '../../TreeSitterLoader';
import type { ProgramNode, BaseNode, AnalysisIssue } from '@/system/types';

export class RustParser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            this.parser = await TreeSitterLoader.createParser('rust');
            this.ready = true;
        } catch (e) {
            console.error("Failed to init tree-sitter. Make sure tree-sitter-rust.wasm is in public/", e);
        }
    }

    isReady() { return this.ready; }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (!this.ready || !this.parser) {
            return {
                ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] },
                errors: [{ severity: 'CRITICAL', message: 'Parser loading... or missing .wasm' }]
            };
        }

        const tree = this.parser.parse(code);
        const converter = new RustCstToAst();
        const ast = converter.convert(tree.rootNode);

        const errors: AnalysisIssue[] = [];
        const findErrors = (n: any) => {
            if (!n) return;
            const isMissing = typeof n.isMissing === 'function' ? n.isMissing() : !!n.isMissing;
            if (n.type === 'ERROR' || isMissing) {
                const row = n.startPosition ? n.startPosition.row + 1 : '?';
                errors.push({ severity: 'CRITICAL', message: `Syntax error at line ${row}: ${n.text || ''}` });
            }
            if (n.children && Array.isArray(n.children)) {
                n.children.forEach(findErrors);
            }
        };
        findErrors(tree.rootNode);

        return { ast, errors };
    }
}

class RustCstToAst {
    convert(node: any): ProgramNode {
        const children = this.visitBlockChildren(node);
        return { nodeType: 'Program', id: 'root', attributes: {}, children };
    }

    visit(node: any): BaseNode | null {
        switch (node.type) {
            case 'function_item': return this.visitFunction(node);
            case 'expression_statement': return this.visitExpressionStatement(node);
            case 'let_declaration': return this.visitLet(node);
            case 'block': return this.visitBlock(node);
            case 'if_expression': return this.visitIf(node);
            case 'loop_expression': return this.visitLoop(node);
            case 'while_expression': return this.visitWhile(node);
            case 'for_expression': return this.visitFor(node);
            case 'match_expression': return this.visitMatch(node);
            case 'struct_item': return this.visitStruct(node);
            case 'enum_item': return this.visitEnum(node);
            case 'break_expression': return this.visitBreak(node);
            case 'continue_expression': return this.visitContinue(node);
            case 'return_expression': return this.visitReturn(node);
            case 'call_expression':
            case 'binary_expression':
            case 'assignment_expression':
                return this.visitExpr(node);
            default:
                return null;
        }
    }

    visitFunction(node: any): BaseNode {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text || 'anon';
        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'Function',
            id: `fn-${node.id}`,
            attributes: { name },
            children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitExpressionStatement(node: any): BaseNode {
        const expr = this.visit(node.firstChild!);
        if (!expr) return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };

        return {
            nodeType: 'ExpressionStatement',
            id: `stmt-${node.id}`,
            attributes: {},
            children: [expr],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitLet(node: any): BaseNode {
        const pattern = node.childForFieldName('pattern');
        const name = pattern?.text.replace('mut ', '').trim() || 'unknown';
        const valueNode = node.childForFieldName('value');
        const value = valueNode ? this.visitExpr(valueNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };

        return {
            nodeType: 'VariableDeclaration',
            id: `decl-${node.id}`,
            attributes: { name, type: 'int' },
            children: [value as BaseNode],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBlock(node: any): BaseNode {
        return {
            nodeType: 'Block',
            id: `blk-${node.id}`,
            attributes: {},
            children: this.visitBlockChildren(node),
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBlockChildren(node: any): BaseNode[] {
        const result: BaseNode[] = [];
        let pendingComments: string[] = [];

        node.children.forEach((c: any) => {
            if (c.type === 'line_comment' || c.type === 'block_comment') {
                pendingComments.push(c.text);
                return;
            }
            if (c.type === '{' || c.type === '}') return;

            const visited = this.visit(c);
            if (visited) {
                if (pendingComments.length > 0) {
                    visited.leadingComments = [...pendingComments];
                    pendingComments = [];
                }
                result.push(visited);
            }
        });
        return result;
    }

    visitIf(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        const consequenceNode = node.childForFieldName('consequence');
        const alternativeNode = node.childForFieldName('alternative');

        const condition = conditionNode ? this.visitExpr(conditionNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] };
        const consequence = consequenceNode ? this.visitBlockChildren(consequenceNode) : [];
        const alternative = alternativeNode ?
            (alternativeNode.type === 'if_expression' ? [this.visitIf(alternativeNode)] : this.visitBlockChildren(alternativeNode))
            : [];

        return {
            nodeType: 'IfStatement',
            id: `if-${node.id}`,
            attributes: {},
            children: [condition as BaseNode, ...consequence, ...alternative as BaseNode[]],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitLoop(node: any): BaseNode {
        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];
        const trueCond: BaseNode = { nodeType: 'Literal', id: 'true', attributes: { value: 1 }, children: [] };

        return {
            nodeType: 'WhileLoop',
            id: `loop-${node.id}`,
            attributes: {},
            children: [trueCond, ...children],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitWhile(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        const bodyNode = node.childForFieldName('body');
        const condition = conditionNode ? this.visitExpr(conditionNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] };
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'WhileLoop',
            id: `while-${node.id}`,
            attributes: {},
            children: [condition as BaseNode, ...children],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFor(node: any): BaseNode {
        const pattern = node.childForFieldName('pattern')?.text || 'i';
        const iterator = node.childForFieldName('value');
        const bodyNode = node.childForFieldName('body');

        let initVal: any = 0;
        let maxVal: any = 10;
        let isInclusive = false;

        if (iterator?.type === 'range_expression') {
            const rangeOp = iterator.child(1)?.text || '..';
            isInclusive = rangeOp === '..=';
            const left = iterator.child(0);
            const right = iterator.child(2);
            if (left) initVal = isNaN(parseInt(left.text)) ? left.text : parseInt(left.text);
            if (right) maxVal = isNaN(parseInt(right.text)) ? right.text : parseInt(right.text);
        }

        const condOp = isInclusive ? '<=' : '<';

        const initLiteral: BaseNode = typeof initVal === 'number'
            ? { nodeType: 'Literal', id: 'l1', attributes: { value: initVal }, children: [] }
            : { nodeType: 'Identifier', id: 'l1', attributes: { name: initVal }, children: [] };

        const maxLiteral: BaseNode = typeof maxVal === 'number'
            ? { nodeType: 'Literal', id: 'l2', attributes: { value: maxVal }, children: [] }
            : { nodeType: 'Identifier', id: 'l2', attributes: { name: maxVal }, children: [] };

        const init: BaseNode = {
            nodeType: 'VariableDeclaration', id: 'init', attributes: { name: pattern, type: 'int' },
            children: [initLiteral]
        };
        const condition: BaseNode = {
            nodeType: 'BinaryExpression', id: 'cond', attributes: { operator: condOp },
            children: [
                { nodeType: 'Identifier', id: 'id', attributes: { name: pattern }, children: [] },
                maxLiteral
            ]
        };
        const update: BaseNode = {
            nodeType: 'UnaryExpression', id: 'upd', attributes: { operator: '++', prefix: false },
            children: [{ nodeType: 'Identifier', id: 'id', attributes: { name: pattern }, children: [] }]
        };

        const body = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'ForLoop',
            id: `for-${node.id}`,
            attributes: { hasInit: true, hasUpdate: true },
            children: [init, condition, update, ...body],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitMatch(node: any): BaseNode {
        const valueNode = node.childForFieldName('value');
        const discriminant = valueNode ? this.visitExpr(valueNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };

        const cases: BaseNode[] = [];

        node.children.forEach((c: any) => {
            if (c.type === 'match_arm') {
                const pattern = c.childForFieldName('pattern');
                const armValue = c.childForFieldName('value');

                const isDefault = pattern?.text === '_';
                const test = isDefault ? null : (pattern ? this.visitExpr(pattern) : null);

                let body: BaseNode[] = [];
                if (armValue) {
                    if (armValue.type === 'block') {
                        body = this.visitBlockChildren(armValue);
                    } else {
                        const visited = this.visit(armValue);
                        if (visited) {
                            body = [visited];
                        } else {
                            const expr = this.visitExpr(armValue);
                            body = [{
                                nodeType: 'ExpressionStatement',
                                id: `stmt-${armValue.id}`,
                                attributes: {},
                                children: [expr],
                                metadata: { line: armValue.startPosition.row + 1 }
                            }];
                        }
                    }
                }

                const caseNode: BaseNode = {
                    nodeType: 'CaseClause',
                    id: `case-${c.id}`,
                    attributes: { isDefault },
                    children: [
                        ...(test ? [test as BaseNode] : []),
                        ...body,
                        { nodeType: 'BreakStatement', id: `brk-${c.id}`, attributes: {}, children: [] } as BaseNode
                    ],
                    metadata: { line: c.startPosition.row + 1 }
                };
                cases.push(caseNode);
            }
        });

        return {
            nodeType: 'SwitchStatement',
            id: `sw-${node.id}`,
            attributes: {},
            children: [discriminant as BaseNode, ...cases],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitStruct(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'UnknownStruct';
        const fields: BaseNode[] = [];

        node.children.forEach((c: any) => {
            if (c.type === 'field_declaration') {
                const fieldName = c.childForFieldName('name')?.text || 'field';
                const fieldType = c.childForFieldName('type')?.text || 'int';
                fields.push({
                    nodeType: 'VariableDeclaration',
                    id: `field-${c.id}`,
                    attributes: { name: fieldName, type: fieldType },
                    children: [],
                    metadata: { line: c.startPosition.row + 1 }
                });
            }
        });

        return {
            nodeType: 'StructDeclaration',
            id: `struct-${node.id}`,
            attributes: { name },
            children: fields,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitEnum(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'UnknownEnum';
        const variants: BaseNode[] = [];

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
            bodyNode.children.forEach((c: any, idx: number) => {
                if (c.type === 'enum_variant') {
                    const variantName = c.childForFieldName('name')?.text || c.child(0)?.text || `variant${idx}`;
                    const discNode = c.childForFieldName('value');
                    const discVal = discNode ? this.visitExpr(discNode) : {
                        nodeType: 'Literal', id: `ev-${c.id}`, attributes: { value: idx }, children: []
                    };
                    variants.push({
                        nodeType: 'VariableDeclaration',
                        id: `variant-${c.id}`,
                        attributes: { name: variantName, type: 'enum_variant' },
                        children: [discVal as BaseNode],
                        metadata: { line: c.startPosition.row + 1 }
                    });
                }
            });
        }

        return {
            nodeType: 'EnumDeclaration',
            id: `enum-${node.id}`,
            attributes: { name },
            children: variants,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBreak(node: any): BaseNode {
        return {
            nodeType: 'BreakStatement',
            id: `brk-${node.id}`,
            attributes: {},
            children: [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitContinue(node: any): BaseNode {
        return {
            nodeType: 'ContinueStatement',
            id: `cont-${node.id}`,
            attributes: {},
            children: [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitReturn(node: any): BaseNode {
        const valueNode = node.childForFieldName('value');
        const val = valueNode ? this.visitExpr(valueNode) : null;
        return {
            nodeType: 'ReturnStatement',
            id: `ret-${node.id}`,
            attributes: {},
            children: val ? [val] : [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitExpr(node: any): BaseNode {
        const meta = { line: node.startPosition.row + 1 };

        if (node.type === 'integer_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/"/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'boolean_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text === 'true' ? 1 : 0 }, children: [], metadata: meta };
        if (node.type === 'identifier') return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };

        if (node.type === 'index_expression') {
            const target = this.visitExpr(node.child(0)!);
            const index  = this.visitExpr(node.child(2)!);
            return { nodeType: 'SubscriptExpression', id: `sub-${node.id}`, attributes: {}, children: [target, index], metadata: meta };
        }

        if (node.type === 'binary_expression') {
            const left = this.visitExpr(node.child(0)!);
            const op = node.child(1)!.text;
            const right = this.visitExpr(node.child(2)!);
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'assignment_expression') {
            const left = this.visitExpr(node.childForFieldName('left')!);
            const right = this.visitExpr(node.childForFieldName('right')!);
            return { nodeType: 'BinaryExpression', id: `assign-${node.id}`, attributes: { operator: '=' }, children: [left, right], metadata: meta };
        }

        if (node.type === 'call_expression') return this.visitCall(node);
        if (node.type === 'macro_invocation') return this.visitMacro(node);

        if (node.type === 'unary_expression') {
            const op = node.child(0)!.text;
            const arg = this.visitExpr(node.child(1)!);
            return {
                nodeType: 'UnaryExpression', id: `un-${node.id}`,
                attributes: { operator: op, prefix: true },
                children: [arg], metadata: meta
            };
        }

        if (node.type === 'reference_expression') {
            const hasMut = node.children.some((c: any) => c.type === 'mutable_specifier');
            const op = hasMut ? '&mut ' : '&';
            const inner = this.visitExpr(node.lastChild!);
            return {
                nodeType: 'UnaryExpression', id: `ref-${node.id}`,
                attributes: { operator: op, prefix: true },
                children: [inner], metadata: meta
            };
        }

        if (node.type === 'field_expression') {
            const obj = this.visitExpr(node.childForFieldName('value')!);
            const field = node.childForFieldName('field')!.text;
            return {
                nodeType: 'MemberExpression', id: `mem-${node.id}`,
                attributes: { property: field, operator: '.' },
                children: [obj], metadata: meta
            };
        }

        if (node.type === 'method_call_expression') {
            const receiver = this.visitExpr(node.childForFieldName('receiver')!);
            const method = node.childForFieldName('name')!.text;
            const argsNode = node.childForFieldName('arguments');
            const args = argsNode
                ? argsNode.children
                    .filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',')
                    .map((c: any) => this.visitExpr(c))
                : [];

            if (method === 'await') return receiver;

            if (method === 'set_high' || method === 'set_low') {
                const val: BaseNode = { nodeType: 'Literal', id: `v-${node.id}`, attributes: { value: method === 'set_high' ? 1 : 0 }, children: [] };
                return { nodeType: 'GpioSet', id: `gs-${node.id}`, attributes: {}, children: [receiver, val], metadata: meta };
            }
            if (method === 'is_high' || method === 'is_low') {
                return { nodeType: 'GpioRead', id: `gr-${node.id}`, attributes: { invert: method === 'is_low' }, children: [receiver], metadata: meta };
            }
            if (method === 'set_duty' || method === 'set_duty_cycle') {
                const pin = args[0] ?? receiver;
                const val = args[1] ?? args[0] ?? { nodeType: 'Literal', id: 'lv', attributes: { value: 0 }, children: [] };
                return { nodeType: 'AnalogWrite', id: `aw-${node.id}`, attributes: {}, children: [pin, val], metadata: meta };
            }

            // ── NEW: .elapsed().as_millis() / .as_micros() ───────────────────────────
            if (method === 'as_millis' || method === 'as_millis_u32') {
                return { nodeType: 'CallExpression', id: `ms-${node.id}`, attributes: { callee: 'millis' }, children: [], metadata: meta };
            }
            if (method === 'as_micros' || method === 'as_micros_u32') {
                return { nodeType: 'CallExpression', id: `us-${node.id}`, attributes: { callee: 'micros' }, children: [], metadata: meta };
            }

            return {
                nodeType: 'CallExpression', id: `mcall-${node.id}`,
                attributes: { callee: method },
                children: [receiver, ...args], metadata: meta
            };
        }

        if (node.type === 'type_cast_expression') {
            const inner = this.visitExpr(node.child(0)!);
            const targetType = node.child(2)?.text || 'int';
            return {
                nodeType: 'CastExpression', id: `cast-${node.id}`,
                attributes: { targetType },
                children: [inner], metadata: meta
            };
        }

        if (node.type === 'array_expression') {
            const isRepeat = node.children.some((c: any) => c.type === ';');
            if (isRepeat) {
                const valNode = node.child(0)!;
                const countNode = node.children.find((c: any, i: number) => i > 0 && c.type !== ';' && c.type !== '[' && c.type !== ']');
                const valExpr = this.visitExpr(valNode);
                const countExpr = countNode ? this.visitExpr(countNode) : { nodeType: 'Literal', id: 'lc', attributes: { value: 0 }, children: [] };
                return {
                    nodeType: 'ArrayInitializer', id: `arr-${node.id}`,
                    attributes: { repeat: true, dimensions: 1 },
                    children: [valExpr, countExpr as BaseNode], metadata: meta
                };
            }
            // Normal array — check if any element is itself an array (2D)
            const elements = node.children
                .filter((c: any) => c.type !== '[' && c.type !== ']' && c.type !== ',')
                .map((c: any) => this.visitExpr(c));
            const is2D = elements.some(e => e.nodeType === 'ArrayInitializer');
            return {
                nodeType: 'ArrayInitializer', id: `arr-${node.id}`,
                attributes: { repeat: false, dimensions: is2D ? 2 : 1 },
                children: elements, metadata: meta
            };
        }

        // ── NEW: struct_expression — Foo { x: 1, y: 2 } ─────────────────────────────
        if (node.type === 'struct_expression') {
            const structName = node.childForFieldName('name')?.text || '';
            const fields: BaseNode[] = [];
            node.children.forEach((c: any) => {
                if (c.type === 'field_initializer') {
                    const fieldName = c.childForFieldName('field')?.text || c.child(0)?.text || 'field';
                    const fieldVal = c.childForFieldName('value') ?? c.lastChild;
                    const valExpr = fieldVal ? this.visitExpr(fieldVal) : { nodeType: 'Literal', id: 'fv', attributes: { value: 0 }, children: [] };
                    fields.push({
                        nodeType: 'VariableDeclaration',
                        id: `fi-${c.id}`,
                        attributes: { name: fieldName },
                        children: [valExpr as BaseNode],
                        metadata: { line: c.startPosition.row + 1 }
                    });
                }
            });
            return {
                nodeType: 'DesignatedInitializer',
                id: `di-${node.id}`,
                attributes: { structName },
                children: fields,
                metadata: meta
            };
        }

        return { nodeType: 'Empty', id: 'empty', attributes: {}, children: [] };
    }

    visitCall(node: any): BaseNode {
        const funcNode = node.childForFieldName('function');
        const funcName = funcNode?.text || '';
        const argsNode = node.childForFieldName('arguments');
        const args = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c)) : [];

        const meta = { line: node.startPosition.row + 1 };

        if (funcName === 'gpio_set' || funcName === 'digitalWrite')
            return { nodeType: 'GpioSet', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
        if (funcName === 'gpio_get' || funcName === 'digitalRead')
            return { nodeType: 'GpioRead', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
        if (funcName === 'adc_read' || funcName === 'analogRead')
            return { nodeType: 'AnalogRead', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
        if (funcName === 'analogWrite' || funcName === 'pwm_write' || funcName === 'pwm_set_duty')
            return { nodeType: 'AnalogWrite', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
        if (funcName === 'delay' || funcName === 'delay_ms')
            return { nodeType: 'DelayMs', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };

        if (funcName === 'Timer::after_millis' || funcName.endsWith('::after_millis') || funcName.endsWith('.after_millis'))
            return { nodeType: 'DelayMs', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };

        if (funcName === 'Timer::after_secs' || funcName.endsWith('::after_secs') || funcName.endsWith('.after_secs')) {
            const secArg = args[0] || { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };
            const msArg: BaseNode = {
                nodeType: 'BinaryExpression',
                id: `ms-${node.id}`,
                attributes: { operator: '*' },
                children: [secArg, { nodeType: 'Literal', id: 'l1000', attributes: { value: 1000 }, children: [] }]
            };
            return { nodeType: 'DelayMs', id: `c-${node.id}`, attributes: {}, children: [msArg], metadata: meta };
        }

        // ── NEW: millis() / micros() ──────────────────────────────────────────
        if (funcName === 'millis' || funcName === 'get_ms')
            return { nodeType: 'CallExpression', id: `c-${node.id}`, attributes: { callee: 'millis' }, children: [], metadata: meta };
        if (funcName === 'micros' || funcName === 'get_us')
            return { nodeType: 'CallExpression', id: `c-${node.id}`, attributes: { callee: 'micros' }, children: [], metadata: meta };

        return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee: funcName }, children: args, metadata: meta };
    }

    visitMacro(node: any): BaseNode {
        const macroNode = node.childForFieldName('macro');
        const name = macroNode?.text || '';
        const tokenTree = node.childForFieldName('tokens');
        let text = tokenTree?.text || '';
        if (text.startsWith('(') && text.endsWith(')')) text = text.substring(1, text.length - 1);
        text = text.replace(/"/g, '');

        const meta = { line: node.startPosition.row + 1 };

        if (name === 'println') {
            return { nodeType: 'Print', id: `p-${node.id}`, attributes: { newline: true }, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: text, isString: true }, children: [] }], metadata: meta };
        }
        if (name === 'print') {
            return { nodeType: 'Print', id: `p-${node.id}`, attributes: { newline: false }, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: text, isString: true }, children: [] }], metadata: meta };
        }

        if (['info', 'warn', 'error', 'debug', 'trace'].includes(name)) {
            return { nodeType: 'Print', id: `p-${node.id}`, attributes: { newline: true }, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: `[${name.toUpperCase()}] ${text}`, isString: true }, children: [] }], metadata: meta };
        }

        if (['uprintln', 'rprintln', 'hprintln', 'uprint', 'rprint', 'hprint'].includes(name)) {
            const newline = name.endsWith('ln');
            return { nodeType: 'Print', id: `p-${node.id}`, attributes: { newline }, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: text, isString: true }, children: [] }], metadata: meta };
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }
}
