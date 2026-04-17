---
title: NeuroForge Full Architecture Master
date: 2026-04-16
tags: [architecture, core, system_map, asl, transpiler]
---

# NeuroForge Full Architecture Master

NeuroForge is a **Real-Time Microcontroller Intelligence Platform** that unifies multi-language transpilation with advanced hardware simulation.

## 💎 Core Technology Stack

| Layer            | Technology                    | Purpose                                                   |
| :--------------- | :---------------------------- | :-------------------------------------------------------- |
| **Frontend**     | Svelte 5 (Runes), SvelteKit 2 | High-performance reactive UI                              |
| **Logic**        | Rust (Edition 2021)           | Safe, concurrent transpiler core                          |
| **Interoperability** | WebAssembly (WASM)          | Running Rust logic in-browser                             |
| **Intelligence** | Antigravity (Agentic AI)      | Specialized Hardware Engine (neuroforge-specialist agent) |

## 🏗️ Workspace Structure (Monorepo)

- `/apps/webapp`: The main SvelteKit IDE.
- `/apps/schemasmith`: Board-to-SVG mapping tool.
- `/crates/neuroforge-asl`: The Rust-based Source of Truth for all transpilation.
- `/.agent`: Antigravity engine and specialist skills.

## 🧠 The ASL Transpilation Pipeline

1. **Source**: C, Python, Rust, ST, Arduino, Zig, etc.
2. **Parser**: Tree-sitter generates a Concrete Syntax Tree.
3. **Core**: Rust ASL Core normalizes the tree.
4. **IR**: Universal Intermediate Representation (`AslProgram`).
5. **Output**: Target code generation for 16+ languages.

## 📍 Key Features

- **NeuroForge Time**: Cycle-accurate virtual clock for simulation.
- **Omni-Directional ASL**: Round-trip code between any supported language without semantic loss.
- **PLC/Ladder Support**: Full IEC 61131-3 support including visual Ladder Logic editor.

---
[[Index|Back to Index]]
