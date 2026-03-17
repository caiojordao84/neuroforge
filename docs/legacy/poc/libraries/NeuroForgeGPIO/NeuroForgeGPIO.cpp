#include "NeuroForgeGPIO.h"

// Caches simples para evitar frames redundantes de PORTx
static uint8_t nf_last_portb = 0;
static uint8_t nf_last_portc = 0;
static uint8_t nf_last_portd = 0;
static bool nf_initialized = false;

static void nfGPIO_sendPort(char portName, uint8_t value) {
  if (!Serial) {
    // Se Serial ainda nao foi inicializada, evita escrever.
    return;
  }

  Serial.print(F("G:"));
  Serial.print(portName);
  Serial.print(F("=0x"));
  if (value < 16) {
    Serial.print('0');
  }
  Serial.println(value, HEX);
}

void nfGPIO_begin() {
  // Inicializa caches com o estado atual dos registradores
  nf_last_portb = PORTB;
  nf_last_portc = PORTC;
  nf_last_portd = PORTD;
  nf_initialized = true;
}

void nfGPIO_reportPORTB() {
  if (!nf_initialized) {
    nfGPIO_begin();
  }

  uint8_t value = PORTB;
  if (value == nf_last_portb) {
    return; // sem mudanca
  }
  nf_last_portb = value;
  nfGPIO_sendPort('B', value);
}

void nfGPIO_reportPORTC() {
  if (!nf_initialized) {
    nfGPIO_begin();
  }

  uint8_t value = PORTC;
  if (value == nf_last_portc) {
    return;
  }
  nf_last_portc = value;
  nfGPIO_sendPort('C', value);
}

void nfGPIO_reportPORTD() {
  if (!nf_initialized) {
    nfGPIO_begin();
  }

  uint8_t value = PORTD;
  if (value == nf_last_portd) {
    return;
  }
  nf_last_portd = value;
  nfGPIO_sendPort('D', value);
}

void nfGPIO_reportPin(uint8_t pin, uint8_t value) {
  if (!Serial) {
    return;
  }

  uint8_t v = value ? 1 : 0;

  Serial.print(F("G:pin="));
  Serial.print(pin);
  Serial.print(F(",v="));
  Serial.println(v);
}
