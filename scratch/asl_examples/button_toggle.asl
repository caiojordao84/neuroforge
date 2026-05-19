# METADATA:
project_name: button-toggle-led
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
    attrs: {color: green}
  - id: BTN_0
    type: button-push
    attrs: {mode: NO}

# 3. NETLIST:
connections:
  - ["MCU_0:13", "LED_0:A", "green", "v0"]
  - ["LED_0:C", "MCU_0:GND.1", "black", "v0"]
  - ["MCU_0:2", "BTN_0:1", "black", "v0"]
  - ["BTN_0:2", "MCU_0:5V", "red", "v0"]

# 4. ASL PROGRAM:
requirements[1]:
  - {lib: arduino-core, critical: true}

tasks[2]:
  - scope: setup
    body[2]:
      - {kind: pinMode, pin: 13, mode: OUTPUT}
      - {kind: pinMode, pin: 2, mode: INPUT}
      
  - scope: loop
    body[5]:
      - {kind: digitalRead, pin: 2, value: btn_state}
      - {kind: if, condition: "btn_state == HIGH", then: [
          {kind: digitalWrite, pin: 13, value: HIGH},
          {kind: delay, ms: 200}
        ]}
      - {kind: if, condition: "btn_state == LOW", then: [
          {kind: digitalWrite, pin: 13, value: LOW},
          {kind: delay, ms: 200}
        ]}
