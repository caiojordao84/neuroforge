# Generic Component

> Code generation skill for generic/unknown components

## Purpose

Generate fallback code for components not covered by specific skills. Uses standard patterns that work broadly.

## Target Platforms

- **Component**: `generic-component`
- **Usage**: Unknown sensors, custom hardware, fallback

## Code Generation Rules

### Generic Digital Input

```c
const int PIN = 2;

void setup() {
    pinMode(PIN, INPUT);  // Or INPUT_PULLUP
}

bool readPin() {
    return digitalRead(PIN) == HIGH;
}
```

### Generic Digital Output

```c
const int PIN = 13;

void setup() {
    pinMode(PIN, OUTPUT);
}

void setPin(bool state) {
    digitalWrite(PIN, state ? HIGH : LOW);
}
```

### Generic PWM Output

```c
const int PWM_PIN = 9;

void setup() {
    pinMode(PWM_PIN, OUTPUT);
}

void setPWM(int value) {
    analogWrite(PWM_PIN, value);  // 0-255
}
```

### Generic ADC Read

```c
const int ADC_PIN = A0;

void setup() {}

int readADC() {
    return analogRead(ADC_PIN);
}
```

### Generic I2C Read

```c
#include <Wire.h>

#define I2C_ADDR 0x68

void setup() {
    Wire.begin();
}

uint8_t readRegister(uint8_t reg) {
    Wire.beginTransmission(I2C_ADDR);
    Wire.write(reg);
    Wire.endTransmission();
    Wire.requestFrom(I2C_ADDR, 1);
    return Wire.read();
}
```

### Generic UART Write

```c
void setup() {
    Serial.begin(115200);
}

void sendData(const char* data) {
    Serial.println(data);
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Using standard APIs | +0.0 |
| No pull-up specified | -0.1 |
| No error handling | -0.1 |
| Generic timing | -0.05 |

## Example Output

```c
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    Serial.begin(115200);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(500);
    digitalWrite(LED_BUILTIN, LOW);
    delay(500);
}
```

## Constraints

- No platform-specific optimizations
- May need refinement for specific hardware
- Uses most common/default patterns

## Related Skills
- arduino-cpp-generic
- micropython-rp2040