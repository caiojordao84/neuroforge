import type { BaseNode } from '@/system/types';

let tempCounter = 0;

function getNextTempName(): string {
    return `__tmp_${tempCounter++}`;
}

export function resetPostfixTempCounter(): void {
    tempCounter = 0;
}

/**
 * Traverses an expression and extracts postfix ++/-- side-effects.
 * Returns the transformed expression and a list of side-effect statements as BaseNodes.
 */
export function extractPostfix(node: BaseNode, sideEffects: BaseNode[] = []): BaseNode {
    if (!node) return node;

    // Handle Postfix ++/--
    if (
        node.nodeType === 'UnaryExpression' &&
        (node.attributes.operator === '++' || node.attributes.operator === '--') &&
        node.attributes.prefix === false
    ) {
        const operand = node.children[0];
        if (operand?.nodeType === 'Identifier') {
            const varName = operand.attributes.name;
            const tempName = getNextTempName();
            const line = node.metadata?.line;

            // 1. Store original value: temp = i
            sideEffects.push({
                nodeType: 'BinaryExpression',
                id: `pf_store_${tempName}`,
                attributes: { operator: '=' },
                children: [
                    { nodeType: 'Identifier', id: `pf_tid_${tempName}`, attributes: { name: tempName }, children: [] },
                    { nodeType: 'Identifier', id: `pf_oid_${tempName}`, attributes: { name: varName }, children: [] },
                ],
                metadata: { line },
            } as BaseNode);

            // 2. Increment/Decrement: i = i + 1
            const op = node.attributes.operator === '++' ? '+' : '-';
            sideEffects.push({
                nodeType: 'BinaryExpression',
                id: `pf_inc_${tempName}`,
                attributes: { operator: '=' },
                children: [
                    { nodeType: 'Identifier', id: `pf_vid_${tempName}`, attributes: { name: varName }, children: [] },
                    {
                        nodeType: 'BinaryExpression',
                        id: `pf_bin_${tempName}`,
                        attributes: { operator: op },
                        children: [
                            { nodeType: 'Identifier', id: `pf_vread_${tempName}`, attributes: { name: varName }, children: [] },
                            { nodeType: 'Literal', id: `pf_lit_${tempName}`, attributes: { value: 1 }, children: [] },
                        ],
                    },
                ],
                metadata: { line },
            } as BaseNode);

            // 3. Return the temp variable to be used in the expression
            return {
                nodeType: 'Identifier',
                id: `pf_use_${tempName}`,
                attributes: { name: tempName },
                children: [],
                metadata: { line },
            } as BaseNode;
        }
    }

    // Recurse into children
    if (node.children && node.children.length > 0) {
        return {
            ...node,
            children: node.children.map(child => extractPostfix(child, sideEffects)),
        };
    }

    return node;
}
