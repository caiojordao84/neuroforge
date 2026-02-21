# 🤖 AI Assistant Context — NeuroForge ASL Subsystem

> **Data de Atualização:** 21/02/2026  
> **Branch:** `ASL_Integration`  
> **Commit Base:** `488221ac` (21/02/2026) — notyet/README.md atualizado  
> **Foco Atual:** Pipeline ASL fake-mode (C++ Arduino + MicroPython → ASL → SimulationEngine)

---

## 📋 Instruções para Assistentes de IA

Tu és um assistente técnico ajudando o desenvolvedor **Caio** a construir o subsistema **ASL (Abstract Simulation Language)** do projeto **NeuroForge**. O ASL é uma Representação Intermediária (IR) universal que serve de pivô entre:

- **Entradas**: código-fonte (C++ Arduino, MicroPython, futuramente JS, Rust, Zig, Ada, Forth, Assembly, Lua) e editores visuais (Blockly, Flowchart, Ladder).
- **Saídas**: execução no SimulationEngine (modo fake, browser), geradores de código para outras linguagens, e representações visuais.

O objetivo é que qualquer sketch ou programa embarcado, de qualquer linguagem, passe sempre pelo ASL antes de ser executado ou convertido — ASL como pivô universal.

---

## 🚨 REGRA CRÍTICA DE INTEGRAÇÃO (ASL)

> [!CAUTION]
> **ANTES de qualquer integração de código:**
> 1. **MOSTRAR TODO o código atual** dos arquivos que serão modificados
> 2. **MOSTRAR TODAS as entradas** (tipos, interfaces, variáveis) que serão afetadas
> 3. **EXPLICAR detalhadamente** o que será alterado e porquê
> 4. **Aguardar aprovação** do desenvolvedor
> 5. **A integração deverá ser feita em um ÚNICO COMMIT no GitHub** com mensagem descritiva
>
> **NUNCA altere** `ASLTypes.ts` sem analisar o impacto em `codeToASL.ts`, `ASLExecutor.ts`, e todos os parsers.  
> **NUNCA altere** `SimulationEngine.ts` sem verificar o contrato de `millis()/micros()` (tempo relativo desde `simulationStartTime`).  
> **NUNCA altere** `CParser.ts` sem manter a tabela de constantes Arduino (`HIGH/LOW/INPUT/OUTPUT/INPUT_PULLUP`).  
> **NUNCA remova** sinais de controlo (`BreakSignal`, `ContinueSignal`, `ReturnSignal`) do executor sem substituição adequada.

---

## 📁 Contexto do Repositório

**Repositório:** [`caiojordao84/neuroforge`](https://github.com/caiojordao84/neuroforge)  
**Branch de trabalho:** `ASL_Integration`  
**Merge target:** `main` (apenas quando ASL v1 estiver estável para C++ Arduino comum)

### Estrutura dos Arquivos ASL

```
src/
  engine/
    SimulationEngine.ts          # Engine de simulação (fake mode): GPIO, delay, millis, Serial
    asl/
      ASLTypes.ts                # ✅ Fonte única de verdade do schema ASL
      ASLExecutor.ts             # ✅ Interpreter/runtime ASL → SimulationEngine
      codeToASL.ts               # ✅ Transpiler: AST (C++/Python) → ASLProgram
      LanguageRegistry.ts        # ✅ Registro central de linguagens suportadas
      TreeSitterLoader.ts        # ✅ Loader lazy de web-tree-sitter (para Python/MicroPython)
      plugins/
        c/
          CParser.ts             # ✅ Parser recursivo descendente para C/C++ Arduino subset
        python/
          PythonParser.ts        # ✅ Parser MicroPython/CircuitPython via tree-sitter
  components/
    TopToolbar.tsx               # ✅ Controles Run/Stop/Pause + integração do pipeline ASL
    CodeEditorWithTabs.tsx       # ✅ Editor Monaco multi-abas, expõe código + metadados
    ASLViewer.tsx                # ✅ Visualizador do ASLProgram gerado (debug/teaching)

notyet/
  README.md                     # Roadmap detalhado (fonte de verdade do estado ASL)
  app/system/
    Lexer.ts                     # 🔜 A integrar em src/engine/tools/lexer/
    SymbolTable.ts               # 🔜 A integrar em src/engine/tools/symbols/
    flow/                        # 🔜 CfgBuilder, FlowValidator, FlowToASL
    blockly/                     # 🔜 BlocklyParser, CodeToBlockly
    simulator/
      SimulatorInterpreter.ts   # 🔜 A integrar com papel formal definido

docs/
  AI_ASSISTANT_CONTEXT.md       # Contexto geral NeuroForge (QEMU, AVR, ESP32)
  AI_ASSISTANT_CONTEXT_ASL.md   # Este arquivo (contexto específico do ASL)
```

---

## 🏗️ Arquitetura Mental do Pipeline ASL

```
 CodeEditorWithTabs
        │  código-fonte + linguagem ativa
        ▼
   TopToolbar (Run)
        │  resolve linguagem via LanguageRegistry
        ▼
   LanguageRegistry
        │  decide: suporta ASL? qual parser?
        ▼
   CParser / PythonParser
        │  produz ProgramNode (AST proprietário)
        ▼
   codeToASL (astToASL)
        │  converte ProgramNode → ASLProgram
        ▼
   ASLProgram (JSON)
        │  globals, functions, tasks
        ▼
   createASLRuntime (ASLExecutor)
        │  setup() + loop() assíncronos
        ▼
   SimulationEngine
        │  GPIO, delay, millis, Serial
        ▼
   UI React (pinChange events, terminal, ASLViewer)
```

---

## 📐 Schema ASL (ASLTypes.ts)

`ASLTypes.ts` é a **fonte única de verdade**. Nunca duplicar tipos noutros ficheiros.

### Estrutura raiz

```typescript
interface ASLProgram {
  metadata: { name?, description?, version?, targetBoard? };
  globals: ASLGlobalVar[];   // variáveis globais declaradas fora de setup/loop
  functions: ASLFunction[];  // setup + funções de utilizador
  tasks: ASLTask[];          // [0] = mainLoop (derivado de loop())
}
```

### Statements suportados (ASLStatement)

| kind | Descrição | Campos chave |
|---|---|---|
| `pinMode` | Configurar modo de pino | `pin: ASLExpr`, `mode: INPUT\|OUTPUT\|INPUT_PULLUP` |
| `digitalWrite` | Escrever valor digital | `pin: ASLExpr`, `value: 'HIGH'\|'LOW'\|ASLExpr` |
| `analogWrite` | Escrever valor analógico/PWM | `pin: ASLExpr`, `value: ASLExpr` |
| `read` | Leitura de pino para variável | `pin`, `target: string`, `mode: DIGITAL\|ANALOG` |
| `if` | Condicional | `condition`, `thenBranch`, `elseBranch?` |
| `while` | Loop while | `condition`, `body` |
| `delay` | Espera bloqueante | `milliseconds: ASLExpr` |
| `assign` | Atribuição simples | `target: string`, `value: ASLExpr` |
| `setIndex` | Atribuição em array | `target: string`, `index`, `value` |
| `setMember` | Atribuição em propriedade | `target: ASLExpr`, `property: string`, `value` |
| `expr` | Expressão como statement | `expr: ASLExpr` |
| `return` | Retorno de função | `value?: ASLExpr` |
| `print` | Serial.print / log | `args: ASLExpr[]`, `newline: boolean` |
| `break` | Interrompe loop | — |
| `continue` | Próxima iteração | — |
| `comment` | Preservação de contexto | `text: string` |

### Expressões suportadas (ASLExpr)

| kind | Descrição | Exemplo |
|---|---|---|
| `literal` | Valor constante | `{ kind:'literal', value: 42 }` |
| `var` | Referência a variável | `{ kind:'var', name:'ledState' }` |
| `index` | Indexação de array | `pins[i]` |
| `member` | Acesso a propriedade | `obj.property` |
| `unary` | Operador unário | `!flag`, `-x` |
| `binary` | Operador binário | `a + b`, `i < 10`, `a && b` |
| `call` | Chamada de função/builtin | `millis()`, `digitalRead(pin)` |

**Operadores binários suportados:** `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`

---

## ⚙️ ASLExecutor — Runtime

**Ficheiro:** `src/engine/asl/ASLExecutor.ts`

### Como criar e usar

```typescript
const program: ASLProgram = codeToASL(sourceCode, 'cpp');
const runtime = createASLRuntime(program, { engine: simulationEngine });
// O SimulationEngine.start() chama:
await runtime.setup();   // executa funções.find('setup')
await runtime.loop();    // executa tasks[0] em cada iteração
```

### Ambiente de variáveis

- **Globais**: `Map<string, any>` inicializado com deep copy dos `program.globals`.
- **Locais** (por chamada de função): novo `Map<string, any>` criado a cada call.
- **Resolução**: `setVar` e `getVar` procuram em **local primeiro**, depois em **global**.

### Sinais de controlo de fluxo

| Classe | Lançada em | Capturada em |
|---|---|---|
| `ReturnSignal(value)` | statement `return` | execução de função (`call`) |
| `BreakSignal` | statement `break` | loop `while` |
| `ContinueSignal` | statement `continue` | loop `while` |

> ⚠️ Estes são mecanismos de controlo de fluxo internos — não são erros. **Nunca** os remova sem substituto.

### Delay interrompível

O `delay` é partido em chunks de **50 ms** para permitir abort via `AbortSignal`:

```typescript
// delay(1000) → 20 chunks de 50ms, cada um verifica abortSignal.aborted
```

### Yield do loop para não travar a UI

A cada **10 iterações** do `while`, o executor faz yield com `setTimeout(r, 0)` para não bloquear o thread do browser.

### Builtins reconhecidos no `evalExpr` (kind: 'call')

| callee | Acção |
|---|---|
| `millis` | `engine.millis()` → ms desde início da simulação |
| `micros` | `engine.micros()` → μs desde início da simulação |
| `digitalRead(pin)` | `engine.digitalRead(pin)` → `'HIGH'` ou `'LOW'` convertido para `1`/`0` |
| `analogRead(pin)` | `engine.analogRead(pin)` → `0–1023` |
| `random(min, max)` | `Math.floor(Math.random() * (max - min)) + min` |
| `Pin(num, mode)` | `engine.pinMode(num, mode)` (MicroPython) |
| `Pin.on(pin)` | `engine.digitalWrite(pin, 'HIGH')` |
| `Pin.off(pin)` | `engine.digitalWrite(pin, 'LOW')` |
| `Pin.value(pin[, v])` | leitura ou escrita conforme nº de args |
| `Serial.begin` | no-op |
| funções do user | executa com novo localEnv, params passados por posição |
| desconhecida | retorna `0` sem erro |

---

## 🔄 codeToASL — Transpiler

**Ficheiro:** `src/engine/asl/codeToASL.ts`

### Assinatura pública

```typescript
function codeToASL(source: string, language: Language): ASLProgram
// language: 'cpp' | 'c' | 'micropython' | 'circuitpython' | 'python'
```

### Fluxo interno

1. Para `cpp`/`c`: instancia `RecursiveDescentCParser(source)` → `ProgramNode`.
2. Para `micropython`/`circuitpython`/`python`: usa `PythonParser` (tree-sitter) → `ProgramNode`.
3. Chama `astToASL(program)` que percorre `ProgramNode.children`:
   - Nós `Function` com nome `setup` → `ASLFunction { name: 'setup', ... }`
   - Nós `Function` com nome `loop` ou `main` → `ASLTask { name: 'mainLoop', ... }`
   - Outras `Function` → `ASLFunction` indexada para chamadas cruzadas
   - `VariableDeclaration` de topo → `ASLGlobalVar`
4. `transformBlock(nodes)` converte cada statement do AST em `ASLStatement[]`.

### Regras de transformBlock (C++)

| Input AST | Output ASL |
|---|---|
| `GpioSet(pin, val)` | `{ kind:'digitalWrite', pin, value }` |
| `AnalogWrite(pin, val)` | `{ kind:'analogWrite', pin, value }` |
| `DelayMs(ms)` | `{ kind:'delay', milliseconds }` |
| `GpioRead(pin)` / `AnalogRead(pin)` em assign | `{ kind:'read', ... }` |
| `IfStatement` | `{ kind:'if', condition, thenBranch, elseBranch? }` |
| `WhileStatement` | `{ kind:'while', condition, body }` |
| `ForStatement` | `init-assign` + `{ kind:'while', ... }` com `inc` no fim do body |
| `ReturnStatement` | `{ kind:'return', value? }` |
| `BreakStatement` | `{ kind:'break' }` |
| `ContinueStatement` | `{ kind:'continue' }` |
| `Print(args)` | `{ kind:'print', args, newline }` |
| `AssignExpression` | `{ kind:'assign', target, value }` |
| `UnaryExpression (++/--)` | `{ kind:'assign', target, value: binary(target ± 1) }` |
| `CallExpression` genérica | `{ kind:'expr', expr: { kind:'call', callee, args } }` |
| `VariableDeclaration` local | `{ kind:'assign', target, value }` |

---

## 🔤 CParser — Parser C/Arduino

**Ficheiro:** `src/engine/asl/plugins/c/CParser.ts`  
**Classe:** `RecursiveDescentCParser`

### Constantes Arduino → valores numéricos

Esta tabela é crítica. O parser mapeia constantes textuais para valores numéricos antes de qualquer transformação:

| Constante | Valor |
|---|---|
| `HIGH`, `true` | `1` |
| `LOW`, `false` | `0` |
| `INPUT` | `0` |
| `OUTPUT` | `1` |
| `INPUT_PULLUP` | `2` |
| `WL_CONNECTED` | `3` |
| `FILE_WRITE` | `1` |
| `FILE_READ` | `0` |

### Builtins reconhecidos como nós semânticos

| Chamada | Nó AST produzido |
|---|---|
| `pinMode(pin, mode)` | `ASLPinMode` |
| `digitalWrite(pin, val)` | `GpioSet` → `ASLDigitalWrite` |
| `analogWrite(pin, val)` | `AnalogWrite` → `ASLAnalogWrite` |
| `delay(ms)` | `DelayMs` → `ASLDelay` |
| `digitalRead(pin)` | `GpioRead` → `ASLRead` ou `ASLCall` |
| `analogRead(pin)` | `AnalogRead` → `ASLRead` ou `ASLCall` |
| `Serial.print(x)` / `Serial.println(x)` | `Print` → `ASLPrint` |
| Outros (`tone`, `noTone`, `servo.*`, etc.) | `CallExpression` genérica |

---

## 🐍 PythonParser + TreeSitterLoader

**Ficheiros:**
- `src/engine/asl/plugins/python/PythonParser.ts`
- `src/engine/asl/TreeSitterLoader.ts`

### Fluxo

1. `TreeSitterLoader` faz import dinâmico de `web-tree-sitter` e carrega a grammar Python (lazy, uma vez só).
2. `PythonParser` usa tree-sitter para produzir `ProgramNode` compatível com `astToASL`.
3. Mapeamentos MicroPython equivalentes aos do CParser:
   - `Pin(n, Pin.OUT)` → `pinMode` + referência ao pin
   - `led.on()` / `led.off()` / `led.value(x)` → `digitalWrite`
   - `time.sleep_ms(n)` → `delay`
   - `print(x)` → `ASLPrint`
   - `if`/`while`/`for` Python → statements ASL equivalentes

---

## 🏭 LanguageRegistry

**Ficheiro:** `src/engine/asl/LanguageRegistry.ts`

É o **único ponto** onde se decide se uma linguagem suporta ASL ou cai no parser legado (`CodeParser.ts`). Nunca fazer essa decisão em `TopToolbar` ou noutro componente.

### Estrutura típica de uma entrada

```typescript
{
  id: 'cpp',
  label: 'C++ Arduino',
  extensions: ['.ino', '.cpp'],
  supportsASL: true,
  transpile: (source) => codeToASL(source, 'cpp')
}
```

---

## ⚡ SimulationEngine — Contrato Crítico

**Ficheiro:** `src/engine/SimulationEngine.ts`

### Primitivos expostos ao ASLExecutor

| Método | Descrição |
|---|---|
| `pinMode(pin, mode)` | Configura pino. Mode: `'INPUT'\|'OUTPUT'\|'INPUT_PULLUP'` |
| `digitalWrite(pin, value)` | Escreve `'HIGH'` ou `'LOW'` em pino OUTPUT |
| `analogWrite(pin, value)` | Escreve valor PWM 0–255 |
| `digitalRead(pin)` | Retorna `'HIGH'` ou `'LOW'` |
| `analogRead(pin)` | Retorna `0–1023` |
| `delay(ms)` | Promise que resolve após ms/speedMultiplier ms |
| `millis()` | ms desde `simulationStartTime` ← **CRÍTICO** |
| `micros()` | μs desde `simulationStartTime` ← **CRÍTICO** |
| `log(msg)` | Emite para SerialStore (terminal) |
| `serialPrint(text)` | Serial.print sem newline |
| `serialPrintln(text)` | Serial.print com newline |
| `random(min?, max?)` | Random helpers |
| `map(v, fl, fh, tl, th)` | Arduino map() |
| `constrain(v, min, max)` | Arduino constrain() |

### ⚠️ Regra do tempo relativo (millis/micros)

```typescript
// CORRETO — tempo desde início da simulação:
private simulationStartTime = 0;  // inicializado em start() com Date.now()
millis(): number {
  if (this.simulationStartTime === 0) return 0;
  return Date.now() - this.simulationStartTime; // RELATIVO
}

// ERRADO — nunca usar diretamente:
return Date.now(); // retorna timestamp Unix ~1.7 × 10¹² ms → quebra millis()-patterns
```

> Esta regra foi o motivo de um bug inteiro: sketches com `millis()` não acendiam LEDs porque `tempoAtual - tempoAnterior` nunca ultrapassava o intervalo (ambos eram ~1.7 trilhão ms).

### Loop assíncrono (scheduleLoop)

- O loop chama `loopFunction()` (o `runtime.loop`) e ao terminar agenda a próxima iteração via `setTimeout(..., 0)`.
- `isLoopExecuting` impede sobreposição de iterações.
- `stop()` limpa todos os timeouts e reseta `simulationStartTime = 0`.

### Ciclo de vida completo

```
start() → simulationStartTime = Date.now() → setup() → scheduleLoop()
                                                              │
                                          loop() ←───── setTimeout(0)
                                              │
                                     (iteração completa)
                                              │
                                         setTimeout(0)
                                              │
                                           loop() ...

stop() → isRunning=false → clearAll timeouts → simulationStartTime=0
```

---

## ✅ Estado de Implementação (Fevereiro 2026)

### ✅ Funcional (C++ Arduino subset)

- `pinMode` / `digitalWrite` / `analogWrite` / `delay`
- `digitalRead` / `analogRead`
- `millis()` / `micros()` relativos
- `Serial.print` / `Serial.println` no terminal
- Controlo de fluxo: `if/else` (incluindo `else if` em cascata), `while`, `for` (lowerizado para while)
- `break` / `continue` / `return`
- Funções de utilizador void sem e com parâmetros escalares
- Variáveis globais e locais escalares (`int`, `float`, `bool`)
- Operadores: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, `!`
- Constantes: `HIGH`, `LOW`, `INPUT`, `OUTPUT`, `INPUT_PULLUP`, `true`, `false`
- Incremento/decremento: `i++`, `i--`, `++i`, `--i` (lowerizado para assign)

### ✅ Funcional (MicroPython)

- `Pin`, `Pin.on()`, `Pin.off()`, `Pin.value()`
- `time.sleep_ms()`
- `if`/`else`, `while True`, `print()`
- Parser via `web-tree-sitter` (Python grammar)

### ✅ Infraestrutura

- `LanguageRegistry` centraliza linguagens + supportsASL
- `ASLViewer` exibe ASLProgram gerado (debug/teaching)
- `CodeEditorWithTabs` expõe código + linguagem ativa
- `TopToolbar` orquestra: código → LanguageRegistry → codeToASL → createASLRuntime → SimulationEngine.start()
- `simulationStartTime` corretamente relativo (fix 20/02/2026)

### 🔜 Não suportado ainda

- Arrays: declaração, indexação, atribuição por índice
- `switch/case`
- `for(;;)` sem condição
- Expressões aritméticas genéricas no RHS de declarações locais: `int x = 1000 - (i * 100)`
- Operadores lógicos compostos no parser de condições (executor suporta, parser ainda limitado em alguns casos)
- `tone()` sem simulação dedicada
- Code generators (ASL → outra linguagem)
- Round-trip Visual ↔ ASL (Blockly, Flow, Ladder)

---

## 🐛 Bugs Conhecidos e Soluções

### Bug 1: millis() retornava timestamp Unix absoluto
**Sintoma:** Sketch com `millis()` não acendia LED, sem log de erro.  
**Causa:** `millis()` retornava `Date.now()` (~1.7 × 10¹² ms).  
**Solução:** Introduzir `simulationStartTime` capturado em `start()`, fazer `millis()` retornar `Date.now() - simulationStartTime`.  
**Commit:** `2d50650aa21bd2cbf9a56f3aa33671c0110ef688`

### Bug 2: Constante OUTPUT não reconhecida pelo CParser
**Sintoma:** `pinMode(13, OUTPUT)` não executava ou gerava aviso.  
**Causa:** `OUTPUT` não estava na tabela de constantes do CParser.  
**Solução:** Adicionar mapeamento `OUTPUT → 1`, `INPUT → 0`, `INPUT_PULLUP → 2` em `parseAtom()`.  

### Bug 3: loop() não tinha delay — UI travava
**Sintoma:** Simulação travava/não respondia com loops ocupados (`while(true)` sem delay).  
**Causa:** Loop síncrono bloqueava o thread do browser.  
**Solução:** `scheduleLoop` usa `setTimeout(..., 0)` entre iterações; `delay()` usa chunks de 50ms com yield.

### Padrão para debugar: sketch não executa sem log
1. Verificar se `TopToolbar` detectou a linguagem corretamente via `LanguageRegistry`.
2. Abrir `ASLViewer` e confirmar que o `ASLProgram` gerado tem `tasks[0].body` não vazio.
3. Confirmar que `setup` está em `functions` (não em `tasks`).
4. Confirmar que `simulationEngine.millis()` retorna valor pequeno (< 60000), não trilhões.
5. Adicionar `Serial.println` no sketch e verificar se aparece no terminal.

---

## 📋 Regras de Ouro para este Subsistema

### 1. ASLTypes.ts é sagrado
Qualquer novo statement ou expressão começa por adicionar o tipo em `ASLTypes.ts`, depois `codeToASL`, depois `ASLExecutor`. Nunca o inverso.

### 2. Não quebre o loop blink
O sketch de referência mínima deve sempre funcionar:
```cpp
void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }
```
Se este sketch deixar de funcionar, há uma regressão crítica.

### 3. millis() é relativo, sempre
Nunca alterar `millis()` para retornar `Date.now()` diretamente. Sempre usar `Date.now() - this.simulationStartTime`.

### 4. for → while, sempre
`for` nunca existe em ASL. `codeToASL` converte sempre para: `assign init` + `while(cond) { body + inc }`.

### 5. break/continue/return usam exceções internas
`BreakSignal`, `ContinueSignal`, `ReturnSignal` são classes internas ao `ASLExecutor`. São lançadas e capturadas na mesma execução. Não são erros de runtime.

### 6. Novo parser → novo ficheiro
Nunca misturar lógica de parsing de C com Python ou outra linguagem. Cada linguagem tem o seu ficheiro em `src/engine/asl/plugins/<lang>/`.

### 7. Antes de modificar, ler o ficheiro atual do GitHub
Sempre buscar o conteúdo atual via MCP GitHub antes de propor alterações. O código local pode estar desatualizado em relação ao branch remoto.

---

## 🔍 Como Interpretar o ASLProgram (debug)

```json
{
  "metadata": { "targetBoard": "Arduino Uno" },
  "globals": [
    { "name": "estadoLed", "type": "int", "initialValue": 0 },
    { "name": "tempoAnterior", "type": "int", "initialValue": 0 },
    { "name": "intervalo", "type": "int", "initialValue": 1000 }
  ],
  "functions": [
    {
      "name": "setup",
      "params": [],
      "body": [
        { "kind": "pinMode", "pin": { "kind": "literal", "value": 13 }, "mode": "OUTPUT" }
      ]
    }
  ],
  "tasks": [
    {
      "name": "mainLoop",
      "body": [
        { "kind": "assign", "target": "tempoAtual",
          "value": { "kind": "call", "callee": "millis", "args": [] } },
        { "kind": "if",
          "condition": { "kind": "binary", "op": ">=",
            "left": { "kind": "binary", "op": "-",
              "left": { "kind": "var", "name": "tempoAtual" },
              "right": { "kind": "var", "name": "tempoAnterior" } },
            "right": { "kind": "var", "name": "intervalo" } },
          "thenBranch": [ ...toggle LED... ]
        }
      ]
    }
  ]
}
```

Se `tasks[0].body` estiver vazio → o parser não encontrou `loop()` no código.  
Se `functions` não tiver `setup` → o `setup()` não foi reconhecido.

---

## 🧪 Fixtures de Teste de Referência

### T1 — Blink com delay (smoke test)
```cpp
void setup() { pinMode(13, OUTPUT); }
void loop() {
  digitalWrite(13, HIGH); delay(500);
  digitalWrite(13, LOW);  delay(500);
}
```
**Esperado:** LED no pino 13 pisca a 1 Hz.

### T2 — Blink com millis() (smoke test timing)
```cpp
const int pinoLed = 13;
int estadoLed = LOW;
int tempoAnterior = 0;
const int intervalo = 1000;
void setup() { pinMode(pinoLed, OUTPUT); }
void loop() {
  int tempoAtual = millis();
  if (tempoAtual - tempoAnterior >= intervalo) {
    tempoAnterior = tempoAtual;
    estadoLed = (estadoLed == LOW) ? HIGH : LOW;
    digitalWrite(pinoLed, estadoLed);
  }
}
```
**Esperado:** LED pisca a 0.5 Hz sem uso de `delay()`.

### T3 — Botão com Serial
```cpp
const int botao = 2;
const int led = 13;
void setup() {
  Serial.begin(9600);
  pinMode(botao, INPUT);
  pinMode(led, OUTPUT);
}
void loop() {
  int estado = digitalRead(botao);
  if (estado == HIGH) {
    digitalWrite(led, HIGH);
    Serial.println("Botao pressionado");
  } else {
    digitalWrite(led, LOW);
  }
}
```
**Esperado:** LED acende com botão; "Botao pressionado" aparece no terminal.

### T4 — MicroPython blink
```python
from machine import Pin
import time
led = Pin(13, Pin.OUT)
while True:
    led.on()
    time.sleep_ms(500)
    led.off()
    time.sleep_ms(500)
```
**Esperado:** LED no pino 13 pisca a 1 Hz em modo MicroPython.

---

## 📋 Checklist antes de qualquer PR para main

- [ ] T1 (blink delay) funciona
- [ ] T2 (blink millis) funciona
- [ ] T3 (botão + serial) funciona
- [ ] T4 (MicroPython) funciona
- [ ] `ASLViewer` mostra ASLProgram correto para cada fixture
- [ ] `millis()` retorna valor < 60 000 após 1 minuto de simulação
- [ ] `stop()` limpa todos os timeouts e reseta `simulationStartTime = 0`
- [ ] Nenhum console.error em nenhum dos fixtures
- [ ] `notyet/README.md` atualizado com estado real dos checkboxes

---

## 📌 Roadmap e Estado Detalhado

O estado detalhado do que está feito/pendente está em:  
👉 [`notyet/README.md`](../notyet/README.md) — Roadmap completo do ASL (fonte de verdade do progresso)

---

## 📚 Documentação Relacionada

- [`docs/AI_ASSISTANT_CONTEXT.md`](./AI_ASSISTANT_CONTEXT.md) — Contexto geral NeuroForge (QEMU, AVR, ESP32)
- [`notyet/README.md`](../notyet/README.md) — Roadmap e estado de implementação ASL
- [`src/engine/asl/ASLTypes.ts`](../src/engine/asl/ASLTypes.ts) — Schema ASL (fonte única de verdade)
- [`src/engine/asl/ASLExecutor.ts`](../src/engine/asl/ASLExecutor.ts) — Runtime
- [`src/engine/asl/codeToASL.ts`](../src/engine/asl/codeToASL.ts) — Transpiler
- [`src/engine/SimulationEngine.ts`](../src/engine/SimulationEngine.ts) — Engine fake-mode

---

**Use este documento como base para todas as respostas futuras sobre o subsistema ASL do NeuroForge.**
