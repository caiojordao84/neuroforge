# Script de instalação de dependências do NeuroForge
# Execute: .\install-deps.ps1

Write-Host "=== NeuroForge - Instalação de Dependências ===" -ForegroundColor Cyan
Write-Host ""

# 1. Limpar pasta src/engine (duplicada)
Write-Host "[1/4] Removendo src/engine duplicado..." -ForegroundColor Yellow
if (Test-Path "src/engine") {
    Remove-Item -Recurse -Force "src/engine"
    Write-Host "✓ src/engine removido" -ForegroundColor Green
} else {
    Write-Host "✓ src/engine já não existe" -ForegroundColor Green
}

Write-Host ""

# 2. Instalar dependências frontend
Write-Host "[2/4] Instalando dependências do frontend..." -ForegroundColor Yellow

# Dependências principais
$mainDeps = @(
    "@xyflow/react@^12.3.5",
    "@radix-ui/react-accordion@^1.2.2",
    "@radix-ui/react-alert-dialog@^1.1.4",
    "@radix-ui/react-aspect-ratio@^1.1.1",
    "@radix-ui/react-avatar@^1.1.2",
    "@radix-ui/react-checkbox@^1.1.3",
    "@radix-ui/react-collapsible@^1.1.2",
    "@radix-ui/react-context-menu@^2.2.5",
    "@radix-ui/react-dialog@^1.1.4",
    "@radix-ui/react-dropdown-menu@^2.1.5",
    "@radix-ui/react-hover-card@^1.1.4",
    "@radix-ui/react-label@^2.1.1",
    "@radix-ui/react-menubar@^1.1.5",
    "@radix-ui/react-navigation-menu@^1.2.3",
    "@radix-ui/react-popover@^1.1.4",
    "@radix-ui/react-progress@^1.1.1",
    "@radix-ui/react-radio-group@^1.2.3",
    "@radix-ui/react-scroll-area@^1.2.2",
    "@radix-ui/react-select@^2.1.5",
    "@radix-ui/react-separator@^1.1.1",
    "@radix-ui/react-slider@^1.2.1",
    "@radix-ui/react-slot@^1.1.1",
    "@radix-ui/react-switch@^1.1.2",
    "@radix-ui/react-tabs@^1.1.2",
    "@radix-ui/react-toggle@^1.1.1",
    "@radix-ui/react-toggle-group@^1.1.1",
    "@radix-ui/react-tooltip@^1.1.6",
    "class-variance-authority@^0.7.1",
    "clsx@^2.1.1",
    "tailwind-merge@^2.6.0",
    "cmdk@^1.0.4",
    "react-day-picker@^9.4.4",
    "recharts@^2.15.0",
    "sonner@^1.7.3",
    "next-themes@^0.4.4",
    "vaul@^1.1.1",
    "embla-carousel-react@^8.5.3",
    "react-hook-form@^7.54.2",
    "react-resizable-panels@^2.1.7",
    "input-otp@^1.4.1"
)

npm install $mainDeps

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependências frontend instaladas" -ForegroundColor Green
} else {
    Write-Host "✗ Erro ao instalar dependências frontend" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. Instalar dependências do servidor QEMU
Write-Host "[3/4] Instalando dependências do servidor QEMU..." -ForegroundColor Yellow
Set-Location server
npm install

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependências servidor instaladas" -ForegroundColor Green
} else {
    Write-Host "✗ Erro ao instalar dependências servidor" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..
Write-Host ""

# 4. Build frontend
Write-Host "[4/4] Compilando frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend compilado" -ForegroundColor Green
} else {
    Write-Host "✗ Erro ao compilar frontend" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Instalação Concluída! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor White
Write-Host "  1. Iniciar frontend:  npm run dev" -ForegroundColor Gray
Write-Host "  2. Testar QEMU:       cd server && npm run dev" -ForegroundColor Gray
Write-Host ""
