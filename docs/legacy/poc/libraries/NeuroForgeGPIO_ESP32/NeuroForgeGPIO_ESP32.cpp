#include "NeuroForgeGPIO_ESP32.h"

void nfGPIO_esp32_begin(void) {
  // Versao inicial nao precisa de setup especifico.
  // Mantido para possivel uso futuro (caches, configuracao de Serial, etc.).
}

void nfGPIO_esp32_reportPin(int pin, int value) {
  if (!Serial) {
    return;
  }

  int v = value ? 1 : 0;

  Serial.print(F("G:pin="));
  Serial.print(pin);
  Serial.print(F(",v="));
  Serial.println(v);
}
