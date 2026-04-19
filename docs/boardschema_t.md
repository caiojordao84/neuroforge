## 1. Schema Extensions (board-schema.json)

- [x] Add `neuroforge` object to `apps/shared/static/boards/board-schema.json` with:
  - [x] `boardFamilySkillId: string`
  - [x] `boardProfileId: string`
  - [x] `defaultLanguageSkills: string[]`
- [x] Extend `gpio.items.type.enum` to include `"ground"` and `"special"`.
- [x] Add `roles: string[]` to `gpio.items` (values like `i2c-sda`, `i2c-scl`, `spi-mosi`, `uart-tx`, `status-led`, etc.).
- [x] Add `meta: { [key: string]: string | number | boolean }` object to `gpio.items` and keep all other top-level properties locked (use `additionalProperties: false` at object level except `meta`).
- [x] Document in schema description how `languages` (coarse) and `neuroforge.defaultLanguageSkills` (precise skill IDs) relate.

## 2. Migrate Existing Boards JSON

- [x] Update `apps/shared/static/boards/arduino-uno.json`:
  - [x] Ensure `id` matches filename prefix (`arduino-uno`).
  - [x] Set `neuroforge.boardFamilySkillId = "avr-family"`.
  - [x] Set `neuroforge.boardProfileId = "arduino-uno"`.
  - [x] Set `neuroforge.defaultLanguageSkills` (`["arduino-cpp-avr", "rust-embassy-avr"]`).
  - [x] Add `roles` and `meta` for pins as appropriate.
- [x] Update `apps/shared/static/boards/esp32-devkit.json`:
  - [x] `neuroforge.boardFamilySkillId = "esp32-family"`.
  - [x] `neuroforge.boardProfileId = "esp32-devkit"`.
  - [x] `neuroforge.defaultLanguageSkills` (`["arduino-cpp-esp32", "micropython-esp32", "rust-embassy-esp"]`).
  - [x] Use `roles` + `meta` for pins (strapping pins, default I2C).
- [x] Update `apps/shared/static/boards/raspberry-pi-pico.json`:
  - [x] `neuroforge.boardFamilySkillId = "rp2040-family"`.
  - [x] `neuroforge.boardProfileId = "rp-pico"`.
  - [x] `neuroforge.defaultLanguageSkills` (`["arduino-cpp-rp2040", "micropython-rp2040", "rust-embassy-rp"]`).
  - [x] Use `roles` + `meta` for pins.

## 3. Create Boards Catalogue (boards-index.json)

- [x] Create `apps/shared/static/boards/boards-index.json` with structure:
  - [x] `version: number`
  - [x] `boards: { id, name, path, family, boardProfileId, category }[]`
- [x] Add entries for:
  - [x] Arduino Uno
  - [x] ESP32 DevKit
  - [x] Raspberry Pi Pico
- [x] Ensure each `path` matches the public URL (e.g. `/boards/arduino-uno.json`).

## 4. Core Route Integration (apps/webapp/src/routes/core/+page.svelte)

- [x] Replace hardcoded `platformOptions` array with state derived from the boards catalogue:
  - [x] Add `boardsCatalogue` state.
  - [x] Load `/boards/boards-index.json` in `onMount`.
  - [x] Set `platform` default to a board id from the catalogue.
- [x] Bind the Target Platform `<select>` to `boardsCatalogue`:
  - [x] `value = board.id`
  - [x] `label = board.name`
- [x] Update `orchestrator.transpile` call to send board id as `targetPlatform`:
  - [x] `targetPlatform: platform` where `platform` is the board id.
- [x] Handle errors when `boards-index.json` fails to load.

## 5. Rust/ASL Integration Hooks (High-Level)

- [x] Adjust backend/orchestrator so `targetPlatform` is treated as board id, not display label.
- [x] Introduce mapping in Rust:
  - [x] `BoardProfile` supports `neuroforge` metadata and roles.
- [x] Ensure `TranspileContext` includes:
  - [x] `board_profile`
  - [x] `board_family_skill_id`
  - [x] `default_language_skill_ids` (for agent hints).

## 6. Validation & Tests

- [x] Add script or test to validate all `apps/shared/static/boards/*.json` against `board-schema.json`.
- [x] Add script or test to validate `boards-index.json`:
  - [x] Each `id` is unique.
  - [x] Each `path` exists.
  - [x] Each `boardProfileId` is known on the Rust side.

## 7. Encore

- [x] Add `stm32-family.md` (skills) and corresponding STM32 board stub.
- [x] Added Industrial PLC stubs (Siemens S7-1200, Beckhoff TwinCAT).
- [ ] Hook SchemaSmith (Pending automation integration).