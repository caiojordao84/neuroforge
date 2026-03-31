# PLAN: Synchronize ASL Engine Changes to Frontend

This plan outlines the steps to rebuild the Rust WASM module and verify that the recent ASL engine improvements (PWM, For Loops, structured control flow) are correctly reflected in the NeuroForge web/desktop frontend.

## User Review Required

> [!IMPORTANT]
> The frontend relies on a WASM binary built from the Rust `neuroforge-asl` crate. If the WASM is not rebuilt, the frontend will continue to use the old, less faithful transpilation logic.

## Proposed Changes

### ASL Engine (WASM)

#### [MODIFY] [neuroforge-asl](file:///d:/Documents/NeuroForge/neuroforge/crates/neuroforge-asl)
- Rebuild the WASM module using `wasm-pack`.
- Ensure the output directory `apps/shared/src/lib/wasm` is updated.

### Frontend Integration

#### [MODIFY] [test_wasm_frontend_integration.mjs](file:///d:/Documents/NeuroForge/neuroforge/test_wasm_frontend_integration.mjs)
- Update or run the integration test to verify the new transpilation logic (e.g., checking for `Pin.value()` instead of `digitalRead` in Python output).

#### [MODIFY] [DesktopIDE.svelte](file:///d:/Documents/NeuroForge/neuroforge/apps/shared/src/components/ui/neuroforge/desktop/DesktopIDE.svelte)
- Verify that the UI correctly handles the updated ASL output. (No code changes expected here, just verification).

## Open Questions

- Should we automate the WASM rebuild on every Rust change during development?
- Are there any browser cache issues we should be aware of when testing the webapp?

## Verification Plan

### Automated Tests
- Run `node test_wasm_frontend_integration.mjs` to verify the WASM module directly.
- Run `cargo test --workspace` to ensure no regressions in the Rust code.

### Manual Verification
- Start the webapp (`pnpm run dev:webapp`) and test the PWM/For loop transpilation in the editor.
- Verify that the output matches the faithful transpilation achieved in the Rust debug example.
