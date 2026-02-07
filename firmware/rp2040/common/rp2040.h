/**
 * @file rp2040.h
 * @brief RP2040 Hardware Definitions
 * 
 * Memory-mapped register addresses for RP2040 peripherals.
 * Based on RP2040 Datasheet.
 */

#ifndef RP2040_H
#define RP2040_H

#include <stdint.h>

/* ========== Memory Regions ========== */
#define ROM_BASE        0x00000000  /* 16KB Boot ROM */
#define FLASH_BASE      0x10000000  /* 16MB Flash (XIP) */
#define SRAM_BASE       0x20000000  /* 264KB SRAM */
#define SIO_BASE        0xD0000000  /* Single-cycle I/O */

/* ========== GPIO - SIO (Fast Access) ========== */
#define SIO_CPUID       (*(volatile uint32_t*)(SIO_BASE + 0x000))
#define SIO_GPIO_IN     (*(volatile uint32_t*)(SIO_BASE + 0x004))
#define SIO_GPIO_OUT    (*(volatile uint32_t*)(SIO_BASE + 0x010))
#define SIO_GPIO_OUT_SET (*(volatile uint32_t*)(SIO_BASE + 0x014))
#define SIO_GPIO_OUT_CLR (*(volatile uint32_t*)(SIO_BASE + 0x018))
#define SIO_GPIO_OUT_XOR (*(volatile uint32_t*)(SIO_BASE + 0x01C))
#define SIO_GPIO_OE     (*(volatile uint32_t*)(SIO_BASE + 0x020))
#define SIO_GPIO_OE_SET (*(volatile uint32_t*)(SIO_BASE + 0x024))
#define SIO_GPIO_OE_CLR (*(volatile uint32_t*)(SIO_BASE + 0x028))
#define SIO_GPIO_OE_XOR (*(volatile uint32_t*)(SIO_BASE + 0x02C))

/* ========== GPIO - IO_BANK0 (Configuration) ========== */
#define IO_BANK0_BASE   0x40014000
#define GPIO_STATUS(n)  (*(volatile uint32_t*)(IO_BANK0_BASE + 0x000 + (n)*8))
#define GPIO_CTRL(n)    (*(volatile uint32_t*)(IO_BANK0_BASE + 0x004 + (n)*8))

/* GPIO_CTRL Register Bits */
#define GPIO_CTRL_FUNCSEL_MASK  0x0000001F
#define GPIO_CTRL_FUNCSEL_SIO   5  /* GPIO controlled by SIO */

/* ========== UART ========== */
#define UART0_BASE      0x40034000
#define UART1_BASE      0x40038000

#define UART_DR(base)   (*(volatile uint32_t*)(base + 0x000))
#define UART_RSR(base)  (*(volatile uint32_t*)(base + 0x004))
#define UART_FR(base)   (*(volatile uint32_t*)(base + 0x018))
#define UART_IBRD(base) (*(volatile uint32_t*)(base + 0x024))
#define UART_FBRD(base) (*(volatile uint32_t*)(base + 0x028))
#define UART_LCR_H(base) (*(volatile uint32_t*)(base + 0x02C))
#define UART_CR(base)   (*(volatile uint32_t*)(base + 0x030))

/* UART_FR Register Bits */
#define UART_FR_RXFE    (1 << 4)  /* RX FIFO Empty */
#define UART_FR_TXFF    (1 << 5)  /* TX FIFO Full */

/* UART_LCR_H Register Bits */
#define UART_LCR_H_WLEN_8BIT (3 << 5)  /* 8-bit word length */

/* UART_CR Register Bits */
#define UART_CR_UARTEN  (1 << 0)  /* UART Enable */
#define UART_CR_TXE     (1 << 8)  /* TX Enable */
#define UART_CR_RXE     (1 << 9)  /* RX Enable */

/* ========== Timer ========== */
#define TIMER_BASE      0x40054000

#define TIMER_TIMEHW    (*(volatile uint32_t*)(TIMER_BASE + 0x000))
#define TIMER_TIMELW    (*(volatile uint32_t*)(TIMER_BASE + 0x004))
#define TIMER_TIMEHR    (*(volatile uint32_t*)(TIMER_BASE + 0x008))
#define TIMER_TIMELR    (*(volatile uint32_t*)(TIMER_BASE + 0x00C))
#define TIMER_ALARM0    (*(volatile uint32_t*)(TIMER_BASE + 0x010))
#define TIMER_ALARM1    (*(volatile uint32_t*)(TIMER_BASE + 0x014))
#define TIMER_ALARM2    (*(volatile uint32_t*)(TIMER_BASE + 0x018))
#define TIMER_ALARM3    (*(volatile uint32_t*)(TIMER_BASE + 0x01C))
#define TIMER_ARMED     (*(volatile uint32_t*)(TIMER_BASE + 0x020))
#define TIMER_TIMERAWH  (*(volatile uint32_t*)(TIMER_BASE + 0x024))
#define TIMER_TIMERAWL  (*(volatile uint32_t*)(TIMER_BASE + 0x028))

/* ========== Constants ========== */
#define LED_PIN         25  /* Onboard LED on GPIO25 */
#define SYSCLK_HZ       133000000  /* System clock (133 MHz) */

#endif /* RP2040_H */
