# ASL MCU Board Profile — Dialect Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24) + domain extensions for ASL MCU board profiles
**File:** `asl-mcu-profile.rules`
**Inherits:** `toon-dialect-core.rules` (§1–§13 + §15) — all core rules apply unchanged
**Scope:** Microcontroller board profiles (`category: maker` or `category: embedded`)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

> This file defines **only** the domain-specific overrides: §5 domain constraints and §14 semantic validations.
> Sections §1–§4, §6–§13, and §15 are inherited from `toon-dialect-core.rules` without modification.

---

## §5 — Scalar Value Types (MCU Domain Overrides)

Core scalar rules (integer, float, bool, null, hex, string, quoting triggers) are inherited from `toon-dialect-core.rules §5`. The following domain constraints **extend or restrict** the core rules for MCU profiles.

### §5.1 — Clock Frequency

- The processor clock **MUST** be expressed as a **bare integer in Hz**.
  - Key name: `clock`
  - Example: `clock: 16000000`
- The `MHz` string form (e.g., `16MHz`) is **forbidden** for the `clock` field; it would produce a string type instead of a number, breaking arithmetic operations in parsers.
- Parsers **MUST** reject non-integer and non-positive values in strict mode.

### §5.2 — Allowed Unit Suffixes

The permitted unit suffix set for MCU profiles (value-with-unit strings, §5 core):

| Suffix | Meaning | Example |
|---|---|---|
| `mA` | Milliamperes | `40mA` |
| `V` | Volts | `5V`, `3.3V` |
| `KB` | Kilobytes | `512KB` |
| `kHz` | Kilohertz | `400kHz` |

- A number immediately followed by one of the above suffixes (no space) is a **unit string**.
- Unit strings are scalar strings in TOON's type model, **not** numbers.
- `MHz` **MUST NOT** be used as a unit suffix in any field; express clock as integer Hz (see §5.1).
- `W`, `ms`, `A`, `bar` are **not** in scope for MCU profiles.

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

---

## §14 — Semantic Validations (MCU Domain)

### §14.1 — Device Identification

- `category` **MUST** be one of: `maker`, `embedded`.
- `mcu` is a free-form string identifying the microcontroller model. Example: `ATmega328P`, `ESP32-S3`.
- `manufacturer` is a free-form unquoted or quoted string.
- `image` is a relative filename string; no path traversal characters allowed.

### §14.2 — Tech Specs

- `flash_total` and `flash_available` **MUST** be positive integers (bytes).
- `flash_available` **MUST** be less than or equal to `flash_total`.
- `sram` and `eeprom` **MUST** be non-negative integers (bytes).
- `clock` **MUST** be a positive integer (Hz) — see §5.1.
- `voltage` **MUST** use the `V` unit suffix. Example: `5V`, `3.3V`.
- `dims.w`, `dims.h`, `dims.t` **MUST** be positive floats (millimetres).

### §14.3 — Power Pins

- Declared with: `powerPins[n|]{name|direction|voltage|type}:`
- `direction` is restricted to: `input`, `output`, `null`
- `type` is restricted to: `ground`, `null`
- `voltage` **MUST** use the `V` unit suffix when non-null. Example: `5V`, `3.3V`
- Pin names **MUST** be unique within `powerPins`.
- The declared count `[n]` **MUST** match exactly the number of power pin rows.

### §14.4 — GPIO Map

- Declared with: `gpio[n|]{pin|type|pwm|int|label|roles}:`
- `pin` **MUST** be a non-negative integer; values **MUST** be unique across all GPIO rows.
- `type` is restricted to: `digital`, `analog`
- `pwm` and `int` **MUST** use boolean values: `t`, `f`, `true`, or `false`.
- `label`:
  - Composite labels (containing spaces, `/`, or other special characters) **MUST** be quoted.
  - Simple single-word labels without special characters **MAY** be unquoted (e.g., `D2`, `A0`).
- `roles`:
  - MAY contain multiple roles separated by `;` with **no surrounding spaces**.
  - When the field contains `:` or `;`, it **MUST** be quoted. Example: `"adc:t;i2c-sda"`
  - Single unambiguous roles **MAY** be unquoted. Example: `uart-rx`, `int0`
  - Use `null` when no role is assigned.
- The declared count `[n]` **MUST** equal the total number of digital plus analog pin rows.

### §14.5 — Peripherals

- Declared with: `peripherals[n|]{peripheral|param|value}:`
- `peripheral` **MUST** be one of: `serial`, `i2c`, `spi`, `pwm`, `adc`, `dac`
- Pin references in `value` fields (e.g., `sda:18;scl:19`) **MUST** reference pin numbers declared in `gpio[n]`.
- Multi-pin values **MUST** use `;` as separator (no surrounding spaces) and **MUST** be quoted.
  - Example: `"sda:18;scl:19"`, `"miso:12;mosi:11;sck:13;ss:10"`
- The `pins` param for `serial` uses `,` as separator within a quoted string (legacy). New profiles should use `;`.
- The declared count `[n]` **MUST** match the number of peripheral rows.

### §14.6 — USB Block

- `type` is a free-form string. Example: `USB-B`, `Micro-USB`, `USB-C`
- `chip` is a free-form string. Example: `ATmega16U2`, `CH340`
- `vid` and `pid` **MUST** each match `^0x[0-9A-Fa-f]{4}$` and **MUST** be quoted.

### §14.7 — Restrictions

- `max_io_current` **MUST** use the `mA` unit suffix.
- `total_current_limit` **MUST** use the `mA` unit suffix.
- `warnings[n]` is a list array; each entry is a quoted string.
- The declared count `[n]` **MUST** match the number of warning entries.

### §14.8 — Compatibility

- `arduinoCore` is a version string; **MUST** be quoted if it contains dots. Example: `"1.8.19"`
- `pio` is a PlatformIO platform identifier. Example: `atmelavr`
- `frameworks` is a free-form string. Example: `arduino`
- `languages` is a free-form string. Example: `arduino-cpp`
- `bootloader` is a free-form string. Example: `optiboot`

### §14.9 — Language & Skill Identifiers

- Language identifiers in `defaultLanguageSkills` **MUST** match: `^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$`
  - Example: `arduino-cpp-avr`, `rust-embassy-avr`
- `boardProfileId` **MUST** match: `^[a-z][a-z0-9-]*$` (kebab-case: lowercase letters, digits, hyphens)
  - Example: `arduino-uno-r3`, `esp32-devkit-v1`
- `defaultLanguageSkills[n]` declared count **MUST** match the number of skill entries.

---

## Standard Section Order (MCU Profiles)

A conformant MCU profile document **MUST** contain the following sections in this order:

| Index | Section Name |
|---|---|
| `## 1.` | `DEVICE IDENTIFICATION` |
| `## 2.` | `TECH SPECS & DIMENSIONS` |
| `## 3.` | `ELECTRICAL PROFILE (POWER PINS)` |
| `## 4.` | `GPIO MAP` |
| `## 5.` | `PERIPHERALS & USB` |
| `## 6.` | `RESTRICTIONS & COMPATIBILITY` |
| `## 7.` | `AGENT SKILLS` |

Additional sections **MAY** be appended at `## 8.` and beyond for domain-specific data (e.g., flashing procedures, shield compatibility matrix).

---

## Reference: Toon 2 — Canonical MCU Profile Example

```toon
# METADATA:
project_name: arduino-uno-r3-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: arduino-uno
name: "Arduino Uno R3"
manufacturer: Arduino
mcu: ATmega328P
category: maker
image: arduino-uno-r3.svg
url: "https://store.arduino.cc/products/arduino-uno-rev3"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 32768
  flash_available: 32256
  sram: 2048
  eeprom: 1024
  clock: 16000000
  voltage: "5V"
dims:
  w: 68.6
  h: 53.4
  t: 1.6

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[7|]{name|direction|voltage|type}:
  VIN|input|null|null
  5V|output|"5V"|null
  3V3|output|"3.3V"|null
  GND|null|null|ground
  RESET|input|null|null
  IOREF|output|"5V"|null
  AREF|input|null|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[20|]{pin|type|pwm|int|label|roles}:
  0|digital|false|false|"D0 / RX"|uart-rx
  1|digital|false|false|"D1 / TX"|uart-tx
  2|digital|false|true|D2|int0
  3|digital|true|true|"D3 PWM"|int1
  4|digital|false|false|D4|null
  5|digital|true|false|"D5 PWM"|null
  6|digital|true|false|"D6 PWM"|null
  7|digital|false|false|D7|null
  8|digital|false|false|D8|null
  9|digital|true|false|"D9 PWM"|null
  10|digital|true|false|"D10 PWM / SS"|spi-ss
  11|digital|true|false|"D11 PWM / MOSI"|spi-mosi
  12|digital|false|false|"D12 / MISO"|spi-miso
  13|digital|false|false|"D13 / LED / SCK"|"spi-sck;status-led"
  14|analog|false|false|A0|"adc:t"
  15|analog|false|false|A1|"adc:t"
  16|analog|false|false|A2|"adc:t"
  17|analog|false|false|A3|"adc:t"
  18|analog|false|false|"A4 / SDA"|"adc:t;i2c-sda"
  19|analog|false|false|"A5 / SCL"|"adc:t;i2c-scl"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[3|]{peripheral|param|value}:
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
  warnings[3]:
    - "Pins 0/1 shared with USB Serial"
    - "Pin 13 has onboard LED interference"
    - "Polyfuse protects USB over 500mA"
compatibility:
  arduinoCore: "1.8.19"
  pio: atmelavr
  frameworks: arduino
  languages: arduino-cpp
  bootloader: optiboot

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: avr-family
  boardProfileId: arduino-uno-r3
  defaultLanguageSkills[2]:
    - arduino-cpp-avr
    - rust-embassy-avr
	```
