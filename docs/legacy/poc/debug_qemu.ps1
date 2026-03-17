# debug_qemu.ps1 - Executa QEMU com monitor para debug
# Uso: .\debug_qemu.ps1 -Sketch serial_test

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("blink", "serial_test", "gpio_test")]
    [string]$Sketch
)

Write-Host "=== QEMU Debug Mode ===" -ForegroundColor Cyan
Write-Host ""

$qemuPath = "C:\Program Files\qemu\qemu-system-avr.exe"

# Localizar firmware
$possiblePaths = @(
    "build\$Sketch\$Sketch.ino.elf",
    "build\$Sketch`_$Sketch\$Sketch.ino.elf",
    "build\$Sketch`_$Sketch.ino\$Sketch.ino.elf"
)

$elfPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $elfPath = $path
        break
    }
}

if (-not $elfPath) {
    Write-Host "[ERROR] Firmware não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Firmware: $elfPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "[INFO] Comandos úteis do monitor QEMU:" -ForegroundColor Yellow
Write-Host "  info registers     - Ver registradores CPU" -ForegroundColor Gray
Write-Host "  x/1xb 0x25        - Ler PORTB (endereço 0x25)" -ForegroundColor Gray
Write-Host "  x/1xb 0x28        - Ler PORTC (endereço 0x28)" -ForegroundColor Gray
Write-Host "  x/1xb 0x2B        - Ler PORTD (endereço 0x2B)" -ForegroundColor Gray
Write-Host "  info qtree        - Ver árvore de devices" -ForegroundColor Gray
Write-Host "  cont              - Continuar execução" -ForegroundColor Gray
Write-Host "  quit              - Sair" -ForegroundColor Gray
Write-Host ""
Write-Host "Pressione Enter para iniciar..." -ForegroundColor Yellow
$null = Read-Host

# Executar QEMU com monitor interativo e clock acelerado
& $qemuPath `
    -machine uno `
    -bios $elfPath `
    -serial file:serial_debug.log `
    -monitor stdio `
    -d guest_errors `
    -icount shift=0 `
    -nographic

Write-Host ""
Write-Host "[INFO] Serial output salvo em: serial_debug.log" -ForegroundColor Yellow

if (Test-Path serial_debug.log) {
    Write-Host ""
    Write-Host "=== Serial Output ===" -ForegroundColor Cyan
    Get-Content serial_debug.log
}
