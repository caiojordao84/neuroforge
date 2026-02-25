# Parser Integration Guide
# MicroPython / CircuitPython / Rust → ASL Pipeline

> **Branch:** `switchAndGenerators`  
> **Autor:** Documento gerado após análise completa de `PythonParser.ts`, `RustParser.ts`, `codeToASL.ts` e `LanguageRegistry.ts`  
> **Objetivo:** Ligar os parsers existentes (mas órfãos) ao pipeline ASL e estabelecer o padrão para futuras linguagens.

---

## 0. Descoberta Crítica — O Pipeline Já Está Parcialmente Montado

Após análise de `codeToASL.ts`, o estado real é:

| Linguagem | Parser | `codeToASL.ts` roteia? | `statementRegistry` completo? | `isASLSupported` | Estado Real |
|-----------|--------|----------------------|------------------------------|-----------------|-------------|
| **C/C++** | `RecursiveDescentCParser` | ✅ | ✅ | `true` | ✅ Funciona |
| **MicroPython** | `PythonParser` | ✅ (`case 'micropython'`) | ❌ Faltam handlers | `true` | ⚠️ Parser conectado, transformações incompletas |
| **CircuitPython** | `PythonParser` | ✅ (`case 'circuitpython'`) | ❌ Faltam handlers | `true` | ⚠️ Mesmo que MicroPython |
| **Rust** | `RustParser` | ❌ Sem `case 'rust'` | ❌ Faltam handlers | `false` | ❌ Completamente desconectado |

### Conclusão:
- **MicroPython/CircuitPython:** O parser chega ao `astToASL()` — só faltam handlers no `statementRegistry.ts` para os nós Python-específicos.
- **Rust:** Precisa de 2 mudanças cirúrgicas: `case 'rust'` no `codeToASL.ts` + `isASLSupported: true` no `LanguageRegistry.ts`. Depois, handlers.

---

## 1. Arquitetura do Pipeline (Como Realmente Funciona)

```
┌──────────────────┐
│   Código Fonte   │
│ (.py / .rs / .c) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐        parseToProgramNode()
│  codeToASL.ts    │──────────────────────────────────────────────┐
│  entry point     │   switch(language)                           │
└──────────────────┘   case 'cpp'/'c'  → RecursiveDescentCParser  │
                       case 'micropython'                         │
                       case 'circuitpython'                       ├──► ProgramNode
                       case 'python'   → PythonParser             │   (AST Universal)
                       case 'rust'     → RustParser  (FALTA!)     │
                       default         → ProgramNode vazio        │
                                                                  │
                                                 ┌────────────────┘
                                                 │
                                                 ▼
                                        astToASL()           ◄── Mesmo para todas as linguagens
                                                 │
                                                 ▼
                                        transformBlock()
                                                 │
                                                 ▼
                                        statementRegistry     ◄── Handlers por nodeType
                                                 │
                                                 ▼
                                        ASLProgram            ◄── Output universal
                                                 │
                                                 ▼
                                        ASLExecutor / Generators
```

---

## 2. Nós Produzidos por Cada Parser

### 2.1. `PythonParser.ts` — Nós que gera

O `PythonParser` (via `PythonCstToAst` com tree-sitter, ou `RegexPythonParser` como fallback) produz:

| nodeType | Origem Python | Atributos relevantes |
|----------|--------------|---------------------|
| `Function` | `def setup():` / `def loop():` / `while True:` | `name: 'setup'\|'loop'` |
| `VariableDeclaration` | `x = 5` / `pin = Pin(2, Pin.OUT)` | `name`, `type: 'auto'` |
| `IfStatement` | `if cond:` / `elif` / `else:` | — |
| `WhileLoop` | `while cond:` | — |
| `ForLoop` | `for i in range(n):` | Normalizado: `init + cond + update` |
| `ReturnStatement` | `return val` | — |
| `ExpressionStatement` | Qualquer expressão como statement | `children[0]` = nó interno |
| `Print` | `print(...)` | `children[]` = args |
| `DelayMs` | `time.sleep_ms(n)` / `sleep(n)` / `utime.sleep_ms(n)` | `children[0]` = ms |
| `CallExpression` | Qualquer chamada de função | `callee: 'Pin.on'\|'Pin.off'\|'Pin.value'\|'pinMode'\|...` |
| `GpioSet` | `gpio_set(pin, val)` | `children[0]` = pin, `children[1]` = val |
| `BinaryExpression` | `a + b`, `a == b`, `a and b` | `operator` |
| `UnaryExpression` | `not x`, `-x` | `operator`, `prefix` |
| `Literal` | `5`, `True`, `False`, `"texto"` | `value`, `isString?` |
| `Identifier` | `x`, `led`, `pin` | `name` |
| `Empty` | nós não reconhecidos | — |

### 2.2. `RustParser.ts` — Nós que gera

| nodeType | Origem Rust | Atributos relevantes |
|----------|------------|---------------------|
| `Function` | `fn setup()` / `fn loop()` | `name` |
| `VariableDeclaration` | `let mut x = 0;` / `let x = 5;` | `name`, `type: 'int'` |
| `IfStatement` | `if cond { } else { }` | — |
| `WhileLoop` | `while cond { }` / `loop { }` | `loop {}` → `cond = literal(1)` |
| `ForLoop` | `for i in 0..10 { }` | Normalizado: `init + cond + update` |
| `ExpressionStatement` | Qualquer expressão como statement | — |
| `GpioSet` | `gpio_set(pin, val)` / `digitalWrite(pin, val)` | `children[]` |
| `DelayMs` | `delay(ms)` / `delay_ms(ms)` | `children[0]` = ms |
| `Print` | `println!("...")` | `children[0]` = texto literal |
| `CallExpression` | Qualquer chamada | `callee: 'funcName'` |
| `BinaryExpression` | `a + b`, `a == b` | `operator` |
| `Literal` | `42`, `true`, `"texto"` | `value`, `isString?` |
| `Identifier` | `x`, `gpio_pin` | `name` |

---

## 3. O Que Falta: Handlers no `statementRegistry.ts`

### 3.1. Handlers em Falta para Python/MicroPython/CircuitPython

Os nós abaixo são produzidos pelo `PythonParser` mas não têm handler no `statementRegistry`:

```typescript
// Em statementRegistry.ts — adicionar estas entradas:

// ── Print ──────────────────────────────────────────────────────────────────
Print: (node, ctx) => [{
    kind: 'call',
    callee: 'Serial.println',
    args: node.children.map(c => transformExpr(c)),
} as ASLStatement],

// ── DelayMs ────────────────────────────────────────────────────────────────
DelayMs: (node, ctx) => [{
    kind: 'delay',
    ms: transformExpr(node.children[0]),
} as ASLStatement],

// ── GpioSet (Rust e Python) ────────────────────────────────────────────────
GpioSet: (node, ctx) => [{
    kind: 'call',
    callee: 'digitalWrite',
    args: node.children.map(c => transformExpr(c)),
} as ASLStatement],

// ── ExpressionStatement — já existe, mas precisa encaminhar nós internos ────
// O handler existente provavelmente usa `transformCallToStmt`.
// Garantir que `callTransform.ts` trata:
//   callee 'Pin.on'    → digitalWrite(pin, HIGH)
//   callee 'Pin.off'   → digitalWrite(pin, LOW)
//   callee 'Pin.value' (1 arg) → digitalWrite(pin, val)
//   callee 'Pin.value' (0 args) → digitalRead(pin)
//   callee 'pinMode'   → pinMode(pin, mode)
```

### 3.2. Mapeamento `CallExpression` Python → ASL (em `callTransform.ts`)

```typescript
// Em callTransform.ts → transformCallToStmt() ou secção adicional:

const PYTHON_CALL_MAP: Record<string, (args: ASLExpr[], ctx: TransformContext) => ASLStatement | null> = {

    'Pin.on': (args) => ({
        kind: 'call',
        callee: 'digitalWrite',
        args: [args[0], { kind: 'literal', value: 1 }],
    }),

    'Pin.off': (args) => ({
        kind: 'call',
        callee: 'digitalWrite',
        args: [args[0], { kind: 'literal', value: 0 }],
    }),

    'Pin.value': (args) => {
        if (args.length >= 2) {
            return {
                kind: 'call',
                callee: 'digitalWrite',
                args: [args[0], args[1]],
            };
        }
        // 0 args → read
        return {
            kind: 'read',
            target: args[0],
            mode: 'DIGITAL',
        };
    },

    'pinMode': (args) => ({
        kind: 'call',
        callee: 'pinMode',
        args,
    }),
};
```

### 3.3. Handlers em Falta para Rust

Os nós do `RustParser` são mais próximos do C — `GpioSet`, `DelayMs`, `Print` coincidem com o mapeamento Python. O handler de `GpioSet` em 3.1 serve os dois.

---

## 4. As Duas Mudanças Cirúrgicas para Rust

### 4.1. `codeToASL.ts` — Adicionar `case 'rust'`

```typescript
// Em parseToProgramNode(), adicionar depois do bloco python:

case 'rust': {
    const parser = new RustParser();
    await parser.init();
    if (!parser.isReady()) {
        // Sem WASM → retornar programa vazio com erro
        console.warn('[codeToASL] RustParser not ready (missing tree-sitter-rust.wasm)');
        return { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
    }
    const { ast } = parser.parse(source);
    return ast;
}
```

**Import necessário no topo do ficheiro:**
```typescript
import { RustParser } from './plugins/rust/RustParser';
```

### 4.2. `LanguageRegistry.ts` — Activar Rust

```typescript
// Mudar:
{
    id: 'rust',
    label: 'Rust',
    extension: '.rs',
    monacoLanguage: 'rust',
    isASLSupported: false,   // ← antes
},

// Para:
{
    id: 'rust',
    label: 'Rust',
    extension: '.rs',
    monacoLanguage: 'rust',
    isASLSupported: true,    // ← depois
},
```

---

## 5. Testes de Integração

Para cada linguagem, validar com os seguintes fixtures:

### 5.1. MicroPython (T-MP-1 a T-MP-4)

**T-MP-1 — Blink básico (MicroPython)**
```python
from machine import Pin
import time

led = Pin(25, Pin.OUT)

while True:
    led.on()
    time.sleep_ms(500)
    led.off()
    time.sleep_ms(500)
```
_Critério:_ LED no pino 25 alterna a cada 500 ms. `led.on()` → `digitalWrite(led, 1)` na ASL.

**T-MP-2 — Blink com `led.value`**
```python
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.value(1)
    time.sleep_ms(200)
    led.value(0)
    time.sleep_ms(200)
```
_Critério:_ `led.value(1)` → `digitalWrite(2, 1)`, `led.value(0)` → `digitalWrite(2, 0)`.

**T-MP-3 — Serial print com if**
```python
import time

x = 5

while True:
    if x > 3:
        print("HIGH")
    else:
        print("LOW")
    time.sleep_ms(1000)
```
_Critério:_ Serial imprime "HIGH" em loop. Variável `x` inicializada como global.

**T-MP-4 — For loop**
```python
from machine import Pin
import time

led = Pin(10, Pin.OUT)

while True:
    for i in range(5):
        led.on()
        time.sleep_ms(100)
        led.off()
        time.sleep_ms(100)
    time.sleep_ms(1000)
```
_Critério:_ LED pisca 5 vezes e pausa 1 segundo em loop.

---

### 5.2. CircuitPython (T-CP-1 a T-CP-3)

**T-CP-1 — Blink CircuitPython**
```python
import board
import digitalio
import time

led = digitalio.DigitalInOut(board.D13)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = True
    time.sleep(0.5)
    led.value = False
    time.sleep(0.5)
```
_Critério:_ `led.value = True` → `digitalWrite(13, 1)`. `time.sleep(0.5)` → `delay(500)`.

**T-CP-2 — LED com board.LED**
```python
import board
import digitalio
import time

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = not led.value
    time.sleep(1)
```
_Critério:_ `board.LED` → pino 25 (RP2040 default). Toggle em loop de 1 segundo.

**T-CP-3 — Input + Output**
```python
import board
import digitalio
import time

btn = digitalio.DigitalInOut(board.D5)
btn.direction = digitalio.Direction.INPUT

led = digitalio.DigitalInOut(board.D13)
led.direction = digitalio.Direction.OUTPUT

while True:
    if btn.value:
        led.value = True
    else:
        led.value = False
    time.sleep(0.1)
```
_Critério:_ LED acende quando botão no D5 está premido.

---

### 5.3. Rust (T-RS-1 a T-RS-3)

**T-RS-1 — Blink Rust (subset NeuroForge)**
```rust
fn setup() {
    // pinMode equivalente — não necessário no subset
}

fn loop() {
    gpio_set(25, 1);
    delay(500);
    gpio_set(25, 0);
    delay(500);
}
```
_Critério:_ `gpio_set(25, 1)` → `GpioSet` na ASL → `digitalWrite(25, HIGH)` na simulação.

**T-RS-2 — Serial print com while**
```rust
fn loop() {
    let mut i = 0;
    while i < 3 {
        println!("Step {}");
        i = i + 1;
        delay(500);
    }
}
```
_Critério:_ Imprime "Step {}" 3 vezes. `i` incrementa correctamente.

**T-RS-3 — loop {} como while(true)**
```rust
fn main() {
    loop {
        gpio_set(10, 1);
        delay(200);
        gpio_set(10, 0);
        delay(200);
    }
}
```
_Critério:_ `loop {}` → `WhileLoop(cond=1)` na AST → `while(true)` na ASL. LED pisca indefinidamente.

---

## 6. Plano de Implementação

### Fase 1 — MicroPython/CircuitPython (Prioridade Alta)

Ficheiros a modificar:

```
src/engine/asl/transforms/statementRegistry.ts
    + handler: Print
    + handler: DelayMs
    + handler: GpioSet

src/engine/asl/transforms/callTransform.ts
    + PYTHON_CALL_MAP: Pin.on, Pin.off, Pin.value, pinMode
```

Ficheiros NÃO modificar (já funcionam):
- `codeToASL.ts` — já faz `case 'micropython'/'circuitpython'/'python': PythonParser`
- `LanguageRegistry.ts` — já tem `isASLSupported: true` para python/micropython/circuitpython
- `PythonParser.ts` — já funciona, tree-sitter + fallback regex

---

### Fase 2 — Rust (Prioridade Média)

Ficheiros a modificar:

```
src/engine/asl/codeToASL.ts
    + case 'rust': RustParser (+ import)

src/engine/asl/LanguageRegistry.ts
    + isASLSupported: true para Rust

src/engine/asl/transforms/statementRegistry.ts
    + handler: GpioSet (partilhado com Python — adicionar uma só vez na Fase 1)
    + handler: DelayMs (idem)
    + handler: Print (idem)
```

Ficheiro NÃO modificar:
- `RustParser.ts` — já funciona, tree-sitter (precisa de `tree-sitter-rust.wasm` em `public/`)

---

### Fase 3 — Documentação e Template Extensível

Ficheiro a criar: `docs/adding-new-language.md`

---

## 7. Template para Novas Linguagens

Usar este checklist para qualquer linguagem nova (Zig, Ada, Go, Lua):

```
□ Passo 1 — Parser
   ├── Criar src/engine/asl/plugins/{lang}/{Lang}Parser.ts
   ├── Deve retornar: { ast: ProgramNode, errors: AnalysisIssue[] }
   ├── ProgramNode com Function nodes ('setup' e/ou 'loop' ou 'main')
   └── Usar TreeSitterLoader se grammar disponível; regex fallback caso contrário

□ Passo 2 — Conectar no Pipeline
   ├── Em codeToASL.ts → parseToProgramNode()
   │   └── Adicionar: case '{lang}': new {Lang}Parser()
   └── Em LanguageRegistry.ts
       └── Adicionar entry com isASLSupported: true

□ Passo 3 — Handlers
   └── Em statementRegistry.ts
       └── Adicionar handlers para nodeTypes específicos da linguagem
           (se o parser gera nós que o registry não conhece)

□ Passo 4 — Testes
   └── 4 fixtures: blink, serial, for loop, if/else
       └── Validar: código fonte → ASL → simulação funciona

□ Passo 5 — Documentar subset
   └── Adicionar à secção 7 do notyet/README.md
       └── Lista dos construtos suportados (no estilo 0.3)
```

### Template de Parser

```typescript
// src/engine/asl/plugins/{lang}/{Lang}Parser.ts

import type { ProgramNode, AnalysisIssue } from '@/system/types';

export class {Lang}Parser {
    private parser: any = null;
    private ready = false;

    async init() {
        if (this.ready) return;
        try {
            // Opção A: tree-sitter
            // this.parser = await TreeSitterLoader.createParser('{lang}');
            // this.ready = true;

            // Opção B: parser manual / regex
            // this.ready = true;
        } catch (e) {
            console.warn('[{Lang}Parser] init failed:', e);
        }
    }

    isReady() { return this.ready; }

    parse(code: string): { ast: ProgramNode; errors: AnalysisIssue[] } {
        if (!this.ready) {
            return {
                ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] },
                errors: [{ severity: 'CRITICAL', message: '{Lang}Parser not ready' }]
            };
        }
        // Implementar conversão código → ProgramNode
        // A AST DEVE seguir os nodeTypes que o statementRegistry conhece:
        //   Function, VariableDeclaration, IfStatement, WhileLoop,
        //   ForLoop, ExpressionStatement, ReturnStatement,
        //   Print, DelayMs, GpioSet, CallExpression, BinaryExpression,
        //   UnaryExpression, Literal, Identifier
        return { ast: { nodeType: 'Program', id: 'root', attributes: {}, children: [] }, errors: [] };
    }
}
```

---

## 8. Resumo do Commit

Após implementar as Fases 1 e 2, o commit único deverá conter:

```
feat(asl): connect Python/Rust parsers to ASL pipeline

- codeToASL.ts: add case 'rust' → RustParser
- LanguageRegistry.ts: isASLSupported: true for Rust
- statementRegistry.ts: add handlers Print, DelayMs, GpioSet
- callTransform.ts: map Pin.on/off/value/pinMode → ASL calls

Enables: MicroPython → ASL, CircuitPython → ASL, Rust → ASL
Fixtures: T-MP-1..4, T-CP-1..3, T-RS-1..3
```

Ficheiros modificados:
```
src/engine/asl/codeToASL.ts
src/engine/asl/LanguageRegistry.ts
src/engine/asl/transforms/statementRegistry.ts
src/engine/asl/transforms/callTransform.ts
```

---

## 9. Estado Após Integração

| De | Para | Via | Estado Pós-Integração |
|----|------|-----|----------------------|
| **C/C++** | **C/C++** | CParser → ASL → CGenerator | ✅ Já funciona |
| **C/C++** | **MicroPython** | CParser → ASL → PythonGenerator | ✅ Já funciona |
| **C/C++** | **Rust** | CParser → ASL → RustGenerator | ✅ Já funciona |
| **MicroPython** | **Simulação** | PythonParser → ASL → ASLExecutor | ✅ Após esta integração |
| **MicroPython** | **C/C++** | PythonParser → ASL → CGenerator | ✅ Após esta integração |
| **MicroPython** | **Rust** | PythonParser → ASL → RustGenerator | ✅ Após esta integração |
| **CircuitPython** | **Simulação** | PythonParser → ASL → ASLExecutor | ✅ Após esta integração |
| **CircuitPython** | **C/C++** | PythonParser → ASL → CGenerator | ✅ Após esta integração |
| **Rust** | **Simulação** | RustParser → ASL → ASLExecutor | ✅ Após esta integração |
| **Rust** | **C/C++** | RustParser → ASL → CGenerator | ✅ Após esta integração |
| **Rust** | **MicroPython** | RustParser → ASL → PythonGenerator | ✅ Após esta integração |
