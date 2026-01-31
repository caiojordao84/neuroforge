# ROADMAP NEUROFORGE

## Visão Geral do Projeto

**Nome:** NeuroForge  
**Objetivo:** Simulador universal de microcontroladores para makers E indústria com capacidade de criar dashboards IoT  
**Diferencial:** Motor de simulação robusto (QEMU) + Componentes industriais + PLC + SCADA + UI doméstica estilo Home Assistant  
**Mercado:** B2C (Makers) + B2B (Industrial)

---

## FASE 0: FUNDAÇÃO

**STATUS: CONCLUÍDA**

### Infraestrutura Base
- Setup inicial do projeto (Frontend React + TypeScript)
- Estrutura de pastas organizada
- Editor de código com Monaco Editor
- UI Builder inicial com React Flow
- Sistema de componentes visual

### Motor de Simulação V1 (Custom)
- CodeParser com suporte a variáveis e funções complexas
- SimulationEngine event-driven
- Sistema de pinos e GPIO básico
- Suporte a pinMode, digitalWrite, analogWrite
- Event bus para comunicação componente-código

### Componentes Implementados
- LED simples com controle de brilho
- LED RGB com 3 canais PWM
- Button com debounce
- Servo Motor com controle PWM
- Potentiometer com saída analógica
- MCU como componente draggable (Arduino Uno, ESP32, Raspberry Pi Pico)

### Sistemas de UI
- Floating Windows com drag e persist
- Multi-File Code Editor com tabs
- Libraries Management System
- Component Properties System para todos os componentes
- Manhattan routing para fios
- Snap-to-grid no canvas

### Correções Críticas (FIX 1.1 - 1.10)
- Language Selector funcional
- Code Parser robusto (brace counting)
- LED State Management com tracking de pinos
- Event Listener Persistence entre runs
- Variable resolution (const int ledPin = 13)
- Loop Re-entrancy Prevention

---

## FASE 1: MIGRAÇÃO PARA QEMU - Semana 1-3 (18-21 dias)

### Semana 1: QEMU WebAssembly Integration

#### Dia 1-3: QEMU Setup e POC
- **Compilar QEMU para WebAssembly**
  - Fork do QEMU oficial
  - Configurar Emscripten build
  - Targets: AVR (Arduino), Xtensa (ESP32), ARM (Raspberry Pi Pico, STM32)
  - Build otimizado para browser (threading via SharedArrayBuffer)
  - Testar execução básica de firmware

- **Proof of Concept**
  - Carregar firmware .hex/.bin no browser
  - Executar blink.ino compilado para Arduino Uno
  - Verificar GPIO output via memory mapping
  - Medir performance (FPS, latency)

#### Dia 4-6: Backend de Compilação
- **Cloud Compilation API**
  - Cloudflare Worker ou AWS Lambda para compilação serverless
  - Endpoint: POST /compile { code, board, language }
  - Suporte a arduino-cli para C++
  - Suporte a micropython-cross para MicroPython
  - Cache de builds (GitHub Actions Artifacts)
  - Rate limiting e autenticação

- **Local Compilation (Opcional)**
  - WASM build do arduino-cli
  - Executar compilação no browser (experimental)
  - Fallback para API se falhar

#### Dia 7: Integration Layer
- **QEMUSimulationEngine.ts**
  - Substituir SimulationEngine custom por QEMU runner
  - Carregar binário compilado no QEMU instance
  - Memory-mapped I/O para ler GPIO registers
  - UART redirection para Serial Monitor
  - Timer configuration para simulação real-time

- **Board Abstraction Layer**
  - QEMUBoard interface (define memory maps)
  - ArduinoUnoQEMU extends QEMUBoard
  - ESP32QEMU extends QEMUBoard
  - RaspberryPiPicoQEMU extends QEMUBoard

### Semana 2: Component Bridge

#### Dia 8-10: GPIO Mapping
- **Memory-Mapped GPIO**
  - Polling de registradores PORTB, PORTC, PORTD (Arduino)
  - GPIO_OUT registers (ESP32)
  - Converter bit state para eventos pinChange
  - Otimização: polling apenas de pinos conectados

- **Component Listeners**
  - LEDNode lê PORT state real
  - ServoNode lê PWM registers (Timer1)
  - ButtonNode injeta valores no PIN register
  - PotentiometerNode injeta no ADC

#### Dia 11-13: Peripheral Simulation
- **UART (Serial)**
  - Capturar TX buffer do QEMU
  - Renderizar no Serial Monitor
  - Injetar RX input do usuário

- **ADC (Analog Input)**
  - Componentes (Potentiometer, Sensor) escrevem no ADC register
  - QEMU lê valor quando analogRead() é chamado

- **PWM (Timer)**
  - Ler Timer/Compare registers
  - Calcular duty cycle
  - Atualizar Servo/LED RGB com valores reais

#### Dia 14: Testing e Refinamento
- Testar todos os componentes com código real compilado
- Validar timing (delay(), millis())
- Performance profiling
- Bug fixes

### Semana 3: Multi-Board Support

#### Dia 15-17: ESP32 QEMU
- Compilar QEMU target xtensa
- WiFi simulation (mock socket API)
- Dual-core simulation (FreeRTOS)
- GPIO matrix mapping

#### Dia 18-20: ARM Boards (STM32, Pico)
- QEMU target ARM Cortex-M0+ (Pico)
- QEMU target ARM Cortex-M3 (STM32)
- PIO simulation (Pico specific)
- CAN bus simulation (STM32)

#### Dia 21: Board Selector
- Dropdown para escolher board antes de compilar
- Carregar QEMU instance correto por board
- Validação de código por arquitetura

---

## FASE 2: COMPONENTES AVANÇADOS - Semana 4-6 (18-21 dias)

### Semana 4: Displays e Comunicação

#### Dia 22-24: Display Components
- **LCD 16x2 (I2C)**
  - Emular PCF8574 I2C expander
  - Renderizar caracteres no canvas
  - LiquidCrystal_I2C biblioteca

- **OLED 128x64 (SPI/I2C)**
  - Emular SSD1306 controller
  - Framebuffer rendering
  - Adafruit_SSD1306 biblioteca

- **TFT Display (ST7735)**
  - SPI communication
  - Bitmap rendering
  - Touch simulation (opcional)

#### Dia 25-26: Sensores Analógicos
- **DHT22 (Temperature/Humidity)**
  - Protocolo 1-wire timing simulado
  - Sliders para ajustar valores

- **Ultrasonic (HC-SR04)**
  - Trigger/Echo timing real
  - Slider de distância
  - Echo pulse width calculation

- **LDR (Light Sensor)**
  - Slider de luz (0-100%)
  - ADC output (0-1023)

#### Dia 27-28: Motores
- **DC Motor + Driver (L298N)**
  - H-Bridge simulation
  - PWM speed control
  - Direção (forward/backward)
  - Visual de rotação

- **Stepper Motor + Driver (A4988)**
  - Step/Dir pins
  - Microstep support
  - Animação de rotação
  - NEMA 17 model

### Semana 5: Comunicação Avançada

#### Dia 29-31: Multi-MCU Communication
- **UART Inter-MCU**
  - Conectar TX de MCU1 a RX de MCU2
  - Buffer de comunicação bidirecional
  - Simulação de baudrate

- **I2C Bus**
  - Master/Slave simulation
  - Address resolution
  - Multiple devices no mesmo bus
  - Clock stretching

- **SPI Bus**
  - Master/Slave (MISO, MOSI, SCK, CS)
  - Multiple slaves com CS dedicado
  - Simulação de timing

#### Dia 32-33: Network Simulation (ESP32)
- **Virtual WiFi Network**
  - Mock de WiFi.begin(), WiFi.status()
  - WebSocket server simulado
  - HTTP client requests (fetch API)
  - MQTT broker (Mosquitto WASM)

#### Dia 34-35: Debug Tools
- **Serial Plotter**
  - Gráficos em tempo real
  - Múltiplos canais
  - Export CSV

- **Logic Analyzer**
  - 8 canais digitais
  - Protocol decoder (I2C, SPI, UART)
  - Timing diagram

- **Oscilloscope Virtual**
  - 4 canais analógicos
  - Trigger modes
  - FFT analysis

### Semana 6: Optimization e Polish

#### Dia 36-38: Performance
- Web Workers para QEMU execution
- OffscreenCanvas para rendering
- Throttling de eventos (debounce)
- Memory leak detection

#### Dia 39-41: UX Improvements
- Keyboard shortcuts (Ctrl+R run, Ctrl+S save)
- Context menu (right-click)
- Component search bar
- Recent projects

#### Dia 42: Testing
- End-to-end tests (Playwright)
- Component tests (Vitest)
- Performance benchmarks

---

## FASE 3: DASHBOARD BUILDER - Semana 7-10 (25-28 dias)

### Semana 7: Dashboard Foundation

#### Dia 43-45: Dashboard Layout Engine
- **Grid System**
  - Drag-and-drop grid layout (react-grid-layout)
  - Responsive breakpoints (desktop, tablet, mobile)
  - Widget resize e reposition
  - Snap-to-grid

- **Widget System**
  - Widget base class
  - Widget configuration panel
  - Widget library (sidebar)

#### Dia 46-48: Core Widgets
- **Gauge Widget**
  - Circular gauge com needle
  - Linear bar gauge
  - Configuração de min/max/units
  - Binding a sensor ou variável

- **Switch Widget**
  - Toggle button
  - Binding a GPIO pin
  - On/Off states
  - Custom icons

- **Button Widget**
  - Momentary/Toggle
  - Execute action (set pin, call function)
  - Custom label/color

- **Text Display Widget**
  - Display sensor value
  - Format string (printf-style)
  - Font customization

#### Dia 49-50: Chart Widgets
- **Line Chart**
  - Time-series data
  - Multiple series
  - Real-time update
  - Zoom/Pan

- **Bar Chart**
  - Categorical data
  - Horizontal/Vertical

- **Pie Chart**
  - Percentage distribution

### Semana 8: Advanced Widgets

#### Dia 51-53: Control Widgets
- **Slider Widget**
  - Horizontal/Vertical
  - Binding a PWM pin
  - Min/Max/Step

- **Color Picker Widget**
  - RGB color selection
  - Binding a RGB LED
  - Hex/RGB/HSV modes

- **Joystick Widget**
  - 2-axis control
  - Binding a 2 analog pins ou serial
  - Deadzone configuration

#### Dia 54-56: Media Widgets
- **Image Widget**
  - Display static image
  - Update via URL
  - Camera feed (simulado)

- **Video Widget**
  - Embed video URL
  - Placeholder para stream

- **Map Widget**
  - Google Maps embed
  - GPS coordinates input
  - Marker positioning

#### Dia 57-58: Container Widgets
- **Tabs Container**
  - Multiple pages
  - Tab labels
  - Nested widgets

- **Accordion Container**
  - Collapsible sections
  - Nested widgets

### Semana 9: Data Binding

#### Dia 59-61: Binding System
- **Data Sources**
  - GPIO pin (digital/analog)
  - Serial Monitor output (parse)
  - Global variables (shared state)
  - MQTT topics
  - HTTP endpoints

- **Binding Configuration**
  - Widget → Data Source mapping
  - Transform functions (scale, offset, format)
  - Update frequency (polling rate)

- **Bidirectional Binding**
  - Widget change → Update MCU state
  - MCU state → Update widget

#### Dia 62-64: Automation Engine
- **Rules System**
  - IF condition THEN action
  - Conditions: sensor threshold, time, manual trigger
  - Actions: set pin, send notification, log

- **Scenes**
  - Predefined states ("Movie Mode", "Away Mode")
  - One-click activation
  - Save current state as scene

- **Schedules**
  - Time-based actions
  - Cron-like syntax
  - Sunrise/sunset (calculated)

### Semana 10: Export e Deploy

#### Dia 65-67: Export Dashboard
- **Standalone HTML Export**
  - Self-contained HTML + JS + CSS
  - Embedded WebSocket client
  - Connect to real hardware via WiFi

- **Mobile App Export**
  - Capacitor integration
  - Build APK for Android
  - Build IPA for iOS (com Mac)

#### Dia 68-70: Production Features
- **Authentication**
  - Login system
  - Role-based access (admin, viewer)
  - API tokens

- **Data Logging**
  - Store sensor data (InfluxDB ou PostgreSQL)
  - Query historical data
  - Export CSV

- **Notifications**
  - Push notifications (Firebase)
  - Email alerts (SendGrid)
  - Webhook integrations

---

## FASE 4: INDUSTRIAL FEATURES - Semana 11-14 (25-28 dias)

### Semana 11: PLC Simulation

#### Dia 71-73: Virtual PLC
- **Modbus RTU/TCP**
  - Master/Slave simulation
  - Coils (digital outputs)
  - Discrete Inputs (digital inputs)
  - Holding Registers (analog values)
  - Input Registers (sensor data)

- **Function Codes**
  - Read Coils (01)
  - Read Discrete Inputs (02)
  - Read Holding Registers (03)
  - Read Input Registers (04)
  - Write Single Coil (05)
  - Write Single Register (06)
  - Write Multiple Coils (15)
  - Write Multiple Registers (16)

#### Dia 74-76: Ladder Logic
- **Ladder Viewer**
  - Visual representation de rungs
  - Contacts (NO, NC)
  - Coils (output, set, reset)
  - Timers (TON, TOF, TP)
  - Counters (CTU, CTD)

- **Import/Export**
  - Import .st (Structured Text)
  - Import .ld (Ladder Diagram XML)
  - Export to PLCOpen XML

### Semana 12: SCADA Interface

#### Dia 77-79: SCADA Dashboard
- **Industrial Theme**
  - Gray/Blue color scheme
  - High contrast for visibility
  - Large clickable elements

- **Mimics (Process Visualization)**
  - Tanks com indicador de nível
  - Pipes com animação de flow
  - Valves (open/close animation)
  - Motors (running/stopped indicator)
  - Pumps (flow rate)

#### Dia 80-82: Industrial Components
- **Sensors Industriais**
  - Encoder rotativo (A/B phases)
  - Proximity sensor (indutivo/capacitivo)
  - Limit switch (fim de curso)
  - Pressure sensor (4-20mA)
  - Load cell (HX711)

- **Atuadores Industriais**
  - Válvula solenoide (2/2, 3/2 vias)
  - Cilindro pneumático (simples/dupla ação)
  - Contactor/Relay
  - VFD (Variable Frequency Drive)

### Semana 13: Safety Systems

#### Dia 83-85: Safety Components
- **Emergency Stop**
  - Twist-to-release button
  - Series connection logic
  - Safety relay integration

- **Light Curtain**
  - Área de proteção
  - Muting function
  - Safety PLC integration

- **Safety PLC**
  - Dual-channel inputs
  - Safety logic (Cat 3, Cat 4)
  - Diagnostic functions

#### Dia 86-88: Real PLC Emulation (Básico)
- **Siemens S7-1200**
  - Import de DB (Data Blocks)
  - Basic instruction set

- **Allen-Bradley CompactLogix**
  - Import de Tags
  - Basic ladder logic

### Semana 14: Integration e Templates

#### Dia 89-91: Industrial Templates
- **Conveyor Belt Control**
  - Motor start/stop
  - Sensor de presença
  - Counter

- **Tank Level Control (PID)**
  - Level sensor
  - Pump control
  - PID algorithm

- **Sorting Machine**
  - Color sensor
  - Pneumatic actuators
  - Conveyor logic

#### Dia 92-95: Documentation
- User manual (Makers)
- User manual (Industrial)
- API documentation
- Video tutorials (10+)

---

## FASE 5: POLISH E LANÇAMENTO - Semana 15-18 (25-28 dias)

### Semana 15-16: Testing

#### Dia 96-105: Quality Assurance
- **Unit Tests**
  - 80%+ coverage
  - Vitest para lógica
  - React Testing Library para UI

- **Integration Tests**
  - Playwright end-to-end
  - Simulation tests (blink, serial, etc)
  - Multi-MCU communication tests

- **Performance Tests**
  - Load testing (k6)
  - Memory profiling
  - FPS benchmarks

- **Security Testing**
  - OWASP Top 10
  - Input validation
  - XSS prevention

#### Dia 106-110: Bug Fixing
- Critical bugs (P0)
- High priority (P1)
- Medium priority (P2)
- UX polish

### Semana 17: Documentation e Marketing

#### Dia 111-113: Documentation
- **User Docs**
  - Getting Started guide
  - Component reference (50+ pages)
  - Dashboard builder tutorial
  - PLC integration guide
  - API reference

- **Developer Docs**
  - Architecture overview
  - QEMU integration guide
  - Custom component SDK
  - Contributing guide

#### Dia 114-116: Marketing
- **Landing Page**
  - Hero section
  - Features showcase
  - Pricing table
  - Demo video (3min)
  - Testimonials

- **Demo Video**
  - Maker use case (LED blink → RGB control)
  - Industrial use case (PLC + SCADA)
  - Dashboard builder demo
  - Side-by-side vs Wokwi

- **Content**
  - Blog posts (5+)
  - Case studies (2+)
  - Press kit

### Semana 18: Launch

#### Dia 117-119: Beta Testing
- Private beta (50-100 testers)
- Feedback collection
- Critical fixes

#### Dia 120-122: Payment Integration
- **Stripe Setup**
  - Subscription plans
  - Trial period (14 days)
  - Billing dashboard
  - Invoices

- **Pricing Tiers**
  - Free: Arduino, 10 components, projetos públicos
  - Hobby (€10/mês): Todas placas, 50 componentes, projetos privados
  - Maker Pro (€30/mês): Unlimited, dashboard export, no watermark
  - Industrial (€100/mês): PLC, SCADA, Modbus, 10 usuários
  - Enterprise (Custom): On-premise, SSO, SLA

#### Dia 123-125: Public Launch
- Product Hunt launch
- Reddit (r/arduino, r/esp32, r/embedded)
- Hacker News
- Twitter/X announcement
- YouTube demo
- Email campaign

---

## VERSÃO 2.0 - FUTURO (6-12 meses)

### Features Avançadas
- **Visual Programming (Blockly)**
  - Drag-and-drop blocks (Scratch-style)
  - Code generation
  - Educational mode

- **3D Viewer**
  - Three.js 3D board rendering
  - Component models em 3D
  - AR preview (WebXR)

- **PCB Designer**
  - Schematic editor
  - PCB layout
  - Auto-routing
  - Gerber export
  - Integration com JLCPCB

- **IoT Cloud**
  - OTA firmware updates
  - Remote monitoring
  - Data logging (InfluxDB)
  - Fleet management

- **Machine Learning**
  - TinyML on ESP32
  - Model training (TensorFlow Lite)
  - Edge AI inference

- **More Boards**
  - nRF52840 (Bluetooth)
  - TI MSP430 (ultra-low power)
  - PIC18F (Microchip)
  - RISC-V (GD32V)

---

## MÉTRICAS DE SUCESSO

### KPIs - Mês 1 (Fase 1)
- QEMU funcionando para Arduino Uno
- LED blink com código real compilado
- Serial Monitor com output real
- 10 componentes compatíveis
- 0 bugs críticos

### KPIs - Mês 3 (Fase 1-2)
- 5 placas (Arduino, ESP32, Pico, STM32, ESP8266)
- 30+ componentes funcionais
- Multi-MCU communication (UART, I2C, SPI)
- Dashboard builder funcional
- 100 beta testers

### KPIs - Mês 6 (Fase 1-4)
- 50+ componentes
- PLC + Modbus funcionais
- SCADA dashboard
- 1.000 usuários ativos
- 100 pagantes (€3k MRR)

### KPIs - Ano 1
- 100+ componentes
- 10.000 usuários ativos
- 500 pagantes (€15k MRR)
- 10 templates industriais
- Break-even alcançado

---

## RESUMO EXECUTIVO

**Duração Total:** 125 dias (18 semanas / 4.5 meses)  
**Componentes Totais:** 100+  
**Placas Suportadas:** 8+ (Arduino, ESP32, Pico, STM32, ESP8266, nRF52, MSP430, PIC)  
**Linguagens:** 3 (C++, MicroPython, CircuitPython)  
**Mercados:** B2C (Makers) + B2B (Industrial)  
**Investimento Estimado:** 4.5 meses full-time (2 pessoas = você + IA)  
**Revenue Ano 1:** €50k-150k (estimado)  
**Diferencial Competitivo:**
- Motor QEMU (simulação real de hardware)
- Dashboard builder (Home Assistant style)
- PLC + SCADA (único no mercado maker)
- Export para produção (APK, HTML standalone)
- Multi-MCU simultâneo

---

## PRÓXIMOS PASSOS IMEDIATOS

### Esta Semana
1. Pesquisar QEMU WebAssembly builds existentes
2. Criar POC de QEMU rodando Arduino blink no browser
3. Setup backend de compilação (Cloudflare Worker)
4. Testar latência GPIO polling

### Próxima Semana
1. Integrar QEMU no NeuroForge
2. Substituir SimulationEngine por QEMUSimulationEngine
3. Conectar LED ao PORT state real
4. Validar timing com delay() e millis()

### Mês 1
- Completar Fase 1 (QEMU migration)
- 5 componentes funcionando com código real
- Serial Monitor com UART real
- Performance aceitável (30+ FPS)

---

**ROADMAP ATUALIZADO E FOCADO EM PRODUÇÃO**