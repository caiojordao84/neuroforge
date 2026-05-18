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

### §5.1 — Cycle Time

- Scan/cycle time **MUST** be expressed as a **bare integer in milliseconds**.
  - Key name: `cycle_time`
  - Example: `cycle_time: 10`
- The value `0` is **forbidden** (a cycle time of zero is not physically meaningful).
- There is **no `clock` field** in PLC profiles; PLCs are not characterised by a processor clock in the same sense as MCUs.
- Parsers **MUST** reject non-integer and non-positive values in strict mode.

### §5.2 — Allowed Unit Suffixes

The permitted unit suffix set for PLC profiles (value-with-unit strings):

| Suffix | Meaning | Example |
|---|---|---|
| `ms` | Milliseconds | `10ms`, `100ms` |
| `A` | Amperes | `2A` |
| `mA` | Milliamperes | `500mA` |
| `V` | Volts | `24V`, `5V` |
| `W` | Watts | `25W` |
| `bar` | Pressure | `1bar`, `10bar` |
| `kHz` | Kilohertz | `19.2kHz` |
| `KB` | Kilobytes | `100KB`, `4096KB` |

- A number immediately followed by one of the above suffixes (no space) is a **unit string**.
- Unit strings are scalar strings in TOON's type model, **not** numbers.
- `MHz` **MUST NOT** be used as a unit suffix in PLC profiles.
- `clock` as a field key is **forbidden** in PLC profiles; use `cycle_time` instead.

### §5.3 — Boolean Shorthand

- The `t` (true) / `f` (false) shorthand is allowed **only** inside:
  - I/O module tabular rows (see §14.3)
  - Digital channel descriptor rows (see §14.4)
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
- The `M`-area addresses (`%MW`, `%MD`) are valid **only** for internal markers and flags, **not** for I/O module `addr_start` / `addr_end` fields.

### §5.5 — Vendor and Product Identifiers

- `vendor_id` and `product_id` are **free-form** values: integer, quoted string, or unquoted identifier.
  - No hex format constraint is imposed (unlike MCU `vid`/`pid`).
  - Examples: `vendor_id: 18`, `vendor_id: "Siemens"`, `vendor_id: "0x0012"`
  - If expressed as hex, **MUST** be quoted.

---

## §14 — Semantic Validations (PLC Domain)

> This section **replaces** §14 of `asl-mcu-profile.rules` entirely. None of the MCU §14 constraints apply to PLC profiles.

### §14.1 — Device Identification

- `category` **MUST** be exactly: `plc`
- `cpu` identifies the CPU module model; it is a free-form quoted or unquoted string.
  - Example: `cpu: "CPU 1214C DC/DC/DC"`
- `manufacturer` is a free-form string (no enum constraint).
- `form_factor` is restricted to: `modular`, `compact`, `rack`, `softplc`
  - If omitted, it defaults to `modular` in strict mode.
- `standard` is **recommended**; if present, **MUST** be `"IEC 61131-3"` or a valid extension.
  - Example: `standard: "IEC 61131-3"`, `standard: "IEC 61131-3 + PLCopen"`

### §14.2 — Tech Specs

- `cycle_time` **MUST** be present and a positive integer (milliseconds) — see §5.1.
- `supply_voltage` **MUST** use the `V` unit suffix. Example: `24V`
- `memory_work` **MUST** use the `KB` unit suffix. Example: `100KB`
- `memory_load` **MUST** use the `KB` unit suffix. Example: `4096KB`
- `memory_retain` is optional; if present, **MUST** use the `KB` unit suffix.
- `power_consumption` is optional; if present, **MUST** use the `W` unit suffix.
- `dims.w`, `dims.h`, `dims.t` **MUST** be positive floats (millimetres), if present.

### §14.3 — I/O Module Map

- Declared with: `ioModules[n|]{slot|rack|type|channels|addr_start|addr_end|current}:`
- `slot` **MUST** be a non-negative integer.
- `rack` **MUST** be a non-negative integer; **MUST** reference a rack declared in the `racks` collection (see §14.6) if that collection is present.
- `type` is restricted to: `DI`, `DO`, `AI`, `AO`, `DIO`, `AIO`, `safety-DI`, `safety-DO`, `mixed`
- `channels` **MUST** be a positive integer.
- `addr_start` and `addr_end` **MUST** follow IEC 61131-3 address format (see §5.4) and **MUST** be quoted.
- `current` is optional; if present, **MUST** use the `mA` unit suffix.
- Slot numbers **MUST** be unique within the same rack.
- `addr_start` and `addr_end` **MUST** be consistent with the channel count and module type:
  - `DI` / `DO` modules: bit (`X`) addressing — `%IX` or `%QX`
  - `AI` / `AO` modules: word (`W`) or dword (`D`) addressing — `%IW`, `%QW`, `%ID`, `%QD`
- The declared count `[n]` **MUST** match the number of module rows.

### §14.4 — Digital Channel Descriptors (optional, per-channel detail)

- Declared with: `digitalChannels[n|]{addr|direction|label|roles}:`
- `addr` **MUST** follow IEC 61131-3 bit address format and **MUST** be quoted. Example: `"%IX0.0"`
- `direction` is restricted to: `input`, `output`, `bidirectional`
- `label` **MUST** be quoted if it contains spaces or special characters; unquoted otherwise.
- `roles` **MAY** contain multiple sub-values separated by `;` (no surrounding spaces).
  - Permitted role values: `di`, `do`, `safety-di`, `safety-do`, `fast-counter`, `interrupt`, `hsc`
  - When field contains `;`, **MUST** be quoted. Example: `"di;interrupt"`
- Channel addresses **MUST** be unique across all `digitalChannels` entries.
- The declared count `[n]` **MUST** match the number of channel rows.

### §14.5 — Analog Channel Descriptors (optional, per-channel detail)

- Declared with: `analogChannels[n|]{addr|direction|resolution|range|label}:`
- `addr` **MUST** follow IEC 61131-3 word address format and **MUST** be quoted. Example: `"%IW0"`
- `direction` is restricted to: `input`, `output`
- `resolution` **MUST** be expressed as a **bare integer in bits**. Example: `12`
- `range` is a quoted string describing the signal range.
  - Example: `"0-10V"`, `"4-20mA"`, `"-10V..10V"`, `"0-20mA"`
- `label` **MUST** be quoted if it contains spaces or special characters.
- Channel addresses **MUST** be unique across all `analogChannels` entries.
- The declared count `[n]` **MUST** match the number of channel rows.

### §14.6 — Rack Configuration (for modular/rack PLCs)

- Declared with: `racks[n|]{rack|slots|backplane_current|voltage}:`
- `rack` **MUST** be a non-negative integer; values **MUST** be unique across rows.
- `slots` **MUST** be a positive integer.
- `backplane_current` **MUST** use the `mA` unit suffix.
- `voltage` **MUST** use the `V` unit suffix.
- If present, all rack numbers referenced in `ioModules` **MUST** exist in this collection.
- The declared count `[n]` **MUST** match the number of rack rows.

### §14.7 — Peripherals & Protocols

- Declared with: `peripherals[n|]{peripheral|param|value}:`
- `peripheral` is restricted to:
  `serial`, `ethernet`, `profibus`, `profinet`, `modbus-tcp`, `modbus-rtu`, `canopen`, `ethernetip`, `devicenet`, `hart`, `io-link`, `opc-ua`
- Per-peripheral `param` constraints:

  | Peripheral | Required param | Example |
  |---|---|---|
  | `serial` | baud rate + protocol | `"baud:9600"` \| `"proto:RS485"` |
  | `ethernet` / `profinet` / `modbus-tcp` / `ethernetip` / `opc-ua` | port | `"port:502"` |
  | `profibus` / `canopen` / `devicenet` | network address | `"address:1"` |
  | `hart` / `io-link` | channel count | `"channels:8"` |

- Multi-value `param` or `value` fields **MUST** use `;` as separator and **MUST** be quoted.
- The declared count `[n]` **MUST** match the number of peripheral rows.

### §14.8 — Service / USB Port (optional)

- `usb` block is optional for PLCs; many PLCs use proprietary service connectors.
- If present:
  - `type` is a free-form string. Example: `"USB-B"`, `"Mini-USB"`, `"Micro-USB"`, `"proprietary"`
  - `vid` and `pid`, if present, **MUST** each match `^0x[0-9A-Fa-f]{4}$` and **MUST** be quoted.
- If the service interface is not USB, use a `service` block instead:

  ```toon
  service:
    type: MPI
    connector: DB9
    protocol: "MPI/DP"
  ```

### §14.9 — Restrictions & Compatibility

- `restrictions` block follows the same structure as the MCU dialect.
  - `max_io_current` **MUST** use `mA`; `supply_voltage` **MUST** use `V`; power **MUST** use `W`.
- `compatibility` keys for PLC profiles:
  - `standard` — **MUST** be `"IEC 61131-3"` or a valid extension (e.g., `"IEC 61131-3 + PLCopen"`)
  - `ide` — free-form string. Example: `"TIA Portal v17"`, `"CODESYS 3.5"`, `"Unity Pro"`
  - `runtime` — free-form string. Example: `"S7-1200 FW4.5"`, `"CODESYS SL"`
  - `languages` — one or more values from the IEC 61131-3 restricted set (see §14.10)
- The following keys are **forbidden** in PLC profiles: `arduinoCore`, `pio`, `bootloader`

### §14.10 — Languages & Skill Identifiers

- `languages` field **MUST** contain only values from the IEC 61131-3 restricted set:

  | Code | Language |
  |---|---|
  | `LD` | Ladder Diagram |
  | `FBD` | Function Block Diagram |
  | `ST` | Structured Text |
  | `IL` | Instruction List *(deprecated in IEC 61131-3 ed.3, but valid)* |
  | `SFC` | Sequential Function Chart |

- Multiple languages **MUST** be expressed as a list array or inline semicolon-separated (quoted, no pipe).
  - Inline example: `languages: "LD;FBD;ST"`
  - List example:
    ```toon
    languages[3]:
      - LD
      - FBD
      - ST
    ```
- Language skill identifiers in `defaultLanguageSkills` **MUST** match: `^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$`
- `boardFamilySkillId` **MUST** be: `plc-family`
- `boardProfileId` **MUST** match: `^[a-z][a-z0-9-]*$` (kebab-case: lowercase letters, digits, hyphens)
  - Example: `siemens-s7-1200`, `schneider-m221`, `allen-bradley-micro820`
- `defaultLanguageSkills[n]` declared count **MUST** match the number of skill entries.
- All skill values **MUST** satisfy the §14.10 skill identifier pattern.

---

## Standard Section Order (PLC Profiles)

A conformant PLC profile document **MUST** contain the following sections in this order:

| Index | Section Name |
|---|---|
| `## 1.` | `DEVICE IDENTIFICATION` |
| `## 2.` | `TECH SPECS & DIMENSIONS` |
| `## 3.` | `ELECTRICAL PROFILE (POWER SUPPLY)` |
| `## 4.` | `I/O MODULE MAP` |
| `## 5.` | `PERIPHERALS & PROTOCOLS` |
| `## 6.` | `RESTRICTIONS & COMPATIBILITY` |
| `## 7.` | `AGENT SKILLS` |

Additional sections **MAY** be appended at `## 8.` and beyond (e.g., safety certification, function block library manifest, rack diagram metadata).

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
  cycle_time: 1
  memory_work: 100KB
  memory_load: 4096KB
  memory_retain: 10KB
  supply_voltage: 24V
  power_consumption: 12W
dims:
  w: 110.0
  h: 100.0
  t: 75.0

## 3. ELECTRICAL PROFILE (POWER SUPPLY):
# Format: name | direction | voltage | type
powerPins[4|]{name|direction|voltage|type}:
  L+|input|24V|null
  M|null|null|ground
  PE|null|null|ground
  SHIELD|null|null|ground

## 4. I/O MODULE MAP:
# Format: slot | rack | type | channels | addr_start | addr_end | current
ioModules[4|]{slot|rack|type|channels|addr_start|addr_end|current}:
  0|0|DI|14|"%IX0.0"|"%IX0.7"|null
  1|0|DO|10|"%QX0.0"|"%QX0.7"|null
  2|0|AI|2|"%IW64"|"%IW66"|null
  3|0|AO|2|"%QW64"|"%QW66"|null

## 5. PERIPHERALS & PROTOCOLS:
# Format: peripheral | param | value
peripherals[3|]{peripheral|param|value}:
  ethernet|"port:102"|"proto:PROFINET;Modbus-TCP"
  modbus-tcp|"port:502"|"addr:1"
  opc-ua|"port:4840"|null

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "500mA"
  total_current_limit: "1000mA"
  warnings[2]:
    - "Do not exceed 24V DC supply voltage"
    - "Ensure proper grounding via PE terminal"
compatibility:
  standard: "IEC 61131-3"
  ide: "TIA Portal v17"
  runtime: "S7-1200 FW4.5"
  languages: "LD;FBD;ST;SFC"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: plc-family
  boardProfileId: siemens-s7-1200
  defaultLanguageSkills[3]:
    - st-iec61131
    - ld-tia
    - fbd-tia
```
