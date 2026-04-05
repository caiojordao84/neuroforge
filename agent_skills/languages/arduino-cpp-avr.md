# Arduino C++ AVR

> Code generation skill for Arduino C++ on AVR microcontrollers (ATmega, ATtiny)

## Purpose

Generate optimized Arduino C++ code for AVR-family microcontrollers (ATmega328P, ATmega2560, ATtiny85, etc.).

## Board Compatibility

- **Family**: `avr-family`
- **Platform**: `arduino`
- **MCUs**: ATmega328P, ATmega2560, ATmega16U2, ATtiny85, ATtiny84

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use digital pin numbers directly (D0-D13, A0-A5):

```c
#define LED_PIN 13
#define BUTTON_PIN 2
```

### Timing

```c
delay(ms);        // milliseconds
delayMicroseconds(us); // microseconds
```

### Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard AVR pins | +0.0 |
| Using analog pins as digital | -0.05 |
| I2C/SPI on non-standard pins | -0.1 |
| PWM on non-PWM pins | -0.1 |

## Example Output

```c
#include <Arduino.h>

const int LED_PIN = 13;
const int BUTTON_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    if (digitalRead(BUTTON_PIN) == LOW) {
        digitalWrite(LED_PIN, HIGH);
    } else {
        digitalWrite(LED_PIN, LOW);
    }
    delay(100);
}
```

## Constraints

- No hardware PWM on all pins (only specific pins support PWM)
- Limited RAM (2KB for ATmega328P)
- Watchdog timer available but limited options
