# DendriForge — Implementation First Steps

This document outlines the strategic transition from a Rust/JS/TS codebase to a Python-centric architecture, focused on the core simulation and transpilation layers.

## 🏗️ Phase 0: Foundation & Infrastructure (The Python Shift)

The priority is to establish the Python orchestration layer and the high-performance bridges.

### 1. Core & Infrastructure (Python Orchestration)
- [ ] **ASL Development (The Rosetta Stone)**
    - [ ] Define ASL Intermediate Representation (IR) structure in Python/Rust
    - [ ] Implement ASL IR Normalizer (Python)
    - [ ] Implement ASL IR Analyzer (Static Analysis in Rust/PyO3)
    - [ ] Implement ASL IR Optimizer (Rust)
    - [ ] Implement Library Resolver (Python)
- [ ] **Transpilation Engine**
    - [ ] Implement Parser framework (Source $\to$ ASL IR)
    - [ ] Implement Generator framework (ASL IR $\to$ Target)
    - [ ] Build Rust/PyO3 high-performance bridge for parsing, generation, and simulation loops
- [ ] **Simulation Engine**
    - [ ] Implement Digital Simulation (Python/Rust hybrid)
    - [ ] Implement Analog Simulation (Ngspice integration via Python)
    - [ ] Implement PLC Scan Cycle runtime (Rust)
- [ ] **Communication & Transport**
    - [ ] Implement `dendriforge.core.transport` (Serial, Socket, Industrial protocols in Python/Rust)
    - [ ] Implement WebSocket real-time sync for simulation/logs

### 2. Asset Management (TOON + SVG)
- [ ] **Board Profiles**
    - [ ] Standardize TOON + SVG for board profiles
    - [ ] Populate core board repository (`dendriforge/core/boards`)
- [ ] **Component Profiles**
    - [ ] Standardize TOON + SVG for component profiles
    - [ ] Populate core component repository (`dendriforge/core/components`)
- [ ] **Library System**
    - [ ] Implement `.toonlib` / `library.toml` manifest system

---

## 🚀 Implementation Roadmap

### Phase 1: Core/MVP (Maker & Classroom)
*Goal: Enable basic Arduino/ESP32/Raspberry Pi simulation and transpilation.*

- [ ] **Hardware Support**
    - [ ] Arduino (Uno R3, Mega 2560, Nano, Leonardo, Micro, Due, MKR WiFi 1010, Opta WiFi, Nano 33 BLE Sense, Nano 33 IoT)
    - [ ] Raspberry Pi (Pico, Pico 2, Zero 2 W)
    - [ ] ESP32 (DevKitC V4)
    - [ ] STM32 (Blue Pill, Black Pill)
    - [ ] Virtual/Generic PLC (16 I/O, 32 I/O)
- [ ] **Core Services**
    - [ ] Basic FastAPI orchestrator
    - [ ] Basic NiceGUI Desktop/Web interface

### Phase 2: Community/Pro (Advanced Maker & Hobbyist)
*Goal: Expand hardware support and simulation fidelity.*

- [ ] **Hardware Expansion**
    - [ ] Extended Arduino (Uno R4 WiFi, Nano ESP32, Nano RP2040, etc.)
    - [ ] Adafruit/Seeed/Maker Boards (Feather, XIAO, M5Stack, LilyGO, etc.)
    - [ ] Nordic (nRF series) & Teensy
    - [ ] TI, NXP, Renesas, Infineon, Microchip (AVR/PIC)
    - [ ] Allen-Bradley (Modular/Compact)
    - [ ] Beckhoff & Berghof
    - [ ] Siemens Legacy
    - [ ] OpenPLC
- [ ] **Advanced Simulation**
    - [ ] Enhanced analog simulation models
    - [ ] Improved component-to-ASL bindings

### Phase 3: Industrial/Extended (Commercial & Industrial)
*Goal: Full professional capability including industrial protocols and safety standards.*

- [ ] **Industrial PLC Expansion**
    - [ ] Siemens S7 (1200, 1500, 300, 400)
    - [ ] Schneider/Modicon (M221, M241, M251, M340, M262, M580)
    - [ ] Omron (CP1E, CP1H, CP1L, NJ501, NX1P2)
    - [ ] Mitsubishi (FX3U, FX5U, iQ-R)
    - [ ] ABB AC500
    - [ ] Delta Electronics
    - [ ] GE/Emerson
    - [ ] Keyence, Panasonic, Horner, B&R, Phoenix Contact, Opto22, Revolution Pi, Unitronics, CODESYS
- [ ] **Industrial Features**
    - [ ] Safety lifecycle & compliance metadata (IEC 62061)
    - [ ] Industrial networking (Modbus, PROFINET, EtherNet/IP, etc.)
    - [ ] Advanced security (ISA/IEC 62443)

---

## 🎨 Presentation & UX Standards
- [ ] **Unified UI (NiceGUI)**
    - [ ] Implement unified UI for Web & Desktop (Native Mode)
    - [ ] Develop interactive wiring/diagramming engine
- [ ] **Mobile (Kivy)**
    - [ ] Develop mobile dashboard for telemetry/monitoring
- [ ] **Design System**
    - [ ] Implement WCAG-aligned design system (Slate/Industrial palette)
    - [ ] Ensure A11Y compliance (Color + Icon + Text)
