# Rust Embassy Generic

> Code generation skill for Rust with Embassy on generic ARM boards

## Purpose

Generate compatible Rust code using Embassy async framework for generic ARM Cortex-M boards not covered by specific skills.

## Board Compatibility

- **Family**: `generic-arm-family`
- **Platform**: `rust-embassy`
- **MCUs**: Various ARM Cortex-M based boards

## Code Generation Rules

### Dependencies (Cargo.toml)

```toml
[dependencies]
embassy-generic = "0.1"
embassy-time = "0.3"
embassy-futures = "0.2"
cortex-m = "0.7"
cortex-m-rt = "0.7"
```

### Generic Setup

```rust
use cortex_m_rt::entry;
use embassy_time::Timer;

#[entry]
fn main() {
    // Board initialization
    let p = /* board init */;
    
    // Main loop
    loop {
        // Code
    }
}
```

### Generic Peripherals

```rust
// Use standard Embassy patterns
use embassy::prelude::*;

// Try to initialize commonly available peripherals
let gpio = // Initialize GPIO;
// Try I2C, SPI, UART if available
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard Embassy patterns | +0.0 |
| Using LED_BUILTIN | +0.05 |
| Unknown board constraints | -0.2 |
| Non-standard configurations | -0.1 |

## Example Output

```rust
use cortex_m_rt::entry;

#[entry]
fn main() {
    // Simple LED blink - generic pattern
    let led = /* get LED pin */;
    
    loop {
        // Toggle LED
        // Delay
    }
}
```

## Constraints

- Assume 3.3V logic unless specified
- No board-specific optimizations
- Use standard Embassy patterns
- Limited hardware knowledge