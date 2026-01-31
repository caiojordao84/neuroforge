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

- **Total de Fixes:** 17
- **Sessão QEMU:** 7 fixes (30-31/01/2026)
- **Sessão Anterior:** 10 fixes (22-29/01/2026)
- **Commits:** 30+
- **Linhas de código:** ~15.000
- **Tempo investido:** ~40 horas

---

**Última atualização:** 31/01/2026 03:47 AM WET
