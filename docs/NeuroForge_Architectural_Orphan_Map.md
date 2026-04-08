# NeuroForge Architectural Orphan & Legacy Map (Forensic Truth)

> **Status**: Verified Physical Inventory
> **Date**: 2026-04-06
> **Integrity Level**: High (Verified via `list_dir` and `Get-ChildItem`)

This document provides a definitive list of all files and directories residing within the NeuroForge root that are **not** members of the active `pnpm-workspace.yaml` or defined Rust workspace members.

## 🛡️ Forensic Safety Directive
Per user policy ([Extreme Caution]), these assets are **Protected Legacy**. They are documented here to prevent unintentional deletion and to provide a roadmap for future manual archival.

---

## 1. ぬ Legacy Shells (Confirmed Empty)
These directories exist in the filesystem but their functional sub-content has been cleared or moved. They remain as "Structural Markers".

| Path | Status | Risk Level | Rationale |
| :--- | :--- | :--- | :--- |
| `src/components` | **Empty Shell** | Low | Legacy React/TSX component home. |
| `app/` | **Empty Shell** | Low | Abandoned root-level app structure. |
| `_jsx_temp/lib` | **Empty Shell** | Low | Reference logic (Led/Poti) moved or cleared. |
| `_jsx_temp/panels`| **Empty Shell** | Low | UI panels from the React epoch. |
| `_jsx_temp/types` | **Empty Shell** | Low | Type definitions for the legacy IR. |

---

## 2. 📜 Dormant & Utility Scripts
Scripts residing in the root or `bin/` that are not currently integrated into the CI/CD pipeline or active workspace dev-scripts.

### Root Level
- `test_ci.ps1`: Legacy PowerShell CI script. Referenced in `documentation-templates` but not part of active `package.json` scripts.

### `/bin` Directory
- `Generate-NeuroForge-Tree.ps1`: Visualizer utility (Active but stray).
- `generate-tree-json.ps1`: Visualizer utility (Active but stray).
- `generate-tree.ps1`: Visualizer utility (Active but stray).
- `tree_project.py`: Python visualizer backend.

---

## 3. 📝 Legacy Documentation
- `_jsx_temp/README.md`: Critical reference document detailing the "Porting Progress" of React components to Svelte/Rust (v1.0.0-alpha.5). **NEVER DELETE** - serves as the migration bridge log.

---

## 4. 🗃️ Temporary Artifacts (Non-Source)
The following files are generated build/log noise and are safe to move to a `_logs/` deep-archive.
- `orphans_check.txt`
- `tmp_full_file_list.txt`
- Various `*.log` files (if present during runtime).

---
*Verified by Antigravity Kit*
