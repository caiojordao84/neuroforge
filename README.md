# NeuroForge - Arduino/ESP32 Simulator

<div align="center">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/QEMU-FF6600?style=for-the-badge&logo=qemu&logoColor=white" />
  <img src="https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
</div>

---

## 🚀 Visão Geral

NeuroForge é um simulador de microcontroladores **baseado em QEMU real** para Arduino Uno, ESP32 e outras placas. Diferente de simuladores online que interpretam código, o NeuroForge executa firmware compilado em máquinas virtuais ARM/AVR/Xtensa.

### ✨ Características

- 🎨 **Editor Visual**: Arraste e conecte componentes (LEDs, botões, sensores)
- 💻 **Editor de Código**: Monaco Editor com syntax highlighting
- ⚡ **Dual Simulation Mode**: 
  - **Interpreter Mode** (AVR8js): Simulação rápida em JavaScript
  - **QEMU Real Mode** (qemu-system-avr/xtensa): Emulação precisa de hardware
- 🔌 **Multi-Architecture Backend**:
  - **AVR** (Arduino Uno): qemu-system-avr
  - **Xtensa** (ESP32): qemu-system-xtensa com ESP-IDF 6.1
- 📊 **Serial Monitor**: Captura UART em tempo real via WebSocket/TCP
- 🔗 **WebSocket Communication**: Comunicação bidirecional frontend ↔ backend
- ⏱️ **NeuroForge Time**: Sistema de temporização unificado com timing ajustável
- 🛠️ **Multi-Board**: Arduino Uno, ESP32 DevKit, Raspberry Pi Pico (em desenvolvimento)

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
- ✅ Express REST API (porta 3000)
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

### ✅ **Fase 3: ESP32 Backend - COMPLETE** (04/02/2026) 🚀

**Arquitetura Multi-Plataforma:**
- ✅ `Esp32Backend`: QEMU Xtensa (qemu-system-xtensa)
- ✅ `Esp32SerialClient`: TCP socket client (porta 5555)
- ✅ Roteamento automático AVR ↔ ESP32 no `QEMUSimulationEngine`
- ✅ Suporte a ESP-IDF 6.1+ firmware images
- ✅ Integração com `SerialGPIOService` (protocolo `G:pin=X,v=Y`)
- ✅ Configuração via `.env` (ESP32_QEMU_PATH, ESP32_SERIAL_PORT)

**Documentação:**
- ✅ `docs/firmware/esp32-idf-setup.md`: Guia completo de setup
- ✅ `server/example-gpio-esp32.ts`: Exemplo funcional
- ✅ `server/test-firmware/esp32/README.md`: Instruções de uso

**Tipos e Configuração:**
- ✅ `server/src/types/esp32.types.ts`: Types completos
- ✅ Flash image + eFuse image support
- ✅ Watchdog disable, network mode, memory config

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

#### AVR (Arduino Uno)
- **Node.js** 18+ e npm
- **Arduino CLI**: [Instalação](https://arduino.github.io/arduino-cli/latest/installation/)
- **QEMU AVR**: 
  - Windows: `choco install qemu` ou baixe de [qemu.org](https://www.qemu.org/download/)
  - Linux: `sudo apt install qemu-system-avr`
  - macOS: `brew install qemu`

#### ESP32 (Xtensa)
- **ESP-IDF 6.1+**: [Instalação](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/)
- **QEMU ESP32**: Incluído no ESP-IDF tools
- **Python 3.12**: Para ESP-IDF environment

### Instalação

```bash
git clone https://github.com/caiojordao84/neuroforge.git
cd neuroforge
npm install
cd server && npm install
```

### Instalar Core NeuroForge Time (AVR)

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

### Configurar ESP32 (Opcional)

**1. Criar arquivo `.env` no servidor:**

```bash
cd server
cp .env.example .env
```

**2. Editar `.env` com seus caminhos ESP-IDF:**

```env
# ESP32 QEMU Configuration
ESP32_QEMU_PATH=D:\Tools\esp-idf-tools\tools\qemu-xtensa\esp_develop_9.0.0_20240606\qemu\bin\qemu-system-xtensa.exe
ESP32_SERIAL_PORT=5555
ESP32_DEFAULT_MEMORY=4M
```

**3. Compilar firmware ESP32 de teste:**

Veja [docs/firmware/esp32-idf-setup.md](docs/firmware/esp32-idf-setup.md) para instruções completas.

---

## 🏃 Executando

### Backend (Servidor QEMU) - OBRIGATÓRIO

```bash
cd server
npm run dev
# Backend listening on http://localhost:3000
```

### Frontend (Interface Visual)

```bash
# Em outro terminal
npm run dev
# Abre http://localhost:5173
```

### Testar Compilação + QEMU (Arduino)

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

### Testar ESP32 Backend

```bash
cd server
tsx example-gpio-esp32.ts
```

**Pré-requisitos:**
- Firmware ESP32 compilado em `test-firmware/esp32/qemu_flash.bin`
- eFuse image em `test-firmware/esp32/qemu_efuse.bin`
- ESP-IDF tools no PATH

Veja [server/test-firmware/esp32/README.md](server/test-firmware/esp32/README.md) para instruções de compilação.

---

## 🧪 ASL Fake Simulation & C++ → ASL

Além do modo QEMU real, o NeuroForge possui um modo de simulação **fake em JavaScript** baseado em um pequeno runtime (SimulationEngine) e em uma linguagem intermediária chamada ASL (Arduino Simulation Language). Este modo é pensado para feedback rápido no navegador, especialmente em exemplos didáticos de LED + botões.

### ✅ O que já está implementado

- **Inputs com INPUT_PULLUP corretos**  
  - Pinos configurados como `INPUT_PULLUP` passam a iniciar em HIGH no motor de simulação fake, de forma alinhada com o comportamento do Arduino real.  
  - Isso garante que `digitalRead(pin)` retorne HIGH por padrão enquanto o botão não está pressionado.

- **Botão com auto-polaridade (Active-Low)**  
  - O `ButtonNode` detecta automaticamente quando o pino da MCU está em `INPUT_PULLUP` e muda para comportamento *active-low*: pressionar → LOW, soltar → HIGH.  
  - Isso evita o caso em que o botão "gruda" o pino em LOW e bloqueia cadeias `if / else if` como no exemplo clássico `BTN_ON` / `BTN_OFF`.

- **Parser de controle de fluxo mais robusto (`if / else if / else`)**  
  - O conversor C++ → ASL entende blocos com `if (...) { ... } else if (...) { ... } else { ... }`, mesmo quando há comentários e linhas em branco entre `}` e `else`.  
  - `else if` é reescrito internamente como um `else { if (...) { ... } }`, preservando a semântica original.

- **Declarações locais simples dentro de `setup`/`loop`**  
  - Suporte a linhas como:  
    - `int i = 0;`  
    - `byte b = 10;`  
    - `long l = 123;`  
    - `float f = 0.5;`  
    - `double d = 3.14;`  
    - `bool flag = true;`  
  - Essas declarações são convertidas para `ASLAssign` com literais, respeitando o ambiente de variáveis do runtime ASL.

- **Incremento/decremento simples via atribuição**  
  - Suporte a:  
    - `i = i + 1;`  
    - `i = i - 1;`  
  - Quando a variável à esquerda e à direita é a mesma, o transpiler gera um `ASLAssign` com expressão binária (`+` ou `-`), usando o valor atual de `i` e um literal à direita.

### 🎯 Próximos passos no ASL

- **Atribuições gerais com expressões**  
  - Estender o parser para entender casos como `x = y + 1;`, `x = sensorValue * 2;`, ainda dentro do perfil simples da ASL v0.

- **Suporte incremental a `for`**  
  - Converter `for (init; cond; inc) { ... }` para uma sequência equivalente de:  
    - `init;`  
    - `while (cond) { ...; inc; }`  
  - Mantendo o foco inicial em padrões didáticos como `for (int i = 0; i < N; i = i + 1)`.

- **Comentários como cidadãos de primeira classe (ASL v2)**  
  - Evoluir o IR da ASL para carregar comentários junto com o AST, permitindo no futuro "traduções" entre linguagens que preservem comentários em posições razoáveis.  
  - Revisitar depois os pontos onde hoje pulamos comentários (ex.: entre `}` e `else`) com essa infraestrutura pronta.

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
│   │   │   ├── QEMURunner.ts              # ✅ QEMU AVR process manager
│   │   │   ├── QEMUSimulationEngine.ts    # ✅ Multi-arch orchestrator
│   │   │   ├── QEMUMonitorService.ts      # ✅ QEMU Monitor (TCP/Unix)
│   │   │   ├── Esp32Backend.ts            # ✅ QEMU ESP32 backend
│   │   │   ├── Esp32SerialClient.ts       # ✅ TCP serial client
│   │   │   └── ...
│   │   ├── types/
│   │   │   └── esp32.types.ts             # ✅ ESP32 types
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
│   ├── test-firmware/
│   │   └── esp32/                         # ✅ ESP32 test firmware dir
│   │       ├── qemu_flash.bin             # Flash image (user-provided)
│   │       ├── qemu_efuse.bin             # eFuse image (user-provided)
│   │       └── README.md                  # ✅ Setup instructions
│   ├── example-gpio-esp32.ts              # ✅ ESP32 example
│   ├── .env.example                       # ✅ Config template
│   ├── package.json
│   └── README.md
├── docs/
│   ├── roadmap.md                         # ✅ Fase 3 COMPLETE
│   ├── firmware/
│   │   └── esp32-idf-setup.md             # ✅ ESP32 setup guide
│   └── fixes.md                           # ✅ NeuroForge Time documentado
├── poc/
│   └── libraries/
│       └── NeuroForgeGPIO_ESP32/          # ✅ ESP32 GPIO helper library
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

### ✅ Fase 3: ESP32 Backend (COMPLETE - 04/02/2026) 🚀
- ✅ Multi-architecture support (AVR + Xtensa)
- ✅ `Esp32Backend` com qemu-system-xtensa
- ✅ `Esp32SerialClient` TCP socket
- ✅ Roteamento automático por board type
- ✅ ESP-IDF 6.1 firmware support
- ✅ Documentação completa + exemplo funcional

### 🧪 Fase 3.7: ASL Fake Simulation & Transpiler (EM ANDAMENTO)
- ✅ INPUT_PULLUP inicializando em HIGH na simulação fake (comportamento alinhado ao Arduino físico).
- ✅ Botão com auto-polaridade (active-low) quando ligado em pinos `INPUT_PULLUP`.
- ✅ Parser de `if / else if / else` tolerante a comentários e linhas vazias entre `}` e `else`.
- ✅ Declarações locais simples dentro de `setup`/`loop`: `tipo nome = literal;`.
- ✅ Incremento/decremento simples: `i = i + 1;` e `i = i - 1;`.

- 🎯 Próximos passos imediatos:
  - [ ] Atribuições com expressões gerais (`x = y + 1;`, `x = sensorValue * 2;`).
  - [ ] Transformar `for (init; cond; inc)` em `init; while (cond) { body; inc; }`.
  - [ ] Documentar exemplos didáticos de uso do modo fake (LED + botões, contador, etc.).
  - [ ] Preparar terreno para preservação de comentários na ASL v2.

### 🎯 Fase 3.5: Botão STOP (PRÓXIMO - 1-2 dias)
- 🎯 **Stop Button Toggle** (próximo)
- ⏳ Loading states e feedback visual
- ⏳ Error handling e mensagens amigáveis

### ⏳ Fase 4: GPIO Real + Componentes
- [ ] GPIO Real via QEMU Monitor
- [ ] LED visual feedback real-time
- [ ] Button input → QEMU GPIO write
- [ ] Serial RX (input para QEMU)
- [ ] PWM para servos
- [ ] ADC para potenciômetros

### 🚀 Fase 5: Multi-Language + Advanced Features
- [ ] ESP32 WiFi/Bluetooth simulation
- [ ] Raspberry Pi Pico (QEMU ARM)
- [ ] **MicroPython** com NeuroForge Time
- [ ] **Rust embedded** com nf_time
- [ ] NeuroForge Time v1 (host-driven clock)
- [ ] Pause/Resume/Step controls
- [ ] Multi-MCU synchronization

---

## 🧪 Testando QEMU Manualmente

### Via Backend API (Arduino)

```bash
cd server
npm run dev

# Em outro terminal:
curl -X POST http://localhost:3000/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"void setup() { pinMode(13, OUTPUT); Serial.begin(9600); Serial.println(\\"LED Blink started!\\"); } void loop() { digitalWrite(13, HIGH); Serial.println(\\"LED ON\\"); delay(500); digitalWrite(13, LOW); Serial.println(\\"LED OFF\\"); delay(500); }","board":"arduino-uno","mode":"qemu"}'

curl -X POST http://localhost:3000/api/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"firmwarePath":"/path/to/firmware.elf","board":"arduino-uno"}'

# Ver serial output
curl http://localhost:3000/api/simulate/serial

# Parar simulação
curl -X POST http://localhost:3000/api/simulate/stop
```

### Standalone ESP32 Backend

```bash
cd server
tsx example-gpio-esp32.ts
```

**Resultado esperado:**
```
🚀 ESP32 + QEMU + SerialGPIO Example
⚙️ Starting ESP32 backend...
✅ Connected to ESP32 serial: 127.0.0.1:5555
📡 [Serial] --- ESP32 Boot Log ---
📡 [Serial] G:pin=2,v=1
🔄 [GPIO] Pin 2 changed: 0 → 1
```

---

## 📚 Documentação

- **ESP32 Setup**: [`docs/firmware/esp32-idf-setup.md`](docs/firmware/esp32-idf-setup.md)
- **ESP32 Test Firmware**: [`server/test-firmware/esp32/README.md`](server/test-firmware/esp32/README.md)
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
- **QEMU AVR** (Arduino emulation)
- **QEMU Xtensa** (ESP32 emulation)
- **TypeScript** + **tsx** (dev runtime)
- **NeuroForge Time** (clock virtual)

### ESP32 Stack
- **ESP-IDF 6.1+** (framework)
- **qemu-system-xtensa** (emulator)
- **TCP Socket Serial** (comunicação)
- **NeuroForgeGPIO_ESP32** (helper library)

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
- [ESP-IDF](https://github.com/espressif/esp-idf) - Espressif IoT Development Framework
- [AVR8js](https://github.com/wokwi/avr8js) - JavaScript AVR simulator
- [Wokwi](https://wokwi.com/) - Online Arduino simulator (inspiração)
- [Socket.IO](https://socket.io/) - Real-time bidirectional communication

---

<div align="center">
  <strong>Made with ❤️ by <a href="https://github.com/caiojordao84">caiojordao84</a></strong>
  <br>
  <sub>NeuroForge - Real QEMU-based Arduino/ESP32 Simulator</sub>
  <br><br>
  <strong>🎉 FASE 3 COMPLETA! ESP32 Backend funcionando! 🎉</strong>
  <br>
  <sub>✅ Multi-Architecture: AVR + Xtensa | 🎯 Próxima Missão: Botão STOP</sub>
</div>
