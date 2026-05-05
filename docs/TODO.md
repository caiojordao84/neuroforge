# DendriForge — Plano de Migração Rust → Python

Este documento é o guia operacional da migração. Cada item é accionável e segue a ordem do ROADMAP.

---

## Estado Actual (branch `preRust`)

### O que existe em Rust (a migrar)

| Crate                          | Módulos principais                                                                                   | Estado               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------- |
| `crates/dendriforge-asl`       | parser/, generator/, executor/, asl_types/, plugins/ (14 linguagens), optimizer/, transforms/, flow/ | ✅ Funcional          |
| `crates/dendriforge-sim`       | Motor de simulação de hardware                                                                       | ⚠️ Parcial            |
| `crates/dendriforge-firmware`  | Firmware embarcado Embassy                                                                           | 🔄 Base               |
| `crates/dendriforge-transport` | Serial + WebSocket transport                                                                         | ✅ Protocolo definido |

### O que existe em TypeScript (manter/adaptar)

| App                | Conteúdo                                              | Decisão                                     |
| ------------------ | ----------------------------------------------------- | ------------------------------------------- |
| `apps/webapp`      | SvelteKit, rotas `/transpile`, `/plc`, `/schemasmith` | ✅ Manter — adaptar para consumir API Python |
| `apps/shared`      | Componentes, tipos                                    | ✅ Manter intacto                            |
| `apps/schemasmith` | Editor de schemas                                     | ✅ Manter                                    |
| `apps/desktop`     | Tauri scaffold                                        | ⏳ Adiar para pós v1.0                       |
| `apps/mobile`      | App scaffold                                          | ⏳ Adiar para pós v1.0                       |

### O que vai ser eliminado

- `crates/dendriforge-asl/src/wasm/` — desnecessário sem WASM
- `verify_wasm.mjs`, `test_wasm_frontend_integration.mjs` — obsoletos
- `pnpm-workspace.yaml`, `tsconfig.json`, `package.json` raiz — obsoletos (o TS fica em `apps/`)
- `Cargo.toml` / `Cargo.lock` raiz — obsoletos após migração
- `test_ci.ps1` — substituir por `test_ci.py`

---

## Fase 1 — ASL Engine em Python

### 1.1 Setup do projecto Python

```
[x] Criar pyproject.toml na raiz com:
    - nicegui
    - fastapi
    - uvicorn[standard]
    - lark
    - pydantic>=2
    - pyserial
    - pyspice
    - python-dotenv
    - pytest
    - pytest-asyncio

[x] Criar estrutura de pastas:
    dendriforge/
    ├── __init__.py
    ├── ui/
    │   ├── __init__.py
    │   ├── pages/
    │   └── components/
    ├── api/
    │   └── __init__.py
    └── core/
        ├── asl/
        │   ├── parser/
        │   └── generator/
        ├── sim/
        └── transport/

[x] Criar main.py com:
    from fastapi import FastAPI
    from nicegui import ui
    app = FastAPI()
    ui.run_with(app, host="0.0.0.0", port=8080)
```

### 1.2 Tipos ASL (dendriforge/core/asl/types.py)

```
[ ] Portar AslProgram de asl_types/ (Rust) para Pydantic BaseModel
[ ] Portar AslExpr, AslStatement, AslLiteral, AslType
[ ] Portar AslFunction, AslVariable, AslBlock
[ ] Validar: carregar ir_debug.json dos crates e fazer parse com os novos modelos
[ ] Escrever test_asl_types.py
```

### 1.3 Executor (dendriforge/core/asl/executor.py)

```
[ ] Portar AslExecutor de executor/ (Rust)
[ ] Implementar detect_language(source) → Language
    (heurísticas: keywords ST, indentação Python, tipos C, etc.)
[ ] Implementar transpile(source, from_lang, to_lang, board) → str
[ ] Integrar optimizer e normalize
[ ] Escrever test_asl_executor.py com casos do st_result.txt
```

### 1.4 Parsers

```
[ ] base.py              — NeuroParser ABC
[ ] toon_parser.py       — Formato TOON (Necessário para a infraestrutura base)

**Core / Tier 1 (Essenciais para o MVP):**
[ ] python_parser.py     — Python/MicroPython usando ast stdlib
[ ] rust_parser.py       — Rust std via Lark
[ ] arduino_parser.py    — Arduino C++

**Community / Tier 2 (Pós-MVP):**
[ ] c_parser.py          — C embarcado via Lark
[ ] st_parser.py         — Structured Text (IEC 61131-3) via Lark
[ ] lua_parser.py        — NodeMCU/Lua
[ ] zig_parser.py        — Zig
[ ] ada_parser.py        — Ada
[ ] asm_parser.py        — AVR Assembly
[ ] forth_parser.py      — Forth
[ ] espruino_parser.py   — Espruino JS
[ ] circuitpython_parser.py — CircuitPython

**Industrial / Tier 3 (Pré Desktop & Mobile):**
[ ] ladder_parser.py     — Ladder Diagram (LD)
[ ] fbd_parser.py        — Function Block Diagram (FBD)
[ ] sfc_parser.py        — Sequential Function Chart (SFC)
[ ] il_parser.py         — Instruction List (IL)
[ ] grafcet_parser.py    — GRAFCET
```

### 1.5 Generators

```
[ ] toon_generator.py        — CRÍTICO: referência: plugins/core/toon_generator.rs

**Core / Tier 1 (Essenciais para o MVP):**
[ ] python_generator.py      — referência: plugins/python/
[ ] rust_generator.py        — referência: plugins/rust_std/
[ ] arduino_generator.py     — referência: plugins/arduino/

**Community / Tier 2 (Pós-MVP):**
[ ] c_generator.py           — referência: plugins/c/
[ ] st_generator.py          — referência: plugins/plc/
[ ] circuitpython_generator.py
[ ] lua_generator.py         — referência: plugins/lua/
[ ] zig_generator.py         — referência: plugins/zig/
[ ] ada_generator.py         — referência: plugins/ada/
[ ] asm_generator.py         — referência: plugins/asm/
[ ] forth_generator.py       — referência: plugins/forth/
[ ] espruino_generator.py    — referência: plugins/espruino/

**Industrial / Tier 3 (Pré Desktop & Mobile):**
[ ] ladder_generator.py      — referência: plugins/ladder_generator.rs (17KB)
[ ] fbd_generator.py         — Function Block Diagram (FBD)
[ ] sfc_generator.py         — Sequential Function Chart (SFC)
[ ] il_generator.py          — Instruction List (IL)
[ ] grafcet_generator.py     — GRAFCET
```

---

## Fase 2 — API FastAPI

```
[ ] dendriforge/api/transpiler.py
    POST /transpile
    Body: { source: str, from_lang: str, to_lang: str, board_id: str }
    Response: { result: str, ir: AslProgram | None }

[ ] dendriforge/api/boards.py
    GET /boards          → lista de boards disponíveis (lê static/boards/*.toon)
    GET /boards/{id}     → detalhes de board

[ ] dendriforge/api/simulation.py
    WS /sim/run          → WebSocket com eventos de simulação em tempo real

[ ] Integrar os 3 routers no main.py via app.include_router()
```

---

## Fase 3 — Motor de Simulação

```
[ ] dendriforge/core/sim/board.py
    - Classe Board com pins: Dict[str, PinState]
    - PinState: { mode: INPUT|OUTPUT|PWM, value: float, pull: NONE|UP|DOWN }
    - Carregar board a partir de .toon (referência: docs/boards-documentation.md)

[ ] dendriforge/core/sim/engine.py (Multi-Processo)
    - SimEngine a correr num processo isolado para não bloquear o GIL
    - Tick configurável (default: 1ms)
    - Executar ASL transpilado num worker
    - IPC para enviar eventos GPIO para o WebSocket

[ ] dendriforge/core/sim/plc.py
    - PLCRuntime com scan cycle IEC 61131-3
    - Carregar programa ST → transpile → executar

[ ] dendriforge/core/sim/spice.py
    - SpiceBridge usando PySpice
    - Gerar netlist a partir de .toon
    - Chamar ngspice como subprocesso
    - Mapear resultados de simulação analógica → GPIO virtual
```

---

## Fase 4 — NiceGUI UI

```
[ ] dendriforge/ui/pages/simulation.py
    - Dashboard principal
    - Selector de board (dropdown alimentado por GET /boards)
    - Editor de código (ui.codemirror ou ui.textarea)
    - Botões: Compile, Simulate, Flash
    - Visualização de pinos em tempo real
    - Console serial

[ ] dendriforge/ui/pages/transpiler.py
    - Editor duplo: código fonte / código transpilado
    - Selector de linguagem origem + destino
    - Visualização opcional da ASL IR (para debug)

[ ] dendriforge/ui/components/board_view.py
    - SVG ou canvas com representação do board
    - Pinos com cores por estado (HIGH=verde, LOW=cinza, PWM=amarelo)

[ ] dendriforge/ui/components/console.py
    - Output série em tempo real
    - Filtros por tipo de mensagem
```

---

## Fase 5 — Transport

```
[ ] dendriforge/core/transport/serial.py
    - Protocolo: docs/serial-gpio-protocol.md
    - Auto-scan de portas COM/tty
    - Detecção de tipo de board
    - Flash: avrdude (AVR), esptool (ESP32), picotool (RP2040)

[ ] dendriforge/core/transport/ws.py
    - WebSocket server para comunicação remota
    - Mesmo protocolo que serial mas sobre rede
```

---

## Fase 6 — Desktop e Mobile (pós v1.0)

```
[ ] DESKTOP (Windows + Linux)
    Avaliar opções:
    - PyWebView: janela nativa que embebe o NiceGUI (solução mais simples)
    - Tauri v2 com Python backend: melhor performance, mais complexo
    - Electron: funciona mas pesado
    Requisitos obrigatórios:
    - Windows 10+ e Linux (Ubuntu 20.04+, Arch)
    - Acesso directo a USB/Serial
    - Auto-update
    - Instalador (.msi / .deb / .AppImage)

[ ] MOBILE (Android + iOS)
    Avaliar opções:
    - BeeWare (Toga): Python nativo, suporte Android+iOS
    - React Native + API Python remota: UI mais polida
    - Kivy: madura mas UI datada
    Requisitos obrigatórios:
    - Android 10+ e iOS 15+
    - Monitorização de boards via WiFi/BLE
    - Transpilação via API remota
    - SEM flash de firmware (limitação hardware mobile)
```

---

## Fase 0.1 — Realocação de Recursos (CRÍTICO) ✅

[x] Mover `apps/shared/static/boards/` para `dendriforge/core/boards/`
    - Actualizar imports e caminhos de leitura na API
    - Garantir que o frontend consome via `GET /boards`

---

## Fase 7 — AI Transpiler

```
[ ] dendriforge/core/asl/ai_transpiler.py
    - Integrar `agent_skills/` como base de conhecimento para prompts
    - Integrar `dendriforge/core/boards/` para contexto de hardware no LLM
    - Implementar client para OpenAI, Anthropic e Ollama
    - Fallback logic: se o parser falhar, enviar para LLM com prompt de sistema ASL
    - Sistema de cache para evitar chamadas repetidas (API cost)

[ ] Integração na UI
    - Mostrar aviso "Transpilado via IA" quando o fallback é activado
    - Botão para "Verificar/Corrigir" código gerado por IA
    - Configuração de chaves API (BYOK)
```

---

## Limpar codebase após migração completa

```
[ ] Remover crates/ (após confirmar que Python replica toda a funcionalidade)
[ ] Remover Cargo.toml / Cargo.lock da raiz
[ ] Remover .cargo/
[ ] Remover pnpm-workspace.yaml, tsconfig.json raiz
[ ] Remover package.json raiz
[ ] Remover verify_wasm.mjs, test_wasm_frontend_integration.mjs
[ ] Remover apps/desktop scaffold vazio
[ ] Remover apps/mobile scaffold vazio
[ ] Atualizar .github/workflows para CI Python (pytest) em vez de Rust (cargo test)
```

---

## Casos de Teste Prontos (dos crates Rust)

Os seguintes ficheiros nos crates são casos de teste reais para validar a implementação Python:

- `crates/dendriforge-asl/` — `ir_debug.json` (ASL IR de exemplo)
- `crates/dendriforge-asl/` — `st_result.txt` (output ST esperado)
- `docs/serial-gpio-protocol.md` — protocolo de comunicação série
- `docs/boards-documentation.md` — specs das boards
- `core/boards/*.toon` — >100 boards reais para usar no simulador, agente IA e testar o loader
