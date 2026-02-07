# ROADMAP da Plataforma NeuroForge

Este documento resume o estado atual da plataforma e os próximos passos planeados, com foco em três camadas: boards, backends de execução (QEMU/outros) e frameworks (Arduino, ESP-IDF, etc.).

---

## Índice Rápido

- [Estado Atual](#estado-atual)
- [Em Progresso](#em-progresso)
- [Próximos Passos (Curto Prazo)](#próximos-passos-curto-prazo)
- [Visão de Médio Prazo](#visão-de-médio-prazo)
- [Mini ROADMAP deste Job (ESP32 QEMU)](#mini-roadmap-deste-job-esp32-qemu)
- [Roadmap Macro do Produto](#roadmap-macro-do-produto)

---

## Estado Atual

### Boards AVR (Arduino clássico) ✅ COMPLETO
- JSONs de boards em `docs/boards/` para UNO, Nano, etc.
- Backend AVR integrado:
  - QEMU AVR configurado e funcional.
  - Pipeline de compilação AVR (Arduino CLI / avr-gcc) a gerar ELF executado no QEMU.
  - Board custom `arduino:avr:unoqemu` com NeuroForge Time.
- Serviços:
  - Serial/monitor integrado.
  - `SerialGPIOParser` com regex não-gananciosa para detectar frames `G:pin=...,v=...`.
  - Filtro de logs de controle (frames `G:` e `M:` não aparecem no Serial Monitor).
  - Multi-pin GPIO sincronizado.

### Backend ESP32 ✅ COMPLETO
- Toolchain ESP-IDF v6.1 configurado no Windows com Python 3.12.
- QEMU ESP32 oficial da Espressif instalado (`qemu-system-xtensa -M esp32 ...`).
- **Compilação Real**: Sistema agora compila código do usuário com `arduino-cli --export-binaries`.
- **Shim de GPIO** (`esp32-shim.cpp`):
  - Sobrescreve `digitalWrite` e `pinMode` usando weak symbols.
  - Injeta automaticamente durante compilação.
  - Reporta estados via `ets_printf("G:pin=%d,v=%d\n", ...)` para UART0.
- **Suporte a eFuse**: `qemu_efuse.bin` passado corretamente para QEMU.
- **Protocolo Serial GPIO** funcionando:
  - Frames `G:` e `M:` filtrados do Serial Monitor.
  - Multi-pin GPIO sincronizado.
  - LED pisca no canvas em tempo real.

### Documentação de Arquitetura
- [`docs/architecture/backends.md`](./architecture/backends.md) descreve a arquitetura multi-backend (AVR, ESP32, RP2040) com separação entre board, backend de execução e framework.
- [`docs/ledPisca.md`](./ledPisca.md) documenta todas as correções implementadas para Arduino e ESP32.
- [`docs/fixes/rp2040-qemu-fixes.md`](./fixes/rp2040-qemu-fixes.md) documenta o processo de integração do RP2040 QEMU.

---

## Em Progresso

### Suporte a RP2040 (Raspberry Pi Pico) 🚧 EM PROGRESSO
- [x] **QEMU Build Customizado**: Compilar QEMU com suporte RP2040
  - [x] Clonar e compilar QEMU ARM no Windows
  - [x] Criar SoC RP2040 (`rp2040_soc.c`, `rp2040.h`)
  - [x] Implementar GPIO via SIO e IO_BANK0
  - [x] Adicionar UARTs (PL011)
  - [x] Criar machine type `raspberrypi-pico`
  - [x] Configurar meson build
- [x] **Firmware Compilation**: Setup de toolchain ARM
  - [x] Instalar `arm-none-eabi-gcc`
  - [x] Criar SDK mínimo para bare-metal
  - [x] Implementar linker script para RP2040
  - [x] Setup de Makefile para compilação
- [ ] **QEMU Integration**: Fazer o QEMU inicializar
  - [ ] Debug e fix de erros de inicialização (assertion failures)
  - [ ] Validar boot sequence do Cortex-M0
  - [ ] Testar exemplo blink.elf
- [ ] **Backend Integration**: Adicionar `Rp2040Backend`
  - [ ] Criar `Rp2040Backend` com interface idêntica a AVR/ESP32
  - [ ] Integrar com `QEMURunner`
  - [ ] Implementar client de serial TCP/UART
- [ ] **GPIO Protocol**: Shim de GPIO para RP2040
  - [ ] Criar shim similar ao ESP32 para Pico SDK
  - [ ] Reportar via `printf("G:pin=%d,v=%d\n", ...)`
  - [ ] Integrar com `SerialGPIOParser`
- [ ] **Testing**: Validação end-to-end
  - [ ] Testar blink LED no canvas
  - [ ] Validar multi-pin GPIO
  - [ ] Performance testing
- [ ] Definir JSONs de boards RP2040 em `docs/boards/`

### Unificação da camada de simulação
- [ ] Extrair um `SimulationProtocol`:
  - Sintaxe e semântica de mensagens (GPIO, ADC, rede, sensores).
- [x] Garantir que tanto AVR quanto ESP32 seguem o mesmo contrato de log.
- [ ] Expor esse protocolo via:
  - WebSocket (UI em tempo real).
  - API para automação de testes e uso industrial.

---

## Próximos Passos (Curto Prazo)

### Suporte a RP2040 (Raspberry Pi Pico)
- [x] Avaliar e integrar QEMU com suporte RP2040 customizado.
- [ ] Completar debugging de inicialização QEMU.
- [ ] Adicionar `Rp2040Backend` com interface idêntica a AVR/ESP32.
- [ ] Definir JSONs de boards RP2040 em `docs/boards/`.
- [ ] Criar shim de GPIO para RP2040.

### Componentes Avançados
- [ ] Sensores analógicos (LDR, potenciômetro já funciona).
- [ ] Displays (LCD 16x2, OLED SSD1306).
- [ ] Motores (DC, Servo, Stepper).
- [ ] Sensores digitais (DHT22, HC-SR04).

---

## Visão de Médio Prazo

### Multi-framework no mesmo MCU
- [ ] Suporte paralelo a:
  - Arduino AVR / Arduino-ESP32 (experiência maker).
  - ESP-IDF puro (experiência industrial).
  - Futuro: MicroPython, Rust/TinyGo (educacional e prototipagem rápida).
- [ ] Permitir que o utilizador escolha framework por projeto/board, mantendo o mesmo backend de simulação.

### Preparação para clientes domésticos e industriais
- [ ] Configuração declarativa de projetos (JSON/YAML):
  - Board, backend, framework, periféricos, integrações.
- [ ] Observabilidade:
  - Logs estruturados, métricas de simulação, tracing básico.
- [ ] Escalabilidade:
  - Múltiplas instâncias de QEMU/backends em paralelo.
  - Integração com pipelines de CI/CD para regressão de firmware.

---

## Mini ROADMAP deste Job (ESP32 QEMU no Windows)

### 1. Infraestrutura de ferramentas ✅ CONCLUÍDO
- [x] Instalar ESP-IDF v6.1 no Windows com Python 3.12.
- [x] Corrigir conflitos de `windows-curses` com Python 3.14 via venv dedicada.
- [x] Instalar toolchain `xtensa-esp-elf` e colocar no PATH.
- [x] Instalar QEMU ESP32 via `idf_tools.py` e garantir que `qemu-system-xtensa -M esp32` funciona.

### 2. Prova de conceito com hello_world ✅ CONCLUÍDO
- [x] Compilar `examples/get-started/hello_world` para target `esp32`.
- [x] Gerar `qemu_flash.bin` e `qemu_efuse.bin`.
- [x] Rodar QEMU manualmente e através de `idf.py qemu monitor`.
- [x] Verificar que o monitor (via socket TCP 5555) recebe output.

### 3. Integração com a plataforma NeuroForge ✅ CONCLUÍDO
- [x] Adicionar `Esp32Backend` / `boardType: 'esp32-devkit'` ao `QEMURunner`.
- [x] Implementar cliente TCP de serial e integrar com `SerialGPIOParser`.
- [x] Criar shim de GPIO (`esp32-shim.cpp`) com weak symbol override.
- [x] Injeção automática do shim durante compilação.
- [x] Compilação real com `arduino-cli --export-binaries`.
- [x] Suporte a `efusePath` em toda a stack (Frontend -> API -> Backend).
- [x] Filtro de logs de controle (`G:`, `M:`) no Serial Monitor.
- [x] Multi-pin GPIO sincronizado.
- [x] Documentação em `docs/ledPisca.md`.

### 4. Generalização e limpeza ✅ CONCLUÍDO
- [x] Documentar a arquitetura multi-backend em `docs/architecture/backends.md`.
- [x] Atualizar este ROADMAP à medida que a integração ESP32 evolui.
- [x] Criar `docs/ledPisca.md` com relatório técnico completo.

### 5. Enhanced QEMU Orchestration (planeado)
- [ ] **Unified Backend Manager**: Melhorar `QEMUSimulationEngine` com API unificada
- [ ] **Shared Event System**: Agregação de eventos de múltiplas instâncias QEMU
- [ ] **Multiplexed Serial Monitor**: Console única para AVR + ESP32 + outros backends
- [ ] **Unified Configuration**: Sistema de configuração centralizado para todas arquiteturas
- [ ] **Better Lifecycle Management**: Start/stop/restart coordenado entre backends
- [ ] **Resource Pooling**: Gerenciamento inteligente de portas TCP/Monitor
- [ ] **Error Handling**: Sistema unificado de tratamento de erros e recovery

### 6. Multi-Device Orchestration (planeado)
- [ ] **Simultaneous Multi-MCU**: Rodar AVR + ESP32 + RP2040 simultaneamente
- [ ] **Shared NeuroForge Clock**: Clock virtual sincronizado entre todos os devices
- [ ] **Inter-Device Communication**: GPIO/I2C/SPI bus compartilhado entre MCUs
- [ ] **QEMU Network Bridge**: Conectar instâncias QEMU via networking features
- [ ] **Coordinated Stepping**: Debug síncrono de múltiplos devices
- [ ] **Resource Arbitration**: Gerenciamento de recursos compartilhados entre instâncias

### 7. Multi-Language Toolchain (planeado)
- [ ] **MicroPython Setup**: Scripts de instalação de firmware e tools (mpy-cross)
- [ ] **CircuitPython Integration**: Suporte a UF2 workflow e bibliotecas
- [ ] **Rust Embedded**: Setup de toolchain (cargo, avr-hal, esp-hal, rp-hal)
- [ ] **TinyGo Support**: Configuração de compilador para AVR/ESP32/RP2040
- [ ] **JavaScript Runtimes**: Integração com Moddable/Kaluma (se viável)

### 8. NeuroForge Transpiler & Visual Programming (planeado)
- [ ] **Unified AST**: Parser universal para blocos, flowcharts e código
- [ ] **Transpiler Core**: Engine de transformação (ex: TypeScript -> C++, Blocos -> Python)
- [ ] **Visual Blocks**: Interface estilo Scratch/Blockly integrada
- [ ] **Flowchart-to-Code**: Conversão de diagramas React Flow para código executável
- [ ] **Custom Syntax DSL**: Suporte a sintaxe simplificada do NeuroForge
- [ ] **Binary Generation**: Integração com compiladores nativos para gerar .hex/.bin finais

---

## Roadmap Macro do Produto

### Visão Geral do Projeto

**Nome:** NeuroForge  
**Objetivo:** Simulador universal de microcontroladores para makers E indústria com capacidade de criar dashboards IoT  
**Diferencial:** Motor de simulação robusto (QEMU) + Componentes industriais + PLC + SCADA + UI doméstica estilo Home Assistant  
**Público Alvo:**
- **Makers (B2M)**: UX simples, MCUs Makers, componentes visuais, dashboards
- **Indústria (B2B)**: PLC/SCADA, Modbus, Ladder, logs estruturados, CI/CD
- **Doméstico/Comercial(B2C)**: Dashboards IoT estilo Home Assistant

---

### FASE 0: FUNDAÇÃO

**STATUS: CONCLUÍDA**

#### Infraestrutura Base
- Setup inicial do projeto (Frontend React + TypeScript)
- Estrutura de pastas organizada
- Editor de código com Monaco Editor
- UI Builder inicial com React Flow
- Sistema de componentes visual

#### Motor de Simulação V1 (Custom)
- CodeParser com suporte a variáveis e funções complexas
- SimulationEngine event-driven
- Sistema de pinos e GPIO básico
- Suporte a pinMode, digitalWrite, analogWrite
- Event bus para comunicação componente-código

#### Componentes Implementados
- LED simples com controle de brilho
- LED RGB com 3 canais PWM
- Button com debounce
- Servo Motor com controle PWM
- Potentiometer com saída analógica
- MCU como componente draggable (Arduino Uno, ESP32, Raspberry Pi Pico)

#### Sistemas de UI
- Floating Windows com drag e persist
- Multi-File Code Editor com tabs
- Libraries Management System
- Component Properties System para todos os componentes
- Manhattan routing para fios
- Snap-to-grid no canvas

#### Correções Críticas (FIX 1.1 - 1.10)
- Language Selector funcional
- Code Parser robusto (brace counting)
- LED State Management com tracking de pinos
- Event Listener Persistence entre runs
- Variable resolution (const int ledPin = 13)
- Loop Re-entrancy Prevention

---

### FASE 1: MIGRAÇÃO PARA QEMU

**STATUS: AVR & ESP32 COMPLETO ✅ | RP2040 EM PROGRESSO 🚧 | STM32 PLANEADO**

#### Semana 1: QEMU Integration e POC ✅ CONCLUÍDO
- [x] Compilar ou configurar QEMU para rodar firmwares Arduino/ESP32/Pico
- [x] Proof of Concept com `blink.ino`
- [x] Verificar GPIO output via Serial
- [x] Medir performance básica

#### Semana 2: Backend de Compilação e QEMUSimulationEngine ✅ CONCLUÍDO
- [x] API/CLI de compilação para AVR
- [x] API/CLI de compilação para ESP32
- [x] `QEMURunner` substituindo SimulationEngine custom (AVR)
- [x] Carregamento de binário no QEMU
- [x] UART redirection para Serial Monitor
- [x] ESP32 backend integration

#### Semana 3: Multi-Board Support
- [x] Arduino Uno (AVR)
- [x] ESP32 (Xtensa)
- [🚧] RP2040 / STM32 (ARM) - em progresso
- [x] Board Selector unificado no app

#### 1.1.1. Backend AVR (QEMU) ✅ COMPLETO

- [x] JSONs de boards AVR em `docs/boards/`
- [x] QEMU AVR configurado e funcional
- [x] Pipeline de compilação AVR (Arduino CLI / avr-gcc)
- [x] Board custom `arduino:avr:unoqemu` com NeuroForge Time
- [x] `SerialGPIOParser` com parser de linhas `G:pin=...,v=...`
- [x] Regex não-gananciosa para detecção robusta
- [x] Filtro de logs de controle no `QEMUSimulationEngine`
- [x] Multi-pin GPIO sincronizado
- [x] Exemplo `example-gpio.ts` com Arduino Uno

#### 1.1.2. Backend ESP32 (QEMU) ✅ COMPLETO

- [x] Toolchain ESP-IDF v6.1 no Windows
- [x] QEMU ESP32 oficial da Espressif instalado
- [x] Projeto `hello_world` compilado e executado em QEMU
- [x] Binários `qemu_flash.bin` e `qemu_efuse.bin` gerados
- [x] Linha de comando QEMU validada
- [x] `Esp32Backend` com suporte a `boardType: 'esp32-devkit'`
- [x] Cliente de serial TCP para UART
- [x] Integração com `SerialGPIOParser`
- [x] **Compilação Real**: Sistema compila código do usuário com `arduino-cli --export-binaries`
- [x] **Shim de GPIO** (`esp32-shim.cpp`):
  - [x] Sobrescreve `digitalWrite` e `pinMode` com weak symbols
  - [x] Injeção automática durante compilação
  - [x] Reporta via `ets_printf("G:pin=%d,v=%d\n", ...)`
- [x] **Suporte a eFuse**: `efusePath` passado em toda a stack
- [x] **Filtro de Logs**: Frames `G:` e `M:` não aparecem no Serial Monitor
- [x] **Multi-pin GPIO**: Todos os pinos digitais funcionando em sincronia
- [x] **Documentação**: `docs/ledPisca.md` com relatório técnico completo

#### 1.1.3. Backend RP2040 (QEMU) 🚧 EM PROGRESSO

##### Infraestrutura Base ✅ COMPLETO
- [x] **QEMU Build**: Compilar QEMU customizado para RP2040
  - [x] Setup MSYS2 e dependências no Windows
  - [x] Clone e build do QEMU ARM
  - [x] Estrutura de arquivos para RP2040 SoC
- [x] **RP2040 SoC Implementation**: Criar emulação do chip
  - [x] Memory map (ROM, SRAM, Flash, periféricos)
  - [x] GPIO via SIO (Single-cycle I/O)
  - [x] IO_BANK0 (configuração de pinos)
  - [x] UARTs (PL011-compatible)
  - [x] Cortex-M0 CPU setup
  - [x] System clock configuration
- [x] **Machine Type**: Raspberry Pi Pico board
  - [x] Board initialization
  - [x] ELF loading support
  - [x] Serial output configuration
- [x] **Firmware Toolchain**: Setup de compilação
  - [x] Instalar `arm-none-eabi-gcc`
  - [x] Criar SDK bare-metal mínimo
  - [x] Linker script para RP2040 memory layout
  - [x] Makefile com targets build/clean/run
  - [x] Startup code e vector table

##### Debug e Correções 🚧 EM PROGRESSO
- [x] **Memory Issues**: Corrigir duplicação de RAMBlocks
  - [x] Remover `default_ram_id` conflitante
  - [x] SoC gerencia suas próprias regiões de memória
- [x] **CPU Configuration**: Corrigir configuração do CPU
  - [x] Adicionar system clock (133MHz)
  - [x] Conectar clock ao ARMv7M container
  - [x] Usar `cortex-m0` (QEMU não tem `cortex-m0p`)
- [ ] **Device Realization**: Corrigir inicialização de dispositivos
  - [ ] Debug assertion failures no qdev
  - [ ] Validar ordem de realize() calls
  - [ ] Testar boot sequence completo

##### Backend Integration - PENDENTE
- [ ] **RaspberryPiBackend**: Implementar backend dedicado
  - [ ] Classe `Rp2040Backend` similar a AVR/ESP32
  - [ ] Integração com `QEMURunner`
  - [ ] Cliente TCP para UART
  - [ ] Gerenciamento de processo QEMU
- [ ] **GPIO Protocol**: Shim de reportação
  - [ ] Port do shim ESP32 para Pico SDK
  - [ ] Reportar via `printf("G:pin=%d,v=%d\n", ...)`
  - [ ] Integração com `SerialGPIOParser`
- [ ] **NeuroForge Time**: Port para ARM
  - [ ] Adaptar `nf_time.h/cpp` para Pico SDK
  - [ ] SysTick timer configuration
  - [ ] Timeline de eventos

##### Testing e Validação - PENDENTE
- [ ] **Unit Tests**: Validação isolada
  - [ ] Testar GPIO shim standalone
  - [ ] Validar compilation pipeline
  - [ ] Testar QEMU startup sequence
- [ ] **Integration Tests**: End-to-end
  - [ ] Blink LED no canvas
  - [ ] Multi-pin GPIO simultâneo
  - [ ] Serial Monitor output
  - [ ] Performance benchmarks
- [ ] **Documentation**:
  - [x] Setup guide em `docs/fixes/rp2040-qemu-fixes.md`
  - [ ] API documentation
  - [ ] Exemplo `example-gpio-rp2040.ts`
  - [ ] Troubleshooting guide

##### Board Profiles - PENDENTE
- [ ] Definir JSONs de boards RP2040 em `docs/boards/`
  - [ ] Raspberry Pi Pico (RP2040)
  - [ ] Raspberry Pi Pico W (com WiFi)
  - [ ] Pinout diagrams
  - [ ] Peripheral mapping (I2C, SPI, UART, PIO)

#### 1.1.4. Backend STM32 (QEMU) - Planeado

- [ ] Avaliar e integrar QEMU ou emulador STM32
- [ ] Adicionar `Stm32Backend`
- [ ] Definir JSONs de boards STM32
- [ ] Integração com `SerialGPIOParser`
- [ ] Shim de GPIO para STM32
- [ ] Exemplo `example-gpio-stm32.ts`

#### 1.1.5. Perfis de Placas & Modelos
- [ ] Formato JSON para perfis de placas
- [ ] Implementar suporte a perfis de placas
- [ ] Implementar suporte a perfis de modelos
- [ ] Documentação de perfis de placas

##### Perfis de Placas Pré-Configurados

  A aplicação inclui perfis detalhados para placas de desenvolvimento populares:

  #### Família ESP32:

  - ESP32-DevKitC: mapeamento de 38 pinos com avisos de strapping pins

  - ESP32-S3: suporte USB OTG, dupla interface USB-Serial

  - ESP32-C3: notas sobre arquitetura RISC-V, pinos limitados

  - ESP32 WROOM-32: variante padrão de 30 pinos

  Inclui assistentes de configuração WiFi/Bluetooth

  #### Raspberry Pi Pico:

  - Pico (RP2040): mapeamento GPIO padrão, capacidades PIO

  - Pico W: configuração WiFi e funcionalidades de rede

  - Funções alternativas de pinos (I2C, SPI, UART)

  #### Placas Arduino:

  - Arduino Uno R3: ATmega328P com pinout padrão para shields

  - Arduino Nano: mapeamento em formato compacto

  - Arduino Mega 2560: I/O expandido com múltiplas portas seriais

  - Arduino Nano 33 IoT: WiFi integrado e IMU

  ##### Cada perfil inclui:

  - Diagrama de pinagem preciso com funções alternativas

  - Especificações de níveis de tensão
  - Corrente máxima por pino e total

  - Periféricos integrados (LED, localização de botões)

  - Erratas de hardware conhecidas e workarounds

---

### FASE 2: COMPONENT LIBRARY & PERIFÉRICOS
**STATUS: PLANEADO**

- **Digital Outputs**: **Single LED** (Cores editáveis, Brilho via PWM, Editor de blink, Mapping); **RGB LED** (Picker Hex/RGB/HSV, Presets, Brilho, Efeitos); **WS2812/NeoPixel** (Pixel count, Pattern editor, Animações, Controlo individual); **LED Matrices** (8x8 mono, 16x16 RGB, Scrolling text, Custom sprites).
- **Digital Inputs**: **Push Button** (Momentary/Toggle, Debounce, Pull-up/down, Active logic); **Toggle Switch** (Switches visuais, Labeling, Callbacks); **Sensores Digitais** (Limit switch, Reed, Hall effect, PIR, IR Protocol decoder).
- **Analog Inputs**: **Potentiometer** (Slider horizontal/vertical, Ranges, PWM mapping); **Gauge** (Radial/Linear, Zonas de aviso, Escala de voltagem); **Sensores Analógicos** (LDR/Lux, Audio level, Humidade solo, Battery monitor).
- **Motor Control**: **DC Motor** (Speed/Direction, Current monitoring, Driver presets); **Stepper** (Step count, Speed, Acceleration, Microstepping); **Servo** (Angle slider, Trim, Continuous mode); **ESC** (Throttle, Safety arming, Telemetria); **Fan** (PWM speed, Tachometer).
- **Power Switching**: **Relays** (Single/Multi-channel, Timed activation, Interlock); **MOSFET/SSR** (High-current, Zero-crossing, PWM dimming); **Actuadores** (Solenoids, Bombas de água, Linear actuators).
- **Rotary & Encoders**: **Rotary Encoder** (Visual wheel, Tracking, Detents, Botão integrado); **Joystick** (X/Y visualization, Deadzone, Calibração).
- **Sensórica**: **Ambiente** (Temp/ Humidade Gauge, Pressão/Altitude, Air Quality, Trend charts); **Proximidade** (Ultrassom HC-SR04, Time-of-Flight VL53L0X, PIR Motion, IMU/Giroscópio/Acelerómetro 3D).
- **Time & Location**: **Real-Time** (Relógio RTC, Alarmes, NTP Sync); **GPS** (Coordendas, Map preview, Altitude, Sat count); **Uptime** (Sistema/Boot counter).
- **Display Emulators**: **Segmented** (7-Segment multi-digit, Alphanumeric); **LCD/OLED** (Character LCD 16x2/20x4 com custom chars, SSD1306/SH1106 canvas render accurate); **TFT/E-Paper** (Resoluções variadas, Touch simulation, Partial update).
- **LED Displays**: **Bar Graph** (VU meter, Level gradients); **Dot Matrix** (Pixel control, Scrolling text, Animation preview).
- **Indicators**: **Status Label** (Labels dinâmicos, Icon library, Badges); **Progress & Chart** (Linear/Circular bars, Real-time charts multi-series, Export CSV).
- **Communication**: **Connectivity** (WiFi Status, RSSI, MQTT Monitor/Topic subscribe, I2C Scanner, SPI Config); **Serial & Logging** (UART Terminal, Send command, Log filtering DEBUG/INFO/ERR, CSV export).
- **Storage & Media** (SD Card browser, File upload/download, ESP32-CAM MJPEG stream preview).
- **UX/UI Layout**: **Organization** (Tabs/Pages, Cards/Sections colapsáveis, Grid layout responsive); **Alerts** (Toasts, Dismiss timing, Severity levels).
- **Advanced Inputs**: **Color Picker** (Full spectrum, Hex/Sliders); **Keypads** (Numeric keypad touch-friendly, Text input com histórico e validação).

---

### FASE 3: DASHBOARD BUILDER

**STATUS: PLANEADO**

- Grid layout responsivo tipo Home Assistant / Lovelace.
- Widgets de gauge, switch, botão, texto, gráficos.
- Binding de widgets a GPIO, Serial, variáveis globais, MQTT, HTTP.
- Engine de automação (rules, scenes, schedules).
- Export de dashboards (HTML standalone, apps móveis via Capacitor).

---

### FASE 4: INDUSTRIAL FEATURES

**STATUS: PLANEADO**

- Simulação de PLC (Modbus RTU/TCP, coils, registers).
- Ladder viewer/editor básico.
- SCADA dashboard com tema industrial.
- Componentes industriais (sensores, atuadores, VFD, etc.).
- Safety systems (E-stop, light curtain, safety PLC).

---

### FASE 5: POLISH E LANÇAMENTO

**STATUS: PLANEADO**

- Testes (unit, integration, performance, security).
- Documentação maker + industrial.
- Marketing e lançamento público.
- Integração de pagamentos e planos.

---

### Métricas de sucesso (KPIs)

- Mês 1: QEMU + Arduino Uno rodando blink real, 10 componentes compatíveis. ✅ **COMPLETO**
- Mês 2: ESP32 QEMU + GPIO sincronizado + Serial Monitor. ✅ **COMPLETO**
- Mês 3: RP2040 QEMU + GPIO, 30+ componentes maker, Dashboard Builder funcional. 🚧 **EM PROGRESSO**
- Mês 6: PLC + SCADA, 50+ componentes maker 30+ industriais, 1k usuários ativos.
- Ano 1: 100+ componentes maker 50+ industriais, 10k usuários, €15k MRR.

---

## Roadmaps Técnicos por Área

Aqui ficam os **roadmaps técnicos detalhados**, cada um focado numa feature/stack específica.

### GPIO via Serial (AVR/ESP32/RP2040)

Arquivo: [`docs/roadmaps/gpio-serial-protocol.md`](./roadmaps/gpio-serial-protocol.md)

- Protocolo `G:...` para reportar GPIO via Serial.
- Backend `SerialGPIOParser` com regex não-gananciosa.
- Helper firmware `NeuroForgeGPIO` (AVR) e shim ESP32 com weak symbols.
- Roadmap de expansão multiplataforma e otimizações (rate limiting, checksum, modo binário).

### Arquitetura Multi-Backend

Arquivo: [`docs/architecture/backends.md`](./architecture/backends.md)

- Descrição completa da arquitetura em três camadas: Board/Device, Backend de Execução, Framework/Runtime.
- Detalhes do backend ESP32 (QEMU) e visão de expansão para RP2040, STM32, etc.
- Protocolo de simulação unificado para makers e uso industrial.

### Correções do LED Pisca (Arduino & ESP32)

Arquivo: [`docs/ledPisca.md`](./ledPisca.md)

- Relatório técnico completo das correções implementadas.
- Detalhes do shim de GPIO do ESP32.
- Explicação da compilação real vs binário estático.
- Parser de GPIO e filtro de logs.

### Integração RP2040 QEMU

Arquivo: [`docs/fixes/rp2040-qemu-fixes.md`](./fixes/rp2040-qemu-fixes.md)

- Processo completo de build customizado do QEMU
- Implementação do RP2040 SoC e Raspberry Pi Pico machine
- Troubleshooting e correções de bugs
- Setup de firmware toolchain

### Outros roadmaps técnicos

- QEMU + memória mapeada de GPIO (AVR/ESP32) – planejado/postergado, manter em `docs/roadmaps/`.
- NeuroForge Time (clock virtual e timeline de eventos).
- UI Builder & Dashboard Builder.
- PLC/SCADA & integrações industriais.

Conforme novos roadmaps forem criados em `docs/roadmaps/*.md`, devem ser **linkados nesta seção**, mantendo este arquivo como fonte única de verdade do roadmap geral do projeto.
