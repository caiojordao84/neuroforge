***

# IMPLEMENTATION_PLAN — Board Schema, JSON Pattern, and Core Route Integration

## 1. Objectives

- Define a **robust, future-proof pattern** for all board definitions under `apps/shared/static/boards/`, using `board-schema.json` as the contract.   
- Ensure the schema is **expressive enough** for current AVR/ESP32/RP2040 boards and future PLC/STM32/etc., without becoming over-constraining.   
- Replace hardcoded platform lists in the webapp **core route** (`apps/webapp/src/routes/core/+page.svelte`) with a **board catalogue** that is automatically derived from the board JSONs (or a generated index).   
- Align board JSONs with **agent_skills/boards/** (family skills) and the Rust-side **BoardProfile** so all three layers (skills, JSON, Rust) stay in sync.   

***

## 2. Current State Summary

### 2.1 Files and Structure

- Board assets live in `apps/shared/static/boards/`:   
  - `arduino-uno.json`  
  - `esp32-devkit.json`  
  - `raspberry-pi-pico.json`  
  - Corresponding SVGs: `arduino-uno-r3.svg`, `esp32-devkitc-v4.svg`, `raspberry-pi-pico.svg`  
  - `board-schema.json` (JSON Schema draft 2020-12) defines the structure.   

- The **core transpilation route** is `apps/webapp/src/routes/core/+page.svelte`. It:   
  - Holds a **hardcoded** `platformOptions` array with labels like `"ESP32"`, `"Arduino Uno"`, `"RP2040"`, `"STM32F4"`, etc.  
  - Does **not** currently read or reference the JSON boards under `apps/shared/static/boards`.  

- Board family skills exist in `agent_skills/boards/`: `avr-family.md`, `esp32-family.md`, `rp2040-family.md`.   

### 2.2 Schema Capabilities and Gaps

`board-schema.json` already covers:   

- Basic metadata: `id`, `name`, `manufacturer`, `mcu`, `category`, `image`, `url` (optional).  
- Specs: `flashMemory`, `sram`, `eeprom`, `clockSpeed`, `voltage`, `wireless`.  
- Physical `dimensions`.  
- `powerPins` with names like `VIN`, `5V`, `3V3`, `GND`, etc.  
- `gpio` with per-pin flags: `type` (`digital`/`analog`/`power`), `pwm`, `interrupt`, `adc`, `dac`, `touch`, `inputOnly`, `label`.  
- `peripherals`: `serial`, `i2c`, `spi`, `wifi`, `bluetooth`.  
- `usb`, `restrictions`, `compatibility`, `languages`, `bootloader`.  

Gaps relative to the planned system:

- **Limited GPIO type enum** — no explicit `ground`, `special`, or protocol aliases like `i2c`, `spi`, `uart` at pin-level (only encoded via `peripherals`).  
- **No explicit link to board family skills** (`avr-family`, `esp32-family`, etc.) for the agent.  
- **No explicit link to Skill IDs / Rust BoardProfile IDs** for use inside `TranspileContext`.  
- `additionalProperties: false` on `gpio` prevents vendor-specific flags (e.g. `rtcGpio`, `strapping`, `bootPin`).   

***

## 3. Board Schema Audit and Extension Plan

### 3.1 Goals for the Schema

- Keep `board-schema.json` as the **single authoritative contract** for front-end board files.  
- Extend the schema minimally to cover:  
  - Mapping to **board family skill IDs** and **Rust BoardProfile IDs**.  
  - A richer, but not over-prescriptive, description of **GPIO roles**.  
  - Vendor- or family-specific pin attributes via a controlled `meta` object.  

### 3.2 Add Agent/Rust Integration Fields

Add a new top-level object `neuroforge` to the schema to glue boards ↔ skills ↔ Rust:

```jsonc
"neuroforge": {
  "type": "object",
  "description": "NeuroForge-specific integration metadata",
  "properties": {
    "boardFamilySkillId": {
      "type": "string",
      "description": "ID of the board family skill in agent_skills/boards (e.g. 'avr-family')"
    },
    "boardProfileId": {
      "type": "string",
      "description": "Rust BoardProfile identifier (used by ASL engine)"
    },
    "defaultLanguageSkills": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Preferred language skill IDs for this board (agent_skills/languages)"
    }
  },
  "additionalProperties": false
}
```

**Implementation steps:**

1. Edit `board-schema.json` to add `neuroforge` under `properties` and, optionally, add `neuroforge` to `required` for newly authored boards (existing ones can be migrated gradually).   
2. Align `boardFamilySkillId` with filenames under `agent_skills/boards/*.md` (`avr-family`, `esp32-family`, `rp2040-family`, later `stm32-family`, etc.).   
3. Align `boardProfileId` with the Rust enum/ID you use in `neuroforge-asl` (e.g. `BoardProfileId::ArduinoUno`, `BoardProfileId::Esp32DevKit`).  
4. Populate `defaultLanguageSkills` with values like `arduino-cpp-avr`, `rust-embassy-avr`, etc., reusing the IDs from `agent_skills/languages/*.md`.   

### 3.3 Relax and Enrich `gpio` Definition

Current `gpio` item schema: `type` is `digital|analog|power`; `additionalProperties: false`.   

**Planned changes:**

1. **Extend `type` enum** to support ASL signal mapping more explicitly:

```jsonc
"type": {
  "type": "string",
  "enum": [
    "digital",
    "analog",
    "power",
    "ground",
    "special"
  ],
  "description": "Pin base type (not protocol-specific)"
}
```

2. Add **`roles`** as a string array to capture protocol-specific functions, used by the ASL → hardware mapper:

```jsonc
"roles": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": [
      "i2c-sda",
      "i2c-scl",
      "spi-mosi",
      "spi-miso",
      "spi-sck",
      "spi-ss",
      "uart-tx",
      "uart-rx",
      "can-tx",
      "can-rx",
      "usb-dp",
      "usb-dm",
      "boot",
      "reset",
      "status-led"
    ]
  },
  "uniqueItems": true,
  "description": "Logical roles this pin can serve"
}
```

3. Replace `additionalProperties: false` at `gpio.items` level with a **controlled `meta` object** to allow vendor/family-specific attributes without schema breakage:

```jsonc
"meta": {
  "type": "object",
  "description": "Vendor/family-specific pin metadata",
  "additionalProperties": {
    "type": ["string", "number", "boolean"]
  }
}
```

and keep `additionalProperties: false` for top-level properties other than `meta`.

4. Update the three existing JSON boards (`arduino-uno.json`, `esp32-devkit.json`, `raspberry-pi-pico.json`) to:   
   - Set `type` appropriately (`ground` for GND, `power` for 5V/3V3, `analog` for A0–A5, etc.).  
   - Add `roles` for pins with dedicated default functions (e.g. `i2c-sda`, `i2c-scl`, `spi-mosi`, `spi-sck`, `uart-tx`, `uart-rx`, `status-led`).  
   - Use `meta` for properties like `rtcGpio: true`, `strapping: true`, `bootPin: true`, etc. on ESP32 and RP2040.  

### 3.4 Tighten/Clarify `languages` Field

Currently: `languages` is an array of generic names like `"arduino-cpp"`, `"micropython"`, `"rust"`, `"assembly"`.   

Planned approach:

- Keep `languages` as the **human-readable, coarse list** (for UI badges).  
- Use `neuroforge.defaultLanguageSkills` as the precise mapping to agent skill IDs.  

No schema change needed beyond documenting the contract in comments and ensuring `languages` stays in sync with `defaultLanguageSkills` conceptually.

***

## 4. Board JSON Authoring Pattern and Future Boards

### 4.1 Authoring Pattern

Define a canonical pattern for each board JSON:

1. **Identity & Metadata**  
   - `id` → kebab-case, must match filename prefix (`arduino-uno.json` → `id = "arduino-uno"`).  
   - `name` → human-readable, used in the UI.  
   - `manufacturer`, `mcu`, `category`, `image`, `url`.  

2. **Specs**  
   - `flashMemory`, `sram`, `eeprom`, `clockSpeed`, `voltage`, `wireless`.  
   - For families with variants, document the “typical” devboard or the one you primarily target.  

3. **Dimensions**  
   - `width`, `height`, `thickness` in mm, tuned to the existing SVG coordinates for consistent rendering.  

4. **Power Pins (`powerPins`)**  
   - Use canonical names (`VIN`, `5V`, `3V3`, `GND`, `VBAT`, `RESET`, `AREF`, `IOREF`).   
   - Include `voltage` where known and `direction` (`input`, `output`, `bidirectional`).  

5. **GPIO Pins (`gpio`)**  
   - One entry per logical pin.  
   - `pin` numeric ID used by ASL and by the underlying firmware target.  
   - `type`, boolean flags, `label`, `roles`, `meta`.  
   - Keep `pin` 1:1 with underlying firmware numbering (e.g. digital 0–13 on Uno, GPIO numbers on ESP32, GPIO numbers on RP2040).  

6. **Peripherals**  
   - `serial`, `i2c`, `spi`, `wifi`, `bluetooth` filled with defaults plus cross-checked with `gpio.roles`.  

7. **Restrictions**  
   - Use `strappingPins`, `reservedPins`, `warnings`, `outputCurrent` for constraints that must be surfaced to the ASL validator and UI.  

8. **Compatibility & Languages**  
   - `compatibility` for Arduino core, PlatformIO ID, etc.  
   - `languages` for human-readable stack; `neuroforge.defaultLanguageSkills` for agent skills.  

9. **NeuroForge Integration (`neuroforge`)**  
   - `boardFamilySkillId` → e.g. `avr-family`, `esp32-family`, `rp2040-family`.  
   - `boardProfileId` → e.g. `arduino-uno`, `esp32-devkit`, `rp-pico`.  
   - `defaultLanguageSkills` → list of skill IDs from `agent_skills/languages`.  

### 4.2 Future Boards

When adding new boards (e.g. STM32 Nucleo, RP2350 Pico 2, PLC devkits):

- Create `*.json` following the pattern above.  
- Add/update `board-family` skill file in `agent_skills/boards/` if a new MCU family is introduced.   
- Set `neuroforge.boardFamilySkillId` and `neuroforge.boardProfileId`.  
- Add board entry to the board catalogue (see Section 5).  

***

## 5. Webapp Integration — Automatic Board Loading in Core Route

### 5.1 Current Situation

`apps/webapp/src/routes/core/+page.svelte` uses a **hardcoded** `platformOptions` array with values like `'ESP32'`, `'Arduino Uno'`, `'RP2040'`, `'STM32F4'`, `'Siemens S7-1200'`, etc.   

This array is not linked to:

- The JSON boards in `apps/shared/static/boards`.   
- The board family skills.  
- The Rust BoardProfile IDs.  

### 5.2 Desired Behaviour

- The **UI dropdown** shows boards/platforms based on a **single source of truth** — a board catalogue derived from `apps/shared/static/boards/*.json`.  
- Each selected platform maps cleanly to:  
  - `BoardProfileId` in Rust.  
  - `boardFamilySkillId` and `defaultLanguageSkills` in agent skills.  
- New boards become available by creating a JSON board (and updating the catalogue or running a generator), **without editing Svelte code**.

### 5.3 Board Catalogue Design

Because `apps/shared/static/boards` is in the **static assets** path, listing files dynamically at runtime in the browser is not trivial. Instead, define an explicit catalogue:

1. Add a new file `apps/shared/static/boards/boards-index.json`:

```jsonc
{
  "version": 1,
  "boards": [
    {
      "id": "arduino-uno",
      "name": "Arduino Uno (ATmega328P)",
      "path": "/boards/arduino-uno.json",
      "family": "avr-family",
      "boardProfileId": "arduino-uno",
      "category": "maker"
    },
    {
      "id": "esp32-devkit",
      "name": "ESP32 DevKitC V4",
      "path": "/boards/esp32-devkit.json",
      "family": "esp32-family",
      "boardProfileId": "esp32-devkit",
      "category": "maker"
    },
    {
      "id": "raspberry-pi-pico",
      "name": "Raspberry Pi Pico (RP2040)",
      "path": "/boards/raspberry-pi-pico.json",
      "family": "rp2040-family",
      "boardProfileId": "rp-pico",
      "category": "maker"
    }
  ]
}
```

2. For now, maintain `boards-index.json` **manually** (later SchemaSmith can regenerate it after board edits).  

3. The `path` is the public URL under SvelteKit static `/boards/…`. (`apps/shared/static` typically maps to `/` in the built app).  

### 5.4 Adapting Core Route

In `apps/webapp/src/routes/core/+page.svelte`:   

1. Replace the hardcoded `platformOptions` array with state derived from a `boardsCatalogue`:

```ts
let boardsCatalogue = $state<{ id: string; name: string; boardProfileId: string; family: string; path: string; }[]>([]);
let platform = $state<string>('esp32-devkit'); // default board id instead of generic label
```

2. Load `boards-index.json` on mount:

```ts
onMount(async () => {
  isBrowser = true;

  try {
    const res = await fetch('/boards/boards-index.json');
    if (!res.ok) throw new Error('Failed to load boards catalogue');
    const data = await res.json();
    boardsCatalogue = data.boards;
    if (!boardsCatalogue.find(b => b.id === platform)) {
      platform = boardsCatalogue[0]?.id ?? platform;
    }
  } catch (e) {
    console.warn('Boards catalogue load failed:', e);
  }

  try {
    await initWasm();
    wasmReady = true;
  } catch (e) {
    console.warn('WASM initialization failed:', e);
  }
});
```

3. Bind the **Target Platform** `<select>` to `boardsCatalogue`:

```svelte
<select
  id="core-platform"
  bind:value={platform}
  class="..."
>
  {#each boardsCatalogue as board}
    <option value={board.id}>{board.name}</option>
  {/each}
</select>
```

4. When calling `orchestrator.transpile`, pass the **board id** instead of a generic label:

```ts
transpileResult = await orchestrator.transpile({
  sourceLang,
  targetLang,
  targetPlatform: platform, // now board.id, e.g. "esp32-devkit"
  code: sourceCode,
  libraries: library.libraries.map(l => ({ name: l.name, source: l.content }))
}, 'auto');
```

5. On the **Rust/ASL side** (not in this file, but by contract), interpret `targetPlatform` as:

- Look up board JSON by `id`.  
- Load/resolve `BoardProfile` and `boardFamilySkillId` from the JSON’s `neuroforge` object.  
- Build `TranspileContext` that includes both ASL program, board profile, and language target.

### 5.5 Backwards Compatibility Hooks

- Keep the old `platformOptions` list as a fallback in a temporary branch (or keep a static map from legacy names → board ids) while migrating the rest of the stack.  
- Ensure `boards-index.json` includes platforms that currently exist in the dropdown (or at least the MCU families you truly support in Rust).  

***

## 6. Schema Validation and Tooling

### 6.1 Validation Flow

- Use `board-schema.json` as the **single source of truth** for JSON validation.   
- When editing/creating boards via SchemaSmith:  
  - Validate user input against the schema in the frontend (AJV or similar).  
  - On save, optionally re-run validation in backend/Rust tests (e.g. via `jsonschema` crate or precompiled validator).  

### 6.2 Tests

- Add a test in the Rust or Node toolchain that:  
  - Globs all `apps/shared/static/boards/*.json`.  
  - Validates each against `board-schema.json`.  
  - Ensures there are **no unknown fields** outside `meta`, and no missing required fields.  

- Add a test that:  
  - Loads `boards-index.json`.  
  - Asserts that each `path` exists, each `id` is unique, and `boardProfileId` matches some Rust-side known ID set.  

***

## 7. Migration Strategy

1. **Step 1 — Schema Update**  
   - Extend `board-schema.json` with `neuroforge`, `roles`, `meta`, extended `type` enum.   

2. **Step 2 — Migrate Existing Boards**  
   - Update `arduino-uno.json`, `esp32-devkit.json`, `raspberry-pi-pico.json` to conform to the new schema, setting `neuroforge` fields and `roles`.   

3. **Step 3 — Introduce `boards-index.json`**  
   - Create index with the three boards and wire them to families/BoardProfile IDs.  

4. **Step 4 — Adapt `core/+page.svelte`**  
   - Replace hardcoded `platformOptions` with data from the catalogue; adjust to send the board id as `targetPlatform`.   

5. **Step 5 — Rust/ASL Integration**  
   - Update `orchestrator`/backend to interpret `targetPlatform` as board id and to load BoardProfile accordingly.  

6. **Step 6 — New Boards**  
   - Once the pipeline is validated, add new boards (e.g. STM32, RP2350, PLC devkits) as new JSON files conforming to the extended schema.  

***

## 8. Future Enhancements (Optional, Nice-to-Have)

- Generate `boards-index.json` automatically from the JSON boards during build (Node script or Rust build tool), so adding/removing boards is single-source.  
- Integrate SchemaSmith so that saving a board:  
  - Writes `*.json` under `apps/shared/static/boards`.  
  - Regenerates `boards-index.json`.  
- Add a **board selection panel** in the webapp that shows SVG preview, voltage, MCU, wireless capabilities, etc., informed by `board-schema.json`.  

***