#pragma once

#include <Arduino.h>

// NeuroForgeGPIO_ESP32 - Helper library para reportar estado de GPIO
// em boards ESP32 via protocolo Serial "G:..." consumido pelo backend
// NeuroForge. Mantem a mesma ideia da versao AVR, mas sem assumir
// nenhum layout especifico de board (DevKitC, S3 UNO, etc.).
//
// Formato base (obrigatorio):
//   G:pin=<num>,v=<0|1>\n
//
// A semantica de cada GPIO (LED onboard, USB, flash, etc.) e derivada
// dos JSONs de board que seguem board-schema.json, nao desta biblioteca.

#ifdef __cplusplus
extern "C" {
#endif

// Inicializacao (reservado para estado futuro, se necessario)
void nfGPIO_esp32_begin(void);

// Reporta o estado logico de um GPIO (0/1) como frame textual
//   G:pin=<num>,v=<0|1>\n
// Nao faz cache por pino na versao inicial.
void nfGPIO_esp32_reportPin(int pin, int value);

#ifdef __cplusplus
}
#endif

// Aliases genericos para manter o mesmo contrato conceitual da versao AVR
#ifdef __cplusplus
inline void nfGPIO_begin() {
  nfGPIO_esp32_begin();
}

inline void nfGPIO_reportPin(uint8_t pin, uint8_t value) {
  nfGPIO_esp32_reportPin(static_cast<int>(pin), static_cast<int>(value));
}
#endif
