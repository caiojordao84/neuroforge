# CircuitPython RP2040

> Code generation skill for CircuitPython on Raspberry Pi RP2040

## Purpose

Generate optimized CircuitPython code for Raspberry Pi RP2040 microcontrollers.

## Board Compatibility

- **Family**: `rp2040-family`
- **Platform**: `circuitpython`
- **MCUs**: RP2040 (Raspberry Pi Pico, Pico H, etc.)

## Code Generation Rules

### Digital I/O

```python
import board
import digitalio

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT
led.value = True
```

### Analog I/O

```python
import analogio
import board

adc = analogio.AnalogIn(board.A0)
value = adc.value  # 0-65535
```

### I2C

```python
import board
import busio

i2c = busio.I2C(board.SCL, board.SDA)
while not i2c.try_scan():
    pass
```

### SPI

```python
import busio
import board

spi = busio.SPI(board.SCK, board.MOSI, board.MISO)
```

### PWM

```python
import pwmio
import board

pwm = pwmio.PWMOut(board.GP16, frequency=1000, duty_cycle=32768)
```

### Neopixel/WS2812

```python
import neopixel
import board

pixels = neopixel.NeoPixel(board.GP0, 8)
pixels[0] = (255, 0, 0)
pixels.show()
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard CircuitPython APIs | +0.0 |
| Using board module pins | +0.1 |
| Neopixel/WS2812 LED control | +0.15 |
| USB HID integration | +0.1 |

## Example Output

```python
import board
import digitalio
import time

led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT

while True:
    led.value = True
    time.sleep(0.5)
    led.value = False
    time.sleep(0.5)
```

## Constraints

- ~264KB usable RAM
- CIRCUITPY drive visible as USB
- Requires .mpy modules for some libs
- All GPIO can do PWM