
import Parser from 'web-tree-sitter';
import { ProgramNode, BaseNode, AnalysisIssue } from '../../system/types';

export class ZigParser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            await (Parser as any).init({
                locateFile(scriptName: string) {
                    return `https://unpkg.com/web-tree-sitter@0.20.8/${scriptName}`;
                },
            });
            this.parser = new (Parser as any)();
            // Assumes tree-sitter-zig.wasm is available in public/
            const Lang = await (Parser as any).Language.load('/tree-sitter-zig.wasm');
            this.parser.setLanguage(Lang);
            this.ready = true;
        } catch (e) {
            console.error("Failed to init tree-sitter-zig", e);
        }
    }

    parse(code: string): { ast: ProgramNode, errors: AnalysisIssue[] } {
        if (!this.ready || !this.parser) {
            return {
                ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] },
                errors: [{ severity: 'CRITICAL', message: 'Zig Parser loading...' }]
            };
        }

        const tree = this.parser.parse(code);
        const converter = new ZigCstToAst();
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

class ZigCstToAst {
    convert(node: any): ProgramNode {
        const children = this.visitBlockChildren(node);
        // Normalize: If we find a 'main' function, we might want to extract setup/loop conceptually
        // For now, we return the structure as is.
        return { nodeType: 'Program', id: 'root', attributes: {}, children };
    }

    visit(node: any): BaseNode | null {
        switch (node.type) {
            case 'function_declaration': // In some grammars it might be different, commonly top_level_decl with fn_proto
                return this.visitFunction(node);
            case 'local_variable_declaration': return this.visitVarDecl(node);
            case 'expression_statement': return this.visitExprStmt(node);
            case 'if_expression': return this.visitIf(node);
            case 'while_expression': return this.visitWhile(node);
            case 'for_expression': return this.visitFor(node);
            case 'block': return this.visitBlock(node);
            default:
                // Handle implicit top-level declarations
                if (node.type === 'test_declaration' || node.type === 'top_level_decl') return null; // Skip for now or handle inside
                // Check if it looks like a function wrapper
                if (node.childForFieldName('prototype')) return this.visitFunction(node);
                return null;
        }
    }

    visitFunction(node: any): BaseNode {
        const proto = node.childForFieldName('prototype') || node;
        const nameNode = proto.childForFieldName ? proto.childForFieldName('name') : null; // Some grammars have name on proto
        // Fallback for simple grammar
        let name = 'anon';
        // Iterate children to find identifier if not in field
        for (let i = 0; i < proto.childCount; i++) {
            if (proto.child(i).type === 'identifier') {
                name = proto.child(i).text;
                break;
            }
        }
        if (name === 'anon' && node.text.includes('fn main')) name = 'main';

        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'Function', id: `fn-${node.id}`, attributes: { name }, children,
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitVarDecl(node: any): BaseNode {
        // const x = 10; or var x: u32 = 10;
        // structure: [const/var] [name] [: type]? = [expr];
        let name = 'unknown';
        let value: BaseNode = { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] };

        let foundEq = false;
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i);
            if (c.type === 'identifier') name = c.text;
            if (c.type === '=') foundEq = true;
            if (foundEq && c.type !== '=' && c.type !== ';') {
                value = this.visitExpr(c);
                break;
            }
        }

        return {
            nodeType: 'VariableDeclaration', id: `decl-${node.id}`, attributes: { name, type: 'auto' }, children: [value],
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
        const res: BaseNode[] = [];
        let pendingComments: string[] = [];
        node.children.forEach((c: any) => {
            if (c.type.includes('comment')) {
                pendingComments.push(c.text);
                return;
            }
            if (c.type === '{' || c.type === '}') return;

            // Try to handle statement-like expressions
            let visited = this.visit(c);
            if (!visited && (c.type === 'call_expression' || c.type === 'assignment_expression')) {
                visited = {
                    nodeType: 'ExpressionStatement', id: `stmt-${c.id}`, attributes: {},
                    children: [this.visitExpr(c)],
                    metadata: { line: c.startPosition.row + 1 }
                };
            }

            if (visited) {
                if (pendingComments.length > 0) {
                    visited.leadingComments = [...pendingComments];
                    pendingComments = [];
                }
                res.push(visited);
            }
        });
        return res;
    }

    visitExprStmt(node: any): BaseNode {
        return {
            nodeType: 'ExpressionStatement', id: `stmt-${node.id}`, attributes: {},
            children: [this.visitExpr(node.firstChild)],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitIf(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        const consNode = node.childForFieldName('consequence');
        const altNode = node.childForFieldName('alternative');

        const cond = this.visitExpr(conditionNode);
        const cons = consNode ? this.visitBlockChildren(consNode) : [];
        const alt = altNode ? this.visitBlockChildren(altNode) : [];

        return {
            nodeType: 'IfStatement', id: `if-${node.id}`, attributes: {},
            children: [cond, ...cons, ...alt],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitWhile(node: any): BaseNode {
        const conditionNode = node.childForFieldName('condition');
        const bodyNode = node.childForFieldName('body');

        const cond = this.visitExpr(conditionNode);
        // Sometimes condition is wrapped in ( )

        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'WhileLoop', id: `while-${node.id}`, attributes: {},
            children: [cond, ...children],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitFor(node: any): BaseNode {
        // Zig for loops are often for(items) |item| {}
        // Mapping to standard ForLoop is tricky, treating as While for AST simplicity or specialized node?
        // Let's map to WhileLoop with special comments for now as our AST is C-like
        const bodyNode = node.childForFieldName('body');
        const children = bodyNode ? this.visitBlockChildren(bodyNode) : [];

        return {
            nodeType: 'WhileLoop', id: `for-${node.id}`, attributes: {},
            children: [{ nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] }, ...children],
            metadata: { line: node.startPosition.row + 1 },
            leadingComments: ['// Converted Zig For-Loop']
        };
    }

    visitExpr(node: any): BaseNode {
        if (!node) return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
        const meta = { line: node.startPosition.row + 1 };

        if (node.type === 'integer_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseInt(node.text) }, children: [], metadata: meta };
        if (node.type === 'float_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: parseFloat(node.text) }, children: [], metadata: meta };
        if (node.type === 'string_literal') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: node.text.replace(/"/g, ''), isString: true }, children: [], metadata: meta };
        if (node.type === 'identifier') return { nodeType: 'Identifier', id: `i-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };
        if (node.type === 'true') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'binary_expression') {
            const left = this.visitExpr(node.child(0));
            const op = node.child(1).text;
            const right = this.visitExpr(node.child(2));
            return { nodeType: 'BinaryExpression', id: `bin-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'assignment_expression') {
            const left = this.visitExpr(node.childForFieldName('left'));
            const right = this.visitExpr(node.childForFieldName('right'));
            const op = node.childForFieldName('operator')?.text || '=';
            return { nodeType: 'BinaryExpression', id: `assign-${node.id}`, attributes: { operator: op }, children: [left, right], metadata: meta };
        }

        if (node.type === 'call_expression') {
            const func = node.childForFieldName('function');
            const argsNode = node.childForFieldName('arguments');
            // Args are usually in ( ... )
            const args = [];
            if (argsNode) {
                for (let i = 0; i < argsNode.childCount; i++) {
                    const c = argsNode.child(i);
                    if (c.type !== '(' && c.type !== ')' && c.type !== ',') {
                        args.push(this.visitExpr(c));
                    }
                }
            }

            let callee = func.text;

            // Map MicroZig calls to AST
            if (callee.includes('delay_ms')) {
                return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            }
            if (callee.includes('print')) {
                return { nodeType: 'Print', id: `p-${node.id}`, attributes: {}, children: args, metadata: meta };
            }

            // Check for method calls like led.toggle() or led.put(1)
            if (node.type === 'call_expression' && func.type === 'field_expression') {
                const obj = func.childForFieldName('operand')?.text; // 'led'
                const field = func.childForFieldName('field')?.text; // 'put'

                // Heuristic: if variable name has 'pin' or 'led', assume GPIO
                if (field === 'put' && args.length === 1) {
                    // Attempt to resolve 'led' to a pin number? Hard without symbol table.
                    // For AST, we might create a GpioSet with Identifier as the pin
                    return {
                        nodeType: 'GpioSet', id: `gs-${node.id}`, attributes: {},
                        children: [{ nodeType: 'Identifier', id: 'id', attributes: { name: obj }, children: [] }, args[0]],
                        metadata: meta
                    };
                }
            }

            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee }, children: args, metadata: meta };
        }

        if (node.type === 'field_expression') {
            // led.put -> handled in call, but if used as value?
            return { nodeType: 'Identifier', id: `fe-${node.id}`, attributes: { name: node.text }, children: [], metadata: meta };
        }

        return { nodeType: 'Empty', id: 'e', attributes: {}, children: [] };
    }
}
