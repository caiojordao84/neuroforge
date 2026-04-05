# Arduino C++ Generic

> Code generation skill for Arduino C++ on generic/unknown ARM boards

## Purpose

Generate compatible Arduino C++ code for generic ARM-based boards not covered by specific skills.

## Board Compatibility

- **Family**: `generic-arm-family`
- **Platform**: `arduino`
- **MCUs**: Various ARM Cortex-M based boards

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use generic pin numbers with fallback:

```c
const int LED_PIN = LED_BUILTIN;  // Safe fallback
const int BUTTON_PIN = 2;
```

### Generic Timing

```c
delay(ms);
delayMicroseconds(us);
unsigned long now = millis();
unsigned long us_now = micros();
```

### Generic Serial

```c
Serial.begin(115200);
Serial.print("Value: ");
Serial.println(value);
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Using LED_BUILTIN | +0.05 |
| Using standard Arduino APIs | +0.0 |
| Non-standard pin numbers | -0.1 |
| Unknown board constraints | -0.15 |

## Example Output

```c
#include <Arduino.h>

void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.begin(115200);
    Serial.println("Generic Arduino started");
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(500);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
}
```

## Constraints

- Assume 3.3V logic unless specified
- No board-specific optimizations
- Use standard delays and timeouts