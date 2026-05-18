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
#    MCU:       1.DEVICE IDENTIFICATION / 2.TECH SPECS & DIMENSIONS /
#               3.ELECTRICAL PROFILE (POWER PINS) / 4.GPIO MAP /
#               5.PERIPHERALS & USB / 6.RESTRICTIONS & COMPATIBILITY / 7.AGENT SKILLS
#    PLC:       1.DEVICE IDENTIFICATION / 2.TECH SPECS & DIMENSIONS /
#               3.ELECTRICAL PROFILE (POWER SUPPLY) / 4.IO MODULE MAP /
#               5.PERIPHERALS & PROTOCOLS / 6.RESTRICTIONS & COMPATIBILITY /
#               7.AGENT SKILLS

# 3. "clock" field forbidden in PLC profiles
#    DRAFT:     clock: 16000000  ← MCU only
#    FIX:       PLC uses cycletime (integer, ms). clock is FORBIDDEN in PLCs.

# 4. "arduinoCore", "pio", "bootloader" keys forbidden in PLC profiles
#    FIX:       PLC compatibility uses: standard, ide, runtime, languages
#               MCU keys must NEVER appear in PLC documents

# 5. boardFamilySkillId mismatch
#    MCU:       boardFamilySkillId: {arch}-family  (e.g. avr-family, xtensa-family)
#    PLC:       boardFamilySkillId: plc-family      ← fixed value, no deviation allowed

# 6. "standard" and "formfactor" are PLC-only fields
#    DRAFT:     standard: IEC 61131-3   ← PLC only
#    FIX:       MCU profiles do NOT have "standard" or "formfactor"
#               PLC formfactor MUST be one of: modular | compact | rack | softplc

# 7. languages field is PLC-only and restricted
#    PLC valid set: LD | FBD | ST | IL | SFC
#    DRAFT:     languages: arduino-cpp   ← MCU form
#    FIX:       MCU uses: languages: arduino-cpp (free-form string)
#               PLC uses: languages: LD|FBD|ST  (restricted IEC 61131-3 set only)

# 8. Tabular array rows must NOT have spaces around the pipe delimiter
#    DRAFT:     0 | digital | false | false | D0 RX | uart-rx   ← wrong
#    STANDARD:  0|digital|false|false|D0 RX|uart-rx             ← correct

# 9. Boolean shorthand (t/f) is ONLY allowed inside tabular array rows
#    FIX:       Outside GPIO/IO rows, use full literals: true / false

# 10. No "symbol" or "standard" fields in board profiles
#     Components have: symbol, symbol_standard, standard
#     Boards have:     image only (no symbol, no standard — except PLC category)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MANDATORY STRUCTURE — MCU PROFILES
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
# MANDATORY STRUCTURE — PLC PROFILES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# METADATA:           (root block, no ## prefix)
# ## 1. DEVICE IDENTIFICATION
# ## 2. TECH SPECS & DIMENSIONS
# ## 3. ELECTRICAL PROFILE (POWER SUPPLY)
# ## 4. IO MODULE MAP
# ## 5. PERIPHERALS & PROTOCOLS
# ## 6. RESTRICTIONS & COMPATIBILITY
# ## 7. AGENT SKILLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §GLOBAL VALID VALUES — BOARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# §CATEGORY
#   MCU:  maker | embedded
#   PLC:  plc

# §FORMFACTOR (PLC only)
#   modular | compact | rack | softplc

# §STANDARD (PLC only)
#   IEC 61131-3  (or valid extension e.g. "IEC 61131-3 PLCopen")

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

# §IO MODULE TYPE (PLC)
#   DI | DO | AI | AO | DIO | AIO | safety-DI | safety-DO | mixed

# §IEC 61131-3 ADDRESSES (PLC)
#   Digital input bit:   IX{rack}.{slot}.{ch}   e.g. "IX0.0"
#   Digital output bit:  QX{rack}.{slot}.{ch}   e.g. "QX1.3"
#   Analog input word:   IW{n}                  e.g. "IW0"
#   Analog output word:  QW{n}                  e.g. "QW2"
#   All addresses MUST be quoted (contain . which triggers quoting)

# §PERIPHERAL (MCU)
#   serial | i2c | spi | pwm | adc | dac

# §PERIPHERAL (PLC)
#   serial | ethernet | profibus | profinet | modbus-tcp | modbus-rtu
#   canopen | ethernetip | devicenet | hart | io-link | opc-ua

# §LANGUAGES
#   MCU: free-form string (e.g. arduino-cpp, micropython)
#   PLC: LD | FBD | ST | IL | SFC  (IEC 61131-3 only)

# §UNIT SUFFIXES
#   MCU:  mA | V | KB | kHz
#   PLC:  ms | A | mA | V | W | bar | kHz | KB

# §AGENT SKILLS — boardFamilySkillId
#   MCU:  {arch}-family    (e.g. avr-family, xtensa-family, arm-family)
#   PLC:  plc-family       (fixed value)

# §boardProfileId
#   kebab-case: [a-z0-9][a-z0-9-]*   e.g. arduino-uno-r3, siemens-s7-1200

# §defaultLanguageSkills entries
#   Must match: [a-z][a-z0-9-]+[-][a-z][a-z0-9-]+
#   MCU examples: arduino-cpp-avr, rust-embassy-avr
#   PLC examples: st-iec61131, ld-tia, fbd-tia

# §FORBIDDEN KEYS IN PLC PROFILES
#   arduinoCore | pio | bootloader | clock

# §FORBIDDEN KEYS IN MCU PROFILES
#   cycletime | formfactor | standard (IEC 61131-3)

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
ASLversion: 0.2.0

## 1. DEVICE IDENTIFICATION:
id: {slug}
name: "{Display Name}"
manufacturer: {Manufacturer}
mcu: {MCU model}
category: maker
image: {slug}.svg
url: {https://... or null}

## 2. TECH SPECS & DIMENSIONS:
specs:
  flashTotal: {bytes}
  flashAvailable: {bytes}
  sram: {bytes}
  eeprom: {bytes or 0}
  clock: {Hz integer}
  voltage: {V unit string e.g. 5V}
  dims:
    w: {mm float}
    h: {mm float}
    t: {mm float}

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  VIN|input|null|null
  5V|output|5V|null
  3V3|output|3.3V|null
  GND|null|null|ground
  RESET|input|null|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[{n}|]{pin|type|pwm|int|label|roles}:
  0|digital|f|f|D0 RX|uart-rx
  1|digital|f|f|D1 TX|uart-tx
  2|digital|f|t|D2|int0
  3|digital|t|t|D3 PWM|int1
  13|digital|f|f|D13 LED|status-led
  14|analog|f|f|A0|adct
  18|analog|f|f|A4 SDA|adct;i2c-sda
  19|analog|f|f|A5 SCL|adct;i2c-scl

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  serial|uart|s1|pins|0,1
  i2c|channels|1|sda|18|scl|19
  spi|channels|1|miso|12|mosi|11|sck|13|ss|10
usb:
  type: {USB-B or Micro-USB or USB-C}
  chip: {bridge chip or null}
  vid: "{0x????}"
  pid: "{0x????}"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  maxIoCurrent: {n}mA
  totalCurrentLimit: {n}mA
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
ASLversion: 0.2.0

## 1. DEVICE IDENTIFICATION:
id: {slug}
name: "{Display Name}"
manufacturer: {Manufacturer}
mcu: {MCU model}
category: embedded
image: {slug}.svg
url: {https://... or null}

## 2. TECH SPECS & DIMENSIONS:
specs:
  flashTotal: {bytes}
  flashAvailable: {bytes}
  sram: {bytes}
  eeprom: {bytes or 0}
  clock: {Hz integer}
  voltage: {V unit string e.g. 3.3V}
  dims:
    w: {mm float}
    h: {mm float}
    t: {mm float}

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  VIN|input|null|null
  3V3|output|3.3V|null
  GND|null|null|ground
  EN|input|null|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
gpio[{n}|]{pin|type|pwm|int|label|roles}:
  0|digital|f|f|GPIO0|null
  1|digital|f|f|GPIO1|uart-tx
  3|digital|f|f|GPIO3|uart-rx
  21|digital|f|f|SDA|i2c-sda
  22|digital|f|f|SCL|i2c-scl
  34|analog|f|t|GPIO34|adct
  35|analog|f|t|GPIO35|adct

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  serial|uarts|2|pins|1,3
  i2c|channels|2|sda|21|scl|22
  spi|channels|2|miso|19|mosi|23|sck|18|ss|5
  adc|channels|18|res|12
  dac|channels|2|pins|25,26
usb:
  type: {Micro-USB or USB-C}
  chip: {bridge chip or null}
  vid: "{0x????}"
  pid: "{0x????}"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  maxIoCurrent: {n}mA
  totalCurrentLimit: {n}mA
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
ASLversion: 0.2.0

## 1. DEVICE IDENTIFICATION:
id: {slug}
name: "{Display Name}"
manufacturer: {Manufacturer}
cpu: {CPU module model}
category: plc
formfactor: {modular|compact|rack|softplc}
standard: "IEC 61131-3"
image: {slug}.svg
url: {https://... or null}

## 2. TECH SPECS & DIMENSIONS:
specs:
  cycleTime: {ms positive integer}
  memoryWork: {n}KB
  memoryLoad: {n}KB
  memoryRetain: {n}KB
  supplyVoltage: {V unit string e.g. 24V}
  powerConsumption: {n}W
  dims:
    w: {mm float}
    h: {mm float}
    t: {mm float}

## 3. ELECTRICAL PROFILE (POWER SUPPLY):
# Format: name | direction | voltage | type
powerPins[{n}|]{name|direction|voltage|type}:
  L|input|24V|null
  M|null|null|ground
  PE|null|null|ground
  SHIELD|null|null|ground

## 4. IO MODULE MAP:
# Format: slot | rack | type | channels | addrStart | addrEnd | current
ioModules[{n}|]{slot|rack|type|channels|addrStart|addrEnd|current}:
  0|0|DI|{n}|"IX0.0"|"IX0.{n-1}"|null
  1|0|DO|{n}|"QX0.0"|"QX0.{n-1}"|null
  2|0|AI|{n}|"IW64"|"IW{64+(n-1)*2}"|null
  3|0|AO|{n}|"QW64"|"QW{64+(n-1)*2}"|null

## 5. PERIPHERALS & PROTOCOLS:
# Format: peripheral | param | value
peripherals[{n}|]{peripheral|param|value}:
  ethernet|port|102|proto|PROFINET
  modbus-tcp|port|502|addr|1
  opc-ua|port|4840|null|null

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  maxIoCurrent: {n}mA
  totalCurrentLimit: {n}mA
  warnings[{n}]:
    - "{warning 1}"
    - "{warning 2}"
compatibility:
  standard: "IEC 61131-3"
  ide: {IDE name e.g. TIA Portal v17}
  runtime: {runtime e.g. S7-1200 FW4.5}
  languages: {LD|FBD|ST|SFC}

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: plc-family
  boardProfileId: {slug}
  defaultLanguageSkills[{n}]:
    - {lang-ide e.g. st-iec61131}