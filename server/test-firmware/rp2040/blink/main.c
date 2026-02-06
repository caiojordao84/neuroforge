/**
 * NeuroForge RP2040 GPIO Test Firmware
 * 
 * Board: Raspberry Pi Pico (RP2040)
 * SDK: Pico SDK (C/C++ nativo, NÃO Arduino)
 * Emulator: Renode
 * 
 * Pisca o LED onboard (GP25) e emite eventos GPIO via UART
 * usando o protocolo NeuroForge: G:pin=X,v=Y
 */

#include "pico/stdlib.h"
#include "hardware/gpio.h"
#include "hardware/uart.h"
#include <stdio.h>

// Configurações
#define LED_PIN 25           // LED onboard do Pico (GP25)
#define BLINK_INTERVAL 1000  // Intervalo em ms
#define UART_ID uart0        // UART0
#define BAUD_RATE 115200     // Baud rate
#define UART_TX_PIN 0        // GP0 (TX)
#define UART_RX_PIN 1        // GP1 (RX)

/**
 * Emite evento GPIO no formato NeuroForge
 * Formato: G:pin=X,v=Y
 * 
 * @param pin Número do pino GPIO
 * @param value Estado do pino (0=LOW, 1=HIGH)
 */
void emit_gpio_event(uint pin, bool value) {
    printf("G:pin=%u,v=%u\n", pin, value ? 1 : 0);
}

/**
 * Controla LED e emite evento GPIO
 * 
 * @param state true=ON, false=OFF
 */
void set_led(bool state) {
    gpio_put(LED_PIN, state);
    emit_gpio_event(LED_PIN, state);
    printf("%s\n", state ? "LED ON" : "LED OFF");
}

int main() {
    // Inicializar stdio (necessário para printf)
    stdio_init_all();
    
    // Aguardar estabilização (importante para Renode)
    sleep_ms(100);
    
    // Configurar UART0
    uart_init(UART_ID, BAUD_RATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);
    uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
    uart_set_fifo_enabled(UART_ID, true);
    
    // Configurar LED
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);
    gpio_put(LED_PIN, false);
    
    // Mensagem de boas-vindas
    printf("\n");
    printf("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    printf("  NeuroForge GPIO Test - RP2040\n");
    printf("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    printf("Board: Raspberry Pi Pico\n");
    printf("LED Pin: GP%u\n", LED_PIN);
    printf("Protocol: G:pin=X,v=Y\n");
    printf("\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n");
    printf("\n");
    
    // Loop principal
    bool led_state = false;
    uint64_t last_toggle = 0;
    
    while (true) {
        uint64_t now = to_ms_since_boot(get_absolute_time());
        
        // Toggle LED a cada BLINK_INTERVAL
        if (now - last_toggle >= BLINK_INTERVAL) {
            led_state = !led_state;
            set_led(led_state);
            last_toggle = now;
        }
        
        // Pequeno delay para não sobrecarregar CPU
        sleep_ms(10);
    }
    
    return 0;
}
