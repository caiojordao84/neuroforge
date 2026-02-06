
extern "C" void __digitalWrite(uint8_t pin, uint8_t val);

void digitalWrite(uint8_t pin, uint8_t val) {
  __digitalWrite(pin, val);
  Serial.printf("G:pin=%d,v=%d\n", pin, val);
}

void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  delay(100);
  digitalWrite(2, LOW);
  delay(100);
}
