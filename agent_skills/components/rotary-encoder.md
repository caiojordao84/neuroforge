# Rotary Encoder

> Code generation skill for rotary encoder input (quadrature)

## Purpose

Generate code to read rotary/quadrature encoders for knob input, motor position tracking, or menu navigation.

## Hardware

- **Component**: `rotary-encoder`
- **Types**: Mechanical (KY-040), Optical, Hall-effect
- **Output**: Quadrature (A/B phases)

## Code Generation Rules

### Basic Encoder (Arduino)

```c
#define ENC_A 2
#define ENC_B 3

volatile int counter = 0;
volatile boolean change = false;

void setup() {
    pinMode(ENC_A, INPUT_PULLUP);
    pinMode(ENC_B, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(ENC_A), encoderISR, CHANGE);
}

void encoderISR() {
    if (digitalRead(ENC_A) == digitalRead(ENC_B)) {
        counter++;
    } else {
        counter--;
    }
    change = true;
}

void loop() {
    if (change) {
        Serial.println(counter);
        change = false;
    }
}
```

### With Library (Encoder.h)

```c
#include <Encoder.h>

Encoder myEnc(2, 3);

void setup() {
    Serial.begin(115200);
}

void loop() {
    long newPosition = myEnc.read();
    if (newPosition != 0) {
        Serial.println(newPosition);
    }
}
```

### ESP32 (PCNT)

```c
#include "driver/pcnt.h"

void setup() {
    pcnt_config_t pcnt_config = {
        .pulse_gpio_num = 2,
        .ctrl_gpio_num = 3,
        .lctrl_mode = PCNT_MODE_KEEP,
        .hctrl_mode = PCNT_MODE_KEEP,
        .pos_mode = PCNT_COUNT_INC,
        .neg_mode = PCNT_COUNT_DEC,
        .counter_h_lim = 100,
        .counter_l_lim = -100,
    };
    pcnt_unit_config(&pcnt_config);
    pcnt_counter_clear(PCNT_UNIT_0);
    pcnt_intr_enable(PCNT_UNIT_0);
}
```

### MicroPython

```c
from machine import Pin
import machine

last_a = 1
last_b = 1
counter = 0

pin_a = Pin(2, Pin.IN, Pin.PULL_UP)
pin_b = Pin(3, Pin.IN, Pin.PULL_UP)

def encoder_callback(p):
    global counter, last_a, last_b
    a = pin_a.value()
    b = pin_b.value()
    if a != last_a:
        if a == b:
            counter += 1
        else:
            counter -= 1
        last_a = a

pin_a.irq(trigger=Pin.IRQ_FALLING, handler=encoder_callback)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Proper quadrature logic | +0.0 |
| Using interrupt/pcnt | +0.1 |
| Edge vs level detection | +0.05 |
| No glitch filtering | -0.1 |

## Example Output

```c
#include <Encoder.h>

Encoder enc(2, 3);

void setup() {}

void loop() {
    long pos = enc.read();
    // Use position
}
```

## Constraints

- Mechanical: 20-60 pulses per revolution
- 2-bit gray code pattern
- Debounce critical

## Related Skills
- arduino-cpp-esp32
- button-input