# ===========================================================
# Arduino GPIO Fix Script
# ===========================================================
# Aplica patch em wiring_digital.c para fazer digitalWrite()
# chamar nf_report_gpio() e emitir protocolo GPIO
#
# Data: 10/02/2026
# ===========================================================

param(
    [switch]$Force
)

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Arduino GPIO Fix Tool" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$ARDUINO_CORE = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\arduino"
$WIRING_DIGITAL = "$ARDUINO_CORE\wiring_digital.c"
$WIRING_BACKUP = "$WIRING_DIGITAL.neuroforge_backup"

# ===========================================================
# 1. VERIFICAR SE O ARQUIVO EXISTE
# ===========================================================
Write-Host "[1/4] Verificando arquivos..." -ForegroundColor Cyan

if (-not (Test-Path $WIRING_DIGITAL)) {
    Write-Host "  ❌ wiring_digital.c não encontrado" -ForegroundColor Red
    Write-Host "  💡 Instale o core Arduino AVR: arduino-cli core install arduino:avr@1.8.7" -ForegroundColor Yellow
    exit 1
}

Write-Host "  ✅ wiring_digital.c encontrado" -ForegroundColor Green
Write-Host ""

# ===========================================================
# 2. FAZER BACKUP
# ===========================================================
Write-Host "[2/4] Criando backup..." -ForegroundColor Cyan

if (Test-Path $WIRING_BACKUP) {
    if ($Force) {
        Write-Host "  ⚠️  Backup existente será sobrescrito (--Force)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Backup já existe: $WIRING_BACKUP" -ForegroundColor Green
        Write-Host "  💡 Use --Force para sobrescrever" -ForegroundColor Cyan
    }
} else {
    Copy-Item -Path $WIRING_DIGITAL -Destination $WIRING_BACKUP -Force
    Write-Host "  ✅ Backup criado: $WIRING_BACKUP" -ForegroundColor Green
}

Write-Host ""

# ===========================================================
# 3. APLICAR PATCH
# ===========================================================
Write-Host "[3/4] Aplicando patch GPIO..." -ForegroundColor Cyan

$content = Get-Content $WIRING_DIGITAL -Raw

# Verificar se já está patcheado
if ($content -match "nf_report_gpio" -and -not $Force) {
    Write-Host "  ✅ Patch já aplicado" -ForegroundColor Green
    Write-Host "  ℹ️  Use --Force para reaplicar" -ForegroundColor Cyan
} else {
    Write-Host "  🔧 Modificando wiring_digital.c..." -ForegroundColor Cyan
    
    # PASSO 1: Adicionar include no topo (após os includes existentes)
    if ($content -notmatch "#include.*nf_gpio\.h") {
        # Encontrar o último #include
        $lastIncludePos = [regex]::Matches($content, "#include.*\n").Value | Select-Object -Last 1
        
        if ($lastIncludePos) {
            $includeToAdd = "#include `"../neuroforge_qemu/nf_gpio.h`"`n"
            $content = $content.Replace($lastIncludePos, "$lastIncludePos$includeToAdd")
            Write-Host "  ✅ Include adicionado" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Não foi possível adicionar include" -ForegroundColor Yellow
        }
    }
    
    # PASSO 2: Adicionar chamada nf_report_gpio() dentro de digitalWrite()
    if ($content -notmatch "nf_report_gpio") {
        # Encontrar a função digitalWrite
        $digitalWritePattern = '(?s)(void digitalWrite\([^{]+\{)([^}]+)'}'
        
        if ($content -match $digitalWritePattern) {
            # Adicionar chamada antes do último }
            $digitalWriteBody = $matches[2]
            $digitalWriteStart = $matches[1]
            
            # Adicionar a chamada logo após o if-else que define val
            $patchedBody = $digitalWriteBody -replace '(if \(val == LOW\)[^}]+}[^}]+})', '$1`n`n#ifdef ARDUINO_ARCH_AVR`n  // NeuroForge: Report GPIO changes to QEMU via serial protocol`n  extern void nf_report_gpio(uint8_t pin, uint8_t value);`n  nf_report_gpio(pin, val);`n#endif'
            
            $content = $content -replace [regex]::Escape($digitalWriteStart + $digitalWriteBody), "$digitalWriteStart$patchedBody"
            Write-Host "  ✅ Patch aplicado em digitalWrite()" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Função digitalWrite() não encontrada" -ForegroundColor Yellow
            Write-Host "  💡 Aplicando patch manualmente..." -ForegroundColor Cyan
            
            # Fallback: Adicionar extern + chamada no final do arquivo
            $manualPatch = @"

// NeuroForge GPIO Patch
#ifdef ARDUINO_ARCH_AVR
extern void nf_report_gpio(uint8_t pin, uint8_t value);
#define NF_REPORT_GPIO(pin, val) nf_report_gpio(pin, val)
#else
#define NF_REPORT_GPIO(pin, val)
#endif
"@
            $content = $content + $manualPatch
            Write-Host "  ✅ Patch manual aplicado (macro NF_REPORT_GPIO)" -ForegroundColor Green
            Write-Host "  ⚠️  ATENÇÃO: Você precisa adicionar NF_REPORT_GPIO(pin, val) manualmente em digitalWrite()" -ForegroundColor Yellow
        }
    }
    
    # Salvar arquivo modificado
    Set-Content -Path $WIRING_DIGITAL -Value $content -NoNewline
    Write-Host "  ✅ Arquivo salvo: $WIRING_DIGITAL" -ForegroundColor Green
}

Write-Host ""

# ===========================================================
# 4. VERIFICAR PATCH
# ===========================================================
Write-Host "[4/4] Verificando patch..." -ForegroundColor Cyan

$verifyContent = Get-Content $WIRING_DIGITAL -Raw

if ($verifyContent -match "#include.*nf_gpio\.h") {
    Write-Host "  ✅ Include presente" -ForegroundColor Green
} else {
    Write-Host "  ❌ Include ausente" -ForegroundColor Red
}

if ($verifyContent -match "nf_report_gpio") {
    Write-Host "  ✅ Chamada nf_report_gpio() presente" -ForegroundColor Green
} else {
    Write-Host "  ❌ Chamada ausente" -ForegroundColor Red
}

Write-Host ""

# ===========================================================
# RESUMO
# ===========================================================
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ PATCH APLICADO COM SUCESSO!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Backup original: $WIRING_BACKUP" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Próximos passos:" -ForegroundColor Yellow
Write-Host "  1. Recompilar firmware:" -ForegroundColor Cyan
Write-Host "     arduino-cli compile --clean --fqbn arduino:avr:unoqemu seu_sketch.ino" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Testar com QEMU:" -ForegroundColor Cyan
Write-Host "     qemu-system-avr -machine arduino-uno -bios sketch.elf -serial mon:stdio" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Procurar linhas:" -ForegroundColor Cyan
Write-Host "     G:pin=13,v=1  (LED ligado)" -ForegroundColor Green
Write-Host "     G:pin=13,v=0  (LED desligado)" -ForegroundColor Green
Write-Host ""
Write-Host "🔄 Para restaurar original:" -ForegroundColor Yellow
Write-Host "   Copy-Item -Path $WIRING_BACKUP -Destination $WIRING_DIGITAL -Force" -ForegroundColor Gray
Write-Host ""
