# RP2040 Family Skill

> **Hardware Family:** Raspberry Pi RP2040 (32-bit ARM Cortex-M0+)
> **Primary Targets:** Raspberry Pi Pico, Arduino Nano RP2040 Connect

---

## 🏗️ Architecture constraints

- **Cores:** Dual Cortex-M0+ (133MHz default)
- **PIO (Programmable I/O):** 2 blocks with 4 state machines each (Master ASL feature)
- **Memory:** 264KB SRAM, external QSPI Flash
- **USB:** Native USB 1.1 support (Host/Device)

## 🧠 ASL Mapping Rules

### Programmable I/O (PIO)
- Used for high-speed bit-banging (DSHOT, I2S, Hub75, WS2812)
- ASL transpiler targets PIO ASM for complex timing blocks

### ADC / Digital
- **ADC Resolution:** 12-bit (0-4095)
- All GPIOs support PWM hardware

### Interpolator / SIO
- Hardware division and interpolation modules accessible via fast instructions

## ⚠️ Known Issues / Warnings
- **ADC Cross-talk:** Known noise issues especially when switching adjacent GPIOs.
- **Multicore Sync:** Ensure usage of Mutex/Queue for inter-core communication.
- **Bootloader:** Default is UF2 via USB Mass Storage.
