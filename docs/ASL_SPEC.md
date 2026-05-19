# ASL (Abstract Simulation Layer) Specification
**Version:** 0.1.0  
**Status:** Draft (Phase B.1)

## 1. Core Philosophy
The Abstract Simulation Layer (ASL) is a universal Intermediate Representation (IR) domain-specific language (DSL). It is explicitly designed to bridge the paradigm gap between **event-driven maker environments** (Arduino C++, MicroPython) and **deterministic, cyclic industrial environments** (IEC 61131-3 Structured Text, Ladder Logic).

ASL is the single source of truth for the DendriForge compiler pipeline.

---

## 2. Document Structure (TOON Logic)
An ASL program is written inside `.toon` files or handled in memory as a structured document. It enforces strict separation of hardware mapping, state memory, and executable logic.

### 2.1 Hardware Interface (`hardware`)
Binds logical execution directly to the physical TOON JSON schema. This acts as a hardware dependency injection map.
```toon
hardware[COUNT|]{pin|type|io_mode|label|target_role}:
  15|digital|output|"Servo Valve"|pwm-out
  19|digital|input|"Manual Button"|int-rising

```

* **Compiler Rule:** Any ASL standard primitive (e.g., `pwmWrite`) invoked in the logic body is statically verified against the declared `target_role` during the AST validation phase.

### 2.2 System Memory (`data` and `state`)

Separates immutable compile-time constants from mutable runtime operational memory.

```toon
data:
  TIME_UNIT: ms
  MAX_TEMP: 300
state:
  current_level: 0
  sys_safety_halt: False

```

* **Type Inference:** ASL enforces strict static typing under the hood. Types are inferred during AST parsing based on the initial literal (`False` -> `bool`, `300` -> `int32`). Implicit coercions (e.g., adding a bool to a float) throw compiler errors.

### 2.3 Industrial Timers (`timers`)

Natively implements IEC 61131-3 standard timers at the IR level.

```toon
timers:
  fill_delay: {type: TON, preset: 2000ms}
  shutdown_warn: {type: TOF, preset: 5000ms, on_done: alarm_trigger()}

```

---

## 3. Routine Syntax & Time Decorators

ASL functions utilize a unique "Time-Decorated" signature `[ms]` that natively embeds the RTOS (Real-Time Operating System) task scheduler or PLC scan-cycle into the AST.

```python
routine_name(args)[interval_ms]:
    statement

```

### 3.1 Execution Contexts

* **`routine()[0]:` (Synchronous / Blocking):** Standard function call. Executes sequentially only when explicitly invoked.
* **`routine()[N]:` (Cyclic / Asynchronous):** The transpiler guarantees this routine evaluates every `N` milliseconds.
* *ST / PLC Target:* Translates to a Cyclic Task assignment in the PLC configuration.
* *Arduino C++ Target:* Translates to a non-blocking `millis()` delta-check inside the main `void loop()`.
* *MicroPython Target:* Translates to an `asyncio.create_task()` running a `while True: await asyncio.sleep_ms(N)` loop.



---

## 4. Control Flow & AST Scoping

ASL adopts Pythonic indentation for scope management, eliminating the parsing ambiguity of C-style curly braces or ST-style `END_IF` closures.

* `if / elif / else`: Standard conditional branching.
* `repeat(N):`: Deterministic, finite bounded loop (Translates to `for(int i=0; i<N; i++)`).
* `while condition:`: Open loop. *Warning:* If transpiling to a strict RTOS/PLC target, the ASL compiler will inject automatic yield/watchdog resets to prevent cycle-time overruns.

---

## 5. ASL Standard Primitives

The AST normalizes common automation instructions. These primitives map to the target language's specific Hardware Abstraction Layer (HAL) shims.

### Digital & Analog I/O

* `digitalWrite(pin_id, HIGH | LOW)`
* `digitalRead(pin_id) -> bool`
* `pwmWrite(pin_id, duty_cycle)`
* `readADC(pin_id) -> int`

### Math & Casting

* Explicit casting is required for mixed-type operations: `int(val)`, `float(val)`.
* Functions: `min(a, b)`, `max(a, b)`, `abs(a)`.

---

## 6. Transpilation Guarantees

1. **Zero Dynamic Allocation:** Transpiled C++ and Rust `no_std` outputs use static allocation. Strings are handled via bounded character arrays to prevent heap fragmentation.
2. **Thread Safety:** `state` variables mutated across different cyclic routines are automatically guarded with atomics or mutexes if the selected target language supports multi-core RTOS.
