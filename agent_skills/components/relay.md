# Relay

> Code generation skill for relay control

## Purpose

Generate code to control electromagnetic relays or solid-state relays (SSR).

## Hardware

- **Component**: `relay`
- **Types**: SPST, SPDT, 5V module, SSR
- **Interface**: Digital output (LOW=off, HIGH=on)

## Code Generation Rules

### Basic Relay Control (Arduino)

```c
const int RELAY_PIN = 7;

void setup() {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);  // Start off
}

void loop() {
    digitalWrite(RELAY_PIN, HIGH);  // Energize relay
    delay(1000);
    digitalWrite(RELAY_PIN, LOW);  // De-energize
    delay(1000);
}
```

### With Feedback (Sense Pin)

```c
const int RELAY_PIN = 7;
const int FEEDBACK_PIN = 8;

void setup() {
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(FEEDBACK_PIN, INPUT_PULLUP);
}

bool isRelayOn() {
    return digitalRead(FEEDBACK_PIN) == LOW;
}
```

### MicroPython

```python
from machine import Pin

relay = Pin(7, Pin.OUT)
relay.value(0)  # Off

# Turn on
relay.value(1)
# Turn off
relay.value(0)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Proper pin mode | +0.0 |
| Flyback diode consideration | +0.1 |
| SSR with zero-crossing | +0.1 |
| Contact rating not specified | -0.1 |

## Example Output

```c
const int RELAY_PIN = 7;

void setup() {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
}

void controlRelay(bool state) {
    digitalWrite(RELAY_PIN, state ? HIGH : LOW);
}
```

## Constraints

- Mechanical relay: flyback diode needed (module has it)
- SSR: requires zero-crossing for AC loads
- Current rating: typically 10A @ 250VAC

## Related Skills
- arduino-cpp-generic
- micropython-rp2040
- digital-output