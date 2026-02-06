#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Instalação automática Raspberry Pi Pico SDK + Renode (Windows 11)

.DESCRIPTION
    Instala e configura:
    - Renode (emulador em D:\Tools\Renode)
    - Pico SDK oficial (via Git)
    - ARM GCC Toolchain (arm-none-eabi-gcc)
    - CMake
    - Ninja (opcional)
    - Variáveis de ambiente

.PARAMETER ToolsDir
    Diretório base (padrão: D:\Tools)

.EXAMPLE
    .\rp2040-windows-install.ps1

.NOTES
    Autor: NeuroForge Team
    Data: 06/02/2026
    Requer: PowerShell 5.1+, Admin
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$ToolsDir = "D:\Tools"
)

$ErrorActionPreference = "Continue"

# Cores
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

function Write-Step {
    param([string]$Message, [string]$Color = "White")
    Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $Color
    Write-Host "  $Message" -ForegroundColor $Color
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor $Color
}

Write-Step "🚀 NeuroForge RP2040 Setup - Pico SDK Puro" $ColorInfo
Write-Host "📂 Diretório: $ToolsDir" -ForegroundColor $ColorInfo

if (!(Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
}

# 1. RENODE
Write-Step "📦 1/5: Instalando Renode" $ColorInfo

$RenodeVersion = "1.15.3"
$RenodeUrl = "https://github.com/renode/renode/releases/download/v$RenodeVersion/renode-$RenodeVersion.zip"
$RenodeZip = "$ToolsDir\renode.zip"
$RenodePath = "$ToolsDir\Renode"

try {
    Write-Host "📥 Baixando Renode..." -ForegroundColor $ColorInfo
    Invoke-WebRequest -Uri $RenodeUrl -OutFile $RenodeZip -ErrorAction Stop
    
    Write-Host "📦 Extraindo..." -ForegroundColor $ColorInfo
    Expand-Archive -Path $RenodeZip -DestinationPath $RenodePath -Force
    
    $ExtractedDir = Get-ChildItem -Path $RenodePath -Directory | Select-Object -First 1
    if ($ExtractedDir -and $ExtractedDir.Name -ne "Renode") {
        Get-ChildItem -Path $ExtractedDir.FullName | Move-Item -Destination $RenodePath -Force
        Remove-Item $ExtractedDir.FullName -Force
    }
    
    Remove-Item $RenodeZip -Force
    Write-Host "✅ Renode instalado" -ForegroundColor $ColorSuccess
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
}

# 2. PICO SDK
Write-Step "📦 2/5: Clonando Pico SDK" $ColorInfo

$PicoSdkPath = "$ToolsDir\pico-sdk"

if (Test-Path $PicoSdkPath) {
    Write-Host "⚠️ Pico SDK já existe" -ForegroundColor $ColorWarning
} else {
    try {
        if (!(Get-Command git -ErrorAction SilentlyContinue)) {
            winget install --id Git.Git -e --source winget --silent
        }
        
        Write-Host "📥 Clonando Pico SDK (~500 MB)..." -ForegroundColor $ColorInfo
        git clone --depth 1 --branch master https://github.com/raspberrypi/pico-sdk.git $PicoSdkPath
        
        Push-Location $PicoSdkPath
        Write-Host "📦 Inicializando submódulos..." -ForegroundColor $ColorInfo
        git submodule update --init --recursive
        Pop-Location
        
        Write-Host "✅ Pico SDK instalado" -ForegroundColor $ColorSuccess
    } catch {
        Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
    }
}

# 3. ARM GCC
Write-Step "📦 3/5: Instalando ARM GCC" $ColorInfo

$ArmGccDir = "$ToolsDir\arm-none-eabi-gcc"
$ArmGccBin = "$ArmGccDir\gcc-arm-none-eabi\bin\arm-none-eabi-gcc.exe"

if (Test-Path $ArmGccBin) {
    Write-Host "⚠️ ARM GCC já instalado" -ForegroundColor $ColorWarning
} else {
    try {
        $ArmGccVersion = "13.2.Rel1"
        $ArmGccUrl = "https://developer.arm.com/-/media/Files/downloads/gnu/$ArmGccVersion/binrel/arm-gnu-toolchain-$ArmGccVersion-mingw-w64-i686-arm-none-eabi.zip"
        $ArmGccZip = "$ToolsDir\arm-gcc.zip"
        
        Write-Host "📥 Baixando ARM GCC (~300 MB)..." -ForegroundColor $ColorInfo
        Invoke-WebRequest -Uri $ArmGccUrl -OutFile $ArmGccZip -ErrorAction Stop
        
        Write-Host "📦 Extraindo..." -ForegroundColor $ColorInfo
        Expand-Archive -Path $ArmGccZip -DestinationPath $ArmGccDir -Force
        
        $ExtractedDir = Get-ChildItem -Path $ArmGccDir -Directory | Select-Object -First 1
        if ($ExtractedDir) {
            Move-Item -Path $ExtractedDir.FullName -Destination "$ArmGccDir\gcc-arm-none-eabi" -Force
        }
        
        Remove-Item $ArmGccZip -Force
        Write-Host "✅ ARM GCC instalado" -ForegroundColor $ColorSuccess
    } catch {
        Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
    }
}

# 4. CMAKE
Write-Step "📦 4/5: Instalando CMake" $ColorInfo

if (Get-Command cmake -ErrorAction SilentlyContinue) {
    Write-Host "✅ CMake já instalado" -ForegroundColor $ColorSuccess
} else {
    winget install --id Kitware.CMake -e --source winget --silent
    Write-Host "✅ CMake instalado" -ForegroundColor $ColorSuccess
}

# 5. NINJA (opcional)
Write-Step "📦 5/5: Instalando Ninja (opcional)" $ColorInfo

if (Get-Command ninja -ErrorAction SilentlyContinue) {
    Write-Host "✅ Ninja já instalado" -ForegroundColor $ColorSuccess
} else {
    winget install Ninja-build.Ninja --silent
    Write-Host "✅ Ninja instalado" -ForegroundColor $ColorSuccess
}

# 6. CONFIGURAR AMBIENTE
Write-Step "🌍 Configurando Ambiente" $ColorInfo

try {
    [System.Environment]::SetEnvironmentVariable("PICO_SDK_PATH", "$ToolsDir\pico-sdk", "User")
    [System.Environment]::SetEnvironmentVariable("PICO_TOOLCHAIN_PATH", "$ArmGccDir\gcc-arm-none-eabi", "User")
    
    $CurrentPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
    $NewPaths = @(
        "$ArmGccDir\gcc-arm-none-eabi\bin",
        "$ToolsDir\Renode"
    )
    
    foreach ($Path in $NewPaths) {
        if ($CurrentPath -notlike "*$Path*") {
            $CurrentPath += ";$Path"
        }
    }
    
    [System.Environment]::SetEnvironmentVariable("PATH", $CurrentPath, "User")
    Write-Host "✅ Variáveis configuradas" -ForegroundColor $ColorSuccess
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor $ColorError
}

# 7. SCRIPT DE ATIVAÇÃO
$ActivationScript = @"
`$TOOLS_DIR = "$ToolsDir"
`$env:PICO_SDK_PATH = "`$TOOLS_DIR\pico-sdk"
`$env:PICO_TOOLCHAIN_PATH = "`$TOOLS_DIR\arm-none-eabi-gcc\gcc-arm-none-eabi"
`$env:PATH = "`$env:PICO_TOOLCHAIN_PATH\bin;`$TOOLS_DIR\Renode;`$env:PATH"

Write-Host "🎯 Ambiente Pico SDK ativado!" -ForegroundColor Green
Write-Host "📂 SDK: `$env:PICO_SDK_PATH" -ForegroundColor Cyan
cmake --version | Select-Object -First 1
arm-none-eabi-gcc --version | Select-Object -First 1
renode --version | Select-Object -First 1
Write-Host "`n✅ Pronto!" -ForegroundColor Green
"@

$ActivationScriptPath = "$ToolsDir\activate-pico-env.ps1"
$ActivationScript | Out-File -FilePath $ActivationScriptPath -Encoding UTF8

Write-Step "🎉 Instalação Concluída!" $ColorSuccess

Write-Host @"
📋 Próximos Passos:

1️⃣  REINICIE O POWERSHELL

2️⃣  Ative o ambiente:
   . $ActivationScriptPath

3️⃣  Compile:
   cd D:\neuroforge\server\test-firmware\rp2040\blink
   mkdir build; cd build
   cmake -G "NMake Makefiles" ..
   nmake

4️⃣  Teste:
   renode ..\test-blink.resc

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 docs/firmware/rp2040-setup.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"@ -ForegroundColor $ColorInfo

Write-Host "✅ Setup concluído!" -ForegroundColor $ColorSuccess
