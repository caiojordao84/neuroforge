# C/C++ Generic

> Code generation skill for generic C/C++ code generation

## Purpose

Generate generic C/C++ code for embedded systems without specific framework dependencies.

## Target Platforms

- **Platform**: `c-cpp-generic`
- **MCUs**: Any embedded MCU with C/C++ compiler

## Code Generation Rules

### Basic Structure

```c
#include <stdint.h>
#include <stdbool.h>

void system_init(void);
void main_loop(void);

int main(void) {
    system_init();
    while (1) {
        main_loop();
    }
    return 0;
}
```

### Standard Includes

```c
#include <stdint.h>   // Fixed-width types
#include <stdbool.h>  // Boolean type
#include <stdio.h>    // Standard I/O
#include <string.h>   // String functions
```

### GPIO Operations

```c
#define LED_PIN (1 << 5)

void gpio_init(void) {
    DDRB |= LED_PIN;  // Set as output
}

void gpio_toggle(void) {
    PORTB ^= LED_PIN;
}
```

### Delay Functions

```c
void delay_ms(uint32_t ms) {
    // Implement based on clock
    for (uint32_t i = 0; i < ms * 1000; i++) {
        __asm__("nop");
    }
}
```

### Interrupt Handlers

```c
void __attribute__((interrupt)) timer_isr(void) {
    // ISR code
}
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Standard C99/C11 features | +0.0 |
| Platform-specific code | -0.1 |
| Proper type usage | +0.1 |
| Memory safety | +0.1 |

## Example Output

```c
#include <stdint.h>
#include <stdbool.h>

#define F_CPU 16000000UL
#include <util/delay.h>

#define LED_PIN PB5

int main(void) {
    DDRB |= (1 << LED_PIN);
    
    while (1) {
        PORTB |= (1 << LED_PIN);
        _delay_ms(500);
        PORTB &= ~(1 << LED_PIN);
        _delay_ms(500);
    }
}
```

## Constraints

- No framework provided
- Must define all I/O registers
- No async/threading by default
- Manual memory management