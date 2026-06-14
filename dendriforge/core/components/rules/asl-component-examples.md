# # EXEMPLO 1
# ___---___

# METADATA:
project_name: dc-psu-prog-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: dc-psu-prog
name: "Programmable DC Laboratory Power Supply"
family: electricals
subfamily: sources
category: source
standard: "IEC 61010-1"
url: "https://www.joy-it.net/en/products/JT-PS1440-C-Pro"
image: dc-psu-prog.svg
symbol: dc-psu-prog-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  voltage:
    label: "Output Voltage"
    unit: V
    default: 12
    min: 0
    max: 60
    type: float
    editable: true
  current_limit:
    label: "Current Limit"
    unit: A
    default: 1
    min: 0
    max: 24
    type: float
    editable: true
  ovp_threshold:
    label: "OVP Threshold"
    unit: V
    default: 62
    min: 0
    max: 66
    type: float
    editable: true
  ocp_threshold:
    label: "OCP Threshold"
    unit: A
    default: 25
    min: 0
    max: 26
    type: float
    editable: true
  output_enabled:
    label: "Output Enabled"
    default: true
    type: bool
    editable: true
  memory_slot:
    label: "Memory Slot"
    default: 0
    options: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    type: enum
    editable: true
  operating_mode:
    label: "Operating Mode"
    default: "CV"
    options: ["CV", "CC"]
    type: enum
    editable: false

## 3. ELECTRICAL PORTS:
ports[3|]{id|direction|type|voltage_max|current_max|notes}:
  AC_IN|input|power|"250V"|"10A"|"AC mains input 230V"
  POS|output|power|"60V"|"24A"|"positive DC output terminal"
  NEG|output|ground|null|null|"negative DC output terminal / GND"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ideal
  waveform: DC
  equation: "V_out = voltage; I_out = min(I_load, current_limit)"
  bidirectional: false
  dynamic: true
  thermal_model: false
  noise_model: false
  states[3]:
    - off
    - on
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "60V"
  max_current: "24A"
  max_power:
    value: 1440
    unit: W
  max_temp: 40
  min_temp: -10
warnings[4]:
  - "Input must be 230V AC — do not connect to other voltages"
  - "Never short-circuit the output terminals"
  - "OVP and OCP must be configured before use in sensitive circuits"
  - "Step-down operation only — output voltage must be below input-derived rail"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["lab-bench", "battery-charging", "device-under-test", "burn-in-test"]

## 7. VISUAL & CANVAS:
canvas:
  width: 80
  height: 60
  ports_layout: custom
  port_AC_IN: {x: 0, y: 10}
  port_POS: {x: 80, y: 15}
  port_NEG: {x: 80, y: 45}
  label_position: top
  value_display: "{voltage}V / {current_limit}A"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: dc-psu-prog
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Sources"
  tags[6]:
    - dc-power-supply
    - programmable
    - laboratory
    - source
    - bench-instrument
    - adjustable
	
# # EXEMPLO 2
# ___---___

# METADATA:
project_name: signal-generator-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: signal-generator
name: "Signal Generator"
family: electricals
subfamily: sources
category: source
standard: "IEC 61010-1"
url: null
image: signal-generator.svg
symbol: signal-generator-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  waveform_type:
    label: "Waveform Type"
    default: "sine"
    options: ["sine", "square", "triangle", "noise", "pwm", "DC"]
    type: enum
    editable: true
  frequency:
    label: "Frequency"
    unit: V
    default: 1000
    min: 0.001
    max: 1000000
    type: float
    editable: true
  amplitude:
    label: "Amplitude (peak)"
    unit: V
    default: 1
    min: 0
    max: 20
    type: float
    editable: true
  offset:
    label: "DC Offset"
    unit: V
    default: 0
    min: -20
    max: 20
    type: float
    editable: true
  duty_cycle:
    label: "Duty Cycle (square/pwm only)"
    unit: "%"
    default: 50
    min: 0
    max: 100
    type: float
    editable: true
  phase:
    label: "Phase Offset"
    unit: "%"
    default: 0
    min: 0
    max: 360
    type: float
    editable: true
  output_impedance:
    label: "Output Impedance"
    unit: Ω
    default: 50
    options: [50, 600]
    type: enum
    editable: true
  output_enabled:
    label: "Output Enabled"
    default: true
    type: bool
    editable: true

## 3. ELECTRICAL PORTS:
ports[4|]{id|direction|type|voltage_max|current_max|notes}:
  OUT|output|analog|"20V"|"200mA"|"main signal output"
  OUT_INV|output|analog|"20V"|"200mA"|"inverted signal output"
  GND|output|ground|null|null|"signal ground / chassis"
  TRIG_IN|input|digital|"5V"|"10mA"|"external trigger / sync input"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ideal
  waveform: sine
  equation: "V_out = amplitude * waveform(waveform_type, frequency, t, phase) + offset"
  bidirectional: false
  dynamic: true
  thermal_model: false
  noise_model: true
  states[3]:
    - off
    - running
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "20V"
  max_current: "200mA"
  max_power: null
  max_temp: 50
  min_temp: -10
warnings[3]:
  - "Do not connect output directly to low-impedance loads without proper matching"
  - "DC offset combined with amplitude must not exceed max_voltage rating"
  - "External trigger voltage must not exceed 5V TTL levels"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["circuit-testing", "frequency-response", "filter-characterisation", "oscilloscope-input"]

## 7. VISUAL & CANVAS:
canvas:
  width: 80
  height: 70
  ports_layout: custom
  port_OUT: {x: 80, y: 15}
  port_OUT_INV: {x: 80, y: 35}
  port_GND: {x: 80, y: 55}
  port_TRIG_IN: {x: 0, y: 30}
  label_position: top
  value_display: "{waveform_type} / {frequency}Hz / {amplitude}Vp"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: signal-generator
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Sources"
  tags[7]:
    - signal-generator
    - source
    - waveform
    - sine
    - square
    - laboratory
    - bench-instrument

# # EXEMPLO 3
# ___---___

# METADATA:
project_name: resistor-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: resistor
name: "Resistor"
family: electricals
subfamily: passives
category: passive
standard: "IEC 60062"
url: null
image: resistor.svg
symbol: resistor-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  resistance:
    label: "Resistance"
    unit: Ω
    default: 1000
    min: 0.001
    max: 10000000
    type: float
    editable: true
  tolerance:
    label: "Tolerance"
    unit: "%"
    default: 5
    options: [0.1, 0.5, 1, 2, 5, 10, 20]
    type: enum
    editable: true
  power_rating:
    label: "Power Rating"
    unit: W
    default: 0.25
    options: [0.063, 0.125, 0.25, 0.5, 1, 2, 5, 10, 25, 50]
    type: enum
    editable: true
  temp_coefficient:
    label: "Temp. Coefficient"
    unit: "%"
    default: 100
    min: 10
    max: 500
    type: float
    editable: false
  package:
    label: "Package"
    default: "THT"
    options: ["THT", "SMD-0402", "SMD-0603", "SMD-0805", "SMD-1206", "SMD-2512"]
    type: enum
    editable: true

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  A|passive|analog|null|null|"terminal A"
  B|passive|analog|null|null|"terminal B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ohms-law
  equation: "V = I * resistance"
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
  max_temp: 155
  min_temp: -55
warnings[2]:
  - "Do not exceed rated power dissipation"
  - "Derate 50% above 70°C ambient temperature"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["current-limiting", "voltage-divider", "pull-up", "pull-down"]

## 7. VISUAL & CANVAS:
canvas:
  width: 60
  height: 20
  ports_layout: horizontal
  port_A: {x: 0, y: 10}
  port_B: {x: 60, y: 10}
  label_position: top
  value_display: "{resistance}Ω / {power_rating}W"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: resistor
  simulationEngine: basic-analog
  paletteGroup: "Fundamental Electricals > Passives"
  tags[5]:
    - resistor
    - passive
    - analog
    - ohms-law
    - passive-component

# # EXEMPLO 4
# ___---___

# METADATA:
project_name: motor-ac-3ph-profile
version: 1
editor: dendriForge
author: schemasmith
ASLversion: 0.1.0

## 1. IDENTIFICATION:
id: motor-ac-3ph
name: "Three-Phase AC Induction Motor"
family: actuators
subfamily: industrial-electrical
category: actuator
standard: "IEC 60034-1 / IEC 60034-30-1"
url: null
image: motor-ac-3ph.svg
symbol: motor-ac-3ph-symbol.svg
symbol_standard: IEC

## 2. PARAMETERS:
params:
  power_rated:
    label: "Rated Power"
    unit: W
    default: 3000
    min: 120
    max: 1000000
    type: float
    editable: true
  voltage_rated:
    label: "Rated Voltage (L-L)"
    unit: V
    default: 400
    options: [230, 400, 415, 690, 1000, 3300, 6000, 11000]
    type: enum
    editable: true
  frequency:
    label: "Supply Frequency"
    unit: V
    default: 50
    options: [50, 60]
    type: enum
    editable: true
  poles:
    label: "Number of Poles"
    default: 4
    options: [2, 4, 6, 8]
    type: enum
    editable: true
  speed_rated:
    label: "Rated Speed"
    unit: V
    default: 1440
    min: 600
    max: 3600
    type: float
    editable: false
  current_rated:
    label: "Rated Current"
    unit: A
    default: 6.8
    min: 0.1
    max: 2000
    type: float
    editable: false
  power_factor:
    label: "Power Factor (cos φ)"
    unit: "%"
    default: 0.83
    min: 0.6
    max: 0.95
    type: float
    editable: false
  efficiency_class:
    label: "Efficiency Class"
    default: "IE3"
    options: ["IE1", "IE2", "IE3", "IE4", "IE5"]
    type: enum
    editable: true
  efficiency:
    label: "Rated Efficiency"
    unit: "%"
    default: 89.1
    min: 70
    max: 98
    type: float
    editable: false
  duty_cycle:
    label: "Duty Cycle"
    default: "S1"
    options: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]
    type: enum
    editable: true
  insulation_class:
    label: "Insulation Class"
    default: "F"
    options: ["B", "F", "H"]
    type: enum
    editable: true
  protection_class:
    label: "Protection Class (IP)"
    default: "IP55"
    options: ["IP23", "IP44", "IP54", "IP55", "IP65", "IP66", "IP67"]
    type: enum
    editable: true
  wiring:
    label: "Winding Connection"
    default: "delta"
    options: ["star", "delta", "star-delta"]
    type: enum
    editable: true
  mounting:
    label: "Mounting Form"
    default: "B3"
    options: ["B3", "B5", "B14", "B34", "B35", "V1"]
    type: enum
    editable: true

## 3. ELECTRICAL PORTS:
ports[4|]{id|direction|type|voltage_max|current_max|notes}:
  U1|input|power|"11000V"|"2000A"|"phase U / L1 supply terminal"
  V1|input|power|"11000V"|"2000A"|"phase V / L2 supply terminal"
  W1|input|power|"11000V"|"2000A"|"phase W / L3 supply terminal"
  PE|input|ground|null|null|"protective earth / frame ground"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: basic-analog
  motion: rotary
  equation: "T = (power_rated * efficiency/100) / (2 * pi * speed_rated / 60); I = power_rated / (sqrt(3) * voltage_rated * power_factor * efficiency/100)"
  bidirectional: false
  dynamic: true
  thermal_model: true
  noise_model: false
  states[4]:
    - off
    - starting
    - running
    - fault

## 5. LIMITS & WARNINGS:
limits:
  max_voltage: "11000V"
  max_current: "2000A"
  max_power: null
  max_temp: 40
  min_temp: -20
  ip_rating: "IP55"
warnings[4]:
  - "Always verify phase sequence before starting — incorrect sequence causes reverse rotation"
  - "Provide overcurrent and thermal overload protection sized to rated current"
  - "Star-delta starters must not switch under full load — use adequate timing relay"
  - "Do not exceed insulation class temperature limit including ambient and self-heating"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["ac-source-3phase", "contactor-*", "act-vfd", "act-starter-dol", "act-starter-sd"]
  forbidden_with: ["dc-source", "ac-source", "battery"]
  requires: ["ac-source-3phase"]
  typical_context: ["pump-drive", "fan-drive", "compressor", "conveyor", "industrial-machine"]

## 7. VISUAL & CANVAS:
canvas:
  width: 80
  height: 70
  ports_layout: custom
  port_U1: {x: 0, y: 15}
  port_V1: {x: 0, y: 35}
  port_W1: {x: 0, y: 55}
  port_PE: {x: 40, y: 70}
  label_position: right
  value_display: "{power_rated}W / {voltage_rated}V / {speed_rated}rpm ({efficiency_class})"
  animated: true

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: actuators-family
  componentProfileId: motor-ac-3ph
  simulationEngine: digital-io
  paletteGroup: "Actuators > Industrial Electrical"
  tags[8]:
    - motor
    - ac
    - three-phase
    - induction
    - actuator
    - industrial
    - squirrel-cage
    - iec-60034