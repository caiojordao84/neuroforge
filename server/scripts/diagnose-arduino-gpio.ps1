# ===========================================================
# Arduino GPIO Diagnostic Script
# ===========================================================
# Verifica se o protocolo GPIO está funcionando corretamente
# no Arduino AVR com QEMU
#
# Data: 10/02/2026
# ===========================================================

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Arduino GPIO Diagnostic Tool" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$CORE_PATH = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores"
$NF_CORE = "$CORE_PATH\neuroforge_qemu"
$ARDUINO_CORE = "$CORE_PATH\arduino"
$WIRING_DIGITAL = "$ARDUINO_CORE\wiring_digital.c"
$BOARDS_TXT = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\boards.txt"

# ===========================================================
# 1. VERIFICAR CORE NEUROFORGE
# ===========================================================
Write-Host "[1/6] Verificando Core NeuroForge..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

if (Test-Path $NF_CORE) {
    Write-Host "  ✅ Core instalado: $NF_CORE" -ForegroundColor Green
    
    # Verificar arquivos críticos
    $files = @("nf_gpio.cpp", "nf_gpio.h", "nf_time.cpp", "nf_time.h", "nf_arduino_time.cpp")
    foreach ($file in $files) {
        if (Test-Path "$NF_CORE\$file") {
            Write-Host "  ✅ $file" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $file AUSENTE" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  ❌ Core não instalado!" -ForegroundColor Red
    Write-Host "  💡 Execute: .\install-core.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ===========================================================
# 2. VERIFICAR PLACA UNOQEMU
# ===========================================================
Write-Host "[2/6] Verificando Placa unoqemu..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

$boardsContent = Get-Content $BOARDS_TXT -Raw

if ($boardsContent -match "unoqemu\.name=") {
    Write-Host "  ✅ Placa unoqemu definida" -ForegroundColor Green
    
    # Verificar core
    if ($boardsContent -match "unoqemu\.build\.core=neuroforge_qemu") {
        Write-Host "  ✅ Core configurado: neuroforge_qemu" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Core incorreto (deve ser neuroforge_qemu)" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ Placa unoqemu NÃO definida" -ForegroundColor Red
    Write-Host "  💡 Execute: .\install-core.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ===========================================================
# 3. VERIFICAR PATCH EM WIRING_DIGITAL.C
# ===========================================================
Write-Host "[3/6] Verificando Patch GPIO..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

if (Test-Path $WIRING_DIGITAL) {
    $wiringContent = Get-Content $WIRING_DIGITAL -Raw
    
    # Verificar include
    if ($wiringContent -match "nf_gpio") {
        Write-Host "  ✅ NeuroForge GPIO integrado" -ForegroundColor Green
    } else {
        Write-Host "  ❌ NeuroForge GPIO NÃO integrado" -ForegroundColor Red
        Write-Host "  ⚠️  PROBLEMA ENCONTRADO: digitalWrite() não vai emitir protocolo GPIO" -ForegroundColor Yellow
    }
    
    # Verificar chamada nf_report_gpio
    if ($wiringContent -match "nf_report_gpio") {
        Write-Host "  ✅ Função nf_report_gpio() presente" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Função nf_report_gpio() NÃO chamada" -ForegroundColor Red
        Write-Host "  ⚠️  PROBLEMA ENCONTRADO: digitalWrite() não vai emitir protocolo GPIO" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Arquivo wiring_digital.c não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ===========================================================
# 4. COMPILAR FIRMWARE DE TESTE
# ===========================================================
Write-Host "[4/6] Compilando Firmware de Teste..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

# Usar here-string corretamente
$testSketch = @'
void setup() {
  Serial.begin(115200);
  pinMode(13, OUTPUT);
  Serial.println("Arduino QEMU - Test GPIO");
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("LED ON");
  delay(1000);
  
  digitalWrite(13, LOW);
  Serial.println("LED OFF");
  delay(1000);
}
'@

$tempDir = "$env:TEMP\neuroforge_test"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$sketchPath = "$tempDir\test_gpio.ino"
Set-Content -Path $sketchPath -Value $testSketch

Write-Host "  📄 Sketch criado: $sketchPath" -ForegroundColor Cyan

try {
    $compileResult = arduino-cli compile --fqbn arduino:avr:unoqemu $sketchPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Compilação bem-sucedida" -ForegroundColor Green
        Write-Host "  📦 ELF: $tempDir\test_gpio.ino.elf" -ForegroundColor Cyan
    } else {
        Write-Host "  ❌ Erro na compilação" -ForegroundColor Red
        Write-Host $compileResult -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  ❌ Arduino CLI não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ===========================================================
# 5. ANALISAR SÍMBOLOS DO ELF
# ===========================================================
Write-Host "[5/6] Analisando Símbolos..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

$elfPath = "$tempDir\test_gpio.ino.elf"

if (Test-Path $elfPath) {
    try {
        # Verificar se avr-nm existe
        $avrNm = "$env:LOCALAPPDATA\Arduino15\packages\arduino\tools\avr-gcc\7.3.0-atmel3.6.1-arduino7\bin\avr-nm.exe"
        
        if (Test-Path $avrNm) {
            $symbols = & $avrNm $elfPath 2>&1 | Select-String "nf_"
            
            if ($symbols) {
                Write-Host "  ✅ Símbolos NeuroForge encontrados:" -ForegroundColor Green
                $symbols | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                
                # Verificar se nf_report_gpio existe
                if ($symbols -match "nf_report_gpio") {
                    Write-Host "  ✅ nf_report_gpio() linkado" -ForegroundColor Green
                } else {
                    Write-Host "  ⚠️  nf_report_gpio() NÃO linkado" -ForegroundColor Yellow
                    Write-Host "  💡 digitalWrite() pode não chamar nf_report_gpio()" -ForegroundColor Yellow
                }
            } else {
                Write-Host "  ⚠️  Nenhum símbolo NeuroForge encontrado" -ForegroundColor Yellow
                Write-Host "  💡 Core pode estar usando versão padrão do Arduino" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  ⚠️  avr-nm não encontrado, pulando análise" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  Erro ao analisar símbolos: $_" -ForegroundColor Yellow
    }
}

Write-Host ""

# ===========================================================
# 6. TESTE RÁPIDO COM QEMU
# ===========================================================
Write-Host "[6/6] Teste Rápido com QEMU..." -ForegroundColor Cyan
Write-Host "──────────────────────────────────────────────────────" -ForegroundColor Gray

Write-Host "  💡 Para testar manualmente:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Executar QEMU:" -ForegroundColor Yellow
Write-Host "     qemu-system-avr -machine arduino-uno -bios $elfPath -serial mon:stdio -nographic" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Procurar por linhas no formato:" -ForegroundColor Yellow
Write-Host "     G:pin=13,v=1  (LED ligado)" -ForegroundColor Green
Write-Host "     G:pin=13,v=0  (LED desligado)" -ForegroundColor Green
Write-Host ""
Write-Host "  3. Se NÃO aparecer 'G:pin=...', o problema está no core" -ForegroundColor Yellow
Write-Host ""

# ===========================================================
# RESUMO
# ===========================================================
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RESUMO DO DIAGNÓSTICO" -ForegroundColor Yellow
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 Próximos passos se o LED não piscar:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Se nf_report_gpio() NÃO foi encontrado:" -ForegroundColor Yellow
Write-Host "   → Execute novamente: install-core.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Se símbolos NeuroForge NÃO aparecem:" -ForegroundColor Yellow
Write-Host "   → Recompile com: arduino-cli compile --clean" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Se QEMU não mostra 'G:pin=...'" -ForegroundColor Yellow
Write-Host "   → Verifique se o backend captura GPIO" -ForegroundColor Gray
Write-Host ""

Write-Host "📂 Firmware de teste: $elfPath" -ForegroundColor Cyan
Write-Host ""
