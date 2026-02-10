# ===============================================
# NeuroForge Core Backup Script
# ===============================================
# Cria backup completo de todos os cores customizados:
# 1. NeuroForge AVR Core (Arduino QEMU)
# 2. ESP32 QEMU (binário + configurações)
# 3. Configurações do servidor (.env)
#
# Data: 10/02/2026
# Autor: NeuroForge Team
# ===============================================

param(
    [string]$BackupDir = "D:\Backups\NeuroForge\cores_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
)

Write-Host "" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  NeuroForge Core Backup Tool" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Criar diretório de backup
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
Write-Host "📁 Diretório de backup: $BackupDir" -ForegroundColor Green
Write-Host ""

# ===============================================
# 1. BACKUP DO CORE NEUROFORGE AVR
# ===============================================
Write-Host "[1/5] Core NeuroForge AVR (Arduino QEMU)" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

$avrCorePath = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\neuroforge_qemu"
$avrBoardsPath = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\boards.txt"
$avrWiringPath = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\arduino\wiring_digital.c"

if (Test-Path $avrCorePath) {
    $avrBackupPath = "$BackupDir\neuroforge_avr_core"
    Copy-Item -Path $avrCorePath -Destination $avrBackupPath -Recurse -Force
    Write-Host "  ✅ Core copiado: $avrBackupPath" -ForegroundColor Green
    
    # Backup do boards.txt
    Copy-Item -Path $avrBoardsPath -Destination "$BackupDir\boards.txt" -Force
    Write-Host "  ✅ boards.txt: $BackupDir\boards.txt" -ForegroundColor Green
    
    # Backup do wiring_digital.c (com patch GPIO)
    Copy-Item -Path $avrWiringPath -Destination "$BackupDir\wiring_digital.c" -Force
    Write-Host "  ✅ wiring_digital.c: $BackupDir\wiring_digital.c" -ForegroundColor Green
    
    # Criar manifesto
    @"
NeuroForge AVR Core Backup
==========================
Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Versão Arduino AVR: 1.8.7

Arquivos:
- neuroforge_avr_core/: Core completo do NeuroForge
- boards.txt: Definições de placas (inclui unoqemu)
- wiring_digital.c: Core Arduino com patch GPIO

Para restaurar:
1. Copie neuroforge_avr_core/ para:
   %LOCALAPPDATA%\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\neuroforge_qemu

2. Adicione o conteúdo de boards.txt ao arquivo:
   %LOCALAPPDATA%\Arduino15\packages\arduino\hardware\avr\1.8.7\boards.txt

3. Substitua wiring_digital.c em:
   %LOCALAPPDATA%\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\arduino\wiring_digital.c

4. Execute: arduino-cli board listall | Select-String "unoqemu"
"@ | Out-File -FilePath "$BackupDir\README_AVR.txt" -Encoding UTF8
    
} else {
    Write-Host "  ⚠️  Core não encontrado em: $avrCorePath" -ForegroundColor Yellow
}

Write-Host ""

# ===============================================
# 2. BACKUP DO ESP32 QEMU (Binário)
# ===============================================
Write-Host "[2/5] ESP32 QEMU (Binário + Configurações)" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

# Ler caminho do .env
$envPath = "D:\Documents\NeuroForge\neuroforge\server\.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath -Raw
    
    # Extrair ESP32_QEMU_PATH
    if ($envContent -match 'ESP32_QEMU_PATH=(.+)') {
        $esp32QemuPath = $matches[1].Trim().Trim('"')
        
        if (Test-Path $esp32QemuPath) {
            $esp32BackupPath = "$BackupDir\esp32_qemu"
            New-Item -ItemType Directory -Force -Path $esp32BackupPath | Out-Null
            
            # Copiar binário
            Copy-Item -Path $esp32QemuPath -Destination "$esp32BackupPath\qemu-system-xtensa.exe" -Force
            Write-Host "  ✅ Binário QEMU: $esp32BackupPath\qemu-system-xtensa.exe" -ForegroundColor Green
            
            # Copiar data path completo
            if ($envContent -match 'ESP32_QEMU_DATA_PATH=(.+)') {
                $esp32DataPath = $matches[1].Trim().Trim('"')
                
                if (Test-Path $esp32DataPath) {
                    Copy-Item -Path $esp32DataPath -Destination "$esp32BackupPath\data" -Recurse -Force
                    Write-Host "  ✅ Data files: $esp32BackupPath\data" -ForegroundColor Green
                }
            }
            
            # Criar manifesto
            @"
ESP32 QEMU Backup
=================
Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Caminho original: $esp32QemuPath

Arquivos:
- qemu-system-xtensa.exe: Binário QEMU ESP32
- data/: Arquivos de dados (BIOS, ROMs, etc.)

Para restaurar:
1. Copie qemu-system-xtensa.exe para:
   C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe

2. Copie data/ para:
   C:\qemu-project\builds\esp32\share\qemu

3. Atualize server\.env:
   ESP32_QEMU_PATH=C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe
   ESP32_QEMU_DATA_PATH=C:\qemu-project\builds\esp32\share\qemu
"@ | Out-File -FilePath "$BackupDir\README_ESP32.txt" -Encoding UTF8
            
        } else {
            Write-Host "  ⚠️  Binário não encontrado: $esp32QemuPath" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ⚠️  Arquivo .env não encontrado" -ForegroundColor Yellow
}

Write-Host ""

# ===============================================
# 3. BACKUP DO ESP32 CORE (Arduino)
# ===============================================
Write-Host "[3/5] ESP32 Core (Arduino-ESP32)" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

$esp32CorePath = "$env:LOCALAPPDATA\Arduino15\packages\esp32\hardware\esp32\3.3.6"

if (Test-Path $esp32CorePath) {
    Write-Host "  📦 Core ESP32 versão: 3.3.6" -ForegroundColor Green
    Write-Host "  ℹ️  Não é necessário backup (instalável via arduino-cli)" -ForegroundColor Gray
    Write-Host "  💡 Para reinstalar: arduino-cli core install esp32:esp32@3.3.6" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  Core não encontrado" -ForegroundColor Yellow
}

Write-Host ""

# ===============================================
# 4. BACKUP DAS CONFIGURAÇÕES DO SERVIDOR
# ===============================================
Write-Host "[4/5] Configurações do Servidor" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

if (Test-Path $envPath) {
    Copy-Item -Path $envPath -Destination "$BackupDir\.env" -Force
    Write-Host "  ✅ .env: $BackupDir\.env" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  .env não encontrado" -ForegroundColor Yellow
}

Write-Host ""

# ===============================================
# 5. BACKUP DOS FIRMWARES DE TESTE
# ===============================================
Write-Host "[5/5] Firmwares de Teste" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────" -ForegroundColor Gray

$esp32FirmwarePath = "D:\Documents\NeuroForge\neuroforge\server\test-firmware\esp32"

if (Test-Path $esp32FirmwarePath) {
    Copy-Item -Path $esp32FirmwarePath -Destination "$BackupDir\esp32_firmware" -Recurse -Force
    Write-Host "  ✅ ESP32 firmware: $BackupDir\esp32_firmware" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Firmwares não encontrados" -ForegroundColor Yellow
}

Write-Host ""

# ===============================================
# RESUMO FINAL
# ===============================================
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ BACKUP CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Localização: $BackupDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 Conteúdo do backup:" -ForegroundColor Cyan
Write-Host "  • neuroforge_avr_core/ - Core Arduino QEMU" -ForegroundColor Gray
Write-Host "  • esp32_qemu/ - QEMU ESP32 binário" -ForegroundColor Gray
Write-Host "  • esp32_firmware/ - Firmwares de teste" -ForegroundColor Gray
Write-Host "  • .env - Configurações do servidor" -ForegroundColor Gray
Write-Host "  • README_*.txt - Guias de restauração" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Para restaurar, leia os arquivos README dentro do backup" -ForegroundColor Cyan
Write-Host ""

# Criar arquivo de inventário
@"
╔════════════════════════════════════════════════════════════╗
║           NEUROFORGE CORE BACKUP - INVENTÁRIO              ║
╚════════════════════════════════════════════════════════════╝

Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Diretório: $BackupDir
Tamanho total: $((Get-ChildItem -Path $BackupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB) MB

──────────────────────────────────────────────────────────────
 ARQUIVOS INCLUÍDOS
──────────────────────────────────────────────────────────────

$(Get-ChildItem -Path $BackupDir -Recurse -File | Select-Object FullName, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}} | Format-Table -AutoSize | Out-String)

──────────────────────────────────────────────────────────────
 COMANDOS RÁPIDOS DE RESTAURAÇÃO
──────────────────────────────────────────────────────────────

# Restaurar Core NeuroForge AVR:
Copy-Item -Path "$BackupDir\neuroforge_avr_core" -Destination "`$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\neuroforge_qemu" -Recurse -Force

# Restaurar ESP32 QEMU:
Copy-Item -Path "$BackupDir\esp32_qemu\qemu-system-xtensa.exe" -Destination "C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe" -Force

# Restaurar configurações:
Copy-Item -Path "$BackupDir\.env" -Destination "D:\Documents\NeuroForge\neuroforge\server\.env" -Force

──────────────────────────────────────────────────────────────
 VERIFICAÇÃO
──────────────────────────────────────────────────────────────

# Verificar Core Arduino:
arduino-cli board listall | Select-String "unoqemu"

# Verificar ESP32 QEMU:
Get-Command qemu-system-xtensa.exe

──────────────────────────────────────────────────────────────
🔒 Guarde este backup em local seguro!
──────────────────────────────────────────────────────────────
"@ | Out-File -FilePath "$BackupDir\INVENTARIO.txt" -Encoding UTF8

Write-Host "📄 Inventário completo salvo em: $BackupDir\INVENTARIO.txt" -ForegroundColor Green
Write-Host ""
