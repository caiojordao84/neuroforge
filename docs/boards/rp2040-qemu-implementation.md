# 🎯 Implementação RP2040 no QEMU - Especificação Técnica

**Data:** 2026-02-07  
**Versão:** 1.0  
**Status:** 🟢 Aprovado - Em Desenvolvimento  
**Branch:** `feature/rp2040-qemu-mvp`

---

## 📋 ÍNDICE

1. [Visão Geral](#1-visão-geral)
2. [Mapa de Memória RP2040](#2-mapa-de-memória-rp2040)
3. [Estrutura de Arquivos QEMU](#3-estrutura-de-arquivos-qemu)
4. [Implementação Detalhada](#4-implementação-detalhada)
5. [Integração NeuroForge](#5-integração-neuroforge)
6. [Cronograma de Implementação](#6-cronograma-de-implementação)
7. [Testes e Validação](#7-testes-e-validação)
8. [Diferenças RP2040 vs QEMU Padrão](#8-diferenças-rp2040-vs-qemu-padrão)
9. [Referências Técnicas](#9-referências-técnicas)
10. [Próximos Passos](#10-próximos-passos)

---

## 1. VISÃO GERAL

### 1.1 Objetivo

Implementar suporte completo para o microcontrolador **RP2040** (Raspberry Pi Pico) no QEMU, integrando-o ao ecossistema NeuroForge como placa virtual simulável com suporte a:

- ✅ Dual-core ARM Cortex-M0+ (133MHz)
- ✅ GPIO (30 pinos configuráveis)
- ✅ UART (2 instâncias)
- ✅ Timer (64-bit @ 1MHz)
- ⚠️ USB (básico - detecção)
- ⏸️ DMA (Fase 2)
- ⏸️ PIO (Fase 3 - diferencial RP2040)

### 1.2 Escopo MVP

**Periféricos prioritários:**

| Periférico | Status | Fase |
|------------|--------|------|
| Dual-Core Cortex-M0+ | ✅ Essencial | MVP |
| Memória (ROM, SRAM, Flash) | ✅ Essencial | MVP |
| GPIO (30 pinos) | ✅ Essencial | MVP |
| UART (2x) | ✅ Essencial | MVP |
| Timer (64-bit) | ✅ Essencial | MVP |
| USB (básico) | ⚠️ Simplificado | MVP |
| DMA | ⏸️ Futuro | Fase 2 |
| SPI, I2C | ⏸️ Futuro | Fase 2 |
| PIO | ⏸️ Futuro | Fase 3 |

### 1.3 Arquitetura RP2040

```
┌─────────────────────────────────────────────────────────┐
│                    RP2040 MCU                           │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────┐        ┌───────────────┐            │
│  │  Cortex-M0+   │◄──────►│  Cortex-M0+   │            │
│  │    Core 0     │        │    Core 1     │            │
│  │   133 MHz     │        │   133 MHz     │            │
│  └───────┬───────┘        └───────┬───────┘            │
│          │                        │                     │
│          └────────┬───────────────┘                     │
│                   │                                     │
│          ┌────────▼────────┐                            │
│          │   Bus Fabric    │                            │
│          │ (AHB-Lite/APB)  │                            │
│          └────────┬────────┘                            │
│                   │                                     │
│   ┌───────────────┼───────────────┐                     │
│   │               │               │                     │
│ ┌─▼──┐  ┌────▼────┐  ┌──────▼───┐ ┌──────┐             │
│ │SRAM│  │  Flash  │  │   GPIO   │ │ UART │             │
│ │264K│  │  16MB   │  │ 30 pinos │ │ x2   │             │
│ └────┘  │(externa)│  └──────────┘ └──────┘             │
│         └─────────┘                                     │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌──────┐                   │
│  │ SPI │  │ I2C │  │ USB │  │ DMA  │                   │
│  │ x2  │  │ x2  │  │1.1  │  │12ch  │                   │
│  └─────┘  └─────┘  └─────┘  └──────┘                   │
│                                                          │
│  ┌─────────────────────────────────┐                    │
│  │     PIO (Programmable I/O)      │                    │
│  │    8 State Machines x 2         │                    │
│  └─────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. MAPA DE MEMÓRIA RP2040

### 2.1 Endereços Base dos Periféricos

| Periférico | Endereço Base | Tamanho | Prioridade |
|------------|---------------|---------|------------|
| **ROM**    | `0x00000000` | 16KB | ✅ MVP |
| **Flash XIP** | `0x10000000` | 16MB | ✅ MVP |
| **SRAM**   | `0x20000000` | 264KB | ✅ MVP |
| **SIO**    | `0xD0000000` | 256B | ✅ MVP |
| **USB**    | `0x50100000` | 64KB | ⚠️ MVP |
| **TIMER**  | `0x40054000` | 4KB | ✅ MVP |
| **UART0**  | `0x40034000` | 4KB | ✅ MVP |
| **UART1**  | `0x40038000` | 4KB | ✅ MVP |
| **GPIO**   | `0x40014000` | 12KB | ✅ MVP |
| **DMA**    | `0x50000000` | 4KB | ⏸️ Fase 2 |
| **SPI0**   | `0x4003C000` | 4KB | ⏸️ Fase 2 |
| **SPI1**   | `0x40040000` | 4KB | ⏸️ Fase 2 |
| **I2C0**   | `0x40044000` | 4KB | ⏸️ Fase 2 |
| **I2C1**   | `0x40048000` | 4KB | ⏸️ Fase 2 |
| **PIO0**   | `0x50200000` | 4KB | ⏸️ Fase 3 |
| **PIO1**   | `0x50300000` | 4KB | ⏸️ Fase 3 |

### 2.2 Registradores GPIO Críticos

```c
// Base: 0xD0000000 (SIO - GPIO de acesso rápido)
#define SIO_BASE        0xD0000000
#define SIO_CPUID       (SIO_BASE + 0x000)  // ID do núcleo
#define SIO_GPIO_IN     (SIO_BASE + 0x004)  // Leitura de pinos
#define SIO_GPIO_OUT    (SIO_BASE + 0x010)  // Escrita de pinos
#define SIO_GPIO_OUT_SET (SIO_BASE + 0x014) // Set atômico
#define SIO_GPIO_OUT_CLR (SIO_BASE + 0x018) // Clear atômico
#define SIO_GPIO_OUT_XOR (SIO_BASE + 0x01C) // XOR atômico
#define SIO_GPIO_OE     (SIO_BASE + 0x020)  // Output enable
#define SIO_GPIO_OE_SET (SIO_BASE + 0x024)  // OE set atômico
#define SIO_GPIO_OE_CLR (SIO_BASE + 0x028)  // OE clear atômico

// Base: 0x40014000 (IO_BANK0 - Configuração de pinos)
#define IO_BANK0_BASE   0x40014000
#define GPIO_STATUS(n)  (IO_BANK0_BASE + 0x00 + (n)*8)
#define GPIO_CTRL(n)    (IO_BANK0_BASE + 0x04 + (n)*8)

// Máscaras GPIO_CTRL
#define GPIO_CTRL_FUNCSEL_MASK  0x0000001F  // Seleção de função (0-31)
#define GPIO_CTRL_OUTOVER_MASK  0x00003000  // Output override
#define GPIO_CTRL_INOVER_MASK   0x00030000  // Input override
#define GPIO_CTRL_IRQOVER_MASK  0x30000000  // IRQ override
```

### 2.3 Registradores UART

```c
// Base UART0: 0x40034000, UART1: 0x40038000
// Compatível com PL011 (ARM)
#define UART_DR         0x000  // Data register
#define UART_RSR        0x004  // Receive status/error clear
#define UART_FR         0x018  // Flag register
#define UART_IBRD       0x024  // Integer baud rate divisor
#define UART_FBRD       0x028  // Fractional baud rate divisor
#define UART_LCR_H      0x02C  // Line control
#define UART_CR         0x030  // Control register
#define UART_IMSC       0x038  // Interrupt mask
#define UART_RIS        0x03C  // Raw interrupt status
#define UART_MIS        0x040  // Masked interrupt status
```

### 2.4 Registradores Timer

```c
// Base: 0x40054000
#define TIMER_TIMEHW    0x000  // High word (write to trigger)
#define TIMER_TIMELW    0x004  // Low word
#define TIMER_TIMEHR    0x008  // High word (read)
#define TIMER_TIMELR    0x00C  // Low word (read)
#define TIMER_ALARM0    0x010  // Alarme 0
#define TIMER_ALARM1    0x014  // Alarme 1
#define TIMER_ALARM2    0x018  // Alarme 2
#define TIMER_ALARM3    0x01C  // Alarme 3
#define TIMER_ARMED     0x020  // Alarmes armados (bitmap)
#define TIMER_TIMERAWH  0x024  // Raw high
#define TIMER_TIMERAWL  0x028  // Raw low
#define TIMER_INTE      0x038  // Interrupt enable
#define TIMER_INTF      0x03C  // Interrupt force
#define TIMER_INTS      0x040  // Interrupt status
```

---

## 3. ESTRUTURA DE ARQUIVOS QEMU

### 3.1 Arquivos a Criar no QEMU

```
qemu/
├── hw/
│   ├── arm/
│   │   ├── rp2040_soc.c          # ✅ SoC principal (CPU + Bus + Memória)
│   │   ├── raspberrypi_pico.c    # ✅ Board Raspberry Pi Pico
│   │   ├── meson.build           # Build system
│   │   └── Kconfig               # Configuração
│   │
│   ├── gpio/
│   │   ├── rp2040_gpio.c         # ✅ Implementação GPIO
│   │   ├── meson.build
│   │   └── Kconfig
│   │
│   ├── char/
│   │   ├── rp2040_uart.c         # ✅ UART (base PL011)
│   │   ├── meson.build
│   │   └── Kconfig
│   │
│   ├── timer/
│   │   ├── rp2040_timer.c        # ✅ Timer de 64-bit
│   │   ├── meson.build
│   │   └── Kconfig
│   │
│   └── usb/
│       ├── rp2040_usb.c          # ⚠️ USB básico
│       ├── meson.build
│       └── Kconfig
│
├── include/hw/
│   ├── arm/
│   │   └── rp2040.h              # ✅ Definições do SoC
│   ├── gpio/
│   │   └── rp2040_gpio.h         # Definições GPIO
│   ├── char/
│   │   └── rp2040_uart.h         # Definições UART
│   └── timer/
│       └── rp2040_timer.h        # Definições Timer
│
└── docs/
    └── system/
        └── arm/
            └── rp2040.rst        # ✅ Documentação QEMU
```

### 3.2 Integração NeuroForge

```
neuroforge/
├── boards/
│   └── raspberrypi-pico.json     # ✅ Descritor de board
│
├── firmware/
│   └── rp2040/
│       ├── examples/
│       │   ├── blink/            # LED piscando
│       │   ├── uart_echo/        # Echo serial
│       │   └── gpio_test/        # Testes GPIO
│       ├── sdk/                  # Biblioteca básica
│       └── linker/               # Scripts de link
│
├── qemu/
│   ├── patches/                  # Patches para QEMU upstream
│   ├── build/                    # Scripts de compilação
│   └── src/                      # Fork do QEMU (submodule)
│
└── docs/
    └── boards/
        ├── rp2040-qemu-implementation.md  # Este documento
        └── rp2040-usage.md                # Guia de uso
```

---

## 4. IMPLEMENTAÇÃO DETALHADA

### 4.1 SoC Principal (`rp2040_soc.c`)

**Estrutura de estado:**

```c
/* include/hw/arm/rp2040.h */
#ifndef HW_ARM_RP2040_H
#define HW_ARM_RP2040_H

#include "hw/sysbus.h"
#include "hw/arm/armv7m.h"
#include "hw/gpio/rp2040_gpio.h"
#include "hw/char/rp2040_uart.h"
#include "hw/timer/rp2040_timer.h"
#include "qom/object.h"

#define TYPE_RP2040_SOC "rp2040-soc"
OBJECT_DECLARE_SIMPLE_TYPE(RP2040State, RP2040_SOC)

#define RP2040_NUM_CPUS 2

typedef struct RP2040State {
    SysBusDevice parent_obj;

    /* Núcleos CPU */
    ARMv7MState cpu[RP2040_NUM_CPUS];

    /* Regiões de memória */
    MemoryRegion rom;        /* 16KB Boot ROM */
    MemoryRegion sram;       /* 264KB SRAM */
    MemoryRegion flash;      /* 16MB Flash XIP */
    MemoryRegion sio;        /* Single-cycle I/O */

    /* Periféricos */
    RP2040GPIOState gpio;
    RP2040UARTState uart[2];
    RP2040TimerState timer;

    /* Clock */
    Clock *sysclk;
} RP2040State;

#endif /* HW_ARM_RP2040_H */
```

**Implementação (`hw/arm/rp2040_soc.c`):**

```c
#include "qemu/osdep.h"
#include "qapi/error.h"
#include "hw/arm/rp2040.h"
#include "hw/qdev-properties.h"
#include "hw/qdev-clock.h"
#include "hw/misc/unimp.h"

/* Endereços de memória */
#define RP2040_ROM_BASE     0x00000000
#define RP2040_ROM_SIZE     (16 * 1024)
#define RP2040_FLASH_BASE   0x10000000
#define RP2040_FLASH_SIZE   (16 * 1024 * 1024)
#define RP2040_SRAM_BASE    0x20000000
#define RP2040_SRAM_SIZE    (264 * 1024)
#define RP2040_SIO_BASE     0xD0000000
#define RP2040_GPIO_BASE    0x40014000
#define RP2040_UART0_BASE   0x40034000
#define RP2040_UART1_BASE   0x40038000
#define RP2040_TIMER_BASE   0x40054000

/* IRQs */
#define RP2040_UART0_IRQ    20
#define RP2040_UART1_IRQ    21
#define RP2040_TIMER_IRQ_0  0
#define RP2040_TIMER_IRQ_1  1
#define RP2040_TIMER_IRQ_2  2
#define RP2040_TIMER_IRQ_3  3
#define RP2040_GPIO_IRQ_0   13
#define RP2040_GPIO_IRQ_1   14
#define RP2040_GPIO_IRQ_2   15
#define RP2040_GPIO_IRQ_3   16

static void rp2040_soc_init(Object *obj)
{
    RP2040State *s = RP2040_SOC(obj);

    /* Criar 2 núcleos Cortex-M0+ */
    for (int i = 0; i < RP2040_NUM_CPUS; i++) {
        object_initialize_child(obj, g_strdup_printf("cpu%d", i),
                                &s->cpu[i], TYPE_ARMV7M);
    }

    /* Periféricos */
    object_initialize_child(obj, "gpio", &s->gpio, TYPE_RP2040_GPIO);
    object_initialize_child(obj, "uart0", &s->uart[0], TYPE_RP2040_UART);
    object_initialize_child(obj, "uart1", &s->uart[1], TYPE_RP2040_UART);
    object_initialize_child(obj, "timer", &s->timer, TYPE_RP2040_TIMER);

    /* Clock */
    s->sysclk = qdev_init_clock_in(DEVICE(s), "sysclk", NULL, NULL, 0);
}

static void rp2040_soc_realize(DeviceState *dev, Error **errp)
{
    RP2040State *s = RP2040_SOC(dev);
    MemoryRegion *system_memory = get_system_memory();

    /* 1. Criar memórias */
    memory_region_init_rom(&s->rom, OBJECT(dev), "rp2040.rom",
                           RP2040_ROM_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_ROM_BASE, &s->rom);

    memory_region_init_ram(&s->sram, OBJECT(dev), "rp2040.sram",
                           RP2040_SRAM_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_SRAM_BASE, &s->sram);

    memory_region_init_ram(&s->flash, OBJECT(dev), "rp2040.flash",
                           RP2040_FLASH_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_FLASH_BASE, &s->flash);

    /* 2. Inicializar CPUs */
    for (int i = 0; i < RP2040_NUM_CPUS; i++) {
        DeviceState *cpudev = DEVICE(&s->cpu[i]);
        
        qdev_prop_set_string(cpudev, "cpu-type", ARM_CPU_TYPE_NAME("cortex-m0plus"));
        qdev_prop_set_uint32(cpudev, "num-irq", 32);
        qdev_connect_clock_in(cpudev, "cpuclk", s->sysclk);
        
        if (!sysbus_realize(SYS_BUS_DEVICE(cpudev), errp)) {
            return;
        }
    }

    /* 3. Criar periféricos */
    /* GPIO */
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->gpio), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->gpio), 0, RP2040_GPIO_BASE);
    sysbus_connect_irq(SYS_BUS_DEVICE(&s->gpio), 0,
                       qdev_get_gpio_in(DEVICE(&s->cpu[0]), RP2040_GPIO_IRQ_0));

    /* UART0 e UART1 */
    for (int i = 0; i < 2; i++) {
        if (!sysbus_realize(SYS_BUS_DEVICE(&s->uart[i]), errp)) {
            return;
        }
        sysbus_mmio_map(SYS_BUS_DEVICE(&s->uart[i]), 0,
                        i == 0 ? RP2040_UART0_BASE : RP2040_UART1_BASE);
        sysbus_connect_irq(SYS_BUS_DEVICE(&s->uart[i]), 0,
                           qdev_get_gpio_in(DEVICE(&s->cpu[0]),
                                            i == 0 ? RP2040_UART0_IRQ : RP2040_UART1_IRQ));
    }

    /* Timer */
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->timer), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->timer), 0, RP2040_TIMER_BASE);
    for (int i = 0; i < 4; i++) {
        sysbus_connect_irq(SYS_BUS_DEVICE(&s->timer), i,
                           qdev_get_gpio_in(DEVICE(&s->cpu[0]),
                                            RP2040_TIMER_IRQ_0 + i));
    }

    /* Criar SIO (stub por enquanto) */
    create_unimplemented_device("rp2040.sio", RP2040_SIO_BASE, 0x100);
}

static void rp2040_soc_class_init(ObjectClass *klass, void *data)
{
    DeviceClass *dc = DEVICE_CLASS(klass);
    dc->realize = rp2040_soc_realize;
}

static const TypeInfo rp2040_soc_info = {
    .name          = TYPE_RP2040_SOC,
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(RP2040State),
    .instance_init = rp2040_soc_init,
    .class_init    = rp2040_soc_class_init,
};

static void rp2040_soc_register_types(void)
{
    type_register_static(&rp2040_soc_info);
}

type_init(rp2040_soc_register_types)
```

### 4.2 Board Raspberry Pi Pico (`raspberrypi_pico.c`)

```c
#include "qemu/osdep.h"
#include "qapi/error.h"
#include "hw/boards.h"
#include "hw/arm/rp2040.h"
#include "hw/arm/boot.h"
#include "hw/loader.h"

#define PICO_FLASH_SIZE (2 * 1024 * 1024)  /* 2MB Flash na placa */

static void raspberrypi_pico_init(MachineState *machine)
{
    RP2040State *soc;
    DeviceState *soc_dev;
    Clock *sysclk;

    /* Clock do sistema (133 MHz) */
    sysclk = clock_new(OBJECT(machine), "sysclk");
    clock_set_hz(sysclk, 133000000);

    /* Criar SoC */
    soc_dev = qdev_new(TYPE_RP2040_SOC);
    soc = RP2040_SOC(soc_dev);
    qdev_connect_clock_in(soc_dev, "sysclk", sysclk);
    sysbus_realize_and_unref(SYS_BUS_DEVICE(soc_dev), &error_fatal);

    /* Carregar firmware */
    if (machine->kernel_filename) {
        if (!load_elf(machine->kernel_filename, NULL, NULL, NULL,
                      NULL, NULL, NULL, NULL, 0, EM_ARM, 1, 0)) {
            if (!load_image_targphys(machine->kernel_filename,
                                     0x10000000, PICO_FLASH_SIZE)) {
                error_report("Could not load kernel '%s'",
                             machine->kernel_filename);
                exit(1);
            }
        }
    }
}

static void raspberrypi_pico_machine_class_init(ObjectClass *oc, void *data)
{
    MachineClass *mc = MACHINE_CLASS(oc);
    mc->desc = "Raspberry Pi Pico (RP2040)";
    mc->init = raspberrypi_pico_init;
    mc->default_cpus = 2;
    mc->min_cpus = 1;
    mc->max_cpus = 2;
    mc->default_ram_size = 264 * 1024;  /* 264KB SRAM */
}

static const TypeInfo raspberrypi_pico_machine_type = {
    .name       = MACHINE_TYPE_NAME("raspberrypi-pico"),
    .parent     = TYPE_MACHINE,
    .class_init = raspberrypi_pico_machine_class_init,
};

static void raspberrypi_pico_machine_register_types(void)
{
    type_register_static(&raspberrypi_pico_machine_type);
}

type_init(raspberrypi_pico_machine_register_types)
```

### 4.3 GPIO (`rp2040_gpio.c`)

**Header (`include/hw/gpio/rp2040_gpio.h`):**

```c
#ifndef HW_GPIO_RP2040_GPIO_H
#define HW_GPIO_RP2040_GPIO_H

#include "hw/sysbus.h"
#include "qom/object.h"

#define TYPE_RP2040_GPIO "rp2040-gpio"
OBJECT_DECLARE_SIMPLE_TYPE(RP2040GPIOState, RP2040_GPIO)

#define RP2040_NUM_GPIOS 30

typedef struct RP2040GPIOState {
    SysBusDevice parent_obj;

    MemoryRegion iomem;

    /* Registradores SIO (acesso rápido) */
    uint32_t gpio_in;      /* Valor atual dos pinos */
    uint32_t gpio_out;     /* Valor de saída */
    uint32_t gpio_oe;      /* Output enable */

    /* Registradores IO_BANK0 (configuração) */
    struct {
        uint32_t status;   /* Status do pino */
        uint32_t ctrl;     /* Controle (função, pulls) */
    } gpio[RP2040_NUM_GPIOS];

    /* Interrupções */
    qemu_irq irq[4];  /* 4 canais de IRQ */

    /* Pinos externos */
    qemu_irq pins_out[RP2040_NUM_GPIOS];
} RP2040GPIOState;

#endif
```

**Implementação (`hw/gpio/rp2040_gpio.c`):**

```c
#include "qemu/osdep.h"
#include "hw/gpio/rp2040_gpio.h"
#include "hw/irq.h"
#include "hw/qdev-properties.h"
#include "migration/vmstate.h"
#include "qemu/log.h"

/* Offsets SIO */
#define SIO_GPIO_IN         0x004
#define SIO_GPIO_OUT        0x010
#define SIO_GPIO_OUT_SET    0x014
#define SIO_GPIO_OUT_CLR    0x018
#define SIO_GPIO_OUT_XOR    0x01C
#define SIO_GPIO_OE         0x020
#define SIO_GPIO_OE_SET     0x024
#define SIO_GPIO_OE_CLR     0x028
#define SIO_GPIO_OE_XOR     0x02C

/* Offsets IO_BANK0 */
#define IO_BANK0_GPIO_STATUS(n)  (0x000 + (n)*8)
#define IO_BANK0_GPIO_CTRL(n)    (0x004 + (n)*8)

static void rp2040_gpio_update_outputs(RP2040GPIOState *s)
{
    for (int i = 0; i < RP2040_NUM_GPIOS; i++) {
        if (s->gpio_oe & (1 << i)) {
            /* Pino em modo saída */
            int value = (s->gpio_out >> i) & 1;
            qemu_set_irq(s->pins_out[i], value);
        }
    }
}

static uint64_t rp2040_gpio_read(void *opaque, hwaddr offset, unsigned size)
{
    RP2040GPIOState *s = RP2040_GPIO(opaque);

    switch (offset) {
    case SIO_GPIO_IN:
        return s->gpio_in;
    case SIO_GPIO_OUT:
        return s->gpio_out;
    case SIO_GPIO_OE:
        return s->gpio_oe;
    default:
        if (offset >= 0x1000 && offset < 0x1000 + RP2040_NUM_GPIOS * 8) {
            /* IO_BANK0 area */
            int gpio_num = (offset - 0x1000) / 8;
            int reg = (offset - 0x1000) % 8;
            if (reg == 0) {
                return s->gpio[gpio_num].status;
            } else if (reg == 4) {
                return s->gpio[gpio_num].ctrl;
            }
        }
        qemu_log_mask(LOG_GUEST_ERROR,
                      "RP2040 GPIO: invalid read offset 0x%" HWADDR_PRIx "\n",
                      offset);
        return 0;
    }
}

static void rp2040_gpio_write(void *opaque, hwaddr offset,
                              uint64_t value, unsigned size)
{
    RP2040GPIOState *s = RP2040_GPIO(opaque);

    switch (offset) {
    case SIO_GPIO_OUT:
        s->gpio_out = value & ((1 << RP2040_NUM_GPIOS) - 1);
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OUT_SET:
        s->gpio_out |= value & ((1 << RP2040_NUM_GPIOS) - 1);
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OUT_CLR:
        s->gpio_out &= ~(value & ((1 << RP2040_NUM_GPIOS) - 1));
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OUT_XOR:
        s->gpio_out ^= value & ((1 << RP2040_NUM_GPIOS) - 1);
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OE:
        s->gpio_oe = value & ((1 << RP2040_NUM_GPIOS) - 1);
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OE_SET:
        s->gpio_oe |= value & ((1 << RP2040_NUM_GPIOS) - 1);
        rp2040_gpio_update_outputs(s);
        break;
    case SIO_GPIO_OE_CLR:
        s->gpio_oe &= ~(value & ((1 << RP2040_NUM_GPIOS) - 1));
        rp2040_gpio_update_outputs(s);
        break;
    default:
        if (offset >= 0x1000 && offset < 0x1000 + RP2040_NUM_GPIOS * 8) {
            /* IO_BANK0 area */
            int gpio_num = (offset - 0x1000) / 8;
            int reg = (offset - 0x1000) % 8;
            if (reg == 0) {
                s->gpio[gpio_num].status = value;
            } else if (reg == 4) {
                s->gpio[gpio_num].ctrl = value;
            }
            break;
        }
        qemu_log_mask(LOG_GUEST_ERROR,
                      "RP2040 GPIO: invalid write offset 0x%" HWADDR_PRIx
                      " value 0x%" PRIx64 "\n", offset, value);
    }
}

static const MemoryRegionOps rp2040_gpio_ops = {
    .read = rp2040_gpio_read,
    .write = rp2040_gpio_write,
    .endianness = DEVICE_LITTLE_ENDIAN,
    .impl = {
        .min_access_size = 4,
        .max_access_size = 4,
    },
};

static void rp2040_gpio_init(Object *obj)
{
    RP2040GPIOState *s = RP2040_GPIO(obj);
    SysBusDevice *sbd = SYS_BUS_DEVICE(obj);

    memory_region_init_io(&s->iomem, obj, &rp2040_gpio_ops, s,
                          "rp2040-gpio", 0x2000);
    sysbus_init_mmio(sbd, &s->iomem);

    /* IRQs */
    for (int i = 0; i < 4; i++) {
        sysbus_init_irq(sbd, &s->irq[i]);
    }

    /* Pinos de saída */
    qdev_init_gpio_out(DEVICE(obj), s->pins_out, RP2040_NUM_GPIOS);
}

static const VMStateDescription vmstate_rp2040_gpio = {
    .name = "rp2040-gpio",
    .version_id = 1,
    .minimum_version_id = 1,
    .fields = (VMStateField[]) {
        VMSTATE_UINT32(gpio_in, RP2040GPIOState),
        VMSTATE_UINT32(gpio_out, RP2040GPIOState),
        VMSTATE_UINT32(gpio_oe, RP2040GPIOState),
        VMSTATE_END_OF_LIST()
    }
};

static void rp2040_gpio_class_init(ObjectClass *klass, void *data)
{
    DeviceClass *dc = DEVICE_CLASS(klass);
    dc->vmsd = &vmstate_rp2040_gpio;
}

static const TypeInfo rp2040_gpio_info = {
    .name          = TYPE_RP2040_GPIO,
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(RP2040GPIOState),
    .instance_init = rp2040_gpio_init,
    .class_init    = rp2040_gpio_class_init,
};

static void rp2040_gpio_register_types(void)
{
    type_register_static(&rp2040_gpio_info);
}

type_init(rp2040_gpio_register_types)
```

### 4.4 UART (Skeleton - baseado em PL011)

**Nota:** UART será baseado no PL011 existente com adaptações mínimas.

```c
/* include/hw/char/rp2040_uart.h */
#ifndef HW_CHAR_RP2040_UART_H
#define HW_CHAR_RP2040_UART_H

#include "hw/sysbus.h"
#include "chardev/char-fe.h"
#include "qom/object.h"

#define TYPE_RP2040_UART "rp2040-uart"
OBJECT_DECLARE_SIMPLE_TYPE(RP2040UARTState, RP2040_UART)

typedef struct RP2040UARTState {
    SysBusDevice parent_obj;

    MemoryRegion iomem;
    CharBackend chr;
    qemu_irq irq;

    /* Registradores PL011-compatíveis */
    uint32_t dr;
    uint32_t rsr;
    uint32_t fr;
    uint32_t ibrd;
    uint32_t fbrd;
    uint32_t lcr_h;
    uint32_t cr;
    uint32_t imsc;
    uint32_t ris;
    uint32_t mis;
} RP2040UARTState;

#endif
```

### 4.5 Timer (Skeleton)

```c
/* include/hw/timer/rp2040_timer.h */
#ifndef HW_TIMER_RP2040_TIMER_H
#define HW_TIMER_RP2040_TIMER_H

#include "hw/sysbus.h"
#include "qom/object.h"

#define TYPE_RP2040_TIMER "rp2040-timer"
OBJECT_DECLARE_SIMPLE_TYPE(RP2040TimerState, RP2040_TIMER)

typedef struct RP2040TimerState {
    SysBusDevice parent_obj;

    MemoryRegion iomem;
    QEMUTimer *timer;

    /* Timer de 64-bit @ 1MHz */
    uint64_t timeraw;

    /* 4 alarmes */
    struct {
        uint32_t alarm_value;
        bool armed;
        qemu_irq irq;
    } alarms[4];

    uint32_t armed;  /* Bitmap de alarmes armados */
    uint32_t inte;   /* Interrupt enable */
    uint32_t intf;   /* Interrupt force */
    uint32_t ints;   /* Interrupt status */
} RP2040TimerState;

#endif
```

---

## 5. INTEGRAÇÃO NEUROFORGE

### 5.1 Descritor de Board (`boards/raspberrypi-pico.json`)

```json
{
  "board": {
    "id": "raspberrypi-pico",
    "name": "Raspberry Pi Pico",
    "manufacturer": "Raspberry Pi Foundation",
    "url": "https://www.raspberrypi.com/products/raspberry-pi-pico/",
    "documentation": "https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf",
    "mcu": {
      "model": "RP2040",
      "architecture": "ARM Cortex-M0+",
      "cores": 2,
      "clock_speed_mhz": 133,
      "flash_size_kb": 2048,
      "sram_size_kb": 264,
      "datasheet": "https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf"
    }
  },
  "qemu": {
    "machine": "raspberrypi-pico",
    "cpu": "cortex-m0plus",
    "memory": {
      "rom": {
        "address": "0x00000000",
        "size": "16K"
      },
      "flash": {
        "address": "0x10000000",
        "size": "2M"
      },
      "sram": {
        "address": "0x20000000",
        "size": "264K"
      }
    },
    "peripherals": {
      "uart": [
        {
          "id": 0,
          "address": "0x40034000",
          "irq": 20
        },
        {
          "id": 1,
          "address": "0x40038000",
          "irq": 21
        }
      ],
      "gpio": {
        "count": 30,
        "sio_address": "0xD0000000",
        "io_bank0_address": "0x40014000",
        "irqs": [13, 14, 15, 16]
      },
      "timer": {
        "address": "0x40054000",
        "alarms": 4,
        "irqs": [0, 1, 2, 3]
      }
    }
  },
  "serial_gpio_protocol": {
    "enabled": true,
    "uart_id": 0,
    "baud_rate": 115200,
    "protocol_version": "1.0"
  },
  "pinout": {
    "led": 25,
    "uart0_tx": 0,
    "uart0_rx": 1,
    "uart1_tx": 4,
    "uart1_rx": 5
  }
}
```

### 5.2 Comando de Execução NeuroForge

```bash
# Executar firmware no Pico virtual
neuroforge run \
  --board raspberrypi-pico \
  --firmware firmware/rp2040/examples/blink/blink.elf \
  --serial-gpio /dev/ttyUSB0 \
  --monitor \
  --debug
```

**Equivalente QEMU direto:**
```bash
qemu-system-arm \
  -M raspberrypi-pico \
  -kernel blink.elf \
  -serial stdio \
  -serial /dev/ttyUSB0 \
  -nographic \
  -d guest_errors
```

---

## 6. CRONOGRAMA DE IMPLEMENTAÇÃO

### **Semana 1-2: Infraestrutura Base**

| Dia | Tarefa | Arquivos | Status |
|-----|--------|----------|--------|
| 1-2 | Estrutura SoC (`rp2040_soc.c`) | `hw/arm/rp2040_soc.c`, `include/hw/arm/rp2040.h` | 🟡 Pendente |
| 2-3 | Memórias (ROM, SRAM, Flash) | Dentro de `rp2040_soc.c` | 🟡 Pendente |
| 3-4 | Dual-core Cortex-M0+ | `rp2040_soc.c` (init CPUs) | 🟡 Pendente |
| 4-5 | Board Pico (`raspberrypi_pico.c`) | `hw/arm/raspberrypi_pico.c` | 🟡 Pendente |
| 5 | Build system (meson/Kconfig) | `hw/arm/meson.build`, `hw/arm/Kconfig` | 🟡 Pendente |
| 5 | Teste: compilação QEMU | - | 🟡 Pendente |

**Critério de sucesso:**
```bash
qemu-system-arm -M raspberrypi-pico -kernel test.elf
# Deve iniciar sem crash (mesmo que não execute nada)
```

### **Semana 2-3: GPIO**

| Dia | Tarefa | Arquivos | Status |
|-----|--------|----------|--------|
| 6-7 | GPIO skeleton (`rp2040_gpio.c`) | `hw/gpio/rp2040_gpio.c`, `include/hw/gpio/rp2040_gpio.h` | 🟡 Pendente |
| 7-8 | Registradores SIO (read/write) | `rp2040_gpio.c` | 🟡 Pendente |
| 8-9 | IO_BANK0 (configuração pinos) | `rp2040_gpio.c` | 🟡 Pendente |
| 9-10 | IRQs de GPIO | `rp2040_gpio.c` | 🟡 Pendente |
| 10 | Integrar ao SoC | `rp2040_soc.c` | 🟡 Pendente |
| 10-11 | Teste: LED blink firmware | `firmware/rp2040/examples/blink/` | 🟡 Pendente |

**Critério de sucesso:**
```c
// Firmware seta GPIO25 (LED onboard)
gpio_init(25);
gpio_set_dir(25, GPIO_OUT);
gpio_put(25, 1);
// Verificar no monitor GPIO
```

### **Semana 3-4: UART + Timer**

| Dia | Tarefa | Arquivos | Status |
|-----|--------|----------|--------|
| 11-12 | UART skeleton (`rp2040_uart.c`) | `hw/char/rp2040_uart.c`, `include/hw/char/rp2040_uart.h` | 🟡 Pendente |
| 12-13 | Registradores PL011 | `rp2040_uart.c` | 🟡 Pendente |
| 13 | FIFOs TX/RX | `rp2040_uart.c` | 🟡 Pendente |
| 13 | Integrar UART0/UART1 ao SoC | `rp2040_soc.c` | 🟡 Pendente |
| 14 | Teste: UART echo | `firmware/rp2040/examples/uart_echo/` | 🟡 Pendente |
| 15-16 | Timer skeleton (`rp2040_timer.c`) | `hw/timer/rp2040_timer.c`, `include/hw/timer/rp2040_timer.h` | 🟡 Pendente |
| 16-17 | Timer de 64-bit @ 1MHz | `rp2040_timer.c` | 🟡 Pendente |
| 17-18 | 4 alarmes comparadores | `rp2040_timer.c` | 🟡 Pendente |
| 18 | Integrar ao SoC | `rp2040_soc.c` | 🟡 Pendente |
| 18-19 | Teste: delays precisos | `firmware/rp2040/examples/timer_test/` | 🟡 Pendente |

**Critério de sucesso UART:**
```bash
echo "HELLO" > /dev/ttyUSB1
# Deve ecoar "HELLO" de volta
```

**Critério de sucesso Timer:**
```c
// Firmware cria delay de 1 segundo
sleep_ms(1000);
// Verificar timing real ≈ 1000ms (±5%)
```

### **Semana 4-5: USB Básico + Integração NeuroForge**

| Dia | Tarefa | Arquivos | Status |
|-----|--------|----------|--------|
| 19-21 | USB stub (detecção básica) | `hw/usb/rp2040_usb.c` | 🟡 Pendente |
| 21 | Board descriptor JSON | `boards/raspberrypi-pico.json` | 🟡 Pendente |
| 22 | Adaptar CLI NeuroForge | `src/cli/boards.ts` | 🟡 Pendente |
| 22-23 | Documentação usuário | `docs/boards/rp2040-usage.md` | 🟡 Pendente |
| 23-24 | Firmware de exemplo (blink, echo, gpio) | `firmware/rp2040/examples/` | 🟡 Pendente |
| 24-25 | Testes de integração | `tests/qemu/test_rp2040.py` | 🟡 Pendente |

**Critério de sucesso integração:**
```bash
neuroforge list-boards
# Deve mostrar "raspberrypi-pico"

neuroforge run --board raspberrypi-pico --firmware blink.elf
# Deve executar sem erros
```

---

## 7. TESTES E VALIDAÇÃO

### 7.1 Suite de Testes Python

```python
# tests/qemu/test_rp2040.py
import pytest
import time
from neuroforge.qemu import QEMUInstance
from neuroforge.serial import SerialGPIOMonitor

class TestRP2040:
    def test_boot_rom(self):
        """Verifica que ROM inicia corretamente"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/boot_test.elf"
        )
        assert qemu.start()
        assert qemu.wait_for_boot(timeout=5.0)
        qemu.stop()

    def test_dual_core(self):
        """Verifica que 2 núcleos são criados"""
        qemu = QEMUInstance(board="raspberrypi-pico")
        info = qemu.get_machine_info()
        assert info["cpus"] == 2

    def test_gpio_write_read(self):
        """Testa escrita e leitura de GPIO"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/gpio_test.elf"
        )
        gpio_monitor = SerialGPIOMonitor("/dev/ttyUSB0")

        qemu.start()
        time.sleep(1)

        # Firmware deve setar GPIO25
        assert gpio_monitor.read_pin(25) == 1

        # Firmware deve clear GPIO25
        time.sleep(1)
        assert gpio_monitor.read_pin(25) == 0

        qemu.stop()

    def test_gpio_atomic_operations(self):
        """Testa operações atômicas (SET/CLR/XOR)"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/gpio_atomic.elf"
        )
        gpio_monitor = SerialGPIOMonitor("/dev/ttyUSB0")

        qemu.start()

        # Testa GPIO_OUT_SET
        time.sleep(0.5)
        assert gpio_monitor.read_pins() & (1 << 10) != 0  # GPIO10 set

        # Testa GPIO_OUT_CLR
        time.sleep(0.5)
        assert gpio_monitor.read_pins() & (1 << 10) == 0  # GPIO10 clear

        # Testa GPIO_OUT_XOR
        time.sleep(0.5)
        assert gpio_monitor.read_pins() & (1 << 10) != 0  # GPIO10 toggle

        qemu.stop()

    def test_uart_echo(self):
        """Testa comunicação UART"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/uart_echo.elf",
            serial_port="/dev/ttyUSB1"
        )

        qemu.start()
        time.sleep(1)

        # Conectar à serial
        import serial
        ser = serial.Serial("/dev/ttyUSB1", 115200, timeout=1)

        # Enviar dados
        test_str = b"HELLO WORLD\n"
        ser.write(test_str)

        # Receber echo
        received = ser.read(len(test_str))
        assert received == test_str

        ser.close()
        qemu.stop()

    def test_timer_accuracy(self):
        """Testa precisão do timer de 1MHz"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/timer_test.elf"
        )
        gpio_monitor = SerialGPIOMonitor("/dev/ttyUSB0")

        qemu.start()

        # Firmware: toggle GPIO a cada 1 segundo exato
        start_time = time.time()
        initial_state = gpio_monitor.read_pin(20)

        # Aguardar 10 toggles (10 segundos)
        toggles = 0
        last_state = initial_state
        while toggles < 10:
            current_state = gpio_monitor.read_pin(20)
            if current_state != last_state:
                toggles += 1
                last_state = current_state
            time.sleep(0.01)

        elapsed = time.time() - start_time

        # Deve ser ~10 segundos (±5% = 9.5-10.5s)
        assert 9.5 <= elapsed <= 10.5

        qemu.stop()

    def test_timer_alarms(self):
        """Testa 4 alarmes do timer"""
        qemu = QEMUInstance(
            board="raspberrypi-pico",
            firmware="firmware/rp2040/tests/timer_alarms.elf"
        )
        gpio_monitor = SerialGPIOMonitor("/dev/ttyUSB0")

        qemu.start()
        time.sleep(1)

        # Firmware configura 4 alarmes em GPIOs diferentes
        # Alarme 0 -> GPIO20 após 1s
        # Alarme 1 -> GPIO21 após 2s
        # Alarme 2 -> GPIO22 após 3s
        # Alarme 3 -> GPIO23 após 4s

        time.sleep(1.5)
        assert gpio_monitor.read_pin(20) == 1
        assert gpio_monitor.read_pin(21) == 0

        time.sleep(1)
        assert gpio_monitor.read_pin(21) == 1
        assert gpio_monitor.read_pin(22) == 0

        time.sleep(1)
        assert gpio_monitor.read_pin(22) == 1
        assert gpio_monitor.read_pin(23) == 0

        time.sleep(1)
        assert gpio_monitor.read_pin(23) == 1

        qemu.stop()
```

### 7.2 Firmware de Teste: LED Blink

```c
// firmware/rp2040/examples/blink/main.c
#include <stdint.h>

// Endereços de memória GPIO
#define SIO_BASE        0xD0000000
#define SIO_GPIO_OUT    (*(volatile uint32_t*)(SIO_BASE + 0x010))
#define SIO_GPIO_OE     (*(volatile uint32_t*)(SIO_BASE + 0x020))

#define LED_PIN 25

void delay_ms(uint32_t ms) {
    // Delay simples (assume clock de 133MHz)
    for (volatile uint32_t i = 0; i < ms * 133000 / 10; i++);
}

int main(void) {
    // Configurar GPIO25 como saída
    SIO_GPIO_OE |= (1 << LED_PIN);

    while (1) {
        // Ligar LED
        SIO_GPIO_OUT |= (1 << LED_PIN);
        delay_ms(500);

        // Desligar LED
        SIO_GPIO_OUT &= ~(1 << LED_PIN);
        delay_ms(500);
    }

    return 0;
}
```

**Linker script (`link.ld`):**
```ld
MEMORY
{
    FLASH (rx)  : ORIGIN = 0x10000000, LENGTH = 2M
    SRAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 264K
}

SECTIONS
{
    .text : {
        KEEP(*(.vector_table))
        *(.text*)
        *(.rodata*)
    } > FLASH

    .data : {
        *(.data*)
    } > SRAM AT > FLASH

    .bss : {
        *(.bss*)
        *(COMMON)
    } > SRAM
}
```

**Makefile:**
```makefile
CC = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy

CFLAGS = -mcpu=cortex-m0plus -mthumb -O2 -g
LDFLAGS = -T link.ld -nostdlib -nostartfiles

all: blink.elf blink.bin

blink.elf: main.c startup.s
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^

blink.bin: blink.elf
	$(OBJCOPY) -O binary $< $@

clean:
	rm -f *.elf *.bin *.o
```

### 7.3 Firmware de Teste: UART Echo

```c
// firmware/rp2040/examples/uart_echo/main.c
#include <stdint.h>

// Endereços UART0
#define UART0_BASE      0x40034000
#define UART0_DR        (*(volatile uint32_t*)(UART0_BASE + 0x000))
#define UART0_FR        (*(volatile uint32_t*)(UART0_BASE + 0x018))
#define UART0_IBRD      (*(volatile uint32_t*)(UART0_BASE + 0x024))
#define UART0_FBRD      (*(volatile uint32_t*)(UART0_BASE + 0x028))
#define UART0_LCR_H     (*(volatile uint32_t*)(UART0_BASE + 0x02C))
#define UART0_CR        (*(volatile uint32_t*)(UART0_BASE + 0x030))

// Flag register bits
#define UART_FR_RXFE    (1 << 4)  // RX FIFO empty
#define UART_FR_TXFF    (1 << 5)  // TX FIFO full

void uart_init(uint32_t baud_rate) {
    // Configurar baud rate (assume 133MHz clock)
    // Divisor = (133000000 / (16 * baud_rate))
    uint32_t divisor = 133000000 / (16 * baud_rate);
    UART0_IBRD = divisor;
    UART0_FBRD = 0;

    // 8 bits, sem paridade, 1 stop bit
    UART0_LCR_H = (3 << 5);  // 8-bit word length

    // Habilitar UART, TX e RX
    UART0_CR = (1 << 0) | (1 << 8) | (1 << 9);
}

void uart_putc(char c) {
    while (UART0_FR & UART_FR_TXFF);  // Aguardar TX FIFO ter espaço
    UART0_DR = c;
}

char uart_getc(void) {
    while (UART0_FR & UART_FR_RXFE);  // Aguardar RX FIFO ter dados
    return UART0_DR & 0xFF;
}

int main(void) {
    uart_init(115200);

    while (1) {
        char c = uart_getc();
        uart_putc(c);  // Echo
    }

    return 0;
}
```

---

## 8. DIFERENÇAS RP2040 VS QEMU PADRÃO

### 8.1 Desafios Únicos do RP2040

| Característica | RP2040 Real | Solução QEMU MVP |
|----------------|-------------|------------------|
| **Dual-core SMP** | 2x Cortex-M0+ independentes com spinlocks | Usar ARMv7M existente (suporte nativo QEMU) |
| **PIO** | 8 state machines programáveis por bloco (2 blocos) | ⏸️ Fase 3: emular como periférico customizado |
| **Operações atômicas** | Registradores SET/CLR/XOR (+0x1000, +0x2000, +0x3000) | Implementar via offsets mágicos no `rp2040_gpio_write()` |
| **Flash XIP** | Execução direta da flash externa via cache | Memory-mapped ROM simples (suficiente para MVP) |
| **SIO** | GPIO ultra-rápido (single-cycle) | Acesso direto via registradores @ 0xD0000000 |
| **USB Device** | USB 1.1 Full-speed (12 Mbps) | ⚠️ Stub básico (detecção apenas) |
| **DMA** | 12 canais independentes | ⏸️ Fase 2 |
| **Interpolator** | Hardware para operações matemáticas | ⏸️ Futuro (não essencial) |
| **Clock Trees** | 6 clocks independentes configuráveis | Simplificar: sysclk único @ 133MHz |

### 8.2 Limitações Aceitáveis para MVP

❌ **NÃO implementado inicialmente:**
- DMA (12 canais)
- PIO (state machines)
- SPI (2 instâncias)
- I2C (2 instâncias)
- Watchdog Timer
- RTC
- ADC (4 canais)
- PWM (8 slices)
- Interpolator
- Clock configurável
- Voltage regulator control
- Crystal oscillator emulation

✅ **Suficiente para:**
- 80% dos tutoriais básicos RP2040
- GPIO digital (leitura/escrita)
- Comunicação serial (UART)
- Delays e timers
- Dual-core básico
- Debug via GDB
- Integração NeuroForge

---

## 9. REFERÊNCIAS TÉCNICAS

### 9.1 Documentação RP2040

1. **[RP2040 Datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf)**  
   Documento oficial completo (646 páginas) com todos os periféricos.

2. **[Raspberry Pi Pico Datasheet](https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf)**  
   Especificações da placa Pico (pinout, esquemático).

3. **[Pico SDK](https://github.com/raspberrypi/pico-sdk)**  
   SDK oficial C/C++ da Raspberry Pi Foundation.

4. **[Getting Started with Raspberry Pi Pico](https://datasheets.raspberrypi.com/pico/getting-started-with-pico.pdf)**  
   Tutorial oficial para iniciantes.

### 9.2 QEMU Internals

5. **[QEMU Documentation](https://www.qemu.org/docs/master/)**  
   Documentação oficial do QEMU.

6. **[QEMU Object Model (QOM)](https://www.qemu.org/docs/master/devel/qom.html)**  
   Sistema de objetos do QEMU.

7. **[ARM System Emulation](https://www.qemu.org/docs/master/system/arm/overview.html)**  
   Visão geral da emulação ARM no QEMU.

8. **[QEMU Device Emulation Guide](https://www.qemu.org/docs/master/devel/index-build.html)**  
   Guia para desenvolver novos dispositivos.

### 9.3 Implementações de Referência

9. **[STM32 QEMU Implementation](https://github.com/qemu/qemu/tree/master/hw/arm)**  
   Exemplo de microcontrolador ARM Cortex-M no QEMU.

10. **[SAMD21 QEMU (Quarkslab)](https://github.com/quarkslab/sstic-tame-the-qemu)**  
    Implementação customizada de Cortex-M0+.

11. **[Writing a Custom Device for QEMU](https://sebastienbourdelin.com/2021/06/16/writing-a-custom-device-for-qemu/)**  
    Tutorial passo-a-passo.

### 9.4 Tutoriais ARM Cortex-M

12. **[ARM Cortex-M0+ Technical Reference Manual](https://developer.arm.com/documentation/ddi0484/latest/)**  
    Documentação oficial do núcleo.

13. **[ARMv6-M Architecture Reference Manual](https://developer.arm.com/documentation/ddi0419/latest/)**  
    Especificação da arquitetura.

---

## 10. PRÓXIMOS PASSOS IMEDIATOS

### ✅ **Aprovado - Iniciando implementação**

**Ordem de execução:**

1. ✅ **Branch criada:** `feature/rp2040-qemu-mvp`
2. ✅ **Documentação completa:** Este arquivo
3. 🟡 **Commit 1:** Skeleton `rp2040_soc.c` + headers
4. 🟡 **Commit 2:** Memórias (ROM, SRAM, Flash)
5. 🟡 **Commit 3:** Dual-core init
6. 🟡 **Commit 4:** Board `raspberrypi_pico.c`
7. 🟡 **Commit 5:** Build system (meson.build)
8. 🟡 **Commit 6:** GPIO implementation
9. 🟡 **Commit 7:** UART implementation
10. 🟡 **Commit 8:** Timer implementation
11. 🟡 **Commit 9:** NeuroForge integration
12. 🟡 **Commit 10:** Tests + firmware examples

---

### 📊 **Critérios de Sucesso Final (MVP)**

✅ **Funcional:**
- Firmware LED blink executa sem erros
- GPIO visível via serial-gpio-protocol
- UART echo funcional
- Timer gera delays corretos (±5% precisão)

✅ **Qualidade:**
- 100% dos testes passam
- Código segue padrões QEMU
- Documentação completa

✅ **Integração:**
- Comando `neuroforge run --board raspberrypi-pico` funciona
- Board aparece em `neuroforge list-boards`
- Serial-GPIO protocol integrado

---

**Próximo passo:** Criar skeleton do SoC 🚀
