# NeuroForge Architecture Report

> **Document Version:** 2.0  
> **Last Updated:** April 2026  
> **Status:** Comprehensive Architecture Overview

---

## 1. Project Overview

### 1.1 What is NeuroForge?

NeuroForge is a **real-time microcontroller simulator** that combines a universal transpiler with virtual hardware simulation. It enables developers to write code in their preferred language (C, Python, Rust, IEC 61131-3) and execute it either:

- **Virtually** (Fake Mode): Through a JavaScript-based simulated environment
- **Physically** (Real Mode): Through QEMU integration for actual hardware emulation

### 1.2 Core Vision

- **Universal Compilation**: Transpile from multiple source languages to ASL (Abstract Simulation Language) IR
- **Virtual Hardware**: Simulate microcontrollers, GPIO, sensors, and peripherals
- **Cross-Platform IDE**: Desktop, Web, and Mobile interfaces built with Svelte 5 and Tauri 2

---

## 2. Monorepo Structure

### 2.1 Workspace Configuration

NeuroForge uses a **hybrid monorepo** combining:

| Package Manager | Workspace Type | Configuration File |
|----------------|----------------|--------------------|
| **pnpm** | JavaScript/TypeScript | `pnpm-workspace.yaml` |
| **Cargo** | Rust crates | `Cargo.toml` (root) |

### 2.2 Directory Layout

```
neuroforge/
├── apps/                    # Frontend applications (pnpm workspace)
├── crates/                  # Rust backend crates (Cargo workspace)
├── packages/                # Shared npm packages
├── .opencode/               # AI agent system (22 agents, 60+ skills)
├── agent_skills/            # LLM prompts for 40+ languages/platforms
├── docs/                    # Documentation
├── firmware/                # Firmware utilities (empty stub)
├── public/                  # Static assets (tree-sitter WASM)
└── bin/                     # Build scripts
```

---

## 3. Systems and Subsystems

### 3.1 Frontend Applications (`apps/`)

| Application | Framework | Purpose | Status |
|-------------|-----------|---------|--------|
| **@neuroforge/desktop** | Tauri 2 + Svelte 5 | Desktop IDE for Windows/macOS/Linux | Active |
| **@neuroforge/webapp** | SvelteKit | Web-based IDE | Active |
| **@neuroforge/mobile** | Tauri 2 + Svelte 5 | Mobile IDE for iOS/Android | Active |
| **@neuroforge/schemasmith** | (Planned) | Board/schema design tool | Not Started |
| **@neuroforge/shared** | Svelte 5 + TypeScript | Shared components + WASM bindings | Active |

#### Technology Stack per App

- **Svelte 5** with runes (`$state`, `$derived`, `$effect`)
- **SvelteKit** for routing and SSR
- **Tailwind CSS v4** for styling
- **Monaco Editor** for code editing
- **@xyflow/svelte** for circuit visualization

### 3.2 Rust Crates (`crates/`)

| Crate | Purpose | Status |
|-------|---------|--------|
| **neuroforge-asl** | ASL transpiler - transpiles C, Python, Rust, IEC 61131-3 to ASL IR | **Active** |
| **neuroforge-transport** | Communication layer | **EMPTY STUB** |
| **neuroforge-firmware** | Firmware utilities | **EMPTY STUB** |

#### neuroforge-asl Architecture

```
neuroforge-asl/
├── src/
│   ├── lib.rs                 # Main entry point
│   ├── parser/                # Tree-sitter based parsers
│   │   ├── tree_sitter_loader.rs
│   │   ├── language_registry.rs
│   │   └── neuro_parser.rs
│   ├── transforms/            # AST transformations
│   │   ├── code_to_asl.rs     # Main transformation pipeline
│   │   ├── ast_normalizer.rs
│   │   ├── block_transform.rs
│   │   ├── expr_transform.rs
│   │   └── ...
│   ├── types/                 # Type system
│   │   ├── asl_types.rs
│   │   ├── typed_nodes.rs
│   │   └── nodes.rs
│   ├── optimizer/             # Optimization passes
│   │   ├── constant_fold.rs
│   │   ├── dead_code.rs
│   │   └── inline_const.rs
│   ├── plugins/              # Code generators
│   │   ├── mod.rs
│   │   └── rust_std/rust_generator.rs
│   ├── wasm/                 # WASM bindings
│   │   ├── bindings.rs
│   │   └── mod.rs
│   ├── flow/                 # Control flow analysis
│   ├── helpers/              # Utility functions
│   └── asl_types/validation/ # Type validation
├── examples/                  # Example programs
├── tests/                    # Integration tests
└── Cargo.toml
```

### 3.3 Shared Packages (`packages/`)

| Package | Purpose | Contents |
|---------|---------|----------|
| **asl-wasm** | WASM bindings for neuroforge-asl | Compiled WASM + JS bindings |

```
packages/asl-wasm/pkg/
├── neuroforge_asl.js         # JavaScript bindings
├── neuroforge_asl_bg.wasm    # Compiled WASM
├── neuroforge_asl.d.ts       # TypeScript definitions
└── package.json
```

### 3.4 AI/Agent Systems

#### .opencode/ Directory

**Active** agent system with 22 specialized agents and 60+ skills.

| Category | Count | Examples |
|----------|-------|----------|
| **Agents** | 22 | backend-specialist, frontend-specialist, transpiler-tester, etc. |
| **Skills** | 60+ | rust-pro, svelte-development, transpiler-development, etc. |
| **Stacks** | 16 | svelte, react, nextjs, flutter, etc. |
| **Data** | 12 CSV files | UI guidelines, design systems, prompts |

#### .agent/ Directory

**Duplicate** of .opencode/ - identical structure, provides no additional value.

#### agent_skills/ Directory

LLM prompts for 40+ languages/platforms:

| Category | Count | Examples |
|----------|-------|----------|
| **Languages** | 15+ | micropython-esp32, arduino-cpp-*, rust-embassy-* |
| **Components** | 12+ | button-input, uart, i2c-sensor, rgb-led |

### 3.5 Backend/Simulation

#### QEMU Integration

| Status | Documentation | Implementation |
|--------|---------------|----------------|
| **DOCUMENTED ONLY** | `docs/QEMU_SETUP.md` | **NOT IMPLEMENTED** |

The QEMU integration is documented in `docs/QEMU_SETUP.md` but has not been implemented. Only a Proof of Concept (POC) exists.

---

## 4. Technology Stack

### 4.1 Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Svelte** | 5.x | UI framework with runes |
| **SvelteKit** | 2.x | Full-stack framework |
| **Tailwind CSS** | v4 | Utility-first CSS |
| **Monaco Editor** | Latest | Code editor |
| **@xyflow/svelte** | Latest | Circuit/node visualization |
| **Tauri** | 2.x | Desktop/mobile runtime |

### 4.2 Backend Stack

| Technology | Purpose |
|------------|---------|
| **Rust** | Transpiler core |
| **tree-sitter** | Parser generation |
| **wasm-bindgen** | WASM interop |
| **Node.js** | Web server |
| **Express** | HTTP server |
| **Socket.IO** | Real-time communication |

### 4.3 Build Tools

| Tool | Purpose |
|------|---------|
| **pnpm** | Package management |
| **Vite** | Frontend bundling |
| **Cargo** | Rust compilation |
| **Tauri CLI** | Desktop app building |

---

## 5. Key Architectural Patterns

### 5.1 ASL as Universal IR

```
Source Code                    ASL Intermediate Representation
─────────────────────────       ─────────────────────────────────
C / C++          ──────►        ┌────────────────────────────────┐
Python           ──────►        │  Function Definitions          │
Rust             ──────►   ───►│  Variable Declarations         │──► Execution
IEC 61131-3 (ST) ──────►        │  GPIO Operations              │   (Fake or Real)
                                 │  Timing Constraints           │
                                 └────────────────────────────────┘
```

### 5.2 NeuroForge Time

Virtual timing system that synchronizes simulated components:

- **Virtual Clock**: Independent of real time
- **Event Queue**: Schedules GPIO, PWM, sensor updates
- **Cycle-Accurate**: Models MCU cycle timing

### 5.3 Plugin Architecture

```
Parser Plugins              Generator Plugins
─────────────────           ──────────────────
tree-sitter-c         ──►   rust_std
tree-sitter-python    ──►   python_std
tree-sitter-rust      ──►   (more planned)
tree-sitter-st        ──►   (IEC 61131-3)
```

### 5.4 Board and Component Profiles

| Concept | Description |
|---------|-------------|
| **Board Profile** | Defines MCU type, memory, GPIO pins |
| **Component Profile** | Defines sensors, actuators, peripherals |
| **Pin Mapping** | Logical to physical pin assignments |

---

## 6. Data Flow

### 6.1 Complete Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT                                   │
│                    (Code in C/Python/Rust/ST)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        PARSING STAGE                                    │
│   tree-sitter ──► Concrete Syntax Tree ──► AST Normalization         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     TRANSFORMATION STAGE                               │
│   AST ──► Type Checking ──► ASL IR ──► Optimization                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXECUTION STAGE                                   │
│                                                                         │
│   ┌─────────────────┐          ┌─────────────────┐                     │
│   │   FAKE MODE    │          │   REAL MODE     │                     │
│   │  (JavaScript)  │          │    (QEMU)       │                     │
│   │                │          │                 │                     │
│   │ Virtual GPIO   │          │ ARM/ESP32       │                     │
│   │ Virtual Timer  │          │ Hardware        │                     │
│   │ Virtual Periph │          │ Emulation       │                     │
│   └─────────────────┘          └─────────────────┘                     │
│         │                             │                                │
│         ▼                             ▼                                │
│   ┌──────────────────────────────────────────┐                        │
│   │        VISUALIZATION                     │                        │
│   │   @xyflow/svelte Circuit Diagram        │                        │
│   │   GPIO state, Pin levels, Timing        │                        │
│   └──────────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Key Data Structures

| Structure | Purpose |
|-----------|---------|
| `AslModule` | Top-level ASL program container |
| `AslFunction` | Function with parameters and body |
| `AslStatement` | Assignments, conditionals, loops |
| `AslExpression` | Arithmetic, logical, function calls |
| `GpioOperation` | Pin configuration, read/write |
| `TimingConstraint` | Delay, duration, cycle requirements |

---

## 7. Development Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| ASL Transpiler | **Active** | Supports C, Python, Rust, IEC 61131-3 |
| Web IDE | **Active** | SvelteKit + Monaco |
| Desktop IDE | **Active** | Tauri 2 + Svelte 5 |
| Mobile IDE | **Active** | Tauri 2 + Svelte 5 |
| WASM Integration | **Active** | neuroforge-asl compiles to WASM |
| QEMU Integration | **Not Implemented** | Documentation only |
| neuroforge-transport | **Empty Stub** | No implementation |
| neuroforge-firmware | **Empty Stub** | No implementation |
| Schemasmith | **Not Started** | Board design tool |

---

## 8. File Structure Summary

```
neuroforge/
├── apps/
│   ├── desktop/          # Tauri desktop app
│   ├── webapp/           # SvelteKit web app
│   └── mobile/           # Tauri mobile app
├── crates/
│   ├── neuroforge-asl/   # Core transpiler (ACTIVE)
│   ├── neuroforge-transport/  # STUB
│   └── neuroforge-firmware/   # STUB
├── packages/
│   └── asl-wasm/         # WASM bindings
├── .opencode/            # AI agents (60+ skills)
├── .agent/               # DUPLICATE of .opencode/
├── agent_skills/         # LLM prompts (40+ languages)
├── docs/                 # Documentation
└── public/               # Static tree-sitter WASM
```

---

*This document provides a comprehensive overview of the NeuroForge architecture as of April 2026.*