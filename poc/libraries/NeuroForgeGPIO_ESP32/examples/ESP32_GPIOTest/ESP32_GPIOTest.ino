#include <NeuroForgeGPIO_ESP32.h>

// Exemplo basico de uso da NeuroForgeGPIO_ESP32
// Pisca um LED em um GPIO e reporta o estado via frames G:pin=...,v=...
//
// Nota: Muitos DevKit ESP32 usam o GPIO 2 como LED onboard, mas isso
// depende do modelo. O simulador/board JSON (board-schema.json) e que
// decide qual GPIO representa o LED visual.

const int ledPin = 2; // ajuste conforme a board real

void setup() {
  Serial.begin(115200);
  nfGPIO_begin();

  pinMode(ledPin, OUTPUT);
  Serial.println("--- ESP32 GPIO Test with NeuroForgeGPIO_ESP32 ---");
}

void loop() {
  // Liga o LED
  digitalWrite(ledPin, HIGH);
  nfGPIO_reportPin(ledPin, 1);
  Serial.println("Status: LED ON");
  for (volatile uint32_t i = 0; i < 200000UL; i++) {}

  // Desliga o LED
  digitalWrite(ledPin, LOW);
  nfGPIO_reportPin(ledPin, 0);
  Serial.println("Status: LED OFF");
  for (volatile uint32_t i = 0; i < 200000UL; i++) {}
}
