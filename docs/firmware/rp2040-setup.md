# 🛠️ Guia Completo: Raspberry Pi Pico SDK + Renode no Windows 11

> **IMPORTANTE:** Este guia é para **Raspberry Pi Pico SDK** (C/C++ nativo)  
> **NÃO use Arduino!** RP2040 não é Arduino.

> **Autor:** NeuroForge Team  
> **Data:** 06/02/2026  
> **Plataforma:** Windows 11 (64-bit)  
> **Workflow:** Pico SDK + CMake → ELF → Renode  
> **Shell:** PowerShell 5.1+

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Instalação do Renode](#instalação-do-renode)
3. [Instalação do Pico SDK](#instalação-do-pico-sdk)
4. [Instalação do ARM GCC Toolchain](#instalação-do-arm-gcc-toolchain)
5. [Instalação do CMake](#instalação-do-cmake)
6. [Instalação do Ninja (Opcional)](#instalação-do-ninja)
7. [Configuração de Ambiente](#configuração-de-ambiente)
8. [Compilação de Firmware](#compilação-de-firmware)
9. [Teste com Renode](#teste-com-renode)
10. [Integração com NeuroForge](#integração-com-neuroforge)
11. [Troubleshooting](#troubleshooting)

---

## 1. Pré-requisitos

### ✅ Checklist

- [x] Windows 11 (64-bit)
- [x] PowerShell 5.1+
- [x] Conexão com internet estável
- [x] ~5 GB de espaço em disco livre
- [x] Git for Windows

### 🔍 Verificar Git

```powershell
git --version
# Se não instalado:
winget install --id Git.Git -e --source winget
```

---

## 2. Instalação do Renode

### 📦 Instalação em D:\Tools\Renode

```powershell
$TOOLS_DIR = "D:\Tools"
New-Item -ItemType Directory -Force -Path $TOOLS_DIR
cd $TOOLS_DIR

# Baixar Renode 1.15.3
$RENODE_VERSION = "1.15.3"
$RENODE_URL = "https://github.com/renode/renode/releases/download/v$RENODE_VERSION/renode-$RENODE_VERSION.zip"
$RENODE_ZIP = "$TOOLS_DIR\renode.zip"

Write-Host "📥 Baixando Renode $RENODE_VERSION..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $RENODE_URL -OutFile $RENODE_ZIP

Write-Host "📦 Extraindo Renode..." -ForegroundColor Cyan
Expand-Archive -Path $RENODE_ZIP -DestinationPath "$TOOLS_DIR\Renode" -Force

# Mover arquivos da subpasta para raiz
$ExtractedDir = Get-ChildItem -Path "$TOOLS_DIR\Renode" -Directory | Select-Object -First 1
if ($ExtractedDir -and $ExtractedDir.Name -ne "Renode") {
    Get-ChildItem -Path $ExtractedDir.FullName | Move-Item -Destination "$TOOLS_DIR\Renode" -Force
    Remove-Item $ExtractedDir.FullName -Force
}

Remove-Item $RENODE_ZIP

# Verificar
$RENODE_EXE = "$TOOLS_DIR\Renode\renode.exe"
if (Test-Path $RENODE_EXE) {
    Write-Host "✅ Renode instalado em: $TOOLS_DIR\Renode" -ForegroundColor Green
    & $RENODE_EXE --version
}
```

### 🌍 Adicionar ao PATH

```powershell
$CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$TOOLS_DIR\Renode*") {
    [System.Environment]::SetEnvironmentVariable(
        "PATH", 
        "$CurrentPath;$TOOLS_DIR\Renode", 
        "User"
    )
}

$env:PATH += ";$TOOLS_DIR\Renode"
renode --version
```

---

## 3. Instalação do Pico SDK

### 📥 Clonar via Git

```powershell
cd $TOOLS_DIR

Write-Host "📥 Clonando Pico SDK..." -ForegroundColor Cyan
git clone --depth 1 --branch master https://github.com/raspberrypi/pico-sdk.git

cd pico-sdk

Write-Host "📦 Inicializando submódulos (~500 MB)..." -ForegroundColor Cyan
git submodule update --init --recursive

Write-Host "✅ Pico SDK instalado em: $TOOLS_DIR\pico-sdk" -ForegroundColor Green
```

---

## 4. Instalação do ARM GCC Toolchain

### 📥 Download ARM GCC 13.2.1

```powershell
$ARM_GCC_VERSION = "13.2.Rel1"
$ARM_GCC_URL = "https://developer.arm.com/-/media/Files/downloads/gnu/$ARM_GCC_VERSION/binrel/arm-gnu-toolchain-$ARM_GCC_VERSION-mingw-w64-i686-arm-none-eabi.zip"
$ARM_GCC_ZIP = "$TOOLS_DIR\arm-gcc.zip"
$ARM_GCC_DIR = "$TOOLS_DIR\arm-none-eabi-gcc"

Write-Host "📥 Baixando ARM GCC $ARM_GCC_VERSION (~300 MB)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ARM_GCC_URL -OutFile $ARM_GCC_ZIP

Write-Host "📦 Extraindo ARM GCC..." -ForegroundColor Cyan
Expand-Archive -Path $ARM_GCC_ZIP -DestinationPath $ARM_GCC_DIR -Force

# Renomear pasta extraída
$ExtractedDir = Get-ChildItem -Path $ARM_GCC_DIR -Directory | Select-Object -First 1
if ($ExtractedDir) {
    Move-Item -Path $ExtractedDir.FullName -Destination "$ARM_GCC_DIR\gcc-arm-none-eabi" -Force
}

Remove-Item $ARM_GCC_ZIP

# Verificar
$ARM_GCC_BIN = "$ARM_GCC_DIR\gcc-arm-none-eabi\bin\arm-none-eabi-gcc.exe"
if (Test-Path $ARM_GCC_BIN) {
    Write-Host "✅ ARM GCC instalado" -ForegroundColor Green
    & $ARM_GCC_BIN --version
}
```

---

## 5. Instalação do CMake

### 📦 Via WinGet

```powershell
if (Get-Command cmake -ErrorAction SilentlyContinue) {
    Write-Host "✅ CMake já instalado" -ForegroundColor Green
    cmake --version
} else {
    Write-Host "📥 Instalando CMake..." -ForegroundColor Cyan
    winget install --id Kitware.CMake -e --source winget
    
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    cmake --version
}
```

---

## 6. Instalação do Ninja (Opcional, mas recomendado)

### 🚀 Ninja = Build mais rápido que NMake

```powershell
Write-Host "📥 Instalando Ninja..." -ForegroundColor Cyan
winget install Ninja-build.Ninja

$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
ninja --version
```

---

## 7. Configuração de Ambiente

### 🌍 Variáveis Permanentes

```powershell
# PICO_SDK_PATH
[System.Environment]::SetEnvironmentVariable("PICO_SDK_PATH", "$TOOLS_DIR\pico-sdk", "User")

# PICO_TOOLCHAIN_PATH
[System.Environment]::SetEnvironmentVariable("PICO_TOOLCHAIN_PATH", "$TOOLS_DIR\arm-none-eabi-gcc\gcc-arm-none-eabi", "User")

# Adicionar ao PATH
$CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
$NewPaths = @(
    "$TOOLS_DIR\arm-none-eabi-gcc\gcc-arm-none-eabi\bin",
    "$TOOLS_DIR\Renode"
)

foreach ($Path in $NewPaths) {
    if ($CurrentPath -notlike "*$Path*") {
        $CurrentPath += ";$Path"
    }
}

[System.Environment]::SetEnvironmentVariable("PATH", $CurrentPath, "User")

Write-Host "✅ Variáveis de ambiente configuradas" -ForegroundColor Green
Write-Host "⚠️ IMPORTANTE: Reinicie o PowerShell!" -ForegroundColor Yellow
```

### 🔧 Script de Ativação Rápida

**Arquivo:** `D:\Tools\activate-pico-env.ps1`

```powershell
$TOOLS_DIR = "D:\Tools"

$env:PICO_SDK_PATH = "$TOOLS_DIR\pico-sdk"
$env:PICO_TOOLCHAIN_PATH = "$TOOLS_DIR\arm-none-eabi-gcc\gcc-arm-none-eabi"
$env:PATH = "$env:PICO_TOOLCHAIN_PATH\bin;$TOOLS_DIR\Renode;$env:PATH"

Write-Host "🎯 Ambiente Pico SDK ativado!" -ForegroundColor Green
Write-Host "📂 SDK: $env:PICO_SDK_PATH" -ForegroundColor Cyan
Write-Host "🛠️ Toolchain: $env:PICO_TOOLCHAIN_PATH" -ForegroundColor Cyan

Write-Host "`n🔍 Verificando..." -ForegroundColor Cyan
cmake --version | Select-Object -First 1
arm-none-eabi-gcc --version | Select-Object -First 1
renode --version | Select-Object -First 1

Write-Host "`n✅ Pronto!" -ForegroundColor Green
```

**Uso:**
```powershell
. D:\Tools\activate-pico-env.ps1
```

---

## 8. Compilação de Firmware

### 📁 Estrutura do Projeto

```
server/test-firmware/rp2040/blink/
├── main.c                  # Código C
├── CMakeLists.txt          # Configuração do build
├── pico_sdk_import.cmake   # Import do SDK
├── test-blink.resc         # Script Renode
└── build/                  # Output (gerado)
```

### 🔨 Compilar

```powershell
cd D:\neuroforge\server\test-firmware\rp2040\blink

# Ativar ambiente
. D:\Tools\activate-pico-env.ps1

# Criar pasta de build
mkdir build -Force
cd build

# Opção 1: NMake (padrão Windows)
cmake -G "NMake Makefiles" ..
nmake

# Opção 2: Ninja (mais rápido)
cmake -G "Ninja" ..
ninja

# Verificar output
if (Test-Path "blink.elf") {
    Write-Host "✅ Compilação bem-sucedida!" -ForegroundColor Green
    ls blink.elf
}
```

### 📊 Arquivos Gerados

```
build/
├── blink.elf      # Binário para Renode (ELF ARM)
├── blink.uf2      # Binário para hardware real (drag-and-drop)
├── blink.bin      # Binário raw
├── blink.hex      # Intel HEX
└── blink.map      # Memory map
```

---

## 9. Teste com Renode

### ▶️ Executar

```powershell
# Terminal 1: Iniciar Renode
cd D:\neuroforge\server\test-firmware\rp2040\blink
renode test-blink.resc
```

**Saída esperada:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 NeuroForge RP2040 Blink Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Board: Raspberry Pi Pico
Firmware: build/blink.elf (Pico SDK)
UART TCP: localhost:1234
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Emulação iniciada!
```

### 📡 Conectar ao Serial

```powershell
# Terminal 2: Monitor serial
cd D:\neuroforge\server\test-firmware\rp2040\blink
.\monitor-serial.ps1
```

**Saída esperada:**
```
[21:35:12.456] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[21:35:12.456] NeuroForge GPIO Test - RP2040
[21:35:12.456] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[21:35:12.456] Board: Raspberry Pi Pico
[21:35:12.456] LED Pin: GP25
[21:35:12.456] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[21:35:13.456] 🔌 GPIO Pin 25 = HIGH
[21:35:13.456] LED ON
[21:35:14.456] 🔌 GPIO Pin 25 = LOW
[21:35:14.456] LED OFF
[21:35:15.456] 🔌 GPIO Pin 25 = HIGH
...
```

---

## 10. Integração com NeuroForge

### 🔗 Configurar .env

```env
# RP2040 Renode Configuration
RP2040_RENODE_PATH=D:\Tools\Renode\renode.exe
RP2040_SERIAL_PORT=1234
RP2040_MONITOR_PORT=1235
RP2040_DEFAULT_BOARD=raspberry-pi-pico

# Pico SDK
PICO_SDK_PATH=D:\Tools\pico-sdk
PICO_TOOLCHAIN_PATH=D:\Tools\arm-none-eabi-gcc\gcc-arm-none-eabi
```

---

## 11. Troubleshooting

### ❌ "cmake: command not found"

```powershell
winget install --id Kitware.CMake -e
# Reiniciar PowerShell
```

### ❌ "arm-none-eabi-gcc: not found"

```powershell
$env:PATH += ";D:\Tools\arm-none-eabi-gcc\gcc-arm-none-eabi\bin"
arm-none-eabi-gcc --version
```

### ❌ "PICO_SDK_PATH not set"

```powershell
$env:PICO_SDK_PATH = "D:\Tools\pico-sdk"
cmake -G "NMake Makefiles" ..
```

### ❌ "TCP port 1234 already in use"

```powershell
netstat -ano | findstr :1234
taskkill /PID <PID> /F
```

---

## 📚 Referências

- [Pico SDK GitHub](https://github.com/raspberrypi/pico-sdk)
- [Getting Started with Pico (PDF)](https://datasheets.raspberrypi.com/pico/getting-started-with-pico.pdf)
- [Renode Documentation](https://renode.readthedocs.io/)
- [ARM GCC Toolchain](https://developer.arm.com/Tools%20and%20Software/GNU%20Toolchain)

---

## 🎉 Próximos Passos

1. ✅ Pico SDK compila C → ELF
2. ✅ ELF roda no Renode
3. ✅ Serial TCP funciona (protocolo `G:pin=25,v=1`)
4. 🔜 Backend `Rp2040Backend.ts`
5. 🔜 Integração com `QEMUSimulationEngine`

**Status:** Ambiente completo! 🚀
