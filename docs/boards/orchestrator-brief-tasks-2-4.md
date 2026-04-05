# Critical Tasks 2-4: TOON Schema Creation Brief

## Context
You are creating the foundational TOON schemas for the NeuroForge Board/SVG/Component/ASL system.

## Available Resources
- **Architecture Document**: `docs/boards/neuroforge_board_asl_architecture_v3_EN.md` (Section 3-5)
- **Existing JSON Schema**: `docs/boards/board-schema.json` (v2.0, needs migration to TOON)
- **TOON Crate**: `toon-rs` v2.1.0 with full serde support (MSRV 1.85)

## Task 2: Create `board-schema.toon`

**Location**: `docs/boards/board-schema.toon`

### Required Extensions (from Section 3.1):
```toon
# powerPins.name — add to enum: VBUS, VSYS, 3V3_EN, EN, VCC, VBAT

# specs — remove additionalProperties: false, add:
# cores:        integer, minimum: 1
# architecture: string

# gpio — add field:
# physicalPin: integer  # Physical connector pin number

# category enum — add: plc
```

### New Required Fields (Sections 3.2-3.3):
1. **`svgMap`** - Links GPIO pins to SVG coordinates
2. **`aslProfile`** - Provides AI agent context per target language
3. **`plcProfile`** - For PLC category boards (roadmap)

### Reference: Current board-schema.json Structure
- $schema, id, title, type: object
- Properties: id, name, manufacturer, mcu, category, image, url, specs, dimensions, powerPins, gpio, peripherals, usb, restrictions, compatibility, languages, bootloader
- **PROBLEMS TO FIX**:
  - `powerPins.name` enum is rigid (missing VBUS, VSYS, etc.)
  - `specs.additionalProperties: false` blocks cores/architecture
  - No `svgMap`, no `aslProfile`, no `plc`
  - `gpio` missing `physicalPin` vs `logicalPin` distinction

## Task 3: Create `component-schema.toon`

**Location**: `docs/boards/component-schema.toon`

### Structure (from Section 4):
```toon
id: string
name: string
category: sensor | actuator | indicator | passive | communication
subcategory: string
svgId: string
voltage: number
signals: 
  | id | name | direction | signalType | required | svgAnchorId |
aslHint:
  semanticType: string
  defaultOperation: string
  include: string?
  hmiWidget: led | gauge | slider | toggle | chart | label | numeric | arc | none
  hmiUnit: string?
  hmiMin: number?
  hmiMax: number?
restrictions:
  requiresPwm: boolean?
  requiresAdc: boolean?
  maxCurrentMa: number?
  notes: string[]
```

### Component Categories (Section 4):
| Category | Examples |
|----------|----------|
| sensor | LDR, DHT22, HC-SR04, PIR, MPU6050, encoder |
| actuator | Servo, DC motor, stepper motor, pump |
| indicator | Simple LED, RGB LED, buzzer, 7-seg display, OLED |
| passve | Resistor, capacitor, potentiometer |
| communication | RF module, BT UART, CAN transceiver |

## Task 4: Create `connection-colors.toon`

**Location**: `docs/boards/connection-colors.toon`

### Structure (from Section 5):
```toon
version: 1.0

connections:
| key      | hex     | name                    | cssVar                  |
| power    | #DC2626 | Power (VCC/5V/3V3)      | --color-wire-power      |
| gnd      | #171717 | Ground                  | --color-wire-gnd        |
| digital  | #2563EB | Digital I/O             | --color-wire-digital    |
| analog   | #CA8A04 | Analog I/O              | --color-wire-analog     |
| pwm      | #EA580C | PWM Output              | --color-wire-pwm        |
| i2c      | #16A34A | I2C (SDA/SCL)           | --color-wire-i2c        |
| spi      | #7C3AED | SPI (MOSI/MISO/SCK)     | --color-wire-spi        |
| uart     | #0891B2 | UART (TX/RX)            | --color-wire-uart       |
| reserved | #6B7280 | Reserved / N/A          | --color-wire-reserved   |
| warning  | #F59E0B | Strapping / Caution     | --color-wire-warning    |

pinClasses:
| cssClass        | connectionKey |
| pin-digital     | digital       |
| pin-analog      | analog        |
| pin-pwm         | pwm           |
| pin-interrupt   | digital       |
| pin-strapping   | warning       |
| pin-reserved    | reserved      |
| pin-power       | power         |
| pin-gnd         | gnd           |
| pin-warning     | warning       |
| pin-touch       | digital       |
| pin-input-only  | analog        |
| pin-i2c         | i2c           |
| pin-spi         | spi           |
| pin-uart        | uart          |
```

## Output Requirements

Create three files in `docs/boards/`:
1. `board-schema.toon` - Extended board schema with all fixes
2. `component-schema.toon` - New component schema
3. `connection-colors.toon` - Canonical wire colors

Use the TOON format exactly as specified in the architecture document. Include proper comments for clarity.

## Verification
After creating each file, ensure:
- Valid TOON syntax (tabular arrays where appropriate)
- All required fields present
- Compatible with existing `arduino-uno.json` structure
- Ready for Phase A board migration