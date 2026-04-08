# NeuroForge Master Architectural Report

> **Document Version:** 4.0 (Corrected & Verified)
> **Last Updated:** April 2026
> **Status:** Accurate System Description - Based on Actual Code Analysis

---

## 1. Project Overview

### 1.1 What is NeuroForge?

NeuroForge is a **multi-language transpilation engine** that converts code between programming languages (C, Python, Rust, IEC 61131-3). It is NOT a simulator - it is a **transpiler** that:

- Parses source code from one language
- Converts it to an intermediate representation (ASL - Abstract Simulation Language)
- Generates output code in a target language

### 1.2 Current Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| **C/C++ → Python** | ✅ Working | Cross-language transpilation |
| **C/C++ → Rust** | ✅ Working | Generates Embassy-compatible Rust |
| **Python → C** | ✅ Working | Reverse transpilation |
| **Python → Rust** | ✅ Working | MicroPython to Embassy |
| **ST (IEC 61131-3)** | ✅ Working | Structured Text support |
| **IL/LD/FBD/SFC** | ❌ Stub | Not yet implemented |
| **Simulation/Execution** | ❌ Fake | "runSimulation" just validates/transpiles |
| **QEMU Integration** | ❌ None | Documentation only, no code |

---

## 2. What NeuroForge Actually Does

### 2.1 The Transpilation Pipeline

```
Source Code (C/Python/Rust/ST)
         │
         ▼
    [Parser Detection]
    (auto-detects source language)
         │
         ▼
    [Language-Specific Parser]
    ┌─────────────────────────────────┐
    │ CParser → tree-sitter C        │
    │ PythonParser → tree-sitter      │
    │ RustParser → tree-sitter        │
    │ StParser → pest (IEC 61131)     │
    └─────────────────────────────────┘
         │
         ▼
    [AslProgram - ASL IR]
    (JSON representation)
         │
         ▼
    [Target Language Generator]
    ┌─────────────────────────────────┐
    │ CGenerator → C/C++              │
    │ PythonGenerator → Python       │
    │ RustGenerator → Rust/Embassy    │
    │ StGenerator → ST               │
    └─────────────────────────────────┘
         │
         ▼
    Output Code
```

### 2.2 What "Simulation" Actually Means

Looking at `apps/shared/src/state/ide.svelte.ts`:

```typescript
async runSimulation() {
    // Transpile to the same language to validate syntax
    asl.transpile(this.code, this.language, this.language);
    this.addLog('Simulation build successful.', 'success');
    this.addLog('Running on virtual target...', 'info');  // <-- This is FAKE
}
```

**The "runSimulation" button does NOT simulate anything.** It:
1. Runs the transpiler (validates the code)
2. Prints "Running on virtual target..." (lies to the user)

There is NO JavaScript executor. NO QEMU. NO real simulation.

---

## 3. Monorepo Structure

### 3.1 Workspace Configuration

| Package Manager | Workspace Type | Configuration |
|----------------|----------------|---------------|
| **pnpm** | JavaScript/TypeScript | `pnpm-workspace.yaml` |
| **Cargo** | Rust crates | `Cargo.toml` (root) |

### 3.2 Directory Layout

```
neuroforge/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   ├── webapp/               # SvelteKit web app
│   ├── mobile/               # Tauri mobile app
│   ├── shared/               # Shared components + WASM bindings
│   └── schemasmith/         # Board schema tool
├── crates/
│   ├── neuroforge-asl/       # CORE: ASL Transpiler (ACTIVE)
│   ├── neuroforge-transport # STUB: Empty
│   └── neuroforge-firmware  # STUB: Empty
├── packages/
│   └── asl-wasm/            # Pre-compiled WASM (not in workspace)
├── .opencode/               # AI agent system
├── agent_skills/            # LLM prompts for platforms
├── docs/                    # Documentation
└── firmware/                # Empty directories
```

---

## 4. Systems and Subsystems

### 4.1 Frontend Applications (`apps/`)

| Application | Framework | Status |
|-------------|-----------|--------|
| `@neuroforge/desktop` | Tauri 2 + Svelte 5 | Active |
| `@neuroforge/webapp` | SvelteKit | Active |
| `@neuroforge/mobile` | Tauri 2 | Active |
| `@neuroforge/schemasmith` | Tauri 2 + Svelte 5 | Active |
| `@neuroforge/shared` | Svelte 5 | Active |

---

### 4.2 SchemaSmith - Board & Component Design Tool

**Purpose:** A Tauri desktop application for designing board and component schemas with visual SVG-based pin mapping.

**Location:** `apps/schemasmith/`

**Architecture:**

```
apps/schemasmith/
├── src/
│   ├── lib/
│   │   ├── types.ts                    # Complete type definitions (560+ lines)
│   │   ├── toon-serializer.ts           # TOON JSON serialization/deserialization
│   │   ├── toon-board-store.ts          # Board state management
│   │   ├── component-store.svelte.ts   # Component state management
│   │   ├── connection-store.svelte.ts  # Wire connections state
│   │   ├── connectionColors.svelte.ts # Connection color definitions
│   │   ├── wire-validator.ts            # Wire validation logic
│   │   ├── svg-pin-extractor.ts         # Extract pins from SVG
│   │   └── tauri-api.ts                # Tauri command wrappers
│   ├── components/
│   │   ├── SvgCanvas.svelte            # Main SVG editing canvas
│   │   ├── PinPanel.svelte              # Pin properties panel
│   │   ├── BoardMetaForm.svelte        # Board metadata form
│   │   ├── ComponentMetaForm.svelte    # Component metadata form
│   │   ├── AslHintForm.svelte          # ASL hint configuration
│   │   ├── RestrictionsForm.svelte    # Component restrictions
│   │   ├── SignalPanel.svelte          # Signal definition panel
│   │   ├── ToonPreview.svelte           # TOON JSON preview
│   │   ├── ValidationReport.svelte     # Validation results
│   │   └── ... (13+ components)
│   └── routes/
│       ├── +page.svelte                 # Home/board editor
│       ├── component/+page.svelte       # Component editor
│       └── connect/+page.svelte        # Connection designer
└── src-tauri/                           # Rust backend for validation
```

**Key Features:**
- Visual board designer with SVG pin mapping
- Component schema designer with signal definitions
- TOON format export (board configuration format)
- Pin validation (PWM, ADC, interrupt capabilities)
- Connection color system
- 24 built-in component templates (sensors, actuators, indicators, etc.)

---

### 4.3 TOON Board Definition Files

**Format:** Custom JSON-based configuration format (TOON = Tauri Object Notation)

**Location:** `docs/boards/*.toon`

| File | Board/Type | Purpose |
|------|------------|---------|
| `arduino-uno-r3.toon` | Arduino Uno R3 | ATmega328P board config |
| `esp32-devkitc-v4.toon` | ESP32 DevKit C | Espressif ESP32 |
| `raspberry-pi-pico.toon` | Raspberry Pi Pico | RP2040 board |
| `raspberry-pi-pico-w.toon` | Raspberry Pi Pico W | RP2040 with WiFi |
| `arduino-mkr-wifi-1010.toon` | Arduino MKR WiFi | ATSAM board |
| `esp8266-nodemcu.toon` | ESP8266 NodeMCU | Espressif WiFi |
| `siemens-s7-1200.toon` | Siemens S7-1200 | PLC |
| `allen-bradley-micro820.toon` | AB Micro820 | PLC |
| `codesys-virtual.toon` | CODESYS Virtual | PLC runtime |

**Schema Files:**
| File | Purpose |
|------|---------|
| `board-schema.toon` | Board JSON schema definition |
| `component-schema.toon` | Component JSON schema definition |
| `connection-colors.toon` | Connection wire colors |

**Component Definitions** (`docs/boards/components/*.toon`): 20+ files
- Sensors: LDR, DHT22, HC-SR04, MPU6050, encoder, etc.
- Actuators: servo, DC motor, stepper motor, pump, relay
- Indicators: LED, RGB LED, buzzer, 7-seg, OLED, LCD
- Passive: resistor, potentiometer
- Communication: Bluetooth UART, CAN, RF module

**Status:** 34 TOON files total

---

### 4.4 SVG Asset Files

**Purpose:** Visual representations of boards and components for the SchemaSmith designer.

**Locations:**
1. `assets/boards/*.svg` - Board images (9 files)
2. `assets/components/*.svg` - Component images (17 files)
3. `assets/_board-template.svg` - Board template for new boards
4. `assets/_component-template.svg` - Component template
5. `apps/shared/static/boards/` - Live board SVGs + JSON configs

**Board SVGs (9 files):**
| File | Board |
|------|-------|
| `arduino-uno-r3.svg` | Arduino Uno R3 |
| `esp32-devkitc-v4.svg` | ESP32 DevKit C |
| `raspberry-pi-pico.svg` | Raspberry Pi Pico |
| `raspberry-pi-pico-w.svg` | Raspberry Pi Pico W |
| `arduino-mkr-wifi-1010.svg` | Arduino MKR WiFi |
| `esp8266-nodemcu.svg` | ESP8266 NodeMCU |
| `siemens-s7-1200.svg` | Siemens S7-1200 |
| `allen-bradley-micro820.svg` | Allen-Bradley Micro820 |
| `codesys-virtual.svg` | CODESYS Virtual |

**Component SVGs (17 files):** led-simple, led-rgb, button-push, servo, potentiometer, ldr, buzzer, hc-sr04, dht22, ds18b20, mpu6050, lcd-16x2, oled-i2c-ssd1306, dc-motor-l298n, relay-5v, resistor, etc.

**SVG Structure:**
- Each pin is a `<circle>` element with data attributes
- Pin IDs mapped to logical pin numbers
- Supports: pwm, interrupt, adc, i2c, spi, uart capabilities
- ViewBox coordinates mapped to pin positions

**Status:** 31+ SVG files

---

### 4.5 Legacy Board JSON Files

**Location:** `apps/shared/static/boards/*.json`

These are the OLD JSON format files (being replaced by TOON):

| File | Board |
|------|-------|
| `arduino-uno.json` | Arduino Uno (old format) |
| `esp32-devkit.json` | ESP32 (old format) |
| `raspberry-pi-pico.json` | Pi Pico (old format) |
| `board-schema.json` | Board schema (old) |

**Status:** Being migrated to TOON format

---

### 4.6 Rust Crates (`crates/`)

| Crate | Status | Purpose |
|-------|--------|---------|
| `neuroforge-asl` | ✅ Active | Core transpiler - parses C/Python/Rust/ST → ASL IR → generates target code |
| `neuroforge-transport` | ❌ Empty | Never implemented |
| `neuroforge-firmware` | ❌ Empty | Never implemented |

### 4.3 neuroforge-asl Architecture

```
crates/neuroforge-asl/src/
├── executor/
│   └── asl_executor.rs      # Main transpilation engine
├── parser/
│   ├── tree_sitter_loader.rs
│   ├── language_registry.rs
│   └── neuro_parser.rs
├── transforms/
│   ├── code_to_asl.rs       # AST → ASL
│   ├── ast_normalizer.rs
│   ├── block_transform.rs
│   └── expr_transform.rs
├── plugins/                 # Language parsers & generators
│   ├── c/                   # C/C++ parser + generator
│   ├── python/              # Python parser + generator
│   ├── rust_std/            # Rust parser + generator
│   └── plc/                 # IEC 61131-3 (ST only)
│       ├── st_parser.rs
│       └── st_generator.rs
├── asl_types/              # Type system
│   ├── core/               # Core ASL types
│   ├── board/              # Board profiles
│   ├── component/          # Component profiles
│   └── validation/         # Type validation
├── optimizer/              # Code optimization
├── wasm/                   # WASM bindings
└── lib.rs                  # Entry point
```

---

## 5. Technology Stack

### 5.1 Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Svelte | 5.x | UI framework |
| SvelteKit | 2.x | Web framework |
| Tailwind CSS | v4 | Styling |
| Monaco Editor | Latest | Code editor |
| @xyflow/svelte | Latest | Circuit visualization |
| Tauri | 2.x | Desktop/mobile runtime |

### 5.2 Backend (Transpiler)

| Technology | Purpose |
|------------|---------|
| Rust | Core transpiler |
| tree-sitter | Parser generation (C, Python, Rust) |
| pest | PEG parser (IEC 61131-3 ST) |
| wasm-bindgen | WASM compilation |

### 5.3 WASM Bindings

The transpiler compiles to WebAssembly for browser execution:

- `wasm_transpile(source, from_lang, to_lang)` - Transpile code
- `wasm_cross_transpile(source, from, to)` - Cross-language transpile
- `wasm_transpile_with_map(source, from, to)` - With source map

---

## 6. The Truth About "Simulation"

### 6.1 What Exists

| Feature | Code Location | Reality |
|---------|--------------|----------|
| JavaScript "Fake" Simulation | NONE | Does not exist |
| QEMU "Real" Simulation | NONE | Does not exist |
| NeuroForge Time | NONE | Does not exist |
| Virtual GPIO | NONE | Does not exist |
| Real QEMU Backend | NONE | Only docs/QEMU_SETUP.md |

### 6.2 What "runSimulation" Actually Does

```typescript
// From apps/shared/src/state/ide.svelte.ts
async runSimulation() {
    // Step 1: Transpile (validate syntax)
    asl.transpile(this.code, this.language, this.language);
    
    // Step 2: Lie to user
    this.addLog('Simulation build successful.', 'success');
    this.addLog('Running on virtual target...', 'info');  // <-- Fake message
}
```

There is NO execution. NO simulation. NO QEMU. Just transpilation validation.

### 6.3 Documentation vs Reality

| Document | Claims | Reality |
|----------|--------|----------|
| docs/QEMU_SETUP.md | QEMU integration guide | Never implemented |
| Master Arch Report (v3) | "Fake Mode (JavaScript)" | Does not exist |
| Master Arch Report (v3) | "Real Mode (QEMU)" | Does not exist |

---

## 7. Data Flow (Actual)

### 7.1 Transpilation Flow Only

```
┌─────────────────────────────────────────────────────┐
│                    USER INPUT                       │
│              (Code in C/Python/Rust/ST)             │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                  PARSING STAGE                      │
│   Source language detection → Parser selection      │
│   tree-sitter (C/Py/Rust) or pest (ST)             │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│             ASL IR (AslProgram JSON)                │
│   Universal intermediate representation            │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│              GENERATION STAGE                       │
│   Target language generator → Output code           │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                   OUTPUT CODE                      │
│              (Transpiled result)                   │
└─────────────────────────────────────────────────────┘
```

### 6.2 NO Execution Pipeline

The following do NOT exist:
- ❌ JavaScript executor
- ❌ QEMU integration
- ❌ Virtual GPIO
- ❌ Virtual timers
- ❌ Component simulation

---

## 8. Development Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| ASL Transpiler | ✅ Active | C, Python, Rust, ST supported |
| Web IDE | ✅ Active | SvelteKit + Monaco |
| Desktop IDE | ✅ Active | Tauri 2 |
| Mobile IDE | ✅ Active | Tauri 2 |
| WASM Integration | ✅ Active | Browser-based transpilation |
| IL/LD/FBD/SBC | ❌ Stub | Not implemented |
| **Simulation/Execution** | ❌ **None** | **Does not exist** |
| **QEMU Integration** | ❌ **None** | **Does not exist** |
| neuroforge-transport | ❌ Empty | Never implemented |
| neuroforge-firmware | ❌ Empty | Never implemented |

---

## 9. Corrected File Structure

```
neuroforge/
├── apps/
│   ├── desktop/              # Tauri desktop app
│   ├── webapp/               # SvelteKit web app
│   ├── mobile/              # Tauri mobile app
│   └── shared/              # Shared components + WASM
├── crates/
│   ├── neuroforge-asl/      # ✅ CORE: Transpiler
│   ├── neuroforge-transport # ❌ STUB
│   └── neuroforge-firmware # ❌ STUB
├── packages/
│   └── asl-wasm/            # ⚠️ NOT in workspace
├── .opencode/               # AI agents
├── agent_skills/             # LLM prompts
├── docs/                    # Documentation
│   └── QEMU_SETUP.md        # 📝 Documentation only
└── firmware/                # ❌ Empty directories
```

---

## 10. Key Finding

**NeuroForge is a transpiler, NOT a simulator.**

The architecture documents (v1-v3) incorrectly described:
1. A JavaScript-based "fake simulation" mode - **Does NOT exist**
2. A QEMU-based "real simulation" mode - **Does NOT exist**
3. "NeuroForge Time" virtual timing - **Does NOT exist**
4. Virtual GPIO/component simulation - **Does NOT exist**

The "runSimulation" button in the IDE is a placebo - it only runs transpilation validation and prints fake status messages.

---

*Document Version 4.0 - Corrected based on actual code analysis*
*Generated: April 2026*
