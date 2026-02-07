/*
 * Raspberry Pi RP2040 SoC (System-on-Chip)
 *
 * Copyright (c) 2024 NeuroForge Team
 *
 * This work is licensed under the terms of the GNU GPL, version 2 or later.
 * See the COPYING file in the top-level directory.
 */

#include "qemu/osdep.h"
#include "qemu/units.h"
#include "qemu/log.h"
#include "qemu/error-report.h"
#include "qapi/error.h"
#include "exec/memory.h"
#include "exec/address-spaces.h"
#include "hw/arm/rp2040.h"
#include "hw/boards.h"
#include "hw/qdev-properties.h"
#include "hw/qdev-clock.h"
#include "hw/sysbus.h"
#include "hw/intc/armv7m_nvic.h"
#include "target/arm/cpu.h"

/* ========== Memory Map ========== */
#define RP2040_ROM_BASE      0x00000000
#define RP2040_ROM_SIZE      (16 * KiB)

#define RP2040_FLASH_BASE    0x10000000
#define RP2040_FLASH_SIZE    (16 * MiB)  /* Max addressable */

#define RP2040_SRAM_BASE     0x20000000
#define RP2040_SRAM_SIZE     (264 * KiB)

#define RP2040_SIO_BASE      0xD0000000
#define RP2040_SIO_SIZE      0x100

#define RP2040_IO_BANK0_BASE 0x40014000
#define RP2040_IO_BANK0_SIZE 0x3000

#define RP2040_UART0_BASE    0x40034000
#define RP2040_UART1_BASE    0x40038000
#define RP2040_UART_SIZE     0x1000

#define RP2040_TIMER_BASE    0x40054000
#define RP2040_TIMER_SIZE    0x1000

#define RP2040_USB_BASE      0x50100000
#define RP2040_USB_SIZE      0x10000

/* ========== IRQs ========== */
#define RP2040_TIMER_IRQ_0   0
#define RP2040_TIMER_IRQ_1   1
#define RP2040_TIMER_IRQ_2   2
#define RP2040_TIMER_IRQ_3   3
#define RP2040_GPIO_IRQ_0    13
#define RP2040_GPIO_IRQ_1    14
#define RP2040_GPIO_IRQ_2    15
#define RP2040_GPIO_IRQ_3    16
#define RP2040_UART0_IRQ     20
#define RP2040_UART1_IRQ     21

/* ========== GPIO Implementation ========== */
static uint64_t rp2040_sio_read(void *opaque, hwaddr offset, unsigned size)
{
    RP2040State *s = RP2040_SOC(opaque);
    
    switch (offset) {
    case 0x000:  /* CPUID */
        return 0;  /* Core 0 (TODO: support Core 1) */
    case 0x004:  /* GPIO_IN */
        /* Return input state (combines output with external inputs) */
        return s->gpio_in | (s->gpio_out & s->gpio_oe);
    case 0x010:  /* GPIO_OUT */
        return s->gpio_out;
    case 0x020:  /* GPIO_OE */
        return s->gpio_oe;
    default:
        qemu_log_mask(LOG_UNIMP, "rp2040_sio: Unimplemented read at 0x%"HWADDR_PRIx"\n", offset);
        return 0;
    }
}

static void rp2040_sio_write(void *opaque, hwaddr offset, uint64_t value, unsigned size)
{
    RP2040State *s = RP2040_SOC(opaque);
    uint32_t val = value & 0x3FFFFFFF;  /* 30 GPIO pins mask */
    
    switch (offset) {
    case 0x010:  /* GPIO_OUT */
        s->gpio_out = val;
        break;
    case 0x014:  /* GPIO_OUT_SET (atomic) */
        s->gpio_out |= val;
        break;
    case 0x018:  /* GPIO_OUT_CLR (atomic) */
        s->gpio_out &= ~val;
        break;
    case 0x01C:  /* GPIO_OUT_XOR (atomic) */
        s->gpio_out ^= val;
        break;
    case 0x020:  /* GPIO_OE */
        s->gpio_oe = val;
        break;
    case 0x024:  /* GPIO_OE_SET (atomic) */
        s->gpio_oe |= val;
        break;
    case 0x028:  /* GPIO_OE_CLR (atomic) */
        s->gpio_oe &= ~val;
        break;
    case 0x02C:  /* GPIO_OE_XOR (atomic) */
        s->gpio_oe ^= val;
        break;
    default:
        qemu_log_mask(LOG_UNIMP, "rp2040_sio: Unimplemented write at 0x%"HWADDR_PRIx" = 0x%"PRIx64"\n", offset, value);
        break;
    }
}

static const MemoryRegionOps rp2040_sio_ops = {
    .read = rp2040_sio_read,
    .write = rp2040_sio_write,
    .endianness = DEVICE_NATIVE_ENDIAN,
    .valid = {
        .min_access_size = 4,
        .max_access_size = 4,
    },
};

static uint64_t rp2040_io_bank0_read(void *opaque, hwaddr offset, unsigned size)
{
    RP2040State *s = RP2040_SOC(opaque);
    
    /* Each GPIO has 8 bytes: STATUS(4) + CTRL(4) */
    int gpio_num = offset / 8;
    int reg = (offset % 8) / 4;  /* 0=STATUS, 1=CTRL */
    
    if (gpio_num >= 30) {
        qemu_log_mask(LOG_GUEST_ERROR, "io_bank0: invalid GPIO %d\n", gpio_num);
        return 0;
    }
    
    if (reg == 0) {
        /* GPIO_STATUS - read-only, mostly zero for MVP */
        return 0;
    } else {
        /* GPIO_CTRL */
        return s->gpio_ctrl[gpio_num];
    }
}

static void rp2040_io_bank0_write(void *opaque, hwaddr offset, uint64_t value, unsigned size)
{
    RP2040State *s = RP2040_SOC(opaque);
    
    /* Each GPIO has 8 bytes: STATUS(4) + CTRL(4) */
    int gpio_num = offset / 8;
    int reg = (offset % 8) / 4;  /* 0=STATUS, 1=CTRL */
    
    if (gpio_num >= 30) {
        qemu_log_mask(LOG_GUEST_ERROR, "io_bank0: invalid GPIO %d\n", gpio_num);
        return;
    }
    
    if (reg == 0) {
        /* GPIO_STATUS is read-only */
        return;
    } else {
        /* GPIO_CTRL - store function selection */
        s->gpio_ctrl[gpio_num] = value & 0x1F;  /* FUNCSEL is bits 0-4 */
    }
}

static const MemoryRegionOps rp2040_io_bank0_ops = {
    .read = rp2040_io_bank0_read,
    .write = rp2040_io_bank0_write,
    .endianness = DEVICE_NATIVE_ENDIAN,
    .valid = {
        .min_access_size = 4,
        .max_access_size = 4,
    },
};

/* ========== SoC Initialization ========== */
static void rp2040_soc_init(Object *obj)
{
    RP2040State *s = RP2040_SOC(obj);

    /* Create system clock */
    s->sysclk = qdev_init_clock_in(DEVICE(obj), "sysclk", NULL, NULL, 0);

    /* Create Cortex-M0+ cores (dual-core) */
    for (int i = 0; i < RP2040_NUM_CORES; i++) {
        object_initialize_child(obj, "armv7m[*]", &s->armv7m[i],
                                TYPE_ARMV7M);
    }

    /* Create UARTs (PL011-compatible) */
    object_initialize_child(obj, "uart0", &s->uart0, TYPE_PL011);
    object_initialize_child(obj, "uart1", &s->uart1, TYPE_PL011);

    /* Create unimplemented devices */
    object_initialize_child(obj, "timer", &s->timer, TYPE_UNIMPLEMENTED_DEVICE);
    object_initialize_child(obj, "usb", &s->usb, TYPE_UNIMPLEMENTED_DEVICE);
}

static void rp2040_soc_realize(DeviceState *dev, Error **errp)
{
    RP2040State *s = RP2040_SOC(dev);
    MemoryRegion *system_memory = get_system_memory();

    /* Set up system clock (133 MHz default) */
    if (!clock_has_source(s->sysclk)) {
        clock_set_hz(s->sysclk, s->sysclk_freq);
    }

    /* ========== Initialize GPIO State ========== */
    s->gpio_out = 0;
    s->gpio_oe = 0;
    s->gpio_in = 0;
    for (int i = 0; i < 30; i++) {
        s->gpio_ctrl[i] = 0x1F;  /* Default: NULL function */
    }

    /* ========== Memory Regions ========== */

    /* ROM (16KB at 0x00000000) */
    memory_region_init_rom(&s->rom, OBJECT(dev), "rp2040.rom",
                           RP2040_ROM_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_ROM_BASE, &s->rom);

    /* SRAM (264KB at 0x20000000) */
    memory_region_init_ram(&s->sram, OBJECT(dev), "rp2040.sram",
                           RP2040_SRAM_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_SRAM_BASE, &s->sram);

    /* Flash (16MB at 0x10000000) */
    memory_region_init_ram(&s->flash, OBJECT(dev), "rp2040.flash",
                           RP2040_FLASH_SIZE, errp);
    memory_region_add_subregion(system_memory, RP2040_FLASH_BASE, &s->flash);

    /* SIO (Single-cycle I/O) */
    memory_region_init_io(&s->sio, OBJECT(dev), &rp2040_sio_ops, s,
                          "rp2040.sio", RP2040_SIO_SIZE);
    memory_region_add_subregion(system_memory, RP2040_SIO_BASE, &s->sio);

    /* IO_BANK0 (GPIO configuration) */
    memory_region_init_io(&s->io_bank0, OBJECT(dev), &rp2040_io_bank0_ops, s,
                          "rp2040.io_bank0", RP2040_IO_BANK0_SIZE);
    memory_region_add_subregion(system_memory, RP2040_IO_BANK0_BASE, &s->io_bank0);

    /* ========== CPU Cores ========== */
    
    /* Initialize only Core 0 (MVP - single core) */
    DeviceState *armv7m = DEVICE(&s->armv7m[0]);
    qdev_prop_set_uint32(armv7m, "num-irq", 32);
    qdev_prop_set_string(armv7m, "cpu-type", ARM_CPU_TYPE_NAME("cortex-m0plus"));
    qdev_prop_set_uint32(armv7m, "num-prio-bits", 2);  /* M0+ has 2-bit priority */
    object_property_set_link(OBJECT(&s->armv7m[0]), "memory",
                             OBJECT(system_memory), &error_abort);
    
    /* Connect system clock to CPU */
    qdev_connect_clock_in(armv7m, "cpuclk", s->sysclk);
    
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->armv7m[0]), errp)) {
        return;
    }

    /* ========== UARTs ========== */

    /* UART0 */
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->uart0), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->uart0), 0, RP2040_UART0_BASE);
    sysbus_connect_irq(SYS_BUS_DEVICE(&s->uart0), 0,
                       qdev_get_gpio_in(DEVICE(&s->armv7m[0]), RP2040_UART0_IRQ));

    /* UART1 */
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->uart1), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->uart1), 0, RP2040_UART1_BASE);
    sysbus_connect_irq(SYS_BUS_DEVICE(&s->uart1), 0,
                       qdev_get_gpio_in(DEVICE(&s->armv7m[0]), RP2040_UART1_IRQ));

    /* ========== Unimplemented Devices ========== */

    /* Timer (stub for now) */
    DeviceState *timer_dev = DEVICE(&s->timer);
    qdev_prop_set_string(timer_dev, "name", "rp2040.timer");
    qdev_prop_set_uint64(timer_dev, "size", RP2040_TIMER_SIZE);
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->timer), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->timer), 0, RP2040_TIMER_BASE);

    /* USB (stub for now) */
    DeviceState *usb_dev = DEVICE(&s->usb);
    qdev_prop_set_string(usb_dev, "name", "rp2040.usb");
    qdev_prop_set_uint64(usb_dev, "size", RP2040_USB_SIZE);
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->usb), errp)) {
        return;
    }
    sysbus_mmio_map(SYS_BUS_DEVICE(&s->usb), 0, RP2040_USB_BASE);
}

/* ========== Property Definition ========== */
static Property rp2040_soc_properties[] = {
    DEFINE_PROP_UINT32("sysclk-frq", RP2040State, sysclk_freq, 133000000),
    DEFINE_PROP_END_OF_LIST(),
};

static void rp2040_soc_class_init(ObjectClass *oc, void *data)
{
    DeviceClass *dc = DEVICE_CLASS(oc);

    dc->realize = rp2040_soc_realize;
    device_class_set_props(dc, rp2040_soc_properties);
}

static const TypeInfo rp2040_soc_type_info = {
    .name          = TYPE_RP2040_SOC,
    .parent        = TYPE_SYS_BUS_DEVICE,
    .instance_size = sizeof(RP2040State),
    .instance_init = rp2040_soc_init,
    .class_init    = rp2040_soc_class_init,
};

static void rp2040_soc_register_types(void)
{
    type_register_static(&rp2040_soc_type_info);
}

type_init(rp2040_soc_register_types)
