# MicroPython STM32

> Code generation skill for MicroPython on STMicroelectronics STM32

## Purpose

Generate optimized MicroPython code for STM32 microcontrollers.

## Board Compatibility

- **Family**: `stm32-family`
- **Platform**: `micropython`
- **MCUs**: STM32F401, STM32F411, STM32L476, various STM32 boards

## Code Generation Rules

### Pin Setup

```python
from machine import Pin

led = Pin('PC13', Pin.OUT)
button = Pin('PA0', Pin.IN, Pin.PULL_UP)
```

### UART

```python
from machine import UART

uart = UART(1, 9600)
uart.write('Hello')
data = uart.read()
```

### I2C

```python
from machine import I2C

i2c = I2C(1, scl=Pin('PB6'), sda=Pin('PB7'), freq=400000)
devices = i2c.scan()
```

### ADC

```python
from machine import ADC

adc = ADC('PA0')
value = adc.read()  # 0-4095 for 12-bit ADC
```

### USB (VCP)

```python
# USB virtual COM port available on most STM32
# Use pyb.USB_VCP() on older ports, or machine.USBCDC()
import machine

cdc = machine.USBCDC()
cdc.write(b'Hello\n')
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard MicroPython APIs | +0.0 |
| Using pyb module (older ports) | -0.05 |
| USB VCP integration | +0.1 |
| Low power modes | +0.1 |

## Example Output

```python
from machine import Pin
import time

led = Pin('PC13', Pin.OUT)

while True:
    led.value(1)
    time.sleep_ms(500)
    led.value(0)
    time.sleep_ms(500)
```

## Constraints

- Pin names vary by board
- 3.3V logic only (most models)
- USB on specific pins
- Various RAM sizes by board