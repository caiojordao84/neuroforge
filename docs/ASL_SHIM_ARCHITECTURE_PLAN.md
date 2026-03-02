# ASL Shim Architecture: "The Middle Path"

> **Status**: Proposed
> **Target**: `src/engine/asl/` and `src/engine/SimulationEngine.ts`

## 1. Overview: The "Middle Path" Concept

NeuroForge utilizes **Abstract Simulation Language (ASL)** to provide structural and semantic parity across C++, Python, and Rust. To handle hardware, we employ **Shims**—virtual translation layers that map high-level hardware commands to the SimulationEngine.

The **Middle Path** defines the boundary of what should and should not be a shim:
1. **Always Shim (External Surface)**: Hardware I/O, Communication Protocols (I2C, SPI, UART), System Time (`millis`), and OS Services (RTOS Tasks, Mutexes).
2. **Never Shim (Internal Processing)**: Control flow (`if`, `while`), mathematical operations, variable assignments, and standard data structures.

This ensures ASL remains a true programming AST rather than a glorified API wrapper, while preserving the flexibility to easily add support for new microcontrollers by only updating the Hardware Shims.

## 2. Exhaustive Shim Catalog

To ensure absolute clarity on the "Middle Path", the following is an **exhaustive list** of every feature, protocol, and hardware module that requires a shim in NeuroForge. If a feature interacts with the physical world or the underlying operating system, it must be on this list.

### 2.1. Level 1: Core IO & Timing Shims (Implemented/Native to Engine)
These are the foundational shims built directly into `SimulationEngine.ts`.
- **GPIO Digital**: `pinMode`, `digitalWrite`, `digitalRead`
- **GPIO Analog**: `analogWrite` (PWM), `analogRead` (ADC)
- **Time/Delay**: `delay`, `delayMicroseconds`, `millis`, `micros`
- **Interrupts**: `attachInterrupt`, `detachInterrupt`
- **Serial/UART (Basic)**: `Serial.begin`, `Serial.print`, `Serial.read`, `Serial.available`

### 2.2. Level 2: Interaction Shims (Current Virtual Peripherals)
These shims map high-level device logic to virtual components in the UI.
- [x] **`liquid_crystal_i2c_shim`**: LCD Display (`clear`, `setCursor`, `print`)
- [x] **`oled_ssd1306_shim`**: OLED Display (`fill`, `text`, `show`, `clear`)
- [x] **`sevseg_shim`**: Seven Segment Display (`setNumber`, `refreshDisplay`)
- [x] **`keypad_shim`**: Matrix Keypad (`getKey`)
- [x] **`buzzer_shim`**: Piezo Buzzer (`tone`, `noTone`, continuous duration management)
- [ ] **`servo_shim`**: Servo Motors (`attach`, `write`, `read`) - *Pending full ASL adoption*
- [ ] **`dht_shim`**: Temperature/Humidity sensors (DHT11/22) - *Pending generic mapping*
- [ ] **`ultrasonic_shim`**: HC-SR04 distance sensors (`pulseIn` mapping) - *Pending generic mapping*

### 2.3. Level 3: Protocol Shims (The Next Frontier)
These shims abstract communication buses. They do not simulate a specific device, but rather the bus itself, allowing custom driver ASL code to function.
- [ ] **I2C Bus (`Wire / machine.I2C`)**: `beginTransmission`, `write`, `endTransmission`, `requestFrom`, `read`
- [ ] **SPI Bus (`SPI / machine.SPI`)**: `beginTransaction`, `transfer`, `endTransaction`
- [ ] **Advanced UART (`Serial1/2 / machine.UART`)**: Hardware serial ports beyond the debug console, with configurable baud rates and interrupts.
- [ ] **1-Wire (`OneWire`)**: Bit-banging protocol simulator for devices like DS18B20.
- [ ] **CAN Bus**: `beginPacket`, `write`, `endPacket`, `parsePacket`

### 2.4. Level 4: Operating System & Connectivity Shims (Future Roadmap)
These shims abstract complex subsystems found in ESP32, Raspberry Pi Pico W, or specific RTOS environments.
- [ ] **Network/WiFi (`WiFi / network.WLAN`)**: `begin`, `status`, `localIP`, HTTP Client requests.
- [ ] **File System (`LittleFS / SPIFFS`)**: `open`, `read`, `write`, `close`, `exists`
- [ ] **EEPROM/Flash (`EEPROM`)**: Persistent memory mapping (`read`, `write`, `commit`).
- [ ] **RTOS Tasks**: Task creation, deletion, yield, and prioritization.
- [ ] **RTOS Synchronization**: Mutexes (`lock`, `unlock`), Semaphores, and Queues.
- [ ] **Hardware Timers**: High-resolution hardware timer interrupts (`timerBegin`, `timerAlarmEnable`).
- [ ] **Sleep Modes**: Deep sleep and light sleep (`esp_deep_sleep_start`).

---

## 3. Integration Plan: Expanding the Protocol Shims

### 3.1. Phase 1: I2C (Wire) Shim Blueprint

**Goal:** Provide a generic I2C interface that C++, MicroPython, and Rust map to.

#### ASL Executor Mapping (`ASLExecutor.ts`)
```typescript
if (expr.callee === 'Wire.beginTransmission' || expr.callee === 'Wire.write' || expr.callee === 'Wire.endTransmission' || expr.callee === 'Wire.requestFrom' || expr.callee === 'Wire.read') {
    const args = [];
    for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
    
    // Defer to the simulation engine's I2C shim
    const result = ctx.engine.emitSync('i2cBus', { action: expr.callee, args: args });
    return result ?? 0;
}
```

#### Simulation Engine Hub (`SimulationEngine.ts`)
```typescript
// Maintains the state of the I2C bus and routes to virtual I2C devices
i2cBus(action: string, args: any[]): number {
    switch(action) {
        case 'Wire.beginTransmission':
            this.activeI2CAddress = args[0];
            this.i2cBuffer = [];
            return 0;
        case 'Wire.write':
            this.i2cBuffer.push(args[0]);
            return 1; // 1 byte written
        case 'Wire.endTransmission':
            return this.routeI2CPacket(this.activeI2CAddress, this.i2cBuffer);
        // ...
    }
}
```

#### Multi-Language Parsers
- **C/C++**: Native `Wire.beginTransmission()`, `Wire.write()` map directly to the `callee` names.
- **Python**: `i2c.writeto(addr, buf)` maps to a generated ASL block doing `Wire.beginTransmission(addr)` followed by a loop of `Wire.write(buf[i])` and `Wire.endTransmission()`.
- **Rust**: Embassy `i2c.write(addr, &[bytes])` maps to the exact same ASL block as Python.

## 4. Test Strategy (Cross-Language Semantic Parity)

To validate the Middle Path, we will use Integration Tests (CIs). A test passes if, and only if, the simulated hardware state is identical regardless of the source language.

### Test Fixture: Generic I2C Expander (PCF8574)

**Objective**: Write a byte to an I2C expander to turn on an LED.

**C++ Input (Arduino)**
```cpp
#include <Wire.h>
void setup() { Wire.begin(); }
void loop() {
  Wire.beginTransmission(0x27);
  Wire.write(0xFF); // Turn all pins HIGH
  Wire.endTransmission();
  delay(1000);
}
```

**MicroPython Input**
```python
from machine import I2C, Pin
import time
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
while True:
    i2c.writeto(0x27, b'\xFF')
    time.sleep_ms(1000)
```

**Rust Input (Embassy)**
```rust
use embassy_rp::i2c::{I2c, Config};
// ... setup abbreviated ...
loop {
    let _ = i2c.write(0x27, &[0xFF]).await;
    Timer::after_millis(1000).await;
}
```

**Validation Criteria**:
1. All three languages compile successfully to ASL.
2. The ASL generated from Python and Rust is "desugared" into the standard `Wire.beginTransmission`, `Wire.write`, `Wire.endTransmission` sequence.
3. The `SimulationEngine` registers an I2C write of `0xFF` to address `0x27` every 1000ms.

## 5. Value Proposition

By formalizing the Middle Path:
1. **DRY Simulation**: We don't need a "Rust I2C Simulator" and a "Python I2C Simulator". The engine only speaks ASL-Shim.
2. **True Parity**: Teaching materials can show the C++, Python, and Rust code side-by-side, proving they do the *exact same thing* under the hood. 
3. **Decoupled Architecture**: Parsers handle syntax. ASL handles logic. Shims handle the physical world.
