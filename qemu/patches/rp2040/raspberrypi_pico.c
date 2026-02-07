/*
 * Raspberry Pi Pico Board
 *
 * Copyright (c) 2024 NeuroForge Team
 *
 * This work is licensed under the terms of the GNU GPL, version 2 or later.
 * See the COPYING file in the top-level directory.
 */

#include "qemu/osdep.h"
#include "qemu/units.h"
#include "qemu/error-report.h"
#include "qapi/error.h"
#include "exec/memory.h"
#include "hw/arm/rp2040.h"
#include "hw/boards.h"
#include "hw/qdev-properties.h"
#include "hw/loader.h"
#include "elf.h"

/* Board State */
typedef struct RaspberryPiPicoState {
    MachineState parent;
    RP2040State soc;
} RaspberryPiPicoState;

#define TYPE_RASPBERRYPI_PICO_MACHINE MACHINE_TYPE_NAME("raspberrypi-pico")
OBJECT_DECLARE_SIMPLE_TYPE(RaspberryPiPicoState, RASPBERRYPI_PICO_MACHINE)

/* Board Initialization */
static void raspberrypi_pico_init(MachineState *machine)
{
    RaspberryPiPicoState *s = RASPBERRYPI_PICO_MACHINE(machine);
    MemoryRegion *system_memory = get_system_memory();
    MemoryRegion *sram = g_new(MemoryRegion, 1);
    MemoryRegion *flash = g_new(MemoryRegion, 1);

    /* Initialize RP2040 SoC */
    object_initialize_child(OBJECT(machine), "soc", &s->soc, TYPE_RP2040_SOC);
    qdev_realize(DEVICE(&s->soc), NULL, &error_fatal);

    /* Load firmware into Flash (XIP - Execute In Place) */
    if (machine->kernel_filename) {
        uint64_t entry_addr;
        int ret;

        /* Try loading as ELF first */
        ret = load_elf(machine->kernel_filename, NULL, NULL, NULL,
                       &entry_addr, NULL, NULL, NULL, 0,
                       EM_ARM, 1, 0);

        if (ret < 0) {
            /* If ELF fails, try raw binary at Flash base */
            ret = load_image_targphys(machine->kernel_filename,
                                      0x10000000, 16 * MiB);
            entry_addr = 0x10000000;
        }

        if (ret < 0) {
            error_report("Could not load kernel '%s'", machine->kernel_filename);
            exit(1);
        }

        /* Set PC to entry point (for ELF files) */
        /* Note: For RP2040, the bootloader in ROM typically handles this */
    } else {
        error_report("No kernel specified (use -kernel)");
        exit(1);
    }
}

/* Machine Class */
static void raspberrypi_pico_machine_class_init(ObjectClass *oc, void *data)
{
    MachineClass *mc = MACHINE_CLASS(oc);

    mc->desc = "Raspberry Pi Pico (RP2040)";
    mc->init = raspberrypi_pico_init;
    mc->max_cpus = 1;  /* MVP: single core (Core 0 only) */
    mc->default_cpus = 1;
    mc->default_ram_size = 264 * KiB;  /* 264KB SRAM */
    mc->default_ram_id = "rp2040.sram";
}

static const TypeInfo raspberrypi_pico_machine_type = {
    .name = TYPE_RASPBERRYPI_PICO_MACHINE,
    .parent = TYPE_MACHINE,
    .instance_size = sizeof(RaspberryPiPicoState),
    .class_init = raspberrypi_pico_machine_class_init,
};

static void raspberrypi_pico_machine_register_types(void)
{
    type_register_static(&raspberrypi_pico_machine_type);
}

type_init(raspberrypi_pico_machine_register_types)
