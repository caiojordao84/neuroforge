// serial_test.ino - Teste de Serial sem delay()
// Valida se o loop roda varias vezes no QEMU

void setup() {
  Serial.begin(9600);
  Serial.println("=== NeuroForge QEMU Test (no delay) ===");
  Serial.println("Initializing...");
  pinMode(13, OUTPUT);
  Serial.println("Setup complete!");
}

void loop() {
  static unsigned long counter = 0;

  // Toggle LED a cada N iteracoes
  if (counter % 100000UL == 0) {
    digitalWrite(13, HIGH);
    Serial.print("[Cycle ");
    Serial.print(counter / 100000UL);
    Serial.println("] LED ON");
  } else if (counter % 100000UL == 50000UL) {
    digitalWrite(13, LOW);
    Serial.print("[Cycle ");
    Serial.print(counter / 100000UL);
    Serial.println("] LED OFF");
  }

  counter++;
}
