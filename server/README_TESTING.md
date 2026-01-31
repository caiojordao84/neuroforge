# Testando QEMU Integration

## Opção 1: Compilar Firmware Localmente

### Pré-requisitos

1. **Instalar Arduino CLI**

```bash
# Windows (PowerShell)
winget install ArduinoSA.CLI

# macOS
brew install arduino-cli

# Linux
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
```

2. **Configurar Arduino CLI**

```bash
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
```

3. **Instalar QEMU AVR**

```bash
# Windows (Chocolatey)
choco install qemu

# macOS
brew install qemu

# Linux (Ubuntu/Debian)
sudo apt install qemu-system-avr
```

---

### Compilar e Testar

```bash
cd server/test-firmware

# Compilar
arduino-cli compile --fqbn arduino:avr:uno blink

# O firmware fica em:
# server/test-firmware/build/arduino.avr.uno/blink.ino.elf

# Testar direto no QEMU
qemu-system-avr \
  -machine arduino-uno \
  -bios build/arduino.avr.uno/blink.ino.elf \
  -serial stdio \
  -nographic

# Deve imprimir:
# Arduino iniciado!
# LED ON
# LED OFF
# LED ON
# ...
```

---

## Opção 2: Usar Firmware Pré-compilado (Mock)

Se não tiver arduino-cli instalado, vou criar um mock simples:

```bash
cd server
npm run dev:mock
```

Isso vai rodar uma simulação sem QEMU real, apenas emitindo eventos.

---

## Opção 3: Testar com Servidor Node.js

```bash
cd server

# Compilar TypeScript
npm run build

# Executar exemplo
node dist/example.js
```

**Outputs esperados:**

```
=== NeuroForge QEMU Example ===

[Engine] Carregando: /path/to/firmware.elf
[Engine] Iniciando...

[QEMURunner] Iniciando: qemu-system-avr -machine uno -bios ...
[Engine] Iniciado
[Engine] Rodando por 10 segundos...

[Serial] Arduino iniciado!
[Serial] LED ON
[Serial] LED OFF
[GPIO] Pino 13 = HIGH
[GPIO] Pino 13 = LOW
...

[Engine] Parando...
[QEMURunner] Parando...
[QEMURunner] Finalizou com codigo: 0
[Engine] Parado

=== Estado Final ===
Linhas serial: 20
Ciclos: 200
```

---

## Troubleshooting

### Erro: "qemu-system-avr: command not found"

**Solução:** Instalar QEMU (veja pré-requisitos acima).

### Erro: "Firmware nao encontrado"

**Solução:** Compilar o firmware primeiro:

```bash
cd server/test-firmware
arduino-cli compile --fqbn arduino:avr:uno blink
```

### Erro: "Board arduino:avr:uno is not installed"

**Solução:** Instalar core AVR:

```bash
arduino-cli core install arduino:avr
```

### QEMU inicia mas não imprime nada

**Causa:** Firmware pode estar corrompido ou board errado.

**Solução:** Verificar board com:

```bash
qemu-system-avr -machine help
# Deve listar: arduino-uno, arduino-mega2560, etc
```

### Serial monitor vazio

**Causa:** QEMU AVR pode não suportar UART completamente.

**Workaround:** Use `-d guest_errors` para debug:

```bash
qemu-system-avr -machine uno -bios firmware.elf -serial stdio -d guest_errors
```

---

## Próximos Passos

Depois de validar que QEMU funciona:

1. **Implementar leitura real de GPIO** (via QEMU monitor)
2. **Adicionar suporte a PWM** (timers)
3. **Criar API REST** para compilar código do frontend
4. **Integrar WebSocket** para streaming de serial em tempo real

---

## Referências

- [QEMU AVR Docs](https://www.qemu.org/docs/master/system/target-avr.html)
- [Arduino CLI Docs](https://arduino.github.io/arduino-cli/latest/)
- [ATmega328P Datasheet](https://ww1.microchip.com/downloads/en/DeviceDoc/Atmel-7810-Automotive-Microcontrollers-ATmega328P_Datasheet.pdf)
