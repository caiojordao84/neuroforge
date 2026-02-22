// Test PROGMEM (FASE 1.6)
void setup() {
  Serial.begin(9600);
  const int data[] PROGMEM = {100, 200, 300};
  Serial.print("data[1]: ");
  Serial.println(data[1]);
  Serial.println("PROGMEM OK!");
}

void loop() {}
