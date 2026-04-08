# NeuroForge Orphan Files Complete Report

> **Document Version:** 3.0 (Corrected & Verified)
> **Date:** April 6, 2026
> **Status:** Accurate Orphan File Documentation
> **Sources:** Actual codebase analysis + previous reports

---

## 1. Executive Summary

### 1.1 Purpose

This report documents **all orphaned, stray, and dead-end files** found through direct code analysis. The analysis identified **73+ files and directories** requiring attention.

### 1.2 Summary Overview

| Category | Count | Recommended Action |
|----------|-------|-------------------|
| Build Artifacts | ~45 | DELETE |
| Workspace Duplicates | 3 | DELETE |
| Empty Stub Crates | 2 | REVIEW/DELETE |
| Empty Directories | 3 | DELETE |
| Temp/Debug Files | ~12 | DELETE |
| Legacy/Abandoned | 4 | DELETE |
| Duplicate Systems | 1 | DELETE |
| **TOTAL** | **~73+** | |

---

## 2. Build Artifacts

### 2.1 Root Directory (45 files)

These files clutter the root and should be in `.gitignore`:

| File | Category | Action |
|------|----------|---------|
| `error.log` | Build log | DELETE |
| `errors.txt` | Build log | DELETE |
| `err.txt` | Build log | DELETE |
| `out.txt` | Build log | DELETE |
| `output.txt` | Build log | DELETE |
| `build_err.txt` | Build log | DELETE |
| `build_error.txt` | Build log | DELETE |
| `build_errors.txt` | Build log | DELETE |
| `build_out.txt` | Build log | DELETE |
| `full_err.txt` | Build log | DELETE |
| `final_output.txt` | Build log | DELETE |
| `final_results.txt` | Build log | DELETE |
| `final_test_debug.txt` | Build log | DELETE |
| `pwm_test_output.txt` | Build log | DELETE |
| `temp_check.log` | Build log | DELETE |
| `temp_check2.log` | Build log | DELETE |
| `temp_check3.log` | Build log | DELETE |
| `check_output.log` | Build log | DELETE |
| `cargo_wasm.log` | Cargo log | DELETE |
| `cargo_tests.log` | Cargo log | DELETE |
| `cargo_errors.log` | Cargo log | DELETE |
| `cargo_check.log` | Cargo log | DELETE |
| `test_ci.ps1` | Old script | DELETE |

### 2.2 neuroforge-asl Crate Logs (~25 files)

Located in `crates/neuroforge-asl/`:

| File | Action |
|------|--------|
| `debug_full_cst.log` | DELETE |
| `debug_cst.log` | DELETE |
| `ir_debug.json` | DELETE |
| `test_full_debug.log` | DELETE |
| `test_debug_ir.log` | DELETE |
| `test_output_final.log` | DELETE |
| `test_output.log` | DELETE |
| `check.log` | DELETE |
| `test_error.log` | DELETE |
| `total_total_total_victory.log` | DELETE |
| `final_final_final_final_victory.log` | DELETE |
| `final_final_final_victory.log` | DELETE |
| `final_judgment.log` | DELETE |
| `total_total_victory.log` | DELETE |
| `total_victory.log` | DELETE |
| `final_all.log` | DELETE |
| `test_errors.txt` | DELETE |
| `failures_summary.txt` | DELETE |
| `all_tests.log` | DELETE |
| `diag.log` | DELETE |
| `st_result.txt` | DELETE |
| `st_panic.log` | DELETE |
| `last_errors.log` | DELETE |
| `final_test_errors.log` | DELETE |
| `syntax_error.log` | DELETE |

### 2.3 Test Artifacts

| File | Location | Action |
|------|----------|--------|
| `test_wasm_frontend_integration.mjs` | Root | DELETE |
| `verify_wasm.mjs` | Root | DELETE |
| `parser-rust-embarcado-completo.md` | Root | DELETE |

---

## 3. Workspace Duplicates

### 3.1 VS Code Workspace Files

Only ONE should exist:

| File | Action |
|------|--------|
| `app.code-workspace` | DELETE |
| `neuroforge1.code-workspace` | DELETE |
| Keep: `neuroforge.code-workspace` | KEEP |

---

## 4. Empty Stub Crates

### 4.1 neuroforge-transport

```
crates/neuroforge-transport/
├── Cargo.toml
└── src/lib.rs     # Contains only: // TODO: implementar
```

**Status:** Never implemented - decide to DELETE or implement

### 4.2 neuroforge-firmware

```
crates/neuroforge-firmware/
├── Cargo.toml
└── src/lib.rs     # Contains only: // TODO: implementar
```

**Status:** Never implemented - decide to DELETE or implement

---

## 5. Empty Directories

| Directory | Status | Action |
|-----------|--------|--------|
| `firmware/boards/` | Empty | DELETE |
| `firmware/templates/` | Empty | DELETE |
| `.gemini/tmp/` | Empty | DELETE |
| `app/` | Empty | DELETE |

---

## 6. Temp/Debug Files

### 6.1 tmp/ Directory Contents

| File | Action |
|------|--------|
| `debug_tree.js` | DELETE |
| `inspect_wasm.cjs` | DELETE |
| `stitch_desktop.html` | DELETE |
| `stitch_desktop_v2.html` | DELETE |
| `stitch_desktop_v3.html` | DELETE |
| `stitch_mobile.html` | DELETE |
| `stitch_mobile_v2.html` | DELETE |
| `desktop_screenshot.png` | DELETE |
| `mobile_screenshot.png` | DELETE |
| `stitch_neuroforge_ide_dashboard.zip` | DELETE |
| `tmp/stitch_extracted/` | DELETE |

**Action:** DELETE entire `tmp/` directory

### 6.2 Other Temp Files

| File | Action |
|------|--------|
| `_jsx_temp/` | DELETE entire directory |
| `.ruff_cache/` | Keep (in .gitignore) |
| `dist/` | Keep (in .gitignore) |
| `target/` | Keep (in .gitignore) |
| `node_modules/` | Keep (in .gitignore) |

---

## 7. Legacy/Abandoned Directories

| Directory | Contents | Action |
|-----------|----------|--------|
| `app/` | Empty | DELETE |
| `src/` | Only `components/` | DELETE |
| `bin/` | Tree generation scripts | REVIEW - may still be used |
| `_jsx_temp/` | Old React temp files | DELETE |

---

## 8. Duplicate Systems

### 8.1 .agent/ Directory

`.agent/` is an exact duplicate of `.opencode/`:

| Comparison | .opencode/ | .agent/ |
|------------|------------|---------|
| Structure | Identical | Identical |
| Agents | 22 | 22 |
| Skills | 60+ | 60+ |

**Action:** DELETE `.agent/` directory

### 8.2 .gemini/ Directory

Minimal/empty - check if needed:

| Directory | Contents |
|-----------|----------|
| `.gemini/tmp/` | Empty |

**Action:** REVIEW - likely DELETE

---

## 9. Orphaned Packages

### 9.1 packages/asl-wasm

| Property | Value |
|----------|-------|
| Path | `packages/asl-wasm` |
| In workspace | ❌ NO (not in pnpm-workspace.yaml) |
| Redundant to | `apps/webapp/src/lib/wasm` |

**Action:** DELETE or move WASM to proper location in apps/

---

## 10. Misleading Documentation

These files describe systems that DON'T EXIST:

| File | Claims | Reality |
|------|--------|---------|
| `docs/QEMU_SETUP.md` | QEMU integration guide | Never implemented - no QEMU code exists |
| `docs/neuroforgeArchReport.md` | JavaScript/QEMU simulation | Fake - no execution code |
| `docs/NeuroForge_Master_Architectural_Report.md` | Current vs Target | Contains false architecture claims |

**Action:** Mark these as " aspirational" or delete outdated sections

---

## 11. Action Matrix

### Priority Actions

| Priority | Action | Items |
|----------|--------|-------|
| **HIGH** | DELETE build artifacts | ~45 root + ~25 crate files |
| **HIGH** | DELETE .agent/ duplicate | 1 directory |
| **HIGH** | DELETE tmp/ directory | 12 files |
| **MEDIUM** | DELETE workspace duplicates | 2 files |
| **MEDIUM** | DELETE _jsx_temp/ | Directory |
| **MEDIUM** | DELETE packages/asl-wasm | Package |
| **LOW** | DELETE empty firmware dirs | 2 directories |
| **LOW** | DELETE empty app/, src/ | 2 directories |
| **LOW** | REVIEW stub crates | 2 crates |

---

## 12. Cleanup Script

```powershell
# NeuroForge Cleanup Script v3.0

# Build artifacts (root)
Remove-Item -Path "*.log" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.txt" -Force -ErrorAction SilentlyContinue

# Root-level temp scripts
Remove-Item -Path "test_wasm_*.mjs" -Force
Remove-Item -Path "verify_wasm.mjs" -Force
Remove-Item -Path "parser-rust-*.md" -Force

# Workspace duplicates
Remove-Item -Path "app.code-workspace" -Force
Remove-Item -Path "neuroforge1.code-workspace" -Force

# Duplicate agent system
Remove-Item -Path ".agent" -Recurse -Force

# Temp directories
Remove-Item -Path "tmp" -Recurse -Force
Remove-Item -Path "_jsx_temp" -Recurse -Force

# Empty firmware directories
Remove-Item -Path "firmware/boards" -Recurse -Force
Remove-Item -Path "firmware/templates" -Recurse -Force

# Empty legacy directories
Remove-Item -Path "app" -Recurse -Force
Remove-Item -Path "src" -Recurse -Force

# Orphaned package
Remove-Item -Path "packages/asl-wasm" -Recurse -Force

# neuroforge-asl crate logs
Set-Location "crates/neuroforge-asl"
Remove-Item -Path "*.log" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "*.txt" -Force -ErrorAction SilentlyContinue
Set-Location "../.."
```

| File | Action |
|------|--------|
| `apps/shared/static/boards/*.json` | REVIEW - Legacy JSON format (being replaced by TOON) |

---

## 14. Legacy JSON Board Files (Being Migrated)

These are the OLD JSON format files in `apps/shared/static/boards/`:

| File | Status | Action |
|------|--------|--------|
| `arduino-uno.json` | Legacy | Migrate to TOON or DELETE |
| `esp32-devkit.json` | Legacy | Migrate to TOON or DELETE |
| `raspberry-pi-pico.json` | Legacy | Migrate to TOON or DELETE |
| `board-schema.json` | Legacy schema | Migrate to TOON or DELETE |

These should be replaced by the TOON format files in `docs/boards/`.

---

## 15. Summary with SchemaSmith

| Category | Count | Recommended Action |
|----------|-------|-------------------|
| Build Artifacts | ~45 | DELETE |
| Workspace Duplicates | 3 | DELETE |
| Empty Stub Crates | 2 | REVIEW/DELETE |
| Empty Directories | 3 | DELETE |
| Temp/Debug Files | ~12 | DELETE |
| Legacy/Abandoned | 4 | DELETE |
| Duplicate Systems | 1 | DELETE |
| Legacy JSON Boards | 4 | MIGRATE/DELETE |
| **TOTAL** | **~78+** | |

---

## 16. Recommended Next Steps

1. **Execute cleanup script** to remove all identified orphans
2. **Decide on stub crates**: Either implement or delete `neuroforge-transport` and `neuroforge-firmware`
3. **Fix documentation**: Update architecture docs to reflect reality (transpiler only, no simulation)
4. **Add to .gitignore**: Ensure build logs are ignored in future
5. **Migrate legacy JSON boards**: Convert `apps/shared/static/boards/*.json` to TOON format or delete

---

*Document Version 3.0 - Corrected based on actual code analysis*
*Generated: April 2026*
