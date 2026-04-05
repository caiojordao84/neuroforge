# Joystick

> Code generation skill for analog joystick input

## Purpose

Generate code to read analog joysticks (two axes + optional button) for game controllers or navigation.

## Hardware

- **Component**: `joystick`
- **Axes**: X (horizontal), Y (vertical), Z (button)
- **Output**: 0-1023 or 0-4095 per axis, center ~512/2048

## Code Generation Rules

### Basic Joystick (Arduino)

```c
const int X_PIN = A0;
const int Y_PIN = A1;
const int BUTTON_PIN = 2;

void setup() {
    pinMode(X_PIN, INPUT);
    pinMode(Y_PIN, INPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    int x = analogRead(X_PIN);
    int y = analogRead(Y_PIN);
    bool pressed = digitalRead(BUTTON_PIN) == LOW;
    
    Serial.print("X: ");
    Serial.print(x);
    Serial.print(" Y: ");
    Serial.println(y);
    
    delay(50);
}
```

### With Deadzone

```c
int readAxis(int pin) {
    int center = 512;  // For 10-bit ADC
    int deadzone = 20;
    int value = analogRead(pin);
    
    if (abs(value - center) < deadzone) {
        return 0;
    }
    return value - center;
}
```

### MicroPython

```python
from machine import ADC, Pin

x_axis = ADC(Pin(34))
y_axis = ADC(Pin(35))
button = Pin(0, Pin.IN, Pin.PULL_UP)

while True:
    x = x_axis.read()
    y = y_axis.read()
    pressed = not button.value()
    print(f"X: {x}, Y: {y}, Pressed: {pressed}")
```

### CircuitPython

```python
import analogio
import digitalio
import board

x_axis = analogio.AnalogIn(board.A0)
y_axis = analogio.AnalogIn(board.A1)
button = digitalio.DigitalInOut(board.D2)
button.direction = digitalio.Direction.INPUT
button.pull = digitalio.Pull.UP

while True:
    x = x_axis.value
    y = y_axis.value
    pressed = not button.value
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Center calibration | +0.0 |
| Deadzone handling | +0.1 |
| Button pull-up | +0.05 |
| No smoothing | -0.05 |

## Example Output

```c
int readJoystickX() {
    return analogRead(A0);
}

int readJoystickY() {
    return analogRead(A1);
}

bool isPressed() {
    return digitalRead(2) == LOW;
}
```

## Constraints

- 10-bit: 0-1023
- 12-bit: 0-4095
- Center ~512 or ~2048

## Related Skills
- analog-sensor
- button-input