# SVG Board Validator (svg_validator.py)

`svg_validator.py` is a validation tool to verify the structural, physical, and electrical alignment between a board profile defined in `.toon` format and its vector graphics representation in `.svg` format.

## Execution

Validate a `.toon` / `.svg` pair:
```bash
python svg_validator.py myboard.toon myboard.svg
```

Output results in JSON format:
```bash
python svg_validator.py myboard.toon myboard.svg --json
```

## Validation Rules

The validator parses the `.toon` file (extracting `dims`, `gpio`, and `powerPins` tables) and parses the `.svg` file (extracting custom HTML5 `data-*` attributes from circles, ellipses, paths, or groups representing physical pins and headers).

### 1. Board Dimensions (`DIM_MISMATCH`)
- The dimensions declared in `.toon` (`dims.w` and `dims.h` in millimeters) must match the attributes `data-w` and `data-h` on the SVG board body element.
- The board body element is identified by having `id="board-body"`. If not found, the validator defaults to the first SVG element having both `data-w` and `data-h` attributes (such as background board rectangles/paths).

### 2. GPIO Alignment
For each GPIO pin declared in `.toon`:
- **Presence (`PIN_MISSING`)**: There must be an element (circle/ellipse/rect/path/g) in the SVG with `data-pin` matching the GPIO pin number.
- **Type (`TYPE_MISMATCH`)**: The SVG attribute `data-type` must match the TOON pin type (`digital` or `analog`).
- **PWM capability (`PWM_MISMATCH`)**: If `pwm` is true or `t` in TOON, `data-pwm="true"` must be set on the SVG element.
- **Interrupt capability (`INT_MISMATCH`)**: If `int` is true or roles contains `interrupt` in TOON, `data-interrupt="true"` must be set on the SVG element.
- **ADC capability (`ADC_MISMATCH`)**: If roles contains `adc` in TOON, `data-adc="true"` must be set on the SVG element.
- **Direction (`DIR_MISMATCH`)**: If the pin is input-only or output-only, a warning is raised if the SVG's `data-direction` attribute does not match the direction.

### 3. Power Pins Alignment
For each Power Pin declared in `.toon`:
- **Presence (`POWER_PIN_MISSING`)**: An SVG element with `id` or `data-pin` matching the name must exist. If the pin is optional or virtual (like `VUSB`), a warning is raised instead of an error (`POWER_PIN_VIRTUAL`).
- **Type (`POWER_TYPE_MISMATCH`)**: The SVG attribute `data-type` must match the TOON pin type (`ground` vs `power` / `earth`).
- **Voltage (`POWER_VOLT_MISMATCH`)**: Normalized voltage strings (e.g. `5V`, `3.3V`) must align.

### 4. Auxiliary and Undefined Pins
- If the SVG contains a `data-pin` attribute pointing to a pin number or terminal that is not defined in the TOON file, the validator raises `UNDEFINED_PIN` (error).
- If the pin ID contains keywords representing auxiliary connector fields (like `icsp`, `_p`, `led`, `eth`), the validator raises a warning `AUXILIARY_PIN` instead.

### 5. Status LEDs (`INVALID_LINKED_PIN`)
- Visual LEDs containing `data-linked-pin="<pin>"` must point to a valid GPIO pin defined in the TOON file.
