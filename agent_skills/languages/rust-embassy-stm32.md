# Rust Embassy STM32

> Code generation skill for Rust with Embassy on STMicroelectronics STM32

## Purpose

Generate optimized Rust code using Embassy async framework for STM32 microcontrollers.

## Board Compatibility

- **Family**: `stm32-family`
- **Platform**: `rust-embassy`
- **MCUs**: STM32F103, STM32F401, STM32F411, STM32L476, STM32H743

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
embassy-stm32 = "0.2"
embassy-time = "0.3"
embassy-futures = "0.2"
cortex-m = "0.7"
cortex-m-rt = "0.7"
```

### Pin Configuration

```rust
use embassy_stm32::prelude::*;
use embassy_stm32::gpio::{Input, Output, Pull};

let led = Output::new(pins.pc13, Level::Low);
let button = Input::new(pins.pa0, Pull::Up);
```

### Peripherals

```rust
use embassy_stm32::i2c::I2c;
use embassy_stm32::spi::Spi;
use embassy_stm32::usart::Uart;

let i2c = I2c::new(pins.i2c1, ...);
let spi = Spi::new(pins.spi1, ...);
```

### USB Support

```rust
use embassy_stm32::usb::Usb;

let usb = Usb::new(pins.pa11, pins.pa12, ...);
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Embassy async patterns | +0.0 |
| STM32 HAL integration | +0.1 |
| Low power modes | +0.15 |
| USB/OTG usage | +0.1 |

## Example Output

```rust
use embassy_stm32::prelude::*;
use embassy_stm32::gpio::{Output, Level};
use embassy_time::Timer;
use embassy_stm32::entry;

#[entry]
async fn main(spawner: Spawner) {
    let p = embassy_stm32::init(Default::default());
    let mut led = Output::new(p.PC13, Level::Low);

    loop {
        led.set_high();
        Timer::after_millis(500).await;
        led.set_low();
        Timer::after_millis(500).await;
    }
}
```

## Constraints

- Pin naming varies by board
- Some series have limited RAM
- 3.3V logic only (most models)
- Various peripheral configurations