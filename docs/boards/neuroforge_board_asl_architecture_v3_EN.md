# NeuroForge — Board/SVG/Component/ASL Architecture v3

> **Version:** 0.3
> **Status:** Planning Draft
> **Branch:** preRust
> **Last Revision:** April 2026
> **Key Changes from v2:** TOON replaces JSON for all data files and agent context; SchemaSmith tool introduced; roadmap updated.

---

## Overview

This document defines the architecture of the interdependent **Board ↔ Component ↔ SVG ↔ ASL Tree** system in NeuroForge. The goal is an ecosystem where any modification to one artifact propagates deterministically to all others, and where the AI Agent has enough structured context to achieve a confidence score ≥ 85% when generating code for any target.

The system is composed of four layers:

1. **Schemas** — the typed contracts (`board-schema.toon`, `component-schema.toon`, `connection-colors.toon`)
2. **Data** — the concrete files (`{board-id}.toon`, `{component-id}.toon`)
3. **Visual** — SVGs for boards and components, linked to data via `data-pin` attributes
4. **IR + Agent** — the `AslProgram` as the semantic source of truth, the `TranspileContext` as the context envelope, and the agent skills system

---

## Why TOON?

**TOON (Token-Oriented Object Notation)** replaces JSON as the file format for all board, component, and ASL data files. It is a compact, human-readable encoding of the JSON data model, designed specifically to minimize LLM token usage.

| Dimension | JSON | TOON |
|-----------|------|------|
| Token usage | Baseline | 30–60% fewer tokens |
| Human readability | Medium — verbose braces and quotes | High — indentation + tabular arrays |
| Comments | ✗ Not supported | ✓ `#` line comments |
| Arrays of objects | Repeated keys per object | Header row + compact data rows |
| Quotes on keys | Always required | Not required |
| Serde support | Universal | `toon-format` crate (Rust), libs for Java, R, JS |

**Impact on the agent pipeline**: the `TranspileContext` envelope (board profile + component profiles + AslProgram) is passed as a TOON string to the agent. Moving from JSON to TOON reduces context size by ~40–55% on typical programs, which directly reduces API cost and latency on every transpilation call.

### TOON Syntax Reference

**Scalar values and nested objects:**
```toon
# Board file — arduino-uno.toon
id: arduino-uno
name: Arduino Uno R3
specs:
  mcu: ATmega328P
  frequency_mhz: 16
  flash_kb: 32
  ram_kb: 2
  voltage: 5.0
languages: [arduino-cpp]
```

**Arrays of uniform objects — tabular format (the key token saver):**
```toon
gpio:
| pin | label      | pwm   | interrupt | adc   | warning                  |
| 0   | D0/RX      | false | false     | false | Serial RX — avoid        |
| 1   | D1/TX      | false | false     | false | Serial TX — avoid        |
| 2   | D2         | false | true      | false |                          |
| 3   | D3 PWM     | true  | true      | false |                          |
| 13  | D13/LED    | false | false     | false | Built-in LED             |
| A0  | A0         | false | false     | true  |                          |
```

**The same block in JSON would require 8× more tokens** due to repeated key names on every row.

**ASL program file — blink.asl (TOON format):**
```toon
# ASL v4.0.0 — Blink example
asl_version: 4.0.0
metadata:
  name: blink
  board: arduino-uno
  target: arduino-cpp

setup:
  - pinMode: [13, OUTPUT]

loop:
  - digitalWrite: [13, HIGH]
  - delay: 500
  - digitalWrite: [13, LOW]
  - delay: 500
```

---

## 1. Current State — Diagnosis

### What Is Already Working

- `board-schema.json` v2.0 has a solid structure: `specs`, `gpio` with `pwm/interrupt/adc/dac/touch/inputOnly`, `peripherals`, `restrictions.warnings`.
- `arduino-uno.json` is clean and compliant with the schema.
- `raspberry-pi-pico.json` has `languages: ["arduino-cpp", "micropython", "circuitpython"]`.
- `esp32-devkitc.json` has `strapping: true` and an inline `warning` per pin.
- The Arduino Uno R3 SVG exists with defined pin coordinates.
- `AslProgram` (ASL v4.0.0) is a robust IR: `AslStatement` covers GPIO, Serial, I2C, SPI, PWM, IEC timers/counters, Servo, RGB, `StateMachine`.
- ASL Semantic Dictionary v1.2.3 is stabilised as the standard.

### Critical Gaps

| Area | Gap | Impact |
|---|---|---|
| File format | All data files are JSON — verbose, no comments, high token cost | Agent context is unnecessarily large |
| `board-schema` | `powerPins.name` rigid enum — blocks VBUS, VSYS, EN | ESP32 and Pico fail validation |
| `board-schema` | `specs.additionalProperties: false` — blocks `cores`, `architecture` | ESP32 currently invalid |
| `board-schema` | No `svgMap` — SVG link not formalised | Renderer cannot map pins to coordinates |
| `board-schema` | No `aslProfile` — no hook for the agent | Agent has no structured context |
| `board-schema` | `gpio` missing `physicalPin` vs `logicalPin` | SVG uses physical position; ASL uses logical number |
| `board-schema` | `plc` category absent | ST/IEC roadmap blocked |
| Board files | `esp32` has `specs.cores` and `architecture` outside schema | File currently invalid |
| Board files | `pico` has multiple `GND` entries with the same `name` | Violates implicit uniqueness |
| Board files | None have `svgMap` or `aslProfile` | — |
| Components | `component-schema` does not exist | No formal contract for sensors/actuators |
| Components | No `{component-id}.toon` files exist | — |
| Connections | No `connection-colors.toon` | Inconsistent wire colors across SVG and UI |
| ASL Pipeline | `TranspileContext` does not exist | Agent has no `board_id + target + ir_hash` |
| ASL Pipeline | `ir_hash` does not exist | No deterministic cache |
| ASL Pipeline | `circuitpython` is not a separate WASM target | Target confused with `micropython` |
| **Tooling** | **No visual tool to create/edit board and component files** | **Schema authoring is manual, error-prone, and inaccessible** |

---

## 2. System Architecture — The Four Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                           SCHEMAS                                     │
│  board-schema.toon   component-schema.toon   connection-colors.toon  │
│  (validates boards)  (validates components)  (canonical wire colors) │
└──────────┬───────────────────┬───────────────────────────────────────┘
           │ referenced         │ referenced
           ▼                   ▼
┌──────────────────┐  ┌──────────────────────┐
│  {board-id}.toon │  │ {component-id}.toon  │
│  specs / gpio    │  │ signals / aslHint    │
│  svgMap          │  │ svgId / category     │
│  aslProfile      │  └────────┬─────────────┘
└───────┬──────────┘           │
        │                      │
   ┌────▼─────────┐    ┌───────▼──────────┐
   │ {board}.svg  │    │ {component}.svg  │
   │ data-pin=""  │    │ data-signal=""   │
   └──────────────┘    └──────────────────┘
           │                   │
           └─────────┬─────────┘
                     ▼
        ┌────────────────────────────────┐
        │        TranspileContext        │
        │  board_id + target_lang        │
        │  AslProgram (TOON) + ir_hash   │
        └────────────┬───────────────────┘
                     │
          ┌──────────▼──────────┐
          │      AI Agent        │
          │  SkillSelector       │
          │  ConfidenceReport    │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │   Generated Code     │
          │ + confidence_score   │
          │ + warnings[]         │
          └─────────────────────┘
```

### Propagation Rule

Any modification to one artifact must propagate deterministically:

- Modifying `gpio[n].pin` in a board TOON → regenerate `svgMap.pins[n]` → update `data-pin` in the SVG
- Adding a language to `languages[]` → create/activate target in `aslProfile.targets[]`
- Changing `restrictions.reservedPins[]` → mark pins in the SVG with `class="pin-reserved"` and in `aslProfile` as `forbidden: true`
- Modifying `component.signals[n].signalType` → update `aslHint.semanticType` → regenerate wire color via `connection-colors.toon`

---

## 3. Extensions to `board-schema.toon`

### 3.1 Immediate Fixes

```toon
# powerPins.name — add to enum:
# VBUS, VSYS, 3V3_EN, EN, VCC, VBAT

# specs — remove additionalProperties: false, add:
# cores:        integer, minimum: 1
# architecture: string

# gpio — add field:
# physicalPin: integer  # Physical connector pin number

# category enum — add:
# plc
```

### 3.2 `svgMap` Field (new, required)

Links each GPIO pin to its exact coordinate in the SVG.

```toon
svgMap:
  file: assets/boards/arduino-uno.svg
  viewBox: 0 0 500 360
  pins:
  | id          | logicalPin | physicalPin | cx    | cy    | side   |
  | pin-d0      | 0          | 1           | 142.5 | 28.0  | right  |
  | pin-d2      | 2          | 4           | 142.5 | 56.0  | right  |
  | pin-d13     | 13         | 19          | 142.5 | 196.0 | right  |
  | pin-a0      | 14         | 23          | 142.5 | 252.0 | right  |
```

### 3.3 `aslProfile` Field (new, required)

Provides the AI agent with structured context per target. This is the field that transforms the board file into an agent-readable document.

```toon
aslProfile:
  targets:
  | language    | targetId               | hal                | std   | alloc | confidenceFloor | agentSkill                                 |
  | arduino-cpp | arduino-uno-avr        | arduino-avr-hal    | false | false | 0.97            | agent_skills/languages/arduino-cpp-avr.md  |
  | rust        | arduino-uno-avr-rust   | arduino-avr-hal    | false | false | 0.78            | agent_skills/languages/rust-embassy-avr.md |
```

### 3.4 `plcProfile` Field (roadmap, boards with `category: plc` only)

```toon
plcProfile:
  standard: IEC-61131-3
  languages: [LD, FBD, ST, IL, SFC]
  cycleTimeMs: 10
  safetyRating: SIL-1
```

---

## 4. `component-schema.toon` — New Schema

Components are the peripheral I/O devices that connect to boards: sensors, actuators, indicators, and passives.

### Component Categories

| Category | Examples |
|---|---|
| `sensor` | LDR, DHT22, HC-SR04, PIR, MPU6050, encoder |
| `actuator` | Servo, DC motor, stepper motor, pump |
| `indicator` | Simple LED, RGB LED, buzzer, 7-seg display, OLED |
| `passive` | Resistor, capacitor, potentiometer |
| `communication` | RF module, BT UART, CAN transceiver |

### Example — RGB LED (`led-rgb-common-cathode.toon`)

```toon
# NeuroForge Component — RGB LED Common Cathode
id: led-rgb-common-cathode
name: RGB LED Common Cathode
category: indicator
subcategory: led
svgId: led-rgb
voltage: 3.3

signals:
| id    | name | direction | signalType | required | svgAnchorId |
| red   | R    | input     | pwm        | true     | anchor-r    |
| green | G    | input     | pwm        | true     | anchor-g    |
| blue  | B    | input     | pwm        | true     | anchor-b    |
| gnd   | GND  | input     | gnd        | true     | anchor-gnd  |

aslHint:
  semanticType: led_rgb
  defaultOperation: analogOutput
  hmiWidget: led
  hmiMin: 0
  hmiMax: 255

restrictions:
  requiresPwm: true
  maxCurrentMa: 20
  notes:
    - Requires current-limiting resistor in series on each channel
```

### Example — DHT22 (`dht22.toon`)

```toon
# NeuroForge Component — DHT22 Temperature and Humidity
id: dht22
name: DHT22 — Temperature and Humidity
category: sensor
subcategory: environmental
svgId: dht22
voltage: 3.3

signals:
| id   | name | direction     | signalType | required | svgAnchorId |
| data | DATA | bidirectional | digital    | true     | anchor-data |
| vcc  | VCC  | input         | power      | true     | anchor-vcc  |
| gnd  | GND  | input         | gnd        | true     | anchor-gnd  |

aslHint:
  semanticType: sensor_analog
  defaultOperation: digitalInput
  include: dht
  hmiWidget: gauge
  hmiUnit: °C
  hmiMin: -40
  hmiMax: 80

restrictions:
  requiresInterrupt: false
  notes:
    - Requires 10kΩ pull-up resistor on DATA line
    - Minimum interval between readings: 2 seconds
```

---

## 5. `connection-colors.toon`

```toon
# NeuroForge — Canonical connection colors
# Shared by SVG renderer, visual editor, and agent diagram generation
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

---

## 6. SVG Convention — Boards and Components

### 6.1 Boards — Data Attribute System

```xml
<!-- Digital GPIO with PWM -->
<circle
  id="pin-d3"
  class="pin pin-digital pin-pwm pin-interrupt"
  data-pin="3"
  data-physical="5"
  data-label="D3 PWM"
  data-pwm="true"
  data-interrupt="true"
  cx="142.5" cy="56.0" r="3.5"
/>

<!-- Strapping pin — boot mode warning (ESP32) -->
<circle
  id="pin-gpio0"
  class="pin pin-digital pin-strapping pin-warning"
  data-pin="0"
  data-warning="Boot mode selection — avoid"
  cx="..." cy="..." r="3.5"
/>

<!-- Input-only (ESP32 GPIO34–39) -->
<circle
  id="pin-gpio34"
  class="pin pin-analog pin-input-only"
  data-pin="34"
  data-adc="true"
  data-input-only="true"
  cx="..." cy="..." r="3.5"
/>

<!-- Power pin -->
<circle
  id="pin-3v3"
  class="pin pin-power"
  data-pin-type="power"
  data-voltage="3.3"
  cx="..." cy="..." r="3.5"
/>
```

### 6.2 Components — Connection Anchors

```xml
<!-- Signal anchor on the component -->
<circle
  id="anchor-data"
  class="signal-anchor signal-digital"
  data-signal="data"
  data-signal-type="digital"
  data-direction="bidirectional"
  cx="50" cy="10" r="4"
/>
```

### 6.3 Standardised CSS Classes

| SVG Class | Meaning |
|---|---|
| `pin-digital` | Digital GPIO |
| `pin-analog` | ADC / DAC |
| `pin-pwm` | PWM capable |
| `pin-interrupt` | Interrupt capable |
| `pin-strapping` | Strapping pin (ESP32) |
| `pin-reserved` | Reserved — do not use |
| `pin-power` | Power supply |
| `pin-gnd` | Ground |
| `pin-warning` | Has usage warning |
| `pin-touch` | Capacitive touch |
| `pin-input-only` | Input-only (ESP32 GPIO34–39) |
| `pin-i2c` | I2C (SDA or SCL) |
| `pin-spi` | SPI (MOSI/MISO/SCK/CS) |
| `pin-uart` | UART (TX or RX) |

---

## 7. SchemaSmith — Visual Schema Authoring Tool

### 7.1 What Is SchemaSmith?

**SchemaSmith** is the visual frontend tool that implements the NeuroForge Board/Component/ASL architecture. It is the authoring environment for creating, editing, and validating all TOON schema files — boards, components, and PLCs — without writing a single line of TOON manually.

**Alternative name candidates:**
- **CircuitScribe** — scribes circuit definitions visually
- **BoardWeaver** — weaves boards, components, and pins together
- **PinStudio** — studio for pin/signal configuration

The name **SchemaSmith** is recommended: it captures the act of crafting precise schemas (smith = craftsman who forges), aligns with the DendriForge branding, and is unique in the ecosystem.

### 7.2 Why SchemaSmith?

Without SchemaSmith, the board and component authoring workflow is:
1. Write TOON by hand
2. Guess SVG coordinates for each pin
3. Validate against the Rust schema types manually
4. Repeat until the file passes validation

With SchemaSmith:
1. Load or draw the board/component SVG
2. Click each pin/anchor to assign it — SchemaSmith fills the TOON
3. Fill a form per pin/signal/component
4. Export a validated, schema-compliant TOON file instantly

### 7.3 Three Modes

| Mode | Input | Output | Purpose |
|------|-------|--------|---------|
| **Board Mode** | Existing SVG | `{board-id}.toon` + updated SVG | Map physical board SVGs to logical pin definitions |
| **Component Mode** | Existing SVG or template | `{component-id}.toon` + SVG with anchors | Define component signals and ASL hints |
| **PLC Mode** | Board JSON/TOON or new | `{plc-id}.toon` + `plcProfile` | Define IEC 61131-3 PLC configurations |

### 7.4 Board Mode — Workflow

```
1. Load SVG  →  SVG renders in the canvas
2. Click pin circle  →  side panel opens: pin ID, logical pin, physical pin, capabilities
3. Fill form: label, pwm, interrupt, adc, strapping, warning (optional)
4. Repeat for all pins
5. Fill board metadata: mcu, frequency, languages[], aslProfile targets
6. Export: validated {board-id}.toon + SVG with data-pin attributes injected
```

**Canvas behaviour:**
- Pins with missing data → highlighted in red (validation state)
- Pins assigned → colour-coded by `connection-colors.toon` (PWM = orange, I2C = green, etc.)
- Hover over a pin → tooltip shows current TOON values
- `svgMap` coordinates auto-populated from the SVG element `cx`/`cy` attributes

### 7.5 Component Mode — Workflow

```
1. Load component SVG or select from template library
2. Click each anchor point  →  assign: signal id, name, direction, signalType
3. Fill aslHint: semanticType, defaultOperation, hmiWidget, hmiUnit, hmiMin/Max
4. Fill restrictions: requiresPwm, requiresAdc, maxCurrentMa, notes
5. Export: validated {component-id}.toon + SVG with data-signal attributes
```

### 7.6 Live Board-Component Linking

SchemaSmith includes a **connection canvas** where the user can:
- Drop a board SVG and one or more component SVGs onto the canvas
- Drag a wire from a component anchor to a board pin
- SchemaSmith validates the connection in real time:
  - Signal type compatibility (e.g., `pwm` signal → must connect to a `pwm`-capable pin)
  - Voltage compatibility (e.g., 5V component on a 3.3V pin → warning)
  - Reserved/strapping pin → blocked with explanation
- The resulting wiring is exported as the `connections[]` section of an `.nf` project file

### 7.7 SchemaSmith Technical Architecture

```
apps/schemasmith/
├── package.json
├── src-tauri/                     ← Tauri 2 shell (desktop + web)
│   └── src/
│       ├── main.rs
│       └── commands/
│           ├── validate_board.rs  ← calls neuroforge-asl BoardProfile::from_toon()
│           ├── validate_component.rs
│           └── export_toon.rs
└── src/
    ├── main.ts
    ├── stores/
    │   ├── useBoardStore.ts       ← board TOON state
    │   ├── useComponentStore.ts   ← component TOON state
    │   └── useConnectionStore.ts  ← wiring state
    ├── components/
    │   ├── SvgCanvas.svelte       ← interactive SVG editor
    │   ├── PinPanel.svelte        ← pin detail form
    │   ├── SignalPanel.svelte     ← signal detail form
    │   ├── BoardMetaForm.svelte   ← board metadata (mcu, languages, aslProfile)
    │   ├── AslHintForm.svelte     ← aslHint editor for components
    │   ├── ConnectionCanvas.svelte ← board + component drag-and-drop wiring
    │   ├── ValidationReport.svelte ← real-time validation errors
    │   └── ToonPreview.svelte     ← live TOON file preview as user fills forms
    └── lib/
        ├── toon-parser.ts         ← TOON → JS object
        ├── toon-serializer.ts     ← JS object → TOON
        ├── svg-pin-extractor.ts   ← extracts cx/cy from SVG elements
        └── wire-validator.ts      ← signal compatibility checks
```

### 7.8 Validation Pipeline

SchemaSmith validates in two layers:

**Layer 1 — Frontend (real-time):**
- Required fields highlighted as the user fills the form
- Signal type / board pin capability cross-check via `wire-validator.ts`
- TOON preview updates live in `ToonPreview.svelte`

**Layer 2 — Backend (on export):**
- Tauri command calls `BoardProfile::from_toon()` in the Rust crate
- Rust returns `Vec<ValidationError>` — displayed in `ValidationReport.svelte`
- Export is blocked until all errors are resolved

---

## 8. `asl_types/` — Proposed File Structure

```
asl_types/
├── mod.rs                    ← public re-exports from all submodules
├── core/
│   ├── program.rs            ← AslProgram, AslBlock, AslStatement
│   ├── types.rs              ← AslType, AslValue, Duration, Condition
│   └── operators.rs          ← AslOperator, BinaryOp, UnaryOp
├── board/
│   ├── mod.rs
│   ├── board_profile.rs      ← BoardProfile, PinCapabilities, AslTarget
│   ├── pin_map.rs            ← PinMap, PhysicalPin, LogicalPin
│   └── restriction.rs        ← PinRestriction, BootWarning, CurrentLimit
├── component/
│   ├── mod.rs
│   ├── component_profile.rs  ← ComponentProfile, Signal, SignalType
│   └── asl_hint.rs           ← AslHint, HmiWidget
├── agent/
│   ├── confidence.rs         ← ConfidenceScore, ConfidenceReport, Deduction
│   ├── skill_selector.rs     ← SkillSelector
│   ├── transpile_context.rs  ← TranspileContext (serialised as TOON for agent)
│   └── transpile_mode.rs     ← TranspileMode (Deterministic | Agent)
└── validation/
    ├── validator.rs          ← AslValidator
    └── errors.rs             ← AslValidationError, PinConflict, etc.
```

### Core Structs

```rust
// asl_types/board/board_profile.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardProfile {
    pub id:      String,
    pub name:    String,
    pub mcu:     String,
    pub specs:   BoardSpecs,
    pub gpio:    Vec<PinCapabilities>,
    pub targets: Vec<AslTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslTarget {
    pub language:         String,
    pub target_id:        String,
    pub hal:              String,
    pub hal_version:      Option<String>,
    pub std_available:    bool,
    pub alloc_available:  bool,
    pub confidence_floor: f32,
    pub agent_skill:      String,
    pub forbidden_pins:   Vec<u8>,
    pub notes:            Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PinCapabilities {
    pub logical_pin:  u8,
    pub physical_pin: Option<u8>,
    pub label:        String,
    pub pwm:          bool,
    pub interrupt:    bool,
    pub adc:          bool,
    pub dac:          bool,
    pub touch:        bool,
    pub input_only:   bool,
    pub strapping:    bool,
    pub warning:      Option<String>,
}
```

```rust
// asl_types/component/asl_hint.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslHint {
    pub semantic_type:     String,
    pub default_operation: String,
    pub include:           Option<String>,
    pub hmi_widget:        HmiWidget,
    pub hmi_unit:          Option<String>,
    pub hmi_min:           Option<f64>,
    pub hmi_max:           Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HmiWidget {
    Led, Gauge, Slider, Toggle,
    Chart, Label, Numeric, Arc, None,
}
```

### TOON Deserialization in Rust

```toml
# Cargo.toml — add dependency
[dependencies]
toon = "0.1"          # toon-format/toon crate (verify latest version)
serde = { version = "1", features = ["derive"] }
```

```rust
// Loading a board profile from TOON
impl BoardProfile {
    pub fn from_toon(path: &str) -> Result<Self, ToonError> {
        let content = std::fs::read_to_string(path)?;
        toon::from_str(&content)
    }

    pub fn to_toon(&self) -> Result<String, ToonError> {
        toon::to_string(self)
    }
}
```

> **Note:** Verify the `toon` crate's serde compatibility before implementation. If the Rust crate is immature, use RON as the internal Rust serialization format (fully serde-compatible, human-readable, Rust-native) and convert to TOON only when serializing for the agent context.

---

## 9. `TranspileContext` — Agent Envelope (TOON)

```rust
// asl_types/agent/transpile_context.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranspileContext {
    pub asl_program:   AslProgram,
    pub board_profile: BoardProfile,
    pub target:        AslTarget,
    pub ir_hash:       u64,
    pub asl_version:   String,
    pub components:    Vec<ComponentProfile>,
}
```

**Serialised as TOON for the agent call:**
```toon
# TranspileContext — sent to agent on each transpilation
asl_version: 4.0.0
ir_hash: 14982734019283756
board_profile:
  id: arduino-uno
  mcu: ATmega328P
target:
  language: arduino-cpp
  targetId: arduino-uno-avr
  hal: arduino-avr-hal
  confidenceFloor: 0.97
components:
| id                      | semanticType | defaultOperation |
| led-rgb-common-cathode  | led_rgb      | analogOutput     |
asl_program:
  # ... AslProgram in TOON (40–55% fewer tokens vs JSON)
```

### The `ir_hash` — Determinism Protocol

```rust
pub fn compute_ir_hash(program: &AslProgram) -> u64 {
    // Canonical TOON serialisation — same program = same hash regardless of source language
    let canonical = toon::to_string(program)
        .expect("AslProgram must be serializable");
    let mut hash: u64 = 14695981039346656037;
    for byte in canonical.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}
```

---

## 10. Agent Skills System

```
agent_skills/
├── base/
│   └── asl_fundamentals.md        ← Base ASL v4 rules, TOON format reference
├── boards/
│   ├── avr-family.md
│   ├── rp2040-family.md
│   └── esp32-family.md
├── languages/
│   ├── rust-embassy-rp.md
│   ├── rust-embassy-avr.md
│   ├── rust-embassy-esp.md
│   ├── micropython-rp2040.md
│   ├── micropython-esp32.md
│   ├── circuitpython-rp2040.md
│   ├── circuitpython-esp32.md
│   ├── arduino-cpp-avr.md
│   ├── arduino-cpp-esp32.md
│   └── iec-st.md
└── components/
    ├── servo.md
    ├── i2c-sensor.md
    └── rgb-led.md
```

---

## 11. Confidence Scoring System

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfidenceReport {
    pub base_score:  f32,
    pub deductions:  Vec<Deduction>,
    pub warnings:    Vec<String>,
    pub final_score: f32,
    pub passed:      bool,   // final_score >= 0.85
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Deduction {
    PinNotAvailable       { pin: u8, reason: String, penalty: f32 },
    PeripheralMissing     { peripheral: String, penalty: f32 },
    MemoryInsufficient    { required: u32, available: u32, penalty: f32 },
    LanguageUnsupported   { language: String, penalty: f32 },
    StrappingPinUsed      { pin: u8, penalty: f32 },
    InputOnlyPinOutput    { pin: u8, penalty: f32 },
    ComponentIncompatible { component_id: String, reason: String, penalty: f32 },
    IncludeNotSupported   { include: String, target: String, penalty: f32 },
}
```

### Confidence Floor Reference

| Board + Target | `confidenceFloor` | Notes |
|---|---|---|
| Arduino Uno + arduino-cpp | 0.97 | Fully deterministic, trivial combination |
| Pico + micropython | 0.93 | Well-documented |
| Pico + circuitpython | 0.91 | Slightly different API from micropython |
| Pico + rust + embassy-rp | 0.88 | Async HAL — more complex |
| ESP32 + rust + embassy-esp | 0.82 | Base; WiFi stack reduces further |
| ESP32 + micropython | 0.89 | |
| Arduino Uno + rust + avr | 0.78 | no_std AVR — complex toolchain |

---

## 12. Target Map by Board

| Board | `rust` | `micropython` | `circuitpython` | `arduino-cpp` | `esp-idf` | `st` |
|---|---|---|---|---|---|---|
| Arduino Uno R3 | `arduino-avr-hal` (no_std) | ✗ | ✗ | ✓ | ✗ | ✗ |
| Raspberry Pi Pico | `embassy-rp` (no_std + alloc) | ✓ | ✓ | ✓ | ✗ | ✗ |
| ESP32 DevKitC V4 | `embassy-esp` (no_std + alloc) | ✓ | ✗ | ✓ | ✓ | ✗ |
| *STM32 Nucleo-64* | `embassy-stm32` | ✗ | ✗ | ✓ | ✗ | ✗ |
| *PLC (roadmap)* | ✗ | ✗ | ✗ | ✗ | ✗ | ST/IEC |

> **Note:** `circuitpython` is always a **separate** target from `micropython`. The agent uses different skill files for each — `board.*` in CircuitPython vs `machine.*` in MicroPython.

---

## 13. Board, Component and SVG Roadmap

### Phase A — Maker/Prototyping

**Boards:**
- [x] Arduino Uno R3 (JSON + SVG existing — migrate to TOON)
- [ ] Raspberry Pi Pico (JSON ✓ | SVG ✗ | aslProfile ✗ | svgMap ✗)
- [ ] ESP32 DevKitC V4 (JSON ✓ but invalid | SVG ✗ | aslProfile ✗ | svgMap ✗)
- [ ] Arduino Nano / Nano Every
- [ ] STM32 Nucleo-64 (F411RE)

**Components — first wave:**
- [ ] Simple LED
- [ ] RGB LED common cathode
- [ ] Potentiometer (TSX exists — migrate to TOON)
- [ ] Servo (TSX exists — migrate to TOON)
- [ ] Button / push-button
- [ ] Resistor
- [ ] DHT22
- [ ] HC-SR04 (ultrasonic)
- [ ] LDR
- [ ] Buzzer

### Phase B — Connectivity

**Boards:** ESP8266 NodeMCU, Raspberry Pi Pico W, Arduino MKR WiFi 1010

**Components — second wave:** OLED I2C (SSD1306), LCD 16×2, MPU6050, DS18B20, Relay, DC Motor + L298N

### Phase C — Industrial / PLC

**Boards:** CODESYS Virtual PLC, Siemens S7-1200 subset, Allen Bradley Micro820

**Components — third wave:** Incremental encoder, Load cell + HX711, NTC thermistor, ACS712

### SVG File Convention

```
/assets/boards/
├── arduino-uno.svg          ← existing, update data-pin attributes
├── raspberry-pi-pico.svg    ← to be created in SchemaSmith
├── esp32-devkitc-v4.svg     ← to be created in SchemaSmith
└── _board-template.svg      ← base template with viewBox and base classes

/assets/components/
├── led-simple.svg
├── led-rgb.svg              ← SVG version of existing TSX
├── potentiometer.svg        ← SVG version of existing TSX
├── servo.svg                ← SVG version of existing TSX
├── dht22.svg
├── hc-sr04.svg
└── _component-template.svg  ← template with base anchors
```

---

## 14. Next Steps — Execution Order

| # | Artifact | Dependencies | Priority |
|---|---|---|---|
| 1 | Verify `toon` Rust crate serde compatibility | — | 🔴 Critical |
| 2 | Fix `board-schema.toon` (sections 3.1–3.4) | 1 | 🔴 Critical |
| 3 | Create `component-schema.toon` (section 4) | 1 | 🔴 Critical |
| 4 | Create `connection-colors.toon` (section 5) | 1 | 🔴 Critical |
| 5 | Migrate `arduino-uno.json` → `arduino-uno.toon` | 2 | 🔴 Critical |
| 6 | Update `esp32-devkitc.toon` (make valid) | 2 | 🔴 Critical |
| 7 | Add `svgMap` + `aslProfile` to all 3 board TOON files | 2 | 🟠 High |
| 8 | Create component TOON files — first wave (10 components) | 3 | 🟠 High |
| 9 | Create Raspberry Pi Pico SVG (with data-pin attributes) | 7 | 🟠 High |
| 10 | Create ESP32 DevKitC V4 SVG (with data-pin attributes) | 7 | 🟠 High |
| 11 | SchemaSmith — Board Mode MVP (SvgCanvas + PinPanel + export) | 2, 7 | 🟠 High |
| 12 | SchemaSmith — Component Mode MVP (SignalPanel + AslHintForm) | 3, 8 | 🟠 High |
| 13 | Create component SVGs — first wave | 8 | 🟡 Medium |
| 14 | Split `asl_types.rs` into `asl_types/` (section 8) | 1 | 🟡 Medium |
| 15 | Implement `BoardProfile::from_toon()` with validation | 14 | 🟡 Medium |
| 16 | Implement `TranspileContext` + `ir_hash` (section 9) | 14, 15 | 🟡 Medium |
| 17 | Implement `SkillSelector` (section 10) | 16 | 🟡 Medium |
| 18 | Implement `ConfidenceReport` + `Deduction` (section 11) | 16, 17 | 🟡 Medium |
| 19 | SchemaSmith — Connection Canvas (board + component wiring) | 11, 12 | 🟡 Medium |
| 20 | SchemaSmith — Tauri backend validation commands | 15, 19 | 🟡 Medium |
| 21 | Create agent skill files — first wave | 17 | 🟢 Normal |
| 22 | Create `_board-template.svg` and `_component-template.svg` | 9, 10 | 🟢 Normal |
| 23 | Phase B boards (ESP8266, Pico W, MKR WiFi) | 2, 7 | 🔵 Roadmap |
| 24 | Second-wave components (OLED, LCD, MPU6050…) | 3, 8 | 🔵 Roadmap |
| 25 | `plcProfile` + Phase C PLC boards | 2 | 🔵 Roadmap |

---

*NeuroForge — Board/SVG/Component/ASL Architecture v3 — April 2026*
