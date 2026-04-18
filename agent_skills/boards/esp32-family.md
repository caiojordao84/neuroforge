# ESP32 Family Skill

> **Hardware Family:** Espressif ESP32 (32-bit Xtensa/RISC-V)
> **Primary Targets:** ESP32, ESP32-S series, ESP32-C series

---

## 🏗️ Architecture constraints

- **Cores:** Dual or Single Core (up to 240MHz)
- **Memory:** Shared IRAM/DRAM, external Flash/PSRAM support
- **Connectivity:** Integrated Wi-Fi 4 + BT 5.x / BLE
- **Peripheral Matrix:** Flexible GPIO mapping (IO MUX)

## 🧠 ASL Mapping Rules

### Digital I/O
- Most pins support 3.3V only (not 5V tolerant)
- Pull-up/Pull-down software-configurable on most GPIOs

### PWM / Analog
- **LEDC:** High-resolution hardware PWM (up to 20-bit)
- **ADC:** 12-bit (0-4095), non-linear response (requires calibration lookup)

### Deep Sleep
- ULP (Ultra-Low Power) co-processor support
- RTC Memory persists across resets

## ⚠️ Known Issues / Warnings
- **ADC Noise:** Known nonlinearity and noise on ESP32 original ADC. Use multisampling or calibration.
- **Task Watchdog:** In FreeRTOS, tasks must yield to prevent WDT resets (especially on Core 0).
- **Wi-Fi Stability:** Ensure decoupling capacitors are near the module to handle Wi-Fi peaks (~400mA).
