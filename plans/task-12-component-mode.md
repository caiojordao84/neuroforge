// Task 12: SchemaSmith Component Mode MVP

## Goal
Add Component Mode to SchemaSmith for defining electronic components with signal anchors, ASL hints, and restrictions.

## Tasks
- [x] 1. Update types.ts - Add Component types (ToonComponent, SignalAnchor, AslHint, Restrictions) → Verify: File compiles
- [x] 2. Create componentStore.svelte.ts - State management for component mode → Verify: Store exports work
- [x] 3. Create SignalPanel.svelte - Signal configuration form → Verify: Component renders
- [x] 4. Create AslHintForm.svelte - ASL hint configuration → Verify: Component renders
- [x] 5. Create RestrictionsForm.svelte - Component restrictions → Verify: Component renders
- [x] 6. Create ComponentMetaForm.svelte - Component metadata form → Verify: Component renders
- [x] 7. Create ComponentSvgCanvas.svelte - SVG canvas with anchor detection → Verify: Anchors detected
- [x] 8. Create component/+page.svelte - Component mode page → Verify: Route works
- [x] 9. Update +layout.svelte - Add mode switcher → Verify: Both modes accessible
- [x] 10. Test - Verify component mode loads and functions → Verify: No console errors

## Done When
- [x] Component Mode accessible via navigation (Board/Component mode switcher added)
- [x] Can load/select component SVG (Load SVG button in Component mode)
- [x] Signal anchors detected from SVG (extracts circles with class="signal-anchor")
- [x] Can configure signal, ASL hint, restrictions, metadata (all forms implemented)
- [x] Live TOON preview updates in real-time (derived store updates on change)
- [x] Can export valid component TOON file (Export button with validation)
