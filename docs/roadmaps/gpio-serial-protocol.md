# GPIO via Serial Protocol - Roadmap

## ✅ Objetivo
Implementar um protocolo Serial leve e confiável para transmitir estado de GPIO do firmware → backend → UI, independente de plataforma ou quirks do QEMU.

---

## Parte 1: Protocolo Serial de GPIO (Backend + Firmware)

### PR 1.1 – Definir formato do protocolo ✅
**Status**: Completo  
**Deliverable**: `docs/serial-gpio-protocol.md`

**Formato escolhido**: Frames de texto simples terminados em `\n`

**Sintaxe**:
- `G:<port>=<hex_value>` – Reportar port completo (ex: PORTB no AVR)
- `G:pin=<num>,v=<0|1>` – Reportar pin individual
- `G:<port1>=<hex>,<port2>=<hex>` – Múltiplos ports numa linha

**Exemplos**:
```
G:B=0xFF\n          # PORTB = 0xFF (todos os bits high)
G:pin=13,v=1\n      # Pin 13 = HIGH
G:B=0x20,C=0x00\n   # PORTB = 0x20, PORTC = 0x00
```

---

### PR 1.2 – Implementar `SerialGPIOService` no backend ✅
**Status**: Completo  
**Arquivos**: `server/SerialGPIOService.ts`, `server/QEMUSimulationEngine.ts`

**Implementado**:
- Parser de frames `G:...` (ports e pins)
- Manutenção de estado interno (`PortValues` e `Map<pin, 0|1>`)
- Emissão de eventos `gpio-snapshot` e `gpio-changes` com mesma interface do `QEMUGPIOService`
- Integração com `QEMUSimulationEngine` via `NF_GPIO_MODE=serial`

**Observações**:
- Primeiro frame gera mudanças assumindo estado inicial 0 para todos os pinos
- `example-gpio.ts` já exibe `[GPIO] Pin 13 changed to 1` e snapshots corretos

**Interface pública**:
```typescript
class SerialGPIOService extends EventEmitter {
  constructor(runner: QEMURunner);
  
  processLine(line: string): void;
  startPolling(): void;
  stopPolling(): void;
  getLastState(): GPIOState | null;
  getPinState(pin: number): 0 | 1;
}
```

---

### PR 1.3 – Criar helper firmware Arduino/AVR (`NeuroForgeGPIO`)
**Status**: Planejado  
**Estrutura**:
```
poc/libraries/NeuroForgeGPIO/
  NeuroForgeGPIO.h
  NeuroForgeGPIO.cpp
  keywords.txt
  library.properties
  examples/
    BasicGPIOTest/
      BasicGPIOTest.ino
```

**API pública**:
```cpp
void nfGPIO_begin();                              // Inicialização (opcional)
void nfGPIO_reportPORTB();                        // Envia G:B=0xXX
void nfGPIO_reportPORTC();                        // Envia G:C=0xXX
void nfGPIO_reportPORTD();                        // Envia G:D=0xXX
void nfGPIO_reportPin(uint8_t pin, uint8_t value); // Envia G:pin=X,v=Y
```

**Implementação interna**:
- Usa `Serial.print()` com format string para gerar frames válidos
- Rate limiting interno: só envia se estado mudou desde último report

**Exemplo de uso** (`BasicGPIOTest.ino`):
```cpp
#include <NeuroForgeGPIO.h>

void setup() {
  Serial.begin(9600);
  nfGPIO_begin();
  
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  nfGPIO_reportPin(13, 1);
  delay(500);
  
  digitalWrite(13, LOW);
  nfGPIO_reportPin(13, 0);
  delay(500);
}
```

---

### PR 1.4 – Integrar `SerialGPIOService` no `QEMUSimulationEngine`
**Status**: Completo  

**Implementado**:
- Engine escolhe backend de GPIO via `NF_GPIO_MODE` (`serial` por default)
- Conecta evento `runner.on('serial')` ao `gpioService.processLine(line)` quando disponível
- Mantém lógica existente de `gpio-changes` → `pin-change` + `cycleCount++`

---

## Parte 2: Expansão Multiplataforma (ESP32 & RP2040)

### PR 2.1 – Criar helper firmware ESP32
**Status**: Planejado  
**Estrutura**:
```
poc/libraries/NeuroForgeGPIO_ESP32/
  NeuroForgeGPIO_ESP32.h
  NeuroForgeGPIO_ESP32.cpp
  examples/
    ESP32_GPIOTest/
      ESP32_GPIOTest.ino
```

**API**: Mesma interface do AVR, mas adaptada para GPIO do ESP32.

---

### PR 2.2 – Criar helper firmware RP2040
**Status**: Planejado  
**Estrutura**:
```
poc/libraries/NeuroForgeGPIO_RP2040/
  NeuroForgeGPIO_RP2040.h
  NeuroForgeGPIO_RP2040.cpp
  examples/
    RP2040_GPIOTest/
      RP2040_GPIOTest.ino
```

**API**: Mesma interface.

---

### PR 2.3 – Testar com QEMU ESP32 e RP2040
**Status**: Planejado  
**Validações**:
- Firmware compila para cada plataforma
- QEMU roda e Serial chega ao backend
- `SerialGPIOService` parseia frames corretamente
- Snapshots e eventos de GPIO funcionam

---

## Parte 3: Otimizações & Robustez

### PR 3.1 – Rate limiting no firmware
**Status**: Planejado  
**Problema**: Firmware pode inundar Serial com frames redundantes.

**Solução**:
```cpp
static uint8_t last_portb = 0;
if (PORTB != last_portb) {
  nfGPIO_reportPORTB();
  last_portb = PORTB;
}
```

---

### PR 3.2 – Checksum/validação de frames no backend
**Status**: Planejado (opcional)  
**Formato com CRC8**:
```
G:B=0xFF*A3\n    # *A3 = CRC8
```

---

### PR 3.3 – Compressão binária (futuro)
**Status**: Futuro  
**Quando**: Se performance for crítica (muitos pinos, alta frequência).

**Formato binário**:
```
0x47 0xFF 0x00   # 'G' PORTB PORTC
```

---

## 📊 Status Summary

| PR | Descrição | Status |
|----|-----------|--------|
| 1.1 | Protocolo definido | ✅ Completo |
| 1.2 | SerialGPIOService | ✅ Completo |
| 1.3 | Helper firmware AVR | 📝 Planejado |
| 1.4 | Integração engine | ✅ Completo |
| 2.1 | Helper ESP32 | 📝 Planejado |
| 2.2 | Helper RP2040 | 📝 Planejado |
| 2.3 | Testes multiplataforma | 📝 Planejado |
| 3.1 | Rate limiting | 📝 Planejado |
| 3.2 | Checksum | 📝 Opcional |
| 3.3 | Binário | 📝 Futuro |
