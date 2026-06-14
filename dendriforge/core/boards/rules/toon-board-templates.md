# DendriForge TOON Board Standard
# ASL 0.1.0 — MCU & PLC Board Profile Schema
# Reference: asl-mcu-profile.rules + asl-plc-profile.rules + toon-dialect-core.rules

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEVIATIONS DETECTED IN DRAFTS vs VALIDATED STANDARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 1. METADATA prefix
#    DRAFT:     ## METADATA:    ← wrong (## is reserved for section headings)
#    STANDARD:  # METADATA:     ← correct (root-level structural block)

# 2. Section numbering mismatch
#    DRAFT:     1.IDENTIFICATION / 2.PARAMETERS / 3.PORTS ...  (component numbering)
#    STANDARD:  1.DEVICE IDENTIFICATION / 2.TECH SPECS & DIMENSIONS /
#               3.ELECTRICAL PROFILE (POWER PINS) / 4.GPIO MAP /
#               5.PERIPHERALS & USB / 6.RESTRICTIONS & COMPATIBILITY / 7.AGENT SKILLS
#               (Both MCU and PLC profiles use these exact section names and order).

# 3. "clock" field in PLC profiles
#    FIX:       PLC profiles must set specs: clock: 0. Cycle time and custom spec keys are NOT supported.

# 4. "arduinoCore", "pio", "bootloader" keys forbidden in PLC profiles
#    FIX:       PLC compatibility uses: sw, frameworks, languages, certifications.
#               MCU keys must NEVER appear in PLC documents.

# 5. boardFamilySkillId mismatch
#    MCU:       boardFamilySkillId: {arch}-family  (e.g. avr-family, xtensa-family)
#    PLC:       boardFamilySkillId: {name}-plc-family  ← must end with plc-family

# 6. "standard" and "form_factor" are PLC-only fields
#    DRAFT:     standard: IEC 61131-3   ← PLC only
#    FIX:       MCU profiles do NOT have "standard" or "form_factor".
#               PLC form_factor MUST be one of: modular | compact | rack | softplc

# 7. languages field is PLC-restricted
#    PLC valid set: LD | LAD | FBD | ST | SCL | IL | SFC | C | C++ | CPP | Python | Rust | Arduino-CPP
#    MCU uses: languages: arduino-cpp (or free-form string)
#    PLC uses: semicolon-separated quoted string, e.g., "LD;FBD;ST" or "Ladder Diagram (LAD);Structured Control Language (SCL)"

# 8. Tabular array rows must NOT have spaces around the pipe delimiter
#    DRAFT:     0 | digital | false | false | D0 RX | uart-rx   ← wrong
#    STANDARD:  0|digital|false|false|D0 RX|uart-rx             ← correct

# 9. Boolean shorthand (t/f) is ONLY allowed inside tabular array rows
#    FIX:       Outside GPIO/powerPins rows, use full literals: true / false

# 10. No "symbol" or "standard" fields in board profiles
#     Components have: symbol, symbol_standard, standard
#     Boards have:     image only (no symbol, no standard — except PLC category)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MANDATORY STRUCTURE — MCU & PLC PROFILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# METADATA:           (root block, no ## prefix)
# ## 1. DEVICE IDENTIFICATION
# ## 2. TECH SPECS & DIMENSIONS
# ## 3. ELECTRICAL PROFILE (POWER PINS)
# ## 4. GPIO MAP
# ## 5. PERIPHERALS & USB
# ## 6. RESTRICTIONS & COMPATIBILITY
# ## 7. AGENT SKILLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §GLOBAL VALID VALUES — BOARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# §CATEGORY
#   MCU:  maker | embedded
#   PLC:  plc

# §FORM_FACTOR (PLC only)
#   modular | compact | rack | softplc

# §STANDARD (PLC only)
#   IEC 61131-3  (or valid extension e.g. "IEC 61131-3 + PLCopen")

# §POWER PIN DIRECTION
#   input | output | null

# §POWER PIN TYPE
#   ground | null

# §GPIO TYPE
#   digital | analog

# §GPIO BOOLEAN FIELDS (pwm, int)
#   t (true) | f (false)  ← shorthand allowed ONLY inside tabular rows
#   true | false          ← required everywhere else

# §GPIO ROLES
#   uart-rx | uart-tx | i2c-sda | i2c-scl
#   spi-mosi | spi-miso | spi-sck | spi-ss
#   adc | int0..intN | status-led | null
#   Multi-role: separated by ; no spaces, MUST be quoted if contains ;

# §PERIPHERALS (3 fields: peripheral | param | value)
#   MCU peripheral names: serial | i2c | spi | pwm | adc | dac
#   PLC peripheral names: Any lowercase alphanumeric name with hyphens/underscores (e.g. profinet)

# §LANGUAGES
#   MCU: free-form string (e.g. arduino-cpp, micropython)
#   PLC: LD | LAD | FBD | ST | SCL | IL | SFC | C | C++ | CPP | Python | Rust | Arduino-CPP (within a quoted, semicolon-separated string)

# §UNIT SUFFIXES
#   MCU:  max_io_current/total_current_limit: mA | specs: voltage: V | specs: flash_total/sram: no suffix (bare bytes)
#   PLC:  max_io_current/total_current_limit: mA | specs: voltage: V

# §AGENT SKILLS — boardFamilySkillId
#   MCU:  {arch}-family    (e.g. avr-family, xtensa-family, arm-family)
#   PLC:  {name}-plc-family (must end with plc-family)

# §boardProfileId
#   kebab-case: [a-z0-9][a-z0-9-]*   e.g. arduino-uno-r3, siemens-s7-1200

# §defaultLanguageSkills entries
#   Must match: ^[a-z][a-z0-9]*(-[a-z0-9]+)*$ (allowing digits immediately after hyphen)
#   MCU examples: arduino-cpp-avr, rust-embassy-avr
#   PLC examples: st-iec61131, ld-tia, fbd-tia, ladder-tia-portal-s7-1200

# §FORBIDDEN KEYS IN PLC PROFILES
#   arduinoCore | pio | bootloader

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VALIDATED TEMPLATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


# ─────────────────────────────────────────────
# TEMPLATE 1 — MCU MAKER
# ─────────────────────────────────────────────

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
category: maker
image: {slug}.svg
url: "{https://... or null}"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: {bytes integer}
  flash_available: {bytes integer}
  sram: {bytes integer}
  eeprom: {bytes integer or 0}
  clock: {Hz integer}
  voltage: "{V unit string e.g. 5V}"
dims:
  w: {mm float}
  h: {mm float}
  t: {mm float}

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  VIN|input|null|null
  5V|output|"5V"|null
  3V3|output|"3.3V"|null
  GND|null|null|ground
  RESET|input|null|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[{n}|]{pin|type|pwm|int|label|roles}:
  0|digital|false|false|"D0 / RX"|uart-rx
  1|digital|false|false|"D1 / TX"|uart-tx
  2|digital|false|true|D2|int0
  3|digital|true|true|"D3 PWM"|int1
  13|digital|false|false|"D13 / LED"|status-led
  14|analog|false|false|A0|"adc:t"
  18|analog|false|false|"A4 / SDA"|"adc:t;i2c-sda"
  19|analog|false|false|"A5 / SCL"|"adc:t;i2c-scl"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  serial|"uarts:1"|"pins:0,1"
  i2c|"channels:1"|"sda:18;scl:19"
  spi|"channels:1"|"miso:12;mosi:11;sck:13;ss:10"
usb:
  type: {USB-B or Micro-USB or USB-C}
  chip: {bridge chip or null}
  vid: "{0x????}"
  pid: "{0x????}"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "{n}mA"
  total_current_limit: "{n}mA"
  warnings[{n}]:
    - "{warning 1}"
    - "{warning 2}"
compatibility:
  arduinoCore: "{x.y.z}"
  pio: {platform identifier}
  frameworks: {framework string}
  languages: {language string e.g. arduino-cpp}
  bootloader: {bootloader name or null}

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: {arch}-family
  boardProfileId: {slug}
  defaultLanguageSkills[{n}]:
    - {lang-env-arch}


# ─────────────────────────────────────────────
# TEMPLATE 2 — MCU EMBEDDED
# ─────────────────────────────────────────────

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
category: embedded
image: {slug}.svg
url: "{https://... or null}"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: {bytes integer}
  flash_available: {bytes integer}
  sram: {bytes integer}
  eeprom: {bytes integer or 0}
  clock: {Hz integer}
  voltage: "{V unit string e.g. 3.3V}"
dims:
  w: {mm float}
  h: {mm float}
  t: {mm float}

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  VIN|input|null|null
  3V3|output|"3.3V"|null
  GND|null|null|ground
  EN|input|null|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[{n}|]{pin|type|pwm|int|label|roles}:
  0|digital|false|false|GPIO0|null
  1|digital|false|false|GPIO1|uart-tx
  3|digital|false|false|GPIO3|uart-rx
  21|digital|false|false|SDA|i2c-sda
  22|digital|false|false|SCL|i2c-scl
  34|analog|false|true|GPIO34|"adc:t"
  35|analog|false|true|GPIO35|"adc:t"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  serial|"uarts:2"|"pins:1,3"
  i2c|"channels:2"|"sda:21;scl:22"
  spi|"channels:2"|"miso:19;mosi:23;sck:18;ss:5"
usb:
  type: {Micro-USB or USB-C}
  chip: {bridge chip or null}
  vid: "{0x????}"
  pid: "{0x????}"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "{n}mA"
  total_current_limit: "{n}mA"
  warnings[{n}]:
    - "{warning 1}"
    - "{warning 2}"
compatibility:
  arduinoCore: "{x.y.z}"
  pio: {platform identifier}
  frameworks: {framework string}
  languages: {language string e.g. arduino-cpp}
  bootloader: {bootloader name or null}

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: {arch}-family
  boardProfileId: {slug}
  defaultLanguageSkills[{n}]:
    - {lang-env-arch}


# ─────────────────────────────────────────────
# TEMPLATE 3 — PLC
# ─────────────────────────────────────────────

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
cpu: {CPU module model}
category: plc
form_factor: {modular|compact|rack|softplc}
standard: "IEC 61131-3"
image: {slug}.svg
url: "{https://... or null}"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: {bytes integer}
  flash_available: {bytes integer}
  sram: {bytes integer}
  eeprom: {bytes integer or 0}
  clock: 0
  voltage: "{V unit string e.g. 24V}"
dims:
  w: {mm float}
  h: {mm float}
  t: {mm float}

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  L+|input|24V|null
  M|null|null|ground
  PE|null|null|ground
  SHIELD|null|null|ground

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[{n}|]{pin|type|pwm|int|label|roles}:
  0|digital|false|true|"Ia.0"|"di"
  1|digital|false|true|"Ia.1"|"di"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  profinet|"speed:100Mbit"|"1x-RJ45-10-100Mbps-auto-MDI-X-isolated"
usb:
  type: null
  chip: null
  vid: "{0x????}"
  pid: "{0x????}"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "{n}mA"
  total_current_limit: "{n}mA"
  warnings[{n}]:
    - "{warning 1}"
    - "{warning 2}"
compatibility:
  sw: "{IDE name and framework details}"
  frameworks: "{supported frameworks}"
  languages: "{LD;FBD;ST;SFC;Python;etc. quoted semicolon-separated}"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: {name}-plc-family
  boardProfileId: {slug}
  defaultLanguageSkills[{n}]:
    - {lang-ide-family}