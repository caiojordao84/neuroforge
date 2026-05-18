# DendriForge — IMPLEMENTATION_PLAN

## 0. Visão geral

O DendriForge é uma plataforma híbrida para transpilação, simulação, edição visual e execução assistida por IA para microcontroladores, PLCs e sistemas industriais. O ecossistema opera sobre uma arquitetura unificada que garante paridade entre desenvolvimento local e remoto.

O produto final terá três superfícies principais:

- **Web Product** — Portal principal para gestão de contas, projetos, colaboração, ambiente educacional e editor de circuitos via browser.
- **Desktop App** — Ferramenta de engenharia "carro-chefe" com suporte offline, motor de simulação local de baixa latência e acesso direto a hardware via USB/Serial e protocolos industriais.
- **Mobile App** — Interface otimizada para monitorização em campo, diagnóstico de ativos, dashboards de telemetria e edição rápida de parâmetros.

---

#### 0.1 Estado atual e direção

O projeto realiza a transição da herança NeuroForge para uma stack baseada numa **Arquitetura Multi-Processo (Python + Rust via PyO3 + ZeroMQ)**, abandonando abordagens baseadas em WASM no browser. O core lógico (parsers, generators, motor de passo ASL) é compilado em Rust como uma extensão nativa Python para garantir performance de tempo real. A camada de aplicação atua como um *broker* de mensagens, garantindo total isolamento entre a interface do utilizador, a comunicação de rede e a matemática pesada da simulação.

#### 0.2 Princípios do produto

* **TOON + SVG-first** — O arquivo TOON governa a lógica; o SVG provê a geometria. O frontend carrega o SVG apenas uma vez.
* **Delta-Streaming UI** — A interface é um terminal passivo ultrarrápido. O backend nunca envia gráficos, apenas emite *deltas* (diferenças de estado) via WebSocket, deixando a GPU do cliente animar o circuito a 60fps.
* **ASL-first** — A Abstract Simulation Layer (ASL) é a verdade única para tradução e simulação.
* **Offline-capable** — O ambiente desktop corre os exatos mesmos processos ZMQ e workers PyO3 que a infraestrutura cloud, garantindo paridade 1:1 sem latência de rede.
* **BYOK AI** — Flexibilidade para integração de modelos de IA de escolha do utilizador.
* **A11Y & Industrial UX** — Conformidade rigorosa WCAG, focada em previsibilidade e eficiência técnica.

---

## 1. Arquitectura alvo

#### 1.1 Camadas do sistema (Arquitetura Multi-Processo)

Para garantir imunidade a falhas e execução em tempo real realística (scan cycles de 1ms), a arquitetura do DendriForge adota um modelo de **Compartimentalização Extrema**. O sistema é dividido em processos físicos isolados, comunicando via ZeroMQ (ZMQ).

1. **Presentation Layer (O Músculo Gráfico)**
* *Unified Web & Desktop UI* — Frontend que atua como um "dumb terminal" ultrarrápido. Carrega o SVG (DOM) apenas uma vez. Utiliza Konva.js / Vanilla JS para intercetar deltas (JSON) via WebSocket e atualizar as propriedades visuais (`fill`, `stroke`, `class`) a 60fps usando a GPU do cliente.
* *Mobile UI* — PWA / Tauri Mobile para garantir paridade absoluta de UI, focada em painéis de monitorização.
* *Desktop Shell* — Contentor nativo com permissões para I/O local.


2. **Application Layer (Processo A: Orquestração — FastAPI)**
* Gere identidades, HTTP REST, bibliotecas e entrega de WebSockets.
* Age como *Broker ZMQ*: recebe streams de deltas dos motores de simulação e faz o broadcast (fan-out) para os clientes conectados.
* **Isolamento:** Picos de tráfego web nunca afetam a latência da simulação matemática.


3. **Core Layer (Processo B: O Cérebro Digital — Rust + PyO3)**
* Motor lógico nativo compilado em Rust e importado como extensão Python (`dendriforge_core.so`).
* Executa o pipeline ASL, timers, I/O virtual e o *scan cycle* do PLC.
* Liberta o GIL do Python (`py.allow_threads()`) para correr em paralelo à velocidade do C.


4. **Execution Layer (O Sistema Nervoso)**
* **ZeroMQ (ZMQ):** Barramento interno de alta velocidade que liga todos os processos (API, Motor Digital, Solver Analógico, I/O Hardware).
* **Python:** Orquestração de threads assíncronas (`asyncio`) para networking e hardware.
* **Rust via PyO3:** Executável nativo injetado no Python para as partes críticas: parsing ASL, geração de netlists, *sim loop* determinístico. Como liberta o GIL, atinge performance C-like no backend.
* **Ngspice:** Worker analógico acoplado via biblioteca partilhada (`libngspice`), estritamente confinado ao seu próprio processo ZMQ para evitar que problemas de convergência afetem o resto da app.


5. **Transport Layer (I/O Desacoplado - Actor Model)**
* Workers assíncronos (`asyncio`) dedicados a falar com hardware físico (USB, Serial, Modbus TCP/RTU). Depositam dados na memória partilhada do Processo B, garantindo que o hardware lento (ex: Baud Rate 9600) nunca bloqueie o loop de simulação.



#### 1.2 Papéis das tecnologias

| Tecnologia | Papel |
| --- | --- |
| Python (FastAPI) | Processo A: Orquestração REST, gestão de sessões, roteamento de WebSockets. |
| ZeroMQ (ZMQ) | Barramento IPC ultrarrápido entre os Processos (A ↔ B ↔ C). |
| Rust (via PyO3) | Processo B: Motor de ASL, Parsing, execução de lógica determinística de baixa latência. Substitui a abordagem WASM. |
| JS / Konva.js | Frontend: Renderização e animação SVG no browser/desktop orientada a eventos (deltas). |
| Ngspice | Processo C: Solver analógico confinado para proteção contra crashes. |
| SQLite/PostgreSQL | Storage local e cloud. |

---

## 2. O papel central do ASL

### 2.1 ASL como Esperanto técnico

O ASL é **pedra de Roseta** do DendriForge. Todas as linguagens entram em parsers específicos, são convertidas para um IR único, e depois saem por generators específicos.

Fluxo canónico:

```text
Source Language
  -> Parser
  -> ASL IR
  -> Normalizer
  -> Analyzer
  -> Optimizer
  -> Library Resolver
  -> Target Generator
  -> Output Language / Firmware / Simulation Artifact
```

### 2.2 O que o ASL precisa suportar

- Literais, expressões, statements, blocos, funções, variáveis.
- Tipos básicos: bool, int, float, string, byte, word, arrays, structs, enums.
- Tempo: timers, delays, scan cycles, periodic tasks.
- IO: GPIO, PWM, ADC, DAC, UART, I2C, SPI, CAN, Modbus, Ethernet.
- Industrial control: contacts, coils, rungs, FBs, SFC steps, transitions, actions.
- Eventos: rising edge, falling edge, interrupts, schedules, watchers.
- Segurança e políticas: permissões de IO, zonas de rede, safety annotations.
- Simulation hooks: probes, watchpoints, virtual sensors, fault injection.
- Board binding: mapeamento lógico para recursos reais do board/PLC.
- Component binding: ligação entre nós ASL e componentes simulados.

### 2.3 ASL e bibliotecas

O ASL terá um **sistema de bibliotecas multi-origem**:

- Biblioteca nativa ASL.
- Biblioteca de wrappers de Arduino/MicroPython/Rust/HAL.
- Biblioteca IEC 61131-3.
- Biblioteca de blocos industriais.
- Biblioteca de sensores/actuadores simulados.
- Biblioteca de funções de classroom.
- Biblioteca de segurança/diagnóstico.

Cada biblioteca terá:

- `manifest.toonlib` ou `library.toml`
- Assinatura pública
- Compatibilidade por linguagem, board e runtime
- Versão semântica
- Documentação, exemplos, testes de transpile e testes de simulação

### 2.4 ASL e simulação

O ASL não servirá apenas para transpilar; ele será também a linguagem interna da simulação. Isso permite:

- Executar firmware lógico sem compilar para hardware real.
- Injectar sinais em GPIOs virtuais.
- Ligar código a sensores e actuadores simulados.
- Correr PLC scan cycles, timers e eventos no mesmo runtime.
- Depurar com breakpoints sem depender da linguagem de origem.

### 2.5 TOON aumentado pelo ASL

O formato TOON será expandido para suportar não apenas boards, mas também: componentes simulados, módulos PLC, bindings de bibliotecas, metadata de visualização, modelos eléctricos simplificados, componentes compostos, portas lógicas, sensores/actuadores, perfis de classroom e perfis de segurança.

O princípio é:

- **SVG** = geometria, hotspots, pinos, LEDs, botões, áreas sensíveis.
- **TOON** = semântica, IO, protocolos, electrical profile, simulation contract, library bindings.
- **ASL** = comportamento.

### 2.6 TOON ASL exemplo

```

# METADATA:
project_name: blink-standard
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0
original_language: C++ (Arduino)

# 1. SETTINGS & ENVIRONMENT:
settings:
  grid_size: 2.54
  snap_enabled: true
  last_modified: 2024-05-20T10:00:00Z
  v_ambient: 25
  h_ambient: 82
  power_source: usb
  power_analysis:
    total_current_draw: 57.2mA
    breakdown: {MC_0: 45mA, led1: 12.2mA}
    status: safe

# 2. HARDWARE CONFIGURATION:
parts:
  - id: MC_0
    type: arduino-uno-r3
    top: 0
    left: 0
  - id: led1
    type: simple_led
    top: -119.38
    left: 71.12
    attrs: {color: red}
  - id: r1
    type: resistor
    top: -53.34
    left: 20.32
    attrs:
      value: 330
      unit: ohm
      power: 500mW
      tolerance: 1
      body_color: skyblue
      color_bands: orange,orange,black,black,brown

# 3. NETLIST:
connections:
  - ["MC_0:13", "led1:A", "green", "v0"]
  - ["r1:1", "led1:C", "black", "v0"]
  - ["r1:2", "MC_0:GND.1", "black", "v0"]

# 4. ASL PROGRAM:
requirements[1]:
  - {lib: arduino-core, critical: true}
  
tasks[2]:
  - scope: setup
    body[1]:
      - {kind: pinMode, pin: 13, mode: OUTPUT}
      
  - scope: loop
    body[4]:
      - {kind: digitalWrite, pin: 13, value: HIGH}
      - {kind: delay, ms: 1000}
      - {kind: digitalWrite, pin: 13, value: LOW}
      - {kind: delay, ms: 1000}
	  
```
	  
	1. METADATA (Cabeçalho de Identidade)
Este bloco define a origem e a versão do projeto.

  - project_name: Identificador único do projeto para fins de salvamento e exportação.
  - ASLversion: Garante compatibilidade com o motor de simulação e os parsers.
  - original_language: Informa ao transpiler qual era a linguagem de origem para auxiliar em otimizações ou retrocompatibilidade.

	2. SETTINGS & ENVIRONMENT (Configurações e Contexto)
Define as condições físicas e operacionais do editor e da simulação.

  - v_ambient / h_ambient: Variáveis ambientais para simulações térmicas e de estresse de sensores.
  - power_analysis: Um resumo dinâmico do consumo elétrico previsto. Essencial para validação de segurança antes da conexão física (ex: evitar sobrecarga na porta USB).

	3. HARDWARE CONFIGURATION (Gêmeo Digital)
Lista os componentes presentes na "mesa de trabalho".

  - id / type: Diferencia a instância (ex: r1) do seu modelo na biblioteca (ex: resistor).
  - top / left: Coordenadas cartesianas que alinham a semântica do TOON à representação visual no canvas.
  - attrs: Propriedades elétricas e visuais específicas (resistência, cor do LED, faixas de cor do resistor).

	4. NETLIST (Conexões)
Descreve a malha elétrica do circuito.

  - Formato: ["Origem:Pino", "Destino:Pino", "Cor", "Versão_da_Ligação"].
  - Esta seção permite ao motor de simulação calcular a continuidade elétrica e injetar sinais do código nos componentes simulados (Component Binding).

	5. ASL PROGRAM (Lógica Agnóstica)
É a "Pedra de Roseta" que converte lógica em comportamento.

  - requirements: Lista de bibliotecas (manifests) necessárias. O transpiler usa isto para carregar os HALs (Hardware Abstraction Layers) corretos para MicroPython ou C++.
  - tasks: Blocos de execução lógica.
  - scope: Define o contexto de execução (inicialização ou ciclo contínuo).
  - body: Contém a lista ordenada de instruções estruturadas em pares kind (comando) e params (argumentos).


---

## 3. Standards industriais

### 3.1 O que é "linguagem" e o que é "modelo"

Nem tudo nesta lista deve virar parser textual directo:

- **IEC 61131-3** — tem linguagens executáveis; parser e generator completos.
- **IEC 61499** — tem blocos/eventos e modelação executável; entra como model interno, import/export `.fbt`/`.sys`.
- **IEC 61850** — não é linguagem de programação geral; entra como modelo, schema, object model e export/import.
- **IEC 62061** — safety lifecycle e modelação de requisitos; entra como validação, hazard model e compliance metadata.
- **ISA/IEC 62443** — security model, policies, zoning, conduits, hardening templates; entra como política, auditoria e deployment profile.

*(→ implementação em B.6)*

### 3.2 Estratégia por standard

**IEC 61131-3**
- Parsers/generators para ST, LD, FBD, SFC e IL (IL apenas parser — standard deprecated em ed. 3, necessário para import de legado).
- Runtime de scan cycle.
- Debug por rungs, coils, contacts e FBs.
- Simulação com IO virtuais e reais.

**IEC 61499**
- Model interno para event-driven function blocks.
- Editor visual.
- Import/export de block networks (`.fbt`/`.sys`).
- Mapeamento para ASL com eventos, ports e actions.

**IEC 61850**
- Import de modelos lógicos.
- Mapeamento de logical nodes para ASL/TOON.
- Templates de subestações e sinais.
- Simulação de publishing/subscribing e estados.

**IEC 62061**
- Safety annotations no projecto.
- Regras de verificação.
- Trilhos de aprovação.
- Relatórios de risco e impacto.

**IEC 62443 / ISA/IEC 62443**
- Modelos de zona e conduta.
- Hardening profiles para gateways e PLCs.
- Auditoria de alterações.
- Perfis por tenant industrial.

---

## 4. Design system e A11Y

### 4.1 Visual industrial moderno

Direcção visual:

- Fundo escuro técnico.
- Superfícies em grafite, petróleo e aço.
- Destaques em ciano industrial, âmbar de estado e verde de execução.
- Bordas discretas.
- Tipografia clara, densa, mas respirável.
- Ícones funcionais, não decorativos.

### 4.2 Paleta base WCAG-aligned

O repositório tem os estilos `.css` em `dendriforge/core/styles/dendriForge-A11Y-Slate.css`.

| Token | Hex | Name | Uso |
|---|---|---|---|
| `--df-bg-main` | `#0f172a` | slate-900 | Background principal da app |
| `--df-bg-panel` | `#020617` | slate-950 | Background de painéis/sidebars escuros |
| `--df-bg-sidebar` | `#1b1e2b` | — | Background da sidebar |
| `--df-bg-editor` | `#2b2b2b` | — | Background do editor de código |
| `--df-bg-hover` | `#1e293b` | slate-800 | Background em hover / sim comp |
| `--df-bg-terminal` | `var(--df-bg-main)` | slate-900 | Background do terminal |
| `--df-border-main` | `var(--df-bg-hover)` | slate-800 | Bordas principais / scrollbar track |
| `--df-border-light` | `#334155` | slate-700 | Bordas leves |
| `--df-border-subtle` | `#475569` | slate-600 | Bordas subtis / scrollbar thumb / sim stroke |
| `--df-text-main` | `#e2e8f0` | slate-200 | Texto de corpo principal |
| `--df-text-heading` | `#f8fafc` | slate-50 | Títulos e labels |
| `--df-text-muted` | `#94a3b8` | slate-400 | Texto secundário/muted |
| `--df-color-slate-muted` | `#64748b` | slate-500 | Source of truth: faded/disconnected/pin-low |
| `--df-text-faded` | `var(--df-color-slate-muted)` | slate-500 | Texto apagado / scrollbar thumb hover |
| `--df-status-disconnected` | `var(--df-color-slate-muted)` | slate-500 | Badge: desligado |
| `--df-sim-pin-low` | `var(--df-color-slate-muted)` | slate-500 | Pino digital em LOW |
| `--df-accent-sky` | `#38bdf8` | sky-400 | Accent principal / wire default / status live / focus ring |
| `--df-accent-sky-light` | `#00b4d8` | — | Accent sky alternativo |
| `--df-accent-amber` | `#f59e0b` | amber-500 | Accent âmbar / status paused |
| `--df-accent-amber-light` | `#fbbf24` | yellow-400 | Amber claro |
| `--df-accent-orange` | `#ff8c00` | — | Botão primário / reset hover / led-orange |
| `--df-accent-orange-dim` | `#7c3f00` | — | Botão primário hover / reset active |
| `--df-accent-rose` | `#f43f5e` | rose-500 | Danger / status fault / led-red |
| `--df-accent-emerald` | `#34d399` | emerald-400 | Success / status running / sim pin high / led-green / led-power |
| `--df-accent-cyan` | `#22d3ee` | cyan-400 | Accent cyan / status virtual |
| `--df-accent-magenta` | `#d946ef` | fuchsia-500 | Accent magenta |
| `--df-accent-purple` | `#a78bfa` | violet-400 | Accent purple / status manual |
| `--df-accent-purple-light` | `#e9d5ff` | purple-200 | Purple claro |
| `--df-status-running` | `var(--df-accent-emerald)` | emerald-400 | Badge: a correr |
| `--df-status-paused` | `var(--df-accent-amber)` | amber-500 | Badge: pausado |
| `--df-status-fault` | `var(--df-accent-rose)` | rose-500 | Badge: erro/falha |
| `--df-status-manual` | `var(--df-accent-purple)` | violet-400 | Badge: controlo manual |
| `--df-status-live` | `var(--df-accent-sky)` | sky-400 | Badge: live/hardware real |
| `--df-status-virtual` | `var(--df-accent-cyan)` | cyan-400 | Badge: simulação virtual |
| `--df-sim-comp-bg` | `var(--df-bg-hover)` | slate-800 | Fundo de componente de simulação |
| `--df-sim-comp-mcu` | `var(--df-bg-main)` | slate-900 | Fundo do MCU na simulação |
| `--df-sim-comp-stroke` | `var(--df-border-subtle)` | slate-600 | Contorno do componente de simulação |
| `--df-sim-wire-default` | `var(--df-accent-sky)` | sky-400 | Fio padrão |
| `--df-sim-wire-vcc` | `#ef4444` | red-500 | Fio VCC (positivo) |
| `--df-sim-wire-gnd` | `var(--df-pin-gnd)` | — | Fio GND (neutro) |
| `--df-sim-pin-high` | `var(--df-accent-emerald)` | emerald-400 | Pino digital em HIGH |
| `--df-sim-multimeter` | `#eab308` | yellow-500 | Multímetro na simulação |
| `--df-led-off-base` | `#1a1a1a` | — | LED estado base (não inicializado) |
| `--df-led-off-idle` | `#2a2a2a` | — | LED estado off explícito |
| `--df-led-color-orange` | `var(--df-accent-orange)` | — | Cor do LED laranja aceso |
| `--df-led-color-yellow` | `var(--prism-number)` | — | Cor do LED amarelo aceso (TX/RX) |
| `--df-led-color-green` | `var(--df-accent-emerald)` | emerald-400 | Cor do LED verde aceso (Power) |
| `--df-led-color-red` | `var(--df-accent-rose)` | rose-500 | Cor do LED vermelho aceso |
| `--df-led-glow-orange` | `#ff8c00aa` | — | Sombra glow do LED laranja |
| `--df-led-glow-yellow` | `#ffd700aa` | — | Sombra glow do LED amarelo (TX/RX) |
| `--df-led-glow-green` | `#34d399aa` | — | Sombra glow do LED verde |
| `--df-led-glow-red` | `#f43f5eaa` | — | Sombra glow do LED vermelho |
| `--df-led-glow-green-dim` | `#34d39944` | — | Glow dim do LED verde (keyframe off) |
| `--df-led-glow-yellow-off` | `#ffd70000` | — | Glow zero do LED amarelo (keyframe off) |
| `--prism-bg` | `#2b2b2b` | — | Background do bloco de código |
| `--prism-fg` | `#f8f8f2` | — | Texto de código (13.28:1 AAA) |
| `--prism-comment` | `#d4d0ab` | — | Comentários (9.04:1 AAA) |
| `--prism-keyword` | `#ffa07a` | — | Keywords / tags (7.12:1 AAA) |
| `--prism-string` | `#abe338` | — | Strings / selectors (9.29:1 AAA) / --df-pin-analog |
| `--prism-number` | `#ffd700` | — | Números / booleans (10.09:1 AAA) / --df-led-color-yellow |
| `--prism-function` | `#60caff` | — | Funções / atrule (8.00:1 AAA) / --df-pin-spi |
| `--prism-operator` | `#00e0ff` | — | Operadores / property / url (11.14:1 AAA) / --df-pin-digital |
| `--prism-type` | `#dcc6e0` | — | Tipos / class-name (8.90:1 AAA) / --df-pin-i2c |
| `--prism-macro` | `#c4b5fd` | — | Macros / regex / directives (7.50:1 AAA) / --df-pin-uart |
| `--df-pin-digital` | `var(--prism-operator)` | — | Pino digital (11.14:1 AAA) |
| `--df-pin-pwm` | `#ffb347` | — | Pino PWM (10.02:1 AAA) / interrupt stroke |
| `--df-pin-analog` | `var(--prism-string)` | — | Pino analógico (11.71:1 AAA) |
| `--df-pin-power` | `#fc8181` | — | Pino de alimentação (7.31:1 AAA) |
| `--df-pin-gnd` | `#a0aec0` | — | Pino GND (7.91:1 AAA) / --df-pin-aref / --df-sim-wire-gnd |
| `--df-pin-i2c` | `var(--prism-type)` | — | Pino I2C SDA/SCL (11.22:1 AAA) |
| `--df-pin-spi` | `var(--prism-function)` | — | Pino SPI (9.68:1 AAA) |
| `--df-pin-uart` | `var(--prism-macro)` | — | Pino UART TX/RX (9.67:1 AAA) |
| `--df-pin-nc` | `#ff8080` | — | Pino NC (Not Connected) (7.35:1 AAA) |
| `--df-pin-icsp` | `#94d2bd` | — | Pino ICSP (8.12:1 AAA) |
| `--df-pin-reset` | `#fb923c` | — | Pino RESET (7.98:1 AAA) |
| `--df-pin-aref` | `var(--df-pin-gnd)` | — | Pino AREF (7.91:1 AAA) |

Regras:

- Texto normal: AA no mínimo.
- Labels pequenas críticas: AAA quando possível.
- Nunca usar cor como único indicador.
- Foco visível sempre.
- Estados devem combinar cor + ícone + texto + padrão.
- Estilos em `dendriforge/core/styles`.
- Utilizar glow sólido discreto #f8fafc aos wires para destacar contra o fundo escuro, para auxiliar utilizadores com baixa visão.

### 4.3 Estados de simulação

| Estado | Gatilho | Combinação visual |
|---|---|---|
| Running | Execução activa | Verde + ícone play + dot pulsante |
| Paused | Break point ou pausa manual | Âmbar + ícone pause |
| Fault | Erro de runtime / watchdog | Vermelho + ícone ⚠ + texto de erro |
| Disconnected | Sem ligação ao device/simulador | Cinza + ícone offline |
| Manual Override | Operador tomou controlo | Violeta + ícone mão |
| Live Hardware | Ligado a hardware físico real | Azul + ícone chip + dot pulsante |
| Virtual Simulation | Simulador interno (user side) | Ciano + ícone CPU virtual |

---

## 5. Catálogo de assets

### 5.1 Boards

O repositório já contém uma base ampla de boards e PLCs em `dendriforge/core/boards`, incluindo `.toon`, `.svg`; cada arquivo `.toon` deve ser acompanhado de seu `.svg` para a simulação funcionar. Esta lista é viva e serve de refeência, a mesma pode ser modificada pelo operador principal a qualquer hora. 
As regras e o validador dos arquivos `.toon` estão em `dendriforge/core/boards/rules`.

> **Nota:** *profile* = representação visual e de pinout para uso no simulador. Não haverá emulação completa do hardware ou runtime proprietário.

## Fase 1 — Core/MVP

- Arduino (Uno R3, Mega 2560, Nano, Leonardo, Micro, Due, MKR WiFi 1010, Opta WiFi, Nano 33 BLE Sense, Nano 33 IoT)
- Raspberry Pi (Pico, Pico 2, Zero 2 W)
- ESP32 (DevKitC V4)
- STM32 (Blue Pill, Black Pill)
- Virtual / Generic (PLC 16 I/O, PLC 32 I/O)

---

## Fase 2 — Community/Pro

- Arduino Extended (Uno R4 WiFi, Nano R4, Nano ESP32, Nano RP2040, Nano RP2040 Connect, Nano Every, M0, Zero, Pro Mini, MKR WAN 1310, GIGA R1 WiFi, Portenta Machine Control)
- Adafruit Feather / Metro (Feather RP2040, Feather M0, Feather ESP32 V2, Feather nRF52840, Metro M4, Grand Central M4)
- Seeed Studio XIAO (SAMD21, RP2040, ESP32-C3, ESP32-S3, nRF52840, nRF54L15)
- Raspberry Pi Variants (Pico W, Pico 2 W)
- ESP32 Variants (DevKit V1, C3, C6, S2, S3, Wrover, H2, P4, NodeMCU ESP8266, Wemos D1 Mini)
- Maker Boards (M5Stack Core2, M5Stack AtomS3, LilyGO T-Display-S3, Waveshare RP2040-Zero)
- Nordic Semiconductor (nRF52 DK, nRF52840 Dongle, nRF9160 DK, nRF7002 DK)
- Sparkfun / PJRC Teensy (Pro Micro, Teensy 3.2, 3.5, 3.6)
- Texas Instruments (MSP430 LaunchPad, Tiva C TM4C123, TM4C129)
- Silicon Labs (EFM32 Giant Gecko, EFR32 Blue Gecko)
- NXP LPCXpresso (LPC11U68, LPC1769)
- Renesas (RA4M1 FPB, RL78 Target Board)
- Infineon XMC (XMC1100, XMC2Go, XMC4500)
- STM32 Nucleo / Discovery (Discovery F4, F7, Nucleo F103RB, F401RE, G0B1RE, L476RG)
- Microchip AVR / PIC (AVR Xplained Mini 168PB, 328P, Curiosity HPC, Curiosity Nano PIC16, PIC18, PICkit)
- Controllino (Mini, Maxi, Mega)
- Allen-Bradley Compact (Micro820, Micro850, Micro870, MicroLogix 1000, 1100, 1400)
- Allen-Bradley Modular (CompactLogix 5069, 5370, 5380, ControlLogix 1756, 5570, 5580, FlexLogix 1794)
- Beckhoff CX (CX2020, CX5120, CX9020)
- Berghof (B-IPC, B-X20)
- Siemens Legacy (S7-300, S7-400, ET200SP)
- OpenPLC (Arduino, ESP32, Raspberry Pi)
- Industrial Shields (M-DIN Arduino, M-DIN ESP32, RPi PLC)

---

## Fase 3 — Industrial/Extended

- Siemens S7-1200 (CPU 1211C, 1212C, 1214C)
- Siemens S7-1500 (CPU 1511C, 1513C, 1515C, 1516C)
- Siemens LOGO! (0BA3, 0BA12)
- Wago (CC100, PFC100, PFC200)
- Schneider / Modicon (M221, M241, M251, M340, M262, M580, Zelio Logic)
- Omron (CP1E, CP1H, CP1L, NJ501, NX1P2)
- Mitsubishi (FX3U, FX5U, iQ-R R04, R08, R16)
- ABB AC500 (PM564, PM5630)
- Delta Electronics (DVP ES2, AS300, AH500)
- GE / Emerson (RX3i, VersaMax)
- Keyence (KV-5500, KV-8000)
- Panasonic (FP0R, FP-X)
- Horner APG (XL4, XL7)
- IDEC (FC6A Plus)
- B&R (X20 CP1586)
- Phoenix Contact PLCnext (AXC F 2152)
- Eaton (easyE4, XV300)
- Opto22 (Groov EPIC PR1, SNAP PAC R1)
- Revolution Pi (Compact, Connect, Core 3)
- Unitronics UniStream (B10, USP)
- CODESYS (Virtual PLC)

---

### 5.2 PLCs

O catálogo de PLCs separa:

- **Virtual PLCs** — implementação simulada completa
- **Real PLC profiles** — representação visual e de I/O, sem emulação de runtime
- **Hybrid controllers** — hardware com capacidade PLC (ex: Arduino Opta, Controllino)
- **Soft PLC runtimes** — CODESYS, Beckhoff TwinCAT, Straton
- **Classroom PLCs** — perfis simplificados para contexto educativo

---

### 5.3 Componentes Simulados

> Repositório base: `dendriforge/core/components` (`.toon` + `.svg` por componente)  
> Lista viva — pode ser modificada pelo operador principal a qualquer momento.
> 9 famílias · 50 subfamílias · ~450 componentes*

---

## Elétricos Fundamentais

### Fontes
- Fonte DC                              | dc-source
- Fonte AC                              | ac-source
- Fonte AC trifásica                    | ac-source-3phase
- Bateria                               | battery
- Fonte de bancada                      | bench-supply
- Fonte PWM                             | pwm-source
- Gerador de sinais                     | signal-generator
- Fonte de corrente ideal               | current-source
- Fonte de ruído                        | noise-source
- Fonte solar / painel fotovoltaico     | solar-panel-source

### Passivos
- Resistor                              | resistor
- Potenciómetro                         | potentiometer
- Trimmer                               | trimmer
- Pack pull-up / pull-down              | pullup-pulldown-pack
- Ladder de resistores                  | resistor-ladder
- Capacitor                             | capacitor
- Indutor                               | inductor
- Transformador                         | transformer
- Cristal / oscilador                   | crystal-oscillator
- NTC                                   | thermistor-ntc
- PTC                                   | thermistor-ptc
- Shunt resistivo                       | shunt-resistor

### Semicondutores
- LED                                   | led
- LED RGB                               | led-rgb
- Display 7 segmentos                   | display-7seg
- Matriz LED                            | led-matrix
- Diodo                                 | diode
- Diodo Schottky                        | diode-schottky
- Diodo Zener                           | diode-zener
- Diodo TVS                             | diode-tvs
- BJT NPN                               | bjt-npn
- BJT PNP                               | bjt-pnp
- Foto-transístor                       | phototransistor
- Optoacoplador                         | optocoupler
- MOSFET N                              | mosfet-n
- MOSFET P                              | mosfet-p
- IGBT                                  | igbt
- SCR / tirístor                        | scr-thyristor
- Triac                                 | triac
- Ponte H                               | h-bridge
- Driver de relé                        | relay-driver
- SSR                                   | ssr

### Proteção Elétrica
- Fusível                               | fuse
- Disjuntor miniatura                   | mcb
- Disjuntor motor                       | motor-circuit-breaker
- Varistor MOV                          | varistor-mov
- TVS de linha                          | tvs-line
- Ferrite bead                          | ferrite-bead
- Supressor RC                          | rc-snubber
- Proteção inversão de polaridade       | reverse-polarity-protection
- Proteção sobrecorrente eletrónica     | overcurrent-protection
- Proteção sobretensão                  | overvoltage-protection

### Interligação e Distribuição
- Terminal de alimentação DC            | terminal-dc-power
- Terminal AC                           | terminal-ac-power
- Bornes plugáveis                      | pluggable-terminals
- Header macho/fêmea                    | header-pin
- Jumper / ponte                        | jumper
- Barramento positivo                   | busbar-positive
- Barramento negativo                   | busbar-negative
- Barramento PE / terra                 | busbar-pe
- Bloco distribuidor                    | distribution-block
- Conector rápido industrial            | industrial-quick-connector

---

## Sensores

### Sensores de Ambiente
- LDR                                   | sensor-ldr
- Termístor                             | sensor-thermistor
- Temperatura                           | sensor-temperature
- Temperatura e humidade                | sensor-temp-humidity
- Pressão barométrica                   | sensor-barometric-pressure
- Gás série MQ                          | sensor-gas-mq
- Chuva                                 | sensor-rain
- Humidade do solo                      | sensor-soil-moisture
- Cor                                   | sensor-color
- Receptor IR                           | sensor-ir-receiver
- UV                                    | sensor-uv
- Qualidade do ar / VOC                 | sensor-air-quality-voc
- CO2                                   | sensor-co2
- Luminosidade digital                  | sensor-light-digital

### Sensores de Movimento e Posição
- Ultrassónico                          | sensor-ultrasonic
- PIR                                   | sensor-pir
- Hall                                  | sensor-hall
- Tilt sensor                           | sensor-tilt
- Encoder incremental                   | sensor-encoder-incremental
- Encoder absoluto                      | sensor-encoder-absolute
- Encoder rotativo manual               | sensor-rotary-encoder
- IMU 6 eixos                           | sensor-imu-6axis
- IMU 9 eixos                           | sensor-imu-9axis
- Sensor táctil capacitivo              | sensor-touch-capacitive
- Flex sensor                           | sensor-flex
- Fim de curso mecânico                 | sensor-limit-switch
- Sensor magnético de posição           | sensor-magnetic-position
- Sensor de distância ToF               | sensor-tof-distance

### Sensores Elétricos
- Sensor de corrente                    | sensor-current
- Sonda divisor de tensão               | sensor-voltage-divider
- Sensor de tensão isolado              | sensor-voltage-isolated
- Transdutor 4-20 mA                    | sensor-4-20ma-transducer
- Transformador de corrente             | sensor-current-transformer
- Sensor de potência                    | sensor-power
- Shunt monitor                         | sensor-shunt-monitor
- Detetor de fase                       | sensor-phase-detector
- Monitor de frequência                 | sensor-frequency-monitor
- Detetor de zero-cross                 | sensor-zero-cross

### Sensores de Processo
- Transmissor de pressão                | sensor-pressure-transmitter
- Pressostato                           | sensor-pressure-switch
- Sensor de caudal                      | sensor-flow
- Caudalímetro mássico virtual          | sensor-mass-flow
- Sensor de nível boia                  | sensor-level-float
- Sensor de nível ultrassónico          | sensor-level-ultrasonic
- Sensor de nível capacitivo            | sensor-level-capacitive
- Load cell / strain gauge              | sensor-load-cell
- Sensor de pH                          | sensor-ph
- Sensor de condutividade               | sensor-conductivity
- Sensor ORP                            | sensor-orp
- Sensor de turbidez                    | sensor-turbidity

### Sensores Industriais de Presença e Segurança
- Sensor indutivo                       | sensor-inductive
- Sensor capacitivo                     | sensor-capacitive
- Sensor fotoelétrico barreira          | sensor-photoelectric-barrier
- Sensor fotoelétrico retro-reflexivo   | sensor-photoelectric-retroreflective
- Sensor fotoelétrico difuso            | sensor-photoelectric-diffuse
- Sensor laser de distância             | sensor-laser-distance
- Cortina de luz de segurança           | sensor-light-curtain-safety
- Tapete de segurança                   | sensor-safety-mat
- Chave magnética de porta              | sensor-magnetic-door-switch
- Interlock de segurança                | sensor-safety-interlock
- Scanner de segurança stub             | sensor-safety-scanner-stub

---

## Elementos de Comando

### Pushbuttons momentâneos
- Pushbutton NO start                   | cmd-pushbutton-no-start
- Pushbutton NC stop                    | cmd-pushbutton-nc-stop
- Pushbutton changeover                 | cmd-pushbutton-changeover
- Pushbutton iluminado NO               | cmd-pushbutton-lit-no
- Pushbutton iluminado NC               | cmd-pushbutton-lit-nc
- Pushbutton duplo bimanual             | cmd-pushbutton-two-hand
- Mushroom head não-segurança           | cmd-mushroom-head
- Foot switch NO                        | cmd-foot-switch-no
- Foot switch NC                        | cmd-foot-switch-nc

### Selectors e switches mantidos
- Selector 2 posições NO/NC             | cmd-selector-2pos-nonc
- Selector 2 posições changeover        | cmd-selector-2pos-changeover
- Selector 3 posições 0-1-2             | cmd-selector-3pos-012
- Selector 3 posições spring return     | cmd-selector-3pos-spring
- Selector rotativo multiposição        | cmd-selector-rotary-multi
- Key switch manual/auto/off            | cmd-key-switch
- Interruptor basculante                | cmd-toggle-switch
- Interruptor alavanca                  | cmd-lever-switch
- Comutador cam                         | cmd-cam-switch

### Comandos de emergência e segurança
- E-Stop mushroom changeover            | cmd-estop-mushroom
- E-Stop key release                    | cmd-estop-key-release
- E-Stop rope pull                      | cmd-estop-rope-pull
- Safety gate switch                    | cmd-safety-gate-switch
- Enabling switch 3 posições            | cmd-enabling-switch-3pos
- Reset de segurança                    | cmd-safety-reset
- Botão acknowledge safety              | cmd-safety-acknowledge

### Sinalizadores de painel
- Piloto verde 24VDC                    | signal-pilot-lamp-green
- Piloto amarelo 24VDC                  | signal-pilot-lamp-yellow
- Piloto vermelho 24VDC                 | signal-pilot-lamp-red
- Piloto azul 24VDC                     | signal-pilot-lamp-blue
- Piloto branco 24VDC                   | signal-pilot-lamp-white
- Piloto pulsante                       | signal-pilot-lamp-flashing
- Buzzer industrial                     | signal-buzzer-industrial
- Sirene                                | signal-siren
- Stack light 3 cores                   | signal-stack-light-3
- Stack light 5 cores                   | signal-stack-light-5

### Interfaces manuais especiais
- Joystick 2 eixos                      | cmd-joystick-2axis
- Joystick 2 eixos com pushbutton       | cmd-joystick-2axis-btn
- Joystick 3 eixos                      | cmd-joystick-3axis
- Handwheel / MPG                       | cmd-handwheel-mpg
- Pedal analógico                       | cmd-pedal-analog
- Painel operador simples               | cmd-operator-panel
- Leitor RFID / badge                   | cmd-rfid-reader
- Leitor código de barras stub          | cmd-barcode-reader-stub

---

## Atuadores

### Atuadores elétricos maker / prototipagem
- Buzzer                                | act-buzzer
- Servo                                 | act-servo
- Motor DC                              | act-motor-dc
- Motor passo-a-passo                   | act-stepper-motor
- Motor de vibração                     | act-vibration-motor
- Ventoinha DC                          | act-fan-dc
- Fita RGB                              | act-rgb-strip
- Lâmpada                               | act-lamp
- Relé maker                            | act-relay-maker
- Micro bomba DC                        | act-micro-pump-dc

### Atuadores elétricos industriais
- Relé                                  | act-relay-industrial
- Relé de estado sólido                 | act-ssr-industrial
- Contactor                             | act-contactor
- Travão eletromagnético                | act-electromagnetic-brake
- Elemento aquecedor PTC                | act-heater-ptc
- Resistência cartucho                  | act-cartridge-heater
- Motor AC monofásico                   | act-motor-ac-1ph
- Motor AC trifásico                    | act-motor-ac-3ph
- Ventilador industrial                 | act-fan-industrial
- Sirene industrial                     | act-siren-industrial

### Acionamento e partida de motores
- Arranque direto DOL                   | act-starter-dol
- Arranque estrela-triângulo            | act-starter-star-delta
- Soft starter                          | act-soft-starter
- VFD / inversor de frequência          | act-vfd
- Servo drive                           | act-servo-drive
- Drive DC                              | act-drive-dc
- Starter reversível                    | act-starter-reversible
- Proteção térmica de motor             | act-motor-thermal-protection

### Atuadores lineares e válvulas acionadas
- Atuador linear                        | act-linear-actuator
- Solenóide linear                      | act-solenoid-linear
- Válvula solenóide genérica            | act-solenoid-valve-generic
- Válvula proporcional elétrica         | act-proportional-valve-electric
- Damper actuator                       | act-damper-actuator
- Atuador rotativo elétrico             | act-rotary-actuator-electric
- Lock / trinco elétrico                | act-electric-lock

---

## Pneumática

### Atuadores pneumáticos
- Cilindro simples efeito retorno mola  | pneu-cylinder-sa-spring
- Cilindro simples efeito retorno ar    | pneu-cylinder-sa-air
- Cilindro duplo efeito                 | pneu-cylinder-da
- Cilindro DA com amortecimento         | pneu-cylinder-da-cushioned
- Cilindro compacto ISO 21287           | pneu-cylinder-compact
- Cilindro guiado                       | pneu-cylinder-guided
- Cilindro sem haste com carro          | pneu-cylinder-rodless
- Cilindro telescópico                  | pneu-cylinder-telescopic
- Garra pneumática paralela             | pneu-gripper-parallel
- Garra pneumática angular              | pneu-gripper-angular
- Atuador rotativo de palheta           | pneu-rotary-vane
- Atuador rotativo de cremalheira       | pneu-rotary-rack
- Motor pneumático de palhetas          | pneu-motor-vane
- Muscle / atuador de membrana          | pneu-muscle-actuator

### Válvulas direcionais pneumáticas
- Válvula 2/2 NC                        | pneu-valve-2-2-nc
- Válvula 2/2 NO                        | pneu-valve-2-2-no
- Válvula 3/2 NC solenóide              | pneu-valve-3-2-nc-sol
- Válvula 3/2 NO solenóide              | pneu-valve-3-2-no-sol
- Válvula 3/2 mecânica                  | pneu-valve-3-2-mech
- Válvula 3/2 manual                    | pneu-valve-3-2-manual
- Válvula 5/2 monoestável               | pneu-valve-5-2-mono
- Válvula 5/2 biestável                 | pneu-valve-5-2-bi
- Válvula 5/3 centro fechado            | pneu-valve-5-3-closed
- Válvula 5/3 centro pressurizado       | pneu-valve-5-3-pressurized
- Válvula 5/3 centro aberto             | pneu-valve-5-3-open
- Válvula de retenção                   | pneu-check-valve
- Válvula shuttle                       | pneu-shuttle-valve
- Válvula de duplo bloqueio             | pneu-dual-check-valve
- Válvula de sequência                  | pneu-sequence-valve

### Controlo de caudal e pressão pneumático
- Regulador de caudal unidirecional     | pneu-flow-control-uni
- Regulador de caudal bidirecional      | pneu-flow-control-bi
- Válvula de escape rápido              | pneu-quick-exhaust
- Regulador de pressão                  | pneu-pressure-regulator
- Válvula de alívio de pressão          | pneu-pressure-relief
- Válvula limitadora de pressão         | pneu-pressure-limiter
- Válvula diferencial de pressão        | pneu-pressure-differential
- Regulador caudal proporcional         | pneu-flow-control-proportional

### Solenóides e acionamentos pneumáticos
- Solenóide simples 24VDC               | pneu-solenoid-single-24vdc
- Solenóide duplo 24VDC Y1/Y2           | pneu-solenoid-double-24vdc
- Eletroválvula retorno por mola        | pneu-electrovalve-spring-return
- Pilotagem pneumática interna          | pneu-pilot-internal
- Pilotagem pneumática externa          | pneu-pilot-external
- Pilotagem manual com lock             | pneu-pilot-manual-lock
- Acionamento por came / rolete         | pneu-actuator-cam-roller
- Acionamento por fim de curso          | pneu-actuator-limit-switch

### Preparação de ar
- Filtro de ar comprimido               | pneu-air-filter
- Regulador de pressão com manómetro    | pneu-regulator-gauge
- Lubrificador                          | pneu-lubricator
- Filtro-Regulador-Lubrificador FRL     | pneu-frl-unit
- Secador por adsorção stub             | pneu-dryer-adsorption
- Separador de condensados              | pneu-condensate-separator
- Silenciador / abafador                | pneu-silencer

### Sensores e instrumentação pneumática
- Manómetro analógico                   | pneu-pressure-gauge
- Pressostato mecânico NC               | pneu-pressure-switch-nc
- Pressostato mecânico NO               | pneu-pressure-switch-no
- Transmissor de pressão 4-20 mA        | pneu-pressure-transmitter
- Sensor de pressão digital IO-Link     | pneu-pressure-sensor-iolink
- Reed switch de cilindro               | pneu-reed-switch-cylinder
- Sensor magnético de cilindro          | pneu-magnetic-cylinder-sensor
- Sensor indutivo fim de curso          | pneu-inductive-limit
- Sensor ótico de posição               | pneu-optical-position
- Sensor de caudal de ar                | pneu-air-flow-sensor
- Fim de curso mecânico pneumático      | pneu-mechanical-limit-switch

### Vácuo e manipulação
- Gerador vácuo venturi simples         | pneu-vacuum-generator-single
- Gerador vácuo venturi duplo estágio   | pneu-vacuum-generator-dual
- Ventosa plana                         | pneu-suction-cup-flat
- Ventosa oval                          | pneu-suction-cup-oval
- Ventosa com fole simples              | pneu-suction-cup-bellows-single
- Ventosa com fole duplo                | pneu-suction-cup-bellows-double
- Pinça de vácuo multizona              | pneu-vacuum-gripper-multizone
- Ejetor de vácuo com retenção          | pneu-vacuum-ejector-check
- Sensor de vácuo pressostato           | pneu-vacuum-switch
- Filtro de linha de vácuo              | pneu-vacuum-filter
- Acumulador de vácuo                   | pneu-vacuum-accumulator

---

## Hidráulica

### Atuadores hidráulicos
- Cilindro hid. simples efeito mola     | hyd-cylinder-sa-spring
- Cilindro hid. simples efeito peso     | hyd-cylinder-sa-gravity
- Cilindro hidráulico duplo efeito      | hyd-cylinder-da
- Cilindro hid. DA com amortecimento    | hyd-cylinder-da-cushioned
- Cilindro telescópico SA               | hyd-cylinder-telescopic-sa
- Cilindro telescópico DA               | hyd-cylinder-telescopic-da
- Cilindro diferencial                  | hyd-cylinder-differential
- Motor hid. de engrenagens             | hyd-motor-gear
- Motor hid. de palhetas                | hyd-motor-vane
- Motor hid. de pistões axiais          | hyd-motor-axial-piston
- Atuador rotativo hidráulico           | hyd-rotary-actuator
- Cilindro guiado hidráulico            | hyd-cylinder-guided

### Válvulas direcionais hidráulicas
- Válvula 2/2 NC hidráulica             | hyd-valve-2-2-nc
- Válvula 2/2 NO hidráulica             | hyd-valve-2-2-no
- Válvula 3/2 NC hidráulica             | hyd-valve-3-2-nc
- Válvula 4/2 monoestável               | hyd-valve-4-2-mono
- Válvula 4/2 biestável                 | hyd-valve-4-2-bi
- Válvula 4/3 centro fechado            | hyd-valve-4-3-closed
- Válvula 4/3 centro em tanque          | hyd-valve-4-3-tank
- Válvula 4/3 centro em pressão         | hyd-valve-4-3-pressure
- Válvula 4/3 centro flutuante          | hyd-valve-4-3-float
- Válvula proporcional direcional 4/3   | hyd-valve-4-3-proportional
- Servoválvula 4/3                      | hyd-servo-valve-4-3

### Controlo de pressão hidráulica
- Válvula de alívio de pressão          | hyd-pressure-relief-valve
- Válvula redutora de pressão           | hyd-pressure-reducing-valve
- Válvula de sequência hidráulica       | hyd-sequence-valve
- Válvula de contrapressão              | hyd-back-pressure-valve
- Válvula diferencial de pressão        | hyd-pressure-differential-valve
- Válvula proporcional de pressão       | hyd-pressure-proportional-valve
- Acumulador de bexiga                  | hyd-accumulator-bladder
- Acumulador de pistão                  | hyd-accumulator-piston
- Acumulador de membrana                | hyd-accumulator-diaphragm
- Bloco de manifold                     | hyd-manifold-block

### Controlo de caudal hidráulico
- Regulador de caudal fixo              | hyd-flow-control-fixed
- Regulador de caudal variável          | hyd-flow-control-variable
- Regulador caudal compensado pressão   | hyd-flow-control-pressure-compensated
- Divisor de caudal                     | hyd-flow-divider
- Motor de caudal                       | hyd-flow-meter-motor
- Válvula proporcional de caudal        | hyd-flow-proportional-valve

### Bombas hidráulicas
- Bomba de engrenagens                  | hyd-pump-gear
- Bomba de palhetas                     | hyd-pump-vane
- Bomba de pistões axiais               | hyd-pump-axial-piston
- Bomba de pistões radiais              | hyd-pump-radial-piston
- Bomba de duplo volume variável        | hyd-pump-variable-displacement
- Grupo hidráulico compacto             | hyd-power-unit

### Válvulas de retenção e especiais
- Válvula de retenção simples           | hyd-check-valve
- Válvula de retenção pilotada          | hyd-pilot-check-valve
- Válvula bloqueio duplo pilotada       | hyd-dual-pilot-check-valve
- Válvula shuttle hidráulica            | hyd-shuttle-valve
- Válvula anti-choque de linha          | hyd-line-relief-valve
- Válvula freewheel                     | hyd-freewheel-valve

### Filtração e condicionamento hidráulico
- Filtro de retorno                     | hyd-filter-return
- Filtro de alta pressão                | hyd-filter-high-pressure
- Filtro de ventilação breather         | hyd-filter-breather
- Trocador de calor ar                  | hyd-heat-exchanger-air
- Trocador de calor água                | hyd-heat-exchanger-water
- Indicador de colmatagem               | hyd-filter-clog-indicator
- Sensor de temperatura do óleo         | hyd-oil-temp-sensor
- Nível de reservatório com termómetro  | hyd-reservoir-level-temp

### Sensores e instrumentação hidráulica
- Manómetro hidráulico                  | hyd-pressure-gauge
- Pressostato hidráulico NC             | hyd-pressure-switch-nc
- Pressostato hidráulico NO             | hyd-pressure-switch-no
- Transdutor de pressão 4-20 mA         | hyd-pressure-transmitter
- Sensor de pressão digital IO-Link     | hyd-pressure-sensor-iolink
- Caudalímetro de engrenagens           | hyd-flow-meter-gear
- Caudalímetro de turbina               | hyd-flow-meter-turbine
- Sensor de temperatura do fluido       | hyd-fluid-temp-sensor
- Sensor de nível de reservatório       | hyd-reservoir-level-sensor
- Sensor de contaminação do óleo        | hyd-oil-contamination-sensor
- Posicionador linear / LVDT            | hyd-linear-position-sensor
- Sensor de velocidade motor hid.       | hyd-motor-speed-sensor

---

## Comunicação

### Interfaces seriais e buses
- Terminal UART                         | comm-uart-terminal
- Stub RS-232                           | comm-rs232-stub
- Stub RS-485                           | comm-rs485-stub
- Stub I2C                              | comm-i2c-stub
- Monitor I2C                           | comm-i2c-monitor
- Stub SPI                              | comm-spi-stub
- Monitor SPI                           | comm-spi-monitor
- Nó CAN                                | comm-can-node
- Analisador CAN                        | comm-can-analyzer
- Nó LIN                                | comm-lin-node

### Dispositivos industriais de rede
- Device Modbus RTU slave               | comm-modbus-rtu-slave
- Device Modbus TCP slave               | comm-modbus-tcp-slave
- Device EtherNet/IP                    | comm-ethernetip-device
- Device PROFINET                       | comm-profinet-device
- Device BACnet                         | comm-bacnet-device
- Servidor OPC-UA stub                  | comm-opcua-server-stub
- Device EtherCAT stub                  | comm-ethercat-stub
- Device IO-Link master stub            | comm-iolink-master-stub
- Device IO-Link slave stub             | comm-iolink-slave-stub

### Comunicação wireless
- Stub Bluetooth / BLE                  | comm-ble-stub
- Nó Zigbee / Thread                    | comm-zigbee-thread-node
- Nó LoRa                               | comm-lora-node
- Wi-Fi 2.4 GHz                         | comm-wifi-2g4
- Wi-Fi 5 GHz                           | comm-wifi-5g
- Nó cellular LTE-M / NB-IoT            | comm-cellular-ltem-nbiot
- RFID reader wireless stub             | comm-rfid-wireless-stub

### Gateways e stubs de protocolo
- Gateway Modbus RTU-TCP                | comm-gateway-modbus-rtu-tcp
- Gateway CAN-Ethernet                  | comm-gateway-can-eth
- Gateway serial-Ethernet               | comm-gateway-serial-eth
- Gateway MQTT-Modbus                   | comm-gateway-mqtt-modbus
- Broker MQTT virtual                   | comm-mqtt-broker-virtual
- Stub REST / HTTP industrial           | comm-rest-http-stub
- Stub WebSocket industrial             | comm-websocket-stub

### Monitores e analisadores de tráfego
- Monitor Modbus                        | comm-monitor-modbus
- Monitor CAN                           | comm-monitor-can
- Monitor I2C                           | comm-monitor-i2c
- Monitor SPI                           | comm-monitor-spi
- Sniffer Ethernet industrial           | comm-ethernet-sniffer
- Analisador PROFINET stub              | comm-profinet-analyzer-stub
- Analisador EtherNet/IP stub           | comm-ethernetip-analyzer-stub
- Monitor MQTT                          | comm-monitor-mqtt

---

## Industrial

### Blocos de lógica e controlo
- Contacto NO                           | ind-contact-no
- Contacto NC                           | ind-contact-nc
- Bobina                                | ind-coil
- Set / Reset                           | ind-set-reset
- Timer TON                             | ind-timer-ton
- Timer TOF                             | ind-timer-tof
- Timer TP                              | ind-timer-tp
- Counter CTU                           | ind-counter-ctu
- Counter CTD                           | ind-counter-ctd
- PID block                             | ind-pid-block
- Comparador analógico                  | ind-analog-comparator
- Latch                                 | ind-latch
- Bloco two-hand control                | ind-two-hand-control-block

### Bancos e módulos de I/O
- Banco DI                              | ind-di-bank
- Banco DO                              | ind-do-bank
- Banco AI                              | ind-ai-bank
- Banco AO                              | ind-ao-bank
- Módulo RTD                            | ind-rtd-module
- Módulo termopar                       | ind-thermocouple-module
- Módulo contador rápido                | ind-high-speed-counter
- Módulo PTO/PWM                        | ind-pto-pwm-module
- Módulo safety I/O                     | ind-safety-io-module
- Módulo energia                        | ind-power-meter-module

### Módulos de processo
- Módulo tanque                         | ind-tank-module
- Módulo esteira / conveyor             | ind-conveyor-module
- Módulo bomba                          | ind-pump-module
- Módulo válvula de processo            | ind-process-valve-module
- Módulo solenóide de processo          | ind-process-solenoid-module
- Módulo misturador                     | ind-mixer-module
- Módulo aquecimento                    | ind-heating-module
- Módulo trocador térmico               | ind-heat-exchanger-module

### HMI e sinalização industrial
- Lâmpada HMI                           | ind-hmi-lamp
- Botão HMI                             | ind-hmi-button
- Selector HMI                          | ind-hmi-selector
- Trend chart HMI                       | ind-hmi-trend-chart
- Alarme HMI                            | ind-hmi-alarm
- Banner de estado                      | ind-hmi-status-banner
- Indicador numérico                    | ind-hmi-numeric-indicator
- Bargraph                              | ind-hmi-bargraph

### Segurança funcional
- Bloco safety relay                    | ind-safety-relay-block
- Safety gate                           | ind-safety-gate
- Cortina de luz stub                   | ind-light-curtain-stub
- E-Stop lógico                         | ind-estop-logic
- Sensor proximidade safety stub        | ind-proximity-safety-stub
- Sensor fotoelétrico safety stub       | ind-photoelectric-safety-stub
- Muting block                          | ind-muting-block
- Reset de segurança                    | ind-safety-reset-block

### Potência e controlo de motores
- Perfil VFD                            | ind-vfd-profile
- Perfil servo drive                    | ind-servo-drive-profile
- Perfil soft starter                   | ind-soft-starter-profile
- Starter DOL                           | ind-starter-dol
- Starter reversível                    | ind-starter-reversible
- Proteção térmica                      | ind-thermal-protection
- Monitor de corrente de motor          | ind-motor-current-monitor
- Módulo feedback encoder               | ind-encoder-feedback-module

---

## Instrumentação Virtual

### Probes e medição
- Probe tensão                          | virt-probe-voltage
- Probe corrente                        | virt-probe-current
- Probe temperatura                     | virt-probe-temperature
- Probe pressão                         | virt-probe-pressure
- Probe caudal                          | virt-probe-flow
- Probe lógica digital                  | virt-probe-digital-logic
- Multímetro virtual                    | virt-multimeter
- Clamp meter virtual                   | virt-clamp-meter

### Instrumentos de bancada virtuais
- Osciloscópio                          | virt-oscilloscope
- Analisador lógico                     | virt-logic-analyzer
- Gerador de funções                    | virt-function-generator
- Fonte de bancada virtual              | virt-bench-supply
- Analisador de potência                | virt-power-analyzer
- Analisador de espectro                | virt-spectrum-analyzer
- Frequencímetro                        | virt-frequency-counter
- LCR meter virtual                     | virt-lcr-meter

### Análise de sinal
- FFT / spectrum                        | virt-fft-spectrum
- Trend temporal                        | virt-time-trend
- Eye diagram stub                      | virt-eye-diagram-stub
- Jitter monitor stub                   | virt-jitter-monitor-stub
- State timeline                        | virt-state-timeline
- Decoder PWM                           | virt-decoder-pwm
- Decoder quadratura                    | virt-decoder-quadrature
- Analisador harmónico                  | virt-harmonic-analyzer

### Monitores de protocolo
- Serial monitor                        | virt-serial-monitor
- Event monitor                         | virt-event-monitor
- Watch table                           | virt-watch-table
- Monitor Modbus                        | virt-monitor-modbus
- Monitor CAN                           | virt-monitor-can
- Monitor I2C                           | virt-monitor-i2c
- Monitor SPI                           | virt-monitor-spi
- Monitor OPC-UA stub                   | virt-monitor-opcua-stub

### Depuração e fault injection
- Fault injector                        | virt-fault-injector
- Noise injector                        | virt-noise-injector
- Power glitch injector                 | virt-power-glitch-injector
- Line break injector                   | virt-line-break-injector
- Short-circuit injector                | virt-short-circuit-injector
- Packet loss injector                  | virt-packet-loss-injector
- Latency injector                      | virt-latency-injector
- Force tag / override                  | virt-force-tag-override

---

## Infraestrutura de Painel

### Disjuntores e seccionamento
- Disjuntor 1P                          | panel-mcb-1p
- Disjuntor 2P                          | panel-mcb-2p
- Disjuntor 3P                          | panel-mcb-3p
- Disjuntor 4P                          | panel-mcb-4p
- Seccionador rotativo                  | panel-rotary-isolator
- Interruptor-seccionador com manete    | panel-switch-disconnector
- Diferencial RCCB                      | panel-rccb
- RCBO                                  | panel-rcbo

### Fusíveis e porta-fusíveis
- Fusível gG                            | panel-fuse-gg
- Fusível aM                            | panel-fuse-am
- Fusível cilíndrico                    | panel-fuse-cylindrical
- Porta-fusível DIN                     | panel-fuse-holder-din
- Porta-fusível basculante              | panel-fuse-holder-flip
- Seccionador fusível                   | panel-fuse-switch-disconnector

### Fontes DIN e transformadores de comando
- Fonte DIN 24VDC                       | panel-psu-din-24vdc
- Fonte DIN redundante                  | panel-psu-din-redundant
- UPS DC DIN                            | panel-ups-dc-din
- Transformador de comando 230/24VAC    | panel-transformer-control
- Transformador isolamento              | panel-transformer-isolation

### Bornes e terminal blocks
- Borne passagem                        | panel-terminal-feedthrough
- Borne PE                              | panel-terminal-pe
- Borne fusível                         | panel-terminal-fused
- Borne seccionável                     | panel-terminal-disconnect
- Borne sensor/atuador                  | panel-terminal-sensor-actuator
- Borne múltiplos níveis                | panel-terminal-multilevel
- Borne mola                            | panel-terminal-spring
- Borne para neutro                     | panel-terminal-neutral

### Barramentos e distribuição
- Barramento fase                       | panel-busbar-phase
- Barramento neutro                     | panel-busbar-neutral
- Barramento terra                      | panel-busbar-earth
- Distribuidor 24VDC                    | panel-distributor-24vdc
- Distribuidor 0V                       | panel-distributor-0v
- Pente de alimentação                  | panel-busbar-comb
- Bloco distribuição trifásico          | panel-3phase-distribution-block

### Relés auxiliares e interfaces
- Relé auxiliar 24VDC                   | panel-aux-relay-24vdc
- Relé auxiliar 230VAC                  | panel-aux-relay-230vac
- Base de relé                          | panel-relay-base
- Módulo interface relé                 | panel-relay-interface-module
- Relé temporizado                      | panel-timer-relay
- Relé monitor tensão                   | panel-voltage-monitor-relay
- Relé monitor fase                     | panel-phase-monitor-relay

### Contactores e proteção térmica
- Contactor 3 polos                     | panel-contactor-3p
- Mini contactor                        | panel-contactor-mini
- Relé térmico                          | panel-thermal-relay
- Disjuntor motor                       | panel-motor-circuit-breaker
- Combinado arrancador                  | panel-combination-starter
- Supressor para bobina                 | panel-coil-suppressor

### Inversores e soft starters
- Inversor compacto                     | panel-inverter-compact
- Inversor vetorial                     | panel-inverter-vector
- Soft starter compacta                 | panel-soft-starter-compact
- Soft starter industrial               | panel-soft-starter-industrial
- Filtro EMC                            | panel-emc-filter
- Resistência de travagem               | panel-braking-resistor

### Medição e energia em painel
- Medidor energia monofásico            | panel-energy-meter-1ph
- Medidor energia trifásico             | panel-energy-meter-3ph
- Amperímetro painel                    | panel-ammeter
- Voltímetro painel                     | panel-voltmeter
- Transdutor energia                    | panel-energy-transducer
- Analisador de rede                    | panel-power-quality-analyzer
- TC de painel                          | panel-current-transformer
- TP de painel                          | panel-voltage-transformer

---

## 6. UX de simulação e wiring

#### 6.1 Comportamento geral e Rendering

A simulação no DendriForge opera sob o princípio de **"Dumb Client, Smart Backend"**. O browser ou app mobile nunca calcula física ou estados lógicos.

* O backend avalia os nós a cada *tick* e transmite um payload JSON minúsculo (ex: `[{"id": "led1", "s": 1}, {"id": "wire3", "v": 5.0}]`).
* O frontend (Konva.js / Vanilla JS) interceta o payload via WebSocket e injeta as alterações diretamente no DOM/Canvas (mudando o *fill*, *stroke* ou opacidade), garantindo os 60fps constantes independentemente da complexidade do circuito.

A simulação terá três modos lógicos governados pelo backend:

* **Logical mode** — rápido, focado em estados digitais.
* **Hybrid mode** — digital + analógico simplificado.
* **Analog mode** — solver completo acoplado ao worker Ngspice via ZMQ.

### 6.2 Como as ligações funcionam

Cada componente expõe: pins físicos, pins lógicos, direcção de pin (input / output / bidireccional / power), power rails, nodes internos opcionais, compatibilidade eléctrica e regras de ligação.

Modelo de ligação:

```text
Visual Pin (SVG hotspot)
  -> Component Pin (TOON) [com direcção e tipo]
  -> Simulation Node
  -> Electrical Net
  -> Runtime Binding
```

### 6.3 Fios virtuais

Os fios são representados como **paths Bézier** com snapping de extremidades.

Regras de comportamento:

- Snap ao aproximar do pin.
- Highlight do pin alvo.
- Cor herdada pelo net type (ver tabela abaixo).
- Grossura ajustável por zoom.
- Curvas suaves por default.
- Segmentos ortogonais opcionais em modo industrial.

| Net type | Cor | Token CSS |
|---|---|---|
| VCC / Power | Vermelho | `--df-sim-wire-vcc` |
| GND | Cinza escuro | `--df-sim-wire-gnd` |
| Signal digital | Sky blue | `--df-sim-wire-default` |
| Signal analógico | Âmbar | `--df-accent-amber` |
| PWM | Laranja | `--df-accent-orange` |
| Bus (I2C/SPI/UART) | Violeta | `--df-accent-purple` |

### 6.4 Cruzamento de fios

Quando um fio cruza outro sem conexão real, é criada uma "ponte" visual. Três estilos disponíveis:

- **Opção 1** — pequeno arco por cima (default).
- **Opção 2** — gap no fio inferior.
- **Opção 3** — estilo ladder / industrial ortogonal.

Regras de detecção:

- O engine de path detecta intersecções geometricamente.
- O fio desenhado por último é considerado visualmente superior.
- Se não houver nó comum → cria bridge arc no fio superior.
- Se houver nó comum → desenha junction dot.

### 6.5 Zoom, pan e camadas

Controlos de navegação: pinch to zoom, scroll wheel zoom, middle mouse pan, minimap activado por defeito (`Ctrl+M` para toggle).

| Layer | Conteúdo | Lock disponível |
|---|---|---|
| board | PCB, silkscreen, componentes | Sim |
| wiring | Fios, nets, junction dots, bridge arcs | Sim |
| annotations | Labels, comentários, notas de design | Sim |
| probes | Pontas de medição, oscilloscope, logic analyzer | Sim |
| overlays | Highlights de selecção, hover states | Não |
| faults | Erros, warnings, fault badges | Não |

A layer `faults` está sempre no topo e não pode ser bloqueada — visibilidade crítica tem prioridade.

### 6.6 Validação em tempo real

**Build-time (ao ligar um fio ou soltar um componente):**
- **Optimistic UI Validation:** Para evitar latência de rede, o frontend utiliza a metadata TOON que já está em cache para dar feedback instantâneo.
- Verifica compatibilidade eléctrica básica entre pins (ex: detectar direcção output → output).
- Snapping inteligente instantâneo sem aguardar roundtrip do servidor.

**Run-time (durante simulação activa no backend):**
- A física real é delegada ao Processo B (ZMQ).
- Verifica presença de alimentação antes de energizar outputs.
- Detecta curtos por net validation de malha fechada.
- Detecta overload e componentes fora de especificação térmica/eléctrica.
- Monitoriza estados de fault contínuos.

Resultados de Run-time surfaçados no frontend via Delta Payload: highlight vermelho no componente afectado, entrada no Event monitor e badge de status.

### 6.7 Regras gerais de simulação

- Sem alimentação, outputs não energizam.
- Curto detectado por net validation → fault imediato.
- Componentes incompatíveis geram warning ou fault conforme severidade.
- Output ligado a output → warning de drive conflict.
- Modo classroom simplifica física e relaxa validações.
- Modo industrial activa validações severas e tolerâncias reais.
- Fallback digital entra quando o solver analógico falha, com notificação visível no painel de estado (modo degraded) — nunca silencioso.

---

## 7. Atalhos e gestos

### 7.1 Teclado

> Em macOS, substituir `Ctrl` por `Cmd`. Todos os atalhos têm equivalente acessível via menu ou command palette (`Ctrl+P`), que funciona como fallback universal para qualquer acção.

#### Gestão de projecto

| Atalho | Acção |
|---|---|
| `Ctrl+N` | Novo projecto |
| `Ctrl+O` | Abrir projecto |
| `Ctrl+S` | Guardar |
| `Ctrl+Shift+S` | Guardar como |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

#### Edição de canvas

| Atalho | Acção |
|---|---|
| `Ctrl+A` | Seleccionar tudo |
| `Ctrl+C` | Copiar componente |
| `Ctrl+V` | Colar componente |
| `Ctrl+D` | Duplicar componente |
| `Delete` | Remover seleccionado |
| `R` | Rodar componente seleccionado |
| `Arrow keys` | Mover por grid step |
| `Shift+Arrow` | Mover por step mínimo |
| `Esc` | Cancelar fio / limpar selecção |

#### Navegação no canvas

| Atalho | Acção |
|---|---|
| `Space` | Pan tool (segurar e arrastar) |
| `Ctrl+1` | Focar editor de código (dentro da view Simulation) |
| `Ctrl+2` | Zoom to fit all |
| `Ctrl+3` | Zoom to selected component |
| `Ctrl+4` | Zoom to origin (reset pan, sem alterar escala) |
| `Ctrl+5` | Next component (ciclar selecção) |
| `Ctrl+6` | Previous component |
| `Ctrl+7` | Next fault / warning |
| `Ctrl+8` | Next probe / watch point |
| `Ctrl+9` | Toggle focus mode (isola componente seleccionado) |
| `Ctrl+0` | Reset pan e zoom ao estado inicial |
| `Ctrl+G` | Toggle grid (visual) |
| `Ctrl+Shift+G` | Toggle snap to grid |
| `Ctrl+M` | Abrir / fechar minimap |

#### Views

| Atalho | View |
|---|---|
| `Ctrl+Shift+1` | Simulation |
| `Ctrl+Shift+2` | Code |
| `Ctrl+Shift+3` | Ladder Editor |
| `Ctrl+Shift+4` | GRAFCET Editor |
| `Ctrl+Shift+5` | Flow Editor |
| `Ctrl+Shift+6` | Blockly |
| `Ctrl+Shift+0` | Reset ao layout default |

#### Simulação e transpilação

| Atalho | Acção |
|---|---|
| `Ctrl+Enter` | Transpile to target (acção manual, usa TOON como pivot) |
| `Ctrl+Shift+Enter` | Transpile only — valida sem iniciar simulação |
| `F5` | Start simulation |
| `Pause` / `F6` | Pause / Resume simulation |
| `Shift+F5` | Stop simulation |
| `F9` | Toggle breakpoint |
| `Shift+F9` | Abrir watch table |
| `F10` | Step |

#### Interface e ferramentas

| Atalho | Acção |
|---|---|
| `Ctrl+P` | Command palette (fallback universal) |
| `Ctrl+K` | Quick search |
| `Ctrl+B` | Boards browser |
| `Ctrl+L` | Serial / log console |
| `Ctrl+Shift+L` | Clear log / console |

---

### 7.2 Touch e gestos

> Em iPadOS, gestos de sistema (three-finger gestures, swipe from edge) têm prioridade sobre gestos da aplicação. O command palette (`Ctrl+P`) está sempre acessível por botão visível no UI como alternativa.

#### Navegação

| Gesto | Acção |
|---|---|
| 1 dedo tap | Seleccionar |
| 1 dedo drag | Arrastar componente |
| 2 dedos drag | Pan |
| Pinch | Zoom in / out |
| 2 dedos double-tap | Zoom reset ao estado inicial |
| Swipe lateral | Trocar painéis |

#### Interacção com componentes

| Gesto | Acção |
|---|---|
| Long press (500 ms) | Menu contextual |
| Double tap | Editar propriedades |
| Double tap em pin | Iniciar ligação |
| Drag entre pins | Criar fio |
| Double tap em zona vazia | Cancelar fio a meio |
| Two-finger rotate | Rodar componente seleccionado |

#### Multi-selecção e comandos globais

| Gesto | Acção |
|---|---|
| Two-finger hold + tap | Multi-select mode |
| Three-finger tap | Command palette |

---

## 8. Segurança, contas e organização do utilizador

### 8.1 Área do utilizador

Hierarquia de entidades:

```text
Account
└── Workspace (múltiplos por conta: pessoal, trabalho, classroom)
    ├── modo: pessoal / trabalho / classroom
    └── Projects, Boards, Libraries, Components, Templates, …
        └── Team (múltiplos por workspace)
            └── Member (múltiplos por team, com role)
```

Estrutura de navegação:

- **Workspace** — contexto activo do utilizador; cada conta pode ter múltiplos workspaces.
- **Projects** — projectos de simulação, código e wiring.
- **Boards** — boards customizados partilhados dentro do workspace.
- **Components** — componentes customizados partilhados dentro do workspace.
- **Libraries** — bibliotecas de código do utilizador (`.h`/`.cpp`, módulos TS, blocos ST, etc.); importadas como dependência viva em qualquer projecto, versionáveis e partilháveis.
- **Templates** — pontos de partida clonáveis: esquemas de canvas, snippets, blocos Blockly pré-configurados, diagramas GRAFCET de exemplo; clonados, não importados.
- **Teams** — grupos de colaboração dentro do workspace; um utilizador pode pertencer a múltiplos teams.
- **Members** — gestão de membros por team, com role atribuído por team.
- **Classroom** — modo activado por workspace (disponível nos perfis Académico e Comercial); suporta gestão de turmas, professores e alunos.
- **AI Providers** — configuração de fornecedores de IA via BYOK (Bring Your Own Key); as chaves ficam no secrets vault.
- **Deployments** — firmwares disponíveis para deploy em hardware real:
  - `Default firmwares` — mantidos pelo DendriForge.
  - `Custom firmwares` — compilados ou uploaded pelo utilizador, com board target, versão e hash de verificação.
- **Logs** — histórico de eventos, simulações e deploys; retenção configurável por perfil.
- **Shared** — recursos partilhados com o utilizador por outros workspaces ou teams.
- **Secrets** — área protegida por RBAC para API keys, credenciais industriais e tokens; não é item de navegação comum.
- **Trash** — recursos eliminados com período de recuperação configurável.

---

### 8.2 Login

Métodos suportados:

- Email + password
- Magic link
- OAuth
- SSO / SAML para enterprise
- Offline local profile para desktop (sem ligação à internet — essencial para ambientes OT)

Gestão de sessões:

- Timeout de sessão configurável por workspace.
- Token refresh automático.
- Invalidação remota de sessão (logout de todos os dispositivos).

---

### 8.3 Segurança

**Passwords:**
- Hash com **Argon2id** (1ª escolha OWASP 2024); parâmetros mínimos: `m=19456`, `t=2`, `p=1`.

**Autenticação e acesso:**
- MFA opcional (perfis Doméstico, Maker, Académico).
- MFA obrigatório (perfil Industrial e enterprise).
- Rate limiting em login e API (protecção contra brute force e abuso).
- Session management com invalidação remota.

**Dados e transmissão:**
- Encryption at rest para segredos e dados sensíveis.
- Encryption in transit (TLS obrigatório).
- Secrets vault para API keys e credenciais industriais.

**Auditoria e controlo:**
- Audit log imutável.
- RBAC com roles por team (ver 8.5).
- Workspace isolation entre tenants via PostgreSQL Row-Level Security (RLS).
- Política de segurança configurável por tenant.

**Hardware e deploy:**
- Signed firmware builds — hash de verificação validado antes de deploy.
- Device trust model — ligações de dispositivos registados vs desconhecidos.

**Compliance:**
- Backup e export controlado.
- GDPR: right to deletion, data residency, política de dados.
- Perfil Industrial: suporte a air-gap, audit trail imutável, alinhamento com IEC 62443.

---

### 8.4 Perfis de cliente

| Feature | Doméstico | Maker | Académico | Comercial | Industrial |
|---|---|---|---|---|---|
| Workspaces | 1 | 3 | TBD | TBD | TBD |
| Projectos | TBD | TBD | TBD | TBD | Unlimited |
| Teams / Members | — | — | TBD | TBD | TBD |
| Simulation mode | Logical | Hybrid | Hybrid | Analog | Analog |
| Deployments | — | Basic | Basic | Custom | Custom + Signed |
| Logs retention | TBD | TBD | TBD | TBD | TBD |
| Classroom | — | — | ✅ | ✅ | — |
| SSO / SAML | — | — | — | — | ✅ |
| MFA | Opcional | Opcional | Opcional | Opcional | Obrigatório |
| Compliance IEC 62443 | — | — | — | — | ✅ |
| Suporte | Community | Community | TBD | Email | Dedicated |
| Preço | TBD | TBD | TBD | TBD | TBD |

Descrição de cada perfil:

- **Doméstico** — homeowner que quer automatizar a sua casa; foco em integração (MQTT, automação residencial); prefere Blockly e templates prontos; tolerância técnica baixa.
- **Maker** — hobbyist/prototipador; escreve código, experimenta hardware, partilha projectos; tolerância técnica alta.
- **Académico** — instituições de ensino; inclui modo classroom com gestão de turmas, professores e alunos.
- **Comercial** — empresas que usam o DendriForge para prototipagem ou formação interna; inclui modo classroom para onboarding e treino de equipas.
- **Industrial** — ambientes de produção e OT; validações severas, compliance, air-gap support, firmware assinado, suporte dedicado.

---

### 8.5 Hierarquia de roles (RBAC)

**Workspaces gerais:**

```text
Account Owner
└── Workspace Admin
    └── Editor
        └── Viewer
            └── Guest
```

**Modo Classroom:**

```text
Institution Admin / Workspace Admin
└── Teacher
    └── Student
```

Os roles são atribuídos por team, não globalmente. Um mesmo utilizador pode ter roles diferentes em teams diferentes dentro do mesmo workspace.

---

## 9. IA e BYOK

### 9.1 Estratégia

A IA é um **módulo plugável**. O utilizador escolhe o provider e fornece a sua própria chave (BYOK — Bring Your Own Key). O DendriForge não inspecciona nem regista qual modelo é usado — apenas comunica com o endpoint configurado. A gestão de versões de modelo é da responsabilidade do utilizador.

Todos os providers implementam a interface `AIProviderAdapter`, o que permite à comunidade adicionar suporte a novos providers sem tocar no core.

#### Providers nativos

**Principais:**

| Provider | Modelo sugerido | Nota |
|---|---|---|
| OpenAI | GPT-4o / o3 | Referência geral |
| Anthropic | Claude Sonnet | Forte em raciocínio e código |
| Google | Gemini 2.5 Pro | Multimodal, contexto longo |
| Ollama | Llama / Qwen / Mistral local | Local-only, air-gap |
| Azure OpenAI | GPT-4o (Azure-hosted) | Enterprise, data residency |

**Europeus (GDPR-aligned):**

| Provider | Modelo sugerido | Especialidade |
|---|---|---|
| Mistral AI | Codestral | Melhor performance em código; endpoint dedicado |
| Aleph Alpha | Luminous Supreme | Conformidade governamental/industrial (DACH) |
| Poolside | Poolside Model | Optimizado para arquitectura de software *(beta / invite-only)* |

**Agregadores e infraestrutura multi-AI:**

| Provider | Modelo de actuação | Diferencial | Velocidade |
|---|---|---|---|
| OpenRouter | Agregador / Proxy | Acesso a quase todos os modelos com faturação unificada | Variável |
| Groq | Infraestrutura LPU | Velocidade extrema para open-source (Llama, Mixtral); ideal para fallback de parser | Ultra-rápida |
| Together AI | Cloud | Fine-tuning e hospedagem de modelos open-source em larga escala | Muito rápida |
| Fireworks AI | Cloud | Baixa latência e economia para developers | Muito rápida |
| Anyscale | Infraestrutura (Ray) | Escalabilidade de aplicações produtivas | Rápida |
| DeepInfra | Cloud | Preços competitivos; modelos de texto e imagem | Rápida |
| Perplexity pplx-api | API de inferência | Modelos com acesso web em tempo real; útil para pesquisa de datasheets | Rápida |
| Vercel AI SDK | Middleware | Camada de abstracção que pode implementar `AIProviderAdapter` internamente | N/A |
| Amazon Bedrock | Enterprise | Anthropic, Mistral, Meta e Amazon numa infra segura; data residency por região AWS | Consistente |

**Self-hosted e adapters comunitários:**
- Providers self-hosted via endpoint OpenAI-compatible.
- Adapters comunitários publicados no registry DendriForge.

---

### 9.2 Casos de uso

#### Assistência ao código

- **Fallback quando parser falha** — quando o parser ASL não consegue processar código, a IA tenta inferir a intenção; o resultado é sempre marcado como *"não validado pelo parser"*; a falha gera um log automático e um aviso visível para correcção imediata, contribuindo para a completude progressiva da ASL:

```text
Código do utilizador
  → Parser ASL
    → [FALHA] → log automático + aviso visível ao utilizador
              → issue interno para completar a ASL
              → IA infere intenção → resultado marcado como não validado
    → [OK]    → TOON gerada continuamente em background
```

- **Geração de boilerplate** — estruturas iniciais de projecto, setup de pins, configuração de periféricos.
- **Refactor entre linguagens** — o agente lê os documentos de padrões DendriForge em `agent_skills/` antes de agir; o resultado passa sempre pelo pipeline TOON antes de ser aceite.
- **Explicação de código** — anotação e documentação inline gerada automaticamente.
- **Geração de testes** — testes unitários e de integração para o código do utilizador.
- **Correcção guiada** — sugestões de correcção com explicação da causa.
- **Documentação automática** — geração de READMEs, docstrings e comentários estruturados.

#### Assistência ao canvas e simulação

- **Geração de wiring templates** — o utilizador descreve em linguagem natural a ligação pretendida; o resultado passa sempre pela validação build-time (secção 6.7); *documentação em `agent_skills/` pendente (TODO)*.
- **Diagnóstico de faults** — quando existe um fault activo no canvas, a IA explica a causa provável e sugere correcção.
- **Geração de sequências ladder / GRAFCET** — o utilizador descreve o comportamento em prosa; a IA gera o diagrama correspondente.

#### Assistência à criação de assets

- **Criação de blocks** — geração de blocos Blockly customizados.
- **Criação assistida de componentes/boards em Schemasmith** — o agente lê as regras de schema em `agent_skills/schemasmith.md`; Fase 1: assistência com confirmação do utilizador; Fase 2 (futura): geração autónoma sujeita a validação de schema.

---

### 9.3 Regras de segurança da IA

- Sem envio automático de segredos nos prompts.
- Redacção de credenciais antes de qualquer saída para o provider.
- Opt-in por projecto — a IA não está activa por defeito.
- Data residency por tenant — o utilizador configura o endpoint; o DendriForge não controla nem regista o destino dos dados.
- Logs de prompts no enterprise — imutáveis, acessíveis apenas a Workspace Admin e Account Owner.
- Modo local-only quando o provider for Ollama ou self-hosted — nenhum dado sai da máquina.
- Toda a saída da IA que envolva código passa pelo pipeline TOON antes de ser aceite.
- Toda a saída da IA que envolva wiring passa pela validação build-time (secção 6.7).

---

### 9.4 Classroom — controlo pelo professor/formador

O professor, formador ou gestor do classroom pode desactivar qualquer área não essencial para o contexto de avaliação ou formação, incluindo:

- Assistência por IA (geração, refactor, explicação).
- Transpilação.
- Templates (para forçar o aluno a partir do zero).
- Blockly (para forçar código textual).
- Import de libraries externas.

---

### 9.5 Limites e responsabilidade

- Toda a saída da IA é uma sugestão; o utilizador é responsável pela validação final.
- Código gerado por IA passa sempre pelo pipeline TOON antes de ser aceite.
- Wiring gerado por IA passa sempre pela validação build-time (secção 6.7).
- A IA não tem acesso a segredos, credenciais ou dados de produção.
- A gestão de versões de modelo é da responsabilidade do utilizador.
- Em modo classroom, o professor pode desactivar a IA para avaliações.

---

## 10. Editores

### 10.1 Code Editor

O editor de código tem uma única responsabilidade: o código fonte original (painel esquerdo). O painel de Transpiled Output é read-only com dois utilitários:

- **Copy** — copia o código transpilado para a área de transferência.
- **Use as Source / → Promote to Source** — move o transpilado para o painel esquerdo, tornando-o o novo código de trabalho; requer confirmação do utilizador.

Funcionalidades:

- Syntax highlighting via PrismJS (tokens alinhados com `dendriForge-A11Y-Slate.css`).
- Transpile split view — Source (esquerda) / Transpiled Output (direita).
- ASL debug view — painel colapsável com a representação TOON/ASL intermédia, activado por `Ctrl+Shift+T`.
- Inline diagnostics — erros e warnings inline no editor, alinhados com o Event monitor.
- Autocomplete — sugestões contextuais baseadas na linguagem activa.
- Board-aware suggestions — o autocomplete conhece o board seleccionado e sugere APIs específicas (ex: `ledcWrite()` para ESP32, `analogWrite()` para AVR).
- Simulation bindings — as linhas de código actualmente em execução na simulação são destacadas em tempo real, como um debugger visual.
- Library import helper — assistente para importar libraries da área Libraries do workspace.

---

### 10.2 Ladder Editor

Base de referência visual e semântica: **OpenPLC Editor** (ecossistema open-source).
O runtime é próprio e centrado em ASL — não depende do runtime OpenPLC.

Funcionalidades:

- Import/export LD via **PLCopen XML** (formato de interoperabilidade IEC 61131-3).
- Execução em scan cycle.
- Simulação de contacts, coils, timers, counters e function blocks.
- Watch por rung — estado de cada rung em tempo real (`--df-sim-pin-high` / `--df-sim-pin-low`).

#### 10.2.1 Function Block Diagram (FBD)

Referência visual e semântica: **OpenPLC Editor 2025+** (suporte FBD nativo).

- Runtime próprio centrado em ASL.
- Import/export FBD via PLCopen XML.
- Simulação de function blocks com inputs/outputs visuais.
- Watch por bloco.

---

### 10.3 Flowchart Editor

O Flowchart Editor é agnóstico de linguagem. A linguagem do editor é **ASL** — o pipeline ASL produz o target. O editor não gera código de nenhuma linguagem directamente.

Funcionalidades:

- Cada bloco mapeia para um nó ASL.
- Primitivas: nodes, edges, guards (expressões booleanas ASL), actions, loops e IO blocks.
- Simulação directa via ASL.
- Export para todos os targets suportados pelo pipeline ASL (Arduino C++, MicroPython, Rust, ST, etc.).

---

### 10.4 GRAFCET Editor

O GRAFCET Editor implementa diagramas sequenciais industriais conforme **IEC 60848**, distinto do Flowchart Editor de propósito geral.

> **Flowchart Editor**: fluxogramas de propósito geral.
> **GRAFCET Editor**: diagramas sequenciais industriais com steps, transições e actions conforme IEC 60848.

Funcionalidades:

- Steps, transições e actions (tipos: N, S, R, P, D).
- Binding de steps e transições para nós ASL.
- Simulação de sequência passo a passo.
- Watch por step — estado activo/inactivo em tempo real.
- Import/export para formato standard IEC 60848.

---

### 10.5 Blockly ASL

A linguagem do editor é **ASL** — os blocos nunca geram código final directamente. O pipeline ASL produz o target.

Tipos de blocos:

- Blocos de IO (GPIO, PWM, ADC, UART, I2C, SPI).
- Blocos de controlo (if/else, loops, timers, events).
- Blocos de lógica e aritmética.
- Blocos de comunicação (Modbus, MQTT, CAN).
- Blocos industriais (contacts, coils, FBs).
- Blocos customizados (gerados pelo utilizador ou por IA).

Funcionalidades adicionais:

- **Blocks por board** — os blocos disponíveis reflectem o board seleccionado (pins, periféricos e capacidades reais).
- **Classroom packs** — conjuntos curados de blocos activados pelo professor/formador para uma sessão específica; liga directamente ao controlo de classroom da secção 9.4.
- Geração de blocos customizados assistida por IA (secção 9.2).

---

### 10.6 Schemasmith

Editor visual para criação e manutenção de boards e componentes no formato TOON+SVG.

#### Fluxo de trabalho

```text
1. Upload do SVG do board/componente
2. Schemasmith lista todos os objectos do SVG com id (grupos, circles, paths, rects)
3. O utilizador vê a lista de objectos à esquerda e o SVG à direita
4. O utilizador selecciona um objecto da lista → fica destacado no SVG
5. O utilizador mapeia logicamente: nome do pin, tipo, direcção e função
6. O sistema gera o TOON progressivamente à medida que os mapeamentos são feitos
7. Validação de schema → erros surfaçados inline na lista e num painel de erros
8. Preview em modo simulação
9. Asset exportado como simulation-ready (SVG + TOON)
```

#### Estrutura TOON

Exemplo de referência: `arduino-uno` (Arduino Uno R3)

```yaml
id: arduino-uno
name: Arduino Uno R3
manufacturer: Arduino
mcu: ATmega328P
category: maker
image: /boards/arduino-uno.svg
url: https://arduino.cc

specs: flashMemory:32768, sram:2048, eeprom:1024, clockSpeed:16000000, voltage:5

dims: w_mm:68.6, h_mm:53.4, t_mm:1.6

dendriforge:
  boardFamilySkillId: avr-family
  boardProfileId: arduino-uno
  defaultLanguageSkills: arduino-cpp-avr,rust-embassy-avr

# Power Pins: name | direction | voltage | type
powerPins:
  VIN|input|null|null
  5V|output|5|null
  3V3|output|3.3|null
  GND|null|null|ground
  RESET|input|null|null
  IOREF|output|5|null
  AREF|input|null|null

# GPIO: pin | type | pwm | interrupt | label | roles
gpio:
  0|digital|f|t|D0 / RX|uart-rx
  1|digital|f|t|D1 / TX|uart-tx
  2|digital|f|t|D2|null
  3|digital|t|t|D3 PWM|null
  4|digital|f|f|D4|null
  5|digital|t|f|D5 PWM|null
  6|digital|t|f|D6 PWM|null
  7|digital|f|f|D7|null
  8|digital|f|f|D8|null
  9|digital|t|f|D9 PWM|null
  10|digital|t|f|D10 PWM / SS|spi-ss
  11|digital|t|f|D11 PWM / MOSI|spi-mosi
  12|digital|f|f|D12 / MISO|spi-miso
  13|digital|f|f|D13 / LED / SCK|spi-sck,status-led
  14|analog|f|f|A0|null
  15|analog|f|f|A1|null
  16|analog|f|f|A2|null
  17|analog|f|f|A3|null
  18|analog|f|f|A4 / SDA|i2c-sda
  19|analog|f|f|A5 / SCL|i2c-scl

peripherals:
  serial: uarts:1, pins:0,1
  i2c: channels:1, sda:18, scl:19
  spi: channels:1, miso:12, mosi:11, sck:13, ss:10

usb: type:USB-B, chipset:ATmega16U2, vid:0x2341, pid:0x0043

restrictions:
  outputCurrent: 40mA
  warnings: Pins 0/1 shared with USB serial avoid during upload. Pin 13 has onboard LED affects HIGH state readings. Max total I/O current 200mA.

compatibility: core:1.8.19, platformio:atmelavr, frameworks:arduino
languages: arduino-cpp
bootloader: optiboot
```

#### Mapeamento SVG → TOON

| Atributo SVG | Campo TOON | Exemplo |
|---|---|---|
| `id="pin-d13"` | gpio pin identifier | pin 13 |
| `data-pin="13"` | gpio pin number | 13 |
| `data-type="digital"` | gpio type | digital |
| `data-pwm="true"` | gpio pwm | t |
| `data-interrupt="true"` | gpio interrupt | t |
| `data-i2c="SDA"` | gpio roles | i2c-sda |
| `data-uart="TX"` | gpio roles | uart-tx |
| `data-state="off"` | led initial state | animação reactiva |
| `data-linked-pin="13"` | led → gpio binding | led animado por pin 13 |

---

## 11. Firmware Custom-Tailored

### 11.1 Visão

O DendriForge não é apenas um editor de código — é um sistema de geração e compilação de firmware. O pipeline produz firmwares **custom-tailored**: binários optimizados para o board e o projecto específicos, sem overhead de frameworks genéricos.

Fluxo canónico:

```text
Código fonte (qualquer linguagem)
  → Parser ASL
  → ASL IR
  → Normalizer + Analyzer + Optimizer
  → Firmware Generator (código C/Rust/HAL mínimo)
  → LLVM Backend (ou toolchain fallback por target)
  → Binary (.hex / .bin / .uf2 / .elf)
  → Signing (perfil Industrial)
  → Deploy (USB, OTA, JTAG, industrial protocol)
```

Os firmwares gerados alimentam a área **Deployments** da área do utilizador (secção 8.1).

---

### 11.2 O que "custom-tailored" significa

- **HAL mínimo** — gerado a partir do TOON do board; inclui apenas os periféricos usados no projecto (GPIO, UART, I2C, SPI, PWM, ADC conforme declarado).
- **Runtime mínimo** — loop de execução bare-metal sem RTOS quando não necessário; com FreeRTOS ou Zephyr quando o projecto declara tasks concorrentes.
- **Runtime PLC embutido** — scan cycle IEC 61131-3 gerado como firmware bare-metal para MCUs compatíveis (ESP32, RP2040, STM32 com RAM suficiente); sem depender de CODESYS ou OpenPLC externos.
- **Cross-language firmware** — um board pode correr firmware gerado a partir de Ladder, GRAFCET, Blockly, ST ou código textual; o ASL é o pivot; o target é sempre binário para o MCU.

---

### 11.3 Backend de compilação — LLVM

| Target | LLVM support | Notas |
|---|---|---|
| ARM Cortex-M (STM32, RP2040, nRF) | ✅ Nativo upstream | LLVM-embedded-toolchain-for-Arm |
| RISC-V | ✅ Nativo upstream | Targets 32 e 64-bit |
| AVR (ATmega, ATtiny) | ⚠️ Parcial upstream | Fallback para avr-gcc quando necessário |
| Xtensa (ESP32, ESP8266) | ⚠️ Fork Espressif | Usa xtensa-gcc/esp-idf como fallback |
| Linux ARM (Raspberry Pi, industrial PCs) | ✅ Nativo upstream | Cross-compile para aarch64 e armv7 |
| MIPS (legacy industrial) | ⚠️ Suporte limitado | Fallback para gcc-mips |

**Regra geral:** LLVM é o backend primário. Para targets sem suporte LLVM upstream estável, o sistema usa o toolchain de referência do fabricante como fallback transparente. O utilizador não precisa de instalar toolchains — o DendriForge gere-os internamente.

---

### 11.4 Builders

| Builder | Target | Backend | Fase |
|---|---|---|---|
| `avr-builder` | ATmega, ATtiny, AVR família | avr-gcc (fallback LLVM) | Fase B |
| `esp-builder` | ESP32, ESP8266, ESP32-S/C/H | xtensa-gcc / esp-idf | Fase B |
| `rp2040-builder` | Raspberry Pi Pico / RP2040 | LLVM ARM Cortex-M0+ | Fase B |
| `stm32-builder` | STM32 F/G/H/L/U séries | LLVM ARM Cortex-M | Fase B |
| `arm-generic-builder` | Qualquer Cortex-M (nRF, SAM, etc.) | LLVM ARM Cortex-M | Fase B |
| `riscv-builder` | RISC-V bare-metal e Linux | LLVM RISC-V | Fase B |
| `linux-arm-builder` | Raspberry Pi, industrial Linux ARM | LLVM aarch64/armv7 | Fase B |
| `plc-runtime-builder` | ESP32, RP2040, STM32 com RAM ≥ 128KB | Conforme target | Fase B |
| `gateway-builder` | ESP32 / Linux ARM com interface de rede | Conforme target | Fase B |
| `safety-builder` | Targets certificáveis (MISRA, IEC 62061) | LLVM + análise estática | Fase M |
| `ota-builder` | Qualquer target com OTA capability | Conforme target | Fase B |

---

### 11.5 Protocolos de deploy

O DendriForge suporta deploy directo do binário gerado para o device, via múltiplos protocolos.
O Desktop App é o vector principal para deploy com fio; OTA e protocolos industriais estão
disponíveis na app e no backend cloud.

#### Maker / Development

#### Maker / Development

| Protocolo | Targets | Ferramenta interna | Notas |
|---|---|---|---|
| USB Serial + DTR reset | Arduino AVR, ESP32 | avrdude, esptool.py | **Web App suporta via WebSerial API.** Desktop App usa bibliotecas nativas. |
| UF2 drag-and-drop | RP2040, SAMD, nRF52 | filesystem mount | Sem software adicional |
| DFU (USB) | STM32, RP2040, AVR32 | dfu-util | **Web App suporta via WebUSB API.** |
| AVR ISP / USBasp | AVR bare-metal | avrdude | Requer Desktop App |
| UPDI | ATtiny, Mega 0-series | avrdude, pymcuprog | Requer Desktop App |

#### Debug / Engineering

| Protocolo | Targets | Ferramenta interna | Notas |
|---|---|---|---|
| SWD | ARM Cortex-M (STM32, RP2040, nRF) | OpenOCD, pyOCD | Flash + debug simultâneo |
| JTAG | ARM, RISC-V, STM32, industrial | OpenOCD | Full debug + boundary scan |
| CMSIS-DAP / DAP-Link | ARM Cortex-M | pyOCD, OpenOCD | Interface USB standard |
| J-Link / SEGGER | ARM Cortex-M | J-Link software | Perfil Industrial/engineering |

#### OTA (Over-The-Air)

| Protocolo | Targets | Mecanismo | Notas |
|---|---|---|---|
| OTA WiFi (ArduinoOTA) | ESP32, ESP8266 | UDP broadcast | Simples, rede local |
| OTA HTTP / HTTPS | ESP32, Linux ARM | pull de servidor | Suporta delta e full image |
| OTA MQTT | qualquer com WiFi/Ethernet | push via broker | Ideal para fluxos IoT existentes |
| Mender / Golioth (integração) | Linux ARM, ESP32 | agente no device | OTA gerida com rollback |
| RP2040 OTA (custom) | RP2040-W | PIO + WiFi | Requer bootloader custom |

#### Industrial

| Protocolo | Targets | Notas |
|---|---|---|
| Modbus RTU bootloader | PLCs com Modbus RTU | Requer bootloader Modbus no device |
| Modbus TCP bootloader | PLCs com Modbus TCP | Rede Ethernet industrial |
| PROFIBUS DP | PLCs Siemens, legacy industrial | Via GSD files; suporte legacy |
| PROFINET DCP | PLCs modernos (Siemens, B&R, Phoenix) | Deploy via rede PROFINET |
| EtherNet/IP (CIP) | Allen-Bradley, Rockwell | Via protocolo CIP |
| CANopen DS302 | Controllers CAN-based | Bootloader CANopen standard |
| CC-Link | Mitsubishi, industrial asiático | Via master CC-Link |

---

### 11.6 Assinatura e segurança do firmware

O perfil Industrial exige firmwares assinados antes de deploy. O pipeline de assinatura
integra-se com o secrets vault da secção 8.3.

```text
Binary gerado
  → Hash SHA-256 calculado
  → Assinatura com chave privada (do secrets vault — nunca exposta)
  → Manifest gerado: { board, version, hash, signature, timestamp }
  → Bundle de deploy: { binary + manifest }

No device (runtime de validação):
  → Lê manifest
  → Verifica hash do binary
  → Verifica assinatura com chave pública embebida no firmware
  → [OK] → flash
  → [FALHA] → rejeita deploy, regista fault no audit log
```

Regras:
- assinatura obrigatória no perfil Industrial (secção 8.4);
- assinatura opcional nos perfis Maker e Comercial;
- a chave privada nunca sai do secrets vault;
- o hash e a assinatura ficam registados no audit log imutável (secção 8.3);
- rollback disponível para o último firmware válido assinado.

---

### 11.7 Estratégia de bootloader

O comportamento do builder em relação ao bootloader do device é configurável por projecto:

| Modo | Comportamento | Quando usar |
|---|---|---|
| `preserve` (default) | O builder respeita o bootloader existente; o binário é gerado para o endereço correcto | Maker, desenvolvimento, production devices |
| `replace` | O builder substitui o bootloader pelo DendriForge bootloader (com suporte OTA e assinatura) | Quando se quer OTA num device sem suporte nativo |
| `dfu` | O builder gera um binário compatível com DFU; o bootloader DFU deve estar presente | STM32, RP2040 em modo DFU |
| `none` | Sem bootloader; o binário ocupa o espaço completo da flash | ISP/JTAG bare-metal, targets mínimos |

> ⚠️ O modo `replace` num device em produção é uma operação irreversível sem acesso físico.
> O sistema emite um aviso explícito e requer confirmação antes de executar.

---

## 12. Fases de implementação

> As fases são identificadas por letra (A → M) para evitar confusão com os números de secção
> deste documento. As dependências entre fases são explícitas em cada cabeçalho.
> Total: 13 fases (A → M).
> Estimativas de duração em documento separado `ROADMAP_TIMELINE.md` — ausência aqui intencional.

### Mapa de superfícies por fase

| Fase | Web | Desktop | Mobile | Notas |
|---|---|---|---|---|
| A — Core | base | base | base | fundações partilhadas |
| B — Transpile | ✅ | ✅ | — | pipeline ASL + builders |
| C — Simulation | ✅ | ✅ | — | engines de simulação |
| D — AI | ✅ | ✅ | — | assistência em todas as superfícies |
| E — Editores Visuais | ✅ | ✅ | — | editores e marketplace |
| F — Refinement | ✅ | ✅ | prep | polish, A11Y, segurança |
| G — Desktop | — | ✅ | — | packaging nativo e integração |
| H — Mobile | — | — | ✅ | packaging e scope mobile |
| I — Accounts & Cloud | ✅ | ✅ | ✅ | multi-user, classroom, cloud |
| J — Launch | ✅ | ✅ | ✅ | infra de lançamento |
| K — Beta Testing | ✅ | ✅ | ✅ | validação com utilizadores reais |
| L — Go-to-Market | ✅ | ✅ | ✅ | publicidade e crescimento |
| M — Safety & Certification | ✅ | ✅ | — | perfil Industrial avançado |

---

### Fase A — Core

> **Pré-requisito:** nenhum.
> **Desbloqueia:** todas as fases seguintes.

#### A.1 Fundamentos e CI/CD

- consolidar `pyproject`, ambiente, lint, type checking, formatadores;
- fechar estrutura `dendriforge/` — critério de conclusão: estrutura de packages estável,
  sem reorganizações planeadas nas fases seguintes;
- definir convenções de packages e naming (documento `ARCHITECTURE_DECISIONS.md`);
- criar contracts de models centrais;
- **pipeline CI/CD base** (GitHub Actions ou equivalente):
  - build automático por commit;
  - lint + type check obrigatórios;
  - testes automáticos com cobertura mínima definida;
  - SAST (Static Application Security Testing) automático no CI — obrigatório para compliance
    IEC 62443 (perfil Industrial); ferramentas: Bandit (Python), cargo-audit (Rust),
    Semgrep (regras customizadas);
  - falha de CI bloqueia merge.

#### A.2 Models

> Ordem de dependência obrigatória dentro de A.2 — implementar por esta sequência:
> 1. ASL core models
> 2. board / PLC / component models
> 3. simulation graph models
> 4. project / workspace / user models
> 5. security models

- ASL core models;
- board / PLC / component models;
- simulation graph models;
- project / workspace / user models;
- security models.

#### A.3 Asset pipeline

> `fingerprinting` e `cache local` podem ser movidos para Fase F sem bloquear B ou C.
> O que bloqueia as fases seguintes são os loaders e validators.

- loaders SVG;
- loaders TOON;
- schema validators;
- index builders;
- fingerprinting *(pode diferir para Fase F se necessário)*;
- cache local *(pode diferir para Fase F se necessário)*.

#### A.4 Runtime base

- config;
- logging;
- diagnostics;
- feature flags;
- storage adapters;
- **plugin system** — define o contrato de extensibilidade do DendriForge:
  - interface `DendriPlugin` com lifecycle hooks (register, activate, deactivate);
  - **Process Targeting:** Dada a arquitetura ZMQ, os plugins devem declarar o seu "Target Process" (ex: `target: api_layer` para rotas REST, ou `target: sim_layer` para lógicas físicas), garantindo que código Python não-determinístico de terceiros nunca bloqueie o motor ASL em Rust;
  - tipos de plugin suportados: builder externo, provider de linguagem, componente TOON, provider de IA, adapter de protocolo de deploy;
  - registry local (Fase A); registry cloud activado na Fase I;
  - **limitação conhecida até Fase I**: plugins externos não são partilháveis publicamente até o registry cloud estar disponível; builders de fabricantes terceiros ficam em modo local-only até I.1;
  - isolamento de falha — um plugin que falha não derruba o core;
  - documentação de contrato em `ARCHITECTURE_DECISIONS.md` antes de implementar.

#### A.5 API base

> Aqui ficam apenas auth e CRUD básico. Rate limiting base aqui; políticas por tenant
> completadas na Fase I.
> `simulation session API` diferida para C.6.
> `transpile session` diferido para B.1.
> `firmware build session` diferido para B.8.

- auth (login, sessões, invalidação remota);
- endpoints CRUD: boards, components, projects, workspace;
- rate limiting base;
- health check e readiness endpoints.

---

### Fase B — Transpile

> **Pré-requisito:** Fase A completa.
> **Desbloqueia:** Fase C (simulação), Fase D (IA), Fase E (editores visuais).
> **Nota de dependência:** Fase C pode iniciar com B.1 completo. Fase M requer B.9 aprovado.

#### B.1 ASL IR e executor

> O IR é redesenhado de raiz com base na herança NeuroForge como referência, não portado
> directamente. A decisão de reutilizar vs. redesenhar cada componente deve ser documentada
> em `ARCHITECTURE_DECISIONS.md`.

- IR completo (types, nodes, expressions, statements, IO, timers, events);
- normalizer;
- optimizer;
- executor;
- analyser (análise estática, type checking, IO validation);
- library resolver;
- **endpoint `transpile session`** (adicionado aqui, após A.5).

#### B.2 Parsers Tier 1

- TOON parser;
- Python / MicroPython;
- Rust;
- Arduino C++.

#### B.3 Generators Tier 1

- TOON generator — produz TOON a partir de ASL; alimenta Schemasmith (E.1) e canvas;
- Python / MicroPython;
- Rust;
- Arduino C++.

#### B.4a Parsers Tier 2 — Prioritários

- Structured Text (ST);
- C;
- CircuitPython;
- Lua.

#### B.4b Parsers Tier 2 — Condicionais

> Implementados apenas se houver procura documentada (issues, beta feedback, parceiros).
> Não bloqueiam o progresso da Fase B.

- Zig;
- Espruino;
- ASM *(subset para targets suportados)*;
- Ada *(uso real em aeroespacial e defesa — implementar se parceiro ou procura documentada)*;
- Forth *(sistemas embarcados históricos — implementar se procura documentada)*.

> ⚠️ Os `agent_skills/` para Ada e Forth só são criados quando a decisão de implementar
> for tomada — não em B.7.

#### B.5 Generators Tier 2

- ST, C, CircuitPython, Lua *(alinhado com B.4a)*;
- Zig, Espruino *(alinhado com B.4b — quando implementados)*.

#### B.6 Tier industrial

- LD (Ladder Diagram) — parser e generator;
- FBD (Function Block Diagram) — parser e generator;
- **SFC (Sequential Function Chart / IEC 61131-3)** — parser e generator;
  > Nota: SFC (IEC 61131-3) e GRAFCET (IEC 60848) são standards distintos com semântica
  > ligeiramente diferente. O parser SFC cobre a maioria dos casos de uso do GRAFCET por
  > compatibilidade estrutural; o parser GRAFCET nativo (E.4) trata os casos divergentes.
  > Decisão documentada em `ARCHITECTURE_DECISIONS.md`.
- IL (Instruction List) — **apenas parser** (import de código legado; sem generator —
  IL foi retirado oficialmente do IEC 61131-3 ed. 3; PLCs legado Siemens S7 Classic
  e Mitsubishi GX Works ainda exportam IL — o parser é necessário para import de projectos
  reais industriais; gerar IL seria um passo para trás);
- GRAFCET (IEC 60848) — parser e generator nativo *(distinto do SFC acima)*;
- **IEC 61499** — implementado como model interno (event-driven function blocks), não como
  parser textual directo; inclui import/export de `.fbt`/`.sys` e mapeamento para ASL com
  eventos, ports e actions *(alinhado com secção 3.2)*.

#### B.7 agent_skills — documentação de linguagens

> Deliverable obrigatório da Fase B: a IA da Fase D só pode agir correctamente se existirem
> estes documentos. Criados progressivamente à medida que os parsers ficam completos.
> Ada e Forth excluídos — ver nota em B.4b.

- `agent_skills/arduino-cpp.md` — padrões, APIs, anti-patterns;
- `agent_skills/micropython.md`;
- `agent_skills/rust-embedded.md`;
- `agent_skills/structured-text.md`;
- `agent_skills/ladder.md`;
- `agent_skills/fbd.md`;
- `agent_skills/grafcet.md`;
- `agent_skills/asl-pipeline.md` — contrato do pipeline ASL completo;
- `agent_skills/schemasmith.md` — regras de criação de boards/componentes *(para Fase E)*.

#### B.8 Firmware builders

> Builders criados aqui, em paralelo com os generators, pois partilham o mesmo pipeline ASL.
> A integração com o LLVM backend e os protocolos de deploy (secção 11) é completada aqui.
> A assinatura de firmware (hash SHA-256, secrets vault, manifest — secção 11.6) é activada
> pelo perfil do utilizador, não pelo builder — aplica-se a qualquer builder quando o perfil
> Industrial está activo.
>
> **`core.transport` nos builders:** o `gateway-builder` é o consumer principal do
> `dendriforge.core.transport` em runtime — o builder configura os protocolos de comunicação
> (Modbus RTU/TCP, MQTT, OPC-UA, CAN) via `core.transport.adapters`. O `plc-runtime-builder`
> usa `core.transport` para bus emulation (C.1b) — a bridge entre o scan cycle bare-metal
> e os adaptadores de protocolo é declarada aqui e implementada em C.1b.

- `avr-builder` — ATmega, ATtiny; backend LLVM (parcial) com fallback automático para
  avr-gcc; o critério de preferência LLVM vs. avr-gcc é determinado automaticamente pelo
  target e flags do projecto — o utilizador não escolhe;
- `esp-builder` — ESP32, ESP8266, ESP32-S/C/H; backend xtensa-gcc / esp-idf (fork
  Espressif com suporte Xtensa — não disponível no LLVM upstream);
- `rp2040-builder` — RP2040; backend LLVM ARM Cortex-M0+;
- `stm32-builder` — STM32 F/G/H/L/U; backend LLVM ARM Cortex-M;
- `arm-generic-builder` — qualquer Cortex-M (nRF, SAM, etc.); backend LLVM ARM;
- `riscv-builder` — RISC-V bare-metal e Linux; backend LLVM RISC-V;
- `linux-arm-builder` — Raspberry Pi, industrial Linux ARM; backend LLVM aarch64/armv7;
- `plc-runtime-builder` — ESP32, RP2040, STM32 com RAM ≥ 128KB; scan cycle bare-metal
  IEC 61131-3 sem depender de CODESYS ou OpenPLC externos; usa `core.transport` via C.1b
  para bus emulation;
- `gateway-builder` — target primário: ESP32 com W5500 ou ESP32-ETH; fallback: qualquer
  Linux ARM com interface de rede; gere protocolos de comunicação inter-device via
  `core.transport.adapters` (Modbus RTU/TCP, MQTT, OPC-UA, CAN);
- `ota-builder` — gera pacote OTA (manifest + binary + delta patch) para targets
  WiFi-capable; integra com os protocolos OTA da secção 11.5; o manifest OTA é verificável
  com a chave pública de teste (critério de smoke test B.9);
- **`firmware build session` API** — job queue, status polling, webhook de resultado,
  download do artefacto (.hex / .bin / .uf2 / .elf); referência cruzada com secção 11.1
  e 8.1 (Deployments); integrado com o sistema de billing cloud (I.3).

> **Estratégia de toolchain:** os toolchains são geridos internamente pelo DendriForge —
> o utilizador não instala nada. Download on-demand por target na primeira build;
> cache local persistente por versão de toolchain. O UI mostra barra de progresso no
> primeiro download. Os toolchains não são bundled no installer base.

#### B.9 Validation suite

> Critério de saída da Fase B para avançar para Produção:
> ≥ 95% dos golden files passam round-trip sem divergência semântica.
> Este critério é também exit criteria da Fase K (beta testing — K.3).

- golden files por linguagem;
- round-trip tests (A → ASL → B → ASL → A);
- semantic equivalence tests;
- board-aware transpile tests;
- **firmware build smoke tests** — para cada builder:
  - compilação sem erro;
  - binário gerado tem tamanho > 0 e dentro do range esperado para o hello-world do target;
  - entry point verificado no ELF/MAP output;
  - flash address correcto para o bootloader mode activo;
  - `ota-builder`: manifest OTA gerado e verificável com chave pública de teste.

---

### Fase C — Simulation

> **Pré-requisito:** B.1 (ASL IR e executor) completo.
> **Desbloqueia:** Fase E (editores visuais com simulação), Fase G (desktop).

#### C.1 Digital engine

> Prioridade C.1a (MVP): GPIO, PWM, ADC, timers, interrupts, eventos.
> Prioridade C.1b (extensão): bus emulation (I2C, SPI, UART a nível de protocolo).
> **Limitação conhecida do MVP:** componentes dependentes de I2C/SPI ficam como stubs
> não-funcionais até C.1b estar completo. Esta limitação deve ser documentada na UI e nos
> release notes do MVP.
>
> **`core.transport` em C.1b:** a bus emulation (I2C, SPI, UART, Modbus, CAN) é
> implementada usando as abstrações de `dendriforge.core.transport` — não reimplementada
> do zero. C.1b é onde o `core.transport` é instanciado na simulação como virtual bus
> adapter. O `plc-runtime-builder` (B.8) declara a dependência de C.1b aqui.

- state graph;
- pin modes;
- **PWM simulation** *(C.1a — obrigatório: Servo, DC motor, LED dimming dependem disto)*;
- **ADC simulation** *(C.1a — obrigatório: potenciómetro, sensores analógicos dependem disto)*;
- events (rising edge, falling edge, schedules);
- timers e delays;
- interrupts;
- **fault rules** (deliverable obrigatório):
  - sem alimentação → outputs não energizam;
  - curto detectado por net validation → fault imediato;
  - output → output → warning de drive conflict;
  - componentes fora de especificação → fault ou warning por severidade;
- bus emulation: I2C, SPI, UART, Modbus, CAN via `core.transport` *(C.1b — pode diferir
  sem bloquear MVP)*.

#### C.2 Analog engine

> **Nota de threading:** o Ngspice não é thread-safe. O solver analógico corre num worker
> multiprocesso isolado — alinhado com a estratégia de workers da secção 1.1 (Execution
> Layer). Decisão documentada em `ARCHITECTURE_DECISIONS.md`.

- libngspice bridge (via worker multiprocesso isolado);
- netlist generation;
- probes;
- convergence strategies — **critério de falha explícito**: solver considerado falhado após
  N iterações sem convergência (N configurável, default: 1000) ou após timeout de T ms
  (T configurável, default: 5000ms);
- **simplified analog fallback**:
  - quando o solver falha → modo degraded;
  - notificação visível no painel de estado — nunca silenciosa;
  - fallback digital entra automaticamente com badge "Degraded Mode".

#### C.3 Hybrid engine

- ASL runtime + digital IO + analog nodes;
- synchronisation loop;
- clock domains.

#### C.4 Wiring engine

> O wiring engine cobre canvas de MCU/componentes. Os editores Ladder, FBD e GRAFCET
> (Fase E) usam engines de ligação próprios (rung connections, block ports, step transitions)
> — não partilham o wiring engine físico. Decisão documentada em `ARCHITECTURE_DECISIONS.md`.
> cross detection e bridge arcs são trabalho de UI/canvas — podem ser implementados
> em paralelo com C.2.

- pin snapping;
- nets;
- cross detection *(UI/canvas — paralelo com C.2)*;
- bridge arcs *(UI/canvas — paralelo com C.2)*;
- connection rules;
- invalid-link diagnostics.

#### C.5 Debug tooling

- watch window;
- signal timeline;
- logic analyzer;
- serial console;
- event trace;
- breakpoints;
- **replay mode**:
  - grava snapshots de estado durante a simulação;
  - permite reprodução passo a passo após a sessão;
  - formato `.dfsnap` — JSON estruturado comprimido (zstd por defeito);
  - storage: local-only por defeito; cloud opt-in no perfil Comercial e Industrial;
  - política de retenção: limite de 20 snapshots por projecto (configurável) com garbage
    collection automático do mais antigo;
  - snapshots exportáveis e importáveis (`.dfsnap`); útil para professores partilharem
    sessões problemáticas com alunos;
  - custo de storage cloud definido pela política de retenção de Logs (secção 8.1).

#### C.6 Simulation session API

#### C.6 Simulation session API

> Movido de A.5 para aqui — depende do engine C.1/C.3.
> Modelo de concorrência: múltiplas sessões por conta suportadas.
> O Desktop App (G.3 multi-window) cria sessões independentes no ZMQ local por cada janela.
> No WEBAPP e MOBILE APP, as abas ativas ficam limitadas a 1 sessão em tempo real para evitar saturação do pool de WebSockets do servidor Cloud e poupar largura de banda (Delta-streaming) em redes móveis.

- create / join / close session;
- WebSocket para estado em tempo real;
- snapshot save / restore;
- session replay export (`.dfsnap`);

---

### Fase D — AI

> **Pré-requisito:** B.1 (ASL IR) e B.7 (agent_skills) completos.
> **Desbloqueia:** funcionalidades de assistência em todas as superfícies.

#### D.1 Provider system

- adapters (`AIProviderAdapter` interface);
- BYOK secrets (integração com secrets vault secção 8.3);
- routing rules;
- **AI presets** — configurações pré-definidas de provider + modelo + temperatura + contexto:
  - "preset refactor" — optimizado para transformação de código;
  - "preset diagnóstico de faults" — contexto de simulação activa;
  - "preset explicação para classroom" — linguagem simplificada, sem jargão;
  - "preset industrial diagnostics" — referências a standards, tolerâncias reais;
  - configuráveis por utilizador e por workspace;
- **conflito de provider não-permitido**: quando um projecto usa um provider fora da
  allow/deny list do tenant Industrial, o sistema bloqueia a funcionalidade de IA com
  mensagem clara e sugere um provider aprovado — nunca silencioso;
- **rate limiting de IA** — específico do subsistema AI, distinto do rate limiting geral (A.5):
  - limite de req/min por utilizador por provider;
  - limite de tokens/dia por workspace (configurável por perfil);
  - throttling gracioso com mensagem de feedback — nunca falha silenciosa;
  - contadores expostos no painel de governance (D.4).

#### D.2 AI transpiler

- **refactor entre linguagens** — o agente lê `agent_skills/` antes de agir; resultado
  passa sempre pelo pipeline TOON antes de ser aceite;
- parser fallback (quando ASL parser falha — fluxo da secção 9.2);
- code explanation;
- repair (correcção guiada com causa explicada);
- test generation;
- library suggestions (sugere library correcta para o board activo);
- boilerplate generation;
- documentation generation.

#### D.3 AI simulator assistant

- **suggest wiring** — resultado passa sempre por validação build-time (secção 6.6);
  - partes válidas da sugestão são aplicadas ao canvas;
  - partes inválidas são rejeitadas com explicação inline;
  - a sugestão inteira é reversível com `Ctrl+Z` atómico;
- identify faults (explica causa e sugere correcção);
- propose fixes;
- **educational hints** — modo classroom: linguagem simplificada, analogias visuais;
- **industrial diagnostics mode** — modo industrial: referências a standards, tolerâncias
  reais, sugestões de compliance.

#### D.4 Governance

- cost controls por tenant;
- per-tenant limits;
- logging imutável (enterprise);
- privacy modes (local-only quando provider for Ollama ou self-hosted);
- **allow/deny lists por tenant** — o admin Industrial define quais providers são permitidos;
  impede uso de providers não aprovados com dados de produção;
- dashboard de consumo de IA (tokens usados, custo estimado, req/min actuais) — visível
  para Workspace Admin e Account Owner.

---

### Fase E — Editores Visuais e Marketplace

> **Pré-requisito:** B.1 (ASL IR), B.6 (tier industrial), C.1 (digital engine).
> **Nota de dependência:** E.3 e E.4 requerem C.1 completo para simulação integrada;
> se C.1 atrasar, E.3 e E.4 podem ser entregues sem simulação e completados depois.
> **Desbloqueia:** Fase I (classroom), Fase J (launch).

#### E.1 Schemasmith

- upload SVG; Schemasmith lista todos os objectos com id (grupos, circles, paths, rects);
- mapeamento visual de objectos → pins TOON (utilizador selecciona da lista → destaque no
  SVG → atribui nome, tipo, direcção e função ao pin);
- TOON gerado progressivamente à medida que os mapeamentos são feitos;
- validação de schema inline com painel de erros;
- simulation readiness checks;
- assistência por IA (agente usa `agent_skills/schemasmith.md` — B.7).

#### E.2 Blockly ASL

- universal blocks (IO, controlo, lógica, comunicação);
- **industrial blocks** (contacts, coils, timers, counters, FBs — alinhado com secção 10.5);
- board packs (blocos reflectem pins e periféricos do board activo);
- classroom packs (conjuntos curados activados pelo professor — liga a secção 9.4).

#### E.3 Flowchart Editor

> **Depende de C.1** para simulação integrada — ver nota de dependência da Fase E.

- ASL-native node graph;
- simulação directa via ASL;
- export agnóstico de linguagem (todos os targets do pipeline ASL).

#### E.4 GRAFCET Editor

> **Depende de C.1** para simulação de sequência.
> Parser GRAFCET nativo (B.6) deve estar completo.

- steps, transições e actions (tipos: N, S, R, P, D);
- binding para ASL;
- simulação de sequência passo a passo;
- import/export IEC 60848.

#### E.5 Ladder / FBD Editor

> **Dependência explícita:** B.6 (parsers/generators LD e FBD) deve estar completo.

- LD visual editor (contacts, coils, timers, counters, FBs);
- FBD visual editor (blocos com inputs/outputs visuais);
- import/export PLCopen XML;
- runtime binding (ASL scan cycle);
- simulator integration (watch por rung / watch por bloco).

#### E.6 Marketplace interno

> **Fase E:** read-only (instalar e usar). **Fase I:** publicar (após I.1 completo).

- **libraries** — versionadas com semver; projectos ficam pinados na versão instalada —
  nunca actualização silenciosa; o utilizador vê aviso de nova versão e escolhe quando
  actualizar; crítico no perfil Industrial onde uma library diferente pode alterar o
  comportamento do firmware;
- assets (boards, componentes TOON+SVG) — instalar na Fase E; publicar na Fase I;
- templates (clonáveis, por domínio) — instalar na Fase E; publicar na Fase I;
- classroom packs *(referência cruzada com E.2 e I.2)*.

---

### Fase F — Refinement

> **Pré-requisito:** Fases A–E substancialmente completas.
> **Desbloqueia:** Fase G (desktop), Fase J (launch).

#### F.1 UX polish

- onboarding (wizard de primeiro projecto — critério de K.3 assente neste tutorial);
- empty states (todos os ecrãs têm estado vazio útil);
- presets (projectos de exemplo por perfil);
- tutorials interactivos in-app;
- contextual help (tooltips, docs inline).

#### F.2 A11Y

- contrast audit completo (WCAG AA obrigatório; AAA onde possível);
- keyboard coverage total;
- screen reader map;
- colour-blind safe states (cor + ícone + texto + padrão — alinhado com secção 4.3);
- touch targets (mínimo 44×44px).

#### F.3 Performance

> Targets de performance obrigatórios — sem métrica, F.3 nunca termina:
> * canvas a 60fps em hardware médio com ≤ 500 componentes visíveis (Aumentado de 50 para 500 graças à arquitetura de deltas);
> * tempo de load de projecto médio ≤ 2s (assets em cache local);
> * latência de transpile para projectos típicos (≤ 500 linhas): ≤ 1s;
> * latência de simulação digital step: ≤ 16ms (1 frame a 60fps).
> 
> 

* **Estratégia de alcance:** Atingir 60fps constantes não depende de otimizar o Python, mas sim da eficiência do empacotamento JSON de *deltas* no ZMQ e da subamostragem (downsampling) de telemetria enviada pelo WebSocket.
* lazy loading de assets pesados.
* indexação em background de TOONs e libraries.
* **verificação de APIs macOS para notarization** — confirmar que o app não usa APIs privadas nem entitlements não justificados.

#### F.4 Reliability

- crash recovery;
- autosave com intervalo configurável;
- snapshot restore;
- **offline queue** — acções elegíveis:
  - guardar/editar projectos: ✅;
  - transpile (sem builder externo): ✅;
  - firmware build (builder LLVM local, toolchain em cache): ✅;
  - firmware build (builder cloud): ❌ requer ligação — operação bloqueada com aviso;
  - simulação analógica (Ngspice local): ✅ se engine local disponível;
  - operações de account/team: ❌ requer ligação;
  - acções pendentes sincronizadas automaticamente quando online;
- **deterministic replay** — garante reprodução idêntica de sessões de simulação
  para debug e auditoria; alinhado com `replay mode` de C.5.

#### F.5 Internacionalização (i18n)

> Arquitectada aqui — implementar traduções depois é ordens de magnitude mais caro.

- todas as strings de UI externalizadas (sem strings hardcoded na UI);
- suporte a RTL preparado na arquitectura (mesmo que não activado no launch);
- locale detection automático;
- traduções activas no launch: Português e Inglês (obrigatórias);
- traduções adicionais (Alemão, Francês, Espanhol, Japonês) — conforme parceiros e procura
  documentada; não bloqueiam o launch.

#### F.6 Security audit

> Complementa o SAST automático do CI (A.1). Requerido para perfil Industrial (IEC 62443).
> Findings críticos bloqueiam Fase J.

- **escopo do pentest**: API REST + WebSocket, Desktop App (Windows/Linux), Web App;
  metodologia: OWASP WSTG;
- **executor**: terceiro certificado (OSCP ou equivalente) para perfil Industrial;
  interno aceitável para Fases Maker/Académico;
- **critério de done**: relatório entregue com severidade por finding;
  todos os findings Críticos e Altos fechados antes da Fase J;
  Médios com plano de mitigação documentado;
- revisão de secrets vault, RBAC e session management;
- revisão de firmware signing pipeline (secção 11.6);
- revisão de workspace isolation entre tenants;
- **revisão de compliance COPPA** — obrigatória se o DendriForge tiver utilizadores
  menores de 13 anos (plausível no perfil Classroom com ensino secundário):
  - a COPPA Amended Rule entrou em vigor a 22 de Abril de 2026;
  - sub-processors (SDKs de analytics, crash reporters, IA) que toquem dados de crianças
    são responsabilidade directa do operador;
  - decisão obrigatória antes da Fase J: o DendriForge suporta utilizadores menores de 13
    (com compliance COPPA completa) ou restringe a 13+ (documentado nos Termos de Serviço);
  - compliance FERPA para instituições EUA;
  - compliance GDPR obrigatória em qualquer caso (utilizadores europeus).

---

### Fase G — Desktop

> **Pré-requisito:** Fases A–F completas.
> **Desbloqueia:** Fase K (beta testing com utilizadores desktop).

#### G.1 Packaging

> *Atenção Arquitetural:* Devido à natureza Multi-Processo (ZMQ) e ao uso de binários nativos Rust (PyO3) e Ngspice, o packaging requer uma "toolchain" rigorosa para garantir que todos os workers "acordam" corretamente no sistema operativo do cliente.

* **Windows** — Empacotamento nativo via PyInstaller ou Nuitka para compilar o core. Installer NSIS ou MSI; auto-update via Squirrel ou equivalente.
* **Linux** — AppImage, .deb, .rpm; auto-update via AppImageUpdate ou equivalente. É imperativo compilar as bibliotecas partilhadas (`.so`) para compatibilidade com distribuições antigas (ex: via `manylinux`).
* **macOS** — Requer Apple Developer account, notarization e entitlements (hardened runtime). Devido à necessidade de assinar bibliotecas dinâmicas injetadas (PyO3/Ngspice), a notarization deve ser testada logo na Fase F, pois rejeita *dylibs* mal configuradas.

#### G.2 Native integrations

- **USB / Serial** — acesso directo a hardware; drivers por OS:
  - detecção de VID/PID do device (disponível no TOON — ex: Arduino Uno `vid:0x2341, pid:0x0043`);
  - verifica se o driver está instalado; se não, oferece link de download ou instala
    automaticamente (com confirmação do utilizador);
  - drivers comuns geridos internamente: CH340, CP2102, FTDI, ATmega16U2;
- filesystem (acesso a projectos locais, firmware builds, logs);
- local build tools — toolchains geridos internamente; download on-demand; cache local
  persistente por versão.

#### G.3 Desktop-only features

- **multi-window** — múltiplos projectos em simultâneo; cada janela cria uma sessão de
  simulação independente (C.6); sem estado partilhado entre janelas;
- advanced instrumentation (oscilloscope, logic analyzer de alta resolução);
- **local hardware lab mode** — múltiplos devices físicos ligados por USB em simultâneo;
  DendriForge gere-os como alvos independentes; flash, monitorização e debug em paralelo;
- offline enterprise mode (air-gap completo — sem ligação à internet necessária).

---

### Fase H — Mobile

> **Pré-requisito:** Fases A–C completas.
> **Soft dependency:** Fase G minimamente funcional para suportar "remote sessions" (H.2).
> **Nota:** Mobile é uma superfície de monitorização e acesso rápido, não de engenharia completa.

#### H.1 Packaging

- Android;
- iOS.

#### H.2 Mobile scope

- monitorização em tempo real (telemetria, dashboards);
- dashboards configuráveis;
- simulation lite (logical mode apenas);
- **classroom — aluno em mobile**:
  - visualização do projecto criado no desktop/web;
  - submissão de assignments sem edição de código;
  - visualização do estado da simulação em tempo real (read-only);
  - Blockly simplificado: visualizar e editar blocos existentes; criar novos em canvas
    reduzido; exportar para a sessão do desktop;
- flow / block editing leve (Blockly e Flowchart — canvas simplificado);
- remote sessions (ligação a sessão activa no desktop ou cloud).

#### H.3 Mobile restrictions

- **flash via cabo (USB) não disponível em mobile**:
  - iOS: não permite acesso USB nativo sem MFi certification;
  - Android: USB Host API disponível mas suporte varia por device — não garantido;
  - OTA WiFi (ESP32, ESP8266) e HTTP OTA disponíveis em mobile como alternativa;
  - flash USB requer sempre o Desktop App;
- **simulação unificada**: Graças ao "Delta-streaming", o mobile exibe simulações lógicas, híbridas e analógicas sem penalização de bateria, visto que todo o cálculo (Ngspice/ASL) ocorre no servidor Cloud ou na sessão remota do Desktop;
- **Blockly em ecrãs pequenos (< 6")** — modo lista de blocos disponível como alternativa ao canvas livre; o utilizador selecciona blocos de uma lista categorizada e o canvas é gerado automaticamente;
- UI simplificada por contexto — features avançadas redireccionam para Desktop.

---

### Fase I — Accounts, Classroom e Cloud

> **Pré-requisito:** Fases A–E completas; Fase G em progresso.
> **Desbloqueia:** Fase J (launch).
> **Nota:** rate limiting por tenant e políticas por perfil completadas aqui (complementam A.5).
> **Nota:** publicação no Marketplace (E.6) activada aqui, após I.1 completo.

#### I.1 Multi-user e RBAC

- workspace isolation completo (segurança por tenant);
- RBAC por team (roles: Account Owner, Workspace Admin, Editor, Viewer, Guest;
  Teacher e Student em modo classroom);
- convites e gestão de membros;
- SSO / SAML (perfil Industrial e enterprise);
- registry cloud de plugins activado (A.4 — plugins partilháveis publicamente a partir daqui).

#### I.2 Classroom

- gestão de turmas, professores e alunos;
- assignment system (criação, submissão, avaliação);
- controlo de features por sessão (IA, transpilação, templates, Blockly, libraries — secção 9.4);
- classroom packs activados no Marketplace (E.6);
- logs de turma (auditoria de sessões por aluno).

#### I.3 Cloud e billing

- PostgreSQL cloud (sync com SQLite local);
- **estratégia de sync SQLite ↔ PostgreSQL**:
  - **formato de transferência**: projectos exportados como bundles `.dfpack`
    (TOON + assets + código + metadados), versionados com hash SHA-256;
  - **mecanismo de sync**: pull-first por defeito — o desktop puxa estado cloud ao abrir;
    push explícito pelo utilizador (sem sync automático bidirecional em background);
  - **resolução de conflitos**: last-write-wins para projectos pessoais; lock optimista
    para projectos de team — editor activo bloqueia, outros vêem versão read-only com aviso;
  - **offline behavior** (alinhado com F.4 offline queue): edições offline acumulam-se
    localmente e são sincronizadas ao reconectar; conflito detectado na sync → utilizador
    escolhe versão a manter;
- object storage (assets, firmware builds, snapshots, logs);
- billing engine (planos por perfil, metering de sessões cloud e builds);
- **`firmware build session` API** integrada com billing (referência cruzada com B.8);
- invoicing e gestão de subscrições.

#### I.4 Deployment cloud

- infraestrutura de produção;
- CDN para assets e SVGs;
- monitoring, alerting, SLA;
- backup automático;
- disaster recovery documentado.

---

### Fase J — Launch

> **Pré-requisito:** Fases A–I completas. Findings críticos e altos de F.6 fechados.
> **Desbloqueia:** Fase K (beta testing), Fase L (go-to-market).
> **Nota:** launch ocorre quando o produto estiver pronto — sem data pré-fixada.

#### J.1 Infra de lançamento

- documentação pública (docs.dendriforge.io ou equivalente);
- changelog público;
- status page (uptime, incidentes);
- suporte: community forum, email (Comercial), dedicated (Industrial).

#### J.2 Legal e compliance

- Termos de Serviço;
- Política de Privacidade (GDPR compliant);
- decisão documentada sobre faixa etária mínima (≥ 13 ou compliance COPPA completa);
- DPA (Data Processing Agreement) para clientes Industrial e enterprise;
- open-source attributions (licenças de dependências verificadas).

#### J.3 Página inicial

> **Sandbox anónima:** o utilizador experimenta sem registo obrigatório no primeiro acesso.
> Projecto temporário anónimo; ao guardar, exportar ou partilhar, o sistema pede registo.
> Modelo validado por CodePen, StackBlitz e Replit — funil de conversão comprovado
> para produtos técnicos.

A homepage deve responder imediatamente:
- o que é o DendriForge;
- para quem serve (perfis com exemplos reais);
- como funciona (demo interactiva ou vídeo curto);
- o que dá para simular;
- o que dá para transpilar;
- diferenças entre planos;
- classroom (secção dedicada para instituições);
- CTA claro para experimentar (sandbox anónima — sem registo obrigatório no primeiro acesso).

---

### Fase K — Beta Testing

> **Pré-requisito:** Fase J completa.
> **Desbloqueia:** Fase L (go-to-market com dados reais de utilizadores).

#### K.1 Recrutamento

- programa de beta fechado: critérios de selecção por perfil (Maker, Académico, Industrial);
- NDA para beta industrial (acesso a features de compliance antecipado);
- formulário de candidatura e selecção.

#### K.2 Canais de feedback

- in-app feedback (formulário contextual por ecrã);
- issue tracker público (GitHub ou equivalente);
- sesions de usability testing (gravadas, com consentimento);
- canal de comunicação directa (Discord, Slack ou equivalente).

#### K.3 Critérios de saída da Fase K

> Todos os critérios abaixo devem ser satisfeitos antes de avançar para Fase L.
> Os critérios quantitativos derivam directamente de B.9 e F.3.

**Transpilação:**
- ≥ 95% dos golden files passam round-trip sem divergência semântica (alinhado com B.9);
- zero regressões nos parsers Tier 1 (Arduino C++, MicroPython, Rust, Python).

**Simulação:**
- canvas a 60fps em hardware médio com ≤ 500 componentes visíveis (alinhado com F.3);
- latência de simulação digital step ≤ 16ms (1 frame a 60fps — alinhado com F.3);
- zero crashes não-recuperáveis em sessões de simulação de duração ≤ 30 min.

**Onboarding:**
- ≥ 80% dos utilizadores beta completam o tutorial de primeiro projecto sem suporte directo (alinhado com F.1 onboarding wizard);
- tempo mediano de conclusão do tutorial ≤ 15 min.

**Qualidade geral:**
- NPS (Net Promoter Score) ≥ 40 após 30 dias de uso;
- zero findings Críticos ou Altos abertos de F.6 no momento do launch;
- todos os builders de B.8 passam os smoke tests de B.9 em ambiente de produção.

---

### Fase L — Go-to-Market

> **Pré-requisito:** Fase K completa (critérios de K.3 satisfeitos).
> **Desbloqueia:** crescimento orgânico e inorgânico do produto.

#### L.1 Pesquisa de mercado e preços

> Preços TBD até pesquisa de mercado completa. Esta subfase produz os valores finais
> para a tabela de perfis da secção 8.4.

- análise de competidores directos e indirectos por segmento (Maker, Académico, Industrial);
- benchmarking de preços de ferramentas comparáveis;
- inquéritos de willingness-to-pay por perfil de cliente;
- definição de planos de preço por perfil (Doméstico, Maker, Académico, Comercial, Industrial);
- definição de limites finais para a tabela 8.4 (Workspaces, Projectos, Teams/Members,
  Logs retention);
- modelo de trial / freemium se aplicável.

#### L.2 Canais de aquisição

- SEO e conteúdo técnico (tutoriais, comparativos, documentação open);
- presença em comunidades técnicas (Arduino, MicroPython, PLC, automação industrial);
- programa de referral para perfis Maker e Académico;
- parcerias com distribuidores de hardware (boards e PLCs);
- parcerias com instituições de ensino técnico e universidades;
- presença em feiras e eventos industriais (Hannover Messe, SPS, Embedded World).

#### L.3 Programa de parceiros

- **Hardware partners** — fabricantes de boards e PLCs que fornecem TOON+SVG oficiais;
  incentivo: badge "Official DendriForge Partner" e listagem preferencial no Marketplace;
- **Education partners** — instituições que adoptam o DendriForge no currículo;
  incentivo: perfil Académico com desconto ou gratuito para alunos;
- **System integrator partners** — integradores industriais que revendem e suportam o
  DendriForge no perfil Industrial.

---

### Fase M — Safety & Certification

> **Pré-requisito:** B.9 (validation suite aprovado), Fase I completa.
> **Nota:** esta fase é paralela às Fases J–L para clientes Industrial avançados.
> Pode iniciar parcialmente logo após B.9 para projectos de certificação com parceiros.

#### M.1 IEC 62061 — Safety lifecycle

- safety annotations no projecto (tipos de segurança: SIL 1, 2, 3);
- regras de verificação de safety (análise estática de safety properties no ASL);
- trilhos de aprovação (workflow de review obrigatório antes de deploy em modo safety);
- relatórios de risco e impacto (FMEA simplificado gerado automaticamente);
- integração com audit log imutável (secção 8.3).

#### M.2 IEC 62443 — Cybersecurity

- modelos de zona e conduta (configuráveis por tenant Industrial);
- hardening profiles para gateways e PLCs (templates de configuração segura);
- auditoria de alterações (changelog imutável com assinatura);
- perfis por tenant industrial com políticas de segurança customizadas;
- suporte a air-gap completo (nenhum dado sai da rede OT);
- SAST contínuo no CI com regras IEC 62443 (extensão do A.1).

#### M.3 MISRA C / C++ compliance

- análise estática MISRA integrada no pipeline de build para targets safety-critical;
- `safety-builder` (B.8) activa as regras MISRA automaticamente quando o perfil safety
  está activo no projecto;
- relatório de desvios MISRA com justificação por regra;
- integração com o trilho de aprovação de M.1.

#### M.4 Certificação formal (roadmap)

> Esta subfase é de longo prazo e depende de parceiros e de recursos dedicados.
> Não é pré-requisito para o launch nem para as fases anteriores.

- avaliação para certificação de produto conforme IEC 62061 (parceiro de certificação TBD);
- avaliação para certificação ISA/IEC 62443-4-1 (processo de desenvolvimento seguro);
- avaliação para certificação IEC 61508 (se procura documentada por parceiro industrial);
- documentação de safety case para cada certificação target.

---

## 13. Critérios de sucesso

### 13.1 Critérios quantitativos

Os critérios abaixo são verificáveis e derivam directamente das fases de implementação.
São usados como exit criteria nas Fases B, F e K.

**Transpilação (derivados de B.9 e K.3):**
- ≥ 95% dos golden files passam round-trip sem divergência semântica;
- zero regressões nos parsers Tier 1 após cada release;
- latência de transpile ≤ 1s para projectos típicos (≤ 500 linhas).

**Simulação (derivados de F.3 e K.3):**
- canvas a 60fps em hardware médio com ≤ 500 componentes visíveis;
- latência de simulação digital step ≤ 16ms (1 frame a 60fps);
- zero crashes não-recuperáveis em sessões de simulação ≤ 30 min;
- tempo de load de projecto médio ≤ 2s (assets em cache local).

**Onboarding (derivados de K.3):**
- ≥ 80% dos utilizadores beta completam o tutorial de primeiro projecto sem suporte directo;
- tempo mediano de conclusão do tutorial ≤ 15 min.

**Qualidade e segurança (derivados de F.6 e K.3):**
- NPS ≥ 40 após 30 dias de uso em beta;
- zero findings Críticos ou Altos abertos no momento do launch;
- todos os builders de B.8 passam os smoke tests de B.9 em ambiente de produção.

### 13.2 Critérios qualitativos

- um utilizador Maker consegue criar, simular e fazer deploy de um projecto com um board da
  Fase 1 do catálogo (secção 5.1) sem consultar documentação externa;
- um utilizador Industrial consegue importar um projecto ST ou LD existente, simular e
  gerar um firmware assinado para o target sem perda semântica documentada;
- um professor consegue criar uma turma, configurar um assignment com features controladas
  e acompanhar o progresso dos alunos sem suporte técnico;
- um utilizador Doméstico consegue criar uma automação MQTT via Blockly e fazer deploy
  num ESP32 sem escrever uma linha de código.

---

## 14. Documentos derivados

Este plano de implementação é suficientemente extenso para justificar documentação irmã
separada por domínio. Os documentos abaixo devem ser criados progressivamente à medida
que as fases avançam — nunca todos de uma vez.

| Documento | Conteúdo | Criado em |
|---|---|---|
| `ARCHITECTURE_DECISIONS.md` | ADRs (Architecture Decision Records) para todas as decisões documentadas neste plano | Fase A |
| `ASL_SPEC.md` | Especificação formal do IR ASL: tipos, nós, semântica, regras de normalização | Fase B.1 |
| `DESIGN_SYSTEM.md` | Design system completo: paleta, tokens CSS, componentes, estados, A11Y | Fase F.2 |
| `SCHEMASMITH_GUIDE.md` | Guia de criação de boards e componentes em Schemasmith: fluxo, schema, exemplos | Fase E.1 |
| `SECURITY_POLICY.md` | Política de segurança pública: responsible disclosure, CVE process, SLA | Fase F.6 |
| `ROADMAP_TIMELINE.md` | Estimativas de duração por fase e subfase | Quando necessário |
| `PARTNER_GUIDE.md` | Guia para hardware partners e education partners (L.3) | Fase L.3 |