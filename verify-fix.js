import { RecursiveDescentCParser } from './src/engine/asl/plugins/c/CParser.js';
import { astToASL } from './src/engine/asl/codeToASL.js';

const code = `
void loop() {
  if (true) {
    Serial.println("IF");
  } else {
    Serial.println("ELSE");
  }
}
`;

try {
    const parser = new RecursiveDescentCParser();
    const { ast } = parser.parse(code);
    console.log("AST Structure for IfStatement:");
    const ifNode = ast.children[0].children[0].children[0]; // Function -> ExpressionStatement -> IfStatement (simplified traversal for debug)
    console.log(JSON.stringify(ifNode, (key, value) => {
        if (key === 'id') return undefined; // simplify output
        return value;
    }, 2));

    const asl = astToASL(ast);
    const loopTask = asl.tasks.find(t => t.name === 'mainLoop');
    console.log("\nGenerated ASL for Loop Task:");
    console.log(JSON.stringify(loopTask?.body, null, 2));
} catch (e) {
    console.error(e);
}
