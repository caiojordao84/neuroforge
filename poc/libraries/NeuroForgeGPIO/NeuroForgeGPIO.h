#pragma once

#include <Arduino.h>

// NeuroForgeGPIO - Helper library para reportar estado de GPIO
// via protocolo Serial "G:..." consumido pelo backend NeuroForge.
//
// Formatos suportados (v1.0):
//   G:pin=<num>,v=<0|1>\n
//   G:B=0xNN\n, G:C=0xNN\n, G:D=0xNN\n
//
// Esta implementacao e focada em placas AVR tipo Arduino Uno
// (ATmega328P), utilizando PORTB/PORTC/PORTD.

#ifdef __cplusplus
extern "C" {
#endif

void nfGPIO_begin();

// Reporta o valor atual de PORTB como frame textual "G:B=0xNN".
// Implementa cache simples: so envia se o valor mudou desde
// a ultima chamada.
void nfGPIO_reportPORTB();

// Idem para PORTC.
void nfGPIO_reportPORTC();

// Idem para PORTD.
void nfGPIO_reportPORTD();

// Reporta o estado de um pino logico (0/1) como
//   G:pin=<num>,v=<0|1>\n
// Nao faz cache por pino na versao inicial.
void nfGPIO_reportPin(uint8_t pin, uint8_t value);

#ifdef __cplusplus
}
#endif
