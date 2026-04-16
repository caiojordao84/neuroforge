# NeuroForge Brain Protocol: Agentic Memory Standards

> **Status**: ACTIVE
> **Target**: Antigravity & OpenCode Agents

This document defines the rules for how AI agents must read and write to the NeuroForge Digital Brain.

## 1. Reading Protocol (The "Recall" Phase)

Before attempting to answer architecture questions or perform migrations:
1. **Consult [[Index]]**: For the master architectural state.
2. **Consult [[Timeline/Index]]**: For the latest session history.
3. **Internalize context**: Answer semantic questions using documentation in `notes/Brain/` before searching raw code.

## 2. Writing Protocol (The "Memory" Phase)

### 2.1 Timeline Logging
After every major implementation or research task:
- **USE MCP TOOL**: Invoke `brain_log_session` to record progress. 
- The MCP will automatically handle date, timestamps, and formatting.
- Ensure `decisions` and `next_steps` are included for high-fidelity memory.

### 2.2 Semantic Mapping (Neurons)
If you solve a problem that isn't documented or create a new system:
- **USE MCP TOOL**: Invoke `brain_add_knowledge`. 
- Provide a clear title and semantic tags.

### 2.3 Linking Standards
- Use `[[internal-links]]` for all cross-references within the Brain.
- Use GitHub alerts (`> [!TIP]`, etc.) to highlight critical engineering gotchas.

## 3. Preservation Rules
- **DO NOT** delete files in `notes/` without explicit user permission.
- **DO NOT** overwrite manual user notes in `notes/`. Always append or ask.

---
*Follow this protocol to ensure 100% semantic parity between human and agent.*
