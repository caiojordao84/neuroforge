
import { Node, Edge } from 'reactflow';
import { CfgBuilder } from './CfgBuilder';

export interface FlowIssue {
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    message: string;
    nodeId?: string;
}

export class FlowValidator {
    static validate(nodes: Node[], edges: Edge[]): FlowIssue[] {
        const issues: FlowIssue[] = [];
        
        // 1. Build Control Flow Graph
        const builder = new CfgBuilder(nodes, edges);
        const analysis = builder.validate();

        // 2. Map CFG Results to FlowIssues

        // Patterns (INFO)
        analysis.patterns.forEach(p => {
             issues.push({ severity: 'INFO', message: p.description, nodeId: p.headerId });
        });

        // Missing Start/End
        if (analysis.missingStart) {
            issues.push({ severity: 'CRITICAL', message: 'No Start node found.' });
        }
        if (analysis.missingEnd) {
            issues.push({ severity: 'WARNING', message: 'No End node found. Flow may not terminate.' });
        }

        // Dead Code
        analysis.deadNodes.forEach(b => {
            issues.push({ severity: 'WARNING', message: 'Unreachable node (Dead code)', nodeId: b.id });
        });

        // Branch / Structure Issues
        analysis.branchIssues.forEach(bi => {
            issues.push({ severity: bi.severity, message: bi.issue, nodeId: bi.node.id });
        });

        // Start Node specific check 
        if (builder.startBlock && builder.startBlock.predecessors.length > 0) {
             issues.push({ severity: 'WARNING', message: 'Start node has incoming edges.', nodeId: builder.startBlock.id });
        }

        // 3. Industrial Logic Validation
        // Check for duplicate IDs in stateful blocks (Timers, Counters, Latches)
        const idMap = new Map<string, string[]>();
        nodes.forEach(n => {
            if (['ladder_timer', 'ladder_counter', 'ladder_latch'].includes(n.type || '')) {
                const id = n.data.id;
                if (id) {
                    if (!idMap.has(id)) idMap.set(id, []);
                    idMap.get(id)?.push(n.id);
                }
            }
        });
        
        idMap.forEach((nodeIds, id) => {
            if (nodeIds.length > 1) {
                nodeIds.forEach(nid => {
                    issues.push({ severity: 'CRITICAL', message: `Duplicate Tag ID '${id}'. Logic tags must be unique.`, nodeId: nid });
                });
            }
        });

        return issues;
    }
}
