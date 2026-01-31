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

## 🔄 FASE 2: NeuroForge Time + GPIO Real - EM PROGRESSO (31/01/2026)

### 🎯 Objetivo

Resolver o problema fundamental de temporização no QEMU AVR:
- QEMU não emula Timer0/Timer1 corretamente
- `delay()` trava indefinidamente
- `millis()` sempre retorna 0
- **Solução:** Clock virtual unificado, independente do hardware emulado

### 🕐 NeuroForge Time - Arquitetura

#### API Comum (todas as linguagens)

```c
// nf_time.h - Contrato unificado

uint32_t nf_now_ms(void);      // Tempo atual da simulação (ms)
uint32_t nf_now_us(void);      // Tempo atual da simulação (µs)
void nf_sleep_ms(uint32_t ms); // Dormir N ms em tempo de simulação
void nf_advance_ms(uint32_t);  // Avançar clock virtual (runtime interno)
```

#### Implementação v0 - Firmware-based (🔄 Atual)

**Características:**
- Clock virtual mantido dentro do firmware
- Usa busy-wait com `_delay_ms()` (baseado em F_CPU)
- Funciona imediatamente, sem modificar QEMU ou backend
- Limitação: não permite pause/step/fast-forward do host

**Arquivos:**
```
server/cores/neuroforge_qemu/
├── nf_time.h              # API comum
├── nf_time.cpp            # Implementação do clock virtual
└── nf_arduino_time.cpp    # Override delay/millis/micros
```

**Implementação:**
```cpp
// nf_time.cpp
static volatile uint32_t nf_ms = 0;

void nf_sleep_ms(uint32_t ms) {
  while (ms--) {
    _delay_ms(1);     // Busy-wait (funciona no QEMU AVR)
    nf_advance_ms(1); // Avança clock virtual
  }
}

// nf_arduino_time.cpp
void delay(unsigned long ms) {
  nf_sleep_ms((uint32_t)ms); // Substitui delay() original
}

unsigned long millis() {
  return nf_now_ms(); // Lê clock virtual
}
```

**Board de Simulação:**
```ini
# boards.txt
unoqemu.name=NeuroForge Uno (QEMU)
unoqemu.build.core=neuroforge_qemu
unoqemu.build.mcu=atmega328p
unoqemu.build.f_cpu=16000000L
```

**Integração Backend:**
```typescript
// CompilerService.ts
const board = mode === 'qemu' 
  ? 'neuroforge:avr-qemu:unoqemu'
  : 'arduino:avr:uno';
```

#### Implementação v1 - Host-driven (⏳ Futuro)

**Características:**
- Clock virtual vem do backend (NeuroForge server)
- Device virtual QEMU expõe registrador de tempo
- Firmware lê `nf_now_ms()` de memória mapeada
- Permite pause, step, fast-forward, rewind
- Multi-MCU sincronizado

**Arquitetura:**
```
Backend (simulationTimeMs)
       ↓
QEMU Device Virtual (0x1000)
       ↓
Firmware lê nf_now_ms() → [0x1000]
       ↓
arduino delay()/millis()
```

**Vantagens:**
- 🎮 **Controle total**: pause, step, fast-forward, rewind
- 🔄 **Multi-MCU sync**: vários MCUs compartilham o clock
- 📊 **Determinístico**: reprodução de traces, debugging preciso
- 🌐 **Multi-linguagem**: Python, Rust, C, todos usam o mesmo clock

---

### ⏱️ NeuroForge Time v0 - Tarefas (3-4 dias)

- [🔄] **Core arduino-uno-qemu**:
  - [🔄] Criar `server/cores/neuroforge_qemu/`
  - [🔄] Implementar `nf_time.h` / `nf_time.cpp`
  - [🔄] Implementar `nf_arduino_time.cpp`
  - [🔄] Criar `boards.txt` com board `unoqemu`
  - [🔄] Registrar core no arduino-cli
- [⏳] **Backend Integration**:
  - [⏳] CompilerService usar board `neuroforge:avr-qemu:unoqemu` em modo QEMU
  - [⏳] Script de instalação do core (install-core.sh/ps1)
- [⏳] **Testing**:
  - [⏳] LED blink com `delay(500)` funcionando
  - [⏳] Serial Monitor: "LED ON" / "LED OFF" a cada 500ms
  - [⏳] Sketch com `millis()` (blink sem delay)
  - [⏳] Sketch complexo (múltiplos delays, lógica)

---

### 🔌 GPIO Real via QEMU Monitor (5-7 dias)

#### QEMU Monitor Integration
- [⏳] **QEMU Monitor Protocol**:
  - [⏳] Conectar ao QEMU Monitor via TCP (Windows) / Unix socket (Linux/Mac)
  - [⏳] Implementar comando `info registers` para ler AVR registers
  - [⏳] Implementar leitura de GPIO registers (PORTB, PORTC, PORTD)
  - [⏳] Implementar escrita em GPIO registers (simular botão pressionado)
- [⏳] **Pin State Polling**:
  - [⏳] Polling loop a cada 50ms (20 FPS) para ler estados de pinos
  - [⏳] Detectar mudanças e emitir eventos `pinChange` via WebSocket
  - [⏳] Mapear registradores AVR para números de pinos Arduino
- [⏳] **Pin Write Implementation**:
  - [⏳] Endpoint `POST /api/simulate/pins/:pin` escrever no QEMU
  - [⏳] Simular botões/sensores alterando registradores
  - [⏳] Validar tipo de pino (INPUT/OUTPUT) antes de escrever
- [⏳] **Frontend Pin Interaction**:
  - [⏳] Button component envia pin write ao clicar
  - [⏳] Potentiometer envia analogWrite ao arrastar slider
  - [⏳] LED atualiza estado visual baseado em pinChange real

#### Testing & Validation
- [⏳] Testar circuitos complexos (múltiplos LEDs + buttons)
- [⏳] Validar timing de `delay()` e `millis()`
- [⏳] Testar PWM real (analogWrite em pinos PWM)
- [⏳] Performance profiling (latência pin polling)

---

## 🚧 PRÓXIMOS PASSOS - Fevereiro 2026

### 🟡 Fase 3: Expand Simulation Engine (MÉDIA PRIORIDADE)

#### Componentes Maker (5-7 dias)
- [ ] **Displays**:
  - [ ] LCD 16x2 (I2C)
  - [ ] OLED 128x64 (SPI/I2C)
  - [ ] TM1637 7-segment
- [ ] **Sensores**:
  - [ ] Ultrasonic HC-SR04
  - [ ] DHT22 (temp/humidity)
  - [ ] LDR (photoresistor)
  - [ ] PIR motion sensor
- [ ] **Atuadores**:
  - [ ] Buzzer (tone/noTone)
  - [ ] Relay module
  - [ ] DC Motor com L298N

#### Code Generation (3-4 dias)
- [ ] Template System por componente
- [ ] Smart Code Generator:
  - [ ] Analisa circuito e gera `setup()` + `loop()`
  - [ ] Merge inteligente de código
  - [ ] Preservar código do usuário (`// USER CODE START`)

---

### 🟢 Fase 4: Multi-Board + Multi-Language Support

#### ESP32 Support via QEMU (7-10 dias)
- [ ] QEMU ESP32 integration (qemu-system-xtensa)
- [ ] WiFi simulation (mock HTTP requests)
- [ ] Bluetooth simulation (mock BLE)
- [ ] Dual-core simulation
- [ ] **NeuroForge Time para ESP32**

#### Raspberry Pi Pico Support (5-7 dias)
- [ ] QEMU ARM Cortex-M0+ (qemu-system-arm)
- [ ] PIO (Programmable I/O) simulation
- [ ] **MicroPython support real** com nf_time

#### Multi-Language Runtime (7-10 dias)
- [ ] **MicroPython VM** com NeuroForge Time:
  ```python
  import time
  time.sleep(0.5)  # → nf_sleep_ms(500)
  time.time()      # → nf_now_ms() / 1000.0
  ```
- [ ] **Rust embedded** com nf_time:
  ```rust
  use nf_time::*;
  nf_sleep_ms(1000);
  let now = nf_now_ms();
  ```
- [ ] **Bare-metal C** com nf_time diretamente

---

### 🔵 Fase 5: Smart Home Dashboard (FUTURO)

#### Dashboard Layout (4-5 dias)
- [ ] Sistema de Rooms (Sala, Cozinha, Quarto)
- [ ] Grid layout drag & drop
- [ ] Device Cards:
  - [ ] Lights (on/off, dimmer, RGB)
  - [ ] Switches
  - [ ] Sensors (temp, humidity, motion)
- [ ] Real-time Sync: Dashboard ↔ Simulação

#### Automation (3-4 dias)
- [ ] Rules Engine: IF-THEN-ELSE visual
- [ ] Schedules (agendar ações)
- [ ] Scenes (Movie Mode, Away Mode, Party Mode)

---

### 🟣 Fase 6: Industrial Features (FUTURO)

#### PLC Simulator (7-10 dias)
- [ ] Virtual PLC com Modbus RTU/TCP
- [ ] Ladder Logic Viewer
- [ ] Import .st (Structured Text) / .ld (Ladder Diagram)

#### SCADA Interface (5-7 dias)
- [ ] Dashboard industrial (cinza/azul)
- [ ] HMI Elements: Tanks, Pipes, Valves, Motors, Gauges
- [ ] Real-time data + Alarms/Warnings

---

## 📊 KPIs e Metas

### Mês 1 (Fevereiro 2026)
- 🎯 **NeuroForge Time v0** funcionando (delay/millis perfeito)
- 🎯 **QEMU GPIO Real** funcionando com polling
- 🎯 **5 placas**: Arduino, ESP32, RP2040, STM32, ESP8266
- 🎯 **30 componentes** maker + sensores
- 🎯 **100 beta testers**

### Mês 3 (Abril 2026)
- 🎯 **NeuroForge Time v1** (host-driven)
- 🎯 **8 placas** + 50 componentes
- 🎯 **PLC/Modbus** funcionais
- 🎯 **MicroPython + CircuitPython**
- 🎯 **1.000 usuários ativos**

### Mês 6 (Julho 2026)
- 🎯 **10 placas** + 100 componentes
- 🎯 **AI code generation**
- 🎯 **Collaboration** real-time
- 🎯 **Pause/Step/Fast-forward** controls
- 🎯 **10.000 usuários ativos**
- 🎯 **500 pagantes** (15k MRR)

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
- **NeuroForge Time** (clock virtual unificado)

### DevOps
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **Vercel** (frontend)
- **Railway** (backend)

---

## 📝 Documentação

- [x] README.md detalhado
- [x] Server README.md (installation guide)
- [x] NeuroForge Time documentation (README)
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

**Última atualização:** 31/01/2026 08:04 PM WET
