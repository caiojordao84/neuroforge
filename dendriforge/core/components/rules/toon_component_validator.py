#!/usr/bin/env python3
"""
toon_component_validator.py — TOON Component Profile Validator
Spec: toon-format/spec v3.0 (2025-11-24)
Dialect: toon-dialect-core §1–§13 §15 | asl-component-profile §5 §14

Usage:
  from toon_component_validator import validate_component
  result = validate_component(content)

  # CLI:
  python toon_component_validator.py mycomponent.toon
  python toon_component_validator.py mycomponent.toon --lenient
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from typing import Optional

# ─── Data types ───────────────────────────────────────────────────────────────

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
    port_count: int = 0
    param_count: int = 0
    warning_count: int = 0
    tag_count: int = 0


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


# ─── Constants ────────────────────────────────────────────────────────────────

VALID_FAMILIES = {
    "electricals", "sensors", "command-elements", "actuators",
    "pneumatics", "hydraulics", "communication", "industrial",
    "virtual-instruments", "panel-infrastructure",
}

VALID_SUBFAMILY = {
    "electricals":          {"sources", "passives", "semiconductors", "protection", "distribution"},
    "sensors":              {"environment", "motion-position", "electrical", "process", "industrial-presence-safety"},
    "command-elements":     {"pushbuttons", "selectors", "emergency-safety", "signaling", "special-interfaces"},
    "actuators":            {"maker-prototyping", "industrial-electrical", "motor-drives", "linear-valves"},
    "pneumatics":           {"pneumatic-actuators", "directional-valves", "flow-pressure-control", "solenoids", "air-preparation", "instrumentation", "vacuum"},
    "hydraulics":           {"hydraulic-actuators", "directional-valves", "pressure-control", "flow-control", "pumps", "check-special-valves", "filtration", "instrumentation"},
    "communication":        {"serial-bus", "industrial-network", "wireless", "gateways", "traffic-monitors"},
    "industrial":           {"logic-control", "io-banks", "process-modules", "hmi-signaling", "functional-safety", "motor-drives"},
    "virtual-instruments":  {"probes", "bench-instruments", "signal-analysis", "protocol-monitors", "debug-fault-injection"},
    "panel-infrastructure": {"circuit-protection", "fuses", "din-supplies", "terminals", "busbars", "aux-relays", "contactors", "inverters-starters", "energy-metering"},
}

VALID_CATEGORIES = {
    "passive", "semiconductor", "source", "sensor", "command", "signal",
    "actuator", "valve", "pump", "accessory", "stub", "monitor", "gateway",
    "node", "function-block", "instrument", "protection", "distribution",
    "switching", "metering",
}

VALID_SYMBOL_STANDARDS = {"IEC", "ANSI", "ISO", "DIN", "NFPA", "JIS", "custom", "null"}

VALID_PORT_DIRECTIONS = {"input", "output", "passive", "bidirectional", "exhaust"}

VALID_PORT_TYPES = {
    "power", "ground", "digital", "analog", "pwm", "uart", "spi", "i2c", "can", "bus",
    "pneumatic", "hydraulic",
    "bool", "int", "float", "word", "dword",
    "serial", "wireless", "network",
}

VALID_SIMULATION_MODELS = {
    "ohms-law", "ideal", "capacitor", "inductor", "transformer",
    "threshold", "analog-transfer", "lookup-table", "script",
    "contact-block", "relay-coil", "latching-contact",
    "pid-controller", "timer-block", "counter-block", "function-block-engine",
    "pneumatic-linear-actuator", "pneumatic-rotary-actuator", "pneumatic-valve",
    "hydraulic-linear-actuator", "hydraulic-rotary-actuator", "hydraulic-valve",
    "hydraulic-pump", "fluid-pressure-source",
    "digital-io", "pwm-output", "adc-input", "uart-bridge",
    "spice", "basic-analog", "basic-digital",
}

VALID_WAVEFORMS = {"DC", "sine", "square", "triangle", "noise", "pwm"}

VALID_MOTION_TYPES = {"linear", "rotary", "none"}

VALID_SIMULATION_ENGINES = {
    "basic-analog", "basic-digital", "digital-io",
    "pneumatic-motion", "hydraulic-motion",
    "protocol-stub-engine", "function-block-engine", "measurement-engine",
}

VALID_PORTS_LAYOUTS = {"horizontal", "vertical", "radial", "custom"}

VALID_LABEL_POSITIONS = {"top", "bottom", "left", "right", "inline"}

VALID_IP_RATINGS = {"IP54", "IP65", "IP67", "IP68", "IP69K"}

VALID_SAFETY_CATEGORIES = {"Cat.2 PLc", "Cat.3 PLd", "Cat.4 PLe"}

VALID_PARAM_TYPES = {"float", "int", "enum", "bool", "string"}

VALID_MEASUREMENT_TARGETS = {
    "voltage", "current", "resistance", "frequency", "power",
    "temperature", "pressure", "flow", "position", "speed", "protocol-frame",
}

FLUID_SIM_MODELS = {
    "pneumatic-linear-actuator", "pneumatic-rotary-actuator", "pneumatic-valve",
    "hydraulic-linear-actuator", "hydraulic-rotary-actuator", "hydraulic-valve",
    "hydraulic-pump", "fluid-pressure-source",
}

FAMILY_TO_ENGINE = {
    "electricals":          "basic-analog",
    "sensors":              "digital-io",
    "command-elements":     "digital-io",
    "actuators":            "digital-io",
    "panel-infrastructure": "digital-io",
    "pneumatics":           "pneumatic-motion",
    "hydraulics":           "hydraulic-motion",
    "communication":        "protocol-stub-engine",
    "industrial":           "function-block-engine",
    "virtual-instruments":  "measurement-engine",
}

# Required sections in order (numeric part only; letter-suffix sections are optional/conditional)
REQUIRED_SECTIONS_CORE = [
    "IDENTIFICATION",
    "PARAMETERS",
    "ELECTRICAL PORTS",
    "SIMULATION BEHAVIOR",
    "LIMITS & WARNINGS",
    "CONNECTIONS & COMPATIBILITY",
    "VISUAL & CANVAS",
    "AGENT SKILLS",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _unquote(s: str) -> str:
    if s.startswith('"') and s.endswith('"') and len(s) >= 2:
        return s[1:-1]
    return s


def _is_quoted(s: str) -> bool:
    return s.startswith('"') and s.endswith('"') and len(s) >= 2


def _split_key_value(line: str) -> Optional[tuple[str, str]]:
    in_quote = False
    for i, ch in enumerate(line):
        if ch == '"':
            in_quote = not in_quote
        elif not in_quote and ch == ':':
            return line[:i].rstrip(), line[i + 1:]
    return None


def _is_unquoted_hex(v: str) -> bool:
    return bool(re.match(r'^0x[0-9A-Fa-f]+', v)) and not _is_quoted(v)


def _validate_escapes(quoted: str) -> bool:
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


def _split_tabular_row(row: str) -> list[str]:
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


def _is_valid_voltage(s: str) -> bool:
    """Accept null, a quoted voltage string like '48V', '3.3V', or a template ref like '{supply_voltage}'."""
    raw = _unquote(s)
    if raw == "null":
        return True
    if re.match(r'^\{[^}]+\}$', raw):
        return True
    return bool(re.match(r'^\d+(\.\d+)?V$', raw))


def _is_valid_current(s: str) -> bool:
    raw = _unquote(s)
    if raw == "null":
        return True
    if re.match(r'^\{[^}]+\}$', raw):
        return True
    return bool(re.match(r'^\d+(\.\d+)?(mA|A)$', raw))


def _is_valid_pressure(s: str) -> bool:
    raw = _unquote(s)
    if raw == "null":
        return True
    if re.match(r'^\{[^}]+\}$', raw):
        return True
    return bool(re.match(r'^\d+(\.\d+)?bar$', raw))


# ─── Public helpers ───────────────────────────────────────────────────────────

def extract_component_profile_id(content: str) -> Optional[str]:
    """Extract componentProfileId from AGENT SKILLS section."""
    in_skills = False
    for line in content.splitlines():
        if '##' in line and 'AGENT SKILLS' in line:
            in_skills = True
            continue
        if in_skills and line.startswith('##') and 'AGENT SKILLS' not in line:
            break
        if in_skills and 'componentProfileId:' in line:
            m = re.search(r'componentProfileId:\s*"?([^"\s]+)"?', line)
            if m:
                return m.group(1)
    return None


# ─── Main validator ───────────────────────────────────────────────────────────

def validate_component(content: str, strict: bool = True) -> ValidationResult:  # noqa: C901
    errors: list[ValidationError] = []
    stats = ValidationStats()

    def add_error(line_num: int, rule: str, snippet: str) -> None:
        errors.append(ValidationError(line=line_num, rule=rule, snippet=snippet[:100]))

    def add_warn(line_num: int, rule: str, snippet: str) -> None:
        if strict:
            errors.append(ValidationError(line=line_num, rule=f"[WARN] {rule}", snippet=snippet[:100]))

    # §15 Trailing newline
    if content.endswith('\n'):
        add_error(len(content.splitlines()), "§15 Trailing newline forbidden at end of file", "")

    # §15 BOM
    if content.startswith('\ufeff'):
        add_error(1, "§15 UTF-8 BOM forbidden", "")

    lines = [l.rstrip('\r') for l in content.split('\n')]

    # §1 Trailing whitespace
    for i, line in enumerate(lines):
        if line.endswith(' ') or line.endswith('\t'):
            add_error(i + 1, "§1 Trailing whitespace forbidden", line[:40])

    # §2 Inline comments
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

    # §12 Single quotes forbidden
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

    # §13 METADATA position
    meta_line = next((i for i, l in enumerate(lines) if l.strip() == '# METADATA:'), -1)
    first_section = next((i for i, l in enumerate(lines) if l.strip().startswith('##')), -1)

    if meta_line == -1:
        add_error(1, "§13 METADATA block required at top of document", "# METADATA:")
    elif first_section != -1 and meta_line > first_section:
        add_error(meta_line + 1, "§13 METADATA block must appear before any ## section heading", "# METADATA:")

    # §13 Required metadata keys
    for key in ('project_name', 'version', 'editor', 'author', 'ASLversion'):
        if not any(l.lstrip().startswith(f'{key}:') for l in lines):
            add_error(1, f"§13 METADATA required key missing: {key}", "# METADATA:")

    # §14.1 project_name pattern
    pn_line = next((l for l in lines if l.lstrip().startswith('project_name:')), None)
    if pn_line:
        raw_pn = _unquote((_split_key_value(pn_line) or (None, ''))[1].strip())
        if not re.match(r'^[a-z][a-z0-9-]+-profile$', raw_pn):
            add_error(lines.index(pn_line) + 1,
                      "§14.1 project_name must match ^[a-z][a-z0-9-]+-profile$",
                      pn_line[:60])

    # §14.1 editor / author
    for key, expected in (('editor', 'dendriForge'), ('author', 'schemasmith')):
        kline = next((l for l in lines if l.lstrip().startswith(f'{key}:')), None)
        if kline:
            raw_v = _unquote((_split_key_value(kline) or (None, ''))[1].strip())
            if raw_v != expected:
                add_error(lines.index(kline) + 1,
                          f"§14.1 {key} must be '{expected}'", kline[:60])

    # §13 version positive integer
    version_line = next(
        (l for l in lines if re.match(r'^\s*version:', l) and 'ASLversion' not in l), None)
    if version_line:
        raw = (_split_key_value(version_line) or (None, ''))[1].strip()
        try:
            v = int(raw)
            if v <= 0 or str(v) != raw:
                raise ValueError
        except ValueError:
            add_error(lines.index(version_line) + 1,
                      "§13 version must be a positive integer", version_line[:40])

    # §13 ASLversion semver
    asl_line = next((l for l in lines if l.lstrip().startswith('ASLversion:')), None)
    if asl_line:
        raw = _unquote((_split_key_value(asl_line) or (None, ''))[1].strip())
        if not re.match(r'^\d+\.\d+\.\d+$', raw):
            add_error(lines.index(asl_line) + 1,
                      "§13 ASLversion must follow semver MAJOR.MINOR.PATCH (e.g. 0.2.0)",
                      asl_line[:40])

    # ── State tracking ─────────────────────────────────────────────────────
    section_count = 0
    section_names_raw: list[str] = []     # uppercase section names in order
    section_line_map: dict[str, int] = {}

    in_array_block = False
    array_kind = 'other'
    array_header_indent = 0
    array_field_count = 0

    # Per-array declared vs actual counters
    declared: dict[str, int] = {}
    actual: dict[str, int] = {}
    for name in ('ports', 'pneumatic_ports', 'hydraulic_ports', 'protocol_ports',
                 'sensor_slots', 'measurement_targets', 'states', 'warnings', 'tags'):
        declared[name] = 0
        actual[name] = 0

    seen_port_ids: set[str] = set()
    seen_fluid_port_ids: set[str] = set()
    seen_proto_port_ids: set[str] = set()
    seen_slot_ids: set[str] = set()
    seen_keys: dict[int, set[str]] = {}
    key_path_stack: list[str] = []

    # Collected identification values for cross-checks
    id_family: str = ""
    id_subfamily: str = ""
    id_category: str = ""
    id_symbol_standard: str = ""
    id_component_id: str = ""
    sim_model: str = ""
    sim_engine: str = ""
    canvas_ports_layout: str = ""

    def get_seen_at(indent: int) -> set:
        if indent not in seen_keys:
            seen_keys[indent] = set()
        return seen_keys[indent]

    # ── Main loop ──────────────────────────────────────────────────────────
    for i, line in enumerate(lines):
        line_num = i + 1
        trimmed = line.strip()

        if trimmed == '':
            if in_array_block:
                next_nb = next(
                    (lines[j].strip() for j in range(i + 1, len(lines)) if lines[j].strip()), '')
                if not next_nb.startswith('##'):
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

        while key_path_stack and leading_spaces <= (len(key_path_stack) - 1) * 2:
            key_path_stack.pop()

        if trimmed == '# METADATA:':
            continue

        # ── §3 Section headings ──────────────────────────────────────────
        if trimmed.startswith('##'):
            in_array_block = False

            # Accept both ## N. NAME: and ## Nb. NAME: (letter-suffix)
            m = re.match(r'^##\s+(\d+)([a-z]?)\.\s+([A-Z][A-Z0-9 &/()._ -]+):\s*(?:#.*)?$', trimmed)
            if not m:
                add_error(line_num, "§3 Section heading must be: ## N. SECTION NAME:", trimmed[:60])
                continue

            num = int(m.group(1))
            letter = m.group(2)
            raw_name = m.group(3).strip().upper()

            # Increment section_count only for new numeric part (not letter sub-sections)
            if not letter:
                section_count += 1
                stats.section_count = section_count
                if num != section_count:
                    add_error(line_num,
                              f"§3 Section index must be incremental (expected {section_count}, got {num})",
                              trimmed)
            # Letter-suffix sections don't advance main counter but must repeat the current number
            else:
                if num != section_count:
                    add_error(line_num,
                              f"§3 Letter-suffix section index {num} must equal current base index {section_count}",
                              trimmed)

            if raw_name != raw_name.upper():
                add_error(line_num, "§3 Section name must be UPPERCASE", trimmed[:60])

            section_names_raw.append(raw_name)
            section_line_map[raw_name] = line_num
            continue

        # ── §10 List array items ─────────────────────────────────────────
        if trimmed.startswith('- '):
            val = _unquote(trimmed[2:].strip())
            if array_kind == 'warnings':
                actual['warnings'] += 1
                stats.warning_count = actual['warnings']
                if not val:
                    add_error(line_num, "§14.6 Warning entry must be a non-empty quoted string", line[:60])
            elif array_kind == 'tags':
                actual['tags'] += 1
                stats.tag_count = actual['tags']
                if not re.match(r'^[a-z][a-z0-9-]*$', val):
                    add_error(line_num,
                              "§14.9 Tag must be lowercase kebab-case: ^[a-z][a-z0-9-]*$",
                              trimmed)
            elif array_kind == 'states':
                actual['states'] += 1
                if not re.match(r'^[a-z][a-z0-9-]*$', val):
                    add_error(line_num,
                              "§14.5 State name must be lowercase alphanumeric-hyphen", trimmed)
            continue

        # ── Tabular array row detection ──────────────────────────────────
        kv = _split_key_value(line)
        looks_like_row = (kv is None) and ('|' in line) and leading_spaces > 0

        if looks_like_row:
            row = trimmed

            if _has_spaced_pipe(row):
                add_error(line_num, "§9 Tabular row pipe delimiter must NOT have surrounding spaces", line[:60])

            fields = _split_tabular_row(row)

            if array_field_count > 0 and len(fields) != array_field_count:
                add_error(line_num,
                          f"§9 Row has {len(fields)} fields but header declared {array_field_count}",
                          line[:60])

            # ── ports row ────────────────────────────────────────────────
            if array_kind == 'ports' and len(fields) >= 6:
                actual['ports'] += 1
                stats.port_count = actual['ports']
                pid, direction, ptype, vmax, imax, notes = (
                    fields[0], fields[1], fields[2], fields[3], fields[4], fields[5])
                if not re.match(r'^[A-Z][A-Z0-9_]*$', pid):
                    add_error(line_num, "§14.4 Port id must be uppercase letters/digits/underscore", line[:40])
                if pid in seen_port_ids:
                    add_error(line_num, "§14.4 Port id must be unique within ports array", line[:40])
                seen_port_ids.add(pid)
                if direction not in VALID_PORT_DIRECTIONS:
                    add_error(line_num,
                              f"§14.4 Port direction must be one of: {'/'.join(sorted(VALID_PORT_DIRECTIONS))}",
                              line[:60])
                if ptype not in VALID_PORT_TYPES:
                    add_error(line_num,
                              f"§14.4 Port type must be one of: {'/'.join(sorted(VALID_PORT_TYPES))}",
                              line[:60])
                if not _is_valid_voltage(vmax):
                    add_error(line_num, '§14.4 voltage_max must be null or quoted voltage string (e.g. "48V")', line[:60])
                if not _is_valid_current(imax):
                    add_error(line_num, '§14.4 current_max must be null or quoted current string (e.g. "200mA")', line[:60])
                if not _is_quoted(notes):
                    add_error(line_num, "§14.4 Port notes must be a quoted non-empty string", line[:60])

            # ── pneumatic_ports / hydraulic_ports row ────────────────────
            elif array_kind in ('pneumatic_ports', 'hydraulic_ports') and len(fields) >= 6:
                kind_key = 'pneumatic_ports' if array_kind == 'pneumatic_ports' else 'hydraulic_ports'
                actual[kind_key] += 1
                fpid, fdir, ftype, pmax, flow, fnotes = (
                    fields[0], fields[1], fields[2], fields[3], fields[4], fields[5])
                if not re.match(r'^[A-Z][A-Z0-9_]*$', fpid):
                    add_error(line_num, f"§14.4b {array_kind} id must be uppercase letters/digits/underscore", line[:40])
                if fpid in seen_fluid_port_ids:
                    add_error(line_num, f"§14.4b {array_kind} id must be unique", line[:40])
                seen_fluid_port_ids.add(fpid)
                valid_fdir = {"input", "output", "bidirectional", "exhaust"}
                if fdir not in valid_fdir:
                    add_error(line_num, f"§14.4b {array_kind} direction must be one of: {'/'.join(sorted(valid_fdir))}", line[:60])
                expected_ftype = "pneumatic" if array_kind == 'pneumatic_ports' else "hydraulic"
                if ftype != expected_ftype:
                    add_error(line_num, f"§14.4b {array_kind} type must be '{expected_ftype}'", line[:60])
                if not _is_valid_pressure(pmax):
                    add_error(line_num, '§14.4b pressure_max must be null or a bar string (e.g. "10bar")', line[:60])

            # ── protocol_ports row ───────────────────────────────────────
            elif array_kind == 'protocol_ports' and len(fields) >= 4:
                actual['protocol_ports'] += 1
                ppid, pdir = fields[0], fields[1]
                pnotes = fields[3]
                if not re.match(r'^[A-Z][A-Z0-9_]*$', ppid):
                    add_error(line_num, "§14.4c protocol_ports id must be uppercase letters/digits/underscore", line[:40])
                if ppid in seen_proto_port_ids:
                    add_error(line_num, "§14.4c protocol_ports id must be unique", line[:40])
                seen_proto_port_ids.add(ppid)
                valid_pdir = {"input", "output", "bidirectional"}
                if pdir not in valid_pdir:
                    add_error(line_num, f"§14.4c protocol_ports direction must be one of: {'/'.join(sorted(valid_pdir))}", line[:60])
                if not _is_quoted(pnotes):
                    add_error(line_num, "§14.4c protocol_ports notes must be a quoted string", line[:60])

            # ── sensor_slots row ─────────────────────────────────────────
            elif array_kind == 'sensor_slots' and len(fields) >= 3:
                actual['sensor_slots'] += 1
                ssid, sspos = fields[0], fields[1]
                if not re.match(r'^S\d+$', ssid):
                    add_error(line_num, "§14.8b sensor_slots id must match S<n> (e.g. S1, S2)", line[:40])
                if ssid in seen_slot_ids:
                    add_error(line_num, "§14.8b sensor_slots id must be unique", line[:40])
                seen_slot_ids.add(ssid)
                valid_pos = {"retracted-end", "extended-end", "mid-stroke", "custom"}
                if sspos not in valid_pos:
                    add_error(line_num, f"§14.8b sensor_slots position must be one of: {'/'.join(sorted(valid_pos))}", line[:60])

            # ── measurement_targets row ──────────────────────────────────
            elif array_kind == 'measurement_targets' and len(fields) >= 3:
                actual['measurement_targets'] += 1
                mt_target = fields[0]
                mt_desc = fields[2]
                if mt_target not in VALID_MEASUREMENT_TARGETS:
                    add_error(line_num,
                              f"§14.8c measurement_targets target must be one of: {'/'.join(sorted(VALID_MEASUREMENT_TARGETS))}",
                              line[:60])
                if not _is_quoted(mt_desc):
                    add_error(line_num, "§14.8c measurement_targets description must be a quoted string", line[:60])

            continue

        # ── Key-value lines ──────────────────────────────────────────────
        if kv is not None:
            raw_key_part, value_part = kv
            actual_indent = leading_spaces
            clean_key = raw_key_part.strip()
            raw_value = value_part[1:] if value_part.startswith(' ') else value_part
            trim_value = raw_value.strip()

            # §4 Delimiter must be ": "
            if trim_value != '' and not value_part.startswith(' '):
                add_error(line_num, '§4 Key-value delimiter must be ": " (colon + exactly one space)', line[:40])
            if value_part.startswith('  '):
                add_error(line_num, '§4 Key-value delimiter must be ": " (exactly one space after colon)', line[:40])

            # §4 Key format
            key_is_quoted = _is_quoted(clean_key)
            unquoted_key = clean_key[1:-1] if key_is_quoted else clean_key
            is_array_decl = '[' in unquoted_key

            if not key_is_quoted and not is_array_decl:
                if not re.match(r'^[A-Za-z_][A-Za-z0-9_.]*$', unquoted_key):
                    add_error(line_num,
                              f'§4 Unquoted key "{unquoted_key}" contains invalid characters',
                              line[:40])

            # §4 Duplicate keys
            parent_path = '/'.join(key_path_stack)
            composite = f"{parent_path}/{unquoted_key}" if parent_path else unquoted_key
            seen_at = get_seen_at(actual_indent)
            if composite in seen_at:
                add_error(line_num, f'§4 Duplicate key "{unquoted_key}" at same parent scope', line[:40])
            seen_at.add(composite)

            if trim_value == '':
                key_path_stack.append(unquoted_key)

            # §5 Leading zeros
            if not _is_quoted(trim_value) and re.match(r'^0\d+', trim_value):
                add_error(line_num, "§5 Integer must not have leading zeros", line[:40])

            # §5 Float trailing zeros
            if not _is_quoted(trim_value) and re.match(r'^\d+\.\d+$', trim_value):
                if trim_value.endswith('0') and not trim_value.endswith('.0'):
                    add_error(line_num, "§5 Float must not have trailing zeros", line[:40])
            if not _is_quoted(trim_value) and re.search(r'[eE][+\-]?\d', trim_value):
                add_error(line_num, "§5 Float must not use scientific notation", line[:40])

            # §5 Unquoted hex
            if _is_unquoted_hex(trim_value):
                add_error(line_num, '§5 Hexadecimal values must be quoted', line[:40])

            # §5 null / bool case
            if re.match(r'^null$', trim_value, re.IGNORECASE) and trim_value != 'null':
                add_error(line_num, "§5 null literal must be lowercase: null", line[:40])
            if re.match(r'^(true|false)$', trim_value, re.IGNORECASE) and trim_value not in ('true', 'false'):
                add_error(line_num, "§5 Boolean must be lowercase: true or false", line[:40])

            # §5.3 Boolean shorthand t/f forbidden in component profiles
            if trim_value in ('t', 'f') and not is_array_decl:
                add_error(line_num, "§5.3 Boolean shorthand t/f is forbidden in component profiles; use true/false", line[:40])

            # §12 Escape sequences
            if _is_quoted(trim_value) and not _validate_escapes(trim_value):
                add_error(line_num, "§12 Invalid escape sequence in quoted string", line[:60])

            # §7 Trailing inline record delimiter
            if not in_array_block and trim_value.rstrip().endswith(' |'):
                add_error(line_num, '§7 Trailing inline record delimiter " |" forbidden', line[:60])

            # §11 Spaces around ; in plain values
            if not _is_quoted(trim_value) and re.search(r' ; | ;|; ', trim_value):
                add_error(line_num, '§11 Sub-value ";" separator must have NO surrounding spaces', line[:60])

            # §5.2 Forbidden board-domain unit suffixes
            raw_tv = _unquote(trim_value)
            if re.search(r'\d+(MHz|KB|kHz|ms)\b', raw_tv):
                add_error(line_num, "§5.2 Unit suffixes MHz/KB/kHz/ms are forbidden in component profiles", line[:40])

            # §5.1 clock key forbidden
            if unquoted_key == 'clock':
                add_error(line_num, "§5.1 'clock' key is forbidden in component profiles", line[:40])

            # Forbidden board-domain keys
            for forbidden_key in ('arduinoCore', 'pio', 'bootloader', 'boardFamilySkillId',
                                  'boardProfileId', 'defaultLanguageSkills', 'cycle_time',
                                  'flash_total', 'flash_available', 'sram', 'eeprom'):
                if unquoted_key == forbidden_key:
                    add_error(line_num, f"§14 Key '{forbidden_key}' is forbidden in component profiles", line[:40])

            # ── IDENTIFICATION fields ─────────────────────────────────
            if unquoted_key == 'id' and 'IDENTIFICATION' in section_names_raw:
                raw = _unquote(trim_value)
                if not re.match(r'^[a-z][a-z0-9-]*$', raw):
                    add_error(line_num, "§14.2 id must be kebab-case: ^[a-z][a-z0-9-]*$", line[:40])
                id_component_id = raw

            if unquoted_key == 'name' and 'IDENTIFICATION' in section_names_raw:
                if not _is_quoted(trim_value) or _unquote(trim_value) == '':
                    add_error(line_num, "§14.2 name must be a quoted non-empty string", line[:40])

            if unquoted_key == 'family':
                raw = _unquote(trim_value)
                if raw not in VALID_FAMILIES:
                    add_error(line_num,
                              f"§14.2 family must be one of: {', '.join(sorted(VALID_FAMILIES))}",
                              line[:60])
                id_family = raw

            if unquoted_key == 'subfamily':
                raw = _unquote(trim_value)
                id_subfamily = raw
                if id_family and id_family in VALID_SUBFAMILY:
                    if raw not in VALID_SUBFAMILY[id_family]:
                        add_error(line_num,
                                  f"§14.2a subfamily '{raw}' is not valid for family '{id_family}'",
                                  line[:60])

            if unquoted_key == 'category':
                raw = _unquote(trim_value)
                id_category = raw
                if raw not in VALID_CATEGORIES:
                    add_error(line_num,
                              f"§14.2 category must be one of: {', '.join(sorted(VALID_CATEGORIES))}",
                              line[:60])

            if unquoted_key == 'symbol_standard':
                raw = _unquote(trim_value)
                id_symbol_standard = raw
                if raw not in VALID_SYMBOL_STANDARDS:
                    add_error(line_num,
                              f"§14.2 symbol_standard must be one of: {', '.join(sorted(VALID_SYMBOL_STANDARDS))}",
                              line[:60])

            if unquoted_key == 'image':
                raw = _unquote(trim_value)
                if '..' in raw or '/' in raw or '\\' in raw:
                    add_error(line_num, "§14.2 image must be a relative filename with no path traversal", line[:40])
                if not re.match(r'^[a-z][a-z0-9-]*\.svg$', raw):
                    add_error(line_num, "§14.2 image must match ^[a-z][a-z0-9-]*.svg$", line[:40])

            if unquoted_key == 'symbol':
                raw = _unquote(trim_value)
                if not re.match(r'^[a-z][a-z0-9-]*-symbol\.svg$', raw):
                    add_error(line_num, "§14.2 symbol must match ^[a-z][a-z0-9-]*-symbol.svg$", line[:40])

            if unquoted_key == 'url':
                raw = _unquote(trim_value)
                if raw != 'null' and not re.match(r'^https?://', raw) and not raw.startswith('['):
                    add_error(line_num, "§14.2 url must be null or a well-formed absolute https:// URL", line[:60])

            # ── PARAMS fields ─────────────────────────────────────────
            if unquoted_key == 'type' and 'params' in key_path_stack:
                raw = _unquote(trim_value)
                if raw not in VALID_PARAM_TYPES:
                    add_error(line_num,
                              f"§14.3 param type must be one of: {'/'.join(sorted(VALID_PARAM_TYPES))}",
                              line[:60])
                stats.param_count += 1

            if unquoted_key == 'editable' and 'params' in key_path_stack:
                if trim_value not in ('true', 'false'):
                    add_error(line_num, "§14.3 param editable must be true or false", line[:40])

            # ── SIMULATION fields ─────────────────────────────────────
            if unquoted_key == 'model' and 'simulation' in key_path_stack:
                raw = _unquote(trim_value)
                sim_model = raw
                if raw not in VALID_SIMULATION_MODELS:
                    add_error(line_num,
                              f"§14.5 simulation.model must be one of the valid simulation models",
                              line[:60])

            if unquoted_key == 'waveform' and 'simulation' in key_path_stack:
                raw = _unquote(trim_value)
                if raw not in VALID_WAVEFORMS:
                    add_error(line_num,
                              f"§14.5 simulation.waveform must be one of: {'/'.join(sorted(VALID_WAVEFORMS))}",
                              line[:60])

            if unquoted_key == 'motion' and 'simulation' in key_path_stack:
                raw = _unquote(trim_value)
                if raw not in VALID_MOTION_TYPES:
                    add_error(line_num,
                              f"§14.5 simulation.motion must be one of: {'/'.join(sorted(VALID_MOTION_TYPES))}",
                              line[:60])

            for bool_key in ('bidirectional', 'dynamic', 'thermal_model', 'noise_model',
                             'latching', 'feedback', 'position_feedback', 'real_time',
                             'scan_cycle_aware', 'animated', 'passive', 'display_panel',
                             'protocol_emulation', 'leakage_model'):
                if unquoted_key == bool_key and trim_value not in ('true', 'false', 'null'):
                    add_error(line_num, f"§14.5/§14.8 '{bool_key}' must be true or false", line[:40])

            # ── LIMITS fields ─────────────────────────────────────────
            if unquoted_key == 'max_voltage' and 'limits' in key_path_stack:
                if not _is_valid_voltage(trim_value):
                    add_error(line_num, '§14.6 limits.max_voltage must be null or a quoted V string', line[:40])

            if unquoted_key == 'max_current' and 'limits' in key_path_stack:
                if not _is_valid_current(trim_value):
                    add_error(line_num, '§14.6 limits.max_current must be null or a quoted A/mA string', line[:40])

            if unquoted_key == 'ip_rating' and trim_value != 'null':
                raw = _unquote(trim_value)
                if raw not in VALID_IP_RATINGS:
                    add_error(line_num,
                              f"§5.6 ip_rating must be null or one of: {'/'.join(sorted(VALID_IP_RATINGS))}",
                              line[:60])

            if unquoted_key == 'safety_category' and trim_value != 'null':
                raw = _unquote(trim_value)
                if raw not in VALID_SAFETY_CATEGORIES:
                    add_error(line_num,
                              f"§5.7 safety_category must be null or one of: {'/'.join(sorted(VALID_SAFETY_CATEGORIES))}",
                              line[:60])

            # ── CANVAS fields ─────────────────────────────────────────
            if unquoted_key == 'ports_layout' and 'canvas' in key_path_stack:
                raw = _unquote(trim_value)
                canvas_ports_layout = raw
                if raw not in VALID_PORTS_LAYOUTS:
                    add_error(line_num,
                              f"§14.8 canvas.ports_layout must be one of: {'/'.join(sorted(VALID_PORTS_LAYOUTS))}",
                              line[:60])

            if unquoted_key == 'label_position' and 'canvas' in key_path_stack:
                raw = _unquote(trim_value)
                if raw not in VALID_LABEL_POSITIONS:
                    add_error(line_num,
                              f"§14.8 canvas.label_position must be one of: {'/'.join(sorted(VALID_LABEL_POSITIONS))}",
                              line[:60])

            if unquoted_key in ('width', 'height') and 'canvas' in key_path_stack:
                if not re.match(r'^\d+$', trim_value) or int(trim_value) <= 0:
                    add_error(line_num, f"§14.8 canvas.{unquoted_key} must be a positive integer", line[:40])

            if unquoted_key in ('x', 'y') and 'canvas' in key_path_stack:
                if not re.match(r'^\d+$', trim_value):
                    add_error(line_num, f"§14.8 canvas port coordinate {unquoted_key} must be a non-negative integer", line[:40])

            if unquoted_key == 'value_display' and 'canvas' in key_path_stack:
                if not _is_quoted(trim_value) or _unquote(trim_value) == '':
                    add_error(line_num, "§14.8 canvas.value_display must be a quoted non-empty string", line[:40])

            # ── AGENT SKILLS fields ───────────────────────────────────
            if unquoted_key == 'componentFamilySkillId':
                raw = _unquote(trim_value)
                if not re.match(r'^[a-z][a-z0-9-]*-family$', raw):
                    add_error(line_num, "§14.9 componentFamilySkillId must match ^[a-z][a-z0-9-]*-family$", line[:40])
                # Cross-check: prefix must match family
                if id_family:
                    expected_skill_family = id_family.replace('-', '') if '-' not in id_family else id_family
                    expected_fam = id_family + "-family"
                    if raw != expected_fam:
                        add_warn(line_num,
                                 f"§14.9 componentFamilySkillId '{raw}' should be '{expected_fam}' for family '{id_family}'",
                                 line[:60])

            if unquoted_key == 'componentProfileId':
                raw = _unquote(trim_value)
                if not re.match(r'^[a-z][a-z0-9-]*$', raw):
                    add_error(line_num, "§14.9 componentProfileId must be kebab-case", line[:40])
                if id_component_id and raw != id_component_id:
                    add_error(line_num,
                              f"§14.9 componentProfileId '{raw}' must match id '{id_component_id}'",
                              line[:60])
                sim_engine = raw  # reuse var name; actual engine checked below

            if unquoted_key == 'simulationEngine':
                raw = _unquote(trim_value)
                sim_engine = raw
                if raw not in VALID_SIMULATION_ENGINES:
                    add_error(line_num,
                              f"§14.9 simulationEngine must be one of: {', '.join(sorted(VALID_SIMULATION_ENGINES))}",
                              line[:60])

            if unquoted_key == 'paletteGroup':
                if not _is_quoted(trim_value) or _unquote(trim_value) == '':
                    add_error(line_num, "§14.9 paletteGroup must be a quoted non-empty string", line[:40])

            # ── Array collection headers ──────────────────────────────
            if is_array_decl:
                in_array_block = True
                array_header_indent = actual_indent
                count_m = re.search(r'\[(\d+)', unquoted_key)
                declared_count = int(count_m.group(1)) if count_m else 0
                fields_m = re.search(r'\{([^}]+)\}', unquoted_key)
                array_field_count = len(fields_m.group(1).split('|')) if fields_m else 0
                array_name = re.sub(r'\[.*', '', unquoted_key)

                if array_name == 'ports':
                    array_kind = 'ports'
                    declared['ports'] = declared_count
                elif array_name == 'pneumatic_ports':
                    array_kind = 'pneumatic_ports'
                    declared['pneumatic_ports'] = declared_count
                elif array_name == 'hydraulic_ports':
                    array_kind = 'hydraulic_ports'
                    declared['hydraulic_ports'] = declared_count
                elif array_name == 'protocol_ports':
                    array_kind = 'protocol_ports'
                    declared['protocol_ports'] = declared_count
                elif array_name == 'sensor_slots':
                    array_kind = 'sensor_slots'
                    declared['sensor_slots'] = declared_count
                elif array_name == 'measurement_targets':
                    array_kind = 'measurement_targets'
                    declared['measurement_targets'] = declared_count
                elif array_name == 'states':
                    array_kind = 'states'
                    declared['states'] = declared_count
                elif array_name == 'warnings':
                    array_kind = 'warnings'
                    declared['warnings'] = declared_count
                elif array_name == 'tags':
                    array_kind = 'tags'
                    declared['tags'] = declared_count
                else:
                    array_kind = 'other'

            continue

        # Unrecognised line
        if trimmed:
            add_error(line_num, "§4/§9 Unrecognised line syntax", line[:60])

    # ── Post-parse cross-checks ────────────────────────────────────────────

    # §8 Declared vs actual counts
    for name in declared:
        d = declared[name]
        a = actual.get(name, 0)
        if d > 0 and a > 0 and a != d:
            add_error(1, f"§8 '{name}' declared {d} but found {a}", f"{name}[{d}]")

    # §14.4b Family-mandatory fluid ports
    if id_family == 'pneumatics' and actual.get('pneumatic_ports', 0) == 0:
        add_error(1, "§14.4b Family 'pneumatics' requires a 'pneumatic_ports' section with at least 1 port", "")
    if id_family == 'hydraulics' and actual.get('hydraulic_ports', 0) == 0:
        add_error(1, "§14.4b Family 'hydraulics' requires a 'hydraulic_ports' section with at least 1 port", "")

    # §14.4c Family-mandatory protocol ports
    if id_family == 'communication' and actual.get('protocol_ports', 0) == 0:
        add_error(1, "§14.4c Family 'communication' requires a 'protocol_ports' section", "")

    # §14.8c Family-mandatory measurement targets
    if id_family == 'virtual-instruments' and actual.get('measurement_targets', 0) == 0:
        add_error(1, "§14.8c Family 'virtual-instruments' requires a 'measurement_targets' section", "")

    # §14.6 At least one warning
    if actual.get('warnings', 0) == 0:
        add_warn(1, "§14.6 At least one warning entry is recommended", "warnings[n]")

    # §14.9 At least one tag
    if actual.get('tags', 0) == 0:
        add_error(1, "§14.9 At least one tag entry is required in dendriForge.tags", "tags[n]")

    # §14.11 Cross-family simulation model consistency
    if id_family and sim_model:
        if id_family in ('pneumatics', 'hydraulics') and sim_model not in FLUID_SIM_MODELS:
            add_error(1,
                      f"§14.11 Family '{id_family}' requires a fluid simulation model; got '{sim_model}'",
                      f"simulation.model: {sim_model}")
        if id_family == 'virtual-instruments' and sim_model != 'script':
            add_error(1,
                      "§14.11 Family 'virtual-instruments' requires simulation.model: script",
                      f"simulation.model: {sim_model}")

    # §14.11 simulationEngine consistency with family
    if id_family and sim_engine and sim_engine in VALID_SIMULATION_ENGINES:
        expected_engine = FAMILY_TO_ENGINE.get(id_family)
        if expected_engine and sim_engine != expected_engine:
            add_warn(1,
                     f"§14.11 simulationEngine '{sim_engine}' does not match expected '{expected_engine}' for family '{id_family}'",
                     f"family: {id_family}")

    # §14.7 Cross-family forbidden_with rules
    if id_family in ('pneumatics', 'hydraulics'):
        # Look for forbidden_with content
        for lline in lines:
            if 'forbidden_with' in lline:
                raw = _unquote(lline.split(':', 1)[-1].strip())
                target = "hyd-*" if id_family == 'pneumatics' else "pneu-*"
                if target not in raw and '"*"' not in raw:
                    add_warn(1,
                             f"§14.7 '{id_family}' component should include '{target}' in connections.forbidden_with",
                             "connections.forbidden_with")
                break

    # §14.10 Required section presence
    present_sections = set(section_names_raw)
    for req in REQUIRED_SECTIONS_CORE:
        if req not in present_sections:
            add_error(1, f"§14.10 Required section missing: '{req}'", "")

    # §14.10 Section order check (core numeric sections only)
    section_order_idx = {s: i for i, s in enumerate(section_names_raw)}
    prev_idx = -1
    for req in REQUIRED_SECTIONS_CORE:
        if req in section_order_idx:
            cur = section_order_idx[req]
            if cur < prev_idx:
                add_error(section_line_map.get(req, 1),
                          f"§14.10 Section '{req}' is out of order",
                          f"Expected after index {prev_idx}")
            prev_idx = cur

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        stats=stats,
    )


# ─── CLI entry point ──────────────────────────────────────────────────────────

def _cli() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate a .toon component profile against ASL component dialect rules."
    )
    parser.add_argument("file", help="Path to the .toon file to validate")
    parser.add_argument(
        "--lenient",
        action="store_true",
        help="Run in lenient mode (warnings instead of errors for advisory rules)",
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

    result = validate_component(content, strict=not args.lenient)

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
                "sections":   result.stats.section_count,
                "ports":      result.stats.port_count,
                "params":     result.stats.param_count,
                "warnings":   result.stats.warning_count,
                "tags":       result.stats.tag_count,
            },
        }, indent=2))
    else:
        print(result)
        print()
        print(f"Sections : {result.stats.section_count}")
        print(f"Ports    : {result.stats.port_count}")
        print(f"Params   : {result.stats.param_count}")
        print(f"Warnings : {result.stats.warning_count}")
        print(f"Tags     : {result.stats.tag_count}")

    sys.exit(0 if result.valid else 1)


if __name__ == "__main__":
    _cli()
