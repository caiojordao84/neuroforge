import type { ASLProgram } from './ASLTypes';
import type { ProgramNode } from '@/system/types';
import type { Language } from '@/types';
import type { TranspileResult } from './transpile';
import { BlocklyParser } from '@/engine/blockly/BlocklyParser';
import { CodeToBlockly } from '@/engine/blockly/CodeToBlockly';
import { normalizeAST } from './transforms/astNormalizer';
import { astToASL, codeToAST } from './codeToASL';
import { transpileAST } from './transpile';

/**
 * Helper interno: converte XML de Blockly num AST normalizado (ProgramNode).
 */
function blocklyXmlToAST(xmlText: string): ProgramNode {
    const parser = new BlocklyParser();
    const ast = parser.parse(xmlText);          // XML -> ProgramNode
    return normalizeAST(ast);                   // normalização única
}

/**
 * 1) Blockly -> ASL
 * XML de Blockly (string) -> ASLProgram para o ASLExecutor/SimulationEngine.
 */
export function blocklyToASL(xmlText: string): ASLProgram {
    const normalized = blocklyXmlToAST(xmlText);
    // Tratamos como AST C-like (cpp) para o funil do astToASL
    return astToASL(normalized, 'cpp');
}

/**
 * 2) Blockly -> ASL + Code
 * Roundtrip direto: a partir de XML de Blockly, produz:
 *  - ASLProgram (para simulação)
 *  - Código alvo gerado pelos generators (C/Python/Rust).
 */
export async function blocklyToCode(
    xmlText: string,
    targetLanguage: Language
): Promise<{ aslProgram: ASLProgram; transpile: TranspileResult }> {
    const normalized = blocklyXmlToAST(xmlText);

    const aslProgram = astToASL(normalized, 'cpp');        // para simulação
    const transpile = await transpileAST(normalized, targetLanguage); // para código

    return { aslProgram, transpile };
}

/**
 * 3) Code -> ASL + Blockly
 * Roundtrip inverso: código textual -> AST -> ASL + XML Blockly.
 */
export async function codeToBlocklyRoundtrip(
    sourceCode: string,
    sourceLanguage: Language
): Promise<{ xml: string; aslProgram: ASLProgram; warnings: string[] }> {
    // 1) Texto -> AST
    const ast = await codeToAST(sourceCode, sourceLanguage);

    // 2) Normalizar AST para ambos caminhos
    const normalized = normalizeAST(ast);

    // 3) AST -> XML Blockly
    const xml = new CodeToBlockly().generate(normalized);

    // 4) AST -> ASL (para simulação no mesmo passo)
    const aslProgram = astToASL(normalized, sourceLanguage);

    return { xml, aslProgram, warnings: [] };
}

/**
 * 4) AST -> Blockly (quando já existe ProgramNode em memória).
 */
export function astToBlockly(ast: ProgramNode): string {
    const gen = new CodeToBlockly();
    return gen.generate(ast);
}
