# ASL Board Profile — Unified Dialect Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24) + domain extensions for ASL board profiles
**File:** `asl-board-profile.rules`
**Scope:** ALL board profile documents (MCU, PLC, embedded, maker, etc.)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

> This file replaces `asl-mcu-profile.rules`, `asl-plc-profile.rules`, and `toon-board-templates.md`.
> All board profiles share a single set of rules. Differences between categories
> (e.g. `maker`, `embedded`, `plc`) are expressed as conditional constraints based on the `category` field.

---

## Inherited Rules

The following sections from `toon-dialect-core.rules` apply unchanged to all board profiles:

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

## §5 — Scalar Value Types

Core scalar rules (integer, float, bool, null, hex, string, quoting triggers) are inherited from `toon-dialect-core.rules §5`. The following domain constraints extend or restrict the core rules for board profiles.

### §5.1 — Clock Frequency

- The `clock` field under the `specs` block value depends on `category`:
  - `maker`, `embedded`: **MUST** be a positive integer in Hz. Example: `clock: 16000000`
  - `plc`: **MUST** be exactly `0` (virtual clock, non-applicable). Example: `clock: 0`
- The `MHz` string form (e.g. `16MHz`) is **forbidden** for the `clock` field.
- Parsers **MUST** reject non-integer and non-positive values in strict mode.

### §5.2 — Allowed Unit Suffixes

The permitted unit suffix set for all board profiles:

| Suffix | Meaning | Example |
|--------|---------|---------|
| `mA` | Milliamperes | `40mA`, `500mA` |
| `V` | Volts | `5V`, `3.3V`, `24V` |
| `KB` | Kilobytes | `512KB`, `4096KB` |
| `kHz` | Kilohertz | `100kHz`, `400kHz` |

- A number immediately followed by one of the above suffixes (no space) is a **unit string**.
- Unit strings are scalar strings in TOON's type model, **not** numbers.
- `MHz`, `ms`, `W`, `A`, `bar` are **not** in scope for board profiles.

### §5.3 — Boolean Shorthand

- The `t` (true) / `f` (false) shorthand is allowed **only** inside:
  - GPIO tabular rows (fields `pwm` and `int`)
  - Power pin tabular rows (where direction/type are boolean-valued)
- Outside these contexts, **MUST** use full literals `true` or `false`.
- Parsers **MUST** map `t → true`, `f → false` at the dialect layer.

### §5.4 — Hexadecimal Values

- `vid` and `pid` under the `usb` block **MUST** be quoted and match `^0x[0-9A-Fa-f]{4}$`.
  - Example: `vid: "0x2341"` | `pid: "0x0043"`
- All other hex values **MUST** be quoted to avoid ambiguity (spec §7.2).

### §5.5 — URL Values

- The `url` field in Device Identification accepts a plain URL (`https://...`) or a Markdown link `[text](url)`.
- Both forms are valid; the URL **MUST** be well-formed and absolute.

### §5.6 — IEC 61131-3 Address Strings (PLC category)

- Used in `ioModules`, `digitalChannels`, and `analogChannels` arrays.
- Addresses following the IEC 61131-3 direct representation format are treated as **quoted strings**.

| Pattern | Meaning | Example |
|---------|---------|---------|
| `%IX<rack>.<slot>.<ch>` | Digital input bit | `"%IX0.0"` |
| `%QX<rack>.<slot>.<ch>` | Digital output bit | `"%QX1.3"` |
| `%IW<n>` | Analog input word | `"%IW0"` |
| `%QW<n>` | Analog output word | `"%QW2"` |
| `%ID<n>` | Analog input dword | `"%ID0"` |
| `%QD<n>` | Analog output dword | `"%QD0"` |
| `%MW<n>` | Memory word (marker) | `"%MW4"` |
| `%MD<n>` | Memory dword (marker) | `"%MD0"` |

- These values **MUST** always be quoted (they contain `%`, which triggers quoting per §12).
- Parsers **MUST NOT** interpret these as numeric expressions.

---

## §14 — Semantic Validations

### §14.1 — Device Identification

- `category` **MUST** be one of: `maker`, `embedded`, `plc`
- `id` identifies the board profile; kebab-case recommended. Example: `arduino-uno-r3`
- `manufacturer` is a free-form unquoted or quoted string.
- `image` is a relative filename string (`.svg`); no path traversal characters allowed.
- `url` — see §5.5.
- Conditional fields:
  - `mcu` (free-form string) — **REQUIRED** for `maker` and `embedded` categories. Identifies the microcontroller model. Example: `ATmega328P`, `ESP32-S3`
  - `cpu` (free-form string) — **REQUIRED** for `plc` category. Identifies the CPU module model. Example: `"CPU 1214C DC/DC/DC"`
  - `form_factor` — **REQUIRED** for `plc` category. Restricted to: `modular`, `compact`, `rack`, `softplc`
  - `standard` — **RECOMMENDED** for `plc` category; if present, **MUST** be `"IEC 61131-3"` or a valid extension.
- Fields `form_factor` and `standard` are **forbidden** for `maker` and `embedded` categories.

### §14.2 — Tech Specs

- `flash_total` and `flash_available` **MUST** be positive integers (bytes).
- `flash_available` **MUST** be less than or equal to `flash_total`.
- `sram` and `eeprom` **MUST** be non-negative integers (bytes).
- `clock` **MUST** satisfy §5.1 rules.
- `voltage` **MUST** use the `V` unit suffix. Example: `5V`, `3.3V`, `24V`
- `dims.w`, `dims.h`, `dims.t` **MUST** be positive floats (millimetres).
- Optional spec keys (for any category): `cores`, `wifi`, `bluetooth`

### §14.3 — Power Pins

- Declared with: `powerPins[n|]{name|direction|voltage|type}:`
- `direction` is restricted to: `input`, `output`, `null`
- `type` is restricted to: `ground`, `null`, or blank (empty string)
- `voltage` **MUST** use the `V` unit suffix when non-null. Example: `5V`, `3.3V`, `24V`
- Pin names **MUST** be unique within `powerPins`.
- The declared count `[n]` **MUST** match exactly the number of power pin rows.

### §14.4 — GPIO Map

- Declared with: `gpio[n|]{pin|type|pwm|int|label|roles}:`
- `pin` **MUST** be a non-negative integer; values **MUST** be unique across all GPIO rows.
- `type` is restricted to: `digital`, `analog`
- `pwm` and `int` **MUST** use boolean values: `t`, `f`, `true`, or `false`.
- `label`:
  - Composite labels (containing spaces, `/`, or other special characters) **MUST** be quoted.
  - Simple single-word labels without special characters **MAY** be unquoted (e.g. `D2`, `A0`, `Ia.0`).
- `roles`:
  - MAY contain multiple roles separated by `;` with **no surrounding spaces**.
  - When the field contains `:` or `;`, it **MUST** be quoted. Example: `"adc:t;i2c-sda"`, `"di;do;pwm"`
  - Single unambiguous roles **MAY** be unquoted. Example: `uart-rx`, `int0`, `di`, `do`
  - Use `null` when no role is assigned.
- The declared count `[n]` **MUST** equal the total number of digital plus analog pin rows.

### §14.5 — Digital I/O Channels (PLC-specific array)

- Declared with: `digitalChannels[n|]{addr|direction|label|roles}:`
- `addr` **MUST** be a quoted IEC 61131-3 bit address (`%IX` or `%QX`). Example: `"%IX0.0"`
- Addresses **MUST** be unique.
- `direction` is restricted to: `input`, `output`, `bidirectional`
- `roles` is a semicolon-separated string. Allowed values: `di`, `do`, `safety-di`, `safety-do`, `fast-counter`, `interrupt`, `hsc`
- The declared count `[n]` **MUST** match the number of rows.

### §14.6 — Analog I/O Channels (PLC-specific array)

- Declared with: `analogChannels[n|]{addr|direction|resolution}:`
- `addr` **MUST** be a quoted IEC 61131-3 word/dword address (`%IW`, `%QW`, `%ID`, `%QD`). Example: `"%IW0"`
- Addresses **MUST** be unique.
- `direction` is restricted to: `input`, `output`
- `resolution` **MUST** be a bare integer (bits). Example: `12`, `16`
- The declared count `[n]` **MUST** match the number of rows.

### §14.7 — I/O Modules (PLC-specific array)

- Declared with: `ioModules[n|]{slot|rack|type|channels|addr_start|addr_end|current}:`
- `slot` and `rack` **MUST** be non-negative integers.
- `slot` numbers **MUST** be unique within the same rack.
- `type` is restricted to: `DI`, `DO`, `AI`, `AO`, `DIO`, `AIO`, `safety-DI`, `safety-DO`, `mixed`
- `channels` **MUST** be a positive integer.
- `addr_start` and `addr_end` **MUST** be quoted IEC 61131-3 addresses or `null`. M-area addresses (`%MW`/`%MD`) are **forbidden** in ioModules address fields.
- `current` **MUST** use the `mA` suffix or be `null`.
- The declared count `[n]` **MUST** match the number of rows.

### §14.8 — Peripherals

- Declared with: `peripherals[n|]{peripheral|param|value}:`
- `peripheral` — identifier rules depend on `category`:
  - `maker`, `embedded`: limited to: `serial`, `i2c`, `spi`, `pwm`, `adc`, `dac`
  - `plc`: any lowercase alphanumeric identifier, with hyphens or underscores. Example: `profinet`, `modbus-tcp`, `hsc_counters`
- Pin references in `value` fields (e.g. `sda:18;scl:19`) **MUST** reference pin numbers declared in `gpio[n]`.
- Multi-pin values **MUST** use `;` as separator (no surrounding spaces) and **MUST** be quoted.
  - Example: `"sda:18;scl:19"`, `"miso:12;mosi:11;sck:13;ss:10"`
- The declared count `[n]` **MUST** match the number of peripheral rows.

### §14.9 — USB Block

- `type` is a free-form string or `null`. Example: `USB-B`, `Micro-USB`, `USB-C`, `null`
- `chip` is a free-form string or `null`. Example: `ATmega16U2`, `CH340`, `null`
- `vid` and `pid` **MUST** each match `^0x[0-9A-Fa-f]{4}$` and **MUST** be quoted.

### §14.10 — Restrictions

- `max_io_current` **MUST** use the `mA` unit suffix.
- `total_current_limit` **MUST** use the `mA` unit suffix.
- `warnings[n]` is a list array; each entry is a quoted string. The declared count `[n]` **MUST** match the number of warning entries.

### §14.11 — Compatibility

Available keys and their applicability by category:

| Key | `maker` / `embedded` | `plc` |
|-----|----------------------|-------|
| `arduinoCore` | Allowed (version string) | **FORBIDDEN** |
| `pio` | Allowed (PlatformIO identifier) | **FORBIDDEN** |
| `bootloader` | Allowed (bootloader name) | **FORBIDDEN** |
| `frameworks` | Allowed (free-form string) | Allowed (free-form string) |
| `languages` | Allowed (free-form string) | **MUST** use allowed set (see §14.12) |
| `sw` | Allowed | Allowed |
| `certifications` | Allowed | Allowed |

- `arduinoCore` with dots **MUST** be quoted. Example: `"1.8.19"`
- `languages` for `plc` category: see §14.12.
- `frameworks` is a free-form string for all categories.

### §14.12 — Languages (PLC-specific constraints)

- When `category` is `plc`, the `languages` field **MUST** contain one or more values from the allowed set:

  `LD`, `LAD`, `FBD`, `ST`, `SCL`, `IL`, `SFC`, `C`, `C++`, `CPP`, `Python`, `Rust`, `Arduino-CPP`

- Multiple languages **MUST** be expressed as a quoted semicolon-separated string. Example: `"LD;FBD;ST;SFC;Python"`
- For `maker` and `embedded` categories, `languages` is a free-form string. Example: `arduino-cpp`, `micropython`

### §14.13 — Agent Skills

- `boardFamilySkillId`:
  - `maker`, `embedded`: **MUST** end with `-family` and be kebab-case. Example: `avr-family`, `esp32-xtensa-family`
  - `plc`: **MUST** end with `plc-family` and be kebab-case. Example: `siemens-simatic-s7-1200-plc-family`
- `boardProfileId` **MUST** match: `^[a-z][a-z0-9-]*$` (kebab-case). Example: `arduino-uno-r3`, `siemens-s7-1200`
- `defaultLanguageSkills` entries **MUST** match: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (allowing digits immediately after a hyphen). Examples: `arduino-cpp-avr`, `ladder-tia-portal-s7-1200`, `st-iec61131`
- The declared count `[n]` **MUST** match the number of skill entries.

---

## Standard Section Order

A conformant board profile document **MUST** contain the following sections in this exact order:

| Index | Section Name | Applicability |
|-------|-------------|---------------|
| `## 1.` | `DEVICE IDENTIFICATION` | All categories |
| `## 2.` | `TECH SPECS & DIMENSIONS` | All categories |
| `## 3.` | `ELECTRICAL PROFILE (POWER PINS)` | All categories |
| `## 4.` | `GPIO MAP` | All categories |
| `## 5.` | `PERIPHERALS & USB` | All categories |
| `## 6.` | `RESTRICTIONS & COMPATIBILITY` | All categories |
| `## 7.` | `AGENT SKILLS` | All categories |

Additional sections **MAY** be appended at `## 8.` and beyond for domain-specific data (e.g. `DIGITAL I/O CHANNELS`, `ANALOG I/O CHANNELS`, `I/O MODULES`, flashing procedures, shield compatibility matrix).

---

## Global Valid Values Reference

| Concept | Valid Values |
|---------|-------------|
| `category` | `maker` · `embedded` · `plc` |
| `form_factor` (PLC only) | `modular` · `compact` · `rack` · `softplc` |
| `standard` (PLC only) | `"IEC 61131-3"` or extension |
| Power pin `direction` | `input` · `output` · `null` |
| Power pin `type` | `ground` · `null` |
| GPIO `type` | `digital` · `analog` |
| GPIO `pwm` / `int` | `t` · `f` · `true` · `false` (shorthand allowed only inside tabular rows) |
| GPIO `roles` | Multi-role: `;` separated, no spaces. Quote if contains `;` or `:` |
| Peripherals (maker/embedded) | `serial` · `i2c` · `spi` · `pwm` · `adc` · `dac` |
| Peripherals (PLC) | Any `[a-z0-9_-]+` identifier |
| Unit suffixes | `mA` · `V` · `KB` · `kHz` |
| `boardFamilySkillId` (maker/embedded) | `{arch}-family` (e.g. `avr-family`) |
| `boardFamilySkillId` (PLC) | `{name}-plc-family` (e.g. `siemens-s7-1200-plc-family`) |
| `boardProfileId` | Kebab-case: `^[a-z][a-z0-9-]*$` |
| Skill identifiers | `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` |
| PLC languages | `LD` · `LAD` · `FBD` · `ST` · `SCL` · `IL` · `SFC` · `C` · `C++` · `CPP` · `Python` · `Rust` · `Arduino-CPP` |
| Forbidden keys in PLC | `arduinoCore` · `pio` · `bootloader` |

---

## Deviations from Drafts (Validation Checklist)

| # | Issue | Correct Form |
|---|-------|-------------|
| 1 | `## METADATA:` (wrong, ## reserved for sections) | `# METADATA:` (single `#`) |
| 2 | Non-standard section names | Must use exact 7-section order above |
| 3 | PLC `clock` not set to `0` | `clock: 0` for all PLC profiles |
| 4 | MCU keys (`arduinoCore`, `pio`, `bootloader`) in PLC | **Forbidden** in PLC profiles |
| 5 | `boardFamilySkillId` missing `-family` or `plc-family` suffix | MCU: `{arch}-family`; PLC: `{name}-plc-family` |
| 6 | `form_factor` / `standard` in non-PLC profiles | **Forbidden** for `maker`/`embedded` |
| 7 | Spaces around pipe in tabular rows | `0|digital|true|false|D2|int0` (no spaces around `\|`) |
| 8 | Boolean `t`/`f` used outside tabular rows | Use `true`/`false` everywhere except GPIO/powerPins rows |
| 9 | `mcu` vs `cpu` swapped between categories | `maker`/`embedded` use `mcu`; `plc` uses `cpu` |

---

## Templates

### Template 1 — Maker / Embedded

```toon
# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: {slug}
name: "{Display Name}"
manufacturer: {Manufacturer}
mcu: {MCU model}
category: maker          # or embedded
image: {slug}.svg
url: "{https://...}"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: {bytes}
  flash_available: {bytes}
  sram: {bytes}
  eeprom: {bytes or 0}
  clock: {Hz}
  voltage: "{V}"
dims:
  w: {mm}
  h: {mm}
  t: {mm}

## 3. ELECTRICAL PROFILE (POWER PINS):
powerPins[n|]{name|direction|voltage|type}:
  VIN|input|null|null
  5V|output|"5V"|null
  3V3|output|"3.3V"|null
  GND|null|null|ground

## 4. GPIO MAP:
gpio[n|]{pin|type|pwm|int|label|roles}:
  0|digital|false|false|"D0 / RX"|uart-rx
  1|digital|false|false|"D1 / TX"|uart-tx
  2|digital|false|true|D2|int0
  13|digital|false|false|"D13 / LED"|status-led
  14|analog|false|false|A0|"adc:t"

## 5. PERIPHERALS & USB:
peripherals[n|]{peripheral|param|value}:
  serial|"uarts:1"|"pins:0,1"
  i2c|"channels:1"|"sda:18;scl:19"
  spi|"channels:1"|"miso:12;mosi:11;sck:13;ss:10"
usb:
  type: USB-B
  chip: ATmega16U2
  vid: "0x2341"
  pid: "0x0043"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "40mA"
  total_current_limit: "200mA"
  warnings[n]:
    - "Warning text"
compatibility:
  arduinoCore: "1.8.19"
  pio: atmelavr
  frameworks: arduino
  languages: arduino-cpp
  bootloader: optiboot

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: {arch}-family
  boardProfileId: {slug}
  defaultLanguageSkills[n]:
    - {lang-env-arch}
```

### Template 2 — PLC

```toon
# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: {slug}
name: "{Display Name}"
manufacturer: {Manufacturer}
cpu: {CPU model}
category: plc
form_factor: {modular|compact|rack|softplc}
standard: "IEC 61131-3"
image: {slug}.svg
url: "{https://...}"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: {bytes}
  flash_available: {bytes}
  sram: {bytes}
  eeprom: {bytes or 0}
  clock: 0
  voltage: "{V}"
dims:
  w: {mm}
  h: {mm}
  t: {mm}

## 3. ELECTRICAL PROFILE (POWER PINS):
powerPins[n|]{name|direction|voltage|type}:
  L+|input|24V|null
  M|null|null|ground
  PE|null|null|ground

## 4. GPIO MAP:
gpio[n|]{pin|type|pwm|int|label|roles}:
  0|digital|false|true|"Ia.0 / HSC0"|"di"
  1|digital|false|true|"Ia.1 / HSC1"|"di"

## 5. PERIPHERALS & USB:
peripherals[n|]{peripheral|param|value}:
  profinet|"speed:100Mbit"|"1x-RJ45-10-100Mbps-isolated"
usb:
  type: null
  chip: null
  vid: "0x0000"
  pid: "0x0000"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "500mA"
  total_current_limit: "1000mA"
  warnings[n]:
    - "Warning text"
compatibility:
  sw: "STEP 7 Basic V11+"
  frameworks: "IEC61131-3;TIA Portal"
  languages: "LD;FBD;ST;SFC"
  certifications: "CE;cULus"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: {name}-plc-family
  boardProfileId: {slug}
  defaultLanguageSkills[n]:
    - {lang-ide-family}
```

---

*This file replaces `asl-mcu-profile.md`, `asl-plc-profile.md`, and `toon-board-templates.md`.*
*Updated: 2026-06-09*
