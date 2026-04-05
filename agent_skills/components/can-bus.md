# CAN Bus

> Code generation skill for CAN bus communication

## Purpose

Generate code to communicate over CAN bus (OBD-II, vehicle networks, industrial automation).

## Hardware

- **Component**: `can-bus`
- **Protocol**: CAN 2.0A/B (11-bit/29-bit IDs)
- **Transceiver**: MCP2515, SN65HVD230, integrated (ESP32)

## Code Generation Rules

### Arduino with MCP2515

```c
#include <mcp2515_can.h>
#include <SPI.h>

#define CAN_CS 10
#define CAN_INT 2

mcp2515_can CAN(CAN_CS);

void setup() {
    while (CAN.begin(CAN_500KBPS) != CAN_OK) {
        delay(100);
    }
    CAN.setMode(MODE_NORMAL);
}

void sendFrame() {
    unsigned char msg[8] = {0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08};
    CAN.sendMsgBuf(0x100, 0, 8, msg);
}

void receiveFrame() {
    if (CAN.checkReceive()) {
        unsigned long id;
        unsigned char len;
        unsigned char buf[8];
        CAN.readMsgBuf(&id, &len, buf);
    }
}
```

### ESP32 (Integrated CAN)

```c
#include "driver/twai.h"

void setup() {
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(
        GPIO_NUM_21, GPIO_NUM_22, TWAI_MODE_NORMAL
    );
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();
    twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
    
    twai_driver_install(&g_config, &t_config, &f_config);
    twai_start();
}
```

### MicroPython

```python
# CAN requires additional hardware (MCP2515 via SPI)
# Some boards have native CAN
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct bit timing | +0.0 |
| Proper termination | +0.1 |
| Message ID handling | +0.1 |
| No error handling | -0.15 |

## Example Output

```c
void sendCAN(uint16_t id, uint8_t* data, uint8_t len) {
    CAN.sendMsgBuf(id, 0, len, data);
}
```

## Constraints

- Requires CAN transceiver
- 120Ω termination required
- Max 1Mbps at short distances

## Related Skills
- spi-sensor
- arduino-cpp-esp32