# NeuroForge ASL — Architecture, Status & Roadmap

> **Last Updated:** 03/Mar/2026
> **Branch:** `critical_Implementation`
> **Purpose:** This document is the single source of truth for the ASL subsystem's current state and evolution roadmap. The guiding thread is the full integration of the contents of `notyet/` into the core (`src/engine`), eliminating that folder at the end of the process.

> 📋 **Implementation Standard**: See [docs/IMPLEMENTATION_STANDARD.md](../docs/IMPLEMENTATION_STANDARD.md) for the implementation pattern that ensures parity across all languages.
>
> 📊 **Parser Comparison Table**: See [docs/ASL_PARSER_COMPARISON.md](../docs/ASL_PARSER_COMPARISON.md) for the full verified implementation matrix.
>
> 🔌 **Hardware Shim Architecture**: See [docs/ASL_SHIM_ARCHITECTURE_PLAN.md](../docs/ASL_SHIM_ARCHITECTURE_PLAN.md) for the complete hardware and protocol virtualization strategy ("The Middle Path").

**Status markers:**
- `[x]` Completed
- `[~]` In progress / partial
- `[ ]` Planned
- `[?]` Under research

---

# Part I — What is ASL?

## 1. Abstract Simulation Language (ASL)

**ASL** (Abstract Simulation Language) is NeuroForge's **universal Intermediate Representation (IR)**. It is a JSON-based schema that captures the complete semantics of an embedded program — control flow, hardware operations, data structures — in a language-agnostic format.

### 1.1. Why ASL Exists

NeuroForge supports multiple programming languages (C++, MicroPython, Rust, and more in the future) and multiple representation modes (Blockly, Flowchart, Ladder). Without a central IR, every new language or visual editor would require N×M integrations. ASL reduces this to N+M:

```
            ┌─────┐ ┌────────┐ ┌──────┐ ┌─────────┐ ┌─────────┐
            │ C++ │ │ Python │ │ Rust │ │ Blockly │ │Flowchart│ ...
            └──┬──┘ └───┬────┘ └──┬───┘ └────┬────┘ └────┬────┘
               │        │        │           │           │
        ┌──────▼────────▼────────▼───────────▼───────────▼──────┐
        │                    PARSERS (input)                      │
        │   CParser · PythonParser · RustParser · BlocklyToASL   │
        └──────────────────────────┬─────────────────────────────┘
                                   │
                            ┌──────▼──────┐
                            │ ASLProgram  │  ← The Universal Pivot
                            │   (JSON)    │
                            └──┬──────┬───┘
                               │      │
              ┌────────────────┘      └────────────────┐
              │                                        │
    ┌─────────▼──────────┐                  ┌──────────▼──────────┐
    │    ASLExecutor      │                  │    GENERATORS       │
    │  (Runtime in JS)    │                  │  C · Python · Rust  │
    │       │             │                  │  Blockly · Flow     │
    │  SimulationEngine   │                  │  (output)           │
    │  GPIO, delay, I2C   │                  └─────────────────────┘
    │  Serial, Shims      │
    └─────────────────────┘
```

### 1.2. ASL vs AST — Key Distinction

| Concept         | AST (Abstract Syntax Tree)                    | ASL (Abstract Simulation Language)               |
| --------------- | --------------------------------------------- | ------------------------------------------------ |
| **Level**       | Syntax-level, language-specific               | Semantic-level, language-agnostic                |
| **Produced by** | Each parser (`CParser`, `PythonParser`, etc.) | `codeToASL()` transformation                     |
| **Format**      | `ProgramNode` with children                   | `ASLProgram { globals, functions, tasks }`       |
| **Purpose**     | Intermediate structure for parsing            | Universal pivot for execution and generation     |
| **Lifespan**    | Temporary — consumed by `codeToASL`           | Persistent — consumed by Executor and Generators |

**Flow:** Source Code → *Parser* → **AST** (`ProgramNode`) → *codeToASL* → **ASL** (`ASLProgram`) → Executor / Generators

### 1.3. The Golden Rule

> "Todas as linguagens devem andar de mãos dadas" — All languages must walk hand in hand.
>
> Any new feature or hardware support added to one language (C++, Python, or Rust) must be implemented with semantic parity across all supported languages.

### 1.4. ASLProgram Schema (Summary)

```typescript
interface ASLProgram {
  metadata: { name?, description?, version?, targetBoard? };
  structs: ASLStructDef[];     // struct definitions
  globals: ASLGlobalVar[];     // global variables declared outside setup/loop
  functions: ASLFunction[];    // setup() + user functions
  tasks: ASLTask[];            // [0] = mainLoop (derived from loop() / while True)
}
```

**Supported Statement Kinds:** `pinMode`, `digitalWrite`, `analogWrite`, `read`, `if`, `while`, `for`, `doWhile`, `switch`, `delay`, `assign`, `setIndex`, `setMember`, `expr`, `return`, `print`, `break`, `continue`, `comment`

**Supported Expression Kinds:** `literal`, `var`, `index`, `member`, `unary`, `binary`, `call`, `ternary`, `cast`, `object`

---

# Part II — Current Architecture

## 2. File Structure (Verified 03/Mar/2026)

```
src/engine/
  SimulationEngine.ts              ✅ Simulation runtime (GPIO, delay, millis, Serial)
  CodeParser.ts                    ⬜ Legacy parser (fallback when ASL doesn't cover something)
  Transpiler.ts                    ✅ Transpilation orchestration

  asl/
    ASLTypes.ts                    ✅ Single source of truth for the ASL schema
    ASLExecutor.ts                 ✅ ASL interpreter/runtime → SimulationEngine
    codeToASL.ts                   ✅ Transpiler: AST → ASLProgram
    LanguageRegistry.ts            ✅ Central registry of supported languages
    TreeSitterLoader.ts            ✅ Lazy loader for web-tree-sitter
    transpile.ts                   ✅ Transpilation helpers
    index.ts                       ✅ Barrel exports

    transforms/                    ✅ codeToASL modules (Handler Registry pattern)
      index.ts                       Barrel exports
      context.ts                     TransformContext interface
      statementRegistry.ts           Handler registry by nodeType (~30 handlers)
      blockTransform.ts              Orchestrator using registry
      exprTransform.ts               Expression transformation
      callTransform.ts               Function call transformation
      astNormalizer.ts               AST normalization pass
      postfixUtils.ts                Postfix increment/decrement utilities

    helpers/                       ✅ Shared utilities
      index.ts
      arrayUtils.ts                  resolveSize, buildEmptyArray, deepCopyValue
      typeUtils.ts                   mapToASLType

    plugins/
      core/
        ShimManager.ts             ✅ Shim orchestrator (registration, dependency DAG, injection)

      c/
        CParser.ts                 ✅ Recursive descent parser for C/C++ Arduino subset
        CGenerator.ts              ✅ ASL → C code generator
        shims/
          display/
            liquid_crystal_i2c_shim.ts   ✅
          input/
            keypad_shim.ts               ✅
          memory/
            eeprom_shim.ts               ✅
          index.ts                       ✅ Barrel + registration

      cpp/
        CppParser.ts               ✅ Full C++ parser

      python/
        PythonParser.ts            ✅ MicroPython/CircuitPython parser via tree-sitter
        PythonGenerator.ts         ✅ ASL → Python code generator
        shims/
          display/
            liquid_crystal_i2c_shim.ts   ✅
            sevseg_shim.ts               ✅
          input/
            keypad_shim.ts               ✅
          memory/
            eeprom_shim.ts               ✅
          index.ts                       ✅

      rust/
        RustParser.ts              ✅ Rust (Embassy) parser
        RustGenerator.ts           ✅ ASL → Rust (Embassy) code generator
        shims/
          display/
            liquid_crystal_i2c_shim.ts   ✅
          input/
            keypad_shim.ts               ✅
          memory/
            eeprom_shim.ts               ✅
          index.ts                       ✅

      zig/                         ⬜ Empty — reserved for future Zig parser

      analysis/
        PatternDetector.ts         ✅ Hardware pattern detection (4 detectors)

      optimizer/
        Optimizer.ts               ✅ AST optimization (3 passes)

src/components/
  TopToolbar.tsx                   ✅ Run/Stop/Pause + ASL pipeline integration
  CodeEditorWithTabs.tsx           ✅ Multi-tab Monaco editor
  ASLViewer.tsx                    ✅ Debug viewer for generated ASLProgram

notyet/
  README.md                        📋 This file
  app/                             ⬜ Pending integration (flow/, blockly/, simulator/)
```

---

## 3. Implementation Status (Verified Against Codebase)

### 3.1. Parsers (Source Code → AST)

| Parser                | Language(s)                 | Technology                   | File                             | Status     |
| --------------------- | --------------------------- | ---------------------------- | -------------------------------- | ---------- |
| `CParser`             | C / C++ Arduino subset      | Recursive descent            | `plugins/c/CParser.ts`           | ✅ Complete |
| `CppParser`           | Full C++                    | Recursive descent            | `plugins/cpp/CppParser.ts`       | ✅ Complete |
| `PythonParser`        | MicroPython / CircuitPython | tree-sitter + regex fallback | `plugins/python/PythonParser.ts` | ✅ Complete |
| `RustParser`          | Rust (Embassy)              | Recursive descent            | `plugins/rust/RustParser.ts`     | ✅ Complete |
| Assembly parser       | AVR / ARM Thumb             | —                            | —                                | ⬜ Planned  |
| ST IEC 61131-3 parser | Structured Text             | —                            | —                                | ⬜ Planned  |
| JS/TS parser          | JavaScript / TypeScript     | —                            | —                                | ⬜ Planned  |

### 3.2. Generators (ASL → Target Code)

| Generator                | Target Language      | File                                | Status     |
| ------------------------ | -------------------- | ----------------------------------- | ---------- |
| `CGenerator`             | C / Arduino C++      | `plugins/c/CGenerator.ts`           | ✅ Complete |
| `PythonGenerator`        | MicroPython / Python | `plugins/python/PythonGenerator.ts` | ✅ Complete |
| `RustGenerator`          | Rust (Embassy)       | `plugins/rust/RustGenerator.ts`     | ✅ Complete |
| C++ generator            | Full C++             | —                                   | ⬜ Planned  |
| CircuitPython generator  | CircuitPython        | —                                   | ⬜ Planned  |
| Assembly generator       | AVR / ARM            | —                                   | ⬜ Planned  |
| ST IEC 61131-3 generator | Structured Text      | —                                   | ⬜ Planned  |
| JS/TS generator          | JavaScript           | —                                   | ⬜ Planned  |

### 3.3. Visual Round-trip (Code ↔ ASL ↔ Visual)

| Path            | Direction        | File              | Status                |
| --------------- | ---------------- | ----------------- | --------------------- |
| Blockly → ASL   | Input parser     | `BlocklyToASL.ts` | ⬜ Planned (Session 8) |
| ASL → Blockly   | Output generator | `ASLToBlockly.ts` | ⬜ Planned (Session 8) |
| Flowchart → ASL | Input parser     | `FlowToASL.ts`    | ⬜ Planned (Session 7) |
| ASL → Flowchart | Output generator | `ASLToFlow.ts`    | ⬜ Planned (Session 7) |
| Ladder → ASL    | Input parser     | —                 | ⬜ Planned             |
| ASL → Ladder    | Output generator | `ASLToLadder.ts`  | ⬜ Planned             |

### 3.4. Hardware Shims (Virtual Peripherals)

> 🔌 Full architecture: [ASL_SHIM_ARCHITECTURE_PLAN.md](../docs/ASL_SHIM_ARCHITECTURE_PLAN.md)

| Shim                      | Device            | Status               | C   | Python | Rust |
| ------------------------- | ----------------- | -------------------- | --- | ------ | ---- |
| `liquid_crystal_i2c_shim` | LCD 16×2 / 20×4   | ✅                    | ✅   | ✅      | ✅    |
| `oled_ssd1306_shim`       | OLED SSD1306      | ✅                    | ✅   | ✅      | ✅    |
| `sevseg_shim`             | 7-Segment Display | ✅                    | ⬜   | ✅      | ⬜    |
| `keypad_shim`             | Matrix Keypad 4×4 | ✅                    | ✅   | ✅      | ✅    |
| `buzzer_shim`             | Piezo Buzzer      | ✅                    | ✅   | ✅      | ✅    |
| `eeprom_shim`             | Virtual EEPROM    | ✅                    | ✅   | ✅      | ✅    |
| Wire (I2C)                | I2C bus           | ✅ via `hardwareCall` | ✅   | ✅      | ✅    |
| SPI                       | SPI bus           | ✅ via `hardwareCall` | ✅   | ✅      | ✅    |
| `servo_shim`              | Servo Motor       | ⬜                    | —   | —      | —    |
| `dht_shim`                | DHT11/22          | ⬜                    | —   | —      | —    |
| `ultrasonic_shim`         | HC-SR04           | ⬜                    | —   | —      | —    |

> ⚠️ Seven Segment (`sevseg_shim`) is only implemented for Python. C and Rust need generator shim injection.

### 3.5. ASLExecutor Builtins (Verified in `ASLExecutor.ts`)

**All implemented:**

| Category                | Builtins                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **GPIO**                | `pinMode`, `digitalWrite`, `analogWrite`, `digitalRead`, `analogRead`                                      |
| **Timing**              | `delay`, `delayMicroseconds`, `millis`, `micros`                                                           |
| **Serial**              | `Serial.begin/print/println/read/write/available/parseInt/readString`                                      |
| **Math**                | `abs`, `sqrt`, `pow`, `sin`, `cos`, `tan`, `log`, `min`, `max`, `round`, `floor`, `ceil`, `isnan`, `isinf` |
| **Utility**             | `random`, `map`, `constrain`                                                                               |
| **String / C stdlib**   | `strlen`, `strcmp`, `atoi`, `atof`, `dtostrf`                                                              |
| **Type conversion**     | `int()`, `float()`, `String()`                                                                             |
| **Hardware events**     | `lcd.*`, `oled.*`, `sevseg.*`, `keypad.*` → `engine.emit('hardwareCall', ...)`                             |
| **Tone**                | `tone(pin, freq)`, `tone(pin, freq, dur)`, `noTone(pin)`                                                   |
| **Interrupts/Protocol** | `attachInterrupt`, `detachInterrupt`, `pulseIn`, `shiftOut`, `shiftIn`                                     |
| **Python extras**       | `len()`, `format()`, `enumerate()`, `reversed()`                                                           |
| **sizeof**              | `sizeof(arr)` → array length                                                                               |

### 3.6. Supported C++ Subset

#### Statements
- [x] Global/local variable declarations (scalars, arrays, strings, PROGMEM)
- [x] `#define` for constants and array sizes
- [x] All assignment forms (simple, array, 2D/3D, compound, pointer dereference)
- [x] All hardware: `pinMode`, `digitalWrite`, `analogWrite`, `delay`, `digitalRead`
- [x] Control flow: `if/else`, `while`, `for`, `doWhile`, `switch/case`, `return`, `break`, `continue`

#### Expressions
- [x] Arithmetic: `+ - * / %`, Bitwise: `& | ^ << >>`, Logical: `&& ||`
- [x] Comparisons: `== != < <= > >=`
- [x] Unary: `! - ++ --` (prefix and postfix)
- [x] Ternary: `cond ? a : b`
- [x] Array indexing, member access, function calls, `sizeof`

#### Data Types
- [x] Scalars, static arrays (1D/2D/3D), strings (`char[]`)
- [x] Type qualifiers: `const`, `volatile`, `static`
- [x] Pointers, address-of operator
- [x] Structs (data only): `struct Point { int x, y; };`
- [x] Enums: `enum Phase { ... };`
- [x] `std::array<int, N>`, `std::vector<int>`
- [x] Range-based for: `for (auto x : arr)`

### 3.7. PatternDetector & Optimizer

> **Files:** `plugins/analysis/PatternDetector.ts`, `plugins/optimizer/Optimizer.ts`

#### PatternDetector — 4 Detection Methods

| Method               | Pattern                                        | Severity   | Description                                         |
| -------------------- | ---------------------------------------------- | ---------- | --------------------------------------------------- |
| `detectPwmBitBang`   | GPIO HIGH → delay → GPIO LOW → delay           | ⚠️ WARNING  | Software PWM detected; suggests using `analogWrite` |
| `detectPollingLoop`  | `while(digitalRead(...))` without delay        | 🔴 CRITICAL | Blocking polling loop freezes multitasking          |
| `detectStateMachine` | `if (state == ...)` with state/mode/phase vars | ℹ️ INFO     | FSM pattern detected, useful for flow visualization |
| `detectLongDelays`   | `delay(>500ms)` inside loop                    | ⚠️ WARNING  | Long blocking delay; suggests `millis()` pattern    |

#### Optimizer — 3 Optimization Passes

| Pass | Method              | Description                                                                     |
| ---- | ------------------- | ------------------------------------------------------------------------------- |
| 1    | `replacePwmBitBang` | Replaces GPIO-HIGH → delay → GPIO-LOW → delay sequences with `HardwarePwm` node |
| 2    | `mergeDelays`       | Merges consecutive `delay()` calls into a single delay                          |
| 3    | `batchGpio`         | Groups consecutive `GpioSet` operations into a single `GpioBatch` node          |

### 3.8. Additional Supported Structures

- [x] Enum declarations: `enum Phase { ACCELERATING, DECELERATING, STOPPED };`
- [x] Enum in conditions: `if (phase == STOPPED)`
- [x] Global expression initialization: `float intervalMin = initialInterval * 0.50;`
- [x] User-defined functions with parameters and return values
- [x] `for` desugared to `while` in ASL (`init → while(cond) { body; update }`)

---

## 4. Known Gaps & Limitations

> See also: [docs/ASL_PARSER_COMPARISON.md](../docs/ASL_PARSER_COMPARISON.md)

### 4.1. Missing Language Features

| Priority    | Gap                                          | Status                                    |
| ----------- | -------------------------------------------- | ----------------------------------------- |
| 🟠 Important | Cast `(byte)`, `(uint8_t)`, `(char)`         | [ ] Only `int`/`float`/`String` handled   |
| 🟡 Medium    | `CommaExpression` — `for(int i=0, j=0; ...)` | [ ] Falls to `literal 0`                  |
| 🟡 Medium    | `sizeof(type)` without variable              | [ ] Only variable-based `sizeof` handled  |
| 🟢 Low       | `typedef` / `using` type aliases             | [ ] Affects `mapToASLType`                |
| 🟢 Low       | `AddressOf` in complex lvalue                | [ ] Only `&varName` and `&arr[i]` handled |
| 🟢 Low       | String concatenation `"text" + String(val)`  | [ ] JS `+` coercion may mismatch          |

### 4.2. Incomplete `evaluateInitializer`

- [ ] Array of string literals as globals: `const char* arr[] = {"on","off"}` — inconsistent
- [ ] Conditional/ternary initializer: `const int X = (A > B) ? A : B` — unsupported

### 4.3. Missing Hardware Builtins

- [ ] `Servo.attach/write/read` → needs UI servo widget
- [ ] `pgm_read_byte(addr)` → should be transparent in simulation

### 4.4. Tools in `notyet/` Still to Integrate

- [ ] `notyet/app/system/flow/CfgBuilder.ts`
- [ ] `notyet/app/system/flow/FlowValidator.ts`
- [ ] `notyet/app/system/flow/FlowToAst.ts`
- [ ] `notyet/app/system/blockly/BlocklyParser.ts`
- [ ] `notyet/app/system/blockly/CodeToBlockly.ts`
- [ ] `notyet/app/system/simulator/SimulatorInterpreter.ts`

---

# Part III — Roadmap

## 5. Integration Sessions

### Session Summary

| Session | Description                 | Status         | Priority |
| ------- | --------------------------- | -------------- | -------- |
| **S1**  | ASLExecutor Builtins        | ✅ **Complete** | —        |
| **S2**  | CGenerator                  | ✅ **Complete** | —        |
| **S3**  | PythonGenerator             | ✅ **Complete** | —        |
| **S4**  | RustGenerator               | ✅ **Complete** | —        |
| **S5**  | ASLTypes Schema Extensions  | [~] Partial    | 🟡 P2     |
| **S6**  | Hardware Shims Extras       | [~] Partial    | 🟡 P2     |
| **S7**  | FlowToASL + ASLToFlow       | [ ] Pending    | 🟠 P1     |
| **S8**  | BlocklyToASL + ASLToBlockly | [ ] Pending    | 🟠 P1     |

> 💡 **Language Parity Achieved**: The system has reached a state where C++, Python, and Rust walk "hand in hand". Any control logic implemented in one of these languages is faithfully represented in ASL and regenerated for the others with semantic parity.

---

### S1 — ASLExecutor Builtins ✅ COMPLETE

| #    | Task                                                                   | File                                     | Status                                                                 |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| S1.1 | Math builtins: `abs/sqrt/pow/sin/cos/tan/log/min/max/round/floor/ceil` | `ASLExecutor.ts`                         | ✅                                                                      |
| S1.2 | Math extras: `isnan/isinf`                                             | `ASLExecutor.ts`                         | ✅ [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b60) |
| S1.3 | String builtins: `strlen/strcmp/atoi/atof/dtostrf`                     | `ASLExecutor.ts`                         | ✅ [79a6b60](https://github.com/caiojordao84/neuroforge/commit/79a6b60) |
| S1.4 | Serial extensions: `write/read/available/parseInt/readString`          | `ASLExecutor.ts`                         | ✅                                                                      |
| S1.5 | `doWhile` in executor                                                  | `ASLExecutor.ts`                         | ✅                                                                      |
| S1.6 | `delayMicroseconds` in executor + SimulationEngine                     | `ASLExecutor.ts` + `SimulationEngine.ts` | ✅                                                                      |
| S1.7 | `tone(pin, freq, duration)` — auto noTone                              | `ASLExecutor.ts`                         | ✅ [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce) |
| S1.8 | `sizeof(arr)` builtin                                                  | `ASLExecutor.ts`                         | ✅                                                                      |
| S1.9 | `attachInterrupt/detachInterrupt/pulseIn/shiftOut/shiftIn`             | `ASLExecutor.ts` + `CParser.ts`          | ✅ [3af7dce](https://github.com/caiojordao84/neuroforge/commit/3af7dce) |

---

### S2 — CGenerator ✅ COMPLETE

| #     | Task                            | File                      | Status |
| ----- | ------------------------------- | ------------------------- | ------ |
| S2.1  | Core and structural support     | `plugins/c/CGenerator.ts` | ✅      |
| S2.2  | Full control flow               | `CGenerator.ts`           | ✅      |
| S2.3  | do-while support                | `CGenerator.ts`           | ✅      |
| S2.11 | Globals, arrays, structs, enums | `CGenerator.ts`           | ✅      |

---

### S3 — PythonGenerator ✅ COMPLETE

| #    | Task                         | File                                | Status |
| ---- | ---------------------------- | ----------------------------------- | ------ |
| S3.1 | ASL-compatible Python output | `plugins/python/PythonGenerator.ts` | ✅      |
| S3.2 | Control flow and GPIO        | `PythonGenerator.ts`                | ✅      |

---

### S4 — RustGenerator ✅ COMPLETE

| #    | Task                               | File               | Status |
| ---- | ---------------------------------- | ------------------ | ------ |
| S4.1 | Serial, Time, GPIO in Rust/Embassy | `RustGenerator.ts` | ✅      |
| S4.2 | `tone/noTone` stubs and interrupts | `RustGenerator.ts` | ✅      |

---

### S5 — ASLTypes Schema Extensions [~] Partial

> New ASL nodes needed for advanced hardware CIs.

| #    | Task                                                               | File                   | Status |
| ---- | ------------------------------------------------------------------ | ---------------------- | ------ |
| S5.1 | `UARTWrite/Read` formal ASL nodes                                  | `ASLTypes.ts`          | [ ]    |
| S5.2 | `I2CRead/Write` formal ASL nodes                                   | `ASLTypes.ts`          | [ ]    |
| S5.3 | `SPIRead/Write` formal ASL nodes                                   | `ASLTypes.ts`          | [ ]    |
| S5.4 | `PWMInit/SetDuty/SetFreq/Stop`                                     | `ASLTypes.ts`          | [ ]    |
| S5.5 | `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F` (IEC) | `ASLTypes.ts`          | [ ]    |
| S5.6 | Executor handlers for new nodes                                    | `ASLExecutor.ts`       | [ ]    |
| S5.7 | Registry handlers for new nodes                                    | `statementRegistry.ts` | [ ]    |

---

### S6 — Hardware Shims Extras [~] Partial

> ⚠️ **Status updated 03/Mar/2026** to reflect actual implementation state.

| #    | Task                                              | File                                     | Status                                                                 |
| ---- | ------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| S6.1 | `Servo.attach/write/read` — servo simulation      | `ASLExecutor.ts` + `SimulationEngine.ts` | [ ]                                                                    |
| S6.2 | `EEPROM.read/write` — Map-backed simulation       | `ASLExecutor.ts` + `SimulationEngine.ts` | ✅ [1cf0961](https://github.com/caiojordao84/neuroforge/commit/1cf0961) |
| S6.3 | `Wire.*` (I2C) — basic bus simulation             | `ASLExecutor.ts`                         | ✅ via `hardwareCall`                                                   |
| S6.4 | `SPI.begin/transfer` — basic bus simulation       | `ASLExecutor.ts`                         | ✅ via `hardwareCall`                                                   |
| S6.5 | `pgm_read_byte(addr)` — transparent in simulation | `ASLExecutor.ts`                         | [ ]                                                                    |
| S6.6 | DHT (Python) — tree-sitter + regex                | `PythonParser.ts`                        | [ ]                                                                    |
| S6.7 | Ultrasonic (Python) — tree-sitter + regex         | `PythonParser.ts`                        | [ ]                                                                    |

---

### S7 — FlowToASL + ASLToFlow (Visual Round-trip) ⬜ PENDING

> **Impact:** 18 of 21 CIs depend on `ASLToFlow.ts` or `FlowToASL.ts`.

| #    | Task                                                   | File                      | Status |
| ---- | ------------------------------------------------------ | ------------------------- | ------ |
| S7.1 | Migrate `FlowToAst.ts` → `FlowToASL.ts`                | `tools/flow/FlowToASL.ts` | [ ]    |
| S7.2 | Migrate `CfgBuilder.ts` and `FlowValidator.ts`         | `tools/flow/`             | [ ]    |
| S7.3 | Create `ASLToFlow.ts`: `If` → Decision, `While` → Loop | `tools/flow/ASLToFlow.ts` | [ ]    |
| S7.4 | FSM pattern: `switch` in loop → states and transitions | `tools/flow/ASLToFlow.ts` | [ ]    |
| S7.5 | Industrial blocks: `TON/TOF` timers as flow nodes      | `tools/flow/`             | [ ]    |
| S7.6 | Register in pipeline and expose via UI                 | `TopToolbar.tsx`          | [ ]    |

---

### S8 — BlocklyToASL + ASLToBlockly ⬜ PENDING

> **Impact:** 16 of 21 CIs depend on the Blockly round-trip.

| #    | Task                                                   | File                            | Status |
| ---- | ------------------------------------------------------ | ------------------------------- | ------ |
| S8.1 | Migrate `BlocklyParser.ts` → `BlocklyToASL.ts`         | `tools/blockly/BlocklyToASL.ts` | [ ]    |
| S8.2 | Migrate `CodeToBlockly.ts` → `ASLToBlockly.ts`         | `tools/blockly/ASLToBlockly.ts` | [ ]    |
| S8.3 | Block library: GPIO, timing, PWM, communication        | `tools/blockly/`                | [ ]    |
| S8.4 | Block definitions: appearance, fields, type validation | `tools/blockly/`                | [ ]    |
| S8.5 | Real-time code preview (blocks → multi-language code)  | UI                              | [ ]    |

---

## 6. Architectural Decisions (ADRs)

### 6.1. ASL Schema
- [x] Core statement/expression types defined in `ASLTypes.ts`
- [ ] Define schema levels: Core, Hardware, Language-specific
- [ ] Schema validation: Zod, JSON Schema, or pure TypeScript types
- [ ] Define the "raw code" policy

### 6.2. Multi-pass Pipeline
- [x] Pass 4 — Hardware pattern detection (`PatternDetector.ts`)
- [x] Pass 5 — Light optimization (`Optimizer.ts`)
- [ ] Pass 1 — Formal parsing pipeline
- [ ] Pass 2 — Normalization pass
- [ ] Pass 3 — Analysis and verification
- [ ] Pass 6 — ASL emission formalization

### 6.3. Parser Technology
- [x] `web-tree-sitter` evaluated and used for Python
- [x] Recursive descent used for C/C++/Rust
- [x] Fallback strategy implemented in `TopToolbar`
- [ ] Define where custom parsers are necessary: Assembly, Ada, Forth, Zig

### 6.4. Executor and Runtime
- [x] `ASLExecutor` is the primary runtime for JS simulation
- [ ] Define the role of `SimulatorInterpreter.ts` (in `notyet/`)
- [ ] Ensure `SimulationEngine.reset()` clears all state before each execution

### 6.5. Round-trip as Product Feature
- [ ] Formalize ASL as the pivot for all conversions in both directions
- [ ] Define the "information loss" policy (perfect / with-warning / unsupported subsets)

---

## 7. Future Language Support

### 7.1. Input Parsers (Source → ASL)

| Language                    | Parser File       | Status | Notes                                 |
| --------------------------- | ----------------- | ------ | ------------------------------------- |
| C / Arduino C++             | `CParser.ts`      | ✅      | Full subset v1                        |
| Full C++                    | `CppParser.ts`    | ✅      | Extended C++ features                 |
| MicroPython / CircuitPython | `PythonParser.ts` | ✅      | tree-sitter + regex                   |
| Rust (Embassy)              | `RustParser.ts`   | ✅      | async/await, GPIO, UART, SPI          |
| JavaScript / TypeScript     | —                 | ⬜      | Subset with `setup()/loop()`          |
| Zig (embedded)              | —                 | ⬜      | HAL abstraction via `@import("chip")` |
| Ada (SPARK subset)          | —                 | ⬜      | Safety-critical subset                |
| Forth                       | —                 | ⬜      | Stack-based → ASL mapping             |
| AVR Assembly                | —                 | ⬜      | GPIO instructions, timers             |
| ARM Thumb Assembly          | —                 | ⬜      | GPIO, timers, interrupts              |
| Structured Text IEC 61131-3 | —                 | ⬜      | IF/FOR/WHILE/CASE, TON/TOF/CTU, FB    |
| Lua                         | —                 | ⬜      | NodeMCU subset                        |

### 7.2. Output Generators (ASL → Target)

| Language                    | Generator File       | Status |
| --------------------------- | -------------------- | ------ |
| C / Arduino C++             | `CGenerator.ts`      | ✅      |
| MicroPython / Python        | `PythonGenerator.ts` | ✅      |
| Rust (Embassy)              | `RustGenerator.ts`   | ✅      |
| C++ (full, non-Arduino)     | —                    | ⬜      |
| CircuitPython               | —                    | ⬜      |
| JavaScript / TypeScript     | —                    | ⬜      |
| Assembly (AVR/ARM)          | —                    | ⬜      |
| Structured Text IEC 61131-3 | —                    | ⬜      |

---

## 8. Bidirectional Transpilation (ASL as Pivot)

### 8.1. Priority Pairs
- [x] C++ → Python (via ASL) — functional
- [x] C++ → Rust (via ASL) — functional
- [x] Python → C++ (via ASL) — functional
- [x] Python → Rust (via ASL) — functional
- [x] Rust → C++ (via ASL) — functional
- [x] Rust → Python (via ASL) — functional

### 8.2. Source Maps and Debugging
- [ ] Source map generation
- [ ] Comment preservation across transpilation
- [ ] Debug metadata (line mapping input → ASL → output)

---

## 9. Hardware & Protocol Roadmap

> See [ASL_SHIM_ARCHITECTURE_PLAN.md](../docs/ASL_SHIM_ARCHITECTURE_PLAN.md) for the full 5-phase plan.

### 9.1. Phase 1 — Peripheral Expansion (Next)
- [ ] `servo_shim` — Servo.attach/write/read + UI widget
- [ ] `dht_shim` — DHT11/22 with simulated temp/humidity
- [ ] `ultrasonic_shim` — HC-SR04 + `pulseIn` mapping
- [ ] `neopixel_shim` — WS2812B LED strip with visual UI
- [ ] `motor_driver_shim` — L298N / TB6612

### 9.2. Phase 2 — Protocol Buses
- [ ] I2C formal bus simulation with device registry
- [ ] SPI bus simulation
- [ ] Hardware UART (beyond debug Serial)
- [ ] Modbus RTU/TCP

### 9.3. Phase 3 — OS Services & Board Profiles
- [ ] Board Profile system (Arduino Uno, ESP32, RPi Pico)
- [ ] RTOS task simulation (cooperative scheduling)
- [ ] Hardware timer shim
- [ ] Virtual filesystem (LittleFS)

### 9.4. Phase 4 — Connectivity
- [ ] WiFi shim (simulated always-connected)
- [ ] MQTT in-browser pub/sub
- [ ] HTTP client/server mock
- [ ] BLE simulation

---

## 10. Optimizations and Safety

### 10.1. Hardware Optimizations (Implemented)
- [x] PWM Bit-Bang replacement → `HardwarePwm` node
- [x] Consecutive delay merging
- [x] GPIO batch grouping → `GpioBatch` node

### 10.2. Safety / Validation (Planned)
- [ ] GPIO Validator — pin conflict detection
- [ ] Memory Checker — array bounds, stack overflow estimation
- [ ] Timing Analyzer — blocking delay warnings (partially done via `detectLongDelays`)

---

## 11. Foundation Tooling

- [x] `LanguageRegistry.ts` — integrated and functional
- [x] `Lexer.ts` — integrated into `CParser`
- [x] `SymbolTable.ts` — integrated into `CParser`
- [ ] `SimulatorInterpreter.ts` — role to be formally defined
- [x] Verbose log cleanup in Serial Monitor

---

## 12. UX, Documentation, and Teaching Mode

### 12.1. Code Best Practices
- [ ] Language / input mode selection guide
- [ ] Inline documentation for each visual editor mode

### 12.2. Teaching Mode
- [ ] Visual highlight of code/block/node being executed
- [ ] Inline pedagogical messages
- [ ] Protocol analyzer view (I2C/SPI transaction logs)

---

## 13. Merge Strategy for `main`

- [ ] Feature flag "ASL experimental"
- [x] Simple C++ goes through ASL first (fallback to `CodeParser` available)
- [ ] Keep fallback for complex patterns that ASL doesn't cover yet

**Criteria for final merge:**
- [ ] ASL v1 stable for common C++ Arduino patterns
- [ ] At least one visual language with round-trip (Blockly or Flowchart)
- [ ] `notyet/` zeroed (all code migrated to `src/`)
- [ ] Basic documentation published
- [ ] Test suite covering all integrated inputs
- [ ] All 21 Integration Test Cases (CI-1 to CI-21) passing

---

## 14. Final Deliverables

- [ ] ASL with complete and validated schema (Core + Hardware + Language-specific)
- [ ] 9+ input languages (text + visual)
- [ ] Code generators for all supported languages
- [ ] Full round-trip: Code ↔ ASL ↔ Visual (Blockly / Flowchart / Ladder)
- [ ] Blockly with 20+ blocks and ASL ↔ blocks round-trip
- [ ] Flow/Ladder with formal industrial blocks (TON, TOF, CTU, CTD, SR, RS, R_TRIG, F_TRIG)
- [ ] Multi-pass pipeline with plugin system
- [ ] Source maps and debugging for all languages
- [ ] Hardware optimizations (PWM, UART, GPIO, delay)
- [ ] `notyet/` = zero files
- [ ] 1000+ validated test cases
- [ ] All 21 Integration Test Cases (CI-1 to CI-21) passing

---

## 15. Integration Test Cases (CI-1 to CI-21)

> **IMPORTANT:** These are system integration tests. Each CI validates that multiple sections
> of the roadmap are complete **and communicate correctly with each other**.
>
> All 21 CIs are currently **blocked** primarily by:
> 1. **Visual round-trip** (S7, S8): Flowchart (18 CIs), Blockly (16 CIs), Ladder (19 CIs)
> 2. **Missing generators**: Assembly, ST, CircuitPython, JS (affects 16–19 CIs each)
> 3. **ASL Features** (S5): formal I2C/SPI/UART/PWM/IEC nodes
> 4. **Missing input parsers**: Assembly, ST, Ladder

### CI-1 — Tank Level (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, 9, S7, S8

### CI-2 — Home Lighting (Flowchart → multi-output)
**Dependencies:** S7, 9 (all generators), S8

### CI-3 — Greenhouse Temperature PID (MicroPython → multi-output)
**Dependencies:** Sec. 7.2, S5 (DHT shim), 9, S7, S8

### CI-4 — Industrial Conveyor Belt (Ladder → multi-output)
**Dependencies:** Ladder parser, S7, 9, S8

### CI-5 — Automatic Gate FSM (ST IEC 61131-3 → multi-output)
**Dependencies:** ST parser, S5 (IEC nodes), S7, S8, 9

### CI-6 — Zone-based Automatic Irrigation (Blockly → multi-output)
**Dependencies:** S8, S7, 9

### CI-7 — Indoor Air Quality (C++ Arduino → multi-output)
**Dependencies:** Sec. 7.1, S5 (OLED/SD shims), 9, S7, S8

### CI-8 — Solar Energy Management (Flowchart → multi-output)
**Dependencies:** S7, 9, S8

### CI-9 — RFID Access Control (Rust Embassy → multi-output)
**Dependencies:** Sec. 7.4, S5, 9, S7, S8

### CI-10 — Industrial 7-Segment Timer (Assembly AVR/ARM → multi-output)
**Dependencies:** Assembly parser, S7, 9, S8

### CI-11 — HX711 Weighing with Modbus RTU (CircuitPython → multi-output)
**Dependencies:** CircuitPython parser, S5 (Modbus), 9, S7, S8

### CI-12 — Multi-tank SCADA ESP32 (MicroPython + Blockly + Flowchart → 3 inputs)
**Dependencies:** Sec. 7.2, S8, S7, S5, 9

### CI-13 — Pressure Pump with Hysteresis (C++ + Ladder + Flowchart → 3 inputs)
**Dependencies:** Sec. 7.1, Ladder parser, S7, 9

### CI-14 — Multi-zone HVAC (MicroPython + ST + Blockly → 3 inputs)
**Dependencies:** Sec. 7.2, ST parser, S8, S5, S7, 9

### CI-15 — BLDC Motor with Encoder and PID (Rust + Flowchart + Assembly ARM → 3 inputs)
**Dependencies:** Sec. 7.4, S7, Assembly parser, S5, 9

### CI-16 — Smart Traffic Light FSM (CircuitPython + Blockly + Ladder → 3 inputs)
**Dependencies:** CircuitPython parser, S8, Ladder parser, S7, 9

### CI-17 — Pasteurization with Chained Timers (MicroPython + Flowchart + Ladder → 3 inputs)
**Dependencies:** Sec. 7.2, S7, Ladder parser, S5, 9

### CI-18 — Pool Control with Modbus TCP (ST + Blockly + Assembly AVR → 3 inputs)
**Dependencies:** ST parser, S8, Assembly parser, S5, 9

### CI-19 — Fleet Monitoring with GPS and MQTT (C++ ESP32 + Flowchart + ST → 3 inputs)
**Dependencies:** Sec. 7.1, S7, ST parser, S5, 9

### CI-20 — Warehouse AGV (MicroPython + Rust + Blockly + Ladder → 4 inputs)
**Dependencies:** Sec. 7.2, 7.4, S8, Ladder parser, S7, 9

### CI-21 — Maximum Perimeter Security (Flowchart + Blockly + Assembly ARM + ST → 4 inputs)
**Dependencies:** S7, S8, Assembly parser, ST parser, S5, 9
