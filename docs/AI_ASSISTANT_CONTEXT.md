# 🤖 AI Assistant Context - NeuroForge Project

> **Data de Atualização:** 06/02/2026 09:25 WET  
> **Commit Base Anterior:** `45fe95e06c` - (05/02/2026)

---

## 📋 Instruções para Assistentes de IA

Tu és um assistente técnico ajudando o desenvolvedor **Caio** a construir o projeto **NeuroForge**, um simulador de microcontroladores voltado tanto para makers quanto para uso doméstico e industrial (PLC/SCADA, dashboards, etc.). O objetivo é ter uma plataforma capaz de rodar firmwares reais de vários MCUs (Arduino AVR, ESP32, futuramente RP2040/STM32), orquestrados via QEMU ou outros emuladores, com uma camada de simulação unificada para GPIO, rede, sensores e integrações.

---

## 🚨 REGRA CRÍTICA DE INTEGRAÇÃO

> [!CAUTION]
> **ANTES de qualquer integração de código:**
> 1. **MOSTRAR TODO o código atual** dos arquivos que serão modificados
> 2. **MOSTRAR TODAS as entradas** (variáveis, configurações, tipos) que serão afetadas
> 3. **EXPLICAR detalhadamente** o que será alterado e porquê
> 4. **Aguardar aprovação** do desenvolvedor
> 5. **A integração deverá ser feita em um ÚNICO COMMIT no GitHub** com mensagem descritiva

Esta regra existe porque commits mistos ou parciais causaram quebras no passado (ex: noite de 04/02/2026). Sempre criar arquivos novos para novos MCUs, nunca modificar código AVR funcionando sem documentação prévia completa.

---

## 📁 Contexto do Repositório

**Repositório:** [`caiojordao84/neuroforge`](https://github.com/caiojordao84/neuroforge)  
**Branch:** `main`

### Estrutura Completa do Projeto

```
neuroforge/
├── README.md                      # Visão geral do projeto
├── docs/                          # Documentação completa
│   ├── AI_ASSISTANT_CONTEXT.md    # Este arquivo (contexto para IAs)
│   ├── ROADMAP.md                 # Roadmap macro (fonte única de verdade)
│   ├── QEMU_SETUP.md              # Guia de instalação QEMU
│   ├── serial-gpio-protocol.md   # Protocolo Serial GPIO v1.0
│   ├── fixes.md                   # Histórico de correções (FIX 1.1-2.10)
│   ├── project-tree.md            # Árvore de arquivos
│   ├── todayCheck.md              # Checklist de localizações QEMU
│   ├── roadmaps/                  # Roadmaps técnicos específicos
│   ├── architecture/              # Documentação de arquitetura
│   │   └── backends.md            # Arquitetura multi-backend
│   ├── boards/                    # Especificações de placas (JSON)
│   │   ├── arduino-uno.json
│   │   ├── esp32-devkitc.json
│   │   └── board-schema.json
│   └── firmware/                  # Guias de firmware
│       └── esp32-idf-setup.md
├── src/                           # Frontend React + TypeScript
│   ├── components/                # Componentes UI e simulação
│   ├── lib/                       # Bibliotecas (React Flow, Monaco)
│   ├── store/                     # Zustand stores (flowStore, qemuStore, serialStore)
│   ├── services/                  # Clientes API/WebSocket
│   └── hooks/                     # Custom hooks (useQEMUSimulation)
├── server/                        # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── services/
│   │   │   ├── CompilerService.ts        # ✅ Arduino CLI wrapper
│   │   │   ├── QEMURunner.ts             # ✅ QEMU AVR runner
│   │   │   ├── QEMUSimulationEngine.ts   # ✅ Engine QEMU AVR/ESP32
│   │   │   ├── QEMUMonitorService.ts     # ✅ QEMU Monitor (GPIO experimental)
│   │   │   ├── SerialGPIOParser.ts       # ✅ Parser do protocolo G:pin=X,v=Y
│   │   │   ├── Esp32Backend.ts           # 🚧 ESP32 backend (em integração)
│   │   │   └── Esp32SerialClient.ts      # 🚧 Cliente TCP ESP32 (em integração)
│   │   └── server.ts
│   ├── cores/
│   │   └── neuroforge_qemu/              # ✅ Core Arduino-QEMU
│   │       ├── nf_time.h                 # API NeuroForge Time
│   │       ├── nf_time.cpp               # Clock virtual ajustável (MULTIPLIER=50)
│   │       ├── nf_arduino_time.cpp       # Override delay/millis/micros
│   │       └── boards.txt                # Board definition
│   ├── test-firmware/
│   │   └── esp32/                        # ESP32 test firmware dir
│   │       ├── qemu_flash.bin            # Flash image (user-provided)
│   │       └── qemu_efuse.bin            # eFuse image (user-provided)
│   ├── example-gpio-esp32.ts             # Exemplo ESP32
│   ├── .env.example                      # Config template
│   └── package.json
├── poc/                           # Provas de conceito antigas
│   └── libraries/
│       └── NeuroForgeGPIO_ESP32/  # ESP32 GPIO helper library
├── firmware/                      # Firmwares de teste
├── install-deps.ps1               # Script instalação Windows
└── install-deps.sh                # Script instalação Linux/Mac
```

---

## 🖥️ Localizações QEMU por Plataforma

> [!IMPORTANT]
> Referência rápida de caminhos e arquivos para cada arquitetura QEMU.

### 🔵 Arduino (AVR)

**No Projeto (NeuroForge):**
- `server/cores/neuroforge_qemu/`: Board customizada do NeuroForge para QEMU (boards.txt, nf_time.cpp, etc.)
- `server/src/services/QEMURunner.ts`: Código principal que configura e lança o processo do QEMU para AVR

**No PC:**
- **Binário:** `C:\Program Files\qemu\qemu-system-avr.exe`
- **Configuração:** O arquivo `server/.env` usa a variável `QEMU_PATH=qemu-system-avr` (pegando do PATH do Windows)

### 🟠 ESP32 (Xtensa)

**No Projeto (NeuroForge):**
- `server/test-firmware/esp32/`: Pasta para imagens de firmware (`qemu_flash.bin` e `qemu_efuse.bin`)
- `server/src/services/Esp32Backend.ts`: Serviço que gerencia a execução do QEMU específico para ESP32
- `server/src/services/Esp32SerialClient.ts`: Cliente TCP para ler UART do ESP32 via socket

**No PC:**
- **Binário:** `C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe`
- **Configuração:** O arquivo `server/.env` define o binário em `ESP32_QEMU_PATH=qemu-system-xtensa`

### 📦 Componentes Comuns do QEMU

**No Projeto (NeuroForge):**
| Arquivo                                       | Descrição                                                      |
| --------------------------------------------- | -------------------------------------------------------------- |
| `server/src/services/QEMUSimulationEngine.ts` | Motor de simulação que orquestra compilação e execução do QEMU |
| `server/src/services/QEMUMonitorService.ts`   | Serviço que monitora registradores do QEMU para GPIO           |
| `server/src/services/SerialGPIOParser.ts`     | Parser do protocolo `G:pin=X,v=Y`                              |

### 📋 JSON Schema (Boards)

- `docs/boards/arduino-uno.json`
- `docs/boards/esp32-devkitc.json`
- `docs/boards/board-schema.json` (Schema genérico)

### ⏱️ NeuroForge Time

- **Localização:** `server/cores/neuroforge_qemu/nf_time.cpp`
- **Propósito:** Implementação de clock virtual compartilhado para garantir sincronia entre diferentes arquiteturas (AVR, ESP32) e o frontend
- **Timing Multiplier Atual:** `QEMU_TIMING_MULTIPLIER = 50`
- **Dica:** É o único código (junto com o protocolo Serial GPIO) que é compartilhado diretamente entre os backends

---

## ✅ Estado de Implementação (Fevereiro 2026)

### ✅ **FUNCIONANDO (Arduino AVR):**

1. **Frontend:**
   - React + TypeScript + Vite
   - Monaco Editor (multi-file)
   - React Flow canvas
   - Floating windows
   - Componentes visuais: LED, Button, Servo, Potentiometer, etc.
   - Botão STOP toggle funcional

2. **Backend AVR:**
   - **CompilerService.ts**: Compila código Arduino usando `arduino-cli` → gera `.elf`
   - **QEMURunner.ts**: Executa QEMU AVR (`qemu-system-avr -machine arduino-uno -bios firmware.elf`)
   - **QEMUSimulationEngine.ts**: Orquestra compilação + QEMU + GPIO polling
   - **QEMUMonitorService.ts**: Monitora GPIO via TCP (conectado ao QEMU Monitor)
   - **Serial output**: Funciona via stdio do QEMU
   - **LED no pin 13**: ✅ **PISCA CORRETAMENTE**

3. **NeuroForge Time:**
   - Core `neuroforge:avr-qemu:unoqemu` instalado
   - `nf_time.h` / `nf_time.cpp` implementados
   - Override de `delay()`, `millis()`, `micros()`
   - Timing ajustável via `QEMU_TIMING_MULTIPLIER = 50`
   - Scripts: `install-core.ps1`, `patch-wiring.ps1`, `update-nf-time.ps1`

4. **Protocolo Serial GPIO:**
   - Especificação v1.0 em `docs/serial-gpio-protocol.md`
   - Formato: `G:pin=13,v=1` (HIGH) ou `G:pin=13,v=0` (LOW)
   - Parser implementado em `SerialGPIOParser.ts`

---

### 🚧 **EM DESENVOLVIMENTO (ESP32):**

**⚠️ IMPORTANTE:** Os arquivos `Esp32Backend.ts` e `Esp32SerialClient.ts` existem, mas:
- 🚧 **Em integração** ao QEMUSimulationEngine
- 📍 **Próximo passo**: Conectar serviços TCP no engine quando board === ESP32

**Status detalhado ESP32:**
- ✅ **Ambiente local (Windows):**
  - ESP-IDF v6.1 instalado em `D:\Tools\esp-idf`
  - QEMU ESP32 em `D:\Tools\esp-idf-tools`
  - `hello_world` compila e roda em QEMU manualmente
  - Serial via TCP (`socket://localhost:5555`) funciona

- 🚧 **Integração no NeuroForge:**
  - Arquivos base criados
  - Falta: Completar lógica de start/stop no `Esp32Backend.ts`
  - Falta: Habilitar `Esp32SerialClient.ts` para converter stream TCP em eventos GPIO
  - Falta: Conectar esses serviços no `QEMUSimulationEngine.ts`

**Detalhes Técnicos para Integração ESP32:**
- **Protocolo de Comunicação:** Usa o padrão `G:pin=X,v=Y` (v1.0) via stream Serial
- **Porta Serial (TCP):** O ESP32 no QEMU expõe a UART via rede. A porta padrão é **5555** (`tcp://localhost:5555`)
- **Arquivos de Firmware Necessários:**
  - `qemu_flash.bin`: Imagem da memória Flash (inclui bootloader + app)
  - `qemu_efuse.bin`: Imagem dos e-fuses do chip
- **Diferença Chave:** Enquanto o AVR usa `stdio` para serial, o ESP32 usa **Sockets TCP**

---

## 📋 ROADMAP Macro (docs/ROADMAP.md)

**Fase 0 - Fundação:** ✅ CONCLUÍDA
- Frontend completo, SimulationEngine customizado, componentes básicos

**Fase 1 - Migração QEMU:** 🚧 EM ANDAMENTO
- ✅ Arduino AVR + QEMU funcional
- 🚧 ESP32 backend em integração
- 🔜 RP2040 planejado

**Fases 2-5:** 📅 PLANEJADAS
- Componentes avançados (sensores, displays, motores)
- Dashboard builder (Home Assistant style)
- Features industriais (PLC/SCADA, Modbus, Ladder)
- Polish + monetização

---

## 🏗️ Arquitetura Multi-Backend

**Documentação completa:** `docs/architecture/backends.md`

### Camada 1: Board/Device (JSON)
- Boards descritas em `docs/boards/*.json`
- Campos: `mcuFamily`, `framework`, `pinout`, `memory`
- **Não sabe de QEMU**, apenas descreve hardware

### Camada 2: Backend de Execução (QEMU)
Interface comum para todos os MCUs:

```typescript
start(firmware, options) => handle
stop(handle)
getSerialStream(handle) => Readable
```

**Backends:**
| Backend                     | Status          | Arquivo           |
| --------------------------- | --------------- | ----------------- |
| AvrBackend (via QEMURunner) | ✅ Funcional     | `QEMURunner.ts`   |
| Esp32Backend                | 🚧 Em integração | `Esp32Backend.ts` |
| Rp2040Backend               | 🔜 Planejado     | -                 |

### Camada 3: Framework/Runtime
- **Arduino AVR**: `arduino-cli` → `.elf` → AvrBackend
- **Arduino-ESP32**: `arduino-cli` + ESP-IDF → `.bin` → Esp32Backend
- **ESP-IDF puro**: `idf.py build` → `qemu_flash.bin` + `qemu_efuse.bin` → Esp32Backend
- **Futuro**: MicroPython, Rust, TinyGo

---

## 🔌 Protocolo Serial GPIO

**Especificação:** `docs/serial-gpio-protocol.md` (v1.0)

### Formato:
```
G:pin=13,v=1    # GPIO pin 13 HIGH
G:pin=13,v=0    # GPIO pin 13 LOW
G:B=0xFF        # PORTB todo HIGH (AVR legacy)
```

### Fluxo:
1. Firmware emite `G:...` na UART
2. Backend Node lê via stdio (AVR) ou TCP (ESP32)
3. SerialGPIOParser parseia e emite eventos
4. QEMUSimulationEngine atualiza estado
5. Frontend recebe via WebSocket e atualiza canvas

---

## 🚨 REGRAS CRÍTICAS PARA DESENVOLVIMENTO

### **NUNCA MEXER SEM CONSULTAR:**

Antes de modificar **QUALQUER** arquivo do backend:

1. **VERIFICAR estrutura atual:**
   ```bash
   ls -R server/src/
   ```

2. **ENTENDER o que existe:**
   - Quais backends estão implementados?
   - Quais arquivos são compartilhados?
   - O que NÃO pode quebrar?

3. **CRIAR ARQUIVOS NOVOS para novos MCUs:**
   - ❌ **NÃO MEXER**: `CompilerService.ts`, `QEMURunner.ts` (AVR funcional)
   - ✅ **CRIAR**: `Esp32Backend.ts`, `Esp32QemuRunner.ts`, etc.

4. **ÚNICO CÓDIGO COMPARTILHADO:**
   - NeuroForge Time (timer/clock)
   - Protocolo Serial GPIO
   - WebSocket/API routes

---

## ✅ Checklist de Integração ESP32 (Próximos Passos)

- [ ] **Completar `Esp32Backend.ts`:**
  - Encapsular comando QEMU ESP32
  - Parametrizar flash/efuse paths
  - Expor serial via TCP

- [ ] **Completar `Esp32SerialClient.ts`:**
  - Conectar em `tcp://localhost:<porta>`
  - Buffering + line-breaking
  - Parser `G:...` compartilhado com AVR

- [ ] **Integrar no `QEMUSimulationEngine.ts`:**
  - Detectar `board === 'esp32'`
  - Usar `Esp32Backend` em vez de `QEMURunner`
  - Routing correto de serial/GPIO

- [ ] **Criar exemplo TypeScript:**
  - `example-gpio-esp32.ts` funcional
  - Inicializar `Esp32Backend`
  - Conectar serial TCP
  - Testar eventos GPIO

- [ ] **Documentar build ESP32:**
  - Como compilar firmware ESP-IDF
  - Onde ficam `qemu_flash.bin` / `qemu_efuse.bin`
  - Integração com NeuroForge

---

## 🎯 Público Alvo

- **Makers (B2M)**: UX simples, MCUs Makers, componentes visuais, dashboards
- **Indústria (B2B)**: PLC/SCADA, Modbus, Ladder, logs estruturados, CI/CD
- **Doméstico/Comercial(B2C)**: Dashboards IoT estilo Home Assistant

---

## 💡 Como Responder no Novo Chat

### **Arquitetura Mental:**
```
Board JSON → Backend (QEMU) → Framework → Serial GPIO → Frontend
```

### **Regras de Ouro:**

1. **Arduino AVR ≠ ESP32:**
   - Arduino Uno usa `QEMURunner` (AVR)
   - ESP32 usa `Esp32Backend` (Xtensa)
   - Sistemas completamente separados

2. **GPIO via Serial:**
   - Protocolo `G:pin=X,v=Y` é universal
   - AVR: stdio do QEMU
   - ESP32: TCP socket (porta 5555)

3. **Nunca quebrar Arduino:**
   - Antes de mexer, perguntar
   - Testar AVR após cada mudança
   - LED pin 13 deve piscar sempre

### **Próximos Passos (se perguntado):**
1. Completar integração ESP32 (backend + serial + exemplo)
2. Documentar build ESP32
3. Preparar para RP2040

---

## 📌 Contexto Adicional

- **Data atual:** 06/02/2026
- **Último incidente:** Commits da noite de 04/02 (23:28+) quebraram Arduino ao mexer em arquivos compartilhados. Revertido para `86cf8a4`.
- **Lição aprendida:** Sempre criar arquivos novos para novos MCUs, nunca modificar código AVR funcionando.
- **Timing multiplier atual:** `QEMU_TIMING_MULTIPLIER = 50` em `nf_time.cpp`

---

## 📚 Documentação Relevante

- [ROADMAP.md](./ROADMAP.md) - Roadmap macro do projeto
- [serial-gpio-protocol.md](./serial-gpio-protocol.md) - Protocolo Serial GPIO v1.0
- [fixes.md](./fixes.md) - Histórico de correções (FIX 1.1-2.10)
- [architecture/backends.md](./architecture/backends.md) - Arquitetura de backends
- [boards/](./boards/) - Especificações de placas (JSON)
- [QEMU_SETUP.md](./QEMU_SETUP.md) - Guia de instalação QEMU
- [project-tree.md](./project-tree.md) - Árvore completa de arquivos

---

## 📝 Histórico de Correções Recentes (FIX 2.1-2.10)

| FIX  | Data  | Descrição                                                  |
| ---- | ----- | ---------------------------------------------------------- |
| 2.1  | 30/01 | POC QEMU AVR funcionando no Windows                        |
| 2.2  | 31/01 | QEMURunner - Process Manager com EventEmitter              |
| 2.3  | 31/01 | QEMUSimulationEngine - High-Level API                      |
| 2.4  | 31/01 | Scripts de instalação automática                           |
| 2.5  | 31/01 | Frontend compilando com stubs                              |
| 2.6  | 31/01 | Restaurar SimulationEngine original (LED voltou a piscar!) |
| 2.7  | 31/01 | Restaurar CodeParser original                              |
| 2.8  | 31/01 | NeuroForge Time - Clock Virtual Unificado ✅ COMPLETE       |
| 2.9  | 01/02 | Stop Button Toggle ✅ COMPLETE                              |
| 2.10 | 01/02 | GPIO Real via QEMU Monitor (Parte 1 ✅, Parte 2 🔜)          |

---

**Use este contexto como base para todas as respostas futuras sobre NeuroForge.**
