#!/usr/bin/env python3
"""
resistor_color_code.py
Lookup-table engine for resistor-color-code TOON component (IEC 60062).
Supports 4-band, 5-band and 6-band resistors.

Usage:
    from resistor_color_code import decode, encode, color_hex

    # Decode bands -> resistance, tolerance, tcr
    result = decode(["brown", "black", "red", "gold"])
    print(result)
    # {'resistance': 1000.0, 'tolerance_pct': 5.0, 'tcr_ppm_C': None, 'bands': 4}

    # Encode resistance -> nearest band colors
    bands = encode(4700, bands=4, tolerance="gold")
    print(bands)
    # ['yellow', 'violet', 'red', 'gold']

    # Get HTML hex color for a band name
    print(color_hex("gold"))  # '#FFD700'
"""

from __future__ import annotations
from typing import Optional

# ── IEC 60062 lookup tables ───────────────────────────────────────────────────

# Significant digit value per color
DIGIT: dict[str, Optional[int]] = {
    "black":  0,
    "brown":  1,
    "red":    2,
    "orange": 3,
    "yellow": 4,
    "green":  5,
    "blue":   6,
    "violet": 7,
    "grey":   8,
    "white":  9,
    "gold":   None,
    "silver": None,
}

# Multiplier value per color
MULTIPLIER: dict[str, float] = {
    "black":  1,
    "brown":  10,
    "red":    100,
    "orange": 1_000,
    "yellow": 10_000,
    "green":  100_000,
    "blue":   1_000_000,
    "violet": 10_000_000,
    "grey":   100_000_000,
    "white":  1_000_000_000,
    "gold":   0.1,
    "silver": 0.01,
}

# Tolerance % per color
TOLERANCE: dict[str, float] = {
    "brown":  1.0,
    "red":    2.0,
    "green":  0.5,
    "blue":   0.25,
    "violet": 0.1,
    "grey":   0.05,
    "gold":   5.0,
    "silver": 10.0,
}

# TCR ppm/°C per color (6-band only, IEC 60062 Table 3)
TCR: dict[str, int] = {
    "black":  250,
    "brown":  100,
    "red":    50,
    "orange": 15,
    "yellow": 25,
    "green":  20,
    "blue":   10,
    "violet": 5,
    "grey":   1,
    "white":  None,
}

# HTML hex colors for canvas rendering
COLOR_HEX: dict[str, str] = {
    "black":  "#1A1A1A",
    "brown":  "#8B4513",
    "red":    "#CC0000",
    "orange": "#FF8C00",
    "yellow": "#FFD700",
    "green":  "#228B22",
    "blue":   "#1E5DC8",
    "violet": "#8A2BE2",
    "grey":   "#808080",
    "white":  "#F5F5F5",
    "gold":   "#FFD700",
    "silver": "#C0C0C0",
}

# Reverse map: digit pair -> color name
_DIGIT_TO_COLOR = {v: k for k, v in DIGIT.items() if v is not None}

# ── Public API ────────────────────────────────────────────────────────────────

def color_hex(color: str) -> str:
    """Return the HTML hex string for a band color name."""
    c = color.lower().strip()
    if c not in COLOR_HEX:
        raise ValueError(f"Unknown color: {color!r}")
    return COLOR_HEX[c]


def decode(bands: list[str]) -> dict:
    """
    Decode a resistor band list into resistance, tolerance and TCR.

    Parameters
    ----------
    bands : list of color name strings, length 4, 5 or 6.

    Returns
    -------
    dict with keys:
        resistance   : float  (Ohms)
        tolerance_pct: float  (%)
        tcr_ppm_C    : int | None  (ppm/°C, only for 6-band)
        bands        : int    (number of bands)
    """
    n = len(bands)
    if n not in (4, 5, 6):
        raise ValueError(f"Expected 4, 5 or 6 bands, got {n}")

    bands = [b.lower().strip() for b in bands]

    if n == 4:
        d1, d2, mult_color, tol_color = bands
        digits = [DIGIT[d1], DIGIT[d2]]
        mult   = MULTIPLIER[mult_color]
        tol    = TOLERANCE.get(tol_color)
        tcr    = None
    elif n == 5:
        d1, d2, d3, mult_color, tol_color = bands
        digits = [DIGIT[d1], DIGIT[d2], DIGIT[d3]]
        mult   = MULTIPLIER[mult_color]
        tol    = TOLERANCE.get(tol_color)
        tcr    = None
    else:  # 6-band
        d1, d2, d3, mult_color, tol_color, tcr_color = bands
        digits = [DIGIT[d1], DIGIT[d2], DIGIT[d3]]
        mult   = MULTIPLIER[mult_color]
        tol    = TOLERANCE.get(tol_color)
        tcr    = TCR.get(tcr_color)

    if any(d is None for d in digits):
        raise ValueError("Significant digit bands cannot be gold or silver")

    base = int("".join(str(d) for d in digits))
    resistance = base * mult

    return {
        "resistance":    resistance,
        "tolerance_pct": tol,
        "tcr_ppm_C":     tcr,
        "bands":         n,
    }


def encode(resistance: float, bands: int = 4, tolerance: str = "gold") -> list[str]:
    """
    Encode a resistance value into the nearest standard band colors.

    Parameters
    ----------
    resistance : float  target resistance in Ohms
    bands      : int    4 or 5 (6-band TCR cannot be auto-selected)
    tolerance  : str    tolerance band color name (default "gold" = 5%)

    Returns
    -------
    list of color name strings (length = bands, TCR band omitted for 6-band input)
    """
    if bands not in (4, 5):
        raise ValueError("encode() supports 4 or 5 bands only (TCR band must be set manually)")
    if tolerance not in TOLERANCE:
        raise ValueError(f"Invalid tolerance color: {tolerance!r}")

    sig_digits = bands - 2  # 2 for 4-band, 3 for 5-band

    # Find the multiplier that keeps significant digits in range
    best: Optional[tuple] = None
    for mult_color, mult_val in MULTIPLIER.items():
        if mult_val == 0:
            continue
        base = resistance / mult_val
        lo = 10 ** (sig_digits - 1)
        hi = 10 ** sig_digits
        if lo <= base < hi:
            rounded = round(base)
            s = str(rounded).zfill(sig_digits)
            if len(s) == sig_digits and all(c.isdigit() for c in s):
                digit_colors = [_DIGIT_TO_COLOR[int(c)] for c in s]
                error = abs(rounded * mult_val - resistance) / resistance
                if best is None or error < best[0]:
                    best = (error, digit_colors, mult_color)

    if best is None:
        raise ValueError(f"Cannot encode {resistance}Ω into {bands} bands")

    _, digit_colors, mult_color = best
    return digit_colors + [mult_color, tolerance]


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import json

    args = sys.argv[1:]

    if not args:
        print("Usage:")
        print("  python resistor_color_code.py decode <band1> <band2> ... (4/5/6 bands)")
        print("  python resistor_color_code.py encode <resistance> [bands=4] [tolerance=gold]")
        print("  python resistor_color_code.py hex <color>")
        sys.exit(0)

    cmd = args[0].lower()

    if cmd == "decode":
        result = decode(args[1:])
        print(json.dumps(result, indent=2))

    elif cmd == "encode":
        if len(args) < 2:
            print("encode requires <resistance>")
            sys.exit(1)
        r      = float(args[1])
        n      = int(args[2]) if len(args) > 2 else 4
        tol    = args[3] if len(args) > 3 else "gold"
        result = encode(r, bands=n, tolerance=tol)
        print(json.dumps({"bands": result, "hex": [color_hex(c) for c in result]}, indent=2))

    elif cmd == "hex":
        if len(args) < 2:
            print("hex requires <color>")
            sys.exit(1)
        print(color_hex(args[1]))

    else:
        print(f"Unknown command: {cmd!r}")
        sys.exit(1)
