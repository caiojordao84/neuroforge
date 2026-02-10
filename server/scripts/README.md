# 🛠️ Scripts NeuroForge

Scripts de utilitário para manutenção e backup do projeto NeuroForge.

---

## 📋 Índice

- [backup-cores.ps1](#-backup-coresps1) - Backup completo de todos os cores customizados
- [diagnose-arduino-gpio.ps1](#-diagnose-arduino-gpiops1) - Diagnóstico de problemas GPIO Arduino
- [fix-arduino-gpio.ps1](#-fix-arduino-gpiops1) - Correção automática de GPIO
- [Guia de Restauração](#-guia-de-restauração)
- [FAQ](#-perguntas-frequentes)

---

## 💾 backup-cores.ps1

### Descrição

Script PowerShell que cria backup completo de **todos os componentes críticos** do NeuroForge:

1. **Core NeuroForge AVR** (`neuroforge_qemu`)
   - Custom core Arduino com protocolo GPIO
   - Patches em `wiring_digital.c`
   - Definições de placa `unoqemu`

2. **ESP32 QEMU**
   - Binário `qemu-system-xtensa.exe`
   - Arquivos de dados (BIOS, ROMs)
   - Configurações customizadas

3. **Configurações**
   - Arquivo `.env` do servidor
   - Firmwares de teste

### Uso

```powershell
cd D:\Documents\NeuroForge\neuroforge\server\scripts
.\backup-cores.ps1
```

---

## 🔍 diagnose-arduino-gpio.ps1

### Descrição

**Quando usar:** LED não pisca no Arduino QEMU apesar do sketch compilar.

Este script verifica **todo o fluxo GPIO** do Arduino AVR:

1. ✅ Core NeuroForge instalado
2. ✅ Placa `unoqemu` definida
3. ✅ Patch em `wiring_digital.c` aplicado
4. ✅ Firmware compila corretamente
5. ✅ Símbolos NeuroForge linkados no ELF
6. ✅ QEMU emite protocolo `G:pin=X,v=Y`

### Uso

```powershell
cd D:\Documents\NeuroForge\neuroforge\server\scripts
.\diagnose-arduino-gpio.ps1
```

### Saída Esperada

```
═══════════════════════════════════════════════════
  Arduino GPIO Diagnostic Tool
═══════════════════════════════════════════════════

[1/6] Verificando Core NeuroForge...
───────────────────────────────────────────────────
  ✅ Core instalado
  ✅ nf_gpio.cpp
  ✅ nf_gpio.h
  ✅ nf_time.cpp
  ✅ nf_time.h

[2/6] Verificando Placa unoqemu...
───────────────────────────────────────────────────
  ✅ Placa unoqemu definida
  ✅ Core configurado: neuroforge_qemu

[3/6] Verificando Patch GPIO...
───────────────────────────────────────────────────
  ❌ Header nf_gpio.h NÃO incluído
  ❌ Função nf_report_gpio() NÃO chamada
  ⚠️  PROBLEMA ENCONTRADO!

RESOLUÇÃO:
  Execute: .\fix-arduino-gpio.ps1
```

---

## 🔧 fix-arduino-gpio.ps1

### Descrição

**Problema resolvido:** `digitalWrite()` não emite protocolo GPIO.

Este script **automaticamente**:

1. 📋 Faz backup de `wiring_digital.c`
2. ➕ Adiciona `#include "../neuroforge_qemu/nf_gpio.h"`
3. 🔧 Insere `nf_report_gpio(pin, val)` dentro de `digitalWrite()`
4. ✅ Verifica se o patch foi aplicado corretamente

### Uso

```powershell
cd D:\Documents\NeuroForge\neuroforge\server\scripts
.\fix-arduino-gpio.ps1
```

### Com Sobrescrita Forçada

```powershell
.\fix-arduino-gpio.ps1 -Force
```

### Saída Esperada

```
═══════════════════════════════════════════════════
  Arduino GPIO Fix Tool
═══════════════════════════════════════════════════

[1/4] Verificando arquivos...
  ✅ wiring_digital.c encontrado

[2/4] Criando backup...
  ✅ Backup criado: wiring_digital.c.neuroforge_backup

[3/4] Aplicando patch GPIO...
  🔧 Modificando wiring_digital.c...
  ✅ Include adicionado
  ✅ Patch aplicado em digitalWrite()
  ✅ Arquivo salvo

[4/4] Verificando patch...
  ✅ Include presente
  ✅ Chamada nf_report_gpio() presente

═══════════════════════════════════════════════════
  ✅ PATCH APLICADO COM SUCESSO!
═══════════════════════════════════════════════════

Próximos passos:
  1. Recompilar firmware:
     arduino-cli compile --clean --fqbn arduino:avr:unoqemu blink.ino

  2. Testar com QEMU:
     qemu-system-avr -machine arduino-uno -bios blink.elf -serial mon:stdio

  3. Procurar linhas:
     G:pin=13,v=1  (LED ligado)
     G:pin=13,v=0  (LED desligado)
```

---

## 🐞 Workflow de Diagnóstico

### Problema: LED não pisca no Arduino QEMU

```powershell
# 1. Diagnosticar problema
.\diagnose-arduino-gpio.ps1

# 2. Se detectar problema de GPIO, aplicar correção
.\fix-arduino-gpio.ps1

# 3. Recompilar firmware
arduino-cli compile --clean --fqbn arduino:avr:unoqemu blink.ino

# 4. Testar com QEMU manualmente
qemu-system-avr -machine arduino-uno `
                -bios build/arduino.avr.unoqemu/blink.ino.elf `
                -serial mon:stdio -nographic

# 5. Verificar saída (deve aparecer):
# G:pin=13,v=1
# G:pin=13,v=0
```

### Problema: Reverteu atualização e perdeu GPIO

```powershell
# Core Arduino foi atualizado e perdeu o patch
.\fix-arduino-gpio.ps1 -Force
```

---

## 🔄 Guia de Restauração

### Cenário 1: Sistema Novo (Instalação Limpa)

```powershell
# 1. Instalar Arduino CLI
winget install ArduinoSA.CLI

# 2. Instalar cores base
arduino-cli core install arduino:avr@1.8.7
arduino-cli core install esp32:esp32@3.3.6

# 3. Restaurar Core NeuroForge
$BACKUP = "D:\Backups\NeuroForge\cores_20260210_095530"
$CORE_PATH = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores"

Copy-Item -Path "$BACKUP\neuroforge_avr_core" -Destination "$CORE_PATH\neuroforge_qemu" -Recurse -Force

# 4. Atualizar boards.txt
$BOARDS_TXT = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\boards.txt"
Get-Content "$BACKUP\boards.txt" | Add-Content $BOARDS_TXT

# 5. Aplicar patch GPIO
.\fix-arduino-gpio.ps1

# 6. Verificar
arduino-cli board listall | Select-String "unoqemu"
```

---

### Cenário 2: Core Corrompido (Reinstalação Rápida)

```powershell
$BACKUP = "D:\Backups\NeuroForge\cores_20260210_095530"
$CORE_PATH = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores"

# Remover core antigo
Remove-Item -Path "$CORE_PATH\neuroforge_qemu" -Recurse -Force -ErrorAction SilentlyContinue

# Restaurar do backup
Copy-Item -Path "$BACKUP\neuroforge_avr_core" -Destination "$CORE_PATH\neuroforge_qemu" -Recurse -Force

# Reaplicar patch GPIO
.\fix-arduino-gpio.ps1 -Force

Write-Host "✅ Core restaurado!" -ForegroundColor Green
```

---

## 💡 Dicas

### Automatizar Backup Semanal

Criar task no Windows Task Scheduler:

```powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-File D:\Documents\NeuroForge\neuroforge\server\scripts\backup-cores.ps1"

$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 2am

Register-ScheduledTask -TaskName "NeuroForge Backup" -Action $action -Trigger $trigger
```

### Backup em Nuvem

```powershell
# Após executar backup-cores.ps1, sincronizar com OneDrive/Google Drive
robocopy "D:\Backups\NeuroForge" "C:\Users\USER\OneDrive\NeuroForge_Backups" /MIR
```

### Verificar se Patch Funciona

```powershell
# 1. Criar sketch de teste
$sketch = @"
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
"@

Set-Content -Path "test.ino" -Value $sketch

# 2. Compilar
arduino-cli compile --fqbn arduino:avr:unoqemu test.ino

# 3. Verificar símbolos
$avrNm = "$env:LOCALAPPDATA\Arduino15\packages\arduino\tools\avr-gcc\7.3.0-atmel3.6.1-arduino7\bin\avr-nm.exe"
& $avrNm build/arduino.avr.unoqemu/test.ino.elf | Select-String "nf_report_gpio"

# 4. Se retornar algo, o patch está funcionando!
```

---

## ❓ Perguntas Frequentes

### O patch sobrevive a atualizações do Arduino CLI?

**Não.** Se você atualizar o core `arduino:avr`, o patch será perdido.

**Solução:**
```powershell
# Após atualizar core AVR:
.\fix-arduino-gpio.ps1 -Force
```

### Como saber se o LED deveria estar piscando?

**Teste direto com QEMU:**
```powershell
qemu-system-avr -machine arduino-uno -bios blink.elf -serial mon:stdio -nographic
```

**Deve aparecer:**
```
G:pin=13,v=1
G:pin=13,v=0
G:pin=13,v=1
G:pin=13,v=0
```

Se não aparece, o problema é no core (execute `fix-arduino-gpio.ps1`).

### O ESP32 também precisa de patch?

**Não.** O ESP32 usa um core diferente que já emite o protocolo GPIO nativamente.

### Como restaurar o wiring_digital.c original?

```powershell
$ARDUINO_CORE = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.7\cores\arduino"
Copy-Item -Path "$ARDUINO_CORE\wiring_digital.c.neuroforge_backup" `
          -Destination "$ARDUINO_CORE\wiring_digital.c" -Force
```

---

## 🔒 Segurança

### Localizações Recomendadas

1. **Local:** `D:\Backups\NeuroForge\` (SSD/HD secundário)
2. **Nuvem:** OneDrive, Google Drive, Dropbox
3. **Externo:** Pen drive, HD externo (criptografado)

### Retenção

- **Últimos 7 dias:** Todos os backups
- **Último mês:** Backup semanal
- **Último ano:** Backup mensal

---

## 📞 Suporte

Problemas ao restaurar? Consulte:

1. `README_AVR.txt` dentro do backup
2. `README_ESP32.txt` dentro do backup
3. `INVENTARIO.txt` para verificar integridade
4. Execute `.\diagnose-arduino-gpio.ps1` para diagnóstico completo

---

**Última atualização:** 10/02/2026  
**Versão:** 1.1.0
