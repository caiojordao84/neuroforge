# RP2040 Blink Test Firmware

Minimal LED blink example to validate RP2040 QEMU emulation.

---

## Features

- **GPIO 25 toggle** (onboard LED on Raspberry Pi Pico)
- **UART output** for debugging
- **No SDK dependencies** - direct register access
- **Minimal code** - easy to understand

---

## Build Requirements

- `arm-none-eabi-gcc` (ARM cross-compiler)
- GNU Make
- QEMU with RP2040 support

### Install Toolchain (MSYS2)

```bash
pacman -S mingw-w64-x86_64-arm-none-eabi-gcc
pacman -S mingw-w64-x86_64-arm-none-eabi-newlib
pacman -S make
```

---

## Build

```bash
cd firmware/rp2040/examples/blink
make
```

Output:
- `blink.elf` - ELF executable
- `blink.bin` - Raw binary
- `blink.map` - Memory map

---

## Run in QEMU

### Quick Start

```bash
make run
```

Expected output:

```
=================================
  RP2040 Blink Test (QEMU)
  GPIO 25 Toggle
=================================

LED initialized. Starting blink...

[LED ON]  0
[LED OFF] 0
[LED ON]  1
[LED OFF] 1
[LED ON]  2
[LED OFF] 2
...
```

Press **Ctrl+A** then **X** to exit QEMU.

### Manual Run

```bash
qemu-system-arm.exe -M raspberrypi-pico \
  -kernel blink.elf \
  -nographic \
  -serial mon:stdio
```

---

## Debug with GDB

### Terminal 1: Start QEMU with GDB server

```bash
make debug
```

### Terminal 2: Connect GDB

```bash
gdb-multiarch blink.elf

(gdb) target remote :1234
(gdb) break main
(gdb) continue
(gdb) step
```

---

## Code Structure

```
blink/
├── main.c          # Main program (GPIO toggle + UART)
├── startup.s       # Startup code (vector table, stack init)
├── linker.ld       # Memory layout (Flash @ 0x10000000, RAM @ 0x20000000)
├── Makefile        # Build system
└── README.md       # This file
```

---

## Memory Map

| Region | Address      | Size  | Usage              |
|--------|--------------|-------|--------------------||
| Flash  | `0x10000000` | 2MB   | Code + read-only data |
| RAM    | `0x20000000` | 264KB | Stack + data + bss |

---

## Register Access

### SIO (Single-cycle I/O)

```c
#define GPIO_OUT_SET  0xD0000014  // Set GPIO bits (atomic)
#define GPIO_OUT_CLR  0xD0000018  // Clear GPIO bits (atomic)
#define GPIO_OE_SET   0xD0000024  // Enable output (atomic)
```

### IO_BANK0 (GPIO Configuration)

```c
#define GPIO25_CTRL   0x400140CC  // GPIO 25 control register
// Set bit 0-4 to 5 (FUNCSEL_SIO) for software control
```

### UART0

```c
#define UART0_DR      0x40034000  // Data register
#define UART0_FR      0x40034018  // Flag register
```

---

## Troubleshooting

### No output in QEMU

**Check:**
1. QEMU has RP2040 support: `qemu-system-arm.exe -M help | grep pico`
2. Firmware built correctly: `ls -lh blink.elf`
3. UART connected: `-serial mon:stdio` flag present

### Build errors

**Check:**
1. Toolchain installed: `arm-none-eabi-gcc --version`
2. Correct directory: `pwd` should end with `/blink`
3. Clean build: `make clean && make`

### QEMU crashes

**Check:**
1. QEMU version: `qemu-system-arm.exe --version`
2. RP2040 patches applied correctly
3. Run with debug: `make debug` and check GDB output

---

## Next Steps

- ✅ Basic GPIO toggle working
- ⏳ Add UART input (echo test)
- ⏳ Test multiple GPIO pins
- ⏳ Implement simple SPI/I2C
- ⏳ Validate interrupt handling

---

## License

Public Domain / MIT - Use freely!
