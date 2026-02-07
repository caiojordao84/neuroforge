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

#include "hw/arm/armv7m.h"
#include "hw/sysbus.h"
#include "qom/object.h"

#define RP2040_NUM_CORES 2

/* RP2040 SoC Type */
#define TYPE_RP2040_SOC "rp2040-soc"

/* Forward declaration for RP2040State */
typedef struct RP2040State RP2040State;

/* Declare the RP2040 SoC type */
OBJECT_DECLARE_SIMPLE_TYPE(RP2040State, RP2040_SOC)

#endif /* HW_ARM_RP2040_H */
