
import Parser from 'web-tree-sitter';
import { ProgramNode, BaseNode, AnalysisIssue } from '../../system/types';

export class PythonParser {
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
            const Lang = await (Parser as any).Language.load('/tree-sitter-python.wasm');
            this.parser.setLanguage(Lang);
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
                errors.push({ severity: 'CRITICAL', message: `Syntax error at line ${n.startPosition.row+1}: ${n.text}` });
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
        
        const setupChildren: BaseNode[] = [];
        const loopChildren: BaseNode[] = [];

        children.forEach(c => {
            if (c.nodeType === 'WhileLoop') {
                const cond = c.children[0];
                if (cond.nodeType === 'Literal' && cond.attributes.value === 1) {
                    loopChildren.push(...c.children.slice(1));
                    return;
                }
            }
            if (c.nodeType !== 'Function') setupChildren.push(c);
        });
        
        const functions = children.filter(c => c.nodeType === 'Function');

        return { 
            nodeType: 'Program', 
            id: 'root', 
            attributes: {}, 
            children: [
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
            default: return null;
        }
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
        const expr = this.visitExpr(node.firstChild!);
        return {
            nodeType: 'ExpressionStatement', id: `stmt-${node.id}`, attributes: {}, children: [expr],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitAssignment(node: any): BaseNode {
        const left = this.visitExpr(node.childForFieldName('left')!);
        const right = this.visitExpr(node.childForFieldName('right')!);
        
        if (node.childForFieldName('left').type === 'attribute') {
             const attrNode = node.childForFieldName('left');
             const obj = attrNode.childForFieldName('object')?.text;
             const attr = attrNode.childForFieldName('attribute')?.text;
             
             if (attr === 'value') {
                 if (obj && /^p\d+$/.test(obj)) {
                     const pin = parseInt(obj.substring(1));
                     return {
                         nodeType: 'GpioSet',
                         id: `set-${node.id}`,
                         attributes: {},
                         children: [
                             { nodeType: 'Literal', id: 'l', attributes: {value: pin}, children: []},
                             right
                         ],
                         metadata: { line: node.startPosition.row + 1 }
                     };
                 }
             }
        }

        return {
            nodeType: 'ExpressionStatement', id: `assign-${node.id}`, attributes: {}, 
            children: [{
                 nodeType: 'BinaryExpression', id: `op-${node.id}`, attributes: { operator: '=' }, children: [left, right]
            }],
            metadata: { line: node.startPosition.row + 1 }
        };
    }

    visitIf(node: any): BaseNode {
        const cond = this.visitExpr(node.childForFieldName('condition')!);
        const cons = node.childForFieldName('consequence');
        const alt = node.childForFieldName('alternative'); 
        
        const thenChildren = cons ? this.visitBlockChildren(cons) : [];
        let elseChildren: BaseNode[] = [];
        if (alt) {
            const body = alt.child(1);
            if (body) elseChildren = this.visitBlockChildren(body);
        }

        return {
            nodeType: 'IfStatement', id: `if-${node.id}`, attributes: {}, 
            children: [cond, ...thenChildren, ...elseChildren],
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
             if(args && args.firstChild) {
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
                if(pendingComments.length > 0) {
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
        if (node.type === 'true') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 1 }, children: [], metadata: meta };
        if (node.type === 'false') return { nodeType: 'Literal', id: `l-${node.id}`, attributes: { value: 0 }, children: [], metadata: meta };

        if (node.type === 'binary_operator') {
            const left = this.visitExpr(node.childForFieldName('left')!);
            const right = this.visitExpr(node.childForFieldName('right')!);
            const op = node.childForFieldName('operator')?.text || '+';
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
                
                if (/^p\d+$/.test(obj) && attr === 'value' && args.length === 1) {
                    const pin = parseInt(obj.substring(1));
                    return { 
                        nodeType: 'GpioSet', 
                        id: `gpio-${node.id}`, 
                        attributes: {}, 
                        children: [{nodeType:'Literal', id:'p', attributes:{value:pin}, children:[]}, args[0]], 
                        metadata: meta 
                    };
                }
            }
            
            if (callee === 'print') return { nodeType: 'Print', id: `p-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep_ms') return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: args, metadata: meta };
            if (callee === 'time.sleep') {
                 if (args.length > 0 && args[0].nodeType === 'Literal') {
                     const secs = args[0].attributes.value;
                     return { nodeType: 'DelayMs', id: `d-${node.id}`, attributes: {}, children: [{nodeType:'Literal', id:'l', attributes:{value: secs*1000}, children:[]}], metadata: meta };
                 }
            }
            return { nodeType: 'CallExpression', id: `call-${node.id}`, attributes: { callee }, children: args, metadata: meta };
        }
        
        if (node.type === 'attribute') {
             const obj = node.childForFieldName('object')?.text;
             const attr = node.childForFieldName('attribute')?.text;
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
