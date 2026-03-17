# compile.ps1 - Script para compilar todos os sketches de teste
# Uso: .\compile.ps1 [-Sketch <name>]
# Exemplo: .\compile.ps1 -Sketch blink

param(
    [string]$Sketch = $null
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

Write-Host "=== NeuroForge QEMU POC - Compilation Script ===" -ForegroundColor Cyan
Write-Host ""

# Verificar arduino-cli
if (-not (Get-Command arduino-cli -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] arduino-cli não encontrado!" -ForegroundColor Red
    Write-Host "Instale com: choco install arduino-cli -y" -ForegroundColor Yellow
    exit 1
}

# Verificar core Arduino AVR
Write-Host "[INFO] Verificando Arduino AVR core..." -ForegroundColor Yellow
$cores = arduino-cli core list
if ($cores -notmatch "arduino:avr") {
    Write-Host "[INFO] Instalando Arduino AVR core..." -ForegroundColor Yellow
    arduino-cli core update-index
    arduino-cli core install arduino:avr
}

Write-Host "[OK] Arduino AVR core instalado" -ForegroundColor Green
Write-Host ""

# Compilar sketches
if ($Sketch) {
    if ($Sketch -like "*\*") {
        $sketches = @($Sketch)
    }
    else {
        # Se passado apenas o nome (ex: blink), encontrar o .ino
        $found = Get-ChildItem -Path $Sketch -Filter "*.ino" -ErrorAction SilentlyContinue
        if ($found) {
            $sketches = @("$Sketch\$($found.Name)")
        }
        else {
            Write-Host "[ERROR] Sketch '$Sketch' não encontrado!" -ForegroundColor Red
            exit 1
        }
    }
}
else {
    $sketches = @(
        "blink\blink.ino",
        "serial_test\serial_test.ino",
        "gpio_test\gpio_test.ino"
    )
}

foreach ($sketch in $sketches) {
    $sketchName = Split-Path $sketch -Leaf
    $sketchFolder = Split-Path $sketch -Parent
    $outputDir = Join-Path "build" $sketchFolder
    
    Write-Host "[COMPILING] $sketchName" -ForegroundColor Cyan
    Write-Host "[OUTPUT] $outputDir" -ForegroundColor Gray
    
    # Garantir que o diretório de destino existe
    if (-not (Test-Path $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }

    arduino-cli compile --fqbn arduino:avr:uno (Resolve-Path $sketch) --output-dir (Resolve-Path $outputDir) --libraries .\libraries
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $sketchName compilado com sucesso" -ForegroundColor Green
    }
    else {
        Write-Host "[ERROR] Falha ao compilar $sketchName" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== Compilação concluída ===" -ForegroundColor Cyan
Write-Host "Arquivos em: .\build\" -ForegroundColor Yellow
