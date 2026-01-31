# Patch wiring.c to disable original timing functions
# This allows nf_arduino_time.cpp to override them

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NeuroForge Time - Patching wiring.c" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Find wiring.c in neuroforge_qemu core
$ARDUINO_DATA = "$env:LOCALAPPDATA\Arduino15"
$AVR_PATH = Get-ChildItem -Path "$ARDUINO_DATA\packages\arduino\hardware\avr" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if (-not $AVR_PATH) {
    Write-Host "❌ Core Arduino AVR não encontrado!" -ForegroundColor Red
    exit 1
}

$AVR_VERSION = $AVR_PATH.Name
$WIRING_FILE = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION\cores\neuroforge_qemu\wiring.c"

if (-not (Test-Path $WIRING_FILE)) {
    Write-Host "❌ wiring.c não encontrado em: $WIRING_FILE" -ForegroundColor Red
    Write-Host "💡 Execute install-core.ps1 primeiro!" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Encontrado: $WIRING_FILE" -ForegroundColor Green

# 2. Backup
$BACKUP_FILE = "$WIRING_FILE.backup"
if (-not (Test-Path $BACKUP_FILE)) {
    Copy-Item -Path $WIRING_FILE -Destination $BACKUP_FILE
    Write-Host "💾 Backup criado: $BACKUP_FILE" -ForegroundColor Green
}

# 3. Read file
$content = Get-Content $WIRING_FILE -Raw

# 4. Check if already patched
if ($content -match "#define NEUROFORGE_TIME_PATCHED") {
    Write-Host "⚠️  wiring.c já foi patchado anteriormente!" -ForegroundColor Yellow
    Write-Host "✅ Nada a fazer." -ForegroundColor Green
    exit 0
}

Write-Host "🔧 Aplicando patch..." -ForegroundColor Cyan

# 5. Add patch marker at the beginning
$patchedContent = "// NEUROFORGE_TIME_PATCHED - timing functions disabled`n"
$patchedContent += "#define NEUROFORGE_TIME_PATCHED`n`n"
$patchedContent += $content

# 6. Disable millis() function
$patchedContent = $patchedContent -replace '(?s)(unsigned long millis\(\)\s*\{.*?\n\})', '/* NEUROFORGE_TIME: Original millis() disabled`n$1`n*/'

# 7. Disable micros() function
$patchedContent = $patchedContent -replace '(?s)(unsigned long micros\(\)\s*\{.*?\n\})', '/* NEUROFORGE_TIME: Original micros() disabled`n$1`n*/'

# 8. Disable delay() function
$patchedContent = $patchedContent -replace '(?s)(void delay\(unsigned long ms\)\s*\{.*?\n\})', '/* NEUROFORGE_TIME: Original delay() disabled`n$1`n*/'

# 9. Save patched file
Set-Content -Path $WIRING_FILE -Value $patchedContent -NoNewline

Write-Host "✅ Patch aplicado com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Funções desabilitadas:" -ForegroundColor Cyan
Write-Host "  • millis()" -ForegroundColor Gray
Write-Host "  • micros()" -ForegroundColor Gray
Write-Host "  • delay()" -ForegroundColor Gray
Write-Host ""
Write-Host "Substituídas por: nf_arduino_time.cpp (NeuroForge Time)" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Pronto! Tente compilar novamente." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
