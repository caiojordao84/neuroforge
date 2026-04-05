# Arduino C++ STM32

> Code generation skill for Arduino C++ on STMicroelectronics STM32

## Purpose

Generate optimized Arduino C++ code for STM32 microcontrollers (F1, F4, L4, H7 series).

## Board Compatibility

- **Family**: `stm32-family`
- **Platform**: `arduino`
- **MCUs**: STM32F103, STM32F401, STM32F411, STM32L476, STM32H743

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use digital pin numbers or STM32 names:

```c
const int LED_PIN = PC13;  // Common built-in LED
const int BUTTON_PIN = PA0;
```

### Hardware Serial

```c
Serial1.begin(115200);  // TX=PA9, RX=PA10
Serial2.begin(115200);  // TX=PA2, RX=PA3
SerialUSB.begin(115200);
```

### STM32-specific APIs

```c
// Reset
NVIC_SystemReset();

// Unique ID
uint32_t id = HAL_GetID0();

// Flash
FLASH_EraseSector(0, VoltageRange_3);
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard Arduino APIs | +0.0 |
| Using STM32 HAL directly | +0.1 |
| Using LowPower library | +0.1 |
| Using STM32Duino-specific features | +0.05 |

## Example Output

```c
#include <Arduino.h>

const int LED_PIN = PC13;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
    Serial.println("STM32 Ready");
}

void loop() {
    digitalToggle(LED_PIN);
    delay(500);
}
```

## Constraints

- Pin naming varies by board (PB1, PC13, etc.)
- Some boards have limited PWM pins
- 3.3V logic only (not 5V tolerant on most)
- USB on specific pins only