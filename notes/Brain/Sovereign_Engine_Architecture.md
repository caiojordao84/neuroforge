---
title: Sovereign Engine Architecture
date: 2026-04-19
tags: [architecture, wasm, core, stabilization, svelte5]
---

# 🏰 Sovereign Engine Architecture

> **Status**: APPROVED / MASTER LAW  
> **Context**: Resolution of monorepo resolution conflicts and establishment of a stable WASM motor.

## ⚖️ The Fundamental Laws

To ensure the stability of the simulation engine and prevent resolution loops within the monorepo, the architecture follows the **Castle Protocol**:

1. **Binary Sovereignty**: The WASM motor (`neuroforge_asl.js`) and environment shims (`env.js`) MUST be served from the local `apps/webapp` context (in `static/wasm/` or `src/lib/wasm/`). **NEVER** import binaries from shared packages via the monorepo link.
2. **State Sovereignty**: The simulation state loader (`asl`) is centralized exclusively in `apps/webapp/src/lib/state/asl.svelte.ts`.
3. **Vite Global Aliasing (The Act of Unification)**: The `webapp` Vite configuration MUST globally alias `@neuroforge/shared/state/asl.svelte.ts` to the local sovereign loader.
4. **Linker Resilience**: The `env.js` shim MUST contain robust implementations for C-stdlib utilities (`iswspace`, `iswalnum`, etc.) to satisfy the WASM linker requirements.

## 🛡️ Integrity Verification
Always monitor the console for the following initialization beacon:
`[AslState] Sovereign Engine Initialized successfully DEF-V5-FINAL`

---
[[Index|Back to Index]]
