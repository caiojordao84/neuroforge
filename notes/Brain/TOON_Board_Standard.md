---
title: TOON Board Implementation Standard
date: 2026-04-19
tags: [toon, board, schema, hardware, mcu, plc]
---

# 📜 TOON Board Implementation Standard (v5.0)

> **Regent**: `board-schema.json`  
> **Engine**: `neuroforge-asl` (Rust Core)

## 🏗️ Technical Specification

The **TOON** (Transactional Object-Oriented Notation) format is the official language for defining MCUs and PLCs in NeuroForge.

### 📊 Tabular Structure (Mandatory)
Pin definitions must follow the high-density tabular pattern for efficiency and validation:
`gpio: [COUNT]{pin,label,type,pwm,adc,interrupt}:`

### 🏭 Target Differentiation
- **MCU**: `category: "maker"`, specific `boardFamilySkillId` (e.g., `avr-family`).
- **PLC**: `category: "industrial"`, `boardFamilySkillId: "plc-family"`.

### ⚖️ Location Rules
- Files (`.toon` and `.svg`) must reside in `apps/shared/static/boards/`.
- All boards must be indexed in `boards-index.json`.

## 🛡️ Authoritative Validation
Validation is enforced by the `neuroforge-asl` crate, ensuring:
1. IDs are kebab-case only.
2. No duplicate pins or overlaps.
3. Voltage and clock frequency are valid numerical values.

---
[[Index|Back to Index]]
