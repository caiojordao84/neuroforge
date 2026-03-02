// Teste de comentários em C/C++
// Usando ESM imports via ts-node/register

import { RecursiveDescentCParser } from '../src/engine/asl/plugins/c/CParser';

const code = `
// Comentário global antes de tudo
int led = 13; // Comentário inline de variável

/* Comentário
   multilinha 
   antes da função */

// Função principal
void setup() {
    // Comentário dentro de setup
    pinMode(led, OUTPUT); // Configura LED
    
    /* Comentário de bloco
       dentro da função */
    digitalWrite(led, HIGH);
}

void loop() {
    // Liga LED
    digitalWrite(led, HIGH);
    delay(1000);
    
    // Desliga LED
    digitalWrite(led, LOW);
    delay(1000);
}
`;

const parser = new RecursiveDescentCParser();
const { ast } = parser.parse(code);

console.log('=== AST com comentários ===\n');
console.log(JSON.stringify(ast, null, 2));
