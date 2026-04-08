# NeuroForge Architectural Purge Map (Forensic Audit v2.0)

This document serves as the definitive categorization of the NeuroForge repository state following the Migration of April 2026. All entries are based on forensic investigation of file contents, dependencies, and workspace configurations.

## 🟢 CORE (Protected / Source of Truth)

| Component | Path | Description | Status |
| :--- | :--- | :--- | :--- |
| **Logic** | `crates/` | Rust workspace contains ASL engine, transport, and firmware libs. | **STABLE** |
| **Apps** | `apps/` | Web, Desktop, Mobile, and Shared frontend logic. | **STABLE** |
| **Private** | `.opencode/` | Master source for agents and skills. | **PROTECTED** |
| **Public** | `public/` | Tree-sitter WASM binaries for Monaco Editor highlighting. | **CRITICAL** |
| **Tests** | `tests/` | CI, Roundtrip, and Hardware-in-the-loop test suites. | **ACTIVE** |

## 🧪 LEGACY REFERENCE (Preserved for Historical Fidelity)

| Path | Identification | Recommendation |
| :--- | :--- | :--- |
| `firmware/` | Contains `boards/` (JSON) and `templates/` (C/PY/RS). | **KEEP**. unique historical logic not yet 100% mirrored. |
| `scripts/` | `wasm-clang.bat` - specific utility for WASM toolchain. | **KEEP**. specific build utility. |
| `bin/generate-tree.ps1` | PowerShell utility for generating ASCII directory trees. | **KEEP**. productivity tool. |

## 🔴 TRASH (Confirmed Orphans for Purge)

| Path | Forensic Rationale | Purge Target |
| :--- | :--- | :--- |
| `packages/asl-wasm/` | Contains stale build artifacts from a previous migration phase. | **DELETE** |
| `agent_skills/` | Empty directory. | **DELETE** |
| `bin/languagesect.py/` | Legacy orphaned Python package directory (bizarrely named). | **DELETE** |
| `plans/` | Contains legacy task logs from completed features. | **DELETE** |
| `.snapshots/` | Empty directory artifact. | **DELETE** |
| `dist/` | Root-level build output from abandoned root-workspace build. | **DELETE** |

## 🗺️ Workspace Configuration Status

- **pnpm-workspace.yaml**: Correctly limited to `apps/*`.
- **Cargo.toml**: Correctly maps `crates/*` and specialized `src-tauri` entries.
- **Root Files**: `pnpm-lock.yaml`, `package.json`, `.gitignore` are all valid.
