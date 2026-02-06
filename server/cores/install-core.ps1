# NeuroForge QEMU Core - Installation Script (Windows)
# 
# Este script instala o core neuroforge_qemu no arduino-cli.
# Copia o core Arduino padrao e adiciona os arquivos NeuroForge Time.

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NeuroForge QEMU Core - Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detectar diretorio do Arduino15
$ARDUINO_DATA = "$env:LOCALAPPDATA\Arduino15"

if (-not (Test-Path $ARDUINO_DATA)) {
    Write-Host "[X] Arduino15 nao encontrado em: $ARDUINO_DATA" -ForegroundColor Red
    Write-Host "[!] Instale arduino-cli primeiro: https://arduino.github.io/arduino-cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Arduino15 encontrado: $ARDUINO_DATA" -ForegroundColor Green

# 2. Encontrar versao do core AVR instalado
$AVR_PATH = Get-ChildItem -Path "$ARDUINO_DATA\packages\arduino\hardware\avr" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if (-not $AVR_PATH) {
    Write-Host "[X] Core Arduino AVR nao encontrado!" -ForegroundColor Red
    Write-Host "[!] Instale com: arduino-cli core install arduino:avr" -ForegroundColor Yellow
    exit 1
}

$AVR_VERSION = $AVR_PATH.Name
$AVR_DIR = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION"

Write-Host "[OK] Core Arduino AVR encontrado: $AVR_VERSION" -ForegroundColor Green

# 3. Criar diretorio do core neuroforge_qemu
$NF_CORE_DIR = "$AVR_DIR\cores\neuroforge_qemu"

Write-Host "[...] Criando diretorio: $NF_CORE_DIR" -ForegroundColor Cyan

if (Test-Path $NF_CORE_DIR) {
    Write-Host "[!] Core ja existe, removendo versao antiga..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $NF_CORE_DIR
}

New-Item -ItemType Directory -Path $NF_CORE_DIR -Force | Out-Null

# 4. Copiar core Arduino padrao
Write-Host "[...] Copiando core Arduino padrao..." -ForegroundColor Cyan

$ARDUINO_CORE_DIR = "$AVR_DIR\cores\arduino"
Copy-Item -Path "$ARDUINO_CORE_DIR\*" -Destination $NF_CORE_DIR -Recurse -Force

Write-Host "[OK] Core Arduino copiado" -ForegroundColor Green

# 5. Adicionar arquivos NeuroForge Time
Write-Host "[...] Adicionando NeuroForge Time..." -ForegroundColor Cyan

$REPO_CORE = "$PSScriptRoot\neuroforge_qemu"

Copy-Item -Path "$REPO_CORE\nf_time.h" -Destination $NF_CORE_DIR -Force
Copy-Item -Path "$REPO_CORE\nf_time.cpp" -Destination $NF_CORE_DIR -Force
Copy-Item -Path "$REPO_CORE\nf_arduino_time.cpp" -Destination $NF_CORE_DIR -Force
Copy-Item -Path "$REPO_CORE\nf_gpio.h" -Destination $NF_CORE_DIR -Force
Copy-Item -Path "$REPO_CORE\nf_gpio.cpp" -Destination $NF_CORE_DIR -Force

Write-Host "[OK] NeuroForge Time e GPIO adicionados" -ForegroundColor Green

# 6. Registrar board no boards.txt
Write-Host "[...] Registrando board unoqemu..." -ForegroundColor Cyan

$BOARDS_FILE = "$AVR_DIR\boards.txt"
$NF_BOARD_DEF = Get-Content "$REPO_CORE\boards.txt" -Raw

# Verificar se ja existe
if ((Get-Content $BOARDS_FILE -Raw) -match "unoqemu.name") {
    Write-Host "[!] Board unoqemu ja registrado, ignorando..." -ForegroundColor Yellow
}
else {
    Add-Content -Path $BOARDS_FILE -Value ""
    Add-Content -Path $BOARDS_FILE -Value "# NeuroForge QEMU Boards"
    Add-Content -Path $BOARDS_FILE -Value $NF_BOARD_DEF
    Write-Host "[OK] Board unoqemu registrado" -ForegroundColor Green
}

# 7. Aplicar patch no wiring.c
Write-Host ""
Write-Host "[...] Aplicando patch no wiring.c..." -ForegroundColor Cyan

& "$PSScriptRoot\patch-wiring.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] Falha ao aplicar patch!" -ForegroundColor Red
    exit 1
}

# 8. Verificar instalacao
Write-Host ""
Write-Host "[...] Verificando instalacao..." -ForegroundColor Cyan

$files = @("nf_time.h", "nf_time.cpp", "nf_arduino_time.cpp", "nf_gpio.h", "nf_gpio.cpp")
foreach ($file in $files) {
    if (Test-Path "$NF_CORE_DIR\$file") {
        Write-Host "  [OK] $file" -ForegroundColor Green
    }
    else {
        Write-Host "  [X] $file" -ForegroundColor Red
    }
}

# 9. Testar arduino-cli
Write-Host ""
Write-Host "[...] Testando arduino-cli..." -ForegroundColor Cyan

$boards = arduino-cli board listall | Select-String "unoqemu"

if ($boards) {
    Write-Host "[OK] Board unoqemu disponivel no arduino-cli!" -ForegroundColor Green
    Write-Host "$boards" -ForegroundColor Gray
}
else {
    Write-Host "[!] Board unoqemu nao detectado" -ForegroundColor Yellow
    Write-Host "[!] Tente: arduino-cli core update-index" -ForegroundColor Yellow
}

# 10. Sucesso!
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "[OK] Instalacao concluida com sucesso!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Cyan
Write-Host "1. Reiniciar backend: npm run dev" -ForegroundColor White
Write-Host "2. Testar no NeuroForge: Compile & Run no frontend" -ForegroundColor White
Write-Host "3. Verificar Serial Monitor: LED ON/OFF deve aparecer!" -ForegroundColor White
Write-Host ""
