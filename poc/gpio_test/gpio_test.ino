// gpio_test.ino - Teste completo de GPIOs
// Valida múltiplos pinos e PWM

void setup() {
  Serial.begin(9600);
  Serial.println("GPIO Test Starting...");
  
  // Digital pins
  pinMode(8, OUTPUT);   // PORTB bit 0
  pinMode(9, OUTPUT);   // PORTB bit 1
  pinMode(10, OUTPUT);  // PORTB bit 2
  pinMode(11, OUTPUT);  // PORTB bit 3
  pinMode(12, OUTPUT);  // PORTB bit 4
  pinMode(13, OUTPUT);  // PORTB bit 5
  
  Serial.println("Setup complete!");
}

void loop() {
  // Sequencial blink em todos os pinos
  for (int pin = 8; pin <= 13; pin++) {
    digitalWrite(pin, HIGH);
    Serial.print("Pin ");
    Serial.print(pin);
    Serial.println(" HIGH");
    delay(200);
    digitalWrite(pin, LOW);
  }
  
  delay(500);
  
  // Todos ON
  for (int pin = 8; pin <= 13; pin++) {
    digitalWrite(pin, HIGH);
  }
  Serial.println("All pins HIGH");
  delay(1000);
  
  // Todos OFF
  for (int pin = 8; pin <= 13; pin++) {
    digitalWrite(pin, LOW);
  }
  Serial.println("All pins LOW");
  delay(1000);
}
