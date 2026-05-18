#!/usr/bin/env python3
"""
toon_parser.py — TOON Format Validator
Spec: toon-format/spec v3.0 (2025-11-24)
Dialects: toon-dialect-core §1–§13 §15 | asl-mcu-profile §5 §14 | asl-plc-profile §5 §14

Usage:
    from toon_parser import parse_and_validate, extract_board_profile_id
    result = parse_and_validate(content, domain="MCU")  # or "PLC"

    # CLI:
    python toon_parser.py myboard.toon --domain MCU
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from typing import Literal, Optional


# ─── Data types ──────────────────────────────────────────────────────────────

@dataclass
class ValidationError:
    line: int
    rule: str
    snippet: str

    def __str__(self) -> str:
        return f"[Line {self.line}] {self.rule}\n  → {self.snippet!r}"


@dataclass
class ValidationStats:
    section_count: int = 0
    pin_count: int = 0
    peripheral_count: int = 0
    warning_count: int = 0


@dataclass
class ValidationResult:
    valid: bool
    errors: list[ValidationError]
    stats: ValidationStats

    def __str__(self) -> str:
        if self.valid:
            return "✅ VALID — no errors found."
        lines = [f"❌ INVALID — {len(self.errors)} error(s) found:\n"]
        for e in self.errors:
            lines.append(str(e))
        return "\n".join(lines)


Domain = Literal["MCU", "PLC"]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _unquote(s: str) -> str:
    """Strip outer double-quotes from a value token if present."""
    if s.startswith('"') and s.endswith('"') and len(s) >= 2:
        return s[1:-1]
    return s


def _is_quoted(s: str) -> bool:
    return s.startswith('"') and s.endswith('"') and len(s) >= 2


def _split_key_value(line: str) -> Optional[tuple[str, str]]:
    """
    Split a line into (key, value) ignoring colons inside quoted strings.
    Returns None if no structural colon found.
    """
    in_quote = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quote = not in_quote
        elif not in_quote and ch == ':':
            return line[:i].rstrip(), line[i + 1:]
    return None


def _is_unquoted_hex(v: str) -> bool:
    """Return True when a raw value starts with 0x... and is not quoted."""
    return bool(re.match(r'^0x[0-9A-Fa-f]+', v)) and not _is_quoted(v)


def _validate_escapes(quoted: str) -> bool:
    """Validate escape sequences inside a double-quoted string (including the quotes)."""
    inner = quoted[1:-1]
    i = 0
    while i < len(inner):
        if inner[i] == '\\':
            if i + 1 >= len(inner) or inner[i + 1] not in '\\"nrt;':
                return False
            i += 2
        else:
            i += 1
    return True


def _validate_iec_address(addr: str) -> bool:
    """Validate IEC 61131-3 address — bit or word/dword form."""
    if re.match(r'^%[IQ]X\d+(\.\d+)*$', addr):
        return True
    if re.match(r'^%[IQM][WD]\d+$', addr):
        return True
    return False


def _split_tabular_row(row: str) -> list[str]:
    """Split a tabular row on | delimiters, respecting quoted strings."""
    fields: list[str] = []
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


def _has_spaced_pipe(row: str) -> bool:
    """Return True if a pipe in the row has surrounding spaces (outside quotes)."""
    in_q = False
    for i, ch in enumerate(row):
        if ch == '"':
            in_q = not in_q
        elif not in_q and ch == '|':
            before = row[i - 1] == ' ' if i > 0 else False
            after = row[i + 1] == ' ' if i + 1 < len(row) else False
            if before or after:
                return True
    return False


# ─── Public helpers ───────────────────────────────────────────────────────────

def extract_board_profile_id(content: str) -> Optional[str]:
    """Extract boardProfileId from AGENT SKILLS section."""
    in_skills = False
    for line in content.splitlines():
        if '##' in line and 'AGENT SKILLS' in line:
            in_skills = True
            continue
        if in_skills and line.startswith('##') and 'AGENT SKILLS' not in line:
            break
        if in_skills and 'boardProfileId:' in line:
            m = re.search(r'boardProfileId:\s*"?([^"\s]+)"?', line)
            if m:
                return m.group(1)
    return None


# ─── Main validator ───────────────────────────────────────────────────────────

def parse_and_validate(content: str, domain: Domain) -> ValidationResult:  # noqa: C901
    errors: list[ValidationError] = []
    stats = ValidationStats()

    def add_error(line_num: int, rule: str, snippet: str) -> None:
        errors.append(ValidationError(line=line_num, rule=rule, snippet=snippet[:80]))

    # Strip CRLF for uniform processing; keep raw for end-of-file check
    if content.endswith('\n'):
        add_error(len(content.splitlines()), "§15 Trailing newline forbidden at end of file", "<EOF>")

    if content.startswith('\ufeff'):
        add_error(1, "§15 UTF-8 BOM forbidden", "<BOM>")

    lines = [l.rstrip('\r') for l in content.split('\n')]

    # ── §1 Trailing whitespace ────────────────────────────────────────────────
    for i, line in enumerate(lines):
        if line.endswith(' ') or line.endswith('\t'):
            add_error(i + 1, "§1 Trailing whitespace forbidden", line[:40])

    # ── §2 Inline comments ────────────────────────────────────────────────────
    for i, line in enumerate(lines):
        trimmed = line.strip()
        if trimmed.startswith('#') or trimmed.startswith('##'):
            continue
        in_q = False
        for j, ch in enumerate(line):
            if ch == '"':
                in_q = not in_q
            elif not in_q and ch == '#' and j > 0 and line[:j].strip():
                add_error(i + 1, "§2 Inline comments forbidden (# after value)", line[:60])
                break

    # ── §12 Single quotes forbidden ───────────────────────────────────────────
    for i, line in enumerate(lines):
        trimmed = line.strip()
        if trimmed.startswith('#') and not trimmed.startswith('##'):
            continue
        in_q = False
        for ch in line:
            if ch == '"':
                in_q = not in_q
            elif not in_q and ch == "'":
                add_error(i + 1, "§12 Single quotes forbidden; use double quotes", line[:60])
                break

    # ── §13 METADATA position ─────────────────────────────────────────────────
    meta_line = next((i for i, l in enumerate(lines) if l.strip() == '# METADATA:'), -1)
    first_section = next((i for i, l in enumerate(lines) if l.strip().startswith('##')), -1)

    if meta_line == -1:
        add_error(1, "§13 METADATA block required at top of document", "# METADATA:")
    elif first_section != -1 and meta_line > first_section:
        add_error(meta_line + 1, "§13 METADATA block must appear before any ## section heading", "# METADATA:")

    # ── §13 Required metadata keys ────────────────────────────────────────────
    for key in ('project_name', 'version', 'editor', 'author', 'ASLversion'):
        if not any(l.lstrip().startswith(f'{key}:') for l in lines):
            add_error(1, f"§13 METADATA required key missing: {key}", "# METADATA:")

    # ── §13 version positive integer ─────────────────────────────────────────
    version_line = next(
        (l for l in lines if re.match(r'^\s*version:', l) and 'ASLversion' not in l), None
    )
    if version_line:
        raw = (_split_key_value(version_line) or (None, ''))[1].strip()
        try:
            v = int(raw)
            if v <= 0 or str(v) != raw:
                raise ValueError
        except ValueError:
            add_error(lines.index(version_line) + 1,
                      "§13 version must be a positive integer", version_line[:40])

    # ── §13 ASLversion semver ─────────────────────────────────────────────────
    asl_line = next((l for l in lines if l.lstrip().startswith('ASLversion:')), None)
    if asl_line:
        raw = _unquote((_split_key_value(asl_line) or (None, ''))[1].strip())
        if not re.match(r'^\d+\.\d+\.\d+$', raw):
            add_error(lines.index(asl_line) + 1,
                      "§13 ASLversion must follow semver MAJOR.MINOR.PATCH (e.g. 0.1.0)",
                      asl_line[:40])

    # ── State ─────────────────────────────────────────────────────────────────
    section_count = 0
    pin_count = 0
    warning_count = 0
    power_pin_count = 0
    io_module_count = 0
    digital_ch_count = 0
    analog_ch_count = 0
    peripheral_count = 0
    actual_default_lang_skills = 0

    declared_gpio = 0
    declared_power_pins = 0
    declared_warnings = 0
    declared_peripherals = 0
    declared_io_modules = 0
    declared_digital_ch = 0
    declared_analog_ch = 0
    declared_default_lang_skills = 0

    in_array_block = False
    array_kind = 'other'
    array_header_indent = 0
    array_field_count = 0

    section_names: list[str] = []
    seen_keys: dict[int, set[str]] = {}
    key_path_stack: list[str] = []

    seen_gpio_pins: set[int] = set()
    seen_power_pin_names: set[str] = set()
    seen_digital_addrs: set[str] = set()
    seen_analog_addrs: set[str] = set()
    seen_io_slot_per_rack: dict[str, set[int]] = {}
    gpio_pin_numbers: set[int] = set()

    def get_seen_at(indent: int) -> set:
        if indent not in seen_keys:
            seen_keys[indent] = set()
        return seen_keys[indent]

    # ── Main loop ─────────────────────────────────────────────────────────────
    for i, line in enumerate(lines):
        line_num = i + 1
        trimmed = line.strip()

        if trimmed == '':
            if in_array_block:
                # Peek ahead: if next non-blank line is a section heading, this blank is a separator
                next_non_blank = next(
                    (lines[j].strip() for j in range(i + 1, len(lines)) if lines[j].strip()),
                    ''
                )
                if not next_non_blank.startswith('##'):
                    add_error(line_num, "§1 Blank lines forbidden inside array blocks", "")
                else:
                    in_array_block = False
            continue

        # Skip doc-comment lines
        if trimmed.startswith('#') and not trimmed.startswith('##') and trimmed != '# METADATA:':
            continue

        leading_spaces = len(line) - len(line.lstrip(' '))

        # §1 Tab indentation
        if line.startswith('\t'):
            add_error(line_num, "§1 Tabs forbidden for indentation", line[:40])

        # §1 Indentation multiple of 2
        if leading_spaces > 0 and leading_spaces % 2 != 0:
            add_error(line_num, "§1 Indentation must be a multiple of 2 spaces", line[:40])

        # End array block when indent decreases
        if in_array_block and leading_spaces <= array_header_indent and not trimmed.startswith('##'):
            in_array_block = False

        # Pop key path stack on indent decrease
        while key_path_stack and leading_spaces <= (len(key_path_stack) - 1) * 2:
            key_path_stack.pop()

        if trimmed == '# METADATA:':
            continue

        # ── §3 Section headings ───────────────────────────────────────────────
        if trimmed.startswith('##'):
            in_array_block = False
            section_count += 1
            stats.section_count = section_count
            m = re.match(r'^##\s+(\d+)\.\s+([A-Z][A-Z0-9 &/()._ -]+):\s*(?:#.*)?$', trimmed)
            if not m:
                add_error(line_num, "§3 Section heading must be: ## N. SECTION NAME:", trimmed[:60])
            else:
                num = int(m.group(1))
                if num != section_count:
                    add_error(line_num,
                              f"§3 Section index must be incremental (expected {section_count}, got {num})",
                              trimmed)
                raw_name = m.group(2).strip()
                if raw_name != raw_name.upper():
                    add_error(line_num, "§3 Section name must be UPPERCASE", trimmed[:60])
                section_names.append(raw_name.upper())
            continue

        # ── §10 List array items ──────────────────────────────────────────────
        if trimmed.startswith('- '):
            if array_kind == 'warnings':
                warning_count += 1
                stats.warning_count = warning_count
            elif array_kind == 'defaultLanguageSkills':
                actual_default_lang_skills += 1
                val = _unquote(trimmed[2:].strip())
                if not re.match(r'^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$', val):
                    add_error(line_num,
                              "§14.9 Skill identifier must match ^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$",
                              trimmed)
            continue

        # ── Tabular array row detection ───────────────────────────────────────
        kv = _split_key_value(line)
        looks_like_row = (kv is None) and ('|' in line) and leading_spaces > 0

        if looks_like_row:
            row = trimmed

            # §9 Pipe with surrounding spaces
            if _has_spaced_pipe(row):
                add_error(line_num,
                          "§9 Tabular row pipe delimiter must NOT have surrounding spaces",
                          line[:60])

            fields = _split_tabular_row(row)

            # §9 Field count
            if array_field_count > 0 and len(fields) != array_field_count:
                add_error(line_num,
                          f"§9 Row has {len(fields)} fields but header declared {array_field_count}",
                          line[:60])

            # ── GPIO row ──────────────────────────────────────────────────────
            if array_kind == 'gpio' and len(fields) >= 4:
                pin_val, type_val, pwm_val, int_val = fields[0], fields[1], fields[2], fields[3]
                if not re.match(r'^\d+$', pin_val):
                    add_error(line_num, "§14.4 GPIO pin must be a non-negative integer", line[:40])
                else:
                    pin_num = int(pin_val)
                    if pin_num in seen_gpio_pins:
                        add_error(line_num, "§14.4 GPIO pin numbers must be unique", line[:40])
                    seen_gpio_pins.add(pin_num)
                    gpio_pin_numbers.add(pin_num)
                    pin_count += 1
                    stats.pin_count = pin_count
                if type_val not in ('digital', 'analog'):
                    add_error(line_num, "§14.4 GPIO type must be 'digital' or 'analog'", line[:40])
                valid_bool = {'t', 'f', 'true', 'false'}
                if pwm_val not in valid_bool:
                    add_error(line_num, "§14.4 GPIO pwm must be t/f/true/false", line[:40])
                if int_val not in valid_bool:
                    add_error(line_num, "§14.4 GPIO int must be t/f/true/false", line[:40])
                if len(fields) >= 5:
                    label = fields[4]
                    if not _is_quoted(label) and re.search(r'[\s/]', label):
                        add_error(line_num,
                                  "§14.4 GPIO label with spaces or '/' must be quoted", line[:60])
                if len(fields) >= 6:
                    roles = fields[5]
                    if not _is_quoted(roles) and ((':' in roles) or (';' in roles)):
                        add_error(line_num,
                                  '§14.4 GPIO roles containing ":" or ";" must be quoted', line[:60])
                    inner = _unquote(roles)
                    if re.search(r' ; | ;|; ', inner):
                        add_error(line_num,
                                  '§11 Sub-value separator ";" must have NO surrounding spaces',
                                  line[:60])

            # ── powerPins row ─────────────────────────────────────────────────
            elif array_kind == 'powerPins' and len(fields) >= 4:
                name_val, dir_val, volt_val, type_val = fields[0], fields[1], fields[2], fields[3]
                if name_val in seen_power_pin_names:
                    add_error(line_num, "§14.3 Power pin names must be unique", line[:40])
                seen_power_pin_names.add(name_val)
                power_pin_count += 1
                if dir_val not in ('input', 'output', 'null'):
                    add_error(line_num,
                              "§14.3 Power pin direction must be input/output/null", line[:40])
                if type_val not in ('ground', 'null'):
                    add_error(line_num,
                              "§14.3 Power pin type must be ground/null", line[:40])
                raw_volt = _unquote(volt_val)
                if raw_volt != 'null' and not raw_volt.endswith('V'):
                    add_error(line_num,
                              "§14.3 Power pin voltage must use V suffix or be null", line[:40])

            # ── ioModules row (PLC) ───────────────────────────────────────────
            elif array_kind == 'ioModules' and len(fields) >= 7:
                slot_val, rack_val, type_val = fields[0], fields[1], fields[2]
                channels_val, addr_start, addr_end, current_val = (
                    fields[3], fields[4], fields[5], fields[6])
                io_module_count += 1
                if not re.match(r'^\d+$', slot_val):
                    add_error(line_num,
                              "§14.3(PLC) ioModules slot must be non-negative integer", line[:40])
                if not re.match(r'^\d+$', rack_val):
                    add_error(line_num,
                              "§14.3(PLC) ioModules rack must be non-negative integer", line[:40])
                rack_key = rack_val
                if rack_key not in seen_io_slot_per_rack:
                    seen_io_slot_per_rack[rack_key] = set()
                slot_num = int(slot_val) if slot_val.isdigit() else -1
                if slot_num >= 0:
                    if slot_num in seen_io_slot_per_rack[rack_key]:
                        add_error(line_num,
                                  "§14.3(PLC) ioModules slot numbers must be unique within same rack",
                                  line[:40])
                    seen_io_slot_per_rack[rack_key].add(slot_num)
                valid_io_types = {
                    'DI', 'DO', 'AI', 'AO', 'DIO', 'AIO', 'safety-DI', 'safety-DO', 'mixed'
                }
                if type_val not in valid_io_types:
                    add_error(line_num,
                              f"§14.3(PLC) ioModules type must be one of: {'/'.join(sorted(valid_io_types))}",
                              line[:60])
                if not re.match(r'^\d+$', channels_val) or int(channels_val) <= 0:
                    add_error(line_num,
                              "§14.3(PLC) ioModules channels must be a positive integer", line[:40])
                for addr_field in (addr_start, addr_end):
                    if addr_field != 'null':
                        if not _is_quoted(addr_field):
                            add_error(line_num,
                                      "§14.3(PLC) ioModules addr_start/addr_end must be quoted",
                                      line[:60])
                        else:
                            inner = _unquote(addr_field)
                            if not _validate_iec_address(inner):
                                add_error(line_num,
                                          f"§5.4(PLC) Invalid IEC 61131-3 address: {inner}",
                                          line[:60])
                            if inner.startswith('%M'):
                                add_error(line_num,
                                          "§5.4(PLC) M-area addresses (%MW/%MD) forbidden in ioModules addr fields",
                                          line[:60])
                raw_current = _unquote(current_val)
                if raw_current != 'null' and not raw_current.endswith('mA'):
                    add_error(line_num,
                              "§14.3(PLC) ioModules current must use mA suffix or be null", line[:40])

            # ── digitalChannels row (PLC) ─────────────────────────────────────
            elif array_kind == 'digitalChannels' and len(fields) >= 4:
                addr_val, dir_val, label_val, roles_val = (
                    fields[0], fields[1], fields[2], fields[3])
                digital_ch_count += 1
                if not _is_quoted(addr_val):
                    add_error(line_num,
                              "§14.4(PLC) digitalChannels addr must be quoted", line[:40])
                else:
                    inner = _unquote(addr_val)
                    if not re.match(r'^%[IQ]X\d+(\.\d+)*$', inner):
                        add_error(line_num,
                                  f"§14.4(PLC) digitalChannels addr must be IEC bit address (%IX/%QX): {inner}",
                                  line[:60])
                    if inner in seen_digital_addrs:
                        add_error(line_num,
                                  "§14.4(PLC) digitalChannels addresses must be unique", line[:40])
                    seen_digital_addrs.add(inner)
                if dir_val not in ('input', 'output', 'bidirectional'):
                    add_error(line_num,
                              "§14.4(PLC) digitalChannels direction must be input/output/bidirectional",
                              line[:40])
                valid_roles = {
                    'di', 'do', 'safety-di', 'safety-do', 'fast-counter', 'interrupt', 'hsc'
                }
                raw_roles = _unquote(roles_val)
                if raw_roles != 'null':
                    for r in raw_roles.split(';'):
                        if r and r not in valid_roles:
                            add_error(line_num,
                                      f'§14.4(PLC) Invalid digitalChannels role: "{r}"',
                                      line[:60])
                    if not _is_quoted(roles_val) and (';' in roles_val or ':' in roles_val):
                        add_error(line_num,
                                  '§14.4(PLC) digitalChannels roles with ";" must be quoted',
                                  line[:60])

            # ── analogChannels row (PLC) ──────────────────────────────────────
            elif array_kind == 'analogChannels' and len(fields) >= 5:
                addr_val, dir_val, res_val = fields[0], fields[1], fields[2]
                analog_ch_count += 1
                if not _is_quoted(addr_val):
                    add_error(line_num,
                              "§14.5(PLC) analogChannels addr must be quoted", line[:40])
                else:
                    inner = _unquote(addr_val)
                    if not re.match(r'^%[IQ][WD]\d+$', inner):
                        add_error(line_num,
                                  f"§14.5(PLC) analogChannels addr must be IEC word/dword address: {inner}",
                                  line[:60])
                    if inner in seen_analog_addrs:
                        add_error(line_num,
                                  "§14.5(PLC) analogChannels addresses must be unique", line[:40])
                    seen_analog_addrs.add(inner)
                if dir_val not in ('input', 'output'):
                    add_error(line_num,
                              "§14.5(PLC) analogChannels direction must be input/output", line[:40])
                if not re.match(r'^\d+$', res_val):
                    add_error(line_num,
                              "§14.5(PLC) analogChannels resolution must be bare integer (bits)",
                              line[:40])

            # ── peripherals row ───────────────────────────────────────────────
            elif array_kind == 'peripherals' and len(fields) >= 3:
                periph_val = fields[0]
                peripheral_count += 1
                stats.peripheral_count = peripheral_count
                if domain == 'MCU':
                    valid_mcu_periph = {'serial', 'i2c', 'spi', 'pwm', 'adc', 'dac'}
                    if periph_val not in valid_mcu_periph:
                        add_error(line_num,
                                  f"§14.5(MCU) peripheral must be one of: {'/'.join(sorted(valid_mcu_periph))}",
                                  line[:60])
                    value_field = _unquote(fields[2])
                    for pin_m in re.finditer(r'[a-zA-Z_]+:(\d+)', value_field):
                        pn = int(pin_m.group(1))
                        if gpio_pin_numbers and pn not in gpio_pin_numbers:
                            add_error(line_num,
                                      f"§14.5(MCU) Peripheral references undefined GPIO pin {pn}",
                                      line[:60])
                    if ';' in value_field and not _is_quoted(fields[2]):
                        add_error(line_num,
                                  '§14.5(MCU) Multi-pin peripheral value with ";" must be quoted',
                                  line[:60])
                elif domain == 'PLC':
                    valid_plc_periph = {
                        'serial', 'ethernet', 'profibus', 'profinet', 'modbus-tcp',
                        'modbus-rtu', 'canopen', 'ethernetip', 'devicenet',
                        'hart', 'io-link', 'opc-ua'
                    }
                    if periph_val not in valid_plc_periph:
                        add_error(line_num,
                                  f"§14.7(PLC) peripheral must be one of: {'/'.join(sorted(valid_plc_periph))}",
                                  line[:60])
                for f in fields:
                    if re.search(r' ; | ;|; ', _unquote(f)):
                        add_error(line_num,
                                  '§11 Sub-value ";" separator must have NO surrounding spaces',
                                  line[:60])

            continue

        # ── Key-value lines ───────────────────────────────────────────────────
        if kv is not None:
            raw_key_part, value_part = kv
            actual_indent = leading_spaces
            clean_key = raw_key_part.strip()
            # value starts after the colon; we already consumed the colon in split
            raw_value = value_part[1:] if value_part.startswith(' ') else value_part
            trim_value = raw_value.strip()

            # §4 Delimiter must be ": "
            if trim_value != '' and not value_part.startswith(' '):
                add_error(line_num,
                          "§4 Key-value delimiter must be \": \" (colon + exactly one space)",
                          line[:40])
            if value_part.startswith('  '):
                add_error(line_num,
                          "§4 Key-value delimiter must be \": \" (exactly one space after colon)",
                          line[:40])

            # §4 Key format
            key_is_quoted = _is_quoted(clean_key)
            unquoted_key = clean_key[1:-1] if key_is_quoted else clean_key
            is_array_decl = '[' in unquoted_key

            if not key_is_quoted and not is_array_decl:
                if not re.match(r'^[A-Za-z_][A-Za-z0-9_.]*$', unquoted_key):
                    add_error(line_num,
                              f'§4 Unquoted key "{unquoted_key}" must match [A-Za-z_][A-Za-z0-9_.]* '
                              f'or be quoted',
                              line[:40])

            # §4 Duplicate keys
            parent_path = '/'.join(key_path_stack)
            composite = f"{parent_path}/{unquoted_key}" if parent_path else unquoted_key
            seen_at = get_seen_at(actual_indent)
            if composite in seen_at:
                add_error(line_num,
                          f'§4 Duplicate key "{unquoted_key}" at same parent scope',
                          line[:40])
            seen_at.add(composite)

            if trim_value == '':
                key_path_stack.append(unquoted_key)

            # §5 Leading zeros
            if not _is_quoted(trim_value) and re.match(r'^0\d+', trim_value):
                add_error(line_num, "§5 Integer must not have leading zeros", line[:40])

            # §5 Float trailing zeros / scientific notation
            if not _is_quoted(trim_value) and re.match(r'^\d+\.\d+$', trim_value):
                if trim_value.endswith('0') and not trim_value.endswith('.0'):
                    add_error(line_num,
                              "§5 Float must not have trailing zeros (e.g. 3.1 not 3.10)",
                              line[:40])
            if not _is_quoted(trim_value) and re.search(r'[eE][+\-]?\d', trim_value):
                add_error(line_num, "§5 Float must not use scientific notation", line[:40])

            # §5 Unquoted hex
            if _is_unquoted_hex(trim_value):
                add_error(line_num,
                          '§5 Hexadecimal values must be quoted (e.g. "0x2341")',
                          line[:40])

            # §5 null / bool case
            if re.match(r'^null$', trim_value, re.IGNORECASE) and trim_value != 'null':
                add_error(line_num, "§5 null literal must be lowercase: null", line[:40])
            if re.match(r'^(true|false)$', trim_value, re.IGNORECASE) and trim_value not in ('true', 'false'):
                add_error(line_num, "§5 Boolean must be lowercase: true or false", line[:40])

            # §12 Escape sequences in quoted strings
            if _is_quoted(trim_value) and not _validate_escapes(trim_value):
                add_error(line_num, "§12 Invalid escape sequence in quoted string", line[:60])

            # §7 Trailing inline record delimiter
            if not in_array_block and trim_value.rstrip().endswith(' |'):
                add_error(line_num,
                          '§7 Trailing inline record delimiter " |" forbidden at end of line',
                          line[:60])

            # §11 Spaces around ; in plain values
            if not _is_quoted(trim_value) and re.search(r' ; | ;|; ', trim_value):
                add_error(line_num,
                          '§11 Sub-value ";" separator must have NO surrounding spaces',
                          line[:60])

            # ── Array collection headers ──────────────────────────────────────
            if is_array_decl:
                in_array_block = True
                array_header_indent = actual_indent
                count_m = re.search(r'\[(\d+)', unquoted_key)
                declared_count = int(count_m.group(1)) if count_m else 0
                fields_m = re.search(r'\{([^}]+)\}', unquoted_key)
                array_field_count = len(fields_m.group(1).split('|')) if fields_m else 0
                array_name = re.sub(r'\[.*', '', unquoted_key)

                if array_name == 'gpio':
                    array_kind = 'gpio'
                    declared_gpio = declared_count
                elif array_name == 'powerPins':
                    array_kind = 'powerPins'
                    declared_power_pins = declared_count
                elif array_name == 'warnings':
                    array_kind = 'warnings'
                    declared_warnings = declared_count
                elif array_name == 'peripherals':
                    array_kind = 'peripherals'
                    declared_peripherals = declared_count
                elif array_name == 'ioModules':
                    array_kind = 'ioModules'
                    declared_io_modules = declared_count
                elif array_name == 'digitalChannels':
                    array_kind = 'digitalChannels'
                    declared_digital_ch = declared_count
                elif array_name == 'analogChannels':
                    array_kind = 'analogChannels'
                    declared_analog_ch = declared_count
                elif array_name == 'defaultLanguageSkills':
                    array_kind = 'defaultLanguageSkills'
                    declared_default_lang_skills = declared_count
                else:
                    array_kind = 'other'

            # ── Domain-specific key checks ────────────────────────────────────

            if domain == 'MCU' and unquoted_key == 'clock':
                if not re.match(r'^\d+$', trim_value) or int(trim_value) <= 0:
                    add_error(line_num,
                              "§5.1(MCU) clock must be a positive integer in Hz", line[:40])

            if domain == 'PLC' and unquoted_key == 'clock':
                add_error(line_num,
                          '§5.1(PLC) "clock" key is forbidden in PLC profiles; use cycle_time',
                          line[:40])

            if domain == 'PLC' and unquoted_key == 'cycle_time':
                if not re.match(r'^\d+$', trim_value) or int(trim_value) <= 0:
                    add_error(line_num,
                              "§5.1(PLC) cycle_time must be a positive integer (ms)", line[:40])

            if domain == 'MCU' and re.search(r'\d+MHz', _unquote(trim_value)):
                add_error(line_num, "§5.2(MCU) MHz is forbidden as a unit suffix", line[:40])

            # Unit suffix checks
            unit_ma = {'max_io_current', 'total_current_limit', 'backplane_current'}
            unit_kb_plc = {'memory_work', 'memory_load', 'memory_retain'}

            if unquoted_key in unit_ma:
                raw = _unquote(trim_value)
                if raw != 'null' and not raw.endswith('mA'):
                    add_error(line_num, f'§14 "{unquoted_key}" must use mA suffix', line[:40])

            if domain == 'PLC' and unquoted_key in unit_kb_plc:
                raw = _unquote(trim_value)
                if not raw.endswith('KB'):
                    add_error(line_num,
                              f'§14.2(PLC) "{unquoted_key}" must use KB suffix', line[:40])

            if domain == 'PLC' and unquoted_key == 'power_consumption':
                raw = _unquote(trim_value)
                if not raw.endswith('W'):
                    add_error(line_num,
                              "§14.2(PLC) power_consumption must use W suffix", line[:40])

            if domain == 'PLC' and unquoted_key == 'supply_voltage':
                raw = _unquote(trim_value)
                if not raw.endswith('V'):
                    add_error(line_num,
                              "§14.2(PLC) supply_voltage must use V suffix", line[:40])

            if domain == 'MCU' and unquoted_key == 'voltage' and '|' not in line:
                raw = _unquote(trim_value)
                if raw != 'null' and not raw.endswith('V'):
                    add_error(line_num,
                              "§14.2(MCU) voltage must use V suffix (e.g. 5V)", line[:40])

            # MCU numeric specs
            if domain == 'MCU':
                if unquoted_key == 'flash_total':
                    if not re.match(r'^\d+$', trim_value) or int(trim_value) <= 0:
                        add_error(line_num,
                                  "§14.2(MCU) flash_total must be a positive integer", line[:40])
                elif unquoted_key == 'flash_available':
                    if not re.match(r'^\d+$', trim_value) or int(trim_value) <= 0:
                        add_error(line_num,
                                  "§14.2(MCU) flash_available must be a positive integer", line[:40])
                elif unquoted_key == 'sram':
                    if not re.match(r'^\d+$', trim_value) or int(trim_value) < 0:
                        add_error(line_num,
                                  "§14.2(MCU) sram must be a non-negative integer", line[:40])
                elif unquoted_key == 'eeprom':
                    if not re.match(r'^\d+$', trim_value) or int(trim_value) < 0:
                        add_error(line_num,
                                  "§14.2(MCU) eeprom must be a non-negative integer", line[:40])

            # dims positive floats
            if unquoted_key in ('w', 'h', 't') and 'dims' in key_path_stack:
                try:
                    v = float(trim_value)
                    if v <= 0:
                        raise ValueError
                except ValueError:
                    add_error(line_num,
                              f"§14.2 dims.{unquoted_key} must be a positive float (mm)",
                              line[:40])

            # MCU: vid / pid
            if domain == 'MCU' and unquoted_key in ('vid', 'pid'):
                if not _is_quoted(trim_value):
                    add_error(line_num,
                              f'§5.4(MCU) {unquoted_key} must be quoted', line[:40])
                elif not re.match(r'^"0x[0-9A-Fa-f]{4}"$', trim_value):
                    add_error(line_num,
                              f'§5.4(MCU) {unquoted_key} must match "0x[0-9A-Fa-f]{{4}}" (e.g. "0x2341")',
                              line[:40])

            # PLC: vid / pid
            if domain == 'PLC' and unquoted_key in ('vid', 'pid') and trim_value:
                if not _is_quoted(trim_value) or not re.match(r'^"0x[0-9A-Fa-f]{4}"$', trim_value):
                    add_error(line_num,
                              f'§14.8(PLC) {unquoted_key} must be quoted and match "0x[0-9A-Fa-f]{{4}}"',
                              line[:40])

            # image: no path traversal
            if unquoted_key == 'image':
                raw = _unquote(trim_value)
                if '..' in raw or '/' in raw or '\\' in raw:
                    add_error(line_num,
                              "§14.1 image must be a relative filename with no path traversal",
                              line[:40])

            # category
            if domain == 'MCU' and unquoted_key == 'category':
                cat = _unquote(trim_value)
                if cat not in ('maker', 'embedded'):
                    add_error(line_num,
                              '§14.1(MCU) category must be "maker" or "embedded"', line[:40])

            if domain == 'PLC' and unquoted_key == 'category':
                if _unquote(trim_value) != 'plc':
                    add_error(line_num, '§14.1(PLC) category must be "plc"', line[:40])

            # form_factor (PLC)
            if domain == 'PLC' and unquoted_key == 'form_factor':
                ff = _unquote(trim_value)
                if ff not in ('modular', 'compact', 'rack', 'softplc'):
                    add_error(line_num,
                              "§14.1(PLC) form_factor must be modular/compact/rack/softplc",
                              line[:40])

            # standard (PLC)
            if domain == 'PLC' and unquoted_key == 'standard':
                std = _unquote(trim_value)
                if not std.startswith('IEC 61131-3'):
                    add_error(line_num,
                              '§14.1(PLC) standard must be "IEC 61131-3" or a valid extension',
                              line[:40])

            # languages (PLC)
            if domain == 'PLC' and unquoted_key == 'languages' and trim_value:
                raw = _unquote(trim_value)
                valid_langs = {'LD', 'FBD', 'ST', 'IL', 'SFC'}
                for lang in re.split(r'[;]', raw):
                    lang = lang.strip()
                    if lang and lang not in valid_langs:
                        add_error(line_num,
                                  f'§14.10(PLC) Invalid language "{lang}" — must be LD/FBD/ST/IL/SFC',
                                  line[:40])

            # Forbidden MCU keys in PLC
            if domain == 'PLC' and unquoted_key in ('arduinoCore', 'pio', 'bootloader'):
                add_error(line_num,
                          f'§14.9(PLC) Key "{unquoted_key}" is forbidden in PLC profiles',
                          line[:40])

            # boardProfileId kebab-case
            if unquoted_key == 'boardProfileId':
                raw = _unquote(trim_value)
                if not re.match(r'^[a-z][a-z0-9-]*$', raw):
                    add_error(line_num,
                              "§14.9 boardProfileId must be kebab-case (e.g. arduino-uno-r3)",
                              line[:40])

            # boardFamilySkillId (PLC)
            if domain == 'PLC' and unquoted_key == 'boardFamilySkillId':
                if _unquote(trim_value) != 'plc-family':
                    add_error(line_num,
                              '§14.10(PLC) boardFamilySkillId must be "plc-family"', line[:40])

            # arduinoCore with dots must be quoted (MCU)
            if domain == 'MCU' and unquoted_key == 'arduinoCore':
                if not _is_quoted(trim_value) and '.' in trim_value:
                    add_error(line_num,
                              '§14.8(MCU) arduinoCore with dots must be quoted (e.g. "1.8.19")',
                              line[:40])

            continue

        # Unrecognised line
        if trimmed:
            add_error(line_num, "§4/§9 Unrecognised line syntax", line[:60])

    # ── Post-parse cross-checks ───────────────────────────────────────────────

    # flash_available <= flash_total (MCU)
    if domain == 'MCU':
        flash_avail = flash_total = 0
        for l in lines:
            kv2 = _split_key_value(l)
            if kv2 and l.lstrip().startswith('flash_available:'):
                try:
                    flash_avail = int(kv2[1].strip())
                except ValueError:
                    pass
            if kv2 and l.lstrip().startswith('flash_total:'):
                try:
                    flash_total = int(kv2[1].strip())
                except ValueError:
                    pass
        if flash_total > 0 and flash_avail > flash_total:
            add_error(1, "§14.2(MCU) flash_available must be <= flash_total",
                      f"flash_available:{flash_avail} > flash_total:{flash_total}")

    # §8 Declared counts vs actual counts
    def count_mismatch(name: str, declared: int, actual: int) -> None:
        if declared > 0 and actual > 0 and actual != declared:
            add_error(1, f"§8 {name} declared {declared} but found {actual}", f"{name}[{declared}]")

    count_mismatch("gpio", declared_gpio, pin_count)
    count_mismatch("powerPins", declared_power_pins, power_pin_count)
    count_mismatch("warnings", declared_warnings, warning_count)
    count_mismatch("peripherals", declared_peripherals, peripheral_count)
    count_mismatch("ioModules", declared_io_modules, io_module_count)
    count_mismatch("digitalChannels", declared_digital_ch, digital_ch_count)
    count_mismatch("analogChannels", declared_analog_ch, analog_ch_count)
    count_mismatch("defaultLanguageSkills", declared_default_lang_skills, actual_default_lang_skills)

    # §3 Required section order
    required_order_mcu = [
        'DEVICE IDENTIFICATION',
        'TECH SPECS & DIMENSIONS',
        'ELECTRICAL PROFILE (POWER PINS)',
        'GPIO MAP',
        'PERIPHERALS & USB',
        'RESTRICTIONS & COMPATIBILITY',
        'AGENT SKILLS',
    ]
    required_order_plc = [
        'DEVICE IDENTIFICATION',
        'TECH SPECS & DIMENSIONS',
        'ELECTRICAL PROFILE (POWER SUPPLY)',
        'I/O MODULE MAP',
        'PERIPHERALS & PROTOCOLS',
        'RESTRICTIONS & COMPATIBILITY',
        'AGENT SKILLS',
    ]
    required_order = required_order_mcu if domain == 'MCU' else required_order_plc
    req_idx = 0
    for name in section_names:
        if req_idx < len(required_order) and name == required_order[req_idx]:
            req_idx += 1
    if req_idx < len(required_order):
        add_error(1,
                  f'§3 Missing or out-of-order required section: "{required_order[req_idx]}"',
                  "")

    stats.warning_count = warning_count

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        stats=stats,
    )


# ─── CLI entry point ──────────────────────────────────────────────────────────

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate a .toon file against the TOON spec v3.0 + ASL dialect rules."
    )
    parser.add_argument("file", help="Path to the .toon file to validate")
    parser.add_argument(
        "--domain",
        choices=["MCU", "PLC"],
        default="MCU",
        help="Profile domain (default: MCU)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    args = parser.parse_args()

    try:
        with open(args.file, encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: file not found: {args.file}", file=sys.stderr)
        sys.exit(2)
    except UnicodeDecodeError as e:
        print(f"Error: file is not valid UTF-8: {e}", file=sys.stderr)
        sys.exit(2)

    result = parse_and_validate(content, domain=args.domain)

    if args.json:
        import json
        print(json.dumps({
            "valid": result.valid,
            "error_count": len(result.errors),
            "errors": [
                {"line": e.line, "rule": e.rule, "snippet": e.snippet}
                for e in result.errors
            ],
            "stats": {
                "sections": result.stats.section_count,
                "pins": result.stats.pin_count,
                "peripherals": result.stats.peripheral_count,
                "warnings": result.stats.warning_count,
            },
        }, indent=2))
    else:
        print(result)
        print()
        print(f"Sections : {result.stats.section_count}")
        print(f"GPIO pins: {result.stats.pin_count}")
        print(f"Periph.  : {result.stats.peripheral_count}")
        print(f"Warnings : {result.stats.warning_count}")

    sys.exit(0 if result.valid else 1)


if __name__ == "__main__":
    _cli()
