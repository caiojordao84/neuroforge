const int buttonPin = 2;     // the number of the pushbutton pin
const int ledPin =  13;      // the number of the LED pin

int buttonState = 0;         // variable for reading the pushbutton status
int lastButtonState = 0;     // variable for remembering the previous pushbutton status
bool ledState = false;       // variable for the LED state

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT);
}

void loop() {
  // read the pushbutton input pin:
  buttonState = digitalRead(buttonPin);

  // compare the buttonState to its previous state
  // if the buttonState is different from the lastButtonState, then the button has been pressed
  if (buttonState != lastButtonState) {
    // if the button was pressed (HIGH = 눌림, LOW = 안눌림)
    // Note: This assumes pull-down resistor. For pull-up, use buttonState == LOW
    if (buttonState == HIGH) {
      ledState = !ledState;
    }
    // delay a little bit to avoid debouncing
    delay(50);
  }
  // save the current state as the last state
  lastButtonState = buttonState;

  // set the LED
  digitalWrite(ledPin, ledState);
}
