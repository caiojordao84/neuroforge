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
    Write-Host "1. Adicione ao PATH: `$env:Path += ';C:\Program Files\qemu'" -ForegroundColor Gray
    Write-Host "2. Execute: .\fix_qemu_path.ps1" -ForegroundColor Gray
    Write-Host "3. Reinstale: .\install_qemu_avr.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host "[OK] QEMU encontrado: $qemuPath" -ForegroundColor Green
Write-Host ""

# Tentar diferentes padrões de caminho do firmware
$possiblePaths = @(
    "build\$Sketch\$Sketch.ino.elf",
    "build\$Sketch`_$Sketch\$Sketch.ino.elf",
    "build\$Sketch`_$Sketch.ino\$Sketch.ino.elf",
    "$Sketch\build\arduino.avr.uno\$Sketch.ino.elf"
)

$elfPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $elfPath = $path
        break
    }
}

if (-not $elfPath) {
    Write-Host "[ERROR] Firmware não encontrado!" -ForegroundColor Red
    Write-Host "Procurado em:" -ForegroundColor Yellow
    foreach ($path in $possiblePaths) {
        Write-Host "  - $path" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Execute primeiro: .\compile.ps1" -ForegroundColor Yellow
    
    # Listar o que existe no build
    if (Test-Path "build") {
        Write-Host ""
        Write-Host "Conteúdo de build/:" -ForegroundColor Yellow
        Get-ChildItem -Path build -Recurse | Where-Object { $_.Extension -eq ".elf" } | ForEach-Object {
            Write-Host "  - $($_.FullName)" -ForegroundColor Gray
        }
    }
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
$machineNames = @("uno", "arduino-uno", "arduino-mega-2560-v3", "arduino-mega", "arduino")
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
    Write-Host "[WARNING] Nenhuma máquina Arduino encontrada" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Máquinas AVR disponíveis:" -ForegroundColor Yellow
    & $qemuPath -machine help 2>&1 | Select-String "avr" | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "[INFO] Tentando Arduino Mega..." -ForegroundColor Yellow
    
    # Fallback: tentar arduino-mega
    & $qemuPath `
        -machine arduino-mega-2560-v3 `
        -bios $elfPath `
        -serial stdio `
        -nographic
}
