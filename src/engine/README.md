# NeuroForge QEMU Integration

## Arquitetura

```
NeuroForge UI (React + TypeScript)
       ↓
  QEMUSimulationEngine.ts
       ↓
    QEMURunner.ts
       ↓
  qemu-system-avr (processo nativo)
       ↓
  Firmware.elf (Arduino compilado)
```

---

## Classes

### QEMURunner

**Responsabilidade:** Gerenciar processo QEMU de baixo nível.

**Métodos principais:**
- `start()` - Inicia processo QEMU
- `stop()` - Para processo QEMU
- `readGPIO(port, pin)` - Lê estado de GPIO
- `writeGPIO(port, pin, value)` - Injeta input
- `sendSerial(data)` - Envia dados para UART RX

**Eventos:**
- `started` - QEMU iniciado
- `stopped` - QEMU parado
- `serial` - Nova linha no Serial Monitor
- `gpio-write` - GPIO foi escrito

---

### QEMUSimulationEngine

**Responsabilidade:** Bridge entre UI e QEMU, gerencia estado da simulação.

**Métodos principais:**
- `loadFirmware(path, board)` - Carrega firmware compilado
- `start()` - Inicia simulação
- `stop()` - Para simulação
- `pause()` / `resume()` - Controla execução
- `setPin(pin, value)` - Simula botão/sensor
- `sendSerial(data)` - Envia para Serial RX
- `getState()` - Retorna estado atual

**Eventos:**
- `started` - Simulação iniciada
- `stopped` - Simulação parada
- `paused` / `resumed` - Pausado/Retomado
- `serial` - Output do Serial Monitor
- `pin-change` - GPIO mudou de estado
- `firmware-loaded` - Firmware carregado

---

## Exemplo de Uso

```typescript
import { QEMUSimulationEngine } from './engine/QEMUSimulationEngine';

// Criar engine
const engine = new QEMUSimulationEngine();

// Escutar eventos
engine.on('started', () => {
  console.log('Simulação iniciada!');
});

engine.on('serial', (line) => {
  console.log('Serial:', line);
});

engine.on('pin-change', ({ pin, value }) => {
  console.log(`Pino ${pin} mudou para ${value}`);
  // Atualizar LEDNode visual
});

// Carregar firmware
await engine.loadFirmware('./build/blink.elf', 'uno');

// Iniciar simulação
await engine.start();

// Simular botão pressionado no pino 2
await engine.setPin(2, 1);

// Enviar dados para Serial
await engine.sendSerial('Hello Arduino\n');

// Parar simulação
engine.stop();
```

---

## Integração com Componentes

### LEDNode

```typescript
engine.on('pin-change', ({ pin, value }) => {
  if (pin === 13) {
    // Atualizar LED visual
    ledNode.setBrightness(value ? 255 : 0);
  }
});
```

### ButtonNode

```typescript
buttonNode.on('press', () => {
  engine.setPin(2, 1); // HIGH
});

buttonNode.on('release', () => {
  engine.setPin(2, 0); // LOW
});
```

### ServoNode

```typescript
engine.on('pwm-change', ({ pin, dutyCycle }) => {
  if (pin === 9) {
    const angle = map(dutyCycle, 0, 255, 0, 180);
    servoNode.setAngle(angle);
  }
});
```

---

## Workflow de Compilação

### 1. Usuário escreve código no editor

```cpp
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
```

### 2. Frontend envia para backend (futuro)

```typescript
const response = await fetch('/api/compile', {
  method: 'POST',
  body: JSON.stringify({
    code: editorContent,
    board: 'uno',
    language: 'cpp'
  })
});

const { firmwarePath } = await response.json();
```

### 3. Backend compila (arduino-cli)

```bash
arduino-cli compile --fqbn arduino:avr:uno sketch.ino
```

### 4. Carrega firmware no engine

```typescript
await engine.loadFirmware(firmwarePath, 'uno');
await engine.start();
```

---

## Limitações Conhecidas

### 1. delay() e millis()

**Problema:** Timers do QEMU AVR não avançam em tempo real.

**Workaround:** 
- Usar contadores de iterações ao invés de `delay()`
- UI controla timing via polling (20-60 FPS)

### 2. GPIO Polling

**Problema:** Atualmente GPIO é mocado (Map em memória).

**TODO:** Implementar leitura real via:
- QEMU Monitor (`x/1xb 0x25` para ler PORTB)
- Memory dump de regiões I/O
- GDB remote protocol

### 3. PWM

**Problema:** Leitura de registradores Timer1 para PWM.

**TODO:** Ler OCR1A/OCR1B para calcular duty cycle.

---

## Próximos Passos

### Fase 1: GPIO Real (Prioritário)

- [ ] Implementar leitura de PORTB/C/D via QEMU monitor
- [ ] Polling otimizado (apenas pinos conectados)
- [ ] Injeção de input (PIN registers)

### Fase 2: Periféricos

- [ ] UART TX/RX bidirecional
- [ ] ADC para sensores analógicos
- [ ] PWM para servos e LED RGB
- [ ] I2C/SPI para displays

### Fase 3: Multi-Board

- [ ] ESP32 (QEMU xtensa)
- [ ] Raspberry Pi Pico (QEMU ARM)
- [ ] STM32 (QEMU ARM Cortex-M)

### Fase 4: Backend de Compilação

- [ ] API REST para compilar código
- [ ] Cache de builds
- [ ] Suporte a bibliotecas custom
- [ ] MicroPython cross-compilation

---

## Performance

**Target:** 30-60 FPS de atualização visual

**Polling GPIO:** 50ms (20 FPS) - ajustável

**Serial Monitor:** Tempo real (< 100ms latency)

**QEMU CPU Usage:** ~5-10% (single core)

**Memory:** ~50-100MB por instância QEMU

---

## Referências

- [QEMU AVR Documentation](https://www.qemu.org/docs/master/system/target-avr.html)
- [Arduino CLI Reference](https://arduino.github.io/arduino-cli/latest/)
- [ATmega328P Datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf)
