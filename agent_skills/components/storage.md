# Storage

> Code generation skill for non-volatile storage (EEPROM, SD card, Flash)

## Purpose

Generate code to store and retrieve data using EEPROM, SD cards, or internal Flash memory.

## Hardware

- **Component**: `storage`
- **Types**: EEPROM (internal/external), SD card, SPI Flash, LittleFS

## Code Generation Rules

### EEPROM (Arduino)

```c
#include <EEPROM.h>

const int ADDR = 0;

void saveValue(int address, int value) {
    EEPROM.write(address, value);
}

int readValue(int address) {
    return EEPROM.read(address);
}

void setup() {
    Serial.begin(115200);
    int saved = readValue(ADDR);
    Serial.print("Saved: ");
    Serial.println(saved);
    saveValue(ADDR, 42);
}
```

### SD Card (Arduino)

```c
#include <SD.h>
#include <SPI.h>

File myFile;

void setup() {
    if (!SD.begin(10)) {
        return;
    }
    myFile = SD.open("data.txt", FILE_WRITE);
    if (myFile) {
        myFile.println("Hello SD");
        myFile.close();
    }
}
```

### SPI Flash / LittleFS (ESP32)

```c
#include <LittleFS.h>

void setup() {
    LittleFS.begin(false);
    File file = LittleFS.open("/config.txt", "w");
    file.print("settings");
    file.close();
}
```

### MicroPython

```python
# Internal flash
with open('data.txt', 'w') as f:
    f.write('Hello')

# SD card (if hardware available)
import uos
uos.listdir('/sd')
```

### CircuitPython

```python
import storage
import os

# Mount filesystem
vfs = storage.VfsFat(sdcard)
storage.mount(vfs, '/sd')

# Read/write
with open('/sd/data.txt', 'w') as f:
    f.write('Hello')
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct filesystem mount | +0.0 |
| Error handling | +0.1 |
| Buffer management | +0.05 |
| Wear leveling not used | -0.1 |

## Example Output

```c
#include <EEPROM.h>

void saveConfig(int threshold) {
    EEPROM.write(0, threshold);
    EEPROM.commit();
}
```

## Constraints

- EEPROM: Limited write cycles (~100k)
- SD: Requires FAT filesystem
- Flash: Sector erase needed

## Related Skills
- spi-sensor
- micropython-esp32