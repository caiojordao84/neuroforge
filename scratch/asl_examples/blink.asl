# METADATA:
project_name: blink-led
version: 1
editor: dendriForge
author: orchestrator
ASLversion: 0.1.0

# 1. SETTINGS & ENVIRONMENT:
settings:
  power_source: usb

# 2. HARDWARE CONFIGURATION:
parts:
  - id: MCU_0
    type: arduino-uno-r3
  - id: LED_0
    type: led
    attrs: {color: red}

# 3. NETLIST:
connections:
  - ["MCU_0:13", "LED_0:A", "green", "v0"]
  - ["LED_0:C", "MCU_0:GND.1", "black", "v0"]

# 4. ASL PROGRAM:
requirements[1]:
  - {lib: arduino-core, critical: true}

tasks[2]:
  - scope: setup
    body[1]:
      - {kind: pinMode, pin: 13, mode: OUTPUT}
      
  - scope: loop
    body[4]:
      - {kind: digitalWrite, pin: 13, value: HIGH}
      - {kind: delay, ms: 1000}
      - {kind: digitalWrite, pin: 13, value: LOW}
      - {kind: delay, ms: 1000}
