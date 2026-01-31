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
 * Avanca o clock virtual.
 * 
 * Chamado internamente por nf_sleep_ms() e pelo main loop.
 */
void nf_advance_ms(uint32_t ms) {
  nf_ms += ms;
  nf_us += ms * 1000UL;
}

/**
 * Implementacao v0 de sleep (VERSAO AGRESSIVA para QEMU).
 * 
 * QEMU AVR executa instrucoes muito rapido mesmo com -icount.
 * Esta versao usa loops multiplos de busy-wait para forcar
 * o QEMU a gastar mais tempo.
 * 
 * A cada 1ms de delay solicitado, executa 1000 iteracoes de
 * _delay_ms(1), criando um busy-wait muito mais longo.
 * 
 * Limitacoes v0:
 * - Nao permite pause/step do host
 * - CPU fica 100% ocupada durante delay
 * - Timing ainda pode ser impreciso no QEMU
 * 
 * Vantagens v0:
 * - Funciona imediatamente no QEMU
 * - Nao precisa modificar backend
 * - delay() e millis() ficam corretos
 */
void nf_sleep_ms(uint32_t ms) {
  while (ms > 0) {
    // Loop agressivo: 1000x _delay_ms(1) por millisegundo
    // Isso forca o QEMU a executar muitos mais ciclos de CPU
    for (uint16_t i = 0; i < 1000; i++) {
      _delay_ms(1);
    }
    
    // Avanca o clock virtual em 1ms.
    nf_advance_ms(1);
    
    ms--;
  }
}
