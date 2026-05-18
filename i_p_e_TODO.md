# DendriForge Implementation TODO List

## 🏗️ Core & Infrastructure
- [ ] **ASL Development (The Rosetta Stone)**
    - [ ] Define ASL Intermediate Representation (IR) structure
    - [ ] Implement ASL IR Normalizer
    - [ ] Implement ASL IR Analyzer (Static Analysis)
    - [ ] Implement ASL IR Optimizer
    - [ ] Implement Library Resolver (ASL Library System)
- [ ] **Transpilation Engine**
    - [ ] Implement Parser framework (Source $\to$ ASL IR)
    - [ ] Implement Generator framework (ASL IR $\to$ Target)
    - [ ] Build Rust/PyO3 high-performance bridge (Parsing, Generation, Simulation Loop)
- [ ] **Simulation Engine**
    - [ ] Implement Digital Simulation (Python/Rust)
    - [ ] Implement Analog Simulation (Ngspice integration)
    - [ ] Implement PLC Scan Cycle runtime
- [ ] **Communication & Transport**
    - [ ] Implement `dendriforge.core.transport` (Serial, Socket, Industrial protocols)
    - [ ] Implement WebSocket real-time sync for simulation/logs

## 📦 Asset Management (TOON + SVG)
- [ ] **Board Profiles**
    - [ ] Establish TOON + SVG standard for boards
    - [ ] Populate base board repository (`dendriforge/core/boards`)
- [ ] **Component Profiles**
    - [ ] Establish TOON + SVG standard for components
    - [ ] Populate base component repository (`dendriforge/core/components`)
- [ ] **Library System**
    - [ ] Implement `.toonlib` / `library.toml` manifest system

## 🚀 Implementation Phases

### Phase 1: Core/MVP (Maker & Classroom)
- [ ] **Hardware Support (Parsers/Generators/Profiles)**
    - [ ] Arduino Family (Uno R3, Mega 2560, Nano, Leonardo, Micro, Due, MKR, Opta)
    - [ ] Raspberry Pi Family (Pico, Pico 2, Zero 2 W)
    - [ ] ESP32 Family (DevKitC V4)
    - [ ] STM32 Family (Blue Pill, Black Pill)
    - [ ] Virtual/Generic PLC (16 I/O, 32 I/O)
- [ ] **Core Services**
    - [ ] Basic FastAPI orchestrator
    - [ ] Basic NiceGUI Desktop/Web interface

### Phase 2: Community/Pro (Advanced Maker & Hobbyist)
- [ ] **Hardware Expansion**
    - [ ] Extended Arduino (Uno R4, Nano ESP32, etc.)
    - [ ] Adafruit/Seeed/Maker Boards (Feather, XIAO, M5Stack, etc.)
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

## 🎨 Presentation & UX
- [ ] **Web/Desktop (NiceGUI)**
    - [ ] Implement unified UI for Web & Desktop
    - [ ] Develop interactive wiring/diagramming engine
- [ ] **Mobile (Kivy)**
    - [ ] Develop mobile dashboard for telemetry/monitoring
- [ ] **Design System**
    - [ ] Implement WCAG-aligned design system (Slate/Industrial palette)
    - [ ] Ensure A11Y compliance (Color + Icon + Text)
