# NeuroForge QEMU Core - Arduino com NeuroForge Time

## 🎯 Objetivo

Core Arduino customizado para simulação no QEMU, substituindo as funções de timing quebradas (`delay`, `millis`, `micros`) por implementações baseadas em **NeuroForge Time**.

## ⚠️ Problema que Resolve

QEMU AVR não emula Timer0 corretamente:
- `delay()` trava indefinidamente
- `millis()` sempre retorna 0
- Sketches simples com `delay(500)` não funcionam

## ✅ Solução: NeuroForge Time

Clock virtual independente do hardware:
- `delay()` usa busy-wait com `_delay_ms()` (baseado em F_CPU)
- `millis()` lê contador virtual avançado por `delay()`
- Funciona perfeitamente no QEMU sem depender de timers

---

## 📁 Estrutura de Arquivos

```
server/cores/neuroforge_qemu/
├── nf_time.h              # API NeuroForge Time
├── nf_time.cpp            # Implementação do clock virtual
├── nf_arduino_time.cpp    # Override delay/millis/micros
├── boards.txt             # Definição do board unoqemu
├── platform.txt           # Metadados da plataforma (TODO)
└── README.md              # Este arquivo
```

---

## 🛠️ Instalação

### Opção 1: Symlink para arduino-cli (Recomendado)

#### Windows (PowerShell como Admin)

```powershell
# Localizar diretório de cores do arduino-cli
$ARDUINO_DATA = "$env:LOCALAPPDATA\Arduino15"
$CORES_DIR = "$ARDUINO_DATA\packages\arduino\hardware\avr\1.8.6\cores"

# Criar symlink do core neuroforge_qemu
cd neuroforge/server/cores
New-Item -ItemType SymbolicLink -Path "$CORES_DIR\neuroforge_qemu" -Target "$PWD\neuroforge_qemu"

# Adicionar board ao boards.txt do arduino:avr
Get-Content "neuroforge_qemu/boards.txt" | Add-Content "$ARDUINO_DATA\packages\arduino\hardware\avr\1.8.6\boards.txt"
```

#### Linux/macOS

```bash
# Localizar diretório de cores do arduino-cli
ARDUINO_DATA="$HOME/.arduino15"
CORES_DIR="$ARDUINO_DATA/packages/arduino/hardware/avr/1.8.6/cores"

# Criar symlink do core neuroforge_qemu
cd neuroforge/server/cores
ln -s "$PWD/neuroforge_qemu" "$CORES_DIR/neuroforge_qemu"

# Adicionar board ao boards.txt do arduino:avr
cat "neuroforge_qemu/boards.txt" >> "$ARDUINO_DATA/packages/arduino/hardware/avr/1.8.6/boards.txt"
```

### Opção 2: Copiar arquivos manualmente

```bash
# Copiar core
cp -r server/cores/neuroforge_qemu ~/.arduino15/packages/arduino/hardware/avr/1.8.6/cores/

# Adicionar definição de board
cat server/cores/neuroforge_qemu/boards.txt >> ~/.arduino15/packages/arduino/hardware/avr/1.8.6/boards.txt
```

---

## ⚙️ Uso

### Compilar sketch para QEMU

```bash
# Criar sketch de teste
mkdir test_sketch
cat > test_sketch/test_sketch.ino << 'EOF'
void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("LED Blink started!");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(500);  // ✅ Funciona no QEMU!
  
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(500);
}
EOF

# Compilar com o board unoqemu
arduino-cli compile --fqbn arduino:avr:unoqemu test_sketch

# Executar no QEMU
qemu-system-avr -machine arduino-uno \
  -bios test_sketch/build/arduino.avr.unoqemu/test_sketch.ino.elf \
  -serial stdio \
  -nographic
```

### Resultado Esperado

```
LED Blink started!
LED ON
LED OFF
LED ON
LED OFF
...
```

✅ **delay(500) funciona!**  
✅ **millis() avança corretamente!**  
✅ **Serial Monitor exibe saída em tempo real!**  

---

## 🔧 Integração com Backend

### CompilerService.ts

```typescript
export class CompilerService {
  async compile(code: string, mode: 'interpreter' | 'qemu'): Promise<string> {
    // Selecionar board baseado no modo
    const board = mode === 'qemu'
      ? 'arduino:avr:unoqemu'  // ✅ Core com NeuroForge Time
      : 'arduino:avr:uno';      // Core Arduino padrão
    
    const sketchPath = await this.createSketch(code);
    
    const result = await execAsync(
      `arduino-cli compile --fqbn ${board} "${sketchPath}"`
    );
    
    return this.getElfPath(sketchPath, board);
  }
}
```

---

## 📚 Referência da API

### nf_time.h

```c
#include "nf_time.h"

// Obtém tempo atual em ms
uint32_t now = nf_now_ms();

// Obtém tempo atual em µs
uint32_t now_us = nf_now_us();

// Dorme por 1000ms
nf_sleep_ms(1000);

// Avançar clock (uso interno apenas)
nf_advance_ms(10);
```

### Arduino.h (com override)

```cpp
#include <Arduino.h>

// Estas funções usam NeuroForge Time automaticamente:
delay(1000);           // → nf_sleep_ms(1000)
unsigned long t = millis();  // → nf_now_ms()
unsigned long u = micros();  // → nf_now_us()

// delayMicroseconds() continua usando _delay_us() (já funciona)
delayMicroseconds(100);
```

---

## 🧪 Testando

### Teste 1: delay() funciona

```cpp
void loop() {
  digitalWrite(13, HIGH);
  delay(500);  // ✅ Não trava mais!
  digitalWrite(13, LOW);
  delay(500);
}
```

### Teste 2: millis() avança

```cpp
void loop() {
  static unsigned long lastTime = 0;
  unsigned long now = millis();
  
  if (now - lastTime >= 1000) {
    Serial.println(now);  // ✅ Incrementa a cada 1s!
    lastTime = now;
  }
}
```

### Teste 3: Blink sem delay

```cpp
void loop() {
  static unsigned long lastBlink = 0;
  unsigned long now = millis();
  
  if (now - lastBlink >= 500) {
    digitalWrite(13, !digitalRead(13));
    lastBlink = now;  // ✅ Funciona!
  }
}
```

---

## 🚀 Roadmap

### v0 - Firmware-based (✅ Atual)
- Clock virtual dentro do firmware
- `_delay_ms()` + contadores locais
- Funciona sem modificar QEMU ou backend

### v1 - Host-driven (⏳ Futuro)
- Clock vem do backend (simulationTimeMs)
- Device virtual QEMU expõe registrador de tempo
- Permite pause, step, fast-forward
- Multi-MCU sincronizado

---

## 📝 Licença

MIT License - mesmo do NeuroForge

---

**Criado:** 31/01/2026  
**Autor:** @caiojordao84
