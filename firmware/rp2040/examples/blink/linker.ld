/*
 * RP2040 Linker Script
 * 
 * Memory layout for QEMU emulation
 */

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x10000000, LENGTH = 2M
    RAM (rwx)   : ORIGIN = 0x20000000, LENGTH = 264K
}

/* Stack size */
_stack_size = 8K;

ENTRY(Reset_Handler)

SECTIONS
{
    /* Vectors and code in FLASH */
    .text : ALIGN(4)
    {
        KEEP(*(.vectors))
        *(.text*)
        *(.rodata*)
        . = ALIGN(4);
        _etext = .;
    } > FLASH

    /* Initialized data (copied from FLASH to RAM at startup) */
    _sidata = LOADADDR(.data);
    .data : ALIGN(4)
    {
        _sdata = .;
        *(.data*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH

    /* Uninitialized data (zeroed at startup) */
    .bss : ALIGN(4)
    {
        _sbss = .;
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
    } > RAM

    /* Stack (grows downward from top of RAM) */
    .stack (NOLOAD) : ALIGN(8)
    {
        . = . + _stack_size;
        _stack_top = .;
    } > RAM

    /* Discard unwanted sections */
    /DISCARD/ :
    {
        *(.ARM.exidx*)
        *(.ARM.extab*)
    }
}
