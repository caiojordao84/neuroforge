# ROADMAP da Plataforma NeuroForge

Este documento resume o estado atual da plataforma e os próximos passos planeados, com foco em três camadas: boards, backends de execução (QEMU/outros) e frameworks (Arduino, ESP-IDF, etc.).

---

## Índice Rápido

- [Estado Atual](#estado-atual)
- [Sistema de LEDs do MCU](#sistema-de-leds-do-mcu)
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

### Sistema de LEDs do MCUNode ✅ COMPLETO (14/02/2026)
- **4 LEDs Funcionais**: Power (verde), Pin 13 (laranja), TX/RX (amarelo)
- **Mapeamento SVG**: Coordenadas extraídas do `arduino-uno-r3.svg`
- **Feedback Visual em Tempo Real**:
  - LED Power indica estado da simulação (running/paused/stopped)
  - LED Pin 13 responde a `digitalWrite()` e `analogWrite()` com PWM
  - LEDs TX/RX piscam durante comunicação Serial
- **Compatibilidade Total**: JS Runtime e QEMU Emulation
- **Animações Diferenciadas**:
  - Fade suave (0.1s) para Power e Pin 13 (efeitos PWM)
  - Instantâneo (0s) para TX/RX (comunicação serial rápida)
- **Commits**: `6cfd560`, `52d9913`, `65a9c6f`, `acbed44`
- Ver seção [Sistema de LEDs do MCU](#sistema-de-leds-do-mcu) para detalhes completos

### Sistema de Botões & Entradas Digitais ✅ COMPLETO (17/02/2026)

- **Cenário validado:** Sketch `Teste_2Botoes_2LEDs.ino` com 2 botões (D2, D3) controlando 2 LEDs (D12, D13) via `digitalRead()` + `digitalWrite()`.
- **ButtonNode**:
  - Resolve `connectedPin` a partir do handle `signal` e das conexões no canvas.
  - Usa `SimulationEngine.externalDigitalWrite(pin, HIGH/LOW)` para dirigir pinos de entrada, respeitando `pullResistor` (`NONE`, `PULLUP`, `PULLDOWN`).
  - Expõe propriedades de identificação, debounce e pull no painel `ButtonPropertiesPanel`.
- **CodeParser (C++)**:
  - Suporta `digitalRead(pin)` e `analogRead(pin)` em expressões, com avaliação correta de `if (btnState == HIGH)`.
  - Mantém variáveis globais/locais e controla blocos `if / else` com uma pilha de execução simples.
- **SimulationEngine / useSimulationStore**:
  - `externalDigitalWrite` permite que componentes externos (botões, sensores) atualizem diretamente o estado dos pinos, sem depender do firmware setar `pinMode` primeiro.
  - `digitalRead(pin)` passa a refletir fielmente o estado do pino vindo tanto do firmware quanto dos componentes visuais.
- **LEDNode + React**:
  - LEDNodes recebem eventos `pinChange` e comparam com `connectedPin` para atualizar o estado visual (ON/OFF) em tempo real.
  - Ajustes de UI garantem que o estado lógico dos pinos seja sempre visível no canvas (commit `74089aa2…`).
- **Commits principais:** `bf989fbf7c…`, `74089aa2…`.

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
      svg/raspberry-pi-pico.json
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

## Sistema de LEDs do MCU

**STATUS: ✅ COMPLETO (Fevereiro 14, 2026)**  
**Commits:** `6cfd560`, `52d9913`, `65a9c6f`, `acbed44`

### Visão Geral

O sistema de LEDs do MCUNode fornece **feedback visual em tempo real** do estado da simulação, replicando o comportamento físico de uma placa Arduino Uno R3 real. Quatro LEDs funcionais foram mapeados, configurados e integrados com os motores de simulação (JS e QEMU).

**Objetivos Alcançados:**
- ✅ Mapeamento preciso de LEDs a partir do SVG do Arduino Uno R3
- ✅ LED Power indica estado da simulação (verde)
- ✅ LED Pin 13 reage a `digitalWrite()` e `analogWrite()` (laranja)
- ✅ LEDs TX/RX piscam durante comunicação Serial (amarelo)
- ✅ Compatibilidade total com JS Runtime e QEMU Emulation
- ✅ Animações diferenciadas: fade suave para PWM, instantâneo para serial

---

(... resto do arquivo inalterado ...)

## Roadmaps Técnicos por Área

Aqui ficam os **roadmaps técnicos detalhados**, cada um focado numa feature/stack específica.

### GPIO via Serial (AVR/ESP32/RP2040)

Arquivo: [`docs/roadmaps/gpio-serial-protocol.md`](./roadmaps/gpio-serial-protocol.md)

- Protocolo `G:...` para reportar GPIO via Serial.
- Backend `SerialGPIOParser` com regex não-gananciosa.
- Helper firmware `NeuroForgeGPIO` (AVR) e shim ESP32 com weak symbols.
- Roadmap de expansão multiplataforma e otimizações (rate limiting, checksum, modo binário).

### Entradas Digitais (Botões, Chaves, Sensores)

Arquivo: [`docs/roadmaps/buttons-and-digital-inputs.md`](./roadmaps/buttons-and-digital-inputs.md)

- Modelo unificado de ButtonNode/SwitchNode/Sensores digitais.
- Integração com `SimulationEngine.externalDigitalWrite` e `useSimulationStore`.
- Suporte a `digitalRead()` no CodeParser (if/else simples e múltiplos botões/LEDs).
- Roadmap separado para perfis Maker, Comercial e Industrial.

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
