# Configuração de Firmware ESP32 para NeuroForge

Este guia explica como compilar firmwares ESP32 compatíveis com o QEMU da plataforma NeuroForge.

## Pré-requisitos

- **ESP-IDF v6.1+** instalado
- **QEMU ESP32** configurado (incluído no ESP-IDF)
- **Python 3.12** venv ativo
- **xtensa-esp-elf** toolchain no PATH

## Instalação do ESP-IDF (Windows)

### 1. Baixar ESP-IDF

```powershell
# Clone o repositório
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
git checkout release/v6.1
```

### 2. Instalar Dependencias

```powershell
# Executar o instalador
.\install.bat esp32
```

### 3. Configurar Ambiente

```powershell
# Ativar o ambiente ESP-IDF (fazer isso a cada sessão)
.\export.bat
```

## Estrutura de Projeto Recomendada

```
meu-projeto-esp32/
├── main/
│   ├── CMakeLists.txt
│   └── main.c
├── CMakeLists.txt
├── sdkconfig
└── partitions.csv
```

## Compilação para QEMU

### 1. Configurar Target ESP32

```bash
cd meu-projeto-esp32
idf.py set-target esp32
```

### 2. Compilar Projeto

```bash
idf.py build
```

### 3. Gerar Imagens QEMU

```bash
# Gera qemu_flash.bin e qemu_efuse.bin em build/
idf.py qemu --no-monitor
```

### 4. Copiar para NeuroForge

```bash
# Windows PowerShell
cp build/qemu_flash.bin D:\Projetos\neuroforge\server\test-firmware\esp32\
cp build/qemu_efuse.bin D:\Projetos\neuroforge\server\test-firmware\esp32\

# Linux/Mac
cp build/qemu_flash.bin /caminho/neuroforge/server/test-firmware/esp32/
cp build/qemu_efuse.bin /caminho/neuroforge/server/test-firmware/esp32/
```

## Integrar NeuroForgeGPIO_ESP32

### 1. Copiar Library

```bash
cp -r neuroforge/poc/libraries/NeuroForgeGPIO_ESP32 meu-projeto-esp32/components/
```

### 2. Estrutura do Componente

```
components/NeuroForgeGPIO_ESP32/
├── CMakeLists.txt
├── include/
│   └── NeuroForgeGPIO_ESP32.h
└── NeuroForgeGPIO_ESP32.c
```

### 3. Usar no Firmware

```c
#include "NeuroForgeGPIO_ESP32.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

void app_main(void) {
    // Inicializar NeuroForge GPIO
    nfGPIO_init();
    
    // Configurar GPIO
    gpio_set_direction(GPIO_NUM_2, GPIO_MODE_OUTPUT);
    
    // Loop com reportagem de GPIO
    while(1) {
        // LED ON
        gpio_set_level(GPIO_NUM_2, 1);
        nfGPIO_reportPin(2, 1);
        vTaskDelay(pdMS_TO_TICKS(500));
        
        // LED OFF
        gpio_set_level(GPIO_NUM_2, 0);
        nfGPIO_reportPin(2, 0);
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
```

## Protocolo Serial GPIO

O NeuroForge utiliza um protocolo serial simples para reportar mudanças de GPIO:

```
G:pin=<numero>,v=<valor>
```

**Exemplos:**
- `G:pin=2,v=1` - GPIO 2 mudou para HIGH
- `G:pin=13,v=0` - GPIO 13 mudou para LOW

### Funções Disponíveis

```c
// Inicializar o sistema (chamar no início)
void nfGPIO_init(void);

// Reportar estado de um pin individual
void nfGPIO_reportPin(uint8_t pin, uint8_t value);

// Reportar estado de todos os pins configurados
void nfGPIO_reportAll(void);
```

## Exemplo Completo: Blink LED

```c
#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "NeuroForgeGPIO_ESP32.h"

#define LED_PIN GPIO_NUM_2
#define BLINK_DELAY_MS 500

void app_main(void)
{
    // Inicializar NeuroForge GPIO
    nfGPIO_init();
    printf("NeuroForge ESP32 Blink Example\n");

    // Configurar GPIO 2 como saída
    gpio_reset_pin(LED_PIN);
    gpio_set_direction(LED_PIN, GPIO_MODE_OUTPUT);

    uint8_t led_state = 0;

    while (1) {
        // Alternar LED
        led_state = !led_state;
        gpio_set_level(LED_PIN, led_state);
        
        // Reportar estado para NeuroForge
        nfGPIO_reportPin(2, led_state);
        
        printf("LED %s\n", led_state ? "ON" : "OFF");
        
        vTaskDelay(pdMS_TO_TICKS(BLINK_DELAY_MS));
    }
}
```

## Testes

### 1. Testar Firmware Localmente com QEMU

```bash
# Iniciar QEMU ESP32 diretamente
idf.py qemu

# Em outro terminal, conectar ao serial TCP
telnet localhost 5555
```

### 2. Testar com NeuroForge

```bash
# Compilar e copiar imagens (passos anteriores)
cd neuroforge/server

# Rodar exemplo
tsx example-gpio-esp32.ts
```

**Saída esperada:**
```
🚀 ESP32 + QEMU + SerialGPIO Example
✅ Connected to ESP32 serial: 127.0.0.1:5555
📡 [Serial] NeuroForge ESP32 Blink Example
📡 [Serial] G:pin=2,v=1
🔄 [GPIO] Pin 2 changed: 0 → 1
📡 [Serial] LED ON
📡 [Serial] G:pin=2,v=0
🔄 [GPIO] Pin 2 changed: 1 → 0
📡 [Serial] LED OFF
```

## Troubleshooting

### Erro: "qemu-system-xtensa not found"

Certifique-se que ESP-IDF está no PATH:

```powershell
# Windows PowerShell
$env:Path += ";D:\Tools\esp-idf-tools\tools\qemu-xtensa\esp_develop_9.0.0_20240606\qemu\bin"
```

Ou configure a variável de ambiente em `server/.env`:

```env
ESP32_QEMU_PATH=D:\Tools\esp-idf-tools\tools\qemu-xtensa\esp_develop_9.0.0_20240606\qemu\bin\qemu-system-xtensa.exe
```

### Erro: "Serial port timeout"

Verifique se a porta TCP 5555 está disponível:

```bash
# Windows
netstat -an | findstr 5555

# Linux/Mac
lsof -i :5555
```

Se estiver em uso, configure outra porta em `.env`:

```env
ESP32_SERIAL_PORT=5556
```

### Erro: "Flash image not found"

Garanta que os arquivos `qemu_flash.bin` e `qemu_efuse.bin` foram gerados:

```bash
# Verificar arquivos
ls -l build/qemu_*.bin

# Regerar se necessário
idf.py qemu --no-monitor
```

### QEMU trava ou não responde

1. Desabilite o Watchdog Timer (já é o padrão):
   ```typescript
   qemuOptions: {
     wdtDisable: true
   }
   ```

2. Reduza a memória se necessário:
   ```typescript
   qemuOptions: {
     memory: '2M'
   }
   ```

## Referências

- [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [QEMU ESP32 Documentation](https://github.com/espressif/qemu)
- [GPIO Driver API](https://docs.espressif.com/projects/esp-idf/en/latest/api-reference/peripherals/gpio.html)
- [FreeRTOS Task API](https://www.freertos.org/a00106.html)
