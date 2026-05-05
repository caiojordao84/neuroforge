# DendriForge — Roadmap

Este roadmap descreve as fases de migração do DendriForge de Rust para Python e o desenvolvimento subsequente de todas as funcionalidades planeadas. Sem datas — o progresso é medido por marcos.

---

## Fase 0 — Limpeza e Estrutura Base ✅

**Objectivo:** Limpar a branch `preRust` de todos os documentos obsoletos e preparar o repositório para a migração.

### Concluído
- [x] Remover todos os guias `guiaFaseX_Rust.md` e `guiaPreFase_*.md`
- [x] Remover planos de migração obsoletos (`Plano-Migracao-*.md`)
- [x] Remover docs de análise interna (orphan maps, purge maps, inventários)
- [x] Remover docs QEMU (substituídos por SPICE)
- [x] Remover checklists, reports e snapshots gerados automaticamente
- [x] Remover docs da era TypeScript (parser*.md, switch*.md, etc.)
- [x] Remover README.md, ROADMAP.md e TODO.md antigos
- [x] Reescrever README.md, ROADMAP.md e TODO.md com arquitectura Python real

---

## Fase 1 — Python Core: ASL Engine 🔄

**Objectivo:** Migrar o `dendriforge-asl` (Rust) para Python puro. Este é o coração do sistema — tudo depende disto.

### Milestone 1.1 — Tipos e IR
- [ ] Criar `dendriforge/core/asl/types.py` — `AslProgram`, `AslExpr`, `AslLiteral`, `AslStatement` como Pydantic models
- [ ] Validar contra os `ir_debug.json` e `st_result.txt` existentes nos crates (são casos de teste reais)
- [ ] Criar `dendriforge/core/asl/normalize.py` — `bool_like()`, `is_canonical_op()`, helpers

### Milestone 1.2 — Executor e Dispatcher
- [ ] Criar `dendriforge/core/asl/executor.py` — `AslExecutor` com heurísticas de detecção de linguagem
- [ ] Implementar `detect_language(source: str) -> Language` (porta do `asl_executor.rs`)
- [ ] Criar `dendriforge/core/asl/optimizer.py` — dead code elimination, constant folding

### Milestone 1.3 — Parsers
- [ ] `base.py` — `NeuroParser` ABC
- [ ] `c_parser.py` — C embarcado via Lark
- [ ] `python_parser.py` — Python/MicroPython
- [ ] `arduino_parser.py` — Arduino C++
- [ ] `rust_parser.py` — Rust std
- [ ] `st_parser.py` — Structured Text (IEC 61131-3) via Lark
- [ ] `lua_parser.py` — NodeMCU/Lua
- [ ] `zig_parser.py` — Zig
- [ ] `ada_parser.py` — Ada
- [ ] `asm_parser.py` — AVR Assembly
- [ ] `forth_parser.py` — Forth
- [ ] `espruino_parser.py` — Espruino JS
- [ ] `circuitpython_parser.py` — CircuitPython
- [ ] `toon_parser.py` — Formato TOON
- [ ] `ladder_parser.py` — Ladder Diagram PLC
- [ ] Testes unitários para cada parser com exemplos reais

### Milestone 1.4 — Generators (linguagens de saída)
- [ ] `base.py` — `AslGenerator` ABC com interface `generate(ast: AslProgram) -> str`
- [ ] `st_generator.py` — Structured Text ← **prioritário** (mais testado no Rust)
- [ ] `c_generator.py` — C embarcado
- [ ] `arduino_generator.py` — Arduino C++
- [ ] `python_generator.py` — Python/MicroPython
- [ ] `circuitpython_generator.py` — CircuitPython
- [ ] `rust_generator.py` — Rust std
- [ ] `lua_generator.py` — NodeMCU/Lua
- [ ] `zig_generator.py` — Zig embarcado
- [ ] `ada_generator.py` — Ada
- [ ] `asm_generator.py` — AVR Assembly
- [ ] `forth_generator.py` — Forth
- [ ] `espruino_generator.py` — Espruino JS
- [ ] `toon_generator.py` — Formato TOON (porta directa de `toon_generator.rs`)
- [ ] `ladder_generator.py` — Ladder Diagram PLC (porta de `ladder_generator.rs`)

---

## Fase 2 — API e Infra Base

**Objectivo:** Criar o esqueleto FastAPI + NiceGUI e expor o ASL engine via HTTP/WebSocket.

### Milestone 2.1 — Estrutura do projecto Python
- [ ] Criar `pyproject.toml` com todas as dependências (nicegui, fastapi, uvicorn, lark, pydantic, pyserial, pyspice, python-dotenv, pytest)
- [ ] Criar `main.py` com `ui.run_with(app)` — NiceGUI + FastAPI no mesmo processo
- [ ] Criar estrutura de pastas `dendriforge/ui/`, `dendriforge/api/`, `dendriforge/core/`

### Milestone 2.2 — FastAPI Routers
- [ ] `POST /transpile` — recebe código fonte + linguagem origem + linguagem destino + board, retorna código transpilado
- [ ] `GET /boards` — lista boards disponíveis (lê `.toon` de `dendriforge/core/boards/`)
- [ ] `GET /boards/{id}` — detalhes de um board
- [ ] `WS /sim/run` — WebSocket para simulação em tempo real

### Milestone 2.3 — Testes de integração
- [ ] `tests/test_asl_executor.py` — baseado nos outputs reais dos crates Rust
- [ ] `tests/test_asl_generators.py` — round-trip: source → ASL → output
- [ ] CI básico com pytest

---

## Fase 3 — Motor de Simulação

**Objectivo:** Implementar simulação comportamental de MCUs e PLCs, substituindo o QEMU por um motor próprio em Python + SPICE para circuitos.

### Milestone 3.1 — Board Model
- [ ] `dendriforge/core/sim/board.py` — modelo abstracto de board: GPIO (digital/PWM), ADC, UART, I2C, SPI, timers
- [ ] Carregar definição de board a partir de `.toon`
- [ ] Implementar GPIO virtual com estado observável (para UI)

### Milestone 3.2 — Simulation Engine
- [ ] `dendriforge/core/sim/engine.py` — loop de simulação com tick configurável
- [ ] Execução do código transpilado (Python) dentro do motor de simulação
- [ ] Eventos: interrupts, timers, ADC reads, Serial in/out
- [ ] Output em tempo real via WebSocket

### Milestone 3.3 — PLC / TOON Runtime
- [ ] `dendriforge/core/sim/plc.py` — runtime para PLCs usando boards TOON
- [ ] Suporte a ciclos de scan IEC 61131-3
- [ ] Simulação de I/O digital e analógico PLC

### Milestone 3.4 — SPICE Bridge
- [ ] `dendriforge/core/sim/spice.py` — bridge PySpice + ngspice para simulação de circuitos
- [ ] Netlist gerada a partir da definição TOON do board
- [ ] Integração com o motor de simulação (circuito analógico ↔ GPIO virtual)

---

## Fase 4 — Interface NiceGUI

**Objectivo:** Dashboard de simulação e editor de transpilação em NiceGUI.

### Milestone 4.1 — Página de Simulação
- [ ] `dendriforge/ui/pages/simulation.py` — visualização em tempo real do board
- [ ] `dendriforge/ui/components/board_view.py` — representação visual dos pinos e estados
- [ ] `dendriforge/ui/components/console.py` — output serial, logs, eventos
- [ ] Controlo de simulação: start/stop/step/reset

### Milestone 4.2 — Página de Transpilação
- [ ] `dendriforge/ui/pages/transpiler.py` — editor de código com syntax highlight
- [ ] Selector de linguagem origem + destino + board
- [ ] Visualização de ASL IR (debug mode)
- [ ] Output do código transpilado com copy/download

---

## Fase 5 — Transporte e Hardware Real

**Objectivo:** Comunicação com hardware físico via protocolo serial-gpio.

### Milestone 5.1 — Transport Layer
- [ ] `dendriforge/core/transport/serial.py` — pyserial com protocolo serial-gpio-protocol.md
- [ ] `dendriforge/core/transport/ws.py` — WebSocket transport para comunicação remota
- [ ] Auto-detecção de porta serial e tipo de board
- [ ] Flash de firmware (invoca avrdude/esptool conforme board)

---

## Fase 6 — Apps Desktop e Mobile (pós v1.0)

**Pré-requisito:** Python core 100% funcional e estável.

**Objectivo:** Empacotar o DendriForge como aplicação nativa para Windows, Linux, Android e iOS.

### Desktop (Windows + Linux)
- [ ] Avaliar: PyWebView vs Tauri (com API Python como backend) vs Electron
- [ ] Empacotamento com PyInstaller ou similar
- [ ] Auto-update
- [ ] Integração com USB/Serial nativa

### Mobile (Android + iOS)
- [ ] Avaliar: Kivy vs BeeWare (Toga) vs React Native + API Python remota
- [ ] UI adaptada para touch
- [ ] Monitorização de boards via WiFi/BLE
- [ ] Sem suporte a flash de firmware (só monitorização e transpilação)

---

## Fase 7 — AI Transpiler

**Objectivo:** Integração LLM para transpilação assistida por IA quando o parser determinístico falha.

- [ ] `dendriforge/core/asl/ai_transpiler.py` — fallback LLM para código complexo
- [ ] Suporte a OpenAI, Anthropic, Ollama (local)
- [ ] Interface na UI para corrigir/aprovar sugestões do LLM
- [ ] BYOK (Bring Your Own Key)

---

## Pós-v1.0 — Funcionalidades Futuras

- **Blockly / Flowchart editor** — editor visual de lógica para não-programadores
- **Ladder Editor** — editor visual de Ladder Diagram para PLCs
- **Multi-MCU simulation** — simular vários boards em simultâneo com comunicação entre eles
- **Cloud sync** — sync de boards e programas via API
- **Plugin SDK** — permitir adicionar novos targets/parsers como plugins externos
