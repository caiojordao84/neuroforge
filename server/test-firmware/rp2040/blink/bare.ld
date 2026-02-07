MEMORY
{
    FLASH (rx) : ORIGIN = 0x10000000, LENGTH = 2048K
    RAM (rwx)  : ORIGIN = 0x20000000, LENGTH = 264K
}

SECTIONS
{
    .text :
    {
        KEEP(*(.boot))
        *(.text*)
        *(.rodata*)
    } > FLASH

    .data :
    {
        *(.data*)
    } > RAM AT > FLASH

    .bss :
    {
        *(.bss*)
        *(COMMON)
    } > RAM
}
