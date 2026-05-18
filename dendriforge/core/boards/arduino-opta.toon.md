# METADATA:
project_name: arduino-opta-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

# 1. DEVICE IDENTIFICATION:
id: arduino-opta
name: Arduino Opta
manufacturer: Arduino / Finder
mcu: STM32H747XI (dual-core)
category: micro-plc
image: arduino-opta.svg
url: https://docs.arduino.cc/hardware/opta

# 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 2097152 | flash_available: 2097152 | flash_qspi: 16777216 | sram: 1048576 | eeprom: 0 | clock_m7: 480000000 | clock_m4: 240000000 | voltage: 3.3 | cores: 2 | arch: ARM Cortex-M7 + Cortex-M4
supply:
  voltage_min: 12 | voltage_max: 24 | voltage_unit: VDC | power_min_w: 0.6 | power_max_w: 2.2
dims:
  w: 49.0 | h: 90.0 | t: 59.0

# 3. VARIANTS:
# Format: variant_id | sku | ethernet | usb | rs485 | wifi | ble
variants[3]:
  - opta-lite|AFX00003|t|t|f|f|f
  - opta-rs485|AFX00001|t|t|t|f|f
  - opta-wifi|AFX00002|t|t|t|t|t

# 4. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
powerPins[4]:
  - PWR+|input|12-24|main-power
  - PWR-|input|null|ground
  - PE|null|null|protective-earth
  - 3V3|output|3.3|internal

# 5. GPIO MAP — INDUSTRIAL I/O:
# Format: pin | type | direction | analog_range | digital_range | label | roles
# Notes: All 8 inputs are configurable as digital (0–24V) or analog (0–10V)
#        Inputs have overvoltage protection and antipolarity protection
#        Outputs are electromechanical relays (NO) — 10A max each, 15A peak
#        No exposed GPIO headers — I/O via screw terminal blocks
inputs[8]:
  - I1|analog-digital|input|0-10V|0-24V|Input 1|adc:t,digital:t
  - I2|analog-digital|input|0-10V|0-24V|Input 2|adc:t,digital:t
  - I3|analog-digital|input|0-10V|0-24V|Input 3|adc:t,digital:t
  - I4|analog-digital|input|0-10V|0-24V|Input 4|adc:t,digital:t
  - I5|analog-digital|input|0-10V|0-24V|Input 5|adc:t,digital:t
  - I6|analog-digital|input|0-10V|0-24V|Input 6|adc:t,digital:t
  - I7|analog-digital|input|0-10V|0-24V|Input 7|adc:t,digital:t
  - I8|analog-digital|input|0-10V|0-24V|Input 8|adc:t,digital:t
outputs[4]:
  - O1|relay-no|output|null|250VAC/24VDC|Relay 1|max:10A,peak:15A
  - O2|relay-no|output|null|250VAC/24VDC|Relay 2|max:10A,peak:15A
  - O3|relay-no|output|null|250VAC/24VDC|Relay 3|max:10A,peak:15A
  - O4|relay-no|output|null|250VAC/24VDC|Relay 4|max:10A,peak:15A

# 6. ADC SPECS:
adc:
  resolution: 12-16bit | resolution_configurable: t | lsb_value: 166uV | input_impedance: 8900 | accuracy: 5pct | repeatability: 2pct | cycle_time: 10us

# 7. DIGITAL INPUT SPECS:
digital_input:
  freq_max: 4500Hz | threshold_low: 0-5V | threshold_high: 11-24V | filter: configurable

# 8. PERIPHERALS & CONNECTIVITY:
# Format: peripheral | param | value
peripherals[6]:
  - ethernet|standard:10/100BaseT|connector:RJ45|protocol:Ethernet,Modbus-TCP
  - usb|type:USB-C|mode:programming+data|power:t
  - rs485|variants:opta-rs485,opta-wifi|mode:half-duplex|protocol:RS485,Modbus-RTU
  - wifi|variants:opta-wifi|standard:802.11b/g/n|freq:2.4GHz
  - ble|variants:opta-wifi|version_firmware:4.2|version_hardware:5.1
  - rtc|internal:t|battery-backup:t
security:
  secure-boot: t | crypto-hw: t | random-hw: t | tamper-detection: t

# 9. STATUS LEDS:
# Format: label | color | function
leds[5]:
  - USER1|yellow|user-programmable
  - USER2|yellow|user-programmable
  - USER3|yellow|user-programmable
  - USER4|yellow|user-programmable
  - STATUS|green|power-status

# 10. RESTRICTIONS & COMPATIBILITY:
restrictions:
  input_voltage_max: 24V | relay_voltage_max: 250VAC | relay_current_max: 10A | relay_peak_current: 15A
  operating_temp_min: -20C | operating_temp_max: 50C | protection: IP20 | din_rail: t
  warnings[5]:
    - Relay outputs are NO (Normally Open) — no NC contacts
    - RS-485 only available on Opta RS485 and Opta WiFi variants
    - WiFi/BLE only available on Opta WiFi variant
    - No exposed GPIO headers — all I/O via screw terminals only
    - Not 5V logic compatible — internal logic is 3.3V
compatibility:
  arduinoCore: arduino-opta | pio: arduino_opta | frameworks: arduino,arduino-plc-ide
  plc_languages: ladder,fbd,st,sfc,il | iec_standard: IEC-61131-3
  languages: arduino-cpp | bootloader: stk500v2-compatible

# 11. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: stm32h7-family
  boardProfileId: arduino-opta
  defaultLanguageSkills[2]: arduino-cpp-opta, structured-text-iec61131
  plcIdeSupport: t
  variantIds[3]: opta-lite, opta-rs485, opta-wifi