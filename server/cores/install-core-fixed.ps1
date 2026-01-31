# NeuroForge QEMU Core - Installation Script (Fixed)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "NeuroForge QEMU Core - Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detectar diretório do Arduino15
$ARDUINO_DATA = "$env:LOCALAPPDATA\Arduino15"

if (-not (Test-Path $ARDUINO_DATA)) {
    Write-Host "❌ Arduino15 não encontrado em: $ARDUINO_DATA" -ForegroundColor Red
    Write-Host "💡 Instale arduino-cli primeiro" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Arduino15 encontrado: $ARDUINO_DATA" -ForegroundColor Green

# 2. Encontrar versão do core AVR
$AVR_PATH = Get-ChildItem -Path "$ARDUINO_DATA\packages\arduino\hardware\avr" -Directory | Sort-Object Name -Descending | Select-Object -First 1

if (-not $AVR_PATH) {
    Write-Host "❌ Core Arduino AVR não encontrado!" -ForegroundColor Red
    Write-Host "💡 Instale com: arduino-cli core install arduino:avr" -ForegroundColor Yellow
    exit 1
}

$AVR_VERSION = $AVR_PATH.Name
$AVR_DIR = "$ARDUINO_DATA\packages\arduino\hardware\avr\$AVR_VERSION"

Write-Host "✅ Core Arduino AVR: $AVR_VERSION" -ForegroundColor Green
Write-Host "📁 Diretório: $AVR_DIR" -ForegroundColor Gray

# 3. Verificar se os arquivos fonte existem
$REPO_CORE = "$PSScriptRoot\neuroforge_qemu"

Write-Host ""
Write-Host "🔍 Verificando arquivos fonte..." -ForegroundColor Cyan

$sourceFiles = @("nf_time.h", "nf_time.cpp", "nf_arduino_time.cpp")
$allExist = $true

foreach ($file in $sourceFiles) {
    $filePath = "$REPO_CORE\$file"
    if (Test-Path $filePath) {
        Write-Host "  ✅ $file existe" -ForegroundColor Green
    }
    else {
        Write-Host "  ❌ $file NÃO ENCONTRADO em: $filePath" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host ""
    Write-Host "❌ Arquivos fonte não encontrados!" -ForegroundColor Red
    Write-Host "💡 Execute: git pull origin main" -ForegroundColor Yellow
    Write-Host "💡 Ou baixe manualmente de: https://github.com/caiojordao84/neuroforge/tree/main/server/cores/neuroforge_qemu" -ForegroundColor Yellow
    exit 1
}

# 4. Criar diretório do core neuroforge_qemu
$NF_CORE_DIR = "$AVR_DIR\cores\neuroforge_qemu"

Write-Host ""
Write-Host "📁 Criando core em: $NF_CORE_DIR" -ForegroundColor Cyan

if (Test-Path $NF_CORE_DIR) {
    Write-Host "⚠️  Core já existe, removendo..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $NF_CORE_DIR
}

New-Item -ItemType Directory -Path $NF_CORE_DIR -Force | Out-Null

# 5. Copiar core Arduino padrão
Write-Host "📋 Copiando core Arduino padrão..." -ForegroundColor Cyan

$ARDUINO_CORE_DIR = "$AVR_DIR\cores\arduino"

if (-not (Test-Path $ARDUINO_CORE_DIR)) {
    Write-Host "❌ Core Arduino não encontrado em: $ARDUINO_CORE_DIR" -ForegroundColor Red
    exit 1
}

Copy-Item -Path "$ARDUINO_CORE_DIR\*" -Destination $NF_CORE_DIR -Recurse -Force
Write-Host "✅ Core Arduino copiado" -ForegroundColor Green

# 6. Adicionar arquivos NeuroForge Time
Write-Host "⏱️  Adicionando NeuroForge Time..." -ForegroundColor Cyan

foreach ($file in $sourceFiles) {
    $sourcePath = "$REPO_CORE\$file"
    $destPath = "$NF_CORE_DIR\$file"
    
    Copy-Item -Path $sourcePath -Destination $destPath -Force
    
    if (Test-Path $destPath) {
        Write-Host "  ✅ $file copiado" -ForegroundColor Green
    }
    else {
        Write-Host "  ❌ Falha ao copiar $file" -ForegroundColor Red
    }
}

# 7. Registrar board no boards.txt
Write-Host ""
Write-Host "📦 Registrando board unoqemu..." -ForegroundColor Cyan

$BOARDS_FILE = "$AVR_DIR\boards.txt"
$NF_BOARD_DEF = Get-Content "$REPO_CORE\boards.txt" -Raw

if ((Get-Content $BOARDS_FILE -Raw) -match "unoqemu.name") {
    Write-Host "⚠️  Board já registrado" -ForegroundColor Yellow
}
else {
    Add-Content -Path $BOARDS_FILE -Value ""
    Add-Content -Path $BOARDS_FILE -Value "# NeuroForge QEMU Boards"
    Add-Content -Path $BOARDS_FILE -Value $NF_BOARD_DEF
    Write-Host "✅ Board registrado" -ForegroundColor Green
}

# 8. Verificar instalação final
Write-Host ""
Write-Host "🔍 Verificando instalação final..." -ForegroundColor Cyan

foreach ($file in $sourceFiles) {
    if (Test-Path "$NF_CORE_DIR\$file") {
        Write-Host "  ✅ $file" -ForegroundColor Green
    }
    else {
        Write-Host "  ❌ $file" -ForegroundColor Red
    }
}

# 9. Testar arduino-cli
Write-Host ""
Write-Host "🧪 Testando arduino-cli..." -ForegroundColor Cyan

$output = arduino-cli board listall 2>&1 | Out-String
if ($output -match "unoqemu") {
    Write-Host "✅ Board unoqemu detectado!" -ForegroundColor Green
}
else {
    Write-Host "⚠️  Board não detectado ainda" -ForegroundColor Yellow
    Write-Host "💡 Aguarde alguns segundos e tente: arduino-cli board listall | Select-String unoqemu" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Instalação concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
