# RP2040 Test Firmware - NeuroForge

Este diretório contém firmwares de teste Arduino para emulação RP2040 com Renode.

## 📁 Estrutura

```
rp2040/
├── README.md              # Este arquivo
├── blink/                 # Firmware de teste básico (LED blink)
│   ├── blink.ino          # Sketch Arduino
│   ├── test-blink.resc    # Script Renode
│   ├── monitor-serial.ps1 # Helper serial monitor
│   └── build/             # Output de compilação (gerado)
└── .gitignore
```

## 🔨 Compilação

### Pré-requisitos

- Arduino CLI instalado (`arduino-cli version`)
- Core RP2040 instalado (`arduino-cli core list | grep rp2040`)
- Renode instalado (`renode --version`)

### Build

```powershell
cd blink

# Compilar sketch
arduino-cli compile --fqbn rp2040:rp2040:rpipico --output-dir build blink.ino

# Verificar saída
ls build/blink.ino.elf
```

### Saída

- `blink.ino.elf` - Binário para Renode (ELF ARM)
- `blink.ino.uf2` - Binário para hardware real (UF2)
- `blink.ino.bin` - Binário raw
- `blink.ino.map` - Memory map

## ▶️ Execução no Renode

```powershell
cd blink
renode test-blink.resc
```

## 📡 Serial Output

O firmware emite eventos GPIO via UART no formato:

```
G:pin=25,v=1    # LED ON
G:pin=25,v=0    # LED OFF
```

### Opção 1: Helper Script (Recomendado)

```powershell
cd blink
.\monitor-serial.ps1
```

### Opção 2: Netcat

```powershell
nc localhost 1234
```

### Opção 3: PowerShell Manual

```powershell
$client = New-Object System.Net.Sockets.TcpClient("localhost", 1234)
$stream = $client.GetStream()
$reader = New-Object System.IO.StreamReader($stream)
while ($true) { $reader.ReadLine() }
```

## ✅ Verificação

Saída esperada:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NeuroForge GPIO Test - RP2040
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Board: Raspberry Pi Pico
LED Pin: GP25
Protocol: G:pin=X,v=Y
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

G:pin=25,v=1
LED ON
G:pin=25,v=0
LED OFF
...
```

## 📚 Documentação

Ver [rp2040-setup.md](../../docs/firmware/rp2040-setup.md) para setup completo.

## 🛠️ Troubleshooting

### Erro: "Board rp2040:rp2040:rpipico not found"

```powershell
# Instalar core
arduino-cli core install rp2040:rp2040
```

### Erro: "Renode can't find elf"

```powershell
# Verificar caminho no test-blink.resc:
# sysbus LoadELF @build/blink.ino.elf

# Garantir que compilou:
Test-Path build/blink.ino.elf
```

### Erro: "TCP connection refused"

```powershell
# Verificar se Renode está rodando
# Verificar porta no .resc (padrão: 1234)
# Aguardar 2-3 segundos após iniciar Renode
```
