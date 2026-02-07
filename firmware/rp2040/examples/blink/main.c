/*
 * RP2040 Blink Test - GPIO 25 (Onboard LED)
 * 
 * Minimal example to test QEMU RP2040 emulation
 * No SDK dependencies - direct register access
 */

#include <stdint.h>
#include <stdbool.h>

/* ========== RP2040 Register Definitions ========== */

/* SIO (Single-cycle I/O) Base */
#define SIO_BASE        0xD0000000
#define GPIO_OUT        ((volatile uint32_t *)(SIO_BASE + 0x010))
#define GPIO_OUT_SET    ((volatile uint32_t *)(SIO_BASE + 0x014))
#define GPIO_OUT_CLR    ((volatile uint32_t *)(SIO_BASE + 0x018))
#define GPIO_OUT_XOR    ((volatile uint32_t *)(SIO_BASE + 0x01C))
#define GPIO_OE         ((volatile uint32_t *)(SIO_BASE + 0x020))
#define GPIO_OE_SET     ((volatile uint32_t *)(SIO_BASE + 0x024))
#define GPIO_OE_CLR     ((volatile uint32_t *)(SIO_BASE + 0x028))

/* IO_BANK0 Base (GPIO Configuration) */
#define IO_BANK0_BASE   0x40014000
#define GPIO_CTRL(n)    ((volatile uint32_t *)(IO_BANK0_BASE + (n) * 8 + 4))

/* UART0 Base */
#define UART0_BASE      0x40034000
#define UART0_DR        ((volatile uint32_t *)(UART0_BASE + 0x000))
#define UART0_FR        ((volatile uint32_t *)(UART0_BASE + 0x018))

/* GPIO Pin Definitions */
#define LED_PIN         25

/* FUNCSEL values */
#define FUNCSEL_SIO     5  /* GPIO controlled by SIO */

/* ========== Helper Functions ========== */

void uart_putc(char c) {
    /* Wait until TX FIFO not full */
    while (*UART0_FR & (1 << 5));
    *UART0_DR = c;
}

void uart_puts(const char *s) {
    while (*s) {
        if (*s == '\n') {
            uart_putc('\r');
        }
        uart_putc(*s++);
    }
}

void delay(uint32_t count) {
    for (volatile uint32_t i = 0; i < count; i++) {
        __asm__("nop");
    }
}

/* ========== GPIO Functions ========== */

void gpio_init(uint32_t pin) {
    /* Set function to SIO (software-controlled GPIO) */
    *GPIO_CTRL(pin) = FUNCSEL_SIO;
}

void gpio_set_dir_out(uint32_t pin) {
    /* Enable output */
    *GPIO_OE_SET = (1 << pin);
}

void gpio_put(uint32_t pin, bool value) {
    if (value) {
        *GPIO_OUT_SET = (1 << pin);
    } else {
        *GPIO_OUT_CLR = (1 << pin);
    }
}

void gpio_toggle(uint32_t pin) {
    *GPIO_OUT_XOR = (1 << pin);
}

/* ========== Main Program ========== */

int main(void) {
    uart_puts("\n=================================\n");
    uart_puts("  RP2040 Blink Test (QEMU)\n");
    uart_puts("  GPIO 25 Toggle\n");
    uart_puts("=================================\n\n");

    /* Initialize LED pin */
    gpio_init(LED_PIN);
    gpio_set_dir_out(LED_PIN);
    gpio_put(LED_PIN, 0);  /* Start with LED off */

    uart_puts("LED initialized. Starting blink...\n\n");

    /* Blink loop */
    uint32_t count = 0;
    while (1) {
        gpio_put(LED_PIN, 1);
        uart_puts("[LED ON]  ");
        
        /* Print counter */
        uart_putc('0' + (count % 10));
        uart_putc('\n');
        
        delay(5000000);

        gpio_put(LED_PIN, 0);
        uart_puts("[LED OFF] ");
        uart_putc('0' + (count % 10));
        uart_putc('\n');
        
        delay(5000000);

        count++;
    }

    return 0;
}
