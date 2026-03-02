# ROADMAP_TO_ASL

This document describes the evolution of NeuroForge as a simulation and transpilation platform for embedded systems, with ASL (Abstract Simulation Language) as the universal intermediate representation. The guiding thread is the full integration of the contents of `notyet/` into the core (`src/engine`), eliminating that folder at the end of the process.

> 📋 **Implementation Standard**: See [docs/IMPLEMENTATION_STANDARD.md](../docs/IMPLEMENTATION_STANDARD.md) for the implementation pattern that ensures parity across all languages.
>
> 📊 **Parser Comparison Table**: See [docs/ASL_PARSER_COMPARISON.md](../docs/ASL_PARSER_COMPARISON.md) for the full verified implementation matrix (last updated: 02 Mar 2026 — Sessão 6).
>
> 🔌 **Hardware Shim Architecture**: See [docs/ASL_SHIM_ARCHITECTURE_PLAN.md](../docs/ASL_SHIM_ARCHITECTURE_PLAN.md) for the complete hardware and protocol virtualization strategy ("The Middle Path").

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

> ✅ **Actualizado em 02/03/2026 — Sessão 1**: todos os itens abaixo verificados como implementados em `ASLExecutor.ts`.

**Mathematical and utility functions:**
- [x] `random(min, max)`, `random(max)`, `map(...)`, `constrain(...)`

**Math functions (ALL implemented):**
- [x] `abs/sqrt/pow/sin/cos/tan/log/min/max/round/floor/ceil/isnan/isinf`

**Type conversion builtins:**
- [x] `int(val)`, `float(val)`, `String(val)`

**String / C stdlib (ALL implemented):**
- [x] `strlen/strcmp/atoi/atof/dtostrf`

**sizeof builtin:**
- [x] `sizeof(arr)` → `arr.length` (1D) or `arr[0].length` (2D)

**Serial extensions (ALL implemented):**
- [x] `Serial.write/read/available/parseInt/readString`

**Hardware event builtins:**
- [x] `lcd.print`, `lcd.setCursor`, `lcd.clear`
- [x] `oled.text`, `oled.show`, `oled.clear`
- [x] `sevseg.print`, `KeypadRead`

**Time functions:**
- [x] `millis()`, `micros()`, `delayMicroseconds()`

**Tone/Buzzer:**
- [x] `tone(pin, freq)`, `tone(pin, freq, duration)`, `noTone(pin)`

**Hardware interrupt/protocol builtins:**
- [x] `attachInterrupt/detachInterrupt`, `pulseIn/pulseInLong`, `shiftOut/shiftIn`

**Python/utility extras:**
- [x] `len()`, `format()`, `enumerate()`, `reversed()`

### 0.7. Hardware Shim Architecture (Confirmed)

> ✅ **Verificado em 02/03/2026**: inventário completo por leitura directa dos ficheiros.
> Ver arquitectura detalhada em [docs/ASL_SHIM_ARCHITECTURE_PLAN.md](../docs/ASL_SHIM_ARCHITECTURE_PLAN.md).

**Core Infrastructure:**
- [x] `plugins/core/ShimManager.ts` (2.8 KB): registry + injector de shims por linguagem. Suporta `registerShim`, `requireShim` (com resolvão recursiva de dependências), `getRequiredShimsCode` (injecção no topo do ficheiro gerado).

**Shims por Linguagem — Inventario Completo:**

| Shim | C | Python | Rust |
|------|---|--------|------|
| `liquid_crystal_i2c_shim` (display/LCD) | ✅ 344 B | ✅ 1.5 KB | ✅ 1.8 KB |
| `sevseg_shim` (display/Seven Segment) | ❌ ausente | ✅ 3.1 KB | ❌ ausente |
| `keypad_shim` (input/Keypad) | ✅ 285 B | ✅ 1.9 KB | ✅ 1.1 KB |
| `eeprom_shim` (memory/EEPROM) | ✅ 305 B | ✅ 1.2 KB | ✅ 1.2 KB |

**Shims em Falta (identificados):**
- [ ] `oled_ssd1306_shim` — não encontrado em nenhuma linguagem
- [ ] `wire_i2c_shim` (Wire/I2C) — não encontrado
- [ ] `spi_shim` — não encontrado
- [ ] `servo_shim` — não encontrado
- [ ] `sevseg_shim` para C e Rust — só existe em Python

### 0.8. Analysis + Optimization Pipeline (Confirmado)

> ✅ **Verificado em 02/03/2026**: ficheiros lidos directamente, código real e substancial.

**`plugins/analysis/PatternDetector.ts`** (7.2 KB) — Pipeline Pass 4:
- [x] `PWM_BITBANG` (WARNING): detecta `GpioSet→DelayMs→GpioSet→DelayMs` no mesmo pin
- [x] `POLLING_LOOP` (CRITICAL): detecta `while(gpioRead)` sem `delay` no corpo
- [x] `STATE_MACHINE` (INFO): detecta `if (state/mode/phase/fsm == X)`
- [x] `LONG_DELAY` (WARNING): detecta `delay(>500ms)` dentro de `loop()`

**`plugins/optimizer/Optimizer.ts`** (6.9 KB) — Pipeline Pass 5:
- [x] **Pass 1**: substitui PWM bit-bang por nó `HardwarePwm` nativo (calcula freq e duty cycle)
- [x] **Pass 2**: funde delays consecutivos (`delay(100)+delay(200)` → `delay(300)`)
- [x] **Pass 3**: agrupa GPIO escritas consecutivas em nó `GpioBatch` único

### 0.9. Additional Supported Structures

- [x] Enum declarations: `enum Phase { ACCELERATING, DECELERATING, STOPPED };`
- [x] Enum in conditions: `if (phase == STOPPED)`
- [x] Global variables resolve expressions: `float intervalMin = initialInterval * 0.50;`

---

## 0.10. Known Gaps in the Current ASL Subset

> ✅ **Actualizado em 02/03/2026**: ver [`docs/ASL_PARSER_COMPARISON.md`](../docs/ASL_PARSER_COMPARISON.md) para lista completa.

### 0.10.1. Missing Statements

| Priority | Gap | Status |
| -------- | --- | ------ |
| 🟢 Low | `switch/case` | ✅ IMPLEMENTED |
| 🟢 Low | `doWhile` | ✅ IMPLEMENTED |
| 🟢 Low | `delayMicroseconds` | ✅ IMPLEMENTED |
| 🟡 Medium | range-based `for` (C++11) | [x] CParser tracks `FASE 3.15` |
| 🟢 Low | `typedef` / `using` | [ ] Affects `mapToASLType` |
| 🟢 Low | `struct` declaration + instance | ✅ IMPLEMENTED — Phase 4 |

### 0.10.2. Missing Expressions

| Priority | Gap | Status |
| -------- | --- | ------ |
| 🔴 Critical | `TernaryExpression` | ✅ IMPLEMENTED |
| 🟠 Important | Cast `(byte)`, `(uint8_t)`, `(char)` | [ ] Only `int`/`float`/`String` handled |
| 🟠 Important | Negative literal in `evaluateInitializer` | ✅ IMPLEMENTED |
| 🟠 Important | String literal as global initializer | ✅ IMPLEMENTED |
| 🟡 Medium | `CommaExpression` | [ ] Falls to `literal 0` |
| 🟡 Medium | `sizeof(type)` (without variable) | [ ] Only variable-based handled |
| 🟢 Low | `AddressOf` in complex lvalue | [ ] Only `&varName` and `&arr[i]` |
| 🟢 Low | String concatenation `"text" + String(val)` | [ ] JS `+` coercion may mismatch |

### 0.10.3. Builtins — Remaining Gaps

**Math/String/Serial — ALL IMPLEMENTED** (ver Sec. 0.6)

**Hardware libraries — Shims em falta:**
- [ ] `Servo.attach/write/read`
- [ ] `Wire.*` (I2C bus)
- [ ] `SPI.begin/transfer`
- [ ] `pgm_read_byte(addr)`
- [ ] OLED (`oled_ssd1306_shim`) para todas as linguagens

### 0.10.4. Incomplete `evaluateInitializer`

- [x] `UnaryExpression` with `-`: `const int OFFSET = -10`
- [x] String literal: `const char* name = "hello"`
- [ ] Array of string literals: `const char* arr[] = {"on","off"}` — inconsistency for globals
- [ ] Conditional/ternary initializer: explicit unsupported

---

## 0.11. Integration Checklist — ASL Branch

> Criado em 02/03/2026. Actualizado em 02/03/2026 23:54 com inventário completo.
> Estado verificado por leitura directa do código (não apenas por documentação).

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

### SESSÃO 2 — CGenerator ✅ COMPLETA

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S2.1 | `CGenerator.ts` — implementação core (12.9 KB) | `plugins/c/CGenerator.ts` | ✅ |
| S2.2 | `genStmt`: controlo de fluxo completo incl. `doWhile` | `CGenerator.ts` | ✅ |
| S2.3 | `genStmt`: GPIO, Serial, hardware calls | `CGenerator.ts` | ✅ |
| S2.4 | `genExpr`: todos os tipos de expressão | `CGenerator.ts` | ✅ |
| S2.5 | Declarações: globais, arrays, structs, enums | `CGenerator.ts` | ✅ |

---

### SESSÃO 3 — PythonGenerator ✅ COMPLETA

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S3.1 | `PythonGenerator.ts` — implementação core (17.9 KB) | `plugins/python/PythonGenerator.ts` | ✅ |
| S3.2 | `genStmt`: controlo de fluxo e GPIO MicroPython | `PythonGenerator.ts` | ✅ |
| S3.3 | `genExpr`, declarações, `print()`, `uart.*` | `PythonGenerator.ts` | ✅ |

---

### SESSÃO 4 — RustGenerator ✅ COMPLETA

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S4.1 | `RustGenerator.ts` — implementação core (18.3 KB) | `plugins/rust/RustGenerator.ts` | ✅ |
| S4.2 | Serial, GPIO, tone/noTone, interrupções (Embassy) | `RustGenerator.ts` | ✅ |

---

### SESSÃO 5 — ShimManager + Pipeline Analysis/Optimizer [~] PARCIAL

> ✅ **Verificado em 02/03/2026**: ShimManager, PatternDetector e Optimizer existem com código substancial.
> ❌ Pendente: nós formais `UART/I2C/SPI/PWM` em `ASLTypes.ts` não confirmados.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S5.1 | `ShimManager.ts` — registry + injector de shims (2.8 KB) | `plugins/core/ShimManager.ts` | ✅ |
| S5.2 | `PatternDetector.ts` — 4 padrões (PWM_BITBANG, POLLING_LOOP, STATE_MACHINE, LONG_DELAY) | `plugins/analysis/PatternDetector.ts` | ✅ |
| S5.3 | `Optimizer.ts` — 3 passes (replacePwmBitBang, mergeDelays, batchGpio) | `plugins/optimizer/Optimizer.ts` | ✅ |
| S5.4 | `UARTWrite/Read` formal ASL nodes em `ASLTypes.ts` | `ASLTypes.ts` | [ ] |
| S5.5 | `I2CRead/Write` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.6 | `SPIRead/Write` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.7 | `PWMInit/SetDuty/SetFreq/Stop` formal ASL nodes | `ASLTypes.ts` | [ ] |
| S5.8 | `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F` (IEC) | `ASLTypes.ts` | [ ] |
| S5.9 | Executor handlers para os novos nós | `ASLExecutor.ts` | [ ] |
| S5.10 | Registry handlers para os novos nós | `statementRegistry.ts` | [ ] |

---

### SESSÃO 6 — Hardware Shims [~] PARCIAL

> Inventario verificado por leitura directa de todos os ficheiros em 02/03/2026.

**Shims implementados (confirmados):**

| Shim | C | Python | Rust |
|------|---|--------|------|
| LCD (`liquid_crystal_i2c_shim`) | ✅ 344 B | ✅ 1.5 KB | ✅ 1.8 KB |
| Seven Segment (`sevseg_shim`) | ❌ | ✅ 3.1 KB | ❌ |
| Keypad (`keypad_shim`) | ✅ 285 B | ✅ 1.9 KB | ✅ 1.1 KB |
| EEPROM (`eeprom_shim`) | ✅ 305 B | ✅ 1.2 KB | ✅ 1.2 KB |

**Shims em falta (identificados):**

| # | Tarefa | Estado |
|---|--------|--------|
| S6.1 | OLED (`oled_ssd1306_shim`) para C, Python, Rust | ❌ |
| S6.2 | `sevseg_shim` para C e Rust (só existe em Python) | ❌ |
| S6.3 | `Servo.attach/write/read` | ❌ |
| S6.4 | `Wire.*` (I2C bus) | ❌ |
| S6.5 | `SPI.begin/transfer` | ❌ |
| S6.6 | `pgm_read_byte(addr)` | ❌ |
| S6.7 | DHT Python (Tree-sitter + Regex) | ❌ |
| S6.8 | Ultrasonic Python (Tree-sitter + Regex) | ❌ |

---

### SESSÃO 7 — FlowToASL + ASLToFlow 🔴 PENDENTE

> **Impacto:** 18 dos 21 CIs dependem de `ASLToFlow.ts` ou `FlowToASL.ts`.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S7.1 | Migrar `FlowToAst.ts` → `FlowToASL.ts` | `tools/flow/FlowToASL.ts` | [ ] |
| S7.2 | Migrar `CfgBuilder.ts` e `FlowValidator.ts` | `tools/flow/` | [ ] |
| S7.3 | Criar `ASLToFlow.ts`: `If` → Decision, `While` → Loop | `tools/flow/ASLToFlow.ts` | [ ] |
| S7.4 | FSM pattern: `switch` em loop → estados e transições | `tools/flow/ASLToFlow.ts` | [ ] |
| S7.5 | Industrial blocks: `TON/TOF` timers como nós de flow | `tools/flow/` | [ ] |
| S7.6 | Registar no pipeline e expor via UI | `TopToolbar.tsx` | [ ] |

---

### SESSÃO 8 — BlocklyToASL + ASLToBlockly 🔴 PENDENTE

> **Impacto:** 16 dos 21 CIs dependem do round-trip com Blockly.

| # | Tarefa | Ficheiro | Estado |
|---|--------|----------|--------|
| S8.1 | Migrar `BlocklyParser.ts` → `BlocklyToASL.ts` | `tools/blockly/BlocklyToASL.ts` | [ ] |
| S8.2 | Migrar `CodeToBlockly.ts` → `ASLToBlockly.ts` | `tools/blockly/ASLToBlockly.ts` | [ ] |
| S8.3 | Biblioteca de blocos: GPIO, timing, PWM, comunicação | `tools/blockly/` | [ ] |
| S8.4 | Definições de blocos: aparência, campos, validação de tipos | `tools/blockly/` | [ ] |
| S8.5 | Preview de código em tempo real (blocos → código multi-linguagem) | UI | [ ] |

---

### Resumo do Estado de Integração

> Actualizado em 02/03/2026 23:54 — verificado por leitura directa do código.

| Sessão | Descrição | Estado | Notas |
|--------|-----------|--------|-------|
| **S1** | ASLExecutor Builtins | ✅ **COMPLETA** | |
| **S2** | CGenerator (12.9 KB) | ✅ **COMPLETA** | |
| **S3** | PythonGenerator (17.9 KB) | ✅ **COMPLETA** | |
| **S4** | RustGenerator (18.3 KB) | ✅ **COMPLETA** | |
| **S5** | ShimManager + PatternDetector + Optimizer | [~] **PARCIAL** | ADRs formais pendentes |
| **S6** | Hardware Shims (LCD/Keypad/EEPROM para 3 linguagens) | [~] **PARCIAL** | OLED/Wire/SPI/Servo em falta |
| **S7** | FlowToASL + ASLToFlow | ❌ Pendente | 🔴 P0 (18 CIs) |
| **S8** | BlocklyToASL + ASLToBlockly | ❌ Pendente | 🔴 P0 (16 CIs) |

> **Critério de merge para `main`**: S1–S4 ✅ + S5/S6 completas + pelo menos S7 ou S8 ✅ + todos os 21 CIs passando.

---

## 1. Architectural Decisions (Mandatory ADRs)

### 1.1. ASL Schema
- [ ] Define schema levels: Core, Hardware, Language-specific.
- [ ] Formalize node types: `UARTWrite/Read`, `I2CRead/Write`, `SPIRead/Write`, `PWMInit/SetDuty/SetFreq/Stop`, `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F`.
- [ ] Define the "raw code" policy.
- [ ] Schema validation: Zod, JSON Schema, or pure TypeScript types.

### 1.2. Multi-pass Pipeline
- [ ] Formalize the passes: Parsing → Normalization → Analysis → Pattern Detection → Optimization → ASL Emission.
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
    CodeParser.ts          (legacy)
    Transpiler.ts

    asl/
      ASLTypes.ts
      ASLExecutor.ts
      index.ts
      codeToASL.ts

      transforms/
        statementRegistry.ts
        blockTransform.ts
        exprTransform.ts
        callTransform.ts

      helpers/
        arrayUtils.ts
        typeUtils.ts

      plugins/
        core/
          ShimManager.ts        ✅ EXISTE
        analysis/
          PatternDetector.ts    ✅ EXISTE (Pass 4)
        optimizer/
          Optimizer.ts          ✅ EXISTE (Pass 5)
        c/
          CParser.ts            ✅ EXISTE
          CGenerator.ts         ✅ EXISTE
          shims/
            display/
              liquid_crystal_i2c_shim.ts  ✅
            input/
              keypad_shim.ts              ✅
            memory/
              eeprom_shim.ts              ✅
        python/
          PythonParser.ts       ✅ EXISTE
          PythonGenerator.ts    ✅ EXISTE
          shims/
            display/
              liquid_crystal_i2c_shim.ts  ✅
              sevseg_shim.ts              ✅
            input/
              keypad_shim.ts              ✅
            memory/
              eeprom_shim.ts              ✅
        rust/
          RustParser.ts         ✅ EXISTE
          RustGenerator.ts      ✅ EXISTE
          shims/
            display/
              liquid_crystal_i2c_shim.ts  ✅
            input/
              keypad_shim.ts              ✅
            memory/
              eeprom_shim.ts              ✅

      LanguageRegistry.ts

    tools/
      flow/
        CfgBuilder.ts           ← SESSÃO 7
        FlowValidator.ts        ← SESSÃO 7
        FlowToASL.ts            ← SESSÃO 7
        ASLToFlow.ts            ← SESSÃO 7

      blockly/
        BlocklyToASL.ts         ← SESSÃO 8
        ASLToBlockly.ts         ← SESSÃO 8

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
- [x] ASL → C (S2), ASL → Python (S3), ASL → Rust (S4)

### 3.3. Round-trip Policy
- [ ] "Perfect" subset (lossless round-trip)
- [ ] "With warning" subset
- [ ] "Unsupported" subset (explicit error)

---

## 4. ASL v1 — Complete Control Flow and Expressions

### 4.1. Control Flow
- [x] Cascading `else if`, nested `if`
- [x] `while`, `doWhile`, simple `for`
- [x] `break` and `continue` inside loops
- [x] `switch/case` (native)

### 4.2. Expressions
- [x] Relational, boolean, arithmetic, bitwise operators
- [x] Unary operators, ternary

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
- [x] Pass 4 — Hardware pattern detection (`PatternDetector.ts` — PWM_BITBANG, POLLING_LOOP, STATE_MACHINE, LONG_DELAY)
- [x] Pass 5 — Light optimization (`Optimizer.ts` — replacePwmBitBang, mergeDelays, batchGpio)
- [ ] Pass 6 — ASL emission

### 6.2. Plugin System
- [x] `ShimManager.ts` — registry + injector core
- [ ] Full plugin API, loader, lifecycle, inter-plugin communication

---

## 7. Input Languages → ASL

### 7.1. C / Arduino C++
- [x] Basic subset v0 (see section 0.3)
- [x] Full control flow (v1)
- [x] `switch/case`, arrays, general expressions
- [ ] Parser via Tree-sitter C/C++

### 7.2. MicroPython / CircuitPython
- [x] Execution via ASL
- [x] Python support: `Pin`, `value()`, `on()`, `off()`, `time.sleep_ms()`
- [x] Parser via Tree-sitter Python + Regex Fallback
- [x] Advanced loops, collections, string methods
- [x] MicroPython specific: `Pin.id/on/off/value`

### 7.3. JavaScript / TypeScript
- [ ] Subset with `setup()/loop()`, IO ops

### 7.4. Rust (embedded subset)
- [x] `RustParser.ts`: Embassy `async/await`, GPIO, UART, SPI
- [x] `RustGenerator.ts`: completo (18.3 KB)

### 7.5–7.9. Zig, Ada, Forth, Assembly, Lua
- [ ] All pending

---

## 8. Visual Inputs → ASL

### 8.1. Flowchart — SESSÃO 7
- [ ] Migrate `CfgBuilder`, `FlowValidator`, `FlowToASL`
- [ ] `ASLToFlow.ts`

### 8.2. Blockly — SESSÃO 8
- [ ] Migrate `BlocklyParser` → `BlocklyToASL`
- [ ] Migrate `CodeToBlockly` → `ASLToBlockly`

### 8.3. Ladder Logic (LD) and IEC 61131-3
- [ ] Contacts (NO/NC), coils, parallel branches → ASL
- [ ] `STParser.ts`, `ASLToLadder.ts`

---

## 9. Code Generators: ASL → Target Language

- [x] ASL → C / Arduino C++ — `CGenerator.ts` (S2 ✅)
- [x] ASL → Python / MicroPython — `PythonGenerator.ts` (S3 ✅)
- [x] ASL → Rust — `RustGenerator.ts` (S4 ✅)
- [ ] ASL → JavaScript / TypeScript
- [ ] ASL → Zig, Ada, Forth, Assembly, Lua, ST IEC 61131-3

---

## 10. Bidirectional Transpilation (ASL as Pivot)

### 10.1. Priority Pairs
- [x] C ↔ Python (via ASL), C ↔ Rust (via ASL), Python ↔ Rust (via ASL)
- [ ] C ↔ C++

### 10.2. Source Maps and Debugging
- [ ] Source map generation, comment preservation, debug metadata

---

## 11. Optimizations and Analysis

### 11.1. Hardware Optimizations
- [x] PWM Bit-Bang → HardwarePwm (`Optimizer.ts` Pass 1)
- [x] Delay merging (`Optimizer.ts` Pass 2)
- [x] GPIO batching → `GpioBatch` (`Optimizer.ts` Pass 3)
- [ ] UART Optimizer, full PWM optimizer

### 11.2. Safety / Validation
- [x] POLLING_LOOP detection (`PatternDetector.ts`)
- [x] LONG_DELAY detection (`PatternDetector.ts`)
- [x] STATE_MACHINE detection (`PatternDetector.ts`)
- [ ] Memory Checker, Timing Analyzer

---

## 12. Foundation Tooling

- [ ] `Lexer.ts` → `src/engine/tools/lexer/`
- [ ] `SymbolTable.ts` → `src/engine/tools/symbols/`
- [ ] `SimulatorInterpreter.ts` with formally defined role
- [x] `LanguageRegistry.ts` integrated
- [x] Verbose log cleanup in Serial Monitor
- [x] `ShimManager.ts` — `plugins/core/` ✅

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
- [x] Generators (C, Python, Rust) ✅
- [ ] ASL v1 stable for common C++ Arduino
- [ ] At least one visual language with round-trip (Blockly or Flow)
- [ ] `notyet/` zeroed
- [ ] Basic documentation published
- [ ] All 21 Integration Test Cases passing

---

## 15. Final Deliverables

- [ ] ASL with complete and validated schema (Core + Hardware + Language-specific)
- [ ] 9+ input languages
- [x] Code generators: C, Python, Rust
- [ ] Full round-trip: Code ↔ ASL ↔ Visual (Blockly / Flow / Ladder)
- [ ] Blockly with 20+ blocks and ASL ↔ blocks round-trip
- [ ] Flow/Ladder with formal industrial blocks
- [ ] Multi-pass pipeline with full plugin system
- [ ] Source maps and debugging for all languages
- [x] Hardware optimizations: PWM, GPIO batch, delay merge (`Optimizer.ts`)
- [ ] `notyet/` = zero
- [ ] 1000+ validated test cases
- [ ] All 21 Integration Test Cases (CI-1 to CI-21) passing

---

## 16. Integration Test Cases (CI-1 to CI-21)

> All 21 CIs currently blocked primarily by:
> 1. Visual round-trip (S7, S8): Flowchart (18 CIs), Blockly (16 CIs), Ladder (19 CIs)
> 2. ASL Schema Extensions (S5): formal UART/I2C/SPI nodes
> 3. Remaining hardware shims (OLED, Wire, SPI, Servo)

### CI-1 — Tank Level (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, 4.3, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-2 — Home Lighting (Flowchart → multi-output)
**Dependencies:** Sec. 8.1, 9, 3.1+8.2, 3.1+8.3, 3.3

### CI-3 — Greenhouse Temperature PID (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, 4.2, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

### CI-4 — Industrial Conveyor Belt (Ladder → multi-output)
**Dependencies:** Sec. 8.3, 8.1, 9, 3.2+8.1, 3.1+8.2, 3.3

### CI-5 — Automatic Gate FSM (ST IEC 61131-3 → multi-output)
**Dependencies:** Sec. 8.3, 4.1, 8.1, 1.1, 9, 3.1+8.1, 3.1+8.2, 3.1+8.3

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

### CI-12 — Multi-tank SCADA ESP32 (MicroPython + Blockly + Flowchart, 3 inputs)
**Dependencies:** Sec. 7.2, 8.2, 8.1, 4.3, 1.1, 1.5, 3.3, 9

### CI-13 — Pressure Pump with Hysteresis (C++ + Ladder + Flowchart, 3 inputs)
**Dependencies:** Sec. 7.1, 8.3, 8.1, 4.2, 1.5, 3.3, 9

### CI-14 — Multi-zone HVAC (MicroPython + ST + Blockly, 3 inputs)
**Dependencies:** Sec. 7.2, 8.3, 8.2, 5, 8.1, 1.5, 3.3, 9

### CI-15 — BLDC Motor with Encoder and PID (Rust + Flowchart + Assembly ARM, 3 inputs)
**Dependencies:** Sec. 7.4, 8.1, 7.8, 4.2, 5, 1.5, 3.3, 9

### CI-16 — Smart Traffic Light FSM (CircuitPython + Blockly + Ladder, 3 inputs)
**Dependencies:** Sec. 7.2, 8.2, 8.3, 8.1, 4.1, 1.5, 3.3, 9

### CI-17 — Pasteurization with Chained Timers (MicroPython + Flowchart + Ladder, 3 inputs)
**Dependencies:** Sec. 7.2, 8.1, 8.3, 1.1, 1.5, 3.3, 9

### CI-18 — Pool Control with Modbus TCP (ST + Blockly + Assembly AVR, 3 inputs)
**Dependencies:** Sec. 8.3, 8.2, 7.8, 4.2, 1.1, 1.5, 3.3, 9

### CI-19 — Fleet Monitoring with GPS and MQTT (C++ ESP32 + Flowchart + ST, 3 inputs)
**Dependencies:** Sec. 7.1, 8.1, 8.3, 5, 1.1, 1.5, 3.3, 9

### CI-20 — Warehouse AGV (MicroPython + Rust + Blockly + Ladder, 4 inputs)
**Dependencies:** Sec. 7.2, 7.4, 8.2, 8.3, 8.1, 1.5, 3.3, 9

### CI-21 — Maximum Perimeter Security (Flowchart + Blockly + Assembly ARM + ST, 4 inputs)
**Dependencies:** Sec. 8.1, 8.2, 7.8, 8.3, 5, 1.1, 1.5, 3.3, 9

---

> **Coverage summary (02/03/2026 — 23:54 WET):**
> - S1–S4 ✅ COMPLETAS (executors, generators C/Python/Rust).
> - S5 [~] PARCIAL: ShimManager + PatternDetector + Optimizer ✅; ADRs formais pendentes.
> - S6 [~] PARCIAL: LCD/Keypad/EEPROM para C/Python/Rust ✅; OLED/Wire/SPI/Servo ❌.
> - S7 e S8 são os maiores bloqueadores (18+16 CIs cada).
> - **Próximo desbloqueador prioritário: S7 (FlowToASL/ASLToFlow).**
