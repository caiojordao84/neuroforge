/**
 * NeuroForge Time - Unified Timing System
 * 
 * Clock virtual independente do hardware emulado.
 * Funciona em QEMU sem depender de Timer0/Timer1.
 * 
 * API comum para todas as linguagens:
 * - Arduino (C/C++)
 * - MicroPython
 * - Rust Embedded
 * - Bare-metal C
 * 
 * Implementação v0: Clock mantido dentro do firmware
 * Implementação v1: Clock vem do host (futuro)
 */

#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Obtém o tempo atual da simulação em milissegundos.
 * 
 * Equivalente a millis() do Arduino, mas funciona no QEMU.
 * 
 * @return Tempo em ms desde o início da simulação
 */
uint32_t nf_now_ms(void);

/**
 * Obtém o tempo atual da simulação em microssegundos.
 * 
 * Equivalente a micros() do Arduino, mas funciona no QEMU.
 * 
 * @return Tempo em µs desde o início da simulação
 */
uint32_t nf_now_us(void);

/**
 * Dorme por N milissegundos em tempo de simulação.
 * 
 * Implementação v0: Usa busy-wait com _delay_ms() + avança clock virtual
 * Implementação v1: Espera o host avançar o clock (futuro)
 * 
 * @param ms Número de milissegundos para dormir
 */
void nf_sleep_ms(uint32_t ms);

/**
 * Avança o clock virtual em N milissegundos.
 * 
 * Função interna usada pelo runtime.
 * Não chamar diretamente do código do usuário!
 * 
 * @param ms Número de milissegundos para avançar
 */
void nf_advance_ms(uint32_t ms);

#ifdef __cplusplus
}
#endif
