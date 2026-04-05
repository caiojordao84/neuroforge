# Rust Embassy RP2040

> Code generation skill for Rust with Embassy on Raspberry Pi RP2040

## Purpose

Generate optimized Rust code using Embassy async framework for RP2040 microcontrollers.

## Board Compatibility

- **Family**: `rp2040-family`
- **Platform**: `rust-embassy`
- **MCUs**: RP2040, RP2350

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
embassy-rp = "0.2"
embassy-time = "0.3"
embassy-futures = "0.2"
embassy-sync = "0.6"
cortex-m = "0.7"
cortex-m-rt = "0.7"
```

### Pin Configuration

```rust
use embassy_rp::prelude::*;
use embassy_rp::gpio::{Input, Output, Pull};

let mut led = Output::new(pins.gpio25, Level::Low);
let button = Input::new(pins.gpio2, Pull::Up);
```

### Multicore Support

```rust
// Core 0
#[entry]
async fn main(_spawner: Spawner) {}

// Core 1 - separate binary entry
#[cortex_m_rt::entry]
fn main() {
    // Core 1 entry
}
```

### Peripherals

```rust
use embassy_rp::i2c::I2c;
use embassy_rp::spi::Spi;

let i2c = I2c::new(pins.i2c0, ...);
let spi = Spi::new(pins.spi0, ...);
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Embassy async patterns | +0.0 |
| Multicore usage | +0.15 |
| DMA for data transfer | +0.1 |
| PIO programming | +0.15 |

## Example Output

```rust
use embassy_rp::prelude::*;
use embassy_rp::gpio::{Output, Level};
use embassy_time::Timer;
use embassy_rp::entry;

#[entry]
async fn main(spawner: Spawner) {
    let p = embassy_rp::init(Default::default());
    let mut led = Output::new(p.PIN_25, Level::Low);

    loop {
        led.set_high();
        Timer::after_millis(500).await;
        led.set_low();
        Timer::after_millis(500).await;
    }
}
```

## Constraints

- 264KB SRAM total
- Two cores available
- PWM on all GPIO
- Flash XIP support