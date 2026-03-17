Que review excelente — vou integrar **todos os pontos** diretamente no documento. Aqui está o v3.2 completo:

***

# NEUROFORGE

## Plano de Migração e Evolução da Plataforma

**WebApp · Desktop · Mobile · PLCs**

**Versão 3.2** · Branch: preRust · 17 de Março de 2026 · Autor: Caio Jordão Barradas

***

## Glossário de Termos

> Este glossário existe para que novos colaboradores possam ler o documento sem ambiguidades.

| **Termo** | **Definição** |
|---|---|
| **ASL** | *Abstract Syntax Language* — Representação Intermédia (IR) universal do NeuroForge. Formato JSON que captura a semântica completa de um programa embarcado de forma independente de linguagem. |
| **IR** | *Intermediate Representation* — Formato intermédio entre a entrada (código fonte) e a saída (código gerado). O ASL é o IR do NeuroForge. |
| **AST** | *Abstract Syntax Tree* — Árvore de sintaxe produzida pelo parser (tree-sitter). **Temporária**: existe apenas durante a conversão de código fonte para ASL. Não deve ser confundida com ASL. |
| **ProgramNode** | Raiz da AST produzida pelos parsers tree-sitter. Estrutura temporária consumida por `code_to_asl()`. |
| **AslProgram** | Raiz do ASL — estrutura JSON persistente que representa o programa de forma semântica e independente de linguagem. |
| **Shim** | Camada de compatibilidade que mapeia funções de biblioteca hardware (ex: `digitalWrite`, `analogRead`) para operações ASL. Cada linguagem tem os seus próprios shims. |
| **Generator** | Módulo Rust que converte um `AslProgram` para código fonte numa linguagem específica (C++, Python, Rust, ST, etc.). |
| **Parser** | Módulo Rust que converte código fonte (via tree-sitter AST) para `AslProgram`. |
| **Roundtrip** | Teste que verifica `código → ASL → código → ASL` produz resultados semanticamente equivalentes. |
| **Paridade Semântica** | Garantia de que uma operação de hardware (ex: `DigitalWrite`) é suportada com o mesmo significado em **todas** as linguagens. |
| **FirmwareHub** | Módulo que gere firmwares originais (pré-compilados) e custom (gerados pelo utilizador). |
| **FlashManager** | Orquestra o processo de upload de firmware para a placa física, seleccionando o protocolo correcto (UART, USB, MODBUS, etc.). |
| **TransportAdapter** | Trait Rust que abstrai um protocolo de comunicação físico. Cada protocolo (UART, MODBUS, Ethernet) implementa este trait. |
| **Bridge Local** | Executável Rust standalone (~2MB) que expõe hardware físico ao WebApp via WebSocket local autenticado. |
| **OTA** | *Over-The-Air* — Upload de firmware via rede Wi-Fi sem necessidade de cabo. |
| **SWD/JTAG** | Protocolos de debug e flash para microcontroladores ARM (STM32, nRF, RP2040). Requer probe-rs ou ST-Link. |
| **IEC 61131-3** | Norma internacional de linguagens de programação para PLCs. Define ST, Ladder, FBD, IL, SFC. |
| **Embassy** | Framework Rust async/await para sistemas embarcados sem OS. Alternativa moderna ao HAL bare-metal. |
| **Scan Cycle** | Ciclo de execução de um PLC: lê entradas → executa programa → escreve saídas. Diferente do modelo imperativo normal. |
| **NFV** | *NeuroForge Visual* — Formato de ficheiro `.nfv` que serializa programas criados no Flow Editor/Ladder Editor. |
| **.nfv** | Ficheiro JSON versionado que representa um programa visual NeuroForge (nós, arestas, placa alvo, versão ASL). |
| **Monorepo** | Repositório único com múltiplos pacotes/aplicações (`apps/`, `crates/`). Facilita partilha de código entre Desktop, WebApp e Mobile. |
| **Tauri** | Framework Rust para criar aplicações Desktop e Mobile nativas com frontend web (Svelte, React, etc.). |
| **SvelteFlow** | `@xyflow/svelte` — Porto Svelte 5 do ReactFlow. Canvas de nós interactivo usado no Flow Editor e Canvas de Simulação. |

***

## Sumário Executivo

Este documento é o plano definitivo de evolução do NeuroForge desde a branch preRust (React 19 + Vite + Node.js) para uma plataforma unificada de três superfícies: **WebApp, Desktop (Windows/macOS/Linux) e Mobile (Android/iOS)**, partilhando a mesma UI Svelte 5, o mesmo motor ASL em Rust e diferenciando-se apenas na camada de transporte de hardware.

O **ASL (Abstract Syntax Language)** é o maior diferencial competitivo do produto e deve ser defendido, expandido e nunca substituído por soluções de terceiros.

### Decisões Estratégicas Definitivas

| **Decisão** | **Justificação** |
|---|---|
| ❌ QEMU eliminado | Comunicação directa com hardware real via Rust/serial/USB |
| ❌ Blockly eliminado | Substituído por NeuroForge Flow Editor (SvelteFlow + nós ASL proprietários) |
| ✅ ASL como núcleo absoluto | IR universal entre todas as linguagens, plataformas e editores |
| ✅ Tauri 2 Desktop + Mobile | Executável nativo cross-platform com hardware Rust |
| ✅ SvelteKit + Svelte 5 | UI partilhada; Runes eliminam Zustand; SSR/PWA para WebApp |
| ✅ SvelteFlow @xyflow/svelte 1.x | Substituto directo de @xyflow/react — API idêntica, Svelte 5 Runes |
| ✅ Rust Embassy/HAL | Nova linguagem MCU: async/await nativo (RP2040, STM32, nRF, ESP32) |
| ✅ IEC 61131-3 ST + Ladder | Linguagens obrigatórias para suporte real a PLCs industriais |
| ✅ NeuroForge Ladder Editor | Editor visual Ladder integrado com ASL, em Svelte + SVG |
| ✅ tree-sitter Rust nativo | Substituição do web-tree-sitter WASM via adapter layer |
| ✅ TypeScript como source-of-truth na Fase 1 | Migração side-by-side, TS permanece activo até paridade 100% |
| ✅ SQLite via Tauri para persistência | Projectos `.nfv` geridos em DB local em vez de JSON isolado |

***

## 1. Estado Actual da Branch preRust

### 1.1 Inventário Exacto dos Ficheiros a Migrar

> **Resposta à questão: "Como sabemos o que migrar?"** — Este inventário mapeia cada ficheiro TypeScript para o seu equivalente Rust, com estimativa de linhas e complexidade.

#### Engine ASL (migração Rust obrigatória)

| **Ficheiro TypeScript** | **Destino Rust** | **LOC (aprox.)** | **Complexidade** |
|---|---|---|---|
| `src/engine/asl/ASLTypes.ts` | `asl_types.rs` + `asl_plc_types.rs` | ~600 | Alta |
| `src/engine/asl/ASLExecutor.ts` | `asl_executor.rs` | ~400 | Alta |
| `src/engine/asl/transforms/astNormalizer.ts` | `ast_normalizer.rs` | ~300 | Alta |
| `src/engine/asl/transforms/exprTransform.ts` | `expr_transform.rs` | ~250 | Média |
| `src/engine/asl/transforms/blockTransform.ts` | `block_transform.rs` | ~200 | Média |
| `src/engine/asl/transforms/callTransform.ts` | `call_transform.rs` | ~150 | Média |
| `src/engine/asl/transforms/statementRegistry.ts` | `statement_registry.rs` | ~100 | Baixa |
| `src/engine/asl/codeToASL.ts` | `code_to_asl.rs` | ~350 | Crítica |
| `src/engine/asl/plugins/c/CParser.ts` | `c_parser.rs` | ~500 | Alta |
| `src/engine/asl/plugins/c/CGenerator.ts` | `c_generator.rs` | ~450 | Alta |
| `src/engine/asl/plugins/c/shims/*.ts` | `plugins/c/shims/*.rs` | ~200 total | Média |
| `src/engine/asl/plugins/python/PythonParser.ts` | `python_parser.rs` | ~480 | Alta |
| `src/engine/asl/plugins/python/PythonGenerator.ts` | `python_generator.rs` | ~420 | Alta |
| `src/engine/asl/plugins/python/shims/*.ts` | `plugins/python/shims/*.rs` | ~180 total | Média |
| `src/engine/asl/plugins/rust/RustParser.ts` | `rust_parser.rs` | ~460 | Alta |
| `src/engine/asl/plugins/rust/RustGenerator.ts` | `rust_generator.rs` | ~440 | Alta |
| `src/engine/asl/optimizer/*.ts` | `optimizer.rs` | ~300 | Média |
| **TOTAL** | | **~5.580 LOC** | |

#### Serviços de Hardware (migração Tauri obrigatória)

| **Ficheiro TypeScript** | **Destino Rust** | **LOC (aprox.)** |
|---|---|---|
| `server/SerialService.ts` | `transport/serial.rs` | ~300 |
| `server/CompilerService.ts` | `firmware/compiler.rs` | ~400 |
| `src/services/SerialGPIOParser.ts` | `serial_gpio_parser.rs` | ~200 |
| `src/engine/SimulationEngine.ts` | `simulation_engine.rs` | ~500 |

#### Frontend (migração Svelte — preservado em JS/TS)

| **Componente React** | **Svelte 5** | **Fase** |
|---|---|---|
| `Terminal.tsx` | `Terminal.svelte` | 2A |
| `SimulationModeToggle.tsx` | `SimulationModeToggle.svelte` | 2A |
| `SerialMonitor.tsx` | `SerialMonitor.svelte` | 2A |
| `SerialTerminalPanel.tsx` | `SerialTerminalPanel.svelte` | 2A |
| `BlocklyEditor.tsx` | ❌ ELIMINADO | 2A |
| `TopToolbar.tsx` | `TopToolbar.svelte` | 2B |
| `LeftSidebar.tsx` | `LeftSidebar.svelte` | 2B |
| `FloatingWindow.tsx` | `FloatingWindow.svelte` | 2B |
| `LEDPropertiesPanel.tsx` | `LEDPropertiesPanel.svelte` | 2C |
| `MCUPropertiesPanel.tsx` | `MCUPropertiesPanel.svelte` | 2C |
| `(+5 painéis)` | `(+5 painéis .svelte)` | 2C |
| `ASLViewer.tsx` | `ASLViewer.svelte` | 2D |
| `CodeEditor.tsx` | `CodeEditor.svelte` | 2D |
| `CodeEditorWithTabs.tsx` | `CodeEditorWithTabs.svelte` | 2D |
| `LEDNode.tsx` | `LEDNode.svelte` | 2E |
| `MCUNode.tsx` | `MCUNode.svelte` | 2E |
| `ButtonNode.tsx` | `ButtonNode.svelte` | 2E |
| `ServoNode.tsx` | `ServoNode.svelte` | 2E |
| `RGBLEDNode.tsx` | `RGBLEDNode.svelte` | 2E |
| `PotentiometerNode.tsx` | `PotentiometerNode.svelte` | 2E |
| `FlowEditor.tsx` (41 KB) | `SimulationCanvas.svelte` | 2E |

#### Stores (migração Svelte Runes)

| **Store Zustand** | **Svelte 5 Runes** | **Fase** |
|---|---|---|
| `useSerialStore.ts` | `serial.svelte.ts` | 2A |
| `useLibraryStore.ts` | `library.svelte.ts` | 2A |
| `useConnectionStore.ts` | `connection.svelte.ts` | 2A |
| `useQEMUStore.ts` | ❌ ELIMINADO | 2A |
| `useFileStore.ts` | `files.svelte.ts` | 2B |
| `useUIStore.ts` | `ui.svelte.ts` | 2B |
| `useSimulationStore.ts` ⚠️ | `simulation.svelte.ts` (**SPIKE**) | 2E |

#### O Que É Eliminado (sem migração)

| **Ficheiro/Módulo** | **Razão** |
|---|---|
| `server/` completo (Node.js) | Lógica de hardware migra para Rust (Tauri) |
| `QEMUApiClient.ts`, `QEMUWebSocket.ts` | QEMU eliminado |
| `useQEMUStore.ts` | QEMU eliminado |
| `QEMURunner.ts`, `QEMUSimulationEngine.ts` | QEMU eliminado |
| `src/engine/blockly/` (todo) | Substituído por NeuroForge Flow Editor |
| `BlocklyEditor.tsx` | Blockly eliminado |
| `socket.io-client` | Substituído por invoke/listen Tauri |
| `web-tree-sitter` WASM | Substituído por adapter layer sobre crate Rust |

### 1.2 Motor de Simulação Actual — Padrão a Preservar

O `SimulationEngine.ts` usa um EventEmitter interno que comunica alterações de pinos para os nós visuais. Este padrão **DEVE ser preservado** — apenas a camada de framework muda:

```
SimulationEngine (EventEmitter)
    ↓ emit('pinChange', { pin, state })
    ↓ emit('serialData', { data })
    ↓ emit('analogChange', { pin, value })
    ↓
LEDNode / ServoNode / MCUNode
    subscrevem via useEffect (React) → $effect / $derived (Svelte 5)
    → actualizam estado visual $state
```

***

## 2. Arquitectura da Plataforma

### 2.1 Diagrama de Camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APRESENTAÇÃO                            │
│         (UI idêntica — Svelte 5 + Tailwind CSS 4)                    │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐    │
│  │ Desktop      │  │ WebApp          │  │ Mobile               │    │
│  │ (Tauri 2)    │  │ (SvelteKit 2)   │  │ (Tauri 2 iOS/Android)│    │
│  └──────────────┘  └─────────────────┘  └──────────────────────┘    │
├──────────────────────────────────────────────────────────────────────┤
│                    CAMADA DE LÓGICA (Rust → WASM)                    │
│  ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐     │
│  │ neuroforge-asl │  │ neuroforge-fw    │  │ neuroforge-      │     │
│  │ (IR universal) │  │ (compiler+flash) │  │ transport        │     │
│  └────────────────┘  └──────────────────┘  └──────────────────┘     │
├──────────────────────────────────────────────────────────────────────┤
│                    CAMADA DE TRANSPORTE                              │
│ Desktop:  UART · USB · MODBUS RTU/TCP · Ethernet · SPI · I2C · CAN  │
│ WebApp:   WebSerial · WebUSB · WebSocket bridge · REST cloud         │
│ Mobile:   Wi-Fi OTA · BLE · USB OTG (Android) · mDNS                │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 WebApp Sem Bridge — Degradação Elegante

> **Resposta à questão: "O que acontece se o utilizador não quiser instalar a bridge?"**

O WebApp funciona em **dois modos**:

| **Modo** | **Disponível sem bridge** | **Funcionalidade** |
|---|---|---|
| **ASL Mode** | ✅ | Editor de código completo, ASL Viewer, Flow Editor, geração de código, compilação cloud |
| **WebSerial Mode** | ✅ Chrome/Edge | UART directo, serial monitor, flash básico via WebSerial API |
| **Bridge Mode** | ❌ Requer bridge | MODBUS, Ethernet, flash completo, PLCs industriais |

A UI indica claramente qual modo está activo e oferece instalação da bridge quando o utilizador tenta usar funcionalidades que a requerem.

```
// wasm-loader.ts — Detecção automática
export async function detectCapabilities() {
    return {
        hasWebSerial: 'serial' in navigator,
        hasWebUSB: 'usb' in navigator,
        hasBridge: await pingBridge(),  // ws://localhost:8765/ping
        isDesktop: '__TAURI__' in window,
    };
}
```

***

## 3. Estrutura de Monorepo — Configuração Completa

### 3.1 Estrutura de Directórios

```
neuroforge/
├── Cargo.toml                          # Workspace raiz Rust
├── Cargo.lock
├── pnpm-workspace.yaml
├── package.json
│
├── crates/
│   ├── neuroforge-asl/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types/
│   │       │   ├── asl_types.rs
│   │       │   ├── asl_plc_types.rs
│   │       │   ├── asl_transport_types.rs
│   │       │   └── asl_version.rs
│   │       ├── executor/
│   │       │   └── asl_executor.rs
│   │       ├── parser/
│   │       │   ├── tree_sitter_adapter.rs   # Adapter layer TS ↔ native
│   │       │   ├── language_registry.rs
│   │       │   └── code_to_asl.rs           # AST → ASL (CRÍTICO)
│   │       ├── transforms/
│   │       │   ├── ast_normalizer.rs
│   │       │   ├── expr_transform.rs
│   │       │   ├── block_transform.rs
│   │       │   ├── call_transform.rs
│   │       │   └── statement_registry.rs
│   │       ├── plugins/
│   │       │   ├── c/
│   │       │   ├── python/
│   │       │   ├── rust_std/
│   │       │   ├── rust_embassy/
│   │       │   └── plc/
│   │       └── optimizer/
│   │
│   ├── neuroforge-transport/
│   │   └── src/
│   │       ├── transport_adapter.rs
│   │       ├── serial.rs
│   │       ├── usb.rs
│   │       ├── modbus.rs
│   │       ├── ethernet.rs
│   │       ├── wifi_ota.rs
│   │       ├── ble.rs
│   │       └── error_recovery.rs
│   │
│   └── neuroforge-firmware/
│       └── src/
│           ├── compiler.rs
│           ├── flash_manager.rs
│           ├── board_profiles.rs
│           ├── firmware_hub.rs
│           └── nfv_format.rs
│
├── apps/
│   ├── desktop/
│   │   ├── package.json
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       └── src/
│   │           ├── main.rs
│   │           ├── db.rs              # SQLite via tauri-plugin-sql
│   │           ├── transport/
│   │           ├── firmware/
│   │           └── state.rs
│   │
│   ├── webapp/
│   │   ├── package.json
│   │   └── src/
│   │       └── routes/
│   │
│   ├── mobile/
│   │   ├── package.json
│   │   └── src-tauri/
│   │       └── src/
│   │           ├── ios/
│   │           └── android/
│   │
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── components/
│           │   ├── terminal/
│           │   ├── editors/
│           │   ├── panels/
│           │   ├── flow-editor/
│           │   └── ladder-editor/
│           ├── stores/
│           │   ├── serial.svelte.ts
│           │   ├── files.svelte.ts
│           │   ├── ui.svelte.ts
│           │   ├── simulation.svelte.ts
│           │   └── connection.svelte.ts
│           └── lib/
│               ├── wasm-loader.ts
│               ├── capabilities.ts    # Detecção de capacidades por plataforma
│               └── types.ts
│
├── docs/
│   ├── languages/
│   └── protocols/
│
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
│
└── .github/
    └── workflows/
```

### 3.2 Cargo.toml Raiz (Workspace)

```toml
[workspace]
members = [
    "crates/neuroforge-asl",
    "crates/neuroforge-transport",
    "crates/neuroforge-firmware",
    "apps/desktop/src-tauri",
    "apps/mobile/src-tauri",
]
resolver = "2"

[workspace.package]
version = "3.2.0"
edition = "2021"
authors = ["Caio Jordão Barradas <caio@neuroforge.dev>"]
license = "MIT OR Apache-2.0"

[workspace.dependencies]
serde         = { version = "1", features = ["derive"] }
serde_json    = "1"
tokio         = { version = "1", features = ["rt", "time", "sync", "macros"] }
thiserror     = "1"
tracing       = "0.1"
tracing-subscriber = "0.3"

[profile.release]
opt-level = 3
lto       = true
strip     = true

[profile.wasm-release]
inherits  = "release"
opt-level = "z"   # Optimizar tamanho para WASM
```

### 3.3 pnpm-workspace.yaml

```yaml
packages:
  - "apps/shared"
  - "apps/desktop"
  - "apps/webapp"
  - "apps/mobile"

pnpm:
  overrides:
    "@xyflow/svelte": "1.x"
    "svelte": "^5.0.0"
    "tailwindcss": "^4.0.0"
```

### 3.4 Dependências Svelte Partilhadas (apps/shared/package.json)

```json
{
  "name": "@neuroforge/shared",
  "version": "3.2.0",
  "dependencies": {
    "@xyflow/svelte": "^1.0.0",
    "@monaco-editor/loader": "^1.4.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "bits-ui": "^1.0.0",
    "shadcn-svelte": "latest",
    "zod": "^3.0.0",
    "sveltekit-superforms": "latest"
  }
}
```

> **Nota:** `shadcn-svelte` é instalado em **Fase 2A** como parte do setup inicial de UI. Inicializar com `npx shadcn-svelte@latest init` dentro de `apps/shared/`.

***

## 4. Motor ASL — Migração TypeScript → Rust (Estratégia Side-by-Side)

### 4.1 Estratégia de Migração — TypeScript como Source-of-Truth

> **Risco reconhecido:** Migrar o motor inteiro mantendo paridade 100% é extremamente difícil. A estratégia adoptada é **side-by-side**: TypeScript permanece como *source of truth* activo até que o equivalente Rust passe 100% dos testes.

```
FASE 1 — ESTADO INTERMÉDIO (temporário):

TypeScript ASL Engine (activo)       Rust ASL Engine (em desenvolvimento)
         │                                        │
         │  ← Testes side-by-side comparativos →  │
         │                                        │
  Produz AslProgram (JSON)            Produz AslProgram (JSON)
         │                                        │
         └──────── assert_eq!(ts_output, rs_output) ──────┘

Apenas quando assert_eq passa em 100% dos testes:
  → TypeScript é removido
  → Rust assume como source of truth
```

**Implementação:**

```rust
#[cfg(test)]
mod side_by_side_tests {
    use std::process::Command;
    
    #[test]
    fn test_c_parser_parity_with_typescript() {
        let source = include_str!("fixtures/blink.c");
        
        // Saída do TypeScript (executar via Node.js em testes)
        let ts_output = run_typescript_asl(source, "c");
        
        // Saída do Rust
        let rs_output = c_parser().parse(source).unwrap();
        let rs_json = serde_json::to_string(&rs_output).unwrap();
        
        assert_asl_equivalent(&ts_output, &rs_json);
    }
    
    fn assert_asl_equivalent(ts: &str, rs: &str) {
        let ts_asl: serde_json::Value = serde_json::from_str(ts).unwrap();
        let rs_asl: serde_json::Value = serde_json::from_str(rs).unwrap();
        
        // Comparação semântica (ignora ordem de campos, whitespace)
        assert_eq!(ts_asl, rs_asl,
            "Paridade falhou!\n  TS: {}\n  RS: {}", ts, rs);
    }
}
```

### 4.2 Adapter Layer — tree-sitter (Web vs Native)

> **Risco reconhecido:** Substituir `web-tree-sitter` por crate Rust pode ter breaking changes na API. A solução é um **adapter layer** que abstrai a origem.

```rust
// tree_sitter_adapter.rs — Abstrai a origem do parser

pub trait TreeSitterParser: Send + Sync {
    fn parse(&self, source: &str, language: &str) -> Result<ProgramNode, ParseError>;
    fn language_id(&self) -> &'static str;
}

// Implementação nativa (Desktop, tests)
pub struct NativeTreeSitterParser {
    language: tree_sitter::Language,
    language_id: &'static str,
}

impl TreeSitterParser for NativeTreeSitterParser {
    fn parse(&self, source: &str, _lang: &str) -> Result<ProgramNode, ParseError> {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&self.language)?;
        let tree = parser.parse(source, None)
            .ok_or(ParseError::ParseFailed)?;
        Ok(ast_builder::build_program_node(&tree, source))
    }
    
    fn language_id(&self) -> &'static str {
        self.language_id
    }
}

// Implementação WASM (WebApp — fallback)
#[cfg(target_arch = "wasm32")]
pub struct WasmTreeSitterParser { ... }

// Factory
pub fn create_parser(language: &str) -> Box<dyn TreeSitterParser> {
    #[cfg(not(target_arch = "wasm32"))]
    return Box::new(NativeTreeSitterParser::new(language));
    
    #[cfg(target_arch = "wasm32")]
    return Box::new(WasmTreeSitterParser::new(language));
}
```

### 4.3 The Golden Rule

**"Todas as linguagens devem andar de mãos dadas"** — qualquer nova feature de hardware adicionada a uma linguagem deve ter **paridade semântica em todas as outras**.

**Mecanismo de Enforcement em CI:**

```yaml
# .github/workflows/test-asl.yml
- name: Test Semantic Parity (ALL languages)
  run: cargo test parity -- --test-threads=1
  # Falha se qualquer linguagem não suportar uma operação nova
```

```rust
// Teste de paridade obrigatório antes de qualquer merge
#[test]
fn test_digital_write_parity_all_langs() {
    let asl = fixtures::create_digital_write_program();
    
    for generator in registry.all_generators() {
        let result = generator.generate(&asl, &GeneratorContext::default());
        assert!(result.is_ok(),
            "Generator '{}' falhou paridade para DigitalWrite: {:?}",
            generator.language_id(), result.err());
    }
}
```

### 4.4 Distinção Crítica: AST Temporário vs ASL Persistente

```
Source Code (C++/Python/Rust/ST)
    ↓
Parser (tree-sitter via adapter)
    ↓
ProgramNode — AST (TEMPORÁRIO — consumido imediatamente)
    ↓
code_to_asl() — Transform semântico
    ↓
AslProgram — ASL (PERSISTENTE — consumido por Executor e Generators)
    ↓
Executor (simulação)    ou    Generator (código para placa)
```

**`code_to_asl.rs`** é o coração da pipeline. Implementa as transformações semânticas:

```rust
pub struct AstToAslTransformer {
    language_id: String,
    type_resolver: TypeResolver,
    symbol_table: SymbolTable,
}

impl AstToAslTransformer {
    pub fn transform(&mut self, ast: &ProgramNode) -> Result<AslProgram, AslError> {
        self.type_resolver.resolve_all(ast)?;
        self.build_symbol_table(ast)?;
        
        let statements = ast.statements.iter()
            .map(|stmt| self.transform_statement(stmt))
            .collect::<Result<Vec<_>, _>>()?;
        
        Ok(AslProgram {
            version: ASL_VERSION.to_string(),
            globals: self.extract_globals(ast)?,
            functions: self.extract_functions(ast)?,
            tasks: vec![AslTask {
                name: "main".to_string(),
                statements,
            }],
        })
    }
}
```

### 4.5 Versionamento Semântico do ASL

```rust
pub const ASL_VERSION: &str = "3.2.0";

impl AslVersion {
    pub fn is_compatible_with(&self, other: &AslVersion) -> bool {
        self.major == other.major  // Major mismatch = incompatível
    }
    pub fn needs_migration(&self, target: &AslVersion) -> bool {
        self != target && self.is_compatible_with(target)
    }
}
```

**Política:**
- **Minor version:** novos tipos ASL adicionados (compatível para trás)
- **Major version:** breaking changes (requer migração de ficheiros `.nfv`)

### 4.6 Roadmap de Linguagens

#### MCUs

| **Linguagem** | **Estado** | **Fase** |
|---|---|---|
| C/C++ Arduino | ✅ TS — migrar para Rust | 1 |
| MicroPython | ✅ TS — migrar para Rust | 1 |
| Rust no_std / embedded-hal | ✅ TS — migrar para Rust | 1 |
| Rust Embassy (async) | ❌ Novo | 3 |
| CircuitPython | ❌ Novo | 4 |

#### PLCs (IEC 61131-3)

| **Linguagem** | **Estado** | **Fase** |
|---|---|---|
| Structured Text (ST) | ❌ Tipos IEC iniciados | 3 |
| Ladder Diagram (LD) | ❌ Novo | 4 |
| Function Block Diagram (FBD) | ❌ Novo | 5 |
| Instruction List (IL) | ❌ Novo | 5 |
| Sequential Function Chart (SFC) | ❌ Novo | 6 |

### 4.7 Semântica do Scan Cycle PLC no ASL

> **Questão: Como se resolve a semântica de "scan cycle" do PLC para o modelo imperativo do ASL?**

O PLC executa em ciclos contínuos: lê entradas → executa lógica → escreve saídas. O ASL usa um modelo imperativo. A reconciliação é feita por uma **task especial de scan**:

```
PLC Scan Cycle:
┌─────────────────────────────────┐
│ 1. Read Inputs (I/O Image)      │
│ 2. Execute Ladder/ST            │
│ 3. Write Outputs (I/O Image)    │
└─────────────────────────────────┘
          ↓ Mapeia para ASL como:

AslTask {
    name: "plc_scan",
    cycle_mode: CycleMode::Continuous { scan_time_ms: 10 },
    statements: [
        AslPlcReadInputs { image: "input_image" },
        // ... lógica Ladder/ST
        AslPlcWriteOutputs { image: "output_image" },
    ]
}
```

```rust
pub enum CycleMode {
    /// MCU: loop { } sem tempo fixo
    Continuous,
    /// PLC: ciclo de scan com tempo fixo (ex: 10ms)
    ContinuousWithScanTime { scan_time_ms: u32 },
    /// Evento único (setup())
    Once,
}
```

O gerador ST produz código PLC que respeita o modelo de scan; o gerador Embassy usa `Timer::after()` para simular scan time.

***

## 5. Plataforma Desktop — Tauri 2

### 5.1 Capacidades Exclusivas Desktop

- **UART/Serial** — `/dev/ttyUSB0`, `COM3`, etc.
- **USB** — flash via `dfu-util`, `avrdude`, `esptool`, `picotool`
- **MODBUS RTU/TCP** — PLCs industriais
- **Ethernet** — programação de PLCs via TCP/IP
- **SPI/I2C** — via adaptadores USB (FTDI, CH341)
- **CAN Bus** — via adaptadores USB-CAN
- **JTAG/SWD** — debug e flash via probe-rs

### 5.2 Persistência com SQLite

> **Sugestão incorporada:** Projectos `.nfv` geridos em SQLite local em vez de JSON isolado.

```rust
// db.rs — tauri-plugin-sql com SQLite
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_projects",
            sql: "
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    nfv_json TEXT NOT NULL,
                    target_board_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    modified_at TEXT NOT NULL,
                    tags TEXT DEFAULT '[]'
                );
                CREATE TABLE IF NOT EXISTS firmware_cache (
                    id TEXT PRIMARY KEY,
                    project_id TEXT REFERENCES projects(id),
                    board_id TEXT NOT NULL,
                    binary BLOB NOT NULL,
                    compiled_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS board_connections (
                    id TEXT PRIMARY KEY,
                    board_id TEXT NOT NULL,
                    protocol TEXT NOT NULL,
                    port TEXT,
                    ip TEXT,
                    last_connected TEXT
                );
            ",
            kind: MigrationKind::Up,
        },
    ]
}
```

**Benefícios:**
- Pesquisa de projectos por nome/tag
- Cache de firmwares compilados (evita recompilação)
- Histórico de ligações físicas por placa
- Suporte a múltiplos projectos sem gestão manual de ficheiros

### 5.3 Tratamento de Erros de Flash e UX de Recovery

| **Erro** | **Diagnóstico Automático** | **Sugestão UX** |
|---|---|---|
| Port not found | Listar ports disponíveis | "Conectar placa ao USB e aguardar 3s" |
| Permission denied | `id -nG \| grep dialout` | "Executar: sudo usermod -aG dialout $USER" |
| Port in use | `lsof /dev/ttyUSB0` | "Fechar: [lista de processos]" |
| Bootloader not found | Auto-detect VID/PID | "Premir botão BOOT e reconectar" |
| Timeout | Auto-detect baud rate | "Detector testou N baud rates" |
| Firmware corrupted | Verificar CRC | "Tentar novamente com cabo diferente" |

```rust
pub struct ErrorRecoveryStrategy {
    pub error_type: FlashErrorType,
    pub diagnostics: Vec<DiagnosticStep>,
    pub recovery_actions: Vec<RecoveryAction>,
    pub user_message: String,
    pub can_auto_recover: bool,
}

#[tauri::command]
pub async fn flash_firmware_with_recovery(
    board: BoardProfile,
    firmware: Vec<u8>,
    protocol: FlashProtocol,
) -> Result<FlashResult, FlashError> {
    let mut attempts = 0;
    let max_attempts = 3;
    
    loop {
        attempts += 1;
        match flash_firmware(&board, &firmware, &protocol).await {
            Ok(result) => return Ok(result),
            Err(err) => {
                let strategy = ErrorRecoveryStrategy::from_error(&err);
                emit_recovery_suggestion(&strategy).await;
                
                if strategy.can_auto_recover && attempts < max_attempts {
                    strategy.apply_auto_recovery().await?;
                    continue;
                }
                return Err(err);
            }
        }
    }
}
```

### 5.4 Suporte a PLCs — Protocolos Industriais

| **Protocolo** | **Crate Rust** | **Plataformas** | **Fase** |
|---|---|---|---|
| MODBUS RTU | `tokio-modbus` | Desktop/Mobile TCP | 2 |
| MODBUS TCP | `tokio-modbus` | Todas | 2 |
| Ethernet/IP | `eip-rs` | Desktop/Mobile TCP | 3 |
| S7 Protocol | `s7-rs` | Desktop/Mobile TCP | 3 |
| OPC-UA | `open62541-rs` | Desktop | 4 |
| PROFIBUS | via USB adapter | Desktop | 4 |

***

## 6. Plataforma WebApp — SvelteKit

### 6.1 Modos de Operação

| **Modo** | **Requer** | **Funcionalidades** |
|---|---|---|
| ASL Mode | Apenas browser | Editor, ASL Viewer, Flow Editor, geração de código |
| WebSerial Mode | Chrome/Edge + HTTPS | UART, serial monitor, flash básico |
| Bridge Mode | Bridge instalada | MODBUS, Ethernet, flash completo, PLCs |

### 6.2 Bridge Local — Segurança Melhorada

> **Sugestão incorporada:** Em vez de token no stdout, o fluxo de autenticação é melhorado.

**Fluxo de Autenticação:**

```
1. Utilizador inicia bridge: neuroforge-bridge
2. Bridge gera QR code na janela do terminal + copia token para clipboard
3. WebApp detecta bridge e apresenta modal: "Bridge detectada — usar?"
4. Ao clicar "Conectar", WebApp lê token do clipboard automaticamente
5. Fallback: campo de texto para input manual do token
```

```rust
// bridge/main.rs
fn main() {
    let token = generate_secure_token(32);
    let url = format!("https://neuroforge.io/bridge-connect?token={}", token);
    
    // Copiar token para clipboard automaticamente
    clipboard::set_content(&token);
    
    // Mostrar QR code no terminal
    println!("NeuroForge Bridge activa");
    println!("Token copiado para clipboard automaticamente.");
    println!("Ou usar QR code abaixo:");
    print_qr_code(&url);
    
    // Iniciar servidor WebSocket
    start_bridge_server(token, "0.0.0.0:8765");
}
```

***

## 7. Plataforma Mobile — Tauri Mobile

### 7.1 Capacidades de Transporte

| **Protocolo** | **iOS** | **Android** | **Uso** |
|---|:---:|:---:|---|
| Wi-Fi (TCP/WebSocket) | ✅ | ✅ | Upload OTA, monitorização |
| Bluetooth LE | ✅ | ✅ | Configuração e monitorização BLE |
| USB OTG | ❌ | ✅ | Flash directo (Android) |
| MODBUS TCP | ✅ | ✅ | PLCs Ethernet |
| mDNS/Bonjour | ✅ | ✅ | Descoberta automática |

### 7.2 Upload Wi-Fi OTA — Detalhado

> **Questão: Como funciona o OTA para non-ESP32?**

O agente OTA do NeuroForge é um pequeno programa que corre no microcontrolador e expõe um endpoint HTTP para receber firmware:

**Para ESP32:** usa protocolo Arduino OTA nativo (já incorporado no firmware base ESP32).

**Para RP2040, STM32, nRF — Agente OTA NeuroForge:**

```
Passo 1 (primeiro flash via Desktop/USB):
  Desktop flash → instala "neuroforge-ota-agent" no microcontrolador
  Agent arranca um servidor HTTP na porta 8088 do Wi-Fi do dispositivo

Passo 2 (flashes posteriores via Mobile/WebApp):
  Mobile descobre dispositivo via mDNS (neuroforge-<id>.local)
  Mobile envia firmware via HTTP PUT para http://neuroforge-<id>.local:8088/update
  Agent verifica CRC, instala e faz reset
```

```rust
// Agente OTA (Rust no_std + embassy-net)
#[embassy_executor::task]
async fn ota_server_task(stack: &'static Stack<impl Driver>) {
    let listener = TcpListener::new(stack, 8088);
    
    loop {
        let mut socket = listener.accept().await;
        
        match parse_http_request(&mut socket).await {
            HttpRequest::Put { path: "/update", body } => {
                if verify_crc(&body) {
                    flash_firmware(&body).await;
                    send_http_ok(&mut socket).await;
                    embassy_time::Timer::after_millis(100).await;
                    cortex_m::peripheral::SCB::sys_reset();
                }
            },
            _ => send_http_404(&mut socket).await,
        }
    }
}
```

***

## 8. NeuroForge Flow Editor — Substituto do Blockly

### 8.1 Diferença: Flow Editor vs Canvas de Simulação

| **Canvas de Simulação** | **Flow Editor** |
|---|---|
| Representa o CIRCUITO FÍSICO | Representa o PROGRAMA LÓGICO |
| Nós = componentes (LED, MCU, Servo) | Nós = operações ASL (DigitalWrite, If, Delay) |
| Arestas = fios eléctricos | Arestas = fluxo de execução e dados |
| Resultado: visualização de simulação | Resultado: AslProgram para compilação/flash |

### 8.2 Migração dos 6 Nós — Milestones Individuais

Cada nó é uma milestone separada na Fase 2E, permitindo progresso incremental:

| **Milestone** | **Nó** | **Complexidade** | **Dependências** |
|---|---|---|---|
| 2E-1 | `MCUNode.svelte` | Alta — SVG complexo, pinos físicos | @xyflow/svelte setup |
| 2E-2 | `LEDNode.svelte` | Média | MCUNode (pino de destino) |
| 2E-3 | `ButtonNode.svelte` | Baixa | MCUNode |
| 2E-4 | `ServoNode.svelte` | Média — animação SVG | MCUNode |
| 2E-5 | `RGBLEDNode.svelte` | Média — 3 pinos | LEDNode base |
| 2E-6 | `PotentiometerNode.svelte` | Média — valor analógico | MCUNode |

### 8.3 Nós do Flow Editor

**Controlo de Fluxo:**

| **Nó** | **ASL** | **Visual** |
|---|---|---|
| StartNode | AslTask { name: 'main' } | Oval verde |
| IfNode | AslIf { condition, thenBranch, elseBranch } | Diamante azul |
| WhileNode | AslWhile { condition, body } | Caixa WHILE |
| ForNode | AslFor { init, condition, update, body } | Caixa FOR |
| DelayNode | AslDelay { milliseconds } | Caixa com relógio |

**Hardware MCU:**

| **Nó** | **ASL** | **Handles** |
|---|---|---|
| DigitalWriteNode | AslDigitalWrite { pin, value } | exec_in/out, pin_in, value_in |
| DigitalReadNode | AslRead { pin, mode: DIGITAL } | exec_in/out, pin_in, result_out |
| AnalogWriteNode | AslAnalogWrite { pin, value } | exec_in/out, pin_in, value_in |
| SerialPrintNode | AslPrint { value } | exec_in/out, value_in |
| ServoWriteNode | AslServoWrite { pin, angle } | exec_in/out, pin_in, angle_in |

**PLCs (IEC 61131-3):**

| **Nó** | **ASL** | **Handles** |
|---|---|---|
| TimerTONNode | AslTimerTON { tag, preset } | exec_in, in_bit, preset, q_out, et_out |
| CounterCTUNode | AslCounterCTU { tag, preset } | cu, r, pv, q_out, cv_out |
| LatchSRNode | AslLatchSR { tag, set, reset } | s_in, r_in, q_out |
| ModbusReadNode | AslUartRead (MODBUS) | exec_in/out, addr, reg, value_out |

### 8.4 Schema `.nfv` — Formato de Ficheiro NeuroForge Visual

```rust
pub struct NfvFile {
    pub version: NfvVersion,
    pub asl_version: String,
    pub metadata: NfvMetadata,
    pub target_board: BoardProfile,
    pub nodes: Vec<NfvNode>,
    pub edges: Vec<NfvEdge>,
}

pub struct NfvVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}
```

**Exemplo `.nfv` JSON:**

```json
{
  "version": { "major": 3, "minor": 2, "patch": 0 },
  "asl_version": "3.2.0",
  "metadata": {
    "name": "Blink LED",
    "author": "Caio",
    "created_at": "2026-03-17T01:05:00Z",
    "modified_at": "2026-03-17T01:05:00Z",
    "tags": ["basic", "tutorial"]
  },
  "target_board": { "id": "esp32_dev_kit" },
  "nodes": [
    { "id": "n1", "type": "StartNode", "position": [100,100], "properties": {} },
    { "id": "n2", "type": "DigitalWriteNode", "position": [300,100],
      "properties": { "pin": 13, "value": "HIGH" } },
    { "id": "n3", "type": "DelayNode", "position": [500,100],
      "properties": { "delay_ms": 1000 } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "source_handle": "exec_out",
      "target": "n2", "target_handle": "exec_in" },
    { "id": "e2", "source": "n2", "source_handle": "exec_out",
      "target": "n3", "target_handle": "exec_in" }
  ]
}
```

***

## 9. NeuroForge Ladder Editor

### 9.1 Elementos Visuais

```
Rung: |--[ ]--[/]--(S)--|
      powerrail NO NC SetCoil powerrail

Contactos: [ ] NO  [/] NC  [P] Borda↑ [N] Borda↓
Bobinas:   ( )     (/)     (S) SET    (R) RESET   (P) PULSE
Blocos FB: [TON]  [TOF]  [TP]  [CTU]  [CTD]  [SR]
Ramos:     --+ BranchStart +-- BranchEnd
```

### 9.2 Pipeline Ladder → ASL → PLC

```
Utilizador desenha Ladder no editor visual
       ↓
AslPlcProgram { networks: [AslRung, ...] }
       ↓
st_generator.rs → Exportação Structured Text (IEC 61131-3)
ladder_generator.rs → Exportação Ladder XML (CODESYS / TwinCAT)
ASLExecutor → Simulação no browser
       ↓
Flash via MODBUS / Ethernet → PLC real
```

### 9.3 Importação de Ladder Externo

Suporte a importação de CODESYS XML, TwinCAT, TIA Portal:

```rust
pub fn import_codesys_xml(xml: &str) -> Result<AslPlcProgram, ImportError> {
    let doc = roxmltree::Document::parse(xml)?;
    let root = doc.root_element();
    
    let mut networks = Vec::new();
    
    for rung in root.descendants().filter(|n| n.has_tag_name("Rung")) {
        networks.push(parse_rung(rung)?);
    }
    
    Ok(AslPlcProgram { networks, ..Default::default() })
}
```

***

## 10. Rust Embassy — Nova Linguagem para MCUs

### 10.1 Mapeamento ASL → Embassy

| **ASL Node** | **Código Embassy Gerado** |
|---|---|
| AslDelay { ms: 500 } | `Timer::after(Duration::from_millis(500)).await;` |
| AslDigitalWrite { pin, HIGH } | `led.set_high();` |
| AslRead { pin, ANALOG } | `let value = adc.read(&mut pin).await.unwrap();` |
| AslTask { body } | `#[embassy_executor::main] async fn main(spawner: Spawner)` |

### 10.2 Placas Suportadas

| **Placa** | **HAL** | **Flash** |
|---|---|---|
| Raspberry Pi Pico (RP2040) | embassy-rp | probe-rs / picotool |
| STM32F4, STM32H7 | embassy-stm32 | probe-rs / STLink |
| nRF52840 (Nordic) | embassy-nrf | probe-rs / J-Link |
| ESP32-S3 | esp-rs + Embassy | esptool / probe-rs |

***

## 11. Protocolo de Adição de Nova Linguagem

### 11.1 Checklist MCU (10 Passos)

- [ ] **1.** Verificar/criar grammar tree-sitter para a linguagem
- [ ] **2.** Criar `metadata.toml` em `plugins/<lang>/` com id, category=`mcu`, asl_mappings
- [ ] **3.** Criar `<lang>_parser.rs` — implementar trait `LanguageParser`
- [ ] **4.** Criar `<lang>_generator.rs` — implementar trait `LanguageGenerator`
- [ ] **5.** Criar shims em `plugins/<lang>/shims/`
- [ ] **6.** Criar `BoardProfiles` para placas suportadas
- [ ] **7.** Registar no `LanguageRegistry`: `register_parser + register_generator`
- [ ] **8.** Testes de roundtrip obrigatórios: blink, serial, gpio, timing
- [ ] **9.** Actualizar `BoardLibrary.svelte`
- [ ] **10.** Documentar em `docs/languages/<lang>.md`

**The Golden Rule (enforced em CI):**

> Qualquer feature de hardware adicionada a uma linguagem deve ter paridade semântica em **TODAS** as outras. ST + C + Python + Rust + Embassy devem andar de mãos dadas.

### 11.2 Checklist PLC (10 Passos)

- [ ] **1.** Identificar formato import/export do PLC alvo (CODESYS, TIA Portal, etc.)
- [ ] **2.** Criar `<plc>_parser.rs` com `target: PlatformType::PLC`
- [ ] **3.** Criar `<plc>_generator.rs` — gerar ST, Ladder XML, ou IL
- [ ] **4.** Implementar `PlcAdapter` trait: `connect`, `upload_program`, `read_variables`
- [ ] **5.** Adicionar nós IEC específicos ao `AslPlcTypes` se necessário
- [ ] **6.** Registar no `PlcRegistry`
- [ ] **7.** Testes de roundtrip: `motor_start_stop`, `timer_control`, `counter`
- [ ] **8.** Documentar restrições de scan cycle, tipos de dados, limitações
- [ ] **9.** Criar templates de biblioteca para esta linguagem
- [ ] **10.** Integrar no `FirmwareHub` e `BoardLibrary`

***

## 12. Estratégia de CI/CD e Testes

### 12.1 Testes por Nível

#### Nível 1 — Unitários e Side-by-Side (sem hardware)

```yaml
name: Test ASL Engine
on: [push, pull_request]

jobs:
  test-asl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Unit tests
        run: cargo test --lib -p neuroforge-asl
      - name: Roundtrip tests (C, Python, Rust)
        run: cargo test roundtrip -p neuroforge-asl
      - name: Paridade semântica (todas as linguagens)
        run: cargo test parity -p neuroforge-asl
      - name: Side-by-side TS vs Rust (Fase 1 apenas)
        run: cargo test side_by_side -p neuroforge-asl
      - name: WASM build
        run: wasm-pack build crates/neuroforge-asl --target web
      - name: Verificar tamanho WASM
        run: |
          SIZE=$(wc -c < pkg/neuroforge_asl_bg.wasm)
          [ $SIZE -lt 2097152 ] || (echo "WASM > 2MB!" && exit 1)
```

#### Nível 2 — Integração (mocking de hardware)

```rust
// Fake MODBUS Server
pub struct FakeModbusServer { ... }

impl FakeModbusServer {
    pub async fn new(port: u16) -> Self { ... }
    pub async fn set_register(&self, addr: usize, value: u16) { ... }
}

#[tokio::test]
async fn test_modbus_read_with_fake_server() {
    let server = FakeModbusServer::new(5020).await;
    server.set_register(100, 1234).await;
    
    let value = modbus_read("127.0.0.1:5020", 100).await?;
    assert_eq!(value, 1234);
}

// Virtual Serial Port (socat)
#[tokio::test]
async fn test_uart_flash_with_virtual_port() {
    let vport = VirtualSerialPort::new();  // socat wrapper
    let firmware = vec![0x00, 0x01, 0x02];
    
    let result = flash_firmware_uart(&vport.port_a, &firmware, 115200).await;
    assert!(result.is_ok());
    assert_eq!(vport.read_all_b(), firmware);
}
```

#### Nível 3 — Hardware-in-the-Loop (hardware real)

```bash
# Executar apenas em runners com hardware físico
# ou via workflow manual (workflow_dispatch)
cd tests/e2e && bash test_flash_to_real_board.sh

# Passos:
# 1. Compilar blink.c para Arduino Uno
# 2. Flash via UART avrdude
# 3. Abrir serial monitor, verificar "Hello, NeuroForge!" após 1s
```

### 12.2 Métricas de "Tempo até Primeiro Hello World"

> **Sugestão incorporada:** métrica de tempo até compilação Rust funcionar no browser.

```yaml
name: Time-to-Hello-World Benchmark
on: [release]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - name: Medir tempo até WASM carregar no browser
        run: |
          START=$(date +%s%N)
          node tests/bench/load_wasm.mjs
          END=$(date +%s%N)
          echo "WASM load time: $(( (END - START) / 1000000 ))ms"
          
      - name: Medir tempo até primeiro parse ASL
        run: cargo bench --bench asl_parse
```

| **Métrica Adicional** | **Target** |
|---|---|
| Tempo até WASM carregar no browser (cold) | < 800ms |
| Tempo até primeiro parse ASL no browser | < 200ms |
| Tempo até UI Desktop aparecer | < 1.5s |

***

## 13. Plano de Fases Completo

### Fase 0 — Preparação + Inventário (2-3 semanas)

> **Fase 0.5 incorporada:** Inventário exacto antes de começar.

- [ ] Criar estrutura de monorepo completa (`apps/`, `crates/`, `docs/`, `tests/`, `poc/`)
- [ ] Configurar `Cargo.toml` workspace raiz + `pnpm-workspace.yaml`
- [ ] Setup `shadcn-svelte` em `apps/shared/` — `npx shadcn-svelte@latest init`
- [ ] **Inventário ASL:** listar todos os ficheiros TS com LOC exactas (usar tabela da Secção 1.1)
- [ ] **Mapear ASLTypes.ts** → `asl_types.rs` campo a campo
- [ ] Verificar releases recentes de `@xyflow/svelte 1.x` e confirmar estabilidade de API antes de commitar
- [ ] Mover `src/components/`, `src/stores/`, `src/engine/` para `apps/shared/src/`
- [ ] Eliminar 50+ ficheiros de output da raiz
- [ ] Eliminar `src/engine/blockly/` (backup em `poc/blockly-archive/`)
- [ ] Eliminar `BlocklyEditor.tsx`, `QEMUApiClient.ts`, `QEMUWebSocket.ts`, `useQEMUStore.ts`
- [ ] Eliminar `server/` (backup `cores/` e `test-firmware/` em `tests/fixtures/`)
- [ ] Setup CI/CD inicial (`.github/workflows/test-asl.yml`)

**Critério de Saída:** Monorepo criado, inventário completo documentado, `npm run dev` funciona.

**Estimativa:** 10-15 dias

***

### Fase 1 — ASL Engine em Rust com Side-by-Side (4-6 semanas)

**Risco:** Alto — mitigado pela estratégia side-by-side. TypeScript permanece activo.

- [ ] Criar crate `neuroforge-asl` com estrutura completa
- [ ] Implementar `tree_sitter_adapter.rs` (abstrai nativo vs WASM)
- [ ] Migrar `ASLTypes.ts` → `asl_types.rs` + `asl_plc_types.rs` (campo a campo, com testes)
- [ ] Implementar `code_to_asl.rs` (transform AST → ASL — **mais crítico**)
- [ ] Migrar `astNormalizer.ts` e todos os transforms
- [ ] Migrar parsers C, Python, Rust com testes side-by-side contra TS
- [ ] Migrar generators C, Python, Rust com testes side-by-side
- [ ] Migrar todos os shims (eeprom, keypad, lcd, servo)
- [ ] Migrar `ASLExecutor.ts` → `asl_executor.rs`
- [ ] Compilar para WASM (`wasm-pack build --target web`)
- [ ] Testes side-by-side passam 100% → remover TypeScript engine
- [ ] Bundle WASM < 2MB verificado em CI

**Critério de Saída:** 100% testes side-by-side passam. TS engine removido. WASM carrega no browser.

**Estimativa:** 28-42 dias

***

### Fase 2 — Desktop Tauri 2 + Svelte 5 (6-8 semanas)

#### 2A — Setup Tauri + Stores Atómicas (1 semana)

- [ ] Inicializar Tauri 2 + SvelteKit no `apps/desktop/`
- [ ] Instalar e verificar `@xyflow/svelte 1.x` — testar API básica
- [ ] Setup SQLite via `tauri-plugin-sql` + migrations
- [ ] Migrar stores: `serial.svelte.ts`, `library.svelte.ts`, `connection.svelte.ts`
- [ ] Implementar `transport/serial.rs` + `error_recovery.rs`
- [ ] Eliminar Blockly e QEMU do frontend completamente

**Critério:** Tauri arranca. Lista de serial ports visível. Stores activas.

#### 2B — Layout (1 semana)

- [ ] Migrar `TopToolbar.svelte`
- [ ] Migrar `LeftSidebar.svelte`
- [ ] Migrar `FloatingWindow.svelte`
- [ ] Implementar `ui.svelte.ts`

**Critério:** Layout Desktop completo e navegável.

#### 2C — Painéis de Propriedades (1 semana)

- [ ] Migrar 7 painéis de propriedades (LED, MCU, Button, Servo, RGB, Potentiometer, Board)
- [ ] Migrar `LibrariesPanel.svelte`

**Critério:** Clique em nó → painel de propriedades aparece com dados correctos.

#### 2D — Editores (1.5 semanas)

- [ ] Integrar Monaco Editor standalone (`@monaco-editor/loader`)
- [ ] Migrar `CodeEditor.svelte`, `CodeEditorWithTabs.svelte`
- [ ] Integrar WASM do crate `neuroforge-asl`
- [ ] Migrar `ASLViewer.svelte`
- [ ] Implementar `asl_bridge.rs` + Tauri commands de compilação

**Critério:** Escrever código C → ASL aparece em tempo real no viewer.

#### 2E — Canvas de Simulação: SPIKE 6 Milestones (3 semanas)

**⚠️ Componente de maior risco — tratado como projecto separado.**

**Milestone 2E-0: Setup @xyflow/svelte**

- [ ] Instalar `@xyflow/svelte 1.x`
- [ ] Criar canvas de teste com 2 nós simples
- [ ] Verificar que Handle, Position, NodeProps funcionam como React equivalente
- [ ] Documentar diferenças de API encontradas

**Milestones 2E-1 a 2E-6: Migração dos nós (por ordem de dependência)**

Ver tabela de milestones na Secção 8.2.

**Migração de `useSimulationStore.ts` (12.6 KB — ALTO RISCO):**

```typescript
// Antes (React + Zustand)
const { pinState, setPinState } = useSimulationStore();
useEffect(() => {
  simulationEngine.on('pinChange', ({ pin, state }) => {
    setPinState(pin, state);
  });
}, []);

// Depois (Svelte 5 Runes)
// simulation.svelte.ts
export const simulation = (() => {
    let pinState = $state<Record<string, PinState>>({});
    
    function init(engine: SimulationEngine) {
        $effect.pre(() => {
            engine.on('pinChange', ({ pin, state }) => {
                pinState = { ...pinState, [pin]: state };
            });
            engine.on('serialData', ({ data }) => {
                // ...
            });
        });
    }
    
    return { get pinState() { return pinState; }, init };
})();
```

**Critério 2E:** Canvas visível. Todos os 6 nós migrados. Simulação LED acende/apaga.

#### 2F — Remoção de React (3 dias)

- [ ] `pnpm remove react react-dom @xyflow/react zustand @radix-ui/* blockly`
- [ ] Verificar zero dependências React em runtime
- [ ] Bundle Desktop < 100 MB, startup < 2s

**Critério de Saída Fase 2:** Zero React em runtime. Flash em Arduino, ESP32 e RP2040.

**Estimativa:** 42-56 dias

***

### Fase 3 — Embassy + IEC 61131-3 ST (4-6 semanas)

- [ ] Implementar plugin `rust_embassy` completo
- [ ] Suporte Embassy: RP2040, STM32F4, nRF52840, ESP32-S3
- [ ] Implementar parser IEC 61131-3 Structured Text
- [ ] Implementar ST generator
- [ ] Implementar MODBUS RTU/TCP (`tokio-modbus`)
- [ ] Implementar `probe_rs_adapter.rs` para SWD/JTAG + picotool
- [ ] Testes roundtrip e paridade Embassy + ST

**Critério de Saída:** Embassy funcional em RP2040. Programa ST instalado via MODBUS em PLC real.

**Estimativa:** 28-42 dias

***

### Fase 4 — WebApp + Ladder Editor + Flow Editor (4-5 semanas)

- [ ] Criar `apps/webapp/` SvelteKit consumindo `apps/shared/`
- [ ] Implementar `LadderEditor.svelte` (SVG puro, todos os elementos IEC)
- [ ] Implementar `ladder_importer.rs` (XML CODESYS/TwinCAT)
- [ ] Implementar `FlowEditor.svelte` com todos os nós ASL
- [ ] Implementar `nfv_to_asl()` Rust/WASM
- [ ] Schema `.nfv` completo com versionamento
- [ ] Executável `neuroforge-bridge` com QR auth
- [ ] Implementar detecção de capacidades (`capabilities.ts`)

**Critério de Saída:** Ladder Editor cria e exporta programas. WebApp funcional em todos os modos.

**Estimativa:** 21-35 dias

***

### Fase 5 — Mobile (3-4 semanas)

- [ ] Configurar `apps/mobile/` Tauri 2 Mobile
- [ ] Implementar Wi-Fi OTA (ESP32 nativo + agente OTA para RP2040/STM32/nRF)
- [ ] Implementar agente OTA Rust (embassy-net, Embassy)
- [ ] Implementar mDNS discovery e BLE
- [ ] USB OTG Android (via JNI)
- [ ] Testar em dispositivos reais (Android + iOS)

**Critério de Saída:** Flash em ESP32 e RP2040 via Wi-Fi a partir de Android e iOS.

**Estimativa:** 14-28 dias

***

### Fase 6 — PLCs Avançados + Ecossistema

- [ ] Siemens S7 (`s7-rs`) — ST via protocolo S7
- [ ] Allen-Bradley EtherNet/IP (`eip-rs`)
- [ ] OPC-UA (`open62541-rs`)
- [ ] Function Block Diagram editor
- [ ] CLI NeuroForge (`nf build`, `nf flash`, `nf monitor`)
- [ ] Plugin SDK público + documentação para terceiros
- [ ] Marketplace de templates

**Critério de Saída:** Suporte a 3+ fabricantes PLC diferentes com testes de integração.

**Estimativa:** 8-12 semanas

***

## 14. Métricas de Sucesso

| **Métrica** | **Target** |
|---|---|
| Bundle WASM (`neuroforge-asl`) | < 2 MB |
| Startup Desktop | < 2 segundos |
| Parsing ASL (10.000 linhas) | < 100 ms |
| Flash firmware 100 KB (UART 115200) | < 15 s |
| Cobertura testes Rust (crate ASL) | > 85% |
| Testes de roundtrip por linguagem | 100% pass |
| Dependências Node.js em runtime | Zero |
| Dependências React em runtime (pós Fase 2F) | Zero |
| Linguagens MCU (Fase 3) | C/C++, Python, Rust no_std, Rust Embassy |
| Linguagens PLC (Fase 4) | Structured Text, Ladder Diagram |
| Protocolos de flash (Fase 2) | UART, USB, Wi-Fi OTA, MODBUS TCP/RTU |
| Tempo WASM carregar no browser (cold) | < 800 ms |
| Tempo primeiro parse ASL no browser | < 200 ms |
| Aprovação CI paridade semântica | 100% |

***

## 15. Dependências Rust Completas

### crates/neuroforge-asl/Cargo.toml

```toml
[package]
name = "neuroforge-asl"
version = "3.2.0"
edition = "2021"

[dependencies]
tree-sitter = "0.22"
tree-sitter-c = "0.21"
tree-sitter-python = "0.21"
tree-sitter-rust = "0.21"
tree-sitter-structured-text = { git = "https://github.com/tmatijevich/tree-sitter-structured-text" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tracing = "0.1"
rox