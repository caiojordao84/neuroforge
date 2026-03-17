# fix_qemu_path.ps1 - Adiciona QEMU ao PATH do Windows
# Execute como Administrador

Write-Host "=== QEMU PATH Fix ===" -ForegroundColor Cyan
Write-Host ""

# Localizar instalação do QEMU
$qemuPaths = @(
    "C:\Program Files\qemu",
    "C:\ProgramData\chocolatey\lib\Qemu\tools",
    "C:\qemu"
)

$qemuFound = $null
foreach ($path in $qemuPaths) {
    if (Test-Path "$path\qemu-system-avr.exe") {
        $qemuFound = $path
        Write-Host "[OK] QEMU encontrado em: $path" -ForegroundColor Green
        break
    }
}

if (-not $qemuFound) {
    Write-Host "[ERROR] QEMU não encontrado em:" -ForegroundColor Red
    $qemuPaths | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Tente localizar manualmente:" -ForegroundColor Yellow
    Write-Host "  Get-ChildItem -Path C:\ -Filter qemu-system-avr.exe -Recurse -ErrorAction SilentlyContinue" -ForegroundColor Gray
    exit 1
}

# Verificar se já está no PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
if ($currentPath -like "*$qemuFound*") {
    Write-Host "[INFO] QEMU já está no PATH" -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Adicionando QEMU ao PATH do sistema..." -ForegroundColor Yellow
    
    # Adicionar ao PATH do sistema (requer admin)
    $newPath = "$currentPath;$qemuFound"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
    
    Write-Host "[OK] QEMU adicionado ao PATH" -ForegroundColor Green
    Write-Host "[WARNING] Reinicie o PowerShell para aplicar mudanças" -ForegroundColor Yellow
}

# Adicionar ao PATH da sessão atual (temporário)
$env:Path += ";$qemuFound"

Write-Host ""
Write-Host "=== Testando QEMU ===" -ForegroundColor Cyan
try {
    $version = qemu-system-avr --version 2>&1 | Select-Object -First 1
    Write-Host "[OK] $version" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Ainda não consegue executar qemu-system-avr" -ForegroundColor Red
    Write-Host "Execute novamente como Administrador" -ForegroundColor Yellow
}
