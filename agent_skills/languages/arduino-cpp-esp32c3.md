# Arduino C++ ESP32-C3

> Code generation skill for Arduino C++ on Espressif ESP32-C3 (RISC-V)

## Purpose

Generate optimized Arduino C++ code for ESP32-C3 microcontrollers (RISC-V based, single-core).

## Board Compatibility

- **Family**: `esp32c3-family`
- **Platform**: `arduino`
- **MCUs**: ESP32-C3 (ESP32-C3-MINI, ESP32-C3-DevKit)

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use GPIO numbers (0-21 for ESP32-C3):

```c
const int LED_PIN = 8;   // Built-in LED (GPIO8 on most boards)
const int BUTTON_PIN = 9;
```

### RISC-V Specific

```c
// ESP32-C3 uses single core RISC-V
// No multicore support
void setup() {}

void loop() {}
```

### WiFi Support

```c
#include <WiFi.h>

void setup() {
    WiFi.mode(WIFI_STA);
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard GPIO usage | +0.0 |
| Using RISC-V specific features | +0.05 |
| USB CDC for serial | +0.1 |
| WiFi/BLE concurrent | -0.1 |

## Example Output

```c
#include <Arduino.h>

const int LED_PIN = 8;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
}

void loop() {
    Serial.println("Hello ESP32-C3!");
    digitalWrite(LED_PIN, HIGH);
    delay(1000);
    digitalWrite(LED_PIN, LOW);
    delay(1000);
}
```

## Constraints

- Single core RISC-V (no SMP)
- Limited to 4KB SRAM (tight memory constraints)
- USB OTG available on some boards
- 3.3V logic only