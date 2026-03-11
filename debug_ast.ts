import { PythonParser } from './src/engine/asl/plugins/python/PythonParser';
import { normalizeAST } from './src/engine/asl/transforms/astNormalizer';
import { astToASL } from './src/engine/asl/codeToASL';
import * as fs from 'fs';

async function run() {
    const code = `
import time
time.sleep_us(1500)
`;

    const parser = new PythonParser();
    await parser.init();
    const { ast, errors } = parser.parse(code);

    fs.writeFileSync('step1_ast.json', JSON.stringify(ast, null, 2));

    const normalized = normalizeAST(ast);
    fs.writeFileSync('step2_normalized.json', JSON.stringify(normalized, null, 2));

    const program = astToASL(normalized, 'python');
    fs.writeFileSync('step3_asl.json', JSON.stringify(program, null, 2));

    console.log("Done");
}

run();
