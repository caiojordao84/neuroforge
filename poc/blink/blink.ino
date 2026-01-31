// blink.ino - LED no pino 13 (PORTB bit 5)
// Teste básico para validar QEMU Arduino Uno

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
