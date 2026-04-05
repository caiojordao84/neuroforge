# Rust Embassy AVR

> Code generation skill for Rust with Embassy on AVR microcontrollers

## Purpose

Generate optimized Rust code using Embassy async framework for AVR-family microcontrollers.

## Board Compatibility

- **Family**: `avr-family`
- **Platform**: `rust-embassy`
- **MCUs**: ATmega328P, ATmega2560, ATtiny85

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
embassy-avr = { version = "0.2", features = ["defmt"] }
embassy-time = "0.3"
embassy-futures = "0.2"
```

### Pin Configuration

```rust
use embassy_avr::prelude::*;
use embassy_avr::gpio::{Input, Output, Pull};

let led = Output::new(pins.d13, Level::Low);
let button = Input::new(pins.d2, Pull::Up);
```

### Async Main

```rust
use embassy_avr::entry;

#[entry]
async fn main(_spawner: Spawner) {
    // Async code here
}
```

### Timers

```rust
use embassy_time::{Timer, Duration};

Timer::after(Duration::from_secs(1)).await;
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Embassy async patterns | +0.0 |
| Using futures correctly | +0.1 |
| AVR memory constraints | -0.1 |
| Proper async/await usage | +0.05 |

## Example Output

```rust
use embassy_avr::prelude::*;
use embassy_avr::gpio::{Output, Level};
use embassy_time::Timer;
use embassy_avr::entry;

#[entry]
async fn main(spawner: Spawner) {
    let mut p = embassy_avr::default_config!();
    let mut led = Output::new(p.d13, Level::Low);

    loop {
        led.set_high();
        Timer::after_millis(500).await;
        led.set_low();
        Timer::after_millis(500).await;
    }
}
```

## Constraints

- Limited RAM (2KB typical)
- No true parallelism on AVR
- Async executor overhead
- Limited flash memory