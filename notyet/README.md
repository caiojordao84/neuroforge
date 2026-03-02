# ROADMAP_TO_ASL

This document describes the evolution of NeuroForge as a simulation and transpilation platform for embedded systems, with ASL (Abstract Simulation Language) as the universal intermediate representation. The guiding thread is the full integration of the contents of `notyet/` into the core (`src/engine`), eliminating that folder at the end of the process.

> 📋 **Implementation Standard**: See [docs/IMPLEMENTATION_STANDARD.md](../docs/IMPLEMENTATION_STANDARD.md) for the implementation pattern that ensures parity across all languages.
>
> 📊 **Parser Comparison Table**: See [docs/ASL_PARSER_COMPARISON.md](../docs/ASL_PARSER_COMPARISON.md) for the full verified implementation matrix (last updated: 02 Mar 2026 — Sessão 6).

Status markers:
- `[x]` Completed
- `[~]` In progress / stabilizing
- `[ ]` Planned
- `[?]` Under research / to be defined

---

## 0. Current State (Baseline)

### 0.1. ASL in the Core

- [x] `ASLTypes.ts`: AST definition — `ASLProgram`, globals, functions, tasks, statements, expressions (including `SwitchStatement`, `ASLObject`).
- [x] `ASLExecutor.ts`: JS executor that traverses the ASL and calls `SimulationEngine` (supports `switch/case`, dictionary lookup, `format`).
- [x] `codeToASL.ts` + `transforms/`: modularized transpiler for C++ Arduino subset → ASL (v1).
- [x] `transforms/statementRegistry.ts`: Handler Registry pattern for statement extensibility.
- [x] Integration in `TopToolbar`: JS mode in C++ tries ASL first, falls back to legacy `CodeParser`.

### 0.2. Current Workflow (C++ / MicroPython → ASL → SimulationEngine)

- [x] `CodeEditorWithTabs.tsx`
- [x] `LanguageRegistry.ts`
- [x] `TopToolbar.tsx`
- [x] `codeToASL.ts` + `transforms/`
- [x] `ASLTypes.ts`
- [x] `ASLExecutor.ts`
- [x] `SimulationEngine.ts`
- [x] `ASLViewer.tsx`

### 0.3. Supported C++ Subset (v0) — Full Detail

#### Statements

**Globals and Locals:**
- [x] Simple global declaration: `int x = 0;`
- [x] Simple local declaration: `int i = 0;`
- [x] Global array declaration: `const int LED_PINS[6] = {3, 4, 5, 6, 7, 8};`
- [x] Local array declaration: `int values[5] = {1, 2, 3, 4, 5};`
- [x] #define for array size: `#define SIZE 10` + `int arr[SIZE]`
- [x] PROGMEM arrays: `const int arr[] PROGMEM`
- [~] Local declaration with expression: `int delayTime = 1000 - (i * 100);`

**Assignments:**
- [x] Increment/decrement: `i = i + 1;`, `i = i - 1;`
- [x] Array subscript postfix: `arr[i]++`, `arr[i]--`
- [x] Array subscript prefix: `++arr[i]`, `--arr[i]`
- [x] Generic simple assignment: `x = expr;`
- [x] Array element assignment: `LED_PINS[2] = 10;`
- [x] Array compound assignment 2D: `arr[i][j] += val`
- [x] Partial array initialization: `int arr[10] = {1, 2}`
- [x] String literal to char array: `char str[] = "hello"`
- [x] Pointer dereference assignment: `*ptr = val;`
- [x] Dereference compound assignment: `*ptr += val;`

**Hardware operations:**
- [x] `pinMode`, `pinMode` with array
- [x] `digitalWrite`, `digitalWrite` with array
- [x] `analogWrite`
- [x] `delay`
- [x] Digital read (declaration + assignment)

**Control flow:**
- [x] `if/else`, cascading `else if`
- [x] `while`
- [x] Simple `for`, `for` with no condition
- [x] `switch/case` (native ASL support with fall-through)
- [x] `return`, `break`, `continue`
- [x] `doWhile` — `do { ... } while(cond)` (ASLExecutor + CParser)

#### Expressions in Conditions
- [x] `!flag`, `a == b`, `a != b`, `i < 10`, `i <= max`, `i > 0`, `i >= 0`
- [x] Bare literals/variables
- [x] Compound logical: `a && b`, `a || b`

#### Expressions on the RHS
- [x] Literal/constant, simple var, simple binary
- [x] Multiplication, compound expression
- [x] Array indexing, array initializer, partial array init
- [x] String literal to char array
- [x] `sizeof()` builtin
- [x] Zero-init: `int arr[5] = {}` or `= {0}`
- [x] Complex expressions: `x = a + b * c / 2;`

#### Data Types and Structures
- [x] Scalar variables, static arrays, index access
- [x] Type qualifiers: `const`, `volatile`, `static`
- [x] Pointer types, address-of operator
- [x] Range-based for: `for (auto x : arr)`
- [x] Strings: `char msg[] = "Hello";`
- [x] 3D array declaration, access (`index3D`), assignment (`setIndex3D`)
- [x] Array of string pointers: `const char* labels[] = {"a","b"}`
- [x] Structs (data only): `struct Point { int x, y; };`
- [x] `std::array<int, 3>` and `std::vector<int>`
- [x] Extern variables (safely ignored)
- [x] Designated initializers: `int arr[5] = {[0]=1, [3]=99}`

#### Arithmetic / Bitwise Operators
- [x] `+ - * / %`
- [x] `&& ||`
- [x] `& | ^ << >>`

### 0.4. Tools in `notyet/` (to integrate)

- [x] `notyet/app/system/Lexer.ts` (integrated into `CParser`)
- [x] `notyet/app/system/SymbolTable.ts` (integrated into `CParser`)
- [ ] `notyet/app/system/flow/CfgBuilder.ts`
- [ ] `notyet/app/system/flow/FlowValidator.ts`
- [ ] `notyet/app/system/flow/FlowToAst.ts`
- [ ] `notyet/app/system/blockly/BlocklyParser.ts`
- [ ] `notyet/app/system/blockly/CodeToBlockly.ts`
- [ ] `notyet/app/system/simulator/SimulatorInterpreter.ts`

### 0.5. Additional Hardware Supported

**Displays:**
- [x] LCD: `lcd.print()`, `lcd.setCursor()`, `lcd.clear()`
- [x] OLED: `oled.text()`, `oled.show()`, `oled.clear()`
- [x] Seven Segment: `sevseg.print()`

**Sensors/Input:**
- [x] Keypad: `keypad.getKey()`

### 0.6. Utility Functions Implemented

> ✅ **Actualizado em 02/03/2026 — Sessão 1**: todos os itens abaixo foram verificados como implementados em `ASLExecutor.ts` (commits `79a6b60`, `3af7dce` e anteriores). O roadmap anterior continha listas "NOT YET" que já estavam implementadas.

**Mathematical and utility functions in `ASLExecutor`:**
- [x] `random(min, max)`: random between min and max
- [x] `random(max)`: random between 0 and max-1
- [x] `map(value, fromMin, fromMax, toMin, toMax)`
- [x] `constrain(value, min, max)`

**Math functions (ALL implemented — `Math.*` wrappers):**
- [x] `abs(x)` → `Math.abs(x)`
- [x] `sqrt(x)` → `Math.sqrt(x)`
- [x] `pow(base, exp)` → `Math.pow(base, exp)`
- [x] `sin(x)` / `cos(x)` / `tan(x)` → `Math.sin/cos/tan`
- [x] `log(x)` → `Math.log(x)`
- [x] `min(a, b)` / `max(a, b)` → `Math.min/max`
- [x] `round(x)` / `floor(x)` / `ceil(x)` → `Math.round/floor/ceil`
- [x] `isnan(x)` → `isNaN(x)` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)
- [x] `isinf(x)` → `!isFinite(x)` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)

**Type conversion builtins:**
- [x] `int(val)`: truncates to integer (`Math.floor`)
- [x] `float(val)`: converts to float (`Number(val)`)
- [x] `String(val)`: converts to string (`String(val)`)

**String / C stdlib functions (ALL implemented):**
- [x] `strlen(s)` → `String(s).length` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)
- [x] `strcmp(a, b)` → `a === b ? 0 : 1` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)
- [x] `atoi(s)` → `parseInt(String(s), 10)` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)
- [x] `atof(s)` → `parseFloat(String(s))` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)
- [x] `dtostrf(val, width, prec, buf)` → `Number(val).toFixed(prec)` — commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171)

**sizeof builtin:**
- [x] `sizeof(arr)` → `arr.length` (1D) or `arr[0].length` (2D) via `__sizeof` callee

**Serial extensions (ALL implemented):**
- [x] `Serial.write(b)` → `engine.serialWrite(b)`
- [x] `Serial.read()` → `engine.serialRead()` (returns `-1` if empty)
- [x] `Serial.available()` → `engine.serialAvailable()`
- [x] `Serial.parseInt()` → `engine.serialParseInt()`
- [x] `Serial.readString()` → reads from simulated RX buffer

**Hardware event builtins:**
- [x] `lcd.print`, `lcd.setCursor`, `lcd.clear` → `engine.emit('hardwareCall', ...)`
- [x] `oled.text`, `oled.show`, `oled.clear` → `engine.emit('hardwareCall', ...)`
- [x] `sevseg.print` → `engine.emit('hardwareCall', ...)`
- [x] `KeypadRead` → `engine.emit('hardwareCall', ...)`

**Time functions:**
- [x] `millis()` → ms since simulation start
- [x] `micros()` → µs since simulation start
- [x] `delayMicroseconds()` → no-op in simulation (instant)

**Tone/Buzzer:**
- [x] `tone(pin, freq)` → tone at given frequency
- [x] `tone(pin, freq, duration)` → auto `noTone` after delay — commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952)
- [x] `noTone(pin)` → stops tone generation

**Hardware interrupt/protocol builtins:**
- [x] `attachInterrupt(pin, fn, mode)` / `detachInterrupt(pin)` — commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952)
- [x] `pulseIn(pin, val)` / `pulseInLong(pin, val)` → returns 500µs simulated — commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952)
- [x] `shiftOut(pin, clock, order, val)` / `shiftIn` → emit `hardwareCall` — commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952)

**Python/utility extras:**
- [x] `len()` → alias `__len`
- [x] `format()` → `{}` substitution
- [x] `enumerate()` → returns `[idx, val][]`
- [x] `reversed()`

### 0.7. Additional Supported Structures

- [x] Enum declarations: `enum Phase { ACCELERATING, DECELERATING, STOPPED };`
- [x] Enum in conditions: `if (phase == STOPPED)`
- [x] Global variables resolve expressions: `float intervalMin = initialInterval * 0.50;`

---

## 0.8. Known Gaps in the Current ASL Subset

> ✅ **Actualizado em 02/03/2026**: Muitos itens desta secção foram resolvidos. Ver lista completa e verificada em [`docs/ASL_PARSER_COMPARISON.md`](../docs/ASL_PARSER_COMPARISON.md).

### 0.8.1. Missing Statements

| Priority | Gap | Status |
| -------- | --- | ------ |
| 🟢 Low | `switch/case` | ✅ **IMPLEMENTED** — native ASL + all generators |
| 🟢 Low | `doWhile` | ✅ **IMPLEMENTED** — ASLExecutor + CParser `do_statement` |
| 🟢 Low | `delayMicroseconds` | ✅ **IMPLEMENTED** — no-op in SimulationEngine |
| 🟡 Medium | range-based `for` (C++11) | [x] CParser tracks `FASE 3.15` |
| 🟢 Low | `typedef` / `using` | [ ] Type aliases — affects `mapToASLType` |
| 🟢 Low | `struct` declaration + instance | ✅ **IMPLEMENTED** — Phase 4 |

### 0.8.2. Missing Expressions

| Priority | Gap | Status |
| -------- | --- | ------ |
| 🔴 Critical | `TernaryExpression` | ✅ **IMPLEMENTED** — `ConditionalExpression` |
| 🟠 Important | Cast `(byte)`, `(uint8_t)`, `(char)` | [ ] Only `int`/`float`/`String` handled |
| 🟠 Important | Negative literal in `evaluateInitializer` | ✅ **IMPLEMENTED** |
| 🟠 Important | String literal as global initializer | ✅ **IMPLEMENTED** |
| 🟡 Medium | `CommaExpression` | [ ] `for(int i=0, j=0; ...)` → falls to `literal 0` |
| 🟡 Medium | `sizeof(type)` (without variable) | [ ] Only variable-based `sizeof` handled |
| 🟢 Low | `AddressOf` in complex lvalue | [ ] Only `&varName` and `&arr[i]` handled |
| 🟢 Low | String concatenation `"text" + String(val)` | [ ] JS `+` coercion may mismatch |

### 0.8.3. Builtins in ASLExecutor

> ✅ **Actualizado em 02/03/2026 — Sessão 1**: todos os itens desta secção estão implementados. Ver secção 0.6 para detalhes e commits.

**Math functions — ALL IMPLEMENTED:**
- [x] `abs/sqrt/pow/sin/cos/tan/log/min/max/round/floor/ceil/isnan/isinf`

**String / C stdlib — ALL IMPLEMENTED:**
- [x] `strlen/strcmp/atoi/atof/dtostrf`

**Serial extensions — ALL IMPLEMENTED:**
- [x] `Serial.write/read/available/parseInt/readString`

**Hardware libraries (via `engine.emit('hardwareCall', ...)`):**
- [ ] `Servo.attach/write/read` → engine servo simulation
- [ ] `EEPROM.read/write` → simulated EEPROM (Map or array)
- [ ] `Wire.*` (I2C bus simulation)
- [ ] `SPI.begin/transfer` (SPI bus simulation)
- [ ] `pgm_read_byte(addr)` → transparent in simulation

### 0.8.4. Incomplete `evaluateInitializer`

- [x] `UnaryExpression` with `-`: `const int OFFSET = -10`
- [x] String literal: `const char* name = "hello"`
- [ ] Array of string literals: `const char* arr[] = {"on","off"}` — inconsistency for globals
- [ ] Conditional/ternary initializer: `const int X = (A > B) ? A : B` — explicit unsupported

---

## 0.9. Integration Checklist — ASL Branch

> Criado em 02/03/2026. Checklist operacional para as sessões de integração.
> Estado verificado por leitura directa do código (não apenas por documentação).
> Ver também: [`docs/ASL_PARSER_COMPARISON.md`](../docs/ASL_PARSER_COMPARISON.md)

### SESSÃO 1 — ASLExecutor Builtins ✅ COMPLETA

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S1.1 | Math builtins: `abs/sqrt/pow/sin/cos/tan/log/min/max/round/floor/ceil` | `ASLExecutor.ts` | ✅ |
| S1.2 | Math extras: `isnan/isinf` | `ASLExecutor.ts` | ✅ commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171) |
| S1.3 | String builtins: `strlen/strcmp/atoi/atof/dtostrf` | `ASLExecutor.ts` | ✅ commit [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b6061f34d9a0390a00495d22af616e6f3171) |
| S1.4 | Serial extensions: `write/read/available/parseInt/readString` | `ASLExecutor.ts` | ✅ |
| S1.5 | `doWhile` no executor | `ASLExecutor.ts` | ✅ |
| S1.6 | `delayMicroseconds` no executor + SimulationEngine | `ASLExecutor.ts` + `SimulationEngine.ts` | ✅ |
| S1.7 | `tone(pin, freq, duration)` — auto noTone | `ASLExecutor.ts` | ✅ commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952) |
| S1.8 | `sizeof(arr)` builtin | `ASLExecutor.ts` | ✅ |
| S1.9 | `attachInterrupt/detachInterrupt/pulseIn/shiftOut/shiftIn` | `ASLExecutor.ts` + `CParser.ts` | ✅ commit [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce503d0e27f7134d15dc9e9a68599edd952) |

---

### SESSÃO 2 — CGenerator (P0 — BLOQUEADOR) 🔴 PENDENTE

> **Impacto:** 19 dos 21 Integration Tests (CI-1 a CI-21) bloqueados por ausência de `CGenerator`.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S2.1 | Criar `CGenerator.ts` — esqueleto base (`genProgram`, `genFunction`, `genStatements`) | `plugins/c/CGenerator.ts` | ❌ |
| S2.2 | `genStmt`: `assign`, `if`, `while`, `for`, `break`, `continue`, `return` | `CGenerator.ts` | ❌ |
| S2.3 | `genStmt`: `doWhile` | `CGenerator.ts` | ❌ |
| S2.4 | `genStmt`: `switch/case` com fall-through | `CGenerator.ts` | ❌ |
| S2.5 | `genStmt`: `pinMode`, `digitalWrite`, `analogWrite`, `delay` | `CGenerator.ts` | ❌ |
| S2.6 | `genStmt`: `Serial.begin/print/println` | `CGenerator.ts` | ❌ |
| S2.7 | `genStmt`: hardware calls (LCD, OLED, tone, attachInterrupt, pulseIn, shiftOut) | `CGenerator.ts` | ❌ |
| S2.8 | `genExpr`: literais, variáveis, binário, unário, ternário, cast | `CGenerator.ts` | ❌ |
| S2.9 | `genExpr`: `index`, `index2D`, `index3D`, `setIndex`, `setIndex2D`, `setIndex3D` | `CGenerator.ts` | ❌ |
| S2.10 | `genExpr`: `call` (builtins math, string, random, map, constrain) | `CGenerator.ts` | ❌ |
| S2.11 | Declarações: globais, arrays 1D/2D/3D, structs, enums | `CGenerator.ts` | ❌ |
| S2.12 | Registar `CGenerator` no `LanguageRegistry` | `LanguageRegistry.ts` | ❌ |
| S2.13 | Fixture de validação: blink → ASL → C → deve ser compilável | `fixtures/` | ❌ |
| S2.14 | Fixture: `for` + array → ASL → C | `fixtures/` | ❌ |
| S2.15 | Fixture: `switch/case` → ASL → C | `fixtures/` | ❌ |

---

### SESSÃO 3 — PythonGenerator 🟡 PENDENTE

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S3.1 | Criar `PythonGenerator.ts` — esqueleto base | `plugins/python/PythonGenerator.ts` | ❌ |
| S3.2 | `genStmt`: controlo de fluxo (`if/while/for/doWhile`) | `PythonGenerator.ts` | ❌ |
| S3.3 | `genStmt`: GPIO → `pin.value()/on()/off()`, `time.sleep_ms()` | `PythonGenerator.ts` | ❌ |
| S3.4 | `genStmt`: `print()`, `uart.*` | `PythonGenerator.ts` | ❌ |
| S3.5 | `genExpr`: todos os tipos de expressão | `PythonGenerator.ts` | ❌ |
| S3.6 | Declarações: variáveis, listas 1D/2D, dicionários | `PythonGenerator.ts` | ❌ |
| S3.7 | Registar no `LanguageRegistry` | `LanguageRegistry.ts` | ❌ |
| S3.8 | Fixtures de validação: blink, button, for+array | `fixtures/` | ❌ |

---

### SESSÃO 4 — RustGenerator Completar 🟡 PENDENTE

> **Nota:** `RustGenerator.ts` já existe com suporte parcial. Esta sessão completa os gaps.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S4.1 | `Serial.begin/print/println` → `rprintln!/uprintln!` | `RustGenerator.ts` | [ ] |
| S4.2 | `tone/noTone` → stub Embassy | `RustGenerator.ts` | [ ] |
| S4.3 | Hardware calls genéricos (LCD, OLED, shiftOut) | `RustGenerator.ts` | [ ] |
| S4.4 | `Serial.available/read/write/parseInt` | `RustGenerator.ts` | [ ] |
| S4.5 | Fixtures de validação: blink, switch/case, array 2D | `fixtures/` | [ ] |

---

### SESSÃO 5 — ASLTypes Schema Extensions 🟡 PENDENTE

> Novos nós ASL necessários para as CIs de hardware avançado.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S5.1 | `UARTWrite/Read` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.2 | `I2CRead/Write` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.3 | `SPIRead/Write` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.4 | `PWMInit/SetDuty/SetFreq/Stop` | `ASLTypes.ts` | [ ] |
| S5.5 | `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F` (IEC) | `ASLTypes.ts` | [ ] |
| S5.6 | Executor handlers para os novos nós | `ASLExecutor.ts` | [ ] |
| S5.7 | Registry handlers para os novos nós | `statementRegistry.ts` | [ ] |

---

### SESSÃO 6 — Hardware Shims Extras 🟡 PENDENTE

> Sessão 6 anterior focou LCD/OLED/Seven Segment/Keypad. Esta cobre o restante.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S6.1 | `Servo.attach/write/read` — simulação de servo | `ASLExecutor.ts` + `SimulationEngine.ts` | [ ] |
| S6.2 | `EEPROM.read/write` — Map simulado | `ASLExecutor.ts` + `SimulationEngine.ts` | [ ] |
| S6.3 | `Wire.*` (I2C) — bus simulation básico | `ASLExecutor.ts` | [ ] |
| S6.4 | `SPI.begin/transfer` — bus simulation básico | `ASLExecutor.ts` | [ ] |
| S6.5 | `pgm_read_byte(addr)` — transparente na simulação | `ASLExecutor.ts` | [ ] |
| S6.6 | DHT Python (Tree-sitter + Regex) | `PythonParser.ts` | [ ] |
| S6.7 | Ultrasonic Python (Tree-sitter + Regex) | `PythonParser.ts` | [ ] |

---

### SESSÃO 7 — FlowToASL + ASLToFlow (Visual Round-trip) 🔴 PENDENTE

> **Impacto:** 18 dos 21 CIs dependem de `ASLToFlow.ts` ou `FlowToASL.ts`.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S7.1 | Migrar `notyet/app/system/flow/FlowToAst.ts` → `src/engine/tools/flow/FlowToASL.ts` | `tools/flow/FlowToASL.ts` | [ ] |
| S7.2 | Migrar `CfgBuilder.ts` e `FlowValidator.ts` | `tools/flow/` | [ ] |
| S7.3 | Criar `ASLToFlow.ts`: `If` → Decision node, `While` → Loop node | `tools/flow/ASLToFlow.ts` | [ ] |
| S7.4 | FSM pattern: `switch` em loop → estados e transições | `tools/flow/ASLToFlow.ts` | [ ] |
| S7.5 | Industrial blocks: `TON/TOF` timers como nós de flow | `tools/flow/` | [ ] |
| S7.6 | Registar no pipeline e expor via UI | `TopToolbar.tsx` | [ ] |

---

### SESSÃO 8 — BlocklyToASL + ASLToBlockly 🔴 PENDENTE

> **Impacto:** 16 dos 21 CIs dependem do round-trip com Blockly.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S8.1 | Migrar `notyet/app/system/blockly/BlocklyParser.ts` → `BlocklyToASL.ts` | `tools/blockly/BlocklyToASL.ts` | [ ] |
| S8.2 | Migrar `CodeToBlockly.ts` → `ASLToBlockly.ts` | `tools/blockly/ASLToBlockly.ts` | [ ] |
| S8.3 | Biblioteca de blocos: GPIO, timing, PWM, comunicação | `tools/blockly/` | [ ] |
| S8.4 | Definições de blocos: aparência, campos, validação de tipos | `tools/blockly/` | [ ] |
| S8.5 | Preview de código em tempo real (blocos → código multi-linguagem) | UI | [ ] |

---

### Resumo do Estado de Integração

| Sessão | Descrição | Estado | Prioridade |
|--------|-----------|--------|------------|
| **S1** | ASLExecutor Builtins | ✅ **COMPLETA** | — |
| **S2** | CGenerator | ❌ Pendente | 🔴 P0 (bloqueador) |
| **S3** | PythonGenerator | ❌ Pendente | 🔴 P0 |
| **S4** | RustGenerator (completar) | ❌ Pendente | 🟠 P1 |
| **S5** | ASLTypes Schema Extensions | ❌ Pendente | 🟠 P1 |
| **S6** | Hardware Shims Extras | ❌ Pendente | 🟡 P2 |
| **S7** | FlowToASL + ASLToFlow | ❌ Pendente | 🔴 P0 (18 CIs) |
| **S8** | BlocklyToASL + ASLToBlockly | ❌ Pendente | 🔴 P0 (16 CIs) |

> **Critério de merge para `main`**: S1 ✅ + S2 ✅ + S3 ✅ + S4 ✅ + pelo menos um dos S7/S8 ✅ + todos os 21 CIs passando.

---

## 1. Architectural Decisions (Mandatory ADRs)

Before any integration, these decisions must be made and documented in `docs/architecture/`.

### 1.1. ASL Schema
- [ ] Define schema levels: Core, Hardware, Language-specific.
- [ ] Formalize node types currently missing: `For`, `Switch`, `FunctionDef`, `FunctionCall`, `Millis`, `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F`, `PWMInit/SetDuty/SetFreq/Stop`, `UARTWrite/Read`, `I2CRead/Write`.
- [ ] Define the "raw code" policy.
- [ ] Schema validation: Zod, JSON Schema, or pure TypeScript types.

### 1.2. Multi-pass Pipeline
- [ ] Formalize the passes: Parsing → Normalization → Analysis/Verification → Pattern Detection → Light Optimization → ASL Emission.
- [ ] Define whether an intermediate IR exists.
- [ ] Plugin system: plugin API, lifecycle, inter-plugin communication.

### 1.3. Parser Technology
- [x] Evaluate `web-tree-sitter` for C, C++, Python.
- [ ] Define where custom parsers are necessary: Assembly, Ada, Forth, Zig.
- [x] Fallback strategy implemented in `TopToolbar`.

### 1.4. Executor and Runtime
- [ ] Confirm `ASLExecutor` as the only official runtime for JS simulation.
- [ ] Define the role of `SimulatorInterpreter`.
- [ ] Ensure `SimulationEngine.reset()` clears all state before each execution.

### 1.5. Round-trip as a Core Product Feature
- [ ] Formalize ASL as the pivot for all conversions in both directions.
- [ ] Define the "information loss" policy.

---

## 2. Target Core Structure (Folder Tree)

```text
src/
  engine/
    SimulationEngine.ts
    QEMUSimulationEngine.ts
    QEMURunner.ts
    CodeParser.ts          (legacy, removed when ASL covers 100% of the subset)
    Transpiler.ts

    asl/
      ASLTypes.ts
      ASLExecutor.ts
      index.ts
      codeToASL.ts

      transforms/
        index.ts
        context.ts
        statementRegistry.ts
        blockTransform.ts
        exprTransform.ts
        callTransform.ts

      helpers/
        index.ts
        arrayUtils.ts
        typeUtils.ts

      plugins/
        c/
          CParser.ts
          CGenerator.ts       ← SESSÃO 2 (criar)
        cpp/
          CppParser.ts
        python/
          PythonParser.ts
          PythonGenerator.ts  ← SESSÃO 3 (criar)
        rust/
          RustParser.ts
          RustGenerator.ts    ← SESSÃO 4 (completar)

      LanguageRegistry.ts

    tools/
      lexer/
        Lexer.ts
      symbols/
        SymbolTable.ts

      flow/
        CfgBuilder.ts         ← SESSÃO 7
        FlowValidator.ts      ← SESSÃO 7
        FlowToASL.ts          ← SESSÃO 7
        ASLToFlow.ts          ← SESSÃO 7
        flow.types.ts

      blockly/
        BlocklyToASL.ts       ← SESSÃO 8
        ASLToBlockly.ts       ← SESSÃO 8
        blockly.types.ts

      simulator/
        SimulatorInterpreter.ts
```

---

## 3. Full Round-trip: Code ↔ ASL ↔ Visual

### 3.1. Direction: Code → ASL → Visual
- [ ] ASL → Blockly: `ASLToBlockly.ts` (SESSÃO 8)
- [ ] ASL → Flowchart: `ASLToFlow.ts` (SESSÃO 7)
- [ ] ASL → Ladder/Industrial

### 3.2. Direction: Visual → ASL → Code
- [ ] Blockly → ASL: `BlocklyToASL.ts` (SESSÃO 8)
- [ ] Flowchart → ASL: `FlowToASL.ts` (SESSÃO 7)
- [ ] Ladder/Industrial → ASL
- [ ] ASL → Code: generators (SESSÕES 2, 3, 4)

### 3.3. Round-trip Policy
- [ ] "Perfect" subset (lossless round-trip)
- [ ] "With warning" subset
- [ ] "Unsupported" subset (explicit error)

---

## 4. ASL v1 — Complete Control Flow and Expressions

### 4.1. Control Flow
- [x] Cascading `else if`, nested `if`
- [x] `while`, simple `for`
- [x] `break` and `continue` inside loops
- [x] `switch/case` (native)

### 4.2. Expressions
- [x] Relational, boolean, arithmetic operators
- [x] Unary operators

### 4.3. Arrays and Indexing
- [x] 1D, 2D, 3D arrays — declaration, access, assignment
- [x] Dictionary and Object support

### 4.4. Error Messages
- [ ] Indicate exact line and snippet of unsupported code.
- [ ] Distinguish "subset does not support" from "invalid syntax".

---

## 5. ASL v2 — Functions, Tasks, and Events

- [ ] User functions: `ASLFunctionDef` and `ASLCall`
- [ ] Multiple tasks beyond `mainLoop`
- [ ] Simple events (high-level API)

---

## 6. Multi-pass Pipeline and Plugin System

### 6.1. Formal Passes
- [ ] Pass 1 — Parsing
- [ ] Pass 2 — Normalization
- [ ] Pass 3 — Analysis and verification
- [ ] Pass 4 — Hardware pattern detection
- [ ] Pass 5 — Light optimization
- [ ] Pass 6 — ASL emission

### 6.2. Plugin System
- [ ] Plugin API, loader, registry, lifecycle, shared context

---

## 7. Input Languages → ASL

### 7.1. C / Arduino C++
- [x] Basic subset v0 (see section 0.3)
- [x] Full control flow (v1)
- [x] `switch/case`, arrays, general expressions
- [~] Additional APIs (tone still without dedicated simulation)
- [ ] Parser via Tree-sitter C/C++

### 7.2. MicroPython / CircuitPython
- [x] Execution via ASL
- [x] Python support: `Pin`, `value()`, `on()`, `off()`, `time.sleep_ms()`
- [x] Parser via Tree-sitter Python + Regex Fallback
- [x] Advanced loops, collections, string methods
- [x] MicroPython specific: `Pin.id/on/off/value`

### 7.3. JavaScript / TypeScript
- [ ] Subset with `setup()/loop()`, IO ops
- [ ] Parser via Tree-sitter JS/TS

### 7.4. Rust (embedded subset)
- [x] `RustParser.ts`: Embassy `async/await`, GPIO, UART, SPI
- [x] `RustGenerator.ts`: partial (DoWhile, Break/Continue/Return, IfStatement, Loop, ArrayInit, etc.)
- [ ] `RustGenerator.ts`: complete (Serial, tone, hardware calls — SESSÃO 4)
- [ ] Serialization of Embassy tasks to multiple `ASLTask`

### 7.5–7.9. Zig, Ada, Forth, Assembly, Lua
- [ ] All pending (see original sections below for full detail)

---

## 8. Visual Inputs → ASL

### 8.1. Flowchart — SESSÃO 7
- [ ] Migrate `CfgBuilder`, `FlowValidator`, `FlowToASL`
- [ ] `ASLToFlow.ts`
- [ ] Industrial blocks as formal ASL nodes
- [ ] `ASLToFlow.ts`: `If` → Decision node, `While` → Loop node

### 8.2. Blockly — SESSÃO 8
- [ ] Migrate `BlocklyParser` → `BlocklyToASL`
- [ ] Migrate `CodeToBlockly` → `ASLToBlockly`
- [ ] Custom block library (GPIO, timing, PWM, communication)

### 8.3. Ladder Logic (LD) and IEC 61131-3
- [ ] Contacts (NO/NC), coils, parallel branches → ASL
- [ ] `STParser.ts`
- [ ] `ASLToLadder.ts`

---

## 9. Code Generators: ASL → Target Language

- [ ] ASL → C / Arduino C++ ← **SESSÃO 2 (P0)**
- [ ] ASL → Python / MicroPython ← **SESSÃO 3 (P0)**
- [ ] ASL → Rust ← **SESSÃO 4 (P1, completar)**
- [ ] ASL → JavaScript / TypeScript
- [ ] ASL → Zig, Ada, Forth, Assembly, Lua, ST IEC 61131-3

---

## 10. Bidirectional Transpilation (ASL as Pivot)

### 10.1. Priority Pairs
- [ ] C ↔ Python, C ↔ C++, C ↔ Rust, Python ↔ C++

### 10.2. Source Maps and Debugging
- [ ] Source map generation, comment preservation, debug metadata

---

## 11. Optimizations and Analysis

### 11.1. Hardware Optimizations
- [ ] PWM Optimizer, UART Optimizer, GPIO Batcher, Delay Optimizer

### 11.2. Safety / Validation
- [ ] GPIO Validator, Memory Checker, Timing Analyzer

---

## 12. Foundation Tooling

- [ ] `Lexer.ts` → `src/engine/tools/lexer/`
- [ ] `SymbolTable.ts` → `src/engine/tools/symbols/`
- [ ] `SimulatorInterpreter.ts` with formally defined role
- [x] `LanguageRegistry.ts` integrated
- [x] Verbose log cleanup in Serial Monitor

---

## 13. UX, Documentation, and Teaching Mode

### 13.1. Code Best Practices
- [ ] Language / input mode selection guide

### 13.2. Teaching Mode
- [ ] Visual highlight of code/block/node being executed
- [ ] Inline pedagogical messages

---

## 14. Merge Strategy for Main

- [ ] Feature flag "ASL experimental"
- [ ] Migrate simple C++ to always go through ASL
- [ ] Keep fallback for complex patterns

**Criteria for final merge:**
- [ ] ASL v1 stable for common C++ Arduino
- [ ] At least one visual language with round-trip (Blockly or Flow)
- [ ] `notyet/` zeroed
- [ ] Basic documentation published
- [ ] Test suite covering all integrated inputs
- [ ] All 21 Integration Test Cases from Sec. 16 passing

---

## 15. Final Deliverables

- [ ] ASL with complete and validated schema (Core + Hardware + Language-specific)
- [ ] 9+ input languages
- [ ] Code generators for all supported languages
- [ ] Full round-trip: Code ↔ ASL ↔ Visual (Blockly / Flow / Ladder)
- [ ] Blockly with 20+ blocks and ASL ↔ blocks round-trip
- [ ] Flow/Ladder with formal industrial blocks (TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG)
- [ ] Multi-pass pipeline with plugin system
- [ ] Source maps and debugging for all languages
- [ ] Hardware optimizations (PWM, UART, GPIO, delay)
- [ ] `notyet/` = zero
- [ ] 1000+ validated test cases
- [ ] All 21 Integration Test Cases (CI-1 to CI-21) passing

---

## 16. Integration Test Cases (CI-1 to CI-21)

> **IMPORTANT:** These are system integration tests. Each CI validates that multiple sections
> of the roadmap are complete **and communicate correctly with each other**.
>
> All 21 CIs are currently **blocked** primarily by:
> 1. **Generators** (Sec. 9): affecting 16–19 CIs each
> 2. **Visual round-trip** (Sec. 3+8): Ladder (19 CIs), Flowchart (18 CIs), Blockly (16 CIs)
> 3. **ASL Features** (Sec. 1.1, 1.5, 3.3, 4.x, 5)
> 4. **Input parsers** (Sec. 7.4, 7.8, 8.x)

### CI-1 — Tank Level (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, 4.3, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-2 — Home Lighting (Flowchart → multi-output)
**Dependencies:** Sec. 8.1, 9, 3.1+8.2, 3.1+8.3, 3.3

### CI-3 — Greenhouse Temperature PID (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, 4.2, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-4 — Industrial Conveyor Belt (Ladder → multi-output)
**Dependencies:** Sec. 8.3, 8.1, 9, 3.2+8.1, 3.1+8.2, 3.3

### CI-5 — Automatic Gate FSM (ST IEC 61131-3 → multi-output)
**Dependencies:** Sec. 8.3, 4.1, 8.1 (FSM), 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-6 — Zone-based Automatic Irrigation (Blockly → multi-output)
**Dependencies:** Sec. 8.2, 8.1, 9, 3.1+8.1, 3.1+8.3, 3.3

### CI-7 — Indoor Air Quality (C++ Arduino → multi-output)
**Dependencies:** Sec. 7.1, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3, 3.3

### CI-8 — Solar Energy Management (Flowchart → multi-output)
**Dependencies:** Sec. 8.1, 4.2, 9, 3.1+8.2, 3.1+8.3, 3.3

### CI-9 — RFID Access Control (Rust Embassy → multi-output)
**Dependencies:** Sec. 7.4, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-10 — Industrial 7-Segment Timer (Assembly AVR/ARM → multi-output)
**Dependencies:** Sec. 7.8, 4.3, 8.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-11 — HX711 Weighing with Modbus RTU (CircuitPython → multi-output)
**Dependencies:** Sec. 7.2, 4.2, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-12 — Multi-tank SCADA ESP32 (MicroPython + Blockly + Flowchart → multi-output, 3 inputs)
**Dependencies:** Sec. 7.2, 8.2, 8.1, 4.3, 1.1, 1.5, 3.3, 9

### CI-13 — Pressure Pump with Hysteresis (C++ + Ladder + Flowchart → multi-output, 3 inputs)
**Dependencies:** Sec. 7.1, 8.3, 8.1, 4.2, 1.5, 3.3, 9

### CI-14 — Multi-zone HVAC (MicroPython + ST + Blockly → multi-output, 3 inputs)
**Dependencies:** Sec. 7.2, 8.3, 8.2, 5, 8.1, 1.5, 3.3, 9

### CI-15 — BLDC Motor with Encoder and PID (Rust + Flowchart + Assembly ARM → multi-output, 3 inputs)
**Dependencies:** Sec. 7.4, 8.1, 7.8, 4.2, 5, 1.5, 3.3, 9

### CI-16 — Smart Traffic Light FSM (CircuitPython + Blockly + Ladder → multi-output, 3 inputs)
**Dependencies:** Sec. 7.2, 8.2, 8.3, 8.1 (FSM), 4.1, 1.5, 3.3, 9

### CI-17 — Pasteurization with Chained Timers (MicroPython + Flowchart + Ladder → multi-output, 3 inputs)
**Dependencies:** Sec. 7.2, 8.1, 8.3, 1.1, 1.5, 3.3, 9

### CI-18 — Pool Control with Modbus TCP (ST + Blockly + Assembly AVR → multi-output, 3 inputs)
**Dependencies:** Sec. 8.3, 8.2, 7.8, 4.2, 1.1, 1.5, 3.3, 9

### CI-19 — Fleet Monitoring with GPS and MQTT (C++ ESP32 + Flowchart + ST → multi-output, 3 inputs)
**Dependencies:** Sec. 7.1, 8.1, 8.3, 5, 1.1, 1.5, 3.3, 9

### CI-20 — Warehouse AGV (MicroPython + Rust + Blockly + Ladder → multi-output, 4 inputs)
**Dependencies:** Sec. 7.2, 7.4, 8.2, 8.3, 8.1 (FSM), 1.5, 3.3, 9

### CI-21 — Maximum Perimeter Security (Flowchart + Blockly + Assembly ARM + ST → multi-output, 4 inputs)
**Dependencies:** Sec. 8.1, 8.2, 7.8, 8.3, 5, 1.1, 1.5, 3.3, 9

---

> **Coverage summary (02/03/2026):**
> - Sessão 1 ✅ COMPLETA.
> - All 21 CIs still blocked primarily by Generators (S2, S3, S4) and Visual round-trip (S7, S8).
> - Next unblock: **S2 — CGenerator** removes the largest blocker (19 CIs affected).
