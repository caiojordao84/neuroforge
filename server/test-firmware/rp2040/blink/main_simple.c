/**
 * NeuroForge RP2040 Ultra-Simple UART Test
 *
 * Firmware de teste MÍNIMO para verificar se UART funciona no Renode
 * NÃO usa nenhum timer ou delay - apenas printf infinito
 */

#include "hardware/gpio.h"
#include "pico/stdlib.h"
#include <stdio.h>


#define LED_PIN 25
#define UART_ID uart0
#define BAUD_RATE 115200
#define UART_TX_PIN 0
#define UART_RX_PIN 1

// Delay simples baseado em loop
static void simple_delay(volatile uint32_t count) {
  while (count--) {
    __asm volatile("nop");
  }
}

int main() {
  // ========================================
  // 1. Inicializar UART diretamente
  // ========================================
  uart_init(UART_ID, BAUD_RATE);
  gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
  gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);
  uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
  uart_set_fifo_enabled(UART_ID, true);

  // Redirecionar printf para UART
  stdio_uart_init_full(UART_ID, BAUD_RATE, UART_TX_PIN, UART_RX_PIN);

  // ========================================
  // 2. Configurar GPIO do LED
  // ========================================
  gpio_init(LED_PIN);
  gpio_set_dir(LED_PIN, GPIO_OUT);
  gpio_put(LED_PIN, false);

  // ========================================
  // 3. Mensagem de boot
  // ========================================
  // Delay curto para estabilizar (loop simples, não timer)
  simple_delay(100000);

  printf("\n");
  printf("================================\n");
  printf("  NeuroForge UART Test - RP2040\n");
  printf("================================\n");
  printf("If you see this, UART works!\n");
  printf("================================\n");
  printf("\n");

  // ========================================
  // 4. Loop infinito com LED toggle
  // ========================================
  bool led_state = false;
  uint32_t counter = 0;

  while (true) {
    counter++;

    // Toggle LED a cada 200000 iterações
    if (counter >= 200000) {
      led_state = !led_state;
      gpio_put(LED_PIN, led_state);

      // Emitir evento GPIO
      printf("G:pin=%u,v=%u\n", LED_PIN, led_state ? 1 : 0);
      printf("%s\n", led_state ? "LED ON" : "LED OFF");

      counter = 0;
    }
  }

  return 0;
}
