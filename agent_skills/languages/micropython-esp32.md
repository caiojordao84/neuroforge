# MicroPython ESP32

> Code generation skill for MicroPython on Espressif ESP32

## Purpose

Generate optimized MicroPython code for ESP32 (dual-core Xtensa) microcontrollers.

## Board Compatibility

- **Family**: `esp32-family`
- **Platform**: `micropython`
- **MCUs**: ESP32 (ESP-WROOM-32), ESP32-S2, ESP32-S3

## Code Generation Rules

### Pin Setup

```python
from machine import Pin

led = Pin(2, Pin.OUT)
button = Pin(0, Pin.IN, Pin.PULL_UP)
```

### WiFi

```python
import network

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('SSID', 'password')
print(wlan.ifconfig())
```

### Bluetooth

```python
import bluetooth

# BLE functionality via bluetooth module
```

### Deep Sleep

```python
import machine

# Configure wake-up sources
machine.deepsleep(10000)  # 10 seconds
```

### ADC

```python
from machine import ADC

adc = ADC(Pin(34))
adc.atten(ADC.ATTEN_11DB)  # Full range 0-3.3V
value = adc.read()
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard MicroPython APIs | +0.0 |
| WiFi integration | +0.1 |
| Deep sleep with wake sources | +0.15 |
| ADC2 + WiFi conflict | -0.15 |

## Example Output

```python
import network
import time
from machine import Pin

led = Pin(2, Pin.OUT)

# WiFi connection
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect('MySSID', 'MyPassword')

while not wlan.isconnected():
    time.sleep(1)

print('Connected!')

while True:
    led.value(1)
    time.sleep(1)
    led.value(0)
    time.sleep(1)
```

## Constraints

- ADC2 unavailable while WiFi active
- Some pins used for flash (GPIO6-11)
- 3.3V logic only
- Limited to ~160KB usable RAM