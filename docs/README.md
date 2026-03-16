successfully downloaded text file (SHA: cd684dbe070105555e0a42562e662087fd03a7e3)
# NeuroForge ASL — Architecture, Status & Roadmap

**Last Updated:** 03/Mar/2026 **Branch:** **`ASL_Integration` Purpose:** This document is the single source of truth for the ASL subsystem's current state and evolution roadmap. The guiding thread is the full integration of the contents of `notyet/` into the core (`src/engine`), eliminating that folder at the end of the process.

📋 **Implementation Standard**: See [docs/IMPLEMENTATION\_STANDARD.md](http://../docs/IMPLEMENTATION_STANDARD.md) for the implementation pattern that ensures parity across all languages.

📊 **Parser Comparison Table**: See [docs/ASL\_PARSER\_COMPARISON.md](http://../docs/ASL_PARSER_COMPARISON.md) for the full verified implementation matrix.

🔌 **Hardware Shim Architecture**: See [docs/ASL\_SHIM\_ARCHITECTURE\_PLAN.md](http://../docs/ASL_SHIM_ARCHITECTURE_PLAN.md) for the complete hardware and protocol virtualization strategy ("The Middle Path").

**Status markers:**

- `[x]` Completed  
- `[~]` In progress / partial  
- `[ ]` Planned  
- `[?]` Under research

---

# Part I — What is ASL?

## 1\. Abstract Simulation Language (ASL)

**ASL** (Abstract Simulation Language) is NeuroForge's **universal Intermediate Representation (IR)**. It is a JSON-based schema that captures the complete semantics of an embedded program — control flow, hardware operations, data structures — in a language-agnostic format.

### 1.1. Why ASL Exists

NeuroForge supports multiple programming languages (C++, MicroPython, Rust, and more in the future) and multiple representation modes (Blockly, Flowchart, Ladder). Without a central IR, every new language or visual editor would require N×M integrations. ASL reduces this to N+M:

            ┌─────┐ ┌────────┐ ┌──────┐ ┌─────────┐ ┌─────────┐
            │ C++ │ │ Python │ │ Rust │ │ Blockly │ │Flowchart│ ...
            └──┬──┘ └───┬────┘ └──┬───┘ └────┬────┘ └────┬────┘
               │        │         │          │           │
        ┌──────▼────────▼────────▼───────────▼───────────▼───────┐
        │                    PARSERS (input)                     │
        │   CParser · PythonParser · RustParser · BlocklyToASL   │
        └──────────────────────────┬─────────────────────────────┘
                                   │
                            ┌──────▼──────┐
                            │ ASLProgram  │  ← The Universal Pivot
                            │   (JSON)    │
                            └──┬──────┬───┘
                               │      │
              ┌────────────────┘      └─────────────────┐
              │                                         │
    ┌─────────▼───────────┐                  ┌──────────▼──────────┐
    │    ASLExecutor      │                  │    GENERATORS       │
    │  (Runtime in JS)    │                  │  C · Python · Rust  │
    │       │             │                  │  Blockly · Flow     │
    │  SimulationEngine   │                  │  (output)           │
    │  GPIO, delay, I2C   │                  └─────────────────────┘
    │  Serial, Shims      │
    └─────────────────────┘

### 1.2. ASL vs AST — Key Distinction

| Concept         | AST (Abstract Syntax Tree)                    | ASL (Abstract Simulation Language)               |
| :-------------- | :-------------------------------------------- | :----------------------------------------------- |
| **Level**       | Syntax-level, language-specific               | Semantic-level, language-agnostic                |
| **Produced by** | Each parser (`CParser`, `PythonParser`, etc.) | `codeToASL()` transformation                     |
| **Format**      | `ProgramNode` with children                   | `ASLProgram { globals, functions, tasks }`       |
| **Purpose**     | Intermediate structure for parsing            | Universal pivot for execution and generation     |
| **Lifespan**    | Temporary — consumed by `codeToASL`           | Persistent — consumed by Executor and Generators |

**Flow:** Source Code → *Parser* → **AST** (`ProgramNode`) → *codeToASL* → **ASL** (`ASLProgram`) → Executor / Generators

### 1.3. The Golden Rule

"Todas as linguagens devem andar de mãos dadas" — All languages must walk hand in hand.

Any new feature or hardware support added to one language (C++, Python, or Rust) must be implemented with semantic parity across all supported languages.

### 1.4. ASLProgram Schema (Summary)

interface ASLProgram {

  metadata: { name?, description?, version?, targetBoard? };

  structs: ASLStructDef\[\];     // struct definitions

  globals: ASLGlobalVar\[\];     // global variables declared outside setup/loop

  functions: ASLFunction\[\];    // setup() \+ user functions

  tasks: ASLTask\[\];            // \[0\] \= mainLoop (derived from loop() / while True)

}

### 1.5. ASL Schema Levels

> **Schema Levels:**
> - **Core:** control flow, expressions, assignments, basic GPIO/delay/print (types defined in `ASLTypes.ts`).
> - **Hardware:** higher-level hardware/protocol abstractions (UART/I2C/SPI, timers IEC, etc.) to be modeled as future extensions in alignment with Section 5.
> - **Language-specific:** surface differences in parsers/generators that still converge to the same ASL Core + Hardware nodes.

### 1.6. Core Statement Kinds (ASL Core Level)

**Core Statements:** `pinMode`, `digitalWrite`, `analogWrite`, `read`, `if`, `while`, `for`, `doWhile`, `switch`, `delay`, `assign`, `setIndex`, `setIndex2D`, `setIndex3D`, `setMember`, `setPointer`, `expr`, `return`, `print`, `break`, `continue`, `comment`.

### 1.7. Core Expression Kinds (ASL Core Level)

**Core Expressions:** `literal`, `var`, `index`, `index2D`, `index3D`, `member`, `unary`, `binary`, `call`, `array`, `object`, `conditional`.

---

# Part II — Current Architecture

## 2\. File Structure (Verified 03/Mar/2026)

```
src/engine/
  SimulationEngine.ts              ✅ Simulation runtime (GPIO, delay, millis, Serial)
  CodeParser.ts                    ⬜ Legacy parser (fallback when ASL doesn't cover something)
  Transpiler.ts                    ✅ Transpilation orchestration
  asl/
    ASLTypes.ts                    ✅ Single source of truth for the ASL schema (Core Level)
    ASLExecutor.ts                 ✅ ASL interpreter/runtime → SimulationEngine
    codeToASL.ts                   ✅ Transpiler: AST → ASLProgram
    LanguageRegistry.ts            ✅ Central registry of supported languages
    TreeSitterLoader.ts            ✅ Lazy loader for web-tree-sitter
    transpile.ts                   ✅ Transpilation helpers
    index.ts                       ✅ Barrel exports
    transforms/                    ✅ codeToASL modules (Handler Registry pattern)
      index.ts                       Barrel exports
      context.ts                     TransformContext interface
      statementRegistry.ts           Handler registry by nodeType (\~30 handlers)
      blockTransform.ts              Orchestrator using registry
      exprTransform.ts               Expression transformation
      callTransform.ts               Function call transformation
      astNormalizer.ts               AST normalization pass
      postfixUtils.ts                Postfix increment/decrement utilities
    helpers/                       ✅ Shared utilities
      index.ts
      arrayUtils.ts                  resolveSize, buildEmptyArray, deepCopyValue
      typeUtils.ts                   mapToASLType for C/C++/Rust surface types → ASL Core types
    plugins/
      core/
        ShimManager.ts             ✅ Shim orchestrator (registration, dependency DAG, injection)
      c/
        CParser.ts                 ✅ Recursive descent parser for C/C++ Arduino subset
        CGenerator.ts              ✅ ASL → C code generator
        shims/
          display/
            liquid\_crystal\_i2c\_shim.ts   ✅
          input/
            keypad\_shim.ts               ✅
          memory/
            eeprom\_shim.ts               ✅
          index.ts                       ✅ Barrel \+ registration
      cpp/
        CppParser.ts               ✅ Full C++ parser
      python/
        PythonParser.ts            ✅ MicroPython/CircuitPython parser via tree-sitter
        PythonGenerator.ts         ✅ ASL → MicroPython/CircuitPython code generator
        shims/
          display/
            liquid\_crystal\_i2c\_shim.ts   ✅
            sevseg\_shim.ts               ✅
          input/
            keypad\_shim.ts               ✅
          memory/
            eeprom\_shim.ts               ✅
          index.ts                       ✅
      rust/
        RustParser.ts              ✅ Rust (HAL/Embassy) parser
        RustGenerator.ts           ✅ ASL → Rust (HAL/Embassy) code generator
        shims/
          display/
            liquid\_crystal\_i2c\_shim.ts   ✅
          input/
            keypad\_shim.ts               ✅
          memory/
            eeprom\_shim.ts               ✅
          index.ts                       ✅
      zig/                         ⬜ Empty — reserved for future Zig parser
      analysis/
        PatternDetector.ts         ✅ Hardware pattern detection (4 detectors)
      optimizer/
        Optimizer.ts               ✅ AST optimization (3 passes)
src/components/
  TopToolbar.tsx                   ✅ Run/Stop/Pause \+ ASL pipeline integration
  CodeEditorWithTabs.tsx           ✅ Multi-tab Monaco editor
  ASLViewer.tsx                    ✅ Debug viewer for generated ASLProgram
notyet/
  README.md                        📋 This file
  app/                             ⬜ Pending integration (flow/, blockly/, simulator/)
---
```

## 3\. Implementation Status (Verified Against Codebase)

### 3.1. Parsers (Source Code → AST)

| Parser                | Language(s)                 | Technology                    | File                             | Status     |
| :-------------------- | :-------------------------- | :---------------------------- | :------------------------------- | :--------- |
| `CParser`             | C / C++ Arduino subset      | Recursive descent             | `plugins/c/CParser.ts`           | ✅ Complete |
| `CppParser`           | Full C++                    | Recursive descent             | `plugins/cpp/CppParser.ts`       | ✅ Complete |
| `PythonParser`        | MicroPython / CircuitPython | tree-sitter \+ regex fallback | `plugins/python/PythonParser.ts` | ✅ Complete |
| `RustParser`          | Rust (Embassy)              | Recursive descent             | `plugins/rust/RustParser.ts`     | ✅ Complete |
| Assembly parser       | AVR / ARM Thumb             | —                             | —                                | ⬜ Planned  |
| ST IEC 61131-3 parser | Structured Text             | —                             | —                                | ⬜ Planned  |
| JS/TS parser          | JavaScript / TypeScript     | —                             | —                                | ⬜ Planned  |

### 3.2. Generators (ASL → Target Code)

| Generator                | Target Language      | File                                | Status     |
| :----------------------- | :------------------- | :---------------------------------- | :--------- |
| `CGenerator`             | C / Arduino C++      | `plugins/c/CGenerator.ts`           | ✅ Complete |
| `PythonGenerator`        | MicroPython / Python | `plugins/python/PythonGenerator.ts` | ✅ Complete |
| `RustGenerator`          | Rust (Embassy)       | `plugins/rust/RustGenerator.ts`     | ✅ Complete |
| C++ generator            | Full C++             | —                                   | ⬜ Planned  |
| CircuitPython generator  | CircuitPython        | —                                   | ⬜ Planned  |
| Assembly generator       | AVR / ARM            | —                                   | ⬜ Planned  |
| ST IEC 61131-3 generator | Structured Text      | —                                   | ⬜ Planned  |
| JS/TS generator          | JavaScript           | —                                   | ⬜ Planned  |

### 3.3. Visual Round-trip (Code ↔ ASL ↔ Visual)

| Path            | Direction        | File              | Status                 |
| :-------------- | :--------------- | :---------------- | :--------------------- |
| Blockly → ASL   | Input parser     | `BlocklyToASL.ts` | ⬜ Planned (Session 8\) |
| ASL → Blockly   | Output generator | `ASLToBlockly.ts` | ⬜ Planned (Session 8\) |
| Flowchart → ASL | Input parser     | `FlowToASL.ts`    | ⬜ Planned (Session 7\) |
| ASL → Flowchart | Output generator | `ASLToFlow.ts`    | ⬜ Planned (Session 7\) |
| Ladder → ASL    | Input parser     | —                 | ⬜ Planned              |
| ASL → Ladder    | Output generator | `ASLToLadder.ts`  | ⬜ Planned              |

### 3.4. Hardware Shims (Virtual Peripherals)

🔌 Full architecture: [ASL\_SHIM\_ARCHITECTURE\_PLAN.md](http://../docs/ASL_SHIM_ARCHITECTURE_PLAN.md)

| Shim                      | Device            | Status               | C    | Python | Rust |
| :------------------------ | :---------------- | :------------------- | :--- | :----- | :--- |
| `liquid_crystal_i2c_shim` | LCD 16×2 / 20×4   | ✅                    | ✅    | ✅      | ✅    |
| `oled_ssd1306_shim`       | OLED SSD1306      | ✅                    | ✅    | ✅      | ✅    |
| `sevseg_shim`             | 7-Segment Display | ✅                    | ⬜    | ✅      | ⬜    |
| `keypad_shim`             | Matrix Keypad 4×4 | ✅                    | ✅    | ✅      | ✅    |
| `buzzer_shim`             | Piezo Buzzer      | ✅                    | ✅    | ✅      | ✅    |
| `eeprom_shim`             | Virtual EEPROM    | ✅                    | ✅    | ✅      | ✅    |
| Wire (I2C)                | I2C bus           | ✅ via `hardwareCall` | ✅    | ✅      | ✅    |
| SPI                       | SPI bus           | ✅ via `hardwareCall` | ✅    | ✅      | ✅    |
| `servo_shim`              | Servo Motor       | ⬜                    | —    | —      | —    |
| `dht_shim`                | DHT11/22          | ⬜                    | —    | —      | —    |
| `ultrasonic_shim`         | HC-SR04           | ⬜                    | —    | —      | —    |

⚠️ Seven Segment (`sevseg_shim`) is only implemented for Python. C and Rust need generator shim injection.

### 3.5. ASLExecutor Builtins (Verified in `ASLExecutor.ts`)

**All implemented:**

| Category                | Builtins                                                                                                   |
| :---------------------- | :--------------------------------------------------------------------------------------------------------- |
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

**Files:** `plugins/analysis/PatternDetector.ts`, `plugins/optimizer/Optimizer.ts`

#### PatternDetector — 4 Detection Methods

| Method               | Pattern                                        | Severity   | Description                                         |
| :------------------- | :--------------------------------------------- | :--------- | :-------------------------------------------------- |
| `detectPwmBitBang`   | GPIO HIGH → delay → GPIO LOW → delay           | ⚠️ WARNING  | Software PWM detected; suggests using `analogWrite` |
| `detectPollingLoop`  | `while(digitalRead(...))` without delay        | 🔴 CRITICAL | Blocking polling loop freezes multitasking          |
| `detectStateMachine` | `if (state == ...)` with state/mode/phase vars | ℹ️ INFO     | FSM pattern detected, useful for flow visualization |
| `detectLongDelays`   | `delay(>500ms)` inside loop                    | ⚠️ WARNING  | Long blocking delay; suggests `millis()` pattern    |

#### Optimizer — 3 Optimization Passes

| Pass | Method              | Description                                                                     |
| :--- | :------------------ | :------------------------------------------------------------------------------ |
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

## 4\. Known Gaps & Limitations

See also: [docs/ASL\_PARSER\_COMPARISON.md](http://../docs/ASL_PARSER_COMPARISON.md)

### 4.1. Missing Language Features

| Priority    | Gap                                          | Status                                      |
| :---------- | :------------------------------------------- | :------------------------------------------ |
| 🟠 Important | Cast `(byte)`, `(uint8_t)`, `(char)`         | \[ \] Only `int`/`float`/`String` handled   |
| 🟡 Medium    | `CommaExpression` — `for(int i=0, j=0; ...)` | \[ \] Falls to `literal 0`                  |
| 🟡 Medium    | `sizeof(type)` without variable              | \[ \] Only variable-based `sizeof` handled  |
| 🟢 Low       | `typedef` / `using` type aliases             | \[ \] Affects `mapToASLType`                |
| 🟢 Low       | `AddressOf` in complex lvalue                | \[ \] Only `&varName` and `&arr[i]` handled |
| 🟢 Low       | String concatenation `"text" + String(val)`  | \[ \] JS `+` coercion may mismatch          |

### 4.2. Incomplete Initialization Helpers

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

### 4.5. Stubbed Executor Behaviours [~]

The following behaviours are implemented in `ASLExecutor.ts` as safe fallbacks or temporary stubs and are scheduled for full integration in future phases:

- [~] **`pulseIn` stub** — `ASLExecutor.evalExpr` emits `engine.emit('hardwareCall', { callee: 'pulseIn', args })` and always returns `500` microseconds as a simulated value. Will be replaced by a proper timing model and integrated with `ultrasonic_shim` and protocol timing when Phase 2 (Protocol Buses) is implemented.

- [~] **`shiftOut` / `shiftIn` stubs** — both functions emit a `hardwareCall` and always return `0`. For `shiftIn` this is only a placeholder; in the future it should return a byte stream from a virtual SPI/I2C device over the corresponding bus shims from Phase 2.

- [~] **`servo` built-in hack** — the `servo` callee currently piggy-backs on the tone system via `ctx.engine.emit('tone', { pin, frequency: 1000, angle })`. This will be replaced by a dedicated `servo_shim` with its own UI widget and state model as part of Phase 1 in the Shim Architecture plan.

- [~] **`Serial.begin` no-op** — `Serial.begin` currently returns `0` and does not modify simulation state. This may remain a documented no-op, or gain a lightweight model of baudrate/connection state in a later phase.

- [~] **Unknown callee default** — when a `call` expression does not match any builtin, shim or user-defined function, the executor currently returns `0`. A future safety phase will turn this into a clear error or warning to avoid masking transformation issues.

- [~] **Out-of-shape index/member access** — invalid array or member accesses in `index/index2D/index3D/member` expressions return `0` instead of throwing. A future validation phase may introduce configurable warnings or errors for these cases.

---

# Part III — Roadmap

## 5\. Integration Sessions

### Session Summary

| Session | Description                  | Status         | Priority |
| :------ | :--------------------------- | :------------- | :------- |
| **S1**  | ASLExecutor Builtins         | ✅ **Complete** | —        |
| **S2**  | CGenerator                   | ✅ **Complete** | —        |
| **S3**  | PythonGenerator              | ✅ **Complete** | —        |
| **S4**  | RustGenerator                | ✅ **Complete** | —        |
| **S5**  | ASLTypes Schema Extensions   | \[\~\] Partial | 🟡 P2     |
| **S6**  | Hardware Shims Extras        | \[\~\] Partial | 🟡 P2     |
| **S7**  | FlowToASL \+ ASLToFlow       | \[ \] Pending  | 🟠 P1     |
| **S8**  | BlocklyToASL \+ ASLToBlockly | \[ \] Pending  | 🟠 P1     |

💡 **Language Parity Achieved**: The system has reached a state where C++, Python, and Rust walk "hand in hand". Any control logic implemented in one of these languages is faithfully represented in ASL and regenerated for the others with semantic parity.

---

### S5 — ASLTypes Schema Extensions \[\~\] Partial

New ASL nodes needed for advanced hardware CIs.

> **Note:** Types, executor handlers, and transform handlers added in March 2026. Parsers still need to emit these nodes.

| \#   | Task                                                               | File                   | Status |
| :--- | :----------------------------------------------------------------- | :--------------------- | :----- |
| S5.1 | `UARTWrite/Read` formal ASL nodes                                  | `ASLTypes.ts`          | ✅      |
| S5.2 | `I2CRead/Write` formal ASL nodes                                   | `ASLTypes.ts`          | ✅      |
| S5.3 | `SPIRead/Write` formal ASL nodes                                   | `ASLTypes.ts`          | ✅      |
| S5.4 | `PWMInit/SetDuty/SetFreq/Stop`                                     | `ASLTypes.ts`          | ✅      |
| S5.5 | `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F` (IEC) | `ASLTypes.ts`          | ✅      |
| S5.6 | Executor handlers for new nodes                                    | `ASLExecutor.ts`       | ✅      |
| S5.7 | Transform handlers for new nodes                                    | `callTransform.ts`     | ✅      |

---

## 6\. Architectural Decisions (ADRs)

### 6.1. ASL Schema

- [x] Core statement/expression types defined in `ASLTypes.ts` (ASL Core Level)  
- [ ] Define schema levels: Core, Hardware, Language-specific  
- [ ] Schema validation: Zod, JSON Schema, or pure TypeScript types  
- [ ] Define the "raw code" policy

... (rest of file unchanged) ...
