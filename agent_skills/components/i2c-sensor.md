# I2C Sensor

> Code generation skill for I2C sensor communication

## Purpose

Generate code to read data from I2C sensors (BME280, MPU6050, BMP180, etc.).

## Hardware

- **Component**: `i2c-sensor`
- **Protocol**: I2C (SCL/SDA)
- **Speed**: Standard (100kHz), Fast (400kHz), Fast Mode Plus (1MHz)

## Code Generation Rules

### Arduino (Wire Library)

```c
#include <Wire.h>

const int I2C_ADDR = 0x76;

void setup() {
    Wire.begin();
    Wire.beginTransmission(I2C_ADDR);
    Wire.write(0xF2);  // Control humidity
    Wire.write(0x01);
    Wire.endTransmission();
}

void loop() {
    Wire.requestFrom(I2C_ADDR, 2);
    if (Wire.available()) {
        uint8_t hum_hi = Wire.read();
        uint8_t hum_lo = Wire.read();
    }
    delay(100);
}
```

### With Library

```c
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;

void setup() {
    bme.begin(0x76);
}

float readTemperature() {
    return bme.readTemperature();
}
```

### MicroPython

```python
from machine import I2C, Pin

i2c = I2C(0, scl=Pin(5), sda=Pin(4), freq=400000)

# Scan for devices
devices = i2c.scan()
print(f"Found: {devices}")

# Read register
data = i2c.readfrom_mem(0x76, 0xF2, 2)
```

### CircuitPython

```python
import board
import busio

i2c = busio.I2C(board.SCL, board.SDA)

while not i2c.try_scan():
    pass

# Use library
import adafruit_bme280
sensor = adafruit_bme280.Adafruit_I2C(i2c, address=0x76)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct I2C address | +0.0 |
| Proper initialization | +0.1 |
| Pull-ups present | +0.05 |
| No address conflict check | -0.1 |

## Example Output

```c
#include <Wire.h>

#define SENSOR_ADDR 0x68

void setup() {
    Wire.begin();
    Wire.beginTransmission(SENSOR_ADDR);
    Wire.write(0x6B);  // Power management
    Wire.write(0);     // Wake up
    Wire.endTransmission();
}
```

## Constraints

- I2C pins fixed on most MCUs
- 4.7kΩ pull-ups typical
- Max cable length ~1m

## Related Skills
- i2c-master
- micropython-rp2040
- circuitpython-esp32