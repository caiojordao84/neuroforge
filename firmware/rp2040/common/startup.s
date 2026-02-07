/**
 * @file startup.s
 * @brief RP2040 Startup Code (ARM Cortex-M0+)
 * 
 * Minimal vector table and reset handler for bare-metal RP2040.
 */

.syntax unified
.cpu cortex-m0plus
.thumb

/* ========== Vector Table ========== */
.section .vector_table,"a",%progbits
.type vector_table, %object
.global vector_table
vector_table:
    .word _stack_top            /* Initial Stack Pointer */
    .word Reset_Handler         /* Reset Handler */
    .word NMI_Handler           /* NMI Handler */
    .word HardFault_Handler     /* Hard Fault Handler */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word SVC_Handler           /* SVCall Handler */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word PendSV_Handler        /* PendSV Handler */
    .word SysTick_Handler       /* SysTick Handler */
    
    /* External Interrupts (RP2040 specific) */
    .word TIMER_IRQ_0           /* Timer 0 */
    .word TIMER_IRQ_1           /* Timer 1 */
    .word TIMER_IRQ_2           /* Timer 2 */
    .word TIMER_IRQ_3           /* Timer 3 */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word GPIO_IRQ_0            /* GPIO Bank 0 */
    .word GPIO_IRQ_1            /* GPIO Bank 1 */
    .word GPIO_IRQ_2            /* GPIO Bank 2 */
    .word GPIO_IRQ_3            /* GPIO Bank 3 */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word 0                     /* Reserved */
    .word UART0_IRQ             /* UART0 */
    .word UART1_IRQ             /* UART1 */

.size vector_table, .-vector_table

/* ========== Reset Handler ========== */
.section .text.Reset_Handler
.weak Reset_Handler
.type Reset_Handler, %function
Reset_Handler:
    /* Copy .data section from Flash to SRAM */
    ldr r0, =_sidata
    ldr r1, =_sdata
    ldr r2, =_edata
    b data_copy_check
data_copy:
    ldr r3, [r0]
    adds r0, r0, #4
    str r3, [r1]
    adds r1, r1, #4
data_copy_check:
    cmp r1, r2
    blo data_copy

    /* Zero .bss section */
    ldr r0, =_sbss
    ldr r1, =_ebss
    movs r2, #0
    b bss_zero_check
bss_zero:
    str r2, [r0]
    adds r0, r0, #4
bss_zero_check:
    cmp r0, r1
    blo bss_zero

    /* Call main() */
    bl main

    /* If main returns, loop forever */
Infinite_Loop:
    b Infinite_Loop

.size Reset_Handler, .-Reset_Handler

/* ========== Default Handlers ========== */
.section .text.Default_Handler,"ax",%progbits
Default_Handler:
Infinite_Loop_Default:
    b Infinite_Loop_Default
.size Default_Handler, .-Default_Handler

/* Weak aliases for exception handlers */
.weak NMI_Handler
.thumb_set NMI_Handler, Default_Handler

.weak HardFault_Handler
.thumb_set HardFault_Handler, Default_Handler

.weak SVC_Handler
.thumb_set SVC_Handler, Default_Handler

.weak PendSV_Handler
.thumb_set PendSV_Handler, Default_Handler

.weak SysTick_Handler
.thumb_set SysTick_Handler, Default_Handler

.weak TIMER_IRQ_0
.thumb_set TIMER_IRQ_0, Default_Handler

.weak TIMER_IRQ_1
.thumb_set TIMER_IRQ_1, Default_Handler

.weak TIMER_IRQ_2
.thumb_set TIMER_IRQ_2, Default_Handler

.weak TIMER_IRQ_3
.thumb_set TIMER_IRQ_3, Default_Handler

.weak GPIO_IRQ_0
.thumb_set GPIO_IRQ_0, Default_Handler

.weak GPIO_IRQ_1
.thumb_set GPIO_IRQ_1, Default_Handler

.weak GPIO_IRQ_2
.thumb_set GPIO_IRQ_2, Default_Handler

.weak GPIO_IRQ_3
.thumb_set GPIO_IRQ_3, Default_Handler

.weak UART0_IRQ
.thumb_set UART0_IRQ, Default_Handler

.weak UART1_IRQ
.thumb_set UART1_IRQ, Default_Handler
