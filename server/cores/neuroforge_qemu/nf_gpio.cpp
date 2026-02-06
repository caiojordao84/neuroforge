#include "nf_gpio.h"
#include <avr/io.h>

/**
 * Low-level UART0 write to send GPIO frames to QEMU.
 * This works even if Serial.begin() was not called.
 */
static void uart_send(char c) {
  // Wait for empty transmit buffer
  while (!(UCSR0A & (1 << UDRE0)))
    ;
  // Put data into buffer, sends the data
  UDR0 = c;
}

static void uart_print(const char *s) {
  while (*s)
    uart_send(*s++);
}

static void uart_print_num(uint8_t n) {
  if (n >= 100)
    uart_send('0' + (n / 100) % 10);
  if (n >= 10)
    uart_send('0' + (n / 10) % 10);
  uart_send('0' + (n % 10));
}

// Cache to avoid redundant reporting
static uint8_t nf_pin_states[32] = {0xFF}; // 0xFF means unknown
static uint8_t nf_mode_states[32] = {0xFF};

void nf_report_gpio(uint8_t pin, uint8_t value) {
  if (pin < 32 && nf_pin_states[pin] == value)
    return;
  if (pin < 32)
    nf_pin_states[pin] = value;

  uart_print("G:pin=");
  uart_print_num(pin);
  uart_print(",v=");
  uart_send(value ? '1' : '0');
  uart_send('\n');
}

void nf_report_mode(uint8_t pin, uint8_t mode) {
  if (pin < 32 && nf_mode_states[pin] == mode)
    return;
  if (pin < 32)
    nf_mode_states[pin] = mode;

  uart_print("M:pin=");
  uart_print_num(pin);
  uart_print(",m=");
  // Mapping: 0=INPUT, 1=OUTPUT, 2=INPUT_PULLUP
  uart_send('0' + mode);
  uart_send('\n');
}
