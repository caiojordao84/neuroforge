## graphify

This project has a graphify knowledge graph at notes/graphify/.

Rules:
- Before answering architecture or codebase questions, read notes/graphify/GRAPH_REPORT.md for god nodes and community structure
- If notes/graphify/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `.\scripts\update-brain.ps1` to keep the graph current (AST-only, no API cost)

## Digital Brain (Obsidian Vault)

Rules:
- **Primary Intelligence Context**: Before starting any session or architecture analysis, read `notes/Index.md`.
- **Session Logging**: After completing every major Task or Implementation Plan, invoke `brain_log_session` via the Brain MCP.
- **Semantic Mapping**: If you discover a novel architectural pattern or solve a complex bug, use `brain_add_knowledge`.

## ?? The Castle Protocol (Sim Engine Sovereignty)

**CRITICAL**: The monorepo has systemic resolution conflicts for WASM engines and state.
- **Rule of Location**: All simulation logic (sl) and WASM binaries MUST be served from the local pps/webapp source tree (specifically src/lib/state and src/lib/wasm).
- **Rule of Aliasing**: pps/webapp/vite.config.ts MUST globally alias @neuroforge/shared/state/asl.svelte.ts to the local sovereign loader to unify shared components.
- **Rule of the Shim**: env.js MUST contain C-stdlib callables (iswspace, etc.) and reside in the same directory as the WASM glue code.
- **Rule of the Purge**: pnpm run dev -- --force is MANDATORY after any WASM engine modification to purge "Ghost Imports" from the Vite cache.
