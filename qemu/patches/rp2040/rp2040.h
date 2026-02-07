/*
 * Raspberry Pi RP2040 SoC Header
 *
 * Copyright (c) 2024 NeuroForge Team
 *
 * This work is licensed under the terms of the GNU GPL, version 2 or later.
 * See the COPYING file in the top-level directory.
 */

#ifndef HW_ARM_RP2040_H
#define HW_ARM_RP2040_H

#include "hw/sysbus.h"
#include "hw/arm/armv7m.h"
#include "hw/char/pl011.h"
#include "hw/misc/unimp.h"
#include "hw/qdev-clock.h"
#include "qom/object.h"

#define RP2040_NUM_CORES 2

/* RP2040 SoC Type */
#define TYPE_RP2040_SOC "rp2040-soc"

/* RP2040 SoC State */
typedef struct RP2040State {
    /*< private >*/
    SysBusDevice parent_obj;

    /*< public >*/
    ARMv7MState armv7m[RP2040_NUM_CORES];
    MemoryRegion rom;
    MemoryRegion sram;
    MemoryRegion sio;
    MemoryRegion io_bank0;
    MemoryRegion flash;
    MemoryRegion flash_alias;
    
    /* Peripherals */
    PL011State uart0;
    PL011State uart1;
    
    /* Unimplemented devices (for now) */
    UnimplementedDeviceState timer;
    UnimplementedDeviceState usb;

    /* GPIO State (30 pins) */
    uint32_t gpio_out;        /* GPIO output values */
    uint32_t gpio_oe;         /* GPIO output enable */
    uint32_t gpio_in;         /* GPIO input values (external state) */
    uint32_t gpio_ctrl[30];   /* GPIO control registers */

    /* Clock */
    Clock *sysclk;

    /* Properties */
    uint32_t sysclk_freq;
} RP2040State;

/* Declare RP2040State type */
OBJECT_DECLARE_SIMPLE_TYPE(RP2040State, RP2040_SOC)

#endif /* HW_ARM_RP2040_H */
