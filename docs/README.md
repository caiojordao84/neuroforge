# DendriForge

**DendriForge** é uma plataforma open-source de programação, simulação e transpilação para microcontroladores (MCU) e controladores lógicos programáveis (PLC). O seu objectivo é permitir que um programador escreva código uma vez — em qualquer linguagem suportada — e o sistema transpila, simula e valida esse código para qualquer hardware-alvo.

---

## O que é o ASL

**ASL (Abstract Semantic Language)** é a linguagem intermédia central do DendriForge. Funciona como uma IR (Intermediate Representation) universal — toda a lógica de transpilação passa por aqui:

```
[código fonte] → [parser] → [ASL IR] → [generator] → [código alvo]
```

O ASL não é uma linguagem que o utilizador escreve directamente. É o formato interno que representa a semântica do programa de forma agnóstica à linguagem de origem e à linguagem de destino.

### Linguagens de entrada suportadas

| Linguagem                            | Notas                              |
| ------------------------------------ | ---------------------------------- |
| C                                    | MCU embedded (Arduino, AVR, ESP32) |
| Python / MicroPython / CircuitPython | MCU com runtime Python             |
| Rust (std)                           | MCU com Embassy / std              |
| Structured Text (ST)                 | IEC 61131-3, PLCs                  |
| Arduino (C++)                        | Arduino IDE style                  |
| Assembly                             | AVR ASM                            |
| Lua                                  | NodeMCU / ESP8266                  |
| Espruino (JS)                        | Espruino MCU                       |
| Ada                                  | Safety-critical                    |
| Forth                                | Resource-constrained MCU           |
| Zig                                  | Modern embedded                    |

### Linguagens de saída suportadas

As mesmas linguagens acima — o ASL é bidirecional. Um programa C pode ser transpilado para MicroPython, ou um programa ST pode ser convertido para C embarcado.

### Formato TOON

**TOON** é o formato de definição de boards/PLCs usado pelo DendriForge. É um JSON estruturado que descreve os pinos, periféricos, capacidades e mapeamentos de hardware de cada placa. Os ficheiros `.toon` estão em `dendriforge/core/boards/` e são consumidos pelo transpiler, simulador e frontend.

---

## Arquitectura do Sistema

```
dendriforge/
├── main.py                        # Entry point: NiceGUI + FastAPI no mesmo processo
├── pyproject.toml                 # Dependências Python (uv/pip)
│
├── dendriforge/                    # Pacote Python principal
│   ├── ui/                        # NiceGUI — interface web
│   │   ├── pages/
│   │   │   ├── simulation.py      # Dashboard de simulação (PRIORIDADE)
│   │   │   └── transpiler.py      # Editor + transpiler
│   │   └── components/
│   │       ├── board_view.py      # Visualização de board
│   │       └── console.py         # Output serial/log
│   │
│   ├── api/                       # FastAPI routers
│   │   ├── transpiler.py          # POST /transpile
│   │   ├── simulation.py          # WS /sim/run
│   │   └── boards.py              # GET /boards
│   │
│   ├── core/                      # Lógica pura — sem UI, sem HTTP
│   │   ├── boards/                # Definições de hardware TOON (realocadas de apps/shared)
│   │   ├── asl/                   # Motor ASL (migrado de dendriforge-asl Rust)
│   │   │   ├── types.py           # AslProgram, AslExpr, AslLiteral (Pydantic)
│   │   │   ├── executor.py        # AslExecutor — dispatcher central
│   │   │   ├── normalize.py       # bool_like(), canonical ops
│   │   │   ├── optimizer.py       # optimizações de AST
│   │   │   ├── ai_transpiler.py   # Fallback LLM (conhecimento: agent_skills + boards)
│   │   │   ├── parser/            # Parsers por linguagem
│   │   │   │   ├── base.py
│   │   │   │   ├── c_parser.py
│   │   │   │   ├── python_parser.py
│   │   │   │   ├── arduino_parser.py
│   │   │   │   ├── rust_parser.py
│   │   │   │   ├── st_parser.py
│   │   │   │   ├── lua_parser.py
│   │   │   │   ├── zig_parser.py
│   │   │   │   ├── ada_parser.py
│   │   │   │   ├── asm_parser.py
│   │   │   │   ├── forth_parser.py
│   │   │   │   ├── espruino_parser.py
│   │   │   │   ├── circuitpython_parser.py
│   │   │   │   ├── toon_parser.py
│   │   │   │   └── ladder_parser.py
│   │   │   └── generator/         # Generators por linguagem
│   │   │       ├── base.py
│   │   │       ├── c_generator.py
│   │   │       ├── python_generator.py
│   │   │       ├── arduino_generator.py
│   │   │       ├── rust_generator.py
│   │   │       ├── st_generator.py
│   │   │       ├── lua_generator.py
│   │   │       ├── zig_generator.py
│   │   │       ├── ada_generator.py
│   │   │       ├── asm_generator.py
│   │   │       ├── forth_generator.py
│   │   │       ├── espruino_generator.py
│   │   │       ├── circuitpython_generator.py
│   │   │       ├── toon_generator.py
│   │   │       └── ladder_generator.py
│   │   │
│   │   ├── sim/                   # Motor de simulação (migrado de dendriforge-sim)
│   │   │   ├── engine.py          # Loop de simulação
│   │   │   ├── board.py           # Modelo de board (GPIO, ADC, UART…)
│   │   │   ├── plc.py             # Modelo PLC / TOON runtime
│   │   │   └── spice.py           # Bridge PySpice / ngspice
│   │   │
│   │   └── transport/             # Comunicação (migrado de dendriforge-transport)
│   │       ├── serial.py          # pyserial — serial-gpio-protocol
│   │       └── ws.py              # WebSocket
│   │
│   └── scripts/                   # Scripts utilitários
│       └── test_ci.py
│
├── tests/
│   ├── test_asl_executor.py
│   ├── test_asl_generators.py
│   └── test_sim.py
│
└── docs/
```

---

## Stack Tecnológico

| Componente          | Tecnologia                            | Motivo                                                                               |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| Motor Core          | **Python 3.13+**                      | Performance nativa aprimorada, gestão avançada de AST e GIL release features         |
| Gestão de Ambiente  | **uv**                                | Instalação de dependências ultrarrápida, substituição total de pip/poetry/virtualenv |
| UI                  | **NiceGUI**                           | Python puro, WebSockets nativos, ideal para dashboards de simulação em tempo real    |
| API                 | **FastAPI + Uvicorn**                 | REST + WebSocket; corre no mesmo processo que o NiceGUI via `ui.run_with(app)`       |
| ASL Parser          | **Lark (PEG/EBNF)**                   | Muito mais limpo que parsers manuais; gramáticas declarativas                        |
| Modelos de dados    | **Pydantic v2**                       | Serialização JSON gratuita, validação automática, compatível com FastAPI             |
| Simulação circuitos | **PySpice + ngspice**                 | Motor externo para SPICE; simulação analógica/digital                                |
| Comunicação série   | **pyserial**                          | Protocolo serial-gpio documentado em `docs/serial-gpio-protocol.md`                  |
| Boards              | **TOON (.toon)**                      | Formato JSON próprio; >100 boards em `dendriforge/core/boards/`                      |
| Configuração        | **python-dotenv + Pydantic Settings** | Substitui `.env` do Node                                                             |
| Testes e Qualidade  | **pytest + ruff + pyright**           | Standard Python ultra-rápido (ruff) e segurança de tipos (pyright)                   |

---

## Apps e Fronteiras de UI

O projecto possui uma separação estrita de responsabilidades entre as suas interfaces:

- **NiceGUI (`dendriforge/ui`)**: Utilizado estritamente como **Developer Tools e Debug Dashboard** local para quem desenvolve o *core* do sistema. Não é o produto virado para o utilizador final.
- **SvelteKit (`apps/webapp`)**: É o **Produto Final Oficial (IDE Web)**, desenhado para utilizadores finais. Apenas comunica com o *core* consumindo os endpoints REST e WebSocket do FastAPI (`/api/v1/...`).

O frontend é um monorepo separado dentro de `apps/` que consome a API Python:

| App                | Tecnologia                                              | Estado                                                   |
| ------------------ | ------------------------------------------------------- | -------------------------------------------------------- |
| `apps/webapp`      | SvelteKit + TypeScript                                  | Frontend web principal (Interface de Utilizador Oficial) |
| `apps/shared`      | TypeScript                                              | Componentes e tipos partilhados                          |
| `apps/schemasmith` | SvelteKit                                               | Editor de schemas de boards                              |
| `apps/desktop`     | Kivy + Python + PyO3 (Rust) + PySpice/ngspice          | Windows + Linux — implementado após Python core estável  |
| `apps/mobile`      | Kivy + Buildozer (mesma base do desktop)               | Android + iOS — implementado após Python core estável    |

---

## Estrutura de Boards

As definições de hardware estão de forma definitiva alocadas em `dendriforge/core/boards/`. O formato principal é `.toon` (>100 boards). Boards suportados incluem:

- **MCU**: Arduino Uno/Mega/Nano, ESP32 (múltiplas variantes), ESP8266, Raspberry Pi Pico (RP2040), STM32F4, ATtiny85, nRF52840, SAMD21
- **PLC**: Siemens S7-1200/S7-300, Allen-Bradley MicroLogix, Omron CP1L, Schneider M221, Mitsubishi FX3U e muitos outros

---

## AI Transpiler

O DendriForge inclui um **AI Transpiler** (Fase 7) que actua como um motor de *fallback*. Quando os parsers determinísticos baseados em Lark/AST não conseguem processar um código complexo ou mal-formado, o sistema pode recorrer a LLMs (OpenAI, Anthropic ou Ollama local) para tentar inferir a semântica ASL e completar a transpilação.

---

## Começar

```bash
# Instalar dependências
pip install -e .

# Ou com uv
uv sync

# Correr
python main.py
```

Abrir `http://localhost:8080`
