/**
 * NeuroForge Time - Arduino Integration
 * 
 * Sobrescreve as funções de timing do core Arduino padrão
 * para usar o NeuroForge Time em vez de Timer0.
 * 
 * Funções substituídas:
 * - delay(ms)  → usa nf_sleep_ms() em vez de Timer0
 * - millis()   → usa nf_now_ms() em vez de Timer0 overflow
 * - micros()   → usa nf_now_us() em vez de Timer0
 * 
 * Isso permite que sketches Arduino padrão funcionem
 * no QEMU sem modificações.
 */

#include <Arduino.h>
#include "nf_time.h"

/**
 * Substitui delay() do Arduino.
 * 
 * O delay() original usa millis() que depende de Timer0.
 * Como Timer0 não funciona no QEMU, substituímos por
 * nf_sleep_ms() que usa busy-wait + clock virtual.
 */
void delay(unsigned long ms) {
  nf_sleep_ms((uint32_t)ms);
}

/**
 * Substitui millis() do Arduino.
 * 
 * O millis() original usa Timer0 overflow interrupt.
 * Como Timer0 não funciona no QEMU (sempre retorna 0),
 * substituímos por nf_now_ms() que lê o clock virtual.
 */
unsigned long millis(void) {
  return nf_now_ms();
}

/**
 * Substitui micros() do Arduino.
 * 
 * O micros() original usa Timer0.
 * Substituímos por nf_now_us() que lê o clock virtual.
 */
unsigned long micros(void) {
  return nf_now_us();
}

/**
 * delayMicroseconds() continua usando _delay_us().
 * 
 * Como é uma função de busy-wait puro baseado em F_CPU,
 * já funciona corretamente no QEMU sem modificações.
 * 
 * Não precisamos sobrescrever.
 */
