# NEUROFORGE

## Plano de Migração e Evolução da Plataforma

**WebApp · Desktop · Mobile · PLCs**

**Versão 3.3** · Branch: preRust · 17 de Março de 2026 · Autor: Caio Jordão Barradas

***

## Glossário de Termos

> Este glossário existe para que novos colaboradores possam ler o documento sem ambiguidades.

| **Termo** | **Definição** |
|---|---|
| **ASL** | *Abstract Syntax Language* — Representação Intermédia (IR) universal do NeuroForge. Formato JSON que captura a semântica completa de um programa embarcado de forma independente de linguagem. |
| **IR** | *Intermediate Representation* — Formato intermédio entre a entrada (código fonte) e a saída (código gerado). O ASL é o IR do NeuroForge. |
| **AST** | *Abstract Syntax Tree* — Árvore de sintaxe produzida pelo parser (tree-sitter). **Temporária**: existe apenas durante a conversão de código fonte para ASL ou para transpilação directa. |
| **ProgramNode** | Raiz da AST produzida pelos parsers tree-sitter. Estrutura temporária consumida por `code_to_asl()` (simulação) e por `transpile()` (transpilação). |
| **AslProgram** | Raiz do ASL — estrutura JSON persistente que representa o programa de forma semântica e independente de linguagem. |
| **Shim** | Camada de compatibilidade que mapeia funções de biblioteca hardware (ex: `digitalWrite`, `analogRead`) para operações ASL. Cada linguagem tem os seus próprios shims. |
| **Generator** | Módulo que converte um `ProgramNode` (AST) ou um `AslProgram` para código fonte numa linguagem específica (C++, Python, Rust, ST, etc.), consoante o pipeline. |
| **Parser** | Módulo que converte código fonte (via tree-sitter AST) para `ProgramNode`. |
| **Roundtrip** | Teste que verifica `código → ASL → código → ASL` (simulação) ou `código A → AST → código B → AST` (transpilação) produz resultados semanticamente equivalentes. |
| **Paridade Semântica** | Garantia de que uma operação de hardware (ex: `DigitalWrite`) é suportada com o mesmo significado em **todas** as linguagens. |
| **FirmwareHub** | Módulo que gere firmwares originais (pré-compilados) e custom (gerados pelo utilizador). |
| **FlashManager** | Orquestra o processo de upload de firmware para a placa física, seleccionando o protocolo correcto (UART, USB, MODBUS, etc.). |
| **TransportAdapter** | Trait Rust que abstrai um protocolo de comunicação físico. Cada protocolo (UART, MODBUS, Ethernet) implementa este trait. |
| **Bridge Local** | Executável Rust standalone (~2 MB) que expõe hardware físico ao WebApp via WebSocket local autenticado. |
| **OTA** | *Over-The-Air* — Upload de firmware via rede Wi-Fi sem necessidade de cabo. |
| **SWD/JTAG** | Protocolos de debug e flash para microcontroladores ARM (ex: STM32, nRF, RP2040). |
| **IEC 61131-3** | Norma internacional de linguagens de programação para PLCs. Define ST, Ladder, FBD, IL, SFC. |
| **Embassy** | Framework Rust async/await para sistemas embarcados sem OS. |
| **Scan Cycle** | Ciclo de execução de um PLC: lê entradas → executa programa → escreve saídas. |
| **NFV** | *NeuroForge Visual* — Formato de ficheiro `.nfv` que serializa programas criados no Flow Editor/Ladder Editor. |
| **.nfv** | Ficheiro JSON versionado que representa um programa visual NeuroForge (nós, arestas, placa alvo, versão ASL). |
| **Monorepo** | Repositório único com múltiplos pacotes/aplicações (`apps/`, `crates/`). |
| **Tauri** | Framework Rust para criar aplicações Desktop e Mobile nativas com frontend web. |
| **SvelteFlow** | `@xyflow/svelte` — Porto Svelte 5 do ReactFlow. Canvas de nós interactivo usado no Flow Editor e Canvas de Simulação. |

***

## Sumário Executivo

Este documento é o plano definitivo de evolução do NeuroForge desde a branch preRust (React 19 + Vite + Node.js) para uma plataforma unificada de três superfícies: **WebApp, Desktop (Windows/macOS/Linux) e Mobile (Android/iOS)**, partilhando a mesma UI Svelte 5, o mesmo motor ASL em Rust e diferenciando-se apenas na camada de transporte de hardware.

O **ASL (Abstract Syntax Language)** é o maior diferencial competitivo do produto e deve ser defendido, expandido e nunca substituído por soluções de terceiros.

### Decisões Estratégicas Definitivas

| **Decisão** | **Justificação** |
|---|---|
| ❌ QEMU eliminado | Comunicação directa com hardware real via Rust/serial/USB. |
| ❌ Blockly eliminado | Substituído por NeuroForge Flow Editor (SvelteFlow + nós ASL proprietários). |
| ✅ ASL como núcleo absoluto | IR universal entre todas as linguagens, plataformas e editores. |
| ✅ Tauri 2 Desktop + Mobile | Executável nativo cross-platform com hardware Rust. |
| ✅ SvelteKit + Svelte 5 | UI partilhada; Runes eliminam Zustand; SSR/PWA para WebApp. |
| ✅ SvelteFlow @xyflow/svelte 1.x | Substituto directo de @xyflow/react — API idêntica, Svelte 5 Runes. |
| ✅ Rust Embassy/HAL | Nova linguagem MCU: async/await nativo (RP2040, STM32, nRF, ESP32). |
| ✅ IEC 61131-3 ST + Ladder | Linguagens obrigatórias para suporte real a PLCs industriais. |
| ✅ NeuroForge Ladder Editor | Editor visual Ladder integrado com ASL, em Svelte + SVG. |
| ✅ tree-sitter Rust nativo + adapter | Substituição de `web-tree-sitter` por crate Rust, via adapter para evitar breaking changes. |
| ✅ TypeScript como source-of-truth na Fase 1 | Migração side-by-side, TS permanece activo até paridade 100%. |
| ✅ SQLite via Tauri para persistência | Projectos `.nfv` geridos em DB local em vez de só ficheiros JSON. |

***

## 1. Estado Actual da Branch preRust

### 1.1 Inventário Exacto dos Ficheiros a Migrar

#### Engine ASL (migração Rust obrigatória)

| **Ficheiro TypeScript** | **Destino Rust** | **LOC (aprox.)** | **Complexidade** | **Notas** |
|---|---|---|---|---|
| `src/engine/asl/ASLTypes.ts` | `asl_types.rs` + `asl_plc_types.rs` | ~600 | Alta | Tipos base ASL + PLC. |
| `src/engine/asl/ASLExecutor.ts` | `asl_executor.rs` | ~400 | Alta | Executor de simulação. |
| `src/engine/asl/transpile.ts` | `transpile.rs` | ~460 | Crítica | Orquestrador da transpilação AST→Generators. |
| `src/engine/asl/codeToASL.ts` | `code_to_asl.rs` | ~350 | Crítica | AST→ASL (pipeline de simulação). |
| `src/engine/asl/transforms/astNormalizer.ts` | `ast_normalizer.rs` | ~300 | Alta | Normalização de AST (transpilação). |
| `src/engine/asl/transforms/exprTransform.ts` | `expr_transform.rs` | ~250 | Média | |
| `src/engine/asl/transforms/blockTransform.ts` | `block_transform.rs` | ~200 | Média | |
| `src/engine/asl/transforms/callTransform.ts` | `call_transform.rs` | ~150 | Média | |
| `src/engine/asl/transforms/statementRegistry.ts` | `statement_registry.rs` | ~100 | Baixa | |
| `src/engine/asl/plugins/c/CParser.ts` | `c_parser.rs` | ~500 | Alta | |
| `src/engine/asl/plugins/c/CGenerator.ts` | `c_generator.rs` | ~450 | Alta | Consome `ProgramNode` no pipeline de transpilação. |
| `src/engine/asl/plugins/c/shims/*.ts` | `plugins/c/shims/*.rs` | ~200 total | Média | |
| `src/engine/asl/plugins/python/PythonParser.ts` | `python_parser.rs` | ~480 | Alta | |
| `src/engine/asl/plugins/python/PythonGenerator.ts` | `python_generator.rs` | ~420 | Alta | Consome `ProgramNode`. |
| `src/engine/asl/plugins/python/shims/*.ts` | `plugins/python/shims/*.rs` | ~180 total | Média | |
| `src/engine/asl/plugins/rust/RustParser.ts` | `rust_parser.rs` | ~460 | Alta | |
| `src/engine/asl/plugins/rust/RustGenerator.ts` | `rust_generator.rs` | ~440 | Alta | Consome `ProgramNode`. |
| `src/engine/asl/LanguageRegistry.ts` | `language_registry.rs` | ~160 | Média | Registo de linguagens/parsers/generators. |
| `src/engine/asl/TreeSitterLoader.ts` | `tree_sitter_adapter.rs` | ~190 | Média | Carrega grammars tree-sitter WASM. |
| `src/engine/asl/optimizer/*.ts` | `optimizer.rs` | ~300 | Média | |

#### Entradas do Funil ASL (Transição Controlada)

| **Ficheiro TypeScript** | **Destino** | **LOC (aprox.)** | **Estado** | **Desactivação** |
|---|---|---|---|---|
| `src/engine/asl/blocklyToASL.ts` | Eliminado | ~260 | Activo em preRust | Fase 2A — neutralizar antes de remover Blockly; evitar quebra de simulação. |
| `src/engine/asl/flowToASL.ts` | `flow_to_asl.rs` | ~100 | Activo em preRust | Fase 4 — migrar para Flow Editor Svelte. |

#### Serviços de Hardware (migração Tauri obrigatória)

| **Ficheiro TS** | **Destino Rust** | **LOC** | **Notas** |
|---|---|---|---|
| `server/SerialService.ts` | `transport/serial.rs` | ~300 | UART/Serial Desktop. |
| `server/CompilerService.ts` | `firmware/compiler.rs` | ~400 | Orquestra toolchains. |
| `src/services/SerialGPIOParser.ts` | `serial_gpio_parser.rs` | ~200 | Mapeia texto serial → eventos de pinos. |
| `src/engine/SimulationEngine.ts` | `simulation_engine.rs` | ~500 | Core da simulação. |

#### Frontend (migração Svelte — preservado em JS/TS)

(Os mapeamentos React→Svelte mantêm-se como na versão anterior: Terminal, SimulationModeToggle, SerialMonitor, TopToolbar, LeftSidebar, FloatingWindow, painéis de propriedades, CodeEditor/ASLViewer, 6 nós de simulação, etc.)

***

## 2. Arquitectura da Plataforma

### 2.1 Diagrama de Camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                           │
│         (UI idêntica — Svelte 5 + Tailwind CSS 4)                   │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ Desktop      │  │ WebApp          │  │ Mobile               │   │
│  │ (Tauri 2)    │  │ (SvelteKit 2)   │  │ (Tauri 2 iOS/Android)│   │
│  └──────────────┘  └─────────────────┘  └──────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│                    CAMADA DE LÓGICA (Rust → WASM)                   │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │ neuroforge-asl │  │ neuroforge-fw    │  │ neuroforge-      │    │
│  │ (IR universal) │  │ (compiler+flash) │  │ transport        │    │
│  └────────────────┘  └──────────────────┘  └──────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│                    CAMADA DE TRANSPORTE                             │
│ Desktop:  UART · USB · MODBUS RTU/TCP · Ethernet · SPI · I2C · CAN │
│ WebApp:   WebSerial · WebUSB · WebSocket bridge · REST cloud        │
│ Mobile:   Wi-Fi OTA · BLE · USB OTG (Android) · mDNS               │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 WebApp Sem Bridge — Degradação Elegante

O WebApp funciona em três modos, dependendo das capacidades disponíveis:

| **Modo** | **Requer** | **Funcionalidades** |
|---|---|---|
| ASL Mode | Apenas browser | Editor, ASL Viewer, Flow Editor, geração de código. |
| WebSerial Mode | Chrome/Edge + HTTPS | UART, serial monitor, flash básico via WebSerial API. |
| Bridge Mode | Bridge local instalada | MODBUS, Ethernet, flash avançado, PLCs industriais. |

Um módulo `capabilities.ts` detecta `navigator.serial`, `navigator.usb` e a presença da bridge através de ping a `ws://localhost:8765/ping`.

***

## 3. Estrutura de Monorepo — Visão Resumida

A estrutura de directorias segue o desenho anterior (crates/ para Rust, apps/ para frontend Desktop/Web/Mobile, docs/ e tests/), com os acréscimos de:

- `crates/neuroforge-asl/src/transpile.rs` — pipeline de transpilação AST→Generators.
- `crates/neuroforge-asl/src/parser/tree_sitter_adapter.rs` — adapter nativo/WASM.
- `crates/neuroforge-asl/src/parser/language_registry.rs` — registo de linguagens.
- `apps/desktop/src-tauri/src/db.rs` — acesso SQLite via `tauri-plugin-sql`.
- `apps/desktop/src-tauri/src/firmware/nfv_format.rs` — serialização `.nfv`.

***

## 4. Pipeline ASL — Dois Caminhos Claros

### 4.1 Pipeline A — Simulação (AST → ASL → Executor)

```
Código fonte (C++/Python/Rust/ST)
    ↓
Parser (tree-sitter via adapter) → ProgramNode (AST temporário)
    ↓
code_to_asl() transform
    ↓
AslProgram (ASL persistente — JSON)
    ↓
ASLExecutor → SimulationEngine
    ↓
Nós visuais (LEDNode, MCUNode, etc.) actualizam estado
```

Ficheiros Rust responsáveis:

- `code_to_asl.rs` (migração de `codeToASL.ts`).
- `asl_executor.rs` (migração de `ASLExecutor.ts`).
- `flow_to_asl.rs` (migração de `flowToASL.ts`) — input alternativo baseado no Flow Editor.
- Antigo `blocklyToASL.ts` é removido após neutralização segura (Fase 2A).

### 4.2 Pipeline B — Transpilação (AST normalizado → Generators)

```
Código fonte língua A (ex: C++)
    ↓
Parser (tree-sitter via adapter) → ProgramNode (AST temporário)
    ↓
ast_normalizer + expr_transform + block_transform
    ↓
ProgramNode normalizado (independente de dialect specifics)
    ↓
Generator língua B (ex: PythonGenerator) consome ProgramNode
    ↓
Código língua B gerado
```

Ficheiros Rust responsáveis:

- `transpile.rs` (migração de `transpile.ts`) — orquestrador.
- `ast_normalizer.rs`, `expr_transform.rs`, `block_transform.rs`, `call_transform.rs`.
- `c_generator.rs`, `python_generator.rs`, `rust_generator.rs` — **consomem `ProgramNode`, não `AslProgram`**.

### 4.3 Estratégia Side-by-Side

Durante a Fase 1:

- TypeScript continua a produzir `AslProgram` (para simulação) e código transpilado.
- Rust produz os mesmos outputs em paralelo.
- Testes comparam JSON TS vs JSON Rust (`assert_eq!`) para `AslProgram` e `ProgramNode` normalizado.
- Só depois de 100% de paridade é que o engine TS é desligado.

### 4.4 Versionamento do ASL

Mantém-se a abordagem SemVer: `ASL_VERSION = "3.3.0"`, com `major` indicando compatibilidade hard‑break e `minor` para adição de tipos não-breaking.

***

## 5. Plataforma Desktop — Tauri 2

Mantém o desenho já definido:

- Camada Rust com `neuroforge-asl`, `neuroforge-transport` e `neuroforge-firmware`.
- `FirmwareHub` e `FlashManager` a gerir firmwares originais/custom, compilação (arduino-cli, cargo, platformio) e flash (UART, USB, MODBUS, SWD/JTAG).
- SQLite via `tauri-plugin-sql` para persistir projectos `.nfv`, cache de firmware e histórico de ligações.
- ErrorRecoveryStrategy a lidar com erros de flash (`Permission denied`, `Port in use`, `Bootloader not found`, etc.).

***

## 6. Plataforma WebApp — SvelteKit + Bridge

- WebApp zero-install, SvelteKit, a consumir componentes de `apps/shared`.
- Modos ASL-only, WebSerial e Bridge, com deteção automática de capacidades e UX clara.
- Bridge local (`neuroforge-bridge`) com token + QR code para autenticação e whitelisting de origem (`https://neuroforge.io`).

***

## 7. Plataforma Mobile — Tauri Mobile

- Android/iOS com foco em Wi-Fi OTA e BLE.
- Para non‑ESP32, uso de agente OTA baseado em Rust/Embassy, instalado no primeiro flash via Desktop e depois actualizado via HTTP pelo Mobile.

***

## 8. NeuroForge Flow Editor — Substituto do Blockly

- Canvas em `@xyflow/svelte`.
- Nós ASL organizados por categoria (fluxo, hardware MCU, PLC).
- Formato `.nfv` como serialização canónica.
- Conversor `flow_to_asl.rs` traduz grafo visual (`NfvFile`) para `AslProgram`, que segue para simulação/compilação.

***

## 9. NeuroForge Ladder Editor — IEC 61131-3

- Editor Ladder em SVG: contactos, bobinas, temporizadores, contadores, ramos paralelos.
- `AslPlcProgram` como representação interna.
- Exportação para ST e Ladder XML (CODESYS, TwinCAT) e execução em PLCs via MODBUS, S7, Ethernet/IP.

***

## 10. Rust Embassy — Nova Linguagem MCU

- Plugin `rust_embassy` gera código Embassy a partir de `AslProgram`.
- Suporte inicial: RP2040, STM32F4/H7, nRF52840, ESP32-S3.

***

## 11. Protocolo de Adição de Nova Linguagem

- Checklists de 10 passos para linguagens MCU e PLC.
- Explicitação de em que pipeline a linguagem entra: simulação (via ASL) e/ou transpilação (via AST).

***

## 12. Estratégia de CI/CD e Testes

- Testes unitários, roundtrip, paridade semântica e side-by-side entre TS/Rust.
- Testes de integração com mocks (virtual serial port, fake MODBUS server).
- Hardware‑in‑the‑loop para placas reais (Arduino, ESP32, RP2040, PLCs).
- Métricas de "time-to-hello-world" (WASM load time, primeiro parse ASL, startup Desktop).

***

## 13. Fases de Migração — v3.3

### Fase 0 — Preparação + Inventário (2-3 semanas)

- Criar monorepo completo.
- Configurar workspaces Rust/PNPM.
- Instalar `shadcn-svelte` em `apps/shared`.
- Gerar inventário real de `src/engine/asl/` (já reflectido acima).
- Migrar código React comum para `apps/shared`.
- Remover código legacy (`server/`, `blockly/`, QEMU) guardando apenas o necessário em `tests/fixtures` e `poc/`.

### Fase 1 — Motor ASL em Rust + Side-by-Side (4-6 semanas)

- Implementar `tree_sitter_adapter.rs` (nativo/WASM).
- Migrar tipos ASL (`ASLTypes.ts`).
- Migrar `codeToASL.ts` → `code_to_asl.rs` (simulação).
- Migrar `astNormalizer.ts` + transforms.
- Criar `transpile.rs` (migração de `transpile.ts`) como orquestrador da transpilação.
- Migrar parsers/generators C/Python/Rust, com testes side-by-side (TS vs Rust).
- Migrar `ASLExecutor.ts` → `asl_executor.rs`.
- Build WASM.
- Testar coexistência de `TreeSitterLoader.ts` e `tree_sitter_adapter.rs` (evitar duplo-registo no `LanguageRegistry`).

**Saída:** engine Rust pronto, TS ainda ligado como fallback, mas com 100% de paridade nos testes.

### Fase 2 — Desktop Tauri + Svelte 5 (6-8 semanas)

- Setup Tauri, SQLite e stores Svelte.
- Neutralizar `blocklyToASL.ts` com feature flag, garantindo que `ASLExecutor` já não depende de Blockly.
- Remover editor Blockly e QEMU após simulação estar funcional com código textual e Flow.
- Migrar layout, painéis, editores.
- Migrar Canvas de Simulação (6 nós) com SPIKE dedicado.
- Remover React/Zustand/Blockly do runtime após estabilidade.

### Fase 3 — Embassy + ST (4-6 semanas)

- Plugin Embassy, parser/generator ST, MODBUS, probe-rs.

### Fase 4 — WebApp + Ladder + Flow (4-5 semanas)

- WebApp SvelteKit, Ladder Editor, Flow Editor.
- `flow_to_asl.rs` substitui completamente `flowToASL.ts`.
- Bridge local funcional e segura.

### Fase 5 — Mobile (3-4 semanas)

- Tauri Mobile, Wi-Fi OTA, BLE, mDNS, USB OTG (Android).

### Fase 6 — PLCs Avançados + Ecossistema

- S7, EtherNet/IP, OPC-UA, FBD Editor, CLI, SDK, marketplace.

***

## 14. Métricas de Sucesso

Mesmas métricas de v2, com a adição explícita de:

- Transpilação C↔Python↔Rust validada via `transpile.rs`.
- Pipelines de simulação e transpilação explicitamente cobertos em CI.
