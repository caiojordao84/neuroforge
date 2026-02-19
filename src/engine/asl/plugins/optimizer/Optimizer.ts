
import type { ProgramNode, BaseNode } from '@/system/types';

export class Optimizer {
    optimize(ast: ProgramNode): ProgramNode {
        // Deep clone to safely mutate
        const newAst = JSON.parse(JSON.stringify(ast));
        this.visit(newAst);
        return newAst;
    }

    private visit(node: BaseNode) {
        if (node.children) {
            // Optimization passes on lists of statements
            if (node.nodeType === 'Program' || node.nodeType === 'Block' || node.nodeType === 'Function') {
                node.children = this.optimizeStatements(node.children);
            }
            node.children.forEach(c => this.visit(c));
        }
    }

    private optimizeStatements(nodes: BaseNode[]): BaseNode[] {
        let optimized: BaseNode[] = [...nodes];

        // Pass 1: Replace PWM Bit-Bang
        optimized = this.replacePwmBitBang(optimized);

        // Pass 2: Merge Delays
        optimized = this.mergeDelays(optimized);

        // Pass 3: Batch GPIOs
        optimized = this.batchGpio(optimized);

        return optimized;
    }

    // Helper to unwrap ExpressionStatements
    private unwrap(node: BaseNode): BaseNode {
        if (node.nodeType === 'ExpressionStatement' && node.children.length > 0) {
            return node.children[0];
        }
        return node;
    }

    private replacePwmBitBang(nodes: BaseNode[]): BaseNode[] {
        const out: BaseNode[] = [];
        for (let i = 0; i < nodes.length; i++) {
            // Check for 4-node sequence
            if (i < nodes.length - 3) {
                const n1 = this.unwrap(nodes[i]);
                const n2 = this.unwrap(nodes[i + 1]);
                const n3 = this.unwrap(nodes[i + 2]);
                const n4 = this.unwrap(nodes[i + 3]);

                if (n1.nodeType === 'GpioSet' && n2.nodeType === 'DelayMs' &&
                    n3.nodeType === 'GpioSet' && n4.nodeType === 'DelayMs') {

                    const pin1 = (n1.children[0] as any).attributes.value;
                    const pin2 = (n3.children[0] as any).attributes.value;

                    if (pin1 === pin2) {
                        const t1 = (n2.children[0] as any).attributes.value;
                        const t2 = (n4.children[0] as any).attributes.value;

                        if (typeof t1 === 'number' && typeof t2 === 'number' && (t1 + t2) > 0) {
                            const freq = Math.round(1000 / (t1 + t2));
                            const duty = Math.round((t1 / (t1 + t2)) * 1023); // Standard Arduino-like range, or 65535 for MP

                            // Replaced with HardwarePwm
                            out.push({
                                nodeType: 'HardwarePwm',
                                id: 'opt-' + Math.random(),
                                attributes: { pin: pin1, freq, duty },
                                children: [],
                                metadata: nodes[i].metadata // Preserve original line info
                            });
                            i += 3; // Skip next 3
                            continue;
                        }
                    }
                }
            }
            out.push(nodes[i]);
        }
        return out;
    }

    private mergeDelays(nodes: BaseNode[]): BaseNode[] {
        const out: BaseNode[] = [];
        for (let i = 0; i < nodes.length; i++) {
            const curr = this.unwrap(nodes[i]);
            if (curr.nodeType === 'DelayMs' && i < nodes.length - 1) {
                const next = this.unwrap(nodes[i + 1]);
                if (next.nodeType === 'DelayMs') {
                    const v1 = (curr.children[0] as any).attributes.value;
                    const v2 = (next.children[0] as any).attributes.value;
                    if (typeof v1 === 'number' && typeof v2 === 'number') {
                        // Merge
                        const merged: BaseNode = {
                            nodeType: 'DelayMs',
                            id: curr.id,
                            attributes: {},
                            children: [{ nodeType: 'Literal', id: 'l', attributes: { value: v1 + v2 }, children: [] }],
                            metadata: nodes[i].metadata
                        };
                        // Recursively try to merge with next (by pushing and letting loop continue, but we need to modify 'i')
                        // Easier: Just replace current in list? No, push merged and skip next
                        // But we want to merge 3 delays? 
                        // Let's just do pairs for simplicity of this pass, multiple passes or while loop handles more.
                        out.push(merged);
                        i++;
                        continue;
                    }
                }
            }
            out.push(nodes[i]);
        }
        return out;
    }

    private batchGpio(nodes: BaseNode[]): BaseNode[] {
        const out: BaseNode[] = [];
        let batch: { pin: number, val: number }[] = [];
        let batchStartMeta: any = null;

        const flushBatch = () => {
            if (batch.length === 1) {
                // Don't batch single items, just push original GpioSet
                out.push({
                    nodeType: 'GpioSet',
                    id: 'opt-orig',
                    attributes: {},
                    children: [
                        { nodeType: 'Literal', id: 'p', attributes: { value: batch[0].pin }, children: [] },
                        { nodeType: 'Literal', id: 'v', attributes: { value: batch[0].val }, children: [] }
                    ],
                    metadata: batchStartMeta
                });
            } else if (batch.length > 1) {
                out.push({
                    nodeType: 'GpioBatch',
                    id: 'opt-batch-' + Math.random(),
                    attributes: { operations: [...batch] },
                    children: [],
                    metadata: batchStartMeta
                });
            }
            batch = [];
            batchStartMeta = null;
        };

        for (let i = 0; i < nodes.length; i++) {
            const n = this.unwrap(nodes[i]);
            if (n.nodeType === 'GpioSet') {
                const pin = (n.children[0] as any).attributes.value;
                const val = (n.children[1] as any).attributes.value;
                if (typeof pin === 'number' && typeof val === 'number') {
                    if (batch.length === 0) batchStartMeta = nodes[i].metadata;
                    batch.push({ pin, val });
                } else {
                    flushBatch();
                    out.push(nodes[i]);
                }
            } else {
                flushBatch();
                out.push(nodes[i]);
            }
        }
        flushBatch();
        return out;
    }
}
