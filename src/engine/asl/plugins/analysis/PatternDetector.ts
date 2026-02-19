
import type { ProgramNode, BaseNode, PatternMatch } from '@/system/types';

export class PatternDetector {
    detect(ast: ProgramNode): PatternMatch[] {
        const matches: PatternMatch[] = [];
        matches.push(...this.detectPwmBitBang(ast));
        matches.push(...this.detectPollingLoop(ast));
        matches.push(...this.detectStateMachine(ast));
        matches.push(...this.detectLongDelays(ast));
        return matches;
    }

    // Helper to unwrap ExpressionStatements which wrap most function calls and assignments
    private unwrap(node: BaseNode): BaseNode {
        if (node.nodeType === 'ExpressionStatement' && node.children.length > 0) {
            return node.children[0];
        }
        return node;
    }

    private getLine(node: BaseNode): number | undefined {
        if (node.metadata?.line) return node.metadata.line;
        if (node.children.length > 0) return this.getLine(node.children[0]);
        return undefined;
    }

    private detectPwmBitBang(ast: ProgramNode): PatternMatch[] {
        const matches: PatternMatch[] = [];
        const loop = ast.children.find(c => c.attributes.name === 'loop');
        if (!loop) return [];

        const stmts = loop.children;
        // Need at least 4 statements for a full ON-WAIT-OFF-WAIT cycle
        for (let i = 0; i < stmts.length - 3; i++) {
            const n1 = this.unwrap(stmts[i]);
            const n2 = this.unwrap(stmts[i + 1]);
            const n3 = this.unwrap(stmts[i + 2]);
            const n4 = this.unwrap(stmts[i + 3]);

            const isGpioSet = (n: BaseNode) => n.nodeType === 'GpioSet';
            const isDelay = (n: BaseNode) => n.nodeType === 'DelayMs';

            if (isGpioSet(n1) && isDelay(n2) && isGpioSet(n3) && isDelay(n4)) {
                const pin1 = (n1.children[0] as any).attributes.value;
                const val1 = (n1.children[1] as any).attributes.value;

                const pin2 = (n3.children[0] as any).attributes.value;
                const val2 = (n3.children[1] as any).attributes.value;

                // Check if it's the same pin and values are toggled (e.g. 1 and 0)
                if (pin1 === pin2 && val1 !== val2) {
                    const t1 = (n2.children[0] as any).attributes.value || 0;
                    const t2 = (n4.children[0] as any).attributes.value || 0;

                    const periodMs = t1 + t2;
                    if (periodMs > 0) {
                        const freq = 1000 / periodMs;
                        matches.push({
                            type: 'PWM_BITBANG',
                            description: `Software PWM detected on Pin ${pin1}. Cycle: ${t1}ms/${t2}ms. Freq: ${freq.toFixed(1)} Hz`,
                            severity: 'WARNING',
                            location: stmts[i].id,
                            line: this.getLine(stmts[i])
                        });
                    }
                }
            }
        }
        return matches;
    }

    private detectPollingLoop(ast: ProgramNode): PatternMatch[] {
        const matches: PatternMatch[] = [];
        const scan = (node: BaseNode) => {
            if (node.nodeType === 'WhileLoop') {
                const condition = node.children[0];
                // Check if the while loop condition reads a PIN, and the body has NO delay
                if (this.hasGpioRead(condition) && !this.hasDelay(node)) {
                    matches.push({
                        type: 'POLLING_LOOP',
                        description: `Blocking polling loop detected. This will freeze the controller/multitasking. Add 'delay(1);' inside the loop.`,
                        severity: 'CRITICAL',
                        location: node.id,
                        line: this.getLine(node)
                    });
                }
            }
            node.children.forEach(scan);
        };
        scan(ast);
        return matches;
    }

    private detectStateMachine(ast: ProgramNode): PatternMatch[] {
        const matches: PatternMatch[] = [];
        const scan = (node: BaseNode) => {
            if (node.nodeType === 'IfStatement') {
                const cond = this.unwrap(node.children[0]);
                if (cond.nodeType === 'BinaryExpression' && cond.attributes.operator === '==') {
                    const left = this.unwrap(cond.children[0]);
                    // Heuristic: check if variable name implies state/mode
                    if (left.nodeType === 'Identifier' && ['state', 'mode', 'status', 'step', 'phase', 'fsm'].includes(left.attributes.name)) {
                        matches.push({
                            type: 'STATE_MACHINE',
                            description: `State Machine pattern detected using variable '${left.attributes.name}'.`,
                            severity: 'INFO',
                            location: node.id,
                            line: this.getLine(node)
                        });
                    }
                }
            }
            node.children.forEach(scan);
        };
        scan(ast);
        // Filter duplicates since we might hit multiple IFs in the same chain
        return matches.filter((v, i, a) => a.findIndex(t => (t.description === v.description)) === i);
    }

    private detectLongDelays(ast: ProgramNode): PatternMatch[] {
        const matches: PatternMatch[] = [];
        const scan = (node: BaseNode, inLoop: boolean) => {
            // Check if we are entering the main loop function
            const isLoopFunc = node.nodeType === 'Function' && node.attributes.name === 'loop';
            const isWhileTrue = node.nodeType === 'WhileLoop'; // Rough approx for main loops in python
            const nowInLoop = inLoop || isLoopFunc || isWhileTrue;

            if (nowInLoop && node.nodeType === 'DelayMs') {
                const valNode = node.children[0];
                if (valNode.nodeType === 'Literal' && typeof valNode.attributes.value === 'number') {
                    if (valNode.attributes.value > 500) {
                        matches.push({
                            type: 'LONG_DELAY',
                            description: `Long delay (${valNode.attributes.value}ms) inside loop blocks other tasks. Consider using non-blocking timers (millis).`,
                            severity: 'WARNING',
                            location: node.id,
                            line: this.getLine(node)
                        });
                    }
                }
            }
            node.children.forEach(c => scan(c, nowInLoop));
        };
        scan(ast, false);
        return matches;
    }

    private hasGpioRead(node: BaseNode): boolean {
        const n = this.unwrap(node);
        if (n.nodeType === 'GpioRead' || n.nodeType === 'AnalogRead') return true;
        // Check children (recursively)
        return n.children.some(c => this.hasGpioRead(c));
    }

    private hasDelay(node: BaseNode): boolean {
        const n = this.unwrap(node);
        if (n.nodeType === 'DelayMs') return true;
        // Recursively check children (e.g. inside Block or If inside While)
        return n.children.some(c => this.hasDelay(c));
    }
}
