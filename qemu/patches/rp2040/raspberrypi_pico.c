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
#include "hw/arm/rp2040.h"
#include "hw/boards.h"
#include "hw/sysbus.h"
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

    /* Initialize and realize RP2040 SoC */
    /* The SoC handles all memory regions (ROM, SRAM, Flash, peripherals) */
    object_initialize_child(OBJECT(machine), "soc", &s->soc, TYPE_RP2040_SOC);
    
    if (!sysbus_realize(SYS_BUS_DEVICE(&s->soc), &error_fatal)) {
        return;
    }

    /* Load firmware */
    if (machine->kernel_filename) {
        uint64_t entry_addr;
        int ret;

        /* Try loading as ELF first */
        ret = load_elf(machine->kernel_filename, NULL, NULL, NULL,
                       &entry_addr, NULL, NULL, NULL, 0,
                       EM_ARM, 1, 0);

        if (ret < 0) {
            /* If ELF fails, try raw binary at Flash base (0x10000000) */
            ret = load_image_targphys(machine->kernel_filename,
                                      0x10000000, 16 * MiB);
        }

        if (ret < 0) {
            error_report("Could not load kernel '%s'", machine->kernel_filename);
            exit(1);
        }
    } else {
        error_report("No kernel specified (use -kernel <file.elf>)");
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
    /* Note: Memory is managed by the SoC, not the machine */
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
