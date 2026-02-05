# ROADMAP da Plataforma NeuroForge

Este documento resume o estado atual da plataforma e os próximos passos planeados, com foco em três camadas: boards, backends de execução (QEMU/outros) e frameworks (Arduino, ESP‑IDF, etc.).

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

### Boards AVR (Arduino clássico)
- JSONs de boards em `docs/boards/` para UNO, Nano, etc.
- Backend AVR integrado:
  - QEMU AVR configurado e funcional.
  - Pipeline de compilação AVR (Arduino CLI / avr-gcc) a gerar ELF executado no QEMU.
- Serviços:
  - Serial/monitor integrado.
  - `GPIOService` a interpretar linhas `G:pin=...,v=...` e atualizar o estado da simulação.

### Backend ESP32 (primeira versão)
- Toolchain ESP‑IDF v6.1 configurado no Windows com Python 3.12.
- QEMU ESP32 oficial da Espressif instalado (`qemu-system-xtensa -M esp32 ...`).
- Projeto `hello_world` do ESP‑IDF compilado e executado em QEMU, gerando:
  - `qemu_flash.bin`
  - `qemu_efuse.bin`
- Linha de comando de QEMU validada e estável para uso pelo `Esp32Backend`.

### Documentação de Arquitetura
- [`docs/architecture/backends.md`](./architecture/backends.md) descreve a arquitetura multi-backend (AVR, ESP32, RP2040) com separação entre board, backend de execução e framework.

---

## Em Progresso

### Integração do backend ESP32 na plataforma
- [ ] Estender `QEMURunner` (ou equivalente) com:
  - `boardType: 'esp32-devkit'` (nome a definir).
  - Suporte a `flashImagePath` e `efuseImagePath`.
  - Parametrização da porta TCP da UART (ex.: 5555).
- [ ] Implementar `Esp32Backend` que:
  - Resolve o caminho do `qemu-system-xtensa`.
  - Constrói e lança o comando QEMU ESP32.
  - Expõe um stream de serial (TCP) consumível pela camada de simulação.
- [ ] Criar um cliente de serial TCP (ex.: `Esp32SerialClient`) que:
  - Liga a `tcp://localhost:<porta>`.
  - Reutiliza o parser de linhas `G:` já usado no AVR para GPIO.

### Projeto mínimo ESP‑IDF para integração
- [ ] Clonar `examples/get-started/hello_world` para um projeto `firmware/esp32/neuroforge-gpio` (nome provisório).
- [ ] Integrar uma pequena "cola" (`NeuroForgeGPIO_ESP32`) que:
  - Intercepta operações de GPIO.
  - Emite linhas `G:pin=...,v=...` na UART padrão.
- [ ] Documentar no `docs/firmware/esp32.md`:
  - Como compilar esse projeto.
  - Onde os binários `qemu_flash.bin`/`qemu_efuse.bin` são gerados.
  - Como apontar o `Esp32Backend` para esses ficheiros.

---

## Próximos Passos (Curto Prazo)

### Suporte a RP2040 (Raspberry Pi Pico)
- [ ] Avaliar e integrar QEMU ou emulador com suporte RP2040.
- [ ] Adicionar `Rp2040Backend` com interface idêntica a AVR/ESP32.
- [ ] Definir JSONs de boards RP2040 em `docs/boards/`.

### Unificação da camada de simulação
- [ ] Extrair um `SimulationProtocol`:
  - Sintaxe e semântica de mensagens (GPIO, ADC, rede, sensores).
- [ ] Garantir que tanto AVR quanto ESP32 seguem o mesmo contrato de log.
- [ ] Expor esse protocolo via:
  - WebSocket (UI em tempo real).
  - API para automação de testes e uso industrial.

---

## Visão de Médio Prazo

### Multi‑framework no mesmo MCU
- [ ] Suporte paralelo a:
  - Arduino AVR / Arduino‑ESP32 (experiência maker).
  - ESP‑IDF puro (experiência industrial).
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

### 1. Infraestrutura de ferramentas (concluído)
- [x] Instalar ESP‑IDF v6.1 no Windows com Python 3.12.
- [x] Corrigir conflitos de `windows-curses` com Python 3.14 via venv dedicada.
- [x] Instalar toolchain `xtensa-esp-elf` e colocar no PATH.
- [x] Instalar QEMU ESP32 via `idf_tools.py` e garantir que `qemu-system-xtensa -M esp32` funciona.

### 2. Prova de conceito com hello_world (concluído)
- [x] Compilar `examples/get-started/hello_world` para target `esp32`.
- [x] Gerar `qemu_flash.bin` e `qemu_efuse.bin`.
- [x] Rodar QEMU manualmente e através de `idf.py qemu monitor`.
- [x] Verificar que o monitor (via socket TCP 5555) recebe output.

### 3. Integração com a plataforma NeuroForge (em andamento)
- [ ] Adicionar `Esp32Backend` / `boardType: 'esp32-devkit'` ao `QEMURunner`.
- [ ] Implementar cliente TCP de serial e integrar com `GPIOService`.
- [ ] Criar `example-gpio-esp32.ts` espelhando `example-gpio.ts` (AVR), mas usando QEMU ESP32.

### 4. Generalização e limpeza (planeado)
- [x] Documentar a arquitetura multi‑backend em `docs/architecture/backends.md`.
- [x] Atualizar este ROADMAP à medida que a integração ESP32 evolui.

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

---

## Roadmap Macro do Produto

### Visão Geral do Projeto

**Nome:** NeuroForge  
**Objetivo:** Simulador universal de microcontroladores para makers E indústria com capacidade de criar dashboards IoT  
**Diferencial:** Motor de simulação robusto (QEMU) + Componentes industriais + PLC + SCADA + UI doméstica estilo Home Assistant  
**Mercado:** B2C (Makers) + B2B (Industrial)

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

**STATUS: EM ANDAMENTO** (AVR concluído, ESP32 em integração)

#### Semana 1: QEMU Integration e POC
- [x] Compilar ou configurar QEMU para rodar firmwares Arduino/ESP32/Pico
- [x] Proof of Concept com `blink.ino`
- [x] Verificar GPIO output via Serial
- [x] Medir performance básica

#### Semana 2: Backend de Compilação e QEMUSimulationEngine
- [x] API/CLI de compilação para AVR
- [x] `QEMURunner` substituindo SimulationEngine custom (AVR)
- [x] Carregamento de binário no QEMU
- [x] UART redirection para Serial Monitor
- [ ] ESP32 backend integration (em progresso)

#### Semana 3: Multi-Board Support
- [x] Arduino Uno (AVR)
- [ ] ESP32 (Xtensa) - em integração
- [ ] RP2040 / STM32 (ARM) - planeado
- [ ] Board Selector unificado no app

#### 1.1.1. Backend AVR (QEMU) - Concluído

- [x] JSONs de boards AVR em `docs/boards/`
- [x] QEMU AVR configurado e funcional
- [x] Pipeline de compilação AVR (Arduino CLI / avr-gcc)
- [x] `GPIOService` com parser de linhas `G:pin=...,v=...`
- [x] Exemplo `example-gpio.ts` com Arduino Uno

#### 1.1.2. Backend ESP32 (QEMU) - Em Integração

- [x] Toolchain ESP‑IDF v6.1 no Windows
- [x] QEMU ESP32 oficial da Espressif instalado
- [x] Projeto `hello_world` compilado e executado em QEMU
- [x] Binários `qemu_flash.bin` e `qemu_efuse.bin` gerados
- [x] Linha de comando QEMU validada
- [ ] `Esp32Backend` com suporte a `boardType: 'esp32-devkit'`
- [ ] Cliente de serial TCP para UART
- [ ] Integração com `GPIOService`
- [ ] Exemplo `example-gpio-esp32.ts`

#### 1.1.3. Backend RP2040 (QEMU) - Planeado

- [ ] **RaspberryPiBackend**: Implementar backend dedicado para QEMU ARM
- [ ] **qemu-system-arm** integration: Suporte completo para RP2040 (Cortex-M0+)
- [ ] **RP2040 GPIO Service**: Adaptador específico para GPIO do Pico
- [ ] **PIO Emulation**: State machine simulation (se viável com QEMU)
- [ ] **NeuroForge Time para ARM**: Port do nf_time.h/cpp para Pico SDK
- [ ] **Multi-Core Sync**: Coordenação dual-core do RP2040
- [ ] **Documentação**: Setup guide estilo ESP32 para Pico
- [ ] Definir JSONs de boards RP2040 em `docs/boards/`
- [ ] Exemplo `example-gpio-rp2040.ts` funcional

#### 1.1.4. Backend STM32 (QEMU) - Planeado

- [ ] Avaliar e integrar QEMU ou emulador STM32
- [ ] Adicionar `Stm32Backend`
- [ ] Definir JSONs de boards STM32
- [ ] Integração com `GPIOService`
- [ ] Exemplo `example-gpio-stm32.ts`

#### 1.1.5. Perfis de Placas & Modelos

- [ ] Formato JSON para perfis de placas
- [ ] Implementar suporte a perfis de placas
- [ ] Implementar suporte a perfis de modelos
- [ ] Documentação de perfis de placas
##### Perfis de Placas Pré‑Configurados

  A aplicação inclui perfis detalhados para placas de desenvolvimento populares:

  #### Família ESP32:

  - ESP32‑DevKitC: mapeamento de 38 pinos com avisos de strapping pins

  - ESP32‑S3: suporte USB OTG, dupla interface USB‑Serial

  - ESP32‑C3: notas sobre arquitetura RISC‑V, pinos limitados

  - ESP32 WROOM‑32: variante padrão de 30 pinos

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

- Mês 1: QEMU + Arduino Uno rodando blink real, 10 componentes compatíveis.
- Mês 3: Placas Maker, 30+ componentes maker, Dashboard Builder funcional.
- Mês 6: PLC + SCADA, 50+ componentes maker 30+ industriais, 1k usuários ativos.
- Ano 1: 100+ componentes maker 50+ industriais, 10k usuários, €15k MRR.

---

## Roadmaps Técnicos por Área

Aqui ficam os **roadmaps técnicos detalhados**, cada um focado numa feature/stack específica.

### GPIO via Serial (AVR/ESP32/RP2040)

Arquivo: [`docs/roadmaps/gpio-serial-protocol.md`](./roadmaps/gpio-serial-protocol.md)

- Protocolo `G:...` para reportar GPIO via Serial.
- Backend `SerialGPIOService` com interface compatível com `QEMUGPIOService`.
- Helper firmware `NeuroForgeGPIO` (AVR) e futuros helpers ESP32/RP2040.
- Roadmap de expansão multiplataforma e otimizações (rate limiting, checksum, modo binário).

### Arquitetura Multi-Backend

Arquivo: [`docs/architecture/backends.md`](./architecture/backends.md)

- Descrição completa da arquitetura em três camadas: Board/Device, Backend de Execução, Framework/Runtime.
- Detalhes do backend ESP32 (QEMU) e visão de expansão para RP2040, STM32, etc.
- Protocolo de simulação unificado para makers e uso industrial.

### Outros roadmaps técnicos

- QEMU + memória mapeada de GPIO (AVR/ESP32) – planejado/postergado, manter em `docs/roadmaps/`.
- NeuroForge Time (clock virtual e timeline de eventos).
- UI Builder & Dashboard Builder.
- PLC/SCADA & integrações industriais.

Conforme novos roadmaps forem criados em `docs/roadmaps/*.md`, devem ser **linkados nesta seção**, mantendo este arquivo como fonte única de verdade do roadmap geral do projeto.
