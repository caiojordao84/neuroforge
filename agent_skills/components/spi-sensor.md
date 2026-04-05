# SPI Sensor

> Code generation skill for SPI sensor communication

## Purpose

Generate code to communicate with SPI sensors (MAX31855, ADXL345, LIS3DH, etc.).

## Hardware

- **Component**: `spi-sensor`
- **Protocol**: SPI (SCK, MISO, MOSI, CS)
- **Modes**: Mode 0-3 (CPOL/CPHA)
- **Speed**: Up to few MHz

## Code Generation Rules

### Arduino (SPITransaction)

```c
#include <SPI.h>

const int CS_PIN = 10;

void setup() {
    pinMode(CS_PIN, OUTPUT);
    digitalWrite(CS_PIN, HIGH);
    SPI.begin();
}

uint16_t readSensor() {
    digitalWrite(CS_PIN, LOW);
    SPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));
    uint16_t data = SPI.transfer16(0x0000);
    SPI.endTransaction();
    digitalWrite(CS_PIN, HIGH);
    return data;
}
```

### With Library

```c
#include <Adafruit_MAX31855.h>

Adafruit_MAX31855 thermo(SCK, MISO, CS);

void setup() {
    if (!thermo.begin()) {
        // Error
    }
}

double readTemp() {
    return thermo.readCelsius();
}
```

### MicroPython

```python
from machine import SPI, Pin

spi = SPI(0, baudrate=1000000, polarity=0, phase=0, 
          sck=Pin(2), mosi=Pin(3), miso=Pin(4))
cs = Pin(10, Pin.OUT)
cs.value(0)

data = spi.read(2)  # Read 2 bytes
cs.value(1)
```

### CircuitPython

```python
import board
import busio
import digitalio

spi = busio.SPI(board.SCK, board.MOSI, board.MISO)
cs = digitalio.DigitalInOut(board.D10)
cs.direction = digitalio.Direction.OUTPUT
cs.value = True

cs.value = False
data = spi.read(2)
cs.value = True
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct SPI mode | +0.0 |
| Proper CS handling | +0.1 |
| Transaction usage | +0.05 |
| Missing beginTransaction | -0.1 |

## Example Output

```c
#include <SPI.h>

const int CS = 10;

void setup() {
    SPI.begin();
    pinMode(CS, OUTPUT);
    digitalWrite(CS, HIGH);
}

uint32_t readData() {
    digitalWrite(CS, LOW);
    uint32_t result = SPI.transfer32(0);
    digitalWrite(CS, HIGH);
    return result;
}
```

## Constraints

- CS pin can be any GPIO
- Max speed depends on MCU/cable
- Mode must match device

## Related Skills
- spi-master
- micropython-rp2040
- circuitpython-esp32