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
    Write-Host "[X] Core Arduino AVR nao encontrado!" -ForegroundColor Red
    exit 1
}

$AVR_VERSION = $AVR_PATH.Name
$WIRING_FILE = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION\cores\neuroforge_qemu\wiring.c"

if (-not (Test-Path $WIRING_FILE)) {
    Write-Host "[X] wiring.c nao encontrado em: $WIRING_FILE" -ForegroundColor Red
    Write-Host "[!] Execute install-core.ps1 primeiro!" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Encontrado: $WIRING_FILE" -ForegroundColor Green

# 2. Backup
$BACKUP_FILE = "$WIRING_FILE.backup"
if (-not (Test-Path $BACKUP_FILE)) {
    Copy-Item -Path $WIRING_FILE -Destination $BACKUP_FILE
    Write-Host "[OK] Backup criado: $BACKUP_FILE" -ForegroundColor Green
}

# 3. Read file
$content = Get-Content $WIRING_FILE -Raw

# 4. Check if already patched
if ($content -match "#define NEUROFORGE_TIME_PATCHED") {
    Write-Host "[!] wiring.c ja foi patchado anteriormente!" -ForegroundColor Yellow
    Write-Host "[OK] Nada a fazer." -ForegroundColor Green
    exit 0
}

Write-Host "[...] Aplicando patch..." -ForegroundColor Cyan

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

Write-Host "[OK] wiring.c patch aplicado!" -ForegroundColor Green

# 10. Patch wiring_digital.c
$WIRING_DIGITAL_FILE = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION\cores\neuroforge_qemu\wiring_digital.c"

Write-Host ""
Write-Host "[...] Aplicando patch no wiring_digital.c..." -ForegroundColor Cyan

if (-not (Test-Path $WIRING_DIGITAL_FILE)) {
    Write-Host "[X] wiring_digital.c nao encontrado!" -ForegroundColor Red
    exit 1
}

# Backup
$DIGITAL_BACKUP = "$WIRING_DIGITAL_FILE.backup"
if (-not (Test-Path $DIGITAL_BACKUP)) {
    Copy-Item -Path $WIRING_DIGITAL_FILE -Destination $DIGITAL_BACKUP
}

$digitalContent = Get-Content $WIRING_DIGITAL_FILE -Raw

if ($digitalContent -match "nf_report_gpio") {
    Write-Host "[!] wiring_digital.c ja possui o reporte GPIO." -ForegroundColor Yellow
}
else {
    # Add includes
    $digitalContent = $digitalContent -replace '#include "wiring_private.h"', "#include `"wiring_private.h`"`n#include `"nf_gpio.h`""
    
    # Inject nf_report_mode in pinMode (at the end of the function)
    # We look for the final closing brace of pinMode
    $digitalContent = $digitalContent -replace '(?s)(void pinMode\(uint8_t pin, uint8_t mode\)\s*\{.*?\n)(\})', "`$1`n	// NeuroForge: Report mode change`n	nf_report_mode(pin, mode);`n`$2"
    
    # Inject nf_report_gpio in digitalWrite (at the end of the function)
    $digitalContent = $digitalContent -replace '(?s)(void digitalWrite\(uint8_t pin, uint8_t val\)\s*\{.*?\n)(\})', "`$1`n	// NeuroForge: Report GPIO change`n	nf_report_gpio(pin, val);`n`$2"

    Set-Content -Path $WIRING_DIGITAL_FILE -Value $digitalContent -NoNewline
    Write-Host "[OK] wiring_digital.c patch aplicado!" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Pronto! Tente compilar novamente." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
exit 0
