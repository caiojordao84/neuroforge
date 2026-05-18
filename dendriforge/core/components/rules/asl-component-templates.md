# DendriForge TOON Component Standard
# ASL 0.1.0 — Component Profile Schema v1
# Unified reference: Boards + Components

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEVIATIONS DETECTED IN DRAFTS vs VALIDATED STANDARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# 1. Inconsistent section numbering
#    DRAFT:     1.IDENTIFICATION / 2.PARAMETERS / 3.PORTS / 4.SIMULATION ...
#    STANDARD:  METADATA (outside numbering) / 1.DEVICE IDENTIFICATION /
#               2.TECH SPECS / 3.ELECTRICAL PROFILE / 4.GPIO MAP / ...
#    FIX:       Components use their own numbering (1–8), boards keep (1–7)
#               The METADATA section is always outside numbering, no ## prefix

# 2. METADATA section missing "##" prefix
#    DRAFT:     ## METADATA:   ← wrong
#    STANDARD:  # METADATA:    ← correct (root block, not a subsection)

# 3. "CONNECTIONS & COMPATIBILITY" section numbered twice
#    DRAFT:     ## 6. LIMITS & WARNINGS / ## 6. CONNECTIONS (duplicate!)
#    FIX:       Connections becomes ## 7. CONNECTIONS & COMPATIBILITY
#               Visual becomes ## 8. VISUAL & CANVAS (not ## 7)
#               Agent Skills becomes ## 9. AGENT SKILLS (not ## 8)

# 4. Extra fluid/protocol sections without fixed numbering
#    DRAFT:     ## 4b. FLUID PORTS / ## 7b. SENSOR SLOTS  ← no standard
#    FIX:       Extra sections receive suffix letter immediately after base number:
#               ## 4. ELECTRICAL PORTS
#               ## 4b. FLUID PORTS / ## 4c. PROTOCOL PORTS
#               ## 7b. SENSOR SLOTS / ## 7c. MEASUREMENT TARGETS

# 5. "standard" field in IDENTIFICATION has no equivalent in boards
#    FIX:       Boards do not have "standard" (it is hardware, not a symbol standard)
#               Components always have "standard" + "symbol_standard"
#               Boards only have "image" (no "symbol")

# 6. Mixed Portuguese/English in comments
#    FIX:       Internal .toon comments are always in ENGLISH
#               External documentation (planning, wiki) may be in PT

# 7. Missing "url" field in components
#    FIX:       Components use url: null (not mandatory but should be present)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MANDATORY STRUCTURE — BOARDS (already validated, reference)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# METADATA:
# ## 1. DEVICE IDENTIFICATION
# ## 2. TECH SPECS & DIMENSIONS
# ## 3. ELECTRICAL PROFILE (POWER PINS)
# ## 4. GPIO MAP
# ## 5. PERIPHERALS & USB
# ## 6. RESTRICTIONS & COMPATIBILITY
# ## 7. AGENT SKILLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MANDATORY STRUCTURE — COMPONENTS (corrected and validated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# METADATA:
# ## 1. IDENTIFICATION
# ## 2. PARAMETERS
# ## 3. ELECTRICAL PORTS
# ## 4b. FLUID PORTS          ← only for pneumatics / hydraulics
# ## 4c. PROTOCOL PORTS       ← only for communication
# ## 4. SIMULATION BEHAVIOR
# ## 5. LIMITS & WARNINGS
# ## 6. CONNECTIONS & COMPATIBILITY
# ## 7. VISUAL & CANVAS
# ## 7b. SENSOR SLOTS         ← only for fluid actuators with position
# ## 7c. MEASUREMENT TARGETS  ← only for virtual-instruments
# ## 8. AGENT SKILLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §GLOBAL VALID VALUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# §FAMILY — valid values for family:
#   electricals | sensors | command-elements | actuators
#   pneumatics | hydraulics | communication
#   industrial | virtual-instruments | panel-infrastructure

# §SUBFAMILY — valid values per family:
#   electricals:          sources | passives | semiconductors |
#                         protection | distribution
#   sensors:              environment | motion-position | electrical |
#                         process | industrial-presence-safety
#   command-elements:     pushbuttons | selectors | emergency-safety |
#                         signaling | special-interfaces
#   actuators:            maker-prototyping | industrial-electrical |
#                         motor-drives | linear-valves
#   pneumatics:           pneumatic-actuators | directional-valves |
#                         flow-pressure-control | solenoids |
#                         air-preparation | instrumentation | vacuum
#   hydraulics:           hydraulic-actuators | directional-valves |
#                         pressure-control | flow-control | pumps |
#                         check-special-valves | filtration | instrumentation
#   communication:        serial-bus | industrial-network | wireless |
#                         gateways | traffic-monitors
#   industrial:           logic-control | io-banks | process-modules |
#                         hmi-signaling | functional-safety | motor-drives
#   virtual-instruments:  probes | bench-instruments | signal-analysis |
#                         protocol-monitors | debug-fault-injection
#   panel-infrastructure: circuit-protection | fuses | din-supplies |
#                         terminals | busbars | aux-relays |
#                         contactors | inverters-starters | energy-metering

# §CATEGORY — valid values for category:
#   passive | semiconductor | source | sensor | command | signal
#   actuator | valve | pump | accessory | stub | monitor | gateway
#   node | function-block | instrument | protection | distribution
#   switching | metering

# §PORT MEDIUM — valid values for ports[n].type:
#   electrical:  power | ground | digital | analog | pwm
#                uart | spi | i2c | can | bus
#   fluid:       pneumatic | hydraulic
#   logical:     bool | int | float | word | dword
#   protocol:    serial | bus | wireless | network

# §PORT DIRECTION — valid values:
#   input | output | passive | bidirectional | exhaust

# §SIMULATION MODEL — valid values for simulation.model:
#   ohms-law | ideal | capacitor | inductor | transformer
#   threshold | analog-transfer | lookup-table | script
#   contact-block | relay-coil | latching-contact
#   pid-controller | timer-block | counter-block | function-block-engine
#   pneumatic-linear-actuator | pneumatic-rotary-actuator | pneumatic-valve
#   hydraulic-linear-actuator | hydraulic-rotary-actuator | hydraulic-valve
#   hydraulic-pump | fluid-pressure-source
#   digital-io | pwm-output | adc-input | uart-bridge
#   spice | basic-analog | basic-digital

# §SIMULATION ENGINE — valid values for dendriForge.simulationEngine:
#   basic-analog | basic-digital | digital-io
#   pneumatic-motion | hydraulic-motion
#   protocol-stub-engine | function-block-engine
#   measurement-engine

# §SYMBOL STANDARD — valid values:
#   IEC | ANSI | ISO | DIN | NFPA | JIS | custom | null

# §PARAM TYPE — valid values for params.*.type:
#   float | int | enum | bool | string

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VALIDATED TEMPLATES (12 component families)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ─────────────────────────────────────────────
# TEMPLATE 1 — ELECTRICAL PASSIVES
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: electricals
subfamily: passives
category: passive
standard: "{IEC/ANSI ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  {primary_value}:
    label: "{Label}"
    unit: {unit}
    default: {default}
    min: {min}
    max: {max}
    type: float
    editable: true
  tolerance:
    label: "Tolerance"
    unit: "%"
    default: 5
    options: [1, 5, 10, 20]
    type: enum
    editable: true
  power_rating:
    label: "Power Rating"
    unit: W
    default: 0.25
    options: [0.125, 0.25, 0.5, 1, 2, 5, 10]
    type: enum
    editable: true
  temp_coefficient:
    label: "Temp. Coefficient"
    unit: "ppm/°C"
    default: 100
    type: float
    editable: false

## 3. ELECTRICAL PORTS:
# Format: id | direction | type | voltage_max | current_max | notes
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  A|passive|analog|null|null|"terminal A"
  B|passive|analog|null|null|"terminal B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ohms-law
  equation: "{V = I * R}"
  bidirectional: true
  dynamic: false
  thermal_model: false
  noise_model: false
  states[1]:
    - nominal

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: null
  max_current: null
  max_power:
    value: "{power_rating}"
    unit: W
  max_temp: 125
  min_temp: -55
warnings[2]:
  - "{primary_warning}"
  - "Derate 50% above 70°C ambient"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["{use_case_1}", "{use_case_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 60
  height: 20
  ports_layout: horizontal
  port_A: {x: 0,  y: 10}
  port_B: {x: 60, y: 10}
  label_position: top
  value_display: "{primary_value}{unit}"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: {slug}
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Passives"
  tags: [{tag1}, passive, analog]


# ─────────────────────────────────────────────
# TEMPLATE 2 — SEMICONDUCTORS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: electricals
subfamily: semiconductors
category: semiconductor
standard: "{ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  forward_voltage:
    label: "Forward Voltage"
    unit: V
    default: 0.7
    type: float
    editable: false
  max_current:
    label: "Max Current"
    unit: A
    default: 1.0
    type: float
    editable: false
  package:
    label: "Package"
    default: "THT"
    options: ["THT", "SMD-SOT23", "SMD-SO8", "TO-220", "TO-92"]
    type: enum
    editable: true
  color:
    label: "Color"
    default: "red"
    options: ["red", "green", "blue", "yellow", "white", "IR"]
    type: enum
    editable: true
    applies_to: [led, led-rgb]

## 3. ELECTRICAL PORTS:
# 2-terminal default; add G for 3-terminal devices
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  A|input|analog|"{Vmax}"|"{Imax}"|"anode / gate / base / drain"
  K|output|analog|"{Vmax}"|"{Imax}"|"cathode / emitter / source"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ideal
  bidirectional: false
  dynamic: false
  thermal_model: false
  noise_model: false
  states[2]:
    - off
    - conducting

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{Vmax}"
  max_current: "{Imax}"
  max_power:
    value: "{Pmax}"
    unit: W
  max_temp: 150
  min_temp: -55
warnings[1]:
  - "Exceeding Vmax or Imax will destroy the device"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: ["resistor"]
  typical_context: ["{use_case}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 40
  height: 40
  ports_layout: custom
  port_A: {x: 0,  y: 20}
  port_K: {x: 40, y: 20}
  label_position: top
  value_display: "{name}"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: {slug}
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Semiconductors"
  tags: [{tag1}, semiconductor, {type}]


# ─────────────────────────────────────────────
# TEMPLATE 3 — POWER SOURCES
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: electricals
subfamily: sources
category: source
standard: "{ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  voltage:
    label: "Voltage"
    unit: V
    default: 24
    min: 0
    max: 1000
    type: float
    editable: true
  frequency:
    label: "Frequency"
    unit: Hz
    default: 50
    options: [50, 60]
    type: enum
    editable: true
    applies_to: [ac-source, ac-source-3phase]
  current_limit:
    label: "Current Limit"
    unit: A
    default: 10
    type: float
    editable: true
  internal_resistance:
    label: "Internal Resistance"
    unit: Ω
    default: 0.01
    type: float
    editable: false

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  POS|output|power|"{voltage}"|"{current_limit}"|"positive / phase A"
  NEG|output|ground|null|null|"negative / neutral / PE"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ideal
  waveform: DC
  bidirectional: false
  dynamic: true
  thermal_model: false
  noise_model: false
  states[2]:
    - on
    - off

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{voltage}"
  max_current: "{current_limit}"
  max_power: null
  max_temp: 70
  min_temp: -10
warnings[1]:
  - "Short-circuit protection must be external"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["power-supply", "test-bench", "circuit-power"]

## 7. VISUAL & CANVAS:
canvas:
  width: 50
  height: 50
  ports_layout: custom
  port_POS: {x: 50, y: 15}
  port_NEG: {x: 50, y: 35}
  label_position: left
  value_display: "{voltage}V / {current_limit}A"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: {slug}
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Sources"
  tags: [{tag1}, source, power, {waveform}]


# ─────────────────────────────────────────────
# TEMPLATE 4 — SENSORS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: sensors
subfamily: {subfamily}
category: sensor
standard: "{IEC/ISO ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  output_type:
    label: "Output Type"
    default: "PNP-NO"
    options: ["PNP-NO", "PNP-NC", "NPN-NO", "NPN-NC",
              "2-wire-NO", "2-wire-NC", "analog-0-10V", "analog-4-20mA"]
    type: enum
    editable: true
  range:
    label: "Sensing Range"
    unit: "{unit}"
    default: {default}
    min: {min}
    max: {max}
    type: float
    editable: true
  supply_voltage:
    label: "Supply Voltage"
    unit: V
    default: 24
    options: [5, 12, 24, 48]
    type: enum
    editable: true
  response_time:
    label: "Response Time"
    unit: ms
    default: 1
    type: float
    editable: false
  hysteresis:
    label: "Hysteresis"
    unit: "%"
    default: 10
    type: float
    editable: false

## 3. ELECTRICAL PORTS:
ports[3|]{id|direction|type|voltage_max|current_max|notes}:
  VCC|input|power|48V|200mA|"supply +"
  GND|input|ground|null|null|"supply -"
  OUT|output|digital|"{supply_voltage}"|200mA|"signal out"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: threshold
  trigger: {trigger_type}
  trigger_source: external
  output_logic: "{output_type}"
  bidirectional: false
  dynamic: true
  thermal_model: false
  noise_model: false
  states[3]:
    - idle
    - detected
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{supply_voltage}"
  max_current: 0.2
  max_power: null
  max_temp: {max_temp}
  min_temp: {min_temp}
  ip_rating: {ip_rating}
  safety_category: null
warnings[2]:
  - "{primary_warning}"
  - "{secondary_warning}"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["ind-di-bank", "ind-contact-no", "ind-contact-nc",
                 "ind-ai-bank", "plc-*", "comm-iolink-master-stub"]
  forbidden_with: ["ac-source", "ac-source-3phase"]
  requires: ["dc-source"]
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 40
  height: 40
  ports_layout: vertical
  port_VCC: {x: 20, y: 0}
  port_GND: {x: 20, y: 40}
  port_OUT: {x: 40, y: 20}
  label_position: right
  value_display: "{range}{unit} / {output_type}"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: sensors-family
  componentProfileId: {slug}
  simulationEngine: digital-io
  paletteGroup: "Sensors > {subfamily_label}"
  tags: [{tag1}, sensor, {subfamily}, {output_type}]


# ─────────────────────────────────────────────
# TEMPLATE 5 — COMMAND ELEMENTS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: command-elements
subfamily: {subfamily}
category: command
standard: "{IEC/ISO ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  contact_config:
    label: "Contact Configuration"
    default: "1NO"
    options: ["1NO", "1NC", "1NO+1NC", "2NO", "2NC", "2NO+2NC"]
    type: enum
    editable: true
  voltage_rating:
    label: "Voltage Rating"
    unit: V
    default: 240
    options: [24, 110, 240, 400]
    type: enum
    editable: false
  current_rating:
    label: "Current Rating"
    unit: A
    default: 10
    type: float
    editable: false
  color:
    label: "Color"
    default: "green"
    options: ["green", "red", "yellow", "blue", "white", "black"]
    type: enum
    editable: true
  illuminated:
    label: "Illuminated"
    default: false
    type: bool
    editable: true
  release_type:
    label: "Release Type"
    default: null
    options: ["twist-release", "pull-release", "key-release"]
    type: enum
    editable: true
    applies_to: [cmd-estop-mushroom, cmd-estop-key-release, cmd-estop-rope-pull]
  positions:
    label: "Number of Positions"
    default: 2
    options: [2, 3, 4, 6, 8, 12]
    type: enum
    editable: true
    applies_to: [cmd-selector-rotary-multi, cmd-cam-switch]

## 3. ELECTRICAL PORTS:
ports[4|]{id|direction|type|voltage_max|current_max|notes}:
  NO_in|input|digital|"{voltage_rating}"|"{current_rating}"|"NO contact in"
  NO_out|output|digital|"{voltage_rating}"|"{current_rating}"|"NO contact out"
  NC_in|input|digital|"{voltage_rating}"|"{current_rating}"|"NC contact in"
  NC_out|output|digital|"{voltage_rating}"|"{current_rating}"|"NC contact out"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: contact-block
  trigger: user-interaction
  bidirectional: false
  dynamic: true
  latching: {latching}
  release_condition: "{release_type}"
  thermal_model: false
  noise_model: false
  states[3]:
    - normal
    - actuated
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{voltage_rating}"
  max_current: "{current_rating}"
  max_power: null
  max_temp: 55
  min_temp: -25
  ip_rating: IP65
  safety_category: null
warnings[2]:
  - "{primary_warning}"
  - "{secondary_warning}"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["ind-contact-no", "ind-contact-nc", "ind-coil",
                 "ind-di-bank", "ind-safety-relay-block", "plc-*"]
  forbidden_with: []
  requires: []
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 50
  height: 50
  ports_layout: custom
  port_NO_in:  {x: 0,  y: 15}
  port_NO_out: {x: 50, y: 15}
  port_NC_in:  {x: 0,  y: 35}
  port_NC_out: {x: 50, y: 35}
  label_position: bottom
  value_display: "{contact_config} / {color}"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: command-elements-family
  componentProfileId: {slug}
  simulationEngine: digital-io
  paletteGroup: "Command Elements > {subfamily_label}"
  tags: [{tag1}, command, {subfamily}, {contact_config}]


# ─────────────────────────────────────────────
# TEMPLATE 6 — ELECTRICAL ACTUATORS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: actuators
subfamily: {subfamily}
category: actuator
standard: "{ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  voltage:
    label: "Nominal Voltage"
    unit: V
    default: 24
    options: [5, 12, 24, 48, 110, 230, 400]
    type: enum
    editable: true
  current:
    label: "Nominal Current"
    unit: A
    default: 1.0
    type: float
    editable: false
  power:
    label: "Rated Power"
    unit: W
    default: 24
    type: float
    editable: false
  speed:
    label: "Nominal Speed"
    unit: RPM
    default: 1500
    type: float
    editable: false
    applies_to: [act-motor-dc, act-motor-ac-1ph, act-motor-ac-3ph, act-stepper-motor]
  torque:
    label: "Nominal Torque"
    unit: "N·m"
    default: 1.0
    type: float
    editable: false
    applies_to: [act-motor-dc, act-motor-ac-1ph, act-motor-ac-3ph]
  steps_per_rev:
    label: "Steps per Revolution"
    default: 200
    options: [48, 100, 200, 400]
    type: enum
    editable: true
    applies_to: [act-stepper-motor]

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  IN_A|input|power|"{voltage}"|"{current}"|"supply / control A"
  IN_B|input|ground|null|null|"supply / control B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: {sim_model}
  motion: {motion_type}
  bidirectional: {bidirectional}
  dynamic: true
  feedback: false
  thermal_model: false
  noise_model: false
  states[3]:
    - off
    - running
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{voltage}"
  max_current: "{current}"
  max_power:
    value: "{power}"
    unit: W
  max_temp: 105
  min_temp: -20
warnings[2]:
  - "{primary_warning}"
  - "Provide flyback diode for inductive loads"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["act-vfd", "act-servo-drive", "act-starter-dol",
                 "ind-do-bank", "ind-coil", "relay-*", "contactor-*"]
  forbidden_with: []
  requires: ["dc-source"]
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 60
  height: 60
  ports_layout: custom
  port_IN_A: {x: 0, y: 20}
  port_IN_B: {x: 0, y: 40}
  label_position: bottom
  value_display: "{voltage}V / {power}W"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: actuators-family
  componentProfileId: {slug}
  simulationEngine: digital-io
  paletteGroup: "Actuators > {subfamily_label}"
  tags: [{tag1}, actuator, {subfamily}]


# ─────────────────────────────────────────────
# TEMPLATE 7 — PNEUMATICS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: pneumatics
subfamily: {subfamily}
category: {category}
standard: "{ISO ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: ISO

## 2. PARAMETERS:
params:
  bore:
    label: "Bore Diameter"
    unit: mm
    default: 32
    options: [12, 16, 20, 25, 32, 40, 50, 63, 80, 100]
    type: enum
    editable: true
    applies_to: [pneu-cylinder-*]
  stroke:
    label: "Stroke"
    unit: mm
    default: 100
    min: 10
    max: 2000
    type: float
    editable: true
    applies_to: [pneu-cylinder-*]
  supply_pressure:
    label: "Supply Pressure"
    unit: bar
    default: 6
    min: 1.5
    max: 10
    type: float
    editable: true
  port_size:
    label: "Port Size"
    default: "G1/8"
    options: ["M5", "G1/8", "G1/4", "G3/8", "G1/2", "G3/4", "G1"]
    type: enum
    editable: true
  cushioning:
    label: "Cushioning"
    default: "none"
    options: ["none", "fixed", "adjustable"]
    type: enum
    editable: true
    applies_to: [pneu-cylinder-da, pneu-cylinder-da-cushioned]
  initial_position:
    label: "Initial Position"
    default: "retracted"
    options: ["retracted", "extended"]
    type: enum
    editable: true
    applies_to: [pneu-cylinder-*]
  flow_rate:
    label: "Nominal Flow Rate"
    unit: "l/min"
    default: 200
    type: float
    editable: false
    applies_to: [pneu-valve-*, pneu-flow-control-*]

## 3. ELECTRICAL PORTS:
# Pure mechanical/fluid components have no electrical ports
ports[0|]{}:
# Electrovalves: uncomment and set n accordingly
# ports[2|]{id|direction|type|voltage_max|current_max|notes}:
#   SOL_A|input|power|30V|500mA|"solenoid coil +"
#   SOL_B|input|ground|null|null|"solenoid coil -"

## 4b. FLUID PORTS (PNEUMATIC):
# Format: id | direction | type | pressure_max | flow_nominal | notes
pneumatic_ports[5|]{id|direction|type|pressure_max|flow_nominal|notes}:
  P|input|pneumatic|10bar|"{flow_rate}"|"supply pressure"
  A|output|pneumatic|10bar|"{flow_rate}"|"port A — work"
  B|output|pneumatic|10bar|"{flow_rate}"|"port B — work"
  EA|exhaust|pneumatic|null|null|"exhaust A"
  EB|exhaust|pneumatic|null|null|"exhaust B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: {sim_model}
  motion: {motion_type}
  bidirectional: {bidirectional}
  dynamic: true
  position_feedback: {pos_fb}
  velocity_model: simplified
  thermal_model: false
  noise_model: false
  states[4]:
    - retracted
    - extending
    - extended
    - retracting

## 5. LIMITS & WARNINGS:
limits:
  max_pressure: 10
  min_pressure: 1.5
  max_voltage: null
  max_current: null
  max_power: null
  max_temp: 80
  min_temp: -20
  max_force:
    extend: "calc:pi*(bore/2)^2 * supply_pressure * 0.1"
    retract: "calc:pi*((bore/2)^2-(rod_diameter/2)^2) * supply_pressure * 0.1"
  ip_rating: IP65
warnings[2]:
  - "{primary_warning}"
  - "Minimum operating pressure: 1.5 bar"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["pneu-valve-*", "pneu-flow-control-*",
                 "pneu-quick-exhaust", "pneu-frl-unit"]
  forbidden_with: ["hyd-*", "act-motor-*"]
  requires: ["pneu-frl-unit"]
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 120
  height: 40
  ports_layout: custom
  port_P:  {x: 60,  y: 0}
  port_A:  {x: 20,  y: 0}
  port_B:  {x: 100, y: 0}
  port_EA: {x: 10,  y: 40}
  port_EB: {x: 110, y: 40}
  label_position: bottom
  value_display: "Ø{bore}mm × {stroke}mm / {supply_pressure}bar"
  animated: true

## 7b. SENSOR SLOTS:
sensor_slots[2|]{id|position|compatible_sensors}:
  S1|retracted-end|["pneu-reed-switch-cylinder", "pneu-magnetic-cylinder-sensor",
                    "pneu-inductive-limit", "pneu-mechanical-limit-switch"]
  S2|extended-end|["pneu-reed-switch-cylinder", "pneu-magnetic-cylinder-sensor",
                   "pneu-inductive-limit", "pneu-mechanical-limit-switch"]

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: pneumatics-family
  componentProfileId: {slug}
  simulationEngine: pneumatic-motion
  paletteGroup: "Pneumatics > {subfamily_label}"
  tags: [{tag1}, pneumatic, {subfamily}, ISO1219]


# ─────────────────────────────────────────────
# TEMPLATE 8 — HYDRAULICS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: hydraulics
subfamily: {subfamily}
category: {category}
standard: "{ISO ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: ISO

## 2. PARAMETERS:
params:
  bore:
    label: "Bore Diameter"
    unit: mm
    default: 63
    options: [25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250]
    type: enum
    editable: true
    applies_to: [hyd-cylinder-*]
  rod_diameter:
    label: "Rod Diameter"
    unit: mm
    default: 36
    type: float
    editable: false
    applies_to: [hyd-cylinder-*]
  stroke:
    label: "Stroke"
    unit: mm
    default: 200
    min: 50
    max: 5000
    type: float
    editable: true
    applies_to: [hyd-cylinder-*]
  operating_pressure:
    label: "Operating Pressure"
    unit: bar
    default: 200
    min: 10
    max: 350
    type: float
    editable: true
  flow_rate:
    label: "Nominal Flow Rate"
    unit: "l/min"
    default: 40
    type: float
    editable: true
  displacement:
    label: "Displacement"
    unit: "cm³/rev"
    default: 28
    type: float
    editable: false
    applies_to: [hyd-motor-*, hyd-pump-*]
  relief_pressure:
    label: "Relief Pressure"
    unit: bar
    default: 250
    type: float
    editable: true
    applies_to: [hyd-pressure-relief-valve, hyd-line-relief-valve]

## 3. ELECTRICAL PORTS:
ports[0|]{}:
# Electrovalves: uncomment accordingly
# ports[4|]{id|direction|type|voltage_max|current_max|notes}:
#   Y1_A|input|power|30V|500mA|"solenoid Y1 +"
#   Y1_B|input|ground|null|null|"solenoid Y1 -"
#   Y2_A|input|power|30V|500mA|"solenoid Y2 +"
#   Y2_B|input|ground|null|null|"solenoid Y2 -"

## 4b. FLUID PORTS (HYDRAULIC):
# Format: id | direction | type | pressure_max | flow_max | notes
hydraulic_ports[4|]{id|direction|type|pressure_max|flow_max|notes}:
  P|input|hydraulic|"{operating_pressure}bar"|"{flow_rate}"|"pressure line"
  T|output|hydraulic|5bar|"{flow_rate}"|"tank return"
  A|bidirectional|hydraulic|"{operating_pressure}bar"|"{flow_rate}"|"work port A"
  B|bidirectional|hydraulic|"{operating_pressure}bar"|"{flow_rate}"|"work port B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: {sim_model}
  motion: {motion_type}
  bidirectional: {bidirectional}
  dynamic: true
  position_feedback: {pos_fb}
  velocity_model: simplified
  thermal_model: false
  leakage_model: false
  noise_model: false
  states[4]:
    - retracted
    - extending
    - extended
    - retracting

## 5. LIMITS & WARNINGS:
limits:
  max_pressure: "{operating_pressure}"
  min_pressure: 10
  max_voltage: null
  max_current: null
  max_power: null
  max_temp: 80
  min_temp: -20
  max_force:
    extend: "calc:pi*(bore/2)^2 * operating_pressure * 0.1"
    retract: "calc:pi*((bore/2)^2-(rod_diameter/2)^2) * operating_pressure * 0.1"
  ip_rating: null
warnings[3]:
  - "Hydraulic pressure can be lethal — never disconnect under pressure"
  - "{primary_warning}"
  - "Ensure relief valve is sized above max system pressure"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["hyd-valve-*", "hyd-pump-*", "hyd-pressure-relief-valve",
                 "hyd-flow-control-*", "hyd-check-valve",
                 "hyd-accumulator-*", "hyd-manifold-block", "hyd-power-unit"]
  forbidden_with: ["pneu-*", "act-motor-*"]
  requires: ["hyd-power-unit"]
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 120
  height: 50
  ports_layout: custom
  port_P: {x: 20,  y: 0}
  port_T: {x: 100, y: 0}
  port_A: {x: 20,  y: 50}
  port_B: {x: 100, y: 50}
  label_position: bottom
  value_display: "Ø{bore}mm × {stroke}mm / {operating_pressure}bar"
  animated: true

## 7b. SENSOR SLOTS:
sensor_slots[2|]{id|position|compatible_sensors}:
  S1|retracted-end|["hyd-pressure-switch-nc", "hyd-pressure-switch-no",
                    "sensor-limit-switch", "hyd-linear-position-sensor"]
  S2|extended-end|["hyd-pressure-switch-nc", "hyd-pressure-switch-no",
                   "sensor-limit-switch", "hyd-linear-position-sensor"]

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: hydraulics-family
  componentProfileId: {slug}
  simulationEngine: hydraulic-motion
  paletteGroup: "Hydraulics > {subfamily_label}"
  tags: [{tag1}, hydraulic, {subfamily}, ISO1219]


# ─────────────────────────────────────────────
# TEMPLATE 9 — COMMUNICATION
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: communication
subfamily: {subfamily}
category: {category}
standard: "{ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  protocol:
    label: "Protocol"
    default: "{protocol}"
    options: ["{opt1}", "{opt2}"]
    type: enum
    editable: false
  baud_rate:
    label: "Baud Rate"
    unit: bps
    default: 9600
    options: [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200]
    type: enum
    editable: true
    applies_to: [comm-uart-terminal, comm-rs232-stub, comm-rs485-stub]
  device_address:
    label: "Device Address"
    default: 1
    min: 1
    max: 247
    type: int
    editable: true
  supply_voltage:
    label: "Supply Voltage"
    unit: V
    default: 24
    options: [5, 12, 24]
    type: enum
    editable: true

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  VCC|input|power|"{supply_voltage}"|500mA|"supply +"
  GND|input|ground|null|null|"supply -"

## 4c. PROTOCOL PORTS:
protocol_ports[1|]{id|direction|protocol|notes}:
  NET|bidirectional|"{protocol}"|"network connection"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: digital-io
  protocol_emulation: true
  bidirectional: true
  dynamic: true
  thermal_model: false
  noise_model: false
  states[3]:
    - idle
    - communicating
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{supply_voltage}"
  max_current: 0.5
  max_power: null
  max_temp: 70
  min_temp: -20
  ip_rating: null
warnings[1]:
  - "Simulation stub — does not represent a real physical device"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["comm-*", "ind-*", "plc-*"]
  forbidden_with: []
  requires: []
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 60
  height: 50
  ports_layout: custom
  port_VCC: {x: 30, y: 0}
  port_GND: {x: 30, y: 50}
  port_NET: {x: 60, y: 25}
  label_position: left
  value_display: "{protocol} @ {baud_rate}bps"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: communication-family
  componentProfileId: {slug}
  simulationEngine: protocol-stub-engine
  paletteGroup: "Communication > {subfamily_label}"
  tags: [{tag1}, communication, {protocol}, {subfamily}]


# ─────────────────────────────────────────────
# TEMPLATE 10 — INDUSTRIAL BLOCKS
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: industrial
subfamily: {subfamily}
category: function-block
standard: "{IEC 61131-3 ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  Kp:
    label: "Proportional Gain"
    default: 1.0
    min: 0.0
    max: 1000.0
    type: float
    editable: true

## 3. ELECTRICAL PORTS:
# Logical ports — no voltage/current limits (simulation signals only)
ports[4|]{id|direction|type|voltage_max|current_max|notes}:
  IN|input|{logical_type}|null|null|"{input_description}"
  OUT|output|{logical_type}|null|null|"{output_description}"
  EN|input|bool|null|null|"enable"
  ENO|output|bool|null|null|"enable output"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: {sim_model}
  equation: "{equation}"
  bidirectional: false
  dynamic: true
  real_time: true
  scan_cycle_aware: true
  thermal_model: false
  noise_model: false
  states[2]:
    - active
    - disabled

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: null
  max_current: null
  max_power: null
  max_temp: null
  min_temp: null
warnings[2]:
  - "{primary_warning}"
  - "{secondary_warning}"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["ind-*", "sensor-*", "act-*", "comm-*"]
  forbidden_with: []
  requires: []
  typical_context: ["{context_1}", "{context_2}"]

## 7. VISUAL & CANVAS:
canvas:
  width: 80
  height: {height}
  ports_layout: custom
  port_EN:  {x: 0,  y: 5}
  port_IN:  {x: 0,  y: 20}
  port_ENO: {x: 80, y: 5}
  port_OUT: {x: 80, y: 20}
  label_position: top
  value_display: "{block_label}"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: industrial-family
  componentProfileId: {slug}
  simulationEngine: function-block-engine
  paletteGroup: "Industrial > {subfamily_label}"
  tags: [{tag1}, IEC61131, function-block, {subfamily}]


# ─────────────────────────────────────────────
# TEMPLATE 11 — VIRTUAL INSTRUMENTATION
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: virtual-instruments
subfamily: {subfamily}
category: instrument
standard: null
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: custom

## 2. PARAMETERS:
params:
  measurement_range:
    label: "Measurement Range"
    default: "auto"
    options: ["auto", "{range_1}", "{range_2}"]
    type: enum
    editable: true
  sample_rate:
    label: "Sample Rate"
    unit: Hz
    default: 1000
    type: float
    editable: true
  resolution:
    label: "Resolution"
    unit: "{unit}"
    default: {default}
    type: float
    editable: false
  trigger_mode:
    label: "Trigger Mode"
    default: "free-run"
    options: ["free-run", "rising-edge", "falling-edge", "level", "protocol"]
    type: enum
    editable: true
    applies_to: [virt-oscilloscope, virt-logic-analyzer]

## 3. ELECTRICAL PORTS:
ports[1|]{id|direction|type|voltage_max|current_max|notes}:
  PROBE|input|analog|null|null|"measurement point"

## 7c. MEASUREMENT TARGETS:
measurement_targets[2|]{target|unit|description}:
  voltage|V|"node voltage"
  current|A|"branch current"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: script
  passive: true
  bidirectional: false
  dynamic: true
  real_time: true
  thermal_model: false
  noise_model: false
  states[2]:
    - measuring
    - idle

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: null
  max_current: null
  max_power: null
  max_temp: null
  min_temp: null
warnings[1]:
  - "Virtual instrument only — does not represent physical hardware"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["debugging", "measurement", "signal-analysis", "fault-finding"]

## 7. VISUAL & CANVAS:
canvas:
  width: 80
  height: 60
  ports_layout: custom
  port_PROBE: {x: 0, y: 30}
  label_position: top
  value_display: "{measurement_range} / {sample_rate}Hz"
  animated: true
  display_panel: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: virtual-instruments-family
  componentProfileId: {slug}
  simulationEngine: measurement-engine
  paletteGroup: "Virtual Instrumentation > {subfamily_label}"
  tags: [{tag1}, virtual, instrument, measurement, {subfamily}]


# ─────────────────────────────────────────────
# TEMPLATE 12 — PANEL INFRASTRUCTURE
# ─────────────────────────────────────────────

# METADATA:
project_name: {slug}-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: {slug}
name: "{Display Name}"
family: panel-infrastructure
subfamily: {subfamily}
category: {category}
standard: "{IEC ref}"
url: null
image: {slug}.svg
symbol: {slug}-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  rated_current:
    label: "Rated Current"
    unit: A
    default: 16
    options: [0.5, 1, 2, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125]
    type: enum
    editable: true
  rated_voltage:
    label: "Rated Voltage"
    unit: V
    default: 400
    options: [24, 48, 110, 230, 400, 690]
    type: enum
    editable: true
  poles:
    label: "Poles"
    default: 3
    options: [1, 2, 3, 4]
    type: enum
    editable: true
  trip_curve:
    label: "Trip Curve"
    default: "C"
    options: ["B", "C", "D", "K", "Z"]
    type: enum
    editable: true
    applies_to: [panel-mcb-*, panel-rcbo]
  breaking_capacity:
    label: "Breaking Capacity"
    unit: kA
    default: 6
    options: [3, 6, 10, 15, 25]
    type: enum
    editable: false
    applies_to: [panel-mcb-*, panel-rcbo, panel-rccb]

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  IN_L|input|power|"{rated_voltage}"|"{rated_current}"|"line in"
  OUT_L|output|power|"{rated_voltage}"|"{rated_current}"|"line out"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: contact-block
  bidirectional: false
  dynamic: true
  thermal_model: false
  trip_model: simplified
  noise_model: false
  states[3]:
    - closed
    - open
    - tripped

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "{rated_voltage}"
  max_current: "{rated_current}"
  max_power: null
  max_temp: 70
  min_temp: -25
  ip_rating: null
warnings[2]:
  - "Verify breaking capacity against prospective short-circuit current"
  - "{secondary_warning}"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["panel-*", "act-motor-*", "act-contactor", "dc-source", "ac-source-*"]
  forbidden_with: []
  requires: []
  typical_context: ["control-panel", "motor-control-center", "distribution-board"]

## 7. VISUAL & CANVAS:
canvas:
  width: 30
  height: 60
  ports_layout: vertical
  port_IN_L:  {x: 15, y: 0}
  port_OUT_L: {x: 15, y: 60}
  label_position: right
  value_display: "{rated_current}A / {rated_voltage}V"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: panel-infrastructure-family
  componentProfileId: {slug}
  simulationEngine: digital-io
  paletteGroup: "Panel Infrastructure > {subfamily_label}"
  tags: [{tag1}, panel, {subfamily}, IEC60947]


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# QUICK REFERENCE — MANDATORY vs OPTIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# MANDATORY in ALL templates:
#   project_name, version, editor, author, ASLversion
#   id, name, family, subfamily, category, url, image, symbol, symbol_standard
#   params (minimum 1 entry)
#   ports (can be [0|] for purely fluid components)
#   simulation.model, simulation.states
#   limits (max_voltage, max_current, max_temp, min_temp)
#   warnings (minimum 1)
#   connections (allowed_with, forbidden_with, requires, typical_context)
#   canvas (width, height, ports_layout, label_position, value_display)
#   dendriForge (componentFamilySkillId, componentProfileId,
#                simulationEngine, paletteGroup, tags)

# MANDATORY per family:
#   pneumatics  →  pneumatic_ports  (##4b)
#   hydraulics  →  hydraulic_ports  (##4b)
#   pneumatics / hydraulics (actuators with position)  →  sensor_slots (##7b)
#   communication  →  protocol_ports  (##4c)
#   virtual-instruments  →  measurement_targets  (##7c)

# OPTIONAL (recommended when applicable):
#   standard, url (fill in whenever an external reference exists)
#   params.*.applies_to
#   limits.ip_rating
#   limits.safety_category
#   limits.max_force (fluídicos)
#   simulation.equation
#   simulation.latching
#   simulation.position_feedback
#   simulation.real_time
#   simulation.scan_cycle_aware
#   simulation.leakage_model (advanced hydraulics)
#   canvas.animated
#   canvas.display_panel (virtual-instruments)

# FORBIDDEN VALUES:
#   forbidden_with: ["hyd-*"]  in any pneumatic component
#   forbidden_with: ["pneu-*"] in any hydraulic component
#   symbol_standard: value outside [IEC|ANSI|ISO|DIN|NFPA|JIS|custom|null]
#   simulation.model: value outside §SIMULATION MODEL
#   ports[n].type: value outside §PORT MEDIUM
#   ports[n].direction: value outside §PORT DIRECTION
#   family: value outside §FAMILY
#   subfamily: value outside the corresponding §SUBFAMILY
#   category: value outside §CATEGORY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEMPLATE vs ENGINE TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# T01  Electrical Passives        → basic-analog
# T02  Semiconductors             → basic-analog
# T03  Power Sources              → basic-analog
# T04  Sensors                    → digital-io
# T05  Command Elements           → digital-io
# T06  Electrical Actuators       → digital-io
# T07  Pneumatics                 → pneumatic-motion
# T08  Hydraulics                 → hydraulic-motion
# T09  Communication              → protocol-stub-engine
# T10  Industrial Blocks          → function-block-engine
# T11  Virtual Instrumentation    → measurement-engine
# T12  Panel Infrastructure       → digital-io