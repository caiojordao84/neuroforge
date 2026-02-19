
import type { Node, Edge } from '@xyflow/react';

export interface CfgOutbound {
    target: CfgBlock;
    label?: string; // e.g., "True", "False"
}

export class CfgBlock {
    id: string;
    type: string;
    data: any;
    outbound: CfgOutbound[] = [];
    predecessors: CfgBlock[] = [];

    // Analysis flags
    reachable: boolean = false;
    visited: boolean = false;       // For DFS
    recursionStack: boolean = false; // For cycle detection

    constructor(node: Node) {
        this.id = node.id;
        this.type = node.type || 'default';
        this.data = node.data;
    }
}

export interface CfgPattern {
    type: 'WHILE_LOOP' | 'FOR_LOOP' | 'DO_WHILE' | 'SWITCH' | 'INFINITE_LOOP';
    headerId: string;
    description: string;
}

export interface CfgAnalysisResult {
    deadNodes: CfgBlock[];
    loops: { source: CfgBlock, target: CfgBlock, type: 'SELF' | 'COMPLEX' }[];
    patterns: CfgPattern[];
    branchIssues: { node: CfgBlock, issue: string, severity: 'WARNING' | 'CRITICAL' }[];
    missingStart: boolean;
    missingEnd: boolean;
    terminates: boolean;
}

export class CfgBuilder {
    blocks: Map<string, CfgBlock> = new Map();
    startBlock: CfgBlock | null = null;
    endBlocks: CfgBlock[] = [];

    constructor(nodes: Node[], edges: Edge[]) {
        // 1. Create Blocks
        nodes.forEach(n => this.blocks.set(n.id, new CfgBlock(n)));

        // 2. Link Blocks
        edges.forEach(e => {
            const src = this.blocks.get(e.source);
            const tgt = this.blocks.get(e.target);
            if (src && tgt) {
                src.outbound.push({ target: tgt, label: e.label as string });
                tgt.predecessors.push(src);
            }
        });

        // 3. Identify Special Blocks
        this.startBlock = Array.from(this.blocks.values()).find(b => b.type === 'start' || b.type === 'input') || null;
        this.endBlocks = Array.from(this.blocks.values()).filter(b => b.type === 'end' || b.type === 'output');
    }

    validate(): CfgAnalysisResult {
        this.resetAnalysis();

        const result: CfgAnalysisResult = {
            deadNodes: [],
            loops: [],
            patterns: [],
            branchIssues: [],
            missingStart: !this.startBlock,
            missingEnd: this.endBlocks.length === 0,
            terminates: true
        };

        if (!this.startBlock) return result;

        // --- 1. Dead Code Detection (Reachability BFS) ---
        const queue = [this.startBlock];
        this.startBlock.reachable = true;
        while (queue.length) {
            const curr = queue.shift()!;
            for (const out of curr.outbound) {
                if (!out.target.reachable) {
                    out.target.reachable = true;
                    queue.push(out.target);
                }
            }
        }
        result.deadNodes = Array.from(this.blocks.values()).filter(b => !b.reachable);

        // --- 2. Loop Detection (DFS Back-Edge Analysis) ---
        const dfs = (b: CfgBlock) => {
            b.visited = true;
            b.recursionStack = true;

            for (const out of b.outbound) {
                if (out.target.recursionStack) {
                    // Back-edge detected
                    result.loops.push({
                        source: b, // Latch
                        target: out.target, // Header
                        type: out.target.id === b.id ? 'SELF' : 'COMPLEX'
                    });
                } else if (!out.target.visited) {
                    dfs(out.target);
                }
            }
            b.recursionStack = false;
        };
        if (this.startBlock) dfs(this.startBlock);

        // --- 3. Pattern Recognition ---

        // A. Loop Classification
        result.loops.forEach(loop => {
            const header = loop.target;
            const latch = loop.source;

            // Avoid duplicate patterns for the same header
            if (result.patterns.some(p => p.headerId === header.id)) return;

            if (header.type === 'loop') {
                result.patterns.push({
                    type: 'FOR_LOOP',
                    headerId: header.id,
                    description: `For-Loop Pattern (Counter controlled)`
                });
            } else if (header.type === 'decision') {
                result.patterns.push({
                    type: 'WHILE_LOOP',
                    headerId: header.id,
                    description: `While-Loop Pattern (Pre-check condition)`
                });
            } else if (latch.type === 'decision') {
                result.patterns.push({
                    type: 'DO_WHILE',
                    headerId: header.id,
                    description: `Do-While Pattern (Post-check condition)`
                });
            } else {
                result.patterns.push({
                    type: 'INFINITE_LOOP',
                    headerId: header.id,
                    description: `Infinite Loop (No exit condition detected)`
                });
            }
        });

        // B. Switch-Case / Branching
        this.blocks.forEach(b => {
            if (!b.reachable) return;
            // Native switch logic: > 2 outputs
            if (b.outbound.length > 2) {
                result.patterns.push({
                    type: 'SWITCH',
                    headerId: b.id,
                    description: `Switch-Case Pattern (${b.outbound.length} branches)`
                });
            }
        });

        // --- 4. Branch Analysis (Issues) ---
        this.blocks.forEach(b => {
            if (!b.reachable) return;

            if (b.type === 'decision') {
                if (b.outbound.length === 0) {
                    result.branchIssues.push({ node: b, issue: 'Decision node is a dead end.', severity: 'CRITICAL' });
                    result.terminates = false;
                } else if (b.outbound.length === 1) {
                    result.branchIssues.push({ node: b, issue: 'Decision should typically have 2 branches.', severity: 'WARNING' });
                }
            } else if (b.type !== 'end' && b.type !== 'output' && b.outbound.length === 0) {
                result.branchIssues.push({ node: b, issue: 'Flow stops without End node.', severity: 'CRITICAL' });
                result.terminates = false;
            }
        });

        return result;
    }

    private resetAnalysis() {
        this.blocks.forEach(b => {
            b.reachable = false;
            b.visited = false;
            b.recursionStack = false;
        });
    }
}
