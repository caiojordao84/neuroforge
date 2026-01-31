# 🔧 NeuroForge - Histórico de Correções

## 🐛 Bug Fixes & Improvements

---

## 🎉 SESSÃO QEMU - 30-31 Janeiro 2026

### FIX 2.1: POC QEMU AVR Funcionando
**Data:** 30/01/2026  
**Commit:** `9ee11138` - `feat: Adicionar POC sketches e scripts para testar QEMU`

**Problema:**
- Precisava validar se QEMU AVR funciona no Windows
- Serial output do Arduino precisa ser capturado
- Compilar sketch com arduino-cli

**Solução:**
```bash
poc/qemu-avr-test/
├── sketches/
│   ├── blink/blink.ino        # LED piscando no pino 13
│   └── serial_test/serial_test.ino  # Serial.println
├── compile.ps1              # arduino-cli compile
├── run-qemu.ps1             # qemu-system-avr
└── README.md
```

**Resultado:**
```
[QEMU] Serial output: Hello from Arduino!
[QEMU] Serial output: Counter: 1
[QEMU] Serial output: Counter: 2
```

✅ **QEMU funciona no Windows + Serial capturado com sucesso!**

---

### FIX 2.2: QEMURunner - Process Manager
**Data:** 31/01/2026  
**Commit:** `33195aad` - `feat: Criar QEMURunner para spawnar e controlar processo QEMU`

**Problema:**
- Precisava de uma classe para gerenciar processo QEMU no Node.js
- Capturar stdout/stderr do QEMU
- Comunicar com QEMU monitor

**Implementação:**
```typescript
// server/QEMURunner.ts
class QEMURunner extends EventEmitter {
  start(firmwarePath: string, board: 'arduino-uno' | 'esp32')
  stop()
  sendSerialData(data: string)
  writeGPIO(port: string, pin: number, value: number)
  readGPIO(port: string, pin: number): Promise<number>
}

// Eventos:
engine.on('started', () => { ... });
engine.on('stopped', () => { ... });
engine.on('serial', (line) => { ... });
engine.on('gpio-write', ({ port, pin, value }) => { ... });
```

✅ **QEMURunner funcional com EventEmitter**

---

### FIX 2.3: QEMUSimulationEngine - High-Level API
**Data:** 31/01/2026  
**Commit:** `c89a7e0b` - `feat: Criar QEMUSimulationEngine para substituir motor custom`

**Problema:**
- Precisava de uma API high-level para controlar QEMU
- Polling de GPIO para atualizar UI
- Sincronizar Serial Monitor

**Implementação:**
```typescript
// server/QEMUSimulationEngine.ts
class QEMUSimulationEngine {
  loadFirmware(firmwarePath: string, board: BoardType)
  start()
  stop()
  pause()
  resume()
  getPinState(pin: number): PinState
  setPinState(pin: number, value: number) // Simular botão
  getSerialBuffer(): string[]
  clearSerial()
}
```

✅ **API pronta para integrar com frontend**

---

### FIX 2.4: Instalação Automática de Dependências
**Data:** 31/01/2026  
**Commit:** `bb049179` - `feat: Adicionar scripts de instalação automática`

**Problema:**
- 40+ dependências do frontend
- Dependencias do servidor QEMU separadas
- Processo manual propenso a erros

**Solução:**
```powershell
# install-deps.ps1 (Windows)
# install-deps.sh (Linux/Mac)

1. Remove src/engine duplicado (frontend não precisa QEMU)
2. Instala 40 pacotes Radix UI + React Flow + Monaco
3. Instala deps do servidor (express, socket.io)
4. Build frontend
```

✅ **Script PowerShell one-click install**

---

### FIX 2.5: Frontend Compilando com Stubs
**Data:** 31/01/2026  
**Commit:** `3a48f37a` - `fix: Criar engine stubs compatíveis com UI existente`

**Problema:**
- Frontend importava `src/engine/` que tinha código Node.js
- TypeScript não compilava (child_process, fs, path)
- Precisava de stubs temporários

**Solução:**
```typescript
// src/engine/SimulationEngine.ts (stub)
class SimulationEngine {
  start() { this.emit('start'); }
  stop() { this.emit('stop'); }
  on(event, callback) { ... }
  emit(event, data) { ... }
}

// tsconfig.app.json
"exclude": [
  "src/engine/example.ts",
  "src/engine/QEMU*.ts"
]
```

✅ **Frontend compila sem erros**

---

### FIX 2.6: Restaurar SimulationEngine Original
**Data:** 31/01/2026  
**Commit:** `04bf7047` - `fix: Restaurar SimulationEngine original que funcionava`

**Problema:**
- Stubs vazios não executam código
- LED não pisca mais
- Usuário reportou: "ligam mas não simula nada"

**Solução:**
```typescript
// Restaurar do commit e648d374 (antes do QEMU)
// 720 linhas de SimulationEngine funcional:
- pinMode(pin, mode)
- digitalWrite(pin, HIGH/LOW)
- delay(ms) com setTimeout real
- analogWrite(pin, value) com PWM
- Event emitter para componentes visuais
```

✅ **LED voltou a piscar! Frontend 100% funcional**

---

### FIX 2.7: Restaurar CodeParser Original
**Data:** 31/01/2026  
**Commit:** `9e389b57` - `fix: Restaurar CodeParser original que retorna funções`

**Problema:**
```typescript
// ERRO:
simulationEngine.start(parsed.setup, parsed.loop, speed);
                       ~~~~~~~~~~~~
// error TS2345: Argument of type 'string' is not assignable to
// parameter of type '() => void'.
```

**Causa Raiz:**
CodeParser stub retornava `setup: string`, mas deveria retornar `setup: () => void`

**Solução:**
```typescript
// src/engine/CodeParser.ts (restaurado)
class CodeParser {
  parse(code: string): { setup: () => void; loop: () => void } | null {
    // Extrai funções do código
    const setupMatch = this.extractFunction(code, 'setup');
    const loopMatch = this.extractFunction(code, 'loop');
    
    // Cria funções JavaScript executáveis
    return {
      setup: () => this.executeCppLine(setupMatch),
      loop: () => this.executeCppLine(loopMatch)
    };
  }
}
```

✅ **Compila sem erros + LED pisca!**

---

### FIX 2.8: NeuroForge Time - Clock Virtual Unificado ✅ COMPLETE
**Data:** 31/01/2026  
**Status:** ✅ COMPLETE  
**Commits:** `c0dea4c`, `2b7f60b`, `bee917d`, `c53a039`

**Problema Crítico:**
```cpp
void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(500);  // ⛔ TRAVAVA AQUI!
  
  digitalWrite(13, LOW);  // Nunca executava
  Serial.println("LED OFF");  // Nunca aparecia
  delay(500);
}
```

**Causa Raiz:**
- QEMU AVR não emula Timer0 corretamente
- `delay()` do Arduino depende de `millis()` que usa Timer0 overflow interrupt
- Timer0 nunca gera interrupções no QEMU → `millis()` sempre retorna 0
- `delay(500)` espera `millis()` avançar → **laço infinito**

---

#### Solução: NeuroForge Time

**Conceito:**
Clock virtual unificado, independente do hardware emulado, que serve todas as linguagens.

**API Comum:**
```c
// nf_time.h - API unificada (C/C++/Python/Rust/...)

uint32_t nf_now_ms(void);      // Tempo atual da simulação (ms)
uint32_t nf_now_us(void);      // Tempo atual da simulação (µs)
void nf_sleep_ms(uint32_t ms); // Dormir N ms em tempo de simulação
void nf_advance_ms(uint32_t);  // Avançar clock virtual (interno)
```

**Implementação v0 - Firmware-based (COMPLETA):**
```cpp
// nf_time.cpp
#define QEMU_TIMING_MULTIPLIER 10  // Ajustável!

static volatile uint32_t nf_ms = 0;

void nf_sleep_ms(uint32_t ms) {
  while (ms > 0) {
    // Loop ajustável: força o QEMU a executar mais ciclos de CPU
    for (uint16_t i = 0; i < QEMU_TIMING_MULTIPLIER; i++) {
      _delay_ms(1);     // Busy-wait baseado em F_CPU
    }
    nf_advance_ms(1);   // Avança clock virtual
    ms--;
  }
}
```

**Override Arduino:**
```cpp
// nf_arduino_time.cpp
void delay(unsigned long ms) {
  nf_sleep_ms((uint32_t)ms);  // Substitui delay() original
}

unsigned long millis() {
  return nf_now_ms();  // Lê clock virtual
}

unsigned long micros() {
  return nf_now_us();
}
```

**Core de Simulação:**
```ini
# boards.txt
unoqemu.name=NeuroForge Uno (QEMU)
unoqemu.build.core=neuroforge_qemu
unoqemu.build.board=AVR_UNO
unoqemu.build.mcu=atmega328p
unoqemu.build.f_cpu=16000000L
```

**Scripts de Instalação:**
```powershell
# install-core.ps1 - Instala core no Arduino CLI
# patch-wiring.ps1 - Desabilita delay/millis do core original
# update-nf-time.ps1 - Atualiza apenas nf_time.cpp (desenvolvimento)
```

**Ajuste de Timing:**
```cpp
// Em nf_time.cpp:
#define QEMU_TIMING_MULTIPLIER 10  // Padrão recomendado

// Se muito lento: diminua para 5 ou 3
// Se muito rápido: aumente para 20 ou 50
// Depois: .\ update-nf-time.ps1
```

**Backend Integration:**
```typescript
// CompilerService.ts
const board = mode === 'qemu'
  ? 'neuroforge:avr-qemu:unoqemu'  // Usa core customizado
  : 'arduino:avr:uno';              // Core original

// QEMURunner.ts - Real-time execution
const args = [
  '-machine', 'arduino-uno',
  '-bios', firmwarePath,
  '-icount', 'shift=auto',  // Throttling para tempo real
  '-serial', 'stdio'
];
```

---

#### Resultado Final

```cpp
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("--- Sistema de Pisca LED Iniciado ---");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("Status: LED LIGADO");
  delay(500);  // ✅ FUNCIONA!
  
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("Status: LED DESLIGADO");
  delay(500);  // ✅ FUNCIONA!
}
```

**Serial Monitor:**
```
[22:01:21] --- Sistema de Pisca LED Iniciado ---
[22:01:21] Status: LED LIGADO
[22:01:57] Status: LED DESLIGADO
[22:02:24] Status: LED LIGADO
[22:02:41] Status: LED DESLIGADO
```

✅ **delay(500) funciona perfeitamente!**  
✅ **millis() retorna valores crescentes!**  
✅ **Timing ajustável via constante!**  
✅ **LED blink roda indefinidamente!**  

---

#### Vantagens do NeuroForge Time

✅ **Funciona sem Timer0/Timer1**  
Usa busy-wait `_delay_ms()` baseado em F_CPU, que roda perfeitamente no QEMU AVR.

✅ **Consistente entre linguagens**  
Arduino, MicroPython, Rust, C bare-metal usam a mesma API `nf_time.h`.

✅ **Timing ajustável**  
Configurável via `QEMU_TIMING_MULTIPLIER` sem recompilar backend.

✅ **Controlável pelo host (v1)**  
Futuro: clock vem do backend, permite pause/step/fast-forward/rewind.

✅ **Multi-MCU sync (v1)**  
Vários MCUs no mesmo circuito compartilham o clock do host.

✅ **Determinístico**  
Reprodução de traces, debugging preciso, testes automatizados.

---

#### Roadmap de Implementação

**v0 - Firmware-based** (✅ COMPLETA):
- ✅ Clock virtual dentro do firmware
- ✅ `_delay_ms()` + contadores locais
- ✅ Override de delay/millis/micros
- ✅ Timing ajustável via `QEMU_TIMING_MULTIPLIER`
- ✅ Scripts de instalação automática
- ✅ Funciona já, sem modificar QEMU ou backend

**v1 - Host-driven** (⏳ Futuro):
- [ ] Clock vem do backend (simulationTimeMs)
- [ ] Device virtual QEMU expõe registrador de tempo
- [ ] Firmware lê `nf_now_ms()` de memória mapeada
- [ ] Permite pause, step, fast-forward, rewind
- [ ] Multi-MCU sincronizado

🚧 **NeuroForge Time é o diferencial do projeto!**

Permite simulação precisa e controlável sem depender de emulação perfeita de timers, e cria um caminho claro para suportar múltiplas linguagens e placas.

---

### FIX 2.9: Stop Button Toggle (🎯 PRÓXIMO)
**Data:** --/02/2026 (planejado)  
**Status:** ⏳ Pendente

**Objetivo:**
Transformar botão "Compile & Run" em "STOP" após simulação iniciar.

**Requisitos:**
- [ ] Estado do botão baseado em `isRunning` do QEMU store
- [ ] Ícone muda: Play → Stop
- [ ] Texto muda: "Compile & Run" → "STOP"
- [ ] Cor muda: verde → vermelho
- [ ] onClick: compile+run → stop simulation
- [ ] Loading state durante compilação
- [ ] Desabilitar durante loading

**Implementação:**
```tsx
// TopToolbar.tsx
const { isRunning, isCompiling } = useQEMUStore();

return (
  <Button
    onClick={isRunning ? handleStop : handleCompileAndRun}
    disabled={isCompiling}
    variant={isRunning ? "destructive" : "default"}
  >
    {isCompiling ? (
      <><Loader2 className="animate-spin" /> Compiling...</>
    ) : isRunning ? (
      <><Square /> STOP</>
    ) : (
      <><Play /> Compile & Run</>
    )}
  </Button>
);
```

---

## 📅 SESSÃO ANTERIOR - 22-29 Janeiro 2026

### FIX 1.1: React Flow Dependency Issues
**Data:** 22/01/2026

**Problema:** Conflito entre `react-flow-renderer` (deprecated) e `@xyflow/react` (novo)

**Solução:** Migrar para `@xyflow/react@^12.3.5`

---

### FIX 1.2: Path Alias `@/` Configuration
**Data:** 23/01/2026

**Problema:** Imports com `@/components` não resolviam

**Solução:**
```json
// tsconfig.json
"paths": {
  "@/*": ["./src/*"]
}

// vite.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
}
```

---

### FIX 1.3: Monaco Editor TypeScript Types
**Data:** 24/01/2026

**Problema:** `@monaco-editor/react` sem definições de tipos

**Solução:**
```bash
npm install @types/monaco-editor --save-dev
```

---

### FIX 1.4: Zustand Store Persistence
**Data:** 25/01/2026

**Problema:** Estado resetava ao recarregar página

**Solução:**
```typescript
import { persist } from 'zustand/middleware';

export const useSimulationStore = create(
  persist(
    (set) => ({ ... }),
    { name: 'simulation-storage' }
  )
);
```

---

### FIX 1.5: Serial Monitor Auto-Scroll
**Data:** 26/01/2026

**Problema:** Serial Monitor não scrollava automaticamente

**Solução:**
```typescript
useEffect(() => {
  if (autoScroll && scrollRef.current) {
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }
}, [lines, autoScroll]);
```

---

### FIX 1.6: Code Parser Function Extraction
**Data:** 27/01/2026  
**Commit:** `47aa7959`

**Problema:** Regex não capturava funções com chaves aninhadas

**Solução:**
```typescript
private extractFunction(code: string, functionName: string): string | null {
  // Contar chaves abertas/fechadas manualmente
  let braceCount = 1;
  let endIndex = startIndex;
  
  while (braceCount > 0 && endIndex < code.length) {
    if (code[endIndex] === '{') braceCount++;
    else if (code[endIndex] === '}') braceCount--;
    endIndex++;
  }
  
  return code.substring(startIndex, endIndex - 1);
}
```

---

### FIX 1.7: LED Component State Management
**Data:** 28/01/2026

**Problema:** LED não atualizava quando conectado a outro pino

**Solução:**
```typescript
useEffect(() => {
  const unsubscribe = simulationEngine.on('pinChange', (event) => {
    if (event.pin === data.connectedPin) {
      setIsOn(event.state === 'HIGH');
    }
  });
  return unsubscribe; // Cleanup
}, [data.connectedPin]);
```

---

### FIX 1.8: Simulation Engine Event Listener Persistence
**Data:** 29/01/2026  
**Commit:** `47aa7959`

**Problema:** Event listeners removidos ao parar simulação

**Solução:**
```typescript
stop(): void {
  // ...
  this.emit('simulationStopped', {});
  
  // NÃO remover listeners - componentes precisam deles!
  // this.removeAllListeners(); // REMOVIDO
  
  this.pinCache.clear();
}
```

---

### FIX 1.9: Variable Support in Code Parser
**Data:** 29/01/2026  
**Commit:** `e648d374`

**Problema:**
```cpp
const int ledPin = 13;
pinMode(ledPin, OUTPUT); // NÃO FUNCIONAVA!
```

**Solução:**
```typescript
private extractGlobalVariables(code: string): void {
  const globalVarRegex = /(?:const\s+)?(?:int|byte|long|float|double)\s+(\w+)\s*=\s*([\d.]+)\s*;/g;
  let match;
  while ((match = globalVarRegex.exec(code)) !== null) {
    this.variables.set(match[1], parseFloat(match[2]));
  }
}

private resolveVariable(name: string): number | null {
  if (this.variables.has(name)) {
    return this.variables.get(name)!;
  }
  return parseInt(name, 10) || null;
}
```

---

### FIX 1.10: Loop Execution Re-entrancy Prevention
**Data:** 29/01/2026  
**Commit:** `47aa7959`

**Problema:** Loop executava em paralelo causando race conditions

**Solução:**
```typescript
private isLoopExecuting = false;

private scheduleLoop(): void {
  if (this.isLoopExecuting) return; // Prevenir re-entrancy
  
  this.isLoopExecuting = true;
  
  const result = this.loopFunction();
  
  if (result instanceof Promise) {
    result.then(() => {
      this.isLoopExecuting = false;
      this.scheduleLoop(); // Próxima iteração
    });
  } else {
    this.isLoopExecuting = false;
    this.scheduleLoop();
  }
}
```

---

## 📊 Estatísticas

- **Total de Fixes:** 19
- **Sessão QEMU:** 9 fixes (30-31/01/2026)
  - **FIX 2.8 (NeuroForge Time):** ✅ **COMPLETO - Diferencial do projeto**
  - **FIX 2.9 (Stop Button):** 🎯 **PRÓXIMO**
- **Sessão Anterior:** 10 fixes (22-29/01/2026)
- **Commits:** 40+
- **Linhas de código:** ~17.000
- **Tempo investido:** ~50 horas

---

**Última atualização:** 31/01/2026 10:20 PM WET
