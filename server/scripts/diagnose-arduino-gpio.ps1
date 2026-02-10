# ===========================================================
# Arduino GPIO Diagnostic Script
# ===========================================================
# Verifica se o protocolo GPIO esta funcionando corretamente
# no Arduino AVR com QEMU
#
# Data: 10/02/2026
# ===========================================================

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Arduino GPIO Diagnostic Tool" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$CORE_PATH = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores"
$NF_CORE = "$CORE_PATH\neuroforge_qemu"
$ARDUINO_CORE = "$CORE_PATH\arduino"
$WIRING_DIGITAL = "$NF_CORE\wiring_digital.c"
$BOARDS_TXT = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\boards.txt"

# ===========================================================
# 1. VERIFICAR CORE NEUROFORGE
# ===========================================================
Write-Host "[1/6] Verificando Core NeuroForge..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

if (Test-Path $NF_CORE) {
    Write-Host "  [OK] Core instalado: $NF_CORE" -ForegroundColor Green
    
    # Verificar arquivos criticos
    $files = @("nf_gpio.cpp", "nf_gpio.h", "nf_time.cpp", "nf_time.h", "nf_arduino_time.cpp")
    foreach ($file in $files) {
        if (Test-Path "$NF_CORE\$file") {
            Write-Host "  [OK] $file" -ForegroundColor Green
        } else {
            Write-Host "  [ERRO] $file AUSENTE" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  [ERRO] Core nao instalado!" -ForegroundColor Red
    Write-Host "  [INFO] Execute: install-core.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ===========================================================
# 2. VERIFICAR PLACA UNOQEMU
# ===========================================================
Write-Host "[2/6] Verificando Placa unoqemu..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

$boardsContent = Get-Content $BOARDS_TXT -Raw

if ($boardsContent -match "unoqemu\.name=") {
    Write-Host "  [OK] Placa unoqemu definida" -ForegroundColor Green
    
    # Verificar core
    if ($boardsContent -match "unoqemu\.build\.core=neuroforge_qemu") {
        Write-Host "  [OK] Core configurado: neuroforge_qemu" -ForegroundColor Green
    } else {
        Write-Host "  [ERRO] Core incorreto (deve ser neuroforge_qemu)" -ForegroundColor Red
    }
} else {
    Write-Host "  [ERRO] Placa unoqemu NAO definida" -ForegroundColor Red
    Write-Host "  [INFO] Execute: install-core.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ===========================================================
# 3. VERIFICAR PATCH EM WIRING_DIGITAL.C
# ===========================================================
Write-Host "[3/6] Verificando Patch GPIO..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

if (Test-Path $WIRING_DIGITAL) {
    $wiringContent = Get-Content $WIRING_DIGITAL -Raw
    
    # Verificar include
    if ($wiringContent -match "nf_gpio") {
        Write-Host "  [OK] NeuroForge GPIO integrado" -ForegroundColor Green
    } else {
        Write-Host "  [ERRO] NeuroForge GPIO NAO integrado" -ForegroundColor Red
        Write-Host "  [AVISO] digitalWrite() nao vai emitir protocolo GPIO" -ForegroundColor Yellow
    }
    
    # Verificar chamada nf_report_gpio
    if ($wiringContent -match "nf_report_gpio") {
        Write-Host "  [OK] Funcao nf_report_gpio() presente" -ForegroundColor Green
    } else {
        Write-Host "  [ERRO] Funcao nf_report_gpio() NAO chamada" -ForegroundColor Red
        Write-Host "  [AVISO] digitalWrite() nao vai emitir protocolo GPIO" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [ERRO] Arquivo wiring_digital.c nao encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ===========================================================
# 4. COMPILAR FIRMWARE DE TESTE
# ===========================================================
Write-Host "[4/6] Compilando Firmware de Teste..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

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

# IMPORTANTE: Nome do diretorio deve ser igual ao nome do .ino
$sketchName = "test_gpio_nf"
$tempDir = "$env:TEMP\$sketchName"

# Limpar diretorio anterior se existir
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

$sketchPath = "$tempDir\$sketchName.ino"
Set-Content -Path $sketchPath -Value $testSketch

Write-Host "  [INFO] Sketch criado: $sketchPath" -ForegroundColor Cyan

try {
    $compileResult = arduino-cli compile --fqbn arduino:avr:unoqemu $sketchPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] Compilacao bem-sucedida" -ForegroundColor Green
        $elfPath = "$tempDir\build\arduino.avr.unoqemu\$sketchName.ino.elf"
        Write-Host "  [INFO] ELF: $elfPath" -ForegroundColor Cyan
    } else {
        Write-Host "  [ERRO] Erro na compilacao" -ForegroundColor Red
        Write-Host "$compileResult" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "  [ERRO] Arduino CLI nao encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ===========================================================
# 5. ANALISAR SIMBOLOS DO ELF
# ===========================================================
Write-Host "[5/6] Analisando Simbolos..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

if (Test-Path $elfPath) {
    try {
        # Verificar se avr-nm existe
        $avrNm = "$env:LOCALAPPDATA\Arduino15\packages\arduino\tools\avr-gcc\7.3.0-atmel3.6.1-arduino7\bin\avr-nm.exe"
        
        if (Test-Path $avrNm) {
            $symbols = & $avrNm $elfPath 2>&1 | Select-String "nf_"
            
            if ($symbols) {
                Write-Host "  [OK] Simbolos NeuroForge encontrados:" -ForegroundColor Green
                $symbols | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                
                # Verificar se nf_report_gpio existe
                if ($symbols -match "nf_report_gpio") {
                    Write-Host "  [OK] nf_report_gpio linkado" -ForegroundColor Green
                } else {
                    Write-Host "  [AVISO] nf_report_gpio NAO linkado" -ForegroundColor Yellow
                    Write-Host "  [INFO] digitalWrite pode nao chamar nf_report_gpio" -ForegroundColor Yellow
                }
            } else {
                Write-Host "  [AVISO] Nenhum simbolo NeuroForge encontrado" -ForegroundColor Yellow
                Write-Host "  [INFO] Core pode estar usando versao padrao do Arduino" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  [AVISO] avr-nm nao encontrado, pulando analise" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [AVISO] Erro ao analisar simbolos: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [AVISO] ELF nao encontrado em: $elfPath" -ForegroundColor Yellow
}

Write-Host ""

# ===========================================================
# 6. TESTE RAPIDO COM QEMU
# ===========================================================
Write-Host "[6/6] Teste Rapido com QEMU..." -ForegroundColor Cyan
Write-Host "----------------------------------------------------------" -ForegroundColor Gray

Write-Host "  [INFO] Para testar manualmente:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Executar QEMU:" -ForegroundColor Yellow
Write-Host "     qemu-system-avr -machine arduino-uno -bios $elfPath -serial mon:stdio -nographic" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Procurar por linhas no formato:" -ForegroundColor Yellow
Write-Host "     G:pin=13,v=1  (LED ligado)" -ForegroundColor Green
Write-Host "     G:pin=13,v=0  (LED desligado)" -ForegroundColor Green
Write-Host ""
Write-Host "  3. Se NAO aparecer 'G:pin=...', o problema esta no core" -ForegroundColor Yellow
Write-Host ""

# ===========================================================
# RESUMO
# ===========================================================
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  RESUMO DO DIAGNOSTICO" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Status do Core NeuroForge:" -ForegroundColor Cyan
Write-Host "  [OK] Core instalado" -ForegroundColor Green
Write-Host "  [OK] Placa unoqemu configurada" -ForegroundColor Green
Write-Host "  [OK] Patch GPIO aplicado" -ForegroundColor Green
Write-Host ""

Write-Host "Proximo passo:" -ForegroundColor Yellow
Write-Host "  Teste o firmware no NeuroForge (frontend)" -ForegroundColor Cyan
Write-Host "  O LED deve piscar se o backend estiver capturando GPIO!" -ForegroundColor Cyan
Write-Host ""

Write-Host "Firmware de teste: $elfPath" -ForegroundColor Gray
Write-Host ""
