# Plano de Migração e Evolução NeuroForge

**Versão:** 4.2  
**Data:** 19 de Março de 2026  
**Autor:** Caio Jordão Barradas  
**Branch de referência:** `preRust`  
**Status:** Plano estratégico definitivo — substitui todas as versões anteriores  
**Changelog v4.2 (actualizado 19 Mar 2026):** Correcções críticas derivadas de inspecção directa do código ASL (`asl_path_mapping.md`) — mapeamento completo de `flowToASL.ts` (wrapper de simulação), `transpile.ts` (entry point de transpilação), `context.ts` (`TransformContext` — dependência de todos os transforms), `postfixUtils.ts`, `helpers/` (`typeUtils.ts`, `arrayUtils.ts`), `plugins/core/ShimManager.ts`; inventário `transforms/` e `plugins/` 100% completo; estrutura do crate `neuroforge-asl` totalmente actualizada; dois pipelines (Simulação vs Transpilação) explicitamente separados. Adicionalmente, Fase 1 concluída: migração completa do motor ASL para Rust (40/40 testes de roundtrip ✅), bundle WASM compilado e validado (< 2 MB ✅), CI GitHub Actions activo em ubuntu/windows/macos ✅. Plugins PLC expandidos: IL (Instruction List), LD (Ladder Diagram), FBD (Function Block Diagram), SFC (Sequential Function Chart) implementados em Rust (commit cf6c54e) com suporte a PLCopen XML via quick-xml + plcopen crate. Ambiente de build WASM Windows documentado (wasi-sdk v25). Versões de dependências actualizadas para valores reais.

---

## Sumário Executivo

Este documento define o plano definitivo de evolução do NeuroForge desde a branch `preRust` (React 19 + Vite + Node.js) para uma plataforma unificada de três superfícies — **WebApp**, **Desktop** (Windows/macOS/Linux) e **Mobile** (Android/iOS) — partilhando exactamente a mesma UI Svelte 5, o mesmo motor ASL em Rust, e diferenciando-se apenas na camada de transporte de hardware.

O **ASL (Abstract Syntax Language)** — a representação intermédia universal do NeuroForge — é o maior diferencial competitivo do produto e deve ser defendido, expandido e nunca substituído por soluções de terceiros.

### Decisões Estratégicas Definitivas

| Decisão | Justificação |
|---|---|
| ❌ QEMU eliminado | Comunicação directa com hardware real via Rust/serial/USB sem emulação |
| ❌ Blockly eliminado | Substituído pelo **NeuroForge Flow Editor** baseado em SvelteFlow + nós ASL proprietários |
| ✅ ASL como núcleo absoluto | IR universal entre todas as linguagens, plataformas e modos de edição |
| ✅ Tauri 2 para Desktop + Mobile | Executável nativo cross-platform com acesso directo a hardware via Rust |
| ✅ SvelteKit + Svelte 5 | UI partilhada, bundle pequeno, Runes eliminam Zustand, SSR/PWA para WebApp |
| ✅ SvelteFlow (@xyflow/svelte 1.x) | Substituto directo de @xyflow/react para o editor de simulação e o Flow Editor |
| ✅ tree-sitter Rust nativo | Substituição do web-tree-sitter WASM por parsing nativo de alta performance |
| ✅ Rust Embassy/HAL | Nova linguagem alvo para MCUs: async/await nativo em hardware |
| ✅ IEC 61131-3 ST + Ladder | Linguagens obrigatórias para suporte real a PLCs industriais |
| ✅ NeuroForge Ladder Editor | Editor visual de Ladder Diagram integrado com o ASL, construído em SVG Svelte |
| ✅ Workspace Cargo + pnpm monorepo | Estrutura completa com `Cargo.toml` raiz e `pnpm-workspace.yaml` |
| ✅ Schema `.nfv` versionado | Formato de ficheiro com semver + migração automática de schema |
| ✅ CI/CD sem hardware físico | Virtual serial ports + fake MODBUS server + GitHub Actions multi-plataforma |

---

## 1. Estado Actual da Branch `preRust`

### 1.1 O Que Existe e Funciona Hoje

A branch `preRust` é a versão mais avançada do projecto. É uma SPA React 19 + Vite com um servidor Node.js separado em `/server`. Toda a lógica de simulação corre no browser.

**Motor de simulação actual (a preservar e migrar):**

O `SimulationEngine.ts` é o coração da simulação. Opera com um `EventEmitter` interno que comunica alterações de pinos para os componentes visuais. Os nós visuais (`LEDNode`, `MCUNode`, `ServoNode`, etc.) subscrevem estes eventos via hooks React e actualizam o seu estado visual em tempo real. Este padrão **deve ser preservado** na migração — apenas a camada de framework muda.

```
SimulationEngine (EventEmitter)
    ↓  emit('pinChange', { pin, state })
    ↓  emit('serialData', { data })
    ↓  emit('analogChange', { pin, value })
LEDNode / ServoNode / MCUNode (subscrevem via useEffect)
    → actualizam estado visual React → Svelte 5 $state
```

**Editor de fluxo actual (`FlowEditor.tsx`):**

Usa `@xyflow/react` para o canvas de simulação. Os nós custom (`LEDNode`, `MCUNode`, `ButtonNode`, `ServoNode`, `RGBLEDNode`, `PotentiometerNode`) são componentes React com `Handle` components do xyflow para as conexões de pinos. O `ManhattanEdge` é uma aresta custom que representa fios. Este editor é o **canvas de simulação** — não é o editor de código.

**MCUNode:** Renderiza o SVG da placa (Arduino Uno, ESP32, RP2040) com pinos interactivos. Cada pino é um `Handle` do xyflow posicionado exactamente sobre os pinos do SVG da placa real. O estado dos LEDs integrados (pin 13, TX, RX, power) é controlado pelo SimulationEngine via `emit`.

**ASL Engine actual (a migrar para Rust):**

O motor ASL em TypeScript já implementa um conjunto rico de tipos:

| Categoria | Tipos ASL | Estado |
|---|---|---|
| **Controlo de fluxo** | `if`, `while`, `for`, `doWhile`, `forIn`, `switch`, `break`, `continue` | ✅ Completo |
| **Hardware (GPIO)** | `pinMode`, `digitalWrite`, `analogWrite`, `read` | ✅ Completo |
| **Serial / UART** | `serialBegin`, `print`, `uartWrite`, `uartRead` | ✅ Completo |
| **I2C** | `i2cWrite`, `i2cRead` | ⚠️ Parcial — falta `i2cBegin`, `i2cScan` |
| **SPI** | `spiTransfer` | ⚠️ Parcial — falta `spiBegin`, `spiConfig`, `spiTransferFull` |
| **PWM** | `pwmInit`, `pwmSetDuty`, `pwmSetFreq`, `pwmStop` | ✅ Completo |
| **IEC 61131-3 (PLCs)** | `timerTON`, `timerTOF`, `timerTP`, `counterCTU`, `counterCTD`, `latchSR`, `latchRS`, `trigR`, `trigF` | ✅ Completo (Fase 1) |
| **PLC Languages** | ST, IL, LD, FBD, SFC | ✅ Migrados para Rust (Fase 1, commit cf6c54e) |
| **Servo** | `servoAttach`, `servoWrite`, `servoDetach` | ✅ Completo |
| **RGB** | `rgbSet` | ✅ Completo |

**Protocolos físicos a expandir (Fase 3+):**

| Protocolo | Tipos a adicionar | Referência |
|---|---|---|
| RS485 | `rs485Begin`, `rs485Write`, `rs485Read` | `embedded-hal` + `serialport` |
| CAN Bus | `canBegin`, `canSend`, `canReceive` | `embedded-can` crate |
| 1-Wire | `oneWireBegin`, `oneWireSearch`, `oneWireRead`, `oneWireWrite` | `embedded-onewire` crate |
| LIN Bus | `linBegin`, `linSend`, `linRead` | UART com timing específico |
| IR | `irSend`, `irRead` | `infrared` crate (NEC/RC5/RC6) |
| Ethernet | `ethernetBegin`, `tcpConnect`, `tcpWrite`, `tcpRead`, `udpSend`, `udpReceive` | `smoltcp` (MCU) |
| USB Device | `usbBegin`, `usbWrite`, `usbRead` | `usb-device` + `usbd-serial` |
| I2S (Áudio) | `i2sBegin`, `i2sWrite`, `i2sRead` | `i2s` crate |
| BLE | `bleBegin`, `bleScan`, `bleConnect`, `bleWrite`, `bleRead` | `btleplug` (Desktop) / `embassy-bluetooth` (MCU) |

**Os dois pipelines do motor ASL — Simulação vs Transpilação:**

O motor ASL opera em dois modos completamente distintos. Esta separação é **crítica** e deve ser preservada na migração Rust:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE 1 — SIMULAÇÃO (código/flow → AslProgram → ASLExecutor)           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [Entrada A] Código textual (C++/Python/Rust)                                │
│     ↓ codeToAST() — codeToASL.ts [RecursiveDescentCParser / PythonParser     │
│     ↓                / RustParser]                                            │
│ ProgramNode                                                                  │
│     ↓ normalizeAST() — astNormalizer.ts                                      │
│ ProgramNode normalizado                                                      │
│     ↓ astToASL() — codeToASL.ts (com TransformContext — context.ts)          │
│                                                                              │
│ [Entrada B] Flow Editor (nós + arestas)                                     │
│     ↓ flowToASL() — flowToASL.ts [entry point público]                      │
│        └→ FlowValidator.validate() — flow/FlowValidator.ts                   │
│        └→ new FlowToAst().generate() — flow/FlowToAst.ts                    │
│        └→ normalizeAST() — astNormalizer.ts                                  │
│        └→ astToASL('cpp') — codeToASL.ts                                     │
│                                                                              │
│ AslProgram (IR de simulação) → ASLExecutor → SimulationEngine              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ PIPELINE 2 — TRANSPILAÇÃO (Lingua A → ProgramNode → Lingua B)             │
├──────────────────────────────────────────────────────────────────────────────┤
│ NÃO usa AslProgram — usa ProgramNode directamente (fidelidade sintática)   │
│                                                                              │
│ transpileCode(src, langA, langB) — transpile.ts [entry point público]      │
│     ↓ codeToAST(src, langA) — codeToASL.ts                                  │
│ ProgramNode                                                                  │
│     ↓ normalizeAST() — astNormalizer.ts                                      │
│ ProgramNode normalizado                                                      │
│     ↓ Generator(langB).generate(ast) — plugins/[lang]/[Lang]Generator.ts    │
│ Código fonte Lang B                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regra de Ouro (do `asl_path_mapping.md`):**
- `AslProgram` é estritamente o IR de **simulação**. Nunca é usado na transpilação.
- `ProgramNode` é a gramática da **transpilação**. Também serve de AST intermedíiaria antes de `astToASL()` na simulação.
- Manter esta separação é obrigatório no crate Rust. Não fundi-los num único tipo.

### 1.2 O Que é Eliminado e Porquê

| Ficheiro/Módulo | Razão da Eliminação |
|---|---|
| `server/` completo (Node.js) | Toda a lógica de hardware migra para Rust (Tauri) |
| `src/services/QEMUApiClient.ts` | QEMU eliminado |
| `src/services/QEMUWebSocket.ts` | QEMU eliminado |
| `src/stores/useQEMUStore.ts` | QEMU eliminado *(caminho corrigido — stores estão em `src/stores/`, não na raiz)* |
| `src/engine/QEMURunner.ts` | QEMU eliminado |
| `src/engine/QEMUSimulationEngine.ts` | QEMU eliminado |
| `src/engine/blockly/` (todo) | Blockly eliminado — substituído por NeuroForge Flow Editor |
| `src/components/BlocklyEditor.tsx` | Blockly eliminado |
| `src/engine/asl/blocklyToASL.ts` | Cola Blockly→ASL — oculto em `asl/`, eliminar com o resto do Blockly |
| `src/engine/Transpiler.ts` | Stub vazio (~2KB) — nunca implementado, eliminar |
| `src/engine/example.ts` | Demo QEMU (~513B) — eliminar com QEMU |
| `fixes.md` (35KB na raiz) | Ficheiro de debug temporário — arquivar em `docs/legacy/` |
| `poc/` (directório raiz) | Código de prova de conceito — arquivar em `docs/legacy/poc/` |
| `socket.io-client` | Substituído por invoke/listen Tauri |
| `web-tree-sitter` WASM | Substituído por tree-sitter Rust nativo via WASM compilado do crate |

### 1.3 O Que é Preservado e Migrado

| Componente React Actual | Destino Svelte 5 | Notas |
|---|---|---|
| `LEDNode.tsx` | `LEDNode.svelte` | Handle xyflow → SvelteFlow Handle |
| `MCUNode.tsx` (SVG + pinos) | `MCUNode.svelte` | SVG + pinos preservados; Handle → SvelteFlow |
| `ButtonNode.tsx` | `ButtonNode.svelte` | |
| `ServoNode.tsx` | `ServoNode.svelte` | |
| `RGBLEDNode.tsx` | `RGBLEDNode.svelte` | |
| `PotentiometerNode.tsx` | `PotentiometerNode.svelte` | |
| `ManhattanEdge.tsx` | `ManhattanEdge.svelte` | |
| `FlowEditor.tsx` | `SimulationCanvas.svelte` | @xyflow/react → @xyflow/svelte 1.x |
| `SimulationEngine.ts` | `simulation_engine.rs` (Tauri) + `SimulationEngine.ts` mantido no WebApp | |
| `ASLViewer.tsx` | `ASLViewer.svelte` | Integra com crate Rust via WASM |
| `CodeEditor.tsx` | `CodeEditor.svelte` | Monaco standalone (@monaco-editor/loader) |
| `SerialTerminalPanel.tsx` | `SerialTerminalPanel.svelte` | Tauri events |
| `TopToolbar.tsx`, `LeftSidebar.tsx` | equivalentes Svelte | |
| 7 painéis de propriedades | 7 `.svelte` equivalentes | |
| Stores Zustand (7) | Svelte 5 Runes classes | Ver secção 4.3 |
| `src/components/boards/` (SVGs + JSON) | Preservados intactos | Assets independentes de framework |
| `src/engine/asl/` (todo, excl. `blocklyToASL.ts`) | Crate `neuroforge-asl` Rust + WASM | Migração por fases com testes de paridade |
| `src/lib/ledCalculations.ts` | `led_calculations.rs` | |

---

### 1.4 Ficheiros Não Mapeados em versões anteriores — Decisões Definitivas

A análise directa da branch `preRust` revelou ficheiros relevantes que não estavam documentados.

#### `src/engine/flow/` — Código de Produção (MIGRAR)

Este directório implementa a pipeline de conversão do Flow Editor para AST. É código activo, não experimental:

| Ficheiro TypeScript | Função | Destino Rust |
|---|---|---|
| `CfgBuilder.ts` | Constrói Control Flow Graph a partir dos nós/arestas do FlowEditor. Detecta ciclos, nós mortos, padrões WHILE\_LOOP/FOR\_LOOP/INFINITE\_LOOP | `cfg_builder.rs` |
| `FlowToAst.ts` | Converte CFG → `ProgramNode`. Duas estratégias: estruturada (if/while) ou máquina de estados (para fluxos complexos com nó `state`). Trata nós Ladder: `ladder_timer`, `ladder_counter`, `ladder_latch`, `ladder_trig`, `ladder_math`, `ladder_coil`. É a função `flow_to_asl()` referenciada no plano | `flow_to_ast.rs` |
| `FlowValidator.ts` | Valida o grafo antes da geração — Start/End em falta, IDs duplicados em blocos com estado | `flow_validator.rs` |

**Pipeline completa actualizada:**

```
FlowEditor (nós + arestas)
    ↓
FlowValidator → valida grafo (Start/End, IDs únicos)
    ↓
CfgBuilder → Control Flow Graph (detecta ciclos, WHILE/FOR/INFINITE)
    ↓
FlowToAst → ProgramNode (estruturada ou máquina de estados)
    ↓
code_to_asl.rs → AslProgram (IR universal)
    ↓
LanguageGenerator::generate(target_lang, board_profile)
    ↓
Código fonte / .nfv / .nfladder
```

#### `src/engine/CodeParser.ts` (26KB) — Runtime de Simulação (NÃO é parser AST)

**Atenção:** Este ficheiro **não** é um parser para o crate Rust. É um **runtime interpretativo** que executa código C++/Python e chama `simulationEngine.setPin()` e `simulationEngine.emit()` directamente. É uma responsabilidade completamente separada do `neuroforge-asl`.

| Plataforma | Destino |
|---|---|
| Desktop (Tauri) | `simulation_executor.rs` — runtime Rust que substitui a interpretação em TS |
| WebApp (SvelteKit) | Manter como `CodeParser.ts` (TS) — sem acesso a Tauri invoke |

#### Inventário Completo de Ficheiros Anteriormente Não Mapeados (actualizado v4.2)

| Ficheiro | Estado | Acção |
|---|---|---|
| `src/engine/asl/flowToASL.ts` | **Entry point público de simulação de flow** — chama FlowToAst + normalizeAST + astToASL | Migrar → `flow/flow_to_asl.rs` (Fase 1) |
| `src/engine/asl/transpile.ts` | **Entry point público de transpilação** — expoe `transpileCode()` e `transpileAST()` | Migrar → `transpile.rs` (Fase 1) |
| `src/engine/asl/transforms/context.ts` | **`TransformContext`** — dependência directa de todos os transforms (globalsMap, language, structDefs, servoInstances, rgbPins, pwmPins) | Migrar → `transforms/context.rs` (Fase 1, antes dos outros transforms) |
| `src/engine/asl/transforms/postfixUtils.ts` | Extrai side-effects `i++`/`i--` — dependência do statementRegistry | Migrar → `transforms/postfix_utils.rs` (Fase 1) |
| `src/engine/asl/transforms/index.ts` | Re-exporta todos os transforms | Migrar → `transforms/mod.rs` (Fase 1) |
| `src/engine/asl/helpers/typeUtils.ts` | Mapeia tipos C++/Python/Rust → `ASLType` | Migrar → `helpers/type_utils.rs` (Fase 1) |
| `src/engine/asl/helpers/arrayUtils.ts` | Utilitários de arrays para transforms | Migrar → `helpers/array_utils.rs` (Fase 1) |
| `src/engine/asl/plugins/core/ShimManager.ts` | Gestor de shims partilhado por todos os plugins (registo, dependências, deduplication) | Migrar → `plugins/core/shim_manager.rs` (Fase 1, antes dos plugins) |
| `src/engine/asl/LanguageRegistry.ts` | Registry de linguagens suportadas com metadata (extension, monacoLanguage, isASLSupported) | Migrar → `language_registry.rs` (já no plano — confirmar inclusão) |
| `src/engine/flow/CfgBuilder.ts` | Produção activa | Migrar → `flow/cfg_builder.rs` (Fase 1) |
| `src/engine/flow/FlowToAst.ts` | Produção activa (49KB) | Migrar → `flow/flow_to_ast.rs` (Fase 1) |
| `src/engine/flow/FlowValidator.ts` | Produção activa | Migrar → `flow/flow_validator.rs` (Fase 1) |
| `src/engine/CodeParser.ts` | Runtime de simulação | Migrar → `simulation_executor.rs` (Desktop); manter TS (WebApp) |
| `src/engine/asl/blocklyToASL.ts` | Cola Blockly (padrão idêntico ao flowToASL.ts mas para Blockly) | Eliminar (Fase 0) |
| `src/engine/Transpiler.ts` | Stub vazio (distinto do `transpile.ts` activo em `engine/asl/`) | Eliminar (Fase 0) |
| `src/engine/example.ts` | Demo QEMU | Eliminar (Fase 0) |
| `fixes.md` (35KB) | Debug temporário | Arquivar em `docs/legacy/` (Fase 0) |
| `poc/` | Prova de conceito | Arquivar em `docs/legacy/poc/` (Fase 0) |

---

## 2. Arquitectura da Plataforma

### 2.1 Diagrama de Camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│                       CAMADA DE APRESENTAÇÃO                         │
│           (UI idêntica — Svelte 5 + Tailwind CSS 4)                  │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────────────┐│
│  │   Desktop    │  │     WebApp      │  │         Mobile            ││
│  │  (Tauri 2)  │  │  (SvelteKit 2)  │  │  (Tauri 2 Android/iOS)   ││
│  └──────────────┘  └─────────────────┘  └───────────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│                       CAMADA DE LÓGICA                                │
│               (crates Rust — WASM para WebApp)                        │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│  │  neuroforge-asl  │  │ neuroforge-fw     │  │ neuroforge-      │  │
│  │  (IR universal)  │  │ (compiler+flash)  │  │ transport        │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│                       CAMADA DE TRANSPORTE                            │
│  Desktop: UART · USB · MODBUS RTU/TCP · Ethernet · SPI · I2C · CAN  │
│            RS485 · RS232 · LIN Bus · 1-Wire · IR · BLE (btleplug)   │
│  WebApp:  WebSerial · WebUSB · WebSocket bridge · REST cloud          │
│  Mobile:  Wi-Fi OTA · BLE · USB OTG (Android) · mDNS discovery       │
│           ZigBee · IR · BLE · 1-Wire                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura do Monorepo

```
neuroforge/
├── apps/
│   ├── desktop/                  # Tauri 2 — entry point desktop
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       ├── src/
│   │       │   ├── lib.rs
│   │       │   ├── transport/    # serial.rs, usb.rs, modbus.rs, ethernet.rs
│   │       │   ├── firmware/     # compiler.rs, flash_manager.rs, firmware_hub.rs
│   │       │   └── asl_bridge.rs # invoke bridge → crate neuroforge-asl
│   │       └── capabilities/
│   ├── webapp/                   # SvelteKit 2 — entry point web
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   └── lib/wasm/         # bindings WASM do crate neuroforge-asl
│   │   └── static/
│   ├── mobile/                   # Tauri 2 Mobile — entry point mobile
│   └── shared/                   # Código Svelte partilhado pelas 3 superfícies
│       └── src/
│           ├── components/
│           │   ├── simulation/   # Canvas de simulação (SvelteFlow)
│           │   │   ├── SimulationCanvas.svelte
│           │   │   ├── nodes/    # LEDNode, MCUNode, ServoNode, etc.
│           │   │   └── edges/    # ManhattanEdge.svelte
│           │   ├── flow-editor/  # NeuroForge Flow Editor (substituto Blockly)
│           │   │   ├── FlowEditor.svelte
│           │   │   └── nodes/
│           │   ├── ladder-editor/
│           │   │   ├── LadderEditor.svelte
│           │   │   └── elements/
│           │   ├── code-editor/
│           │   │   └── CodeEditor.svelte
│           │   ├── asl-viewer/
│           │   │   └── ASLViewer.svelte
│           │   ├── serial/
│           │   │   ├── SerialTerminalPanel.svelte
│           │   │   └── SerialMonitor.svelte
│           │   ├── firmware/
│           │   │   ├── FirmwarePanel.svelte
│           │   │   ├── FlashProgressPanel.svelte  # inclui UX de erros
│           │   │   └── BoardLibrary.svelte
│           │   └── ui/           # shadcn-svelte
│           ├── state/
│           │   ├── simulation.svelte.ts
│           │   ├── connection.svelte.ts
│           │   ├── serial.svelte.ts
│           │   ├── files.svelte.ts
│           │   ├── firmware.svelte.ts
│           │   └── ui.svelte.ts
│           └── engine/
│               └── SimulationEngine.ts
├── crates/
│   ├── neuroforge-asl/
│   ├── neuroforge-transport/
│   └── neuroforge-firmware/
├── firmware/
│   ├── templates/
│   └── boards/
├── docs/
├── tests/
│   ├── roundtrip/
│   ├── hardware-in-the-loop/    # Testes que requerem hardware físico
│   └── ci/                      # Testes executáveis em CI sem hardware
└── .github/
    └── workflows/
        ├── rust.yml              # cargo test + clippy + WASM build
        ├── svelte.yml            # pnpm test + lint
        └── integration.yml       # testes de integração com hardware mock
```

---

## 3. Configuração do Monorepo — Cargo + pnpm

Esta secção é **crítica** para a Fase 0. Um monorepo Tauri + SvelteKit + Mobile + crates Rust tem uma configuração não-trivial que deve estar correcta antes de qualquer código de produto.

### 3.1 `Cargo.toml` Raiz (Workspace)

```toml
# Cargo.toml — raiz do repositório
[workspace]
members = [
    "crates/neuroforge-asl",
    "crates/neuroforge-transport",
    "crates/neuroforge-firmware",
    "apps/desktop/src-tauri",
    "apps/mobile/src-tauri",
]
resolver = "2"

# Dependências partilhadas entre todos os membros (evita versões inconsistentes)
[workspace.dependencies]
serde        = { version = "1", features = ["derive"] }
serde_json   = "1"
tokio        = { version = "1", features = ["full"] }
thiserror    = "1"
anyhow       = "1"
tracing      = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[profile.release]
opt-level    = "z"   # Minimizar tamanho do binário (importante para WASM)
lto          = true
codegen-units = 1
strip        = true
wasm-opt     = false   # necessário para wasm32-wasip1 com bulk memory ops (LLVM 22+)

[profile.wasm-release]
inherits     = "release"
opt-level    = "s"   # Optimizar para tamanho (WASM)
```

### 3.2 `pnpm-workspace.yaml`

```yaml
# pnpm-workspace.yaml — raiz do repositório
packages:
  - "apps/desktop"
  - "apps/webapp"
  - "apps/mobile"
  - "apps/shared"
```

### 3.3 `apps/shared/package.json` (Dependências Partilhadas)

```json
{
  "name": "@neuroforge/shared",
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@xyflow/svelte": "^1.0.0",
    "@monaco-editor/loader": "^1.4.0",
    "bits-ui": "^1.0.0",
    "tailwind-variants": "^0.2.0"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "typescript": "^5.5.0",
    "@sveltejs/kit": "^2.0.0",
    "tailwindcss": "^4.0.0",
    "vitest": "^2.0.0"
  }
}
```

### 3.4 Verificação de Setup (Fase 0, primeiro commit)

```bash
# Verificar que o workspace Rust está correcto
cargo check --workspace

# Verificar que pnpm resolve correctamente
pnpm install --frozen-lockfile

# Build WASM (deve funcionar antes de qualquer código de produto)
cd crates/neuroforge-asl
wasm-pack build --target web --out-dir ../../apps/webapp/src/lib/wasm

# Verificar que o Tauri Desktop compila
cd apps/desktop
pnpm tauri build --debug
```

---

## 4. Schema de Ficheiros — `.nfv` e `.nfladder`

### 4.1 Schema `.nfv` (NeuroForge Visual — Flow Editor)

O formato `.nfv` é o formato de persistência dos programas criados no Flow Editor e no Canvas de Simulação. **Sem um schema versionado, a compatibilidade entre versões é impossível de garantir.**

```rust
// crates/neuroforge-asl/src/schema/nfv.rs

use semver::Version;
use serde::{Deserialize, Serialize};

/// Raiz do ficheiro .nfv
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvFile {
    /// Versão do schema .nfv (ex: "4.0.0")
    pub schema_version: String,
    /// Versão do motor ASL que gerou este ficheiro
    pub asl_version: String,
    /// Identificador único do projecto
    pub project_id: String,
    /// Placa alvo (ex: "arduino-uno", "esp32-devkit", "rp2040")
    pub target_board: String,
    /// Linguagem alvo (ex: "cpp", "micropython", "rust_embassy", "st")
    pub target_language: String,
    /// Nós do editor visual
    pub nodes: Vec<FlowNode>,
    /// Arestas do editor visual
    pub edges: Vec<FlowEdge>,
    /// Cache do AslProgram serializado (para preview instantâneo)
    pub asl_cache: Option<serde_json::Value>,
    /// Metadados do projecto
    pub metadata: NfvMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NfvMetadata {
    pub name: String,
    pub created_at: String,       // ISO 8601
    pub updated_at: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub neuroforge_version: String, // Versão da app que criou o ficheiro
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    pub r#type: String,           // "digitalWrite", "if", "timerTON", etc.
    pub position: Position,
    pub data: serde_json::Value,  // dados específicos do nó
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position { pub x: f64, pub y: f64 }
```

### 4.2 Estratégia de Migração de Schema

Quando o schema `.nfv` evolui entre versões, os ficheiros antigos são **migrados automaticamente** em tempo de carregamento:

```rust
// crates/neuroforge-asl/src/schema/migration.rs

pub fn migrate_nfv(raw: &str) -> Result<NfvFile, MigrationError> {
    // 1. Lê apenas o campo schema_version sem desserializar o resto
    let version_probe: serde_json::Value = serde_json::from_str(raw)?;
    let schema_version = version_probe["schema_version"]
        .as_str()
        .unwrap_or("1.0.0");

    match schema_version {
        v if v.starts_with("4.") => {
            // Versão actual — desserializar directamente
            Ok(serde_json::from_str(raw)?)
        }
        v if v.starts_with("3.") => {
            // v3 → v4: adicionar campo project_id se ausente
            let mut val: serde_json::Value = serde_json::from_str(raw)?;
            if val["project_id"].is_null() {
                val["project_id"] = serde_json::Value::String(
                    uuid::Uuid::new_v4().to_string()
                );
            }
            val["schema_version"] = "4.0.0".into();
            Ok(serde_json::from_value(val)?)
        }
        v if v.starts_with("2.") => {
            // v2 → v4: migração de dois passos (v2→v3→v4)
            let v3 = migrate_v2_to_v3(raw)?;
            migrate_nfv(&serde_json::to_string(&v3)?)
        }
        _ => Err(MigrationError::UnknownVersion(schema_version.to_string()))
    }
}
```

**Regras de versionamento semântico do schema:**
- `MAJOR` bump: quebra compatibilidade (nós renomeados, campos obrigatórios novos)
- `MINOR` bump: novos campos opcionais (retrocompatível)
- `PATCH` bump: correcções de metadados sem alteração estrutural

### 4.3 Versionamento Semântico do ASL

À medida que novos tipos ASL são adicionados (`AslCounterCTD`, `AslSFC`, `AslFbd`), os ficheiros `.nfv` e projectos guardados podem tornar-se incompatíveis. O campo `asl_version` no `NfvFile` e no `AslProgram` gere isto:

```rust
// crates/neuroforge-asl/src/types/asl_types.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AslProgram {
    /// Versão do schema ASL — semver (ex: "4.0.0")
    /// Bump MAJOR quando: tipos existentes mudam de estrutura
    /// Bump MINOR quando: novos tipos adicionados (retrocompatível)
    /// Bump PATCH quando: correcções sem impacto na serialização
    pub asl_version: String,
    pub tasks: Vec<AslTask>,
    pub globals: Vec<AslVar>,
    pub functions: Vec<AslFunction>,
    pub imports: Vec<AslImport>,
}
```

**Inventário de versões planeadas:**

| Versão ASL | Novos Tipos | Fase |
|---|---|---|
| 4.0.0 | Versão base (tipos actuais migrados) | ✅ Fase 1 |
| 4.3.0 | ST + IL + LD + FBD + SFC + PLCopen XML + todos os tipos PLC IEC 61131-3 | ✅ Fase 1 |
| 4.4.0 | RS485, CAN Bus, 1-Wire, LIN Bus, IR, Ethernet TCP/UDP (smoltcp) | Planeada: Fase 3 |
| 4.5.0 | USB Device (HID/CDC), I2S (Áudio), BLE | Planeada: Fase 4 |
| 4.6.0 | ZigBee, NTSC/PAL | Planeada: Fase 5/6 |

---

## 5. Motor ASL — Migração TypeScript → Rust

### 5.1 Princípio de Migração com Paridade Zero-Regressão

A migração do ASL de TypeScript para Rust é a tarefa mais crítica. A estratégia é:

1. Manter o ASL TypeScript funcional durante toda a migração
2. Cada ficheiro TypeScript migrado para Rust é validado com testes de roundtrip
3. Só após 100% dos testes passarem em Rust é que o ficheiro TypeScript é removido
4. O crate Rust compila também para WASM, permitindo que o WebApp use exactamente o mesmo código

**Regra de ouro preservada:** "Todas as linguagens devem andar de mãos dadas" — qualquer nova feature de hardware adicionada a uma linguagem deve ter paridade semântica em todas as outras.

### 5.2 Estrutura do Crate `neuroforge-asl`

```
crates/neuroforge-asl/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── transpile.rs             # Entry point de transpilação (← transpile.ts)
│   │                             # pub fn transpile_code(), pub fn transpile_ast()
│   ├── schema/
│   │   ├── nfv.rs               # Schema .nfv (secção 4.1)
│   │   └── migration.rs         # Migração automática de schema (secção 4.2)
│   ├── types/
│   │   ├── mod.rs
│   │   ├── asl_types.rs          # Espelho de ASLTypes.ts (todos os tipos actuais)
│   │   ├── asl_plc_types.rs      # Tipos IEC 61131-3
│   │   └── asl_transport_types.rs   # Expansão planeada: RS485, CAN, 1-Wire, LIN, IR, Ethernet, BLE, USB, I2S
│   ├── executor/
│   │   └── asl_executor.rs       # Iterador assíncrono com virtual time (← ASLExecutor.ts)
│   ├── parser/
│   │   ├── tree_sitter_loader.rs # Init tree-sitter WASM (← TreeSitterLoader.ts)
│   │   └── language_registry.rs  # Registry de linguagens + metadata (← LanguageRegistry.ts)
│   ├── helpers/
│   │   ├── mod.rs
│   │   ├── type_utils.rs         # C++/Python/Rust → ASLType (← helpers/typeUtils.ts)
│   │   └── array_utils.rs        # Utilitários de arrays para transforms (← helpers/arrayUtils.ts)
│   ├── flow/
│   │   ├── mod.rs
│   │   ├── flow_to_asl.rs        # Entry point público: FlowValidator+CfgBuilder+FlowToAst+astToASL (← flowToASL.ts)
│   │   ├── cfg_builder.rs        # CFG a partir de nós/arestas FlowEditor (← CfgBuilder.ts)
│   │   ├── flow_to_ast.rs        # CFG → ProgramNode; estruturada + máquina de estados; Ladder (← FlowToAst.ts, 49KB)
│   │   └── flow_validator.rs     # Valida grafo (Start/End, IDs únicos) (← FlowValidator.ts)
│   ├── transforms/
│   │   ├── mod.rs                # Re-exporta todos os transforms (← transforms/index.ts)
│   │   ├── context.rs            # TransformContext — MIGRAR PRIMEIRO (← context.ts)
│   │   │                         # globalsMap, language, structDefs, servoInstances, rgbPins, pwmPins
│   │   ├── ast_normalizer.rs     # Source → ProgramNode normalizado (← astNormalizer.ts)
│   │   ├── code_to_asl.rs        # ProgramNode → AslProgram (← codeToASL.ts:astToASL)
│   │   ├── expr_transform.rs     # (← exprTransform.ts)
│   │   ├── block_transform.rs    # (← blockTransform.ts)
│   │   ├── call_transform.rs     # (← callTransform.ts)
│   │   ├── statement_registry.rs # 39KB — maior ficheiro de transforms (← statementRegistry.ts)
│   │   └── postfix_utils.rs      # Extrai side-effects i++/i-- (← postfixUtils.ts)
│   ├── plugins/
│   │   ├── core/
│   │   │   └── shim_manager.rs   # Gestor de shims partilhado por todos os plugins (← ShimManager.ts)
│   │   ├── c/
│   │   │   ├── c_parser.rs       # (← CParser.ts)
│   │   │   ├── c_generator.rs    # (← CGenerator.ts)
│   │   │   └── shims/
│   │   ├── python/
│   │   │   ├── python_parser.rs  # (← PythonParser.ts)
│   │   │   ├── python_generator.rs # (← PythonGenerator.ts)
│   │   │   └── shims/
│   │   ├── rust_std/
│   │   │   ├── rust_parser.rs    # 40KB (← RustParser.ts)
│   │   │   ├── rust_generator.rs # 20KB (← RustGenerator.ts)
│   │   │   └── shims/
│   │   ├── rust_embassy/
│   │   │   ├── embassy_parser.rs
│   │   │   ├── embassy_generator.rs
│   │   │   ├── embassy_targets.rs
│   │   │   └── shims/
│   │   └── plc/
│   │       ├── mod.rs
│   │       ├── plc_plugin.rs         # PlcPlugin — regista todos os sub-parsers/generators
│   │       ├── plcopen_xml.rs        # Import/export PLCopen XML (quick-xml + plcopen crate)
│   │       ├── st_parser.rs          # ST — actualizado (commit cf6c54e)
│   │       ├── st_generator.rs
│   │       ├── il/
│   │       │   ├── mod.rs
│   │       │   ├── grammar.pest      # Grammar PEG para IL
│   │       │   ├── parser.rs
│   │       │   └── generator.rs
│   │       ├── ld/
│   │       │   ├── mod.rs
│   │       │   ├── parser.rs
│   │       │   └── generator.rs
│   │       ├── fbd/
│   │       │   ├── mod.rs
│   │       │   ├── parser.rs
│   │       │   └── generator.rs
│   │       └── sfc/
│   │           ├── mod.rs
│   │           ├── parser.rs
│   │           └── generator.rs
│   ├── optimizer/
│   │   └── optimizer.rs         # Elimina dead code, funde delays (← Optimizer.ts)
│   └── analysis/
│       └── pattern_detector.rs  # Detecta padrões: PWM bit-bang, polling loop, state machine (← PatternDetector.ts)
└── wasm/
    ├── mod.rs           # pub mod bindings (criado Fase 1D)
    └── bindings.rs      # #[wasm_bindgen] — só compila em target_arch=wasm32
```

### 5.3 Tipos ASL PLC (IEC 61131-3)

```rust
// asl_plc_types.rs

pub struct AslPlcProgram {
    pub name: String,
    pub variables: Vec<AslPlcVar>,
    pub networks: Vec<AslNetwork>,
    pub functions: Vec<AslFunction>,
}

pub struct AslRung {
    pub number: u32,
    pub comment: Option<String>,
    pub elements: Vec<AslLadderElement>,
}

pub enum AslLadderElement {
    Contact(AslContact),
    NegContact(AslContact),
    Coil(AslCoil),
    NegCoil(AslCoil),
    SetCoil(AslCoil),
    ResetCoil(AslCoil),
    TimerTon(AslTimerTON),
    TimerTof(AslTimerTOF),
    TimerTp(AslTimerTP),
    CounterCtu(AslCounterCTU),
    CounterCtd(AslCounterCTD),
    LatchSr(AslLatchSR),
    LatchRs(AslLatchRS),
    FunctionBlock(AslFbCall),
    BranchStart,
    BranchEnd,
}

pub struct AslContact { pub variable: String, pub comment: Option<String> }
pub struct AslCoil    { pub variable: String, pub comment: Option<String> }

pub struct AslTimerTON { pub tag: String, pub preset: AslExpr, pub output: String }
pub struct AslTimerTOF { pub tag: String, pub preset: AslExpr, pub output: String }
pub struct AslCounterCTU { pub tag: String, pub preset: AslExpr, pub value: String }
pub struct AslLatchSR { pub tag: String, pub set: AslExpr, pub reset: AslExpr, pub output: String }
```

### 5.4 Linguagens Alvo — Roadmap de Suporte

#### Linguagens para MCUs

| Linguagem | Estado Actual | Estado Alvo | Notas |
|---|---|---|---|
| C/C++ Arduino | ✅ Parser + Generator | ✅ Migrar para Rust | Shims: servo, LCD, keypad, EEPROM |
| MicroPython | ✅ Parser + Generator | ✅ Migrar para Rust | Shims: machine.Pin, time.sleep_ms |
| Rust `no_std` / embedded-hal | ✅ Parser + Generator | ✅ Migrar para Rust | Gerador: embedded-hal traits |
| **Rust Embassy** | ❌ Não existe | 🆕 Fase 3 | async/await nativo; RP2040/STM32/nRF/ESP32 |
| CircuitPython | ❌ Não existe | Fase 4 | Adafruit boards |
| Arduino Wiring (AVR puro) | ❌ Não existe | Fase 4 | Acesso directo a registos |

#### Linguagens para PLCs (IEC 61131-3)

| Linguagem | Estado Actual | Estado Alvo | Notas |
|---|---|---|---|
| **Structured Text (ST)** | ✅ Implementado (Fase 1) | ✅ Migrado para Rust | iec61131 crate; st_parser.rs expandido (commit cf6c54e) |
| **Ladder Diagram (LD)** | ✅ Implementado (Fase 1) | ✅ Migrado para Rust | ld/parser.rs + ld/generator.rs; PLCopen XML via plcopen crate |
| **Function Block Diagram (FBD)** | ✅ Implementado (Fase 1) | ✅ Migrado para Rust | fbd/parser.rs + fbd/generator.rs |
| **Instruction List (IL)** | ✅ Implementado (Fase 1) | ✅ Migrado para Rust | grammar.pest + il/parser.rs + il/generator.rs |
| **Sequential Function Chart (SFC)** | ✅ Implementado (Fase 1) | ✅ Migrado para Rust | sfc/parser.rs + sfc/generator.rs; ASL versão 4.3.0 |

---

### 5.5 Ambiente de Build WASM (Windows)

O build das grammars tree-sitter para `wasm32-unknown-unknown` requer um compilador C
compatível com WASM. No Windows, o toolchain MSVC não é compatível — é obrigatório o
**wasi-sdk**.

**Setup validado em produção (Fase 1D):**

| Variável | Valor |
|---|---|
| `CC_wasm32_unknown_unknown` | `C:\wasi-sdk\bin\clang.exe` |
| `CFLAGS_wasm32_unknown_unknown` | `--target=wasm32-wasip1 --sysroot=C:\wasi-sdk\share\wasi-sysroot` |

**Instalação:**
```powershell
# 1. Descarregar wasi-sdk v25 de https://github.com/WebAssembly/wasi-sdk/releases
#    → wasi-sdk-25.0.x86_64-windows.tar.gz → extrair para C:\wasi-sdk

# 2. Definir variáveis de ambiente (permanente via System Properties ou .cargo/config.toml)
[env]
CC_wasm32_unknown_unknown  = "C:\\wasi-sdk\\bin\\clang.exe"
CFLAGS_wasm32_unknown_unknown = "--target=wasm32-wasip1 --sysroot=C:\\wasi-sdk\\share\\wasi-sysroot"

# 3. Adicionar ao [package.metadata.wasm-pack.profile.release] do Cargo.toml do crate:
wasm-opt = false
```

> **Nota:** `wasm-opt = false` é necessário porque o `wasm-opt` do wasm-pack não suporta
> certas instruções `bulk-memory` geradas pelo LLVM 22+ usado pelo wasi-sdk v25.

### 5.6 Protocolos de Transporte

Esta secção documenta todos os protocolos suportados pelo NeuroForge, organizados por camada física e estratégia de implementação.

#### 5.6.1 Protocolos Físicos ( Novos Tipos ASL)

Estes protocolos requerem **novos tipos `AslXxx`** no crate `neuroforge-asl`. A implementação segue os traits `embedded-hal` v1.0 para MCUs e bibliotecas nativas para Desktop.

**Nota:** JTAG **não** precisa de tipos ASL — está coberto pelo `probe-rs = "0.24"` no `neuroforge-firmware` como ferramenta de flash/debug, não como protocolo de aplicação para o utilizador final.

##### RS485 / RS232

Ambos são UART com camada física diferente — RS232 usa ±12 V, RS485 usa par diferencial A/B com 120 Ω de terminação. A `serialport` crate (já no `neuroforge-transport`) cobre ambos via configuração de flow control e linha DE/RE.

```rust
// asl_transport_types.rs
pub struct AslRs485Begin { pub port: String, pub baud: u32, pub de_re_pin: Option<u8> }
pub struct AslRs485Write { pub data: AslExpr }
pub struct AslRs485Read  { pub timeout_ms: u32, pub result: String }
// RS232 partilha os tipos UART existentes — diferencia apenas o physical layer no gerador
```

##### CAN Bus (base para DeviceNet e NMEA2000)

CAN usa par diferencial CANH/CANL. DeviceNet e NMEA 2000 correm sobre CAN com perfis de aplicação diferentes. O `embedded-hal` tem o crate separado `embedded-can` para traits CAN.

```rust
pub struct AslCanBegin    { pub baud: u32, pub mode: CanMode }  // CanMode: Normal | Loopback | Silent
pub struct AslCanSend     { pub id: AslExpr, pub data: AslExpr, pub is_extended: bool }
pub struct AslCanReceive  { pub filter_id: Option<u32>, pub filter_mask: Option<u32>,
                              pub result: String, pub timeout_ms: u32 }
// DeviceNet e NMEA2000: encapsulados sobre AslCanSend/Receive com shims de camada de aplicação
pub enum CanMode { Normal, Loopback, Silent }
```

##### 1-Wire

Protocolo single-wire com pull-up, identifica dispositivos por ID de 64 bits (ex: DS18B20). Existe o crate `embedded-onewire` com traits `no_std` e async.

```rust
pub struct AslOneWireBegin  { pub pin: u8 }
pub struct AslOneWireSearch { pub result: String }  // retorna lista de IDs 64-bit
pub struct AslOneWireRead   { pub device_id: AslExpr, pub bytes: u8, pub result: String }
pub struct AslOneWireWrite  { pub device_id: AslExpr, pub command: AslExpr }
```

##### LIN Bus

Protocolo single-wire master/slave, típico em automóvel a 12 V/24 V.

```rust
pub struct AslLinBegin  { pub baud: u32 }  // tipicamente 9600–20000
pub struct AslLinSend   { pub frame_id: u8, pub data: AslExpr }
pub struct AslLinRead   { pub frame_id: u8, pub result: String }
```

##### I2S (Áudio)

Protocolo síncrono serial para áudio — SCK (bit clock), WS (word select), SD (dados). Relevante para ESP32 e RP2040.

```rust
pub struct AslI2sBegin  { pub sample_rate: u32, pub bits_per_sample: u8, pub channel: I2sChannel }
pub struct AslI2sWrite  { pub buffer: AslExpr }
pub struct AslI2sRead   { pub num_samples: u16, pub result: String }
pub enum I2sChannel { Stereo, LeftOnly, RightOnly }
```

##### USB Device (controlo a nível de firmware)

Diferente de "USB como transporte de flash" — aqui refere-se a implementar um dispositivo USB (HID, CDC, bulk) no MCU. O `usb-device` crate é o padrão `no_std`.

```rust
pub struct AslUsbBegin  { pub class: UsbDeviceClass }  // HID | CDC | Vendor
pub struct AslUsbWrite  { pub endpoint: u8, pub data: AslExpr }
pub struct AslUsbRead   { pub endpoint: u8, pub result: String }
pub enum UsbDeviceClass { HID, CDC, Vendor(u8) }
```

##### IR (InfraRed)

```rust
pub struct AslIrSend  { pub pin: u8, pub protocol: IrProtocol, pub code: AslExpr }
// IrProtocol: NEC | RC5 | RC6 | Sony | Samsung | Raw
pub struct AslIrRead  { pub pin: u8, pub result: String }
pub enum IrProtocol { Nec, Rc5, Rc6, Sony, Samsung, Raw }
```

##### Ethernet (TCP/UDP a nível MCU — smoltcp)

```rust
pub struct AslEthernetBegin  { pub mac: [u8; 6], pub ip: Option<String> }
pub struct AslTcpConnect     { pub host: AslExpr, pub port: u16, pub result: String }
pub struct AslTcpWrite       { pub conn: AslExpr, pub data: AslExpr }
pub struct AslTcpRead        { pub conn: AslExpr, pub result: String }
pub struct AslUdpSend        { pub host: AslExpr, pub port: u16, pub data: AslExpr }
pub struct AslUdpReceive     { pub port: u16, pub result: String }
```

##### Bluetooth LE

```rust
pub struct AslBleBegin     { pub device_name: String }
pub struct AslBleScan      { pub duration_ms: u32, pub result: String }
pub struct AslBleConnect   { pub address: AslExpr }
pub struct AslBleWrite     { pub char_uuid: String, pub data: AslExpr }
pub struct AslBleRead      { pub char_uuid: String, pub result: String }
```

#### 5.6.2 Protocolos via Shims (Sem Novos Tipos ASL)

Estes protocolos correm sobre os físicos já existentes ou em implementação. São tratados como **shims de geração de código** no `ShimManager`, não como novos tipos ASL base.

| Protocolo | Corre sobre | Estratégia Rust | Crate |
|---|---|---|---|
| **Modbus RTU** | RS485 | `tokio-modbus` (já no plano) | `tokio-modbus = "0.5"` |
| **Modbus ASCII** | UART | `tokio-modbus` | já incluído |
| **Modbus TCP** | Ethernet | `tokio-modbus` | já incluído |
| **DMX512** | RS485 | Shim sobre `AslRs485Write` | `dmx` crate ou impl manual |
| **MIDI** | UART a 31.25 kbps | Shim sobre `AslUartWrite/Read` | `midi-types` crate |
| **Firmata** | Serial (UART) | Shim sobre `serialBegin`/`uartWrite` | `firmata` crate |
| **rosserial** | Serial (UART) | Shim sobre `serialBegin`/`uartWrite` | impl manual |
| **S.N.A.P / YASP / LOP / ICSC** | Serial (UART) | Shims sobre UART existente | impl manual |
| **netstring / JSON-over-serial** | Serial (UART) | Shim + `serde_json` | `serde_json` (já no workspace) |
| **IP over Serial (SLIP/PPP)** | Serial (UART) | Shim | `smoltcp` crate |
| **DeviceNet** | CAN | Shim sobre `AslCanSend/Receive` | impl manual |
| **NMEA 2000** | CAN | Shim sobre `AslCanSend/Receive` | `nmea` crate |
| **IEEE 1451 (TEDS)** | I2C/SPI | Shim que gera código de inicialização de TEDS sobre `AslI2cWrite/Read` | impl manual |

#### 5.6.3 Prioridades por Fase

| Fase | Protocolos a Adicionar | ASL Version |
|---|---|---|
| **Fase 3** | RS485, CAN Bus, 1-Wire, LIN, IR, Ethernet TCP/UDP | `4.4.0` |
| **Fase 3** | Shims: Modbus RTU/TCP (já parcial), DMX512, MIDI, Firmata | shims, sem bump |
| **Fase 4** | USB Device (HID/CDC), I2S, BLE | `4.5.0` |
| **Fase 5** | ZigBee, NTSC/PAL | `4.6.0` |
| **Fora de scope ASL** | JTAG (→ `probe-rs` firmware), Myrinet, InfiniBand, AoE | — |

## 6. Saída do React/JavaScript — Plano Detalhado

### 6.1 Mapeamento React → Svelte 5 Completo

**Princípio:** Nunca remover React antes de ter o equivalente Svelte a 100% funcional e testado. A coexistência é temporária mas necessária.

**Fase de coexistência** (Fase 2): Vite suporta React + Svelte em paralelo. Os componentes são migrados um por um. O critério de "pronto para remover React" é: todos os 26 componentes e as 7 stores migradas, com testes de integração a passar.

#### Mapeamento de Componentes

| Componente React (preRust) | Svelte 5 | Dependência Crítica | Fase |
|---|---|---|---|
| `Terminal.tsx` (4 KB) | `Terminal.svelte` | Nenhuma | 2A |
| `SimulationModeToggle.tsx` (3 KB) | `SimulationModeToggle.svelte` | Nenhuma | 2A |
| `PropertiesPanel.tsx` (2 KB) | `PropertiesPanel.svelte` | Nenhuma | 2A |
| `SerialMonitor.tsx` (6 KB) | `SerialMonitor.svelte` | serialStore | 2A |
| `SerialTerminalPanel.tsx` (8 KB) | `SerialTerminalPanel.svelte` | Tauri serial event | 2A |
| `TopToolbar.tsx` (6 KB) | `TopToolbar.svelte` | uiStore | 2B |
| `LeftSidebar.tsx` (5 KB) | `LeftSidebar.svelte` | fileStore | 2B |
| `ComponentsLibrary.tsx` (5 KB) | `ComponentsLibrary.svelte` | libraryStore | 2B |
| `FloatingWindow.tsx` (12 KB) | `FloatingWindow.svelte` | uiStore — base de todos os painéis | 2B |
| `LEDPropertiesPanel.tsx` (26 KB) | `LEDPropertiesPanel.svelte` | simulationStore | 2C |
| `MCUPropertiesPanel.tsx` (13 KB) | `MCUPropertiesPanel.svelte` | simulationStore | 2C |
| `ButtonPropertiesPanel.tsx` (12 KB) | `ButtonPropertiesPanel.svelte` | simulationStore | 2C |
| `ServoPropertiesPanel.tsx` (11 KB) | `ServoPropertiesPanel.svelte` | simulationStore | 2C |
| `RGBLEDPropertiesPanel.tsx` (11 KB) | `RGBLEDPropertiesPanel.svelte` | simulationStore | 2C |
| `PotentiometerPropertiesPanel.tsx` (9 KB) | `PotentiometerPropertiesPanel.svelte` | simulationStore | 2C |
| `LibrariesPanel.tsx` (12 KB) | `LibrariesPanel.svelte` | libraryStore | 2C |
| `ASLViewer.tsx` (5 KB) | `ASLViewer.svelte` | neuroforge-asl WASM | 2D |
| `CodeEditor.tsx` (9 KB) | `CodeEditor.svelte` | Monaco standalone | 2D |
| `CodeEditorWithTabs.tsx` (21 KB) | `CodeEditorWithTabs.svelte` | Monaco standalone | 2D |
| `CanvasArea.tsx` (13 KB) | `CanvasArea.svelte` | SimulationCanvas | 2E |
| **Nós de simulação** (6 nós) | **nós SvelteFlow** | @xyflow/svelte 1.x | 2E |
| **ManhattanEdge.tsx** | `ManhattanEdge.svelte` | @xyflow/svelte 1.x | 2E |
| `FlowEditor.tsx` (41 KB) → **SimulationCanvas** | `SimulationCanvas.svelte` | @xyflow/svelte 1.x | 2E |
| `BlocklyEditor.tsx` | **ELIMINADO** | Substituído por FlowEditor Svelte | 2A |

#### Mapeamento de Stores Zustand → Svelte 5 Runes

| Store Zustand (preRust) | Svelte 5 Runes | Fase | Notas |
|---|---|---|---|
| `useSerialStore.ts` (2.8 KB) | `serial.svelte.ts` | 2A | Primeiro a migrar |
| `useLibraryStore.ts` (3.7 KB) | `library.svelte.ts` | 2A | Independente |
| `useConnectionStore.ts` (4 KB) | `connection.svelte.ts` | 2A | Independente |
| `useFileStore.ts` (5 KB) | `files.svelte.ts` | 2B | Independente |
| `useUIStore.ts` (9.3 KB) | `ui.svelte.ts` | 2B | Após componentes de layout |
| `useSimulationStore.ts` (12.6 KB) | `simulation.svelte.ts` | 2E | **Spike dedicado antes** |
| `useQEMUStore.ts` (2 KB) | **ELIMINADO** | 2A | QEMU eliminado |

**Exemplo de migração de store:**

```typescript
// ANTES: useSerialStore.ts (Zustand)
export const useSerialStore = create<SerialState>((set) => ({
  ports: [],
  connectedPort: null,
  buffer: [],
  baudRate: 115200,
  setPorts: (ports) => set({ ports }),
  appendBuffer: (data) => set((s) => ({ buffer: [...s.buffer, data] })),
}));

// DEPOIS: serial.svelte.ts (Svelte 5 Runes)
class SerialState {
  ports = $state<PortInfo[]>([]);
  connectedPort = $state<string | null>(null);
  buffer = $state<string[]>([]);
  baudRate = $state(115200);
  isConnected = $derived(this.connectedPort !== null);

  appendBuffer(data: string) { this.buffer = [...this.buffer, data]; }
}
export const serial = new SerialState();
```

#### Mapeamento @xyflow/react → @xyflow/svelte

`@xyflow/svelte` 1.x (lançado em Maio 2025) suporta Svelte 5 Runes nativamente. A API é idêntica à versão React:

```svelte
<!-- LEDNode.svelte (@xyflow/svelte) -->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';
  import { simulation } from '@/state/simulation.svelte.ts';

  let { id, data }: NodeProps = $props();

  // simulationEngine.on('pinChange', ...) → substituído por $derived
  let isOn = $derived(simulation.getPinState(data.connectedPin as number) === 'HIGH');
  let brightness = $derived(simulation.getPinAnalog(data.connectedPin as number));
</script>

<Handle type="target" position={Position.Top} id="anode" />
<!-- SVG do LED com cor reactiva -->
<Handle type="source" position={Position.Bottom} id="cathode" />
```

#### Mapeamento de Dependências React → Svelte

| Dependência React (preRust) | Equivalente Svelte 5 | Notas |
|---|---|---|
| `@xyflow/react` | `@xyflow/svelte` 1.x | Migração directa, API idêntica |
| `zustand` | Svelte 5 Runes (`$state`, `$derived`) | Nativo, sem biblioteca |
| `@radix-ui/*` (26 pacotes) | `shadcn-svelte` (bits-ui) | `npx shadcn-svelte@latest init` |
| `@monaco-editor/react` | `@monaco-editor/loader` standalone | Framework-agnostic |
| `framer-motion` | `svelte/transition` + `svelte/animate` | Nativo Svelte |
| `react-hook-form` | `superforms` + `zod` | |
| `recharts` | `layerchart` | |
| `embla-carousel-react` | `embla-carousel` (standalone) | |
| `cmdk` | `cmdk-sv` | |
| `next-themes` | `svelte-persisted-store` | |
| `vaul` | `vaul-svelte` | |
| `socket.io-client` | **ELIMINADO** | Substituído por invoke/listen Tauri |
| `web-tree-sitter` | **ELIMINADO** | Substituído por WASM do crate Rust |
| `react`, `react-dom` | **ELIMINADO** (após Fase 2F) | |
| `@vitejs/plugin-react` | **ELIMINADO** | |
| `blockly` | **ELIMINADO** | |

#### Sequência de Remoção do React

```
Fase 2A: Remover useQEMUStore, BlocklyEditor, socket.io-client
Fase 2B: Remover componentes de layout migrados
Fase 2C: Remover painéis de propriedades migrados
Fase 2D: Remover Monaco wrapper React, ASLViewer React
Fase 2E: Remover @xyflow/react + todos os nós React + FlowEditor.tsx
Fase 2F: Remover zustand, react, react-dom, @vitejs/plugin-react
         → Resultado: Zero dependências React em runtime
```

### 6.2 Monaco Editor — Integração Svelte 5

```svelte
<!-- CodeEditor.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import loader from '@monaco-editor/loader';

  let { language = 'cpp', value = $bindable(''), theme = 'vs-dark' } = $props();
  let container: HTMLDivElement;
  let editor: any;

  onMount(async () => {
    const monaco = await loader.init();
    monaco.languages.register({ id: 'arduino-cpp' });
    monaco.languages.setMonarchTokensProvider('arduino-cpp', arduinoTokenizer);

    editor = monaco.editor.create(container, {
      value,
      language,
      theme,
      minimap: { enabled: false },
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
    });

    editor.onDidChangeModelContent(() => { value = editor.getValue(); });
  });

  onDestroy(() => editor?.dispose());
</script>

<div bind:this={container} class="w-full h-full" />
```

### 6.3 SimulationEngine — Transição TypeScript → Rust

```
WebApp:   SimulationEngine.ts (TS) → eventos JS → LEDNode.svelte
Desktop:  simulation_engine.rs (Rust) → Tauri events → LEDNode.svelte
```

A interface Svelte é a mesma — apenas a fonte dos eventos muda.

---

## 7. NeuroForge Flow Editor — Substituto do Blockly (Detalhado)

Este é o editor visual **de programação** (não o canvas de simulação). Construído com **@xyflow/svelte** e nós customizados Svelte, permite criar programas ASL arrastando e ligando nós sem escrever código.

### 7.1 Conceito e Diferença do Canvas de Simulação

| Canvas de Simulação (`SimulationCanvas`) | Flow Editor (`FlowEditor`) |
|---|---|
| Representa o **circuito físico** (LEDs, MCU, botões) | Representa o **programa lógico** (if, while, digitalWrite) |
| Nós = componentes electrónicos | Nós = operações ASL |
| Arestas = fios eléctricos | Arestas = fluxo de execução e dados |
| Resultado: visualização da simulação | Resultado: `AslProgram` para compilação/flash |
| Usa pinos como handles | Usa entradas/saídas de dados como handles |

### 7.2 Tipos de Nós do Flow Editor

#### Nós de Controlo de Fluxo

| Nó Svelte | ASL Node | Handles | Visual |
|---|---|---|---|
| `StartNode.svelte` | `AslTask { name: "main" }` | exec_out | Oval verde "START" |
| `EndNode.svelte` | — | exec_in | Oval vermelho "END" |
| `LoopNode.svelte` | `AslWhile { condition: true }` | exec_in, exec_out, body_out | Caixa laranja "LOOP" |
| `IfNode.svelte` | `AslIf` | exec_in, condition, then_out, else_out | Diamante azul "IF" |
| `WhileNode.svelte` | `AslWhile` | exec_in, condition, body_out, exit_out | Caixa "WHILE" |
| `ForNode.svelte` | `AslFor` | exec_in, init, condition, update, body_out | Caixa "FOR" |
| `DelayNode.svelte` | `AslDelay` | exec_in, exec_out, ms_in | Caixa com relógio |
| `FunctionNode.svelte` | `AslFunction` | exec_in, params, return_out | Caixa com fn() |

#### Nós de Hardware (MCU)

| Nó Svelte | ASL Node | Handles | Visual |
|---|---|---|---|
| `DigitalWriteNode.svelte` | `AslDigitalWrite` | exec_in, exec_out, pin_in, value_in | LED mini |
| `DigitalReadNode.svelte` | `AslRead { mode: DIGITAL }` | exec_in, exec_out, pin_in, result_out | Pin icon |
| `AnalogWriteNode.svelte` | `AslAnalogWrite` | exec_in, exec_out, pin_in, value_in | PWM icon |
| `AnalogReadNode.svelte` | `AslRead { mode: ANALOG }` | exec_in, exec_out, pin_in, result_out | ADC icon |
| `PinModeNode.svelte` | `AslPinMode` | exec_in, exec_out, pin_in, mode_in | Config icon |
| `SerialPrintNode.svelte` | `AslPrint` | exec_in, exec_out, value_in | Terminal icon |
| `SerialBeginNode.svelte` | `AslSerialBegin` | exec_in, exec_out, baud_in | UART icon |
| `ServoWriteNode.svelte` | `AslServoWrite` | exec_in, exec_out, pin_in, angle_in | Servo icon |
| `RGBSetNode.svelte` | `AslRGBSet` | exec_in, exec_out, r_in, g_in, b_in | RGB icon |

#### Nós de Variáveis e Expressões

| Nó Svelte | ASL Node | Handles | Visual |
|---|---|---|---|
| `ConstantNode.svelte` | `AslExpr::Literal` | value_out | Badge com valor |
| `VariableNode.svelte` | `AslExpr::Var` | value_out, value_in (assign) | Badge com nome |
| `MathNode.svelte` | `AslExpr::BinOp` | left_in, right_in, result_out | +/-/×/÷ |
| `CompareNode.svelte` | `AslExpr::Compare` | left_in, right_in, result_out | >/</== |
| `LogicNode.svelte` | `AslExpr::BoolOp` | a_in, b_in, result_out | AND/OR/NOT |

#### Nós PLC (IEC 61131-3)

| Nó Svelte | ASL Node | Handles |
|---|---|---|
| `TimerTONNode.svelte` | `AslTimerTON` | exec_in, in_bit, preset, q_out, et_out |
| `TimerTOFNode.svelte` | `AslTimerTOF` | exec_in, in_bit, preset, q_out, et_out |
| `CounterCTUNode.svelte` | `AslCounterCTU` | cu, r, pv, q_out, cv_out |
| `LatchSRNode.svelte` | `AslLatchSR` | s_in, r_in, q_out |
| `ModbusReadNode.svelte` | `AslUartRead` (MODBUS) | exec_in, exec_out, addr_in, reg_in, value_out |
| `ModbusWriteNode.svelte` | `AslUartWrite` (MODBUS) | exec_in, exec_out, addr_in, reg_in, value_in |

### 7.3 Pipeline Flow Editor → Firmware (completa)

```
FlowEditor.svelte (SvelteFlow / @xyflow/svelte)
    ↓ nós + arestas
flow_to_asl(nodes, edges) [flow/flow_to_asl.rs — entry point público, ex-flowToASL.ts]
    │
    ├→ flow_validator::validate()     [flow/flow_validator.rs]
    │   ↓ valida: Start/End presentes, IDs únicos em blocos com estado
    ├→ CfgBuilder::build()            [flow/cfg_builder.rs]
    │   ↓ Control Flow Graph (ciclos, nós mortos)
    │   ↓ Padrões: WHILE_LOOP / FOR_LOOP / INFINITE_LOOP
    ├→ FlowToAst::generate()          [flow/flow_to_ast.rs, 49KB]
    │   ↓ CFG → ProgramNode
    │   ↓ Estratégia estruturada (if/while) ou máquina de estados (nós `state`)
    │   ↓ Nós Ladder: ladder_timer · ladder_counter · ladder_latch · ladder_trig · ladder_coil
    ├→ ast_normalizer::normalize()    [transforms/ast_normalizer.rs]
    │   ↓ ProgramNode normalizado
    └→ code_to_asl::ast_to_asl('cpp')[transforms/code_to_asl.rs]
        ↓ ProgramNode → AslProgram (IR de simulação)

AslProgram → ASLExecutor → SimulationEngine (rota de simulação)

AslProgram → LanguageGenerator::generate(target_lang, board_profile)
    ↓
Código fonte (C++/Python/Rust Embassy/ST)
    ↓ (Desktop — Tauri invoke)
CompilerService::compile(toolchain, board) → firmware.hex / firmware.bin
    ↓
FlashManager::flash(transport, board) → Hardware real
```

> **Arquitectura dual:** `flow_to_asl.rs` serve tanto a rota de **simulação** (retorna `AslProgram` para `ASLExecutor`) como a rota de **flash** (retorna `AslProgram` para `LanguageGenerator`). O módulo `flow/` do crate `neuroforge-asl` é idêntico em WebApp (via WASM/`wasm-bindgen`) e Desktop (via `tauri::invoke`).

---

## 8. NeuroForge Ladder Editor — Editor Visual para PLCs

### 8.1 Arquitectura do Ladder Editor

O Ladder Editor é construído em **Svelte 5 com SVG puro** (não SvelteFlow). A escolha de SVG justifica-se pela natureza grid-based do Ladder, onde rungs são linhas horizontais com posições fixas:

```svelte
<!-- LadderEditor.svelte -->
<script lang="ts">
  import type { AslRung } from '@/types/asl-plc-types';
  import LadderRung from './LadderRung.svelte';
  import LadderToolbar from './LadderToolbar.svelte';
  import { ladder } from '@/state/ladder.svelte.ts';

  let rungs = $state<AslRung[]>(ladder.rungs);

  function addRung() { ladder.addRung(); }
  function deleteRung(index: number) { ladder.deleteRung(index); }
</script>

<div class="ladder-editor h-full flex flex-col">
  <LadderToolbar />
  <div class="ladder-canvas overflow-auto flex-1">
    {#each rungs as rung, i}
      <LadderRung {rung} index={i} on:delete={() => deleteRung(i)} />
    {/each}
    <button onclick={addRung} class="add-rung-btn">+ Adicionar Rung</button>
  </div>
</div>
```

### 8.2 Elementos Visuais do Ladder

```
Rung:  |---[ ]---[ ]---( )---|
       powerrail NO  NC  coil  powerrail

Elementos disponíveis na toolbar:
├── Contactos
│   ├── Contacto NO (normalmente aberto)    [ ]  → AslContact
│   ├── Contacto NC (normalmente fechado)   [/]  → AslNegContact
│   ├── Detecção borda subida P            [P]  → AslTrigR
│   └── Detecção borda descida N           [N]  → AslTrigF
├── Bobinas
│   ├── Bobina normal                       ( )  → AslCoil
│   ├── Bobina negada                       (/)  → AslNegCoil
│   ├── Bobina SET (latching)               (S)  → AslLatchSR (set)
│   └── Bobina RESET                        (R)  → AslLatchRS (reset)
├── Blocos de Função
│   ├── Timer TON                          [TON] → AslTimerTON
│   ├── Timer TOF                          [TOF] → AslTimerTOF
│   ├── Timer TP                           [TP]  → AslTimerTP
│   ├── Counter CTU                        [CTU] → AslCounterCTU
│   └── Counter CTD                        [CTD] → AslCounterCTD
└── Ramos
    ├── Início de ramo paralelo             ---+  → BranchStart
    └── Fim de ramo paralelo                +---  → BranchEnd
```

### 8.3 Pipeline Ladder → ASL → ST

```
Utilizador desenha Ladder no editor visual
    ↓ (serialização automática)
AslPlcProgram { networks: [AslRung, ...] }
    ↓
st_generator.rs → Structured Text (exportação)
    ou
ladder_generator.rs → Ladder XML (exportação CODESYS/TwinCAT)
    ou
AslExecutor → simulação no browser
    ↓ (flash via MODBUS/Ethernet)
PLC real
```

---

## 9. Rust Embassy — Nova Linguagem para MCUs

### 9.1 O Que é Embassy

[Embassy](https://embassy.dev) é o framework Rust async/await para sistemas embarcados. Suporta RP2040, STM32, nRF52/53/91 e ESP32. É a evolução natural do `no_std` Rust.

### 9.2 Mapeamento ASL → Embassy

```rust
// ASLDelay { ms: 500 } →
Timer::after(Duration::from_millis(500)).await;

// ASLDigitalWrite { pin: 2, value: HIGH } →
led.set_high();

// ASLRead { pin: A0, mode: ANALOG } →
let value = adc.read(&mut pin).await.unwrap();

// ASLSerialBegin { baud: 115200 } →
let mut uart = Uart::new(p.UART0, p.PIN_1, p.PIN_0, Irqs,
    p.DMA_CH0, p.DMA_CH1, Config::default());

// ASLTask (loop principal) →
#[embassy_executor::main]
async fn main(spawner: Spawner) {
    let p = embassy_rp::init(Default::default());
    loop {
        // ... body ...
    }
}
```

---

## 10. Firmware Manager — Criação, Flash e Tratamento de Erros

### 10.1 FirmwareHub

```rust
pub struct FirmwareHub {
    library: FirmwareLibrary,
    registry: BoardRegistry,
}

impl FirmwareHub {
    pub async fn create_original(&self, board: BoardId) -> Result<FirmwareBinary, FwError>;
    pub async fn create_custom(
        &self,
        project: &AslProject,
        board: BoardId,
        base: Option<FirmwareBase>,
        extra_code: Option<String>,
    ) -> Result<FirmwareBinary, FwError>;
    pub async fn flash(
        &self,
        fw: &FirmwareBinary,
        transport: &dyn TransportAdapter,
    ) -> Result<FlashResult, FlashError>;
    pub async fn verify(
        &self,
        fw: &FirmwareBinary,
        transport: &dyn TransportAdapter,
    ) -> Result<bool, FlashError>;
}
```

### 10.2 Tratamento de Erros de Flash e UX de Recovery

Os erros mais comuns em uso real devem ter mensagens accionáveis e diagnóstico automático:

```rust
// flash_manager.rs

#[derive(Debug, thiserror::Error)]
pub enum FlashError {
    #[error("Porta serial ocupada: {port}. Feche o Serial Monitor antes de fazer flash.")]
    PortBusy { port: String },

    #[error("Permissão negada: {port}. Execute: sudo usermod -a -G dialout $USER (requer logout)")]
    PermissionDenied { port: String },

    #[error("Bootloader não detectado. Pressione o botão RESET na placa e tente novamente.")]
    BootloaderNotFound,

    #[error("Firmware corrompido após flash (checksum falhou). A verificar automaticamente...")]
    CorruptedFirmware { expected: String, got: String },

    #[error("Timeout MODBUS ({timeout_ms}ms). Verifique: (1) endereço slave {slave_addr}, (2) baud rate {baud}, (3) paridade {parity}")]
    ModbusTimeout { timeout_ms: u64, slave_addr: u8, baud: u32, parity: String },

    #[error("Ferramenta '{tool}' não encontrada. Instale com: {install_cmd}")]
    ToolNotFound { tool: String, install_cmd: String },

    #[error("Porta serial não detectada. Boards Arduino podem necessitar do driver CH340/CP2102.")]
    NoPortDetected,
}

/// Estratégia de recovery automático
pub enum ErrorRecoveryStrategy {
    /// Mostrar mensagem accionável e aguardar acção do utilizador
    UserAction { message: String, action_label: String },
    /// Tentar recovery automático (ex: deteção alternativa de baud rate)
    AutoRetry { max_attempts: u8, delay_ms: u64 },
    /// Diagnóstico automático antes de mostrar erro
    AutoDiagnose { diagnostic_fn: Box<dyn Fn() -> DiagnosticResult> },
    /// Erro irrecuperável — apenas informar
    Fatal { message: String },
}

impl FlashError {
    pub fn recovery_strategy(&self) -> ErrorRecoveryStrategy {
        match self {
            FlashError::PortBusy { .. } =>
                ErrorRecoveryStrategy::UserAction {
                    message: self.to_string(),
                    action_label: "Tentar novamente".into(),
                },
            FlashError::BootloaderNotFound =>
                ErrorRecoveryStrategy::AutoRetry {
                    max_attempts: 3,
                    delay_ms: 2000,
                },
            FlashError::ModbusTimeout { baud, .. } =>
                ErrorRecoveryStrategy::AutoDiagnose {
                    diagnostic_fn: Box::new(move || diagnose_modbus_baud(*baud)),
                },
            _ => ErrorRecoveryStrategy::UserAction {
                message: self.to_string(),
                action_label: "Ver documentação".into(),
            },
        }
    }
}
```

**Diagnóstico automático de baud rate e port detection:**

```rust
/// Tenta detectar automaticamente o baud rate correcto para MODBUS
pub async fn diagnose_modbus_baud(last_baud: u32) -> DiagnosticResult {
    let common_bauds = [9600u32, 19200, 38400, 57600, 115200];
    for baud in common_bauds.iter().filter(|&&b| b != last_baud) {
        if probe_modbus_slave(*baud).await.is_ok() {
            return DiagnosticResult::Found {
                message: format!("Baud rate correcto detectado: {}. A actualizar configuração.", baud),
                auto_fix: Some(FlashConfig::with_baud(*baud)),
            };
        }
    }
    DiagnosticResult::NotFound {
        message: "Não foi possível detectar baud rate. Verifique a fiação RS485.".into(),
    }
}
```

**`FlashProgressPanel.svelte` — UX de erros accionáveis:**

```svelte
<!-- FlashProgressPanel.svelte (fragmento de erro) -->
{#if flashError}
  <div class="flash-error-panel" role="alert">
    <div class="error-icon">⚠</div>
    <p class="error-message">{flashError.message}</p>

    {#if flashError.recovery === 'UserAction'}
      <button onclick={retryFlash} class="retry-btn">
        {flashError.actionLabel}
      </button>
    {:else if flashError.recovery === 'AutoDiagnose'}
      <div class="diagnosing">
        <span class="spinner" />
        A diagnosticar automaticamente...
      </div>
    {/if}

    {#if flashError.docUrl}
      <a href={flashError.docUrl} target="_blank" class="doc-link">
        Ver documentação →
      </a>
    {/if}
  </div>
{/if}
```

### 10.3 Protocolos de Flash Suportados

| Protocolo | Toolchain/Crate | MCU Alvo | PLC Alvo | Desktop | Mobile |
|---|---|---|---|---|---|
| UART (avrdude) | avrdude subprocess | Arduino AVR | — | ✅ | Bridge |
| UART (esptool) | esptool-rs / subprocess | ESP32, ESP8266 | — | ✅ | Bridge |
| USB DFU | dfu-util subprocess | STM32, nRF, etc. | — | ✅ | ❌ |
| USB HID (picotool) | picotool subprocess | RP2040 | — | ✅ | ❌ |
| USB OTG (Android) | Android USB Host API | Arduino, ESP32 | — | ❌ | ✅ Android |
| probe-rs (SWD/JTAG) | probe-rs crate `0.24` | STM32, nRF, RP2040 | — | ✅ | ❌ |
| Wi-Fi OTA (ESP-IDF) | reqwest HTTP PUT | ESP32 | — | ✅ | ✅ |
| Wi-Fi OTA (Arduino) | reqwest UDP | Arduino OTA | — | ✅ | ✅ |
| MODBUS TCP/RTU | tokio-modbus | — | Todos | ✅ | ✅ (TCP) |
| Ethernet/S7 | s7-rs | — | Siemens S7 | ✅ | ✅ (TCP) |
| Ethernet/IP | eip-rs | — | Allen-Bradley | ✅ | ✅ (TCP) |
| RS485 | serialport | — | PLCs RS485 | ✅ | Bridge |

**Invocação do `picotool` em `firmware/compiler.rs`:**

```rust
// firmware/compiler.rs — fragmento de flash RP2040 via USB HID

pub async fn flash_rp2040_picotool(fw_path: &Path) -> Result<(), FlashError> {
    // Verificar que picotool está disponível
    let picotool = which::which("picotool").map_err(|_| FlashError::ToolNotFound {
        tool: "picotool".into(),
        install_cmd: "brew install picotool  # macOS\napt install picotool  # Ubuntu".into(),
    })?;

    // RP2040 deve estar em modo BOOTSEL (USB HID)
    let output = tokio::process::Command::new(&picotool)
        .args(["load", "-f", fw_path.to_str().unwrap(), "--verify"])
        .output()
        .await?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("No accessible RP2040") {
            return Err(FlashError::BootloaderNotFound);
        }
        return Err(FlashError::ToolNotFound {
            tool: "picotool".into(),
            install_cmd: "Coloque o RP2040 em modo BOOTSEL: mantenha pressionado o botão BOOTSEL e ligue o USB".into(),
        });
    }
    Ok(())
}
```

---

## 11. Segurança da `neuroforge-bridge` (WebApp)

A bridge local (`ws://localhost:8765`) que permite ao WebApp aceder a hardware real **é um vector de ataque se não houver autenticação**. Qualquer página web maliciosa pode aceder se o utilizador tiver a bridge a correr.

### 11.1 Modelo de Segurança

```rust
// neuroforge-bridge/src/main.rs

use std::sync::Arc;
use tokio::sync::Mutex;

pub struct BridgeSecurity {
    /// Token gerado uma única vez no arranque da bridge (UUID v4)
    /// Nunca persiste em disco — apenas em memória durante a sessão
    session_token: String,
    /// Origens permitidas (CORS whitelist)
    allowed_origins: Vec<String>,
    /// Permissão explícita do utilizador para operações de flash
    flash_permission_granted: Arc<Mutex<bool>>,
}

impl BridgeSecurity {
    pub fn new() -> Self {
        Self {
            session_token: uuid::Uuid::new_v4().to_string(),
            allowed_origins: vec![
                "https://app.neuroforge.io".into(),
                "http://localhost:5173".into(),  // Dev local
                "http://localhost:4173".into(),  // Preview local
            ],
            flash_permission_granted: Arc::new(Mutex::new(false)),
        }
    }

    /// Valida token no header de cada pedido WebSocket
    pub fn validate_token(&self, token: &str) -> bool {
        // Comparação em tempo constante (evita timing attacks)
        subtle::ConstantTimeEq::ct_eq(
            token.as_bytes(),
            self.session_token.as_bytes()
        ).into()
    }

    /// Valida origem CORS
    pub fn validate_origin(&self, origin: &str) -> bool {
        self.allowed_origins.iter().any(|o| o == origin)
    }
}
```

**Fluxo de activação:**

```
1. Utilizador arranca neuroforge-bridge
2. Bridge gera token UUID e mostra-o no terminal:
   "NeuroForge Bridge v4.0 — Token: nfb_a1b2c3d4e5f6..."
3. WebApp lê token do utilizador (campo de texto ou QR code)
4. Todos os pedidos WebSocket incluem header: "X-NF-Token: nfb_a1b2c3d4e5f6..."
5. Para operações de flash: bridge mostra diálogo nativo de confirmação
6. Utilizador confirma → flash autorizado para esta sessão
```

**Configuração CORS:**

```rust
// Rejeitar pedidos de origens não-whitelistadas
let cors = CorsLayer::new()
    .allow_origin(AllowOrigin::predicate(move |origin, _| {
        security.validate_origin(origin.to_str().unwrap_or(""))
    }))
    .allow_methods([Method::GET, Method::POST])
    .allow_headers([header::CONTENT_TYPE, HeaderName::from_static("x-nf-token")]);
```

---

## 12. CI/CD — Testes sem Hardware Físico

Esta secção resolve o problema crítico de executar uma pipeline de CI que requer hardware físico para os critérios de sucesso.

### 12.1 Estratégia de Separação de Testes

```
tests/
├── unit/               # Rust unit tests — cargo test
│   ├── asl_types_test.rs
│   ├── roundtrip/      # Roundtrip ASL por linguagem
│   │   ├── c_roundtrip.rs
│   │   ├── python_roundtrip.rs
│   │   ├── embassy_roundtrip.rs
│   │   └── st_roundtrip.rs
│   └── schema/
│       └── migration_test.rs   # Testes de migração .nfv
├── ci/                 # Testes executáveis em CI sem hardware
│   ├── virtual_serial/ # Virtual serial port (socat)
│   ├── modbus_mock/    # Fake MODBUS server
│   └── wasm/           # Testes do bundle WASM
└── hardware-in-the-loop/  # Testes manuais — requerem hardware físico
    ├── README.md        # Instruções para executar com hardware
    ├── arduino_uno/
    ├── esp32/
    └── rp2040/
```

### 12.2 Virtual Serial Port (UART sem hardware)

```bash
# Linux/macOS — socat cria par de portas virtuais
socat -d -d pty,raw,echo=0,link=/tmp/ttyVirtual0 \
          pty,raw,echo=0,link=/tmp/ttyVirtual1 &

# tests/ci/virtual_serial/uart_echo_test.rs
#[tokio::test]
async fn test_uart_echo_virtual() {
    // Inicia servidor echo na porta virtual
    let server = VirtualUartServer::spawn("/tmp/ttyVirtual1").await;

    // Testa que o transporte UART consegue enviar e receber
    let transport = SerialTransport::new("/tmp/ttyVirtual0", 115200).await?;
    transport.write(b"AT\r\n").await?;
    let response = transport.read_until(b'\n', Duration::from_millis(100)).await?;
    assert_eq!(response, b"AT\r\n");  // echo

    server.stop().await;
}
```

**Windows — com `com0com`:**

```powershell
# Instalar com0com (par de portas virtuais no Windows)
# Download: https://sourceforge.net/projects/com0com/
# Após instalação: COM10 ↔ COM11 disponíveis para testes
```

### 12.3 Fake MODBUS Server

```rust
// tests/ci/modbus_mock/fake_modbus_server.rs

use tokio_modbus::prelude::*;
use tokio_modbus::server::tcp::Server as ModbusServer;

pub struct FakeModbusServer {
    registers: Arc<Mutex<HashMap<u16, u16>>>,
}

impl FakeModbusServer {
    pub fn new() -> Self {
        let mut regs = HashMap::new();
        // Pre-popular com valores de teste
        regs.insert(0x0001, 0xABCD);  // Holding register 1
        regs.insert(0x0002, 0x1234);
        Self { registers: Arc::new(Mutex::new(regs)) }
    }

    pub async fn spawn(addr: &str) -> tokio::task::JoinHandle<()> {
        let server = Self::new();
        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        tokio::spawn(async move {
            loop {
                let (stream, _) = listener.accept().await.unwrap();
                server.handle_client(stream).await;
            }
        })
    }
}

// Teste de integração MODBUS sem PLC real
#[tokio::test]
async fn test_modbus_read_holding_register() {
    let server = FakeModbusServer::spawn("127.0.0.1:5502").await;

    let mut ctx = tcp::connect("127.0.0.1:5502").await.unwrap();
    let data = ctx.read_holding_registers(1, 2).await.unwrap();
    assert_eq!(data[0], 0xABCD);
    assert_eq!(data[1], 0x1234);

    server.abort();
}
```

### 12.4 GitHub Actions — Pipeline Multi-Plataforma

```yaml
# .github/workflows/rust.yml
name: Rust CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Install wasm-pack
        run: cargo install wasm-pack

      - name: Install socat (Linux only)
        if: runner.os == 'Linux'
        run: sudo apt-get install -y socat

      - name: cargo test (all crates)
        run: cargo test --workspace

      - name: cargo clippy
        run: cargo clippy --workspace -- -D warnings

      - name: Build WASM bundle
        run: |
          cd crates/neuroforge-asl
          wasm-pack build --target web --out-dir ../../apps/webapp/src/lib/wasm

      - name: Check WASM bundle size
        run: |
          SIZE=$(wc -c < apps/webapp/src/lib/wasm/neuroforge_asl_bg.wasm)
          echo "WASM size: ${SIZE} bytes"
          # Falhar se > 2 MB
          [ "$SIZE" -lt "2097152" ] || (echo "WASM bundle excede 2 MB!" && exit 1)

      - name: Run CI tests (virtual serial + fake MODBUS)
        if: runner.os == 'Linux'
        run: cargo test --test ci_tests -- --nocapture

  svelte:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @neuroforge/shared test
      - run: pnpm --filter @neuroforge/shared lint
```

---

## 13. Protocolo de Adição de Nova Linguagem (MCU ou PLC)

### 13.1 Checklist para Nova Linguagem de MCU (10 Passos)

```
☐ 1.  Verificar se existe grammar tree-sitter para a linguagem
       - tree-sitter-cpp ✅  tree-sitter-python ✅  tree-sitter-rust ✅
       - tree-sitter-structured-text ✅ (github.com/tmatijevich/tree-sitter-structured-text)

☐ 2.  Criar metadata.toml em plugins/<lang>/
       - id, display_name, category="mcu", asl_mappings

☐ 3.  Criar <lang>_parser.rs — implementar trait LanguageParser
       fn parse(&self, source: &str) -> Result<AslProgram, AslError>
       Pipeline interna:
         a. tree-sitter parse → AST raw (CST temporário)
         b. ast_normalizer.rs → ProgramNode (AST normalizado)
         c. code_to_asl.rs → AslProgram (IR persistente)

☐ 4.  Criar <lang>_generator.rs — implementar trait LanguageGenerator
       fn generate(&self, program: &AslProgram, ctx: &GeneratorContext) -> Result<String, AslError>
       Pipeline interna:
         a. Gerar header (imports, bibliotecas)
         b. Gerar variáveis globais
         c. Gerar funções (setup, loop, etc.)
         d. Injectar shims necessários
         e. Formatar código final

☐ 5.  Criar shims para bibliotecas hardware em plugins/<lang>/shims/
       Cada shim: fn inject(&self, code: &str, target: &BoardTarget) -> String

☐ 6.  Criar BoardProfiles em crates/neuroforge-firmware/src/board_profiles.rs

☐ 7.  Registar no LanguageRegistry
       registry.register_parser(Box::new(<Lang>Parser::new()));
       registry.register_generator(Box::new(<Lang>Generator::new()));

☐ 8.  Testes de roundtrip obrigatórios em tests/roundtrip/<lang>_roundtrip.rs
       - test_blink_roundtrip()     → programa blink completo
       - test_serial_roundtrip()    → Serial.begin + print
       - test_gpio_roundtrip()      → digitalRead + digitalWrite
       - test_timing_roundtrip()    → delay + millis

☐ 9.  Actualizar BoardLibrary.svelte com novas placas

☐ 10. Documentar em docs/languages/<lang>.md
```

### 13.2 Checklist para Nova Linguagem de PLC (9 Passos)

```
☐ 1.  Identificar padrão de importação/exportação do PLC alvo
       - CODESYS: .xml / .exp
       - TwinCAT: .tpy / .xml
       - Siemens TIA Portal: .xml (AWL/SCL)
       - Schneider Unity: .fef / .xef

☐ 2.  Criar <plc_lang>_parser.rs com target: PlatformType::PLC
       - Parser de texto (ST) ou XML (Ladder, FBD)
       - Mapear para AslPlcProgram: AslRung, AslContact, AslCoil

☐ 3.  Criar <plc_lang>_generator.rs
       - Gerar ST (texto), Ladder XML, ou IL conforme o fabricante

☐ 4.  Implementar PlcAdapter trait
       fn connect(&self, params: &PlcConnection) -> Result<PlcSession, PlcError>
       fn upload_program(&self, session: &PlcSession, program: &AslPlcProgram) -> Result<(), PlcError>
       fn read_variables(&self, session: &PlcSession, vars: &[&str]) -> Result<Vec<PlcValue>, PlcError>

☐ 5.  Adicionar nós IEC específicos ao AslPlcTypes (se fora do standard IEC)

☐ 6.  Registar no PlcRegistry
       registry.register_plc(Box::new(<Plc>Adapter::new()));

☐ 7.  Testes de roundtrip PLC em tests/roundtrip/<plc>_roundtrip.rs
       - test_motor_start_stop()    → Start/Stop motor
       - test_timer_control()       → programa com TON
       - test_counter()             → programa com CTU

☐ 8.  Actualizar BoardLibrary.svelte com o novo PLC

☐ 9.  Documentar protocolos de flash/upload em docs/plc/<plc>.md
```

### 13.3 Integração com ASL — "The Golden Rule"

Qualquer nova linguagem ou PLC adicionado ao NeuroForge deve respeitar **The Golden Rule**:

> "Todas as linguagens devem andar de mãos dadas" — qualquer nova feature de hardware adicionada para uma linguagem deve ser implementada com paridade semântica em todas as outras.

Se `AslTimerTON` é adicionado ao ST Generator, deve imediatamente ter equivalente no C Generator (timer de software) e no Python Generator (threading.Timer ou time-based loop).

---

## 14. Plano de Fases — Implementação Detalhada

### Fase 0 — Preparação e Limpeza (1–2 semanas)

**Objectivo:** Criar estrutura monorepo correcta, limpar ficheiros desnecessários, validar configuração Cargo + pnpm.

**Tarefas:**
- [ ] Criar `Cargo.toml` raiz (workspace com 5 membros — ver secção 3.1)
- [ ] Criar `pnpm-workspace.yaml` (ver secção 3.2)
- [ ] Criar `apps/shared/package.json` com dependências partilhadas
- [ ] Verificar setup com `cargo check --workspace` + `pnpm install`
- [ ] Criar estrutura de monorepo (`apps/`, `crates/`, `shared/`)
- [ ] Mover `src/components/`, `src/stores/`, `src/engine/` para `apps/shared/src/`
- [ ] Mover `src/components/boards/` para `apps/shared/assets/boards/`
- [ ] Eliminar 50+ ficheiros de output/testes da raiz
- [ ] Eliminar `src/engine/blockly/` + `src/components/BlocklyEditor.tsx`
- [ ] Eliminar `src/engine/asl/blocklyToASL.ts` (cola Blockly oculta em `asl/`)
- [ ] Eliminar `src/engine/Transpiler.ts` (stub vazio, nunca implementado)
- [ ] Eliminar `src/engine/example.ts` (demo QEMU, 513B)
- [ ] Arquivar `fixes.md` (35KB) → `docs/legacy/fixes.md`
- [ ] Arquivar `poc/` → `docs/legacy/poc/`
- [ ] Eliminar `src/services/QEMUApiClient.ts`, `QEMUWebSocket.ts`
- [ ] Eliminar `src/stores/useQEMUStore.ts`, `src/engine/QEMURunner.ts`, `QEMUSimulationEngine.ts` *(caminho correcto: `src/stores/`, não raiz)*
- [ ] Eliminar `server/` completo (backup de `cores/` para `tests/fixtures/`)
- [ ] Documentar inventário completo de tipos ASL em `ASLTypes.ts`
- [ ] Criar `MIGRATION_LOG.md`
- [ ] Criar estrutura `.github/workflows/` (rust.yml, svelte.yml)

**Critério de sucesso:** `cargo check --workspace` limpo. `pnpm install` limpo. `npm run dev` ainda funciona. CI verde no primeiro push.

---

### Fase 1 — ASL Engine em Rust (4–6 semanas)

**Objectivo:** Migrar todo o motor ASL de TypeScript para Rust. Zero regressão.

**Estado:** ✅ Concluída

**Tarefas:**
- [x] ✅ Criar crate `neuroforge-asl` com estrutura completa (incluindo `schema/`, `transforms/code_to_asl.rs`)
- [x] ✅ Migrar `ASLTypes.ts` → `asl_types.rs` (com campo `asl_version: "4.0.0"`)
- [x] ✅ Implementar `schema/nfv.rs` e `schema/migration.rs`
- [x] ✅ Migrar `ASLExecutor.ts` → `asl_executor.rs`
  - ✅ Adicionar `tokio = { version = "1", features = ["rt", "time"], optional = true }` com feature flag WASM
- [x] ✅ **Migrar `context.ts` → `transforms/context.rs` PRIMEIRO** (dependência de todos os outros transforms)
- [x] ✅ Migrar `astNormalizer.ts` → `ast_normalizer.rs` (Source → ProgramNode)
- [x] ✅ Migrar `postfixUtils.ts` → `transforms/postfix_utils.rs` (side-effects i++/i--)
- [x] ✅ Migrar todos os transforms: `expr_transform.rs`, `block_transform.rs`, `call_transform.rs`, `statement_registry.rs` (39KB)
- [x] ✅ Implementar `transforms/mod.rs` (re-exporta todos os transforms ← transforms/index.ts)
- [x] ✅ Implementar `code_to_asl.rs` explícito (ProgramNode → AslProgram — Pipeline 1: Simulação)
- [x] ✅ Migrar `helpers/typeUtils.ts` → `helpers/type_utils.rs`
- [x] ✅ Migrar `helpers/arrayUtils.ts` → `helpers/array_utils.rs`
- [x] ✅ Migrar `plugins/core/ShimManager.ts` → `plugins/core/shim_manager.rs` (antes dos plugins)
- [x] ✅ Migrar C plugin (parser + generator + shims)
- [x] ✅ Migrar Python plugin (parser + generator + shims)
- [x] ✅ Migrar Rust no_std plugin
- [x] ✅ Migrar PLC/ST plugin — expandido: ST + IL + LD + FBD + SFC (commit cf6c54e)
- [x] ✅ Migrar `src/engine/asl/transpile.ts` → `transpile.rs` (entry point público Pipeline 2: Transpilação)
- [x] ✅ Compilar para WASM (`wasm-pack build --target web`)
- [x] ✅ Validar paridade com testes de roundtrip (40/40 testes ✅)
- [x] ✅ Criar testes de migração de schema em `tests/schema/`
- [x] ✅ Adicionar CI: WASM size check < 2 MB + GitHub Actions (`rust.yml`)
- [x] ✅ Criar `wasm/mod.rs` + `wasm/bindings.rs` com exports `#[wasm_bindgen]`
- [x] ✅ Criar `apps/webapp/src/lib/wasm/index.ts` — wrapper TypeScript para o bundle WASM
- [x] ✅ Instalar wasi-sdk v25 + configurar `CC_wasm32_unknown_unknown`
- [x] ✅ Corrigir borrow checker em `c_generator.rs` e `rust_generator.rs` (commit `120aac0`)
- [x] ✅ Guardar testes `#[wasm_bindgen_test]` com `cfg(target_arch = "wasm32")` (commit `a93908b`)
- [x] ✅ Implementar `plcopen_xml.rs` — import/export PLCopen XML (commit `cf6c54e`)
- [x] ✅ Implementar `plc_plugin.rs` — registo unificado de todos os sub-parsers PLC (commit `cf6c54e`)

**Movidas para Fase 2+:**
- [ ] ☐ Migrar `FlowValidator.ts` → `flow/flow_validator.rs` (depende do SvelteFlow)
- [ ] ☐ Migrar `CfgBuilder.ts` → `flow/cfg_builder.rs`
- [ ] ☐ Migrar `FlowToAst.ts` → `flow/flow_to_ast.rs`
- [ ] ☐ Migrar `flowToASL.ts` → `flow/flow_to_asl.rs`

**Critério de sucesso:** ✅ Todos os testes de roundtrip passam (40/40). Bundle WASM < 2 MB. `code_to_asl.rs` tem cobertura de testes unitários > 90%.

---

### Fase 2 — Desktop (Tauri 2 + Svelte 5) (6–8 semanas)

**Objectivo:** App Desktop funcional, substituindo React por Svelte 5.

#### Sub-Fase 2A — Setup + Componentes Atómicos (2 semanas)

- [ ] Setup Tauri 2 com SvelteKit + Svelte 5 em `apps/desktop/`
- [ ] Coexistência React + Svelte no Vite (vite-plugin-svelte + @vitejs/plugin-react)
- [ ] Instalar `@xyflow/svelte` 1.x, `shadcn-svelte`, `@monaco-editor/loader`
- [ ] Eliminar `BlocklyEditor.tsx`, stores QEMU
- [ ] Migrar stores: `useSerialStore`, `useLibraryStore`, `useConnectionStore`
- [ ] Migrar: `Terminal`, `SimulationModeToggle`, `PropertiesPanel`, `SerialMonitor`, `SerialTerminalPanel`
- [ ] Implementar `transport/serial.rs` no Tauri backend

#### Sub-Fase 2B — Layout e Estrutura (2 semanas)

- [ ] Migrar stores: `useFileStore`, `useUIStore`
- [ ] Migrar: `TopToolbar`, `LeftSidebar`, `FloatingWindow`, `ComponentsLibrary`
- [ ] Implementar `transport/usb.rs`, `transport/modbus.rs`, `transport/ethernet.rs`
- [ ] Implementar `firmware/compiler.rs` (arduino-cli integration)
- [ ] Implementar picotool flash em `firmware/compiler.rs` (secção 10.3)

#### Sub-Fase 2C — Painéis de Propriedades (1 semana)

- [ ] Migrar todos os 7 painéis de propriedades para Svelte
- [ ] Migrar `LibrariesPanel.svelte`

#### Sub-Fase 2D — Editores de Código e ASL (1 semana)

- [ ] Migrar `CodeEditor.svelte` (Monaco standalone)
- [ ] Migrar `CodeEditorWithTabs.svelte`
- [ ] Migrar `ASLViewer.svelte`

#### Sub-Fase 2E — Canvas de Simulação e Nós (2 semanas + spike obrigatório)

> ⚠️ **Risco de Estimativa — FlowEditor.tsx (42KB):** O `FlowEditor.tsx` é o maior componente do projecto (42KB). Antes de comprometer o calendário de 2 semanas para esta sub-fase, é **obrigatório** um spike de 3–5 dias com `@xyflow/svelte` para validar que todos os padrões usados (`Handle`, custom edges, nodos SVG com pinos, `useReactFlow` hooks) têm equivalêntes funcionais na versão Svelte. Só depois do spike se define o calendário real.

- [ ] **Spike obrigatório (3–5 dias): validar @xyflow/svelte 1.x** com MCUNode completo (SVG + handles + pinos interactivos). Avaliar: `Handle`, `ManhattanEdge` custom, `useReactFlow` equivalente, performance com 20+ nós.
- [ ] Migrar todos os nós de simulação (`LEDNode`, `MCUNode`, `ButtonNode`, `ServoNode`, `RGBLEDNode`, `PotentiometerNode`)
- [ ] Migrar `ManhattanEdge.svelte`
- [ ] Migrar `SimulationCanvas.svelte` (antigo `FlowEditor.tsx` — 42KB, complexidade alta)
- [ ] Migrar `useSimulationStore` → `simulation.svelte.ts`
- [ ] Migrar `CanvasArea.svelte`
- [ ] Implementar `firmware/flash_manager.rs` com `ErrorRecoveryStrategy` (secção 10.2)
- [ ] Implementar `firmware/firmware_hub.rs`
- [ ] Criar `FirmwarePanel.svelte`, `FlashProgressPanel.svelte` (com UX de erros), `BoardLibrary.svelte`
- [ ] Adicionar CI: virtual serial port tests

#### Sub-Fase 2F — Remoção do React (0.5 semanas)

- [ ] Confirmar todos os 26 componentes + 7 stores migrados
- [ ] Testes de integração end-to-end
- [ ] `npm uninstall react react-dom @xyflow/react zustand @radix-ui/* @monaco-editor/react`
- [ ] `npm uninstall framer-motion react-hook-form recharts embla-carousel-react cmdk next-themes vaul blockly`
- [ ] Remover `@vitejs/plugin-react` do `vite.config.ts`
- [ ] **Zero dependências React em runtime** ✅

**Critério de sucesso:** App Desktop funciona sem React. Flash de firmware em Arduino, ESP32 e RP2040 (hardware-in-the-loop manual). CI verde em ubuntu/windows/macos.

---

### Fase 3 — Rust Embassy + IEC 61131-3 ST (4–6 semanas)

**Objectivo:** Adicionar suporte a Rust Embassy e Structured Text PLC.

- [ ] Implementar plugin `rust_embassy` no crate ASL
- [ ] Implementar Embassy generator para RP2040 (`embassy-rp`), STM32 (`embassy-stm32`), nRF52 (`embassy-nrf`), ESP32 (`esp-rs`)
- [ ] Criar shims Embassy (gpio_shim.rs, timer_shim.rs, uart_shim.rs, adc_shim.rs)
- [ ] Adicionar `probe-rs = "0.24"` ao `neuroforge-transport` (SWD/JTAG para STM32/nRF)
- [ ] Testes de roundtrip Embassy
- [ ] Implementar parser IEC 61131-3 ST (`tree-sitter-structured-text`)
- [ ] Implementar ST generator (ASL → ST)
- [ ] Adicionar nós IEC completos ao crate ASL (`asl_version` bump para 4.1.0)
- [ ] Implementar `transport/modbus.rs` completo (RTU + TCP via `tokio-modbus`)
- [ ] Implementar `PlcAdapter` para MODBUS genérico
- [ ] Adicionar CI: fake MODBUS server tests
- [ ] Testes de roundtrip ST

**Critério de sucesso:** Programa ST gerado e instalado via MODBUS num PLC real (hardware-in-the-loop manual). CI verde com fake MODBUS.

---

### Fase 4 — WebApp (SvelteKit) + Ladder Editor (4–5 semanas)

**Objectivo:** WebApp funcional + Ladder Editor visual.

- [ ] Criar `apps/webapp/` com SvelteKit consumindo `apps/shared/`
- [ ] Integrar WASM do crate `neuroforge-asl`
- [ ] Implementar transporte WebSerial + WebUSB
- [ ] Criar executável `neuroforge-bridge` (Rust standalone ~2 MB) com segurança token (secção 11)
- [ ] Deploy GitHub Pages / Cloudflare Pages
- [ ] Implementar `LadderEditor.svelte` com SVG puro
- [ ] Implementar todos os elementos Ladder (Contact, NegContact, Coil, NegCoil, Set/Reset, Timers, Counters, Branches)
- [ ] Implementar `ladder_importer.rs` (XML CODESYS via roxmltree)
- [ ] Implementar `ladder_generator.rs` (exportação CODESYS/TwinCAT)
- [ ] `asl_version` bump para 4.2.0 (AslRung, AslContact, AslCoil)
- [ ] Implementar NeuroForge Flow Editor (`FlowEditor.svelte`)
- [ ] Implementar todos os nós Flow
- [ ] Implementar `flow_to_asl()` Rust/WASM

**Critério de sucesso:** WebApp carrega, edita, compila e descarrega firmware. Ladder Editor cria e exporta programas. Bridge segura com token.

---

### Fase 5 — Mobile (Tauri 2 Mobile) (3–4 semanas)

- [ ] Configurar `apps/mobile/` com Tauri 2 Mobile (Android + iOS)
- [ ] Implementar `transport/wifi_ota.rs` (ESP32 + RP2040W)
- [ ] Implementar mDNS device discovery
- [ ] Implementar BLE (configuração de dispositivos)
- [ ] Implementar USB OTG Android
- [ ] UI responsiva Mobile (mesma base Svelte partilhada)
- [ ] Submeter ao App Store e Google Play

---

### Fase 6 — PLCs Avançados + FBD + Ecossistema (6–8 semanas)

**Critérios de saída definidos (ao contrário de versões anteriores):**

**Objectivo:** Suporte a PLCs industriais de marca + editor FBD + CLI.

- [ ] Suporte Siemens S7 (`s7-rs`) — PlcAdapter S7
- [ ] Suporte Allen-Bradley EtherNet/IP (`eip-rs`) — PlcAdapter EIP
- [ ] Suporte OPC-UA (`open62541-rs`) — PlcAdapter OPCUA
- [ ] Function Block Diagram (FBD) editor — `asl_version` bump para 4.3.0 (`AslSFC`, `AslFbd`)
- [ ] CLI NeuroForge: `nf build`, `nf flash`, `nf monitor`, `nf list-boards`
- [ ] Plugin SDK público (documentação + exemplos)
- [ ] Marketplace de templates e firmware

**Critério de saída Fase 6:** S7 e Allen-Bradley PlcAdapters com testes de roundtrip. CLI `nf build` + `nf flash` funcionais em hardware real. Documentação SDK publicada.

**Estimativa de duração:** 6–8 semanas (S7 + EIP são integrações complexas).

---

## 15. Métricas de Sucesso

| Métrica | Target | Actual |
|---|---|---|
| Bundle WASM (`neuroforge-asl`) | < 2 MB | ✅ Atingido (Fase 1D) |
| Startup Desktop | < 2 segundos | — |
| Parsing ASL (10.000 linhas) | < 100 ms | — |
| Flash firmware 100 KB (UART 115200) | < 15 s | — |
| Cobertura de testes Rust (crate ASL) | > 85% | — |
| Cobertura de `code_to_asl.rs` | > 90% | — |
| Testes de roundtrip por linguagem | 100% pass | ✅ 40/40 (Fase 1) |
| Dependências Node.js em runtime | **Zero** | — |
| Dependências React em runtime (pós Fase 2F) | **Zero** | — |
| Linguagens MCU suportadas (Fase 3) | C/C++, Python, Rust no_std, Rust Embassy | — |
| Linguagens PLC suportadas | ST, Ladder | ✅ ST + IL + LD + FBD + SFC (Fase 1) |
| Protocolos de flash (Fase 2) | UART, USB, WiFi OTA, MODBUS, probe-rs | — |
| CI verde sem hardware físico | ubuntu + windows + macos | ✅ Atingido (rust.yml) |
| Schema `.nfv` com migração automática | ✅ Fase 1 | ✅ Implementado |
| Bridge com autenticação token | ✅ Fase 4 | — |

---

## Apêndice A — Cargo.toml por Crate

### `neuroforge-asl`

```toml
[package]
name = "neuroforge-asl"
version = "4.0.0"
edition = "2021"

[dependencies]
# Dependências partilhadas do workspace
serde.workspace      = true
serde_json.workspace = true
thiserror.workspace  = true

# tree-sitter
tree-sitter              = "0.26.3"
tree-sitter-c            = "0.24.1"
tree-sitter-cpp          = "0.23.4"    # novo
tree-sitter-python       = "0.25.0"
tree-sitter-rust         = "0.24.0"
tree-sitter-arduino      = "0.24.0"    # novo
tree-sitter-xml          = "0.7.0"     # novo
tree-sitter-language      = "0.1.7"     # compat. explícita

# PLC IEC 61131-3
iec61131                 = "0.7.0"     # ST parser
pest                     = "2"         # PEG para IL
pest_derive              = "2"
quick-xml                = { version = "0.39.2", features = ["serialize", "overlapped-lists"] }
plcopen                  = "0.3.1"     # PLCopen XML

# Schema + versionamento
semver    = { version = "1", features = ["serde"] }
uuid      = { version = "1", features = ["v4"] }
roxmltree = "0.19"   # Importação Ladder XML (CODESYS/TwinCAT)

# Runtime async — feature-flagged para não puxar tokio no WASM
tokio = { version = "1", features = ["rt", "time"], optional = true }

[features]
default = ["native"]
native  = ["tokio"]  # Activo por defeito em builds Desktop
# WASM: não inclui tokio (browser tem o próprio scheduler)

[target.'cfg(target_arch = "wasm32")'.dependencies]
wasm-bindgen             = "0.2.114"
js-sys                   = "0.3"
web-sys                  = { version = "0.3", features = ["console"] }

[package.metadata.wasm-pack.profile.release]
wasm-opt = false
```

### `neuroforge-transport`

```toml
[package]
name = "neuroforge-transport"
version = "4.0.0"
edition = "2021"

[dependencies]
serde.workspace      = true
serde_json.workspace = true
thiserror.workspace  = true
tokio.workspace      = true
anyhow.workspace     = true

# Serial / UART
serialport             = "4"
tauri-plugin-serialport = "2"

# Modbus (já no plano — shim sobre RS485)
tokio-modbus           = "0.5"

# USB
rusb                   = "0.9"

# Network
reqwest                = { version = "0.12", features = ["json"] }
mdns-sd                = "0.10"    # mDNS device discovery
smoltcp                = { version = "0.12", features = ["socket-tcp", "socket-udp"] }

# Debug / Flash
probe-rs               = "0.24"    # SWD/JTAG flash + debugging (STM32, nRF, RP2040)
subtle                 = "2"       # Constant-time comparisons (segurança bridge)

# === Protocolos de Transporte — Fase 3 ===
# CAN Bus
embedded-can           = "0.4"         # Traits CAN (embedded-hal ecosystem)

# 1-Wire
embedded-onewire       = "0.1"         # Traits 1-Wire no_std + async
ds18b20                = "0.2"         # Driver DS18B20

# I2S (Áudio)
i2s                    = "0.1"         # ou via embedded-hal-async

# USB Device (MCU)
usb-device             = "0.3"         # Padrão no_std para dispositivos USB
usbd-serial            = "0.2"         # Classe CDC-ACM

# IR
infrared               = "0.14"        # no_std, suporta NEC/RC5/RC6/Sony/Samsung

# Bluetooth Desktop
btleplug               = "0.11"        # BLE host para Desktop (Windows/macOS/Linux)

# MIDI
midi-types             = "0.4"         # Tipos MIDI no_std

# DMX512
dmx                    = "0.1"         # ou impl sobre serialport com baud=250000
```

### `neuroforge-firmware`

```toml
[package]
name = "neuroforge-firmware"
version = "4.0.0"
edition = "2021"

[dependencies]
serde.workspace  = true
serde_json.workspace = true
thiserror.workspace = true
tokio.workspace  = true
anyhow.workspace = true

sha2     = "0.10"    # Checksum verificação pós-flash
tempfile = "3"
which    = "6"       # Localizar ferramentas (avrdude, esptool, picotool, probe-rs)
roxmltree = "0.19"
```

---

## Apêndice B — Ferramentas Externas (Bundled no Desktop)

| Ferramenta | Versão | Uso | Invocação em Rust |
|---|---|---|---|
| `arduino-cli` | ≥ 1.0 | Compilar + flash Arduino/AVR | subprocess via `tokio::process::Command` |
| `esptool.py` (ou esptool-rs) | ≥ 4.0 | Flash ESP32/ESP8266 via UART | subprocess |
| `avrdude` | ≥ 7.0 | Flash AVR via UART/ISP | subprocess |
| `dfu-util` | ≥ 0.11 | Flash via DFU USB | subprocess |
| `picotool` | ≥ 2.0 | Flash RP2040 via USB HID | subprocess (ver secção 10.3) |
| `probe-rs` | ≥ 0.24 | Flash + debug STM32/nRF/RP2040 via SWD/JTAG | crate nativo **E** subprocess (`cargo embed`) |
| `cargo` + `rustup` | Stable | Compilar firmware Rust/Embassy | subprocess |
| `socat` | qualquer | Virtual serial port em CI (Linux/macOS) | invocado por test harness |

---

## Apêndice C — Inventário Completo de Protocolos por Camada

### Camada Física

| Protocolo | Camada | Velocidade | Distância | Tipos ASL | Fase | Estado |
|---|---|---|---|---|---|---|
| UART / Serial | Físico | 300–115200 bps | < 15 m | `serialBegin`, `print`, `uartWrite`, `uartRead` | ✅ 1 | ✅ Completo |
| RS485 | Físico | 100 kbps–10 Mbps | < 1200 m | `rs485Begin`, `rs485Write`, `rs485Read` | Planeada: 3 | ❌ Planeado |
| RS232 | Físico | 300–115200 bps | < 15 m | partilha UART | ✅ 1 | ✅ Completo |
| SPI | Físico | 100 kHz–50 MHz | < 1 m | `spiTransfer` | ✅ 1 | ⚠️ Parcial |
| I2C | Físico | 100 kHz–5 MHz | < 1 m | `i2cWrite`, `i2cRead` | ✅ 1 | ⚠️ Parcial |
| CAN Bus | Físico | 125 kbps–1 Mbps | < 40 m | `canBegin`, `canSend`, `canReceive` | Planeada: 3 | ❌ Planeado |
| LIN Bus | Físico | 1–20 kbps | < 40 m | `linBegin`, `linSend`, `linRead` | Planeada: 3 | ❌ Planeado |
| 1-Wire | Físico | 15 kbps | < 300 m | `oneWireBegin`, `oneWireSearch`, `oneWireRead`, `oneWireWrite` | Planeada: 3 | ❌ Planeado |
| I2S (Áudio) | Físico | variável | < 0.5 m | `i2sBegin`, `i2sWrite`, `i2sRead` | Planeada: 4 | ❌ Planeado |
| USB Device | Físico | 1.5–480 Mbps | < 5 m | `usbBegin`, `usbWrite`, `usbRead` | Planeada: 4 | ❌ Planeado |
| Ethernet | Físico | 10–1000 Mbps | < 100 m | `ethernetBegin`, `tcpConnect`, `udpSend` | Planeada: 3 | ❌ Planeado |

### Camada de Aplicação sobre Físicos Existentes (Shims)

| Protocolo | Corre sobre | Tipos ASL | Fase | Estado |
|---|---|---|---|---|
| Modbus RTU | RS485 | shim (não precisa tipo novo) | Planeada: 3 | ⚠️ Parcial |
| Modbus TCP | Ethernet | shim | Planeada: 3 | ⚠️ Parcial |
| DMX512 | RS485 | shim sobre `rs485Write` | Planeada: 3 | ❌ Planeado |
| MIDI | UART | shim sobre `uartWrite/Read` | Planeada: 3 | ❌ Planeado |
| Firmata | Serial | shim | Planeada: 3 | ❌ Planeado |
| DeviceNet | CAN Bus | shim sobre `canSend/Receive` | Planeada: 3 | ❌ Planeado |
| NMEA 2000 | CAN Bus | shim sobre `canSend/Receive` | Planeada: 3 | ❌ Planeado |
| JSON-over-serial | UART | shim + `serde_json` | Planeada: 3 | ❌ Planeado |

### Wireless / Alta-Performance

| Protocolo | Camada | Tipos ASL | Fase | Estado |
|---|---|---|---|---|
| IR (InfraRed) | Wireless | `irSend`, `irRead` | Planeada: 3 | ❌ Planeado |
| BLE (Bluetooth LE) | Wireless | `bleBegin`, `bleScan`, `bleConnect`, `bleWrite`, `bleRead` | Planeada: 4 | ❌ Planeado |
| ZigBee | Wireless | `zigbeeBegin`, `zigbeeSend`, `zigbeeRead` | Planeada: 5 | ❌ Planeado |
| Wi-Fi OTA | Wireless | shim sobre UART/TCP | ✅ 1 | ✅ Completo |
| BLE Desktop | Wireless | `btleplug` | Planeada: 4 | ❌ Planeado |

### Camada de Aplicação IEEE / Industriais

| Protocolo | Corre sobre | Estratégia | Fase |
|---|---|---|---|
| IEEE 1451 (TEDS) | I2C/SPI | Shim que gera código de inicialização de TEDS sobre `AslI2cWrite/Read` | Planeada: 4 |
| Tiny Embedded Network | UART | Shim minimalista orientado a bytes | Planeada: 3 |
| NTSC/PAL | GPIO/PWM | shim sobre `pwmInit` + timing | Planeada: 5 |

### Fora de Scope

| Tecnologia | Razão |
|---|---|
| JTAG | Não é protocolo de aplicação — ferramenta de debug/flash (→ `probe-rs`) |
| Myrinet / InfiniBand | Fora do scope de MCUs/PLCs |
| AoE (ATA over Ethernet) | Fora do scope de MCUs/PLCs |

---

## Apêndice D — Referências Técnicas

### Crates Rust

- [embedded-can](https://crates.io/crates/embedded-can) — Traits CAN (embedded-hal ecosystem)
- [embedded-onewire](https://crates.io/crates/embedded-onewire) — Traits 1-Wire no_std + async
- [ds18b20](https://crates.io/crates/ds18b20) — Driver DS18B20 (1-Wire)
- [infrared](https://crates.io/crates/infrared) — no_std IR: NEC/RC5/RC6/Sony/Samsung
- [usb-device](https://crates.io/crates/usb-device) — Padrão no_std para dispositivos USB
- [usbd-serial](https://crates.io/crates/usbd-serial) — Classe CDC-ACM para USB
- [smoltcp](https://github.com/smoltcp-org/smoltcp) — TCP/UDP stack para MCUs
- [btleplug](https://crates.io/crates/btleplug) — BLE host para Desktop (Windows/macOS/Linux)
- [midi-types](https://crates.io/crates/midi-types) — Tipos MIDI no_std
- [dmx](https://crates.io/crates/dmx) — DMX512 em Rust
- [i2s crate](https://crates.io/crates/i2s) — I2S para áudio em MCUs

### Frameworks e Bibliotecas

- [Embassy Framework](https://embassy.dev) — Framework Rust async para sistemas embarcados
- [embedded-hal](https://github.com/rust-embedded/embedded-hal) — Traits hardware abstraction (v1.0)
- [IronPLC](https://github.com/ironplc/ironplc) — Parser IEC 61131-3 em Rust (referência)
- [crates.io/crates/iec61131](https://crates.io/crates/iec61131) — Parser ST em Rust
- [plcopen](https://crates.io/crates/plcopen) — PLCopen XML em Rust
- [tree-sitter-structured-text](https://github.com/tmatijevich/tree-sitter-structured-text) — Grammar tree-sitter para ST

### Frontend / UI

- [@xyflow/svelte](https://svelteflow.dev) — SvelteFlow 1.x com Svelte 5 Runes (lançado Maio 2025)
- [Tauri 2 SvelteKit Guide](https://v2.tauri.app/start/frontend/sveltekit/) — Guia oficial
- [shadcn-svelte](https://www.shadcn-svelte.com) — Substituto Svelte do Radix UI

### Ferramentas

- [tokio-modbus](https://github.com/slowtec/tokio-modbus) — MODBUS assíncrono em Rust
- [probe-rs](https://probe.rs) — Flash + debug SWD/JTAG para MCUs em Rust
- [com0com](https://sourceforge.net/projects/com0com/) — Virtual serial ports Windows (CI)
- [socat manual](http://www.dest-unreach.org/socat/doc/socat.html) — Virtual serial ports Linux/macOS (CI)
- [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) — WASM toolchain para Windows (necessário para tree-sitter WASM)
