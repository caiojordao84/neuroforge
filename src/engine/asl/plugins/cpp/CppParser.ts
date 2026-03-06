import { TreeSitterLoader } from '../../TreeSitterLoader';
import type { ProgramNode, BaseNode, AnalysisIssue } from '@/system/types';

export class CppParser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            this.parser = await TreeSitterLoader.createParser('cpp');
            this.ready = true;
        } catch (e) {
            console.error("Failed to init tree-sitter-cpp", e);
        }
    }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (!this.ready || !this.parser) {
            return {
                ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] },
                errors: [{ severity: 'CRITICAL', message: 'C++ Parser loading...' }]
            };
        }

        const tree = this.parser.parse(code);
        const converter = new CppCstToAst();
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

class CppCstToAst {
    convert(node: any): ProgramNode {
        const children = this.visitBlockChildren(node);
        return { nodeType: 'Program', id: 'root', attributes: {}, children };
    }

    visit(node: any): BaseNode | null {
        switch (node.type) {
            case 'function_definition': return this.visitFunction(node);
            case 'declaration': return this.visitDeclaration(node);
            case 'if_statement': return this.visitIf(node);
            case 'while_statement': return this.visitWhile(node);
            case 'for_statement': return this.visitFor(node);
            case 'return_statement': return this.visitReturn(node);
            case 'break_statement': return { nodeType: 'BreakStatement', id: `br-${node.id}`, attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
            case 'continue_statement': return { nodeType: 'ContinueStatement', id: `cnt-${node.id}`, attributes: {}, children: [], metadata: { line: node.startPosition.row + 1 } };
            case 'expression_statement': return this.visitExpressionStatement(node);
            case 'compound_statement': return this.visitBlock(node);
            default: return null;
        }
    }

    visitFunction(node: any): BaseNode {
        const declarator = node.childForFieldName('declarator');
        let name = 'anon';
        const params: any[] = [];

        if (declarator) {
            const idNode = declarator.child(0);
            name = idNode?.text || 'anon';

            const paramList = declarator.child(1);
            if (paramList && paramList.type === 'parameter_list') {
                for (let i = 0; i < paramList.childCount; i++) {
                    const p = paramList.child(i);
                    if (p.type === 'parameter_declaration') {
                        const pType = p.childForFieldName('type')?.text || 'int';
                        const pName = p.childForFieldName('declarator')?.text || 'arg' + i;
                        params.push({ name: pName, type: pType });
                    }
                }
            }
        }

        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'Function',
            id: `fn-${node.id}`,
            attributes: { name, params },
            children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitDeclaration(node: any): BaseNode | null {
        const typeNode = node.childForFieldName('type');
        const type = typeNode?.text || 'int';

        for (const child of node.children) {
            if (child.type === 'init_declarator') {
                let nameNode = child.childForFieldName('declarator');

                // Unpack array/pointer wrappers to get name
                while (nameNode && (nameNode.type === 'array_declarator' || nameNode.type === 'pointer_declarator')) {
                    nameNode = nameNode.childForFieldName('declarator');
                }

                const name = nameNode?.text || 'unknown';
                const valNode = child.childForFieldName('value');
                const value = valNode ? this.visitExpr(valNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };

                return {
                    nodeType: 'VariableDeclaration',
                    id: `decl-${child.id}`,
                    attributes: { name, type },
                    children: [value as BaseNode],
                    metadata: { line: node.startPosition.row + 1 }
                };
            }
        }
        return null;
    }

    visitIf(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        let condExpr = conditionNode?.child(1);
        if (!condExpr || condExpr.type === ')') condExpr = conditionNode?.firstChild || null;

        const condition = condExpr ? this.visitExpr(condExpr) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] };

        const consequenceNode = node.childForFieldName('consequence');
        const consequence = consequenceNode ? (consequenceNode.type === 'compound_statement' ? this.visitBlockChildren(consequenceNode) : [this.visit(consequenceNode)].filter(Boolean) as BaseNode[]) : [];

        const alternativeNode = node.childForFieldName('alternative');
        let alternative: BaseNode[] = [];
        if (alternativeNode) {
            alternative = alternativeNode.type === 'compound_statement' ? this.visitBlockChildren(alternativeNode) : [this.visit(alternativeNode)].filter(Boolean) as BaseNode[];
        }

        return {
            nodeType: 'IfStatement',
            id: `if-${node.id}`,
            attributes: {},
            children: [condition as BaseNode, ...consequence, ...alternative],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitWhile(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        let condExpr = conditionNode?.child(1);
        const condition = condExpr ? this.visitExpr(condExpr) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] };

        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? (bodyNode.type === 'compound_statement' ? this.visitBlockChildren(bodyNode) : [this.visit(bodyNode)].filter(Boolean) as BaseNode[]) : [];

        return {
            nodeType: 'WhileLoop',
            id: `while-${node.id}`,
            attributes: {},
            children: [condition as BaseNode, ...children],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFor(node: any): BaseNode {
        const initNode = node.childForFieldName('initializer');
        const condNode = node.childForFieldName('condition');
        const updateNode = node.childForFieldName('update');
        const bodyNode = node.childForFieldName('body');

        const init = initNode ? (initNode.type === 'declaration' ? this.visitDeclaration(initNode) : this.visitExpr(initNode)) : null;
        const cond = condNode ? this.visitExpr(condNode) : { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] };
        const update = updateNode ? this.visitExpr(updateNode) : null;

        const children = bodyNode ? (bodyNode.type === 'compound_statement' ? this.visitBlockChildren(bodyNode) : [this.visit(bodyNode)].filter(Boolean) as BaseNode[]) : [];

        return {
            nodeType: 'ForLoop',
            id: `for-${node.id}`,
            attributes: { hasInit: !!init, hasUpdate: !!update },
            children: [...(init ? [init] : []), cond as BaseNode, ...(update ? [update as BaseNode] : []), ...children],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitReturn(node: any): BaseNode {
        let value: BaseNode | undefined;
        if (node.childCount > 2) {
            value = this.visitExpr(node.child(1));
        }
        return {
            nodeType: 'ReturnStatement',
            id: `ret-${node.id}`,
            attributes: {},
            children: value ? [value] : [],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitBlock(node: any): BaseNode {
        return {
            nodeType: 'Block', id: `blk-${node.id}`, attributes: {},
            children: this.visitBlockChildren(node)
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

    visitExpressionStatement(node: any): BaseNode {
        const expr = this.visitExpr(node.firstChild!);
        return {
            nodeType: 'ExpressionStatement',
            id: `stmt-${node.id}`,
            attributes: {},
            children: [expr],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitExpr(node: any): BaseNode {
        if (!node) return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        const meta = { line: node.startPosition.row + 1 };

        if (node.type === 'number_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/"/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };
        if (node.type === 'true') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'binary_expression') {
            const left = this.visitExpr(node.child(0)!);
            const op = node.child(1)!.text;
            const right = this.visitExpr(node.child(2)!);
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'assignment_expression') {
            const left = this.visitExpr(node.childForFieldName('left')!);
            const right = this.visitExpr(node.childForFieldName('right')!);
            const op = node.childForFieldName('operator')?.text || '=';
            return { nodeType: 'BinaryExpression', id: `assign-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'update_expression') {
            const op = node.child(0)!.type.match(/[+-]+/) ? node.child(0)!.text : node.child(1)!.text;
            const arg = node.child(0)!.type.match(/[+-]+/) ? node.child(1)! : node.child(0)!;
            const prefix = node.child(0)!.type.match(/[+-]+/) ? true : false;
            return { nodeType: 'UnaryExpression', id: `un-${node.id}`, attributes: { operator: op, prefix }, children: [this.visitExpr(arg)], metadata: meta };
        }

        if (node.type === 'call_expression') {
            const func = node.childForFieldName('function');
            const argsNode = node.childForFieldName('arguments');
            const args = argsNode ? argsNode.children.filter((c: any) => c.type !== '(' && c.type !== ')' && c.type !== ',').map((c: any) => this.visitExpr(c)) : [];

            let calleeName = func?.text || '';
            if (func?.type === 'field_expression') {
                const obj = func.childForFieldName('argument')?.text;
                const field = func.childForFieldName('field')?.text;
                calleeName = `${obj}.${field}`;
            }

            if (calleeName === 'digitalWrite' || calleeName === 'gpio_set') return { nodeType: 'GpioSet', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (calleeName === 'delay') return { nodeType: 'DelayMs', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (calleeName.startsWith('Serial.print')) return { nodeType: 'Print', id: `c-${node.id}`, attributes: {}, children: args, metadata: meta };

            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee: calleeName }, children: args, metadata: meta };
        }

        if (node.type === 'sizeof_expression') {
            const value = node.child(1);
            return { nodeType: 'CallExpression', id: `so-${node.id}`, attributes: { callee: 'sizeof' }, children: [this.visitExpr(value)], metadata: meta };
        }

        if (node.type === 'parenthesized_expression') return this.visitExpr(node.firstNamedChild!);

        // Array Handling
        if (node.type === 'subscript_expression') {
            const argument = node.childForFieldName('argument');
            const index = node.childForFieldName('index');
            return {
                nodeType: 'SubscriptExpression',
                id: `sub-${node.id}`,
                attributes: {},
                children: [this.visitExpr(argument!), this.visitExpr(index!)],
                metadata: meta
            };
        }
        if (node.type === 'initializer_list') {
            const elements: BaseNode[] = [];
            for (let i = 0; i < node.childCount; i++) {
                const c = node.child(i);
                if (c.type !== '{' && c.type !== '}' && c.type !== ',') {
                    elements.push(this.visitExpr(c));
                }
            }
            return { nodeType: 'ArrayInitializer', id: `init-${node.id}`, attributes: {}, children: elements, metadata: meta };
        }

        // Struct member access
        if (node.type === 'field_expression') {
            const obj = this.visitExpr(node.childForFieldName('argument'));
            const field = node.childForFieldName('field')?.text;
            return {
                nodeType: 'MemberExpression',
                id: `mem-${node.id}`,
                attributes: { property: field },
                children: [obj],
                metadata: meta
            };
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }
}
