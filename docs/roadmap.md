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

---

### FASE 2: COMPONENTES AVANÇADOS

**STATUS: PLANEADO**

- Displays: LCD 16x2, OLED 128x64, TFT ST7735.
- Sensores: DHT22, ultrasom, LDR, etc.
- Motores: DC + driver, stepper + driver.
- Comunicação multi-MCU: UART, I2C, SPI.
- Network (ESP32): WiFi virtual, MQTT, HTTP.
- Ferramentas: Serial Plotter, Logic Analyzer, Osciloscópio virtual.

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
- Mês 3: 5+ placas, 30+ componentes, dashboard builder funcional.
- Mês 6: PLC + SCADA, 50+ componentes, 1k usuários ativos.
- Ano 1: 100+ componentes, 10k usuários, €15k MRR.

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
