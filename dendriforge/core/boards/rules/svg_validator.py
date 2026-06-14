#!/usr/bin/env python3
"""
svg_validator.py — Cross-validator for board SVG vector graphics and TOON profiles
Spec: svg-toon-alignment v1.0 (2026-05-30)

Usage:
    python svg_validator.py myboard.toon myboard.svg
"""

import sys
import os

# Reconfigure stdout/stderr to UTF-8 to support emojis on all platforms
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional, Union, List, Dict, Tuple

@dataclass
class ValidationError:
    rule: str
    message: str
    element_id: Optional[str] = None
    svg_attr: Optional[str] = None
    expected: Optional[str] = None
    actual: Optional[str] = None

    def __str__(self) -> str:
        parts = [f"[{self.rule}]"]
        if self.element_id:
            parts.append(f"Element '{self.element_id}':")
        parts.append(self.message)
        if self.expected is not None or self.actual is not None:
            parts.append(f"(Expected: {self.expected!r}, Actual: {self.actual!r})")
        return " ".join(parts)

@dataclass
class ValidationResult:
    valid: bool
    errors: List[ValidationError]
    warnings: List[ValidationError]

# ─── Parsing Helpers ──────────────────────────────────────────────────────────

def _unquote(s: str) -> str:
    s = s.strip()
    if s.startswith('"') and s.endswith('"') and len(s) >= 2:
        return s[1:-1]
    return s

def _split_tabular_row(row: str) -> List[str]:
    fields = []
    buf = ""
    in_q = False
    for ch in row:
        if ch == '"':
            in_q = not in_q
            buf += ch
        elif not in_q and ch == '|':
            fields.append(buf.strip())
            buf = ""
        else:
            buf += ch
    fields.append(buf.strip())
    return fields

def parse_toon_dims(content: str) -> Dict[str, float]:
    dims = {}
    in_dims = False
    for line in content.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith('#'):
            continue
        if trimmed == 'dims:':
            in_dims = True
            continue
        if in_dims:
            # Check indentation to confirm we are inside dims block
            leading_spaces = len(line) - len(line.lstrip(' '))
            if leading_spaces == 0:
                in_dims = False
                continue
            if ':' in trimmed:
                k, v = trimmed.split(':', 1)
                k = k.strip()
                v = v.strip()
                if k in ('w', 'h', 't'):
                    try:
                        dims[k] = float(v)
                    except ValueError:
                        pass
    return dims

def parse_toon_table(content: str, table_name: str) -> Tuple[List[str], List[Dict[str, str]]]:
    headers = []
    rows = []
    in_table = False
    table_header_indent = 0

    for line in content.splitlines():
        trimmed = line.strip()
        if not trimmed:
            if in_table:
                # Blank line ends the table
                in_table = False
            continue
        if trimmed.startswith('#') and not trimmed.startswith('##'):
            continue
        
        leading_spaces = len(line) - len(line.lstrip(' '))

        if not in_table:
            # Look for table header declaration: name[count|]{headers}:
            if f'{table_name}[' in trimmed and ':{' in trimmed or ']:' in trimmed or '}' in trimmed:
                m = re.match(rf'^{table_name}\[\d+\|\]\{{([^}}]+)\}}:', trimmed)
                if m:
                    headers = [h.strip() for h in m.group(1).split('|')]
                    in_table = True
                    table_header_indent = leading_spaces
        else:
            if leading_spaces <= table_header_indent and not trimmed.startswith('- '):
                # Indentation went back to header level, table ended
                in_table = False
                continue
            
            # Split fields
            fields = _split_tabular_row(trimmed)
            if len(fields) >= len(headers):
                row_dict = {}
                for h, val in zip(headers, fields):
                    row_dict[h] = _unquote(val)
                rows.append(row_dict)
                
    return headers, rows

# ─── XML Helper ───────────────────────────────────────────────────────────────

def parse_svg_elements(svg_path: str) -> Tuple[Optional[ET.Element], List[Tuple[ET.Element, str, Dict[str, str]]]]:
    try:
        tree = ET.parse(svg_path)
    except Exception as e:
        print(f"Error parsing SVG XML: {e}", file=sys.stderr)
        return None, []
        
    root = tree.getroot()
    
    # Strip namespaces
    for el in root.iter():
        if el.tag.startswith('{'):
            el.tag = el.tag.split('}', 1)[1]
            
    board_body = None
    data_elements = []
    
    for el in root.iter():
        eid = el.attrib.get('id', '')
        if eid == 'board-body':
            board_body = el
            
        data_attrs = {k: v for k, v in el.attrib.items() if k.startswith('data-')}
        if data_attrs or eid == 'board-body':
            data_elements.append((el, el.tag, data_attrs))
            
    # If no board-body ID found, look for first element with both data-w and data-h
    if board_body is None:
        for el, tag, attrs in data_elements:
            if 'data-w' in attrs and 'data-h' in attrs:
                board_body = el
                break
                
    return board_body, data_elements

# ─── Verification Logic ───────────────────────────────────────────────────────

def is_auxiliary_element(tag: str, eid: str) -> bool:
    if not eid:
        return False
    eid_lower = eid.lower()
    # Match P1-P8 for ethernet, CM_P1, SM_P1, icsp, led, etc.
    if re.match(r'^p\d+$', eid_lower):
        return True
    if eid_lower.startswith('cm_') or eid_lower.startswith('sm_'):
        return True
    if eid_lower.startswith('icsp') or eid_lower.startswith('led'):
        return True
    return False

def validate_svg_against_toon(toon_content: str, svg_path: str) -> ValidationResult:
    errors = []
    warnings = []

    def add_error(rule: str, msg: str, eid: Optional[str] = None, attr: Optional[str] = None, exp: Optional[str] = None, act: Optional[str] = None):
        errors.append(ValidationError(rule, msg, eid, attr, exp, act))

    def add_warning(rule: str, msg: str, eid: Optional[str] = None, attr: Optional[str] = None, exp: Optional[str] = None, act: Optional[str] = None):
        warnings.append(ValidationError(rule, msg, eid, attr, exp, act))

    # 1. Parse TOON data
    dims = parse_toon_dims(toon_content)
    _, power_pins = parse_toon_table(toon_content, 'powerPins')
    _, gpios = parse_toon_table(toon_content, 'gpio')

    # 2. Parse SVG data
    board_body, data_elements = parse_svg_elements(svg_path)

    # 3. Validate Dimensions
    if not dims:
        add_error("TOON_DIMS", "No board dimensions (dims.w, dims.h) defined in TOON profile.")
    
    if board_body is None:
        add_error("SVG_DIMS", "No board body element (id='board-body' or element with data-w/data-h) found in SVG.")
    else:
        svg_w = board_body.attrib.get('data-w')
        svg_h = board_body.attrib.get('data-h')
        
        if not svg_w or not svg_h:
            add_error("SVG_DIMS", f"Board body '{board_body.attrib.get('id', 'unknown')}' is missing data-w or data-h attributes.")
        else:
            try:
                w_val = float(svg_w)
                h_val = float(svg_h)
                
                if dims:
                    if abs(w_val - dims.get('w', 0.0)) > 0.01:
                        add_error("DIM_MISMATCH", "Board width mismatch.", board_body.attrib.get('id'), "data-w", str(dims.get('w')), svg_w)
                    if abs(h_val - dims.get('h', 0.0)) > 0.01:
                        add_error("DIM_MISMATCH", "Board height mismatch.", board_body.attrib.get('id'), "data-h", str(dims.get('h')), svg_h)
            except ValueError:
                add_error("SVG_DIMS_INVALID", "Board dimensions data-w or data-h in SVG are not valid numbers.", board_body.attrib.get('id'))

    # 4. Extract all visual pins from SVG
    svg_pins_by_data_pin = {}
    svg_pins_by_id = {}
    
    for el, tag, attrs in data_elements:
        eid = el.attrib.get('id', '')
        # Pins must be shape elements (circle, ellipse, rect, path) with data-pin attribute
        if tag in ('circle', 'ellipse', 'rect', 'path', 'g') and 'data-pin' in attrs:
            data_pin = attrs['data-pin']
            if data_pin not in svg_pins_by_data_pin:
                svg_pins_by_data_pin[data_pin] = []
            svg_pins_by_data_pin[data_pin].append((el, attrs))
            if eid:
                svg_pins_by_id[eid] = (el, attrs)

    # 5. Validate GPIO pins matching
    for gpio in gpios:
        pin_num = gpio['pin']
        label = gpio.get('label', '')
        roles = gpio.get('roles', '')
        gpio_type = gpio.get('type', '')
        pwm_val = gpio.get('pwm', '').lower()
        int_val = gpio.get('int', '').lower()

        # Find matching SVG elements
        matched_el_list = svg_pins_by_data_pin.get(pin_num, [])
        
        # Filter out auxiliary elements (such as RJ45 pins P1-P8, DB9 pins CM_P1, etc.)
        main_el_list = [
            (el, attrs) for el, attrs in matched_el_list 
            if not is_auxiliary_element(el.tag, el.attrib.get('id', ''))
        ]
        
        if not main_el_list:
            add_error("PIN_MISSING", f"GPIO Pin {pin_num} ({label}) defined in TOON is missing a corresponding visual element in SVG.")
            continue

        # Validate each corresponding SVG element
        for el, attrs in main_el_list:
            eid = el.attrib.get('id', f"pin-{pin_num}")
            
            # Type verification
            svg_type = attrs.get('data-type')
            if gpio_type == 'digital' and svg_type != 'digital':
                add_error("TYPE_MISMATCH", f"GPIO Pin type mismatch for pin {pin_num}.", eid, "data-type", gpio_type, svg_type)
            elif gpio_type == 'analog' and svg_type not in ('analog', 'digital'):
                add_error("TYPE_MISMATCH", f"GPIO Pin type mismatch for pin {pin_num}.", eid, "data-type", gpio_type, svg_type)

            # PWM verification
            is_pwm_toon = pwm_val in ('true', 't')
            svg_pwm = attrs.get('data-pwm', 'false').lower() == 'true'
            if svg_pwm and not is_pwm_toon:
                add_error("PWM_NOT_SUPPORTED", f"GPIO Pin {pin_num} has data-pwm='true' in SVG but is not PWM-capable in TOON.", eid)
            elif is_pwm_toon and not svg_pwm:
                add_warning("PWM_NOT_EXPOSED", f"GPIO Pin {pin_num} is PWM-capable in TOON but data-pwm is not set to true in SVG.", eid)

            # Interrupt verification
            is_int_toon = int_val in ('true', 't') or 'interrupt' in roles.lower()
            svg_int = attrs.get('data-interrupt', 'false').lower() == 'true'
            if svg_int and not is_int_toon:
                add_error("INT_NOT_SUPPORTED", f"GPIO Pin {pin_num} has data-interrupt='true' in SVG but is not interrupt-capable in TOON.", eid)
            elif is_int_toon and not svg_int:
                add_warning("INT_NOT_EXPOSED", f"GPIO Pin {pin_num} is interrupt-capable in TOON but data-interrupt is not set to true in SVG.", eid)

            # ADC verification
            is_adc_toon = 'adc' in roles.lower() or gpio_type == 'analog'
            svg_adc = attrs.get('data-adc', 'false').lower() == 'true'
            if svg_adc and not is_adc_toon:
                add_error("ADC_NOT_SUPPORTED", f"GPIO Pin {pin_num} has data-adc='true' in SVG but is not ADC-capable in TOON.", eid)
            elif is_adc_toon and not svg_adc:
                add_warning("ADC_NOT_EXPOSED", f"GPIO Pin {pin_num} is ADC-capable in TOON but data-adc is not set to true in SVG.", eid)

            # Direction verification
            svg_dir = attrs.get('data-direction')
            expected_dir = None
            if 'input-only' in roles.lower() or roles.lower() == 'di':
                expected_dir = 'input'
            elif roles.lower() == 'do':
                expected_dir = 'output'
            elif 'uart-tx' in roles.lower():
                expected_dir = 'output'
            elif 'uart-rx' in roles.lower():
                expected_dir = 'input'
            
            if expected_dir and svg_dir != expected_dir:
                add_warning("DIR_MISMATCH", f"GPIO Pin direction mismatch for pin {pin_num}.", eid, "data-direction", expected_dir, svg_dir)

    # 6. Validate Power Pins matching
    for power_pin in power_pins:
        name = power_pin['name']
        direction = power_pin.get('direction', 'null')
        voltage = power_pin.get('voltage', 'null')
        pin_type = power_pin.get('type', 'null')

        # To find matching power pin: match SVG element with id == name, OR data-pin == name
        matched_pin = None
        if name in svg_pins_by_id:
            matched_pin = svg_pins_by_id[name]
        elif name in svg_pins_by_data_pin:
            matched_pin = svg_pins_by_data_pin[name][0]

        # We allow power pins to be virtual/connector-only (meaning not in SVG) if they are null/empty type, but warn if functional
        if matched_pin is None:
            if pin_type != 'null' and pin_type != '' and name in ('VIN', '3V3', '5V', 'GND', 'RESET'):
                add_error("POWER_PIN_MISSING", f"Power Pin '{name}' defined in TOON is missing in SVG.")
            else:
                add_warning("POWER_PIN_VIRTUAL", f"Power Pin '{name}' is virtual (defined in TOON but no shape in SVG).")
            continue

        el, attrs = matched_pin
        eid = el.attrib.get('id', name)

        # Type verification
        svg_type = attrs.get('data-type')
        if pin_type != 'null' and pin_type != '':
            expected_type = 'ground' if pin_type == 'ground' else 'power'
            if name == 'PE' and svg_type == 'earth':
                expected_type = 'earth'
                
            if svg_type != expected_type:
                # Allow ground to map to earth
                if expected_type == 'ground' and svg_type in ('ground', 'earth'):
                    pass
                else:
                    add_error("POWER_TYPE_MISMATCH", f"Power Pin type mismatch for '{name}'.", eid, "data-type", expected_type, svg_type)

        # Direction verification
        svg_dir = attrs.get('data-direction')
        if direction != 'null' and svg_dir != direction:
            add_warning("POWER_DIR_MISMATCH", f"Power Pin direction mismatch for '{name}'.", eid, "data-direction", direction, svg_dir)

        # Voltage verification
        svg_volt = attrs.get('data-voltage')
        if voltage != 'null' and svg_volt:
            # Strip V from voltage strings for comparison if needed, or normalize
            norm_toon_v = voltage.replace('V', '').replace('v', '').strip()
            norm_svg_v = svg_volt.replace('V', '').replace('v', '').strip()
            
            # Allow ranges (like 7V-12V in SVG vs null in TOON, or vice versa)
            if norm_toon_v != norm_svg_v and '-' not in norm_svg_v:
                add_warning("POWER_VOLT_MISMATCH", f"Power Pin voltage mismatch for '{name}'.", eid, "data-voltage", voltage, svg_volt)

    # 7. Check for extra/auxiliary data pins in SVG that are not defined in TOON
    gpio_nums = {g['pin'] for g in gpios}
    power_names = {p['name'] for p in power_pins}
    
    # Standard functional mappings for generic power pins
    generic_power_names = {'VIN', 'GND', 'VOUT', 'PE', '3V3', '5V', 'NC'}

    for data_pin, el_list in svg_pins_by_data_pin.items():
        if data_pin == 'NC':
            continue
        if data_pin not in gpio_nums and data_pin not in power_names and data_pin not in generic_power_names:
            # Check if any matching ID exists
            has_id_match = False
            for el, attrs in el_list:
                eid = el.attrib.get('id', '')
                if eid in power_names:
                    has_id_match = True
            
            if not has_id_match:
                # This pin has no correlation to TOON profile
                # Check if it is a secondary RJ45, DB9 or sub-module pin which is allowed as auxiliary
                is_auxiliary = any(
                    is_auxiliary_element(el.tag, el.attrib.get('id', ''))
                    for el, _ in el_list
                )
                if is_auxiliary:
                    add_warning("AUXILIARY_PIN", f"SVG defines auxiliary pin '{data_pin}' (ID: {el_list[0][0].attrib.get('id')}) not mapped in TOON.")
                else:
                    add_error("UNDEFINED_PIN", f"SVG defines pin '{data_pin}' (ID: {el_list[0][0].attrib.get('id')}) which is not declared in TOON profile.")

    # 8. Check linked status LEDs in SVG
    for el, tag, attrs in data_elements:
        if 'data-linked-pin' in attrs:
            linked_pin = attrs['data-linked-pin']
            if linked_pin not in gpio_nums:
                add_error("INVALID_LINKED_PIN", f"Status LED links to undefined pin '{linked_pin}'.", el.attrib.get('id'))

    valid = len(errors) == 0
    return ValidationResult(valid=valid, errors=errors, warnings=warnings)

# ─── CLI entry point ──────────────────────────────────────────────────────────

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Cross-validate a .toon board profile and its corresponding .svg vector graphic."
    )
    parser.add_argument("toon_file", help="Path to the .toon file")
    parser.add_argument("svg_file", help="Path to the .svg file")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    args = parser.parse_args()

    # Read TOON
    try:
        with open(args.toon_file, encoding="utf-8") as f:
            toon_content = f.read()
    except Exception as e:
        print(f"Error: failed to read TOON file {args.toon_file}: {e}", file=sys.stderr)
        sys.exit(2)

    # Validate
    result = validate_svg_against_toon(toon_content, args.svg_file)

    if args.json:
        import json
        print(json.dumps({
            "valid": result.valid,
            "error_count": len(result.errors),
            "warning_count": len(result.warnings),
            "errors": [
                {
                    "rule": e.rule,
                    "message": e.message,
                    "element_id": e.element_id,
                    "svg_attr": e.svg_attr,
                    "expected": e.expected,
                    "actual": e.actual
                }
                for e in result.errors
            ],
            "warnings": [
                {
                    "rule": e.rule,
                    "message": e.message,
                    "element_id": e.element_id,
                    "svg_attr": e.svg_attr,
                    "expected": e.expected,
                    "actual": e.actual
                }
                for e in result.warnings
            ]
        }, indent=2))
    else:
        if result.valid:
            print("✅ SVG and TOON profile match perfectly!")
        else:
            print(f"❌ Alignment errors found: {len(result.errors)} error(s)")
            for e in result.errors:
                print(f"  {e}")
                
        if result.warnings:
            print(f"\n⚠️ Warnings: {len(result.warnings)}")
            for w in result.warnings:
                print(f"  {w}")

    sys.exit(0 if result.valid else 1)

if __name__ == "__main__":
    _cli()
