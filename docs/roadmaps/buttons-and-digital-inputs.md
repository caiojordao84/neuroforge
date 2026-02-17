# Buttons & Digital Inputs - Roadmap

## ✅ Objetivo

Definir um modelo unificado de entradas digitais (botões, chaves, sensores on/off) na NeuroForge, cobrindo o fluxo completo **Componente Visual → Pino Digital → Firmware (`digitalRead`) → Lógica → Outputs/UI**, tanto em simulação JS quanto em backends QEMU.

---

## Parte 1: Modelo de Entrada Digital (Frontend)

### PR 1.1 – Modelo base de ButtonNode ✅

**Status**: Completo  
**Arquivos**: `src/components/nodes/ButtonNode.tsx`, `src/components/panels/ButtonPropertiesPanel.tsx`, `src/stores/useConnectionStore.ts`

**Implementado**:

- ButtonNode como entrada digital momentânea:
  - Estado interno `pressed` controlado por eventos de mouse/touch.
  - Propriedades configuráveis no painel (label, debounce, pull resistor).
- Resolução de `connectedPin`:
  - Usa `useConnectionStore` para inspecionar a conexão do handle `signal`.
  - Extrai o identificador do pino (ex.: `D2`, `D3`) e converte para número inteiro.
- Integração com SimulationEngine:
  - Em cada transição de estado (press/release), chama `simulationEngine.externalDigitalWrite(connectedPin, HIGH/LOW)`.
  - Escolha de HIGH/LOW respeita `pullResistor` (NONE, PULLUP, PULLDOWN) + lógica active-high padrão.

**Próximos passos**:

- Expor mais presets de comportamento (momentary, toggle, latch).
- Melhorar visual para indicar claramente estado press/release e posição de “descanso” (especialmente para industrial).

---

### PR 1.2 – Modelo de SwitchNode (chave estável) 📝 Planejado

**Status**: Planejado  
**Descrição**: Generalizar o modelo do ButtonNode para componentes de chave ON/OFF (toggle) com estados estáveis.

**Planejado**:

- Criar `SwitchNode`:
  - Dois estados estáveis (ON/OFF), com visual tipo rocker/slider.
  - Propriedades: `initialState`, `activeLevel` (HIGH/LOW), `pullResistor`.
- Mesmo contrato de resolução de pino:
  - Usa `useConnectionStore` + handle `signal` para encontrar `connectedPin`.
- Integração com SimulationEngine:
  - Ao mudar ON→OFF ou OFF→ON, emite `externalDigitalWrite(pin, HIGH/LOW)` uma vez (sem repetição contínua).
- Suporte a perfis:
  - Perfil “Maker” (simples ON/OFF).
  - Perfil “Comercial” (interruptores de luz / painel).
  - Perfil “Industrial” (chaves de seleção com rótulos, exemplo: AUTO / MAN / OFF).

---

### PR 1.3 – Sensores Digitais (limit switch, reed, etc.) 📝 Planejado

**Status**: Planejado

**Objetivo**:

- Criar uma família de componentes visuais que expõem **saídas digitais binárias** (0/1) mas com semântica específica (fim de curso, porta aberta, presença, etc.).

**Planejado**:

- Nodes base: `LimitSwitchNode`, `ProximitySensorNode`, `DoorSensorNode`.
- Todos seguem o mesmo contrato:
  - Um output `signal` que dirige um `connectedPin`.
  - Mudança de estado chama `externalDigitalWrite` com HIGH/LOW.
- Modelos de acionamento:
  - Manual (UI do simulador).
  - Scripted (por tempo, ciclo, ou entrada de outros sinais).

---

## Parte 2: Integração com SimulationEngine e Pin Store

### PR 2.1 – externalDigitalWrite unificado ✅

**Status**: Completo  
**Arquivos**: `src/engine/SimulationEngine.ts`, `src/stores/useSimulationStore.ts`

**Implementado**:

- Método `SimulationEngine.externalDigitalWrite(pin, value)`:
  - Chama `useSimulationStore.getState().digitalWrite(pin, value)`.
  - Atualiza cache interno de pinos (`pinCache`).
  - Emite `pinChange` para todos os listeners no frontend.
- Semântica:
  - Não depende do firmware ter chamado `pinMode(pin, INPUT/INPUT_PULLUP)` para funcionar.
  - Permite simular entradas “vindas de fora” mesmo que o sketch do usuário não esteja perfeito ainda.

**Impacto**:

- Botões, chaves e sensores visuais podem dirigir pinos de entrada de forma consistente.
- `digitalRead(pin)` no interpretador JS/C++ passa a enxergar esse estado imediatamente.

---

### PR 2.2 – Coerência digitalWrite/digitalRead no useSimulationStore ✅

**Status**: Completo  
**Arquivos**: `src/stores/useSimulationStore.ts`

**Implementado**:

- Armazenamento de pinos:
  - `pins: Map<number, PinState>` com `{ pin, mode, value }`.
- Escrita digital:
  ```ts
  digitalWrite: (pin, value) => {
    set((state) => {
      const pinState = state.pins.get(pin);
      const newPins = new Map(state.pins);
      newPins.set(pin, {
        pin,
        mode: pinState?.mode ?? 'OUTPUT',
        value,
      });
      return { pins: newPins };
    });
  },
  ```
- Leitura digital:
  ```ts
  digitalRead: (pin) => {
    const pinState = get().pins.get(pin);
    if (!pinState) return 'LOW';
    if (typeof pinState.value === 'number') {
      return pinState.value > 127 ? 'HIGH' : 'LOW';
    }
    return pinState.value;
  },
  ```

**Semântica**:

- Qualquer chamada a `digitalWrite` (seja do firmware, seja de `externalDigitalWrite`) atualiza o estado único do pino.
- `digitalRead` devolve HIGH/LOW de forma determinística em cima desse valor, sem bloquear por `mode`, o que simplifica a simulação de entradas digitais.

---

### PR 2.3 – Compatibilidade JS Runtime vs QEMU 📝 Planejado

**Status**: Planejado

**Objetivo**:

- Garantir que o mesmo modelo de `externalDigitalWrite` e de leitura de pinos funcione:
  - No interpretador JS (modo “MCU JS”).
  - Em modo QEMU, recebendo GPIO real via protocolo Serial (`G:pin=...`).

**Planejado**:

- Mapa de origem do estado do pino:
  - Flag interna indicando última origem (firmware/QEMU vs externo).
  - Estratégia de “última escrita vence” ou de prioridade configurável por modo de simulação.
- Documentação de casos:
  - Inputs controlados apenas pelo usuário (simulação pura, sem QEMU).
  - Inputs provenientes de hardware/QEMU (pino dirigido pelo firmware).
  - Mistos (por exemplo, sinal de E-stop vindo de componente visual, enquanto QEMU dirige outros pinos).

---

## Parte 3: Integração com CodeParser (C++)

### PR 3.1 – Suporte a digitalRead/if/else ✅

**Status**: Completo  
**Arquivos**: `src/engine/CodeParser.ts`

**Implementado**:

- Variáveis:
  - Mapas separados de `globalVariables` e `localVariables`.
  - Resolução de símbolos (`resolveVariable`) entende:
    - Globais/locais.
    - Constantes `HIGH`, `LOW`, `true`, `false`.
    - Literais numéricos.
- Expressões:
  - `evaluateExpression(expr)` com suporte a:
    - `digitalRead(pin)` (via `simulationEngine.digitalRead(pin)`).
    - `analogRead(pin)`.
    - Comparações `==` e `!=` entre subexpressões simples.
- Controle de fluxo:
  - Stack `executionStack` controlando blocos `if { ... } else { ... }`.
  - Só executa linhas dentro de blocos cujo `if` / `else` está ativo.

**Resultado**:

- Sketches como `Teste_2Botoes_2LEDs.ino` funcionam corretamente:
  - `digitalRead(btn1Pin)` e `digitalRead(btn2Pin)` refletem o estado vindo de ButtonNode.
  - `if (btn1State == HIGH)` e `if (btn2State == HIGH)` disparam `digitalWrite` apenas quando os botões estão realmente pressionados.

---

### PR 3.2 – Padrões de uso recomendados 📝 Planejado

**Status**: Planejado

**Objetivo**:

- Documentar padrões “bons” para makers, comercial e industrial, com base nas capacidades atuais do CodeParser.

**Planejado**:

- Padrão Maker:
  - Botão com `pinMode(pin, INPUT_PULLUP)` + `if (digitalRead(pin) == LOW)` (botão para GND).
- Padrão Comercial:
  - Botões com debounce no código e histerese simples.
  - Múltiplos botões controlando cenas (ex.: liga/desliga conjuntos de LEDs/relés).
- Padrão Industrial:
  - Dois botões de segurança (two-hand control) exigindo ambos HIGH em janela de tempo.
  - Entradas redundantes (ex.: dois sensores para validar posição de um atuador).

---

### PR 3.3 – Suporte a interrupções e callbacks 📝 Futuro

**Status**: Futuro

**Descrição**:

- Explorar um modelo simplificado de interrupções (ex.: `attachInterrupt(digitalPinToInterrupt(pin), ...)`) dentro do interpretador, pelo menos para casos educacionais.
- Mapear isso para eventos no SimulationEngine, mantendo compatibilidade razoável com Arduino clássico.

---

## Parte 4: Perfis de Uso (Maker, Comercial, Industrial)

### PR 4.1 – Presets de Entrada Digital para Makers 📝 Planejado

**Status**: Planejado

**Objetivo**:

- Tornar fácil criar circuitos clássicos de Arduino com botões e chaves.

**Planejado**:

- Presets no ButtonNode:
  - “Botão simples (active HIGH)”.
  - “Botão com pull-up interno (active LOW)”.
- Wizards:
  - Assistente que cria automaticamente:
    - ButtonNode, ligação para pino digital, LEDNode, sketch de exemplo (`digitalRead` + `digitalWrite`).
- Exemplos prontos:
  - `ButtonToggleLED.ino`.
  - `TwoButtonsTwoLEDs.ino` (baseado no que já usamos como teste).

---

### PR 4.2 – Painéis Comerciais (switches, keypads) 📝 Planejado

**Status**: Planejado

**Descrição**:

- Focar em cenários de automação residencial/comercial:
  - Interruptores de luz, botões de cena, teclados numéricos simples.

**Planejado**:

- `SwitchPanelNode`:
  - Grupo de 2–8 switches, cada um mapeado para um pino digital.
- `KeypadNode` (modo digital):
  - Matrizes de botões (por exemplo, 3x4) com mapeamento de linha/coluna abstraído para o usuário iniciante.
- Integração com CodeParser:
  - Exemplos de sketch mostrando leitura de múltiplos inputs para controlar cenários.

---

### PR 4.3 – Entradas Industriais (E-stop, safety, fim de curso) 📝 Futuro

**Status**: Futuro

**Objetivo**:

- Modelar componentes clássicos de painéis industriais como entradas digitais:
  - Botões de parada de emergência (E-stop).
  - Sensores de fim de curso.
  - Chaves de porta de segurança.

**Planejado**:

- Nodes:
  - `EStopNode` (normalmente fechado, active-low).
  - `LimitSwitchNode` (fim de curso mecânico).
  - `SafetyDoorNode` (porta aberta/fechada).
- Semântica:
  - Perfil elétrico pré-definido (NO/NC, active-high/low).
  - Documentação clara de comportamento esperado no firmware (como tratar falhas abertas/curtas em simulação).

---

## Parte 5: Testes, Telemetria e Automação

### PR 5.1 – Testes automatizados de entradas digitais 📝 Planejado

**Status**: Planejado

**Objetivo**:

- Garantir que regressões no CodeParser, SimulationEngine ou components não quebrem o pipeline de entrada digital.

**Planejado**:

- Suíte de testes:
  - Casos para 1 botão / 1 LED.
  - Casos para 2 botões / 2 LEDs (como `Teste_2Botoes_2LEDs.ino`).
  - Casos com múltiplos estados e debounces.
- Harness:
  - Scripts que simulam cliques em ButtonNode via API de testes.
  - Verificação de estados de pinos e outputs esperados no frontend.

---

### PR 5.2 – Telemetria de entradas digitais 📝 Futuro

**Status**: Futuro

**Descrição**:

- Expor métricas sobre uso de botões e entradas:
  - Número de acionamentos.
  - Duty cycle (tempo em HIGH vs LOW).
  - Sequências típicas de operação (para análise de UX e safety).

---

## 📊 Status Summary

| PR  | Descrição                                              | Status         |
|-----|--------------------------------------------------------|----------------|
| 1.1 | Modelo base de ButtonNode                              | ✅ Completo    |
| 1.2 | Modelo de SwitchNode                                   | 📝 Planejado   |
| 1.3 | Sensores digitais (limit, reed, etc.)                  | 📝 Planejado   |
| 2.1 | `externalDigitalWrite` unificado                       | ✅ Completo    |
| 2.2 | Coerência digitalWrite/digitalRead no store            | ✅ Completo    |
| 2.3 | Compatibilidade JS Runtime vs QEMU                     | 📝 Planejado   |
| 3.1 | Suporte a digitalRead/if/else no CodeParser            | ✅ Completo    |
| 3.2 | Padrões de uso recomendados                            | 📝 Planejado   |
| 3.3 | Suporte a interrupções e callbacks                     | 📝 Futuro      |
| 4.1 | Presets de entrada digital para makers                 | 📝 Planejado   |
| 4.2 | Painéis comerciais (switches, keypads)                 | 📝 Planejado   |
| 4.3 | Entradas industriais (E-stop, safety, fim de curso)    | 📝 Futuro      |
| 5.1 | Testes automatizados de entradas digitais              | 📝 Planejado   |
| 5.2 | Telemetria de entradas digitais                        | 📝 Futuro      |
