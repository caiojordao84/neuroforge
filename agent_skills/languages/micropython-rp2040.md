# MicroPython RP2040

> Code generation skill for MicroPython on Raspberry Pi RP2040

## Purpose

Generate optimized MicroPython code for Raspberry Pi RP2040 microcontrollers.

## Board Compatibility

- **Family**: `rp2040-family`
- **Platform**: `micropython`
- **MCUs**: RP2040, RP2350

## Code Generation Rules

### Pin Setup

```python
from machine import Pin, PWM, I2C, SPI

led = Pin(25, Pin.OUT)
button = Pin(2, Pin.IN, Pin.PULL_UP)
```

### PWM

```python
pwm = PWM(Pin(16))
pwm.freq(1000)
pwm.duty_u16(32768)  # 50% duty
```

### I2C

```python
i2c = I2C(0, scl=Pin(5), sda=Pin(4), freq=400000)
devices = i2c.scan()
```

### SPI

```python
spi = SPI(0, baudrate=1000000, polarity=0, phase=0, sck=Pin(2), mosi=Pin(3), miso=Pin(4))
```

### PIO (Programmable I/O)

```python
from machine import Pin, StateMachine
import time

# PIO for precise timing
sm = StateMachine(0, pin=Pin(16))
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard MicroPython APIs | +0.0 |
| Using RP2040-specific features | +0.1 |
| PIO programming | +0.15 |
| Multicore usage | +0.1 |

## Example Output

```python
from machine import Pin
import time

led = Pin(25, Pin.OUT)

while True:
    led.value(1)
    time.sleep_ms(500)
    led.value(0)
    time.sleep_ms(500)
```

## Constraints

- 264KB SRAM available
- Can use both cores via `_thread` module
- All GPIO supports PWM
- Flash mounted as USB drive