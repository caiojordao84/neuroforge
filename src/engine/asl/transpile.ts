import type { Language } from '@/types';
import { codeToAST } from './codeToASL';
import { CGenerator } from './plugins/c/CGenerator';
import { PythonGenerator, type PythonFlavor } from './plugins/python/PythonGenerator';
import { RustGenerator } from './plugins/rust/RustGenerator';
import { normalizeAST } from './transforms/astNormalizer';

export interface TranspileResult {
    success: boolean;
    code: string;
    warnings: string[];
}

export async function transpileCode(
    sourceCode: string,
    sourceLanguage: Language,
    targetLanguage: Language
): Promise<TranspileResult> {
    const warnings: string[] = [];

    // Same language - no transpilation needed or simple copy
    if (sourceLanguage === targetLanguage) {
        return { success: true, code: sourceCode, warnings: [] };
    }

    try {
        // Step 1: Parse source code to AST (ProgramNode)
        let ast = await codeToAST(sourceCode, sourceLanguage);

        // Step 1.5: Normalize AST for generation
        ast = normalizeAST(ast);

        // Step 2: Generate code in target language
        let generatedCode = '';

        switch (targetLanguage) {
            case 'c':
            case 'cpp': {
                const generator = new CGenerator();
                generatedCode = generator.generate(ast).code;
                break;
            }

            case 'micropython':
            case 'circuitpython':
            case 'python': {
                const generator = new PythonGenerator();
                const flavor: PythonFlavor = targetLanguage === 'circuitpython'
                    ? 'CIRCUITPYTHON'
                    : 'MICROPYTHON';
                generatedCode = generator.generate(ast, flavor).code;
                break;
            }

            case 'rust': {
                const generator = new RustGenerator();
                generatedCode = generator.generate(ast).code;
                break;
            }

            default:
                return {
                    success: false,
                    code: sourceCode,
                    warnings: [`Target language ${targetLanguage} not supported for transpilation`]
                };
        }

        return { success: true, code: generatedCode, warnings };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Transpilation failed: ${errorMessage}`);

        // Return original code with warning comment
        const warningComment = `\n/*\n * ### WARNING ###\n * ${sourceLanguage.toUpperCase()} -> ${targetLanguage.toUpperCase()} transpilation failed\n * Error: ${errorMessage}\n * ### WARNING ###\n */\n`;

        return {
            success: false,
            code: warningComment + sourceCode,
            warnings
        };
    }
}
