// Blink simples para testar QEMU
// Compila: arduino-cli compile --fqbn arduino:avr:uno blink

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
  Serial.println("Arduino iniciado!");
}

void loop() {
  Serial.println("LED ON");
  digitalWrite(13, HIGH);
  delay(1000);
  
  Serial.println("LED OFF");
  digitalWrite(13, LOW);
  delay(1000);
}
