# Rust Embassy ESP32-C3

> Code generation skill for Rust with Embassy on Espressif ESP32-C3 (RISC-V)

## Purpose

Generate optimized Rust code using Embassy async framework for ESP32-C3 RISC-V microcontrollers.

## Board Compatibility

- **Family**: `esp32c3-family`
- **Platform**: `rust-embassy`
- **MCUs**: ESP32-C3, ESP32-C3-MINI

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
esp32c3-hal = "0.15"
embassy-esp32 = "0.4"
embassy-time = "0.3"
embassy-futures = "0.2"
esp-hal = "0.15"
```

### Pin Configuration

```rust
use esp_hal::prelude::*;
use esp_hal::gpio::{GpioPin, Output};

let led = GpioPin::<8>::new(Output::new(Level::Low));
```

### RISC-V Specific

```rust
// ESP32-C3 is single-core RISC-V
// Use embassy executor
use embassy_executor::Executor;

static EXECUTOR: StaticCell<Executor> = StaticCell::new();
```

### USB CDC Support

```rust
use esp_hal::usb::Serial;

// Enable USB CDC in Cargo.toml features
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Embassy async patterns | +0.0 |
| RISC-V specific optimizations | +0.05 |
| USB CDC usage | +0.1 |
| WiFi integration | +0.1 |

## Example Output

```rust
use esp_hal::prelude::*;
use esp_hal::gpio::Level;
use embassy_time::Timer;

#[entry]
fn main() {
    let p = esp_hal::init(Default::default());
    let mut led = p.gpio8.into_output();

    loop {
        led.set_high();
        Timer::after_millis(500).await;
        led.set_low();
        Timer::after_millis(500).await;
    }
}
```

## Constraints

- Single core RISC-V only
- 4KB SRAM (tight constraints)
- USB OTG available
- 3.3V logic only