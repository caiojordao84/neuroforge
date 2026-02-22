// Test char array from string literal (FASE 1.4)
void setup() {
  Serial.begin(9600);
  char msg[] = "Hi";
  Serial.print("msg: ");
  Serial.println(msg);
  Serial.print("msg[0]: ");
  Serial.println(msg[0]);  // 72 = 'H'
  Serial.println("String OK!");
}

void loop() {}
