#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Script automático de instalação do ambiente RP2040 para NeuroForge (Windows 11)
    Workflow: Arduino CLI → ELF → Renode

.DESCRIPTION
    Instala e configura:
    - Renode (emulador em D:\Tools\Renode)
    - Arduino CLI
    - Arduino-Pico Core (rp2040:rp2040)
    - Variáveis de ambiente

.PARAMETER ToolsDir
    Diretório base para instalação (padrão: D:\Tools)

.PARAMETER SkipRenode
    Pula instalação do Renode se já estiver instalado

.EXAMPLE
    .\rp2040-windows-install.ps1
    .\rp2040-windows-install.ps1 -ToolsDir "C:\Dev\Tools"

.NOTES
    Autor: NeuroForge Team
    Data: 06/02/2026
    Requer: PowerShell 5.1+, Privilégios de Administrador
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ToolsDir = "D:\Tools",
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipRenode
)

$ErrorActionPreference = "Continue"

# Cores
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

function Write-Step {
    param([string]$Message, [string]$Color = "White")
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Color
    Write-Host "  $Message" -ForegroundColor $Color
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $Color
}

Write-Step "🚀 NeuroForge RP2040 Setup - Windows 11" $ColorInfo
Write-Host "📂 Diretório: $ToolsDir" -ForegroundColor $ColorInfo

# Criar diretório base
if (!(Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    Write-Host "✅ Diretório criado: $ToolsDir" -ForegroundColor $ColorSuccess
}

# 1. INSTALAR RENODE
if (!$SkipRenode) {
    Write-Step "📦 1/3: Instalando Renode" $ColorInfo
    
    $RenodeVersion = "1.15.3"
    $RenodeUrl = "https://github.com/renode/renode/releases/download/v$RenodeVersion/renode-$RenodeVersion.zip"
    $RenodeZip = "$ToolsDir\renode.zip"
    $RenodePath = "$ToolsDir\Renode"
    
    try {
        Write-Host "📥 Baixando Renode $RenodeVersion..." -ForegroundColor $ColorInfo
        Invoke-WebRequest -Uri $RenodeUrl -OutFile $RenodeZip -ErrorAction Stop
        
        Write-Host "📦 Extraindo Renode..." -ForegroundColor $ColorInfo
        Expand-Archive -Path $RenodeZip -DestinationPath $RenodePath -Force
        
        # Mover arquivos da subpasta para raiz se necessário
        $ExtractedDir = Get-ChildItem -Path $RenodePath -Directory | Select-Object -First 1
        if ($ExtractedDir -and $ExtractedDir.Name -ne "Renode") {
            Get-ChildItem -Path $ExtractedDir.FullName | Move-Item -Destination $RenodePath -Force
            Remove-Item $ExtractedDir.FullName -Force
        }
        
        Remove-Item $RenodeZip -Force
        
        $RenodeExe = "$RenodePath\renode.exe"
        if (Test-Path $RenodeExe) {
            Write-Host "✅ Renode instalado: $RenodePath" -ForegroundColor $ColorSuccess
            & $RenodeExe --version
        }
    } catch {
        Write-Host "❌ Erro ao instalar Renode: $_" -ForegroundColor $ColorError
    }
}

# 2. INSTALAR ARDUINO CLI
Write-Step "📦 2/3: Instalando Arduino CLI" $ColorInfo

$ArduinoDir = "$ToolsDir\arduino-cli"
$ArduinoExe = "$ArduinoDir\arduino-cli.exe"

if (Test-Path $ArduinoExe) {
    Write-Host "⚠️ Arduino CLI já instalado" -ForegroundColor $ColorWarning
    & $ArduinoExe version
} else {
    try {
        New-Item -ItemType Directory -Force -Path $ArduinoDir | Out-Null
        
        $ArduinoUrl = "https://downloads.arduino.cc/arduino-cli/arduino-cli_latest_Windows_64bit.zip"
        $ArduinoZip = "$ToolsDir\arduino-cli.zip"
        
        Write-Host "📥 Baixando Arduino CLI..." -ForegroundColor $ColorInfo
        Invoke-WebRequest -Uri $ArduinoUrl -OutFile $ArduinoZip -ErrorAction Stop
        
        Write-Host "📦 Extraindo Arduino CLI..." -ForegroundColor $ColorInfo
        Expand-Archive -Path $ArduinoZip -DestinationPath $ArduinoDir -Force
        
        Remove-Item $ArduinoZip -Force
        
        if (Test-Path $ArduinoExe) {
            Write-Host "✅ Arduino CLI instalado" -ForegroundColor $ColorSuccess
            & $ArduinoExe version
            
            # Configurar
            & $ArduinoExe config init
        }
    } catch {
        Write-Host "❌ Erro ao instalar Arduino CLI: $_" -ForegroundColor $ColorError
    }
}

# 3. INSTALAR CORE RP2040
Write-Step "📦 3/3: Instalando Core Arduino-Pico" $ColorInfo

try {
    # Adicionar board manager URL
    $PicoBoardUrl = "https://github.com/earlephilhower/arduino-pico/releases/download/global/package_rp2040_index.json"
    
    Write-Host "📝 Adicionando URL do arduino-pico..." -ForegroundColor $ColorInfo
    & $ArduinoExe config add board_manager.additional_urls $PicoBoardUrl
    
    Write-Host "📥 Atualizando índice de cores..." -ForegroundColor $ColorInfo
    & $ArduinoExe core update-index
    
    Write-Host "📦 Instalando core RP2040 (aguarde, ~200 MB)..." -ForegroundColor $ColorInfo
    & $ArduinoExe core install rp2040:rp2040
    
    Write-Host "✅ Core RP2040 instalado!" -ForegroundColor $ColorSuccess
    & $ArduinoExe core list
} catch {
    Write-Host "❌ Erro ao instalar core RP2040: $_" -ForegroundColor $ColorError
}

# 4. CONFIGURAR PATH
Write-Step "🌍 Configurando Variáveis de Ambiente" $ColorInfo

try {
    $CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $NewPaths = @(
        "$ToolsDir\Renode",
        "$ToolsDir\arduino-cli"
    )
    
    foreach ($Path in $NewPaths) {
        if ($CurrentPath -notlike "*$Path*") {
            $CurrentPath += ";$Path"
            Write-Host "✅ Adicionado ao PATH: $Path" -ForegroundColor $ColorSuccess
        }
    }
    
    [System.Environment]::SetEnvironmentVariable("PATH", $CurrentPath, "User")
    
    # Variáveis específicas
    [System.Environment]::SetEnvironmentVariable("RENODE_PATH", "$ToolsDir\Renode", "User")
    [System.Environment]::SetEnvironmentVariable("ARDUINO_CLI_PATH", "$ToolsDir\arduino-cli", "User")
    
    Write-Host "✅ Variáveis configuradas" -ForegroundColor $ColorSuccess
} catch {
    Write-Host "❌ Erro ao configurar PATH: $_" -ForegroundColor $ColorError
}

# 5. CRIAR SCRIPT DE ATIVAÇÃO
Write-Step "📝 Criando Script de Ativação" $ColorInfo

$ActivationScript = @"
# Ativação do Ambiente RP2040 - NeuroForge
`$TOOLS_DIR = "$ToolsDir"

`$env:PATH = "`$TOOLS_DIR\Renode;`$TOOLS_DIR\arduino-cli;`$env:PATH"

Write-Host "🎯 Ambiente RP2040 ativado!" -ForegroundColor Green
Write-Host "📂 Renode: `$TOOLS_DIR\Renode" -ForegroundColor Cyan
Write-Host "🛠️ Arduino CLI: `$TOOLS_DIR\arduino-cli" -ForegroundColor Cyan

Write-Host "``n🔍 Verificando ferramentas..." -ForegroundColor Cyan
renode --version | Select-Object -First 1
arduino-cli version

Write-Host "``n✅ Pronto para compilar!" -ForegroundColor Green
"@

$ActivationScriptPath = "$ToolsDir\activate-rp2040-env.ps1"
$ActivationScript | Out-File -FilePath $ActivationScriptPath -Encoding UTF8
Write-Host "✅ Script criado: $ActivationScriptPath" -ForegroundColor $ColorSuccess

# FINALIZAÇÃO
Write-Step "🎉 Instalação Concluída!" $ColorSuccess

Write-Host @"
📋 Próximos Passos:

1️⃣  REINICIE O POWERSHELL

2️⃣  Ative o ambiente:
   . $ActivationScriptPath

3️⃣  Compile o firmware:
   cd D:\neuroforge\server\test-firmware\rp2040\blink
   arduino-cli compile --fqbn rp2040:rp2040:rpipico --output-dir build blink.ino

4️⃣  Teste com Renode:
   renode test-blink.resc

5️⃣  Conecte ao serial:
   .\monitor-serial.ps1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 Documentação: docs/firmware/rp2040-setup.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor $ColorInfo

Write-Host "`n✅ Setup concluído!" -ForegroundColor $ColorSuccess
