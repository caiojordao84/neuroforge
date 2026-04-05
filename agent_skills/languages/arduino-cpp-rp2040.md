# Arduino C++ RP2040

> Code generation skill for Arduino C++ on Raspberry Pi RP2040

## Purpose

Generate optimized Arduino C++ code for Raspberry Pi RP2040 (and RP2350) microcontrollers.

## Board Compatibility

- **Family**: `rp2040-family`
- **Platform**: `arduino`
- **MCUs**: RP2040, RP2350

## Code Generation Rules

### Includes

```c
#include <Arduino.h>
```

### Pin Mapping

Use GPIO pin numbers (0-29):

```c
const uint LED_PIN = 25;  // Built-in LED
const uint BUTTON_PIN = 2;
```

### Multicore Support

```c
void setup() {
    // Main core setup
}

void loop() {
    // Main loop
}

// Second core
void setup1() {
    // Secondary core setup
}

void loop1() {
    // Secondary loop
}
```

### PIO (Programmable I/O)

For advanced timing-critical operations:

```c
#include <RP2040Pio.h>
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard GPIO usage | +0.0 |
| Using PIO for timing | +0.1 |
| Multicore parallel tasks | +0.05 |
| DMA for data transfer | +0.05 |

## Example Output

```c
#include <Arduino.h>

const uint LED_PIN = 25;
const uint BUTTON_PIN = 2;

void setup() {
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
}

void loop() {
    digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
    delay(10);
}
```

## Constraints

- 264KB SRAM (split across cores)
- PWM on all GPIO pins
- I2C: pins 4-5 (default) or any via PIO
- SPI: pins 0-3 (default)
