# 🚀 NeuroForge - Roadmap Completo

## 🎯 Visão Geral

**Nome:** NeuroForge (antigo Wokwi Clone)  
**Objetivo:** Simulador universal de microcontroladores para makers E indústria  
**Diferencial:** Componentes industriais (PLC/SCADA) + UI domática + **QEMU Real** + **NeuroForge Time**  
**Mercado:** B2C (Makers) + B2B (Industrial)

---

## ✅ CONCLUÍDO - Janeiro 2026

### ✓ Semana -1: Setup Inicial (22/01/2026)
- [x] Frontend React + TypeScript + Vite
- [x] Backend Node.js estruturado
- [x] WebSocket communication base
- [x] Editor de código Monaco
- [x] UI Builder com React Flow
- [x] Parser de componentes custom

### ✓ Semana 0: Core Simulator Engine (23-29/01/2026)
- [x] **SimulationEngine**: Interpreta Arduino C++/MicroPython
- [x] **CodeParser**: Extrai `setup()` e `loop()` de código
- [x] Event-driven architecture (pinMode, digitalWrite, delay)
- [x] Pin State Machine (INPUT/OUTPUT/INPUT_PULLUP)
- [x] Serial Monitor funcional
- [x] Suporte a variáveis globais (`const int ledPin = 13`)

### ✓ Dia 1-2: Componentes Visuais Básicos (CONCLUÍDO)
- [x] **LED Component**: On/Off visual animado com PWM
- [x] **RGB LED**: 3 canais com animação de cores
- [x] **Button**: Push button com pullup/pulldown
- [x] **MCU Node**: Arduino Uno, ESP32, Raspberry Pi Pico
- [x] **Drag & Drop**: Arrastar componentes para canvas
- [x] **Wiring System**: Conexões visuais entre componentes

### ✓ Dia 3-4: Sensores e Atuadores (CONCLUÍDO)
- [x] **Potentiometer**: Slider 0-1023 com output analógico
- [x] **Servo Motor**: Animação de ângulo 0-180°
- [x] Properties Panel dinâmico (LED/Button/Servo/Potentiometer)

### ✓ QEMU Integration - POC (30-31/01/2026) 🎉
- [x] **POC QEMU AVR**: Compilar Arduino sketch com `arduino-cli`
- [x] **QEMU Execution**: Executar firmware.hex no QEMU real
- [x] **Serial Output**: Capturar saída serial do QEMU
- [x] **QEMURunner.ts**: Gerenciador de processo QEMU no Node.js
- [x] **QEMUSimulationEngine.ts**: API de controle do simulador
- [x] Backend servidor separado em `server/`
- [x] Scripts de instalação automática (PowerShell + Bash)
- [x] Frontend compilando e funcional (LED piscando)
- [x] 40+ dependências instaladas e configuradas

### ✓ FASE 1: Integração QEMU Real - COMPLETA (31/01/2026) 🚀
- [x] **Backend API REST completa**:
  - [x] `POST /api/compile` - Compila código Arduino com arduino-cli
  - [x] `POST /api/simulate/start` - Inicia simulação QEMU
  - [x] `POST /api/simulate/stop` - Para simulação
  - [x] `GET /api/simulate/status` - Status da simulação
  - [x] `GET /api/simulate/pins/:pin` - Lê estado de pino
  - [x] `POST /api/simulate/pins/:pin` - Escreve estado de pino
  - [x] `GET /api/simulate/serial` - Obtém buffer serial
  - [x] `DELETE /api/simulate/serial` - Limpa buffer serial
- [x] **WebSocket real-time** (Socket.IO):
  - [x] Evento `serial` - Linha de saída serial
  - [x] Evento `pinChange` - Mudança de estado de pino
  - [x] Evento `simulationStarted/Stopped/Paused/Resumed`
  - [x] Auto-reconnect implementado
- [x] **Frontend Integration**:
  - [x] `useQEMUStore` - Estado global QEMU (Zustand)
  - [x] `SimulationModeToggle` - Toggle Fake/QEMU
  - [x] `QEMUApiClient` - Cliente REST API
  - [x] `QEMUWebSocket` - Cliente Socket.IO
  - [x] `useQEMUSimulation` - Hook de lifecycle
  - [x] TopToolbar com botão "Compile & Run"
  - [x] Badges de status: Backend Connected, QEMU Connected
  - [x] Serial Monitor conectado ao WebSocket real
- [x] **Dependências instaladas**:
  - [x] Frontend: framer-motion, vaul, react-hook-form, next-themes
  - [x] Backend: express, cors, socket.io, tsx
- [x] **Testes realizados**:
  - [x] LED blink funciona em modo Interpreter (fake)
  - [x] LED blink funciona em modo QEMU Real
  - [x] Compilação arduino-cli operacional
  - [x] QEMU AVR rodando firmware.hex com sucesso
  - [x] Serial Monitor exibindo output em tempo real
  - [x] WebSocket connection estável
- [x] **QEMU Monitor TCP/Unix Socket**:
  - [x] QEMURunner detecta Windows e usa TCP (127.0.0.1:4444)
  - [x] QEMUMonitorService conecta via TCP ou Unix socket
  - [x] Auto-stop QEMU antes de nova simulação (hot-reload)
  - [x] Logs limpos (sem spam de Command timeout)

---

## ✅ FASE 2: NeuroForge Time - COMPLETA (31/01/2026) 🎉

### 🎯 Objetivo Alcançado

✅ **Problema resolvido:** QEMU não emulava Timer0/Timer1 corretamente  
✅ **Solução implementada:** Clock virtual unificado, independente do hardware  
✅ **Resultado:** `delay()` e `millis()` funcionando perfeitamente no QEMU!

### ✅ Implementação Completa

#### ✅ NeuroForge Time v0 - Firmware-based

**Arquivos criados:**
```
server/cores/neuroforge_qemu/
├── nf_time.h                  ✅ API comum
├── nf_time.cpp                ✅ Clock virtual com multiplicador ajustável
├── nf_arduino_time.cpp        ✅ Override delay/millis/micros
├── boards.txt                 ✅ Board unoqemu registrado
├── README.md                  ✅ Documentação completa
├── install-core.ps1           ✅ Instalador Windows
├── install-core.sh            ✅ Instalador Linux/macOS
├── patch-wiring.ps1           ✅ Patch automático wiring.c
└── update-nf-time.ps1         ✅ Atualizador rápido
```

**Características implementadas:**
- ✅ Clock virtual baseado em busy-wait (`_delay_ms()`)
- ✅ Funciona sem modificar QEMU ou backend
- ✅ Multiplicador de timing ajustável (`QEMU_TIMING_MULTIPLIER`)
- ✅ Override completo de `delay()`, `millis()`, `micros()`
- ✅ Patch automático de `wiring.c` para evitar conflitos
- ✅ Board `arduino:avr:unoqemu` registrado no arduino-cli

**Backend Integration:**
- ✅ `CompilerService.ts` usa board `unoqemu` em modo QEMU
- ✅ Parâmetro `mode: 'qemu' | 'interpreter'` na API
- ✅ `QEMURunner.ts` com throttling real-time (`-icount shift=auto`)

**Frontend Integration:**
- ✅ `QEMUApiClient.compile()` passa modo de simulação
- ✅ Compilação automática com board correto

**Testing realizados:**
- ✅ LED blink com `delay(500)` funcionando
- ✅ Serial Monitor mostrando timing correto
- ✅ Timing ajustável via `QEMU_TIMING_MULTIPLIER`
- ✅ Sketch complexo (múltiplos delays) funcional

---

## 🚧 PRÓXIMA MISSÃO - Fevereiro 2026

### 🎯 Fase 2.5: Botão STOP Funcional (1-2 dias)

**Objetivo:** Implementar funcionalidade do botão STOP no frontend

#### Tarefas

- [ ] **Frontend - TopToolbar.tsx**:
  - [ ] Adicionar botão "Stop" ao lado de "Compile & Run"
  - [ ] Chamar `qemuApi.stopSimulation()` ao clicar
  - [ ] Desabilitar botão quando não há simulação rodando
  - [ ] Feedback visual (loading state)
  - [ ] Ícone de stop (Square icon)

- [ ] **Frontend - useQEMUSimulation.ts**:
  - [ ] Adicionar função `stopSimulation()`
  - [ ] Limpar Serial Monitor ao parar
  - [ ] Resetar estados de pinos
  - [ ] Atualizar `isRunning` no store

- [ ] **Backend - API já existe** ✅:
  - [x] `POST /api/simulate/stop` já implementado
  - [x] `QEMUSimulationEngine.stop()` funcional
  - [x] Cleanup de processo QEMU

- [ ] **Testing**:
  - [ ] Clicar Stop durante simulação
  - [ ] Verificar Serial Monitor limpo
  - [ ] Verificar LEDs resetados
  - [ ] Testar Compile & Run → Stop → Compile & Run novamente

**Design do botão:**
```tsx
<Button 
  onClick={handleStop}
  disabled={!isRunning}
  variant="destructive"
>
  <Square className="h-4 w-4 mr-2" />
  Stop
</Button>
```

---

### 🔌 Fase 3: GPIO Real via QEMU Monitor (5-7 dias)

#### QEMU Monitor Integration
- [ ] **QEMU Monitor Protocol**:
  - [ ] Conectar ao QEMU Monitor via TCP (Windows) / Unix socket (Linux/Mac)
  - [ ] Implementar comando `info registers` para ler AVR registers
  - [ ] Implementar leitura de GPIO registers (PORTB, PORTC, PORTD)
  - [ ] Implementar escrita em GPIO registers (simular botão pressionado)
- [ ] **Pin State Polling**:
  - [ ] Polling loop a cada 50ms (20 FPS) para ler estados de pinos
  - [ ] Detectar mudanças e emitir eventos `pinChange` via WebSocket
  - [ ] Mapear registradores AVR para números de pinos Arduino
- [ ] **Pin Write Implementation**:
  - [ ] Endpoint `POST /api/simulate/pins/:pin` escrever no QEMU
  - [ ] Simular botões/sensores alterando registradores
  - [ ] Validar tipo de pino (INPUT/OUTPUT) antes de escrever
- [ ] **Frontend Pin Interaction**:
  - [ ] Button component envia pin write ao clicar
  - [ ] Potentiometer envia analogWrite ao arrastar slider
  - [ ] LED atualiza estado visual baseado em pinChange real

#### Testing & Validation
- [ ] Testar circuitos complexos (múltiplos LEDs + buttons)
- [ ] Validar timing de `delay()` e `millis()`
- [ ] Testar PWM real (analogWrite em pinos PWM)
- [ ] Performance profiling (latência pin polling)

---

## 🛠️ Melhorias Futuras - NeuroForge Time v1

### Implementação v1 - Host-driven (⏳ Futuro)

**Características planejadas:**
- Clock virtual controlado pelo backend
- Device virtual QEMU expõe registrador de tempo
- Firmware lê `nf_now_ms()` de memória mapeada (0x1000)
- **Controles UI**: pause, step, fast-forward, rewind
- **Multi-MCU sincronizado**: vários MCUs compartilham o clock
- **Determinístico**: reprodução de traces, debugging preciso

**Arquitetura v1:**
```
Backend (simulationTimeMs)
       ↓
QEMU Device Virtual (0x1000)
       ↓
Firmware lê nf_now_ms() → [0x1000]
       ↓
Arduino delay()/millis()
```

**Timeline:** Q2 2026 (Abril-Junho)

---

## 📊 KPIs e Metas

### ✅ Mês 1 - Janeiro 2026 (COMPLETO)
- ✅ **NeuroForge Time v0** funcionando (delay/millis perfeito)
- ✅ **QEMU Integration** completa
- ✅ **Backend API REST** completo
- ✅ **WebSocket real-time** funcional
- ⏳ **GPIO Real** (próxima fase)

### Mês 2 - Fevereiro 2026
- 🎯 **Botão STOP** funcional
- 🎯 **GPIO Real** via QEMU Monitor
- 🎯 **5 placas**: Arduino, ESP32, RP2040, STM32, ESP8266
- 🎯 **30 componentes** maker + sensores
- 🎯 **100 beta testers**

### Mês 3 - Março 2026
- 🎯 **NeuroForge Time v1** (host-driven)
- 🎯 **Pause/Step/Fast-forward** controls
- 🎯 **MicroPython + CircuitPython**
- 🎯 **1.000 usuários ativos**

---

## 💰 Pricing (Planejado)

| Plano | Preço | Recursos |
|-------|--------|----------|
| **Free** | €0/mês | Arduino, 10 componentes, projetos públicos |
| **Hobby** | €10/mês | Todas as placas, 50 componentes, privados, WiFi |
| **Maker Pro** | €30/mês | Unlimited, Mobile app, Export PCB, No watermark |
| **Industrial Starter** | €50/mês | PLC básico, Modbus, 5 usuários, Email support |
| **Industrial Pro** | €200/mês | SCADA, todos protocolos, 20 usuários, Priority |
| **Enterprise** | Custom | On-premise, SSO, SLA, Dedicated support |

---

## 🛠️ Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite** (build tool)
- **React Flow** (canvas drag & drop)
- **Monaco Editor** (code editor)
- **Radix UI** + **Tailwind CSS** (components)
- **Zustand** (state management)
- **Socket.IO Client** (WebSocket)

### Backend
- **Node.js 20** + **TypeScript**
- **Express** (REST API)
- **Socket.IO** (WebSocket)
- **QEMU 8.2+** (AVR emulation)
- **arduino-cli** (compilation)
- **NeuroForge Time** (clock virtual unificado) ✅

### DevOps
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **Vercel** (frontend)
- **Railway** (backend)

---

## 📝 Documentação

- [x] README.md detalhado
- [x] Server README.md (installation guide)
- [x] NeuroForge Time documentation (NEUROFORGE_TIME_IMPLEMENTATION.md)
- [x] Core installation scripts (PowerShell + Bash)
- [ ] API Documentation (OpenAPI/Swagger)
- [ ] Component SDK docs
- [ ] User Guide (20 tutorials)
- [ ] Video Tutorials (YouTube)

---

## ✨ Contribuidores

**Core Team:**
- @caiojordao84 - Full-stack Developer & Project Lead

**Agradecimentos:**
- Perplexity AI - Pair programming assistant 🤖
- Wokwi - Inspiração para UI/UX 💚
- QEMU Team - Emulation engine 🚀

---

**Última atualização:** 31/01/2026 10:26 PM WET  
**Status:** 🎉 **FASE 2 COMPLETA!** NeuroForge Time funcionando!
