/**
 * NeuroForge RP2040 Minimal Blink Test
 *
 * Versão minimalista para Renode que NÃO depende do hardware timer
 * Usa loop simples com NVIC/SysTick (suportado pelo Renode padrão)
 */

#include "hardware/gpio.h"
#include "hardware/structs/systick.h"
#include "pico/stdlib.h"
#include <stdio.h>


#define LED_PIN 25
#define UART_ID uart0
#define BAUD_RATE 115200
#define UART_TX_PIN 0
#define UART_RX_PIN 1

// Contador de delay usando loop simples
static inline void delay_loop(volatile uint32_t count) {
  while (count--) {
    __asm volatile("nop");
  }
}

void emit_gpio_event(uint pin, bool value) {
  printf("G:pin=%u,v=%u\n", pin, value ? 1 : 0);
}

void set_led(bool state) {
  gpio_put(LED_PIN, state);
  emit_gpio_event(LED_PIN, state);
  printf("%s\n", state ? "LED ON" : "LED OFF");
}

int main() {
  // Inicializar UART diretamente (sem stdio_init_all que usa timer)
  uart_init(UART_ID, BAUD_RATE);
  gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
  gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);
  uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
  uart_set_fifo_enabled(UART_ID, true);

  // Redirecionar stdout para UART
  stdio_uart_init_full(UART_ID, BAUD_RATE, UART_TX_PIN, UART_RX_PIN);

  // Configurar LED
  gpio_init(LED_PIN);
  gpio_set_dir(LED_PIN, GPIO_OUT);
  gpio_put(LED_PIN, false);

  // Mensagem de boot
  printf("\n");
  printf("================================\n");
  printf("  NeuroForge GPIO Test - RP2040\n");
  printf("  (Minimal - no timer needed)\n");
  printf("================================\n");
  printf("Board: Raspberry Pi Pico\n");
  printf("LED Pin: GP%u\n", LED_PIN);
  printf("Protocol: G:pin=X,v=Y\n");
  printf("================================\n");
  printf("\n");

  // Loop principal usando delay simples
  bool led_state = false;
  uint32_t loop_count = 0;

  while (true) {
    loop_count++;

    // Toggle a cada ~1M iterações (ajustar conforme velocidade)
    if (loop_count >= 500000) {
      led_state = !led_state;
      set_led(led_state);
      loop_count = 0;
    }

    // Pequeno delay
    delay_loop(100);
  }

  return 0;
}
