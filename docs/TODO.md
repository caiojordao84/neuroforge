# DendriForge — Master TODO List

Este documento é o guia operacional e tático de desenvolvimento, diretamente mapeado com as Fases do `implementation_plan_ensaio.md`.

---

## 🏗️ Fase A — Core e Fundações (Arquitetura Multi-Processo)
> **Foco:** Criar a espinha dorsal imune a falhas, unindo Python e Rust sem gargalos no GIL.

- [x] **A.1 Setup do Monorepo e Packaging:** Configurar pacotes segregados (Maturin para Rust, framework padrão para Python).
- [x] **A.2 Exorcismo do WASM:** Remover dependências `js-sys`, `web-sys` e preparar compilação condicional nativa.
- [x] **A.3 Integração PyO3:** Criar extensão nativa `neuroforge_core` com `py.allow_threads()` para libertação do GIL.
- [x] **A.4 Barramento ZeroMQ (ZMQ):** Implementar comunicação interprocessos (Broker no FastAPI ↔ Workers Rust/Python).
- [x] **A.5 Orquestração Assíncrona:** Configurar `asyncio` no Processo A (FastAPI) para gerir sessões e filas de mensagens.
- [x] **A.6 Base de Dados Base:** Setup do PostgreSQL (Cloud) / SQLite (Desktop) usando SQLAlchemy/SQLModel.
- [x] **A.7 Sistema de Plugins:** Implementar interface `DendriPlugin` com declaração obrigatória de "Target Process".

---

## 🧠 Fase B — ASL e Transpilação
> **Foco:** O "Esperanto" do código. A árvore de sintaxe abstrata (AST) que unifica Ladder, ST, C++ e Python.

- [x] **B.1 Especificação ASL:** Redigir o `ASL_SPEC.md` definindo a estrutura formal do Intermediate Representation (IR).
- [ ] **B.2 Refatorização de Parsers (Tier 1):** Validar ingestão nativa de C/C++ (Arduino), MicroPython e Rust via ASL.
- [ ] **B.3 Parser Industrial (Tier 1):** Refinar parser de Structured Text (IEC 61131-3) e linguagens PLCopen XML.
- [ ] **B.4 Otimizador ASL:** Implementar dead-code elimination e constant folding no Rust.
- [ ] **B.5 Geradores de Código (Deploy):** Rust gerando saídas limpas de volta para C, Python, ST e LLVM IR.
- [ ] **B.6 Golden Files Test Suite:** Garantir que 95% dos scripts fazem *round-trip* sem divergência semântica.

---

## ⚡ Fase C — Simulação (Digital, Analógica e HIL)
> **Foco:** O motor determinístico de alta performance a correr fora da main-thread.

- [x] **C.1 Motor Digital (Cérebro):** Classe stateful `AslExecutor` em memória Rust.
- [ ] **C.2 Delta Generator:** O motor Rust calcula e emite exclusivamente subamostragens JSON das alterações (Deltas).
- [ ] **C.3 Motor Analógico Isolado:** Setup do worker Ngspice em processo separado via ZMQ, com *Degraded Mode fallback*.
- [ ] **C.4 Hardware in the Loop (HIL):** Workers `asyncio` para I/O (`pyserial`, `pymodbus`, `python-snap7`).
- [ ] **C.5 API de Orquestração (WebSockets):** Rota pass-through no FastAPI para escutar ZMQ e fazer fan-out de Deltas para a UI.

---

## 🛠️ Fase D — The Schemasmith (Ferramenta Interna)
> **Foco:** A ferramenta de criação de componentes (`.toon` + `.svg`).

- [ ] **D.1 JSON Schema Final:** Consolidar o schema dos ficheiros TOON.
- [ ] **D.2 Validação Estática:** Implementar regras de colisão, consumos de corrente máxima e verificação de pinos virtuais.
- [ ] **D.3 Schemasmith App:** Adaptar a UI do Schemasmith para exportar pares perfeitos TOON/SVG para a pasta `core`.

---

## 📦 Fase E — Bibliotecas de Base (The Payload)
> **Foco:** Alimentar o simulador com hardware real.

- [ ] **E.1 MCU Profiles:** Arduino Uno, ESP32, Raspberry Pi Pico.
- [ ] **E.2 PLC Profiles:** Siemens S7-1200, Beckhoff CX, Allen-Bradley Micro820.
- [ ] **E.3 Componentes Ativos/Passivos:** Sensores industriais (4-20mA), atuadores, botões industriais e eletrónica base.
- [ ] **E.4 ASL Standard Library:** Timers (TON, TOF), PID, contadores e blocos de *motion control*.

---

## 🖥️ Fase F — Web Product (Cloud & Edição)
> **Foco:** O portal unificado acessível via browser.

- [ ] **F.1 Auth e Gestão:** Autenticação JWT, gestão de sessões multitenant.
- [ ] **F.2 Editor UI:** Integrar Monaco Editor (C++/Python/Rust) e canvas visual para Ladder.
- [ ] **F.3 O "Dumb Client" (Renderização):** Konva.js/Vanilla JS desenha o SVG e reage **apenas** aos Deltas JSON a 60fps. Zero física no browser.
- [ ] **F.4 Validação Optimista UI:** "Snapping" elétrico instantâneo baseado no ficheiro TOON em cache no browser.
- [ ] **F.5 Integração WebSerial/WebUSB:** Permitir flash de hardware direto do Chromium (ESP32/Arduino).

---

## 💻 Fase G — Desktop App (A Experiência Industrial)
> **Foco:** O "Carro-Chefe" para chão de fábrica, com suporte offline total.

- [ ] **G.1 Tauri Shell:** Empacotar a interface Web num contentor desktop leve.
- [ ] **G.2 ZMQ Local Setup:** O Desktop corre os motores PyO3/Ngspice diretamente no SO do utilizador.
- [ ] **G.3 Deploy Físico Nativo:** Integração via subprocessos com `avrdude`, `esptool` e `dfu-util`.
- [ ] **G.4 Toolchain de Packaging:** Configuração de geradores de instaladores (NSIS para Windows, AppImage Linux) com *Notarization* da Apple (dylibs injetadas).

---

## 📱 Fase H — Mobile App (O Monitor de Bolso)
> **Foco:** Interface HMI e telemetria.

- [ ] **H.1 PWA / Capacitor Setup:** Reutilizar a base da UI Web para compilação mobile.
- [ ] **H.2 View-Only Mode:** Otimizar o *Delta-streaming* para redes 4G instáveis.
- [ ] **H.3 Fallback UI:** Editor Blockly para ecrãs pequenos e direcionamento de lógicas avançadas para o Desktop.

---

## 💾 Fase I — Storage e Colaboração
> **Foco:** A gestão de estado e ficheiros entre as plataformas.

- [ ] **I.1 Virtual File System (VFS):** API de persistência agnóstica (sqlite local vs cloud storage).
- [ ] **I.2 Gestão de Conflitos:** Implementar lock de sessão ou merging semântico de diagramas baseados em texto.
- [ ] **I.3 Packaging:** Geração e importação de ficheiros `.dfpack` (projetos) e `.dfsnap` (estados de simulação).

---

## 🤖 Fase J — AI Assistant (The Visual Tutor)
> **Foco:** O copiloto inteligente contextualizado pela AST e Hardware.

- [ ] **J.1 Integração de Providers:** Suporte BYOK (Bring Your Own Key) para OpenAI, Anthropic ou LLMs locais via Ollama.
- [ ] **J.2 Prompt Hydration:** Injetar o ASL, mapa de pinos do TOON atual e erros de compilador automaticamente no contexto do LLM.
- [ ] **J.3 Autocorreção ASL:** O motor tenta compilar o código sugerido pela IA *antes* de o apresentar ao utilizador.

---

## 🛡️ Fase K — Beta Testing e QA Final
> **Foco:** Esmagar bugs antes de qualquer lançamento público.

- [ ] **K.1 QA de Performance:** Validar métrica de "≤ 16ms por tick" e "≤ 500 componentes visíveis a 60fps" no "Dumb Client".
- [ ] **K.2 Resilience Testing:** Matar o processo ZMQ do Ngspice intencionalmente e validar a ativação suave do *Degraded Mode* digital.
- [ ] **K.3 Telemetry & Logs:** Monitorização silenciosa de falhas no motor de transpilação.
- [ ] **K.4 Onboarding Tests:** Validar o wizard inicial e o tutorial do primeiro circuito LED Pisca.