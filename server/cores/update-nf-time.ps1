# Quick update nf_time.cpp in installed core

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NeuroForge Time - Quick Update" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ARDUINO_DATA = "$env:LOCALAPPDATA\Arduino15"
$AVR_PATH = Get-ChildItem -Path "$ARDUINO_DATA\packages\arduino\hardware\avr" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if (-not $AVR_PATH) {
    Write-Host "[X] Core Arduino AVR nao encontrado!" -ForegroundColor Red
    exit 1
}

$AVR_VERSION = $AVR_PATH.Name
$NF_CORE_DIR = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION\cores\neuroforge_qemu"

if (-not (Test-Path $NF_CORE_DIR)) {
    Write-Host "[X] Core neuroforge_qemu nao encontrado!" -ForegroundColor Red
    Write-Host "[!] Execute install-core.ps1 primeiro!" -ForegroundColor Yellow
    exit 1
}

Write-Host "[...] Atualizando nf_time.cpp..." -ForegroundColor Cyan

$REPO_CORE = "$PSScriptRoot\neuroforge_qemu"

Copy-Item -Path "$REPO_CORE\nf_time.cpp" -Destination $NF_CORE_DIR -Force

if (Test-Path "$NF_CORE_DIR\nf_time.cpp") {
    Write-Host "[OK] nf_time.cpp atualizado!" -ForegroundColor Green
} else {
    Write-Host "[X] Falha ao atualizar nf_time.cpp" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Atualizacao concluida!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Reiniciar backend: npm run dev" -ForegroundColor White
Write-Host "2. Compile & Run novamente" -ForegroundColor White
Write-Host ""
