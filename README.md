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
- ⏱️ **NeuroForge Time**: Sistema de temporização unificado com timing ajustável
- 🛠️ **Multi-Board**: Arduino Uno, ESP32, Raspberry Pi Pico (em desenvolvimento)

---

## 🕐 NeuroForge Time - Arquitetura de Temporização

### O Problema

QEMU AVR não emula Timer0 corretamente, causando:
- `delay()` trava indefinidamente
- `millis()` sempre retorna 0
- Sketches simples (LED blink) não funcionam

### A Solução: Clock Virtual Unificado

NeuroForge implementa um **sistema de tempo virtual** independente dos timers do hardware emulado.

```c
// nf_time.h - API comum para todas as linguagens

uint32_t nf_now_ms(void);      // Tempo atual da simulação (ms)
uint32_t nf_now_us(void);      // Tempo atual da simulação (µs)
void nf_sleep_ms(uint32_t ms); // Dormir N ms em tempo de simulação
void nf_advance_ms(uint32_t);  // Avançar clock virtual (interno)
```

### Implementação v0 (Atual) - ✅ COMPLETA

```cpp
// nf_time.cpp - implementação dentro do firmware

#define QEMU_TIMING_MULTIPLIER 10  // Ajustável!

static volatile uint32_t nf_ms = 0;

void nf_sleep_ms(uint32_t ms) {
  while (ms > 0) {
    for (uint16_t i = 0; i < QEMU_TIMING_MULTIPLIER; i++) {
      _delay_ms(1);     // Busy-wait baseado em F_CPU
    }
    nf_advance_ms(1);   // Avança clock virtual
    ms--;
  }
}
```

#### Ajuste de Timing

Se o timing estiver incorreto, ajuste `QEMU_TIMING_MULTIPLIER` em `server/cores/neuroforge_qemu/nf_time.cpp`:

- **Muito lento**: diminua para `5` ou `3`
- **Muito rápido**: aumente para `20` ou `50`
- **Ideal (500ms reais)**: deixe em `10` (padrão)

```bash
# Após ajustar:
cd server/cores
.\update-nf-time.ps1  # Windows
# ou
./update-nf-time.sh   # Linux/macOS

cd ..
npm run dev  # Reinicia backend
```

### Implementação v1 (Futuro)

- Clock vem do host (backend)
- Device virtual QEMU expõe registrador de tempo
- Firmware lê `nf_now_ms()` de memória mapeada
- Permite pause, step, fast-forward controlados pelo frontend

### Vantagens

✅ **Funciona sem Timer0/Timer1**: Usa busy-wait + clock virtual  
✅ **Consistente entre linguagens**: Arduino, Python, Rust, C usam mesma API  
✅ **Timing ajustável**: Configurável via `QEMU_TIMING_MULTIPLIER`  
✅ **Determinístico**: Reprodução de traces, debugging preciso  
✅ **Multi-MCU sync** (v1): Múltiplos MCUs compartilham o clock  

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
- ✅ TypeScript errors fixed

### ✅ **Fase 2: NeuroForge Time - COMPLETE** (31/01/2026) 🎉

- ✅ Core `neuroforge:avr-qemu:unoqemu` criado
- ✅ `nf_time.h` / `nf_time.cpp` implementados
- ✅ Override de `delay()`, `millis()`, `micros()`
- ✅ Timing ajustável via `QEMU_TIMING_MULTIPLIER`
- ✅ Teste: LED blink com delay(500) funcionando no QEMU
- ✅ Scripts de instalação: `install-core.ps1`, `patch-wiring.ps1`, `update-nf-time.ps1`

### 🚧 **Próxima Missão: Botão STOP** (1-2 dias)

**Objetivo:** Transformar "Compile & Run" em botão toggle Play/Stop

**Tarefas:**
- [ ] Estado do botão baseado em `isRunning`
- [ ] Ícone muda: Play → Stop
- [ ] Texto muda: "Compile & Run" → "STOP"
- [ ] Cor muda: verde → vermelho
- [ ] onClick: compile+run → stop simulation
- [ ] Loading state durante compilação
- [ ] Limpar Serial Monitor ao parar
- [ ] Resetar estados de componentes

**Design:**
```tsx
{!isRunning ? (
  <Button onClick={handleCompileAndRun}>
    <Play className="h-4 w-4 mr-2" />
    Compile & Run
  </Button>
) : (
  <Button onClick={handleStop} variant="destructive">
    <Square className="h-4 w-4 mr-2" />
    STOP
  </Button>
)}
```

---

## 📦 Instalação Rápida

### Pré-requisitos

- **Node.js** 18+ e npm
- **Arduino CLI**: [Instalação](https://arduino.github.io/arduino-cli/latest/installation/)
- **QEMU AVR**: 
  - Windows: `choco install qemu` ou baixe de [qemu.org](https://www.qemu.org/download/)
  - Linux: `sudo apt install qemu-system-avr`
  - macOS: `brew install qemu`

### Instalação

```bash
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
npm install
cd server && npm install
```

### Instalar Core NeuroForge Time

**Windows:**
```powershell
cd server\cores
.\install-core.ps1
```

**Linux/macOS:**
```bash
cd server/cores
chmod +x install-core.sh
./install-core.sh
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
     Serial.println("--- Sistema de Pisca LED Iniciado ---");
   }
   void loop() {
     digitalWrite(LED_BUILTIN, HIGH);
     Serial.println("Status: LED LIGADO");
     delay(500);
     digitalWrite(LED_BUILTIN, LOW);
     Serial.println("Status: LED DESLIGADO");
     delay(500);
   }
   ```
4. Clique em **"Compile & Run"**
5. Veja o LED piscar no canvas + Serial Monitor com timing correto!

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
│   │   └── neuroforge_qemu/               # ✅ Core Arduino-QEMU
│   │       ├── nf_time.h                  # ✅ NeuroForge Time API
│   │       ├── nf_time.cpp                # ✅ Clock virtual ajustável
│   │       ├── nf_arduino_time.cpp        # ✅ delay/millis override
│   │       ├── boards.txt                 # ✅ Board definition
│   │       └── README.md
│   ├── package.json
│   └── README.md
├── docs/
│   ├── roadmap.md                         # ✅ Fase 2 COMPLETE
│   └── fixes.md                           # ✅ NeuroForge Time documentado
├── install-core.ps1
├── patch-wiring.ps1
├── update-nf-time.ps1
└── README.md                              # Este arquivo
```

---

## 🎯 Roadmap

### ✅ Fase 1: QEMU Integration (COMPLETE - 31/01/2026)
- ✅ Backend Express + Socket.IO
- ✅ arduino-cli compilation
- ✅ QEMU process management
- ✅ Serial Monitor (TX only)
- ✅ Frontend dual mode toggle
- ✅ WebSocket real-time events
- ✅ Compile & Run workflow

### ✅ Fase 2: NeuroForge Time (COMPLETE - 31/01/2026) 🎉
- ✅ Core `neuroforge:avr-qemu:unoqemu`
- ✅ `nf_time.h` API comum
- ✅ Override delay/millis/micros
- ✅ Timing ajustável (`QEMU_TIMING_MULTIPLIER`)
- ✅ Teste: LED blink delay(500) funcionando
- ✅ Scripts de instalação automática

### 🎯 Fase 2.5: Botão STOP (PRÓXIMO - 1-2 dias)
- 🎯 **Stop Button Toggle** (próximo)
- ⏳ Loading states e feedback visual
- ⏳ Error handling e mensagens amigáveis

### ⏳ Fase 3: GPIO Real + Componentes
- [ ] GPIO Real via QEMU Monitor
- [ ] LED visual feedback real-time
- [ ] Button input → QEMU GPIO write
- [ ] Serial RX (input para QEMU)
- [ ] PWM para servos
- [ ] ADC para potenciômetros

### 🚀 Fase 4: Multi-Board + Multi-Language
- [ ] ESP32 (QEMU xtensa)
- [ ] Raspberry Pi Pico (QEMU ARM)
- [ ] **MicroPython** com NeuroForge Time
- [ ] **Rust embedded** com nf_time
- [ ] NeuroForge Time v1 (host-driven clock)
- [ ] Pause/Resume/Step controls

---

## 🧪 Testando QEMU Manualmente

### Via Backend API

```bash
cd server
npm run dev

# Em outro terminal:
curl -X POST http://localhost:3001/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"void setup() { pinMode(13, OUTPUT); Serial.begin(9600); Serial.println(\"LED Blink started!\"); } void loop() { digitalWrite(13, HIGH); Serial.println(\"LED ON\"); delay(500); digitalWrite(13, LOW); Serial.println(\"LED OFF\"); delay(500); }","board":"arduino-uno","mode":"qemu"}'

curl -X POST http://localhost:3001/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"firmwarePath":"/path/to/firmware.elf","board":"arduino-uno"}'

# Ver serial output
curl http://localhost:3001/api/simulate/serial

# Parar simulação
curl -X POST http://localhost:3001/api/simulate/stop
```

---

## 📚 Documentação

- **NeuroForge Time**: [`server/cores/NEUROFORGE_TIME_IMPLEMENTATION.md`](server/cores/NEUROFORGE_TIME_IMPLEMENTATION.md)
- **QEMU Integration**: [`server/README.md`](server/README.md)
- **Roadmap Detalhado**: [`docs/roadmap.md`](docs/roadmap.md)
- **Fixes & Features**: [`docs/fixes.md`](docs/fixes.md)
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
  <br><br>
  <strong>🎉 FASE 2 COMPLETA! NeuroForge Time funcionando! 🎉</strong>
  <br>
  <sub>🎯 Próxima Missão: Botão STOP</sub>
</div>
