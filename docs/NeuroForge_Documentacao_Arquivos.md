# NeuroForge - Documentação Detalhada de Arquivos e Arquitetura

Este documento mapeia **todos** os arquivos do projeto NeuroForge, detalhando suas utilizações, funções centrais, pipelines de processamento e dependências. Ele também estabelece o plano de refatoração, listando os arquivos experimentais de saída que devem ser deletados e os testes que devem ser transferidos para uma pasta dedicada (`tests/`).

---

## 1. Visão Geral e Arquitetura

**NeuroForge** é um ambiente de programação visual e simulação baseado na web para sistemas embarcados (Arduino, ESP32, Raspberry Pi Pico). Ele suporta a transcrição e execução de fluxos lógicos multimodais:
- **Texto (Código):** C/C++, MicroPython, Rust.
- **Visual:** Diagramas de Blocos (Blockly) e Fluxogramas (React Flow).

A arquitetura usa o `web-tree-sitter` para gerar Abstract Syntax Trees (ASTs) universais que são convertidas em uma representação intermediária (**ASL - Abstract Syntax Language**). A ASL pode ser executada num simulador simulado no frontend (`SimulationEngine`) ou transpilada de volta para linguagens de hardware.

---

## 2. Arquivos de Configuração (Raiz)

| Arquivo                          | Utilização e Função                                                                           | Dependências Principais                          |
| -------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `package.json`                   | Gerencia os scripts de build, dependências de runtime e dev do monorepo React/Vite.           | React 19, Zustand, Radix UI, Monaco, Tree-sitter |
| `vite.config.ts`                 | Configuração do empacotador Vite. Define os caminhos falsos (aliases como `@/`) e os plugins. | Vite, `@vitejs/plugin-react`                     |
| `tsconfig.*.json`                | Arquivos de configuração do TypeScript limitando a tipagem (usando ES2022 e ESNext).          | TypeScript 5.7                                   |
| `eslint.config.js`               | Configuração do linter em arquivos JS/TS para manter a padronização do projeto.               | ESLint 9                                         |
| `tailwind.config.js` / `postcss` | Regras de estilização do Tailwind, configurações de cores, animações e plugins adicionais.    | Tailwind CSS 3.4                                 |
| `components.json`                | Registra e configura componentes baseados no framework *shadcn/ui*.                           | Radix UI                                         |

---

## 3. Código Fonte - Interface e Estado (`src/`)

### 3.1. Componentes React (`src/components/`)
A interface de usuário é altamente modular, controlando abas de código, simulação, visualização serial e canvas de diagramação.

* **Main App & Layout**:
  * `App.tsx`: Inicializa a IDE, o sistema de arquivos, o motor unificado e o sistema QEMU. Depende fortemente das Stores Zustand.
  * `LeftSidebar.tsx`, `TopToolbar.tsx`, `FloatingWindow.tsx`: Estruturas de encapsulamento para ferramentas adjacentes (arquivos, execução).
* **Editores Multimodais**:
  * `CodeEditor.tsx` / `CodeEditorWithTabs.tsx`: Componentes de encapsulamento em volta do editor Monaco para entrada de texto C/Python/Rust.
  * `BlocklyEditor.tsx`: Carrega o ambiente de injeção Blockly, escutando as mudanças dos blocos XML e convertendo em ASL ou AST.
  * `FlowEditor.tsx`: Canvas baseado no *React Flow*. Escuta arestas e nós customizados para a criação de fluxogramas elétricos ou lógicos.
  * `ASLViewer.tsx`: Janela de modo leitura apresentando o JSON gerado pelo motor ASL a partir do código submetido.
* **Componentes Eletrônicos Simulados (`src/components/nodes/`)**:
  * Nós visuais renderizados na placa (React Flow): `LEDNode.tsx`, `ButtonNode.tsx`, `PotentiometerNode.tsx`, `ServoNode.tsx`, `RGBLEDNode.tsx`, `MCUNode.tsx`.
* **Painéis de Propriedade**:
  * `LEDPropertiesPanel.tsx`, `ButtonPropertiesPanel.tsx`, etc., responsáveis por alterar o estado dos pinos atrelados no `SimulationEngine`.

### 3.2. Gerenciamento de Estado (`src/stores/`)
Todos os stores usam **Zustand** para gerenciamento de estado global sem props drilling.
* `useSimulationStore.ts`: Guarda o estado lógico das placas conectadas, pinos (HIGH/LOW/PWM) e dados do motor ASL (rodando/parado).
* `useFileStore.ts`: Sistema virtual de arquivos (arquivos abertos, conteúdo dos arquivos).
* `useSerialStore.ts`: Mantém o histórico do buffer serial exibido pelos monitores.
* `useQEMUStore.ts`: Controla as máquinas virtuais remanescentes no Backend, recebendo estado dos GPIOs pela rede.
* `useUIStore.ts` / `useConnectionStore.ts`: Estado puramente da interface visual (temas, abas focadas).

---

## 4. Código Fonte - Motor de Lógica (Engine) (`src/engine/`)

### 4.1. Core Simulation (`src/engine/`)
* **`SimulationEngine.ts`**: Coração do frontend. Mantém registros atualizados de pinos reais, relógios temporais (`millis`, `delay`), executa operações I/O e emite alertas visuais para a UI através da subscrição (`emit('pinMode', ...)`).
* **`CodeParser.ts`**: Sistema tradicional baseado em Expressão Regular de parsing. Serve a lógica simples legada (C/Python) antes de cair na pipeline pesada de compilação da infra ASL.
* **`QEMUSimulationEngine.ts` / `QEMURunner.ts`**: Motores remotos integrando sockets WebRTC/WS com hardware virtual emulado pelo backend.

### 4.2. Pipeline ASL (Abstract Syntax Language) (`src/engine/asl/`)
A ASL (Abstract Syntax Language) é a espinha dorsal de compilação cruzada do NeuroForge.

* **Tipos e Execução Constante**:
  * `ASLTypes.ts`: Define a tipagem exata dos comandos transversais suportados (ex: `ASLIf`, `ASLWhile`, `ASLDigitalWrite`, `ASLTimerTON`, IEC Triggers).
  * `ASLExecutor.ts`: Iterador de ambiente assíncrono. Substitui o avaliador natural do browser, iterando lentamente linha a linha sobre um programa `ASLType` respeitando o Virtual Time (`delay`, `PWM`, `I2CBus`).
* **Compilação e Transformação**:
  * `TreeSitterLoader.ts` / `LanguageRegistry.ts`: Responsáveis por carregar pesadamente bibliotecas Wasm do `web-tree-sitter` (Rust, C, Python).
  * `astNormalizer.ts`: Normalizador que esconde diferenças cruas nos ASTs de Python, Rust e C para uma mesma árvore homogênea (tipo "if", "for", "block").
  * **`transforms/`** (`exprTransform.ts`, `blockTransform.ts`, `callTransform.ts`, `statementRegistry.ts`): Componentes fundamentais que mapeiam "Call: *delayMicroseconds*" ou "PWMInit" em chamadas atômicas ASL. Destacam mapeamentos de High-Level para chamadas abstraídas de hardware.
* **Plugins de Geradores de Código Visuais e Linguagens (`plugins/`)**:
  * `CParser.ts / CGenerator.ts`: Compiladores C++. O `Generator` tem a robustez injetiva de bibliotecas ("shims") e inferência de tipos em `forIn`.
  * `PythonParser.ts / PythonGenerator.ts`: Adaptadores MicroPython.
  * `RustParser.ts / RustGenerator.ts`: Adaptadores Rust (`no_std`).
* **Emuladores de Bibliotecas Virtuais (`shims/`)**:
  * Diretórios `plugins/c/shims`, `plugins/python/shims` contendo `display` (LCD I2C, displays 7 segmentos), `input` (Keypad Matrix), `memory` (EEPROM virtual). Estas são as interfaces de proxy transpiladas pela análise.

### 4.3. Pipeline Blockly (`src/engine/blockly/`)
* **`BlocklyParser.ts`**: Transcreve árvores XML vindas do workspace visual Blockly para instâncias ASL diretas.
* **`CodeToBlockly.ts`**: Uma ponte retroativa ("Roundtrip") complexa: Pega um `AST Node` (C/Python) normalizado e escreve XML para ser hidratado no Editor Visual.
* **`BlocklyToASL.ts`**: Simplifica conexões da infra Blockly genérica da engine em componentes.

### 4.4. Pipeline React Flow (`src/engine/flow/`)
* **`CfgBuilder.ts`**: (Control Flow Graph Builder) Cria nós (`CfgBlock`) com laços de alcançabilidade DFS, identifica dead code, ciclos fixos (For, While, Do-While) baseados em geometria e ligações das arestas.
* **`FlowToAst.ts`**: Mapeador semântico: Pega o Grafo Direcionado preenchido de um frontend lógico e transcreve para código AST padronizado.
* **`FlowValidator.ts`**: Dispara detecção de Missing Start/End, ou bifurcações cegas (`CRITICAL / WARNING`) e interrompe compilações com loops infinitos desancorados.

---

## 5. Serviços e Backend (`src/services/` e `server/`)

### 5.1. Front-end Services
* **`QEMUApiClient.ts` / `QEMUWebSocket.ts`**: Clientes assíncronos que conectam pontes REST / WS para enviar binários HEX ou compilar projetos à distância (`Compile → Run QEMU → Stream Serial Logs`).

### 5.2. Infraestrutura Backend Node (`server/`)
Um microserviço robusto rodando hardware-in-the-loop virtual (QEMU & arduino-cli).
* **`CompilerService.ts`**: Orquestra comandos shell do `arduino-cli` com profiles customizados mapeados em `server/cores/neuroforge_qemu/boards.txt`.
* **`Esp32Backend.ts` / `Esp32SerialClient.ts`**: Lidam de maneira exclusiva e agressiva com as rotas seriais de microcontroladores específicos (ESP32). Emitindo binário e protocolando saídas.
* **Cores Customizados (`server/cores/...`)**: Variáveis falsas de ambiente e "Time.h/GPIO.h" injetados na compilação que convertem manipulação de bit shifting do chip virtual em logs UDP para o WebSocket do cliente capturar.

---

## 6. Scripts Auxiliares (`bin/` & `scripts/`)
Possuem scripts cruciais para desenvolvedores (powershell, python, bash) e geração de logs para agentes ou backups CI/CD.
* `generate-tree.ps1` / `tree_project.py`
* `diagnose-arduino-gpio.ps1`
* `install_qemu_avr.ps1` (Setup de container QEMU local).

---

## 7. Sumário de Pipelines

1. **Text-to-Sim**: `Monaco Editor (C/Py)` -> `Parser (CParser)` -> `Normalizer` -> `Transforms/CodeToASL` -> `ASLExecutor` -> `SimulationEngine` -> `UI (LED pisca)`.
2. **Block-to-Sim**: `Blockly XML` -> `BlocklyParser / BlocklyToASL` -> `ASLExecutor`.
3. **Sim-to-Code**: `Motor ASL unificado` -> `Generator (ex: PythonGenerator)` -> `Text`.
4. **Flow-to-Sim**: `Node Graph` -> `CfgBuilder` (Validates Loops) -> `FlowToAst` -> `AST Normalizer` -> `Transforms` -> `ASLExecutor`.
5. **Real-world Backend**: `Monaco Editor Text` -> `CompilerService` -> `arduino-cli` -> Emite `firmware.elf` -> `QEMU Runner VM` -> `UDP/WebSocket stream` -> Frontend `SimulationEngine`.

---
