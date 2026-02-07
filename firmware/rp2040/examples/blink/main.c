/**
 * @file main.c
 * @brief LED Blink Example for RP2040 (Raspberry Pi Pico)
 * 
 * Blinks the onboard LED (GPIO25) every 500ms.
 * Demonstrates GPIO output control using SIO registers.
 */

#include "../../common/rp2040.h"

/**
 * @brief Simple delay function (busy-wait)
 * @param ms Milliseconds to delay (approximate)
 * 
 * Note: Assumes 133MHz system clock.
 * Each loop iteration takes ~10 cycles.
 * 133,000,000 / 10 = 13,300,000 loops per second
 * 13,300 loops ≈ 1 millisecond
 */
void delay_ms(uint32_t ms) {
    for (volatile uint32_t i = 0; i < ms * 13300; i++) {
        __asm__("nop");
    }
}

/**
 * @brief Initialize GPIO pin as output
 * @param pin GPIO pin number (0-29)
 */
void gpio_init_output(uint8_t pin) {
    /* Set function to SIO (GPIO controlled by processor) */
    GPIO_CTRL(pin) = GPIO_CTRL_FUNCSEL_SIO;
    
    /* Enable output (set corresponding bit in OE register) */
    SIO_GPIO_OE_SET = (1 << pin);
}

/**
 * @brief Set GPIO pin high
 * @param pin GPIO pin number (0-29)
 */
void gpio_put_high(uint8_t pin) {
    SIO_GPIO_OUT_SET = (1 << pin);
}

/**
 * @brief Set GPIO pin low
 * @param pin GPIO pin number (0-29)
 */
void gpio_put_low(uint8_t pin) {
    SIO_GPIO_OUT_CLR = (1 << pin);
}

/**
 * @brief Main function
 */
int main(void) {
    /* Initialize GPIO25 (onboard LED) as output */
    gpio_init_output(LED_PIN);

    /* Blink LED forever */
    while (1) {
        gpio_put_high(LED_PIN);  /* Turn LED ON */
        delay_ms(500);
        
        gpio_put_low(LED_PIN);   /* Turn LED OFF */
        delay_ms(500);
    }

    return 0;  /* Never reached */
}
