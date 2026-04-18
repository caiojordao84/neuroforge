# AVR Family Skill

> **Hardware Family:** Atmel/Microchip AVR (8-bit)
> **Primary Targets:** ATmega328P, ATmega2560, ATtiny series

---

## 🏗️ Architecture constraints

- **Word Size:** 8-bit
- **Memory Model:** Harvard Architecture (Flash, SRAM, EEPROM are separate spaces)
- **Interrupts:** Vector-based, single priority level
- **Timers:** Typically 8-bit or 16-bit with limited PWM frequencies

## 🧠 ASL Mapping Rules

### Digital I/O
- Maps to `PORT`, `DDR`, `PIN` registers in C++ (Arduino Core)
- High Current support on most pins (~20mA)

### Analog Performance
- **ADC Resolution:** 10-bit (0-1023)
- **Reference Voltages:** Default (VCC), Internal (1.1V/2.56V)

### I2C / SPI
- Hardware-backed on specific pins (e.g., A4/A5 on UNO)
- Limited buffer sizes in Wire library (32 bytes)

## ⚠️ Known Issues / Warnings
- **RAM Pressure:** Extremely limited SRAM (2KB on Nano/Uno). Avoid deep recursion and dynamic allocation.
- **Floating Point:** No FPU. Calculations should use `FixedPoint` or `int` whenever possible to save cycles.
