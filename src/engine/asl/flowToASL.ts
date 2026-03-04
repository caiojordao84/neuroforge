// src/engine/asl/flowToASL.ts

import type { Node, Edge } from 'reactflow';
import type { ASLProgram } from './ASLTypes';
import { FlowToAst } from '@/engine/flow/FlowToAst';
import { normalizeAST } from './transforms/astNormalizer';
import { astToASL } from './codeToASL';
import { FlowValidator, type FlowIssue } from '@/engine/flow/FlowValidator';

/**
 * Converte um diagrama de Flow (React Flow nodes/edges)
 * num ASLProgram pronto para o ASLExecutor / generators.
 */
export function flowToASL(nodes: Node[], edges: Edge[]): ASLProgram {
    // 1) Flow -> ProgramNode (AST)
    const flowAst = new FlowToAst().generate(nodes, edges);

    // 2) Normalizar AST para manter paridade com C/Python/Rust
    const normalized = normalizeAST(flowAst);

    // 3) AST -> ASLProgram (sem linguagem textual especifica; tratamos como C++)
    return astToASL(normalized, 'cpp');
}

export function validateFlow(nodes: Node[], edges: Edge[]): FlowIssue[] {
    return FlowValidator.validate(nodes, edges);
}
