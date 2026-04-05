# Rust Embassy ESP32

> Code generation skill for Rust with Embassy on Espressif ESP32

## Purpose

Generate optimized Rust code using Embassy async framework for ESP32 (Xtensa) microcontrollers.

## Board Compatibility

- **Family**: `esp32-family`
- **Platform**: `rust-embassy`
- **MCUs**: ESP32 (ESP-WROOM-32), ESP32-S2, ESP32-S3

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
esp32-hal = "0.21"
embassy-esp32 = "0.4"
embassy-time = "0.3"
embassy-futures = "0.2"
esp-hal = "0.21"
```

### Pin Configuration

```rust
use esp_hal::prelude::*;
use esp_hal::gpio::{GpioPin, Output};

let led = GpioPin::<2>::new(Output::new(Level::Low));
```

### WiFi Support

```rust
use embassy_esp32::wifi::Wifi;

let wifi = Wifi::new(...);
wifi.connect("SSID", "password").await;
```

### Async Runtime

```rust
use embassy_executor::Executor;
use esp_hal::interrupt;

static EXECUTOR: StaticCell<Executor> = StaticCell::new();

#[entry]
fn main() {
    let executor = EXECUTOR.init(Executor::new());
    executor.run(|spawner| {
        spawner.spawn(async_main()).ok();
    });
}

async fn async_main() {
    // Main async code
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Embassy async patterns | +0.0 |
| WiFi integration | +0.1 |
| Using ESP-IDF components | +0.05 |
| Proper async executor setup | +0.1 |

## Example Output

```rust
use esp_hal::prelude::*;
use esp_hal::gpio::Level;
use embassy_time::Timer;

#[entry]
fn main() {
    let p = esp_hal::init(Default::default());
    let mut led = p.gpio2.into_output();

    loop {
        led.set_high();
        Timer::after_millis(500).await;
        led.set_low();
        Timer::after_millis(500).await;
    }
}
```

## Constraints

- Dual core (Xtensa)
- ADC2 unavailable during WiFi
- 3.3V logic only
- WiFi/BLE coexistence limited