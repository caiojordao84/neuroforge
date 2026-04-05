# Servo Motor

> Code generation skill for servo motor control

## Purpose

Generate code to control hobby servo motors (SG90, MG996R, etc.) via PWM.

## Hardware

- **Component**: `servo`
- **Signal**: PWM (typically 50Hz / 20ms period)
- **Pulse width**: 1ms (0°) to 2ms (180°)
- **Voltage**: 5V-6V (external supply recommended)

## Code Generation Rules

### Arduino (Servo Library)

```c
#include <Servo.h>

Servo myServo;
const int SERVO_PIN = 9;

void setup() {
    myServo.attach(SERVO_PIN, 544, 2400);  // min/max pulse
}

void loop() {
    myServo.write(90);  // 0-180 degrees
    delay(1000);
}
```

### MicroPython

```python
from machine import PWM, Pin
import time

servo = PWM(Pin(16))
servo.freq(50)

def angle_to_duty(angle):
    # 1ms to 2ms mapped to 0-180 degrees
    min_duty = 1638   # 1ms at 50Hz
    max_duty = 8192   # 2ms at 50Hz
    return int(min_duty + (max_duty - min_duty) * angle / 180)

while True:
    servo.duty_u16(angle_to_duty(0))
    time.sleep(1)
    servo.duty_u16(angle_to_duty(90))
    time.sleep(1)
```

### CircuitPython

```python
import pwmio
import board

servo = pwmio.PWMOut(board.GP16, frequency=50)
servo.duty_cycle = 3276  # ~1.5ms (middle)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Using proper 50Hz PWM | +0.0 |
| Correct pulse width range | +0.1 |
| External power supply | +0.05 |
| Blocking during movement | -0.05 |

## Example Output

```c
#include <Servo.h>

Servo myServo;

void setup() {
    myServo.attach(9);
}

void loop() {
    for (int angle = 0; angle <= 180; angle++) {
        myServo.write(angle);
        delay(15);
    }
}
```

## Related Skills
- arduino-cpp-generic
- micropython-rp2040
- pwm-output (implied)