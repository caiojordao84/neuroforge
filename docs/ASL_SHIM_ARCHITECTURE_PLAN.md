# ASL Shim Architecture: "The Middle Path"

> **Status**: Active — Living Document
> **Version**: 2.0 (02/Mar/2026)
> **Target**: `src/engine/asl/`, `src/engine/SimulationEngine.ts`, `ShimManager.ts`
> **Owner**: Caio Jordão

---

## Table of Contents

1. [Overview: The "Middle Path" Concept](#1-overview-the-middle-path-concept)
2. [Core Design Principles](#2-core-design-principles)
3. [Shim Classification Taxonomy](#3-shim-classification-taxonomy)
4. [Exhaustive Shim Catalog](#4-exhaustive-shim-catalog)
5. [Shim Lifecycle & Architecture](#5-shim-lifecycle--architecture)
6. [ShimManager — The Runtime Orchestrator](#6-shimmanager--the-runtime-orchestrator)
7. [Protocol Bus Architecture](#7-protocol-bus-architecture)
8. [Cross-Language Parity Contract](#8-cross-language-parity-contract)
9. [Integration Plan — Phased Rollout](#9-integration-plan--phased-rollout)
10. [Extension Guide: Adding a New Shim](#10-extension-guide-adding-a-new-shim)
11. [Extension Guide: Adding a New Board](#11-extension-guide-adding-a-new-board)
12. [Test Strategy (Cross-Language Semantic Parity)](#12-test-strategy-cross-language-semantic-parity)
13. [Error Handling & Observability](#13-error-handling--observability)
14. [Performance & Scalability](#14-performance--scalability)
15. [Future Roadmap (v2, v3, v4)](#15-future-roadmap-v2-v3-v4)
16. [Value Proposition](#16-value-proposition)
17. [Appendix A: Decision Log](#appendix-a-decision-log)
18. [Appendix B: Glossary](#appendix-b-glossary)

---

## 1. Overview: The "Middle Path" Concept

NeuroForge utilizes **Abstract Simulation Language (ASL)** to provide structural and semantic parity across C++, Python, and Rust. To handle hardware, we employ **Shims** — virtual translation layers that map high-level hardware commands to the SimulationEngine.

The **Middle Path** defines the boundary of what should and should not be a shim:

| Domain                              | Example                         | Shim?    | Rationale                |
| ----------------------------------- | ------------------------------- | -------- | ------------------------ |
| **External Surface** (hardware I/O) | `digitalWrite`, `analogRead`    | ✅ Always | Touches physical world   |
| **Communication Protocols**         | I2C, SPI, UART, CAN             | ✅ Always | Bus-level abstraction    |
| **System Services**                 | `millis()`, RTOS tasks, mutexes | ✅ Always | OS-level behavior        |
| **Peripheral Libraries**            | LCD, OLED, keypad, servo        | ✅ Always | Device-specific API      |
| **Internal Processing**             | `if`, `while`, `x + y`          | ❌ Never  | Pure computation         |
| **Data Structures**                 | arrays, structs, enums          | ❌ Never  | Language-level construct |

This ensures ASL remains a true programming AST rather than a glorified API wrapper, while preserving the flexibility to easily add support for **new microcontrollers** by only updating the Hardware Shims.

### 1.1. Key Invariant

> **The Shim Boundary Rule**: A function requires a shim if and only if it has a side-effect on the physical world OR depends on OS/platform state. If it can be evaluated as a pure expression of its inputs, it MUST NOT be a shim.

---

## 2. Core Design Principles

These principles govern all present and future shim decisions.

### P1 — Single Source of Truth
Every hardware abstraction exists in exactly one place: the shim definition. Parsers map to it; generators emit from it; the executor dispatches through it.

### P2 — Language-Agnostic Core
The `SimulationEngine` only understands ASL-Shim calls. It never sees C++, Python, or Rust syntax. All language-specific API translations happen in parsers, **before** the shim layer.

### P3 — Layered Abstraction
Shims are organized in ordered levels (L1–L5). Higher levels may depend on lower levels, but never the reverse. This forms a **Dependency DAG** enforced by `ShimManager`.

### P4 — Convention over Configuration
New shims follow a predictable file structure (`plugins/<lang>/shims/<category>/<name>_shim.ts`) and a standard `ShimDefinition` interface. Zero config needed for basic shims.

### P5 — Fail-Open with Diagnostics
Unknown hardware calls return a safe default (`0`) and emit a structured warning. The simulation never crashes due to an unrecognized shim call — but the user always knows something was skipped.

### P6 — Cross-Language Parity ("Hand in Hand")
Any shim added for one language MUST have corresponding implementations for all supported languages. This is enforced via the parity test matrix (Section 12).

### P7 — Composability
Shims can depend on other shims (e.g., `oled_ssd1306_shim` depends on `i2c_bus_shim`). The `ShimManager` resolves the dependency graph and injects code in topological order.

### P8 — Hot-Swappable Board Profiles
The set of available shims is parameterized by a `BoardProfile`. Switching from "Arduino Uno" to "ESP32" changes which shims are available, but the ASL code remains unchanged.

---

## 3. Shim Classification Taxonomy

### 3.1. By Layer

```
┌─────────────────────────────────────────────────────────────────┐
│  L5: Connectivity & Cloud (WiFi, BLE, MQTT, HTTP)              │
├─────────────────────────────────────────────────────────────────┤
│  L4: OS Services (RTOS, File System, Sleep, Timers, OTA)       │
├─────────────────────────────────────────────────────────────────┤
│  L3: Protocol Buses (I2C, SPI, UART, 1-Wire, CAN, Modbus)     │
├─────────────────────────────────────────────────────────────────┤
│  L2: Peripherals (LCD, OLED, Servo, DHT, Ultrasonic, RFID)    │
├─────────────────────────────────────────────────────────────────┤
│  L1: Core IO & Timing (GPIO, ADC, PWM, delay, millis)         │
└─────────────────────────────────────────────────────────────────┘
                    ↑ Dependencies flow upward
```

### 3.2. By Lifecycle

| Category      | Description                                 | Example                     |
| ------------- | ------------------------------------------- | --------------------------- |
| **Static**    | Available at compile-time, always present   | `gpio_digital`, `delay`     |
| **On-Demand** | Injected only when the parser detects usage | `liquid_crystal_i2c_shim`   |
| **Runtime**   | State-dependent, created during execution   | I2C bus transaction buffers |

### 3.3. By Scope

| Scope             | Description                                             | Example                            |
| ----------------- | ------------------------------------------------------- | ---------------------------------- |
| **Generator**     | Injects `#include` / `import` / `use` in generated code | `liquid_crystal_i2c_shim` for C    |
| **Executor**      | Dispatches calls during ASL runtime execution           | `engine.emit('hardwareCall', ...)` |
| **Bidirectional** | Both generates code AND handles simulation              | I2C bus (future)                   |

---

## 4. Exhaustive Shim Catalog

> **Rule**: If a feature interacts with the physical world or the underlying OS, it must be on this list. If it doesn't appear here, it is NOT a shim.

### 4.1. Level 1: Core IO & Timing (Built into SimulationEngine)

These are foundational — built directly into `SimulationEngine.ts` and `ASLExecutor.ts`.

| Shim                | API                                               | ASL Kind(s)                                | Status |
| ------------------- | ------------------------------------------------- | ------------------------------------------ | ------ |
| GPIO Digital        | `pinMode`, `digitalWrite`, `digitalRead`          | `pinMode`, `digitalWrite`, `read(DIGITAL)` | ✅      |
| GPIO Analog         | `analogWrite` (PWM), `analogRead` (ADC)           | `analogWrite`, `read(ANALOG)`              | ✅      |
| Time/Delay          | `delay`, `delayMicroseconds`, `millis`, `micros`  | `delay`, `call(millis)`, `call(micros)`    | ✅      |
| Interrupts          | `attachInterrupt`, `detachInterrupt`              | `call(attachInterrupt)`                    | ✅      |
| Serial/UART (Debug) | `Serial.begin/print/println/read/available/write` | `print`, `call(Serial.*)`                  | ✅      |
| Tone/Buzzer         | `tone(pin, freq, dur?)`, `noTone(pin)`            | `call(tone)`, `call(noTone)`               | ✅      |
| Shift Registers     | `shiftOut`, `shiftIn`                             | `call(shiftOut)`, `call(shiftIn)`          | ✅      |
| Pulse Timing        | `pulseIn`, `pulseInLong`                          | `call(pulseIn)`                            | ✅      |
| Math/Utils          | `map`, `constrain`, `random`, `abs`, etc.         | `call(map)`, etc.                          | ✅      |

### 4.2. Level 2: Peripheral Shims (Virtual Components)

These map high-level device APIs to virtual UI components.

| Shim ID                   | Device             | API Surface                             | Status    | Generator Shim | Executor Dispatch |
| ------------------------- | ------------------ | --------------------------------------- | --------- | -------------- | ----------------- |
| `liquid_crystal_i2c_shim` | LCD 16×2 / 20×4    | `lcd.clear/setCursor/print/backlight`   | ✅         | ✅ C/Py/Rust    | `hardwareCall`    |
| `oled_ssd1306_shim`       | OLED SSD1306       | `oled.fill/text/show/clear/rect/line`   | ✅         | ✅ C/Py/Rust    | `hardwareCall`    |
| `sevseg_shim`             | 7-Segment Display  | `sevseg.setNumber/refreshDisplay/print` | ✅         | ✅ Py           | `hardwareCall`    |
| `keypad_shim`             | Matrix Keypad 4×4  | `keypad.getKey`                         | ✅         | ✅ C/Py/Rust    | `hardwareCall`    |
| `buzzer_shim`             | Piezo Buzzer       | `tone/noTone` with auto-duration        | ✅         | ✅ (via L1)     | `hardwareCall`    |
| `servo_shim`              | Servo Motor        | `attach/write/read/writeMicroseconds`   | ⬜ Planned | —              | —                 |
| `dht_shim`                | DHT11/DHT22        | `readTemperature/readHumidity/begin`    | ⬜ Planned | —              | —                 |
| `ultrasonic_shim`         | HC-SR04            | `ping_cm/ping_in` + `pulseIn` mapping   | ⬜ Planned | —              | —                 |
| `neopixel_shim`           | WS2812B / NeoPixel | `setPixelColor/show/fill/clear`         | ⬜ Planned | —              | —                 |
| `stepper_shim`            | Stepper Motor      | `step/setSpeed/moveTo/run`              | ⬜ Planned | —              | —                 |
| `rfid_shim`               | MFRC522 / PN532    | `isNewCardPresent/readCardSerial/uid`   | ⬜ Planned | —              | —                 |
| `hx711_shim`              | Load Cell HX711    | `read/tare/getUnits/setScale`           | ⬜ Planned | —              | —                 |
| `relay_shim`              | Relay Module       | `on/off/toggle` (maps to GPIO)          | ⬜ Planned | —              | —                 |
| `motor_driver_shim`       | L298N / TB6612     | `forward/backward/stop/speed`           | ⬜ Planned | —              | —                 |
| `encoder_shim`            | Rotary Encoder     | `getCount/getDirection/reset`           | ⬜ Planned | —              | —                 |
| `ir_receiver_shim`        | IR Receiver        | `decode/resume/getResults`              | ⬜ Planned | —              | —                 |
| `rtc_shim`                | DS1307/DS3231 RTC  | `now/getHours/getMinutes/adjust`        | ⬜ Planned | —              | —                 |
| `sd_card_shim`            | SD Card Module     | `begin/open/read/write/close`           | ⬜ Planned | —              | —                 |
| `gps_shim`                | NEO-6M GPS         | `read/lat/lon/speed/satellites`         | ⬜ Planned | —              | —                 |

### 4.3. Level 3: Protocol Bus Shims

These abstract communication buses. They do NOT simulate a specific device, but rather the **bus itself**, allowing ASL driver code to function.

| Shim ID           | Protocol                  | API Surface                                                | Status    |
| ----------------- | ------------------------- | ---------------------------------------------------------- | --------- |
| `i2c_bus_shim`    | I2C (Wire / machine.I2C)  | `beginTransmission/write/endTransmission/requestFrom/read` | ⬜ Planned |
| `spi_bus_shim`    | SPI                       | `beginTransaction/transfer/endTransaction/settings`        | ⬜ Planned |
| `uart_hw_shim`    | Hardware UART (Serial1/2) | `begin/read/write/available` (beyond debug Serial)         | ⬜ Planned |
| `onewire_shim`    | 1-Wire                    | `reset/write/read/select/search`                           | ⬜ Planned |
| `can_bus_shim`    | CAN Bus                   | `beginPacket/write/endPacket/parsePacket/filter`           | ⬜ Planned |
| `modbus_rtu_shim` | Modbus RTU                | `readHoldingRegisters/writeSingleRegister/coils`           | ⬜ Planned |
| `modbus_tcp_shim` | Modbus TCP                | Same as RTU + TCP socket management                        | ⬜ Planned |

#### 4.3.1. Protocol Shim Internal Architecture

Each protocol shim maintains an internal **bus state machine**:

```
┌────────────┐     beginTransmission(addr)     ┌───────────┐
│    IDLE    │ ────────────────────────────────► │  ACTIVE   │
│            │                                   │ addr=0x27 │
└────────────┘                                   │ buf=[]    │
      ▲                                          └─────┬─────┘
      │            endTransmission()                   │ write(byte)
      │◄──────────────── routePacket() ────────────────┘
      │                                                │
      │                                                ▼
      │                                          ┌───────────┐
      │                                          │ buf=[...] │
      │◄─────────────────────────────────────────┘           │
      │            endTransmission()                          │
```

Each virtual device on the bus registers its address. When `endTransmission()` fires, the bus routes the buffer to the matching virtual device.

### 4.4. Level 4: OS & System Services Shims

| Shim ID            | Service                       | API Surface                                                                | Boards          | Status     |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------- | --------------- | ---------- |
| `eeprom_shim`      | EEPROM / Flash                | `read/write/commit/length`                                                 | All             | ⬜ Gen-only |
| `littlefs_shim`    | File System (LittleFS/SPIFFS) | `open/read/write/close/exists/mkdir`                                       | ESP32, RP2040   | ⬜ Planned  |
| `rtos_task_shim`   | FreeRTOS Tasks                | `xTaskCreate/vTaskDelete/vTaskDelay/taskYIELD`                             | ESP32           | ⬜ Planned  |
| `rtos_sync_shim`   | RTOS Sync Primitives          | `xSemaphoreCreate/Take/Give`, `xQueueSend/Receive`, Mutex                  | ESP32           | ⬜ Planned  |
| `hw_timer_shim`    | Hardware Timers               | `timerBegin/timerAlarmWrite/timerAlarmEnable`                              | ESP32, RPi Pico | ⬜ Planned  |
| `sleep_mode_shim`  | Power Management              | `esp_deep_sleep_start/esp_light_sleep_start/esp_sleep_enable_timer_wakeup` | ESP32           | ⬜ Planned  |
| `watchdog_shim`    | Watchdog Timer                | `esp_task_wdt_init/esp_task_wdt_reset`                                     | ESP32, AVR      | ⬜ Planned  |
| `ota_shim`         | Over-the-Air Update           | `ArduinoOTA.begin/handle/onStart/onEnd`                                    | ESP32, ESP8266  | ⬜ Planned  |
| `preferences_shim` | NVS Storage                   | `begin/putInt/getInt/putString/getString/clear`                            | ESP32           | ⬜ Planned  |

### 4.5. Level 5: Connectivity & Cloud Shims

| Shim ID            | Service                 | API Surface                                         | Boards                 | Status    |
| ------------------ | ----------------------- | --------------------------------------------------- | ---------------------- | --------- |
| `wifi_shim`        | WiFi STA/AP             | `begin/status/localIP/scanNetworks/RSSI`            | ESP32, ESP8266, Pico W | ⬜ Planned |
| `ble_shim`         | BLE Central/Peripheral  | `begin/advertise/scan/connect/characteristics`      | ESP32, nRF52           | ⬜ Planned |
| `mqtt_shim`        | MQTT Client             | `connect/publish/subscribe/loop/onMessage`          | Any (via WiFi)         | ⬜ Planned |
| `http_client_shim` | HTTP Client             | `begin/GET/POST/PUT/DELETE/getPayload/responseCode` | Any (via WiFi)         | ⬜ Planned |
| `http_server_shim` | HTTP Server             | `on/begin/send/arg/handleClient`                    | ESP32, ESP8266         | ⬜ Planned |
| `websocket_shim`   | WebSocket Client/Server | `begin/send/onMessage/onConnect`                    | ESP32                  | ⬜ Planned |
| `ntp_shim`         | NTP Time Sync           | `configTime/getLocalTime/epoch`                     | Any (via WiFi)         | ⬜ Planned |
| `espnow_shim`      | ESP-NOW P2P             | `init/addPeer/send/onReceive`                       | ESP32, ESP8266         | ⬜ Planned |

---

## 5. Shim Lifecycle & Architecture

### 5.1. Dual-Path Shim Model

Shims serve two distinct roles and both MUST be considered for every new shim:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           ASL Program                                    │
│              globals, functions, tasks, statements                       │
└──────────┬───────────────────────────────────────┬───────────────────────┘
           │                                       │
     ┌─────▼──────┐                          ┌─────▼──────┐
     │  EXECUTOR   │                          │ GENERATORS │
     │  PATH       │                          │ PATH       │
     │             │                          │             │
     │ ASLExecutor │                          │ CGenerator  │
     │ evalExpr()  │                          │ PyGenerator │
     │   ↓         │                          │ RustGen     │
     │ engine.emit │                          │   ↓         │
     │ ('hardware  │                          │ ShimManager │
     │  Call',..') │                          │ .require()  │
     └─────┬───────┘                          │ .getCode()  │
           │                                  └─────┬───────┘
     ┌─────▼───────┐                          ┌─────▼───────┐
     │ Simulation  │                          │  Generated  │
     │ Engine      │                          │  Source     │
     │ (runtime)   │                          │  Code       │
     └─────────────┘                          └─────────────┘
```

### 5.2. Shim Lifecycle Phases

```
1. REGISTRATION   → ShimManager.registerShim(def)           [at generator init]
2. DETECTION      → Parser detects API usage in source code  [at parse time]
3. REQUIREMENT    → ShimManager.requireShim(name)            [at code-gen time]
4. RESOLUTION     → Dependency DAG resolved, topological sort [at code-gen time]
5. INJECTION      → Shim code injected into generated output  [at code-gen time]
6. EXECUTION      → ASLExecutor dispatches call to engine     [at runtime]
7. TEARDOWN       → ShimManager.resetRuntime()                [at simulation stop]
```

### 5.3. File Structure Convention

Every shim follows this directory pattern:

```
src/engine/asl/plugins/
  <language>/
    shims/
      <category>/
        <device>_shim.ts       ← ShimDefinition export
      index.ts                 ← Barrel: registers all shims for that language
  core/
    ShimManager.ts             ← Orchestrator (shared across languages)
    ShimRegistry.ts            ← [FUTURE] Global registry with board profiles
    ShimTypes.ts               ← [FUTURE] Shared interfaces & types
```

**Category taxonomy for the `<category>` folder:**

| Category        | Contents                                            |
| --------------- | --------------------------------------------------- |
| `display`       | LCD, OLED, 7-segment, TFT, e-ink, LED matrix        |
| `input`         | Keypad, buttons, rotary encoder, touch, IR receiver |
| `sensor`        | DHT, ultrasonic, HX711, GPS, accelerometer, gas     |
| `actuator`      | Servo, stepper, DC motor, relay, solenoid           |
| `memory`        | EEPROM, SD card, Flash, NVS                         |
| `communication` | I2C, SPI, UART, CAN, Modbus, 1-Wire                 |
| `connectivity`  | WiFi, BLE, MQTT, HTTP, WebSocket, ESP-NOW           |
| `system`        | RTOS, timers, sleep, watchdog, OTA                  |

---

## 6. ShimManager — The Runtime Orchestrator

### 6.1. Current Implementation (`ShimManager.ts`)

```typescript
interface ShimDefinition {
  name: string;
  code: string;                  // Source code to inject
  description?: string;
  dependencies?: string[];       // DAG edges
}

class ShimManager {
  registerShim(shim: ShimDefinition): void;
  requireShim(name: string): void;        // recursive dependency resolution
  getRequiredShimsCode(): string;          // topological injection
  hasRequested(name: string): boolean;
  resetRuntime(): void;
}
```

### 6.2. Planned Enhancements (ShimManager v2)

The current `ShimManager` handles basic registration and code injection. To be truly future-proof, it needs:

#### 6.2.1. Board Profile System

```typescript
// FUTURE: ShimRegistry.ts
interface BoardProfile {
  id: string;                       // 'arduino_uno', 'esp32', 'rpi_pico'
  name: string;
  availableShims: string[];         // subset of all registered shims
  pinMap: Record<string, number>;   // named pins → physical numbers
  capabilities: BoardCapability[];  // 'wifi', 'ble', 'i2c', 'spi', etc.
  memoryLimits: {
    flash: number;   // bytes
    sram: number;    // bytes
    eeprom?: number; // bytes
  };
}

type BoardCapability =
  | 'gpio' | 'adc' | 'dac' | 'pwm'
  | 'i2c' | 'spi' | 'uart' | 'can'
  | 'wifi' | 'ble' | 'espnow'
  | 'rtos' | 'filesystem' | 'ota'
  | 'deep_sleep' | 'touch';
```

#### 6.2.2. Shim Capability Query

```typescript
// FUTURE: Before dispatching a call, check if the board supports it
class ShimManager {
  // ...existing methods...
  canProvide(shimName: string): boolean;   // checks BoardProfile
  getUnavailableReason(shimName: string): string;
  listAvailableShims(): ShimDefinition[];
  listMissingForProgram(program: ASLProgram): ShimAudit[];
}
```

#### 6.2.3. Execution-Side Shim Hooks

```typescript
// FUTURE: Allow shims to hook into execution, not just code-gen
interface ExecutorShimHook {
  name: string;
  callee: string | RegExp;               // match pattern for ASLExpr.callee
  handler: (args: any[], ctx: ASLContext) => any; // custom executor logic
  initialize?: (engine: SimulationEngine) => void;
  teardown?: (engine: SimulationEngine) => void;
}
```

This replaces the current ad-hoc `if/else` chain in `ASLExecutor.ts` with a registry-based dispatch for hardware calls.

---

## 7. Protocol Bus Architecture

Protocol shims are fundamentally different from peripheral shims: they manage **stateful, multi-step transactions** over shared buses.

### 7.1. I2C Bus Shim Blueprint

**Goal:** Provide a generic I2C interface that C++, MicroPython, and Rust map to.

#### ASL Executor Mapping

```typescript
// ASLExecutor.ts — I2C dispatch
if (/^Wire\.(beginTransmission|write|endTransmission|requestFrom|read)$/.test(expr.callee)) {
    const args = [];
    for (const a of expr.args) args.push(await evalExpr(a, env, ctx));
    const result = ctx.engine.emitSync('i2cBus', { action: expr.callee, args });
    return result ?? 0;
}
```

#### SimulationEngine I2C Hub

```typescript
// SimulationEngine.ts
class I2CBus {
  private activeAddress: number = 0;
  private txBuffer: number[] = [];
  private rxBuffer: number[] = [];
  private devices: Map<number, VirtualI2CDevice> = new Map();

  beginTransmission(addr: number): void {
    this.activeAddress = addr;
    this.txBuffer = [];
  }

  write(byte: number): number {
    this.txBuffer.push(byte & 0xFF);
    return 1; // 1 byte written
  }

  endTransmission(): number {
    const device = this.devices.get(this.activeAddress);
    if (!device) return 2; // NACK — no device at address
    return device.onReceive(this.txBuffer); // 0 = success
  }

  requestFrom(addr: number, count: number): number {
    const device = this.devices.get(addr);
    if (!device) return 0;
    this.rxBuffer = device.onRequest(count);
    return this.rxBuffer.length;
  }

  read(): number {
    return this.rxBuffer.shift() ?? -1;
  }

  registerDevice(addr: number, device: VirtualI2CDevice): void {
    this.devices.set(addr, device);
  }
}

interface VirtualI2CDevice {
  address: number;
  onReceive(data: number[]): number;   // returns Wire error code (0=ok)
  onRequest(count: number): number[];  // returns requested bytes
}
```

#### Multi-Language Parser Mapping

| Language          | Native API                        | Maps To (ASL)                                                                                    |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| **C/C++**         | `Wire.beginTransmission(0x27)`    | Direct: callee = `Wire.beginTransmission`                                                        |
| **MicroPython**   | `i2c.writeto(addr, buf)`          | Desugared: `Wire.beginTransmission(addr)` → loop `Wire.write(buf[i])` → `Wire.endTransmission()` |
| **Rust**          | `i2c.write(addr, &[bytes]).await` | Same desugaring as Python                                                                        |
| **CircuitPython** | `i2c.writeto(addr, buf)`          | Same desugaring as Python                                                                        |

### 7.2. SPI Bus Shim Blueprint

```typescript
interface VirtualSPIDevice {
  csPin: number;
  onTransfer(txByte: number): number; // returns MISO byte for each MOSI byte
}
```

### 7.3. Virtual I2C Device Registry Pattern

When a peripheral shim (e.g., `oled_ssd1306_shim`) depends on I2C, it registers itself as a `VirtualI2CDevice`:

```typescript
// Future: oled_ssd1306 as I2C device
class OledSsd1306Device implements VirtualI2CDevice {
  address = 0x3C;

  onReceive(data: number[]): number {
    const [cmd, ...payload] = data;
    if (cmd === 0x00) this.processCommand(payload);
    if (cmd === 0x40) this.processData(payload);
    return 0; // ACK
  }

  onRequest(count: number): number[] {
    return [0x00]; // status byte
  }
}
```

This allows the same device to be used via **raw I2C** (for advanced users writing their own drivers) OR via the **high-level library shim** (for beginners using `lcd.print()`).

---

## 8. Cross-Language Parity Contract

### 8.1. The Golden Rule

> "Todas as linguagens devem andar de mãos dadas" — All languages must walk hand in hand.

For every shim, the following parity matrix MUST be satisfied:

| Artifact           | C/C++                                              | MicroPython | Rust | CircuitPython |
| ------------------ | -------------------------------------------------- | ----------- | ---- | ------------- |
| Parser recognition | ✅                                                  | ✅           | ✅    | ✅             |
| ASL emission       | Same ASL output for semantically identical code    |
| Executor dispatch  | Single handler, language-agnostic                  |
| Generator output   | Idiomatic code in each target language             |
| Generator ShimDef  | `plugins/<lang>/shims/<cat>/<name>_shim.ts` exists |

### 8.2. Parity Test Template

For every new shim, create a test fixture with:

1. **One source per language** that performs the same hardware operation.
2. **One expected ASL output** that all sources must converge to.
3. **One expected engine state** (pin values, I2C bus state, serial output, etc.).

```
tests/shims/<shim_name>/
  input_cpp.ino
  input_micropython.py
  input_rust.rs
  expected_asl.json
  expected_state.json
```

---

## 9. Integration Plan — Phased Rollout

### Phase 0: Foundation (✅ Complete)
- [x] `ShimManager.ts` with dependency resolution
- [x] Generator shim injection for C, Python, Rust
- [x] L1 Core IO fully implemented in SimulationEngine
- [x] L2 Shims: LCD, OLED, 7-Segment, Keypad, Buzzer

### Phase 1: Peripheral Expansion (Next)

> **Goal**: Complete the most requested L2 peripherals.

| #   | Task                                                    | Priority | Estimated Effort |
| --- | ------------------------------------------------------- | -------- | ---------------- |
| 1.1 | `servo_shim` — Servo.attach/write/read + UI widget      | 🔴 High   | 1 session        |
| 1.2 | `dht_shim` — DHT11/22 with simulated temp/humidity data | 🔴 High   | 1 session        |
| 1.3 | `ultrasonic_shim` — HC-SR04 with `pulseIn` mapping      | 🟡 Medium | 0.5 session      |
| 1.4 | `neopixel_shim` — WS2812B LED strip with visual UI      | 🟡 Medium | 1 session        |
| 1.5 | `relay_shim` — simple GPIO wrapper with visual state    | 🟢 Low    | 0.5 session      |
| 1.6 | `motor_driver_shim` — L298N / TB6612                    | 🟡 Medium | 1 session        |

### Phase 2: Protocol Buses

> **Goal**: Implement I2C and SPI as generic buses, enabling user-written drivers.

| #   | Task                                                       | Priority   | Estimated Effort | Dependency |
| --- | ---------------------------------------------------------- | ---------- | ---------------- | ---------- |
| 2.1 | `i2c_bus_shim` — Full Wire simulation with device registry | 🔴 Critical | 2 sessions       | —          |
| 2.2 | Refactor LCD/OLED to register as VirtualI2CDevice          | 🟡 Medium   | 1 session        | 2.1        |
| 2.3 | `spi_bus_shim` — Full SPI simulation                       | 🟡 Medium   | 1.5 sessions     | —          |
| 2.4 | `uart_hw_shim` — Hardware Serial ports                     | 🟡 Medium   | 1 session        | —          |
| 2.5 | `onewire_shim` — DS18B20 support                           | 🟢 Low      | 1 session        | —          |
| 2.6 | `can_bus_shim`                                             | 🟢 Low      | 1.5 sessions     | —          |
| 2.7 | `modbus_rtu_shim` + `modbus_tcp_shim`                      | 🟡 Medium   | 2 sessions       | 2.4        |

### Phase 3: OS Services & Board Profiles

> **Goal**: Support ESP32-grade features and introduce board-aware simulation.

| #   | Task                                                          | Priority | Estimated Effort |
| --- | ------------------------------------------------------------- | -------- | ---------------- |
| 3.1 | `BoardProfile` type + Arduino Uno / ESP32 / RPi Pico profiles | 🔴 High   | 1 session        |
| 3.2 | `eeprom_shim` — full executor support (Map-backed)            | 🟡 Medium | 0.5 session      |
| 3.3 | `preferences_shim` (ESP32 NVS)                                | 🟢 Low    | 0.5 session      |
| 3.4 | `hw_timer_shim`                                               | 🟡 Medium | 1 session        |
| 3.5 | `rtos_task_shim` — cooperative scheduling in ASLExecutor      | 🔴 High   | 2 sessions       |
| 3.6 | `rtos_sync_shim` — Mutex/Semaphore/Queue simulation           | 🟡 Medium | 1.5 sessions     |
| 3.7 | `sleep_mode_shim`                                             | 🟢 Low    | 0.5 session      |
| 3.8 | `watchdog_shim`                                               | 🟢 Low    | 0.5 session      |
| 3.9 | `littlefs_shim` — in-memory filesystem                        | 🟡 Medium | 1 session        |

### Phase 4: Connectivity & Cloud

> **Goal**: HTTP/MQTT/WebSocket support for IoT projects.

| #   | Task                                                       | Priority | Estimated Effort |
| --- | ---------------------------------------------------------- | -------- | ---------------- |
| 4.1 | `wifi_shim` — simulated WiFi (always-connected mock)       | 🔴 High   | 1 session        |
| 4.2 | `http_client_shim` — mock HTTP with configurable responses | 🟡 Medium | 1 session        |
| 4.3 | `mqtt_shim` — in-browser pub/sub                           | 🟡 Medium | 1.5 sessions     |
| 4.4 | `ble_shim` — BLE GATT simulation                           | 🟢 Low    | 2 sessions       |
| 4.5 | `http_server_shim` — mock server with route matching       | 🟢 Low    | 1 session        |
| 4.6 | `websocket_shim`                                           | 🟢 Low    | 1 session        |
| 4.7 | `espnow_shim`, `ntp_shim`                                  | 🟢 Low    | 1 session        |

### Phase 5: Executor Shim V2 (Registry-Based Dispatch)

> **Goal**: Replace the `if/else` chain in `ASLExecutor.ts` with a plugin-based dispatch system.

| #   | Task                                                  | Priority | Estimated Effort |
| --- | ----------------------------------------------------- | -------- | ---------------- |
| 5.1 | Define `ExecutorShimHook` interface                   | 🔴 High   | 0.5 session      |
| 5.2 | Implement `ExecutorShimRegistry` in ASLExecutor       | 🔴 High   | 1 session        |
| 5.3 | Migrate all existing `hardwareCall` handlers to hooks | 🟡 Medium | 1 session        |
| 5.4 | Plugin auto-discovery from `plugins/<lang>/shims/`    | 🟢 Low    | 0.5 session      |

---

## 10. Extension Guide: Adding a New Shim

### Step-by-Step Checklist

When adding a new peripheral (e.g., a DS18B20 temperature sensor):

#### Step 1: Choose the Layer
DS18B20 uses 1-Wire protocol → needs `onewire_shim` (L3) + `ds18b20_shim` (L2).

#### Step 2: Create ShimDefinitions (for each language)

```
plugins/c/shims/sensor/ds18b20_shim.ts
plugins/python/shims/sensor/ds18b20_shim.ts
plugins/rust/shims/sensor/ds18b20_shim.ts
```

Each file exports a `ShimDefinition` with the appropriate `#include` / `import` / `use`.

#### Step 3: Register in language index

```typescript
// plugins/c/shims/index.ts
import { ds18b20_shim } from './sensor/ds18b20_shim';
shimManager.registerShim(ds18b20_shim);
```

#### Step 4: Parser Recognition

Update each parser to recognize the library's API calls:
- **CParser**: `sensors.getTempCByIndex(0)` → `CallExpression { callee: 'DS18B20.getTemp', args: [0] }`
- **PythonParser**: `ds.convert_temp()` → same ASL call
- **RustParser**: `sensor.read_temperature()` → same ASL call

#### Step 5: ASLExecutor Dispatch

Add handler to the executor (or to the `ExecutorShimRegistry` when v2 ships):

```typescript
case 'DS18B20.getTemp':
  return ctx.engine.emit('hardwareCall', { callee: 'DS18B20.getTemp', args }) ?? 22.5;
```

#### Step 6: SimulationEngine/UI Integration

Create a virtual temperature sensor widget that lets the user drag a slider to simulate temperature values.

#### Step 7: Generator Shim Injection

Each generator calls `shimManager.requireShim('ds18b20')` when it detects usage, injecting the appropriate `#include` / `import`.

#### Step 8: Parity Tests

Create test fixtures under `tests/shims/ds18b20/` with identical C++, Python, and Rust code that read a temperature, and verify they all produce the same ASL and engine state.

#### Step 9: Documentation

Add the shim to this catalog (Section 4) and to `notyet/README.md`.

---

## 11. Extension Guide: Adding a New Board

### Step-by-Step Checklist

When adding support for a new microcontroller (e.g., STM32F4):

#### Step 1: Define Board Profile

```typescript
const stm32f4Profile: BoardProfile = {
  id: 'stm32f4',
  name: 'STM32F411 (Black Pill)',
  availableShims: ['gpio_digital', 'gpio_analog', 'i2c_bus', 'spi_bus', 'uart_hw', 'hw_timer'],
  pinMap: { 'LED_BUILTIN': 13, 'USER_BUTTON': 0 },
  capabilities: ['gpio', 'adc', 'pwm', 'i2c', 'spi', 'uart'],
  memoryLimits: { flash: 512 * 1024, sram: 128 * 1024 },
};
```

#### Step 2: Create Board-Specific Pin Map

The board profile's `pinMap` allows named pins to resolve to physical numbers, so ASL code using `LED_BUILTIN` works on any board.

#### Step 3: Register Available Shims

Not all boards support all shims. ESP32 has WiFi; Arduino Uno does not. The profile's `availableShims` array controls this.

#### Step 4: Add to Board Selector UI

The UI presents a dropdown of boards. Selecting one loads the profile and validates the current ASL program against available shims.

#### Step 5: Validation Warnings

If the user's code uses `WiFi.begin()` on an Arduino Uno, the system shows:
> ⚠️ `wifi_shim` is not available on Arduino Uno. This code requires ESP32 or Pico W.

---

## 12. Test Strategy (Cross-Language Semantic Parity)

### 12.1. Test Pyramid

```
                 ┌─────────────────────┐
                 │  CI Integration     │  ← Full system tests (CI-1 to CI-21)
                 │  Tests              │
                ─┼─────────────────────┼─
                 │  Shim Parity Tests  │  ← Per-shim, per-language (Section 8.2)
                 │                     │
              ───┼─────────────────────┼───
                 │  Unit Tests         │  ← ShimManager, I2CBus, individual shims
                 │                     │
              ───┴─────────────────────┴───
```

### 12.2. Shim Parity Test: I2C Example

**Objective**: Write a byte to an I2C expander to turn on an LED.

**C++ Input (Arduino)**
```cpp
#include <Wire.h>
void setup() { Wire.begin(); }
void loop() {
  Wire.beginTransmission(0x27);
  Wire.write(0xFF);
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
loop {
    let _ = i2c.write(0x27, &[0xFF]).await;
    Timer::after_millis(1000).await;
}
```

**Validation Criteria**:
1. All three languages compile successfully to ASL.
2. The ASL from Python and Rust is "desugared" into the standard `Wire.beginTransmission` → `Wire.write` → `Wire.endTransmission` sequence.
3. The `SimulationEngine` registers an I2C write of `0xFF` to address `0x27` every 1000ms.

### 12.3. Automated Test Runner

```bash
# Run all shim parity tests
npm run test:shims

# Run specific shim
npm run test:shims -- --shim=i2c_bus

# Run parity check (all languages produce same ASL)
npm run test:parity -- --fixture=i2c_write
```

---

## 13. Error Handling & Observability

### 13.1. Error Categories

| Error                       | Severity | Action                        | Example                                         |
| --------------------------- | -------- | ----------------------------- | ----------------------------------------------- |
| **Shim Not Found**          | Warning  | Return default, log           | Unknown `mySensor.read()` → returns `0`         |
| **Board Incompatible**      | Error    | Block execution, show message | `WiFi.begin()` on Arduino Uno                   |
| **Bus No Device**           | Warning  | Return NACK code              | I2C `endTransmission()` to unregistered address |
| **Pin Conflict**            | Warning  | Log conflict                  | Two peripherals claiming same pin               |
| **Shim Dependency Missing** | Error    | Fail at registration          | `oled_ssd1306` without `i2c_bus` registered     |

### 13.2. Structured Logging

All shim operations should emit structured log events:

```typescript
interface ShimLogEvent {
  timestamp: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  shim: string;        // 'i2c_bus', 'servo'
  action: string;      // 'write', 'read', 'init'
  details: any;        // { addr: 0x27, data: [0xFF] }
}
```

This enables:
- **Teaching mode**: Show students what the hardware is doing step by step.
- **Debug mode**: Trace all hardware interactions for the serial monitor.
- **Protocol analyzer**: Visualize I2C/SPI transactions in the UI.

### 13.3. Observability Dashboard (Future)

```
┌── Protocol Analyzer ──────────────────────────────────┐
│ I2C Bus:                                               │
│  [0.000s] BEGIN TRANSMISSION → 0x27                   │
│  [0.001s] WRITE 0xFF                                   │
│  [0.001s] END TRANSMISSION → ACK (0)                   │
│  [1.001s] BEGIN TRANSMISSION → 0x27                   │
│  ...                                                   │
├── GPIO State ──────────────────────────────────────────┤
│  Pin 13: OUTPUT = HIGH  │  Pin 2: INPUT = LOW          │
│  Pin 11: PWM = 128      │  Pin A0: ADC = 512           │
└────────────────────────────────────────────────────────┘
```

---

## 14. Performance & Scalability

### 14.1. Constraints

The ASLExecutor runs in the browser's main thread (with `setTimeout` yields). Performance considerations:

| Concern                           | Mitigation                                                  |
| --------------------------------- | ----------------------------------------------------------- |
| Many I2C transactions/sec         | Batch writes, coalesce UI updates                           |
| Large NeoPixel strips (300+ LEDs) | Throttle `show()` to 30fps, use `requestAnimationFrame`     |
| RTOS task switching               | Cooperative yield with `setTimeout(0)`, max 10 tasks        |
| Protocol analyzer logging         | Ring buffer with configurable max entries (default 1000)    |
| Shim registry lookup              | `Map<string>` with O(1) lookup; pre-compile RegExp matchers |

### 14.2. Memory Budget

| Component          | Budget                   | Strategy                                |
| ------------------ | ------------------------ | --------------------------------------- |
| I2C Bus buffers    | 256 bytes per device     | Fixed-size circular buffer              |
| SPI transfer       | 4096 bytes max           | Hard limit with error on exceed         |
| Virtual filesystem | 64KB per file, 1MB total | Configurable per board profile          |
| EEPROM simulation  | Matches real board size  | From `BoardProfile.memoryLimits.eeprom` |

---

## 15. Future Roadmap (v2, v3, v4)

### 15.1. Shim Architecture v2 — Plugin SDK

> **Target**: Q3 2026

- **Shim Plugin API**: Third parties can create custom shims (e.g., for proprietary sensors):
  ```typescript
  // my-custom-sensor.shim.ts
  export default defineShim({
    name: 'CustomSensor',
    layer: 'L2',
    category: 'sensor',
    protocols: ['i2c'],           // declares bus dependencies
    address: 0x48,                // I2C address
    executor: {
      callees: ['CustomSensor.read', 'CustomSensor.begin'],
      handler: async (callee, args, ctx) => { /* ... */ },
    },
    generators: {
      c: { code: '#include <CustomSensor.h>' },
      python: { code: 'from custom_sensor import CustomSensor' },
      rust: { code: 'use custom_sensor::CustomSensor;' },
    },
    ui: {
      widget: 'slider',
      range: [0, 100],
      label: 'Sensor Value',
    },
  });
  ```
- **Shim Marketplace**: Community-contributed shim packages, installable via UI.
- **Auto-Detection**: Parser heuristics that auto-require shims based on `#include` / `import` / `use` statements without explicit handler code.

### 15.2. Shim Architecture v3 — Multi-Node Simulation

> **Target**: Q1 2027

- **Multiple Boards**: Simulate two or more microcontrollers communicating over shared buses.
- **Virtual Network**: WiFi/BLE/ESP-NOW communication between simulated nodes.
- **Shared I2C Bus**: Two boards sharing the same I2C bus with address arbitration.
- **MQTT Broker Simulation**: In-browser MQTT broker for multi-node IoT projects.

### 15.3. Shim Architecture v4 — Hardware-in-the-Loop

> **Target**: Q3 2027

- **Serial Passthrough**: Connect a real microcontroller via WebSerial to bridge simulated and real hardware.
- **Hybrid Simulation**: Some peripherals simulated, some real (e.g., real sensor data feeding into simulated logic).
- **QEMU Bridge**: Connect the ASL shim layer to QEMU for cycle-accurate simulation of AVR/ARM firmware.

### 15.4. Cross-Cutting Future Features

| Feature                   | Description                                                           | Depends On      |
| ------------------------- | --------------------------------------------------------------------- | --------------- |
| **Shim Versioning**       | Each shim declares a semver; breaking changes handled via migration   | ShimManager v2  |
| **Timing Accuracy**       | Microsecond-accurate timer simulation via Web Workers                 | `hw_timer_shim` |
| **Power Profiling**       | Estimate mA consumption per shim call; display battery-life estimates | Board Profiles  |
| **Wiring Validator**      | Verify that physical connections match code expectations              | Pin Map + UI    |
| **Interactive Tutorials** | Step-by-step guided lessons that highlight shim calls                 | Observability   |
| **ASL Linter**            | Warn about common mistakes (wrong pin mode, missing begin(), etc.)    | All L1/L2 shims |
| **Shim Coverage Report**  | Show which shims are tested and which need parity tests               | Test runner     |

---

## 16. Value Proposition

By formalizing the Middle Path:

1. **DRY Simulation**: We don't need a "Rust I2C Simulator" and a "Python I2C Simulator". The engine only speaks ASL-Shim.
2. **True Parity**: Teaching materials can show C++, Python, and Rust code side-by-side, proving they do the *exact same thing* under the hood.
3. **Decoupled Architecture**: Parsers handle syntax. ASL handles logic. Shims handle the physical world.
4. **Predictable Extension**: Adding a new device = creating 3 files + 1 executor handler + 1 UI widget. No architectural changes needed.
5. **Board Portability**: Switch boards with a dropdown. The same ASL code runs on Arduino Uno, ESP32, or RPi Pico — with appropriate shim availability warnings.
6. **Educational Power**: Students see not just *what* the code does, but *how* the hardware responds — with protocol analyzers, pin state views, and structured logs.
7. **Future-Ready**: The plugin SDK (v2) allows the community to extend NeuroForge without modifying core code.

---

## Appendix A: Decision Log

| Date     | Decision                                                           | Rationale                                                   | Status    |
| -------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | --------- |
| Feb 2026 | Use `engine.emit('hardwareCall', ...)` for all peripheral dispatch | Keeps ASLExecutor decoupled from specific devices           | ✅ Active  |
| Feb 2026 | ShimManager operates per-language with shared interface            | Each language needs different `#include`/`import` syntax    | ✅ Active  |
| Mar 2026 | Introduce formal shim layers (L1–L5)                               | Prevents circular dependencies, clarifies integration order | ✅ Active  |
| Mar 2026 | Protocol shims model the bus, not the device                       | Allows user-written drivers and generic device support      | 📋 Planned |
| Mar 2026 | Board Profiles to parameterize available shims                     | Prevents unrealistic simulations (WiFi on Arduino Uno)      | 📋 Planned |
| TBD      | Executor Shim Registry to replace if/else chains                   | Scalability and plugin support                              | 📋 Planned |
| TBD      | Shim Plugin SDK for third-party extensions                         | Community growth, educational ecosystem                     | 📋 Planned |

---

## Appendix B: Glossary

| Term                   | Definition                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **ASL**                | Abstract Simulation Language — the universal IR for NeuroForge                           |
| **Shim**               | A virtual translation layer that maps hardware API calls to simulation behavior          |
| **Middle Path**        | The design principle that separates what IS a shim from what IS NOT                      |
| **ShimDefinition**     | A TypeScript interface declaring a shim's name, code, description, and dependencies      |
| **ShimManager**        | The class that orchestrates shim registration, dependency resolution, and code injection |
| **Board Profile**      | A configuration declaring which shims and capabilities a specific board supports         |
| **VirtualI2CDevice**   | An interface for simulated devices that respond to I2C bus transactions                  |
| **Executor Shim Hook** | A function registered to handle specific `callee` patterns during ASL execution          |
| **Parity Test**        | A test that verifies identical hardware behavior across C++, Python, and Rust            |
| **Generator Shim**     | Code injected into generated output (e.g., `#include <Wire.h>`)                          |
| **Executor Shim**      | Logic dispatched at runtime to simulate hardware behavior                                |
| **L1–L5**              | The five layers of shim abstraction, from Core IO to Connectivity                        |
