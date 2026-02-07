/**
 * @file link.ld
 * @brief Linker Script for RP2040 (Raspberry Pi Pico)
 * 
 * Memory layout:
 * - ROM:   0x00000000 - 0x00003FFF (16KB)
 * - Flash: 0x10000000 - 0x101FFFFF (2MB XIP)
 * - SRAM:  0x20000000 - 0x20041FFF (264KB)
 */

ENTRY(Reset_Handler)

MEMORY
{
    ROM   (rx)  : ORIGIN = 0x00000000, LENGTH = 16K
    FLASH (rx)  : ORIGIN = 0x10000000, LENGTH = 2M
    SRAM  (rwx) : ORIGIN = 0x20000000, LENGTH = 264K
}

/* Stack size (8KB) */
_stack_size = 0x2000;

SECTIONS
{
    /* ========== Code in Flash ========== */
    .text :
    {
        KEEP(*(.vector_table))  /* Vector table must be first */
        *(.text)                /* Program code */
        *(.text*)
        *(.rodata)              /* Read-only data */
        *(.rodata*)
        
        . = ALIGN(4);
        _etext = .;             /* End of code */
    } > FLASH

    /* ========== Initialized Data (Flash -> SRAM) ========== */
    .data :
    {
        . = ALIGN(4);
        _sdata = .;             /* Start of data in SRAM */
        *(.data)
        *(.data*)
        . = ALIGN(4);
        _edata = .;             /* End of data in SRAM */
    } > SRAM AT > FLASH
    
    _sidata = LOADADDR(.data);  /* Start of data in Flash (for copying) */

    /* ========== Uninitialized Data (BSS) ========== */
    .bss :
    {
        . = ALIGN(4);
        _sbss = .;              /* Start of BSS */
        *(.bss)
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;              /* End of BSS */
    } > SRAM

    /* ========== Stack ========== */
    .stack :
    {
        . = ALIGN(8);
        . = . + _stack_size;
        . = ALIGN(8);
        _stack_top = .;         /* Top of stack (grows downward) */
    } > SRAM

    /* ========== Heap (remaining SRAM) ========== */
    .heap :
    {
        . = ALIGN(4);
        _heap_start = .;
        . = ORIGIN(SRAM) + LENGTH(SRAM);
        _heap_end = .;
    } > SRAM
}
