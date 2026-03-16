// Button + Potentiometer Blink Control (C++)
// Button on D2, LED on D3 (PWM), Potentiometer on A0

const int BUTTON_PIN = 2;
const int LED_PIN = 3;
const int POT_PIN = A0;

bool blinkMode = false; // false = LED aceso, true = pisca
bool lastButtonState = HIGH;

unsigned long lastBlinkTime = 0;
bool ledOutputState = false;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Blink + Pot Test Started");
}

void loop() {
  // 1. Button Toggle Logic
  bool currentButtonState = digitalRead(BUTTON_PIN);
  if (currentButtonState == LOW && lastButtonState == HIGH) {
    blinkMode = !blinkMode;
    Serial.println(blinkMode ? "Blink Mode Enabled" : "Blink Mode Disabled");
  }
  lastButtonState = currentButtonState;

  // 2. LED Behavior
  if (!blinkMode) {
    // --- LED ACESO FIXO ---
    digitalWrite(LED_PIN, HIGH);
  } else {
    // --- LED PISCANDO COM VELOCIDADE DO POTENCIÔMETRO ---

    int potValue = analogRead(POT_PIN);

    // Pot 0% → 200 ms (5 Hz)
    // Pot 100% → 2000 ms (0.5 Hz)
    int periodo = map(potValue, 0, 1023, 200, 2000);
    int halfPeriod = periodo / 2;

    unsigned long now = millis();

    if (now - lastBlinkTime >= halfPeriod) {
      lastBlinkTime = now;
      ledOutputState = !ledOutputState;
      digitalWrite(LED_PIN, ledOutputState);
    }

    // Debug
    static int counter = 0;
    if (++counter > 50) {
      Serial.print("Pot: ");
      Serial.print(potValue);
      Serial.print(" | Periodo: ");
      Serial.print(periodo);
      Serial.print(" ms | LED: ");
      Serial.println(ledOutputState ? "ON" : "OFF");
      counter = 0;
    }
  }

  delay(5);
}
