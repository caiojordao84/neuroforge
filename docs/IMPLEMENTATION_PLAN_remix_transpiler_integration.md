# Remix Transpiler Integration Implementation Plan

> **Status**: Draft Implementation Plan  
> **Date**: April 7, 2026  
> **Objective**: Integrate Remix Ladder Logic transpiler capabilities into NeuroForge platform

---

## Executive Summary

This plan details the integration of the Remix Transpiler (Ladder Logic + multi-language code generation) into the NeuroForge ecosystem. The integration will add 8 new target languages and enable Ladder/PLC editing as a new source input type, leveraging NeuroForge's existing Rust-based transpiler architecture and Svelte 5 frontend.

### Key Deliverables
- Ladder Logic support as source language in neuroforge-asl
- 8 new language plugins (Arduino, Zig, CircuitPython, JavaScript/Espruino, Lua/NodeMCU, Ada, Forth, Assembly)
- New "PLC" tab in the NeuroForge webapp IDE

---

## Phase Breakdown

### Phase 1: Foundation & Architecture (Week 1)
**Objective**: Establish core infrastructure for Ladder support and new language plugins

| Task ID | Description | Deliverable |
|---------|-------------|-------------|
| P1.1 | Analyze existing plugin architecture in `crates/neuroforge-asl/src/plugins/` | Architecture doc |
| P1.2 | Create unified language registry system | `language_registry.rs` extension |
| P1.3 | Extend ASL type system for Ladder-specific types (Contacts, Coils, FBs) | Extended `asl_types.rs` |
| P1.4 | Define plugin interface for new language targets | Trait definitions |
| P1.5 | Setup WASM compilation pipeline for new plugins | Working wasm build |

### Phase 2: Ladder as Source Language (Week 2)
**Objective**: Enable Ladder Logic as input source, round-trip with ASL IR

| Task ID | Description | Deliverable |
|---------|-------------|-------------|
| P2.1 | Import Ladder AST types from Remix analysis | New `types/ladder_types.rs` |
| P2.2 | Implement Ladder-to-ASL transformer | `transforms/ladder_to_asl.rs` |
| P2.3 | Implement ASL-to-Ladder generator | `plugins/ladder_generator.rs` |
| P2.4 | Add Ladder to source language registry | Language detection |
| P2.5 | Create ladder-to-ST converter (IEC 61131-3) | ST output from Ladder |

### Phase 3: New Target Language Plugins (Week 3-4)
**Objective**: Implement 8 new language generators

| Task ID | Language | Deliverable |
|---------|----------|-------------|
| P3.1 | Arduino | `plugins/arduino/mod.rs` - PlatformIO/Arduino compatible |
| P3.2 | Zig | `plugins/zig/mod.rs` - Embedded Zig target |
| P3.3 | CircuitPython | `plugins/circuitpython/mod.rs` - Adafruit CPY target |
| P3.4 | JavaScript/Espruino | `plugins/espruino/mod.rs` - JS for Espruino boards |
| P3.5 | Lua/NodeMCU | `plugins/lua/mod.rs` - Lua for ESP8266/ESP32 |
| P3.6 | Ada | `plugins/ada/mod.rs` - SPARK/Ada for safety-critical |
| P3.7 | Forth | `plugins/forth/mod.rs` - Forth for embedded |
| P3.8 | Assembly | `plugins/asm/mod.rs` - AVR/ARM inline asm |

### Phase 4: Frontend Integration (Week 5)
**Objective**: Add PLC/Ladder tab to NeuroForge IDE following existing patterns

| Task ID | Description | Deliverable |
|---------|-------------|-------------|
| P4.1 | Create PLC/Ladder route in webapp | `/plc` route |
| P4.2 | Implement LadderCanvas component (Konva-based) | Visual editor |
| P4.3 | Implement LadderToolbox component | Component palette |
| P4.4 | Integrate transpiler via WASM | Real-time preview |
| P4.5 | Add language selector with new targets | Dropdown component |

### Phase 5: Testing & Verification (Week 6)
**Objective**: Ensure all phases work together correctly

| Task ID | Description | Deliverable |
|---------|-------------|-------------|
| P5.1 | Unit tests for all new plugins | Test coverage >80% |
| P5.2 | Integration tests for Ladder round-trip | Pass/fail report |
| E2E | E2E tests for frontend | Playwright tests |
| P5.4 | Cross-compilation verification | Build artifacts |
| P5.5 | Performance benchmarking | Timing report |

---

## Task Breakdown with Dependencies

### Phase 1: Foundation & Architecture

| Task | Agent | Dependencies | Test Strategy |
|------|-------|--------------|---------------|
| P1.1: Analyze plugin architecture | `explorer-agent` | None | Code inspection |
| P1.2: Create unified language registry | `backend-specialist` | P1.1 | Unit tests |
| P1.3: Extend ASL type system | `neuroforge-specialist` | P1.1 | Type check |
| P1.4: Define plugin interface | `backend-specialist` | P1.2 | Interface tests |
| P1.5: Setup WASM pipeline | `devops-engineer` | P1.4 | Build verification |

### Phase 2: Ladder as Source Language

| Task | Agent | Dependencies | Test Strategy |
|------|-------|--------------|---------------|
| P2.1: Import Ladder AST types | `neuroforge-specialist` | P1.3 | Schema validation |
| P2.2: Ladder-to-ASL transformer | `neuroforge-specialist` | P2.1 | Round-trip tests |
| P2.3: ASL-to-Ladder generator | `neuroforge-specialist` | P2.1, P1.4 | Visual output tests |
| P2.4: Add Ladder to registry | `backend-specialist` | P1.2, P2.2 | Detection tests |
| P2.5: Ladder-to-ST converter | `neuroforge-specialist` | P2.2 | IEC compliance |

### Phase 3: New Target Language Plugins

| Task | Agent | Dependencies | Test Strategy |
|------|-------|--------------|---------------|
| P3.1: Arduino plugin | `neuroforge-specialist` | P1.4 | Compile for UNO/ESP32 |
| P3.2: Zig plugin | `backend-specialist` | P1.4 | Zig build check |
| P3.3: CircuitPython plugin | `neuroforge-specialist` | P1.4 | CP syntax check |
| P3.4: Espruino plugin | `neuroforge-specialist` | P1.4 | JS lint |
| P3.5: Lua/NodeMCU plugin | `neuroforge-specialist` | P1.4 | Lua syntax check |
| P3.6: Ada plugin | `backend-specialist` | P1.4 | GNAT compile |
| P3.7: Forth plugin | `neuroforge-specialist` | P1.4 | Forth interpreter |
| P3.8: Assembly plugin | `backend-specialist` | P1.4 | AVR/ARM assemble |

### Phase 4: Frontend Integration

| Task | Agent | Dependencies | Test Strategy |
|------|-------|--------------|---------------|
| P4.1: Create PLC route | `frontend-specialist` | P2.3 | Route verification |
| P4.2: LadderCanvas component | `frontend-specialist` | P2.3 | Render tests |
| P4.3: LadderToolbox component | `frontend-specialist` | P4.2 | Interaction tests |
| P4.4: WASM integration | `frontend-specialist` | P3.1-3.8 | E2E transpilation |
| P4.5: Language selector | `frontend-specialist` | P4.4 | UX tests |

### Phase 5: Testing & Verification

| Task | Agent | Dependencies | Test Strategy |
|------|-------|--------------|---------------|
| P5.1: Unit tests | `test-engineer` | P3.1-3.8 | Test coverage |
| P5.2: Integration tests | `test-engineer` | P2, P3 | Pass/fail report |
| P5.3: E2E tests | `test-engineer` | P4 | Playwright |
| P5.4: Cross-compilation | `neuroforge-specialist` | P3.1-3.8 | Build artifacts |
| P5.5: Performance | `performance-optimizer` | P5.1 | Timing report |

---

## Agent Assignment

Based on task domains and agent specializations:

### Primary Agents
| Agent | Domain | Assigned Tasks |
|-------|--------|----------------|
| `neuroforge-specialist` | ASL/Transpiler Core | P1.3, P2.1-2.3, P2.5, P3.1, P3.3-3.5, P3.7, P5.4 |
| `backend-specialist` | Rust/Backend | P1.1-1.2, P1.4-1.5, P3.2, P3.6, P3.8 |
| `frontend-specialist` | Svelte/UI | P4.1-4.5 |
| `test-engineer` | Testing/QA | P5.1-5.3 |
| `explorer-agent` | Discovery | P1.1 |

### Agent Skills Activation
- **neuroforge-specialist**: Activate `asl-logic-pro`, `asl-transpiler-pro`, `asl-hardware-pro`
- **backend-specialist**: Activate `rust-pro`, `transpiler-development`
- **frontend-specialist**: Activate `svelte-development`, `frontend-design`
- **test-engineer**: Activate `testing-patterns`, `transpiler-testing`

---

## Testing Strategy

### Phase-by-Phase Testing

| Phase | Test Type | Tools | Success Criteria |
|-------|-----------|-------|-------------------|
| P1 | Architecture review | Code inspection | Plugin interface sound |
| P2 | Unit tests | `cargo test` | Ladder ↔ ASL round-trip |
| P3 | Compilation tests | Platform-specific toolchains | All 8 languages compile |
| P4 | Component tests | Vitest, Storybook | Components render correctly |
| P5 | E2E tests | Playwright | Full workflow passes |

### Test Coverage Requirements
- **Core transpiler**: >90% line coverage
- **New plugins**: >80% line coverage
- **Frontend components**: >70% component coverage
- **E2E**: Critical paths covered

### Regression Prevention
- All existing tests must pass
- Add regression tests for each new plugin
- Create reference implementations for each language
- Implement incremental testing pipeline

---

## Success Criteria

### Phase 1 Completion
- [ ] Plugin architecture documented
- [ ] Language registry accepts new entries
- [ ] ASL type system includes Ladder types
- [ ] Plugin interface supports all required methods
- [ ] WASM builds successfully with new structure

### Phase 2 Completion
- [ ] Ladder AST imported from Remix analysis
- [ ] Ladder-to-ASL transformer produces valid IR
- [ ] ASL-to-Ladder generates visual ladder diagram
- [ ] Ladder detected as valid source language
- [ ] ST output follows IEC 61131-3 standard

### Phase 3 Completion
- [ ] Arduino: Compiles for Arduino UNO and ESP32
- [ ] Zig: Builds with Zig 0.14+
- [ ] CircuitPython: Valid CP syntax
- [ ] Espruino: Valid JS for Espruino IDE
- [ ] Lua: Valid Lua for NodeMCU
- [ ] Ada: Compiles with GNAT
- [ ] Forth: Executes on ANS Forth system
- [ ] Assembly: Assembles for AVR/ARM

### Phase 4 Completion
- [ ] PLC route accessible at `/plc`
- [ ] LadderCanvas renders rungs and contacts
- [ ] LadderToolbox provides drag-and-drop
- [ ] Transpilation works via WASM in browser
- [ ] Language selector shows all 12+ targets

### Phase 5 Completion
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] E2E tests pass for critical paths
- [ ] All 8 new languages compile correctly
- [ ] Performance meets <500ms transpilation target

---

## Implementation Notes

### Key Patterns from NeuroForge Architecture
1. **Plugin Pattern**: Each language lives in `plugins/<lang>/` with parser/generator
2. **WASM Integration**: Use existing `wasm/` module for browser runtime
3. **Runes State**: Use Svelte 5 runes for reactive transpilation state
4. **Monaco Editor**: Integrate code preview in existing CodePanel
5. **Tailwind v4**: Use CSS-first configuration for styling

### Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Plugin interface breaking changes | High | Version the interface, provide adapters |
| WASM bundle size bloat | Medium | Lazy-load plugins, use dynamic imports |
| Frontend complexity | Medium | Follow existing component patterns |
| Testing coverage gap | High | Incremental testing, reference implementations |

### Dependencies Summary
```
P1 (Foundation)
├── P1.1 → P1.2, P1.3
├── P1.2 → P1.4
├── P1.3 → P2.1
└── P1.4 → P1.5, P2.3, P3.x

P2 (Ladder Source)
├── P2.1 → P2.2, P2.3
├── P2.2 → P2.4, P2.5
└── P2.3 → P4.2

P3 (Target Languages)
└── All depend on P1.4, P1.5

P4 (Frontend)
├── P4.1 → P4.2, P4.3
├── P4.2 → P4.3
├── P4.3 → P4.4
└── P4.4 → P4.5

P5 (Testing)
├── All depend on P2, P3, P4
└── P5.1 → P5.2 → P5.3
```

---

## Next Steps

1. **Immediate**: Review and approve this plan
2. **Week 1**: Begin P1.1 (architecture analysis) with explorer-agent
3. **Parallel**: Start P1.2-1.5 with backend-specialist
4. **Sync**: Weekly standups to track progress against milestones

---

*Plan prepared following NeuroForge agent protocols and system architecture reference.*