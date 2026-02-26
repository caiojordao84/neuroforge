# ROADMAP_TO_ASL

This document describes the evolution of NeuroForge as a simulation and transpilation platform for embedded systems, with ASL (Abstract Simulation Language) as the universal intermediate representation. The guiding thread is the full integration of the contents of `notyet/` into the core (`src/engine`), eliminating that folder at the end of the process.

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

- [x] `CodeEditorWithTabs.tsx`:
    - Manages multiple code tabs and the active language (C++, MicroPython).
    - Exposes current content and metadata (language, board) to `TopToolbar`.

- [x] `LanguageRegistry.ts`:
    - Central language registry: maps labels (`"C++ Arduino"`, `"MicroPython"`) to:
      - extensions / internal IDs,
      - parsing/transpilation function → ASL (e.g.: `CParser` + `codeToASL`, `PythonParser` + `codeToASL`).
    - The single place that decides whether a language supports ASL or falls back to the legacy parser.

- [x] `TopToolbar.tsx`:
    - Run button in JS mode:
      - Gets current code from `CodeEditorWithTabs`.
      - Resolves language via `LanguageRegistry`.
      - Calls the transpilation pipeline → ASL (`codeToASL`).
      - Creates an `ASLRuntime` (`ASLExecutor`) and initializes `SimulationEngine` in JS mode.
    - Fallback: if the language/board does not support ASL, uses the legacy `CodeParser` flow.

- [x] `codeToASL.ts` + `transforms/`:
    - Entry point: `codeToASL()` → `parseToProgramNode()` → `astToASL()`
    - `transforms/blockTransform.ts`: orchestrator that uses `statementRegistry`
    - `transforms/statementRegistry.ts`: Handler Registry pattern
      - Each nodeType (`IfStatement`, `WhileLoop`, `ForLoop`, `VariableDeclaration`, etc.) has its dedicated handler
      - Extensible: new handlers can be added without modifying the core
    - `transforms/exprTransform.ts`: `transformExpr()` for expressions
    - `transforms/callTransform.ts`: `transformCallToStmt()` + `tryTransformRead()`
    - `helpers/arrayUtils.ts`: `resolveSize`, `buildEmptyArray`, `deepCopyValue`
    - `helpers/typeUtils.ts`: `mapToASLType`
    - Converts input AST (`CParser` for C++, `PythonParser` for MicroPython) into `ASLProgram`:
      - Fills globals, functions, and tasks (`setup/loop` → `functions/tasks`, other functions → `ASLFunction`)
      - Converts statements via registry (`if/while/for/return/break/continue`, `pinMode/digitalWrite/delay`, `Serial.print*`, hardware)
      - Converts expressions (arithmetic, logical, calls, pin reads, array indexing)

- [x] `ASLTypes.ts`:
    - Single source of truth for the ASL schema: `ASLProgram`, `ASLStatement`, `ASLExpr`, `ASLFunction`, tasks.

- [x] `ASLExecutor.ts`:
    - Interprets an `ASLProgram`:
      - Maintains global/local variable environment.
      - Executes control flow (`if`, `while`, lowered `for`, `break`, `continue`, `return`).
      - Evaluates expressions (arithmetic, logical, function calls).
      - Bridges to `SimulationEngine` for GPIO, delays, Serial/log, random, `digitalRead/analogRead`, `millis/micros`.

- [x] `SimulationEngine.ts`:
    - Manages the simulation cycle (start/pause/stop, async loop without overlap).
    - Exposes hardware primitives:
      - `pinMode/digitalWrite/analogWrite/digitalRead/analogRead`.
      - `delay(ms)` with `speedMultiplier`.
      - `millis()/micros()` relative to the simulation start.
      - `Serial.begin` / `Serial.print*` / `log`.
    - Notifies UI via events (`pinChange`, `serialTransmit`, `simulationStopped`).

- [x] `ASLViewer.tsx`:
    - Displays the generated ASL for the current code:
      - Structure view (globals, functions, tasks).
      - Useful for debugging and teaching (see exactly what the transpiler understood).

### 0.3. Supported C++ Subset (v0) — Full Detail

#### Statements

**Globals and Locals:**
- [x] Simple global declaration: `int x = 0;` outside setup/loop (becomes `ASLGlobalVar` with numeric literal).
- [x] Simple local declaration: `int i = 0;` in setup/loop (becomes `assign` with literal/constant `HIGH/LOW/true/false/number`).
- [x] Global array declaration: `const int LED_PINS[6] = {3, 4, 5, 6, 7, 8};` (CParser: `isArray`, `arraySizeExpr`, `ArrayInitializer`).
- [x] Local array declaration: `int values[5] = {1, 2, 3, 4, 5};` (CParser: same `parseVarDecl` path).
- [x] #define for array size: `#define SIZE 10` + `int arr[SIZE]` (FASE 1.5).
- [x] PROGMEM arrays: `const int arr[] PROGMEM` (FASE 1.6a/b).
- [~] Local declaration with expression: `int delayTime = 1000 - (i * 100);` (expression parser exists, but not all cases are covered in roadmap/fixtures yet).

**Assignments:**
- [x] Increment/decrement: `i = i + 1;`, `i = i - 1;` (when variable is the same on both sides, generates binary +/-).
- [x] Array subscript postfix: `arr[i]++`, `arr[i]--` (FASE 1.1).
- [x] Array subscript prefix: `++arr[i]`, `--arr[i]` (FASE 1.2).
- [x] Generic simple assignment: `x = expr;` (CParser parses `=` as a binary operator with low precedence and `codeToASL` generates `assign` with arbitrary RHS).
- [x] Array element assignment: `LED_PINS[2] = 10;` (`codeToASL` → `setIndex`; `setIndex2D` for 2D).
- [x] Array compound assignment 2D: `arr[i][j] += val` (FASE 2.1).
- [x] Partial array initialization: `int arr[10] = {1, 2}` fills with zeros (FASE 1.3).
- [x] String literal to char array: `char str[] = "hello"` (FASE 1.4).
- [x] Pointer dereference assignment: `*ptr = val;` (kind: `'setDeref'`, `ASLSetDeref` in `ASLTypes.ts`).
- [x] Dereference compound assignment: `*ptr += val;` (lowered to `setDeref` with binary RHS).

**Hardware operations:**
- [x] `pinMode`: `pinMode(PIN, MODE);` where `MODE` ∈ `{INPUT, OUTPUT, INPUT_PULLUP}`, but PIN only accepts `\\w+`, not indexing.
- [x] `pinMode` with array: `pinMode(LED_PINS[i], OUTPUT);` (CParser generates `SubscriptExpression` → `codeToASL` evaluates as expr).
- [x] `digitalWrite`: `digitalWrite(PIN, HIGH/LOW);` (accepts simple expr as value).
- [x] `digitalWrite` with array: `digitalWrite(LED_PINS[i], HIGH);` (same mechanism).
- [x] `analogWrite`: `analogWrite(PIN, VAL);` (VAL becomes literal or var via `makeVarOrLiteral`).
- [x] `delay`: `delay(1000);` or `delay(delayTime);` (argument treated as simple literal/var).
- [x] Digital read (declaration): `int v = digitalRead(PIN);` (generates `read` statement with `mode: 'DIGITAL'`).
- [x] Digital read (assignment): `v = digitalRead(PIN);` (same `read`, without new declaration).

**Control flow:**
- [x] Single-line `if`: `if (COND) stmt;` (condition goes through expression parser, body becomes 1 statement).
- [x] Simple `if/else`: nested `{ ... }` blocks.
- [x] Cascading `else if`: rewritten as `else { if (...) { ... } }`.
- [x] Normalization: `} else {` and `if (cond)\n{` handled correctly.
- [x] `while`: `while (COND) { ... }` (uses `parseConditionExpr` for the condition).
- [x] Simple `for`: `for (init; cond; inc) { body }` (converted to `init; while (cond) { body; inc; }`).
- [x] `for` with no condition: `for(;;)` (CParser generates literal `'true'` as default condition).
- [x] `switch/case`: `switch(var) { case X: ... break; }` (ASL native support with fall-through).
- [x] Other statements: `return`, `break`, `continue`, custom functions.

#### Expressions in Conditions

- [x] Negation: `!flag` (unary `'!'` with `makeVarOrLiteral(flag)`).
- [x] Equality: `a == b` (binary `'=='` with converted left/right).
- [x] Not equal: `a != b` (binary `'!='`).
- [x] Less than: `i < 10` (binary `'<'`).
- [x] Less than or equal: `i <= max` (binary `'<='`).
- [x] Greater than: `i > 0` (binary `'>'`).
- [x] Greater than or equal: `i >= 0` (binary `'>='`).
- [x] Bare literals/variables: `flag`, `10` (go directly to `makeVarOrLiteral`, interpreted as truthy/falsy).
- [x] Compound logical expressions: `a && b`, `a || b` (CParser uses `parseExpression` with precedence for `&&/||`, executor already evaluates).

#### Expressions on the Right-Hand Side of `=` / Declarations

- [x] Simple literal/constant: `int i = 0;` (becomes numeric/boolean literal or `HIGH/LOW`).
- [x] Simple var: `x = y;`.
- [x] Simple binary: `i = i + 1;`, `i = i - 1;` (increment/decrement when variable is the same on both sides).
- [x] Multiplication: `x = i * 100;` (executor supports `*, +, -, /, %`).
- [x] Compound expression: `int delayTime = 1000 - (i * 100);`.
- [x] Array indexing: `int pin = LED_PINS[i];` (`codeToASL` → `ASLIndex kind:'index'`).
- [x] Array initializer: `int arr[3] = {1, 2, 3};` (CParser: `ArrayInitializer` → `codeToASL` → `initialValue` JS array).
- [x] Partial array init: `int arr[10] = {1, 2}` fills with zeros (FASE 1.3).
- [x] String literal to char array: `char str[] = "hello"` (FASE 1.4).
- [x] sizeof() builtin: `sizeof(arr)`, `sizeof(arr[0])` (FASE 2.4).
- [x] Zero-init: `int arr[5] = {}` or `= {0}` (FASE 2.5).
- [x] Complex expressions: `x = a + b * c / 2;`.

#### Data Types and Structures

- [x] Scalar variables: `int x;`, `float y;`, `bool flag;` (work both as globals and locals with initialization).
- [x] Static arrays: `int pins[6] = {3,4,5,6,7,8};`.
- [x] Index access: `pins[i]`, `pins[2]` (`ASLExecutor`: `case 'index'` in `evalExpr`).
- [x] Type qualifiers: `const`, `volatile`, `static` (FASE 3.1, 3.6, 3.7, 3.8).
- [x] Pointer types: `int *ptr = arr` (FASE 3.3).
- [x] Address-of operator: `&arr[i]` (FASE 3.4).
- [x] Range-based for: `for (auto x : arr)` (FASE 3.15).
- [x] Strings: `char msg[] = "Hello";`.
- [x] 3D array declaration: `int cube[2][3][4];` / with initializer (CParser: `isArray3D`, `arraySize3Expr`).
- [x] 3D access: `arr[d1][d2][d3]` as `ASLExpr` (kind: `'index3D'`) — `ASLIndex3D` in `ASLTypes.ts`.
- [x] 3D assignment: `arr[d1][d2][d3] = val` (kind: `'setIndex3D'`) — `ASLSetIndex3D` in `ASLTypes.ts`.
- [x] `ASLExecutor.ts`: `case 'setIndex3D'` (triple `Array.isArray` guard) + `case 'index3D'`.
- [x] Array of string pointers: `const char* labels[] = {"a","b"}` (FASE 2.8) — `isStringPointerArray` in `statementRegistry`.
- [x] Structs (data only): `struct Point { int x, y; };` (FASE 4) — `ASLStructDef`, inline instances, member access/assignment.
- [x] C++ standard arrays: `std::array<int, 3>` and `std::vector<int>` (lowered to C arrays in ASL).
- [x] Extern variables: `extern int val;` (safely ignored during ASL code generation).
- [x] Designated initializers: `int arr[5] = {[0]=1, [3]=99}` (FASE 4).

#### Arithmetic Operators in the ASL Executor

- [x] `+`: `binary('+', a, b)` — works.
- [x] `-`: `binary('-', a, b)` — works.
- [x] `*`: `binary('*', a, b)` — works.
- [x] `/`: `binary('/', a, b)` — works.
- [x] `%`: `binary('%', a, b)` — works.
- [x] `&&`: `binary('&&', a, b)` — works.
- [x] `||`: `binary('||', a, b)` — works.

#### Bitwise Operators in the ASL Executor

- [x] `&`: `binary('&', a, b)` — bitwise AND (works).
- [x] `|`: `binary('|', a, b)` — bitwise OR (works).
- [x] `^`: `binary('^', a, b)` — bitwise XOR (works).
- [x] `<<`: `binary('<<', a, b)` — left shift (works).
- [x] `>>`: `binary('>>', a, b)` — right shift (works).

### 0.4. Tools in `notyet/` (to integrate)

- [x] `notyet/app/system/Lexer.ts` (integrated into `CParser`)
- [x] `notyet/app/system/SymbolTable.ts` (integrated into `CParser`)
- [ ] `notyet/app/system/flow/CfgBuilder.ts`
- [ ] `notyet/app/system/flow/FlowValidator.ts`
- [ ] `notyet/app/system/flow/FlowToAst.ts`
- [ ] `notyet/app/system/blockly/BlocklyParser.ts`
- [ ] `notyet/app/system/blockly/CodeToBlockly.ts`
- [ ] `notyet/app/system/simulator/SimulatorInterpreter.ts`

### 0.5. Additional Hardware Supported (implemented beyond the basics)

**Displays:**
- [x] LCD: `lcd.print()`, `lcd.setCursor()`, `lcd.clear()` (CParser generates nodeType `LcdPrint/LcdCursor/LcdClear`)
- [x] OLED: `oled.text()`, `oled.show()`, `oled.clear()` (CParser generates nodeType `OledText/OledShow/OledClear`)
- [x] Seven Segment: `sevseg.print()` (CParser generates nodeType `SevSegPrint`)

**Sensors/Input:**
- [x] Keypad: `keypad.getKey()` (CParser generates nodeType `KeypadRead`)

### 0.6. Utility Functions Implemented

**Mathematical and utility functions in `ASLExecutor`:**
- [x] `random(min, max)`: Generates a random number between min and max.
- [x] `random(max)`: Generates a random number between 0 and max-1.
- [x] `map(value, fromMin, fromMax, toMin, toMax)`: Maps a value from one range to another.
- [x] `constrain(value, min, max)`: Clamps a value between min and max.

**Math functions NOT YET implemented (return 0):**
- [ ] `abs(x)` → should use `Math.abs(x)`
- [ ] `sqrt(x)` → should use `Math.sqrt(x)`
- [ ] `pow(base, exp)` → should use `Math.pow(base, exp)`
- [ ] `sin(x)` / `cos(x)` / `tan(x)` → should use `Math.sin/cos/tan`
- [ ] `log(x)` → should use `Math.log(x)`
- [ ] `min(a, b)` / `max(a, b)` → should use `Math.min/max`
- [ ] `round(x)` / `floor(x)` / `ceil(x)` → should use `Math.round/floor/ceil`
- [ ] `isnan(x)` → should use `isNaN(x)`
- [ ] `isinf(x)` → should use `!isFinite(x)`

**Type conversion builtins (in `ASLExecutor`):**
- [x] `int(val)`: truncates to integer (`Math.floor`); also handles pointer-to-int.
- [x] `float(val)`: converts to float (`Number(val)`).
- [x] `String(val)`: converts to string (`String(val)`).

**sizeof builtin — NOT YET IMPLEMENTED:**
- [ ] `sizeof(arr)`: should return `arr.length` (1D) or `arr[0].length` (2D) via `__sizeof` callee.

**Hardware event builtins (generic dispatch):**
- [x] `lcd.print`, `lcd.setCursor`, `lcd.clear`: dispatched via `engine.emit('hardwareCall', ...)`.
- [x] `oled.text`, `oled.show`, `oled.clear`: dispatched via `engine.emit('hardwareCall', ...)`.
- [x] `sevseg.print`: dispatched via `engine.emit('hardwareCall', ...)`.
- [x] `KeypadRead`: dispatched via `engine.emit('hardwareCall', ...)`.
- [x] Any `callee` containing `'.'` or matching hardware names: dispatched as `hardwareCall` event (returns `0`).

**Time functions:**
- [x] `millis()`: Returns milliseconds since simulation start.
- [x] `micros()`: Returns microseconds since simulation start.

**Tone/Buzzer (partial):**
- [x] `tone(pin, freq)`: Generates tone at given frequency (duration not supported yet).
- [x] `noTone(pin)`: Stops tone generation.

### 0.7. Additional Supported Structures

- [x] Enum declarations: `enum Phase { ACCELERATING, DECELERATING, STOPPED };` (CParser + `codeToASL` generate `ASLGlobalVar` with integer values)
- [x] Enum in conditions: `if (phase == STOPPED)` (comparison with enum variable)
- [x] Global variables resolve expressions: `float intervalMin = initialInterval * 0.50;` (executor evaluates binary)

---

## 0.8. Known Gaps in the Current ASL Subset

Gaps identified in the current implementation (branch `Array_Integration`, February 2026).
These are not blockers for the current branch but must be resolved before ASL v1 is considered stable.
Ordered by priority.

### 0.8.1. Missing Statements (ASLTypes.ts + executor + registry)

| Priority   | Gap                             | Description                                                                                                                  |
| ---------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Low      | `switch/case`                   | **[IMPLEMENTED]** Native support in ASL and generators (C, Python, Rust).                                                    |
| 🔴 Critical | `doWhile`                       | `do { ... } while(cond)` — present in AVR/Arduino patterns.                                                                  |
| 🟡 Medium   | `delayMicroseconds`             | `delayMicroseconds(us)` — needed for bit-bang protocols (I2C, SPI manual). Currently falls through to unhandled.             |
| 🟡 Medium   | range-based `for` (C++11)       | `for (auto x : arr)` — ESP32/C++11 mode; CParser partially tracks `FASE 3.15` but executor has no `forRange`.                |
| 🟢 Low      | `typedef` / `using`             | Type aliases — affects `mapToASLType`.                                                                                       |
| 🟢 Low      | `struct` declaration + instance | **[IMPLEMENTED]** `struct Point { int x, y; };` — Supported in Phase 4 (arrays of structs, inline instances, member access). |

### 0.8.2. Missing Expressions (ASLTypes.ts + exprTransform + executor)

| Priority    | Gap                                         | Description                                                                                                       |
| ----------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 🔴 Critical  | `TernaryExpression`                         | **[IMPLEMENTED]** `x = (a > b) ? a : b` — Parsed as `ConditionalExpression` and executed natively in ASLExecutor. |
| 🟠 Important | Cast `(byte)`, `(uint8_t)`, `(char)`        | `CastExpression` only handles `int`/`float`/`String`. All other casts silently return the value as `int`.         |
| 🟠 Important | Negative literal in `evaluateInitializer`   | **[IMPLEMENTED]** `const int OFFSET = -10` — Handled via `UnaryExpression` in `evaluateInitializer`.              |
| 🟠 Important | String literal as global initializer        | **[IMPLEMENTED]** `const char* name = "hello"` — Handled via `StringLiteral` in `evaluateInitializer`.            |
| 🟡 Medium    | `CommaExpression`                           | `for(int i=0, j=0; ...)` — falls to `literal 0`.                                                                  |
| 🟡 Medium    | `sizeof(type)` (without variable)           | `sizeof(int)` as a type-only expression — only variable-based `sizeof` is handled.                                |
| 🟢 Low       | `AddressOf` in complex lvalue               | `&struct.member` — only `&varName` and `&arr[i]` are handled; silently returns wrong pointer.                     |
| 🟢 Low       | String concatenation `"text" + String(val)` | `binary +` on mixed string/number evaluates incorrectly in executor (JS `+` coerces, but types may mismatch).     |

### 0.8.3. Missing Builtins in ASLExecutor (callee dispatch)

These are all currently handled by the generic fallback (`return 0` with no error). Each can be fixed in `ASLExecutor.ts` alone — no schema change needed.

**Math functions (trivial — `Math.*` wrappers) — NOT YET IMPLEMENTED:**
- [ ] `abs(x)` → should use `Math.abs(x)`
- [ ] `sqrt(x)` → should use `Math.sqrt(x)`
- [ ] `pow(base, exp)` → should use `Math.pow(base, exp)`
- [ ] `sin(x)` / `cos(x)` / `tan(x)` → should use `Math.sin/cos/tan`
- [ ] `log(x)` → should use `Math.log(x)`
- [ ] `min(a, b)` / `max(a, b)` → should use `Math.min/max`
- [ ] `round(x)` / `floor(x)` / `ceil(x)` → should use `Math.round/floor/ceil`
- [ ] `isnan(x)` → should use `isNaN(x)`
- [ ] `isinf(x)` → should use `!isFinite(x)`
- [x] `random(max)` (1-arg form) → `Math.floor(Math.random() * max)` — different from existing `random(min, max)`.

**String / C stdlib functions — NOT YET IMPLEMENTED:**
- [ ] `strlen(s)` → should use `String(s).length`
- [ ] `strcmp(a, b)` → should use `a === b ? 0 : 1`
- [ ] `atoi(s)` → should use `parseInt(s)`
- [ ] `atof(s)` → should use `parseFloat(s)`
- [ ] `dtostrf(val, width, prec, buf)` — Arduino AVR float-to-string; simulate with `val.toFixed(prec)`.
- [ ] `sprintf(buf, fmt, ...)` — partial: format string to char array (limited subset).

**Serial extensions:**
- [ ] `Serial.write(b)` → `engine.serialPrint(String.fromCharCode(b))`.
- [ ] `Serial.read()` → read from simulated input queue (returns `-1` if empty).
- [ ] `Serial.available()` → size of simulated input queue.
- [ ] `Serial.parseInt()` → parse int from simulated input queue.

**Hardware libraries (currently `engine.emit('hardwareCall', ...)` returns 0):**
- [ ] `Servo.attach(pin)` / `Servo.write(angle)` / `Servo.read()` → engine servo simulation.
- [ ] `EEPROM.read(addr)` / `EEPROM.write(addr, val)` → simulated EEPROM (Map or array).
- [ ] `Wire.begin()` / `Wire.beginTransmission(addr)` / `Wire.write(b)` / `Wire.endTransmission()` / `Wire.requestFrom(addr, n)` / `Wire.read()` → I2C bus simulation.
- [ ] `SPI.begin()` / `SPI.transfer(b)` → SPI bus simulation.
- [ ] `tone(pin, freq, duration)` — `duration` arg not handled; currently only `tone(pin, freq)` works.
- [ ] `attachInterrupt(pin, fn, mode)` / `detachInterrupt(pin)` → ISR model (Sec. 5).
- [ ] `pulseIn(pin, val)` / `pulseInLong(pin, val)` → pulse width simulation.
- [ ] `shiftOut(pin, clock, order, val)` → bit-bang serial simulation.
- [ ] `pgm_read_byte(addr)` → transparent in simulation (return `globals[addr]`).

### 0.8.4. Incomplete `evaluateInitializer` (codeToASL.ts)

`evaluateInitializer` is used for **compile-time evaluation** of global variable initializers. Gaps:

- [x] `UnaryExpression` with `-` operator: `const int OFFSET = -10` → currently returns `0`. (Implemented)
- [x] String literal (`StringLiteral` node): `const char* name = "hello"` → returns `0` instead of `"hello"`. (Implemented)
- [ ] Array of string literals: `const char* arr[] = {"on","off"}` → partially handled via `isStringPointerArray` in `statementRegistry` but **not** in `evaluateInitializer` (inconsistency for globals).
- [ ] Conditional/ternary initializer: `const int X = (A > B) ? A : B` → returns `0` (acceptable limitation, document as explicit unsupported).

---

## 1. Architectural Decisions (Mandatory ADRs)

Before any integration, these decisions must be made and documented in `docs/architecture/`.

### 1.1. ASL Schema
- [ ] Define schema levels:
  - **Core**: control flow, expressions, variables, functions.
  - **Hardware**: GPIO, PWM, UART, I2C, SPI, industrial timers.
  - **Language-specific**: nodes that have no universal equivalent (controlled escape hatch).
- [ ] Formalize node types currently missing: `For`, `Switch`, `FunctionDef`, `FunctionCall`, `Millis`, `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F`, `PWMInit/SetDuty/SetFreq/Stop`, `UARTWrite/Read`, `I2CRead/Write`.
- [ ] Define the "raw code" policy: allowed only as an explicit escape hatch with validation and warning, never as a silent fallback.
- [ ] Schema validation: Zod, JSON Schema, or pure TypeScript types — all generators emit validated ASL before reaching the executor.

### 1.2. Multi-pass Pipeline
- [ ] Formalize the passes: Parsing → Normalization → Analysis/Verification → Pattern Detection → Light Optimization → ASL Emission.
- [ ] Define whether an intermediate IR exists between the parser and ASL emission, or if emission is direct.
- [ ] Plugin system: plugin API (entry points, lifecycle, inter-plugin communication).

### 1.3. Parser Technology
- [x] Evaluate `web-tree-sitter` for C, C++, Python... (Used for Python/MicroPython).
- [ ] Define where custom parsers are necessary: Assembly, Ada, Forth, Zig.
- [x] Fallback strategy: error with location (line/column) or degradation to legacy parser (implemented in `TopToolbar`).

### 1.4. Executor and Runtime
- [ ] Confirm `ASLExecutor` as the only official runtime for JS simulation.
- [ ] Define the role of `SimulatorInterpreter` (coming from `notyet/`).
- [ ] Ensure `SimulationEngine.reset()` clears all state before each execution.

### 1.5. Round-trip as a Core Product Feature
- [ ] Formalize that ASL is the pivot for all conversions in both directions:
  - Code (any language) → ASL → Visual (Blockly / Flow / Ladder / Industrial).
  - Visual (Blockly / Flow / Ladder / Industrial) → ASL → Code (any language).
- [ ] Define the "information loss" policy for conversions (e.g.: raw code with no block representation becomes a "Custom block"; complex state machine that cannot be structured becomes a warning in the flowchart).

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
      ASLTypes.ts           (single source of truth for the schema)
      ASLExecutor.ts
      index.ts              (barrel exports)
      codeToASL.ts          (entry point ~194 lines)

      transforms/            (AST → ASL transformation)
        index.ts            (barrel exports)
        context.ts          (TransformContext interface)
        statementRegistry.ts (Handler Registry pattern)
        blockTransform.ts   (orchestrator)
        exprTransform.ts    (transformExpr)
        callTransform.ts    (transformCallToStmt + tryTransformRead)

      helpers/               (utility functions)
        index.ts
        arrayUtils.ts       (resolveSize, buildEmptyArray, deepCopyValue)
        typeUtils.ts        (mapToASLType)

      plugins/              (parsers per language)
        c/
          CParser.ts
          CGenerator.ts
        cpp/
          CppParser.ts
        python/
          PythonParser.ts
          PythonGenerator.ts
        rust/
          RustParser.ts
          RustGenerator.ts

      LanguageRegistry.ts   (central language registry)

    tools/
      lexer/
        Lexer.ts
      symbols/
        SymbolTable.ts

      flow/
        CfgBuilder.ts
        FlowValidator.ts
        FlowToASL.ts
        ASLToFlow.ts        (new: ASL → flow graph)
        flow.types.ts

      blockly/
        BlocklyToASL.ts
        ASLToBlockly.ts
        blockly.types.ts

      simulator/
        SimulatorInterpreter.ts
```

> **Note:** The structure above reflects the current implementation after the modularization of `codeToASL.ts` (branch `ASL_Integration_codeToASL_Modular`). The Handler Registry pattern allows adding new statement types without modifying the core of `blockTransform`.

---

## 3. Full Round-trip: Code ↔ ASL ↔ Visual

This is a central product feature. Both directions must be treated as first-class capabilities.

### 3.1. Direction: Code → ASL → Visual
- [ ] Code (C++, Python, JS, Rust, etc.) → ASL via the corresponding transpiler.
- [ ] ASL → Blockly: `ASLToBlockly.ts` converts ASL nodes to a Blockly workspace (XML/JSON).
    - Nodes with no block representation → "Custom code block" with textual content.
    - User functions → "Procedure block".
- [ ] ASL → Flowchart: `ASLToFlow.ts` converts ASL nodes to a React Flow graph.
    - `If` → Decision node with True/False edges.
    - `While/For` → Loop node with back-edge.
    - `FunctionCall` → Process node.
    - Complex state machine → "not visually structurable" warning.
- [ ] ASL → Ladder/Industrial: conversion of hardware nodes (`GpioSet/Read`, timers, counters) to rungs and IEC 61131-3 function blocks.

### 3.2. Direction: Visual → ASL → Code
- [ ] Blockly → ASL: `BlocklyToASL.ts` (coming from `notyet/`) converts workspace to `ASLProgram`.
- [ ] Flowchart → ASL: `FlowToASL.ts` (coming from `notyet/`) via CFG.
- [ ] Ladder/Industrial → ASL: IEC blocks (`TON/TOF/CTU/CTD/SR/RS/TRIG`) → formal ASL nodes.
- [ ] ASL → Code: code generators per target language (see section 9).

### 3.3. Round-trip Policy
- [ ] "Perfect" subset (lossless round-trip): basic control flow (`if/while/for`), GPIO, delay, simple variables.
- [ ] "With warning" subset (loses details, but works): raw code, overly complex expressions, macros.
- [ ] "Unsupported" subset (explicit error): recursion, dynamic allocation, inline assembly.

---

## 4. ASL v1 — Complete Control Flow and Expressions

### 4.1. Control Flow
- [x] Cascading `else if`: lowering to nested `if` in ASL.
- [x] Nested `if` inside then/else blocks.
- [x] `while (cond) { ... }` end-to-end.
- [x] Simple counter `for`: lowering to `init-assign` + `ASLWhile` + increment.
- [x] `break` and `continue` inside loops.
- [x] Simple `switch/case` (native support in ASL and generators).

### 4.2. Expressions
- [x] Relational operators: `<`, `>`, `<=`, `>=`.
- [x] Basic boolean operators in executor: `&&`, `||`.
- [x] Compound logical operators in condition parser: `a && b`, `a || b` as nested AST.
- [x] Simple arithmetic expressions in assign: `i = i + 1`, `i = i - 1`.
- [x] General arithmetic expressions: `x = y + 1`, `x = a * b`, `x = 1000 - (i * 100)` (executor supports `+, -, *, /, %`).
- [x] `%` (modulo) operator in executor.
- [x] Unary operators: `++i`, `--i`, `i++`, `i--`, `*p` (deref), `&v` (addr).

### 4.3. Arrays and Indexing
- [x] Global array declaration: `const int pins[6] = {3,4,5,6,7,8};`.
- [x] Local array declaration: `int values[5] = {1,2,3,4,5};`.
- [x] Index access: `pins[i]`, `pins[2]` as `ASLExpr` (new kind: `'index'`).
- [x] Array element assignment: `pins[2] = 10;` (kind: `'setIndex'`).
- [x] Array representation in executor: `env.set('pins', [3,4,5,6,7,8])`.
- [x] Index evaluation in executor: `evalExpr({kind:'index', array:'pins', index:expr})`.
- [x] 2D array declaration: `int m[3][4];` / `int m[][4] = {{1,2},{3,4}};` (CParser: `isArray2D`, `arraySize2Expr`, `isRow`)
- [x] 2D access: `arr[i][j]` as `ASLExpr` (kind: `'index2D'`) — `ASLIndex2D` in `ASLTypes.ts`
- [x] 2D assignment: `arr[i][j] = val` (kind: `'setIndex2D'`) — `ASLSetIndex2D` in `ASLTypes.ts`
- [x] `ASLExecutor.ts`: `case 'setIndex2D'` (double `Array.isArray` guard) + `case 'index2D'` (fallback 0)
- [x] **Dictionary and Object support**: `ObjectInitializer` node and `ASLObject` expression kind. `ASLExecutor` supports indexing into objects/dictionaries.

> **Detailed checklist of 38 array patterns in progress:**
> [`docs/checklistArrayCppASL.md`](../docs/checklistArrayCppASL.md)

### 4.4. Error Messages
- [ ] Indicate exact line and snippet of unsupported code.
- [ ] Distinguish "subset does not support" from "invalid syntax".

---

## 5. ASL v2 — Functions, Tasks, and Events

- [ ] User functions: `ASLFunctionDef` and `ASLCall`; C++ `void foo()` subset without parameters first, then with scalar parameters.
- [ ] Multiple tasks beyond `mainLoop` with round-robin or period-based scheduling.
- [ ] Simple events (high-level API): "when input changes from LOW→HIGH, execute block X".

---

## 6. Multi-pass Pipeline and Plugin System

### 6.1. Formal Passes
- [ ] Pass 1 — Parsing: per language, produces high-level AST.
- [ ] Pass 2 — Normalization: language-specific AST → common IR (`If`, `While`, `For`, `Block`, `Call`, `Assign`, IO ops).
- [ ] Pass 3 — Analysis and verification: basic types, invalid usages, pedagogical warnings.
- [ ] Pass 4 — Hardware pattern detection:
    - PWM bit-banging (GPIO toggle + delays).
    - Polling pattern (while + read).
    - State machine pattern (switch in loop).
    - Busy-wait delays (empty loops).
- [ ] Pass 5 — Light optimization: constant folding, dead code removal, trivial condition simplification.
- [ ] Pass 6 — ASL emission: common IR → `ASLProgram`.

### 6.2. Plugin System
- [ ] Plugin API with entry points defined per pass.
- [ ] Plugin loader and registry.
- [ ] Lifecycle: load, execute, unload.
- [ ] Shared context between plugins (symbol table, hardware metadata).

---

## 7. Input Languages → ASL

### 7.1. C / Arduino C++
- [x] Basic subset v0 (see section 0.3 for full detail).
- [x] Support for pure `'c'` language in `codeToASL.ts`.
- [x] Full control flow (v1): `while` and simple `for` work; `break` and `continue` implemented.
- [x] `switch/case`: implemented natively in ASL and `CGenerator`.
- [x] General expressions on RHS of assignments.
- [x] Arrays and indexing — basic 1D and 2D subset implemented.
- [~] Additional APIs: `analogRead`, `millis`, `micros`, `Serial.print` already supported in `ASLExecutor/SimulationEngine`; `tone` still without dedicated simulation.
- [ ] Parser via Tree-sitter C/C++.

### 7.2. MicroPython / CircuitPython
- [x] Execution via ASL (MicroPython/CircuitPython/Python).
- [x] Python support: `Pin`, `value()`, `on()`, `off()`, `time.sleep_ms()`, `if/else`, `while True`.
- [x] Parser via Tree-sitter Python (`web-tree-sitter`) + inductions-aware Regex Fallback.
- [x] Advanced loops: `for i, x in enumerate(items)`, `for x in reversed(items)`.
- [x] Collections: `list`, `list_comprehension`, and dictionary support (`{key: value}`).
- [x] String methods: `.format()` support.
- [x] MicroPython specific: `Pin.id()`, `Pin.on()`, `Pin.off()`, `Pin.value()`.

### 7.3. JavaScript / TypeScript
- [ ] Subset with `setup()/loop()`, IO ops, `if/else`, `while`, `for`.
- [ ] Parser via Tree-sitter JS/TS.

### 7.4. Rust (embedded subset)
- [ ] Subset `fn setup()`, `fn loop()`, scalar types.
- [ ] NeuroForge macros/wrappers as a predictable interface.
- [ ] Parser via Tree-sitter Rust.
- [ ] `RustParser.ts`: Embassy `async/await` serialized to ASL cooperative loop.
- [ ] Serialization of Embassy tasks (`join!`, `select!`) to multiple `ASLTask`.

### 7.5. Zig

**Installation and toolchain:**
- [ ] Document Zig compiler installation (official binary, no extra dependencies).
- [ ] Check if `web-tree-sitter` has a Zig grammar available; if not, develop a minimal grammar for the subset.
- [ ] Define NeuroForge IO wrappers for Zig (e.g.: `neuroforge.digitalWrite`, `neuroforge.delay`).

**Parser and generator:**
- [ ] Parser for subset `pub fn setup()`, `pub fn loop()`, basic types (`u8`, `i32`, `bool`), `if/while/for`.
- [ ] `zigToASL.ts`: subset → ASL.
- [ ] `ASLToZig.ts`: ASL → valid Zig code.
- [ ] Test fixtures: blink, button, PWM, `if/else`, loops.

### 7.6. Ada

**Installation and toolchain:**
- [ ] Document GNAT installation (FSF GNAT via apt/brew, or GNAT Community Edition).
- [ ] Define whether the compiler is needed only for validation (generate + compile to check) or if the subset runs only via ASL.
- [ ] Evaluate Ada grammar for Tree-sitter; if unavailable or incomplete, develop a custom parser for the subset.
- [ ] Define NeuroForge IO wrappers for Ada (`procedure DigitalWrite`, `function DigitalRead`, etc.).

**Parser and generator:**
- [ ] Parser for subset: `procedure Setup`, `procedure Loop`, `if/elsif/else`, `while`, `case`.
- [ ] `adaToASL.ts`: subset → ASL.
- [ ] `ASLToAda.ts`: ASL → valid Ada code (compilable with GNAT).
- [ ] Test fixtures: blink, button, PWM, `if/else`, loops.

### 7.7. Forth

**Installation and toolchain:**
- [ ] Document a reference Forth installation (e.g.: Gforth via apt/brew) for validation.
- [ ] Define a NeuroForge vocabulary for Forth: words such as `PINOUTPUT`, `PININPUT`, `DIGITAL-WRITE`, `DIGITAL-READ`, `ANALOG-WRITE`, `DELAY-MS`.
- [ ] Define setup and loop delimiters in the vocabulary (e.g.: `: SETUP ... ;` and `: LOOP ... ;`).

**Parser and generator:**
- [ ] Develop custom parser for the subset (stack-based, word tokenization).
- [ ] `forthToASL.ts`: word sequences → linear IR + control flow → ASL.
- [ ] `ASLToForth.ts`: ASL → valid Forth word sequences.
- [ ] Test fixtures: blink, button, delay, `if/else` equivalent (`IF ... ELSE ... THEN`).

### 7.8. Assembly (didactic subset)

**Installation and toolchain:**
- [ ] Define the initial target architecture (AVR 8-bit or ARM Cortex-M).
- [ ] Document the reference assembler installation (e.g.: `avr-as` for AVR, `arm-none-eabi-as` for ARM).
- [ ] Define the instruction subset mappable to ASL operations:
    - AVR: `OUT PORTB, Rn` → `GpioSet`, `IN Rn, PINB` → `GpioRead`, `RCALL delay` → `DelayMs`.
    - ARM: GPIO equivalents via MMIO.

**Parser and generator:**
- [ ] Develop custom parser for the defined instruction subset.
- [ ] `assemblyToASL.ts`: pseudo-instructions → ASL (without assembling real binary).
- [ ] `ASLToAssembly.ts`: ASL → annotated pseudo-assembly (didactic purpose).
- [ ] Test fixtures: blink and pin read in assembly subset.

### 7.9. Lua / NodeMCU
- [ ] Subset with functions and IO calls.
- [ ] Parser via Tree-sitter Lua.
- [ ] `luaToASL.ts` and `ASLToLua.ts`.

---

## 8. Visual Inputs → ASL

### 8.1. Flowchart
- [ ] Migrate `CfgBuilder`, `FlowValidator`, `FlowToASL` to `src/engine/tools/flow/`.
- [ ] `FlowToASL` imports types from `src/engine/asl/ASLTypes.ts`.
- [ ] Explicit generation strategy: structured vs. state machine.
- [ ] Industrial blocks as formal ASL nodes: `TimerTON/TOF/TP`, `CounterCTU/CTD`, `LatchSR/RS`, `TrigR/F`, math ops.
- [ ] Industrial templates: `TON`, `TOF`, `CTU`, `CTD`, `SR`, `RS`, `R_TRIG`, `F_TRIG`, state machine diagram, basic GRAFCET.
- [ ] IEC 61131-3 Structured Text (ST) as an additional text language (close to Pascal/PLC).
- [ ] `ASLToFlow.ts`: ASL → React Flow graph (`If` → Decision node, `While` → Loop node, `FunctionCall` → Process node).
- [ ] FSM pattern: state machine of ASL nodes → visual representation of states and transitions.

### 8.2. Blockly
- [ ] Migrate `BlocklyParser` → `BlocklyToASL` and `CodeToBlockly` → `ASLToBlockly` to `src/engine/tools/blockly/`.
- [ ] Custom block library:
    - GPIO: set, read, toggle, config.
    - Timing: delay ms, delay us, millis, micros.
    - PWM: init, set duty, set frequency, stop.
    - Communication: UART, I2C, SPI (basic level).
    - Control flow: `if/else`, `while`, `for` (integration with standard Blockly blocks).
    - Sensor blocks: temperature, humidity, distance, etc.
- [ ] Block definitions: appearance, fields, type validation, tooltips.
- [ ] Live code preview: blocks → code in real time (simultaneous multi-language).
- [ ] Project templates: blink, button+LED, servo, I2C sensor, state machine.

### 8.3. Ladder Logic (LD) and IEC 61131-3
- [ ] Contacts (NO/NC), coils, simple parallel branches → ASL.
- [ ] Each ladder scan → loop cycle in ASL.
- [ ] `STParser.ts`: Structured Text IEC 61131-3 (`IF/THEN/ELSE`, `FOR`, `WHILE`, `CASE`, `TON`, `TOF`, `CTU`, FB) → ASL.
- [ ] `ASLToLadder.ts`: ASL → Ladder Diagram (rungs, contacts, coils, function blocks).
- [ ] Expansion to Function Block Diagram (FBD) and Sequential Function Chart (SFC).

---

## 9. Code Generators: ASL → Target Language

All code generators below receive a valid `ASLProgram` and emit compilable/executable code in the target language.

- [ ] ASL → C / Arduino C++.
- [ ] ASL → Python / MicroPython.
- [ ] ASL → JavaScript / TypeScript.
- [ ] ASL → Rust.
- [ ] ASL → Zig (after toolchain is defined).
- [ ] ASL → Ada (after toolchain is defined, output compilable with GNAT).
- [ ] ASL → Forth (NeuroForge vocabulary).
- [ ] ASL → Assembly subset (didactic, with explanatory comments).
- [ ] ASL → Lua.
- [ ] ASL → Structured Text IEC 61131-3.
- [ ] ASL → CircuitPython.

For each generator:
- [ ] Equivalence fixtures: same logical behavior across languages.
- [ ] Source maps: ASL line → target line.
- [ ] Comment preservation.
- [ ] Reverse mapping: target line → ASL line.

---

## 10. Bidirectional Transpilation (ASL as Pivot)

### 10.1. Priority Pairs (text ↔ text)
- [ ] C ↔ Python.
- [ ] C ↔ C++.
- [ ] C ↔ Rust.
- [ ] Python ↔ C++.

### 10.2. Source Maps and Debugging
- [ ] Source map generation: source line → target line.
- [ ] Comment preservation.
- [ ] Debug metadata in ASL.
- [ ] Reverse mapping: target line → source line.

---

## 11. Optimizations and Analysis

### 11.1. Hardware Optimizations
- [ ] PWM Optimizer: detect bit-banging (GPIO toggle + delay) and convert to hardware PWM.
- [ ] UART Optimizer: group consecutive sends.
- [ ] GPIO Batcher: multiple consecutive sets → single operation.
- [ ] Delay Optimizer: busy-wait (empty loops) → timer.

### 11.2. Safety / Validation
- [ ] GPIO Validator: pin conflicts, invalid configurations.
- [ ] Memory Checker: stack overflow estimation.
- [ ] Timing Analyzer: critical sections and timing violations.

---

## 12. Foundation Tooling

- [ ] `Lexer.ts` integrated into `src/engine/tools/lexer/`, used in at least one pipeline.
- [ ] `SymbolTable.ts` integrated into `src/engine/tools/symbols/`, connected to Pass 3 (type and scope analysis).
- [ ] `SimulatorInterpreter.ts` integrated with a formally defined role (debug/compat vs. alternative executor).
- [x] `LanguageRegistry.ts` integrated into `src/engine/asl/`, centralizing labels, extensions, and ASL support.
- [x] Verbose log cleanup in Serial Monitor (focus on user output).

---

## 13. UX, Documentation, and Teaching Mode

### 13.1. Code Best Practices
- [ ] Difference between `if` with and without `else` in outputs.
- [ ] Safe loop patterns.
- [ ] Language / input mode selection guide.

### 13.2. Teaching Mode
- [ ] Visual highlight of the code/block/node being executed.
- [ ] Inline pedagogical messages (`if` without `else`, loop without delay, bit-bang detected).

---

## 14. Merge Strategy for Main

- [ ] Feature flag "ASL experimental": active in dev/beta, disableable in advanced config.
- [ ] Migrate simple C++ to always go through ASL (disable legacy `CodeParser` after gaining confidence).
- [ ] Keep fallback for complex patterns until ASL v1/v2 mature.

**Criteria for final merge:**
- [ ] ASL v1 stable for common C++ Arduino.
- [ ] At least one visual language integrated with round-trip (Blockly or Flow).
- [ ] `notyet/` zeroed: no core imports point to the folder.
- [ ] Basic documentation published: introductory manual, best practices, ASL schema.
- [ ] Test suite covering all integrated inputs.
- [ ] All 21 Integration Test Cases from Sec. 16 passing.

---

## 15. Final Deliverables

- [ ] ASL with complete and validated schema (Core + Hardware + Language-specific).
- [ ] 9+ input languages (C++, Python, JS, Rust, Zig, Ada, Forth, Assembly subset, Lua).
- [ ] Code generators for all supported languages.
- [ ] Full round-trip: Code ↔ ASL ↔ Visual (Blockly / Flow / Ladder).
- [ ] Blockly integrated with 20+ blocks and ASL ↔ blocks round-trip.
- [ ] Flow/Ladder integrated with formal industrial blocks (`TON`, `TOF`, `CTU`, `CTD`, `SR`, `RS`, `R_TRIG`, `F_TRIG`).
- [ ] Multi-pass pipeline with plugin system.
- [ ] Source maps and debugging for all languages.
- [ ] Hardware optimizations (PWM, UART, GPIO, delay).
- [ ] Documented toolchains for Zig, Ada, Forth, and Assembly.
- [ ] `notyet/` = zero.
- [ ] 1000+ validated test cases.
- [ ] Complete documentation: ASL schema, language guide, toolchains, best practices, teaching mode.
- [ ] All 21 Integration Test Cases (CI-1 to CI-21) from Sec. 16 passing.

---

## 16. Integration Test Cases (CI-1 to CI-21)

> **IMPORTANT:** These are not unit tests for an isolated feature.
> They are system integration tests: each CI validates that multiple sections
> of the roadmap are complete **and communicate correctly with each other**.
>
> A CI can only be run when **all** its dependencies
> are marked as `[x]` in the corresponding sections.
>
> These 21 cases are the formal acceptance criteria for the merge to `main`.
> See also: `docs/AI_ASSISTANT_CONTEXT_ASL.md` for a detailed description of each case.

---

### CI-1 — Tank Level (MicroPython → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — Complete MicroPython/CircuitPython parser (`machine.Pin`, `analogRead`, `time`)
- [ ] Sec. 4.3 — Arrays and indexing in ASL (multiple sensors/zones)
- [ ] Sec. 1.1 — ASL nodes: `UARTWrite/Read`, `I2CRead/Write` (sensor protocols)
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** level thresholds and pump activation logic identical across all outputs.

---

### CI-2 — Home Lighting (Flowchart → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 8.1 — Complete `FlowToASL.ts` (migrated from `notyet/`)
- [ ] Sec. 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 8.1 — FSM pattern: state machine in flowchart → ASL
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)
- [ ] Sec. 3.3 — Round-trip policy: "perfect" subset defined

**Validation:** zone logic and state transitions preserved across all outputs.

---

### CI-3 — Greenhouse Temperature PID (MicroPython → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — MicroPython parser: DHT22, `analogRead`, `analogWrite` (fan, heating resistor)
- [ ] Sec. 4.2 — General arithmetic expressions (PID error calculation: `e = setpoint - temp`)
- [ ] Sec. 1.1 — ASL nodes: `I2CRead/Write` (DHT22 sensor), `PWMInit/SetDuty` (fan)
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** PID coefficients and actuator logic preserved; numerical equivalence of error calculation.

---

### CI-4 — Industrial Conveyor Belt (Ladder → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 8.3 — `LadderToASL`: NO/NC contacts, coils, parallel branches
- [ ] Sec. 8.3 — `STParser.ts`: ST IEC 61131-3 → ASL
- [ ] Sec. 8.1 — Industrial blocks as ASL nodes: `TimerTON/TOF`, emergency logic
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.2 + 8.1 — `FlowToASL` + `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.3 — Policy: NC (normally-closed) contacts correctly inverted

**Validation:** emergency logic (normally-closed) correctly inverted across all outputs.

---

### CI-5 — Automatic Gate FSM (ST IEC 61131-3 → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 8.3 — `STParser.ts`: `IF/THEN/ELSE`, `CASE`, `TON`, encoder, PWM
- [ ] Sec. 4.1 — `switch/case` in ASL (lowering of `CASE OF`)
- [ ] Sec. 8.1 — FSM pattern: open/closed/moving/obstacle states → ASL
- [ ] Sec. 1.1 — ASL nodes: `PWMInit/SetDuty/Stop` (DC motor), encoder input
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, Assembly
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** gate state FSM preserved across all outputs.

---

### CI-6 — Zone-based Automatic Irrigation (Blockly → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts` (migrated from `notyet/`)
- [ ] Sec. 8.2 — Block library: humidity sensor, solenoid valves, timing/schedule
- [ ] Sec. 8.1 — Industrial blocks: `TON/TOF` timers (time schedule)
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)
- [ ] Sec. 3.3 — Round-trip policy defined

**Validation:** schedule logic and humidity thresholds preserved; zones do not overlap.

---

### CI-7 — Indoor Air Quality (C++ Arduino → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.1 — Complete `CParser`: arrays, compound expressions, CO₂/DHT22 APIs
- [ ] Sec. 1.1 — ASL nodes: `I2CRead/Write` (OLED/CO₂), `UARTWrite` (SD log), tone/buzz
- [ ] Sec. 9 — Generators: C, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)
- [ ] Sec. 3.3 — Policy: display/SD APIs mapped to generic ASL builtins

**Validation:** CO₂/temperature/humidity thresholds and alert logic preserved.

---

### CI-8 — Solar Energy Management (Flowchart → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 8.1 — Complete `FlowToASL.ts`
- [ ] Sec. 8.1 — FSM pattern: voltage hysteresis logic as state machine
- [ ] Sec. 4.2 — General arithmetic expressions (hysteresis calculation: min/max voltage)
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)
- [ ] Sec. 3.3 — Policy: load priority preserved

**Validation:** voltage hysteresis logic preserved; load priority maintained across all outputs.

---

### CI-9 — RFID Access Control (Rust Embassy → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.4 — `RustParser.ts`: Embassy `async/await`, GPIO, UART, SPI (RFID)
- [ ] Sec. 7.4 — Embassy `async/await` serialization → ASL cooperative loop
- [ ] Sec. 1.1 — ASL nodes: `UARTWrite/Read` (log), `SPIRead/Write` (RFID), `PWMSetDuty` (servo)
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** authorization logic (valid UID + PIN) preserved; `async/await` correctly serialized.

---

### CI-10 — Industrial 7-Segment Timer (Assembly AVR/ARM → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.8 — `AsmParser.ts` AVR: subset `OUT PORTB`, `IN PINB`, `RCALL delay`, timer ISR
- [ ] Sec. 7.8 — `AsmParser.ts` ARM Thumb: GPIO equivalents via MMIO
- [ ] Sec. 4.3 — Arrays in ASL (display multiplexing: segment array)
- [ ] Sec. 8.1 — Industrial blocks: `TON` timer (preset timing)
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** multiplexing logic and preset preserved; timing without drift.

---

### CI-11 — HX711 Weighing with Modbus RTU (CircuitPython → multi-output)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — CircuitPython parser: HX711 (SPI), LCD (I2C), RS-485 (UART)
- [ ] Sec. 4.2 — Float/REAL precision: calibration formula (`weight = (raw - tare) / scale`)
- [ ] Sec. 1.1 — ASL nodes: `UARTWrite/Read` for Modbus RTU; `SPIRead` for HX711
- [ ] Sec. 9 — Generators: C, C++, MicroPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (Flowchart round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (Blockly round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (Ladder round-trip)

**Validation:** calibration formula and Modbus registers preserved; float precision maintained.

---

### CI-12 — Multi-tank SCADA ESP32 (MicroPython + Blockly + Flowchart → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — Complete MicroPython parser (WiFi WebServer, `analogRead` on multiple pins)
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts`
- [ ] Sec. 8.1 — Complete `FlowToASL.ts`
- [ ] Sec. 4.3 — Arrays in ASL (up to 8 tanks: sensor and state arrays)
- [ ] Sec. 1.1 — ASL nodes: `UARTWrite/Read`, `I2CRead/Write`, network protocols
- [ ] Sec. 1.5 — Multi-input pipeline: 3 simultaneous inputs → semantic equivalence check
- [ ] Sec. 3.3 — Cross-parsing: Blockly ↔ Flowchart ↔ Ladder (consistency)
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** the 3 inputs produce semantically equivalent `ASLProgram`s; polling logic identical across all outputs.

---

### CI-13 — Pressure Pump with Hysteresis (C++ + Ladder + Flowchart → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.1 — Complete `CParser`: `analogRead` 4–20 mA, soft start (PWM ramp)
- [ ] Sec. 8.3 — Complete `LadderToASL`
- [ ] Sec. 8.1 — Complete `FlowToASL`
- [ ] Sec. 4.2 — General arithmetic expressions (hysteresis: `if p > pMax || p < pMin`)
- [ ] Sec. 1.5 — Multi-input pipeline: 3 simultaneous inputs → semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Blockly ↔ Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: MicroPython, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** hysteresis logic (start and stop thresholds) preserved across all representations.

---

### CI-14 — Multi-zone HVAC (MicroPython + ST + Blockly → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — MicroPython parser: multiple DHT22s, I2C bus
- [ ] Sec. 8.3 — `STParser.ts`: `IF/THEN`, `FOR`, `TON`, per-zone setpoints
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts`
- [ ] Sec. 5 — Multiple tasks (one per zone) with round-robin scheduling
- [ ] Sec. 8.1 — Industrial blocks: `TON/TOF` (weekly schedule)
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Rust, Assembly
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** setpoints and schedule identical across the 3 inputs and all outputs; multi-zone logic consistent.

---

### CI-15 — BLDC Motor with Encoder and PID (Rust + Flowchart + Assembly ARM → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.4 — `RustParser.ts`: Embassy async, ADC (overcurrent), encoder (interrupt)
- [ ] Sec. 8.1 — Complete `FlowToASL.ts`
- [ ] Sec. 7.8 — `AsmParser.ts` ARM Thumb: encoder ISR, ADC read, PWM
- [ ] Sec. 4.2 — General arithmetic expressions (speed PID loop)
- [ ] Sec. 5 — ISR serialized to ASL task: encoder interrupt → ASL event
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Blockly ↔ Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** ISR and control loop semantically equivalent; interrupt correctly serialized in visual representations.

---

### CI-16 — Smart Traffic Light FSM (CircuitPython + Blockly + Ladder → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — CircuitPython parser: IR sensor, digital outputs (traffic light)
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts`
- [ ] Sec. 8.3 — Complete `LadderToASL`
- [ ] Sec. 8.1 — FSM pattern: red/yellow/green/night states → ASL
- [ ] Sec. 4.1 — `switch/case` in ASL (FSM state transitions)
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, MicroPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** FSM correctly represented across all outputs; night/manual mode transitions tested.

---

### CI-17 — Pasteurization with Chained Timers (MicroPython + Flowchart + Ladder → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — MicroPython parser: DHT22, EEPROM (I2C), alarm relay
- [ ] Sec. 8.1 — Complete `FlowToASL.ts`
- [ ] Sec. 8.3 — Complete `LadderToASL`
- [ ] Sec. 8.1 — Industrial blocks: chained `TON/TOF` timers (ramp-up → hold → cool-down)
- [ ] Sec. 1.1 — ASL nodes: `I2CWrite` (EEPROM batch log)
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Blockly ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Rust, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** timed sequences (chained timers) preserved; temperature profile identical across all outputs.

---

### CI-18 — Pool Control with Modbus TCP (ST + Blockly + Assembly AVR → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 8.3 — `STParser.ts`: `REAL/float`, peristaltic FB, Modbus TCP
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts`
- [ ] Sec. 7.8 — `AsmParser.ts` AVR: ADC for analog pH/chlorine sensor
- [ ] Sec. 4.2 — `REAL/float` numerical precision: chemical dosing
- [ ] Sec. 1.1 — ASL nodes: Modbus TCP as formal ASL protocol/builtin
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** float precision and Modbus registers preserved; dosage correctly calculated across all outputs.

---

### CI-19 — Fleet Monitoring with GPS and MQTT (C++ ESP32 + Flowchart + ST → multi-output, 3 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.1 — Complete `CParser`: UART (GPS NMEA), I2C (MPU-6050), LTE/MQTT
- [ ] Sec. 8.1 — Complete `FlowToASL.ts`
- [ ] Sec. 8.3 — Complete `STParser.ts`
- [ ] Sec. 5 — ISR + concurrent tasks: accelerometer interrupt + GPS polling → ASL serialization
- [ ] Sec. 1.1 — ASL nodes: `UARTRead` (GPS), `I2CRead` (MPU-6050), MQTT/LTE protocols
- [ ] Sec. 1.5 — Multi-input pipeline: 3 inputs + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Blockly ↔ Flowchart
- [ ] Sec. 9 — Generators: MicroPython, CircuitPython, Rust, Assembly
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts`
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`

**Validation:** async logic correctly serialized; driving events detected identically.

---

### CI-20 — Warehouse AGV (MicroPython + Rust + Blockly + Ladder → multi-output, 4 inputs)

**Mandatory dependencies:**
- [ ] Sec. 7.2 — MicroPython parser: line sensors, battery voltage ADC
- [ ] Sec. 7.4 — `RustParser.ts` Embassy: differential control (2 motors), PWM
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts`
- [ ] Sec. 8.3 — Complete `LadderToASL`
- [ ] Sec. 8.1 — FSM pattern: navigation + charging states → ASL
- [ ] Sec. 1.5 — Multi-input pipeline: **4 simultaneous inputs** + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: Flowchart ↔ Ladder
- [ ] Sec. 9 — Generators: C, C++, CircuitPython, Assembly, ST IEC 61131-3
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts`
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts`

**Validation:** largest test case with 4 inputs — semantic equivalence across all inputs and outputs; navigation and charging logic preserved.

---

### CI-21 — Maximum Perimeter Security (Flowchart + Blockly + Assembly ARM + ST → multi-output, 4 inputs)

**Mandatory dependencies:**
- [ ] Sec. 8.1 — Complete `FlowToASL.ts` + `ASLToFlow.ts`
- [ ] Sec. 8.2 — Complete `BlocklyToASL.ts` + `ASLToBlockly.ts`
- [ ] Sec. 7.8 — `AsmParser.ts` ARM Thumb: multiple PIRs (GPIO interrupt), ADC, UART
- [ ] Sec. 8.3 — Complete `STParser.ts` + `ASLToLadder.ts`
- [ ] Sec. 5 — ISR: multiple PIRs as ASL events; OpenMV camera as independent task
- [ ] Sec. 1.1 — ASL nodes: MQTT publish (notification), `I2CWrite` (SD log), `UARTRead` (OpenMV)
- [ ] Sec. 1.5 — Multi-input pipeline: **4 simultaneous inputs** + semantic equivalence
- [ ] Sec. 3.3 — Cross-parsing: **all** visual formats (Flowchart ↔ Blockly ↔ Ladder)
- [ ] Sec. 9 — Generators: C, C++, MicroPython, CircuitPython, Rust
- [ ] Sec. 3.1 + 8.1 — `ASLToFlow.ts` (full round-trip)
- [ ] Sec. 3.1 + 8.2 — `ASLToBlockly.ts` (full round-trip)
- [ ] Sec. 3.1 + 8.3 — `ASLToLadder.ts` (full round-trip)

**Validation:** maximum test case — async event logic, concurrency, and data persistence semantically equivalent across all inputs and outputs.

---

> **Coverage summary (analysis 21/02/2026):**
> - All 21 CIs are currently **blocked**.
> - The 4 blocker categories in order of impact:
>   1. **Generators** (Sec. 9): ASL → C, C++, Rust, Assembly, ST, MicroPython, CircuitPython — affecting 16–19 CIs each.
>   2. **Visual round-trip** (Sec. 3+8): Ladder (19 CIs), Flowchart (18 CIs), Blockly (16 CIs).
>   3. **ASL Features** (Sec. 1.1, 1.5, 3.3, 4.x, 5): cross-parse, protocols, multi-input, FSM, ISR/async, arrays, IEC timers.
>   4. **Input parsers** (Sec. 7.4, 7.8, 8.x): Rust, Assembly AVR/ARM, ST, Blockly, Flowchart, Ladder.
> - 28 unique gaps identified. The roadmap covers all of them — execution is what remains.
