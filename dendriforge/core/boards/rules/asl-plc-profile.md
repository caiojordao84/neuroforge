# ASL PLC Board Profile — Dialect Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24) + domain extensions for ASL PLC profiles
**File:** `asl-plc-profile.rules`
**Inherits:** `toon-dialect-core.rules` (§1–§13 + §15) — all core rules apply unchanged
**Scope:** PLC (Programmable Logic Controller) profiles (`category: plc`)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

> This file defines **only** the domain-specific overrides: §5 domain constraints and §14 semantic validations.
> Sections §1–§4, §6–§13, and §15 are inherited from `toon-dialect-core.rules` without modification.
> The MCU-specific extensions in `asl-mcu-profile.rules` do **not** apply here.

---

## §5 — Scalar Value Types (PLC Domain Overrides)

Core scalar rules (integer, float, bool, null, hex, string, quoting triggers) are inherited from `toon-dialect-core.rules §5`. The following domain constraints **replace** the MCU equivalents from `asl-mcu-profile.rules`.

### §5.1 — Clock Frequency

- The `clock` field under the `specs` block **MUST** be set to exactly `0` for PLC profiles, representing a non-applicable virtual clock.
  - Example: `clock: 0`
- Scan/cycle time fields (e.g. `cycle_time`) are **not** supported at the schema level.

### §5.2 — Allowed Unit Suffixes

The permitted unit suffix set for PLC profiles (value-with-unit strings):

| Suffix | Meaning | Example |
|---|---|---|
| `mA` | Milliamperes | `500mA` |
| `V` | Volts | `24V`, `5V` |
| `KB` | Kilobytes | `100KB`, `4096KB` |
| `kHz` | Kilohertz | `100kHz` |

- A number immediately followed by one of the above suffixes (no space) is a **unit string**.
- Unit strings are scalar strings in TOON's type model, **not** numbers.
- `MHz`, `ms`, `A`, `W`, `bar` are **not** supported as suffixes in standard PLC profiles.

### §5.3 — Boolean Shorthand

- The `t` (true) / `f` (false) shorthand is allowed **only** inside:
  - GPIO map tabular rows (see §14.4)
  - Power pin tabular rows (see §14.3)
- Outside these contexts, **MUST** use full literals `true` or `false`.
- Parsers **MUST** map `t → true`, `f → false` at the dialect layer.

### §5.4 — IEC 61131-3 Address Strings

- Addresses following the IEC 61131-3 direct representation format are treated as **quoted strings**.
- Format patterns:

  | Pattern | Meaning | Example |
  |---|---|---|
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

### §5.5 — USB / Service Port Identifiers

- `vid` and `pid` under the `usb` block **MUST** be quoted and match `^0x[0-9A-Fa-f]{4}$`.
  - Example: `vid: "0x0000"` | `pid: "0x0000"`

---

## §14 — Semantic Validations (PLC Domain)

> This section **replaces** §14 of `asl-mcu-profile.rules` entirely. None of the MCU §14 constraints apply to PLC profiles.

### §14.1 — Device Identification

- `category` **MUST** be exactly: `plc`
- `cpu` identifies the CPU module model; it is a free-form quoted or unquoted string.
  - Example: `cpu: "CPU 1214C DC/DC/DC"`
- `manufacturer` is a free-form string.
- `form_factor` is restricted to: `modular`, `compact`, `rack`, `softplc`
- `standard` is **recommended**; if present, **MUST** be `"IEC 61131-3"` or a valid extension.
  - Example: `standard: "IEC 61131-3"`

### §14.2 — Tech Specs

- `flash_total` and `flash_available` **MUST** be positive integers (bytes).
- `sram` and `eeprom` **MUST** be non-negative integers (bytes).
- `clock` **MUST** be exactly `0`.
- `voltage` **MUST** use the `V` unit suffix. Example: `24V`.
- `dims.w`, `dims.h`, `dims.t` **MUST** be positive floats (millimetres), if present.

### §14.3 — Power Pins

- Declared with: `powerPins[n|]{name|direction|voltage|type}:`
- `direction` is restricted to: `input`, `output`, `null`
- `type` is restricted to: `ground`, `null`, or blank (empty string)
- `voltage` **MUST** use the `V` unit suffix when non-null. Example: `24V`, `5V`
- Pin names **MUST** be unique within `powerPins`.
- The declared count `[n]` **MUST** match exactly the number of power pin rows.

### §14.4 — GPIO Map

- Declared with: `gpio[n|]{pin|type|pwm|int|label|roles}:`
- `pin` **MUST** be a non-negative integer; values **MUST** be unique across all GPIO rows.
- `type` is restricted to: `digital`, `analog`
- `pwm` and `int` **MUST** use boolean values: `t`, `f`, `true`, or `false`.
- `label`:
  - Composite labels (containing spaces, `/`, or other special characters) **MUST** be quoted.
  - Simple single-word labels without special characters **MAY** be unquoted (e.g., `Ia.6`, `AIW0`).
- `roles`:
  - MAY contain multiple roles separated by `;` with **no surrounding spaces**.
  - When the field contains `:` or `;`, it **MUST** be quoted. Example: `"di"`, `"do;pwm"`
  - Single unambiguous roles **MAY** be unquoted. Example: `di`, `do`
  - Use `null` when no role is assigned.
- The declared count `[n]` **MUST** equal the total number of digital plus analog pin rows.

### §14.5 — Peripherals

- Declared with: `peripherals[n|]{peripheral|param|value}:`
- `peripheral` identifier **MUST** be lowercase alphanumeric, with hyphens or underscores (any peripheral identifier is accepted as long as it is organized and counted).
- Multi-value `param` or `value` fields **MUST** use `;` as separator and **MUST** be quoted if they contain special characters.
- The declared count `[n]` **MUST** match the number of peripheral rows.

### §14.6 — USB Block

- `type` is a free-form string or `null`. Example: `null`, `"USB-C"`
- `chip` is a free-form string or `null`.
- `vid` and `pid` **MUST** each match `^0x[0-9A-Fa-f]{4}$` and **MUST** be quoted.

### §14.7 — Restrictions & Compatibility

- `restrictions` block:
  - `max_io_current` **MUST** use `mA`.
  - `total_current_limit` **MUST** use `mA`.
  - `warnings[n]` is a list array of warnings. Declared count **MUST** match the list.
- `compatibility` keys for PLC profiles:
  - `sw` — free-form string. Example: `"STEP 7 Basic V11+"`
  - `frameworks` — free-form string. Example: `"IEC61131-3;TIA Portal"`
  - `languages` — one or more values from the allowed set (see §14.8)
  - `certifications` — free-form string. Example: `"CE;cULus"`
- The following keys are **forbidden** in PLC profiles: `arduinoCore`, `pio`, `bootloader`

### §14.8 — Languages & Skill Identifiers

- `languages` field **MUST** contain or be one of the language codes from the allowed set: `LD`, `LAD`, `FBD`, `ST`, `SCL`, `IL`, `SFC`, `C`, `C++`, `CPP`, `Python`, `Rust`, `Arduino-CPP`.
- Multiple languages **MUST** be expressed as a quoted semicolon-separated string (e.g. `"LD;FBD;ST;SCL;Python"`).
- Language skill identifiers in `defaultLanguageSkills` **MUST** match: `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` (allowing digits immediately after a hyphen, e.g. `ladder-tia-portal-s7-1200`).
- `boardFamilySkillId` **MUST** end with `plc-family` and be kebab-case (e.g. `siemens-simatic-s7-1200-plc-family`).
- `boardProfileId` **MUST** match: `^[a-z][a-z0-9-]*$` (kebab-case: lowercase letters, digits, hyphens)
  - Example: `siemens-s7-1200`, `schneider-m221`, `allen-bradley-micro820`
- `defaultLanguageSkills[n]` declared count **MUST** match the number of skill entries.
- All skill values **MUST** satisfy the skill identifier pattern.

---

## Standard Section Order (PLC Profiles)

A conformant PLC profile document **MUST** contain the following sections in this exact order:

| Index | Section Name |
|---|---|
| `## 1.` | `DEVICE IDENTIFICATION` |
| `## 2.` | `TECH SPECS & DIMENSIONS` |
| `## 3.` | `ELECTRICAL PROFILE (POWER PINS)` |
| `## 4.` | `GPIO MAP` |
| `## 5.` | `PERIPHERALS & USB` |
| `## 6.` | `RESTRICTIONS & COMPATIBILITY` |
| `## 7.` | `AGENT SKILLS` |

---

## Reference: Canonical PLC Profile Skeleton

```toon
# METADATA:
project_name: siemens-s7-1200-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: siemens-s7-1200
name: "Siemens SIMATIC S7-1200"
manufacturer: Siemens
cpu: "CPU 1214C DC/DC/DC"
category: plc
form_factor: compact
standard: "IEC 61131-3"
image: siemens-s7-1200.svg
url: "https://mall.industry.siemens.com/mall/en/WW/Catalog/Product/6ES72141BG400XB0"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 4194304
  flash_available: 102400
  sram: 102400
  eeprom: 0
  clock: 0
  voltage: "24V"
dims:
  w: 110.0
  h: 100.0
  t: 75.0

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[4|]{name|direction|voltage|type}:
  L+|input|24V|null
  M|null|null|ground
  PE|null|null|ground
  SHIELD|null|null|ground

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[2|]{pin|type|pwm|int|label|roles}:
  0|digital|false|true|"Ia.0 / HSC0"|"di"
  1|digital|false|true|"Ia.1 / HSC1"|"di"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[1|]{peripheral|param|value}:
  profinet|"speed:100Mbit"|"1x-RJ45-10-100Mbps-auto-MDI-X-isolated"
usb:
  type: null
  chip: null
  vid: "0x0000"
  pid: "0x0000"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "500mA"
  total_current_limit: "1000mA"
  warnings[2]:
    - "Do not exceed 24V DC supply voltage"
    - "Ensure proper grounding via PE terminal"
compatibility:
  sw: "STEP 7 Basic V11+"
  frameworks: "IEC61131-3;TIA Portal"
  languages: "LD;FBD;ST;SFC;Python"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: siemens-simatic-s7-1200-plc-family
  boardProfileId: siemens-s7-1200
  defaultLanguageSkills[3]:
    - ladder-tia-portal-s7-1200
    - fbd-tia-portal-s7-1200
    - scl-tia-portal-s7-1200
```
