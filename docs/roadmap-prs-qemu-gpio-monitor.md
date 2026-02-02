# Roadmap de PRs - GPIO Real via QEMU Monitor

Este documento descreve um mini roadmap de Pull Requests para finalizar o **FIX 2.10: GPIO Real via QEMU Monitor** e integrar o backend QEMU com o frontend da NeuroForge.

---

## PR 1 – Refinar leitura de GPIO via QEMU Monitor

**Objetivo:** Garantir que a leitura de `PORTB/PORTC/PORTD` via QEMU Monitor seja confiável e que o pino 13 alterne corretamente entre 0 e 1 durante o `gpio_test.ino`.

### Tarefas
- Ajustar `QEMURunner.processMonitorBuffer` para:
  - Considerar a resposta completa **somente** quando o buffer terminar com o prompt `(qemu) ` (não apenas quando contiver a string).
  - Limpar corretamente:
    - Linha ecoada do comando (`x/1b 0x25` etc.).
    - Prompt final `(qemu)`.
- Adicionar logs de debug opcionais para inspecionar a resposta bruta dos comandos `x/1b 0x25`, `x/1b 0x28` e `x/1b 0x2b`.
- Refinar o parser de linha em `QEMUGPIOService.readPortByte` se necessário, tratando casos como:
  - Linhas incompletas (`"(qemu) x"`, `"(qemu) x/1b"`, etc.).
  - Respostas vazias em ciclos iniciais de polling.
- Rodar `server/example-gpio.ts` usando `poc/build/gpio_test/gpio_test.ino.elf` e validar que:
  - O Serial imprime `PB5 = HIGH/LOW` continuamente.
  - Os logs mostram `[GPIO] Pin 13 changed to 1` alternando com `0`.
  - Os snapshots refletem o valor correto: `D13 = 1` quando PB5 está HIGH e `D13 = 0` quando está LOW.

### Critérios de aceite
- Nenhuma exceção durante o polling de GPIO.
- Eventos `pin-change` para o pino 13 batem com o firmware de teste (`gpio_test.ino`).
- Warnings de parse aparecem, no máximo, em condições de boot/timing, e não em regime permanente.

---

## PR 2 – Consolidar contrato do QEMUSimulationEngine para GPIO

**Objetivo:** Formalizar a API do `QEMUSimulationEngine` para GPIO, preparando o backend para ser consumido pelo servidor HTTP/WebSocket e pelo frontend.

### Tarefas
- Garantir que o `QEMUSimulationEngine`:
  - Crie internamente um `QEMURunner` e um `QEMUGPIOService` ao iniciar (`start()`).
  - Ative/pare o polling de GPIO nos eventos `started`/`stopped` do `QEMURunner`.
  - Registre listeners em `gpioService.on('gpio-changes', ...)` para:
    - Atualizar `state.gpioStates["D${pin}"]`.
    - Emitir `this.emit('pin-change', { pin, value })`.
    - Incrementar `state.cycleCount` a cada batch de mudanças.
- Confirmar e documentar a API pública do engine:
  - Métodos: `loadFirmware`, `start`, `stop`, `pause`, `resume`, `setPin`, `sendSerial`, `getState`, `getPinState`, `clearSerial`.
  - Eventos: `started`, `stopped`, `serial`, `pin-change`, `firmware-loaded`, `serial-cleared`.
- Atualizar/adição de comentários JSDoc ou documentação leve explicando:
  - Como o engine mapeia pinos Arduino ↔ PORTB/PORTC/PORTD.
  - Como o `cycleCount` pode ser usado para debugging/perf.

### Critérios de aceite
- `server/example-gpio.ts` usa apenas `QEMUSimulationEngine` (nada de acessar `QEMURunner` ou `QEMUGPIOService` diretamente) e continua funcionando.
- `getPinState(13)` retorna o último valor conhecido de D13 tanto durante o polling quanto após eventos de `gpio-changes`.

---

## PR 3 – Ponte WebSocket/HTTP entre engine e frontend

**Objetivo:** Expor o estado de GPIO e eventos de pino do `QEMUSimulationEngine` para o frontend via WebSocket e endpoints HTTP simples.

### Tarefas
- Criar (ou adaptar) um módulo de servidor que mantenha um singleton de `QEMUSimulationEngine` para o modo QEMU.
- WebSocket (ex.: via `socket.io`):
  - Ao receber `pin-change` do engine, enviar para os clientes um evento, ex.: `qemu:pin-change` com payload `{ pin, value }`.
  - Ao receber `serial` do engine, enviar `qemu:serial` com a linha.
  - Ao receber `started`/`stopped`, enviar `qemu:state` com `engine.getState()`.
  - Receber comandos do frontend, por exemplo:
    - `qemu:set-pin` → chama `engine.setPin(pin, value)`.
    - `qemu:send-serial` → chama `engine.sendSerial(data)`.
- HTTP:
  - `GET /qemu/state` → retorna `engine.getState()` para bootstrap inicial da UI.
  - Endpoints já existentes de `start/stop` devem delegar para o `QEMUSimulationEngine`.

### Critérios de aceite
- Ao iniciar uma simulação QEMU pelo frontend, o backend instancia o engine e começa a enviar eventos via WebSocket.
- É possível acompanhar, em tempo real, mudanças de pino 13 (e outros) somente ouvindo os eventos `qemu:pin-change`.
- O estado retornado por `GET /qemu/state` é consistente com o que está sendo transmitido via WebSocket.

---

## PR 4 – Integração na UI (LEDs, botões, etc.)

**Objetivo:** Conectar o frontend à nova infraestrutura QEMU, reutilizando ao máximo os componentes existentes do modo "fake".

### Tarefas
- Na store de simulação (Zustand):
  - Adicionar suporte explícito ao modo QEMU, consumindo eventos WebSocket ao invés do SimulationEngine em memória.
  - Atualizar o mapa de pinos ao receber `qemu:pin-change`.
  - Empurrar linhas para o Serial Monitor ao receber `qemu:serial`.
- Em componentes visuais (LED, botão, etc.):
  - Manter a interface baseada em eventos de `pinChange { pin, state }`, de forma que a origem (fake vs QEMU) seja transparente.
  - No caso de botões, mapear interações de UI (`mousedown`, `mouseup`) para `socket.emit('qemu:set-pin', { pin, value })` quando em modo QEMU.
- Garantir que o botão "Compile & Run" / "STOP" (FIX 2.9) funcione igualmente bem no modo QEMU com o novo engine.

### Critérios de aceite
- No modo QEMU, um sketch que pisca o LED 13 faz o LED virtual da UI piscar sincronizado.
- O Serial Monitor mostra a mesma saída que o log serial do backend.
- Botões/inputs no frontend conseguem alterar pinos de entrada do firmware via QEMU Monitor.

---

## Observações

- O FIX 2.8 (NeuroForge Time) já está completo e pode ser usado para validar sketches reais com `delay/millis`, depois que a infraestrutura GPIO via monitor estiver estável.
- O firmware `gpio_test.ino` continua sendo o "laboratório" ideal para validar somente a camada de GPIO (sem dependência de tempo do Arduino).
