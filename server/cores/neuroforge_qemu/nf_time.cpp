/**
 * NeuroForge Time - Core Implementation
 *
 * Implementacao v0: Clock virtual mantido dentro do firmware
 *
 * Usa _delay_ms() de <util/delay.h> que funciona no QEMU AVR porque
 * e baseado apenas em F_CPU (ciclos de CPU), nao em timers.
 *
 * Esta implementacao garante que delay() e millis() funcionem
 * corretamente no QEMU sem depender de Timer0/Timer1.
 */

#include "nf_time.h"
#include <util/delay.h>

// Estado do clock virtual da simulacao
static volatile uint32_t nf_ms = 0;
static volatile uint32_t nf_us = 0;

// Multiplicador de timing para QEMU
// Ajuste este valor se o timing estiver muito rapido ou lento:
// - Valores maiores = mais lento (mais ciclos de CPU)
// - Valores menores = mais rapido (menos ciclos de CPU)
// - Valor recomendado: 50 (testado no QEMU AVR para sincronia host real-time)
#define QEMU_TIMING_MULTIPLIER 50

/**
 * Retorna o tempo atual em milissegundos.
 */
uint32_t nf_now_ms(void) { return nf_ms; }

/**
 * Retorna o tempo atual em microssegundos.
 */
uint32_t nf_now_us(void) { return nf_us; }

/**
 * Avanca o clock virtual.
 *
 * Chamado internamente por nf_sleep_ms() e pelo main loop.
 */
void nf_advance_ms(uint32_t ms) {
  nf_ms += ms;
  nf_us += ms * 1000UL;
}

/**
 * Implementacao v0 de sleep para QEMU.
 *
 * QEMU AVR executa instrucoes muito rapido. Esta versao usa
 * um multiplicador para ajustar o timing.
 *
 * Cada 1ms de delay solicitado executa QEMU_TIMING_MULTIPLIER
 * iteracoes de _delay_ms(1), criando um busy-wait ajustavel.
 *
 * Limitacoes v0:
 * - Nao permite pause/step do host
 * - CPU fica 100% ocupada durante delay
 * - Timing pode variar entre diferentes maquinas
 *
 * Vantagens v0:
 * - Funciona imediatamente no QEMU
 * - Nao precisa modificar backend
 * - delay() e millis() ficam corretos
 * - Timing ajustavel via QEMU_TIMING_MULTIPLIER
 */
void nf_sleep_ms(uint32_t ms) {
  while (ms > 0) {
    // Loop ajustavel: QEMU_TIMING_MULTIPLIER x _delay_ms(1) por millisegundo
    for (uint32_t i = 0; i < QEMU_TIMING_MULTIPLIER; i++) {
      _delay_ms(1);
    }

    // Avanca o clock virtual em 1ms.
    nf_advance_ms(1);

    ms--;
  }
}
