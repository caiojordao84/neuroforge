# run_qemu.ps1 - Script para executar sketches no QEMU
# Uso: .\run_qemu.ps1 -Sketch blink

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("blink", "serial_test", "gpio_test")]
    [string]$Sketch
)

Write-Host "=== NeuroForge QEMU Runner ===" -ForegroundColor Cyan
Write-Host ""

# Função para localizar QEMU
function Find-QEMU {
    $possiblePaths = @(
        "C:\Program Files\qemu\qemu-system-avr.exe",
        "C:\ProgramData\chocolatey\lib\Qemu\tools\qemu-system-avr.exe",
        "C:\qemu\qemu-system-avr.exe",
        "$env:LOCALAPPDATA\Programs\qemu\qemu-system-avr.exe"
    )
    
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            return $path
        }
    }
    
    # Tentar encontrar via Get-Command
    try {
        $cmd = Get-Command qemu-system-avr -ErrorAction SilentlyContinue
        if ($cmd) {
            return $cmd.Source
        }
    } catch {}
    
    return $null
}

# Localizar QEMU
$qemuPath = Find-QEMU

if (-not $qemuPath) {
    Write-Host "[ERROR] qemu-system-avr não encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Opções:" -ForegroundColor Yellow
    Write-Host "1. Execute: .\fix_qemu_path.ps1" -ForegroundColor Gray
    Write-Host "2. Localize manualmente:" -ForegroundColor Gray
    Write-Host "   Get-ChildItem -Path C:\ -Filter qemu-system-avr.exe -Recurse -ErrorAction SilentlyContinue" -ForegroundColor DarkGray
    Write-Host "3. Reinstale: choco uninstall qemu -y; choco install qemu -y" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] QEMU encontrado: $qemuPath" -ForegroundColor Green
Write-Host ""

# Path do firmware
$buildFolder = "build\$Sketch`_$Sketch.ino"
$elfPath = "$buildFolder\$Sketch.ino.elf"

if (-not (Test-Path $elfPath)) {
    Write-Host "[ERROR] Firmware não encontrado: $elfPath" -ForegroundColor Red
    Write-Host "Execute primeiro: .\compile.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Firmware: $elfPath" -ForegroundColor Yellow
Write-Host "[INFO] Tamanho: $((Get-Item $elfPath).Length) bytes" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Executando $Sketch no QEMU..." -ForegroundColor Yellow
Write-Host "[INFO] Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""
Write-Host "===========================================" -ForegroundColor DarkGray
Write-Host ""

# Listar máquinas disponíveis
$machines = & $qemuPath -machine help 2>&1

# Tentar diferentes nomes de máquina
$machineNames = @("uno", "arduino-uno", "arduino", "avr")
$machineFound = $false

foreach ($machine in $machineNames) {
    if ($machines -match $machine) {
        Write-Host "[DEBUG] Usando machine: $machine" -ForegroundColor DarkGray
        Write-Host ""
        $machineFound = $true
        
        # Executar QEMU
        & $qemuPath `
            -machine $machine `
            -bios $elfPath `
            -serial stdio `
            -nographic `
            -d guest_errors
        
        break
    }
}

if (-not $machineFound) {
    Write-Host "[WARNING] Máquina Arduino não encontrada nas opções:" -ForegroundColor Yellow
    Write-Host $machines -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "[INFO] Tentando modo genérico AVR..." -ForegroundColor Yellow
    Write-Host ""
    
    # Fallback: modo genérico AVR
    & $qemuPath `
        -M help 2>&1 | Select-String "avr" | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    
    Write-Host ""
    Write-Host "[ERROR] QEMU instalado pode não ter suporte a AVR" -ForegroundColor Red
    Write-Host "Versão do QEMU:" -ForegroundColor Yellow
    & $qemuPath --version | Select-Object -First 1
    Write-Host ""
    Write-Host "QEMU precisa ser versão 5.1+ para suporte AVR" -ForegroundColor Yellow
}
