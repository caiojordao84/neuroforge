import { TreeSitterLoader } from '../../TreeSitterLoader';
import type { ProgramNode, BaseNode, AnalysisIssue } from '@/system/types';

export class PythonParser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            this.parser = await TreeSitterLoader.createParser('python');
            this.ready = true;
        } catch (e) {
            console.error("Failed to init tree-sitter-python", e);
        }
    }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (!this.ready || !this.parser) {
            return {
                ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] },
                errors: [{ severity: 'CRITICAL', message: 'Python Parser loading...' }]
            };
        }

        const tree = this.parser.parse(code);
        const converter = new PythonCstToAst();
        const ast = converter.convert(tree.rootNode);

        const errors: AnalysisIssue[] = [];
        const findErrors = (n: any) => {
            if (n.type === 'ERROR' || n.isMissing()) {
                errors.push({ severity: 'CRITICAL', message: `Syntax error at line ${n.startPosition.row + 1}: ${n.text}` });
            }
            n.children.forEach(findErrors);
        };
        findErrors(tree.rootNode);

        return { ast, errors };
    }
}

class PythonCstToAst {
    convert(node: any): ProgramNode {
        const children = this.visitBlockChildren(node);

        const globals: BaseNode[] = [];
        const setupChildren: BaseNode[] = [];
        const loopChildren: BaseNode[] = [];

        children.forEach(c => {
            // Check for Main Loop pattern: while True: or while 1:
            if (c.nodeType === 'WhileLoop') {
                const cond = c.children[0];
                const isTrueLit = cond.nodeType === 'Literal' && cond.attributes.value === 1;
                const isTrueId = cond.nodeType === 'Identifier' && (cond.attributes.name === 'True' || cond.attributes.name === '1');

                if (isTrueLit || isTrueId) {
                    loopChildren.push(...c.children.slice(1));
                    return;
                }
            }

            if (c.nodeType === 'Function') {
                // Keep functions separate
            } else if (c.nodeType === 'VariableDeclaration') {
                // Global vars: keep in globals for scope, but ALSO put in setup to run initialization
                globals.push(c);
                setupChildren.push(c);
            } else {
                // Everything else (initializations, calls) goes to setup
                setupChildren.push(c);
            }
        });

        const functions = children.filter(c => c.nodeType === 'Function');

        return {
            nodeType: 'Program',
            id: 'root',
            attributes: {},
            children: [
                ...globals,
                ...functions,
                { nodeType: 'Function', id: 'setup', attributes: { name: 'setup' }, children: setupChildren },
                { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: loopChildren }
            ]
        };
    }

    visit(node: any): BaseNode | null {
        switch (node.type) {
            case 'function_definition': return this.visitFunction(node);
            case 'expression_statement': return this.visitExprStmt(node);
            case 'if_statement': return this.visitIf(node);
            case 'while_statement': return this.visitWhile(node);
            case 'for_statement': return this.visitFor(node);
            case 'assignment': return this.visitAssignment(node);
            case 'augmented_assignment': return this.visitAssignment(node);
            case 'return_statement': return this.visitReturn(node);
            case 'import_statement':
            case 'import_from_statement':
                return { nodeType: 'Empty', id: `imp-${node.id}`, attributes: {}, children: [] };
            default:
                // Return Empty node for safe filtering instead of null to avoid accidental crashes
                return { nodeType: 'Empty', id: `e-${node.id}`, attributes: {}, children: [] };
        }
    }

    visitReturn(node: any): BaseNode {
        const val = node.child(1) ? this.visitExpr(node.child(1)) : null;
        return {
            nodeType: 'ReturnStatement', id: `ret-${node.id}`, attributes: {}, children: val ? [val] : [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFunction(node: any): BaseNode {
        const name = node.childForFieldName('name')?.text || 'anon';
        const body = node.childForFieldName('body');
        const children = body ? this.visitBlockChildren(body) : [];
        return {
            nodeType: 'Function', id: `fn-${node.id}`, attributes: { name }, children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitExprStmt(node: any): BaseNode {
        const exprNode = node.namedChild(0);
        const expr = exprNode ? this.visitExpr(exprNode) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] } as BaseNode;
        return {
            nodeType: 'ExpressionStatement', id: `stmt-${node.id}`, attributes: {}, children: [expr],
            metadata: { line: node.startPosition.row + 1 }
        } as BaseNode;
    }

    visitAssignment(node: any): BaseNode {
        const leftExpr = node.childForFieldName('left');
        const rightExpr = node.childForFieldName('right');
        const operator = node.childForFieldName('operator')?.text || '=';

        const left = this.visitExpr(leftExpr!);
        const right = this.visitExpr(rightExpr!);
        const meta = { line: node.startPosition.row + 1 };

        // Handle augmented assignments: x += 1 -> x = x + 1
        if (operator !== '=') {
            const simpleOp = operator.replace('=', '');
            return {
                nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' },
                    children: [
                        left,
                        {
                            nodeType: 'BinaryExpression', id: `aug-${node.id}`, attributes: { operator: simpleOp },
                            children: [left, right]
                        } as BaseNode
                    ]
                } as BaseNode],
                metadata: meta
            } as BaseNode;
        }

        // Handle direct GPIO assignment: p2.value = 1
        if (leftExpr && leftExpr.type === 'attribute') {
            const attr = leftExpr.childForFieldName('attribute')?.text;
            if (attr === 'value') {
                return {
                    nodeType: 'ExpressionStatement', id: `set-${node.id}`, attributes: {},
                    children: [{
                        nodeType: 'CallExpression', id: `v-${node.id}`, attributes: { callee: 'Pin.value' },
                        children: [this.visitExpr(leftExpr.childForFieldName('object')), right]
                    } as BaseNode],
                    metadata: meta
                } as BaseNode;
            }
        }

        // Top-level variable definition (hoistable)
        if (left.nodeType === 'Identifier') {
            return {
                nodeType: 'VariableDeclaration', id: `decl-${node.id}`,
                attributes: { name: left.attributes.name, type: 'auto' },
                children: [right],
                metadata: meta
            } as BaseNode;
        }

        return {
            nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {},
            children: [{
                nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' }, children: [left, right]
            } as BaseNode],
            metadata: meta
        } as BaseNode;
    }

    visitIf(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const cons = node.childForFieldName('consequence');
        const alt = node.childForFieldName('alternative');

        const thenBlock: BaseNode = {
            nodeType: 'Block',
            id: `blk-${node.id}-then`,
            attributes: {},
            children: cons ? this.visitBlockChildren(cons) : [],
            metadata: { line: node.startPosition.row + 1 }
        };

        const children = [cond, thenBlock];

        if (alt) {
            // Check if it's an 'elif' (if_statement)
            const body = alt.child(1);
            if (body && body.type === 'if_statement') {
                const nestedIf = this.visitIf(body);
                if (nestedIf) children.push(nestedIf);
            } else if (body) {
                const elseBlock: BaseNode = {
                    nodeType: 'Block',
                    id: `blk-${node.id}-else`,
                    attributes: {},
                    children: this.visitBlockChildren(body),
                    metadata: { line: alt.startPosition.row + 1 }
                };
                children.push(elseBlock);
            }
        }

        return {
            nodeType: 'IfStatement', id: `if-${node.id}`, attributes: {},
            children: children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitWhile(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const body = node.childForFieldName('body');
        return {
            nodeType: 'WhileLoop', id: `while-${node.id}`, attributes: {},
            children: [cond, ...(body ? this.visitBlockChildren(body) : [])],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFor(node: any): BaseNode {
        const left = node.childForFieldName('left')?.text || 'i';
        const right = node.childForFieldName('right');
        const body = node.childForFieldName('body');

        let maxVal = 10;
        if (right?.type === 'call' && right.childForFieldName('function')?.text === 'range') {
            const args = right.childForFieldName('arguments');
            if (args && args.firstChild) {
                const arg = args.children.find((c: any) => c.type === 'integer');
                if (arg) maxVal = parseInt(arg.text);
            }
        }

        const init: BaseNode = {
            nodeType: 'VariableDeclaration', id: 'init', attributes: { name: left, type: 'int' },
            children: [{ nodeType: 'Literal', id: 'l1', attributes: { value: 0 }, children: [] }]
        };
        const condition: BaseNode = {
            nodeType: 'BinaryExpression', id: 'cond', attributes: { operator: '<' },
            children: [
                { nodeType: 'Identifier', id: 'id', attributes: { name: left }, children: [] },
                { nodeType: 'Literal', id: 'l2', attributes: { value: maxVal }, children: [] }
            ]
        };
        const update: BaseNode = {
            nodeType: 'UnaryExpression', id: 'upd', attributes: { operator: '++', prefix: false },
            children: [{ nodeType: 'Identifier', id: 'id', attributes: { name: left }, children: [] }]
        };

        return {
            nodeType: 'ForLoop', id: `for-${node.id}`, attributes: { hasInit: true, hasUpdate: true },
            children: [init, condition, update, ...(body ? this.visitBlockChildren(body) : [])],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBlockChildren(node: any): BaseNode[] {
        const result: BaseNode[] = [];
        let pendingComments: string[] = [];

        node.children.forEach((c: any) => {
            if (c.type === 'comment') {
                pendingComments.push(c.text);
                return;
            }
            if (c.type === ':' || c.type === 'block') return; // Blocks are implicit in Python structure but we might recurse

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

    visitExpr(node: any): BaseNode {
        const meta = { line: node.startPosition.row + 1 };
        if (node.type === 'integer') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/['"]/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };

        // True/False handling (Python nodes can be 'true', 'false' or identifiers True, False)
        if (node.type === 'true' || node.type === 'True' || (node.type === 'identifier' && node.text === 'True'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false' || node.type === 'False' || (node.type === 'identifier' && node.text === 'False'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };
        if (node.type === 'none' || node.type === 'None' || (node.type === 'identifier' && node.text === 'None'))
            return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'parenthesized_expression') {
            const inner = node.namedChild(0);
            return inner ? this.visitExpr(inner) : { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        }

        if (node.type === 'unary_operator' || node.type === 'not_operator') {
            const op = node.childForFieldName('operator')?.text || (node.type === 'not_operator' ? 'not' : '-');
            const arg = this.visitExpr(node.childForFieldName('argument') || node.namedChild(0));
            return {
                nodeType: 'UnaryExpression', id: `un-${node.id}`,
                attributes: { operator: op === 'not' ? '!' : op, prefix: true },
                children: [arg], metadata: meta
            };
        }

        if (node.type === 'binary_operator' || node.type === 'boolean_operator') {
            const left = this.visitExpr(node.childForFieldName('left')!);
            const right = this.visitExpr(node.childForFieldName('right')!);
            let op = node.childForFieldName('operator')?.text || 'and';
            if (op === 'and') op = '&&';
            if (op === 'or') op = '||';
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'call') {
            const func = node.childForFieldName('function');
            const argsNode = node.childForFieldName('arguments');
            const args = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c)) : [];

            let callee = func?.text || '';

            if (func?.type === 'attribute') {
                const obj = func.childForFieldName('object')?.text || '';
                const attr = func.childForFieldName('attribute')?.text || '';
                callee = `${obj}.${attr}`;

                // MicroPython Pin.value() / Pin.value(val)
                if (attr === 'value') {
                    if (args.length === 1) {
                        return { nodeType: 'CallExpression', id: `set-${node.id}`, attributes: { callee: 'Pin.value' }, children: [this.visitExpr(func.childForFieldName('object')), args[0]], metadata: meta };
                    } else if (args.length === 0) {
                        return { nodeType: 'CallExpression', id: `get-${node.id}`, attributes: { callee: 'Pin.value' }, children: [this.visitExpr(func.childForFieldName('object'))], metadata: meta };
                    }
                }
            }

            if (callee === 'print') return { nodeType: 'Print', id: `p-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep_ms' || callee === 'sleep_ms') return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep' || callee === 'sleep') {
                if (args.length > 0 && args[0].nodeType === 'Literal') {
                    const secs = args[0].attributes.value;
                    return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: secs * 1000 }, children: [] }], metadata: meta };
                }
            }
            // machine.Pin or Pin
            if (callee === 'Pin' || callee === 'machine.Pin') {
                return { nodeType: 'CallExpression', id: `pin-${node.id}`, attributes: { callee: 'Pin' }, children: args, metadata: meta };
            }

            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee }, children: args, metadata: meta };
        }

        if (node.type === 'attribute') {
            const obj = node.childForFieldName('object')?.text;
            const attr = node.childForFieldName('attribute')?.text;

            // MicroPython Pin constants
            if (obj === 'Pin' || obj === 'machine.Pin') {
                if (attr === 'IN') return { nodeType: 'Literal', id: 'in', attributes: { value: 0 }, children: [], metadata: meta };
                if (attr === 'OUT') return { nodeType: 'Literal', id: 'out', attributes: { value: 1 }, children: [], metadata: meta };
                if (attr === 'PULL_UP') return { nodeType: 'Literal', id: 'pullup', attributes: { value: 2 }, children: [], metadata: meta };
            }

            if (obj === 'board' && attr) {
                const match = attr.match(/\d+/);
                if (match) {
                    return { nodeType: 'Literal', id: `pin-${node.id}`, attributes: { value: parseInt(match[0]) }, children: [], metadata: meta };
                }
            }
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }
}
