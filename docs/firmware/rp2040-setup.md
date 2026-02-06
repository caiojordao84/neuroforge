# 🛠️ Guia Completo: Instalação RP2040 + Renode no Windows 11 (Arduino Workflow)

> **Autor:** NeuroForge Team  
> **Data:** 06/02/2026  
> **Plataforma:** Windows 11 (64-bit)  
> **Workflow:** Arduino CLI → ELF → Renode  
> **Shell:** PowerShell 5.1+

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Instalação do Renode](#instalação-do-renode)
3. [Instalação do Arduino CLI](#instalação-do-arduino-cli)
4. [Instalação do Core Arduino-Pico](#instalação-do-core-arduino-pico)
5. [Configuração de Ambiente](#configuração-de-ambiente)
6. [Compilação de Firmware Arduino](#compilação-de-firmware-arduino)
7. [Teste com Renode](#teste-com-renode)
8. [Integração com NeuroForge](#integração-com-neuroforge)
9. [Troubleshooting](#troubleshooting)

---

## 1. Pré-requisitos

### ✅ Checklist

Antes de começar, certifique-se de ter:

- [x] Windows 11 (64-bit)
- [x] PowerShell 5.1 ou superior
- [x] Conexão com internet estável
- [x] ~3 GB de espaço em disco livre
- [x] Git for Windows (recomendado)

### 🔍 Verificar PowerShell

```powershell
# Verificar versão do PowerShell
$PSVersionTable.PSVersion
# Deve mostrar: 5.1 ou superior
```

---

## 2. Instalação do Renode

### 📦 Instalação no D:\Tools\Renode

```powershell
# Criar estrutura de diretórios
$TOOLS_DIR = "D:\Tools"
New-Item -ItemType Directory -Force -Path $TOOLS_DIR
cd $TOOLS_DIR

# Baixar Renode 1.15.3 (versão estável)
$RENODE_VERSION = "1.15.3"
$RENODE_URL = "https://github.com/renode/renode/releases/download/v$RENODE_VERSION/renode-$RENODE_VERSION.zip"
$RENODE_ZIP = "$TOOLS_DIR\renode.zip"

Write-Host "📥 Baixando Renode $RENODE_VERSION..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $RENODE_URL -OutFile $RENODE_ZIP

Write-Host "📦 Extraindo Renode..." -ForegroundColor Cyan
Expand-Archive -Path $RENODE_ZIP -DestinationPath "$TOOLS_DIR\Renode" -Force

# Renomear pasta extraída
$ExtractedDir = Get-ChildItem -Path "$TOOLS_DIR\Renode" -Directory | Select-Object -First 1
if ($ExtractedDir -and $ExtractedDir.Name -ne "Renode") {
    Get-ChildItem -Path $ExtractedDir.FullName | Move-Item -Destination "$TOOLS_DIR\Renode" -Force
    Remove-Item $ExtractedDir.FullName -Force
}

# Limpar ZIP
Remove-Item $RENODE_ZIP

# Verificar instalação
$RENODE_EXE = "$TOOLS_DIR\Renode\renode.exe"
if (Test-Path $RENODE_EXE) {
    Write-Host "✅ Renode instalado em: $TOOLS_DIR\Renode" -ForegroundColor Green
    & $RENODE_EXE --version
} else {
    Write-Host "❌ Erro: Renode não encontrado em $RENODE_EXE" -ForegroundColor Red
}
```

### 🌍 Adicionar ao PATH

```powershell
# Adicionar Renode ao PATH do usuário
$CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$TOOLS_DIR\Renode*") {
    [System.Environment]::SetEnvironmentVariable(
        "PATH", 
        "$CurrentPath;$TOOLS_DIR\Renode", 
        "User"
    )
    Write-Host "✅ Renode adicionado ao PATH" -ForegroundColor Green
}

# Atualizar PATH da sessão atual
$env:PATH += ";$TOOLS_DIR\Renode"

# Testar
renode --version
```

---

## 3. Instalação do Arduino CLI

### 📥 Download e Instalação

```powershell
# Criar pasta para Arduino CLI
$ARDUINO_DIR = "$TOOLS_DIR\arduino-cli"
New-Item -ItemType Directory -Force -Path $ARDUINO_DIR

# Baixar Arduino CLI (última versão)
$ARDUINO_CLI_URL = "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"
$ARDUINO_CLI_ZIP = "$TOOLS_DIR\arduino-cli.zip"

Write-Host "📥 Baixando Arduino CLI..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $ARDUINO_CLI_URL -OutFile $ARDUINO_CLI_ZIP

Write-Host "📦 Extraindo Arduino CLI..." -ForegroundColor Cyan
Expand-Archive -Path $ARDUINO_CLI_ZIP -DestinationPath $ARDUINO_DIR -Force

# Limpar ZIP
Remove-Item $ARDUINO_CLI_ZIP

# Verificar instalação
$ARDUINO_CLI_EXE = "$ARDUINO_DIR\arduino-cli.exe"
if (Test-Path $ARDUINO_CLI_EXE) {
    Write-Host "✅ Arduino CLI instalado em: $ARDUINO_DIR" -ForegroundColor Green
    & $ARDUINO_CLI_EXE version
} else {
    Write-Host "❌ Erro: Arduino CLI não encontrado" -ForegroundColor Red
}
```

### 🌍 Adicionar ao PATH

```powershell
# Adicionar Arduino CLI ao PATH
$CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$ARDUINO_DIR*") {
    [System.Environment]::SetEnvironmentVariable(
        "PATH", 
        "$CurrentPath;$ARDUINO_DIR", 
        "User"
    )
    Write-Host "✅ Arduino CLI adicionado ao PATH" -ForegroundColor Green
}

# Atualizar PATH da sessão
$env:PATH += ";$ARDUINO_DIR"

# Testar
arduino-cli version
```

### 🔧 Configuração Inicial

```powershell
# Criar configuração padrão
arduino-cli config init

Write-Host "✅ Arduino CLI configurado" -ForegroundColor Green
Write-Host "📂 Configuração em: $env:LOCALAPPDATA\Arduino15" -ForegroundColor Cyan
```

---

## 4. Instalação do Core Arduino-Pico

### 📦 Adicionar Board Manager URL

```powershell
# Adicionar repositório arduino-pico (Earle Philhower)
$PICO_BOARD_URL = "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json"

arduino-cli config add board_manager.additional_urls $PICO_BOARD_URL

Write-Host "✅ URL do arduino-pico adicionada" -ForegroundColor Green
```

### 📥 Instalar Core RP2040

```powershell
# Atualizar índice de cores
Write-Host "📥 Atualizando índice de cores..." -ForegroundColor Cyan
arduino-cli core update-index

# Instalar core arduino-pico
Write-Host "📦 Instalando core RP2040 (aguarde, ~200 MB)..." -ForegroundColor Cyan
arduino-cli core install rp2040:rp2040

# Verificar instalação
arduino-cli core list

Write-Host "✅ Core RP2040 instalado com sucesso!" -ForegroundColor Green
```

### 🔍 Listar Boards Disponíveis

```powershell
# Listar todas as boards RP2040
arduino-cli board listall rp2040

# Saída esperada:
# Board Name                    FQBN
# Raspberry Pi Pico             rp2040:rp2040:rpipico
# Raspberry Pi Pico W           rp2040:rp2040:rpipicow
# Arduino Nano RP2040 Connect   rp2040:rp2040:nano_connect
# ...
```

---

## 5. Configuração de Ambiente

### 🌍 Variáveis de Ambiente

```powershell
# Definir variáveis para NeuroForge
[System.Environment]::SetEnvironmentVariable("RENODE_PATH", "D:\Tools\Renode", "User")
[System.Environment]::SetEnvironmentVariable("ARDUINO_CLI_PATH", "D:\Tools\arduino-cli", "User")

Write-Host "✅ Variáveis de ambiente configuradas" -ForegroundColor Green
```

### 🔧 Script de Ativação Rápida

**Arquivo:** `D:\Tools\activate-rp2040-env.ps1`

```powershell
# Script de ativação do ambiente RP2040
$TOOLS_DIR = "D:\Tools"

# Atualizar PATH da sessão
$env:PATH = "$TOOLS_DIR\Renode;$TOOLS_DIR\arduino-cli;$env:PATH"

Write-Host "🎯 Ambiente RP2040 ativado!" -ForegroundColor Green
Write-Host "📂 Renode: $TOOLS_DIR\Renode" -ForegroundColor Cyan
Write-Host "🛠️ Arduino CLI: $TOOLS_DIR\arduino-cli" -ForegroundColor Cyan

# Verificar ferramentas
Write-Host "`n🔍 Verificando ferramentas..." -ForegroundColor Cyan
renode --version | Select-Object -First 1
arduino-cli version

Write-Host "`n✅ Pronto para compilar!" -ForegroundColor Green
```

**Uso:**
```powershell
. D:\Tools\activate-rp2040-env.ps1
```

---

## 6. Compilação de Firmware Arduino

### 📁 Estrutura do Sketch Blink

**Localização:** `server/test-firmware/rp2040/blink/`

```
blink/
├── blink.ino          # Código Arduino
└── test-blink.resc    # Script Renode
```

### 🔨 Compilar Sketch

```powershell
# Navegar para o projeto
cd D:\neuroforge\server\test-firmware\rp2040\blink

# Ativar ambiente (se necessário)
. D:\Tools\activate-rp2040-env.ps1

# Compilar sketch para Raspberry Pi Pico
arduino-cli compile --fqbn rp2040:rp2040:rpipico --output-dir build blink.ino

# Verificar saída
if (Test-Path "build\blink.ino.elf") {
    Write-Host "✅ Firmware compilado: build\blink.ino.elf" -ForegroundColor Green
    Write-Host "📊 Tamanho:" -ForegroundColor Cyan
    Get-Item "build\blink.ino.elf" | Select-Object Name, Length
} else {
    Write-Host "❌ Erro na compilação" -ForegroundColor Red
}
```

### 📊 Arquivos Gerados

```
build/
├── blink.ino.elf      # Binário para Renode (ELF ARM)
├── blink.ino.bin      # Binário raw
├── blink.ino.hex      # Hexadecimal
├── blink.ino.uf2      # Binário para hardware real (UF2)
└── blink.ino.map      # Memory map
```

### 🎯 Opções de Compilação (Avançado)

```powershell
# Compilar com otimização de tamanho
arduino-cli compile --fqbn rp2040:rp2040:rpipico `
    --build-property "compiler.optimization_flags=-Os" `
    --output-dir build blink.ino

# Compilar com debug symbols
arduino-cli compile --fqbn rp2040:rp2040:rpipico `
    --build-property "build.debug_level=-g3" `
    --output-dir build blink.ino

# Ver saída verbose
arduino-cli compile --fqbn rp2040:rp2040:rpipico `
    --verbose --output-dir build blink.ino
```

---

## 7. Teste com Renode

### 📝 Script Renode Atualizado

**Arquivo:** `test-blink.resc` (já incluído no projeto)

O script está configurado para carregar `build/blink.ino.elf`.

### ▶️ Executar Teste

```powershell
# Terminal 1: Iniciar Renode
cd D:\neuroforge\server\test-firmware\rp2040\blink
renode test-blink.resc

# Saída esperada:
# 🚀 NeuroForge RP2040 Blink Test
# 📡 UART TCP: localhost:1234
# ✅ Emulação iniciada!
```

### 📡 Conectar ao Serial TCP

**Opção 1: NetCat (se instalado)**
```powershell
nc localhost 1234
```

**Opção 2: PowerShell Nativo**
```powershell
$client = New-Object System.Net.Sockets.TcpClient("localhost", 1234)
$stream = $client.GetStream()
$reader = New-Object System.IO.StreamReader($stream)

Write-Host "📡 Conectado ao serial RP2040" -ForegroundColor Green
Write-Host "Aguardando dados...`n" -ForegroundColor Cyan

while ($true) {
    $line = $reader.ReadLine()
    if ($line) {
        Write-Host $line
        
        # Detectar protocolo GPIO
        if ($line -match "G:pin=(\d+),v=([01])") {
            $pin = $matches[1]
            $value = $matches[2]
            $state = if ($value -eq "1") { "HIGH" } else { "LOW" }
            Write-Host "🔌 GPIO Event: Pin $pin = $state" -ForegroundColor Cyan
        }
    }
}
```

**Opção 3: Script Helper**

Criar `monitor-serial.ps1`:
```powershell
param([int]$Port = 1234)

$client = New-Object System.Net.Sockets.TcpClient("localhost", $Port)
$stream = $client.GetStream()
$reader = New-Object System.IO.StreamReader($stream)

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  📡 NeuroForge Serial Monitor" -ForegroundColor Cyan
Write-Host "  Port: $Port" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Cyan

try {
    while ($true) {
        $line = $reader.ReadLine()
        if ($line) {
            $timestamp = Get-Date -Format "HH:mm:ss.fff"
            
            if ($line -match "G:pin=(\d+),v=([01])") {
                Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
                Write-Host $line -ForegroundColor Yellow
            } else {
                Write-Host "[$timestamp] $line" -ForegroundColor White
            }
        }
    }
} finally {
    $client.Close()
}
```

**Uso:**
```powershell
.\monitor-serial.ps1
# OU com porta customizada:
.\monitor-serial.ps1 -Port 1234
```

### ✅ Saída Esperada

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
G:pin=25,v=1
LED ON
...
```

---

## 8. Integração com NeuroForge

### 🔗 Configurar .env

**Arquivo:** `server/.env`

```env
# RP2040 Renode Configuration
RP2040_RENODE_PATH=D:\Tools\Renode\renode.exe
RP2040_SERIAL_PORT=1234
RP2040_MONITOR_PORT=1235
RP2040_DEFAULT_BOARD=raspberry-pi-pico

# Arduino CLI
ARDUINO_CLI_PATH=D:\Tools\arduino-cli\arduino-cli.exe
RP2040_FQBN=rp2040:rp2040:rpipico
```

### 📝 Script de Compilação Integrado

**Arquivo:** `server/scripts/compile-rp2040.ps1`

```powershell
param(
    [Parameter(Mandatory=$true)]
    [string]$SketchPath,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "build",
    
    [Parameter(Mandatory=$false)]
    [string]$FQBN = "rp2040:rp2040:rpipico"
)

$ErrorActionPreference = "Stop"

# Verificar se sketch existe
if (!(Test-Path $SketchPath)) {
    Write-Host "❌ Sketch não encontrado: $SketchPath" -ForegroundColor Red
    exit 1
}

# Compilar
Write-Host "🔨 Compilando sketch RP2040..." -ForegroundColor Cyan
Write-Host "📂 Sketch: $SketchPath" -ForegroundColor Gray
Write-Host "📦 FQBN: $FQBN" -ForegroundColor Gray

try {
    arduino-cli compile --fqbn $FQBN --output-dir $OutputDir $SketchPath
    
    $ElfPath = Join-Path $OutputDir "$(Split-Path -Leaf $SketchPath).elf"
    
    if (Test-Path $ElfPath) {
        Write-Host "✅ Compilação bem-sucedida!" -ForegroundColor Green
        Write-Host "📄 ELF: $ElfPath" -ForegroundColor Cyan
        
        $Size = (Get-Item $ElfPath).Length
        Write-Host "📊 Tamanho: $([math]::Round($Size/1KB, 2)) KB" -ForegroundColor Cyan
        
        return $ElfPath
    } else {
        throw "ELF não encontrado após compilação"
    }
} catch {
    Write-Host "❌ Erro na compilação: $_" -ForegroundColor Red
    exit 1
}
```

---

## 9. Troubleshooting

### ❌ Problema: "renode.exe not found"

**Solução:**
```powershell
# Verificar instalação
Test-Path D:\Tools\Renode\renode.exe

# Se false, reinstalar:
cd D:\Tools
Invoke-WebRequest -Uri "https://github.com/renode/renode/releases/download/v1.15.3/renode-1.15.3.zip" -OutFile "renode.zip"
Expand-Archive -Path "renode.zip" -DestinationPath "Renode" -Force
```

### ❌ Problema: "arduino-cli: command not found"

**Solução:**
```powershell
# Adicionar ao PATH manualmente
$env:PATH += ";D:\Tools\arduino-cli"

# Testar
arduino-cli version

# Se falhar, verificar instalação:
Test-Path D:\Tools\arduino-cli\arduino-cli.exe
```

### ❌ Problema: "Core rp2040:rp2040 not found"

**Solução:**
```powershell
# Atualizar índice
arduino-cli core update-index

# Reinstalar core
arduino-cli core install rp2040:rp2040

# Verificar
arduino-cli core list
```

### ❌ Problema: "TCP port 1234 already in use"

**Solução:**
```powershell
# Encontrar processo
netstat -ano | findstr :1234

# Matar processo (substituir PID)
taskkill /PID <PID> /F

# OU mudar porta no .resc e .env
```

### ❌ Problema: Compilação falha com erro de memória

**Solução:**
```powershell
# Limpar cache do Arduino CLI
arduino-cli cache clean

# Recompilar
arduino-cli compile --fqbn rp2040:rp2040:rpipico --clean blink.ino
```

### ❌ Problema: Renode não mostra output serial

**Solução:**
```powershell
# Verificar se UART está configurado no sketch:
# Serial.begin(115200);

# Verificar se porta TCP está aberta:
Test-NetConnection -ComputerName localhost -Port 1234

# Verificar logs do Renode (na janela do Renode):
# logLevel 3
```

---

## 📚 Referências

- [Renode Documentation](https://renode.readthedocs.io/)
- [Arduino CLI Documentation](https://arduino.github.io/arduino-cli/)
- [Arduino-Pico Core (Earle Philhower)](https://github.com/earlephilhower/arduino-pico)
- [Raspberry Pi Pico Datasheet](https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf)
- [Renode RP2040 Support](https://github.com/renode/renode/tree/master/platforms/cpus)

---

## 🎉 Próximos Passos

Após concluir esta instalação:

1. ✅ Arduino CLI compila .ino para RP2040
2. ✅ ELF puro roda no Renode
3. ✅ Serial TCP funciona (`G:pin=25,v=1`)
4. 🔜 Integrar `Rp2040Backend.ts` no NeuroForge
5. 🔜 Conectar ao `QEMUSimulationEngine`
6. 🔜 Testar com componentes visuais (LED no canvas)

**Status:** Ambiente completo e funcional! 🚀
