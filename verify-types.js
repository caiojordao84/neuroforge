import { RecursiveDescentCParser } from './src/engine/asl/plugins/c/CParser.js';

const code = `
const int pinoLed = 13;
unsigned long ultimoTempoDebounce = 0; 
unsigned long tempoEspera = 250;

void loop() {
  unsigned long now = millis();
}
`;

try {
    const parser = new RecursiveDescentCParser();
    const { ast } = parser.parse(code);
    console.log("AST Structure for Global/Local Variables:");

    // Filter out only VariableDeclaration nodes
    const vars = ast.children.filter(c => c.nodeType === 'VariableDeclaration' || (c.nodeType === 'Function' && c.attributes.name === 'loop'));

    console.log(JSON.stringify(vars, (key, value) => {
        if (key === 'id' || key === 'metadata') return undefined;
        return value;
    }, 2));

} catch (e) {
    console.error(e);
}
