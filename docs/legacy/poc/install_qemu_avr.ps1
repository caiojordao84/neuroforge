# install_qemu_avr.ps1 - Instala QEMU com suporte AVR
# Execute como Administrador

Write-Host "=== QEMU AVR Installation ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se já tem qemu-system-avr
$existingQemu = Get-ChildItem -Path C:\ -Filter qemu-system-avr.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1

if ($existingQemu) {
    Write-Host "[OK] QEMU AVR já encontrado em: $($existingQemu.FullName)" -ForegroundColor Green
    & $existingQemu.FullName --version
    exit 0
}

Write-Host "[INFO] QEMU AVR não encontrado. Instalando versão com suporte AVR..." -ForegroundColor Yellow
Write-Host ""

# Opção 1: Download binário oficial QEMU (Windows)
$qemuVersion = "9.0.0"
$qemuUrl = "https://qemu.weilnetz.de/w64/2024/qemu-w64-setup-20240423.exe"
$installerPath = "$env:TEMP\qemu-setup.exe"

Write-Host "[INFO] Baixando QEMU $qemuVersion com suporte AVR..." -ForegroundColor Yellow
Write-Host "[INFO] URL: $qemuUrl" -ForegroundColor Gray

try {
    # Download
    Invoke-WebRequest -Uri $qemuUrl -OutFile $installerPath -UseBasicParsing
    
    Write-Host "[OK] Download concluído" -ForegroundColor Green
    Write-Host ""
    Write-Host "[INFO] Instalando QEMU..." -ForegroundColor Yellow
    Write-Host "[INFO] Instale em: C:\Program Files\qemu" -ForegroundColor Yellow
    Write-Host ""
    
    # Executar instalador
    Start-Process -FilePath $installerPath -Wait
    
    # Verificar instalação
    $qemuInstalled = Test-Path "C:\Program Files\qemu\qemu-system-avr.exe"
    
    if ($qemuInstalled) {
        Write-Host "[OK] QEMU AVR instalado com sucesso!" -ForegroundColor Green
        
        # Adicionar ao PATH
        $qemuPath = "C:\Program Files\qemu"
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        
        if ($currentPath -notlike "*$qemuPath*") {
            Write-Host "[INFO] Adicionando ao PATH..." -ForegroundColor Yellow
            $newPath = "$currentPath;$qemuPath"
            [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
            Write-Host "[OK] PATH atualizado" -ForegroundColor Green
        }
        
        # Testar
        Write-Host ""
        Write-Host "=== Teste ===" -ForegroundColor Cyan
        & "C:\Program Files\qemu\qemu-system-avr.exe" --version
        
        Write-Host ""
        Write-Host "[OK] Instalação completa!" -ForegroundColor Green
        Write-Host "[INFO] Reinicie o PowerShell para usar o comando 'qemu-system-avr'" -ForegroundColor Yellow
        
    } else {
        Write-Host "[ERROR] Instalação falhou ou foi cancelada" -ForegroundColor Red
    }
    
} catch {
    Write-Host "[ERROR] Falha no download: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== Instalação Manual ===" -ForegroundColor Yellow
    Write-Host "1. Acesse: https://qemu.weilnetz.de/w64/" -ForegroundColor Gray
    Write-Host "2. Baixe a versão mais recente (qemu-w64-setup-*.exe)" -ForegroundColor Gray
    Write-Host "3. Execute o instalador" -ForegroundColor Gray
    Write-Host "4. Instale em: C:\Program Files\qemu" -ForegroundColor Gray
    Write-Host "5. Adicione ao PATH: C:\Program Files\qemu" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Alternativa: Compilar do Código Fonte ===" -ForegroundColor Yellow
Write-Host "Se preferir compilar o QEMU com MSYS2:" -ForegroundColor Gray
Write-Host "1. Instale MSYS2: https://www.msys2.org/" -ForegroundColor Gray
Write-Host "2. No MSYS2 terminal:" -ForegroundColor Gray
Write-Host "   pacman -S mingw-w64-x86_64-qemu" -ForegroundColor DarkGray
Write-Host "3. QEMU estará em: C:\msys64\mingw64\bin\qemu-system-avr.exe" -ForegroundColor Gray
