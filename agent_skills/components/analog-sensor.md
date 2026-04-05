# Analog Sensor

> Code generation skill for analog sensor reading

## Purpose

Generate code to read analog sensors (potentiometers, TMP36, photocells, etc.) via ADC.

## Hardware

- **Component**: `analog-sensor`
- **Interface**: ADC pin
- **Resolution**: 10-bit (Arduino), 12-bit (ESP32, STM32)

## Code Generation Rules

### Arduino

```c
const int ADC_PIN = A0;

void setup() {
    analogReadResolution(10);  // 10-bit default
}

void loop() {
    int raw = analogRead(ADC_PIN);
    float voltage = raw * (5.0 / 1023.0);
    delay(100);
}
```

### ESP32 (12-bit)

```c
const int ADC_PIN = 34;

void setup() {
    analogReadResolution(12);  // 12-bit: 0-4095
    analogSetAttenuation(ADC_11DB);  // 0-3.3V
}

void loop() {
    int raw = analogRead(ADC_PIN);
    float voltage = raw * (3.3 / 4095.0);
}
```

### MicroPython

```python
from machine import ADC, Pin

adc = ADC(Pin(34))
adc.atten(ADC.ATTN_11DB)  # 0-3.3V

while True:
    value = adc.read()
    voltage = value * 3.3 / 4095
    print(voltage)
```

### CircuitPython

```python
import analogio
import board

adc = analogio.AnalogIn(board.A0)

value = adc.value  # 0-65535 (16-bit)
voltage = value * 3.3 / 65535
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct ADC resolution | +0.0 |
| Voltage divider calculated | +0.1 |
| Proper attenuation | +0.1 |
| Averaging for noise | +0.05 |

## Example Output

```c
const int SENSOR_PIN = A0;

int readSensor() {
    return analogRead(SENSOR_PIN);
}

// For TMP36: temp = (voltage * 100) - 50
float readTemperature() {
    int raw = analogRead(SENSOR_PIN);
    float voltage = raw * (3.3 / 4096.0);
    return (voltage * 100) - 50;
}
```

## Constraints

- ADC reference varies by board
- ESP32: ADC2 unusable with WiFi
- Some sensors need conditioning

## Related Skills
- adc-input
- arduino-cpp-esp32