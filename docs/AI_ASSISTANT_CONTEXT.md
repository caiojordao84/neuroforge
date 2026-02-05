# 🤖 AI Assistant Context - NeuroForge Project

> **Data de Criação:** 05/02/2026 01:45 WET  
> **Commit Base:** `86cf8a4` - "ignore google drive files" (04/02/2026 14:33)

---

## 📋 Instruções para Assistentes de IA

Tu és Perplexity, um assistente técnico ajudando o desenvolvedor **Caio** a construir o projeto **NeuroForge**, um simulador de microcontroladores voltado tanto para makers quanto para uso doméstico e industrial (PLC/SCADA, dashboards, etc.). O objetivo é ter uma plataforma capaz de rodar firmwares reais de vários MCUs (Arduino AVR, ESP32, futuramente RP2040/STM32), orquestrados via QEMU ou outros emuladores, com uma camada de simulação unificada para GPIO, rede, sensores e integrações.

---

## 📁 Contexto do Repositório

**Repositório:** [`caiojordao84/neuroforge`](https://github.com/caiojordao84/neuroforge)  
**Branch:** `main`  
**Commit atual:** `86cf8a459d4ff7cc83bd7d890c8e1985feefbd21` (04/02/2026 14:33)

### Estrutura do Projeto

```
neuroforge/
├── README.md                 # Visão geral do projeto
├── docs/                     # Documentação completa
│   ├── ROADMAP.md           # Roadmap macro (fonte única de verdade)
│   ├── roadmaps/            # Roadmaps técnicos específicos
│   ├── architecture/        # Documentação de arquitetura
│   ├── boards/              # Especificações de placas (JSON)
│   ├── firmware/            # Guias de firmware ESP32
│   ├── fixes.md             # Histórico de correções (FIX 1.1-1.10)
│   ├── serial-gpio-protocol.md  # Protocolo Serial GPIO v1.0
│   └── project-tree.md      # Árvore de arquivos
├── src/                     # Frontend React + TypeScript
│   ├── components/          # Componentes UI e simulação
│   ├── lib/                 # Bibliotecas (React Flow, Monaco)
│   └── ...
├── server/                  # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── services/
│   │   │   ├── CompilerService.ts      # ✅ Arduino CLI wrapper
│   │   │   ├── QEMURunner.ts           # ✅ QEMU AVR runner
│   │   │   ├── QEMUSimulationEngine.ts # ✅ Engine QEMU AVR
│   │   │   ├── QEMUMonitorService.ts   # ✅ QEMU Monitor (GPIO experimental)
│   │   │   ├── Esp32Backend.ts         # 🚧 ESP32 backend (básico, NÃO integrado)
│   │   │   └── Esp32SerialClient.ts    # 🚧 Cliente TCP ESP32 (básico)
│   │   └── server.ts
│   └── ...
├── poc/                     # Provas de conceito antigas
└── ...
```

---

## ✅ Estado de Implementação (Commit 86cf8a4)

### ✅ **FUNCIONANDO (Arduino AVR):**

1. **Frontend:**
   - React + TypeScript + Vite
   - Monaco Editor (multi-file)
   - React Flow canvas
   - Floating windows
   - Componentes visuais: LED, Button, Servo, Potentiometer, etc.

2. **Backend AVR:**
   - **CompilerService.ts**: Compila código Arduino usando `arduino-cli` → gera `.elf`
   - **QEMURunner.ts**: Executa QEMU AVR (`qemu-system-avr -machine arduino-uno -bios firmware.elf`)
   - **QEMUSimulationEngine.ts**: Orquestra compilação + QEMU + GPIO polling
   - **QEMUMonitorService.ts**: Monitora GPIO via `info registers` (experimental)
   - **Serial output**: Funciona via stdio do QEMU
   - **LED no pin 13**: ✅ **PISCA CORRETAMENTE**

3. **Protocolo Serial GPIO:**
   - Especificação v1.0 em `docs/serial-gpio-protocol.md`
   - Formato: `G:pin=13,v=1` (HIGH) ou `G:pin=13,v=0` (LOW)
   - Biblioteca AVR: `NeuroForgeGPIO` (não confirmado se está no commit atual)

---

### 🚧 **EM DESENVOLVIMENTO (ESP32):**

**⚠️ IMPORTANTE:** Os arquivos `Esp32Backend.ts` e `Esp32SerialClient.ts` existem no commit `86cf8a4`, mas:
- ❌ **NÃO estão integrados** ao QEMUSimulationEngine
- ❌ **NÃO são usados** atualmente
- ❌ **NÃO afetam** o funcionamento do Arduino

**Status ESP32:**
- ✅ **Ambiente local (Windows):**
  - ESP-IDF v6.1 instalado em `D:\Tools\esp-idf`
  - QEMU ESP32 em `D:\Tools\esp-idf-tools`
  - `hello_world` compila e roda em QEMU manualmente
  - Serial via TCP (`socket://localhost:5555`) funciona

- 🚧 **Integração no NeuroForge:**
  - Arquivos base criados mas não conectados
  - Falta: integrar Esp32Backend no QEMUSimulationEngine
  - Falta: exemplo completo de GPIO ESP32
  - Falta: documentação de build ESP32

---

## 📋 ROADMAP Macro (docs/ROADMAP.md)

**Fase 0 - Fundação:** ✅ CONCLUÍDA
- Frontend completo
- SimulationEngine customizado (não-QEMU)
- Componentes básicos

**Fase 1 - Migração QEMU:** 🚧 EM ANDAMENTO
- ✅ Arduino AVR + QEMU funcional
- 🚧 ESP32 backend em desenvolvimento
- 🔜 RP2040 planejado

**Fases 2-5:** 📅 PLANEJADAS
- Componentes avançados
- Dashboard builder (Home Assistant style)
- Features industriais (PLC/SCADA, Modbus, Ladder)
- Polish + monetização

---

## 🏗️ Arquitetura Multi-Backend

**Documentação:** `docs/architecture/backends.md`

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
- ✅ **AvrBackend** (via QEMURunner): Arduino Uno/Nano/Mega
- 🚧 **Esp32Backend** (básico, não integrado): ESP32 via QEMU Xtensa
- 🔜 **Rp2040Backend** (planejado): Raspberry Pi Pico

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
```

### Fluxo:
1. Firmware emite `G:...` na UART
2. Backend Node lê via stdio (AVR) ou TCP (ESP32)
3. SerialGPIOService parseia e emite eventos
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
   - ❌ **NÃO MEXER**: `CompilerService.ts`, `QEMURunner.ts` (AVR)
   - ✅ **CRIAR**: `Esp32Backend.ts`, `Esp32QemuRunner.ts`, etc.

4. **ÚNICO CÓDIGO COMPARTILHADO:**
   - NeuroForge Time (timer/clock)
   - Protocolo Serial GPIO
   - WebSocket/API routes

---

## ✅ Checklist de Integração ESP32 (Próximos Passos)

- ⬜ **Completar `Esp32Backend.ts`:**
  - Encapsular comando QEMU ESP32
  - Parametrizar flash/efuse paths
  - Expor serial via TCP

- ⬜ **Completar `Esp32SerialClient.ts`:**
  - Conectar em `tcp://localhost:<porta>`
  - Buffering + line-breaking
  - Parser `G:...` compartilhado com AVR

- ⬜ **Integrar no `QEMUSimulationEngine.ts`:**
  - Detectar `board === 'esp32'`
  - Usar `Esp32Backend` em vez de `QEMURunner`
  - Routing correto de serial/GPIO

- ⬜ **Criar exemplo TypeScript:**
  - `example-gpio-esp32.ts`
  - Inicializar `Esp32Backend`
  - Conectar serial TCP
  - Testar eventos GPIO

- ⬜ **Documentar build ESP32:**
  - Como compilar firmware ESP-IDF
  - Onde ficam `qemu_flash.bin` / `qemu_efuse.bin`
  - Integração com NeuroForge

---

## 🎯 Público Alvo

- **Makers (B2C)**: UX simples, Arduino, componentes visuais, dashboards
- **Indústria (B2B)**: PLC/SCADA, Modbus, Ladder, logs estruturados, CI/CD
- **Doméstico/Comercial**: Dashboards IoT estilo Home Assistant

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
   - ESP32: TCP socket

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

- **Data atual:** 05/02/2026 01:45 WET
- **Último incidente:** Commits da noite de 04/02 (23:28+) quebraram Arduino ao mexer em arquivos compartilhados. Revertido para `86cf8a4`.
- **Lição aprendida:** Sempre criar arquivos novos para novos MCUs, nunca modificar código AVR funcionando.

---

## 📚 Documentação Relevante

- [ROADMAP.md](./ROADMAP.md) - Roadmap macro do projeto
- [serial-gpio-protocol.md](./serial-gpio-protocol.md) - Protocolo Serial GPIO v1.0
- [fixes.md](./fixes.md) - Histórico de correções
- [architecture/backends.md](./architecture/backends.md) - Arquitetura de backends
- [boards/](./boards/) - Especificações de placas

---

**Use este contexto como base para todas as respostas futuras sobre NeuroForge.**
