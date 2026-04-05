# MicroPython ESP32-C3

> Code generation skill for MicroPython on Espressif ESP32-C3 (RISC-V)

## Purpose

Generate optimized MicroPython code for ESP32-C3 RISC-V microcontrollers.

## Board Compatibility

- **Family**: `esp32c3-family`
- **Platform**: `micropython`
- **MCUs**: ESP32-C3, ESP32-C3-MINI

## Code Generation Rules

### Pin Setup

```python
from machine import Pin

led = Pin(8, Pin.OUT)
button = Pin(9, Pin.IN, Pin.PULL_UP)
```

### RISC-V Specific

```python
# ESP32-C3 is single-core RISC-V
# Standard MicroPython works
```

### WiFi

```python
import network

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('SSID', 'password')
```

### USB CDC

```python
# USB serial available on compatible boards
import os
print(os.listwd())
```

### Limited RAM

```python
# Optimize for 4KB SRAM
# Use small data structures
# Avoid large buffers
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard MicroPython APIs | +0.0 |
| RISC-V specific features | +0.05 |
| USB CDC usage | +0.1 |
| Memory constraints | -0.1 |

## Example Output

```python
import time
from machine import Pin

led = Pin(8, Pin.OUT)

while True:
    led.value(1)
    time.sleep_ms(500)
    led.value(0)
    time.sleep_ms(500)
```

## Constraints

- Single core RISC-V
- Only ~4KB SRAM available
- USB OTG on some boards
- 3.3V logic only