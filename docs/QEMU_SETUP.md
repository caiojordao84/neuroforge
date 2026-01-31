# QEMU Setup Local - Proof of Concept

## Objetivo

Validar a viabilidade de usar QEMU para simular microcontroladores no NeuroForge, começando com Arduino Uno (ATmega328P).

---

## Pré-requisitos

### Windows 11

```powershell
# Instalar Chocolatey (se não tiver)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar QEMU
choco install qemu -y

# Instalar Arduino CLI
choco install arduino-cli -y

# Verificar instalação
qemu-system-avr --version
arduino-cli version
```

### Configurar Arduino CLI

```powershell
# Criar config
arduino-cli config init

# Instalar core do Arduino AVR
arduino-cli core update-index
arduino-cli core install arduino:avr

# Listar boards disponíveis
arduino-cli board listall
```

---

## Passo 1: Criar Sketch de Teste

Crie o arquivo `blink.ino`:

```cpp
// blink.ino - LED no pino 13 (PORTB bit 5)
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

---

## Passo 2: Compilar para Arduino Uno

```powershell
# Compilar sketch para Arduino Uno
arduino-cli compile --fqbn arduino:avr:uno blink.ino

# O output estará em:
# blink.ino.arduino.avr.uno.hex
# blink.ino.arduino.avr.uno.elf
```

### Estrutura de saída

```
blink/
├── blink.ino
└── build/
    └── arduino.avr.uno/
        ├── blink.ino.hex       # Firmware para upload
        ├── blink.ino.elf       # Arquivo executável com símbolos
        ├── blink.ino.eep       # EEPROM data
        └── blink.ino.with_bootloader.hex
```

---

## Passo 3: Executar no QEMU

### Opção A: Linha de Comando Básica

```powershell
# Executar QEMU com Arduino Uno (ATmega328P)
qemu-system-avr `
  -machine uno `
  -bios blink/build/arduino.avr.uno/blink.ino.elf `
  -nographic `
  -serial stdio
```

**Parâmetros:**
- `-machine uno`: Emula Arduino Uno (ATmega328P)
- `-bios`: Carrega o firmware compilado
- `-nographic`: Modo headless (sem GUI)
- `-serial stdio`: Redireciona Serial para terminal

### Opção B: Com Monitor Interativo

```powershell
# QEMU com monitor para debug
qemu-system-avr `
  -machine uno `
  -bios blink.ino.elf `
  -monitor stdio `
  -S -s
```

**Parâmetros adicionais:**
- `-monitor stdio`: Console de debug do QEMU
- `-S`: Pausar execução no início
- `-s`: Abrir GDB server na porta 1234

---

## Passo 4: Verificar GPIO (PORTB)

### Monitor QEMU

No monitor do QEMU, você pode inspecionar registradores:

```
(qemu) info registers
(qemu) x/1xb 0x25    # Ler PORTB (endereço 0x25)
```

### Script de Polling

Crie `poll_gpio.py`:

```python
# poll_gpio.py - Monitora estado do PORTB via QEMU monitor
import subprocess
import time
import re

def read_portb():
    """Lê o registrador PORTB (0x25) via QEMU monitor"""
    cmd = 'echo "x/1xb 0x25" | qemu-system-avr -machine uno -bios blink.ino.elf -monitor stdio -nographic'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    # Parse output: "0x00000025: 0x20"
    match = re.search(r'0x[0-9a-f]+:\s+0x([0-9a-f]+)', result.stdout)
    if match:
        portb_value = int(match.group(1), 16)
        bit5 = (portb_value >> 5) & 1  # LED no bit 5
        return bit5
    return None

# Loop de monitoramento
print("Monitorando PORTB bit 5 (LED pino 13)...")
while True:
    led_state = read_portb()
    if led_state is not None:
        print(f"LED: {'ON ' if led_state else 'OFF'}")
    time.sleep(0.5)
```

---

## Passo 5: Testar Serial Monitor

Sketch com Serial:

```cpp
// serial_test.ino
void setup() {
  Serial.begin(9600);
  Serial.println("NeuroForge QEMU Test");
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
```

Compilar e executar:

```powershell
arduino-cli compile --fqbn arduino:avr:uno serial_test.ino

qemu-system-avr `
  -machine uno `
  -bios serial_test.ino.elf `
  -serial stdio `
  -nographic
```

**Output esperado:**
```
NeuroForge QEMU Test
LED ON
LED OFF
LED ON
LED OFF
...
```

---

## Troubleshooting

### QEMU não reconhece `-machine uno`

```powershell
# Listar máquinas disponíveis
qemu-system-avr -machine help
```

Se `uno` não estiver listado, use:

```powershell
qemu-system-avr -M arduino-uno ...
# ou
qemu-system-avr -M arduino ...
# ou (genérico AVR)
qemu-system-avr -cpu avr6 ...
```

### Arduino CLI não compila

```powershell
# Verificar se o core está instalado
arduino-cli core list

# Reinstalar se necessário
arduino-cli core uninstall arduino:avr
arduino-cli core install arduino:avr
```

### QEMU não executa

```powershell
# Verificar se o .elf foi gerado
ls blink/build/arduino.avr.uno/

# Testar com firmware de exemplo do QEMU
qemu-system-avr -machine uno -bios path/to/test.elf -nographic
```

---

## Próximos Passos

### POC Completo

1. ✅ Compilar blink.ino
2. ✅ Executar no QEMU local
3. ⏳ Ler GPIO via monitor
4. ⏳ Capturar Serial output
5. ⏳ Injetar input no Serial (RX)

### Integração com NeuroForge

1. **Node.js wrapper para QEMU**
   - Spawn QEMU process
   - Pipe Serial I/O
   - Parse GPIO state

2. **QEMUSimulationEngine.ts**
   - Substituir SimulationEngine atual
   - Polling de PORTB/PORTC/PORTD
   - Emit eventos pinChange

3. **Backend de compilação (futuro)**
   - API REST para compilar .ino → .hex
   - Cache de builds
   - Suporte a bibliotecas

---

## Recursos

- [QEMU AVR Documentation](https://www.qemu.org/docs/master/system/target-avr.html)
- [Arduino CLI Reference](https://arduino.github.io/arduino-cli/latest/)
- [ATmega328P Datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf)
- [Arduino Uno Schematic](https://docs.arduino.cc/resources/schematics/A000066-schematics.pdf)

---

## Validação do POC

Para considerar o POC bem-sucedido, devemos conseguir:

- ✅ Compilar sketch Arduino para .hex/.elf
- ✅ Executar firmware no QEMU
- ✅ Capturar output do Serial Monitor
- ✅ Ler estado dos GPIOs (PORTB, PORTC, PORTD)
- ✅ Validar timing de delay() e millis()
- ⏳ Performance aceitável (>30 FPS de polling)

Se todos os critérios forem atendidos, podemos prosseguir com a integração no NeuroForge.
