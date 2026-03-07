import type { ProgramNode, BaseNode } from '@/system/types';
import type { Node, Edge } from '@xyflow/react';
import { CfgBuilder, CfgBlock } from './CfgBuilder';
import type { CfgAnalysisResult } from './CfgBuilder';

export class FlowToAst {
    private blockIdMap = new Map<string, number>();
    private injectedGlobals: BaseNode[] = [];
    private declaredGlobalNames = new Set<string>();

    generate(nodes: any[], edges: any[]): ProgramNode {
        // Reset
        this.blockIdMap.clear();
        this.injectedGlobals = [];
        this.declaredGlobalNames.clear();

        // 1. Build CFG
        const builder = new CfgBuilder(nodes, edges);
        const analysis = builder.validate();

        if (analysis.missingStart) {
            return this.createEmptyProgram("Error: No Start Node found.");
        }

        // 2. Identify and Inject Globals for Industrial Blocks
        this.scanForIndustrialGlobals(builder);

        // Map Block IDs for State Machine
        let idCounter = 0;
        builder.blocks.forEach(b => {
            this.blockIdMap.set(b.id, ++idCounter);
        });

        const program: ProgramNode = { nodeType: 'Program', id: 'root', attributes: {}, children: [] };

        // Setup Function
        // Recolhe APENAS os nós 'setup' explícitos do grafo de Flow.
        // SEM injeção automática de Serial.begin, WiFi.begin ou qualquer outro
        // init de plataforma — o utilizador controla 100% o conteúdo do setup.
        //
        // TODO (Fase 3 — BoardProfile): antes de setupNodes, injetar:
        //   BoardProfile.getSetupNodes(boardId)
        //   Ex: Arduino   → Serial.begin(9600)
        //       ESP32     → WiFi.begin(ssid, pass)
        //       S7-1200   → OB100 startup block (sem serial)
        //       PLC RS485 → ModbusTCP.begin(ip, port)
        const setupNodes: BaseNode[] = [];
        builder.blocks.forEach(b => {
            if (b.type === 'setup') {
                const content = b.data.code
                    ? this.parseExplicitCode(b.data.code)
                    : this.parseSimpleCommand(b.data.label || '');
                if (content) setupNodes.push(content);
            }
        });

        const setup: BaseNode = {
            nodeType: 'Function', id: 'setup', attributes: { name: 'setup' },
            children: setupNodes
        };

        // Loop Function
        const loop: BaseNode = { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: [] };

        // 3. Strategy Selection
        // Force state machine if 'state' nodes present or complex flow
        const hasStateNodes = Array.from(builder.blocks.values()).some(b => b.type === 'state');
        if (hasStateNodes || this.shouldUseStateMachine(builder, analysis)) {
            loop.children = this.generateStateMachine(builder, analysis);
        } else {
            loop.children = this.generateStructured(builder.startBlock!, new Set(), analysis);
        }

        program.children.push(...this.injectedGlobals, setup, loop);
        return program;
    }

    private createEmptyProgram(comment: string): ProgramNode {
        return {
            nodeType: 'Program', id: 'root', attributes: {}, children: [
                { nodeType: 'Function', id: 'setup', attributes: { name: 'setup' }, children: [] },
                { nodeType: 'Function', id: 'loop', attributes: { name: 'loop' }, children: [], leadingComments: [comment] }
            ]
        };
    }

    private scanForIndustrialGlobals(builder: CfgBuilder) {
        builder.blocks.forEach(b => {
            // Timer Globals
            if (b.type === 'ladder_timer') {
                const id = b.data.id || 'T1';
                // int t_id_start = 0; bool t_id_active = false; bool t_id_done = false;
                this.injectGlobal(`${id}_start`, 'int', 0);
                this.injectGlobal(`${id}_active`, 'bool', 0);
                this.injectGlobal(`${id}_done`, 'bool', 0);
            }
            // Counter Globals
            if (b.type === 'ladder_counter') {
                const id = b.data.id || 'C1';
                // int c_id_val = 0; bool c_id_last = false; bool c_id_done = false;
                this.injectGlobal(`${id}_val`, 'int', 0);
                this.injectGlobal(`${id}_last`, 'bool', 0);
                this.injectGlobal(`${id}_done`, 'bool', 0);
            }
            // Latch Globals
            if (b.type === 'ladder_latch') {
                const id = b.data.id || 'L1';
                // bool l_id_q = false;
                this.injectGlobal(`${id}_q`, 'bool', 0);
            }
            // Trig Globals
            if (b.type === 'ladder_trig') {
                const id = b.data.id || 'Trig1';
                // bool tr_id_last = false; bool tr_id_q = false;
                this.injectGlobal(`${id}_last`, 'bool', 0);
                this.injectGlobal(`${id}_q`, 'bool', 0);
            }
            // Math Destinations
            if (b.type === 'ladder_math') {
                const dest = b.data.dest;
                if (dest) {
                    this.injectGlobal(dest, 'float', 0);
                }
            }
        });
    }

    private injectGlobal(name: string, type: string, val: any) {
        if (this.declaredGlobalNames.has(name)) return;
        this.declaredGlobalNames.add(name);

        this.injectedGlobals.push({
            nodeType: 'VariableDeclaration', id: `g_${name}`, attributes: { name, type },
            children: [{ nodeType: 'Literal', id: 'l', attributes: { value: val }, children: [] }]
        });
    }

    private shouldUseStateMachine(builder: CfgBuilder, analysis: CfgAnalysisResult): boolean {
        if (analysis.loops.some(l => l.type === 'COMPLEX')) return true;
        if (builder.blocks.size > 20 && analysis.loops.length > 0) return true;
        if (!analysis.terminates && analysis.loops.length === 0) return false;
        return false;
    }

    // --- Structured Generation ---

    private generateStructured(block: CfgBlock, visited: Set<string>, analysis: CfgAnalysisResult): BaseNode[] {
        if (visited.has(block.id)) return [];

        const nodes: BaseNode[] = [];
        const content = this.parseBlockContent(block);
        if (content) nodes.push(content);

        // Check for Loop Pattern
        const loopPattern = analysis.patterns.find(p => p.headerId === block.id && (p.type === 'WHILE_LOOP' || p.type === 'FOR_LOOP' || p.type === 'INFINITE_LOOP'));

        if (loopPattern) {
            visited.add(block.id);
            const trueBranch = block.outbound.find(o => o.label === 'True' || o.label === 'Yes') || block.outbound[0];
            const falseBranch = block.outbound.find(o => o.label === 'False' || o.label === 'No') || block.outbound[1];

            const bodyStart = trueBranch?.target;
            const exitStart = falseBranch?.target;

            if (bodyStart) {
                const cond = this.parseCondition(block);
                const bodyNodes = this.generateStructured(bodyStart, new Set(visited), analysis);

                const whileNode: BaseNode = {
                    nodeType: 'WhileLoop',
                    id: `while-${block.id}`,
                    attributes: {},
                    children: [cond, ...bodyNodes]
                };
                nodes.push(whileNode);

                if (exitStart && exitStart.id !== bodyStart.id) {
                    nodes.push(...this.generateStructured(exitStart, visited, analysis));
                }
                return nodes;
            }
        }

        visited.add(block.id);

        if (block.outbound.length === 0) return nodes;

        if (block.outbound.length === 1) {
            nodes.push(...this.generateStructured(block.outbound[0].target, visited, analysis));
        } else if (block.outbound.length >= 2) {
            const trueBranch = block.outbound.find(o => o.label === 'True' || o.label === 'Yes') || block.outbound[0];
            const falseBranch = block.outbound.find(o => o.label === 'False' || o.label === 'No') || block.outbound[1];

            const cond = this.parseCondition(block);

            const ifStmt: BaseNode = {
                nodeType: 'IfStatement',
                id: `if-${block.id}`,
                attributes: {},
                children: [
                    cond,
                    ...this.generateStructured(trueBranch.target, new Set(visited), analysis),
                    ...this.generateStructured(falseBranch.target, new Set(visited), analysis)
                ]
            };
            nodes.push(ifStmt);
        }

        return nodes;
    }

    // --- State Machine Generation ---

    private generateStateMachine(builder: CfgBuilder, analysis: CfgAnalysisResult): BaseNode[] {
        const startId = this.blockIdMap.get(builder.startBlock!.id)!;

        // Globals for State Machine
        const stateDecl: BaseNode = {
            nodeType: 'VariableDeclaration',
            id: 'state_decl',
            attributes: { name: 'flowState', type: 'int' },
            children: [{ nodeType: 'Literal', id: 's_init', attributes: { value: startId }, children: [] }]
        };
        const newStateDecl: BaseNode = {
            nodeType: 'VariableDeclaration',
            id: 'state_new',
            attributes: { name: 'g_newState', type: 'bool' },
            children: [{ nodeType: 'Literal', id: 's_new', attributes: { value: 1 }, children: [] }]
        };

        const whileLoop: BaseNode = {
            nodeType: 'WhileLoop',
            id: 'main_loop',
            attributes: {},
            children: [{ nodeType: 'Literal', id: 'true', attributes: { value: 1 }, children: [] }]
        };

        let rootIf: BaseNode | null = null;
        let currentIf: BaseNode | null = null;

        builder.blocks.forEach(block => {
            if (!block.reachable) return;
            const stateId = this.blockIdMap.get(block.id)!;

            const body: BaseNode[] = [];

            // 1. Entry Action (Logic injection)
            if (block.type === 'state' && block.data.entry) {
                const entryNode = this.parseExplicitCode(block.data.entry);
                if (entryNode) {
                    const ifStmt: BaseNode = {
                        nodeType: 'IfStatement', id: `entry-${block.id}`, attributes: {},
                        children: [
                            { nodeType: 'Identifier', id: 'nst', attributes: { name: 'g_newState' }, children: [] },
                            entryNode,
                            {
                                nodeType: 'ExpressionStatement', id: 'ack', attributes: {},
                                children: [{
                                    nodeType: 'BinaryExpression', id: 'ack_op', attributes: { operator: '=' },
                                    children: [
                                        { nodeType: 'Identifier', id: 'nsv', attributes: { name: 'g_newState' }, children: [] },
                                        { nodeType: 'Literal', id: 'f', attributes: { value: 0 }, children: [] }
                                    ]
                                }]
                            }
                        ]
                    };
                    body.push(ifStmt);
                }
            } else {
                const clearStmt: BaseNode = {
                    nodeType: 'ExpressionStatement', id: `clr-${block.id}`, attributes: {},
                    children: [{
                        nodeType: 'BinaryExpression', id: 'assign', attributes: { operator: '=' },
                        children: [
                            { nodeType: 'Identifier', id: 'i', attributes: { name: 'g_newState' }, children: [] },
                            { nodeType: 'Literal', id: 'l', attributes: { value: 0 }, children: [] }
                        ]
                    }]
                };
                body.push(clearStmt);
            }

            // 2. Main Content / Do Action
            const content = this.parseBlockContent(block);
            if (content) body.push(content);

            // 3. Exit Action & Transition
            const exitNode = (block.type === 'state' && block.data.exit) ? this.parseExplicitCode(block.data.exit) : null;

            if (block.outbound.length === 0) {
                body.push(this.createStateAssign(-1, exitNode));
            } else if (block.outbound.length === 1) {
                const nextId = this.blockIdMap.get(block.outbound[0].target.id)!;
                body.push(this.createStateAssign(nextId, exitNode));
            } else {
                const trueBranch = block.outbound.find(o => o.label === 'True' || o.label === 'Yes') || block.outbound[0];
                const falseBranch = block.outbound.find(o => o.label === 'False' || o.label === 'No') || block.outbound[1];

                const tId = this.blockIdMap.get(trueBranch.target.id)!;
                const fId = this.blockIdMap.get(falseBranch.target.id)!;

                const cond = this.parseCondition(block);

                const branchIf: BaseNode = {
                    nodeType: 'IfStatement',
                    id: `br-${block.id}`,
                    attributes: {},
                    children: [cond, this.createStateAssign(tId, exitNode), this.createStateAssign(fId, exitNode)]
                };
                body.push(branchIf);
            }

            const stateCheck: BaseNode = {
                nodeType: 'BinaryExpression', id: `chk-${block.id}`, attributes: { operator: '==' },
                children: [
                    { nodeType: 'Identifier', id: 'st', attributes: { name: 'flowState' }, children: [] },
                    { nodeType: 'Literal', id: 'l', attributes: { value: stateId }, children: [] }
                ]
            };

            const ifNode: BaseNode = {
                nodeType: 'IfStatement', id: `st-if-${block.id}`, attributes: {},
                children: [stateCheck, ...body]
            };

            if (!rootIf) {
                rootIf = ifNode;
                currentIf = ifNode;
            } else {
                currentIf!.children.push(ifNode);
                currentIf = ifNode;
            }
        });

        if (rootIf) whileLoop.children.push(rootIf);
        return [stateDecl, newStateDecl, whileLoop];
    }

    private createStateAssign(nextState: number, exitNode: BaseNode | null): BaseNode {
        const assigns: BaseNode[] = [
            {
                nodeType: 'ExpressionStatement', id: `set-st-${Math.random()}`, attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: 'assign', attributes: { operator: '=' },
                    children: [
                        { nodeType: 'Identifier', id: 'i', attributes: { name: 'flowState' }, children: [] },
                        { nodeType: 'Literal', id: 'l', attributes: { value: nextState }, children: [] }
                    ]
                }]
            },
            {
                nodeType: 'ExpressionStatement', id: `set-ns-${Math.random()}`, attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: 'assign', attributes: { operator: '=' },
                    children: [
                        { nodeType: 'Identifier', id: 'i', attributes: { name: 'g_newState' }, children: [] },
                        { nodeType: 'Literal', id: 'l', attributes: { value: 1 }, children: [] }
                    ]
                }]
            }
        ];

        return {
            nodeType: 'Block', id: `tr-${Math.random()}`, attributes: {},
            children: exitNode ? [exitNode, ...assigns] : assigns
        };
    }

    // --- Parsing Helpers ---

    private parseBlockContent(block: CfgBlock): BaseNode | null {
        const { type, data } = block;

        // Nós 'setup' são recolhidos em generate() e não devem aparecer no loop.
        if (type === 'setup') {
            return null;
        }

        // --- Ladder Logic Mapping (Function Blocks) ---

        // Coils
        if (type === 'ladder_coil') {
            const pin = data.pin || 13;
            return {
                nodeType: 'GpioSet', id: `coil-${block.id}`, attributes: {},
                children: [
                    { nodeType: 'Literal', id: 'p', attributes: { value: pin }, children: [] },
                    { nodeType: 'Literal', id: 'v', attributes: { value: 1 }, children: [] }
                ]
            };
        }

        // Timers: TON, TOF, TP
        if (type === 'ladder_timer') {
            const id = data.id || 'T1';
            const pt = data.preset || 1000;
            const inVar = data.variable || 'true'; // Default to always running if undefined
            const subType = data.subType || 'TON';

            const callee = subType === 'TOF' ? 'TOF' : subType === 'TP' ? 'TP' : 'TON';

            const call: BaseNode = {
                nodeType: 'CallExpression',
                id: `timer-${block.id}`,
                attributes: { callee, instance: id },
                children: [
                    {
                        nodeType: 'Identifier',
                        id: `in-${block.id}`,
                        attributes: { name: inVar },
                        children: [],
                    },
                    {
                        nodeType: 'Literal',
                        id: `pt-${block.id}`,
                        attributes: { value: pt },
                        children: [],
                    },
                ],
            };

            return {
                nodeType: 'ExpressionStatement',
                id: `stmt-timer-${block.id}`,
                attributes: {},
                children: [call]
            };
        }

        // Counters: CTU, CTD
        if (type === 'ladder_counter') {
            const id = data.id || 'C1';
            const pv = data.preset || 5;
            const inVar = data.variable || 'false';
            const subType = data.subType || 'CTU';

            if (subType === 'CTU') {
                const call: BaseNode = {
                    nodeType: 'CallExpression',
                    id: `ctu-${block.id}`,
                    attributes: { callee: 'CTU', instance: id },
                    children: [
                        {
                            nodeType: 'Identifier',
                            id: `cu-${block.id}`,
                            attributes: { name: inVar },
                            children: [],
                        },
                        {
                            nodeType: 'Literal',
                            id: `r-${block.id}`,
                            attributes: { value: 0 },
                            children: [],
                        },
                        {
                            nodeType: 'Literal',
                            id: `pv-${block.id}`,
                            attributes: { value: pv },
                            children: [],
                        },
                    ],
                };
                return {
                    nodeType: 'ExpressionStatement',
                    id: `stmt-ctu-${block.id}`,
                    attributes: {},
                    children: [call]
                };
            }

            const call: BaseNode = {
                nodeType: 'CallExpression',
                id: `ctd-${block.id}`,
                attributes: { callee: 'CTD', instance: id },
                children: [
                    {
                        nodeType: 'Identifier',
                        id: `cd-${block.id}`,
                        attributes: { name: inVar },
                        children: [],
                    },
                    {
                        nodeType: 'Literal',
                        id: `ld-${block.id}`,
                        attributes: { value: 0 },
                        children: [],
                    },
                    {
                        nodeType: 'Literal',
                        id: `pv-${block.id}`,
                        attributes: { value: pv },
                        children: [],
                    },
                ],
            };
            return {
                nodeType: 'ExpressionStatement',
                id: `stmt-ctd-${block.id}`,
                attributes: {},
                children: [call]
            };
        }

        // Latches: SR, RS
        if (type === 'ladder_latch') {
            const id = data.id || 'L1';
            const sVar = data.setVar || 'false';
            const rVar = data.resetVar || 'false';
            const subType = data.subType || 'SR';

            if (subType === 'SR') {
                const call: BaseNode = {
                    nodeType: 'CallExpression',
                    id: `sr-${block.id}`,
                    attributes: { callee: 'SR', instance: id },
                    children: [
                        {
                            nodeType: 'Identifier',
                            id: `s-${block.id}`,
                            attributes: { name: sVar },
                            children: [],
                        },
                        {
                            nodeType: 'Identifier',
                            id: `r-${block.id}`,
                            attributes: { name: rVar },
                            children: [],
                        },
                    ],
                };
                return {
                    nodeType: 'ExpressionStatement',
                    id: `stmt-sr-${block.id}`,
                    attributes: {},
                    children: [call]
                };
            }

            const call: BaseNode = {
                nodeType: 'CallExpression',
                id: `rs-${block.id}`,
                attributes: { callee: 'RS', instance: id },
                children: [
                    {
                        nodeType: 'Identifier',
                        id: `r-${block.id}`,
                        attributes: { name: rVar },
                        children: [],
                    },
                    {
                        nodeType: 'Identifier',
                        id: `s-${block.id}`,
                        attributes: { name: sVar },
                        children: [],
                    },
                ],
            };
            return {
                nodeType: 'ExpressionStatement',
                id: `stmt-rs-${block.id}`,
                attributes: {},
                children: [call]
            };
        }

        // Triggers: R_TRIG, F_TRIG
        if (type === 'ladder_trig') {
            const id = data.id || 'Trig1';
            const clk = data.variable || 'false';
            const subType = data.subType || 'R_TRIG';

            const callee = subType === 'F_TRIG' ? 'F_TRIG' : 'R_TRIG';

            const call: BaseNode = {
                nodeType: 'CallExpression',
                id: `trig-${block.id}`,
                attributes: { callee, instance: id },
                children: [
                    {
                        nodeType: 'Identifier',
                        id: `in-${block.id}`,
                        attributes: { name: clk },
                        children: [],
                    },
                ],
            };
            return {
                nodeType: 'ExpressionStatement',
                id: `stmt-trig-${block.id}`,
                attributes: {},
                children: [call]
            };
        }

        // Math: ADD, SUB, MUL, DIV
        if (type === 'ladder_math') {
            const op = data.op || 'ADD';
            const a = data.a || '0';
            const b = data.b || '0';
            const dest = data.dest || 'res';
            const map: any = { 'ADD': '+', 'SUB': '-', 'MUL': '*', 'DIV': '/' };
            const operator = map[op] || '+';

            // dest = a + b
            return {
                nodeType: 'ExpressionStatement', id: `math-${block.id}`, attributes: {},
                children: [{
                    nodeType: 'BinaryExpression', id: `assign-${block.id}`, attributes: { operator: '=' },
                    children: [
                        { nodeType: 'Identifier', id: 'd', attributes: { name: dest }, children: [] },
                        {
                            nodeType: 'BinaryExpression', id: `op-${block.id}`, attributes: { operator },
                            children: [
                                { nodeType: 'Identifier', id: 'a', attributes: { name: a }, children: [] },
                                { nodeType: 'Identifier', id: 'b', attributes: { name: b }, children: [] }
                            ]
                        }
                    ]
                }]
            };
        }

        if (type === 'process' || type === 'state' || type === 'default') {
            if (data.code) return this.parseExplicitCode(data.code);
            return this.parseSimpleCommand(data.label);
        }
        return null;
    }

    private raw(code: string): BaseNode {
        return {
            nodeType: 'ExpressionStatement', id: 'raw', attributes: {},
            children: [{
                nodeType: 'Literal', id: 'raw',
                attributes: { value: code, isRaw: true, isString: false },
                children: []
            }]
        };
    }

    private parseCondition(block: CfgBlock): BaseNode {
        // Ladder Contact
        if (block.type === 'ladder_contact') {
            const pin = block.data.pin || 0;
            const isNC = block.data.subType === 'NC';

            const read: BaseNode = {
                nodeType: 'GpioRead', id: `read-${block.id}`, attributes: {},
                children: [{ nodeType: 'Literal', id: 'p', attributes: { value: pin }, children: [] }]
            };

            if (isNC) {
                return {
                    nodeType: 'UnaryExpression', id: `not-${block.id}`, attributes: { operator: '!', prefix: true },
                    children: [read]
                };
            }
            return read;
        }

        // Ladder Compare
        if (block.type === 'ladder_compare') {
            const op = block.data.op || 'EQ';
            const a = block.data.a || '0';
            const b = block.data.b || '0';
            const map: any = { 'EQ': '==', 'NEQ': '!=', 'GT': '>', 'LT': '<', 'GTE': '>=', 'LTE': '<=' };
            return {
                nodeType: 'BinaryExpression', id: `cmp-${block.id}`,
                attributes: { operator: map[op] || '==' },
                children: [
                    { nodeType: 'Identifier', id: 'a', attributes: { name: a }, children: [] },
                    { nodeType: 'Identifier', id: 'b', attributes: { name: b }, children: [] }
                ]
            };
        }

        const str = block.data.code || block.data.label.replace('?', '');
        return this.parseExpression(str);
    }

    private parseExplicitCode(code: string): BaseNode | null {
        if (!code) return null;
        if (code.startsWith('digitalWrite')) {
            const args = code.match(/\((.*)\)/);
            if (args) {
                const [pin, val] = args[1].split(',').map(s => s.trim());
                return {
                    nodeType: 'GpioSet', id: 'gen', attributes: {},
                    children: [
                        { nodeType: 'Literal', id: 'p', attributes: { value: parseInt(pin) }, children: [] },
                        { nodeType: 'Literal', id: 'v', attributes: { value: (val === 'HIGH' || val === '1') ? 1 : 0 }, children: [] }
                    ]
                };
            }
        }
        if (code.startsWith('delay')) {
            const args = code.match(/\((.*)\)/);
            if (args) {
                return { nodeType: 'DelayMs', id: 'gen', attributes: {}, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: parseInt(args[1]) }, children: [] }] };
            }
        }

        // --- S5: analogWrite(pin, val) ---
        if (code.startsWith('analogWrite')) {
            const m = code.match(/\(([^,]+),([^)]+)\)/);
            if (m) {
                const pinV = m[1].trim();
                const valV = m[2].trim();
                return {
                    nodeType: 'AnalogWrite', id: 'gen', attributes: {},
                    children: [
                        isNaN(Number(pinV))
                            ? { nodeType: 'Identifier', id: 'p', attributes: { name: pinV }, children: [] }
                            : { nodeType: 'Literal', id: 'p', attributes: { value: parseInt(pinV) }, children: [] },
                        isNaN(Number(valV))
                            ? { nodeType: 'Identifier', id: 'v', attributes: { name: valV }, children: [] }
                            : { nodeType: 'Literal', id: 'v', attributes: { value: parseInt(valV) }, children: [] }
                    ]
                };
            }
        }

        // --- S5: pinMode(pin, MODE) ---
        if (code.startsWith('pinMode')) {
            const m = code.match(/\(([^,]+),([^)]+)\)/);
            if (m) {
                const pinV = m[1].trim();
                const modeV = m[2].trim().replace(/['"]/g, '');
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'pinMode' },
                    children: [
                        isNaN(Number(pinV))
                            ? { nodeType: 'Identifier', id: 'p', attributes: { name: pinV }, children: [] }
                            : { nodeType: 'Literal', id: 'p', attributes: { value: parseInt(pinV) }, children: [] },
                        { nodeType: 'Literal', id: 'm', attributes: { value: modeV, isString: true }, children: [] }
                    ]
                };
            }
        }

        // --- S5: Serial.begin(baud) ---
        if (code.startsWith('Serial.begin')) {
            const m = code.match(/\(([^)]+)\)/);
            if (m) {
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'Serial.begin' },
                    children: [{ nodeType: 'Literal', id: 'l', attributes: { value: parseInt(m[1]) || 9600 }, children: [] }]
                };
            }
        }

        // --- S5: Serial.print(x) ---
        if (code.startsWith('Serial.print')) {
            const m = code.match(/\((.*)\)/);
            if (m) {
                const raw = m[1].trim().replace(/^["']|["']$/g, '');
                return {
                    nodeType: 'Print', id: 'gen', attributes: {},
                    children: [{ nodeType: 'Literal', id: 'l', attributes: { value: raw, isString: true }, children: [] }]
                };
            }
        }

        // --- S5: delayMicroseconds(us) ---
        if (code.startsWith('delayMicroseconds')) {
            const m = code.match(/\(([^)]+)\)/);
            if (m) {
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'delayMicroseconds' },
                    children: [{ nodeType: 'Literal', id: 'l', attributes: { value: parseInt(m[1]) || 0 }, children: [] }]
                };
            }
        }

        // --- S5: servo.write(pin, angle) ---
        if (/^servo\.write|^Servo\.write/i.test(code)) {
            const m = code.match(/\(([^)]+)\)/);
            if (m) {
                const parts = m[1].split(',').map(s => s.trim());
                const pin = parts.length > 1 ? (parseInt(parts[0]) || 0) : 0;
                const angle = parts.length > 1 ? (parseInt(parts[1]) || 90) : (parseInt(parts[0]) || 90);
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'servo' },
                    children: [
                        { nodeType: 'Literal', id: 'p', attributes: { value: pin }, children: [] },
                        { nodeType: 'Literal', id: 'a', attributes: { value: angle }, children: [] }
                    ]
                };
            }
        }

        // --- S5: tone(pin, freq, dur) ---
        if (code.startsWith('tone(')) {
            const m = code.match(/\(([^)]+)\)/);
            if (m) {
                const parts = m[1].split(',').map(s => s.trim());
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'tone' },
                    children: [
                        { nodeType: 'Literal', id: 'p', attributes: { value: parseInt(parts[0]) || 0 }, children: [] },
                        { nodeType: 'Literal', id: 'f', attributes: { value: parseInt(parts[1]) || 440 }, children: [] },
                        { nodeType: 'Literal', id: 'd', attributes: { value: parseInt(parts[2]) || 500 }, children: [] }
                    ]
                };
            }
        }

        // --- S5: noTone(pin) ---
        if (code.startsWith('noTone(')) {
            const m = code.match(/\(([^)]*)\)/);
            if (m) {
                return {
                    nodeType: 'CallExpression', id: 'gen', attributes: { callee: 'noTone' },
                    children: [{ nodeType: 'Literal', id: 'p', attributes: { value: parseInt(m[1]) || 0 }, children: [] }]
                };
            }
        }

        // --- S5: lcd.print(text) ---
        if (/^lcd\.print/i.test(code)) {
            const m = code.match(/\((.*)\)/);
            if (m) {
                return {
                    nodeType: 'LcdPrint', id: 'gen', attributes: {},
                    children: [{ nodeType: 'Literal', id: 'l', attributes: { value: m[1].replace(/^["']|["']$/g, ''), isString: true }, children: [] }]
                };
            }
        }

        // --- S5: lcd.clear() ---
        if (/^lcd\.clear\(\)/i.test(code)) {
            return { nodeType: 'LcdClear', id: 'gen', attributes: {}, children: [] };
        }

        // --- S5: lcd.setCursor(col, row) ---
        if (/^lcd\.setCursor/i.test(code)) {
            const m = code.match(/\(([^,]+),([^)]+)\)/);
            if (m) {
                return {
                    nodeType: 'LcdCursor', id: 'gen', attributes: {},
                    children: [
                        { nodeType: 'Literal', id: 'c', attributes: { value: parseInt(m[1]) || 0 }, children: [] },
                        { nodeType: 'Literal', id: 'r', attributes: { value: parseInt(m[2]) || 0 }, children: [] }
                    ]
                };
            }
        }

        // --- S5: oled.print(text, x, y, size?) ---
        if (/^oled\.print/i.test(code)) {
            const m = code.match(/\(([^)]+)\)/);
            if (m) {
                const parts = m[1].split(',').map(s => s.trim());
                return {
                    nodeType: 'OledText', id: 'gen', attributes: {},
                    children: [
                        { nodeType: 'Literal', id: 'l', attributes: { value: parts[0]?.replace(/^["']|["']$/g, '') || '', isString: true }, children: [] },
                        { nodeType: 'Literal', id: 'x', attributes: { value: parseInt(parts[1]) || 0 }, children: [] },
                        { nodeType: 'Literal', id: 'y', attributes: { value: parseInt(parts[2]) || 0 }, children: [] },
                        { nodeType: 'Literal', id: 's', attributes: { value: parseInt(parts[3]) || 1 }, children: [] }
                    ]
                };
            }
        }

        // --- S5: oled.show() / oled.clear() ---
        if (/^oled\.show\(\)/i.test(code)) return { nodeType: 'OledShow', id: 'gen', attributes: {}, children: [] };
        if (/^oled\.clear\(\)/i.test(code)) return { nodeType: 'OledClear', id: 'gen', attributes: {}, children: [] };

        // Fallback: Raw Code Expression (e.g., "x = x + 1")
        return this.raw(code);
    }

    private parseSimpleCommand(cmd: string): BaseNode | null {
        if (cmd.includes('LED On') || cmd.includes('On')) {
            return { nodeType: 'GpioSet', id: 'gen', attributes: {}, children: [{ nodeType: 'Literal', id: 'p', attributes: { value: 2 }, children: [] }, { nodeType: 'Literal', id: 'v', attributes: { value: 1 }, children: [] }] };
        }
        if (cmd.includes('LED Off') || cmd.includes('Off')) {
            return { nodeType: 'GpioSet', id: 'gen', attributes: {}, children: [{ nodeType: 'Literal', id: 'p', attributes: { value: 2 }, children: [] }, { nodeType: 'Literal', id: 'v', attributes: { value: 0 }, children: [] }] };
        }
        if (cmd.includes('Delay') || cmd.includes('Wait')) {
            const match = cmd.match(/(\d+)/);
            const ms = match ? parseInt(match[1]) : (cmd.includes('1s') ? 1000 : 100);
            return { nodeType: 'DelayMs', id: 'gen', attributes: {}, children: [{ nodeType: 'Literal', id: 'l', attributes: { value: ms }, children: [] }] };
        }
        return null;
    }

    private parseExpression(expr: string): BaseNode {
        const parts = expr.split(/(<=|>=|<|>|==|!=)/);
        if (parts.length === 3) {
            return {
                nodeType: 'BinaryExpression', id: 'gen', attributes: { operator: parts[1] },
                children: [
                    { nodeType: 'Identifier', id: 'i', attributes: { name: parts[0].trim() }, children: [] },
                    { nodeType: 'Literal', id: 'l', attributes: { value: parseInt(parts[2]) || 0 }, children: [] }
                ]
            };
        }
        return { nodeType: 'Literal', id: 'true', attributes: { value: 1 }, children: [] };
    }
}
