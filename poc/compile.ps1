# compile.ps1 - Script para compilar todos os sketches de teste
# Uso: .\compile.ps1

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
$sketches = @(
    "blink\blink.ino",
    "serial_test\serial_test.ino",
    "gpio_test\gpio_test.ino"
)

foreach ($sketch in $sketches) {
    $sketchName = Split-Path $sketch -Leaf
    Write-Host "[COMPILING] $sketchName" -ForegroundColor Cyan
    
    arduino-cli compile --fqbn arduino:avr:uno $sketch --output-dir "build\$($sketch.Replace('\', '_').Replace('.ino', ''))"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] $sketchName compilado com sucesso" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Falha ao compilar $sketchName" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "=== Compilação concluída ===" -ForegroundColor Cyan
Write-Host "Arquivos em: .\build\" -ForegroundColor Yellow
