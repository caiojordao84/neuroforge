# RP2040 QEMU Integration - Fixes & Progress Log

**Data Início:** 06/02/2026  
**Último Update:** 07/02/2026 17:00 WET  
**Status:** 🚧 EM PROGRESSO - Debugging QEMU Initialization  
**Branch:** `feature/rp2040-qemu-mvp`

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Setup Inicial](#setup-inicial)
3. [Implementação do SoC](#implementação-do-soc)
4. [Firmware Toolchain](#firmware-toolchain)
5. [Bugs e Correções](#bugs-e-correções)
6. [Status Atual](#status-atual)
7. [Próximos Passos](#próximos-passos)

---

## Visão Geral

### Objetivo
Integrar o Raspberry Pi Pico (RP2040) ao NeuroForge através de uma build customizada do QEMU, permitindo simulação de firmware bare-metal com suporte a GPIO, Serial e periféricos básicos.

### Arquitetura
```
NeuroForge App
    ↓
Rp2040Backend (TypeScript)
    ↓
QEMU ARM (qemu-system-arm.exe)
    ↓
raspberrypi-pico machine
    ↓
RP2040 SoC Emulation
    ↓
Firmware (blink.elf)
```

### Diferenças vs ESP32/AVR

| Aspecto | AVR | ESP32 | RP2040 |
|---------|-----|-------|--------|
| **QEMU** | Oficial | Espressif fork | **Custom build** |
| **CPU** | ATmega328P | Xtensa LX6 | **Dual Cortex-M0+** |
| **Toolchain** | avr-gcc | ESP-IDF | **arm-none-eabi-gcc** |
| **SDK** | Arduino | Arduino-ESP32 | **Bare-metal custom** |
| **Complexidade** | Baixa | Média | **Alta (custom SoC)** |

---

## Setup Inicial

### 1. Instalação do MSYS2 (Windows)

```bash
# Download MSYS2 installer
choco install msys2

# Atualizar pacotes
pacman -Syu

# Instalar dependências QEMU
pacman -S mingw-w64-x86_64-gcc \
          mingw-w64-x86_64-glib2 \
          mingw-w64-x86_64-pixman \
          mingw-w64-x86_64-ninja \
          mingw-w64-x86_64-meson \
          mingw-w64-x86_64-python \
          git make diffutils
```

### 2. Clone e Build do QEMU

```bash
# Clone oficial do QEMU
cd /c/qemu-project
git clone https://gitlab.com/qemu-project/qemu.git qemu-arm
cd qemu-arm
git checkout v9.2.0

# Configurar build (apenas ARM)
mkdir build && cd build
meson setup .. \
  --prefix=/c/qemu-project/qemu-arm/install \
  --target-list=arm-softmmu

# Compilar (primeira vez demora ~30-60min)
ninja

# Instalar
ninja install
```

### 3. Verificar Build

```bash
# Ver máquinas ARM disponíveis
./qemu-system-arm.exe -M help | grep -i pico
# (Inicialmente vazio - vamos criar)

# Ver CPUs disponíveis
./qemu-system-arm.exe -cpu help | grep -i cortex
# cortex-m0, cortex-m3, cortex-m4, etc.
```

---

## Implementação do SoC

### Arquivos Criados

```
qemu/patches/rp2040/
├── rp2040.h              # Header do SoC
├── rp2040_soc.c          # Implementação do SoC
├── raspberrypi_pico.c    # Machine type Pico
└── meson.build           # Build config
```

### Memory Map do RP2040

```c
/* Memory Regions */
#define RP2040_ROM_BASE      0x00000000  // 16KB Boot ROM
#define RP2040_FLASH_BASE    0x10000000  // 16MB Flash (XIP)
#define RP2040_SRAM_BASE     0x20000000  // 264KB SRAM
#define RP2040_SIO_BASE      0xD0000000  // Single-cycle I/O
#define RP2040_IO_BANK0_BASE 0x40014000  // GPIO config
#define RP2040_UART0_BASE    0x40034000  // UART0
#define RP2040_UART1_BASE    0x40038000  // UART1
```

### Periféricos Implementados

#### 1. GPIO via SIO (Single-cycle I/O)

```c
// Registos principais
0xD0000000  CPUID        (read-only, retorna 0 ou 1)
0xD0000004  GPIO_IN      (input state)
0xD0000010  GPIO_OUT     (output values)
0xD0000020  GPIO_OE      (output enable)

// Operações atómicas (SET/CLR/XOR)
0xD0000014  GPIO_OUT_SET
0xD0000018  GPIO_OUT_CLR
0xD000001C  GPIO_OUT_XOR
```

**Estado do GPIO:**
```c
typedef struct RP2040State {
    uint32_t gpio_out;      // Output values (30 pins)
    uint32_t gpio_oe;       // Output enable mask
    uint32_t gpio_in;       // Input values (external)
    uint32_t gpio_ctrl[30]; // Per-pin function select
} RP2040State;
```

#### 2. IO_BANK0 (GPIO Configuration)

```c
// Cada GPIO tem 8 bytes:
// 0x40014000 + (gpio_num * 8) + 0  →  GPIO0_STATUS (read-only)
// 0x40014000 + (gpio_num * 8) + 4  →  GPIO0_CTRL (FUNCSEL)

// Exemplo: GPIO25 (LED onboard)
0x400140C8  GPIO25_STATUS
0x400140CC  GPIO25_CTRL   (bits 0-4: function, 5=SIO)
```

#### 3. UARTs (PL011-compatible)

```c
// UART0 e UART1 baseados no ARM PL011
UART0: 0x40034000 - 0x40034FFF
UART1: 0x40038000 - 0x40038FFF

// QEMU já tem implementação PL011 pronta
// Apenas mapeamos os endereços e IRQs
```

### CPU Configuration

```c
// RP2040 usa Cortex-M0+ (arquitetura ARMv6-M)
// QEMU não tem cortex-m0plus, usamos cortex-m0

DeviceState *armv7m = DEVICE(&s->armv7m[0]);
qdev_prop_set_string(armv7m, "cpu-type", 
                     ARM_CPU_TYPE_NAME("cortex-m0"));
qdev_prop_set_uint32(armv7m, "num-irq", 32);
qdev_prop_set_uint32(armv7m, "num-prio-bits", 2);

// System clock (133MHz padrão)
s->sysclk = qdev_init_clock_in(DEVICE(obj), "sysclk", NULL, NULL, 0);
clock_set_hz(s->sysclk, 133000000);
qdev_connect_clock_in(armv7m, "cpuclk", s->sysclk);
```

---

## Firmware Toolchain

### 1. Instalação do ARM GCC

```bash
# Download do ARM GNU Toolchain
# https://developer.arm.com/downloads/-/gnu-rm

# Instalar no Windows:
# C:\Program Files (x86)\GNU Arm Embedded Toolchain\13.3 2024.06

# Adicionar ao PATH:
export PATH="$PATH:/c/Program Files (x86)/GNU Arm Embedded Toolchain/13.3 2024.06/bin"

# Verificar
arm-none-eabi-gcc --version
```

### 2. SDK Bare-Metal

**Estrutura de Pastas:**
```
firmware/rp2040/
├── sdk/
│   ├── include/
│   │   ├── rp2040.h         # Memory map e registos
│   │   └── hardware/
│   │       ├── gpio.h        # GPIO helpers
│   │       └── uart.h        # UART helpers
│   └── src/
│       ├── startup.c         # Vector table e reset
│       └── syscalls.c        # Minimal syscalls
├── examples/blink/
│   ├── main.c
│   ├── Makefile
│   └── rp2040.ld            # Linker script
└── Makefile.common
```

### 3. Linker Script

```ld
/* rp2040.ld - Memory layout */
MEMORY {
    FLASH (rx)  : ORIGIN = 0x10000000, LENGTH = 16M
    SRAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 264K
}

SECTIONS {
    .text : {
        KEEP(*(.vectors))     /* Vector table first */
        *(.text*)
        *(.rodata*)
    } > FLASH

    .data : {
        _sdata = .;
        *(.data*)
        _edata = .;
    } > SRAM AT > FLASH

    .bss : {
        _sbss = .;
        *(.bss*)
        *(COMMON)
        _ebss = .;
    } > SRAM

    _stack_top = ORIGIN(SRAM) + LENGTH(SRAM);
}
```

### 4. Startup Code

```c
/* startup.c - Minimal boot */
extern void main(void);
extern uint32_t _sdata, _edata, _sidata;
extern uint32_t _sbss, _ebss;
extern uint32_t _stack_top;

void Reset_Handler(void) {
    // Copy .data from Flash to SRAM
    uint32_t *src = &_sidata;
    uint32_t *dst = &_sdata;
    while (dst < &_edata) {
        *dst++ = *src++;
    }

    // Zero .bss
    dst = &_sbss;
    while (dst < &_ebss) {
        *dst++ = 0;
    }

    // Call main
    main();

    // Halt if main returns
    while(1);
}

__attribute__((section(".vectors")))
void (*const vectors[])(void) = {
    (void*)&_stack_top,   // Initial SP
    Reset_Handler,        // Reset
    // ... outros handlers
};
```

### 5. Makefile

```makefile
# Makefile para RP2040
CROSS = arm-none-eabi-
CC    = $(CROSS)gcc
OBJCP = $(CROSS)objcopy

CFLAGS  = -mcpu=cortex-m0 -mthumb -g -O0 \
          -I../../sdk/include \
          -ffunction-sections -fdata-sections

LDFLAGS = -T rp2040.ld -nostartfiles \
          --specs=nano.specs -Wl,--gc-sections

SRCS = main.c ../../sdk/src/startup.c ../../sdk/src/syscalls.c
OBJS = $(SRCS:.c=.o)

blink.elf: $(OBJS)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^

blink.bin: blink.elf
	$(OBJCP) -O binary $< $@

run: blink.elf
	qemu-system-arm.exe -M raspberrypi-pico \
	  -kernel blink.elf -nographic -serial mon:stdio
```

### 6. Exemplo Blink

```c
/* main.c - LED blink */
#include "rp2040.h"
#include "hardware/gpio.h"

#define LED_PIN 25

void delay(uint32_t ms) {
    for (volatile uint32_t i = 0; i < ms * 10000; i++);
}

int main(void) {
    // Configure GPIO25 as SIO output
    gpio_set_function(LED_PIN, GPIO_FUNC_SIO);
    gpio_set_dir(LED_PIN, GPIO_OUT);

    while (1) {
        gpio_put(LED_PIN, 1);
        delay(500);
        gpio_put(LED_PIN, 0);
        delay(500);
    }
}
```

---

## Bugs e Correções

### FIX 1: RAMBlock Duplicate (06/02/2026)

**Erro:**
```
RAMBlock "rp2040.sram" already registered, abort!
```

**Causa:**  
A machine `raspberrypi-pico` estava configurando `default_ram_id = "rp2040.sram"`, o que faz o QEMU criar automaticamente uma região de RAM. Mas o SoC **já cria** essa mesma região em `rp2040_soc_realize()`.

**Solução:**
```c
// raspberrypi_pico.c
static void raspberrypi_pico_machine_class_init(ObjectClass *oc, void *data) {
    MachineClass *mc = MACHINE_CLASS(oc);
    mc->desc = "Raspberry Pi Pico (RP2040)";
    mc->init = raspberrypi_pico_init;
    mc->max_cpus = 1;
    // REMOVER estas linhas:
    // mc->default_ram_id = "rp2040.sram";
    // mc->default_ram_size = 264 * KiB;
}
```

**Commit:** [a4d1514](https://github.com/caiojordao84/neuroforge/commit/a4d15147495ac12afa86130d423924345062df53)

---

### FIX 2: CPU Clock Missing (06/02/2026)

**Erro:**
```
qemu-system-arm.exe: armv7m: cpuclk must be connected
```

**Causa:**  
O container ARMv7M requer um clock conectado ao pino `cpuclk`. Sem isso, o CPU não inicializa.

**Solução:**
```c
// rp2040_soc.c - init
static void rp2040_soc_init(Object *obj) {
    RP2040State *s = RP2040_SOC(obj);
    // Criar clock input
    s->sysclk = qdev_init_clock_in(DEVICE(obj), "sysclk", 
                                    NULL, NULL, 0);
}

// rp2040_soc.c - realize
static void rp2040_soc_realize(DeviceState *dev, Error **errp) {
    RP2040State *s = RP2040_SOC(dev);
    
    // Set clock frequency (133 MHz)
    if (!clock_has_source(s->sysclk)) {
        clock_set_hz(s->sysclk, s->sysclk_freq);
    }
    
    // Connect to CPU
    DeviceState *armv7m = DEVICE(&s->armv7m[0]);
    qdev_connect_clock_in(armv7m, "cpuclk", s->sysclk);
}
```

**Também requer adicionar ao header:**
```c
// rp2040.h
#include "hw/qdev-clock.h"

typedef struct RP2040State {
    // ...
    Clock *sysclk;          // System clock
    uint32_t sysclk_freq;   // Frequency (property)
} RP2040State;
```

**Commits:** [35ba8c8](https://github.com/caiojordao84/neuroforge/commit/35ba8c827b8601eeba14fa1299fbb6909e14da30), [83d7c19](https://github.com/caiojordao84/neuroforge/commit/83d7c190c60e5cc440c72ec6b6e85a04adbb0e81)

---

### FIX 3: CPU Type Invalid (07/02/2026)

**Erro:**
```
qemu-system-arm.exe: invalid object type: cortex-m0plus-arm-cpu
```

**Causa:**  
O QEMU usa `cortex-m0p` para Cortex-M0+, mas esse nome não existe. Lista de CPUs disponíveis:
```
cortex-m0
cortex-m3
cortex-m33
cortex-m4
cortex-m55
cortex-m7
```

O QEMU **não tem Cortex-M0+**. A diferença entre M0 e M0+ é mínima (unprivileged instructions, MPU opcional).

**Solução:**
```c
// rp2040_soc.c
qdev_prop_set_string(armv7m, "cpu-type", 
                     ARM_CPU_TYPE_NAME("cortex-m0"));
// Note: Using cortex-m0 since QEMU doesn't have cortex-m0p
```

**Commit:** [725a2d4](https://github.com/caiojordao84/neuroforge/commit/725a2d4836250af2c2bc17df7b9a2dd626beb303)

---

### FIX 4: Device Not Realized (07/02/2026)

**Erro:**
```
ERROR:../hw/core/qdev.c:300:qdev_assert_realized_properly_cb: 
  assertion failed: (dev->realized)
```

**Causa:**  
Algum dispositivo não foi "realizado" (initialized) corretamente. Este erro geralmente indica:
1. Falta de `realize()` call
2. Ordem errada de inicialização
3. Propriedade obrigatória não definida

**Status:** 🚧 **EM DEBUG**  
Último teste tentou usar `qdev_realize()` mas falhou com:
```
ERROR:../hw/core/qdev.c:273:qdev_realize: 
  assertion failed: (!DEVICE_GET_CLASS(dev)->bus_type)
```

Isso indica que o ARMv7M **precisa de um bus**, então `sysbus_realize()` é o correto.

**Próxima tentativa:** Verificar se todas as propriedades estão definidas antes do realize.

---

## Status Atual

### ✅ Completo

1. **QEMU Build**
   - Compilação do QEMU ARM no Windows (MSYS2)
   - Arquivos de SoC no source tree
   - Build config (meson.build) integrado

2. **RP2040 SoC**
   - Memory map completo (ROM, SRAM, Flash)
   - GPIO via SIO (registos atómicos)
   - IO_BANK0 (function select)
   - UARTs (PL011)
   - Stub de Timer e USB

3. **Machine Type**
   - `raspberrypi-pico` machine
   - ELF loading
   - Serial redirection

4. **Firmware Toolchain**
   - arm-none-eabi-gcc instalado
   - SDK bare-metal mínimo
   - Linker script
   - Startup code
   - Makefile funcional
   - Exemplo blink compilado

5. **Bug Fixes**
   - RAMBlock duplicate → Fixed
   - CPU clock missing → Fixed
   - CPU type invalid → Fixed (usar cortex-m0)

### 🚧 Em Progresso

1. **QEMU Initialization**
   - Debug de assertion failures no qdev
   - Validar ordem de device realization
   - Testar boot sequence do CPU

### ⏳ Pendente

1. **Backend Integration**
   - Criar `Rp2040Backend` classe
   - Integrar com `QEMURunner`
   - Cliente TCP para UART

2. **GPIO Protocol**
   - Port do shim ESP32 para Pico SDK
   - Reportar via printf
   - Integrar com `SerialGPIOParser`

3. **Testing**
   - Validar blink LED no canvas
   - Multi-pin GPIO
   - Performance testing

---

## Próximos Passos

### Imediato (Debug QEMU)

1. **Investigar qdev realize**
   ```bash
   # Rodar com debug verbose
   qemu-system-arm.exe -M raspberrypi-pico \
     -kernel blink.elf -d guest_errors,unimp \
     -nographic -serial mon:stdio 2>&1 | tee qemu-debug.log
   ```

2. **Comparar com machine funcional**
   - Estudar `hw/arm/stm32f205_soc.c` (Cortex-M3)
   - Estudar `hw/arm/netduino2.c` (machine similar)
   - Comparar ordem de device initialization

3. **Simplificar SoC**
   - Remover UARTs temporariamente
   - Testar apenas CPU + RAM
   - Adicionar periféricos um por um

### Curto Prazo (Backend)

1. **Criar Rp2040Backend**
   ```typescript
   class Rp2040Backend extends BaseBackend {
     async compile(code: string): Promise<string> {
       // Usar arm-none-eabi-gcc
     }
     
     async startQemu(elfPath: string): Promise<void> {
       // Lançar qemu-system-arm -M raspberrypi-pico
     }
   }
   ```

2. **GPIO Shim**
   ```c
   // rp2040-gpio-shim.c
   void gpio_put(uint pin, bool value) {
       // Real GPIO
       sio_hw->gpio_out = (sio_hw->gpio_out & ~(1u << pin)) 
                        | (value << pin);
       
       // Report to NeuroForge
       printf("G:pin=%u,v=%u\n", pin, value);
   }
   ```

3. **Integration Testing**
   - End-to-end test: código → compile → QEMU → GPIO → canvas
   - Performance: medir latência de GPIO updates
   - Reliability: stress test com múltiplos pinos

### Médio Prazo (Features)

1. **Dual-Core Support**
   - Implementar Core 1 initialization
   - SIO FIFO para inter-core communication
   - Mutex e spinlock helpers

2. **PIO (Programmable I/O)**
   - State machine emulation (se viável)
   - Suporte básico a protocols (I2C, SPI)

3. **Board Profiles**
   - JSON para Pico e Pico W
   - Pinout diagrams
   - Peripheral mapping

---

## Referências

### Documentação Oficial
- [RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)
- [Pico SDK Documentation](https://raspberrypi.github.io/pico-sdk-doxygen/)
- [QEMU ARM System Emulation](https://www.qemu.org/docs/master/system/target-arm.html)
- [ARM Cortex-M0 TRM](https://developer.arm.com/documentation/ddi0432/c/)

### Código de Referência
- [QEMU STM32F205 SoC](https://github.com/qemu/qemu/blob/master/hw/arm/stm32f205_soc.c)
- [QEMU ARMv7M Container](https://github.com/qemu/qemu/blob/master/hw/arm/armv7m.c)
- [Pico SDK HAL](https://github.com/raspberrypi/pico-sdk/tree/master/src/rp2_common/hardware_gpio)

### Commits Relevantes
- [a4d1514](https://github.com/caiojordao84/neuroforge/commit/a4d15147495ac12afa86130d423924345062df53) - Remove default_ram_id
- [35ba8c8](https://github.com/caiojordao84/neuroforge/commit/35ba8c827b8601eeba14fa1299fbb6909e14da30) - Add CPU clock
- [83d7c19](https://github.com/caiojordao84/neuroforge/commit/83d7c190c60e5cc440c72ec6b6e85a04adbb0e81) - Add Clock* to header
- [725a2d4](https://github.com/caiojordao84/neuroforge/commit/725a2d4836250af2c2bc17df7b9a2dd626beb303) - Use cortex-m0
- [a6edfb9](https://github.com/caiojordao84/neuroforge/commit/a6edfb9837204b149e41d255f6d0853f3938327e) - Try qdev_realize
- [1020d6f](https://github.com/caiojordao84/neuroforge/commit/1020d6f84b167f8fdc569f76e3b5b3265f1d410d) - Revert to sysbus_realize

---

**Última Atualização:** 07/02/2026 17:00 WET  
**Próximo Milestone:** QEMU boot successful → Backend integration
