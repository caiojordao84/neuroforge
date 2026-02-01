# 📺 QEMU Monitor TCP Connection

## 🎯 Overview

O **QEMU Monitor** é uma interface de comandos do QEMU que permite:
- Inspecionar o estado interno da máquina virtual
- Ler registradores da CPU (R0-R31, SREG, SP, PC)
- Ler registradores de I/O mapeados em memória (PORTB, PORTC, PORTD, etc.)
- Pausar, continuar, fazer stepping de instruções
- Debug avançado da simulação

Nesta implementação, usamos uma **conexão TCP** ao monitor para permitir que o backend Node.js envie comandos e receba respostas do QEMU em tempo real.

---

## 🔧 Arquitetura

### 1. Fluxo de Conexão

```
Node.js (QEMURunner)
       │
       │ spawn
       ↓
qemu-system-avr
  -monitor tcp:127.0.0.1:4444,server,nowait
       │
       │ TCP connection
       ↓
net.Socket (Node.js)
       │
       │ sendMonitorCommand('info registers')
       ↓
QEMU Monitor
       │
       │ Response with register values
       ↓
Promise<string> resolved
```

### 2. Lifecycle

1. **Start**: `QEMURunner.start()`
   - Spawna o processo QEMU com `-monitor tcp:127.0.0.1:<port>,server,nowait`
   - Aguarda 500ms para o QEMU inicializar
   - Conecta ao monitor via `net.createConnection(port, '127.0.0.1')`
   - Emite evento `'monitor-connected'` quando conectado

2. **Command/Response Cycle**:
   - `sendMonitorCommand(cmd)` envia o comando via socket
   - Acumula a resposta até detectar o prompt `(qemu)`
   - Remove o comando ecoado e o prompt da resposta
   - Resolve a `Promise` com a string da resposta

3. **Stop**: `QEMURunner.stop()`
   - Fecha a socket do monitor
   - Mata o processo QEMU
   - Limpa arquivos temporários

---

## 💻 Uso Básico

### Exemplo Completo

```typescript
import { QEMURunner } from './QEMURunner';

const runner = new QEMURunner(
  'path/to/firmware.hex',
  'uno',                    // board type
  'qemu-system-avr',        // qemu executable
  4444                      // monitor port (optional)
);

// Listen for events
runner.on('started', () => console.log('QEMU started'));
runner.on('monitor-connected', () => console.log('Monitor connected'));
runner.on('serial', (line) => console.log('[Serial]', line));

// Start QEMU
await runner.start();

// Send commands
const help = await runner.sendMonitorCommand('help');
console.log(help);

const registers = await runner.sendMonitorCommand('info registers');
console.log(registers);

// Stop
runner.stop();
```

### Script de Teste

```bash
# No diretório server/
npm run test:monitor
```

Isso executa `server/example-monitor.ts` que:
1. Inicia o QEMU com um firmware de teste
2. Conecta ao monitor
3. Envia comandos `help` e `info registers`
4. Exibe as respostas
5. Para o QEMU

---

## 📦 Comandos Disponíveis

### 1. `help`
Lista todos os comandos disponíveis no monitor.

```typescript
const help = await runner.sendMonitorCommand('help');
```

**Exemplo de resposta:**
```
info version  -- show the version of QEMU
info network  -- show the network state
info registers -- show the cpu registers
...
```

### 2. `info registers`
Exibe todos os registradores da CPU AVR.

```typescript
const regs = await runner.sendMonitorCommand('info registers');
```

**Exemplo de resposta:**
```
CPU#0
 R0 =00 R1 =00 R2 =00 R3 =00 R4 =00 R5 =00 R6 =00 R7 =00
 R8 =00 R9 =00 R10=00 R11=00 R12=00 R13=00 R14=00 R15=00
 R16=00 R17=00 R18=00 R19=00 R20=00 R21=00 R22=00 R23=00
 R24=00 R25=00 R26=00 R27=00 R28=00 R29=00 R30=00 R31=00
 PC =00000000 SP =000008ff SREG [ -------- ]
```

### 3. `info mem`
Exibe o mapa de memória.

```typescript
const mem = await runner.sendMonitorCommand('info mem');
```

### 4. `x /fmt addr`
Examina memória em um endereço específico.

```typescript
// Lê 1 byte no endereço 0x25 (PORTB no ATmega328P)
const portb = await runner.sendMonitorCommand('x/1b 0x25');
```

**Formato:**
- `/1b` = 1 byte
- `/4x` = 4 words em hexadecimal
- `/8d` = 8 words em decimal

### 5. `stop` / `cont`
Pausa e continua a execução.

```typescript
await runner.sendMonitorCommand('stop');
// ... inspecionar estado ...
await runner.sendMonitorCommand('cont');
```

---

## 🔌 GPIO Reading Strategy (Future)

Para ler o estado real dos pinos GPIO do QEMU, a estratégia é:

### 1. Mapeamento de Registradores AVR (ATmega328P)

| Registrador | Endereço | Pins Arduino |
|-------------|----------|---------------|
| `PORTB`     | `0x25`   | D8-D13        |
| `PORTC`     | `0x28`   | A0-A5         |
| `PORTD`     | `0x2B`   | D0-D7         |

### 2. Leitura via Monitor

```typescript
// Ler PORTB (pinos D8-D13)
const response = await runner.sendMonitorCommand('x/1b 0x25');
// Parse response: "0x25: 0x20"
const portbValue = parseInt(response.split(':')[1].trim(), 16);

// Bit 5 de PORTB = Pino 13 (LED_BUILTIN no Arduino Uno)
const pin13State = (portbValue & (1 << 5)) ? 1 : 0;
```

### 3. Polling Loop (50ms = 20 FPS)

```typescript
setInterval(async () => {
  if (!runner.running) return;

  try {
    // Ler todos os registradores de porta
    const portB = await readPort(runner, 'B', 0x25);
    const portC = await readPort(runner, 'C', 0x28);
    const portD = await readPort(runner, 'D', 0x2B);

    // Detectar mudanças
    const changes = detectChanges(prevState, { portB, portC, portD });

    // Emitir eventos via WebSocket
    changes.forEach(({ pin, value }) => {
      io.emit('pinChange', { pin, value });
    });

    prevState = { portB, portC, portD };
  } catch (err) {
    console.error('GPIO polling error:', err);
  }
}, 50);
```

### 4. Mapeamento Completo Arduino Uno

```typescript
const PIN_MAP = {
  // Digital pins
  0: { port: 'D', bit: 0 },   // PD0
  1: { port: 'D', bit: 1 },   // PD1
  2: { port: 'D', bit: 2 },   // PD2
  3: { port: 'D', bit: 3 },   // PD3
  4: { port: 'D', bit: 4 },   // PD4
  5: { port: 'D', bit: 5 },   // PD5
  6: { port: 'D', bit: 6 },   // PD6
  7: { port: 'D', bit: 7 },   // PD7
  8: { port: 'B', bit: 0 },   // PB0
  9: { port: 'B', bit: 1 },   // PB1
  10: { port: 'B', bit: 2 },  // PB2
  11: { port: 'B', bit: 3 },  // PB3
  12: { port: 'B', bit: 4 },  // PB4
  13: { port: 'B', bit: 5 },  // PB5 (LED_BUILTIN)
  
  // Analog pins
  14: { port: 'C', bit: 0 },  // A0 / PC0
  15: { port: 'C', bit: 1 },  // A1 / PC1
  16: { port: 'C', bit: 2 },  // A2 / PC2
  17: { port: 'C', bit: 3 },  // A3 / PC3
  18: { port: 'C', bit: 4 },  // A4 / PC4
  19: { port: 'C', bit: 5 },  // A5 / PC5
};
```

---

## ⚠️ Troubleshooting

### 1. "QEMU monitor not connected"

**Causa:** Socket TCP não conseguiu conectar à porta 4444.

**Soluções:**
- Verificar se a porta está disponível: `netstat -an | findstr 4444` (Windows)
- Aumentar o `retryDelay` ou `maxRetries` em `connectMonitor()`
- Verificar firewall (pode estar bloqueando localhost:4444)

### 2. "QEMU monitor command timeout"

**Causa:** Comando não retornou resposta em 500ms.

**Soluções:**
- Aumentar o timeout: `sendMonitorCommand('help', 2000)`
- Verificar se o comando é válido: `help` lista todos os comandos
- QEMU pode estar travado (verificar processo)

### 3. Windows: "Error: spawn qemu-system-avr ENOENT"

**Causa:** `qemu-system-avr` não está no PATH.

**Solução:**
```powershell
# Adicionar QEMU ao PATH
$env:Path += ";C:\Program Files\qemu"

# Ou especificar caminho completo
const runner = new QEMURunner(
  firmware,
  'uno',
  'C:\\Program Files\\qemu\\qemu-system-avr.exe'
);
```

### 4. Linux: "Connection refused"

**Causa:** QEMU pode estar usando Unix socket ao invés de TCP.

**Solução:** Forçar TCP:
```typescript
// Garantir que os argumentos incluem:
'-monitor', 'tcp:127.0.0.1:4444,server,nowait'
```

---

## 📊 Performance Considerations

### Polling Frequency

- **20 FPS (50ms)**: Bom para animações suaves de LEDs
- **10 FPS (100ms)**: Mais leve, suficiente para debug
- **60 FPS (16ms)**: Pode sobrecarregar o monitor (evitar)

### Command Latency

- `info registers`: ~5-20ms
- `x/1b <addr>`: ~3-10ms
- `help`: ~20-50ms (texto longo)

### Recomendação

- Fazer polling apenas quando simulação estiver rodando
- Parar polling ao pausar/parar simulação
- Usar `Promise.all()` para ler múltiplos registradores em paralelo

```typescript
const [portB, portC, portD] = await Promise.all([
  runner.sendMonitorCommand('x/1b 0x25'),
  runner.sendMonitorCommand('x/1b 0x28'),
  runner.sendMonitorCommand('x/1b 0x2B')
]);
```

---

## 🚀 Next Steps

1. **Parse GPIO Registers** (Parte 2)
   - Implementar `parsePortValue(response: string): number`
   - Mapear bits para pinos Arduino
   - Detectar mudanças e emitir eventos

2. **WebSocket Integration** (Parte 3)
   - Emitir `pinChange` events para frontend
   - LED components atualizam em tempo real
   - Botões simulam input escrevendo no GPIO

3. **Performance Optimization** (Parte 4)
   - Cachear valores que não mudaram
   - Polling adaptativo (acelera quando há mudanças)
   - Batch commands para reduzir roundtrips

---

## 📚 References

- [QEMU Monitor Documentation](https://qemu.readthedocs.io/en/latest/system/monitor.html)
- [ATmega328P Datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf) (Register addresses)
- [Arduino Pin Mapping](https://www.arduino.cc/en/Hacking/PinMapping168)

---

**Última atualização:** 01/02/2026  
**Status:** ✅ **Parte 1 (Conexão TCP) COMPLETA**  
**Próxima:** 🎯 **Parte 2 (Parse GPIO Registers)**
