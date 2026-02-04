# ESP32 Test Firmware

Este diretório contém as imagens de firmware ESP32 compiladas para execução no QEMU.

## Arquivos Necessários

Para executar simulações ESP32, você precisa dos seguintes arquivos neste diretório:

```
server/test-firmware/esp32/
├── qemu_flash.bin     # Imagem da flash contendo o firmware
└── qemu_efuse.bin     # Imagem dos eFuses do ESP32
```

## Como Gerar os Arquivos

### 1. Compilar um Projeto ESP-IDF

```bash
cd /caminho/do/seu/projeto-esp32
idf.py set-target esp32
idf.py build
```

### 2. Gerar Imagens QEMU

```bash
idf.py qemu --no-monitor
```

Isso criará os arquivos `qemu_flash.bin` e `qemu_efuse.bin` no diretório `build/`.

### 3. Copiar para este Diretório

**Windows PowerShell:**
```powershell
cp build/qemu_flash.bin D:\Projetos\neuroforge\server\test-firmware\esp32\
cp build/qemu_efuse.bin D:\Projetos\neuroforge\server\test-firmware\esp32\
```

**Linux/Mac:**
```bash
cp build/qemu_flash.bin /caminho/neuroforge/server/test-firmware/esp32/
cp build/qemu_efuse.bin /caminho/neuroforge/server/test-firmware/esp32/
```

## Exemplo Rápido

Para um teste rápido, use o projeto `hello_world` do ESP-IDF:

```bash
# Copiar exemplo
cp -r $IDF_PATH/examples/get-started/hello_world ./teste-esp32
cd teste-esp32

# Compilar
idf.py set-target esp32
idf.py build

# Gerar imagens QEMU
idf.py qemu --no-monitor

# Copiar para NeuroForge
cp build/qemu_*.bin /caminho/neuroforge/server/test-firmware/esp32/
```

## Usando com NeuroForge GPIO

Para firmwares que utilizam o protocolo GPIO do NeuroForge, integre a library `NeuroForgeGPIO_ESP32`:

1. Copie o componente:
   ```bash
   cp -r neuroforge/poc/libraries/NeuroForgeGPIO_ESP32 seu-projeto/components/
   ```

2. Use no código:
   ```c
   #include "NeuroForgeGPIO_ESP32.h"
   
   void app_main(void) {
       nfGPIO_init();
       // ... seu código ...
       nfGPIO_reportPin(2, 1);
   }
   ```

## Executar Exemplo

Após copiar os arquivos:

```bash
cd server
tsx example-gpio-esp32.ts
```

## Referências

- [Guia Completo de Setup ESP32](../../docs/firmware/esp32-idf-setup.md)
- [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/latest/)
