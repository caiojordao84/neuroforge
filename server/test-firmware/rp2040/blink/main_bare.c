/**
 * NeuroForge RP2040 Bare Metal UART Test
 *
 * Firmware ABSOLUTAMENTE MÍNIMO - bare metal sem runtime do Pico SDK
 * Apenas configura UART diretamente nos registradores
 */

#include <stdint.h>

// Endereços base dos periféricos
#define RESETS_BASE 0x4000C000
#define IO_BANK0_BASE 0x40014000
#define PADS_BANK0_BASE 0x4001C000
#define UART0_BASE 0x40034000
#define SIO_BASE 0xD0000000

// Registradores UART (PL011)
#define UART0_DR (*(volatile uint32_t *)(UART0_BASE + 0x000))
#define UART0_FR (*(volatile uint32_t *)(UART0_BASE + 0x018))
#define UART0_IBRD (*(volatile uint32_t *)(UART0_BASE + 0x024))
#define UART0_FBRD (*(volatile uint32_t *)(UART0_BASE + 0x028))
#define UART0_LCR_H (*(volatile uint32_t *)(UART0_BASE + 0x02C))
#define UART0_CR (*(volatile uint32_t *)(UART0_BASE + 0x030))

// Flag Register bits
#define UART_FR_TXFF (1 << 5) // TX FIFO full
#define UART_FR_TXFE (1 << 7) // TX FIFO empty

// GPIO para LED
#define GPIO_OE (*(volatile uint32_t *)(SIO_BASE + 0x020))
#define GPIO_OUT (*(volatile uint32_t *)(SIO_BASE + 0x010))
#define GPIO_OUT_SET (*(volatile uint32_t *)(SIO_BASE + 0x014))
#define GPIO_OUT_CLR (*(volatile uint32_t *)(SIO_BASE + 0x018))

#define LED_PIN 25

// Delay simples
static void delay(volatile uint32_t count) {
  while (count--)
    __asm volatile("nop");
}

// Enviar caractere via UART
static void uart_putc(char c) {
  // Esperar se FIFO cheio
  while (UART0_FR & UART_FR_TXFF) {
  }
  UART0_DR = c;
}

// Enviar string via UART
static void uart_puts(const char *s) {
  while (*s) {
    if (*s == '\n')
      uart_putc('\r');
    uart_putc(*s++);
  }
}

// Configurar UART0 (assumindo que resets já foram feitos pelo Renode)
static void uart_init_simple(void) {
  // Desabilitar UART
  UART0_CR = 0;

  // Configurar baud rate para 115200 @ 12MHz clock
  // Divisor = 12000000 / (16 * 115200) = 6.51
  // IBRD = 6, FBRD = 0.51 * 64 = 33
  UART0_IBRD = 6;
  UART0_FBRD = 33;

  // 8 bits, no parity, 1 stop bit, enable FIFO
  UART0_LCR_H = (3 << 5) | (1 << 4); // WLEN=8, FEN=1

  // Habilitar UART, TX e RX
  UART0_CR = (1 << 0) | (1 << 8) | (1 << 9); // UARTEN, TXE, RXE
}

// LED control
static void led_on(void) { GPIO_OUT_SET = (1 << LED_PIN); }

static void led_off(void) { GPIO_OUT_CLR = (1 << LED_PIN); }

static void led_init(void) {
  GPIO_OE |= (1 << LED_PIN);
  led_off();
}

// Função main - ponto de entrada
int main(void) {
  // Inicializar periféricos
  uart_init_simple();
  led_init();

  // Enviar mensagem de boot
  uart_puts("\n");
  uart_puts("================================\n");
  uart_puts("  NeuroForge Bare Metal Test\n");
  uart_puts("================================\n");
  uart_puts("UART working!\n");
  uart_puts("================================\n");
  uart_puts("\n");

  // Loop principal
  uint32_t counter = 0;
  uint8_t led_state = 0;

  while (1) {
    counter++;

    if (counter >= 100000) {
      led_state = !led_state;

      if (led_state) {
        led_on();
        uart_puts("G:pin=25,v=1\n");
        uart_puts("LED ON\n");
      } else {
        led_off();
        uart_puts("G:pin=25,v=0\n");
        uart_puts("LED OFF\n");
      }

      counter = 0;
    }
  }

  return 0;
}

// Startup code mínimo (para linker)
void _start(void) __attribute__((naked, section(".boot")));
void _start(void) {
  __asm volatile("ldr r0, =0x20042000\n" // Stack top
                 "mov sp, r0\n"
                 "bl main\n"
                 "b .\n" // Loop infinito se main retornar
  );
}
