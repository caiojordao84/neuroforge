# ROADMAP_TO_ASL

Este documento descreve a evolução do NeuroForge como plataforma de simulação e transpilação para sistemas embarcados, tendo o ASL (Abstract Simulation Language) como representação intermediária universal. O fio condutor é a integração completa do conteúdo de notyet/ no core (src/engine), eliminando a pasta ao final do processo.

Marcadores de status:
[x] Concluído
[~] Em progresso / estabilização
[ ] Planejado
[?] Em pesquisa / a definir

## 0. Estado atual (baseline)

### 0.1. ASL no core
[x] ASLTypes.ts: definição do AST — ASLProgram, globals, functions, tasks, statements, expressions.
[x] ASLExecutor.ts: executor JS que percorre o ASL e chama SimulationEngine.
[x] codeToASL.ts: transpiler C++ Arduino subset → ASL (v0).
[x] Integração na TopToolbar: modo JS em C++ tenta ASL primeiro, fallback para CodeParser legado.

### 0.3. Fluxo de trabalho atual (C++ / MicroPython → ASL → SimulationEngine)

[x] CodeEditorWithTabs.tsx:
    - Gerencia múltiplas abas de código e a linguagem ativa (C++, MicroPython).
    - Expõe o conteúdo atual e metadados (linguagem, placa) para a TopToolbar.

[x] LanguageRegistry.ts:
    - Registro central de linguagens: mapeia labels ("C++ Arduino", "MicroPython") para:
      - extensões / ids internos,
      - função de parsing/transpilação → ASL (ex.: CParser + codeToASL, PythonParser + codeToASL).
    - Único lugar onde decidimos se uma linguagem suporta ASL ou cai no parser legado.

[x] TopToolbar.tsx:
    - Botão Run em modo fake:
      - Obtém código atual do CodeEditorWithTabs.
      - Resolve a linguagem via LanguageRegistry.
      - Chama o pipeline de transpilação → ASL (codeToASL).
      - Cria um ASLRuntime (ASLExecutor) e inicializa o SimulationEngine em modo fake.
    - Fallback: se a linguagem/board não suportar ASL, usa o fluxo CodeParser legado.

[x] codeToASL.ts:
    - Converte AST de entrada (CParser para C++, PythonParser para MicroPython) em ASLProgram:
      - Preenche globals, functions e tasks (setup/loop → functions/tasks, outras funções → ASLFunction).
      - Converte statements (if/while/for/return/break/continue, pinMode/digitalWrite/delay, Serial.print* etc.).
      - Converte expressões (aritméticas, lógicas, chamadas, leituras de pinos).

[x] ASLTypes.ts:
    - Fonte única de verdade do schema ASL: ASLProgram, ASLStatement, ASLExpr, ASLFunction, tasks.

[x] ASLExecutor.ts:
    - Interpreta um ASLProgram:
      - Mantém ambiente de variáveis globais/locais.
      - Executa controle de fluxo (if, while, for lowerizado, break, continue, return).
      - Avalia expressões (aritméticas, lógicas, chamadas de função).
      - Faz ponte com o SimulationEngine para GPIO, delays, Serial/log, random, digitalRead/analogRead, millis/micros.

[x] SimulationEngine.ts:
    - Gerencia o ciclo de simulação (start/pause/stop, loop assíncrono sem sobreposição).
    - Expõe primitivos de hardware:
      - pinMode/digitalWrite/analogWrite/digitalRead/analogRead.
      - delay(ms) com speedMultiplier.
      - millis()/micros() relativos ao início da simulação.
      - Serial.begin / Serial.print* / log.
    - Notifica UI via eventos (pinChange, serialTransmit, simulationStopped).

[x] ASLViewer.tsx:
    - Exibe o ASL gerado para o código atual:
      - Visualização da estrutura (globals, functions, tasks).
      - Útil para debugging e ensino (ver exatamente o que o transpiler entendeu).


### 0.2. Subset C++ suportado (v0) - Detalhamento completo

#### Statements

**Globais e Locais:**
[x] Declaração global simples: `int x = 0;` fora de setup/loop (vira ASLGlobalVar com literal numérico).
[x] Declaração local simples: `int i = 0;` em setup/loop (vira assign com literal/constante HIGH/LOW/true/false/número).
[ ] Declaração global de array: `const int LED_PINS[6] = {3, 4, 5, 6, 7, 8};` (regex não reconhece [tamanho] nem inicializador {...}).
[ ] Declaração local de array: `int valores[5] = {1, 2, 3, 4, 5};` (sem parser para arrays).
[~] Declaração local com expressão: `int delayTime = 1000 - (i * 100);` (parser de expressões já existe, mas ainda não cobrimos todos os casos no roadmap/fixtures).

**Atribuições:**
[x] Incremento/decremento: `i = i + 1;`, `i = i - 1;` (quando variável é a mesma dos dois lados, gera binary +/-).
[x] Atribuição simples genérica: `x = expr;` (CParser parseia = como operador binário com precedência baixa e codeToASL gera assign com RHS arbitrário).
[ ] Atribuição a elemento de array: `LED_PINS[2] = 10;` (sem suporte a indexação no transpiler nem executor).

**Operações de hardware:**
[x] pinMode: `pinMode(PIN, MODE);` onde MODE ∈ {INPUT, OUTPUT, INPUT_PULLUP}, mas PIN só aceita \w+, não indexação.
[ ] pinMode com array: `pinMode(LED_PINS[i], OUTPUT);` (LED_PINS[i] não bate no pattern \w+, linha ignorada).
[x] digitalWrite: `digitalWrite(PIN, HIGH/LOW);` (aceita expr simples como valor).
[ ] digitalWrite com array: `digitalWrite(LED_PINS[i], HIGH);` (mesmo problema de pattern: não reconhece indexação).
[x] analogWrite: `analogWrite(PIN, VAL);` (VAL vira literal ou var via makeVarOrLiteral).
[x] delay: `delay(1000);` ou `delay(delayTime);` (argumento tratado como literal/var simples).
[x] Leitura digital (decl): `int v = digitalRead(PIN);` (gera statement read com mode: 'DIGITAL').
[x] Leitura digital (assign): `v = digitalRead(PIN);` (mesmo read, sem nova declaração).

**Controle de fluxo:**
[x] if de uma linha: `if (COND) stmt;` (condição passa pelo parser de expressões e corpo vira 1 statement).
[x] if/else simples: blocos { ... } aninhados.
[x] else if em cascata: reescrito como else { if (...) { ... } }.
[x] Normalização: } else { e if (cond)\n{ tratados corretamente.
[x] while: `while (COND) { ... }` (usa parseConditionExpr para a condição).
[x] for simples: `for (init; cond; inc) { body }` (convertido para init; while (cond) { body; inc; }).
[ ] for sem cond: `for(;;)` ou `for(;;inc)` (hoje lança erro "for without condition not supported yet").
[~] Outros statements: return, break, continue, funções customizadas (CParser + codeToASL + ASLExecutor já suportam return/break/continue e funções void sem parâmetros, mas ainda falta consolidar o subset e fixtures no roadmap).

#### Expressões em condições

[x] Negação: `!flag` (unary '!' com makeVarOrLiteral(flag)).
[x] Igualdade: `a == b` (binary '==' com left/right convertidos).
[x] Diferente: `a != b` (binary '!=').
[x] Menor que: `i < 10` (binary '<').
[x] Menor ou igual: `i <= max` (binary '<=').
[x] Maior que: `i > 0` (binary '>').
[x] Maior ou igual: `i >= 0` (binary '>=').
[x] Literais/variáveis nuas: `flag`, `10` (vão direto para makeVarOrLiteral, interpretado como truthy/falsy).
[x] Expressões lógicas compostas: `a && b`, `a || b` (CParser usa parseExpression com precedência para &&/||, executor já avalia).

#### Expressões no lado direito de `=` / declarações

[x] Literal/constante simples: `int i = 0;` (vira literal numérica/booleana ou HIGH/LOW).
[~] Var simples: `x = y;` (CParser e executor suportam, mas ainda falta consolidar o subset/fixtures).
[x] Binário simples: `i = i + 1;`, `i = i - 1;` (incremento/decremento quando variável é a mesma dos dois lados).
[ ] Multiplicação: `x = i * 100;` (precisa fixtures e validação, executor já tem *).
[ ] Expressão composta: `int delayTime = 1000 - (i * 100);` (parser de expressões já existe, falta fechar o subset/fixtures).
[ ] Indexação de array: `int pin = LED_PINS[i];` (sem suporte a arrays: não há AST para indexação, nem avaliação no executor).
[ ] Inicializador de array: `int arr[3] = {1, 2, 3};` (parser não reconhece sintaxe [tamanho] nem {...}).
[ ] Expressões complexas: `x = a + b * c / 2;` (ainda fora do escopo da ASL v0).

#### Tipos de dados e estruturas

[x] Variáveis escalares: `int x;`, `float y;`, `bool flag;` (funcionam tanto globais quanto locais com inicialização).
[ ] Arrays estáticos: `int pins[6] = {3,4,5,6,7,8};` (não há parser para declaração nem representação no IR/executor).
[ ] Acesso por índice: `pins[i]`, `pins[2]` (nenhum ASLExpr representa indexação; executor usa Map<string, any> simples).
[ ] Strings: `char msg[] = "Hello";` (não suportado).
[ ] Structs/classes: `struct Point { int x, y; };` (não suportado).

#### Operadores aritméticos no executor ASL

[x] `+`: binary('+', a, b) - já funciona.
[x] `-`: binary('-', a, b) - já funciona.
[x] `*`: binary('*', a, b) - já funciona.
[x] `/`: binary('/', a, b) - já funciona.
[x] `%`: binary('%', a, b) - já funciona.
[x] `&&`: binary('&&', a, b) - já funciona.
[x] `||`: binary('||', a, b) - já funciona.

### 0.3. Ferramentas em notyet/ (a integrar)
[ ] notyet/app/system/Lexer.ts
[ ] notyet/app/system/SymbolTable.ts
[ ] notyet/app/system/flow/CfgBuilder.ts
[ ] notyet/app/system/flow/FlowValidator.ts
[ ] notyet/app/system/flow/FlowToAst.ts
[ ] notyet/app/system/blockly/BlocklyParser.ts
[ ] notyet/app/system/blockly/CodeToBlockly.ts
[ ] notyet/app/system/simulator/SimulatorInterpreter.ts

## 1. Decisões arquiteturais (ADRs obrigatórios)
Antes de qualquer integração, estas decisões devem ser tomadas e documentadas em docs/architecture/.

### 1.1. Schema do ASL
[ ] Definir níveis do schema:
Core: controle de fluxo, expressões, variáveis, funções.
Hardware: GPIO, PWM, UART, I2C, SPI, timers industriais.
Language-specific: nós que não têm equivalente universal (escape hatch controlado).
[ ] Formalizar tipos de nó que hoje faltam: For, Switch, FunctionDef, FunctionCall, Millis, TimerTON/TOF/TP, CounterCTU/CTD, LatchSR/RS, TrigR/F, PWMInit/SetDuty/SetFreq/Stop, UARTWrite/Read, I2CRead/Write.
[ ] Definir política de "raw code": permitido apenas como escape hatch explícito com validação e aviso, nunca como fallback silencioso.
[ ] Validação do schema: Zod, JSON Schema, ou tipos TypeScript puros — todos os geradores emitem ASL validado antes de chegar ao executor.

### 1.2. Multi-pass pipeline
[ ] Formalizar os passes: Parsing → Normalização → Análise/Verificação → Detecção de padrões → Otimização leve → Emissão ASL.
[ ] Definir se existe IR intermediário entre o parser e a emissão ASL, ou se a emissão é direta.
[ ] Plugin system: API de plugin (entry points, ciclo de vida, comunicação entre plugins).

### 1.3. Parser technology
[x] Avaliar web-tree-sitter para C, C++, Python... (Utilizado para Python/MicroPython).
[ ] Definir onde parsers customizados são necessários: Assembly, Ada, Forth, Zig.
[x] Estratégia de fallback: erro com localização (linha/coluna) ou degradação para parser legado (Implementado no TopToolbar).

### 1.4. Executor e runtime
[ ] Confirmar ASLExecutor como o único runtime oficial para simulação JS.
[ ] Definir papel do SimulatorInterpreter (vindo de notyet/).
[ ] Garantir que SimulationEngine.reset() zera todos os estados antes de cada execução.

### 1.5. Round-trip como eixo do produto
[ ] Formalizar que o ASL é o pivô de todas as conversões nos dois sentidos:
Código (qualquer linguagem) → ASL → Visual (Blockly / Flow / Ladder / Industrial).
Visual (Blockly / Flow / Ladder / Industrial) → ASL → Código (qualquer linguagem).
[ ] Definir política de "perda de informação" nas conversões (ex.: raw code que não tem representação em blocos vira "Custom block"; state machine complexa que não estruturiza vira aviso no flowchart).

## 2. Estrutura alvo do core (árvore de pastas)
```text
src/
  engine/
    SimulationEngine.ts
    QEMUSimulationEngine.ts
    QEMURunner.ts
    CodeParser.ts          (legado, removido quando ASL cobrir 100% do subset)
    Transpiler.ts

    asl/
      ASLTypes.ts           (fonte única de verdade do schema)
      ASLExecutor.ts
      codeToASL.ts
      LanguageRegistry.ts   (registro central de linguagens)

    tools/
      lexer/
        Lexer.ts
      symbols/
        SymbolTable.ts

      flow/
        CfgBuilder.ts
        FlowValidator.ts
        FlowToASL.ts
        ASLToFlow.ts        (novo: ASL → grafo de fluxo)
        flow.types.ts

      blockly/
        BlocklyToASL.ts
        ASLToBlockly.ts
        blockly.types.ts

      simulator/
        SimulatorInterpreter.ts
```

## 3. Round-trip completo: Código ↔ ASL ↔ Visual
Este é um eixo central do produto. Os dois sentidos devem ser tratados como capacidades de primeira classe.

### 3.1. Sentido: Código → ASL → Visual
[ ] Código (C++, Python, JS, Rust, etc.) → ASL via transpiler correspondente.
[ ] ASL → Blockly: ASLToBlockly.ts converte nós ASL para workspace Blockly (XML/JSON).
    - Nós sem representação em bloco → "Custom code block" com conteúdo textual.
    - Funções de usuário → "Procedure block".
[ ] ASL → Flowchart: ASLToFlow.ts converte nós ASL para grafo React Flow.
    - If → Decision node com arestas True/False.
    - While/For → Loop node com back-edge.
    - FunctionCall → Process node.
    - State machine complexa → aviso de "não estruturizável visualmente".
[ ] ASL → Ladder/Industrial: conversão de nós hardware (GpioSet/Read, timers, counters) para rungs e blocos de função IEC 61131-3.

### 3.2. Sentido: Visual → ASL → Código
[ ] Blockly → ASL: BlocklyToASL.ts (vindo de notyet/) converte workspace para ASLProgram.
[ ] Flowchart → ASL: FlowToASL.ts (vindo de notyet/) via CFG.
[ ] Ladder/Industrial → ASL: blocos IEC (TON/TOF/CTU/CTD/SR/RS/TRIG) → nós ASL formais.
[ ] ASL → Código: code generators por linguagem alvo (ver seção 9).

### 3.3. Política de round-trip
[ ] Subset "perfeito" (vai e volta sem perda): controle de fluxo básico (if/while/for), GPIO, delay, variáveis simples.
[ ] Subset "com aviso" (perde detalhes, mas funciona): raw code, expressões muito complexas, macros.
[ ] Subset "sem suporte" (erro explícito): recursão, alocação dinâmica, assembly inline.

## 4. ASL v1 — Controle de fluxo completo e expressões

### 4.1. Controle de fluxo
[x] else if em cascata: lowering para if aninhado no ASL.
[x] if aninhado dentro de blocos then/else.
[x] while (cond) { ... } end-to-end.
[x] for contador simples: lowering para init-assign + ASLWhile + increment.
[x] break e continue dentro de loops.
[ ] switch/case simples.

### 4.2. Expressões
[x] Operadores relacionais: <, >, <=, >=.
[x] Operadores booleanos básicos em executor: &&, ||.
[x] Operadores lógicos compostos no parser de condições: `a && b`, `a || b` como AST aninhado.
[x] Expressões aritméticas simples em assign: `i = i + 1`, `i = i - 1`.
[ ] Expressões aritméticas gerais: `x = y + 1`, `x = a * b`, `x = 1000 - (i * 100)` (parser de expressões no RHS).
[x] Operador `%` (módulo) no executor.
[x] Operadores unários: `++i`, `--i`, `i++`, `i--`.

### 4.3. Arrays e indexação
[ ] Declaração de arrays globais: `const int pins[6] = {3,4,5,6,7,8};`.
[ ] Declaração de arrays locais: `int valores[5] = {1,2,3,4,5};`.
[ ] Acesso por índice: `pins[i]`, `pins[2]` como ASLExpr (novo kind: 'index').
[ ] Atribuição a elemento de array: `pins[2] = 10;`.
[ ] Representação de arrays no executor: `env.set('pins', [3,4,5,6,7,8])`.
[ ] Avaliação de indexação no executor: `evalExpr({kind:'index', array:'pins', index:expr})`.

### 4.4. Mensagens de erro
[ ] Indicar linha e trecho exato do código não suportado.
[ ] Distinguir "subset não suporta" de "sintaxe inválida".

## 5. ASL v2 — Funções, tarefas e eventos
[ ] Funções de usuário: ASLFunctionDef e ASLCall; subset C++ void foo() sem parâmetros primeiro, depois com parâmetros escalares.
[ ] Múltiplas tasks além de mainLoop com escalonamento round-robin ou por período.
[ ] Eventos simples (API de alto nível): "quando entrada muda de LOW→HIGH, execute bloco X".

## 6. Multi-pass pipeline e plugin system

### 6.1. Passes formais
[ ] Pass 1 — Parsing: por linguagem, produz AST de alto nível.
[ ] Pass 2 — Normalização: AST específico → IR comum (If, While, For, Block, Call, Assign, IO ops).
[ ] Pass 3 — Análise e verificação: tipos básicos, usos inválidos, warnings pedagógicos.
[ ] Pass 4 — Detecção de padrões de hardware:
    - PWM bit-banging (GPIO toggle + delays).
    - Polling pattern (while + read).
    - State machine pattern (switch em loop).
    - Busy-wait delays (loops vazios).
[ ] Pass 5 — Otimização leve: constant folding, remoção de código morto, simplificação de condições triviais.
[ ] Pass 6 — Emissão ASL: IR comum → ASLProgram.

### 6.2. Plugin system
[ ] API de plugin com entry points definidos por pass.
[ ] Plugin loader e registry.
[ ] Ciclo de vida: load, execute, unload.
[ ] Contexto compartilhado entre plugins (tabela de símbolos, metadados de hardware).

## 7. Linguagens de entrada → ASL

### 7.1. C / Arduino C++
[x] Subset básico v0 (veja seção 0.2 para detalhamento completo).
[x] Suporte para linguagem 'c' pura em codeToASL.ts.
[~] Controle de fluxo completo (v1): while e for simples já funcionam; faltam break, continue, switch.
[ ] Expressões gerais no RHS de atribuições.
[ ] Arrays e indexação.
[~] APIs adicionais: analogRead, millis, micros, Serial.print já suportadas em ASLExecutor/SimulationEngine; tone ainda sem simulação dedicada.
[ ] Parser via Tree-sitter C/C++.

### 7.2. MicroPython / CircuitPython
[x] Execução via ASL (MicroPython/CircuitPython/Python).
[x] Python support: Pin, value(), on(), off(), time.sleep_ms(), if/else, while True.
[x] Parser via Tree-sitter Python (web-tree-sitter).

### 7.3. JavaScript / TypeScript
[ ] Subset com setup()/loop(), IO ops, if/else, while, for.
[ ] Parser via Tree-sitter JS/TS.

### 7.4. Rust (embedded subset)
[ ] Subset fn setup(), fn loop(), tipos escalares.
[ ] Macros/wrappers NeuroForge como interface previsível.
[ ] Parser via Tree-sitter Rust.

### 7.5. Zig
**Instalação e toolchain:**
[ ] Documentar instalação do compilador Zig (binário oficial, sem dependências extras).
[ ] Verificar se web-tree-sitter tem grammar Zig disponível; se não, desenvolver grammar mínima para o subset.
[ ] Definir wrappers de IO NeuroForge para Zig (ex.: neuroforge.digitalWrite, neuroforge.delay).

**Parser e generator:**
[ ] Parser para subset pub fn setup(), pub fn loop(), tipos básicos (u8, i32, bool), if/while/for.
[ ] zigToASL.ts: subset → ASL.
[ ] ASLToZig.ts: ASL → código Zig válido.
[ ] Fixtures de teste: blink, button, PWM, if/else, loops.

### 7.6. Ada
**Instalação e toolchain:**
[ ] Documentar instalação do GNAT (FSF GNAT via apt/brew, ou GNAT Community Edition).
[ ] Definir se o compilador é necessário apenas para validação (gerar + compilar para checar) ou se o subset é executado só via ASL.
[ ] Avaliar grammar Ada para Tree-sitter; se não existir ou for incompleta, desenvolver parser customizado para o subset.
[ ] Definir wrappers de IO NeuroForge para Ada (procedure DigitalWrite, function DigitalRead, etc.).

**Parser e generator:**
[ ] Parser para subset: procedure Setup, procedure Loop, if/elsif/else, while, case.
[ ] adaToASL.ts: subset → ASL.
[ ] ASLToAda.ts: ASL → código Ada válido (compilável com GNAT).
[ ] Fixtures de teste: blink, button, PWM, if/else, loops.

### 7.7. Forth
**Instalação e toolchain:**
[ ] Documentar instalação de um Forth de referência (ex.: Gforth via apt/brew) para validação.
[ ] Definir vocabulário NeuroForge para Forth: palavras como PINOUTPUT, PININPUT, DIGITAL-WRITE, DIGITAL-READ, ANALOG-WRITE, DELAY-MS.
[ ] Definir delimitadores de setup e loop no vocabulário (ex.: : SETUP ... ; e : LOOP ... ;).

**Parser e generator:**
[ ] Desenvolver parser customizado para o subset (stack-based, tokenização por palavras).
[ ] forthToASL.ts: sequências de palavras → IR linear + controle de fluxo → ASL.
[ ] ASLToForth.ts: ASL → sequências de palavras Forth válidas.
[ ] Fixtures de teste: blink, button, delay, if/else equivalente (IF ... ELSE ... THEN).

### 7.8. Assembly (subset didático)
**Instalação e toolchain:**
[ ] Definir arquitetura alvo inicial (AVR 8-bit ou ARM Cortex-M).
[ ] Documentar instalação do assembler de referência (ex.: avr-as para AVR, arm-none-eabi-as para ARM).
[ ] Definir subset de instruções mapeáveis para operações ASL:
    - AVR: OUT PORTB, Rn → GpioSet, IN Rn, PINB → GpioRead, RCALL delay → DelayMs.
    - ARM: equivalentes para GPIO via MMIO.

**Parser e generator:**
[ ] Desenvolver parser customizado para o subset de instruções definido.
[ ] assemblyToASL.ts: pseudo-instruções → ASL (sem montar binário real).
[ ] ASLToAssembly.ts: ASL → pseudo-assembly comentado (finalidade didática).
[ ] Fixtures de teste: blink e read de pino em assembly subset.

### 7.9. Lua / NodeMCU
[ ] Subset com funções e chamadas de IO.
[ ] Parser via Tree-sitter Lua.
[ ] luaToASL.ts e ASLToLua.ts.

## 8. Entradas visuais → ASL

### 8.1. Flowchart
[ ] Migrar CfgBuilder, FlowValidator, FlowToASL para src/engine/tools/flow/.
[ ] FlowToASL importa tipos de src/engine/asl/ASLTypes.ts.
[ ] Estratégia de geração explícita: structured vs. state machine.
[ ] Blocos industriais como nós ASL formais: TimerTON/TOF/TP, CounterCTU/CTD, LatchSR/RS, TrigR/F, ops matemáticas.
[ ] Templates industriais: TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG, state machine diagram, GRAFCET básico.
[ ] IEC 61131-3 Structured Text (ST) como linguagem textual adicional (próxima de Pascal/PLC).

### 8.2. Blockly
[ ] Migrar BlocklyParser → BlocklyToASL e CodeToBlockly → ASLToBlockly para src/engine/tools/blockly/.
[ ] Biblioteca de blocos customizados:
    - GPIO: set, read, toggle, config.
    - Timing: delay ms, delay us, millis, micros.
    - PWM: init, set duty, set frequency, stop.
    - Communication: UART, I2C, SPI (nível básico).
    - Control flow: if/else, while, for (integração com blocos padrão Blockly).
    - Sensor blocks: temperatura, humidade, distância, etc.
[ ] Definição de cada bloco: aparência, campos, validação de tipos, tooltips.
[ ] Live code preview: blocos → código em tempo real (multi-linguagem simultâneo).
[ ] Templates de projeto: blink, button+LED, servo, I2C sensor, state machine.

### 8.3. Ladder Logic (LD) e IEC 61131-3
[ ] Contatos (NA/NF), bobinas, ramos paralelos simples → ASL.
[ ] Cada varredura de ladder → ciclo de loop em ASL.
[ ] Expansão para Function Block Diagram (FBD) e Sequential Function Chart (SFC).

## 9. Code generators: ASL → linguagem alvo
Todos os code generators abaixo recebem um ASLProgram válido e emitem código compilável/executável na linguagem alvo.

[ ] ASL → C / Arduino C++.
[ ] ASL → Python / MicroPython.
[ ] ASL → JavaScript / TypeScript.
[ ] ASL → Rust.
[ ] ASL → Zig (após toolchain definido).
[ ] ASL → Ada (após toolchain definido, saída compilável com GNAT).
[ ] ASL → Forth (vocabulário NeuroForge).
[ ] ASL → Assembly subset (didático, com comentários explicativos).
[ ] ASL → Lua.

Para cada generator:
[ ] Fixtures de equivalência: mesmo comportamento lógico entre linguagens.
[ ] Source maps: linha ASL → linha alvo.
[ ] Preservação de comentários.
[ ] Reverse mapping: linha alvo → linha ASL.

## 10. Transpilação bidirecional (ASL como pivô)

### 10.1. Pares prioritários (texto ↔ texto)
[ ] C ↔ Python.
[ ] C ↔ C++.
[ ] C ↔ Rust.
[ ] Python ↔ C++.

### 10.2. Source maps e debugging
[ ] Source map generation: linha fonte → linha alvo.
[ ] Preservação de comentários.
[ ] Debug metadata no ASL.
[ ] Reverse mapping: linha alvo → linha fonte.

## 11. Otimizações e análise

### 11.1. Otimizações de hardware
[ ] PWM Optimizer: detectar bit-banging (GPIO toggle + delay) e converter para hardware PWM.
[ ] UART Optimizer: agrupar sends consecutivos.
[ ] GPIO Batcher: múltiplos sets consecutivos → operação única.
[ ] Delay Optimizer: busy-wait (loops vazios) → timer.

### 11.2. Safety / validação
[ ] GPIO Validator: conflitos de pino, configurações inválidas.
[ ] Memory Checker: estimativa de stack overflow.
[ ] Timing Analyzer: seções críticas e violações de timing.

## 12. Foundation tooling
[ ] Lexer.ts integrado em src/engine/tools/lexer/, usado em pelo menos um pipeline.
[ ] SymbolTable.ts integrado em src/engine/tools/symbols/, conectado ao Pass 3 (análise de tipos e escopos).
[ ] SimulatorInterpreter.ts integrado com papel formal definido (debug/compat vs. executor alternativo).
[x] LanguageRegistry.ts integrado em src/engine/asl/, centralizando labels, extensões e suporte ASL.
[x] Limpeza de logs verbosos no Serial Monitor (foco em output do usuário).

## 13. UX, documentação e teaching mode

### 13.1. Boas práticas de código
[ ] Diferença entre if com e sem else em saídas.
[ ] Padrões de loop seguros.
[ ] Guia de escolha de linguagem / modo de entrada.

### 13.2. Teaching mode
[ ] Highlight visual do código/bloco/nó em execução.
[ ] Mensagens pedagógicas inline (if sem else, loop sem delay, bit-bang detectado).

## 14. Estratégia de merge para main
[ ] Feature flag "ASL experimental": ativo em dev/beta, desativável em config avançada.
[ ] Migrar C++ simples para passar sempre por ASL (desligar CodeParser legado após confiança).
[ ] Manter fallback para padrões complexos até ASL v1/v2 maduros.

Critérios para merge final:
[ ] ASL v1 estável para C++ Arduino comum.
[ ] Pelo menos uma linguagem visual integrada com round-trip (Blockly ou Flow).
[ ] notyet/ zerado: nenhum import do core aponta para a pasta.
[ ] Documentação básica publicada: manual introdutório, boas práticas, schema ASL.
[ ] Suite de testes cobrindo todas as entradas integradas.

## 15. Deliverables finais
[ ] ASL com schema completo e validado (Core + Hardware + Language-specific).
[ ] 9+ linguagens de entrada (C++, Python, JS, Rust, Zig, Ada, Forth, Assembly subset, Lua).
[ ] Code generators para todas as linguagens suportadas.
[ ] Round-trip completo: Código ↔ ASL ↔ Visual (Blockly / Flow / Ladder).
[ ] Blockly integrado com 20+ blocos e round-trip ASL ↔ blocos.
[ ] Flow/Ladder integrado com blocos industriais formais (TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG).
[ ] Multi-pass pipeline com plugin system.
[ ] Source maps e debugging para todas as linguagens.
[ ] Otimizações de hardware (PWM, UART, GPIO, delay).
[ ] Toolchains documentados para Zig, Ada, Forth e Assembly.
[ ] notyet/ = zero.
[ ] 1000+ test cases validados.
[ ] Documentação completa: schema ASL, guia de linguagens, toolchains, boas práticas, teaching mode.
