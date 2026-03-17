#include <NeuroForgeGPIO.h>

// Define o pino do LED
const int ledPin = 13;

void setup() {
  Serial.begin(9600);
  nfGPIO_begin(); // inicializa caches dos PORTx

  pinMode(ledPin, OUTPUT);

  Serial.println("--- Sistema de Pisca LED Iniciado ---");
}

void loop() {
  // Liga o LED
  digitalWrite(ledPin, HIGH);
  nfGPIO_reportPin(ledPin, 1); // G:pin=13,v=1
  nfGPIO_reportPORTB();        // opcional: G:B=0x20 se só o bit 5 estiver HIGH
  Serial.println("Status: LED LIGADO");
  for (volatile uint32_t i = 0; i < 100000UL; i++) {
  }

  // Desliga o LED
  digitalWrite(ledPin, LOW);
  nfGPIO_reportPin(ledPin, 0); // G:pin=13,v=0
  nfGPIO_reportPORTB();        // G:B=0x00
  Serial.println("Status: LED DESLIGADO");
  for (volatile uint32_t i = 0; i < 100000UL; i++) {
  }
}
