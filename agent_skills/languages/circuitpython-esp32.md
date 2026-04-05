# CircuitPython ESP32

> Code generation skill for CircuitPython on Espressif ESP32

## Purpose

Generate optimized CircuitPython code for ESP32 (dual-core Xtensa) microcontrollers.

## Board Compatibility

- **Family**: `esp32-family`
- **Platform**: `circuitpython`
- **MCUs**: ESP32 (various ESP32-based boards)

## Code Generation Rules

### Digital I/O

```python
import board
import digitalio

led = digitalio.DigitalInOut(board.IO2)
led.direction = digitalio.Direction.OUTPUT
```

### WiFi

```python
import wifi
import socket

radio = wifi.radio
radio.connect(ssid='SSID', password='PASSWORD')
```

### BLE

```python
import bleio
# BLE HID, peripheral, central roles
```

### Deep Sleep

```python
import alarm
import time

time_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + 60)
alarm.exit_and_deep_sleep_until_alarms(time_alarm)
```

### Analog

```python
import analogio
import board

adc = analogio.AnalogIn(board.IO34)
value = adc.value
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard CircuitPython APIs | +0.0 |
| WiFi integration | +0.1 |
| Deep sleep with wake sources | +0.15 |
| BLE support | +0.1 |

## Example Output

```python
import board
import digitalio
import time

led = digitalio.DigitalInOut(board.IO2)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = True
    time.sleep(1)
    led.value = False
    time.sleep(1)
```

## Constraints

- ADC2 unavailable while WiFi active
- Some pins used for flash
- 3.3V logic only
- ~160KB usable RAM