# NeuroForge Complete Orphan Inventory: The 2026 Hit List

> **Status**: FINALIZED Cleanup Blueprint  
> **Last Updated**: April 6, 2026  
> **Objective**: Catalog all confirmed redundant and legacy artifacts for systematic removal while protecting the active agentic ecosystem.

---

## 🚩 1. High-Priority "Strays" (Immediate Deletion)

These files and directories have been physically audited and confirmed to provide zero value to the 2026 workspace.

### 1.1 Ghost Structures
| Path | Type | Reason |
| :--- | :--- | :--- |
| `/src` | Directory | Empty root folder from legacy structure. |
| `/app` | Directory | Abandoned placeholder directory. |
| `/_jsx_temp` | Directory | Temporary build artifacts from old transpilation tests. |
| `packages/asl-wasm` | Package | Orphaned package. Webapp now uses internal WASM compilation. |

### 1.2 Multi-Workspace Noise
Multiple VS Code workspace files lead to configuration drift. 
- **Action**: Keep `neuroforge.code-workspace`.
- **DELETE**: `app.code-workspace`, `neuroforge1.code-workspace`.

---

## 🏺 2. Legacy Migration Targets (Relocation Strategy)

These assets are conceptually active but physically misplaced according to the "Workspace-First" architecture.

### 2.1 The Firmware Consolidation
The root `firmware/` directory contains active board definitions that belong in the official Rust crate.
- **Target**: `crates/neuroforge-firmware/`
- **Move List**:
    - `firmware/boards/*` -> `crates/neuroforge-firmware/boards/`
    - `firmware/templates/*` -> `crates/neuroforge-firmware/templates/`

### 2.2 Root Script Audit
The `bin/` directory and root level contain utility scripts to be consolidated into `dev-tools/`.
- **Consolidate**: `tree_project.py`, `generate-tree.ps1`, `test_ci.ps1`.
- **Delete (Superseded)**: `verify_wasm.mjs`, `test_wasm_frontend_integration.mjs`.

---

## 📂 3. The Log & Temp "Pollution" Map

Analysis identified **~55+ files** that are redundant build/test artifacts.

### 3.1 Root Build Logs
- `error.log`, `errors.txt`, `err.txt`, `out.txt`, `output.txt`
- `build_err.txt`, `build_error.txt`, `build_out.txt`
- `final_output.txt`, `final_results.txt`

### 3.2 Crate-Specific Artifacts (`crates/neuroforge-asl/`)
- `debug_full_cst.log`, `debug_cst.log`
- `ir_debug.json`, `st_panic.log`
- `total_total_total_victory.log` (and all "victory" variants)
- `failures_summary.txt`, `syntax_error.log`

---

## 🛡️ 4. Preservation Policy (Source of Truth)

The following directories are **PROTECTED** and must **NEVER** be deleted:
- `.opencode/`: The Definitive Intelligence Source (Source of Truth).
- `.agent/`: The ACTIVE Antigravity Engine (Synchronized Pro Skills).
- `agent_skills/`: **Protected Legacy** (Future Project - Absolute Preservation).
- `apps/schemasmith/`: Active Hardware Modeling Tool.

---

## 🧹 5. Action Matrix

| Priority | Action | Target |
| :--- | :--- | :--- |
| **P0: CRITICAL** | **DELETE** | Ghost root folders (`src/`, `app/`, `_jsx_temp/`), orphaned packages. |
| **P1: CLEANUP** | **PURGE** | All `*.log` and `*.txt` artifacts from root and crates. |
| **P2: MIGRATE** | **MOVE** | Root `firmware/` content to `crates/neuroforge-firmware`. |
| **P3: CONSOLIDATE**| **MERGE** | VS Code workspace files and dev scripts. |

---
*Consolidated and verified against physical repository state on April 6, 2026. Schemasmith and .agent removed from hit list.*
