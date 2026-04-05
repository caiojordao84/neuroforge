# Arduino C++ ESP32

> Code generation skill for Arduino C++ on Espressif ESP32

## Purpose

Generate optimized Arduino C++ code for ESP32 (dual-core) microcontrollers.

## Board Compatibility

- **Family**: `esp32-family`
- **Platform**: `arduino`
- **MCUs**: ESP32 (ESP-WROOM-32), ESP32-S2, ESP32-S3, ESP32-C3

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use GPIO numbers (0-39 for ESP32):

```c
const int LED_PIN = 2;   // Built-in LED
const int BUTTON_PIN = 0;
```

### WiFi & Bluetooth

```c
#include <WiFi.h>
#include <BluetoothSerial.h>
```

### FreeRTOS Tasks

```c
void TaskCode(void *parameter) {
    for (;;) {
        // Task code
    }
}

void setup() {
    xTaskCreate(TaskCode, "Task", 4096, NULL, 1, NULL);
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard GPIO | +0.0 |
| Using ADC2 while WiFi on | -0.15 |
| Deep sleep with RTC peripherals | +0.1 |
| Bluetooth + WiFi concurrent | -0.1 |

## Example Output

```c
#include <Arduino.h>

const int LED_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
}

void loop() {
    Serial.println("Hello ESP32!");
    digitalWrite(LED_PIN, HIGH);
    delay(1000);
    digitalWrite(LED_PIN, LOW);
    delay(1000);
}
```

## Constraints

- ADC2 unavailable while WiFi active
- Some pins used for flash (GPIO6-11)
- 3.3V logic only
- Limited PWM pins
