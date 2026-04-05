# Button Input

> Code generation skill for digital button/switch input

## Purpose

Generate code to read digital button inputs with debouncing and optional pull-up/pull-down configuration.

## Hardware

- **Component**: `button-input`
- **Types**: Tactile button, toggle switch, limit switch
- **Configuration**: Pull-up (default), Pull-down, External

## Code Generation Rules

### Basic Button (Arduino)

```c
const int BUTTON_PIN = 2;

void setup() {
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    if (digitalRead(BUTTON_PIN) == LOW) {
        // Button pressed
    }
}
```

### With Debounce (Arduino)

```c
#include <Bounce2.h>

#define BUTTON_PIN 2
Bounce debouncedButton = Bounce();

void setup() {
    debouncedButton.attach(BUTTON_PIN, INPUT_PULLUP);
    debouncedButton.interval(10);
}

void loop() {
    debouncedButton.update();
    if (debouncedButton.fell()) {
        // Button pressed
    }
    if (debouncedButton.rose()) {
        // Button released
    }
}
```

### Multiple Buttons

```c
const int BUTTONS[] = {2, 3, 4};
const int NUM_BUTTONS = 3;

void setup() {
    for (int i = 0; i < NUM_BUTTONS; i++) {
        pinMode(BUTTONS[i], INPUT_PULLUP);
    }
}
```

### MicroPython

```python
from machine import Pin
import time

button = Pin(2, Pin.IN, Pin.PULL_UP)

while True:
    if button.value() == 0:
        print("Pressed!")
    time.sleep_ms(10)
```

### CircuitPython

```python
import digitalio
import board
import time

button = digitalio.DigitalInOut(board.D2)
button.direction = digitalio.Direction.INPUT
button.pull = digitalio.Pull.UP

while True:
    if not button.value:
        print("Pressed!")
    time.sleep(0.01)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Pull resistor configured | +0.0 |
| Debounce implemented | +0.1 |
| Edge detection | +0.05 |
| No debounce (bouncy) | -0.15 |

## Example Output

```c
#include <Bounce2.h>

Bounce btn;

void setup() {
    btn.attach(2, INPUT_PULLUP);
    btn.interval(10);
}

void loop() {
    btn.update();
    if (btn.fell()) {
        // Action on press
    }
}
```

## Constraints

- Mechanical bounce: 50-100ms typical
- Use INPUT_PULLUP for simple wiring

## Related Skills
- arduino-cpp-generic
- digital-input