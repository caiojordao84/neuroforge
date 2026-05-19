# Architecture Decision Records (ADRs)
**Project:** DendriForge  
**Status:** Active

This document records all major architectural decisions made during the lifecycle of the DendriForge platform to provide context and rationale for the current technical stack.

---

## ADR 001: Sovereign Native Engine (PyO3 + Maturin) vs. WASM
**Date:** May 2026  
**Status:** Accepted (Phase A)

**Context:** The legacy NeuroForge architecture relied on compiling the Rust simulation and transpilation engine to WebAssembly (WASM) to run inside the user's browser. While this provided easy web deployment, it severely restricted access to local hardware (USB/Serial), caused performance bottlenecks on lower-end mobile devices, and created a split ecosystem between web and desktop.

**Decision:** We abandoned the WASM-in-browser approach. The Rust core (`neuroforge_core`) is now compiled as a native Python extension using PyO3 and Maturin. 

**Consequences:**
* **Positive:** The engine now has unrestricted access to native OS threads, local filesystem, and hardware (USB/Modbus/Serial). By using `py.allow_threads()`, the Rust engine executes physics and logic loops in sub-millisecond times, completely bypassing the Python Global Interpreter Lock (GIL).
* **Negative:** Requires platform-specific builds (`.so`, `.pyd`, `.dylib`) which complicates the CI/CD deployment pipeline for the desktop app.

---

## ADR 002: Process Isolation via ZeroMQ (ZMQ)
**Date:** May 2026  
**Status:** Accepted (Phase A)

**Context:** Running a high-frequency (1ms) PLC scan-cycle in the same OS process as a FastAPI web server risks catastrophic jitter. If the web server receives a spike in HTTP traffic, the simulation loop will drop frames, breaking real-time determinism.

**Decision:** Implementation of a strict multi-process architecture using ZeroMQ.
* **Process A (API Layer):** FastAPI handles HTTP, WebSockets, and database persistence.
* **Process B (Sim Layer):** A detached worker running the Rust PyO3 engine. 
Communication occurs via a `REQ/REP` socket for stateful commands and a `PUB/SUB` socket for high-frequency telemetry.

**Consequences:**
* **Positive:** Absolute fault isolation. A crash in the API does not halt the simulation. Jitter is eliminated. The architecture scales natively to cloud environments.
* **Positive:** Protected against "Zombie Processes" via an asynchronous heartbeat monitor in the worker.

---

## ADR 003: Delta-Streaming "Dumb Client" UI
**Date:** May 2026  
**Status:** Accepted (Phase A)

**Context:** Transmitting entire SVG DOM trees or running heavy physics engines inside the browser (`Konva.js` running ASL) scales poorly when rendering industrial panels with over 500 components.

**Decision:** The frontend UI acts exclusively as a passive "Dumb Client". It loads the static SVG once. The Rust engine calculates state changes and emits a highly compressed JSON *Delta* (e.g., `{"id": "led1", "state": 1}`). The frontend intercepts these deltas via WebSockets and simply toggles CSS classes or DOM attributes.

**Consequences:**
* **Positive:** Guarantees 60 FPS on average hardware with negligible battery consumption on mobile devices.
* **Positive:** Enables true Hybrid and Analog simulation visualization, as the heavy `Ngspice` calculations are offloaded to the server.
