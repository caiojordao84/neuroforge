// serial_test.ino - Teste de Serial Monitor com QEMU
// Valida UART output e timing

void setup() {
  Serial.begin(9600);
  Serial.println("=== NeuroForge QEMU Test ===");
  Serial.println("Initializing...");
  pinMode(13, OUTPUT);
  Serial.println("Setup complete!");
}

void loop() {
  static int count = 0;
  
  digitalWrite(13, HIGH);
  Serial.print("[Cycle ");
  Serial.print(count);
  Serial.println("] LED ON");
  delay(1000);
  
  digitalWrite(13, LOW);
  Serial.print("[Cycle ");
  Serial.print(count);
  Serial.println("] LED OFF");
  delay(1000);
  
  count++;
}
