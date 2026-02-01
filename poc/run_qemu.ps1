# run_qemu.ps1 - Script para executar sketches no QEMU
# Uso: .\run_qemu.ps1 -Sketch blink

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("blink", "serial_test", "gpio_test")]
    [string]$Sketch
)

$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot

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
    }
    catch {}
    
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

# Criar arquivo de log para serial output
$logFile = "serial_output_$Sketch.log"
if (Test-Path $logFile) {
    Remove-Item $logFile
}

Write-Host "[INFO] Executando $Sketch no QEMU..." -ForegroundColor Yellow
Write-Host "[INFO] Serial output estará em: $logFile" -ForegroundColor Yellow
Write-Host "[INFO] Pressione Ctrl+C para parar" -ForegroundColor Yellow
Write-Host ""
Write-Host "===========================================" -ForegroundColor DarkGray
Write-Host ""

# Iniciar job para ler o log em tempo real
$tailJob = Start-Job -ScriptBlock {
    param($file)
    while (-not (Test-Path $file)) { Start-Sleep -Milliseconds 100 }
    Get-Content $file -Wait
} -ArgumentList (Resolve-Path -Path . | Join-Path -ChildPath $logFile)

# Executar QEMU com output para arquivo
try {
    & $qemuPath `
        -machine uno `
        -bios $elfPath `
        -serial file:$logFile `
        -nographic `
        -d guest_errors 2>&1 | Out-Null
}
catch {
    Write-Host "[ERROR] QEMU crashed: $_" -ForegroundColor Red
}
finally {
    # Parar job de tail
    Stop-Job $tailJob
    Remove-Job $tailJob
    
    # Mostrar conteúdo final do log
    Write-Host ""
    Write-Host "===========================================" -ForegroundColor DarkGray
    Write-Host "=== Serial Output Final ===" -ForegroundColor Cyan
    if (Test-Path $logFile) {
        Get-Content $logFile
    }
    else {
        Write-Host "[WARNING] Nenhum output serial capturado" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[INFO] Log salvo em: $logFile" -ForegroundColor Yellow
