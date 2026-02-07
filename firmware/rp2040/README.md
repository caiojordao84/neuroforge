# 🔥 RP2040 Firmware Examples

## 📋 Overview

Firmware examples for Raspberry Pi Pico (RP2040) running on QEMU.

---

## 📁 Structure

```
firmware/rp2040/
├── README.md              # This file
├── common/                # Shared code
│   ├── rp2040.h           # Hardware definitions
│   ├── startup.s          # Boot code (vector table)
│   └── link.ld            # Common linker script
├── examples/
│   ├── blink/             # LED blink example
│   ├── uart_echo/         # UART echo test
│   └── gpio_test/         # GPIO read/write test
└── sdk/                   # Minimal RP2040 SDK
    ├── gpio.h             # GPIO API
    ├── uart.h             # UART API
    └── timer.h            # Timer API
```

---

## 🔧 Prerequisites

### Install ARM Toolchain

**Ubuntu/Debian:**
```bash
sudo apt-get install gcc-arm-none-eabi binutils-arm-none-eabi gdb-arm-none-eabi
```

**macOS:**
```bash
brew install arm-none-eabi-gcc
```

**Windows (MSYS2):**
```bash
pacman -S mingw-w64-x86_64-arm-none-eabi-gcc
```

### Verify Installation

```bash
arm-none-eabi-gcc --version
# Should show >= 10.3
```

---

## ⚡ Quick Start

### Build Blink Example

```bash
cd firmware/rp2040/examples/blink
make
```

**Output:**
- `blink.elf` - Executable (for QEMU)
- `blink.bin` - Raw binary
- `blink.lst` - Disassembly listing

### Run on QEMU

```bash
# Direct QEMU
qemu-system-arm \
  -M raspberrypi-pico \
  -kernel blink.elf \
  -nographic

# NeuroForge CLI
neuroforge run \
  --board raspberrypi-pico \
  --firmware blink.elf \
  --monitor
```

### Debug with GDB

**Terminal 1:**
```bash
qemu-system-arm \
  -M raspberrypi-pico \
  -kernel blink.elf \
  -s -S \
  -nographic
```

**Terminal 2:**
```bash
arm-none-eabi-gdb blink.elf
(gdb) target remote :1234
(gdb) load
(gdb) break main
(gdb) continue
```

---

## 📚 Examples

### 1. Blink (GPIO)

**Path:** `examples/blink/`

**Description:**
- Blinks onboard LED (GPIO25) every 500ms
- Demonstrates GPIO output control
- Uses atomic SET/CLR operations

**Build:**
```bash
cd examples/blink && make
```

### 2. UART Echo

**Path:** `examples/uart_echo/`

**Description:**
- Echoes characters received on UART0
- Demonstrates serial communication
- 115200 baud, 8N1

**Build:**
```bash
cd examples/uart_echo && make
```

**Test:**
```bash
qemu-system-arm -M raspberrypi-pico -kernel uart_echo.elf -serial stdio
# Type characters, they will be echoed back
```

### 3. GPIO Test

**Path:** `examples/gpio_test/`

**Description:**
- Tests all GPIO operations
- SET, CLR, XOR atomic operations
- Input/output mode switching

**Build:**
```bash
cd examples/gpio_test && make
```

---

## 📝 Memory Map

```
0x00000000 - 0x00003FFF : ROM (16KB - Boot code)
0x10000000 - 0x101FFFFF : Flash (2MB - XIP)
0x20000000 - 0x20041FFF : SRAM (264KB)
0xD0000000 - 0xD00000FF : SIO (Fast GPIO)
0x40014000 - 0x40016FFF : GPIO (IO_BANK0)
0x40034000 - 0x40034FFF : UART0
0x40038000 - 0x40038FFF : UART1
0x40054000 - 0x40054FFF : Timer
```

---

## 🔍 Common Issues

### Linker Errors

**Error:** `undefined reference to '_start'`

**Fix:** Make sure `startup.s` is included in build:
```makefile
SOURCES = main.c ../common/startup.s
```

### QEMU Not Starting

**Error:** `qemu-system-arm: -M raspberrypi-pico: unknown machine type`

**Fix:** Rebuild QEMU with RP2040 support (see `qemu/README.md`)

### LED Not Blinking

**Check:**
1. GPIO25 is configured as output (`SIO_GPIO_OE`)
2. Using correct memory addresses
3. Delay function works (adjust for clock speed)

---

## 🛠️ Build System

### Compiler Flags

```makefile
CFLAGS = -mcpu=cortex-m0plus \
         -mthumb \
         -O2 \
         -g \
         -Wall \
         -Wextra \
         -nostdlib \
         -nostartfiles
```

### Linker Flags

```makefile
LDFLAGS = -T ../common/link.ld \
          -Wl,--gc-sections \
          -Wl,-Map=output.map
```

---

## 📚 Resources

- **RP2040 Datasheet:** https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf
- **Pico SDK:** https://github.com/raspberrypi/pico-sdk
- **ARM Cortex-M0+ Manual:** https://developer.arm.com/documentation/ddi0484/latest/

---

**Status:** 🟡 Active Development  
**Last Updated:** 2026-02-07
