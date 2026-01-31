# run_qemu.ps1 - Script para executar sketches no QEMU
# Uso: .\run_qemu.ps1 -Sketch blink

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("blink", "serial_test", "gpio_test")]
    [string]$Sketch
)

Write-Host "=== NeuroForge QEMU Runner ===" -ForegroundColor Cyan
Write-Host ""

# Verificar QEMU
if (-not (Get-Command qemu-system-avr -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] qemu-system-avr não encontrado!" -ForegroundColor Red
    Write-Host "Instale com: choco install qemu -y" -ForegroundColor Yellow
    exit 1
}

# Path do firmware
$elfPath = "build\$Sketch`_$Sketch.ino\$Sketch.ino.elf"

if (-not (Test-Path $elfPath)) {
    Write-Host "[ERROR] Firmware não encontrado: $elfPath" -ForegroundColor Red
    Write-Host "Execute primeiro: .\compile.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Executando $Sketch no QEMU..." -ForegroundColor Yellow
Write-Host "[INFO] Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""

# Listar máquinas disponíveis
$machines = qemu-system-avr -machine help 2>&1
Write-Host "[DEBUG] Máquinas QEMU disponíveis:" -ForegroundColor Gray
Write-Host $machines -ForegroundColor Gray
Write-Host ""

# Tentar diferentes nomes de máquina
$machineNames = @("uno", "arduino-uno", "arduino")
$machineFound = $false

foreach ($machine in $machineNames) {
    if ($machines -match $machine) {
        Write-Host "[OK] Usando machine: $machine" -ForegroundColor Green
        $machineFound = $true
        
        # Executar QEMU
        qemu-system-avr `
            -machine $machine `
            -bios $elfPath `
            -serial stdio `
            -nographic
        
        break
    }
}

if (-not $machineFound) {
    Write-Host "[WARNING] Máquina 'uno' não encontrada, tentando modo genérico..." -ForegroundColor Yellow
    
    # Fallback: modo genérico AVR
    qemu-system-avr `
        -cpu avr6 `
        -bios $elfPath `
        -serial stdio `
        -nographic
}
