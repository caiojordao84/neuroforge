# ROADMAP_TO_ASL

Este documento descreve a evolução do NeuroForge como plataforma de simulação e transpilação para sistemas embarcados, tendo o ASL (Abstract Simulation Language) como representação intermediária universal. O fio condutor é a integração completa do conteúdo de notyet/ no core (src/engine), eliminando a pasta ao final do processo.

Marcadores de status:
[x] Concluído
[~] Em progresso / estabilização
[ ] Planejado
[?] Em pesquisa / a definir

0. Estado atual (baseline)
0.1. ASL no core
[x] ASLTypes.ts: definição do AST — ASLProgram, globals, functions, tasks, statements, expressions.
[x] ASLExecutor.ts: executor JS que percorre o ASL e chama SimulationEngine.
[x] codeToASL.ts: transpiler C++ Arduino subset → ASL (v0).
[x] Integração na TopToolbar: modo fake em C++ tenta ASL primeiro, fallback para CodeParser legado.

0.2. Subset C++ suportado (v0)
[x] Globais: const int / int / byte / long / float / double / bool com inicialização simples.
[x] setup() e loop() com extração de corpo por análise de chaves.
[x] Statements: pinMode, digitalWrite, analogWrite, delay, digitalRead (declaração e assign).
[x] if/else simples: if de uma linha, if com bloco, if/else com bloco, normalização de } else { e if (cond)\n{.
[x] Condições: ==, !=, !cond, literais HIGH/LOW/true/false.

0.3. Ferramentas em notyet/ (a integrar)
[ ] notyet/app/system/Lexer.ts
[ ] notyet/app/system/SymbolTable.ts
[ ] notyet/app/system/flow/CfgBuilder.ts
[ ] notyet/app/system/flow/FlowValidator.ts
[ ] notyet/app/system/flow/FlowToAst.ts
[ ] notyet/app/system/blockly/BlocklyParser.ts
[ ] notyet/app/system/blockly/CodeToBlockly.ts
[ ] notyet/app/system/simulator/SimulatorInterpreter.ts

1. Decisões arquiteturais (ADRs obrigatórios)
Antes de qualquer integração, estas decisões devem ser tomadas e documentadas em docs/architecture/.

1.1. Schema do ASL
[ ] Definir níveis do schema:
Core: controle de fluxo, expressões, variáveis, funções.
Hardware: GPIO, PWM, UART, I2C, SPI, timers industriais.
Language-specific: nós que não têm equivalente universal (escape hatch controlado).
[ ] Formalizar tipos de nó que hoje faltam: For, Switch, FunctionDef, FunctionCall, Millis, TimerTON/TOF/TP, CounterCTU/CTD, LatchSR/RS, TrigR/F, PWMInit/SetDuty/SetFreq/Stop, UARTWrite/Read, I2CRead/Write.
[ ] Definir política de "raw code": permitido apenas como escape hatch explícito com validação e aviso, nunca como fallback silencioso.
[ ] Validação do schema: Zod, JSON Schema, ou tipos TypeScript puros — todos os geradores emitem ASL validado antes de chegar ao executor.

1.2. Multi-pass pipeline
[ ] Formalizar os passes: Parsing → Normalização → Análise/Verificação → Detecção de padrões → Otimização leve → Emissão ASL.
[ ] Definir se existe IR intermediário entre o parser e a emissão ASL, ou se a emissão é direta.
[ ] Plugin system: API de plugin (entry points, ciclo de vida, comunicação entre plugins).

1.3. Parser technology
[ ] Avaliar web-tree-sitter para C, C++, Python, Rust, JS/TS, Lua no browser.
[ ] Definir onde parsers customizados são necessários: Assembly, Ada, Forth, Zig.
[ ] Estratégia de fallback: erro com localização (linha/coluna) ou degradação para parser legado.

1.4. Executor e runtime
[ ] Confirmar ASLExecutor como o único runtime oficial para simulação fake.
[ ] Definir papel do SimulatorInterpreter (vindo de notyet/).
[ ] Garantir que SimulationEngine.reset() zera todos os estados antes de cada execução.

1.5. Round-trip como eixo do produto
[ ] Formalizar que o ASL é o pivô de todas as conversões nos dois sentidos:
Código (qualquer linguagem) → ASL → Visual (Blockly / Flow / Ladder / Industrial).
Visual (Blockly / Flow / Ladder / Industrial) → ASL → Código (qualquer linguagem).
[ ] Definir política de "perda de informação" nas conversões (ex.: raw code que não tem representação em blocos vira "Custom block"; state machine complexa que não estruturiza vira aviso no flowchart).

2. Estrutura alvo do core (árvore de pastas)
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

3. Round-trip completo: Código ↔ ASL ↔ Visual
Este é um eixo central do produto. Os dois sentidos devem ser tratados como capacidades de primeira classe.

3.1. Sentido: Código → ASL → Visual
[ ] Código (C++, Python, JS, Rust, etc.) → ASL via transpiler correspondente.
[ ] ASL → Blockly: ASLToBlockly.ts converte nós ASL para workspace Blockly (XML/JSON).
    - Nós sem representação em bloco → "Custom code block" com conteúdo textual.
    - Funções de usuário → "Procedure block".
[ ] ASL → Flowchart: ASLToFlow.ts converte nós ASL para grafo React Flow.
    - If → Decision node com arestas True/False.
    - While/For → Loop node com back-edge.
    - FunctionCall → Process node.
    - State machine complexa → aviso de "não estruturizável visualmente".
[ ] ASL → Ladder/Industrial: conversão de nós hardware (GpioSet/Read, timers, counters) para rungs e blocos de função IEC 61131-3.

3.2. Sentido: Visual → ASL → Código
[ ] Blockly → ASL: BlocklyToASL.ts (vindo de notyet/) converte workspace para ASLProgram.
[ ] Flowchart → ASL: FlowToASL.ts (vindo de notyet/) via CFG.
[ ] Ladder/Industrial → ASL: blocos IEC (TON/TOF/CTU/CTD/SR/RS/TRIG) → nós ASL formais.
[ ] ASL → Código: code generators por linguagem alvo (ver seção 9).

3.3. Política de round-trip
[ ] Subset "perfeito" (vai e volta sem perda): controle de fluxo básico (if/while/for), GPIO, delay, variáveis simples.
[ ] Subset "com aviso" (perde detalhes, mas funciona): raw code, expressões muito complexas, macros.
[ ] Subset "sem suporte" (erro explícito): recursão, alocação dinâmica, assembly inline.

4. ASL v1 — Controle de fluxo completo
4.1. Controle de fluxo
[ ] else if em cascata: lowering para if aninhado no ASL.
[ ] if aninhado dentro de blocos then/else.
[ ] while (cond) { ... } end-to-end sem break/continue (primeiro passo).
[ ] for contador simples: lowering para init-assign + ASLWhile + increment.

4.2. Expressões
[ ] Operadores relacionais: <, >, <=, >=.
[ ] Operadores booleanos compostos: &&, ||.
[ ] Expressões aritméticas simples em assign: x = x + 1, x++, x--.

4.3. Mensagens de erro
[ ] Indicar linha e trecho exato do código não suportado.
[ ] Distinguir "subset não suporta" de "sintaxe inválida".

5. ASL v2 — Funções, tarefas e eventos
[ ] Funções de usuário: ASLFunctionDef e ASLCall; subset C++ void foo() sem parâmetros primeiro, depois com parâmetros escalares.
[ ] Múltiplas tasks além de mainLoop com escalonamento round-robin ou por período.
[ ] Eventos simples (API de alto nível): "quando entrada muda de LOW→HIGH, execute bloco X".

6. Multi-pass pipeline e plugin system
6.1. Passes formais
[ ] Pass 1 — Parsing: por linguagem, produz AST de alto nível.
[ ] Pass 2 — Normalização: AST específico → IR comum (If, While, For, Block, Call, Assign, IO ops).
[ ] Pass 3 — Análise e verificação: tipos básicos, usos inválidos, warnings pedagógicos.
[ ] Pass 4 — Detecção de padrões de hardware:
    - PWM bit-banging (GPIO toggle + delays).
    - Polling pattern (while + read).
    - State machine pattern (switch em loop).
    - Busy-wait delays (loops vazios).
[ ] Pass 5 — Otimização leve: constant folding, remoção de código morto, simplificação de condições triviais.
[ ] Pass 6 — Emissão ASL: IR comum → ASLProgram.

6.2. Plugin system
[ ] API de plugin com entry points definidos por pass.
[ ] Plugin loader e registry.
[ ] Ciclo de vida: load, execute, unload.
[ ] Contexto compartilhado entre plugins (tabela de símbolos, metadados de hardware).

7. Linguagens de entrada → ASL
7.1. C / Arduino C++
[x] Subset básico v0.
[ ] Controle de fluxo completo (v1).
[ ] APIs adicionais: analogRead, tone, millis, micros, Serial.print.
[ ] Parser via Tree-sitter C/C++.

7.2. MicroPython / CircuitPython
[~] Execução via CodeParser legado.
[ ] pythonToASL.ts: Pin, value(), time.sleep(), if/else, while.
[ ] Parser via Tree-sitter Python.

7.3. JavaScript / TypeScript
[ ] Subset com setup()/loop(), IO ops, if/else, while, for.
[ ] Parser via Tree-sitter JS/TS.

7.4. Rust (embedded subset)
[ ] Subset fn setup(), fn loop(), tipos escalares.
[ ] Macros/wrappers NeuroForge como interface previsível.
[ ] Parser via Tree-sitter Rust.

7.5. Zig
**Instalação e toolchain:**
[ ] Documentar instalação do compilador Zig (binário oficial, sem dependências extras).
[ ] Verificar se web-tree-sitter tem grammar Zig disponível; se não, desenvolver grammar mínima para o subset.
[ ] Definir wrappers de IO NeuroForge para Zig (ex.: neuroforge.digitalWrite, neuroforge.delay).

**Parser e generator:**
[ ] Parser para subset pub fn setup(), pub fn loop(), tipos básicos (u8, i32, bool), if/while/for.
[ ] zigToASL.ts: subset → ASL.
[ ] ASLToZig.ts: ASL → código Zig válido.
[ ] Fixtures de teste: blink, button, PWM, if/else, loops.

7.6. Ada
**Instalação e toolchain:**
[ ] Documentar instalação do GNAT (FSF GNAT via apt/brew, ou GNAT Community Edition).
[ ] Definir se o compilador é necessário apenas para validação (gerar + compilar para checar) ou se o subset é executado só via ASL.
[ ] Avaliar grammar Ada para Tree-sitter; se não existir ou for incompleta, desenvolver parser customizado para o subset.
[ ] Definir wrappers de IO NeuroForge para Ada (procedure DigitalWrite, function DigitalRead, etc.).

**Parser e generator:**
[ ] Parser para subset: procedure Setup, procedure Loop, if/elsif/else, while, case.
[ ] adaToASL.ts: subset → ASL.
[ ] ASLToAda.ts: ASL → código Ada válido (compilável com GNAT).
[ ] Fixtures de teste: blink, button, PWM, if/else, loops.

7.7. Forth
**Instalação e toolchain:**
[ ] Documentar instalação de um Forth de referência (ex.: Gforth via apt/brew) para validação.
[ ] Definir vocabulário NeuroForge para Forth: palavras como PINOUTPUT, PININPUT, DIGITAL-WRITE, DIGITAL-READ, ANALOG-WRITE, DELAY-MS.
[ ] Definir delimitadores de setup e loop no vocabulário (ex.: : SETUP ... ; e : LOOP ... ;).

**Parser e generator:**
[ ] Desenvolver parser customizado para o subset (stack-based, tokenização por palavras).
[ ] forthToASL.ts: sequências de palavras → IR linear + controle de fluxo → ASL.
[ ] ASLToForth.ts: ASL → sequências de palavras Forth válidas.
[ ] Fixtures de teste: blink, button, delay, if/else equivalente (IF ... ELSE ... THEN).

7.8. Assembly (subset didático)
**Instalação e toolchain:**
[ ] Definir arquitetura alvo inicial (AVR 8-bit ou ARM Cortex-M).
[ ] Documentar instalação do assembler de referência (ex.: avr-as para AVR, arm-none-eabi-as para ARM).
[ ] Definir subset de instruções mapeáveis para operações ASL:
    - AVR: OUT PORTB, Rn → GpioSet, IN Rn, PINB → GpioRead, RCALL delay → DelayMs.
    - ARM: equivalentes para GPIO via MMIO.

**Parser e generator:**
[ ] Desenvolver parser customizado para o subset de instruções definido.
[ ] assemblyToASL.ts: pseudo-instruções → ASL (sem montar binário real).
[ ] ASLToAssembly.ts: ASL → pseudo-assembly comentado (finalidade didática).
[ ] Fixtures de teste: blink e read de pino em assembly subset.

7.9. Lua / NodeMCU
[ ] Subset com funções e chamadas de IO.
[ ] Parser via Tree-sitter Lua.
[ ] luaToASL.ts e ASLToLua.ts.

8. Entradas visuais → ASL
8.1. Flowchart
[ ] Migrar CfgBuilder, FlowValidator, FlowToASL para src/engine/tools/flow/.
[ ] FlowToASL importa tipos de src/engine/asl/ASLTypes.ts.
[ ] Estratégia de geração explícita: structured vs. state machine.
[ ] Blocos industriais como nós ASL formais: TimerTON/TOF/TP, CounterCTU/CTD, LatchSR/RS, TrigR/F, ops matemáticas.
[ ] Templates industriais: TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG, state machine diagram, GRAFCET básico.
[ ] IEC 61131-3 Structured Text (ST) como linguagem textual adicional (próxima de Pascal/PLC).

8.2. Blockly
[ ] Migrar BlocklyParser → BlocklyToASL e CodeToBlockly → ASLToBlockly para src/engine/tools/blockly/.
[ ] Biblioteca de blocos customizados:
    - GPIO: set, read, toggle, config.
    - Timing: delay ms, delay us, millis, micros.
    - PWM: init, set duty, set frequency, stop.
    - Communication: UART, I2C, SPI (nível básico).
    - Control flow: if/else, while, for (integração com blocos padrão Blockly).
    - Sensor blocks: temperatura, humidade, distância, etc.
[ ] Definição de cada bloco: aparência, campos, validação de tipos, tooltips.
[ ] Live code preview: blocos → código em tempo real (multi-linguagem simultâneo).
[ ] Templates de projeto: blink, button+LED, servo, I2C sensor, state machine.

8.3. Ladder Logic (LD) e IEC 61131-3
[ ] Contatos (NA/NF), bobinas, ramos paralelos simples → ASL.
[ ] Cada varredura de ladder → ciclo de loop em ASL.
[ ] Expansão para Function Block Diagram (FBD) e Sequential Function Chart (SFC).

9. Code generators: ASL → linguagem alvo
Todos os code generators abaixo recebem um ASLProgram válido e emitem código compilável/executável na linguagem alvo.

[ ] ASL → C / Arduino C++.
[ ] ASL → Python / MicroPython.
[ ] ASL → JavaScript / TypeScript.
[ ] ASL → Rust.
[ ] ASL → Zig (após toolchain definido).
[ ] ASL → Ada (após toolchain definido, saída compilável com GNAT).
[ ] ASL → Forth (vocabulário NeuroForge).
[ ] ASL → Assembly subset (didático, com comentários explicativos).
[ ] ASL → Lua.

Para cada generator:
[ ] Fixtures de equivalência: mesmo comportamento lógico entre linguagens.
[ ] Source maps: linha ASL → linha alvo.
[ ] Preservação de comentários.
[ ] Reverse mapping: linha alvo → linha ASL.

10. Transpilação bidirecional (ASL como pivô)
10.1. Pares prioritários (texto ↔ texto)
[ ] C ↔ Python.
[ ] C ↔ C++.
[ ] C ↔ Rust.
[ ] Python ↔ C++.

10.2. Source maps e debugging
[ ] Source map generation: linha fonte → linha alvo.
[ ] Preservação de comentários.
[ ] Debug metadata no ASL.
[ ] Reverse mapping: linha alvo → linha fonte.

11. Otimizações e análise
11.1. Otimizações de hardware
[ ] PWM Optimizer: detectar bit-banging (GPIO toggle + delay) e converter para hardware PWM.
[ ] UART Optimizer: agrupar sends consecutivos.
[ ] GPIO Batcher: múltiplos sets consecutivos → operação única.
[ ] Delay Optimizer: busy-wait (loops vazios) → timer.

11.2. Safety / validação
[ ] GPIO Validator: conflitos de pino, configurações inválidas.
[ ] Memory Checker: estimativa de stack overflow.
[ ] Timing Analyzer: seções críticas e violações de timing.

12. Foundation tooling
[ ] Lexer.ts integrado em src/engine/tools/lexer/, usado em pelo menos um pipeline.
[ ] SymbolTable.ts integrado em src/engine/tools/symbols/, conectado ao Pass 3 (análise de tipos e escopos).
[ ] SimulatorInterpreter.ts integrado com papel formal definido (debug/compat vs. executor alternativo).

13. UX, documentação e teaching mode
13.1. Boas práticas de código
[ ] Diferença entre if com e sem else em saídas.
[ ] Padrões de loop seguros.
[ ] Guia de escolha de linguagem / modo de entrada.

13.2. Teaching mode
[ ] Highlight visual do código/bloco/nó em execução.
[ ] Mensagens pedagógicas inline (if sem else, loop sem delay, bit-bang detectado).

14. Estratégia de merge para main
[ ] Feature flag "ASL experimental": ativo em dev/beta, desativável em config avançada.
[ ] Migrar C++ simples para passar sempre por ASL (desligar CodeParser legado após confiança).
[ ] Manter fallback para padrões complexos até ASL v1/v2 maduros.

Critérios para merge final:
[ ] ASL v1 estável para C++ Arduino comum.
[ ] Pelo menos uma linguagem visual integrada com round-trip (Blockly ou Flow).
[ ] notyet/ zerado: nenhum import do core aponta para a pasta.
[ ] Documentação básica publicada: manual introdutório, boas práticas, schema ASL.
[ ] Suite de testes cobrindo todas as entradas integradas.

15. Deliverables finais
[ ] ASL com schema completo e validado (Core + Hardware + Language-specific).
[ ] 9+ linguagens de entrada (C++, Python, JS, Rust, Zig, Ada, Forth, Assembly subset, Lua).
[ ] Code generators para todas as linguagens suportadas.
[ ] Round-trip completo: Código ↔ ASL ↔ Visual (Blockly / Flow / Ladder).
[ ] Blockly integrado com 20+ blocos e round-trip ASL ↔ blocos.
[ ] Flow/Ladder integrado com blocos industriais formais (TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG).
[ ] Multi-pass pipeline com plugin system.
[ ] Source maps e debugging para todas as linguagens.
[ ] Otimizações de hardware (PWM, UART, GPIO, delay).
[ ] Toolchains documentados para Zig, Ada, Forth e Assembly.
[ ] notyet/ = zero.
[ ] 1000+ test cases validados.
[ ] Documentação completa: schema ASL, guia de linguagens, toolchains, boas práticas, teaching mode.
