import { codeToASL } from './src/engine/asl/codeToASL';

const code = `
const int BTN_ON  = 2;   // Botão para ligar o LED
const int BTN_OFF = 4;   // Botão para desligar o LED
const int LED_PIN = 13;

void setup() {
  pinMode(BTN_ON, INPUT_PULLUP);
  pinMode(BTN_OFF, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int btnOnState  = digitalRead(BTN_ON);
  int btnOffState = digitalRead(BTN_OFF);

  if (btnOnState == LOW) {
    digitalWrite(LED_PIN, HIGH);
  }
  else if (btnOffState == LOW) {
    digitalWrite(LED_PIN, LOW);
  }
  else {
    // ...
  }

  delay(50);
}
`;

try {
    const asl = codeToASL(code, 'cpp');
    console.log(JSON.stringify(asl, null, 2));
} catch (e) {
    console.error(e);
}
