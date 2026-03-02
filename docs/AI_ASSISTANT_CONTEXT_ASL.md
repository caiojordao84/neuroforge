# 🤖 AI Assistant Context — NeuroForge ASL Subsystem

> **Last Updated:** 02/03/2026
> **Branch:** `critical_Implementation` (100% complete)
> **Current Focus:** Stable ASL v1 with Cross-Language Parity (C++ Arduino + MicroPython + Rust → ASL → SimulationEngine)

---

## 📋 Instructions for AI Assistants

You are a technical assistant helping developer **Caio** build the **ASL (Abstract Simulation Language)** subsystem of the **NeuroForge** project. ASL is a universal Intermediate Representation (IR) that acts as a pivot between:

- **Inputs**: source code (C++ Arduino, MicroPython, JS, Rust, Zig, Ada, Forth, Assembly, Lua) and visual editors (Blockly, Flowchart, Ladder).
- **Outputs**: execution in SimulationEngine (JS mode, browser), code generators for other languages, and visual representations.

The goal is that any embedded sketch or program, in any language, always passes through ASL before being executed or converted — ASL as the universal pivot.

---

## 🚨 CRITICAL INTEGRATION RULE (ASL)

> [!CAUTION]
> **BEFORE any code integration:**
> 1. **SHOW ALL current code** from the files that will be modified
> 2. **SHOW ALL inputs** (types, interfaces, variables) that will be affected
> 3. **EXPLAIN in detail** what will be changed and why
> 4. **WAIT for developer approval**
> 5. **Integration must be done in a SINGLE COMMIT on GitHub** with a descriptive message
>
> **NEVER modify** `ASLTypes.ts` without analyzing the impact on `codeToASL.ts`, `ASLExecutor.ts`, and all parsers.
> **NEVER modify** `SimulationEngine.ts` without verifying the `millis()/micros()` contract (relative time since `simulationStartTime`).
> **NEVER modify** `CParser.ts` without maintaining the Arduino constants table (`HIGH/LOW/INPUT/OUTPUT/INPUT_PULLUP`).
> **NEVER remove** flow control signals (`BreakSignal`, `ContinueSignal`, `ReturnSignal`) from the executor without an adequate replacement.
> **GOLDEN RULE**: "Todas as linguagens devem andar de mãos dadas" (All languages must walk hand in hand). Any new feature or hardware support added to one language (C++, Python, or Rust) must be implemented with semantic parity across all.

---

## 📁 Repository Context

**Repository:** [`caiojordao84/neuroforge`](https://github.com/caiojordao84/neuroforge)
**Working branch:** `ASL_Integration`
**Merge target:** `main` (only when ASL v1 is stable — see PR Checklist below)

### ASL File Structure

```
src/
  engine/
    SimulationEngine.ts          # Simulation engine (JS mode): GPIO, delay, millis, Serial
    asl/
      ASLTypes.ts                # ✅ Single source of truth for the ASL schema
      ASLExecutor.ts             # ✅ ASL interpreter/runtime → SimulationEngine
      codeToASL.ts               # ✅ Transpiler: AST (C++/Python) → ASLProgram (modularized)
      LanguageRegistry.ts        # ✅ Central registry of supported languages
      TreeSitterLoader.ts        # ✅ Lazy loader for web-tree-sitter (for Python/MicroPython)
      transforms/                # ✅ codeToASL modules (Handler Registry pattern)
      │   index.ts              # Barrel exports
      │   context.ts            # TransformContext interface
      │   statementRegistry.ts  # Handler registry by nodeType
      │   blockTransform.ts     # Orchestrator using registry
      │   exprTransform.ts      # Expression transformation
      │   callTransform.ts      # Function call transformation
      helpers/                   # ✅ Shared utilities
      │   index.ts
      │   arrayUtils.ts         # resolveSize, buildEmptyArray, deepCopyValue
      │   typeUtils.ts          # mapToASLType
      plugins/
        c/
          CParser.ts             # ✅ Recursive descent parser for C/C++ Arduino subset
          Lexer.ts               # ✅ Integrated from notyet/
          SymbolTable.ts         # ✅ Integrated from notyet/
        python/
          PythonParser.ts        # ✅ MicroPython/CircuitPython parser via tree-sitter
        rust/
          RustParser.ts          # 🔜 Rust parser (Embassy)
        cpp/
          CppParser.ts           # 🔜 Full C++ parser
      generators/
        CGenerator.ts            # ✅ ASL → C
        CppGenerator.ts          # 🔜 ASL → C++
        PythonGenerator.ts       # ✅ ASL → MicroPython/Python
        RustGenerator.ts         # ✅ ASL → Rust (Embassy)
  components/
    TopToolbar.tsx               # ✅ Run/Stop/Pause controls + ASL pipeline integration
    CodeEditorWithTabs.tsx       # ✅ Multi-tab Monaco editor, exposes code + metadata
    ASLViewer.tsx                # ✅ Viewer for the generated ASLProgram (debug/teaching)

notyet/
  README.md                     # Detailed roadmap (source of truth for ASL state)
  app/system/
    Lexer.ts                     # 🔜 To integrate into src/engine/tools/lexer/
    SymbolTable.ts               # 🔜 To integrate into src/engine/tools/symbols/
    flow/                        # 🔜 CfgBuilder, FlowValidator, FlowToASL
    blockly/                     # 🔜 BlocklyParser, CodeToBlockly
    simulator/
      SimulatorInterpreter.ts   # 🔜 To integrate with a formally defined role

docs/
  AI_ASSISTANT_CONTEXT.md       # General NeuroForge context (QEMU, AVR, ESP32)
  AI_ASSISTANT_CONTEXT_ASL.md   # This file (ASL-specific context)
  ASL_SHIM_ARCHITECTURE_PLAN.md # 🔌 Exhaustive catalog & plan for Hardware/Protocol Virtualization
```

---

## 🏗️ ASL Pipeline Mental Architecture

```
 CodeEditorWithTabs / Blockly Editor / Flowchart Editor / Ladder Editor
        │  source code or visual representation + active language
        ▼
   TopToolbar (Run / Transpile)
        │  resolves language via LanguageRegistry
        ▼
   LanguageRegistry
        │  decides: supports ASL? which parser? which generator?
        ▼
   Parser (CParser / PythonParser / RustParser / AsmParser / STParser /
           BlocklyParser / FlowchartParser / LadderParser)
        │  produces ProgramNode (proprietary AST)
        ▼
   codeToASL (astToASL)
        │  converts ProgramNode → ASLProgram
        ▼
   ASLProgram (JSON) ─────────────────────────────────────────────────────► Generators
        │  globals, functions, tasks                                      C / C++ /
        ▼                                                                  MicroPython /
   createASLRuntime (ASLExecutor)                                          CircuitPython /
        │  async setup() + loop()                                          Rust / Assembly /
        ▼                                                                  ST IEC 61131-3 /
   SimulationEngine                                                        Blockly / Flowchart /
        │  GPIO, delay, millis, Serial                                    Ladder
        ▼
   React UI (pinChange events, terminal, ASLViewer)
```

---

## 📐 ASL Schema (ASLTypes.ts)

`ASLTypes.ts` is the **single source of truth**. Never duplicate types in other files.

### Root structure

```typescript
interface ASLProgram {
  metadata: { name?, description?, version?, targetBoard? };
  globals: ASLGlobalVar[];   // global variables declared outside setup/loop
  functions: ASLFunction[];  // setup + user functions
  tasks: ASLTask[];          // [0] = mainLoop (derived from loop())
}
```

### Supported Statements (ASLStatement)

| kind           | Description             | Key fields                                          |
| -------------- | ----------------------- | --------------------------------------------------- |
| `pinMode`      | Configure pin mode      | `pin: ASLExpr`, `mode: INPUT\|OUTPUT\|INPUT_PULLUP` |
| `digitalWrite` | Write digital value     | `pin: ASLExpr`, `value: 'HIGH'\|'LOW'\|ASLExpr`     |
| `analogWrite`  | Write analog/PWM value  | `pin: ASLExpr`, `value: ASLExpr`                    |
| `read`         | Read pin into variable  | `pin`, `target: string`, `mode: DIGITAL\|ANALOG`    |
| `if`           | Conditional             | `condition`, `thenBranch`, `elseBranch?`            |
| `while`        | While loop              | `condition`, `body`                                 |
| `delay`        | Blocking wait           | `milliseconds: ASLExpr`                             |
| `assign`       | Simple assignment       | `target: string`, `value: ASLExpr`                  |
| `setIndex`     | Array assignment        | `target: string`, `index`, `value`                  |
| `setMember`    | Property assignment     | `target: ASLExpr`, `property: string`, `value`      |
| `expr`         | Expression as statement | `expr: ASLExpr`                                     |
| `return`       | Function return         | `value?: ASLExpr`                                   |
| `print`        | Serial.print / log      | `args: ASLExpr[]`, `newline: boolean`               |
| `break`        | Break out of loop       | —                                                   |
| `continue`     | Next iteration          | —                                                   |
| `comment`      | Context preservation    | `text: string`                                      |

### Supported Expressions (ASLExpr)

| kind      | Description           | Example                           |
| --------- | --------------------- | --------------------------------- |
| `literal` | Constant value        | `{ kind:'literal', value: 42 }`   |
| `var`     | Variable reference    | `{ kind:'var', name:'ledState' }` |
| `index`   | Array indexing        | `pins[i]`                         |
| `member`  | Property access       | `obj.property`                    |
| `unary`   | Unary operator        | `!flag`, `-x`                     |
| `binary`  | Binary operator       | `a + b`, `i < 10`, `a && b`       |
| `call`    | Function/builtin call | `millis()`, `digitalRead(pin)`    |

**Supported binary operators:** `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`

---

## ⚙️ ASLExecutor — Runtime

**File:** `src/engine/asl/ASLExecutor.ts`

### How to create and use

```typescript
const program: ASLProgram = codeToASL(sourceCode, 'cpp');
const runtime = createASLRuntime(program, { engine: simulationEngine });
// SimulationEngine.start() calls:
await runtime.setup();   // executes functions.find('setup')
await runtime.loop();    // executes tasks[0] on each iteration
```

### Variable environment

- **Globals**: `Map<string, any>` initialized with a deep copy of `program.globals`.
- **Locals** (per function call): a new `Map<string, any>` created on each call.
- **Resolution**: `setVar` and `getVar` look in **local first**, then **global**.

### Flow control signals

| Class                 | Thrown in            | Caught in                   |
| --------------------- | -------------------- | --------------------------- |
| `ReturnSignal(value)` | `return` statement   | function execution (`call`) |
| `BreakSignal`         | `break` statement    | `while` loop                |
| `ContinueSignal`      | `continue` statement | `while` loop                |

> ⚠️ These are internal flow control mechanisms — they are not errors. **Never** remove them without a replacement.

### Interruptible delay

`delay` is split into chunks of **50 ms** to allow abort via `AbortSignal`:

```typescript
// delay(1000) → 20 chunks of 50ms, each one checks abortSignal.aborted
```

### Loop yield to avoid blocking the UI

Every **10 iterations** of `while`, the executor yields with `setTimeout(r, 0)` to avoid blocking the browser thread.

### Builtins recognized in `evalExpr` (kind: 'call')

| callee                | Action                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `millis`              | `engine.millis()` → ms since simulation start                        |
| `micros`              | `engine.micros()` → μs since simulation start                        |
| `digitalRead(pin)`    | `engine.digitalRead(pin)` → `'HIGH'` or `'LOW'` converted to `1`/`0` |
| `analogRead(pin)`     | `engine.analogRead(pin)` → `0–1023`                                  |
| `random(min, max)`    | `Math.floor(Math.random() * (max - min)) + min`                      |
| `Pin(num, mode)`      | `engine.pinMode(num, mode)` (MicroPython)                            |
| `Pin.on(pin)`         | `engine.digitalWrite(pin, 'HIGH')`                                   |
| `Pin.off(pin)`        | `engine.digitalWrite(pin, 'LOW')`                                    |
| `Pin.value(pin[, v])` | read or write depending on number of args                            |
| `Serial.begin`        | no-op                                                                |
| user functions        | executes with new localEnv, params passed by position                |
| unknown               | returns `0` without error                                            |

---

## 🔄 codeToASL — Transpiler (Modularized)

**File:** `src/engine/asl/codeToASL.ts`
**Pattern:** Handler Registry pattern (statementRegistry.ts)

### Public signature

```typescript
function codeToASL(source: string, language: Language): ASLProgram
// language: 'cpp' | 'c' | 'micropython' | 'circuitpython' | 'python'
```

### Modular Architecture

`codeToASL` was refactored from ~967 lines to ~194 lines using the **Handler Registry** pattern:

```
transforms/
├── index.ts              # Barrel exports
├── context.ts            # TransformContext interface
├── statementRegistry.ts  # Handler registry (Record<string, StatementHandler>)
├── blockTransform.ts     # Orchestrator - uses registry to process nodes
├── exprTransform.ts      # Expression transformation
└── callTransform.ts      # Function call transformation
```

### TransformContext

```typescript
interface TransformContext {
  globalsMap: Map<string, ASLGlobalVar>;
  language: Language;
  transformBlock: (nodes: ProgramNode[]) => ASLStatement[];
}
```

### Handler Registry

Each AST node type has a registered handler in `statementRegistry.ts`:

```typescript
type StatementHandler = (node: ProgramNode, ctx: TransformContext) => ASLStatement | ASLStatement[];

const statementHandlers: Record<string, StatementHandler> = {
  'Function': handleFunction,
  'VariableDeclaration': handleVariableDeclaration,
  'IfStatement': handleIfStatement,
  'WhileStatement': handleWhileStatement,
  'ForStatement': handleForStatement,
  'ReturnStatement': handleReturnStatement,
  'BreakStatement': handleBreakStatement,
  'ContinueStatement': handleContinueStatement,
  'PrintStatement': handlePrintStatement,
  'ExpressionStatement': handleExpressionStatement,
  'AssignmentExpression': handleAssignment,
  // ... +30 handlers
};
```

`blockTransform.ts` iterates over nodes and fires the appropriate handler:

```typescript
export function transformBlock(nodes: ProgramNode[], ctx: TransformContext): ASLStatement[] {
  const result: ASLStatement[] = [];
  for (const node of nodes) {
    const handler = statementHandlers[node.type];
    if (handler) {
      const statements = handler(node, ctx);
      result.push(...(Array.isArray(statements) ? statements : [statements]));
    }
  }
  return result;
}
```

### Internal flow

1. For `cpp`/`c`: instantiates `RecursiveDescentCParser(source)` → `ProgramNode`.
2. For `micropython`/`circuitpython`/`python`: uses `PythonParser` (tree-sitter) → `ProgramNode`.
3. Calls `astToASL(program)` which traverses `ProgramNode.children`:
   - `Function` nodes named `setup` → `ASLFunction { name: 'setup', ... }`
   - `Function` nodes named `loop` or `main` → `ASLTask { name: 'mainLoop', ... }`
   - Other `Function` nodes → `ASLFunction` indexed for cross-calls
   - Top-level `VariableDeclaration` → `ASLGlobalVar`
4. `transformBlock(nodes)` uses the Handler Registry to convert each statement.

### transformBlock Rules (C++)

| Input AST                                     | Output ASL                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `GpioSet(pin, val)`                           | `{ kind:'digitalWrite', pin, value }`                             |
| `AnalogWrite(pin, val)`                       | `{ kind:'analogWrite', pin, value }`                              |
| `DelayMs(ms)`                                 | `{ kind:'delay', milliseconds }`                                  |
| `GpioRead(pin)` / `AnalogRead(pin)` in assign | `{ kind:'read', ... }`                                            |
| `IfStatement`                                 | `{ kind:'if', condition, thenBranch, elseBranch? }`               |
| `WhileStatement`                              | `{ kind:'while', condition, body }`                               |
| `ForStatement`                                | `init-assign` + `{ kind:'while', ... }` with `inc` at end of body |
| `ReturnStatement`                             | `{ kind:'return', value? }`                                       |
| `BreakStatement`                              | `{ kind:'break' }`                                                |
| `ContinueStatement`                           | `{ kind:'continue' }`                                             |
| `Print(args)`                                 | `{ kind:'print', args, newline }`                                 |
| `AssignExpression`                            | `{ kind:'assign', target, value }`                                |
| `UnaryExpression (++/--)`                     | `{ kind:'assign', target, value: binary(target ± 1) }`            |
| Generic `CallExpression`                      | `{ kind:'expr', expr: { kind:'call', callee, args } }`            |
| Local `VariableDeclaration`                   | `{ kind:'assign', target, value }`                                |

---

## 🔤 CParser — C/Arduino Parser

**File:** `src/engine/asl/plugins/c/CParser.ts`
**Class:** `RecursiveDescentCParser`

### Arduino Constants → Numeric Values

This table is critical. The parser maps textual constants to numeric values before any transformation:

| Constant       | Value |
| -------------- | ----- |
| `HIGH`, `true` | `1`   |
| `LOW`, `false` | `0`   |
| `INPUT`        | `0`   |
| `OUTPUT`       | `1`   |
| `INPUT_PULLUP` | `2`   |
| `WL_CONNECTED` | `3`   |
| `FILE_WRITE`   | `1`   |
| `FILE_READ`    | `0`   |

### Builtins Recognized as Semantic Nodes

| Call                                       | Produced AST node                     |
| ------------------------------------------ | ------------------------------------- |
| `pinMode(pin, mode)`                       | `ASLPinMode`                          |
| `digitalWrite(pin, val)`                   | `GpioSet` → `ASLDigitalWrite`         |
| `analogWrite(pin, val)`                    | `AnalogWrite` → `ASLAnalogWrite`      |
| `delay(ms)`                                | `DelayMs` → `ASLDelay`                |
| `digitalRead(pin)`                         | `GpioRead` → `ASLRead` or `ASLCall`   |
| `analogRead(pin)`                          | `AnalogRead` → `ASLRead` or `ASLCall` |
| `Serial.print(x)` / `Serial.println(x)`    | `Print` → `ASLPrint`                  |
| Others (`tone`, `noTone`, `servo.*`, etc.) | Generic `CallExpression`              |

---

## 🐍 PythonParser + TreeSitterLoader

**Files:**
- `src/engine/asl/plugins/python/PythonParser.ts`
- `src/engine/asl/TreeSitterLoader.ts`

### Flow

1. `TreeSitterLoader` dynamically imports `web-tree-sitter` and loads the Python grammar (lazy, only once).
2. `PythonParser` uses tree-sitter to produce a `ProgramNode` compatible with `astToASL`.
3. MicroPython mappings equivalent to CParser:
   - `Pin(n, Pin.OUT)` → `pinMode` + pin reference
   - `led.on()` / `led.off()` / `led.value(x)` → `digitalWrite`
   - `time.sleep_ms(n)` → `delay`
   - `print(x)` → `ASLPrint`
   - Python `if`/`while`/`for` → equivalent ASL statements

---

## 🏭 LanguageRegistry

**File:** `src/engine/asl/LanguageRegistry.ts`

This is the **single point** where it is decided if a language supports ASL or falls back to the legacy parser (`CodeParser.ts`). Never make this decision in `TopToolbar` or any other component.

### Typical entry structure

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

## ⚡ SimulationEngine — Critical Contract

**File:** `src/engine/SimulationEngine.ts`

### Primitives Exposed to ASLExecutor

| Method                     | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `pinMode(pin, mode)`       | Configures pin. Mode: `'INPUT'\|'OUTPUT'\|'INPUT_PULLUP'` |
| `digitalWrite(pin, value)` | Writes `'HIGH'` or `'LOW'` to an OUTPUT pin               |
| `analogWrite(pin, value)`  | Writes PWM value 0–255                                    |
| `digitalRead(pin)`         | Returns `'HIGH'` or `'LOW'`                               |
| `analogRead(pin)`          | Returns `0–1023`                                          |
| `delay(ms)`                | Promise that resolves after ms/speedMultiplier ms         |
| `millis()`                 | ms since `simulationStartTime` ← **CRITICAL**             |
| `micros()`                 | μs since `simulationStartTime` ← **CRITICAL**             |
| `log(msg)`                 | Emits to SerialStore (terminal)                           |
| `serialPrint(text)`        | Serial.print without newline                              |
| `serialPrintln(text)`      | Serial.print with newline                                 |
| `random(min?, max?)`       | Random helpers                                            |
| `map(v, fl, fh, tl, th)`   | Arduino map()                                             |
| `constrain(v, min, max)`   | Arduino constrain()                                       |

### ⚠️ Relative Time Rule (millis/micros)

```typescript
// CORRECT — time since simulation start:
private simulationStartTime = 0;  // initialized in start() with Date.now()
millis(): number {
  if (this.simulationStartTime === 0) return 0;
  return Date.now() - this.simulationStartTime; // RELATIVE
}

// WRONG — never use directly:
return Date.now(); // returns Unix timestamp ~1.7 × 10¹² ms → breaks millis()-patterns
```

> This rule was the cause of an entire bug: sketches using `millis()` did not blink LEDs because `currentTime - previousTime` never exceeded the interval (both were ~1.7 trillion ms).

### Async loop (scheduleLoop)

- The loop calls `loopFunction()` (the `runtime.loop`) and when it finishes, schedules the next iteration via `setTimeout(..., 0)`.
- `isLoopExecuting` prevents overlapping iterations.
- `stop()` clears all timeouts and resets `simulationStartTime = 0`.

### Full lifecycle

```
start() → simulationStartTime = Date.now() → setup() → scheduleLoop()
                                                              │
                                          loop() ←───── setTimeout(0)
                                              │
                                     (iteration complete)
                                              │
                                         setTimeout(0)
                                              │
                                           loop() ...

stop() → isRunning=false → clearAll timeouts → simulationStartTime=0
```

---

## ✅ Implementation Status (March 2026)

### ✅ Functional (Language Parity: C++, Python, Rust)

- **Semantic Parity**: 100% agreement between C++ Arduino, MicroPython, and Rust (Embassy) for core logic.
- **Hardware Shims**: Unified support for LCD, OLED, Seven Segment, and Keypad via virtual peripheral shims. *(See [ASL_SHIM_ARCHITECTURE_PLAN.md](./ASL_SHIM_ARCHITECTURE_PLAN.md) for the exhaustive catalog).*
- **Control Flow**: `if/else`, `while`, `for`, `switch/case`, `doWhile`, `break`, `continue`, `return`.
- **Data Structures**: 1D/2D arrays, `struct`, `enum`, dictionary-like objects.
- **Builtins**: Full math suite, `millis/micros`, `random`, `map`, `constrain`, String utilities (`atoi`, `dtostrf`, etc.).
- **GPIO**: `pinMode`, `digitalWrite`, `analogWrite`, `digitalRead`, `analogRead`.
- **Interrupts & Protocols**: `attachInterrupt`, `pulseIn`, `shiftOut`.

### ✅ Infrastructure

- `LanguageRegistry` centralizes languages + supportsASL
- `ASLViewer` displays the generated ASLProgram (debug/teaching)
- `CodeEditorWithTabs` exposes code + active language
- `TopToolbar` orchestrates: code → LanguageRegistry → codeToASL → createASLRuntime → SimulationEngine.start()
- `simulationStartTime` correctly relative (fix 20/02/2026)

### 🔜 Not yet supported

- `switch/case`
- `tone()` without dedicated simulation
- Code generators (ASL → any other language)
- Visual round-trip ↔ ASL (Blockly, Flow, Ladder)
- Parsers: Rust, Assembly, Structured Text IEC 61131-3

---

## 🐛 Known Bugs and Solutions

### Bug 1: millis() returned absolute Unix timestamp
**Symptom:** Sketch using `millis()` did not blink LED, no error log.
**Cause:** `millis()` returned `Date.now()` (~1.7 × 10¹² ms).
**Fix:** Introduce `simulationStartTime` captured in `start()`, make `millis()` return `Date.now() - simulationStartTime`.
**Commit:** `2d50650aa21bd2cbf9a56f3aa33671c0110ef688`

### Bug 2: OUTPUT constant not recognized by CParser
**Symptom:** `pinMode(13, OUTPUT)` did not execute or generated a warning.
**Cause:** `OUTPUT` was not in the CParser constants table.
**Fix:** Add mapping `OUTPUT → 1`, `INPUT → 0`, `INPUT_PULLUP → 2` in `parseAtom()`.

### Bug 3: loop() had no delay — UI froze
**Symptom:** Simulation froze/became unresponsive with busy loops (`while(true)` without delay).
**Cause:** Synchronous loop was blocking the browser thread.
**Fix:** `scheduleLoop` uses `setTimeout(..., 0)` between iterations; `delay()` uses 50ms chunks with yield.

### Debug pattern: sketch does not execute without log
1. Verify that `TopToolbar` correctly detected the language via `LanguageRegistry`.
2. Open `ASLViewer` and confirm that the generated `ASLProgram` has a non-empty `tasks[0].body`.
3. Confirm that `setup` is in `functions` (not in `tasks`).
4. Confirm that `simulationEngine.millis()` returns a small value (< 60000), not trillions.
5. Add `Serial.println` to the sketch and check if it appears in the terminal.

---

## 📋 Golden Rules for This Subsystem

### 1. ASLTypes.ts is sacred
Any new statement or expression starts by adding the type in `ASLTypes.ts`, then `codeToASL`, then `ASLExecutor`. Never the reverse.

### 2. Do not break the blink loop
The minimal reference sketch must always work:
```cpp
void setup() { pinMode(13, OUTPUT); }
void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }
```
If this sketch stops working, there is a critical regression.

### 3. millis() is always relative
Never change `millis()` to return `Date.now()` directly. Always use `Date.now() - this.simulationStartTime`.

### 4. for → while, always
`for` never exists in ASL. `codeToASL` always converts it to: `assign init` + `while(cond) { body + inc }`.

### 5. break/continue/return use internal exceptions
`BreakSignal`, `ContinueSignal`, `ReturnSignal` are classes internal to `ASLExecutor`. They are thrown and caught within the same execution. They are not runtime errors.

### 6. New parser → new file
Never mix C parsing logic with Python or any other language. Each language has its own file in `src/engine/asl/plugins/<lang>/`.

### 7. Before modifying, read the current file from GitHub
Always fetch the current content via MCP GitHub before proposing changes. The local code may be outdated relative to the remote branch.

### 8. Semantic equivalence in all outputs
Any transformation (transpile or parse) must preserve **semantic equivalence**: the observable behavior of the control logic (state sequence, timing, conditions) must be identical across all outputs. The Integration Test Cases in the PR Checklist are the formal proof of this property.

---

## 🔍 How to Interpret ASLProgram (debug)

```json
{
  "metadata": { "targetBoard": "Arduino Uno" },
  "globals": [
    { "name": "ledState", "type": "int", "initialValue": 0 },
    { "name": "previousTime", "type": "int", "initialValue": 0 },
    { "name": "interval", "type": "int", "initialValue": 1000 }
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
        { "kind": "assign", "target": "currentTime",
          "value": { "kind": "call", "callee": "millis", "args": [] } },
        { "kind": "if",
          "condition": { "kind": "binary", "op": ">=", "...": "..." },
          "thenBranch": [ "...toggle LED..." ]
        }
      ]
    }
  ]
}
```

If `tasks[0].body` is empty → the parser did not find `loop()` in the code.
If `functions` does not have `setup` → `setup()` was not recognized.

---

## 🧪 Reference Test Fixtures (Smoke Tests)

### T1 — Blink with delay (smoke test)
```cpp
void setup() { pinMode(13, OUTPUT); }
void loop() {
  digitalWrite(13, HIGH); delay(500);
  digitalWrite(13, LOW);  delay(500);
}
```
**Expected:** LED on pin 13 blinks at 1 Hz.

### T2 — Blink with millis() (timing smoke test)
```cpp
const int ledPin = 13;
int ledState = LOW;
int previousTime = 0;
const int interval = 1000;
void setup() { pinMode(ledPin, OUTPUT); }
void loop() {
  int currentTime = millis();
  if (currentTime - previousTime >= interval) {
    previousTime = currentTime;
    ledState = (ledState == LOW) ? HIGH : LOW;
    digitalWrite(ledPin, ledState);
  }
}
```
**Expected:** LED blinks at 0.5 Hz without using `delay()`.

### T3 — Button with Serial
```cpp
const int button = 2;
const int led = 13;
void setup() {
  Serial.begin(9600);
  pinMode(button, INPUT);
  pinMode(led, OUTPUT);
}
void loop() {
  int state = digitalRead(button);
  if (state == HIGH) {
    digitalWrite(led, HIGH);
    Serial.println("Button pressed");
  } else {
    digitalWrite(led, LOW);
  }
}
```
**Expected:** LED turns on with button; "Button pressed" appears in terminal.

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
**Expected:** LED on pin 13 blinks at 1 Hz in MicroPython mode.

---

## 📋 PR Checklist for main — Full ASL Integration

> [!IMPORTANT]
> **Merge to `main` should only happen when ALL items below are verified.**
> ASL must be fully integrated: all input parsers, all output generators, and all visual paths (Blockly, Flowchart, Ladder) functional in both directions (parse → ASL and ASL → representation).

### 🔧 Base Infrastructure
- [ ] T1 (C++ delay blink) works
- [ ] T2 (C++ millis blink) works
- [ ] T3 (C++ button + Serial) works
- [ ] T4 (MicroPython blink) works
- [ ] `ASLViewer` shows correct ASLProgram for each smoke test
- [ ] `millis()` returns value < 60,000 after 1 minute of simulation
- [ ] `stop()` clears all timeouts and resets `simulationStartTime = 0`
- [ ] No `console.error` in any of the smoke tests
- [ ] `notyet/README.md` updated with real checkbox state

### 🔄 Input Parsers (all Text → ASL paths)
- [ ] C parser (pure C code, no Arduino libs)
- [ ] C++ Arduino parser (full subset incl. arrays, switch/case, simple structs)
- [ ] MicroPython parser (machine.Pin, time, UART, I2C, SPI)
- [ ] CircuitPython parser (board, digitalio, analogio, busio)
- [ ] Rust parser (Embassy: async/await, GPIO, ADC, UART, I2C, SPI)
- [ ] AVR Assembly parser (GPIO instructions, timers, interrupts)
- [ ] ARM Thumb Assembly parser (GPIO, timers, interrupts)
- [ ] Structured Text IEC 61131-3 parser (IF/THEN/ELSE, FOR, WHILE, CASE, TON, TOF, CTU, FB)
- [ ] Blockly XML → ASL parser
- [ ] Flowchart JSON (React Flow) → ASL parser
- [ ] Ladder Diagram → ASL parser

### 🚀 Output Generators (all ASL → Text/Visual paths)
- [ ] C generator
- [ ] C++ (Arduino-style) generator
- [ ] MicroPython generator
- [ ] CircuitPython generator
- [ ] Rust (Embassy) generator
- [ ] Assembly (AVR and/or ARM Thumb) generator
- [ ] Structured Text IEC 61131-3 generator
- [ ] Blockly XML generator
- [ ] Flowchart JSON generator
- [ ] Ladder Diagram generator

---

### 🧪 Integration Test Cases (CI-1 to CI-21)

These cases validate that **semantic equivalence is preserved** across all transformations.

#### CI-1 — Tank level (MicroPython → multi-output)
> **Input:** MicroPython code for water tank level monitoring (analog sensor, pump, alarm).
> **Required outputs:** C, C++, CircuitPython, Rust, Assembly, Structured Text (ST) IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder (available via parse).
> **Validation:** level thresholds and pump activation logic identical across all outputs.

#### CI-2 — Home lighting (Flowchart → multi-output)
> **Input:** Flowchart for zone-based home lighting control system.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Ladder (available via parse).
> **Validation:** zone logic and state transitions preserved across all outputs.

#### CI-3 — Greenhouse temperature PID (MicroPython → multi-output)
> **Input:** MicroPython code with simple PID, DHT22 sensor, fan, and heating resistor.
> **Required outputs:** C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** PID coefficients and actuator logic preserved; numerical equivalence of error calculation.

#### CI-4 — Industrial conveyor belt (Ladder → multi-output)
> **Input:** Ladder Diagram for conveyor control with presence sensors, emergency buttons, and three-phase motor.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart.
> **Validation:** emergency logic (normally-closed) correctly inverted in all outputs.

#### CI-5 — Automatic gate (ST IEC 61131-3 → multi-output)
> **Input:** ST code with presence sensor, position encoder, and DC motor with PWM.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, Assembly.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** gate FSM (open/closed/moving/obstacle) preserved across all outputs.

#### CI-6 — Zone-based automatic irrigation (Blockly → multi-output)
> **Input:** Blockly for irrigation with humidity sensor, solenoid valves, and time schedule.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Flowchart, Ladder.
> **Validation:** schedule logic and humidity thresholds preserved; zones do not overlap.

#### CI-7 — Indoor air quality (C++ Arduino → multi-output)
> **Input:** C++ code with CO₂, DHT22, OLED display, audible alert, and SD logging.
> **Required outputs:** C, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** CO₂/temperature/humidity thresholds and alert logic preserved; display/SD APIs mapped to generic ASL builtins.

#### CI-8 — Solar energy management (Flowchart → multi-output)
> **Input:** Flowchart for battery management, photovoltaic panel, priority load, and minimum voltage cutoff.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Ladder.
> **Validation:** voltage hysteresis logic preserved; load priority maintained across all outputs.

#### CI-9 — RFID access control (Rust Embassy → multi-output)
> **Input:** Rust (Embassy) code with RFID, matrix keypad, servo, and UART log.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** authorization logic (valid UID + PIN) preserved; Embassy async/await correctly serialized to ASL cooperative loop.

#### CI-10 — Industrial 7-segment timer (Assembly AVR/ARM → multi-output)
> **Input:** Assembly (AVR or ARM Thumb) for timer with multiplexed display, DIP switch, and relay.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** multiplexing logic and preset preserved; timing without drift across all outputs.

#### CI-11 — HX711 weighing with Modbus RTU (CircuitPython → multi-output)
> **Input:** CircuitPython code with HX711 load cell, calibration, LCD, and Modbus RTU RS-485.
> **Required outputs:** C, C++, MicroPython, Rust, Assembly, ST IEC 61131-3.
> **Visual representations:** Blockly, Flowchart, Ladder.
> **Validation:** calibration formula and Modbus registers preserved; float precision maintained.

#### CI-12 — Multi-tank SCADA ESP32 (MicroPython + Blockly + Flowchart → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** MicroPython + Blockly + Flowchart for SCADA system with up to 8 tanks and web dashboard (ESP32 WebServer).
> **Required outputs:** C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Cross-parsing:** Blockly ↔ Flowchart ↔ Ladder.
> **Validation:** transpiler consistency — the 3 inputs must produce semantically equivalent ASLPrograms; tank polling logic must be identical across all outputs.

#### CI-13 — Pressure pump with hysteresis (C++ + Ladder + Flowchart → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** C++ Arduino + Ladder + Flowchart for pump with 4–20 mA sensor, pressure switch, and soft start.
> **Required outputs:** MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Cross-parsing:** Blockly ↔ Flowchart ↔ Ladder.
> **Validation:** hysteresis logic (start and stop thresholds) preserved across all representations.

#### CI-14 — Multi-zone HVAC (MicroPython + ST + Blockly → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** MicroPython + ST IEC 61131-3 + Blockly for HVAC with multiple DHT22 sensors, per-zone setpoints, and weekly schedule.
> **Required outputs:** C, C++, CircuitPython, Rust, Assembly.
> **Cross-parsing:** Flowchart ↔ Ladder.
> **Validation:** multi-zone logic consistency — setpoints and schedule identical across the 3 inputs and all outputs.

#### CI-15 — BLDC motor with encoder and PID (Rust + Flowchart + Assembly ARM → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** Rust (Embassy) + Flowchart + Assembly (ARM Thumb) for BLDC motor with encoder, speed PID, and overcurrent protection.
> **Required outputs:** C, C++, MicroPython, CircuitPython, ST IEC 61131-3.
> **Cross-parsing:** Blockly ↔ Flowchart ↔ Ladder.
> **Validation:** interrupt logic and control loop semantically equivalent; ISR correctly serialized in visual representations.

#### CI-16 — Smart traffic light FSM (CircuitPython + Blockly + Ladder → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** CircuitPython + Blockly + Ladder for traffic light with vehicle detection, night mode, and manual override.
> **Required outputs:** C, C++, MicroPython, Rust, Assembly, ST IEC 61131-3.
> **Cross-parsing:** Flowchart ↔ Ladder.
> **Validation:** finite state machine (FSM) correctly represented and preserved across all outputs; night/manual mode transitions tested.

#### CI-17 — Pasteurization with chained timers (MicroPython + Flowchart + Ladder → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** MicroPython + Flowchart + Ladder for pasteurization with temperature profile (ramp-up, hold, cool-down), EEPROM logging, and deviation alarm.
> **Required outputs:** C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3.
> **Cross-parsing:** Blockly ↔ Ladder.
> **Validation:** timed sequences (chained timers) preserved; temperature profile identical across all outputs.

#### CI-18 — Pool control with Modbus TCP (ST + Blockly + Assembly AVR → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** ST IEC 61131-3 + Blockly + Assembly (AVR) for pH/chlorine control, peristaltic pumps, and Modbus TCP.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust.
> **Cross-parsing:** Flowchart ↔ Ladder.
> **Validation:** REAL/float numerical precision and Modbus registers preserved; dosage correctly calculated across all outputs.

#### CI-19 — Fleet monitoring with GPS and MQTT (C++ ESP32 + Flowchart + ST → multi-output, 3 simultaneous inputs)
> **Simultaneous inputs:** C++ (ESP32) + Flowchart + ST IEC 61131-3 for fleet with NMEA GPS, MPU-6050, MQTT via LTE, and aggressive driving detection.
> **Required outputs:** MicroPython, CircuitPython, Rust, Assembly.
> **Cross-parsing:** Blockly ↔ Flowchart.
> **Validation:** async logic (ISR + concurrent tasks) correctly serialized in visual representations; driving events detected identically.

#### CI-20 — Warehouse AGV with 4 inputs (MicroPython + Rust + Blockly + Ladder → multi-output, 4 simultaneous inputs)
> **Simultaneous inputs:** MicroPython + Rust (Embassy) + Blockly + Ladder for AGV with line sensors, differential control, and automatic charging station.
> **Required outputs:** C, C++, CircuitPython, Assembly, ST IEC 61131-3.
> **Cross-parsing:** Flowchart ↔ Ladder.
> **Validation:** largest pipeline test case (4 inputs) — semantic equivalence between all inputs and all outputs; navigation and charging logic preserved.

#### CI-21 — Maximum perimeter security (Flowchart + Blockly + Assembly ARM + ST → multi-output, 4 simultaneous inputs)
> **Simultaneous inputs:** Flowchart + Blockly + Assembly (ARM Thumb) + ST IEC 61131-3 for perimeter security with multiple PIRs, OpenMV camera, zoned siren, MQTT, and SD logging.
> **Required outputs:** C, C++, MicroPython, CircuitPython, Rust.
> **Cross-parsing:** Flowchart ↔ Blockly ↔ Ladder (all visual formats).
> **Validation:** maximum consistency test case — async event logic, concurrency, and data persistence semantically equivalent across all inputs and outputs.

---

## 📌 Roadmap and Detailed Status

The detailed status of what is done/pending is at:
👉 [`notyet/README.md`](../notyet/README.md) — Full ASL roadmap (source of truth for progress)

---

## 📚 Related Documentation

- [`docs/AI_ASSISTANT_CONTEXT.md`](./AI_ASSISTANT_CONTEXT.md) — General NeuroForge context (QEMU, AVR, ESP32)
- [`notyet/README.md`](../notyet/README.md) — ASL roadmap and implementation status
- [`src/engine/asl/ASLTypes.ts`](../src/engine/asl/ASLTypes.ts) — ASL schema (single source of truth)
- [`src/engine/asl/ASLExecutor.ts`](../src/engine/asl/ASLExecutor.ts) — Runtime
- [`src/engine/asl/codeToASL.ts`](../src/engine/asl/codeToASL.ts) — Transpiler
- [`src/engine/SimulationEngine.ts`](../src/engine/SimulationEngine.ts) — JS-mode engine

---

**Use this document as the basis for all future responses about the NeuroForge ASL subsystem.**
