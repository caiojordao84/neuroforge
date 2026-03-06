# Blockly vs ASL Gap Analysis

This document provides a comprehensive comparison between the capabilities of the **Antigravity Scripting Language (ASL)** and the current implementation of **Blockly** in NeuroForge.

## Overview
While Blockly provides a user-friendly interface for basic logic and hardware control, there is a significant gap in support for advanced ASL features, particularly in control flow, complex data structures, and industrial (PLC) services.

## Capability Comparison Table

| Feature Category      | ASL Support                                                       | Blockly Support                              | Status                                                                        |
| :-------------------- | :---------------------------------------------------------------- | :------------------------------------------- | :---------------------------------------------------------------------------- |
| **Control Flow**      | If, While, Do-While, For, For-In, Switch, Break, Continue, Return | If, While, For, For-In                       | ⚠️ Missing: Do-While, Switch, Break, Continue, Return                          |
| **Data Structures**   | Arrays (1D, 2D, 3D), Structs, Members, Pointers                   | 1D Lists (Partial)                           | ❌ Missing: 2D/3D Matrix, Explicit Structs, Struct Members (get/set), Pointers |
| **Memory Management** | Explicit Declarations, Global vs Local                            | Automatic Variables                          | ⚠️ Missing: Explicit Global/Local scope toggle                                 |
| **Hardware IO**       | pinMode, digitalWrite, analogWrite, reads                         | nf_gpio_set, nf_digital_read, nf_analog_read | ✅ Core support is functional                                                  |
| **Communication**     | UART, I2C, SPI                                                    | None                                         | ❌ Missing: All bus communication blocks                                       |
| **PLC / IEC 61131**   | Timers (TON/TOF/TP), Counters, Latches, Triggers                  | None                                         | ❌ Missing: All industrial automation blocks                                   |
| **Specialized Nodes** | LCD, OLED, RGB, NeoPixel, Servo, Tone                             | nf_lcd, nf_oled, nf_rgb, etc.                | ✅ Good coverage of high-level abstractions                                    |
| **Expressions**       | Literal, Binary, Unary, Call, Conditional (?:)                    | Math, Logic, Call                            | ⚠️ Missing: Ternary operator and complex expressions                           |

---

## Detailed Gap Details

### 1. Control Flow Gaps
ASL supports the full range of C-style control flow, but Blockly is currently limited to:
- **Missing `Switch/Case`**: Essential for state machines.
- **Missing `Break/Continue`**: Required for efficient loop control.
- **Missing `Return`**: Blockly cannot currently exit functions with a value.
- **Missing `Do-While`**: Loops that must execute at least once.

### 2. Specialized Peripheral Services (S5)
The most significant "missing" category. ASL has dedicated statements for:
- **Timers**: `timerTON`, `timerTOF`, `timerTP`.
- **Counters**: `counterCTU`, `counterCTD`.
- **Latches/Triggers**: `latchSR`, `latchRS`, `trigR`, `trigF`.
- **Bus Communication**: Support for UART, I2C, and SPI is entirely absent in the current Blockly toolbox.

### 3. Structural & Data Gaps
- **Arrays**: ASL supports 2D and 3D indexing, but Blockly only handles 1D.
- **Structs**: There are no blocks to define or interact with structured data types.
- **Tasks**: ASL's concept of cooperative tasks is not yet surfaced in the Blockly UI.

## Recommendations
To achieve parity with ASL, the following blocks should be prioritized for implementation:
1. **PLC Category**: Add Timer/Counter blocks for industrial automation parity.
2. **Control Category**: Add Switch/Case and Loop control (Break/Continue).
3. **Data Category**: Add blocks for Struct field access and Multi-dimensional arrays.
4. **Comm Category**: Add basic UART/I2C/SPI blocks.
