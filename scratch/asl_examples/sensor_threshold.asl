# METADATA:
project_name: sensor-threshold-led
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
  - id: SENSOR_0
    type: sensor-ldr
  - id: LED_0
    type: led
    attrs: {color: yellow}

# 3. NETLIST:
connections:
  - ["MCU_0:A0", "SENSOR_0:out", "black", "v0"]
  - ["MCU_0:5V", "SENSOR_0:vcc", "red", "v0"]
  - ["SENSOR_0:gnd", "MCU_0:GND.1", "black", "v0"]
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
    body[5]:
      - {kind: analogRead, pin: A0, value: light_level}
      - {kind: if, condition: "light_level < 500", then: [
          {kind: digitalWrite, pin: 13, value: HIGH}
        ]}
      - {kind: if, condition: "light_level >= 500", then: [
          {kind: digitalWrite, pin: 13, value: LOW}
        ]}
