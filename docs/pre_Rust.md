# NeuroForge - Documentação de Arquivos

## Visão Geral do Projeto

NeuroForge é um ambiente de programação visual baseado na web para sistemas embarcados (Arduino, ESP32, Raspberry Pi Pico). O projeto utiliza React 19, TypeScript, Vite e tree-sitter para parsing/transpilação de código.

---

## 1. ARQUIVOS DE CONFIGURAÇÃO (Raiz)

### 1.1 Configuração Principal

| Arquivo              | Descrição                             | Dependências                                                        |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `package.json`       | Dependências npm do projeto principal | React 19, Zustand, Radix UI, Monaco Editor, tree-sitter, React Flow |
| `tsconfig.json`      | Configuração TypeScript base          | TypeScript 5.7                                                      |
| `tsconfig.app.json`  | Configuração TypeScript para app      | Herda de tsconfig.json                                              |
| `tsconfig.node.json` | Configuração TypeScript para Node     | -                                                                   |
| `vite.config.ts`     | Configuração Vite 6                   | Vite, plugin React                                                  |
| `eslint.config.js`   | Configuração ESLint 9                 | ESLint, typescript-eslint, react-hooks                              |
| `tailwind.config.js` | Configuração Tailwind CSS             | Tailwind CSS 3.4                                                    |
| `postcss.config.js`  | Configuração PostCSS                  | Autoprefixer, Tailwind                                              |
| `components.json`    | Configuração shadcn/ui                | Radix UI components                                                 |
| `.gitignore`         | Arquivos ignorados pelo Git           | -                                                                   |

### 1.2 Documentação do Projeto

| Arquivo     | Descrição                                       |
| ----------- | ----------------------------------------------- |
| `README.md` | Documentação principal do projeto               |
| `AGENTS.md` | Diretrizes para agentes de código (esta seção!) |
| `fixes.md`  | Lista de correções e issues                     |

---

## 2. CÓDIGO FONTE (src/)

### 2.1 Estrutura de Diretórios

```
src/
├── components/      # Componentes React
│   ├── ui/          # Componentes UI do shadcn
│   ├── nodes/      # Nós do React Flow
│   ├── edges/      # Arestas customizadas
│   └── *.tsx       # Componentes principais
├── engine/          # Motor de processamento
│   ├── asl/        # Sistema ASL (Abstract Syntax Language)
│   ├── blockly/    # Integração Blockly
│   ├── flow/       # Processamento de Flow
│   └── system/     # Sistema (Lexer, SymbolTable - duplicados)
├── hooks/           # React Hooks customizados
├── services/        # Serviços (QEMU API)
├── stores/          # Zustand stores (estado global)
├── lib/             # Utilitários
├── system/          # Sistema (Lexer, types - legado)
└── types/           # Definições de tipos TypeScript
```

### 2.2 Componentes React (src/components/)

| Arquivo                            | Função                                      | Dependências       |
| ---------------------------------- | ------------------------------------------- | ------------------ |
| `App.tsx`                          | Componente raiz - organiza layout principal | React Flow, stores |
| `CanvasArea.tsx`                   | Área principal de canvas                    | React Flow         |
| `CodeEditor.tsx`                   | Editor de código Monaco                     | Monaco Editor      |
| `CodeEditorWithTabs.tsx`           | Editor com abas                             | CodeEditor         |
| `BlocklyEditor.tsx`                | Editor visual Blockly                       | Blockly            |
| `FlowEditor.tsx`                   | Editor de fluxo visual                      | React Flow         |
| `SerialTerminalPanel.tsx`          | Terminal serial                             | Stores             |
| `TopToolbar.tsx`                   | Barra de ferramentas superior               | -                  |
| `LeftSidebar.tsx`                  | Barra lateral esquerda                      | -                  |
| `FloatingWindow.tsx`               | Janelas flutuantes                          | Radix UI           |
| `PropertiesPanel.tsx`              | Painel de propriedades                      | -                  |
| `ComponentsLibrary.tsx`            | Biblioteca de componentes                   | -                  |
| `LibrariesPanel.tsx`               | Painel de bibliotecas                       | -                  |
| `ASLViewer.tsx`                    | Visualizador ASL                            | Monaco Editor      |
| `SimulationModeToggle.tsx`         | Alternador modo simulação                   | -                  |
| `ButtonPropertiesPanel.tsx`        | Propriedades botão                          | -                  |
| `LEDPropertiesPanel.tsx`           | Propriedades LED                            | -                  |
| `PotentiometerPropertiesPanel.tsx` | Propriedades potenciômetro                  | -                  |
| `ServoPropertiesPanel.tsx`         | Propriedades servo                          | -                  |
| `RGBLEDPropertiesPanel.tsx`        | Propriedades RGB LED                        | -                  |
| `MCUPropertiesPanel.tsx`           | Propriedades MCU                            | -                  |
| `SerialMonitor.tsx`                | Monitor serial                              | -                  |
| `Terminal.tsx`                     | Componente terminal                         | -                  |
| `nodes/ButtonNode.tsx`             | Nó botão (React Flow)                       | React Flow         |
| `nodes/LEDNode.tsx`                | Nó LED (React Flow)                         | React Flow         |
| `nodes/PotentiometerNode.tsx`      | Nó potenciômetro                            | React Flow         |
| `nodes/ServoNode.tsx`              | Nó servo                                    | React Flow         |
| `nodes/RGBLEDNode.tsx`             | Nó RGB LED                                  | React Flow         |
| `nodes/MCUNode.tsx`                | Nó MCU                                      | React Flow         |
| `edges/ManhattanEdge.tsx`          | Aresta customizada                          | React Flow         |
| `ui/*.tsx`                         | Componentes shadcn/ui (50+ arquivos)        | Radix UI           |

### 2.3 Stores (src/stores/)

| Arquivo                 | Função                    | Estado Gerenciado           |
| ----------------------- | ------------------------- | --------------------------- |
| `useSimulationStore.ts` | Estado da simulação       | Status, pinos, MCUs, idioma |
| `useUIStore.ts`         | Estado da UI              | Tema, janelas abertas       |
| `useSerialStore.ts`     | Comunicação serial        | Buffer, baud rate           |
| `useLibraryStore.ts`    | Bibliotecas do usuário    | Bibliotecas carregadas      |
| `useFileStore.ts`       | Gerenciamento de arquivos | Arquivos do projeto         |
| `useConnectionStore.ts` | Conexões                  | Status de conexão           |
| `useQEMUStore.ts`       | Estado QEMU               | VMs, GPIO                   |

### 2.4 Hooks (src/hooks/)

| Arquivo                | Função                   |
| ---------------------- | ------------------------ |
| `useRunSimulation.ts`  | Controlador de simulação |
| `useQEMUSimulation.ts` | Integração QEMU          |
| `use-mobile.ts`        | Detecção mobile          |

### 2.5 Engine (src/engine/)

#### 2.5.1 Sistema Principal

| Arquivo                   | Função                         | Pipeline                                 |
| ------------------------- | ------------------------------ | ---------------------------------------- |
| `CodeParser.ts`           | Parse C++/Python para execução | Input → Regex Parse → Funções setup/loop |
| `SimulationEngine.ts`     | Motor de simulação             | Execução, controle pinos, serial         |
| `Transpiler.ts`           | Stub transpilação              | (não implementado)                       |
| `QEMUSimulationEngine.ts` | Motor QEMU                     | (Backend)                                |
| `QEMURunner.ts`           | Executor QEMU                  | (Backend)                                |
| `example.ts`              | Exemplo de uso                 | (legado)                                 |

#### 2.5.2 Sistema ASL (src/engine/asl/)

| Arquivo               | Função                  | Pipeline                               |
| --------------------- | ----------------------- | -------------------------------------- |
| `ASLTypes.ts`         | Definições tipos ASL    | Tipos unificados para todas linguagens |
| `ASLExecutor.ts`      | Executor ASL            | Statements → Execução                  |
| `codeToASL.ts`        | Conversor código→ASL    | Código → AST → Normalizado → ASL       |
| `transpile.ts`        | Transpilador ASL→Código | ASL → Código destino                   |
| `TreeSitterLoader.ts` | Carregador tree-sitter  | Carrega parsers C/Python/Rust          |
| `LanguageRegistry.ts` | Registro de linguagens  | Gerencia parsers disponíveis           |
| `blocklyToASL.ts`     | Blockly → ASL           | Blocos → ASL                           |
| `flowToASL.ts`        | Flow → ASL              | Nós → ASL                              |

##### Transformações ASL (transforms/)

| Arquivo                | Função                    |
| ---------------------- | ------------------------- |
| `astNormalizer.ts`     | Normaliza ASTtree-sitter  |
| `exprTransform.ts`     | Transforma expressões     |
| `blockTransform.ts`    | Transforma blocos         |
| `callTransform.ts`     | Transforma chamadas       |
| `context.ts`           | Contexto de transformação |
| `statementRegistry.ts` | Registro de statements    |
| `postfixUtils.ts`      | Utilitários postfix       |
| `index.ts`             | Export aggregated         |

##### Plugins de Linguagem (plugins/)

| Arquivo                       | Função                  |
| ----------------------------- | ----------------------- |
| `c/CParser.ts`                | Parser C/C++            |
| `c/CGenerator.ts`             | Gerador C/C++           |
| `python/PythonParser.ts`      | Parser Python           |
| `python/PythonGenerator.ts`   | Gerador Python          |
| `cpp/CppParser.ts`            | Parser C++ (específico) |
| `rust/RustParser.ts`          | Parser Rust             |
| `rust/RustGenerator.ts`       | Gerador Rust            |
| `core/ShimManager.ts`         | Gerenciador shims       |
| `analysis/PatternDetector.ts` | Detecção de padrões     |
| `optimizer/Optimizer.ts`      | Otimização ASL          |

##### Shims (plugins/*/shims/)

Shims para emulação de bibliotecas hardware:

| Arquivo                              | Função              |
| ------------------------------------ | ------------------- |
| `memory/eeprom_shim.ts`              | Emulação EEPROM     |
| `input/keypad_shim.ts`               | Emulação keypad     |
| `display/liquid_crystal_i2c_shim.ts` | Display LCD I2C     |
| `display/sevseg_shim.ts`             | Display 7 segmentos |

#### 2.5.3 Sistema Blockly (src/engine/blockly/)

| Arquivo            | Função           |
| ------------------ | ---------------- |
| `BlocklyParser.ts` | Parse Blockly    |
| `CodeToBlockly.ts` | Código → Blockly |

#### 2.5.4 Sistema Flow (src/engine/flow/)

| Arquivo            | Função         |
| ------------------ | -------------- |
| `FlowToAst.ts`     | Flow → AST     |
| `FlowValidator.ts` | Validação Flow |
| `CfgBuilder.ts`    | Construção CFG |

#### 2.5.5 Sistema (legado) (src/engine/system/)

| Arquivo          | Função                      |
| ---------------- | --------------------------- |
| `types.ts`       | Tipos (duplicado)           |
| `Lexer.ts`       | Lexer (duplicado)           |
| `SymbolTable.ts` | Tabela símbolos (duplicado) |

### 2.6 Serviços (src/services/)

| Arquivo            | Função           |
| ------------------ | ---------------- |
| `QEMUApiClient.ts` | Cliente API QEMU |
| `QEMUWebSocket.ts` | WebSocket QEMU   |

### 2.7 Utilitários (src/lib/)

| Arquivo              | Função                        |
| -------------------- | ----------------------------- |
| `utils.ts`           | Funções utilitárias (cn, etc) |
| `ledCalculations.ts` | Cálculos LED                  |

### 2.8 Tipos (src/types/)

| Arquivo                | Função                |
| ---------------------- | --------------------- |
| `index.ts`             | Definições principais |
| `web-tree-sitter.d.ts` | Tipos tree-sitter     |

---

## 3. SERVIDOR (server/)

### 3.1 Estrutura

```
server/
├── src/
│   ├── api/        # Endpoints API
│   ├── services/   # Serviços backend
│   └── types/      # Tipos
├── cores/          # Cores Arduino customizados
├── test-firmware/  # Firmwares de teste
└── scripts/        # Scripts auxiliar
```

### 3.2 Serviços Backend

| Arquivo                   | Função                  | Pipeline                |
| ------------------------- | ----------------------- | ----------------------- |
| `QEMURunner.ts`           | Execução QEMU           | Compile → Run → Monitor |
| `QEMUSimulationEngine.ts` | Motor simulação         | GPIO ←→ QEMU            |
| `QEMUMonitorService.ts`   | Monitor QEMU            | Status, GPIO            |
| `CompilerService.ts`      | Compilação              | arduino-cli integration |
| `Esp32Backend.ts`         | Backend ESP32           | Serial/GPIO             |
| `Esp32SerialClient.ts`    | Cliente serial ESP32    | -                       |
| `SerialGPIOParser.ts`     | Parser protocolo serial | -                       |

### 3.3 API

| Arquivo        | Função           |
| -------------- | ---------------- |
| `websocket.ts` | WebSocket server |
| `routes.ts`    | Rotas REST       |

---

## 4. DOCUMENTAÇÃO (docs/)

### 4.1 Documentos Técnicos

| Arquivo                      | Descrição             |
| ---------------------------- | --------------------- |
| `ROADMAP.md`                 | Roadmap do projeto    |
| `AI_ASSISTANT_CONTEXT.md`    | Contexto para IA      |
| `IMPLEMENTATION_STANDARD.md` | Padrões implementação |
| `ASL_PARSER_COMPARISON.md`   | Comparação parsers    |
| `blockly_gap_analysis.md`    | Análise gaps Blockly  |
| `boards-documentation.md`    | Documentação placas   |
| `serial-gpio-protocol.md`    | Protocolo serial/GPIO |
| `QEMU_SETUP.md`              | Setup QEMU            |

### 4.2 Arquivos de Teste (docs/)

| Arquivo                        | Descrição              |
| ------------------------------ | ---------------------- |
| `test-serial.ts`               | Teste serial           |
| `test-transpile.ts`            | Teste transpilação     |
| `test-roundtrip.ts`            | Teste roundtrip        |
| `test-rust-roundtrip.ts`       | Teste Rust roundtrip   |
| `test-chain.ts`                | Teste chain            |
| `test-combined_components.md`  | Teste componentes      |
| `test-postfix.mjs`             | Teste postfix          |
| `test-postfix.md`              | Documentação postfix   |
| `test-comments.mjs`            | Teste comentários      |
| `test-comments.cjs`            | Teste comentários C    |
| `fase5_serial_buffer_test.ts`  | Teste buffer serial    |
| `fase5_serial_buffer_test.cjs` | Teste buffer (cjs)     |
| `*.ino`                        | Sketches Arduino teste |

---

## 5. SCRIPTS (bin/)

| Arquivo                        | Função                  |
| ------------------------------ | ----------------------- |
| `tree_project.py`              | Geração árvore projeto  |
| `generate-tree.ps1`            | Script PowerShell tree  |
| `generate-tree-json.ps1`       | Script tree JSON        |
| `Generate-NeuroForge-Tree.ps1` | Geração tree NeuroForge |

---

## 6. ARQUIVOS DE TESTE/DESENVOLVIMENTO (Raiz)

### 6.1 Arquivos de Teste para Transferir para tests/

```
NOTA: Estes arquivos devem ser movidos para uma pasta 'tests/' antes de deletar da raiz
```

| Arquivo                   | Descrição            |
| ------------------------- | -------------------- |
| `test-asl.ts`             | Teste ASL            |
| `test-asl-standalone.cjs` | Teste ASL standalone |
| `test-flow.ts`            | Teste Flow           |
| `test_ast_debug.ts`       | Debug AST            |
| `test_led_transpile.ts`   | Teste transpile LED  |
| `test_user_sketch.ts`     | Teste sketch usuário |
| `test_python_loops.ts`    | Teste loops Python   |
| `test_fixtures.ts`        | Fixtures de teste    |
| `test_timing.ts`          | Teste timing         |
| `test_timing.js`          | Teste timing (JS)    |
| `test_ts.cjs`             | Teste TS             |
| `debug_ast.ts`            | Debug AST            |

### 6.2 Arquivos de Saída/Log (Deletar)

```
NOTA: Estes arquivos são saídas de testes anteriores e podem ser deletados
```

| Arquivo                     | Descrição                                     |
| --------------------------- | --------------------------------------------- |
| `step1_ast.json`            | Output teste AST                              |
| `step2_normalized.json`     | Output normalização                           |
| `step3_asl.json`            | Output ASL                                    |
| `flow-output.json`          | Output Flow                                   |
| `flow-output-utf8.json`     | Output Flow UTF8                              |
| `flow-output-full.json`     | Output Flow completo                          |
| `out.txt`                   | Output geral                                  |
| `out2.txt`                  | Output 2                                      |
| `out3.txt`                  | Output 3                                      |
| `test_output.txt`           | Output testes                                 |
| `test_out.txt`              | Output teste                                  |
| `test_results_clean.txt`    | Resultados limpos                             |
| `test_results_final.txt`    | Resultados finais                             |
| `test_results_ultimate.txt` | Resultados finais                             |
| `test_errors.txt`           | Erros teste                                   |
| `test_errors_ascii.txt`     | Erros ASCII                                   |
| `test_serial_output.txt`    | Output serial                                 |
| `serial_test_results.txt`   | Resultados serial                             |
| `all_symbols.txt`           | Símbolos todos                                |
| `boot_disasm.txt`           | Disassembly boot                              |
| `boot_disasm_ascii.txt`     | Disassembly ASCII                             |
| `disassembly.txt`           | Disassembly                                   |
| `disassembly_ascii.txt`     | Disassembly ASCII                             |
| `renode_types.txt`          | Tipos Renode                                  |
| `renode_types_full.txt`     | Tipos Renode full                             |
| `cpu_help.txt`              | Help CPU                                      |
| `file_list.txt`             | Lista arquivos                                |
| `file_list_filtered.txt`    | Lista filtrada                                |
| `tsc_errors.txt`            | Erros TypeScript                              |
| `log_sketch_critical.md`    | Log sketch                                    |
| `sketch_critical.ts`        | Sketch crítico                                |
| `sketch_critical.cjs`       | Sketch crítico (cjs)                          |
| `fix_parser.js`             | Parser fix                                    |
| `fix_parser2.js`            | Parser fix 2                                  |
| `verify-fix.js`             | Verificação fix                               |
| `verify-types.js`           | Verificação tipos                             |
| `tmp_check.js`              | Check temporário                              |
| `debug_ast.ts`              | Debug AST                                     |
| `install-deps.ps1`          | Install deps (raiz - verificar se necessária) |
| `install-deps.sh`           | Install deps shell                            |

---

## 7. PIPELINES DE PROCESSAMENTO

### 7.1 Pipeline de Código → Simulação

```
Código (C++/Python)
       ↓
  CodeParser.ts (regex-based)
       ↓
  Funções setup/loop
       ↓
  SimulationEngine.ts
       ↓
  Execução (pinos, serial)
```

### 7.2 Pipeline ASL (Novo)

```
Código Fonte (C/Python/Rust)
       ↓
  TreeSitterLoader.ts (carrega parser)
       ↓
  CParser/PythonParser/RustParser (tree-sitter)
       ↓
  astNormalizer.ts (normaliza AST)
       ↓
  Transforms (expr, block, call)
       ↓
  ASL (Intermediate Representation)
       ↓
  CGenerator/PythonGenerator/RustGenerator
       ↓
  Código Destino
```

### 7.3 Pipeline Visual

```
Flow (React Flow) ←→ Blockly ←→ Código
       ↓                    ↓
  FlowToAst.ts        CodeToBlockly.ts
       ↓                    ↓
  FlowValidator.ts    BlocklyParser.ts
       ↓                    ↓
  AST/Normalized ←→ ASL ←→ Normalized
```

### 7.4 Pipeline QEMU

```
Código C++
       ↓
  Server: CompilerService (arduino-cli)
       ↓
  QEMURunner.ts (executa VM)
       ↓
  QEMUSimulationEngine.ts (GPIO sync)
       ↓
  WebSocket → Frontend
       ↓
  useQEMUSimulation.ts → simulationEngine
```

---

## 8. DEPENDÊNCIAS EXTERNAS

### 8.1 Principais

- **React 19**: Framework UI
- **@xyflow/react** (React Flow): Editor visual de fluxo
- **@monaco-editor/react**: Editor de código
- **web-tree-sitter**: Parsing código
- **tree-sitter-cpp, -python, -rust**: Parsers específicos
- **zustand**: Gerenciamento estado
- **@radix-ui/***: Componentes UI (50+)
- **socket.io-client**: WebSocket client

### 8.2 Desenvolvimento

- **Vite**: Build tool
- **TypeScript 5.7**: Linguagem
- **ESLint 9**: Linting
- **Tailwind CSS 3.4**: Estilização
- **PostCSS**: Processamento CSS

---

## 9. DIRETÓRIOS ADICIONAIS

### 9.1 poc/ (Proof of Concept)

| Diretório/Arquivo                 | Descrição                |
| --------------------------------- | ------------------------ |
| `serial_test/serial_test.ino`     | Teste serial             |
| `gpio_test/gpio_test.ino`         | Teste GPIO               |
| `blink/blink.ino`                 | Exemplo blink            |
| `libraries/`                      | Bibliotecas customizadas |
| `libraries/NeuroForgeGPIO/`       | Biblioteca GPIO Arduino  |
| `libraries/NeuroForgeGPIO_ESP32/` | Biblioteca GPIO ESP32    |
| `run_qemu.ps1`                    | Script execução QEMU     |
| `debug_qemu.ps1`                  | Script debug QEMU        |
| `install_qemu_avr.ps1`            | Script install QEMU AVR  |
| `compile.ps1`                     | Script compilação        |
| `README.md`                       | Documentação PoC         |

### 9.2 .snapshots/ (Metadados)

| Arquivo       | Descrição       |
| ------------- | --------------- |
| `sponsors.md` | Sponsors        |
| `readme.md`   | Readme snapshot |
| `config.json` | Configuração    |

### 9.3 server/cores/ (Cores Arduino customizados)

| Arquivo                             | Descrição                     |
| ----------------------------------- | ----------------------------- |
| `neuroforge_qemu/boards.txt`        | Configuração placas           |
| `neuroforge_qemu/nf_time.*`         | Implementação NeuroForge time |
| `neuroforge_qemu/nf_gpio.*`         | Implementação NeuroForge GPIO |
| `neuroforge_qemu/README.md`         | Documentação                  |
| `install-core.ps1`                  | Script instalação core        |
| `install-core.sh`                   | Script shell instalação       |
| `NEUROFORGE_TIME_IMPLEMENTATION.md` | Documentação time             |
| `patch-wiring.ps1`                  | Patch wiring                  |

### 9.4 server/test-firmware/ (Firmwares de teste)

| Arquivo                               | Descrição          |
| ------------------------------------- | ------------------ |
| `blink.ino`                           | Blink básico       |
| `rp2040/blink/`                       | Testes RP2040      |
| `rp2040/blink/main.c`                 | Firmware principal |
| `rp2040/blink/CMakeLists.txt`         | Build config       |
| `rp2040/blink/test-*.resc`            | Scripts Renode     |
| `esp32_shim_test/esp32_shim_test.ino` | Teste shim ESP32   |
| `esp32/README.md`                     | Documentação ESP32 |
| `esp32/*.bin`                         | Binários ESP32     |

### 9.5 server/scripts/ (Scripts auxiliares)

| Arquivo                     | Descrição        |
| --------------------------- | ---------------- |
| `diagnose-arduino-gpio.ps1` | Diagnóstico GPIO |
| `fix-arduino-gpio.ps1`      | Correção GPIO    |
| `backup-cores.ps1`          | Backup cores     |
| `README.md`                 | Documentação     |

---

## 10. NOTAS ADICIONAIS

### 10.1 Arquivos .code-workspace

| Arquivo                      | Descrição             |
| ---------------------------- | --------------------- |
| `app.code-workspace`         | Workspace principal   |
| `neuroforge.code-workspace`  | Workspace alternativo |
| `neuroforge1.code-workspace` | Workspace alternativo |