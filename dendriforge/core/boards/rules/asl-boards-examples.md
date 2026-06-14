# # EXEMPLO 1
# ___---___

# METADATA:
project_name: beckhoff-cx5130-0125-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: beckhoff-cx5130-0125
name: "Beckhoff CX5130-0125 — Embedded PC; Intel Atom E3827 dual-core 1.75GHz; 4GB DDR3 non-expandable; WES7P 32-bit + TwinCAT 3 XAR; 2× GbE Intel i210 RJ45; 4× USB 2.0; DVI-I; 1-sec UPS; CFast+microSD; E-/K-bus auto-detect; fTPM 2.0; 14W; 24VDC; 142×100×92mm DIN rail fanless"
manufacturer: "Beckhoff Automation"
mcu: "Intel Atom E3827 dual-core 1.75GHz; 4GB DDR3 soldered (not expandable); Intel HD Graphics 542MHz base/792MHz burst; DirectX11; TwinCAT 3 XAR performance class 40; 4 user tasks; EtherCAT master via LAN ports with RT driver; K-bus or E-bus terminal expansion"
category: plc
image: beckhoff-cx5130-0125.svg
url: "https://www.beckhoff.com/en-en/products/ipc/embedded-pcs/cx5100-intel-atom-r/cx5130.html"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 42949672960
  flash_available: 1048576
  sram: 4294967296
  eeprom: 0
  clock: 0
  voltage: "24V"
dims:
  w: 142.0
  h: 100.0
  t: 92.0

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
# CX5130-0125: 24VDC (-15%/+20%) = 20.4-28.8VDC; spring-loaded terminals on power supply terminal
# Max power consumption: 14W (CPU + all system interfaces); 20W peak (including 1-sec UPS capacitor charging)
# E-bus / K-bus terminal power: max 10W (5V / max 2A) via power supply terminal to terminal chain
# Power contacts on terminal bus: max 10A (for supplying field power to connected Bus/EtherCAT Terminals)
# Isolation: 500V between 24VDC supply and internal electronics (galvanic isolation tested)
# No isolated field supply built-in — additional CX2100-0900 power supply module needed for separate field supply
# Internal 1-second UPS: supercapacitor-based; stores up to 1MB persistent variables on CFast/microSD
# Battery: CR2032 in replaceable compartment under front flap; backs up RTC only (not RAM/flash)
powerPins[5|]{name|direction|voltage|type}:
  PWR_24V|input|"24V"|null
  PWR_0V|null|null|ground
  PE_GND|null|null|ground
  EBUS_5V|output|"5V"|null
  POWER_CONTACT_24V|output|"24V"|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
# CX5130-0125 has NO integrated field I/O — all I/O via E-bus or K-bus terminals on right side
# GPIO map covers the physical hardware interfaces on the CX5130 front/top panel
# EtherCAT master function: achieved by loading Beckhoff RT EtherCAT driver on X000 or X001 GbE port
# Second EtherCAT master port: via optional interface M112 in optional slot (ordered ex factory only)
gpio[8|]{pin|type|pwm|int|label|roles}:
  0|digital|false|false|"ETH X000 — RJ45; Intel i210; 10/100/1000 Mbit/s; independent Gigabit Ethernet; auto-MDI/MDIX; jumbo frames supported (up to 9014 bytes); NIC teaming supported; EtherCAT master operation via Beckhoff RT driver (load RT driver in TwinCAT to use as EtherCAT master); protocols: EtherCAT master, EtherNet/IP adapter, Modbus TCP, ADS/AMS over TCP, OPC UA, PROFINET via TwinCAT; LED LINK/ACT green + SPEED green/red; factory default: EtherCAT mode"|"do;di"
  1|digital|false|false|"ETH X001 — RJ45; Intel i210; 10/100/1000 Mbit/s; second independent Gigabit Ethernet; same specs as X000; independent MAC address; use for SCADA/HMI or EtherCAT cable redundancy (ring topology with X000); NO internal switch between X000 and X001 — cannot pass traffic between them without OS routing; cable max 100m Cat5e+"|"do;di"
  2|digital|false|false|"USB X100 — USB 2.0 Type-A; 480 Mbps; 500mA VBUS; for keyboard/mouse/storage/touchscreen; NOT for continuous high-current devices; cable max 3m without hub"|"do;di"
  3|digital|false|false|"USB X101 — USB 2.0 Type-A; 480 Mbps; 500mA; same as X100"|"do;di"
  4|digital|false|false|"USB X102 — USB 2.0 Type-A; 480 Mbps; 500mA; same as X100"|"do;di"
  5|digital|false|false|"USB X103 — USB 2.0 Type-A; 480 Mbps; 500mA; same as X100; total 4× USB 2.0; in hazardous area use CX2900-0107 retainer bracket and cable tie all USB plugs"|"do;di"
  6|digital|false|false|"DVI-I X200 — DVI-I female 29-pin; resolution 640×480 to 1920×1200; max cable 5m direct DVI (50m with Beckhoff DVI extension panel); digital and analog (VGA via adapter); Intel HD Graphics 256MB shared 542MHz base/792MHz burst; DirectX 11; OpenGL 4.0; Shader 5.0; no independent GPU memory — uses system RAM; clone/extended display with optional N010 DVI-D or N011 DisplayPort second interface"|"do"
  7|digital|false|false|"OPTIONAL INTERFACE X300 — 1 slot; must be ordered ex factory — NOT retrofittable; available options: N010 DVI-D (clone/extended display), N011 DisplayPort (2560×1600), N020 audio 3.5mm jacks (not available on WEC7), N030 RS232 D-sub9 isolated 500V, N031 RS422/RS485 D-sub9 isolated 500V, B110 EtherCAT slave (2×RJ45 EtherCAT IN/OUT), M310 PROFIBUS master D-sub9 9.6k-12Mbd, B310 PROFIBUS slave, M510 CANopen master D-sub9 10k-1Mbd, B510 CANopen slave, M930 PROFINET RT controller 2×RJ45, B930 PROFINET RT device 2×RJ45 switch; specify at order time — field upgrade not possible"|"do;di"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[9|]{peripheral|param|value}:
  ethercat_master|"ports:2"|"EtherCAT-master-via-standard-GbE-ports-X000-X001-with-Beckhoff-RT-EtherCAT-driver;no-dedicated-EtherCAT-port-on-base-unit;TC3-performance-class-40;EtherCAT-cable-redundancy-via-both-ports-ring-topology;optional-M112-EtherCAT-slave-interface-for-EtherCAT-slave-mode;drives-BK-EK-EL-EP-EP-series-terminals-and-servo-drives;DC-sync;TwinCAT-System-Manager-auto-scan"
  terminal_bus|"terminals:65534"|"right-side-power-supply-terminal-auto-detects-E-bus-EtherCAT-Terminals-or-K-bus-Bus-Terminals;E-bus:up-to-65534-EL-EP-series-EtherCAT-Terminals;K-bus:up-to-64-BK-KL-series-Bus-Terminals-or-255-with-K-bus-extension;5V-2A-power-to-terminal-chain;power-contacts-10A-max;K-bus-process-data:max-2048B-in-2048B-out;NX-END02-equivalent:EtherCAT-Terminal-bus-end-cover"
  cfast_slot|"size:40GB"|"CFast-card-slot-under-front-flap;cards-not-included;min-40GB-for-WES7P-or-Win10-IoT;min-20GB-for-WEC7-or-TC-BSD;industrial-grade-CFast-recommended:Beckhoff-CX1900-0102-series;stores:OS-TC3-program-persistent-1MB-UPS-data;SATA-interface;LED-flash-access-on-front-panel;power-off-before-inserting-or-removing"
  microsd_slot|"size:32GB"|"microSD-card-slot-under-front-flap;cards-not-included;additional-storage;can-store-persistent-UPS-data-if-no-CFast;IDE-interface;Beckhoff-recommends-industrial-microSD;max-32GB-tested;hot-swap-NOT-supported-power-off-before-change"
  ups_1sec|"capacity:1MB"|"integrated-1-second-UPS;supercapacitor-based;triggers-on-power-failure;stores-up-to-1MB-persistent-variables-on-CFast-or-microSD;FB_S_UPS_CX51x0-function-block-in-TwinCAT;BIOS-UPS-enable-required;Windows-Write-Filter-must-be-configured;peak-power-consumption-20W-during-capacitor-charging"
  twincat3_xar|"class:40"|"TwinCAT-3-XAR-runtime-pre-installed;performance-class-40;4-user-tasks-max;tasks:cyclic-periodic-event-free-running;min-task-cycle-time-depends-on-CPU-load-typical-250µs-1ms;EtherCAT-master-integrated;NC-PTP-NC-I-motion-control-included;CNC-optional;PLC-runtime-IEC-61131-3-full;ADS-AMS-communication;OPC-UA-server;Modbus-TCP-slave-client;EtherNet-IP-adapter-optional;TC-BSD-option-order-0185"
  graphics_ipc|"resolution:1920x1200"|"Intel-HD-Graphics-integrated;256MB-shared-from-system-RAM;base-clock-542MHz;burst-792MHz;DirectX-11;OpenGL-4.0;Shader-5.0;DVI-I-native;DVI-D-optional-N010;DisplayPort-optional-N011;max-2560x1600-on-DP;clone-or-extended-dual-display;Beckhoff-DVI-extension-panels-up-to-50m;VGA-via-DVI-I-adapter"
  battery_rtc|"type:CR2032"|"battery-CR2032-under-front-flap-replaceable;backs-up-RTC-date-and-time-ONLY;does-NOT-back-up-RAM-or-program;program-retained-on-CFast-flash;always-replace-battery-with-power-ON-to-avoid-RTC-reset;battery-location:front-flap-bottom-compartment;replace-when-date-time-lost-on-power-cycle"
  fieldbus_options|"slots:1"|"1x-optional-interface-slot-X300;must-order-ex-factory-not-retrofittable;options:N030-RS232-500V-isolated,N031-RS422-RS485-500V-isolated,B110-EtherCAT-slave-2xRJ45,M310-PROFIBUS-master,B310-PROFIBUS-slave,M510-CANopen-master,B510-CANopen-slave,M930-PROFINET-RT-controller,B930-PROFINET-RT-device,N010-DVI-D,N011-DisplayPort,N020-audio;RS232-RS485-configurable-in-TwinCAT-or-Windows;fieldbus-options-require-corresponding-TC3-fieldbus-license"
usb:
  type: Type-A
  chip: xHCI
  vid: "0x15EC"
  pid: "0x0000"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "2000mA"
  total_current_limit: "2000mA"
  warnings[9]:
    - "The CX5130-0125 has NO integrated field I/O on the CPU module — all discrete I/O (digital inputs, digital outputs, analog inputs, analog outputs, encoder inputs, safety I/O) is provided exclusively by Beckhoff EtherCAT Terminals (EL/EP series, E-bus) or Bus Terminals (KL series, K-bus) connected via the terminal bus on the right side of the power supply terminal; the CX5130 module alone cannot control any field devices; the power supply terminal (CX2100-xxxx) must be ordered as a separate item and attached before any terminals can be connected"
    - "The CX5130-0125 is pre-installed with Windows Embedded Standard 7 P 32-BIT — this is a 32-bit operating system with the practical RAM limit of approximately 3.5 GB visible to Windows even though 4 GB is physically installed; TwinCAT 3 can use the full 4 GB via memory-mapped access for its real-time kernel; for applications requiring full 64-bit OS with access to the complete 4 GB RAM in both Windows and TwinCAT, order the CX5130-0135 (WES7P 64-bit) or CX5130-0155/0175 (Windows 10 IoT 64-bit) variants; the 32-bit OS also limits single-process address space to 2 GB"
    - "The OPTIONAL INTERFACE SLOT (X300) must be ordered EX FACTORY and CANNOT BE RETROFITTED in the field — once the CX5130-0125 is delivered without an optional interface, it is impossible to add RS232, RS485, PROFIBUS, CANopen, EtherCAT slave, or PROFINET connectivity later; always specify the required fieldbus interface at the time of ordering; the only post-delivery communication expansion options are via EtherCAT expansion terminals (EL6xxx series) on the terminal bus"
    - "The EtherCAT master function on the CX5130-0125 is provided by loading the Beckhoff RT EtherCAT driver on one of the standard Gigabit Ethernet ports (X000 or X001) — there is NO dedicated hardware EtherCAT port on the base unit; this means the EtherCAT master port shares the same Intel i210 NIC hardware with standard Ethernet; if BOTH ports are used (one for EtherCAT, one for SCADA/Modbus TCP), they use independent NICs and there is no performance interference; for EtherCAT cable redundancy, both X000 and X001 must be dedicated to EtherCAT in a ring topology, leaving no Ethernet port for SCADA — in that case use an additional network interface via EL6601/EL6614 EtherCAT terminal"
    - "The 1-second UPS stores a MAXIMUM of 1 MB of persistent variables on power failure — applications requiring more than 1 MB of persistent data storage must implement their own data-saving mechanisms (writing to CFast or MicroSD via file access in the TwinCAT PLC program before the UPS timeout); the 1-second window is the worst case; actual storage time may be slightly longer; the BIOS UPS enable setting and Windows Write Filter configuration are both MANDATORY prerequisites for UPS function — if not configured, the UPS will not store any data; use FB_S_UPS_CX51x0 function block in TwinCAT to control the UPS"
    - "The CFast card and MicroSD card are NOT included with the CX5130-0125 — the unit cannot boot without a CFast card (Windows Embedded Standard 7 P requires a minimum 40 GB CFast card); Beckhoff strongly recommends industrial-grade CFast cards (CX1900-0102 series) rated for the full operating temperature range of -25°C to +60°C; consumer-grade CFast or SDHC cards may fail at high temperatures or under continuous write cycles in data-logging applications; the OS and TwinCAT 3 runtime are NOT pre-loaded on a card — they must be ordered on a separate Beckhoff image card or re-imaged by the user"
    - "The two Gigabit Ethernet ports X000 and X001 are INDEPENDENT — there is NO internal Ethernet switch between them; packets cannot pass between X000 and X001 without Windows routing or a bridging configuration; this means the two ports cannot be used as a 2-port managed switch for connecting a downstream device without additional Windows ICS (Internet Connection Sharing) or NIC Teaming configuration; for industrial network bridging between EtherCAT and SCADA segments, use Windows routing or an external managed switch; NIC Teaming (LACP/failover) between X000 and X001 is supported in Windows networking configuration"
    - "The CX5130-0125 requires TwinCAT 3 XAR performance class 40 licensing — this performance class supports a maximum of 4 user tasks; applications requiring more than 4 concurrent real-time tasks (e.g. complex multi-technology architectures with PLC + NC + CNC + safety all as separate tasks) may need to restructure task allocation or upgrade to a higher-performance CX5140 (quad-core, higher TC3 performance class); the 32-bit WES7P OS also limits the maximum TwinCAT 3 build to the last TC3 build supporting WES7P; for the latest TwinCAT 3 builds with all features, use 64-bit Windows 10 IoT variants"
    - "For operation in HAZARDOUS AREAS (ATEX Zone 2/22) the device modification CX2900-0107 is MANDATORY — without it the USB connectors may vibrate loose and cause a deflagration; the CX2900-0107 adds a retainer bracket for mechanically securing all USB, RJ45, and DVI connectors with cable ties; the optional N020 audio interface CANNOT be used in hazardous areas; the embedded PC MUST be installed inside an IP54-rated enclosure for Zone 2 gas (EN 60079-15) or IP54 for non-conductive dust / IP6X for conductive dust (EN 60079-31); take measures to prevent supply voltage exceeding 119V due to short-term interference"
compatibility:
  sw: "TwinCAT 3 XAR (pre-installed, class 40); TwinCAT 2 PLC/NC PTP/NC I (optional license); TwinCAT/BSD (order -0185 variant instead); Windows Embedded Standard 7 P 32-bit (pre-installed -0125); Windows 10 IoT Enterprise LTSB/LTSC (order -0150/-0155/-0160/-0175/-0190/-0195 variants); Beckhoff Device Manager; Beckhoff TF licenses (TF6xxx fieldbus, TF5xxx NC, TF4xxx HMI)"
  languages: "Instruction List (IL);Structured Text (ST);Ladder Diagram (LD);Function Block Diagram (FBD);Sequential Function Chart (SFC);Continuous Function Chart (CFC)"
  frameworks: "IEC61131-3;EtherCAT-master;TwinSAFE-over-EtherCAT-FSoE;EtherNet-IP-via-TC3-TF6280;Modbus-TCP;ADS-AMS;OPC-UA-TF6100;PROFIBUS-via-N030-option;CANopen-via-M510-option;PROFINET-via-M930-option;PLCopen-Motion-Control;CNC-optional"
  certifications: "CE;UL;DNV-GL;ATEX-Zone2-22-with-CX2900-0107;IECEx-with-CX2900-0107;cFMus-with-CX2900-0107;fTPM-2.0;EN-61000-6-2;EN-61000-6-4"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: beckhoff-cx5100-family
  boardProfileId: beckhoff-cx5130-0125
  defaultLanguageSkills[3]:
    - st-twincat3-cx5130
    - ladder-twincat3-cx5130
    - fbd-twincat3-cx5130

# # EXEMPLO 2
# ___---___	

# METADATA:
project_name: tiva-c-launchpad-tm4c123-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: tiva-c-launchpad-tm4c123
name: "TI EK-TM4C123GXL Tiva C LaunchPad — TM4C123GH6PM ARM Cortex-M4F 80MHz HW-FPU, 256KB Flash, 32KB RAM, 43 GPIO, USB OTG, 2xCAN, MC-PWM, QEI"
manufacturer: "Texas Instruments"
mcu: "TI TM4C123GH6PM — ARM Cortex-M4F 80MHz; IEEE754 FPU; 32-ch uDMA; 2xADC-12bit; 8xUART; 4xSSI; 4xI2C; 2xCAN; USB-OTG"
category: maker
image: tiva-c-launchpad-tm4c123.svg
url: "https://www.ti.com/tool/EK-TM4C123GXL"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 262144
  flash_available: 262144
  sram: 32768
  eeprom: 2048
  clock: 80000000
  voltage: "3.3V"
dims:
  w: 102.0
  h: 64.0
  t: 12.0

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
# 3.3V from onboard LDO; powered via ICDI USB or Device USB; power switch selects source
# VBAT pad for 3V coin cell to supply Hibernation module RTC when main power off
powerPins[6|]{name|direction|voltage|type}:
  VBUS_USB|input|"5V"|null
  V3V3|output|"3.3V"|null
  VBAT|input|"3V"|null
  GND|null|null|ground
  AGND|null|null|ground
  WAKE|input|"3.3V"|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
# Port naming: PA=Port A, PB=Port B, PC=Port C, PD=Port D, PE=Port E, PF=Port F
# ALL GPIO: 3.3V logic only — NOT 5V tolerant; output 8mA max per pin
# PD7 and PF0 are NMI/JTAG-locked: must call GPIO_PORTD/F_LOCK = KEY and COMMIT before use
# Pins exposed on LaunchPad headers J1-J4 only; full 64-pin LQFP has additional pads
gpio[43|]{pin|type|pwm|int|label|roles}:
  0|digital|false|true|"PA0 / UART0-RX — UART0 RX; also routed to ICDI virtual COM port (USB-ICDI); default debug/programming UART; 3.3V ONLY"|"uart-rx;di;do"
  1|digital|false|true|"PA1 / UART0-TX — UART0 TX; also ICDI virtual COM port TX; 3.3V ONLY"|"uart-tx;di;do"
  2|digital|false|true|"PA2 / SSI0-CLK — SSI0 serial clock (default); 3.3V ONLY; interrupt"|"di;do;spi"
  3|digital|false|true|"PA3 / SSI0-FSS — SSI0 frame select / CS (default); 3.3V ONLY; interrupt"|"di;do;spi"
  4|digital|false|true|"PA4 / SSI0-RX — SSI0 MISO (default); 3.3V ONLY; interrupt"|"di;spi"
  5|digital|false|true|"PA5 / SSI0-TX — SSI0 MOSI (default); 3.3V ONLY; interrupt"|"di;do;spi"
  6|digital|false|true|"PA6 / I2C1-SCL / CAN0-RX — I2C1 SCL; alt CAN0 RX; 3.3V ONLY; interrupt"|"di;do;i2c;can"
  7|digital|false|true|"PA7 / I2C1-SDA / CAN0-TX — I2C1 SDA; alt CAN0 TX; 3.3V ONLY; interrupt — CAN requires external SN65HVD232 or equivalent transceiver"|"di;do;i2c;can"
  8|digital|false|true|"PB0 / UART1-RX / T2CCP0 — UART1 RX (w/ modem flow); Timer T2 capture; Wake pin (Hibernation); 3.3V ONLY; interrupt"|"uart-rx;di;do"
  9|digital|false|true|"PB1 / UART1-TX / T2CCP1 — UART1 TX; Timer T2 capture; 3.3V ONLY; interrupt"|"uart-tx;di;do"
  10|digital|false|true|"PB2 / I2C0-SCL / T3CCP0 — I2C0 SCL (primary); Timer T3 capture; 3.3V ONLY; interrupt"|"di;do;i2c"
  11|digital|false|true|"PB3 / I2C0-SDA / T3CCP1 — I2C0 SDA (primary); Timer T3 capture; 3.3V ONLY; interrupt"|"di;do;i2c"
  12|analog|true|true|"PB4 / AIN10 / CAN0-RX / SSI2-CLK / T1CCP0 — ADC AIN10; CAN0 RX (alt); SSI2 CLK; MC PWM-compatible; Timer T1; 3.3V ONLY; interrupt"|"di;do;pwm;adc:t;spi;can"
  13|analog|true|true|"PB5 / AIN11 / CAN0-TX / SSI2-FSS / T1CCP1 — ADC AIN11; CAN0 TX (alt); SSI2 FSS; Timer T1; 3.3V ONLY; interrupt"|"di;do;pwm;adc:t;spi;can"
  14|digital|true|true|"PB6 / M0PWM0 / SSI2-RX / T0CCP0 — MC PWM M0PWM0; SSI2 RX; Timer T0; 3.3V ONLY; interrupt"|"di;do;pwm;spi"
  15|digital|true|true|"PB7 / M0PWM1 / SSI2-TX / T0CCP1 — MC PWM M0PWM1; SSI2 TX; Timer T0; 3.3V ONLY; interrupt"|"di;do;pwm;spi"
  16|digital|false|false|"PC0 / TCK / SWCLK — JTAG TCK / SWD SWCLK — DEBUG USE ONLY; do NOT use as GPIO unless JTAG disabled; 3.3V ONLY"|null
  17|digital|false|false|"PC1 / TMS / SWDIO — JTAG TMS / SWD SWDIO — DEBUG USE ONLY; 3.3V ONLY"|null
  18|digital|false|false|"PC2 / TDI — JTAG TDI — DEBUG USE ONLY; 3.3V ONLY"|null
  19|digital|false|false|"PC3 / TDO / SWO — JTAG TDO / SWO trace — DEBUG USE ONLY; 3.3V ONLY"|null
  20|digital|false|true|"PC4 / U4RX / M0PWM6 / IDX1 — UART4 RX; MC PWM M0PWM6; QEI1 index; 3.3V ONLY; interrupt"|"uart-rx;di;do;pwm"
  21|digital|false|true|"PC5 / U4TX / M0PWM7 / PHA1 — UART4 TX; MC PWM M0PWM7; QEI1 PhA; 3.3V ONLY; interrupt"|"uart-tx;di;do;pwm"
  22|digital|false|true|"PC6 / U3RX / PHB1 — UART3 RX; QEI1 PhB; 3.3V ONLY; interrupt"|"uart-rx;di;do"
  23|digital|false|true|"PC7 / U3TX — UART3 TX; 3.3V ONLY; interrupt"|"uart-tx;di;do"
  24|analog|false|true|"PD0 / AIN7 / SSI3-CLK / SSI1-CLK / I2C3-SCL / M0PWM6 / M1PWM0 / T0CCP0 — ADC AIN7; SSI3/1 CLK; I2C3 SCL; PWM; Timer; 3.3V ONLY; interrupt"|"di;do;pwm;adc:t;spi;i2c"
  25|analog|false|true|"PD1 / AIN6 / SSI3-FSS / SSI1-FSS / I2C3-SDA / M0PWM7 / M1PWM1 / T0CCP1 — ADC AIN6; SSI3/1 FSS; I2C3 SDA; PWM; 3.3V ONLY; interrupt"|"di;do;pwm;adc:t;spi;i2c"
  26|analog|false|true|"PD2 / AIN5 / SSI3-RX / SSI1-RX / M0FAULT0 / T3CCP0 — ADC AIN5; SSI3/1 RX (MISO); PWM fault input; Timer; 3.3V ONLY; interrupt"|"di;do;adc:t;spi"
  27|analog|false|true|"PD3 / AIN4 / SSI3-TX / SSI1-TX / IDX0 / T3CCP1 — ADC AIN4; SSI3/1 TX (MOSI); QEI0 index; Timer; 3.3V ONLY; interrupt"|"di;do;adc:t;spi"
  28|digital|false|true|"PD4 / U6RX / USB0DM — UART6 RX; USB D- signal — USB function takes priority; do NOT use as GPIO when USB active; 3.3V ONLY; interrupt"|"uart-rx;di"
  29|digital|false|true|"PD5 / U6TX / USB0DP — UART6 TX; USB D+ signal — USB function takes priority; 3.3V ONLY; interrupt"|"uart-tx;di"
  30|digital|false|true|"PD6 / U2RX / M0FAULT0 / PHA0 / T4CCP0 — UART2 RX; PWM M0 fault input 0; QEI0 PhA; Timer T4; 3.3V ONLY; interrupt"|"uart-rx;di;do"
  31|digital|false|true|"PD7 / U2TX / PHB0 / T4CCP1 — UART2 TX; QEI0 PhB; Timer T4; 3.3V ONLY; interrupt — NMI LOCKED by default; must write GPIOLOCK=0x4C4F434B then GPIOCR=0xFF to unlock before use"|"uart-tx;di;do"
  32|analog|false|true|"PE0 / AIN3 / U7RX — ADC AIN3; UART7 RX; Wake pin (Hibernation); 3.3V ONLY; interrupt"|"uart-rx;di;do;adc:t"
  33|analog|false|true|"PE1 / AIN2 / U7TX — ADC AIN2; UART7 TX; 3.3V ONLY; interrupt"|"uart-tx;di;do;adc:t"
  34|analog|false|true|"PE2 / AIN1 — ADC AIN1; 3.3V ONLY; interrupt"|"di;do;adc:t"
  35|analog|false|true|"PE3 / AIN0 — ADC AIN0; 3.3V ONLY; interrupt"|"di;do;adc:t"
  36|analog|true|true|"PE4 / AIN9 / U5RX / I2C2-SCL / M0PWM4 / M1PWM2 / CAN0-RX — ADC AIN9; UART5 RX; I2C2 SCL; MC PWM; CAN0 RX (alt); 3.3V ONLY; interrupt"|"uart-rx;di;do;pwm;adc:t;i2c;can"
  37|analog|true|true|"PE5 / AIN8 / U5TX / I2C2-SDA / M0PWM5 / M1PWM3 / CAN0-TX — ADC AIN8; UART5 TX; I2C2 SDA; MC PWM; CAN0 TX (alt); 3.3V ONLY; interrupt"|"uart-tx;di;do;pwm;adc:t;i2c;can"
  38|digital|false|true|"PF0 / M1PWM4 / SSI1-RX / CAN0-RX / T0CCP0 / NMI / C0O / SW2 — on-board SW2 (User Button 2); CAN0 RX (alt); PWM; SSI1; Timer; 3.3V ONLY; interrupt — NMI LOCKED by default; write LOCK+COMMIT to unlock before use as GPIO or SW2"|"di;pwm;spi;can"
  39|digital|true|true|"PF1 / M1PWM5 / SSI1-TX / T0CCP1 / C1O / PHA0 / TRD1 — on-board RGB LED RED; MC PWM M1PWM5; SSI1 TX; QEI0 PhA; Timer; 3.3V ONLY; interrupt"|"di;do;pwm;spi"
  40|digital|true|true|"PF2 / M0FAULT0 / M1PWM6 / SSI1-CLK / T1CCP0 / TRD0 — on-board RGB LED BLUE; MC PWM M1PWM6; SSI1 CLK; Timer; 3.3V ONLY; interrupt"|"di;do;pwm;spi"
  41|digital|true|true|"PF3 / M1PWM7 / SSI1-FSS / CAN0-TX / T1CCP1 / TRCLK — on-board RGB LED GREEN; MC PWM M1PWM7; SSI1 FSS; CAN0 TX (alt); Timer; 3.3V ONLY; interrupt"|"di;do;pwm;spi;can"
  42|digital|false|true|"PF4 / M1FAULT0 / IDX1 / T2CCP0 / USB0EPEN / SW1 — on-board SW1 (User Button 1); MC PWM fault 1; QEI1 index; Timer; USB OTG enable; 3.3V ONLY; interrupt"|"di"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[9|]{peripheral|param|value}:
  usb_otg|"speed:12Mbit"|"proto:USB2.0-FS+LS-OTG-Host-Device;endpoints:32;connector:Micro-A-B;DM:PD4;DP:PD5;lib:TivaWare-USB;modes:CDC-HID-Bulk-Audio-DFU"
  uart_0to3|"baud:3000000"|"uart0:RX=PA0,TX=PA1(ICDI-VCP);uart1:RX=PB0,TX=PB1(modem-RTS-CTS);uart2:RX=PD6,TX=PD7;uart3:RX=PC6,TX=PC7;all:IrDA-9bit-ISO7816"
  uart_4to7|"baud:3000000"|"uart4:RX=PC4,TX=PC5;uart5:RX=PE4,TX=PE5;uart6:RX=PD4,TX=PD5(shared-USB);uart7:RX=PE0,TX=PE1"
  ssi_0to3|"speed:25Mbit"|"ssi0:CLK=PA2,FSS=PA3,RX=PA4,TX=PA5;ssi1:CLK=PF2,FSS=PF3,RX=PF0,TX=PF1(alt:PD0-3);ssi2:CLK=PB4,FSS=PB5,RX=PB6,TX=PB7;ssi3:CLK=PD0,FSS=PD1,RX=PD2,TX=PD3;modes:Freescale-SPI-MICROWIRE-TI-sync"
  i2c_0to3|"speed:400kHz"|"i2c0:SCL=PB2,SDA=PB3;i2c1:SCL=PA6,SDA=PA7;i2c2:SCL=PE4,SDA=PE5;i2c3:SCL=PD0,SDA=PD1;all:100-400kHz-master-slave"
  can_0to1|"speed:1Mbit"|"can0:RX=PA6-or-PB4-or-PE4,TX=PA7-or-PB5-or-PE5;can1:RX=PA6-or-PF0,TX=PA7-or-PF1;proto:CAN2.0A-2.0B;requires-external-transceiver-SN65HVD232"
  mc_pwm|"channels:16"|"M0PWM:pins-PB6-PB7-PB4-PB5-PE4-PE5-PC4-PC5;M1PWM:PF1-PF2-PF3-PF4-PA6-PA7-PD0-PD1;8-generators-x2;dead-band;fault-inputs-2;QEI0:PD6-PD7-PD3;QEI1:PC5-PC6-PF1"
  adc_0to1|"resolution:12bit"|"ADC0+ADC1:12-bit-SAR;1MSPS-per-module;12-channels:AIN0-PE3,AIN1-PE2,AIN2-PE1,AIN3-PE0,AIN4-PD3,AIN5-PD2,AIN6-PD1,AIN7-PD0,AIN8-PE5,AIN9-PE4,AIN10-PB4,AIN11-PB5;temp-sensor;16-samples-FIFO"
  hibernation|"current:5uA"|"wake:PE0-or-RTC;RTC:32768Hz-crystal-on-board;VBAT:coin-cell-pad;GPIORETENTION:supported;lib:TivaWare-Hibernate"
usb:
  type: Micro-AB
  chip: native
  vid: "0x1CBE"
  pid: "0x0108"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "8mA"
  total_current_limit: "250mA"
  warnings[9]:
    - "ALL GPIO pins on TM4C123GH6PM are 3.3V ONLY — none are 5V tolerant; applying 5V to any GPIO pin will latch-up or permanently damage the device; use a level shifter (e.g. TXB0108) when interfacing with 5V peripherals"
    - "PD7 (UART2-TX/NMI) and PF0 (SW2/CAN0-RX/NMI) are LOCKED by default to prevent accidental NMI triggering — before using these as GPIO write 0x4C4F434B to GPIOLOCK and 0xFF to GPIOCR; SW2 on PF0 is also affected and requires unlock"
    - "PC0-PC3 (JTAG/SWD pins: TCK, TMS, TDI, TDO/SWO) must NOT be used as GPIO unless the JTAG interface is fully disabled — disabling JTAG makes on-board ICDI debugger non-functional; recovery requires a JTAG programmer"
    - "PD4 and PD5 are the USB D- and D+ signals — these pins cannot be used as GPIO while the USB peripheral is active; if USB is not required they can be reconfigured but output drive strength is 18mA (higher than other pads)"
    - "Both CAN modules (CAN0 and CAN1) require an external CAN bus transceiver chip (TI SN65HVD232 or equivalent) — the MCU CAN pins output 3.3V CMOS logic and cannot directly drive a CAN bus; the LaunchPad has no on-board CAN transceiver"
    - "UART0 (PA0/PA1) is shared with the on-board ICDI virtual COM port over USB — when the ICDI USB cable is connected, PA0/PA1 are driven by the ICDI; do NOT connect external devices to PA0/PA1 while using ICDI serial debugging simultaneously"
    - "The on-board RGB LED uses PF1 (RED), PF2 (BLUE), PF3 (GREEN) — these are shared with SSI1 (CLK/FSS/TX) and MC PWM outputs; using SSI1 will toggle the LED; disable LED GPIO before using SSI1 or PWM on PF1-PF3"
    - "The Hibernation module shares the 32.768kHz oscillator circuit with the RTC — HIBCLK must be enabled via SysCtlPeripheralEnable(SYSCTL_PERIPH_HIBERNATE) and HibernateEnableExpClk() before any RTC or hibernate functions; without coin-cell on VBAT, RTC resets on power loss"
    - "The Motion-Control PWM (MCPWM) is a separate module from the standard GPT PWM — MCPWM uses the PWM subsystem (M0PWM/M1PWM), has dedicated dead-band generators and fault inputs; GPT PWM (CCP) and MCPWM cannot share the same pin simultaneously"
compatibility:
  sw: "Code Composer Studio (CCS) v6+; IAR Embedded Workbench; Keil MDK-ARM; Energia (Arduino-compatible); PlatformIO (timsp430 or tivac target)"
  languages: "C;C++;ARM assembly;Energia (C++ subset)"
  frameworks: "TivaWare for C Series;FreeRTOS;TI-RTOS;CMSIS;Energia"
  certifications: "FCC;CE;RoHS"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: ti-tivac-tm4c123-family
  boardProfileId: tiva-c-launchpad-tm4c123
  defaultLanguageSkills[3]:
    - c-tivaware-tm4c
    - cpp-energia-tivac
    - c-freertos-arm-cortex-m4f

# # EXEMPLO 3
# ___---___

# METADATA:
project_name: esp32-s3-relay-6ch-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: esp32-s3-relay-6ch
name: "Waveshare ESP32-S3 Relay 6CH"
manufacturer: Waveshare
mcu: "ESP32-S3 Xtensa LX7 dual-core up to 240 MHz; 16MB flash; 8MB PSRAM; WiFi 802.11 b/g/n; BLE 5.0; 6x SPDT relay 10A; isolated RS485; 7-30V DC; Pico-HAT header; DIN-rail"
category: maker
image: esp32-s3-relay-6ch.svg
url: "https://www.waveshare.com/wiki/ESP32-S3-Relay-6CH"

## 2. TECH SPECS & DIMENSIONS:
specs: flashtotal 16777216 | flashavailable 16777216 | sram 8388608 | eeprom 0 | clock 240000000 | voltage "3.3V" | cores 2 | wifi "802.11 b/g/n" | bluetooth "BLE 5.0"
dims: w 120.0 | h 96.0 | t 27.5

## 3. ELECTRICAL PROFILE (POWER PINS):
powerPins[4|]{name|direction|voltage|type}:
  VIN|input|"7-30V"|null
  GND|null|null|ground
  USB5V|input|"5V"|null
  3V3|output|"3.3V"|null

## 4. GPIO MAP:
gpio[22|]{pin|type|pwm|int|label|roles}:
  1|digital|t|f|"GPIO1 — Relay 1 (active-HIGH; optocoupler; SPDT 10A 250VAC/30VDC; ADC1-CH0)"|"do"
  2|digital|t|f|"GPIO2 — Relay 2 (active-HIGH; strapping: HIGH=SPI boot; ADC1-CH1)"|"do"
  3|digital|t|f|"GPIO3 — Relay 3 (active-HIGH; ADC1-CH2)"|"do"
  4|digital|t|f|"GPIO4 — Relay 4 (active-HIGH; ADC1-CH3)"|"do"
  5|digital|t|f|"GPIO5 — Relay 5 (active-HIGH; ADC1-CH4)"|"do"
  6|digital|t|f|"GPIO6 — Relay 6 (active-HIGH; ADC1-CH5)"|"do"
  8|digital|f|f|"GPIO8 — RS485 DE/RE control (HIGH=TX; LOW=RX; SP3485; strapping: ROM msgs; ADC1-CH7)"|"do"
  9|analog|f|f|"GPIO9 — Free GPIO Pico-HAT; ADC1-CH8; TOUCH9"|"di;do"
  10|analog|f|f|"GPIO10 — Free GPIO Pico-HAT; ADC1-CH9; TOUCH10"|"di;do"
  11|analog|f|f|"GPIO11 — Free GPIO Pico-HAT; ADC2-CH0 (avoid with WiFi)"|"di;do"
  12|analog|f|f|"GPIO12 — Free GPIO Pico-HAT; ADC2-CH1 (avoid with WiFi)"|"di;do"
  13|analog|f|f|"GPIO13 — Free GPIO Pico-HAT; ADC2-CH2 (avoid with WiFi)"|"di;do"
  14|analog|f|f|"GPIO14 — Free GPIO Pico-HAT; ADC2-CH3 (avoid with WiFi)"|"di;do"
  15|analog|f|f|"GPIO15 — Free GPIO Pico-HAT; ADC2-CH4 (avoid with WiFi)"|"di;do"
  16|analog|f|f|"GPIO16 — Free GPIO Pico-HAT; ADC2-CH5 (avoid with WiFi)"|"di;do"
  17|digital|f|f|"GPIO17 — RS485 TX (SP3485 DI); UART1-TX"|"uart-tx"
  18|digital|f|f|"GPIO18 — RS485 RX (SP3485 RO); UART1-RX"|"uart-rx"
  19|digital|f|f|"GPIO19 — USB D- (native USB CDC/JTAG); do not use as GPIO when USB active"|"di;do"
  20|digital|f|f|"GPIO20 — USB D+ (native USB CDC/JTAG); do not use as GPIO when USB active"|"di;do"
  21|digital|f|t|"GPIO21 — Free GPIO Pico-HAT; interrupt-capable"|"di;do"
  38|digital|f|f|"GPIO38 — Free GPIO Pico-HAT"|"di;do"
  48|digital|t|f|"GPIO48 — Onboard status LED (active-HIGH; PWM; strapping on some HW revisions)"|"status-led"

## 5. PERIPHERALS & USB:
peripherals[4|]{peripheral|param|value}:
  serial|uart1|"tx17|rx18"
  i2c|channels1|"sda21|scl38"
  adc|channels2|"adc1:pins1,2,3,4,5,6,8,9,10"
  pwm|channels8|"ledc-any-gpio"
usb: type USB-C | chip "ESP32-S3-native" | vid "0x303A" | pid "0x1001"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "40mA"
  total_current_limit: "1200mA"
  warnings[9]:
    - "GPIO1-GPIO6 drive relay coils via optocouplers; GPIO only sources signal (~5mA); relay coil powered by internal 5V; relay contact max 10A 250VAC or 30VDC (SRD-05VDC-SL-C); never connect loads exceeding 10A to relay contacts"
    - "GPIO2 is a strapping pin; must be HIGH at boot for normal SPI boot; pulling LOW at power-on forces download mode; add 10k pull-up if relay driver circuit can backfeed GPIO2 LOW during power-on transients"
    - "GPIO8 is a strapping pin; HIGH at reset enables ROM UART messages on UART0; ensure GPIO8 is LOW (RS485 RX mode) before reset to avoid unexpected serial output on boot"
    - "ADC2 channels (GPIO11-GPIO20) unreliable during active WiFi TX; use only ADC1 (GPIO1-GPIO10) for analog sensing concurrent with WiFi"
    - "GPIO19/GPIO20 are native USB D-/D+; do not use as GPIO when USB CDC or JTAG is active; only free for GPIO in non-USB applications"
    - "RS485 isolated via digital isolator; RS485-GND terminal must be connected to bus common ground at remote device; floating RS485-GND causes common-mode noise and Modbus CRC errors; isolation rated typically 2500V RMS"
    - "Relay contacts are electrically independent but share PCB proximity; mains voltage on one relay can capacitively couple to adjacent contacts; maintain IEC 60664-1 creepage/clearance for mains-rated applications"
    - "DC input 7-30V via screw terminal; below 7V relay coils may chatter; above 30V input protection may be damaged; install TVS diode on input rail when sharing supply with inductive loads"
    - "GPIO48 onboard status LED; also a strapping pin on some HW revisions; verify silkscreen revision before using GPIO48 for application logic"
compatibility: pio esp32s3box | frameworks "arduino;espidf" | languages "arduino-cpp;micropython;rust-embassy" | bootloader "esp-idf-bootloader"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: esp32-xtensa-family
  boardProfileId: esp32-s3-relay-6ch
  defaultLanguageSkills[2]:
    - arduino-cpp-esp32
    - espidf-c-esp32

# # EXEMPLO 4
# ___---___

# METADATA:
project_name: schneider-modicon-m221-tm221ce16r-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. DEVICE IDENTIFICATION:
id: schneider-modicon-m221-tm221ce16r
name: "Schneider Electric Modicon M221 TM221CE16R — Compact PLC; 0.2µs Boolean; 256KB RAM; 9 DI 24VDC; 7 DO relay 2A 250VAC; 2 AI 10-bit 0-10V; 4x100kHz HSC; Ethernet Modbus TCP; RS232/485; USB; SD; 100-240VAC"
manufacturer: "Schneider Electric"
mcu: "Schneider Electric Modicon M221 CPU — 0.2µs Boolean; 0.3ms/1KI; 256KB user RAM; 256KB NV flash; IEC61131-3 IL-ST-LD-FBD-SFC; 14 PID loops; Ethernet Modbus TCP + EtherNet/IP; RS485 Modbus RTU; USB; BR2032 RTC 1yr"
category: plc
image: schneider-modicon-m221-tm221ce16r.svg
url: "https://www.se.com/en/product/TM221CE16R/"

## 2. TECH SPECS & DIMENSIONS:
specs:
  flash_total: 2097152
  flash_available: 262144
  sram: 262144
  eeprom: 0
  clock: 0
  voltage: "230V"
dims:
  w: 95.0
  h: 90.0
  t: 70.0

## 3. ELECTRICAL PROFILE (POWER PINS):
# Format: name | direction | voltage | type
# TM221CE16R: 100-240VAC 50/60Hz; range 85-264VAC; max 49VA (with 4 expansion modules); max 33VA alone
# Inrush current ≤40A cold start; isolation 2300VAC supply to internal logic; 1500VAC supply to ground
# Sensor power supply output: 24VDC at 250mA from controller (for external input sensors)
# Expansion bus: 5V/325mA + 24V/120mA for TM3 expansion modules
# PE: Functional Earth via DIN rail; connect rail to protective earth; required for CE/EMC compliance
powerPins[6|]{name|direction|voltage|type}:
  L_AC|input|"230V"|null
  N_AC|null|null|ground
  PE|null|null|ground
  SENS_24V|output|"24V"|null
  SENS_GND|null|null|ground
  EXP_5V|output|"5V"|null

## 4. GPIO MAP:
# Format: pin | type | pwm | int | label | roles
# DI I0-I8: 24VDC IEC 61131-2 Type 1; sink or source; removable screw terminal
# I0,I1,I6,I7 = 4x FAST inputs: 100kHz HSC 32-bit; 5µs ON/OFF; 5mA; 4.9kΩ; max 10m shielded cable
# I2-I5, I8 = 5x standard: 35µs ON / 100µs OFF; 7mA; 3.4kΩ; filter 0/3/12ms; max 30m unshielded
# Input ON: ≥15VDC; OFF: ≤5VDC; overload: ±30VDC 5min / ±13VDC permanent
# DO Y0-Y6: relay SPST-NO; 2A; 5-125VDC / 5-250VAC (max 277VAC CE); min 1mA@5VDC
# COM groups: COM0=Y0-Y3 (7A total); COM1=Y4-Y6 (6A total); COM0 and COM1 NOT internally connected
# Relay NO protection against short-circuit; always fuse outputs externally
# AI AN0-AN1: 0-10VDC; 10-bit; 10mV LSB; ±1%; NO isolation from logic; max 1m unshielded cable
gpio[19|]{pin|type|pwm|int|label|roles}:
  0|digital|false|true|"I0 — Fast Digital Input 0; 24VDC sink/source; 100kHz HSC ch0 A-phase; ON delay 5µs; OFF delay 5µs; 5mA@24VDC; 4.9kΩ; A/B quadrature or single-phase or pulse/direction; interrupt; cable max 10m shielded; isolation 500VAC to internal logic"|"di"
  1|digital|false|true|"I1 — Fast Digital Input 1; 24VDC; 100kHz HSC ch0 B-phase or ch1 A-phase; 5µs ON/OFF; 5mA; interrupt; 10m shielded"|"di"
  2|digital|false|true|"I2 — Standard Digital Input 2; 24VDC sink/source; 35µs turn-on; 100µs turn-off; 7mA@24VDC; 3.4kΩ; filter 0/3/12ms configurable; interrupt; cable max 30m unshielded; 500VAC isolation"|"di"
  3|digital|false|true|"I3 — Standard Digital Input 3; 24VDC; 35µs ON/100µs OFF; 7mA; 3.4kΩ; interrupt; 30m unshielded"|"di"
  4|digital|false|true|"I4 — Standard Digital Input 4; 24VDC; 35µs/100µs; 7mA; interrupt"|"di"
  5|digital|false|true|"I5 — Standard Digital Input 5; 24VDC; 35µs/100µs; 7mA; interrupt"|"di"
  6|digital|false|true|"I6 — Fast Digital Input 6; 24VDC; 100kHz HSC ch1 or ch2 A-phase; 5µs ON/OFF; 5mA; 4.9kΩ; interrupt; 10m shielded"|"di"
  7|digital|false|true|"I7 — Fast Digital Input 7; 24VDC; 100kHz HSC ch2 B-phase; 5µs ON/OFF; 5mA; 4.9kΩ; interrupt; 10m shielded; I0-I1-I6-I7 = 4 fast inputs supporting up to 4ch 100kHz HSC 32-bit"|"di"
  8|digital|false|true|"I8 — Standard Digital Input 8; 24VDC; 35µs/100µs; 7mA; last built-in DI; interrupt; 30m unshielded"|"di"
  9|digital|false|false|"Y0 — Relay Output 0; SPST-NO Form A; 5-125VDC or 5-250VAC (CE: 277VAC max); 2A resistive; min 1mA@5VDC; COM0 group (Y0-Y3; 7A max total); 10ms ON/OFF; 20 ops/min max load; NO short-circuit protection — fuse externally; 2300VAC isolation output to logic; mech durability ≥20M cycles"|"do"
  10|digital|false|false|"Y1 — Relay Output 1; same as Y0; COM0 group; 2A; 5-250VAC/125VDC"|"do"
  11|digital|false|false|"Y2 — Relay Output 2; same as Y0; COM0 group; 2A"|"do"
  12|digital|false|false|"Y3 — Relay Output 3; last relay in COM0 group; 2A; COM0 total 7A; protect load with freewheeling diode (DC) or RC snubber (AC) for inductive loads"|"do"
  13|digital|false|false|"Y4 — Relay Output 4; SPST-NO; 2A; 5-250VAC/125VDC; COM1 group (Y4-Y6; 6A max total); COM1 NOT internally connected to COM0 — can switch different voltage level; 2300VAC isolation; 10ms; NO short-circuit protection"|"do"
  14|digital|false|false|"Y5 — Relay Output 5; COM1 group; 2A; same specs as Y4"|"do"
  15|digital|false|false|"Y6 — Relay Output 6; COM1 group; last relay output; 2A; total COM1 6A"|"do"
  16|analog|false|false|"AN0 — Analog Input 0; 0-10VDC unipolar; 10-bit (0-1023 raw); 10mV LSB; ±1% accuracy full scale @25°C; conversion 1ms per channel + 1 controller cycle; overload ±30VDC 5min / ±13VDC permanent; 100kΩ; NO isolation from internal logic; cable max 1m unshielded; both AI 0V terminals are internally connected"|"adc:t"
  17|analog|false|false|"AN1 — Analog Input 1; 0-10VDC; 10-bit; same specs as AN0; 1m unshielded; no isolation; analog ground and digital ground share common reference inside CPU"|"adc:t"
  18|digital|false|false|"USB / Mini-B — USB 2.0 Hi-Speed 480 Mbps; programming and commissioning only via SoMachine/EcoStruxure Machine Expert; NOT for permanent connection; standard type Mini-B connector; cable max 3m; 500VAC isolation USB to internal logic"|"do;di"

## 5. PERIPHERALS & USB:
# Format: peripheral | param | value
peripherals[8|]{peripheral|param|value}:
  ethernet|"speed:100Mbit"|"1x-RJ45-10BASE-T-100BASE-TX;max-cable-100m;DHCP-client;protocols:Modbus-TCP-slave-client-server,EtherNet-IP-adapter,IGMP;isolation-500VAC-to-logic;supports-max-8-simultaneous-TCP-connections;Modbus-TCP-max-16-client-connections;programming-via-SoMachine-over-Ethernet"
  serial_sl1|"speed:115200bps"|"1x-RJ45-SL1-port;RS232-or-RS485-selectable-via-internal-jumper;RS232:3m-max-not-isolated;RS485:15m-max-2-wire-half-duplex-not-isolated;1.2-to-115200bps;protocols:Modbus-RTU-ASCII-master-slave,SoMachine-Network;pin-7-provides-5VDC-200mA-supply-for-RS485-devices"
  hsc_counters|"count:4"|"4-channels-100kHz-32-bit;inputs:I0-I1-I6-I7;modes:A-B-quadrature,single-phase,pulse-direction;software-configurable;compare-output-not-on-relay-variant;used-for-encoder-feedback-and-speed-measurement"
  sd_card|"size:2GB"|"optional-2GB-SD-card-slot;stores:application-data-logs-recipes;SD-LED-indicator-on-CPU-front;hot-plug-not-recommended-during-RUN;power-off-before-inserting-or-removing"
  battery_rtc|"type:BR2032"|"hardware-RTC;BR2032-non-rechargeable-lithium-battery;4-year-life;backup:1-year-at-25C-after-power-loss;battery-low-indication-via-BAT-LED;replace-with-power-ON-for-uninterrupted-RTC"
  expansion_tm3|"modules:7"|"up-to-4-TM3-relay-or-transistor-output-modules;up-to-7-TM3-mixed-modules-incl-analog;types:TM3DI16-TM3DQ16R-TM3DQ16TK-TM3AI8-TM3AQ4-TM3TI4;expansion-bus:5V-325mA-and-24V-120mA;hotfix-not-supported-power-off-before-change"
  cartridge_slot|"slots:1"|"1x-cartridge-slot-top-of-CPU;types:TMC2AI2-2AI-0-10V,TMC2AQ2V-2AO-0-10V,TMC2AQ2C-2AO-4-20mA,TMC2SL1-RS485-serial,TMC2HOIS01-basic-counter;power-off-before-inserting;not-hot-swappable"
  pid_motion|"loops:14"|"14-PID-loops-simultaneous;adjustable-PID-regulator;no-pulse-output-on-relay-variant;PTO-available-on-TM221CE16T-transistor-variant-only;HSC-feedback-usable-with-PID-via-custom-ladder"
usb:
  type: Mini-B
  chip: native
  vid: "0x0067"
  pid: "0xC1FE"

## 6. RESTRICTIONS & COMPATIBILITY:
restrictions:
  max_io_current: "250mA"
  total_current_limit: "250mA"
  warnings[9]:
    - "TM221CE16R uses RELAY outputs (Y0-Y6) which CANNOT generate Pulse Train Output (PTO) or PWM signals — the relay switching time of ~10ms makes high-frequency pulse generation physically impossible; for applications requiring stepper or servo drive pulse outputs use the TM221CE16T (transistor output) variant; the relay model has NO PTO instructions in SoMachine/EcoStruxure Machine Expert, and attempting to configure PTO on a relay CPU will result in a configuration error at download"
    - "Relay output groups COM0 (Y0-Y3) and COM1 (Y4-Y6) are NOT internally connected — this allows different voltage levels to be switched by each group (e.g. 24VDC on COM0, 230VAC on COM1); however, within each group all outputs share the common terminal (COM0 or COM1); mixing AC and DC voltages within the SAME group is NOT safe and will create a hazardous cross-connection through the common terminal; plan load distribution across groups before wiring"
    - "Relay outputs have NO built-in short-circuit protection — always install external fuses rated to the load on each relay output; Schneider Electric recommends Type T (slow-blow) fuses; for inductive DC loads connect a freewheeling diode in parallel with each load; for inductive AC loads connect an RC snubber in parallel; failure to suppress inductive spikes will permanently damage relay contacts ahead of the rated electrical durability"
    - "The 2 built-in analog inputs (AN0, AN1) accept 0-10VDC ONLY and have NO isolation from the internal CPU logic — always use cables no longer than 1m and avoid routing analog cables near power conductors or motor cables; for 4-20mA current measurement install the TMC2AQ2C cartridge (AO) or a TM3AI8 expansion module which supports true 4-20mA inputs; connecting a current signal directly to AN0/AN1 without a shunt resistor will damage the analog input permanently"
    - "The serial port SL1 (RJ45) is NOT isolated from the internal CPU logic — it operates on the same reference as the CPU; never connect SL1 RS-485 to a RS-485 bus that has a different ground potential; if field devices are in remote panels with separate earth, use an external RS-485 isolator module; exceeding the ±15V common-mode voltage on the RS-485 lines will destroy the SL1 transceiver"
    - "The expansion bus power budget MUST be calculated before selecting TM3 modules — the TM221CE16R provides only 5V/325mA and 24V/120mA on the expansion bus; each TM3 module consumes approximately 35-100mA at 5V and 50-150mA at 24V; if the total consumption exceeds the budget you must add an external TM3XTRA1 power supply module; exceeding bus power limits causes random I/O module faults and potential CPU reset"
    - "The SD card slot in the TM221CE16R is OPTIONAL — the controller will operate without an SD card using only internal flash backup; however without an SD card there is no data logging or recipe storage capability; if an SD card is installed always power off the controller before inserting or removing it; hot-plugging an SD card during RUN can corrupt the file system and cause the application to lose all logged data"
    - "The BR2032 battery backs up the RTC only for approximately 1 year after power loss — it does NOT back up the user program or variable data (those are stored in the 256KB internal flash); when the BAT LED turns red, replace the battery while the controller is powered ON to maintain uninterrupted RTC operation; if replaced with power OFF the RTC will reset to default date/time and any battery-backed clock-dependent logic will malfunction"
    - "The TM221CE16R power supply accepts 100-240VAC (range 85-264VAC) at 50/60Hz — do NOT connect a DC power source to the AC input terminals; the /R suffix in TM221CE16R denotes Relay outputs, NOT the power supply type; the CE suffix denotes Compact Ethernet; the TM221C16R variant (without E) has no Ethernet; always verify the exact part number suffix before wiring as incorrect supply voltage will permanently damage the switching power supply inside the controller"
compatibility:
  sw: "EcoStruxure Machine Expert (SoMachine V4.3+, alias ESME V1.0+) primary; SoMachine V4.1-V4.3 (legacy); Vijeo Designer for HMI; EcoStruxure Operator Terminal Expert"
  languages: "Instruction List (IL);Structured Text (ST);Ladder Diagram (LD);Function Block Diagram (FBD);Sequential Function Chart (SFC)"
  frameworks: "IEC61131-3;Modbus-TCP;Modbus-RTU-ASCII;EtherNet-IP-adapter;SoMachine-Network;TM3-expansion-bus;EcoStruxure"
  certifications: "CE;cULus;CSA;RCM;DNV-GL;ABS;LR;IACS-E10;EAC"

## 7. AGENT SKILLS:
dendriForge:
  boardFamilySkillId: schneider-modicon-m221-family
  boardProfileId: schneider-modicon-m221-tm221ce16r
  defaultLanguageSkills[3]:
    - ladder-esme-modicon-m221
    - st-esme-modicon-m221
    - fbd-esme-modicon-m221	