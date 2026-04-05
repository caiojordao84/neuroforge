# Stepper Motor

> Code generation skill for stepper motor control

## Purpose

Generate code to control stepper motors (NEMA 17, 28BYJ-48, etc.) via step/direction or full-step drivers.

## Hardware

- **Component**: `stepper-motor`
- **Drivers**: A4988, DRV8825, ULN2003, TMC2208
- **Interface**: Step/Dir pins or 4-wire control

## Code Generation Rules

### Arduino (Stepper Library)

```c
#include <Stepper.h>

const int STEPS = 200;  // NEMA 17 is 200 steps/rev
Stepper myStepper(STEPS, 2, 3, 4, 5);

void setup() {
    myStepper.setSpeed(60);  // RPM
}

void loop() {
    myStepper.step(200);  // One full revolution
    delay(1000);
}
```

### Arduino (AccelStepper)

```c
#include <AccelStepper.h>

AccelStepper stepper(AccelStepper::FULL2WIRE, 2, 3);

void setup() {
    stepper.setMaxSpeed(1000);
    stepper.setAcceleration(500);
    stepper.moveTo(200);
}

void loop() {
    stepper.run();
}
```

### MicroPython (ULN2003)

```python
from machine import Pin
import time

# IN1-IN4 on ULN2003
in1 = Pin(10, Pin.OUT)
in2 = Pin(11, Pin.OUT)
in3 = Pin(12, Pin.OUT)
in4 = Pin(13, Pin.OUT)

step_sequence = [
    [1,0,0,0], [1,1,0,0], [0,1,0,0], [0,1,1,0],
    [0,0,1,0], [0,0,1,1], [0,0,0,1], [1,0,0,1]
]

def move_stepper(steps):
    for _ in range(steps):
        for step in step_sequence:
            in1.value(step[0])
            in2.value(step[1])
            in3.value(step[2])
            in4.value(step[3])
            time.sleep_ms(2)

move_stepper(512)  # Half revolution for 28BYJ-48
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Proper step/dir timing | +0.0 |
| Acceleration/deceleration | +0.15 |
| Microstepping configured | +0.1 |
| Blocking delays | -0.05 |

## Example Output

```c
#include <AccelStepper.h>

AccelStepper stepper(AccelStepper::FULL2WIRE, 2, 3);

void setup() {
    stepper.setMaxSpeed(1000);
    stepper.setAcceleration(500);
}

void loop() {
    if (stepper.distanceToGo() == 0) {
        stepper.moveTo(-stepper.currentPosition());
    }
    stepper.run();
}
```

## Related Skills
- arduino-cpp-generic
- micropython-rp2040
- pwm-output (implied for speed control)