# NeuroForge Fixes & Workarounds

Documentação de problemas encontrados e soluções aplicadas durante o desenvolvimento do NeuroForge.

---

## 🐛 FIX #1: QEMU Serial via stdio não funciona no Windows

### Problema
- QEMU iniciava com `-serial stdio` mas **nenhum dado serial era capturado**
- `stdout` do processo Node.js ficava vazio
- GPIO protocol não chegava ao backend

### Causa Raiz
- No Windows, `spawn()` do Node.js com `stdio: ['ignore', 'pipe', 'pipe']` não redireciona corretamente o stdout do QEMU
- O `-serial stdio` funciona apenas quando QEMU é executado diretamente no terminal

### Solução Aplicada
1. **Backend cria TCP server** na porta 5555 **ANTES** de iniciar QEMU
2. **QEMU se conecta como cliente** usando `-serial tcp:127.0.0.1:5555`
3. Dados serial são recebidos via socket TCP

### Arquivos Modificados
- `server/src/services/QEMURunner.ts`
  - Método `setupSerialTCPServer()`: Cria servidor TCP
  - Método `handleSerialData()`: Processa dados recebidos
  - Args QEMU: `-serial tcp:127.0.0.1:5555` (sem `server` flag)

### Commits
- `08b83a9` - fix: Make QEMU connect to backend TCP server (remove 'server' flag)
- `092ef1c` - fix: Use TCP serial instead of stdio for Windows compatibility

---

## 🐛 FIX #2: Dados TCP fragmentados

### Problema
- TCP entrega dados em fragmentos:
  ```
  Fragment 1: "G:pin"
  Fragment 2: "=11,v=0\n"
  ```
- Parser não reconhece protocolo GPIO incompleto

### Solução Aplicada
- **Buffer TCP** acumula fragmentos até encontrar `\n`
- Apenas linhas completas são emitidas como eventos

### Arquivos Modificados
- `server/src/services/QEMURunner.ts`
  - Adicionado: `private serialBuffer: string = ''`
  - Método `handleSerialData()`: Acumula em buffer, split por `\n`

### Commit
- `2bd66e3` - fix: Add TCP buffer to handle fragmented GPIO data

---

## 🐛 FIX #3: Código do usuário sem Serial.begin()

### Problema
- Usuário escreve código sem `Serial.begin(115200)`
- Core NeuroForge precisa de Serial para emitir GPIO protocol
- Firmware compila mas não envia dados serial

### Solução Aplicada
- **Auto-inject** `Serial.begin(115200)` no início de `setup()`
- Apenas se não existir no código original
- Funciona para Arduino AVR (ESP32 usa shim separado)

### Arquivos Modificados
- `server/src/services/CompilerService.ts`
  - Método `injectSerialBegin()`: Detecta e injeta Serial.begin()
  - Regex: `/void\s+setup\s*\(\s*\)\s*\{/`

### Commit
- `6e2544e` - fix: Auto-inject Serial.begin() for Arduino GPIO protocol

---

## 📦 Backup & Restore dos Cores Customizados

### Arduino AVR Core (NeuroForge GPIO Protocol)

**Localização:**
```
%LOCALAPPDATA%\Arduino15\packages\arduino\hardware\avr\1.8.6\
```

**Arquivos modificados:**
- `boards.txt` - Adiciona board `unoqemu`
- `cores/arduino/wiring_digital.c` - Adiciona `nf_report_gpio()`
- `cores/arduino/neuroforge.h` - Header do protocolo

#### 🔄 Backup (PowerShell)

```powershell
# Criar backup do core Arduino AVR modificado
$avrCore = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.6"
$backupDir = "D:\Documents\NeuroForge\backups\arduino-avr-core"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$backupDir\backup_$timestamp"

New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

# Copiar arquivos modificados
Copy-Item "$avrCore\boards.txt" "$backupPath\boards.txt"
Copy-Item "$avrCore\cores\arduino\wiring_digital.c" "$backupPath\wiring_digital.c"
Copy-Item "$avrCore\cores\arduino\neuroforge.h" "$backupPath\neuroforge.h"

Write-Host "✅ Backup criado: $backupPath" -ForegroundColor Green
```

#### 🔙 Restore (PowerShell)

```powershell
# Restaurar core Arduino AVR a partir de backup
$avrCore = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.6"
$backupPath = "D:\Documents\NeuroForge\backups\arduino-avr-core\backup_XXXXXXXX_XXXXXX"  # Substituir pelo timestamp

# Verificar se backup existe
if (-not (Test-Path $backupPath)) {
    Write-Host "❌ Backup não encontrado: $backupPath" -ForegroundColor Red
    exit 1
}

# Restaurar arquivos
Copy-Item "$backupPath\boards.txt" "$avrCore\boards.txt" -Force
Copy-Item "$backupPath\wiring_digital.c" "$avrCore\cores\arduino\wiring_digital.c" -Force
Copy-Item "$backupPath\neuroforge.h" "$avrCore\cores\arduino\neuroforge.h" -Force

Write-Host "✅ Core Arduino AVR restaurado!" -ForegroundColor Green
```

---

### ESP32 Core (NeuroForge GPIO Protocol)

**Localização:**
```
%LOCALAPPDATA%\Arduino15\packages\esp32\hardware\esp32\2.0.14\
```

**Arquivos modificados:**
- `cores/esp32/esp32-hal-gpio.c` - Adiciona `__attribute__((weak)) void nf_report_gpio()`
- `cores/esp32/neuroforge.h` - Header do protocolo

#### 🔄 Backup (PowerShell)

```powershell
# Criar backup do core ESP32 modificado
$esp32Core = "$env:LOCALAPPDATA\Arduino15\packages\esp32\hardware\esp32\2.0.14"
$backupDir = "D:\Documents\NeuroForge\backups\esp32-core"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupPath = "$backupDir\backup_$timestamp"

New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

# Copiar arquivos modificados
Copy-Item "$esp32Core\cores\esp32\esp32-hal-gpio.c" "$backupPath\esp32-hal-gpio.c"
Copy-Item "$esp32Core\cores\esp32\neuroforge.h" "$backupPath\neuroforge.h"

Write-Host "✅ Backup criado: $backupPath" -ForegroundColor Green
```

#### 🔙 Restore (PowerShell)

```powershell
# Restaurar core ESP32 a partir de backup
$esp32Core = "$env:LOCALAPPDATA\Arduino15\packages\esp32\hardware\esp32\2.0.14"
$backupPath = "D:\Documents\NeuroForge\backups\esp32-core\backup_XXXXXXXX_XXXXXX"  # Substituir pelo timestamp

# Verificar se backup existe
if (-not (Test-Path $backupPath)) {
    Write-Host "❌ Backup não encontrado: $backupPath" -ForegroundColor Red
    exit 1
}

# Restaurar arquivos
Copy-Item "$backupPath\esp32-hal-gpio.c" "$esp32Core\cores\esp32\esp32-hal-gpio.c" -Force
Copy-Item "$backupPath\neuroforge.h" "$esp32Core\cores\esp32\neuroforge.h" -Force

Write-Host "✅ Core ESP32 restaurado!" -ForegroundColor Green
```

---

## 🔍 Diagnóstico: Verificar se Core está instalado

### Arduino AVR

```powershell
# Verificar se board unoqemu existe
$boardsTxt = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.6\boards.txt"
Select-String -Path $boardsTxt -Pattern "unoqemu.name"

# Verificar se nf_report_gpio existe
$wiringDigital = "$env:LOCALAPPDATA\Arduino15\packages\arduino\hardware\avr\1.8.6\cores\arduino\wiring_digital.c"
Select-String -Path $wiringDigital -Pattern "nf_report_gpio"
```

**Saída esperada:**
```
unoqemu.name=Arduino Uno (QEMU)
void nf_report_gpio(char mode, uint8_t pin, uint8_t val) {
```

### ESP32

```powershell
# Verificar weak symbol no core
$gpioHal = "$env:LOCALAPPDATA\Arduino15\packages\esp32\hardware\esp32\2.0.14\cores\esp32\esp32-hal-gpio.c"
Select-String -Path $gpioHal -Pattern "__attribute__\(\(weak\)\) void nf_report_gpio"
```

**Saída esperada:**
```
__attribute__((weak)) void nf_report_gpio(char mode, uint8_t pin, uint8_t val) {
```

---

## ✅ Status Atual (10/02/2026)

### Arduino UNO + QEMU
- ✅ Compilação com core customizado (`arduino:avr:unoqemu`)
- ✅ QEMU rodando com serial TCP
- ✅ GPIO protocol funcionando (M:, G:)
- ✅ Serial Monitor funcionando
- ✅ Auto-inject Serial.begin()
- ✅ LEDs piscando no frontend
- ✅ NeuroForge Time funcionando (`-icount shift=auto`)

### ESP32 + QEMU
- ✅ Compilação com shim
- ✅ QEMU rodando
- ✅ GPIO protocol funcionando
- ✅ Serial Monitor funcionando
- ⚠️ NeuroForge Time ainda não testado

### JavaScript Interpreter
- ✅ Funcionando 100%
- ✅ digitalWrite, pinMode, delay
- ✅ Serial Monitor

---

## 🚀 Próximos Passos

1. **Documentar instalação dos cores** no README principal
2. **Criar script de instalação automática** dos cores modificados
3. **Testar NeuroForge Time no ESP32**
4. **Adicionar suporte a analog pins** (analogRead, analogWrite)
5. **Implementar QEMU Monitor** para leitura de GPIO

---

## 📝 Notas Importantes

### Performance
- **TCP Serial**: ~1ms de latência, aceitável para simulação
- **Buffer**: Acumula até encontrar `\n`, evita fragmentação
- **Health Check**: 10s interval para não poluir logs

### Limitações Conhecidas
- **Windows Only**: Serial TCP é workaround para Windows (Linux/Mac podem usar stdio)
- **Single Client**: TCP server aceita apenas 1 conexão QEMU por vez
- **No Analog**: Ainda não implementado (TODO)

### Debug
- Logs detalhados em `QEMURunner.ts`
- Use `📥`, `📤`, `🔍` emojis para filtrar logs
- Serial Monitor mostra timestamp `[HH:mm:ss]`
