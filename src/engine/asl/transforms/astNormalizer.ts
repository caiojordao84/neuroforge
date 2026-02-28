import type { ProgramNode, BaseNode } from '@/system/types';

/**
 * AST Normalizer for Transpilation.
 * 
 * Purpose:
 * 1. Unwrap hardware nodes (GpioSet, DelayMs, etc.) from ExpressionStatement.
 * 2. Standardize pinMode and other common calls.
 * 3. Ensure consistent node structure for all generators.
 */

export function normalizeAST(ast: ProgramNode): ProgramNode {
    let normalizedChildren = ast.children
        .map(node => normalizeNode(node))
        .filter(node => node.nodeType !== 'Empty');

    // Standardize top-level structure into setup/loop functions
    normalizedChildren = standardizeTopLevelStructure(normalizedChildren);

    return {
        ...ast,
        children: normalizedChildren
    };
}

function standardizeTopLevelStructure(nodes: BaseNode[]): BaseNode[] {
    // If the AST already has setup/loop functions, leave it alone.
    if (nodes.some(n => n.nodeType === 'Function' && (n.attributes.name === 'setup' || n.attributes.name === 'loop'))) {
        return nodes;
    }

    const setupNodes: BaseNode[] = [];
    const loopNodes: BaseNode[] = [];
    let foundLoop = false;

    // Check if the script is entirely enclosed in a function (e.g., main)
    if (nodes.length === 1 && nodes[0].nodeType === 'Function' && nodes[0].attributes.name === 'main') {
        return standardizeTopLevelStructure(nodes[0].children);
    }

    for (const node of nodes) {
        if (node.nodeType === 'WhileLoop') {
            const cond = node.children[0];
            const isTrue = cond && (
                (cond.nodeType === 'Literal' && (cond.attributes.value === true || cond.attributes.value === 1 || cond.attributes.value === '1' || cond.attributes.value === 'true')) ||
                (cond.nodeType === 'Identifier' && (cond.attributes.name === 'True' || cond.attributes.name === 'true'))
            );
            if (isTrue && !foundLoop) {
                // The true WhileLoop becomes the loop() body
                loopNodes.push(...node.children.slice(1));
                foundLoop = true;
                continue;
            }
        }

        if (!foundLoop) {
            setupNodes.push(node);
        } else {
            // Unlikely to have nodes after infinite loop, but preserve them in setup for now
            setupNodes.push(node);
        }
    }

    if (!foundLoop && setupNodes.length > 0) {
        // If no explicit while true, assume everything is setup (run once). 
        // This is safe. If the user had a loop, it would have been found.
        return [
            { nodeType: 'Function', id: 'gen-setup', attributes: { name: 'setup' }, children: setupNodes },
            { nodeType: 'Function', id: 'gen-loop', attributes: { name: 'loop' }, children: [] }
        ];
    } else if (foundLoop) {
        return [
            { nodeType: 'Function', id: 'gen-setup', attributes: { name: 'setup' }, children: setupNodes },
            { nodeType: 'Function', id: 'gen-loop', attributes: { name: 'loop' }, children: loopNodes }
        ];
    }

    return nodes;
}

function normalizeNode(node: BaseNode): BaseNode {
    if (!node) return node;

    // 1. Recursive normalization of children
    if (node.children && node.children.length > 0) {
        node.children = node.children
            .map(c => normalizeNode(c))
            .filter(c => c.nodeType !== 'Empty');
    }

    // 2. Unwrap ExpressionStatement if it contains a hardware node
    if (node.nodeType === 'ExpressionStatement' && node.children.length === 1) {
        const child = node.children[0];
        const hardwareNodes = [
            'GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite',
            'DelayMs', 'Print', 'HardwarePwm', 'LcdClear',
            'LcdCursor', 'LcdPrint', 'OledText', 'OledShow', 'OledClear'
        ];

        if (hardwareNodes.includes(child.nodeType)) {
            // Transfer metadata and comments from wrapper to child
            return {
                ...child,
                leadingComments: [...(node.leadingComments || []), ...(child.leadingComments || [])],
                metadata: { ...node.metadata, ...child.metadata }
            };
        }

        // 2b. Special case: if it's an ExpressionStatement wrapping a Pin call, convert to pinMode
        if (child.nodeType === 'CallExpression' && child.attributes.callee === 'Pin') {
            return {
                nodeType: 'CallExpression',
                id: `pinmode-${node.id}`,
                attributes: { callee: 'pinMode' },
                children: child.children, // [pin, mode]
                leadingComments: node.leadingComments,
                metadata: node.metadata
            };
        }
    }

    // 3. Simplify Pin(13, mode) inside hardware calls
    // e.g., GpioSet(Pin(13, 1), 1) -> GpioSet(13, 1)
    const hardwareNodesRequiringPinSimplification = ['GpioSet', 'GpioRead', 'AnalogRead', 'AnalogWrite'];
    if (hardwareNodesRequiringPinSimplification.includes(node.nodeType)) {
        node.children = node.children.map(child => {
            if (child.nodeType === 'CallExpression' && child.attributes.callee === 'Pin' && child.children.length > 0) {
                // Return just the pin argument (the first child of the Pin call)
                return child.children[0];
            }
            return child;
        });
    }

    // 4. Map specific CallExpressions to more descriptive nodes if possible
    if (node.nodeType === 'CallExpression') {
        const callee = node.attributes.callee;
        if (callee === 'pinMode') {
            // Can add more logic here if needed
        }
    }

    return node;
}
