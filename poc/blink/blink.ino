void setup() {
  pinMode(13, OUTPUT); // ou LED_BUILTIN se preferir
  Serial.begin(9600);  // importante para habilitar a Serial
}

void loop() {
  digitalWrite(13, HIGH);
  Serial.println("G:pin=13,v=1"); // frame GPIO para o backend
  delay(500);

  digitalWrite(13, LOW);
  Serial.println("G:pin=13,v=0"); // frame GPIO para o backend
  delay(500);
}
