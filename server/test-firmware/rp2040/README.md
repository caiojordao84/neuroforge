# RP2040 Test Firmware - NeuroForge

> **IMPORTANTE:** Raspberry Pi Pico SDK (C puro), **NÃO Arduino!**

Firmware de teste para emulação RP2040 com Renode.

## 📁 Estrutura

```
rp2040/
├── README.md
├── blink/
│   ├── main.c                 # Código C (Pico SDK)
│   ├── CMakeLists.txt         # Configuração CMake
│   ├── pico_sdk_import.cmake  # SDK import
│   ├── test-blink.resc        # Script Renode
│   ├── monitor-serial.ps1     # Monitor serial TCP
│   ├── platforms/             # Custom RP2040 platform
│   │   ├── rp2040.repl        # RP2040 MCU description
│   │   └── raspberry-pico.repl # Pico board config
│   └── build/                 # Output (gerado)
└── .gitignore
```

## 🔧 Platform Files

**IMPORTANTE:** Renode 1.15.3 não inclui RP2040 por padrão. Usamos arquivos `.repl` customizados na pasta `platforms/`.

Esses arquivos definem:
- Cortex-M0+ CPU
- Memória (SRAM, Flash, ROM)
- UART0/UART1 (PL011 compatible)
- Timers

**Não é necessário instalar nada extra!** Os arquivos já estão no repositório.

## 🔨 Compilação

### Pré-requisitos

- Pico SDK instalado (`$env:PICO_SDK_PATH`)
- ARM GCC no PATH (`arm-none-eabi-gcc --version`)
- CMake (`cmake --version`)
- Renode (`renode --version`)

### Build

```powershell
cd blink

# Ativar ambiente
. D:\Tools\activate-pico-env.ps1

# Criar pasta de build
mkdir build -Force
cd build

# Configurar CMake
cmake -G "NMake Makefiles" ..
# OU com Ninja:
# cmake -G "Ninja" ..

# Compilar
nmake
# OU:
# ninja

# Verificar output
ls blink.elf
```

### Saída

```
build/
├── blink.elf      # Binário para Renode (ELF ARM)
├── blink.uf2      # Hardware real (drag-and-drop)
├── blink.bin      # Raw binary
├── blink.hex      # Intel HEX
└── blink.map      # Memory map
```

## ▶️ Execução no Renode

```powershell
cd blink
renode test-blink.resc
```

**Saída esperada:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 NeuroForge RP2040 Blink Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Board:    Raspberry Pi Pico
  Firmware: build/blink.elf (Pico SDK)
  UART TCP: localhost:1234
  Platform: Custom RP2040 .repl
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Emulação iniciada!
```

## 📡 Serial Output

O firmware emite eventos GPIO via UART:

```
G:pin=25,v=1    # LED ON
G:pin=25,v=0    # LED OFF
```

### Monitor Serial

```powershell
cd blink
.\monitor-serial.ps1
```

## ✅ Verificação

Saída esperada:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NeuroForge GPIO Test - RP2040
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Board: Raspberry Pi Pico
LED Pin: GP25
Protocol: G:pin=X,v=Y
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

G:pin=25,v=1
LED ON
G:pin=25,v=0
LED OFF
...
```

## 🛠️ Troubleshooting

### Erro: "Could not find file 'platforms/cpus/rp2040.repl'"

✅ **RESOLVIDO!** Agora usamos `platforms/raspberry-pico.repl` local (já está no repo).

O script `test-blink.resc` foi atualizado para usar:
```
machine LoadPlatformDescription @platforms/raspberry-pico.repl
```

### Erro: "PICO_SDK_PATH not defined"

```powershell
$env:PICO_SDK_PATH = "D:\Tools\pico-sdk"
```

### Erro: "arm-none-eabi-gcc not found"

```powershell
$env:PATH += ";D:\Tools\arm-none-eabi-gcc\gcc-arm-none-eabi\bin"
```

### Erro: "CMake Error: Could not find CMAKE_MAKE_PROGRAM"

```powershell
# Especificar gerador:
cmake -G "NMake Makefiles" ..
# OU instalar Ninja:
winget install Ninja-build.Ninja
```

## 📚 Documentação

- [rp2040-setup.md](../../docs/firmware/rp2040-setup.md) - Setup completo
- [Pico SDK](https://github.com/raspberrypi/pico-sdk)
- [Renode](https://renode.readthedocs.io/)
- [Custom RP2040 Platform](https://github.com/matgla/Renode_RP2040) - Referência
