# TODO — Agent / Board / TOON Integration
> Branch: `preRust`
> Last analysed commit: [`c1b2a026`](https://github.com/caiojordao84/neuroforge/commit/c1b2a026651523dc06f356f332efbfb8b95b1a2d)

---

## ✅ Implemented and functional

- `skill_selector.rs` — complete with tests. 3-level selection logic:
  - Explicit `target.agent_skill` → used directly
  - `confidence_floor` below threshold → fallback to `base/asl_fundamentals.md`
  - Builds path via `board.get_board_family()` + `target.platform`
  - Covers AVR, RP2040, ESP32, ESP32-C3, STM32, IEC 61131-3, components (servo, i2c-sensor, display, bluetooth, etc.)
- `transpile_context.rs` — builds `TranspileContext` (`AslProgram` + `BoardProfile` + `AslTarget` + `Vec<ComponentProfile>`) with FNV-1a hash for deterministic caching via canonical TOON
- `confidence.rs` — `BoardConfidenceReport::calculate()` corrected (Bug #0a and #0b)
- `commands.rs` — `validate_board` + `validate_component` functional
- `connectionColors.svelte.ts` — Svelte store that loads `connection-colors.toon` dynamically
- **TODO-D ✅ RESOLVED** — `crate::types::asl_types::AslProgram` is a full re-export of `crate::asl_types::core::program::AslProgram` via chain: `types/asl_types.rs → pub use crate::asl_types::*` → `asl_types/mod.rs → pub use core::*`. Same type, no incompatibility.

---

## 🔴 Critical TODOs

### B — Connect `AslExecutor` to `TranspileContext` (new entry point)
> 🔴 **Critical** — bridge between the new agent system and the transpilation engine
> ✅ **Unblocked** — TODO-D confirmed resolved

The `AslExecutor` is functional but belongs to the previous architecture:

```rust
// Current signature (old architecture)
AslExecutor::run(source: &str, target: &TargetLanguage) -> TranspileOutput

// Desired pipeline
TranspileContext { board, target, program, components }
    → SkillSelector::select()                // select which .md skill to use
    → BoardConfidenceReport::calculate()     // check hardware confidence
    → AslExecutor::run_with_context()        // code generation
    → AwareTranspileOutput { code, source_map, confidence, skill_used }
```

- [ ] Define `AwareTranspileOutput` struct extending `TranspileOutput` with:
  - `confidence: BoardConfidenceReport`
  - `skill_used: String` (path of the selected `.md` skill file)
- [ ] Create `AslExecutor::run_with_context(ctx: &TranspileContext) -> Result<AwareTranspileOutput, String>`
  - [ ] Call `SkillSelector::select(&ctx.board, &ctx.target)` to resolve skill path
  - [ ] Call `BoardConfidenceReport::calculate(&ctx.board, &ctx.target, &ctx.asl_program, &ctx.components)`
  - [ ] Pass selected skill `.md` as context hint for generation
  - [ ] Delegate code generation to existing generator plugins (same as `run()`)
- [ ] Keep legacy `run()` for backward compatibility (or deprecate with `#[deprecated]`)
- [ ] Update integration tests to cover the new entry point
- [ ] Export `AwareTranspileOutput` in `lib.rs`

---

### A — Create `agent_skills/**/*.md` files
> 🔴 **Critical** — blocks the agent from actually working

`SkillSelector::select()` generates paths like `agent_skills/languages/arduino-cpp-avr.md`, `agent_skills/components/servo.md`, etc. — but **none of these files exist in the repository**.

#### Directory structure to create
```
agent_skills/
├── base/
│   └── asl_fundamentals.md          ← low-confidence fallback
├── boards/
│   └── (board family skills, optional)
├── languages/
│   ├── arduino-cpp-avr.md
│   ├── arduino-cpp-rp2040.md
│   ├── arduino-cpp-esp32.md
│   ├── arduino-cpp-esp32c3.md
│   ├── arduino-cpp-stm32.md
│   ├── arduino-cpp-generic.md       ← generic fallback
│   ├── rust-embassy-avr.md
│   ├── rust-embassy-rp.md           ← RP2040 (not rp2040)
│   ├── rust-embassy-esp.md          ← ESP32 (not esp32)
│   ├── rust-embassy-esp32c3.md
│   ├── rust-embassy-stm32.md
│   ├── rust-embassy-generic.md      ← generic fallback
│   ├── micropython-rp2040.md        ← (not micropython-rp)
│   ├── micropython-esp32.md
│   ├── micropython-esp32c3.md
│   ├── micropython-stm32.md
│   ├── circuitpython-rp2040.md
│   ├── circuitpython-esp32.md
│   ├── iec-st.md                    ← IEC 61131-3 (not iec61131-st)
│   ├── c-cpp-generic.md
│   └── python-generic.md
└── components/
    ├── servo.md
    ├── stepper-motor.md
    ├── relay.md
    ├── i2c-sensor.md
    ├── spi-sensor.md
    ├── analog-sensor.md
    ├── display.md
    ├── rgb-led.md
    ├── bluetooth.md                 ← (not ble)
    ├── wifi.md
    ├── uart.md
    ├── can-bus.md
    ├── storage.md
    ├── button-input.md
    ├── rotary-encoder.md
    ├── joystick.md
    ├── power-management.md
    └── generic-component.md         ← generic fallback
```

#### Checklist
- [ ] Define minimum content format for each `.md` (LLM instructions, code examples, platform-specific constraints)
- [ ] Create `agent_skills/base/asl_fundamentals.md`
- [ ] Create all `agent_skills/languages/*.md` files (21 files)
- [ ] Create all `agent_skills/components/*.md` files (18 files)
- [ ] Verify each filename matches **exactly** the path generated by `SkillSelector::derive_language_skill()` and `SkillSelector::select_for_component()`

> ⚠️ Filenames must match exactly — `SkillSelector` will request these paths verbatim. Any mismatch = missing skill at runtime.

---

## 🟡 Medium TODOs

### E — Modify `show_asl.rs` to use serde_toon instead of serde_json
> 🔴 **Critical** — TOON is the canonical format for the transpiler

The `show_asl.rs` example currently uses `serde_json` for output, but the transpiler uses `serde_toon` (TOML) as its canonical serialization format. This needs to be updated for consistency.

- [ ] Locate `show_asl.rs` in the examples or bin directory
- [ ] Replace `serde_json` with `serde_toon` import
- [ ] Update serialization logic from `to_string()` to use TOON format
- [ ] Test that output renders correctly as TOML
- [ ] Verify compatibility with existing TOON parsing in the codebase

---

### C — Call `loadConnectionColors()` in `+layout.svelte`
> 🟡 **Medium** — `--color-wire-*` CSS vars remain undefined at runtime

The `connectionColors.svelte.ts` store exists and is correct, but `+layout.svelte` never initializes it.

- [ ] Update `apps/schemasmith/src/routes/+layout.svelte`:
  ```svelte
  <script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { loadConnectionColors } from '$lib/connectionColors.svelte';

    onMount(() => loadConnectionColors());
  </script>

  <div class="app-container">
    <slot />
  </div>

  <style>
    .app-container {
      min-height: 100vh;
    }
  </style>
  ```
- [ ] Confirm import path matches `apps/schemasmith/src/lib/connectionColors.svelte.ts`
- [ ] Test that `--color-wire-*` vars are defined after mount

---

## Target pipeline (after TODO-B complete)

```
TranspileContext { board, target, program, components }
    → SkillSelector::select()                ← which .md skill to use
    → BoardConfidenceReport::calculate()     ← hardware confidence check
    → AslExecutor::run_with_context()        ← code generation
    → AwareTranspileOutput { code, source_map, confidence, skill_used }
```

---

## Execution order

| # | TODO | Priority | Status |
|---|---|---|---|
| D | Verify `AslProgram` re-exports | 🟡 Medium | ✅ Done |
| E | Modify `show_asl.rs` to use serde_toon instead of serde_json | 🔴 Critical | ✅ Done |
| B | New `run_with_context()` entry point | 🔴 Critical | ⬜ Pending |
| A | Create `agent_skills/**/*.md` files | 🔴 Critical | ⬜ Pending |
| C | Initialize store in `+layout.svelte` | 🟡 Medium | ⬜ Pending |
