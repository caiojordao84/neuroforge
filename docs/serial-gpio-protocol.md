# Serial GPIO Protocol Specification

**Version**: 1.0  
**Date**: 2026-02-03  
**Status**: Draft

---

## Overview

Protocolo leve baseado em texto para transmitir estado de GPIO do firmware para o backend do simulador via Serial.

**Objetivos**:
- Independente de plataforma (AVR, ESP32, RP2040, etc.)
- Fácil de debugar (frames legíveis)
- Baixo overhead (poucos bytes por mudança)
- Extensível (suporte futuro para ADC, PWM, etc.)

---

## Frame Format

### Estrutura básica
```
<prefix>:<payload>\n
```

- **Prefix**: Identificador do tipo de frame (1 caractere)
- **Payload**: Dados específicos do tipo
- **Terminador**: `\n` (newline, 0x0A)

### Prefixes definidos

| Prefix | Tipo | Descrição |
|--------|------|-------------|
| `G` | GPIO | Estado de pinos/ports |
| `A` | ADC | Leitura analógica (futuro) |
| `P` | PWM | Estado PWM (futuro) |
| `S` | Status | Informações do sistema (futuro) |

---

## GPIO Frames (`G:`)

### Sintaxe

#### 1. Port completo (AVR)
```
G:<port>=<hex_value>
```

**Exemplos**:
```
G:B=0xFF\n       # PORTB = 0xFF (todos os bits high)
G:C=0x00\n       # PORTC = 0x00 (todos os bits low)
G:D=0x20\n       # PORTD = 0x20 (bit 5 high, resto low)
```

#### 2. Pin individual (universal)
```
G:pin=<num>,v=<0|1>
```

**Exemplos**:
```
G:pin=13,v=1\n   # Pin 13 = HIGH
G:pin=2,v=0\n    # Pin 2 = LOW
```

#### 3. Múltiplos ports/pins (opcional)
```
G:<item1>,<item2>,...
```

**Exemplos**:
```
G:B=0x20,C=0x00\n           # PORTB=0x20, PORTC=0x00
G:pin=13,v=1,pin=2,v=0\n   # Pin 13=HIGH, Pin 2=LOW
```

---

## Parsing Rules (Backend)

### 1. Detecção de frame
- Linha começa com `G:`? → é frame de GPIO
- Caso contrário, ignorar (pode ser output normal do Serial)

### 2. Parsing de payload

**Regex sugerido** (TypeScript):
```typescript
const GPIO_FRAME_REGEX = /^G:(.+)$/;
const PORT_PATTERN = /([BCD])=0x([0-9a-fA-F]{2})/g;
const PIN_PATTERN = /pin=(\d+),v=([01])/g;
```

**Algoritmo**:
```typescript
function parseGPIOFrame(line: string): GPIOUpdate | null {
  const match = line.match(GPIO_FRAME_REGEX);
  if (!match) return null;
  
  const payload = match[1];
  const ports: Record<string, number> = {};
  const pins: Record<number, 0 | 1> = {};
  
  // Parse ports (ex: B=0xFF)
  for (const [, port, hex] of payload.matchAll(PORT_PATTERN)) {
    ports[port] = parseInt(hex, 16);
  }
  
  // Parse pins (ex: pin=13,v=1)
  for (const [, pinStr, valueStr] of payload.matchAll(PIN_PATTERN)) {
    pins[parseInt(pinStr)] = parseInt(valueStr) as 0 | 1;
  }
  
  return { ports, pins };
}
```

### 3. Atualização de estado

**Se frame contém ports**:
- Atualizar `PortValues` correspondente
- Expandir bits para `Map<pin, 0|1>` usando `PIN_MAP`

**Se frame contém pins**:
- Atualizar `Map<pin, 0|1>` diretamente

**Emitir eventos**:
- `gpio-snapshot`: Estado completo
- `gpio-changes`: Apenas pins que mudaram

---

## Firmware Implementation Guidelines

### 1. Rate limiting
**Problema**: Enviar frame a cada ciclo pode inundar Serial.

**Solução**: Cache de estado anterior
```cpp
static uint8_t last_portb = 0;

void reportPORTB() {
  if (PORTB != last_portb) {
    Serial.print("G:B=0x");
    Serial.println(PORTB, HEX);
    last_portb = PORTB;
  }
}
```

### 2. Timing
**Quando enviar frames**:
- Logo após `digitalWrite()` / `PORTB =`
- Em ISRs (se necessário, mas cuidado com overhead)
- Periodicamente via timer (para garantir sincronia)

### 3. Buffer overflow
**Problema**: Serial buffer pode encher se firmware enviar mais rápido que backend consome.

**Solução** (AVR):
```cpp
if (Serial.availableForWrite() < 16) {
  return; // Skip frame se buffer quase cheio
}
```

---

## Examples

### Arduino AVR (Blink)
```cpp
#include <NeuroForgeGPIO.h>

void setup() {
  Serial.begin(9600);
  nfGPIO_begin();
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  nfGPIO_reportPin(13, 1);  // Envia G:pin=13,v=1
  delay(500);
  
  digitalWrite(13, LOW);
  nfGPIO_reportPin(13, 0);  // Envia G:pin=13,v=0
  delay(500);
}
```

### ESP32 (Multiple pins)
```cpp
#include <NeuroForgeGPIO_ESP32.h>

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);   // LED onboard
  pinMode(4, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  digitalWrite(4, LOW);
  
  // Envia G:pin=2,v=1,pin=4,v=0
  nfGPIO_reportMultiple(2, HIGH, 4, LOW);
  
  delay(1000);
}
```

### Backend (Node.js)
```typescript
import { SerialGPIOService } from './SerialGPIOService';

const gpioService = new SerialGPIOService(runner);

runner.on('serial-line', (line) => {
  gpioService.processLine(line);
});

gpioService.on('gpio-changes', (changes) => {
  for (const { pin, from, to } of changes) {
    console.log(`Pin ${pin}: ${from} → ${to}`);
  }
});
```

---

## Future Extensions

### Analog frames (`A:`)
```
A:pin=<num>,v=<0-1023>\n
```

**Exemplo**:
```
A:pin=0,v=512\n   # Analog pin A0 = 512 (2.5V se Vref=5V)
```

### PWM frames (`P:`)
```
P:pin=<num>,duty=<0-255>\n
```

**Exemplo**:
```
P:pin=9,duty=128\n   # PWM no pin 9, 50% duty cycle
```

### Status frames (`S:`)
```
S:uptime=<ms>,free_ram=<bytes>\n
```

**Exemplo**:
```
S:uptime=5000,free_ram=1024\n
```

---

## Error Handling

### Frames malformados
**Backend deve**:
- Logar warning com linha original
- Ignorar frame (não crashar)
- Continuar processando próximas linhas

**Exemplo**:
```typescript
try {
  const update = parseGPIOFrame(line);
  if (update) {
    this.applyUpdate(update);
  }
} catch (err) {
  console.warn('[SerialGPIOService] Malformed frame:', line, err);
}
```

### Frames fora de ordem
**Não é problema**: Cada frame representa estado absoluto, não delta.

### Frames duplicados
**Backend deve**: Detectar via diff de estado e não emitir `gpio-changes` se nada mudou.

---

## Performance Considerations

### Bandwidth
**Frame típico**: ~15 bytes (`G:pin=13,v=1\n`)

**Baud rate 9600**:
- ~960 bytes/s → ~64 frames/s
- Suficiente para maioria dos casos

**Baud rate 115200** (ESP32):
- ~11520 bytes/s → ~768 frames/s
- Mais que suficiente

### Latency
**Serial + parsing**: <1ms no backend (Node.js)

**Total (firmware → UI)**: ~10-50ms (depende de baud rate + polling do engine)

---

## Version History

| Version | Date | Changes |
|---------|------|----------|
| 1.0 | 2026-02-03 | Especificação inicial |
