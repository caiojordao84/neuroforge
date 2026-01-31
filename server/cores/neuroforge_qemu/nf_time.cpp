/**
 * NeuroForge Time - Core Implementation
 * 
 * Implementação v0: Clock virtual mantido dentro do firmware
 * 
 * Usa _delay_ms() de <util/delay.h> que funciona no QEMU AVR porque
 * é baseado apenas em F_CPU (ciclos de CPU), não em timers.
 * 
 * Esta implementação garante que delay() e millis() funcionem
 * corretamente no QEMU sem depender de Timer0/Timer1.
 */

#include "nf_time.h"
#include <util/delay.h>

// Estado do clock virtual da simulação
static volatile uint32_t nf_ms = 0;
static volatile uint32_t nf_us = 0;

/**
 * Retorna o tempo atual em milissegundos.
 */
uint32_t nf_now_ms(void) {
  return nf_ms;
}

/**
 * Retorna o tempo atual em microssegundos.
 */
uint32_t nf_now_us(void) {
  return nf_us;
}

/**
 * Avança o clock virtual.
 * 
 * Chamado internamente por nf_sleep_ms() e pelo main loop.
 */
void nf_advance_ms(uint32_t ms) {
  nf_ms += ms;
  nf_us += ms * 1000UL;
}

/**
 * Implementação v0 de sleep.
 * 
 * Usa busy-wait com _delay_ms() que funciona perfeitamente no QEMU
 * porque depende apenas de F_CPU (16MHz), não de timers.
 * 
 * A cada 1ms de busy-wait, avança o clock virtual.
 * 
 * Limitações v0:
 * - Não permite pause/step do host
 * - CPU fica 100% ocupada durante delay
 * 
 * Vantagens v0:
 * - Funciona imediatamente no QEMU
 * - Não precisa modificar backend
 * - delay() e millis() ficam corretos
 */
void nf_sleep_ms(uint32_t ms) {
  while (ms > 0) {
    // _delay_ms() é um busy-wait baseado em F_CPU.
    // Funciona no QEMU AVR sem depender de timers.
    _delay_ms(1);
    
    // Avança o clock virtual em 1ms.
    nf_advance_ms(1);
    
    ms--;
  }
}
