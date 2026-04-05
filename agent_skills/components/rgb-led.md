# RGB LED

> Code generation skill for RGB LED control (single, strip, Neopixel)

## Purpose

Generate code to control RGB LEDs, including single RGB, addressable LED strips (WS2812/Neopixel), and RGBW variants.

## Hardware

- **Component**: `rgb-led`
- **Types**: Common cathode/anode RGB, WS2812, SK6812, PL9823
- **Interface**: Digital PWM or 1-wire timing

## Code Generation Rules

### Single RGB (Arduino)

```c
const int RED_PIN = 9;
const int GREEN_PIN = 10;
const int BLUE_PIN = 11;

void setup() {
    pinMode(RED_PIN, OUTPUT);
    pinMode(GREEN_PIN, OUTPUT);
    pinMode(BLUE_PIN, OUTPUT);
}

void setColor(int r, int g, int b) {
    analogWrite(RED_PIN, r);
    analogWrite(GREEN_PIN, g);
    analogWrite(BLUE_PIN, b);
}

void loop() {
    setColor(255, 0, 0);  // Red
    delay(1000);
    setColor(0, 255, 0);  // Green
    delay(1000);
}
```

### Neopixel/WS2812 - Arduino

```c
#include <Adafruit_NeoPixel.h>

#define PIN 6
#define NUM_LEDS 8

Adafruit_NeoPixel strip(NUM_LEDS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
    strip.begin();
    strip.show();  // Initialize all to off
}

void loop() {
    for (int i = 0; i < NUM_LEDS; i++) {
        strip.setPixelColor(i, strip.Color(255, 0, 0));
        strip.show();
        delay(50);
    }
}
```

### Neopixel - MicroPython

```python
from machine import Pin
import neopixel

np = neopixel.NeoPixel(Pin(4), 8)

np[0] = (255, 0, 0)  # Red
np[1] = (0, 255, 0)  # Green
np.write()
```

### Neopixel - CircuitPython

```python
import neopixel
import board

pixels = neopixel.NeoPixel(board.D4, 8)
pixels[0] = (255, 0, 0)
pixels.show()
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct color order (GRB) | +0.0 |
| Proper timing for WS2812 | +0.1 |
| Brightness control | +0.05 |
| No show() after set | -0.15 |

## Example Output

```c
#include <Adafruit_NeoPixel.h>

Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);

void setup() {
    strip.begin();
}

void setLed(int index, uint8_t r, uint8_t g, uint8_t b) {
    strip.setPixelColor(index, strip.Color(r, g, b));
    strip.show();
}
```

## Constraints

- WS2812: 800kHz timing critical
- Current: 60mA per LED at full white
- Data must be latched (no reading back)

## Related Skills
- pwm-output
- arduino-cpp-rp2040