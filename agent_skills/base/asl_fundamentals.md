# ASL Fundamentals

> Low-confidence fallback skill for general ASL transpilation

## Purpose

This skill is used when confidence is below the threshold or when no specific board/language skill is available. It provides basic transpilation rules that work across most platforms but may not be optimized for specific hardware.

## When to Use

- `confidence_floor` below 0.5
- Unknown board family
- Platform not recognized
- Fallback for unsupported targets

## Code Generation Rules

### Basic Structure

Generate standard ASL-compatible code that works on most platforms:

```c
// C/Arduino
void setup() {}
void loop() {}
```

```rust
// Rust embassy
fn main() {}
```

```python
# Python/MicroPython
def main():
    pass
```

### Standard Library Includes

- C: `<Arduino.h>`
- Rust: `embassy_*` crates
- Python: `machine`, `time` modules

### Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Unknown board | -0.2 |
| Generic target | -0.15 |
| No specific optimizations | -0.1 |

### Limitations

- No board-specific pin mappings
- No optimized peripheral initialization
- No hardware-specific timing
- Generic delays and timeouts

## Example Output

```c
// Generic C output
void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}
```
