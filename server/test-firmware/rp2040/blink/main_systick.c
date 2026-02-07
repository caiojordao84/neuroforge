/**
 * NeuroForge RP2040 SysTick Blink Test
 *
 * Versão para Renode que usa SysTick (NVIC built-in) em vez do
 * hardware timer do RP2040
 *
 * O SysTick é parte do Cortex-M0+ core e é emulado pelo Renode
 */

#include "hardware/gpio.h"
#include "pico/stdlib.h"
#include <stdio.h>


#define LED_PIN 25
#define UART_ID uart0
#define BAUD_RATE 115200
#define UART_TX_PIN 0
#define UART_RX_PIN 1

// SysTick registers (part of Cortex-M0+ core, not RP2040 peripheral)
#define SYSTICK_CSR (*(volatile uint32_t *)0xE000E010)
#define SYSTICK_RVR (*(volatile uint32_t *)0xE000E014)
#define SYSTICK_CVR (*(volatile uint32_t *)0xE000E018)

// SysTick CSR bits
#define SYSTICK_ENABLE (1 << 0)
#define SYSTICK_TICKINT (1 << 1)
#define SYSTICK_CLKSOURCE (1 << 2)
#define SYSTICK_COUNTFLAG (1 << 16)

// Contador de ticks
volatile uint32_t systick_count = 0;

// ISR do SysTick
void isr_systick(void) { systick_count++; }

// Inicializar SysTick para 1ms tick @ 12MHz (default clock)
void systick_init(uint32_t ticks_per_interrupt) {
  SYSTICK_RVR = ticks_per_interrupt - 1;
  SYSTICK_CVR = 0;
  SYSTICK_CSR = SYSTICK_ENABLE | SYSTICK_TICKINT | SYSTICK_CLKSOURCE;
}

// Delay usando SysTick
void delay_ms_systick(uint32_t ms) {
  uint32_t target = systick_count + ms;
  while (systick_count < target) {
    __asm volatile("wfi"); // Wait for interrupt
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
  // Configurar UART diretamente
  uart_init(UART_ID, BAUD_RATE);
  gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
  gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);

  // Redirecionar stdout para UART
  stdio_uart_init_full(UART_ID, BAUD_RATE, UART_TX_PIN, UART_RX_PIN);

  // Configurar LED
  gpio_init(LED_PIN);
  gpio_set_dir(LED_PIN, GPIO_OUT);
  gpio_put(LED_PIN, false);

  // Inicializar SysTick (12000 ticks = 1ms @ 12MHz)
  // Nota: frequência pode variar no Renode, ajustar conforme necessário
  systick_init(12000);

  // Mensagem de boot (delay curto para UART estabilizar)
  for (volatile int i = 0; i < 100000; i++)
    __asm("nop");

  printf("\n");
  printf("================================\n");
  printf("  NeuroForge GPIO Test - RP2040\n");
  printf("  (SysTick-based timing)\n");
  printf("================================\n");
  printf("Board: Raspberry Pi Pico\n");
  printf("LED Pin: GP%u\n", LED_PIN);
  printf("Protocol: G:pin=X,v=Y\n");
  printf("================================\n");
  printf("\n");

  // Loop principal
  bool led_state = false;

  while (true) {
    led_state = !led_state;
    set_led(led_state);
    delay_ms_systick(1000);
  }

  return 0;
}
