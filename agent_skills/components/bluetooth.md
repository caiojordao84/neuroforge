# Bluetooth

> Code generation skill for Bluetooth communication (Classic, BLE)

## Purpose

Generate code to enable Bluetooth communication using Classic Bluetooth (SPP) or Bluetooth Low Energy (BLE).

## Hardware

- **Component**: `bluetooth`
- **Protocol**: Classic Bluetooth (SPP), BLE (GAP/GATT)
- **Boards**: ESP32, nRF52, HM-10 (BLE), BlueSMiRF (Classic)

## Code Generation Rules

### BLE (ESP32) - Arduino

```c
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer *pServer;
BLEService *pService;
BLECharacteristic *pCharacteristic;

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pChar) {
        std::string value = pChar->getValue();
        // Handle data
    }
};

void setup() {
    BLEDevice::init("ESP32_BLE");
    pServer = BLEDevice::createServer();
    pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    pCharacteristic->setCallbacks(new MyCallbacks());
    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->start();
}
```

### BLE (MicroPython)

```python
from machine import Pin
# Note: BLE support varies by firmware
# Use bluetooth module on ESP32
import bluetooth

def start_ble():
    ble = bluetooth.BLE()
    ble.active(True)
    # Configure GATT server
```

### BLE (CircuitPython)

```python
import board
import bleio

# Initialize as peripheral
ble = bleio.Peripheral()
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct UUID format | +0.0 |
| Proper GATT structure | +0.1 |
| Connection handling | +0.1 |
| Security not implemented | -0.1 |

## Example Output

```c
#include <BLEDevice.h>

void setup() {
    BLEDevice::init("MyDevice");
    // Create service and characteristic
    // Start advertising
}
```

## Constraints

- BLE: Limited to 512 bytes per attribute
- ESP32: BLE + WiFi concurrent issues
- Classic: SPP limited to 1 connection

## Related Skills
- wifi
- arduino-cpp-esp32