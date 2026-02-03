# Roadmap NeuroForge

Este documento consolida o **roadmap macro** do projeto com os **roadmaps técnicos detalhados** que estavam espalhados em arquivos separados (raiz, `docs/`, `docs/roadmaps/`).

- Roadmap macro do produto (fases, semanas, features) – migrado do `ROOT/ROADMAP.md`.
- Roadmaps técnicos específicos (GPIO, QEMU, etc.) – mantidos em `docs/roadmaps/` e referenciados daqui.

---

## Índice rápido

- [Visão geral e fases macro](#visão-geral-e-fases-macro)
- [Roadmaps técnicos por área](#roadmaps-técnicos-por-área)
  - [GPIO via Serial (AVR/ESP32/RP2040)](#gpio-via-serial-avresp32rp2040)
  - (futuros) Tempo NeuroForge, UI Builder, PLC/SCADA, etc.

---

## Visão geral e fases macro

> Conteúdo migrado do `ROADMAP.md` na raiz do repositório. Este é o plano de alto nível de produto.

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

_(Descrição original mantida; detalhes de implementação atuais podem divergir – ver roadmaps técnicos.)_

#### Semana 1: QEMU Integration e POC
- Compilar ou configurar QEMU para rodar firmwares Arduino/ESP32/Pico
- Proof of Concept com `blink.ino`
- Verificar GPIO output via memory mapping ou Serial
- Medir performance básica

#### Semana 2: Backend de Compilação e QEMUSimulationEngine
- API/CLI de compilação para C++/MicroPython
- `QEMUSimulationEngine` substituindo SimulationEngine custom
- Carregamento de binário no QEMU
- UART redirection para Serial Monitor
- Timer configuration para simulação real-time (ou abstração via NeuroForge Time)

#### Semana 3: Multi-Board Support
- Arduino Uno (AVR)
- ESP32 (Xtensa)
- RP2040 / STM32 (ARM)
- Board Selector unificado no app

---

### FASE 2: COMPONENTES AVANÇADOS

(Displays, sensores, motores, comunicação avançada, ferramentas de debug – conteúdo detalhado mantido no roadmap original, resumido aqui em alto nível.)

- Displays: LCD 16x2, OLED 128x64, TFT ST7735.
- Sensores: DHT22, ultrassom, LDR, etc.
- Motores: DC + driver, stepper + driver.
- Comunicação multi-MCU: UART, I2C, SPI.
- Network (ESP32): WiFi virtual, MQTT, HTTP.
- Ferramentas: Serial Plotter, Logic Analyzer, Osciloscópio virtual.

---

### FASE 3: DASHBOARD BUILDER

- Grid layout responsivo tipo Home Assistant / Lovelace.
- Widgets de gauge, switch, botão, texto, gráficos.
- Binding de widgets a GPIO, Serial, variáveis globais, MQTT, HTTP.
- Engine de automação (rules, scenes, schedules).
- Export de dashboards (HTML standalone, apps móveis via Capacitor).

---

### FASE 4: INDUSTRIAL FEATURES

- Simulação de PLC (Modbus RTU/TCP, coils, registers).
- Ladder viewer/editor básico.
- SCADA dashboard com tema industrial.
- Componentes industriais (sensores, atuadores, VFD, etc.).
- Safety systems (E-stop, light curtain, safety PLC).

---

### FASE 5: POLISH E LANÇAMENTO

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

## Roadmaps técnicos por área

Aqui ficam os **roadmaps técnicos detalhados**, cada um focado numa feature/stack específica.

### GPIO via Serial (AVR/ESP32/RP2040)

Arquivo: [`docs/roadmaps/gpio-serial-protocol.md`](./roadmaps/gpio-serial-protocol.md)

- Protocolo `G:...` para reportar GPIO via Serial.
- Backend `SerialGPIOService` com interface compatível com `QEMUGPIOService`.
- Helper firmware `NeuroForgeGPIO` (AVR) e futuros helpers ESP32/RP2040.
- Roadmap de expansão multiplataforma e otimizações (rate limiting, checksum, modo binário).

### Outros roadmaps técnicos

- QEMU + memória mapeada de GPIO (AVR/ESP32) – planejado/postergado, manter em `docs/roadmaps/`.
- NeuroForge Time (clock virtual e timeline de eventos).
- UI Builder & Dashboard Builder.
- PLC/SCADA & integrações industriais.

Conforme novos roadmaps forem criados em `docs/roadmaps/*.md`, devem ser **linkados nesta seção**, mantendo este arquivo como fonte única de verdade do roadmap geral do projeto.
