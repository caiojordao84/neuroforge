# UART

> Code generation skill for UART/Serial communication

## Purpose

Generate code for UART serial communication between MCU and other devices (GPS, modem, second MCU, PC).

## Hardware

- **Component**: `uart`
- **Protocol**: UART (TX/RX)
- **Baud rates**: 9600, 115200, 460800, etc.

## Code Generation Rules

### Arduino (Hardware Serial)

```c
void setup() {
    Serial.begin(115200);
    Serial1.begin(9600);  // Second UART if available
}

void loop() {
    if (Serial.available()) {
        char c = Serial.read();
        Serial.print(c);  // Echo
    }
}
```

### Arduino (Software Serial)

```c
#include <SoftwareSerial.h>

SoftwareSerial mySerial(10, 11);  // RX, TX

void setup() {
    mySerial.begin(9600);
}

void loop() {
    if (mySerial.available()) {
        Serial.write(mySerial.read());
    }
}
```

### ESP32 - Arduino

```c
void setup() {
    Serial.begin(115200);
    Serial2.begin(115200, SERIAL_8N1, 16, 17);  // RX, TX pins
}
```

### MicroPython

```python
from machine import UART

uart = UART(1, 9600)
uart.write(b'Hello')
data = uart.read()
```

### CircuitPython

```python
import board
import busio

uart = busio.UART(board.TX, board.RX, baudrate=9600)

uart.write(b'Hello')
data = uart.read()
```

### Parse NMEA (GPS)

```c
void parseGPS() {
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        if (line.startsWith("$GPGGA")) {
            // Parse GGA sentence
        }
    }
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct baud rate | +0.0 |
| Proper pin assignment | +0.05 |
| Buffer overflow handling | +0.1 |
| No flow control | -0.05 |

## Example Output

```c
void setup() {
    Serial.begin(115200);
    Serial.println("UART Ready");
}

void sendData(const char* data) {
    Serial.println(data);
}
```

## Constraints

- TX/RX pins vary by board
- 3.3V logic on most MCUs
- Max cable length ~15m at low baud

## Related Skills
- arduino-cpp-generic
- micropython-rp2040