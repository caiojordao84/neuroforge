# NeuroForge - Arduino/ESP32 Simulator

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/QEMU-FF6600?style=for-the-badge&logo=qemu&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
</div>

---

## 🚀 Visão Geral

NeuroForge é um simulador de microcontroladores **baseado em QEMU real** para Arduino Uno, ESP32 e outras placas. Diferente de simuladores online que interpretam código, o NeuroForge executa firmware compilado em máquinas virtuais ARM/AVR.

### ✨ Características

- 🎨 **Editor Visual**: Arraste e conecte componentes (LEDs, botões, sensores)
- 💻 **Editor de Código**: Monaco Editor com syntax highlighting
- ⚡ **Dual Simulation Mode**: 
  - **Interpreter Mode** (AVR8js): Simulação rápida em JavaScript
  - **QEMU Real Mode** (qemu-system-avr): Emulação precisa de hardware
- 🔌 **Backend QEMU Real**: Compilação arduino-cli + execução QEMU
- 📊 **Serial Monitor**: Captura UART em tempo real via WebSocket
- 🔗 **WebSocket Communication**: Comunicação bidirecional frontend ↔ backend
- ⏱️ **NeuroForge Time**: Sistema de temporização unificado entre linguagens
- 🛠️ **Multi-Board**: Arduino Uno, ESP32, Raspberry Pi Pico (em desenvolvimento)

---

## 🕐 NeuroForge Time - Arquitetura de Temporização

### O Problema

QEMU AVR não emula Timer0 corretamente, causando:
- `delay()` trava indefinidamente
- `millis()` sempre retorna 0
- Sketches simples (LED blink) não funcionam

### A Solução: Clock Virtual Unificado

NeuroForge implementa um **sistema de tempo virtual** controlado pelo host, independente dos timers do hardware emulado.

```c
// nf_time.h - API comum para todas as linguagens

uint32_t nf_now_ms(void);      // Tempo atual da simulação (ms)
uint32_t nf_now_us(void);      // Tempo atual da simulação (µs)
void nf_sleep_ms(uint32_t ms); // Dormir N ms em tempo de simulação
void nf_advance_ms(uint32_t);  // Avançar clock virtual (interno)
```

### Implementação por Linguagem

#### Arduino (C/C++)
```cpp
// Core arduino-uno-qemu sobrescreve delay/millis/micros

void delay(unsigned long ms) {
  nf_sleep_ms(ms);  // Usa NeuroForge Time em vez de Timer0
}

unsigned long millis() {
  return nf_now_ms();  // Lê clock virtual
}

unsigned long micros() {
  return nf_now_us();
}
```

#### MicroPython / CircuitPython
```python
import time

# VM implementa time.time() e time.sleep() em cima de nf_time
time.sleep(0.5)  # → nf_sleep_ms(500)
time.time()      # → nf_now_ms() / 1000.0
```

#### Bare-Metal C
```c
#include <nf_time.h>

void main() {
  while(1) {
    GPIO_SET_HIGH(13);
    nf_sleep_ms(1000);
    GPIO_SET_LOW(13);
    nf_sleep_ms(1000);
  }
}
```

### Vantagens

✅ **Funciona sem Timer0/Timer1**: Usa busy-wait + clock virtual  
✅ **Consistente entre linguagens**: Arduino, Python, Rust, C usam mesma API  
✅ **Controlável pelo host**: Permite pause, step, fast-forward, rewind  
✅ **Determinístico**: Reprodução de traces, debugging preciso  
✅ **Multi-MCU sync**: Múltiplos MCUs no mesmo circuito compartilham o clock  

### Implementação v0 (Atual)

```cpp
// nf_time.cpp - implementação dentro do firmware

static volatile uint32_t nf_ms = 0;

void nf_sleep_ms(uint32_t ms) {
  while (ms--) {
    _delay_ms(1);     // Busy-wait baseado em F_CPU (funciona no QEMU)
    nf_advance_ms(1); // Avança clock virtual
  }
}
```

### Implementação v1 (Futuro)

- Clock vem do host (backend)
- Device virtual QEMU expõe registrador de tempo
- Firmware lê `nf_now_ms()` de memória mapeada
- Permite pause, step, fast-forward controlados pelo frontend

---

## 🎯 Status do Projeto

### ✅ **Fase 1: QEMU Integration - COMPLETE** (31/01/2026)

**Backend:**
- ✅ Express REST API (porta 3001)
- ✅ Socket.IO WebSocket server
- ✅ `CompilerService`: arduino-cli wrapper
- ✅ `QEMURunner`: qemu-system-avr process manager
- ✅ `QEMUSimulationEngine`: high-level API
- ✅ Endpoints: `/compile`, `/simulate/start`, `/simulate/stop`, `/simulate/status`, `/pins/:pinNumber`, `/serial`
- ✅ Events: `serial`, `pinChange`, `simulationStarted`, `simulationStopped`

**Frontend:**
- ✅ `useQEMUStore`: QEMU state management
- ✅ `SimulationModeToggle`: Switch fake ↔ real
- ✅ `QEMUApiClient`: REST API client
- ✅ `QEMUWebSocket`: Socket.IO client
- ✅ `useQEMUSimulation`: Lifecycle hook
- ✅ TopToolbar: Compile & Run button + connection badges
- ✅ TypeScript errors fixed (framer-motion, vaul, react-hook-form, next-themes)

**Testes Realizados:**
- ✅ LED blink compila com arduino-cli
- ✅ QEMU executa firmware.hex com sucesso
- ✅ Serial Monitor exibe output em tempo real
- ✅ WebSocket connection estável
- ✅ Mode switching funcionando perfeitamente

### 🔄 **Fase 2: NeuroForge Time - IN PROGRESS** (31/01/2026)

- 🔄 Core `arduino-uno-qemu` criado
- 🔄 `nf_time.h` / `nf_time.cpp` implementados
- 🔄 Override de `delay()`, `millis()`, `micros()`
- 🔄 Testes: LED blink com delay(500) funcionando no QEMU
- ⏳ GPIO Real via QEMU Monitor (próximo)

---

## 📦 Instalação Rápida

### Pré-requisitos

- **Node.js** 18+ e npm
- **Arduino CLI**: [Instalação](https://arduino.github.io/arduino-cli/latest/installation/)
- **QEMU AVR**: 
  - Windows: `choco install qemu` ou baixe de [qemu.org](https://www.qemu.org/download/)
  - Linux: `sudo apt install qemu-system-avr`
  - macOS: `brew install qemu`

### Windows (PowerShell)

```powershell
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
.\install-deps.ps1
```

### Linux/macOS (Bash)

```bash
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
chmod +x install-deps.sh
./install-deps.sh
```

---

## 🏃 Executando

### Backend (Servidor QEMU) - OBRIGATÓRIO

```bash
cd server
npm run dev
# Backend listening on http://localhost:3001
```

### Frontend (Interface Visual)

```bash
# Em outro terminal
npm run dev
# Abre http://localhost:5173
```

### Testar Compilação + QEMU

1. Abra o frontend em `http://localhost:5173`
2. Clique no toggle **"Simulation Mode"** no topo (deve mudar para **Real QEMU**)
3. Escreva um sketch simples:
   ```cpp
   void setup() {
     pinMode(LED_BUILTIN, OUTPUT);
     Serial.begin(9600);
     Serial.println("LED Blink started!");
   }
   void loop() {
     digitalWrite(LED_BUILTIN, HIGH);
     Serial.println("LED ON");
     delay(500);
     digitalWrite(LED_BUILTIN, LOW);
     Serial.println("LED OFF");
     delay(500);
   }
   ```
4. Clique em **"Compile & Run"**
5. Veja o LED piscar no canvas + Serial Monitor!

---

## 📁 Estrutura do Projeto

```
neuroforge/
├── src/                        # Frontend React
│   ├── components/
│   │   ├── flow/
│   │   │   ├── LEDNode.tsx
│   │   │   ├── ButtonNode.tsx
│   │   │   └── ...
│   │   ├── toolbar/
│   │   │   ├── TopToolbar.tsx             # ✅ Compile & Run + badges
│   │   │   └── SimulationModeToggle.tsx   # ✅ Toggle fake/real
│   │   └── ...
│   ├── store/
│   │   ├── flowStore.ts
│   │   ├── serialStore.ts
│   │   └── qemuStore.ts                   # ✅ QEMU state
│   ├── services/
│   │   ├── QEMUApiClient.ts               # ✅ REST client
│   │   ├── QEMUWebSocket.ts               # ✅ Socket.IO client
│   │   └── ...
│   ├── hooks/
│   │   └── useQEMUSimulation.ts           # ✅ Lifecycle hook
│   └── App.tsx
├── server/                     # Backend Node.js + Express
│   ├── src/
│   │   ├── services/
│   │   │   ├── CompilerService.ts         # ✅ arduino-cli wrapper
│   │   │   ├── QEMURunner.ts              # ✅ QEMU process manager
│   │   │   ├── QEMUSimulationEngine.ts    # ✅ High-level API
│   │   │   ├── QEMUMonitorService.ts      # ✅ QEMU Monitor (TCP/Unix)
│   │   │   └── ...
│   │   ├── api/
│   │   │   └── routes.ts                  # ✅ REST endpoints
│   │   └── server.ts                      # ✅ Express + Socket.IO server
│   ├── cores/
│   │   └── neuroforge_qemu/               # 🔄 Core Arduino-QEMU
│   │       ├── nf_time.h                  # 🔄 NeuroForge Time API
│   │       ├── nf_time.cpp                # 🔄 Implementação do clock virtual
│   │       └── nf_arduino_time.cpp        # 🔄 delay/millis override
│   ├── package.json
│   └── README.md
├── poc/
│   └── qemu-avr-test/                     # Testes QEMU manuais
├── docs/
│   ├── roadmap.md                         # ✅ Fase 1 COMPLETE
│   └── fixes.md                           # ✅ Feature 2.5 documentada
├── install-deps.ps1
├── install-deps.sh
└── README.md                              # Este arquivo
```

---

## 🎯 Roadmap

### ✅ Fase 1: QEMU Integration (COMPLETE - 31/01/2026)
- ✅ Backend Express + Socket.IO
- ✅ arduino-cli compilation
- ✅ QEMU process management
- ✅ Serial Monitor (TX only)
- ✅ GPIO Polling (mock)
- ✅ Frontend dual mode toggle
- ✅ WebSocket real-time events
- ✅ Compile & Run workflow

### 🔄 Fase 2: NeuroForge Time + GPIO Real (Em Progresso)
- 🔄 **NeuroForge Time v0** (delay/millis funcional)
  - 🔄 Core `arduino-uno-qemu`
  - 🔄 `nf_time.h` API comum
  - 🔄 Override delay/millis/micros
  - 🔄 Teste: LED blink delay(500)
- ⏳ **GPIO Real via QEMU Monitor**
  - ⏳ TCP/Unix socket connection
  - ⏳ `info registers` parsing
  - ⏳ Pin state polling (20 FPS)
  - ⏳ LED visual feedback real-time
  - ⏳ Button input → QEMU GPIO write

### 🚀 Fase 3: Serial RX + Componentes
- [ ] Serial RX (input para QEMU)
- [ ] PWM para servos (QEMU timer simulation)
- [ ] ADC para potenciômetros
- [ ] I2C/SPI displays
- [ ] Sensores (DHT, ultrasonic)

### 🌐 Fase 4: Multi-Board + Multi-Language
- [ ] ESP32 (QEMU xtensa)
- [ ] Raspberry Pi Pico (QEMU ARM)
- [ ] STM32 (QEMU Cortex-M)
- [ ] **MicroPython** com NeuroForge Time
- [ ] **Rust embedded** com nf_time
- [ ] **Bare-metal C** com nf_time

### 🎨 Fase 5: UI/UX Polish
- [ ] Component library (drag & drop)
- [ ] Circuit wiring visualization
- [ ] Project save/load
- [ ] Code templates
- [ ] Pause/Step/Fast-forward controls

---

## 🧪 Testando QEMU Manualmente

### Via Backend API

```bash
cd server
npm run dev

# Em outro terminal:
curl -X POST http://localhost:3001/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"void setup() { pinMode(13, OUTPUT); Serial.begin(9600); Serial.println(\"LED Blink started!\"); } void loop() { digitalWrite(13, HIGH); Serial.println(\"LED ON\"); delay(500); digitalWrite(13, LOW); Serial.println(\"LED OFF\"); delay(500); }","board":"arduino-uno"}'

curl -X POST http://localhost:3001/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"firmwarePath":"/path/to/firmware.elf","board":"arduino-uno"}'

# Ver serial output
curl http://localhost:3001/api/simulate/serial

# Parar simulação
curl -X POST http://localhost:3001/api/simulate/stop
```

### Via arduino-cli + QEMU (manual)

```bash
cd poc/qemu-avr-test

# Compilar sketch
arduino-cli compile --fqbn arduino:avr:uno serial_test

# Rodar no QEMU
qemu-system-avr -machine arduino-uno -bios build/serial_test.ino.elf -serial stdio -nographic
```

---

## 📚 Documentação

- **QEMU Integration**: [`server/README.md`](server/README.md)
- **Roadmap Detalhado**: [`docs/roadmap.md`](docs/roadmap.md)
- **Fixes & Features**: [`docs/fixes.md`](docs/fixes.md)
- **NeuroForge Time**: Esta seção (🕐 acima)
- **API Reference**: (em breve)
- **Component Guide**: (em breve)

---

## 🛠️ Tecnologias

### Frontend
- **React 18** + **TypeScript**
- **Vite** (build tool)
- **React Flow** (visual editor)
- **Zustand** (state management)
- **Monaco Editor** (code editor)
- **Socket.IO Client** (WebSocket)
- **Tailwind CSS** + **shadcn/ui**

### Backend
- **Node.js** + **Express**
- **Socket.IO** (WebSocket server)
- **arduino-cli** (compilation)
- **QEMU AVR** (emulation)
- **TypeScript** + **tsx** (dev runtime)
- **NeuroForge Time** (clock virtual)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- [QEMU](https://www.qemu.org/) - Machine emulator and virtualizer
- [Arduino CLI](https://github.com/arduino/arduino-cli) - Arduino command line tool
- [AVR8js](https://github.com/wokwi/avr8js) - JavaScript AVR simulator
- [Wokwi](https://wokwi.com/) - Online Arduino simulator (inspiração)
- [Socket.IO](https://socket.io/) - Real-time bidirectional communication

---

<div align="center">
  <strong>Made with ❤️ by <a href="https://github.com/caiojordao84">caiojordao84</a></strong>
  <br>
  <sub>NeuroForge - Real QEMU-based Arduino/ESP32 Simulator</sub>
</div>
