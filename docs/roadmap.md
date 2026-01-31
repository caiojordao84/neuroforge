# 🚀 NeuroForge - Roadmap Completo

## 🎯 Visão Geral

**Nome:** NeuroForge (antigo Wokwi Clone)  
**Objetivo:** Simulador universal de microcontroladores para makers E indústria  
**Diferencial:** Componentes industriais (PLC/SCADA) + UI domática + **QEMU Real**  
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

---

## 🚧 PRÓXIMOS PASSOS - Fevereiro 2026

### 🔴 Fase 1: Integração QEMU Real (ALTA PRIORIDADE)

#### Backend API (3-5 dias)
- [ ] REST API para compilação:
  - `POST /api/compile` - Recebe código, retorna firmware.hex
  - `POST /api/simulate/start` - Inicia QEMU
  - `POST /api/simulate/stop` - Para QEMU
  - `GET /api/simulate/pins/:pin` - Lê estado de pino via QEMU monitor
  - `POST /api/simulate/pins/:pin` - Escreve estado de pino (simular botão)
- [ ] WebSocket para Serial Monitor:
  - `WS /api/serial` - Stream bidirecional de dados seriais
  - Auto-reconnect em caso de desconexão
- [ ] GPIO Monitor real:
  - Polling de registradores AVR via QEMU monitor
  - Emitir eventos `pinChange` para frontend

#### Frontend Integration (2-3 dias)
- [ ] Toggle **"Simulação Fake"** vs **"QEMU Real"**
- [ ] Service layer para comunicação com backend:
  - `QEMUApiClient.ts` - Chamadas REST
  - `QEMUWebSocket.ts` - WebSocket handler
- [ ] Conectar Serial Monitor ao WebSocket
- [ ] Conectar LED/Button ao estado de pinos do QEMU
- [ ] Indicator visual: "QEMU Running" com status

#### Docker & Deploy (1-2 dias)
- [ ] Dockerfile com QEMU + arduino-cli
- [ ] docker-compose.yml (frontend + backend + QEMU)
- [ ] Deploy na Vercel (frontend) + Railway (backend)

---

### 🟡 Fase 2: Expand Simulation Engine (MÉDIA PRIORIDADE)

#### Componentes Maker (5-7 dias)
- [ ] **Displays**:
  - LCD 16x2 (I2C)
  - OLED 128x64 (SPI/I2C)
  - TM1637 7-segment
- [ ] **Sensores**:
  - Ultrasonic HC-SR04
  - DHT22 (temp/humidity)
  - LDR (photoresistor)
  - PIR motion sensor
- [ ] **Atuadores**:
  - Buzzer (tone/noTone)
  - Relay module
  - DC Motor com L298N

#### Code Generation (3-4 dias)
- [ ] Template System por componente
- [ ] Smart Code Generator:
  - Analisa circuito e gera `setup()` + `loop()`
  - Merge inteligente de código
  - Preservar código do usuário (`// USER CODE START`)

---

### 🟢 Fase 3: Smart Home Dashboard (BAIXA PRIORIDADE)

#### Dashboard Layout (4-5 dias)
- [ ] Sistema de Rooms (Sala, Cozinha, Quarto)
- [ ] Grid layout drag & drop
- [ ] Device Cards:
  - Lights (on/off, dimmer, RGB)
  - Switches
  - Sensors (temp, humidity, motion)
- [ ] Real-time Sync: Dashboard ↔ Simulação

#### Automation (3-4 dias)
- [ ] Rules Engine: IF-THEN-ELSE visual
- [ ] Schedules (agendar ações)
- [ ] Scenes (Movie Mode, Away Mode, Party Mode)

---

### 🔵 Fase 4: Industrial Features (FUTURO)

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
- 🎯 **5 placas**: Arduino, ESP32, RP2040, STM32, ESP8266
- 🎯 **30 componentes** maker + sensores
- 🎯 **QEMU integrado** e funcional
- 🎯 **100 beta testers**

### Mês 3 (Abril 2026)
- 🎯 **8 placas** + 50 componentes
- 🎯 **PLC/Modbus** funcionais
- 🎯 **MicroPython + CircuitPython**
- 🎯 **1.000 usuários ativos**

### Mês 6 (Julho 2026)
- 🎯 **10 placas** + 100 componentes
- 🎯 **AI code generation**
- 🎯 **Collaboration** real-time
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

### Backend
- **Node.js 20** + **TypeScript**
- **Express** (REST API)
- **Socket.IO** (WebSocket)
- **QEMU 8.2+** (AVR emulation)
- **arduino-cli** (compilation)

### DevOps
- **Docker** + **Docker Compose**
- **GitHub Actions** (CI/CD)
- **Vercel** (frontend)
- **Railway** (backend)

---

## 📝 Documentação

- [ ] README.md detalhado
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

**Última atualização:** 31/01/2026 03:47 AM WET
