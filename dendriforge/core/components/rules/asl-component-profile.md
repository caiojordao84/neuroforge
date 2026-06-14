# ASL Component Profile — Dialect Rules
**Spec reference:** toon-format/spec v3.0 (2025-11-24) + domain extensions for ASL component profiles
**File:** `asl-component-profile.rules`
**Inherits:** `toon-dialect-core.rules` (§1–§13 + §15) — all core rules apply unchanged
**Scope:** All component profiles (`family`: electricals, sensors, command-elements, actuators,
  pneumatics, hydraulics, communication, industrial, virtual-instruments, panel-infrastructure)
**Precedence:** TOON spec v3.0 (normative) > dialect extensions (informative where spec is silent)

> This file defines **only** the domain-specific overrides: §5 domain constraints and §14 semantic validations.
> Sections §1–§4, §6–§13, and §15 are inherited from `toon-dialect-core.rules` without modification.
> The MCU-specific and PLC-specific extensions do **not** apply here.

---

## §5 — Scalar Value Types (Component Domain Overrides)

Core scalar rules are inherited from `toon-dialect-core.rules §5`. The following domain constraints
**extend** the core rules for component profiles.

### §5.1 — Numeric Parameters

- All numeric param `default`, `min`, `max` values **MUST** be expressed as bare numbers (integer or float).
  - Valid: `default: 0.25`, `min: 0`, `max: 1000`
  - Invalid: `default: 0.25W` (unit goes in the separate `unit` field)
- `version` **MUST** be a positive integer (inherited §13).
- `width` and `height` in `canvas` **MUST** be positive integers (canvas units).
- Coordinate values (`x`, `y`) in port layout **MUST** be non-negative integers.

### §5.2 — Allowed Unit Suffixes

The permitted unit suffix set for component profiles (value-with-unit strings in `limits` and `restrictions`):

| Suffix | Meaning               | Example          |
|--------|-----------------------|------------------|
| `V`    | Volts                 | `5V`, `48V`      |
| `A`    | Amperes               | `2A`, `0.5A`     |
| `mA`   | Milliamperes          | `200mA`, `500mA` |
| `W`    | Watts                 | `25W`, `0.25W`   |
| `bar`  | Pressure (fluid)      | `10bar`, `1.5bar`|
| `°C`   | Temperature (Celsius) | `125°C`          |
| `%`    | Percentage            | `5%`, `10%`      |
| `Ω`    | Ohms                  | `0.01Ω`          |

- A number immediately followed by one of the above suffixes (no space) is a **unit string**.
- Unit strings are scalar strings in TOON's type model, **not** numbers.
- `MHz`, `KB`, `kHz`, `ms` **MUST NOT** be used in component profiles (those are board-domain suffixes).
- `clock` as a field key is **forbidden** in component profiles.

### §5.3 — Boolean Shorthand

- The `t` / `f` shorthand is **forbidden** in component profiles.
- **MUST** use full literals `true` or `false` everywhere.
- Parsers operating on component profiles **MUST NOT** apply the MCU/PLC boolean shorthand mapping.

### §5.4 — Calc Expressions

- `max_force.extend` and `max_force.retract` values **MAY** use a `calc:` prefix followed by a
  mathematical expression string.
  - Format: `"calc:<expression>"`
  - These values **MUST** always be quoted (they contain `:`, which triggers quoting per §12).
  - Example: `"calc:pi*(bore/2)^2 * supply_pressure * 0.1"`
- Parsers **MUST NOT** evaluate `calc:` expressions at parse time; they are deferred to the simulation engine.

### §5.5 — Enum Option Lists

- Param `options` lists use TOON list syntax: `[value1, value2, ...]` on a single line
  or block list array syntax.
- String options **MUST** be quoted if they contain spaces, colons, or special characters.
- Numeric options **MUST** be bare numbers (no unit suffix inside options lists).

### §5.6 — IP Rating Values

- `ip_rating` **MUST** be `null` or one of the following quoted strings:
  `"IP54"`, `"IP65"`, `"IP67"`, `"IP68"`, `"IP69K"`.
- Any other string is **invalid**.

### §5.7 — Safety Category Values

- `safety_category` **MUST** be `null` or one of the following quoted strings:
  `"Cat.2 PLc"`, `"Cat.3 PLd"`, `"Cat.4 PLe"`.

---

## §14 — Semantic Validations (Component Domain)

> This section **replaces** §14 of `asl-mcu-profile.rules` and `asl-plc-profile.rules` entirely.
> None of the MCU §14 or PLC §14 constraints apply to component profiles.

### §14.1 — METADATA

- **Required keys** (inherited §13): `project_name`, `version`, `editor`, `author`, `ASLversion`.
- `project_name` **MUST** match the pattern `^[a-z][a-z0-9-]+-profile$`.
  - Example: `resistor-profile`, `pneu-cylinder-da-profile`
- `editor` **MUST** be `dendriForge`.
- `author` **MUST** be `schemasmith`.

### §14.2 — IDENTIFICATION

Required fields: `id`, `name`, `family`, `subfamily`, `category`, `url`, `image`, `symbol`, `symbol_standard`.

- `id` **MUST** match kebab-case: `^[a-z][a-z0-9-]*$`.
  - Example: `resistor`, `pneu-cylinder-da`, `act-motor-dc`
- `name` **MUST** be a quoted non-empty string.
- `family` **MUST** be one of:
  `electricals`, `sensors`, `command-elements`, `actuators`,
  `pneumatics`, `hydraulics`, `communication`, `industrial`,
  `virtual-instruments`, `panel-infrastructure`
- `subfamily` **MUST** be a value from the allowed set for the declared `family` (see §14.2a).
- `category` **MUST** be one of:
  `passive`, `semiconductor`, `source`, `sensor`, `command`, `signal`,
  `actuator`, `valve`, `pump`, `accessory`, `stub`, `monitor`, `gateway`,
  `node`, `function-block`, `instrument`, `protection`, `distribution`,
  `switching`, `metering`
- `url` **MUST** be `null` or a well-formed absolute URL (`https://...`).
  - If a Markdown link `[text](url)` form is used, it **MUST** be quoted.
- `image` **MUST** be a relative `.svg` filename with no path traversal characters.
  - Pattern: `^[a-z][a-z0-9-]*\.svg$`
- `symbol` **MUST** be a relative `.svg` filename matching `^[a-z][a-z0-9-]*-symbol\.svg$`.
- `symbol_standard` **MUST** be one of: `IEC`, `ANSI`, `ISO`, `DIN`, `NFPA`, `JIS`, `custom`, `null`.

#### §14.2a — Family → Subfamily Allowed Values

| `family`               | Allowed `subfamily` values                                                                                          |
|------------------------|---------------------------------------------------------------------------------------------------------------------|
| `electricals`          | `sources`, `passives`, `semiconductors`, `displays`, `protection`, `distribution`                                   |
| `sensors`              | `environment`, `motion-position`, `electrical`, `process`, `industrial-presence-safety`                            |
| `command-elements`     | `pushbuttons`, `selectors`, `emergency-safety`, `signaling`, `special-interfaces`                                  |
| `actuators`            | `maker-prototyping`, `industrial-electrical`, `motor-drives`, `linear-valves`                                      |
| `pneumatics`           | `pneumatic-actuators`, `directional-valves`, `flow-pressure-control`, `solenoids`, `air-preparation`, `instrumentation`, `vacuum` |
| `hydraulics`           | `hydraulic-actuators`, `directional-valves`, `pressure-control`, `flow-control`, `pumps`, `check-special-valves`, `filtration`, `instrumentation` |
| `communication`        | `serial-bus`, `industrial-network`, `wireless`, `gateways`, `traffic-monitors`                                     |
| `industrial`           | `logic-control`, `io-banks`, `process-modules`, `hmi-signaling`, `functional-safety`, `motor-drives`               |
| `virtual-instruments`  | `probes`, `bench-instruments`, `signal-analysis`, `protocol-monitors`, `debug-fault-injection`                     |
| `panel-infrastructure` | `circuit-protection`, `fuses`, `din-supplies`, `terminals`, `busbars`, `aux-relays`, `contactors`, `inverters-starters`, `energy-metering` |

### §14.3 — PARAMETERS

- `params` **MUST** be a nested block with at least one parameter entry.
- Each parameter entry **MUST** contain: `label`, `type`, `editable`.
- `type` **MUST** be one of: `float`, `int`, `enum`, `bool`, `string`.
- `editable` **MUST** be a boolean literal: `true` or `false`.
- `label` **MUST** be a quoted non-empty string.
- `default` is **required** for every parameter.
- `unit` is **required** when `type` is `float` or `int` (may be `null` if unitless).
- `min` and `max` are **optional**; when present and `type` is `float` or `int`, both **MUST** be numbers and `min` **MUST** be less than or equal to `max`.
- `options` is **required** when `type` is `enum`; **MUST** be a non-empty list.
- `applies_to` is **optional**; when present, **MUST** be a list of component id strings.

### §14.4 — ELECTRICAL PORTS

- Declared with: `ports[n|]{id|direction|type|voltage_max|current_max|notes}:`
- `n` **MUST** be a non-negative integer (0 is valid for purely fluid/logical components).
- When `n` is 0, the port header **MUST** be `ports[0|]{}:` with no rows.
- `id` **MUST** match `^[A-Z][A-Z0-9_]*$` (uppercase letters, digits, underscores).
  - Examples: `VCC`, `GND`, `NO_in`, `IN_A`, `SOL_A`
- `direction` **MUST** be one of: `input`, `output`, `passive`, `bidirectional`, `exhaust`.
- `type` **MUST** be one of:
  - Electrical: `power`, `ground`, `digital`, `analog`, `pwm`, `uart`, `spi`, `i2c`, `can`, `bus`
  - Fluid: `pneumatic`, `hydraulic`
  - Logical: `bool`, `int`, `float`, `word`, `dword`
  - Protocol: `serial`, `wireless`, `network`
- `voltage_max` **MUST** be `null` or a quoted voltage string (e.g., `"48V"`, `"5V"`).
- `current_max` **MUST** be `null` or a quoted current string (e.g., `"200mA"`, `"2A"`).
- `notes` **MUST** be a quoted non-empty string.
- Port `id` values **MUST** be unique within the `ports` array.
- The declared count `[n]` **MUST** match the number of port rows.

### §14.4b — FLUID PORTS (pneumatics and hydraulics families only)

- `pneumatic_ports` is **required** when `family` is `pneumatics`.
- `hydraulic_ports` is **required** when `family` is `hydraulics`.
- Declared with: `pneumatic_ports[n|]{id|direction|type|pressure_max|flow_nominal|notes}:`
  or: `hydraulic_ports[n|]{id|direction|type|pressure_max|flow_max|notes}:`
- `id` **MUST** match `^[A-Z][A-Z0-9_]*$`.
- `direction` **MUST** be one of: `input`, `output`, `bidirectional`, `exhaust`.
- `type` **MUST** be `pneumatic` (for `pneumatic_ports`) or `hydraulic` (for `hydraulic_ports`).
- `pressure_max` **MUST** be `null` or a quoted bar string (e.g., `"10bar"`).
- `flow_nominal` / `flow_max` **MUST** be `null` or a quoted flow reference (e.g., `"{flow_rate}"`).
- Port `id` values **MUST** be unique within each fluid ports array.
- The declared count `[n]` **MUST** match the number of rows.

### §14.4c — PROTOCOL PORTS (communication family only)

- `protocol_ports` is **required** when `family` is `communication`.
- Declared with: `protocol_ports[n|]{id|direction|protocol|notes}:`
- `id` **MUST** match `^[A-Z][A-Z0-9_]*$`.
- `direction` **MUST** be one of: `input`, `output`, `bidirectional`.
- `protocol` **MUST** be a non-empty string (quoted if contains spaces or special characters).
- `notes` **MUST** be a quoted non-empty string.
- Port `id` values **MUST** be unique within `protocol_ports`.
- The declared count `[n]` **MUST** match the number of rows.

### §14.5 — SIMULATION BEHAVIOR

- `simulation` **MUST** be a nested block.
- Required keys: `model`, `bidirectional`, `dynamic`, `thermal_model`, `noise_model`, `states`.
- `model` **MUST** be one of:
  `ohms-law`, `ideal`, `capacitor`, `inductor`, `transformer`,
  `threshold`, `analog-transfer`, `lookup-table`, `script`,
  `contact-block`, `relay-coil`, `latching-contact`,
  `pid-controller`, `timer-block`, `counter-block`, `function-block-engine`,
  `pneumatic-linear-actuator`, `pneumatic-rotary-actuator`, `pneumatic-valve`,
  `hydraulic-linear-actuator`, `hydraulic-rotary-actuator`, `hydraulic-valve`,
  `hydraulic-pump`, `fluid-pressure-source`,
  `digital-io`, `pwm-output`, `adc-input`, `uart-bridge`,
  `spice`, `basic-analog`, `basic-digital`
- `bidirectional` **MUST** be `true` or `false`.
- `dynamic` **MUST** be `true` or `false`.
- `thermal_model` **MUST** be `true` or `false`.
- `noise_model` **MUST** be `true` or `false`.
- `states` **MUST** be a list array `states[n]:` with at least 1 state entry.
- Each state entry **MUST** be a non-empty unquoted lowercase string (e.g., `nominal`, `off`, `fault`).
- The declared count `[n]` in `states[n]` **MUST** match the number of state entries.
- `equation` is **optional**; when present **MUST** be a quoted string.
- `waveform` is **optional** (sources only); when present **MUST** be one of:
  `DC`, `sine`, `square`, `triangle`, `noise`, `pwm`.
- `motion` is **optional** (actuators/fluid); when present **MUST** be one of:
  `linear`, `rotary`, `none`.

### §14.6 — LIMITS & WARNINGS

- `limits` **MUST** be a nested block.
- Required keys: `max_voltage`, `max_current`, `max_power`, `max_temp`, `min_temp`.
- `max_voltage` **MUST** be `null` or a quoted voltage string using `V` suffix.
- `max_current` **MUST** be `null` or a quoted current string using `A` or `mA` suffix.
- `max_power` **MUST** be `null` or a nested block with `value` and `unit` keys,
  or a quoted string (for reference values like `"{power_rating}"`).
- `max_temp` **MUST** be `null` or a number (integer or float, in °C).
- `min_temp` **MUST** be `null` or a number (integer or float, in °C).
- `min_temp` **MUST** be less than `max_temp` when both are non-null.
- `ip_rating` is **optional**; when present, **MUST** satisfy §5.6.
- `safety_category` is **optional**; when present, **MUST** satisfy §5.7.
- `max_pressure` (fluid components) **MUST** be `null` or a number in bar.
- `min_pressure` (fluid components) **MUST** be `null` or a positive number in bar.
- `max_force` (fluid actuators) is **optional**; when present, values **MUST** use `calc:` prefix (§5.4).
- `warnings` **MUST** be declared as `warnings[n]:` with at least 1 entry.
- Each warning entry **MUST** be a quoted non-empty string.
- The declared count `[n]` **MUST** match the number of warning entries.

### §14.7 — CONNECTIONS & COMPATIBILITY

- `connections` **MUST** be a nested block.
- Required keys: `allowed_with`, `forbidden_with`, `requires`, `typical_context`.
- `allowed_with` **MUST** be a non-empty list. The wildcard `"*"` is valid.
- `forbidden_with` **MUST** be a list (may be empty `[]`).
- `requires` **MUST** be a list (may be empty `[]`).
- `typical_context` **MUST** be a non-empty list of quoted strings.
- Cross-family exclusion rules (enforced as warnings in lenient mode, errors in strict mode):
  - Components with `family: pneumatics` **MUST** include `"hyd-*"` in `forbidden_with`.
  - Components with `family: hydraulics` **MUST** include `"pneu-*"` in `forbidden_with`.

### §14.8 — VISUAL & CANVAS

- `canvas` **MUST** be a nested block.
- Required keys: `width`, `height`, `ports_layout`, `label_position`, `value_display`, `animated`.
- `width` **MUST** be a positive integer.
- `height` **MUST** be a positive integer.
- `ports_layout` **MUST** be one of: `horizontal`, `vertical`, `radial`, `custom`.
- `label_position` **MUST** be one of: `top`, `bottom`, `left`, `right`, `inline`.
- `value_display` **MUST** be a quoted non-empty string.
- `animated` **MUST** be `true` or `false`.
- Port coordinate keys follow the pattern `port_<ID>` where `<ID>` matches the port `id`
  declared in the corresponding ports array.
  - Each coordinate block **MUST** contain `x` (non-negative integer) and `y` (non-negative integer).
- `sensor_slot_S<n>` coordinate keys are allowed only when `family` is `pneumatics` or `hydraulics`
  and a `sensor_slots` section is present.
- `display_panel` is **optional** (virtual-instruments only); when present **MUST** be `true` or `false`.

### §14.8b — SENSOR SLOTS (pneumatics and hydraulics actuators with position)

- `sensor_slots` is **optional** at the file level; it is recommended for actuator components.
- Declared with: `sensor_slots[n|]{id|position|compatible_sensors}:`
- `id` **MUST** match `^S\d+$` (e.g., `S1`, `S2`).
- `position` **MUST** be one of: `retracted-end`, `extended-end`, `mid-stroke`, `custom`.
- `compatible_sensors` **MUST** be a quoted string containing a JSON-style list of sensor id strings.
- Slot `id` values **MUST** be unique within `sensor_slots`.
- The declared count `[n]` **MUST** match the number of rows.

### §14.8c — MEASUREMENT TARGETS (virtual-instruments family only)

- `measurement_targets` is **required** when `family` is `virtual-instruments`.
- Declared with: `measurement_targets[n|]{target|unit|description}:`
- `target` **MUST** be one of: `voltage`, `current`, `resistance`, `frequency`, `power`,
  `temperature`, `pressure`, `flow`, `position`, `speed`, `protocol-frame`.
- `unit` **MUST** be a non-empty string.
- `description` **MUST** be a quoted non-empty string.
- The declared count `[n]` **MUST** match the number of rows.

### §14.9 — AGENT SKILLS

- `dendriForge` **MUST** be a nested block.
- Required keys: `componentFamilySkillId`, `componentProfileId`, `simulationEngine`, `paletteGroup`, `tags`.
- `componentFamilySkillId` **MUST** match the pattern `^[a-z][a-z0-9-]*-family$`.
  - Valid examples: `electricals-family`, `sensors-family`, `pneumatics-family`
  - The prefix before `-family` **MUST** correspond to the declared `family` value.
- `componentProfileId` **MUST** be identical to the `id` field in IDENTIFICATION.
  - Pattern: `^[a-z][a-z0-9-]*$` (kebab-case).
- `simulationEngine` **MUST** be one of:
  `basic-analog`, `basic-digital`, `digital-io`,
  `pneumatic-motion`, `hydraulic-motion`,
  `protocol-stub-engine`, `function-block-engine`, `measurement-engine`
- `paletteGroup` **MUST** be a quoted non-empty string.
- `tags` **MUST** be a non-empty list array `tags[n]:` with at least 1 tag entry.
  - Each tag **MUST** be an unquoted lowercase alphanumeric-hyphen string matching
    `^[a-z][a-z0-9-]*$`.
  - The declared count `[n]` **MUST** match the number of tag entries.
- Forbidden keys (inherited from board dialects, not applicable here): `boardFamilySkillId`,
  `boardProfileId`, `arduinoCore`, `pio`, `bootloader`, `defaultLanguageSkills`.

### §14.10 — Section Order and Mandatory Sections

A conformant component profile document **MUST** contain the following sections in this order:

| Index | Section Name                  | Required for                           |
|-------|-------------------------------|----------------------------------------|
| `## 1.` | `IDENTIFICATION`            | All                                    |
| `## 2.` | `PARAMETERS`                | All                                    |
| `## 3.` | `ELECTRICAL PORTS`          | All                                    |
| `## 4b.` | `FLUID PORTS`              | `pneumatics`, `hydraulics` only        |
| `## 4c.` | `PROTOCOL PORTS`           | `communication` only                   |
| `## 4.` | `SIMULATION BEHAVIOR`       | All                                    |
| `## 5.` | `LIMITS & WARNINGS`         | All                                    |
| `## 6.` | `CONNECTIONS & COMPATIBILITY` | All                                  |
| `## 7.` | `VISUAL & CANVAS`           | All                                    |
| `## 7b.` | `SENSOR SLOTS`             | `pneumatics`, `hydraulics` (actuators) |
| `## 7c.` | `MEASUREMENT TARGETS`      | `virtual-instruments` only             |
| `## 8.` | `AGENT SKILLS`              | All                                    |

- Sections `4b`, `4c`, `7b`, `7c` use letter-suffixed indices. The parser **MUST** accept
  section headings of the form `## <digit><letter>. <NAME>:` for these cases.
- The numeric part of the section index must be monotonically non-decreasing.
- The letter suffix (`b`, `c`) is an extension sub-index and does not increment the main counter.
- Additional sections **MAY** be appended at `## 9.` and beyond.

### §14.11 — Cross-Family Consistency Rules

- When `family` is `pneumatics` or `hydraulics`, the `simulation.model` **MUST** be one of the
  fluid simulation models:
  `pneumatic-linear-actuator`, `pneumatic-rotary-actuator`, `pneumatic-valve`,
  `hydraulic-linear-actuator`, `hydraulic-rotary-actuator`, `hydraulic-valve`,
  `hydraulic-pump`, `fluid-pressure-source`.
- When `family` is `industrial`, the `simulation.model` **MUST** be one of:
  `pid-controller`, `timer-block`, `counter-block`, `function-block-engine`,
  `relay-coil`, `contact-block`, `digital-io`.
- When `family` is `communication`, the `simulation.model` **MUST** be one of:
  `digital-io`, `uart-bridge`, `script`.
- When `family` is `virtual-instruments`, the `simulation.model` **MUST** be `script`.
- When `family` is `electricals` and `subfamily` is `passives`, the `simulation.model`
  **MUST** be one of: `ohms-law`, `capacitor`, `inductor`, `transformer`, `ideal`, `basic-analog`.
- The `simulationEngine` in `dendriForge` **MUST** be consistent with `family`:
  - `electricals` → `basic-analog`
  - `sensors`, `command-elements`, `actuators`, `panel-infrastructure` → `digital-io`
  - `pneumatics` → `pneumatic-motion`
  - `hydraulics` → `hydraulic-motion`
  - `communication` → `protocol-stub-engine`
  - `industrial` → `function-block-engine`
  - `virtual-instruments` → `measurement-engine`

---

## Standard Section Order (Component Profiles)

A conformant component profile document **MUST** contain sections in this order
(letter-suffixed sections are inserted between their base-indexed neighbours):

```
## 1.  IDENTIFICATION
## 2.  PARAMETERS
## 3.  ELECTRICAL PORTS
## 4b. FLUID PORTS              ← pneumatics / hydraulics only
## 4c. PROTOCOL PORTS           ← communication only
## 4.  SIMULATION BEHAVIOR
## 5.  LIMITS & WARNINGS
## 6.  CONNECTIONS & COMPATIBILITY
## 7.  VISUAL & CANVAS
## 7b. SENSOR SLOTS             ← pneumatics / hydraulics actuators only
## 7c. MEASUREMENT TARGETS      ← virtual-instruments only
## 8.  AGENT SKILLS
```

---

## Reference: Canonical Component Profile Skeleton (Resistor)

```toon
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
    min: 0.01
    max: 10000000
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

## 3. ELECTRICAL PORTS:
ports[2|]{id|direction|type|voltage_max|current_max|notes}:
  A|passive|analog|null|null|"terminal A"
  B|passive|analog|null|null|"terminal B"

## 4. SIMULATION BEHAVIOR:
simulation:
  model: ohms-law
  equation: "V = I * R"
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
  - "Do not exceed rated power dissipation"
  - "Derate 50% above 70°C ambient"

## 6. CONNECTIONS & COMPATIBILITY:
connections:
  allowed_with: ["*"]
  forbidden_with: []
  requires: []
  typical_context: ["current-limiting", "voltage-divider"]

## 7. VISUAL & CANVAS:
canvas:
  width: 60
  height: 20
  ports_layout: horizontal
  port_A: {x: 0, y: 10}
  port_B: {x: 60, y: 10}
  label_position: top
  value_display: "{resistance}Ω"
  animated: false

## 8. AGENT SKILLS:
dendriForge:
  componentFamilySkillId: electricals-family
  componentProfileId: resistor
  simulationEngine: basic-analog
  paletteGroup: "Elétricos Fundamentais > Passivos"
  tags[3]:
    - resistor
    - passive
    - analog
```
