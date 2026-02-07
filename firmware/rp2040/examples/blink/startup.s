/*
 * RP2040 Minimal Startup Code
 * 
 * Sets up stack and jumps to main()
 */

    .syntax unified
    .cpu cortex-m0plus
    .thumb

/* ========== Vector Table ========== */

    .section .vectors, "ax"
    .align 2
    .global _vectors

_vectors:
    .word _stack_top            /* Initial stack pointer */
    .word Reset_Handler         /* Reset handler */
    .word NMI_Handler           /* NMI handler */
    .word HardFault_Handler     /* Hard fault handler */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word SVC_Handler           /* SVCall handler */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word PendSV_Handler        /* PendSV handler */
    .word SysTick_Handler       /* SysTick handler */

/* ========== Reset Handler ========== */

    .section .text
    .thumb_func
    .global Reset_Handler

Reset_Handler:
    /* Copy .data section from flash to SRAM */
    ldr r0, =_sidata
    ldr r1, =_sdata
    ldr r2, =_edata
    movs r3, #0
    b data_copy_check

data_copy_loop:
    ldr r4, [r0, r3]
    str r4, [r1, r3]
    adds r3, r3, #4

data_copy_check:
    adds r4, r1, r3
    cmp r4, r2
    bcc data_copy_loop

    /* Zero .bss section */
    ldr r0, =_sbss
    ldr r1, =_ebss
    movs r2, #0
    b bss_zero_check

bss_zero_loop:
    str r2, [r0]
    adds r0, r0, #4

bss_zero_check:
    cmp r0, r1
    bcc bss_zero_loop

    /* Call main() */
    bl main

    /* Hang if main returns */
hang:
    b hang

/* ========== Default Handlers ========== */

    .thumb_func
    .weak NMI_Handler
NMI_Handler:
    b .

    .thumb_func
    .weak HardFault_Handler
HardFault_Handler:
    b .

    .thumb_func
    .weak SVC_Handler
SVC_Handler:
    b .

    .thumb_func
    .weak PendSV_Handler
PendSV_Handler:
    b .

    .thumb_func
    .weak SysTick_Handler
SysTick_Handler:
    b .
