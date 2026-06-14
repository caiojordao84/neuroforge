# ASL Program Profile — Unified Dialect Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24) + domain extensions for ASL program logic
**File:** `asl-program-profile.rules`
**Scope:** ALL ASL program documents (`.toon` files containing behavioral logic)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

> This file defines the rules for ASL (Agentic Scripting Language) program files.
> ASL programs describe hardware configuration, variable declarations, initialization,
> main loop logic, and procedural functions for embedded/microcontroller targets.

---

## Inherited Rules

The following sections from `toon-dialect-core.rules` apply unchanged to all ASL program files:

| Section | Topic |
|---------|-------|
| §1 | Whitespace & Indentation (2-space, no tabs) |
| §2 | Comments (`#` annotations, no inline comments) |
| §3 | Section Headings (`## N. UPPERCASE NAME:`) |
| §4 | Keys & Key Folding |
| §6 | Nested Object Blocks |
| §7 | Inline Record Delimiter (` \| `) |
| §8 | Collections with Size Annotation `name[n]` |
| §9 | Tabular Arrays (pipe delimiter, no surrounding spaces) |
| §10 | List Arrays (`- ` prefix) |
| §11 | Sub-Value Separator (`;` no surrounding spaces) |
| §12 | Quoting and Escaping |
| §13 | Metadata Block |
| §15 | Document-Level Rules (UTF-8 no BOM, `.toon` extension) |

---

## §5 — Scalar Value Types (Program Domain)

Core scalar rules (integer, float, bool, null, hex, string, quoting triggers) are inherited from `toon-dialect-core.rules §5`. The following domain constraints extend or restrict the core rules for ASL program files.

### §5.1 — Hex Literals in Program Data

- Inside the `data:` block, hex values (`0x...`) are **valid integer literals** and **MUST NOT** be quoted.
  - Example: `COLOR_BLACK: 0x0000` | `I2C_ADDR: 0x27`
- Inside function call arguments (setup, loop, functions), hex values are **valid integer literals** and **MUST NOT** be quoted.
  - Example: `initLCD(0x27, 16, 2)` | `initOLED(0x3C, 128, 64)`
- This is a **domain override** of §12: inside ASL program code (data values and call arguments), `0x` prefix is the **only** case where a leading `0` followed by a non-digit is explicitly allowed as an unquoted integer literal.

### §5.2 — Boolean in Program Data

- The `t` / `f` shorthand is **forbidden** inside the `data:` block.
- Use full literals `true` or `false`.
  - Example: `led_state: false` | `game_over: true`

### §5.3 — String Constants in Program Data

- String values in the `data:` block that contain spaces, special characters, or could be mistaken for a number **MUST** be quoted.
- Simple unit identifiers or short labels **MAY** be unquoted.
  - Example: `TIME_UNIT: ms` | `TEMP_UNIT: "C"` | `HUMD_UNIT: "%"`
- Strings used as initial values for string variables **MUST** be quoted.
  - Example: `light_label: "---"`

### §5.4 — Value Types in Data Block

The `data:` block declares program variables. Each value is an **ASL literal** (not a TOON field value). Allowed types:

| Type | Example |
|------|---------|
| Integer | `BLINK_INTERVAL: 500`, `DEBOUNCE_TIME: 250` |
| Float | `KP: 25.5`, `NTC_NOMINAL: 10000.0` |
| Boolean | `led_state: false`, `sys_safety_halt: false` |
| String (unquoted) | `TIME_UNIT: ms` |
| String (quoted) | `TEMP_UNIT: "C"`, `light_label: "---"` |
| Hex (unquoted) | `COLOR_BLACK: 0x0000`, `I2C_ADDR: 0x27` |

---

## §14 — Semantic Validations (Program Domain)

### §14.1 — Metadata Block

- Required keys: `project_name`, `version`, `editor`, `author`, `ASLversion`
- `version` **MUST** be a non-negative integer.
- `ASLversion` **MUST** follow semver: `MAJOR.MINOR.PATCH` (e.g., `0.1.0`).
- `project_name` **MUST** match `^[a-z][a-z0-9-]*$` (kebab-case).
- No extra keys are allowed under `# METADATA:` beyond the required five.

### §14.2 — Section Order

ASL program files **MUST** contain the following sections in this exact order:

| Index | Section Name | Required |
|-------|-------------|----------|
| `## 1.` | `HARDWARE INTERFACE:` | **REQUIRED** |
| `## 2.` | `SYSTEM DATA:` | **REQUIRED** |
| `## 3.` | `INITIALIZATION SYSTEM:` | **REQUIRED** |
| `## 4.` | `BEHAVIORAL LOGIC (LOOP):` | **REQUIRED** |
| `## 5.` | `PROCEDURAL FUNCTIONS:` | **OPTIONAL** (may be omitted if no functions are defined) |

- Section `## 5. PROCEDURAL FUNCTIONS:` **MAY** be absent when the program has no user-defined functions.
- The parenthetical qualifier `(LOOP)` in section 4 is **OPTIONAL** but recommended.
- An inline format annotation **MAY** follow the colon as a `#` comment on the same heading line (see §3).

### §14.3 — Hardware Declaration (Tabular Array)

Declared with: `hardware[n|]{pin|type|io_mode|label|target_role}:`

- `pin` **MUST** be a non-negative integer. Values **MUST** be unique across all hardware rows.
- `type` is restricted to: `digital`, `analog`
- `io_mode` is restricted to: `input`, `output`, `bi`, `input_pullup`
  - Additional modes **MAY** be added as the ASL specification evolves.
  - Values are **case-sensitive**; the observed set is all lowercase.
- The `pinMode()` arguments in `setup`/`loop`/`functions` use a **different, uppercase** set: `INPUT`, `OUTPUT`, `INPUT_PULLUP`, `INPUT_PULLDOWN`.
- `label` **MUST** be a quoted string (contains spaces and special characters).
- `target_role` is a kebab-case identifier or quoted when it contains special characters (e.g., `"adc:t"`, `"di;do;pwm"`).
  - Common roles: `digital-in`, `digital-out`, `pwm-out`, `status-led`, `i2c-sda`, `i2c-scl`, `spi-mosi`, `spi-sck`, `spi-cs`, `uart-rx`, `uart-tx`, `btn-no`, `btn-up`, `btn-down`, `btn-start`, `sensor-pos`, `sensor-a0`, `sensor-a1`, `sensor-b0`, `sensor-b1`, `relay-coil`, `led-out`, `ir-rx`, `ir-tx`, `int-rising`, `int-falling`, `"adc:t"`
  - Multi-role values **MUST** use `;` as separator (no surrounding spaces) and **MUST** be quoted.
- The declared count `[n]` **MUST** match the number of hardware rows exactly.
- Rows are indented exactly **2 spaces** relative to the header.

### §14.4 — System Data Block (Nested Object)

Declared with: `data:` (nested block)

- Variable names (keys) **MUST** match `^[A-Za-z_][A-Za-z0-9_]*$`
  - Uppercase for constants (e.g., `TIME_UNIT`, `BLINK_INTERVAL`, `KP`)
  - Lowercase for mutable variables (e.g., `led_state`, `current_temp`, `count`)
- Values follow §5.1–5.4 rules (integers, floats, booleans, strings, hex).
- Variables **MAY** be declared with an explicit type only (no initial value):
  - Example: `o: boolean` | `set_valvula: boolean` | `pin: int`
  - Allowed types for explicit declarations: `boolean`, `int`, `float`, `string`
- Duplicate variable names at the same indentation level are **forbidden**.
- No limit on the number of variable declarations.

### §14.5 — Initialization System Block (List Array)

Declared with: `setup[n]:`

- The body is a **list array** (§10) with `- ` prefix.
- `n` **MUST** equal the number of body lines.
- Each line is an ASL command (function call, control flow, or assignment).
- Commonly contains: `pinMode()`, `digitalWrite()`, `initI2C()`, `initLCD()`, `attachInterrupt()`, `pwmFreq()`, `serialBegin()`

### §14.6 — Behavioral Logic Block (List Array)

Declared with: `loop[n]:`

- The body is a **list array** (§10) with `- ` prefix.
- `n` **MUST** equal the number of body lines.
- Each line is an ASL command executed repeatedly in the main control loop.
- Commonly contains: function calls, control flow, `delay()`, sensor reads, output writes.

### §14.7 — Procedural Functions Block (Nested Object)

Declared with: `functions:` (nested block)

Each function within the block is defined with one of these forms:

| Form | Example |
|------|---------|
| Name only + size | `toggle_led[5]:` |
| Name + empty parens + size | `compute_thermal_pid()[11]:` |
| Name + params + size | `move_to_vpos(val_x, val_y)[14]:` |

Rules:

- Function name **MUST** match `^[a-z_][a-z0-9_]*$` (snake_case).
- The size annotation `[n]` is **REQUIRED** and **MUST** match the number of body lines (list items).
- Parameters (optional) **MUST** be enclosed in parentheses immediately after the function name, before the size annotation.
  - Multiple parameters are separated by `, ` (comma + space).
- The body is a **list array** (§10) with `- ` prefix.
- Body lines **MUST** be indented exactly **2 spaces** relative to the function name.
- Function names **MUST** be unique within the `functions:` block.
- Parameter names **MUST** match `^[a-z_][a-z0-9_]*$`.

### §14.8 — Control Flow Constructs

ASL programs use the following control flow constructs **inside list array bodies**:

| Construct | Syntax |
|-----------|--------|
| If | `- if condition:` |
| Else | `- else:` |
| Repeat (counted) | `- repeat(count):` |
| Return | `- return(value)` |

- `if` and `else` **MUST** appear as separate `- ` prefixed lines (each is a list item).
- `else` is optional and **MUST** follow an `if` block.
- The `condition` in `if` is any valid ASL expression.
- `repeat(count):` repeats its body `count` times. The body follows on subsequent indented lines.
- Inline one-liner form is allowed: `- if digitalRead(2): toggle_led1()`
  - The command after `:` is executed when the condition is true.
  - No separate `- else:` form exists for one-liners.

### §14.9 — Expression Rules

ASL expressions appear in assignments, function call arguments, and control flow conditions.

**Operators:**

| Category | Operators |
|----------|-----------|
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Comparison | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| Logical | `not`, `and`, `or` |
| Assignment | `=` |

- Assignment uses `=` (not `==`): `led_state = not led_state`
- String concatenation uses `+`: `"Temp: " + string(temp_c, 1) + " C"`
- Parentheses are used for grouping and function calls.

**Built-in Type Conversion Functions:**
`int(value)`, `string(value)`, `string(value, decimals)`, `float(value)`, `bool(value)`, `abs(value)`, `min(a, b)`, `max(a, b)`, `sqrt(value)`, `log(value)`, `sin(value)`, `cos(value)`, `map(value, fromLow, fromHigh, toLow, toHigh)`, `constrain(value, min, max)`

### §14.10 — Built-in Commands Reference

#### Pin I/O
| Command | Signature |
|---------|-----------|
| `pinMode` | `pinMode(pin, mode)` |
| `digitalWrite` | `digitalWrite(pin, value)` |
| `digitalRead` | `digitalRead(pin)` |
| `analogWrite` | `analogWrite(pin, value)` |
| `readADC` | `readADC(pin)` |
| `pwmWrite` | `pwmWrite(pin, duty)` |
| `pwmFreq` | `pwmFreq(pin, freq)` |

#### Interrupts
| Command | Signature |
|---------|-----------|
| `attachInterrupt` | `attachInterrupt(pin, handler, mode)` |

#### Communication
| Command | Signature |
|---------|-----------|
| `initI2C` | `initI2C(bus, sda, scl, freq)` |
| `initSPI` | `initSPI(bus, mosi, miso, sck, cs)` |
| `serialBegin` | `serialBegin(baud)` |
| `serialPrint` | `serialPrint(text)` |
| `serialPrintln` | `serialPrintln(text)` |

#### Display — LCD
| Command | Signature |
|---------|-----------|
| `initLCD` | `initLCD(address, cols, rows)` |
| `lcdClear` | `lcdClear()` |
| `lcdPrint` | `lcdPrint(col, row, text)` |

#### Display — OLED (SSD1306-like)
| Command | Signature |
|---------|-----------|
| `initOLED` | `initOLED(address, width, height)` |
| `display.clearDisplay` | `display.clearDisplay()` |
| `display.display` | `display.display()` |
| `display.setCursor` | `display.setCursor(x, y)` |
| `display.print` | `display.print(text)` |
| `display.drawPixel` | `display.drawPixel(x, y, color)` |
| `display.drawFastVLine` | `display.drawFastVLine(x, y, h, color)` |
| `display.drawRect` | `display.drawRect(x, y, w, h, color)` |
| `display.fillRect` | `display.fillRect(x, y, w, h, color)` |
| `display.drawRoundRect` | `display.drawRoundRect(x, y, w, h, r, color)` |
| `display.setTextColor` | `display.setTextColor(fg, bg)` |
| `display.setTextSize` | `display.setTextSize(size)` |

#### Display — TFT
| Command | Signature |
|---------|-----------|
| `initTFT` | `initTFT(dc, rst, spi_bus)` |
| `tftFillScreen` | `tftFillScreen(color)` |
| `tftSetTextColor` | `tftSetTextColor(fg, bg)` |
| `tftSetTextSize` | `tftSetTextSize(size)` |
| `tftPrintText` | `tftPrintText(x, y, text)` |
| `tftDrawLine` | `tftDrawLine(x1, y1, x2, y2, color)` |
| `tftDrawRoundRect` | `tftDrawRoundRect(x, y, w, h, r, color)` |

#### Sensor
| Command | Signature |
|---------|-----------|
| `readDistanceCM` | `readDistanceCM(trig_pin, echo_pin)` |
| `initSensorI2C` | `initSensorI2C()` |
| `readTemperature` | `readTemperature()` |
| `readHumidity` | `readHumidity()` |

#### Timing & Audio
| Command | Signature |
|---------|-----------|
| `delay` | `delay(ms)` |
| `currentTime` | `currentTime()` |
| `tone` | `tone(pin, freq, duration)` |

---

## Standard Section Order

A conformant ASL program document **MUST** contain the following sections in this exact order:

| Index | Section Name | Required |
|-------|-------------|----------|
| `## 1.` | `HARDWARE INTERFACE:` | **REQUIRED** |
| `## 2.` | `SYSTEM DATA:` | **REQUIRED** |
| `## 3.` | `INITIALIZATION SYSTEM:` | **REQUIRED** |
| `## 4.` | `BEHAVIORAL LOGIC (LOOP):` | **REQUIRED** |
| `## 5.` | `PROCEDURAL FUNCTIONS:` | **REQUIRED** (may be empty if no functions) |

---

## Deviations from Drafts (Validation Checklist)

| # | Issue | Correct Form |
|---|-------|-------------|
| 1 | `## METADATA:` (wrong, `##` reserved for sections) | `# METADATA:` (single `#`) |
| 2 | Section names not in the 5-section order above | Must use exact order |
| 3 | `hardware[n]` count mismatch | `[n]` must equal number of rows |
| 4 | `setup[n]` / `loop[n]` count mismatch | `[n]` must equal number of body lines |
| 5 | Function `[n]` count mismatch | `[n]` must equal number of body lines |
| 6 | Hex values quoted in `data:` block | `COLOR_BLACK: 0x0000` (unquoted) |
| 7 | Hex values quoted in function call args | `initLCD(0x27, 16, 2)` (unquoted) |
| 8 | Boolean shorthand `t` / `f` in `data:` | Use `true` / `false` |
| 9 | Spaces around pipe in tabular hardware rows | `2|digital|input|"Label"|role` (no spaces around `\|`) |
| 10 | Function name not snake_case | Use `toggle_led`, `read_temperature_celsius` |
| 11 | Inconsistent indentation in function body | Must be exactly 2 spaces more than function name |
| 12 | Missing `functions:` when procedures declared | `functions:` block is required if any functions exist |

---

## Templates

### Template — Basic ASL Program

```toon
# METADATA:
project_name: {slug}
version: 1
editor: dendriForge
author: {author}
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[n|]{pin|type|io_mode|label|target_role}:
  {pin}|{type}|{io_mode}|"{label}"|{role}

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  {CONSTANT}: {value}
  {variable}: {initial_value}

## 3. INITIALIZATION SYSTEM:
setup[n]:
  - pinMode({pin}, {mode})
  - {command}({args})

## 4. BEHAVIORAL LOGIC (LOOP):
loop[n]:
  - {function_call}({args})

## 5. PROCEDURAL FUNCTIONS:
functions:
  {function_name}[n]:
    - {command}({args})
```

---

*This file supersedes `LINGUAGEM-ASL-REFERENCIA.md` as the normative reference for ASL program syntax.*
*Updated: 2026-06-10*
