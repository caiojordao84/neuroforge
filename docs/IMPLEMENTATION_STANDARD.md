# Padrão de Implementação ASL - Plano de Execução

> **Versão**: 1.0  
> **Data**: Fevereiro 2026  
> **Objetivo**: Garantir consistência e completude na implementação de todas as linguagens, parsers, executores e geradores ASL.

---

## 1. Visão Geral do Padrão

### 1.1 Princípios Fundamentais

1. **Paridade de Funcionalidades**: Toda nova funcionalidade implementada em uma linguagem deve ser implementada em TODAS as outras linguagens supportadas.
2. **Arquitetura em Camadas**: Cada linguagem deve seguir o pipeline completo:
   - **Parser** → **ASL Intermediate** → **Executor** → **Generator**
3. **Escalabilidade**: O padrão deve facilitar a adição de novas linguagens (ADA, Forth, JS, Assembly, etc.)
4. **Documentação Inline**: Cada funcionalidade deve ter testes e documentação

### 1.2 Pipeline Completo

```
Código Fonte (Linguagem X)
        │
        ▼
┌───────────────────┐
│   Parser (X)      │  ← Tree-sitter ou Regex Custom
│   XParser.ts      │
└─────────┬─────────┘
          │ AST linguagem X
          ▼
┌───────────────────┐
│   Transform       │  ← Opcional: normalização
│   codeToASL.ts    │
└─────────┬─────────┘
          │ ASL (Intermediate)
          ▼
┌───────────────────┐
│   ASLExecutor.ts  │  ← Simulação JS
│   SimulationEngine│
└─────────┬─────────┘
          │ Execução
          ▼
┌───────────────────┐
│   Generator (X)   │  ← Código gerado
│   XGenerator.ts   │
└───────────────────┘
```

---

## 2. Checklist de Implementação por Camada

### 2.1 Camada 1: Parser (obrigatório para todas)

Para cada linguagem, o parser DEVE implementar:

| Categoria      | Item                  | Prioridade | Descrição                          |
| -------------- | --------------------- | ---------- | ---------------------------------- |
| **Controle**   | IfStatement           | 🔴 Alta     | Condicionais if/else               |
| **Controle**   | WhileLoop             | 🔴 Alta     | Loop while                         |
| **Controle**   | ForLoop               | 🔴 Alta     | Loop for                           |
| **Controle**   | Loop Infinito         | 🔴 Alta     | while(true) / loop                 |
| **Controle**   | SwitchStatement       | 🔴 Alta     | match/case                         |
| **Controle**   | BreakStatement        | 🔴 Alta     | break em loops                     |
| **Controle**   | ContinueStatement     | 🟡 Média    | continue em loops                  |
| **Controle**   | ReturnStatement       | 🔴 Alta     | retorno de funções                 |
| **Controle**   | DoWhile               | 🔴 Alta     | do-while loop                      |
| **Declaração** | VariableDeclaration   | 🔴 Alta     | declaração de variáveis            |
| **Declaração** | Function              | 🔴 Alta     | definição de funções               |
| **Declaração** | ArrayInitializer 1D   | 🔴 Alta     | arrays unidimensionais             |
| **Declaração** | ArrayInitializer 2D   | 🟡 Média    | arrays bidimensionais              |
| **Declaração** | ArrayInitializer 3D   | 🟢 Baixa    | arrays tridimensionais             |
| **Declaração** | StructDeclaration     | 🟡 Média    | structs                            |
| **Declaração** | EnumDeclaration       | 🟡 Média    | enums                              |
| **Expressão**  | Literal (int)         | 🔴 Alta     | inteiros                           |
| **Expressão**  | Literal (float)       | 🔴 Alta     | floats                             |
| **Expressão**  | Literal (string)      | 🔴 Alta     | strings                            |
| **Expressão**  | Boolean               | 🔴 Alta     | booleanos                          |
| **Expressão**  | Identifier            | 🔴 Alta     | identificadores                    |
| **Expressão**  | BinaryExpression      | 🔴 Alta     | operações binárias (+-*/%)         |
| **Expressão**  | UnaryExpression       | 🔴 Alta     | operações unárias (!, ++, --)      |
| **Expressão**  | ComparisonOperator    | 🔴 Alta     | comparações (==, !=, <, >, <=, >=) |
| **Expressão**  | SubscriptExpression   | 🔴 Alta     | indexação de arrays                |
| **Expressão**  | MemberExpression      | 🟡 Média    | acesso a membros (.attr)           |
| **Expressão**  | ConditionalExpression | 🟡 Média    | ternary (?:)                       |
| **Hardware**   | GpioSet               | 🔴 Alta     | digitalWrite / Pin.value(1)        |
| **Hardware**   | GpioRead              | 🔴 Alta     | digitalRead / Pin.value()          |
| **Hardware**   | AnalogWrite           | 🔴 Alta     | analogWrite                        |
| **Hardware**   | AnalogRead            | 🔴 Alta     | analogRead                         |
| **Hardware**   | DelayMs               | 🔴 Alta     | delay / sleep_ms                   |
| **Hardware**   | millis()              | 🔴 Alta     | millis()                           |
| **Hardware**   | micros()              | 🔴 Alta     | micros()                           |
| **Hardware**   | pinMode               | 🔴 Alta     | pinMode / direction                |
| **Hardware**   | random()              | 🔴 Alta     | random()                           |
| **Serial**     | Print                 | 🔴 Alta     | Serial.print / print()             |
| **Serial**     | Serial.begin          | 🟡 Média    | Serial.begin                       |
| **Serial**     | Serial.available      | 🟡 Média    | Serial.available                   |
| **Serial**     | Serial.readString     | 🟡 Média    | Serial.readString                  |

### 2.2 Camada 2: ASLExecutor (obrigatório)

O executor DEVE implementar:

| Categoria  | Função                   | Descrição                   |
| ---------- | ------------------------ | --------------------------- |
| **Math**   | abs()                    | Valor absoluto              |
| **Math**   | sqrt()                   | Raiz quadrada               |
| **Math**   | pow()                    | Potência                    |
| **Math**   | sin(), cos(), tan()      | Funções trigonométricas     |
| **Math**   | log()                    | Logaritmo                   |
| **Math**   | min(), max()             | Mínimo e máximo             |
| **Math**   | round(), floor(), ceil() | Arredondamento              |
| **Math**   | random(min, max)         | Random com intervalo        |
| **Math**   | random(max)              | Random de 0 a max-1         |
| **Math**   | map()                    | Mapeamento de valores       |
| **Math**   | constrain()              | Limitação de valores        |
| **Type**   | int()                    | Conversão para inteiro      |
| **Type**   | float()                  | Conversão para float        |
| **Type**   | String()                 | Conversão para string       |
| **Size**   | sizeof()                 | Tamanho de array            |
| **Time**   | millis()                 | Milissegundos desde início  |
| **Time**   | micros()                 | Microsegundos desde início  |
| **Time**   | delay()                  | Atraso em ms                |
| **Time**   | delayMicroseconds()      | Atraso em us                |
| **String** | strlen()                 | Comprimento de string       |
| **String** | strcmp()                 | Comparação de strings       |
| **String** | atoi(), atof()           | Conversão ASCII para número |
| **Serial** | Serial.write()           | Escrita serial              |
| **Serial** | Serial.read()            | Leitura serial              |
| **Serial** | Serial.available()       | Bytes disponíveis           |
| **Serial** | Serial.parseInt()        | Parse de inteiro            |

### 2.3 Camada 3: Hardware Específico (por linguagem)

| Módulo            | Descrição                  | C/C++ | Python | Rust  | outras |
| ----------------- | -------------------------- | :---: | :----: | :---: | :----: |
| LCD               | Display LCD 16x2/20x4      |   ✅   |   ❌    |   ❌   |   ❌    |
| OLED              | Display OLED               |   ✅   |   ❌    |   ❌   |   ❌    |
| Seven Segment     | Display 7 segmentos        |   ✅   |   ❌    |   ❌   |   ❌    |
| Keypad            | Teclado matricial          |   ✅   |   ❌    |   ❌   |   ❌    |
| DHT               | Sensor temperatura/umidade |   ✅   |   ❌    |   ❌   |   ❌    |
| Ultrasonic        | Sensor ultrassônico        |   ✅   |   ❌    |   ❌   |   ❌    |
| LDR               | Sensor de luz              |   ✅   |   ❌    |   ❌   |   ❌    |
| IR                | Receptor IR                |   ✅   |   ❌    |   ❌   |   ❌    |
| Motors            | Controle de motores        |   ✅   |   ❌    |   ❌   |   ❌    |
| MPU/IMU           | Acelerômetro/Giroscópio    |   ✅   |   ❌    |   ❌   |   ❌    |
| RGB/NeoPixel      | LEDs RGB                   |   ✅   |   ❌    |   ❌   |   ❌    |
| WiFi              | Conexão WiFi               |   ✅   |   ❌    |   ❌   |   ❌    |
| HTTP              | Requisições HTTP           |   ✅   |   ❌    |   ❌   |   ❌    |
| SPIFFS            | Sistema de arquivos        |   ✅   |   ❌    |   ❌   |   ❌    |
| Servo             | Controle de servo          |   ⚠️   |   ❌    |   ❌   |   ❌    |
| EEPROM            | Memória EEPROM             |   ❌   |   ❌    |   ❌   |   ❌    |
| Wire/I2C          | Comunicação I2C            |   ❌   |   ❌    |   ❌   |   ❌    |
| SPI               | Comunicação SPI            |   ❌   |   ❌    |   ❌   |   ❌    |
| tone()            | Gerador de tons            |   ⚠️   |   ❌    |   ❌   |   ❌    |
| attachInterrupt() | Interrupções               |   ❌   |   ❌    |   ❌   |   ❌    |
| pulseIn()         | Leitura de pulso           |   ❌   |   ❌    |   ❌   |   ❌    |
| shiftOut()        | Shift register             |   ❌   |   ❌    |   ❌   |   ❌    |

### 2.4 Camada 4: Generator (obrigatório para round-trip)

Para cada linguagem, o gerador DEVE implementar a conversão ASL → código fonte.

---

## 3. Fases de Implementação

### Fase 1: Baseline (Todas as linguagens existentes)

**Objetivo**: Atingir paridade entre C/C++, Python e Rust

| #    | Tarefa                                                | Responsável  | Dependência |
| ---- | ----------------------------------------------------- | ------------ | ----------- |
| 1.1  | Implementar Math Builtins no ASLExecutor              | ASL Executor | -           |
| 1.2  | Implementar sizeof no ASLExecutor                     | ASL Executor | 1.1         |
| 1.3  | Implementar DoWhile no CParser                        | CParser      | -           |
| 1.4  | Implementar DoWhile no ASLExecutor                    | ASL Executor | 1.3         |
| 1.5  | Implementar delayMicroseconds no ASLExecutor          | ASL Executor | -           |
| 1.6  | Implementar continue no Python Tree-sitter            | PythonParser | -           |
| 1.7  | Implementar return no Python Regex                    | PythonParser | -           |
| 1.8  | Implementar break/continue no RustParser              | RustParser   | -           |
| 1.9  | Implementar return no RustParser                      | RustParser   | -           |
| 1.10 | Implementar StructDeclaration no RustParser           | RustParser   | -           |
| 1.11 | Implementar GpioRead/AnalogRead no Python Tree-sitter | PythonParser | -           |
| 1.12 | Implementar GpioRead/AnalogRead no RustParser         | RustParser   | -           |
| 1.13 | Implementar Serial extensions no ASLExecutor          | ASLExecutor  | -           |
| 1.14 | Implementar float no RustParser                       | RustParser   | -           |
| 1.15 | Implementar SubscriptExpression no RustParser         | RustParser   | -           |

### Fase 2: Hardware Parity

**Objetivo**: Uniformizar hardware entre linguagens

| #   | Tarefa                                               | Responsável  | Dependência |
| --- | ---------------------------------------------------- | ------------ | ----------- |
| 2.1 | Implementar LCD/OLED/7Seg no Python                  | PythonParser | 1.1         |
| 2.2 | Implementar LCD/OLED/7Seg no Rust                    | RustParser   | 1.1         |
| 2.3 | Implementar Sensors (DHT, Ultrasonic, etc) no Python | PythonParser | 1.1         |
| 2.4 | Implementar Sensors no Rust                          | RustParser   | 1.1         |
| 2.5 | Implementar Servo no ASLExecutor                     | ASLExecutor  | -           |
| 2.6 | Implementar EEPROM/Wire/SPI no ASLExecutor           | ASLExecutor  | -           |

### Fase 3: Novas Linguagens

**Objetivo**: Adicionar linguagens seguindo o padrão

| #   | Linguagem             | Parser          | Executor | Generator | Prioridade |
| --- | --------------------- | --------------- | -------- | --------- | ---------- |
| 3.1 | JavaScript/TypeScript | Tree-sitter JS  | Shared   | Novo      | Alta       |
| 3.2 | Blockly               | Custom          | Shared   | Novo      | Alta       |
| 3.3 | Flowchart             | Custom          | Shared   | Novo      | Alta       |
| 3.4 | Ada                   | Tree-sitter Ada | Shared   | Novo      | Média      |
| 3.5 | Forth                 | Custom          | Shared   | Novo      | Média      |
| 3.6 | Assembly (AVR)        | Custom          | Shared   | Novo      | Baixa      |
| 3.7 | Lua/NodeMCU           | Tree-sitter Lua | Shared   | Novo      | Baixa      |
| 3.8 | IEC 61131-3 (ST/LD)   | Custom          | Shared   | Novo      | Média      |

### Fase 4: Features Avançadas

| #   | Tarefa                                       | Responsável  | Dependência |
| --- | -------------------------------------------- | ------------ | ----------- |
| 4.1 | Implementar attachInterrupt/pulseIn/shiftOut | ASL Executor | Fase 2      |
| 4.2 | Implementar WiFi/HTTP no Python              | PythonParser | 2.3         |
| 4.3 | Implementar WiFi/HTTP no Rust                | RustParser   | 2.4         |
| 4.4 | Implementar range-based for no CParser       | CParser      | -           |

---

## 4. Template de Implementação

### 4.1 Template para novo Parser

```typescript
// src/engine/asl/plugins/{lang}/{Lang}Parser.ts
export class {Lang}Parser {
    // Implementar segundo o padrão:
    // 1. parse(source: string) → AST
    // 2. visit(node) → BaseNode (ASL)
    // 3. mapToASL(ast) → ASLProgram
}
```

### 4.2 Template para novo Generator

```typescript
// src/engine/asl/plugins/{lang}/{Lang}Generator.ts
export class {Lang}Generator {
    // Implementar segundo o padrão:
    // 1. generate(program: ASLProgram) → string
    // 2. genStatement(stmt) → string
    // 3. genExpr(expr) → string
}
```

---

## 5. Critérios de Qualidade

### 5.1 Testes Obrigatórios

Para cada funcionalidade implementada, DEVE existir:

1. **Teste Unitário**: Teste específico do parser/gerador
2. **Teste de Integração**: Teste end-to-end (código → ASL → execução)
3. **Teste de Round-trip**: Código → ASL → Código gerado → ASL (deve ser idêntico)

### 5.2 Cobertura Mínima

| Camada    | Cobertura Mínima              |
| --------- | ----------------------------- |
| Parser    | 90% das features obrigatórias |
| Executor  | 100% dos builtins listados    |
| Generator | 80% das features do parser    |

### 5.3 Documentação

Cada nova funcionalidade DEVE incluir:

1. Descrição em `docs/ASL_PARSER_COMPARISON.md`
2. Atualização em `notyet/README.md` (se aplicável)
3. Comentários no código seguindo o padrão existente

---

## 6. Matriz de Responsabilidades

| Componente       | Responsável              | Revisor   |
| ---------------- | ------------------------ | --------- |
| CParser          | Equipe C++               | ASL Lead  |
| PythonParser     | Equipe Python            | ASL Lead  |
| RustParser       | Equipe Rust              | ASL Lead  |
| ASLExecutor      | ASL Lead                 | Tech Lead |
| SimulationEngine | Platform Lead            | ASL Lead  |
| Generators       | Cada equipe de linguagem | ASL Lead  |
| Novas Linguagens | Feature Owner            | ASL Lead  |

---

## 7. Referências

- [ASL_PARSER_COMPARISON.md](./ASL_PARSER_COMPARISON.md) - Estado atual
- [notyet/README.md](../notyet/README.md) - Roadmap completo
- [ROADMAP.md](./ROADMAP.md) - Visão macro do produto

---

## 8. Histórico de Versões

| Versão | Data                    | Descrição                |
| ------ | ----------------------- | ------------------------ |
| 1.0    | 26 de Fevereiro de 2026 | Versão inicial do padrão |
