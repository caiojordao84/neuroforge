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
- JSONs de boards em `src/components/boards/` para UNO, Nano, etc.
- Backend AVR integrado:
  - QEMU AVR configurado e funcional.
  - Pipeline de compilação AVR (Arduino CLI / avr-gcc) a gerar ELF executado no QEMU.
  - Board custom `arduino:avr:unoqemu` com NeuroForge Time.
  - **Serial TCP**: QEMU conecta ao backend via TCP (fix para Windows stdio).
  - **Auto-inject Serial.begin()**: Código do usuário sem Serial.begin() recebe injeção automática.
- Serviços:
  - Serial/monitor integrado.
  - `SerialGPIOParser` com regex não-gananciosa para detectar frames `G:pin=...,v=...`.
  - **Buffer TCP**: Acumula fragmentos até linha completa (`\n`).
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
- [`docs/fixes.md`](./fixes.md) documenta correções técnicas críticas (QEMU serial TCP, buffer TCP, auto-inject).

### Estrutura de Boards ✅ REORGANIZADA (12/02/2026)
- **Nova estrutura**: `src/components/boards/`
  ```
  src/components/boards/
    arduino/
      json/arduino-uno.json
      svg/arduino-uno-r3.svg
    esp32/
      json/esp32-devkit.json
      svg/esp32-devkit.svg
    raspberry-pi-pico/
      json/raspberry-pi-pico.json
      svg/raspberry-pi-pico.svg
    board-schema.json
  ```
- **SVG Arduino Uno R3**: Criado com nomenclatura padronizada:
  - IDs: `pin-d0` a `pin-d13`, `pin-a0` a `pin-a5`, `pin-vin`, `pin-5v`, etc.
  - Data attributes: `data-pin`, `data-analog`, `data-i2c`, `data-pwm`, `data-interrupt`.
  - Componentes: `chip-atmega328p`, `chip-atmega16u2`, `usb-connector`, `power-jack`, `reset-button`.
  - LEDs: `led-power`, `led-tx`, `led-rx`, `led-pin13`.
  - ICSP: `icsp-1-miso` a `icsp-1-gnd`, `icsp-2-miso` a `icsp-2-gnd`.
- Servidor não é afetado (não usa os JSONs, apenas tipos TypeScript).

---

## Em Progresso

### Suporte a RP2040 (Raspberry Pi Pico) - Simulação JS
> **⚠️ NOTA:** A emulação backend via QEMU/Renode foi suspensa temporariamente para focar na simulação frontend (JS/WASM).
- [x] Remover scripts Renode obsoletos do servidor.
- [x] Definir JSON de board em `src/components/boards/raspberry-pi-pico/`.
- [ ] Implementar simulação lógica básica (pinos, LED) no frontend.
- [ ] Criar SVG do Raspberry Pi Pico com nomenclatura padronizada.

### Unificação da camada de simulação
- [ ] Extrair um `SimulationProtocol`:
  - Sintaxe e semântica de mensagens (GPIO, ADC, rede, sensores).
- [x] Garantir que tanto AVR quanto ESP32 seguem o mesmo contrato de log.
- [ ] Expor esse protocolo via:
  - WebSocket (UI em tempo real).
  - API para automação de testes e uso industrial.

---

## Próximos Passos (Curto Prazo)

### Componentes de Board
- [ ] Criar index.ts para importar todos os boards automaticamente.
- [ ] Implementar BoardLoader no frontend para carregar JSON + SVG dinamicamente.
- [ ] Sistema de binding SVG ↔ GPIO state (pin highlighting, LED animations).

### Suporte a RP2040 (Raspberry Pi Pico)
- [ ] Validar integração com `board-schema.json`.
- [ ] Implementar interpretador/simulador JS para RP2040 (sem QEMU no momento).
- [ ] Criar SVG do Raspberry Pi Pico.

### Componentes Avançados
- [ ] Sensores analógicos (LDR, potenciômetro já funciona).
- [ ] Displays (LCD 16x2, OLED SSD1306).
- [ ] Motores (DC, Servo, Stepper).
- [ ] Sensores digitais (DHT22, HC-SR04).

---

## Visão de Médio Prazo

### Backend RP2040 (QEMU/Renode) - ⏸️ POSTERGADO
- Retornaremos à emulação full-system backend quando o projeto estiver mais maduro.

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

### 4. Correções Críticas do QEMU no Windows ✅ CONCLUÍDO (10-12/02/2026)
- [x] **FIX #1: QEMU Serial TCP** - stdio não funciona no Windows:
  - Backend cria TCP server na porta 5555 antes de iniciar QEMU.
  - QEMU conecta como cliente usando `-serial tcp:127.0.0.1:5555`.
  - Dados serial recebidos via socket TCP.
  - Commits: `08b83a9`, `092ef1c`.
- [x] **FIX #2: Buffer TCP** - Dados fragmentados:
  - Buffer TCP acumula fragmentos até encontrar `\n`.
  - Apenas linhas completas emitidas como eventos.
  - Commit: `2bd66e3`.
- [x] **FIX #3: Auto-inject Serial.begin()** - Código sem Serial.begin():
  - Auto-inject `Serial.begin(115200)` no início de `setup()`.
  - Apenas se não existir no código original.
  - Funciona para Arduino AVR (ESP32 usa shim separado).
  - Commit: `6e2544e`.
- [x] Documentação completa em `docs/fixes.md` com scripts PowerShell de backup/restore.
- [x] Reorganização de boards: `docs/boards/` → `src/components/boards/`.
- [x] SVG Arduino Uno R3 com nomenclatura padronizada.

### 5. Generalização e limpeza ✅ CONCLUÍDO
- [x] Documentar a arquitetura multi-backend em `docs/architecture/backends.md`.
- [x] Atualizar este ROADMAP à medida que a integração ESP32 evolui.
- [x] Criar `docs/ledPisca.md` com relatório técnico completo.
- [x] Criar `docs/fixes.md` com correções técnicas e scripts de manutenção.

### 6. Enhanced QEMU Orchestration (planeado)
- [ ] **Unified Backend Manager**: Melhorar `QEMUSimulationEngine` com API unificada
- [ ] **Shared Event System**: Agregação de eventos de múltiplas instâncias QEMU
- [ ] **Multiplexed Serial Monitor**: Console única para AVR + ESP32 + outros backends
- [ ] **Unified Configuration**: Sistema de configuração centralizado para todas arquiteturas
- [ ] **Better Lifecycle Management**: Start/stop/restart coordenado entre backends
- [ ] **Resource Pooling**: Gerenciamento inteligente de portas TCP/Monitor
- [ ] **Error Handling**: Sistema unificado de tratamento de erros e recovery

### 7. Multi-Device Orchestration (planeado)
- [ ] **Simultaneous Multi-MCU**: Rodar AVR + ESP32 + RP2040 simultaneamente
- [ ] **Shared NeuroForge Clock**: Clock virtual sincronizado entre todos os devices
- [ ] **Inter-Device Communication**: GPIO/I2C/SPI bus compartilhado entre MCUs
- [ ] **QEMU Network Bridge**: Conectar instâncias QEMU via networking features
- [ ] **Coordinated Stepping**: Debug síncrono de múltiplos devices
- [ ] **Resource Arbitration**: Gerenciamento de recursos compartilhados entre instâncias

### 8. Multi-Language Toolchain (planeado)
- [ ] **MicroPython Setup**: Scripts de instalação de firmware e tools (mpy-cross)
- [ ] **CircuitPython Integration**: Suporte a UF2 workflow e bibliotecas
- [ ] **Rust Embedded**: Setup de toolchain (cargo, avr-hal, esp-hal, rp-hal)
- [ ] **TinyGo Support**: Configuração de compilador para AVR/ESP32/RP2040
- [ ] **JavaScript Runtimes**: Integração com Moddable/Kaluma (se viável)

### 9. NeuroForge Transpiler & Visual Programming (planeado)
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

**STATUS: AVR & ESP32 COMPLETO ✅ | RP2040 JS SIMULATION ⚡**

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
- [x] **QEMU Serial TCP** para compatibilidade Windows
- [x] **Buffer TCP** para fragmentos de dados
- [x] **Auto-inject Serial.begin()** para Arduino AVR

#### Semana 3: Multi-Board Support ✅ COMPLETO
- [x] Arduino Uno (AVR)
- [x] ESP32 (Xtensa)
- [ ] RP2040 (Simulação JS) - em progresso
- [x] Board Selector unificado no app
- [x] **Reorganização de estrutura**: `src/components/boards/`
- [x] **SVG Arduino Uno R3** com nomenclatura padronizada

#### 1.1.1. Backend AVR (QEMU) ✅ COMPLETO

- [x] JSONs de boards AVR em `src/components/boards/arduino/`
- [x] SVG Arduino Uno R3 com IDs padronizados
- [x] QEMU AVR configurado e funcional
- [x] Pipeline de compilação AVR (Arduino CLI / avr-gcc)
- [x] Board custom `arduino:avr:unoqemu` com NeuroForge Time
- [x] **QEMU Serial via TCP** (fix Windows stdio)
- [x] **Buffer TCP** para linhas completas
- [x] **Auto-inject Serial.begin()** automático
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

#### 1.1.3. Backend RP2040 (QEMU) - ⏸️ POSTERGADO

- A emulação de backend completa (QEMU/Renode) foi movida para uma fase futura.
- O foco atual é suportar o Raspberry Pi Pico via **Simulação JS** no frontend.

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
- Mês 3: Placas Maker, 30+ componentes maker, Dashboard Builder funcional.
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

### Correções Técnicas (QEMU Serial TCP, Buffer, Auto-inject)

Arquivo: [`docs/fixes.md`](./fixes.md)

- **FIX #1**: QEMU Serial via TCP (Windows stdio não funciona)
- **FIX #2**: Buffer TCP para dados fragmentados
- **FIX #3**: Auto-inject Serial.begin() para GPIO protocol
- Scripts PowerShell de backup/restore dos cores customizados (Arduino AVR e ESP32)
- Diagnóstico e verificação de instalação dos cores

### Outros roadmaps técnicos

- QEMU + memória mapeada de GPIO (AVR/ESP32) – planejado/postergado, manter em `docs/roadmaps/`.
- NeuroForge Time (clock virtual e timeline de eventos).
- UI Builder & Dashboard Builder.
- PLC/SCADA & integrações industriais.

Conforme novos roadmaps forem criados em `docs/roadmaps/*.md`, devem ser **linkados nesta seção**, mantendo este arquivo como fonte única de verdade do roadmap geral do projeto.
