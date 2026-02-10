# 🛠️ Scripts NeuroForge

Scripts de utilitário para manutenção e backup do projeto NeuroForge.

---

## 📋 Índice

- [backup-cores.ps1](#-backup-coresps1) - Backup completo de todos os cores customizados
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

---

### Uso

#### Backup Padrão (Recomendado)

```powershell
cd D:\Documents\NeuroForge\neuroforge\server\scripts
.\backup-cores.ps1
```

**Resultado:** Cria backup em `D:\Backups\NeuroForge\cores_YYYYMMDD_HHMMSS`

#### Backup em Local Customizado

```powershell
.\backup-cores.ps1 -BackupDir "E:\MeusBackups\NeuroForge_20260210"
```

---

### Saída do Script

```
═══════════════════════════════════════════════
  NeuroForge Core Backup Tool
═══════════════════════════════════════════════

📁 Diretório de backup: D:\Backups\NeuroForge\cores_20260210_095530

[1/5] Core NeuroForge AVR (Arduino QEMU)
─────────────────────────────────────────
  ✅ Core copiado: D:\Backups\NeuroForge\cores_20260210_095530\neuroforge_avr_core
  ✅ boards.txt: D:\Backups\NeuroForge\cores_20260210_095530\boards.txt
  ✅ wiring_digital.c: D:\Backups\NeuroForge\cores_20260210_095530\wiring_digital.c

[2/5] ESP32 QEMU (Binário + Configurações)
─────────────────────────────────────────
  ✅ Binário QEMU: D:\Backups\NeuroForge\cores_20260210_095530\esp32_qemu\qemu-system-xtensa.exe
  ✅ Data files: D:\Backups\NeuroForge\cores_20260210_095530\esp32_qemu\data

═══════════════════════════════════════════════
  ✅ BACKUP CONCLUÍDO COM SUCESSO!
═══════════════════════════════════════════════
```

---

### Estrutura do Backup

```
D:\Backups\NeuroForge\cores_20260210_095530\
├── neuroforge_avr_core\         # Core completo
│   ├── nf_gpio.cpp
│   ├── nf_gpio.h
│   ├── nf_time.cpp
│   ├── nf_time.h
│   ├── nf_arduino_time.cpp
│   └── boards.txt
├── esp32_qemu\                 # QEMU ESP32
│   ├── qemu-system-xtensa.exe
│   └── data\                   # BIOSes, ROMs
├── esp32_firmware\             # Firmwares de teste
│   ├── qemu_flash.bin
│   └── qemu_efuse.bin
├── boards.txt                  # Definições de placas
├── wiring_digital.c            # Arduino core com patch
├── .env                        # Configurações do servidor
├── README_AVR.txt              # Guia de restauração AVR
├── README_ESP32.txt            # Guia de restauração ESP32
└── INVENTARIO.txt              # Índice completo
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

# 5. Aplicar patch em wiring_digital.c
Copy-Item -Path "$BACKUP\wiring_digital.c" -Destination "$CORE_PATH\arduino\wiring_digital.c" -Force

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

Write-Host "✅ Core restaurado!" -ForegroundColor Green
```

---

### Cenário 3: ESP32 QEMU Não Funciona

```powershell
$BACKUP = "D:\Backups\NeuroForge\cores_20260210_095530"

# Restaurar binário
Copy-Item -Path "$BACKUP\esp32_qemu\qemu-system-xtensa.exe" `
          -Destination "C:\qemu-project\builds\esp32\bin\qemu-system-xtensa.exe" -Force

# Restaurar data files
Copy-Item -Path "$BACKUP\esp32_qemu\data" `
          -Destination "C:\qemu-project\builds\esp32\share\qemu" -Recurse -Force

# Testar
qemu-system-xtensa.exe --version
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

---

## ❓ Perguntas Frequentes

### O core precisa ser reinstalado após atualizar Arduino CLI?

**Sim.** Se você atualizar o core `arduino:avr` (ex: 1.8.7 → 1.8.8), o NeuroForge core será perdido.

**Solução:**
1. Fazer backup antes de atualizar
2. Após atualizar, restaurar o core na nova versão

### O backup inclui bibliotecas Arduino?

**Não.** O backup foca em:
- Cores customizados (NeuroForge)
- QEMU binários (ESP32)
- Configurações do projeto

Bibliotecas Arduino padrão podem ser reinstaladas via `arduino-cli lib install`.

### Como saber qual versão do core AVR tenho?

```powershell
arduino-cli core list | Select-String "arduino:avr"
```

### Posso usar o backup em outro PC?

**Sim!** Mas ajuste os caminhos:
- Abra `INVENTARIO.txt` no backup
- Execute os comandos de restauração ajustando os paths

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

---

**Última atualização:** 10/02/2026  
**Versão:** 1.0.0
