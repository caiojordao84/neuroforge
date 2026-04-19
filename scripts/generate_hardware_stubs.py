import os
import json
import re

BOARDS_DIR = "apps/shared/static/boards"
INDEX_PATH = os.path.join(BOARDS_DIR, "boards-index.json")
TABLES_PATH = "docs/tabelas_MCU_PLC.md"

def slugify(text):
    return re.sub(r'[^a-zA-Z0-9]', '-', text.lower()).strip('-')

def get_family(placa, chip):
    placa_lower = placa.lower()
    chip_lower = chip.lower()
    
    if "avr" in chip_lower or "atmega" in chip_lower: return "avr-family"
    if "esp32" in chip_lower: return "esp32-family"
    if "esp8266" in chip_lower: return "esp8266-family"
    if "rp2040" in chip_lower or "rp2350" in chip_lower: return "rp2040-family"
    if "stm32" in chip_lower: return "stm32-family"
    if "samd" in chip_lower: return "samd-family"
    if "pic" in chip_lower: return "pic-family"
    if "msp430" in chip_lower: return "msp430-family"
    if "lpc" in chip_lower: return "lpc-family"
    if "s7-" in placa_lower or "siemens" in placa_lower: return "s7-family"
    if "beckhoff" in placa_lower or "codesys" in placa_lower or "twincat" in placa_lower: return "ipc-family"
    
    return "generic-mcu"

def generate_toon(name, chip, flash, ram, clock, family):
    board_id = slugify(name)
    
    # Corrected TOON v3.0 template (Root-level fields to match BoardProfile struct)
    toon = f"""# NeuroForge Hardware Definition: {name} (STUB)
# Generated from {TABLES_PATH}

id: {board_id}
name: {name}
manufacturer: Generic
category: {"industrial" if family in ["s7-family", "ipc-family"] else "maker"}
mcu: {chip}
architecture: {get_arch(chip)}
flashBytes: {parse_size(flash)}
ramBytes: {parse_size(ram)}
clockHz: {parse_freq(clock)}

aslProfile:
  targets:
    | language    | targetId | agentSkill |
    | arduino-cpp | {board_id}-cpp | languages/{family}.md |

# Minimum GPIO stub for visualization
gpio:
  | pin | label | pwm | adc | interrupt | type    |
  | 0   | D0    | false | false| false     | digital |
  | 1   | D1    | false | false| false     | digital |
"""
    return board_id, toon

def get_arch(chip):
    c = chip.lower()
    if "atmega" in c: return "avr"
    if "esp32" in c: return "xtensa"
    if "rp2040" in c: return "arm-cortex-m0+"
    if "stm32" in c: return "arm-cortex-m"
    return "unknown"

def parse_size(size_str):
    if not size_str or size_str == "—": return 0
    size_str = size_str.lower().replace(" ", "")
    m = re.match(r'(\d+)(kb|mb|gb|b)', size_str)
    if m:
        val = int(m.group(1))
        unit = m.group(2)
        if unit == "kb": return val * 1024
        if unit == "mb": return val * 1024 * 1024
        if unit == "gb": return val * 1024 * 1024 * 1024
    return 0

def parse_freq(freq_str):
    if not freq_str or freq_str == "—": return 0
    freq_str = freq_str.lower().replace(" ", "")
    m = re.match(r'(\d+)(mhz|ghz|hz)', freq_str)
    if m:
        val = int(m.group(1))
        unit = m.group(2)
        if unit == "mhz": return val * 1000000
        if unit == "ghz": return val * 1000000000
    return 0

def run():
    with open(TABLES_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Extract all tables
    # Format: | Placa | Chip | ... |
    tables = re.findall(r'\| Placa \| Chip \|.*?\|\s*(.*?)\n\n', content, re.DOTALL)
    # Also for PLC table title
    tables += re.findall(r'\| PLC \| Fabricante \|.*?\|\s*(.*?)\n\n', content, re.DOTALL)
    
    boards_data = []
    
    # Read existing index
    with open(INDEX_PATH, "r") as f:
        index_data = json.load(f)
    
    existing_ids = {b['id'] for b in index_data['boards']}
    
    for table in tables:
        rows = table.strip().split('\n')
        for row in rows:
            if row.startswith('|---'): continue
            cols = [c.strip() for c in row.split('|') if c.strip()]
            if len(cols) < 5: continue
            
            name = cols[0]
            chip = cols[1]
            flash = cols[2]
            ram = cols[3]
            clock = cols[4]
            
            board_id, toon_content = generate_toon(name, chip, flash, ram, clock, get_family(name, chip))
            
            # Write TOON file (ALWAYS overwrite to apply new schema)
            with open(os.path.join(BOARDS_DIR, f"{board_id}.toon"), "w", encoding="utf-8") as bf:
                bf.write(toon_content)
            
            # Update index entry if exists, otherwise append
            existing_entry = next((b for b in index_data['boards'] if b['id'] == board_id), None)
            
            new_entry = {
                "id": board_id,
                "name": name,
                "path": f"/boards/{board_id}.toon",
                "family": get_family(name, chip),
                "boardProfileId": board_id,
                "category": "industrial" if get_family(name, chip) in ["s7-family", "ipc-family"] else "maker"
            }
            
            if existing_entry:
                existing_entry.update(new_entry)
                print(f"Updated: {name}")
            else:
                index_data['boards'].append(new_entry)
                print(f"Generated: {name}")
            
            existing_ids.add(board_id)

    # Write updated index
    with open(INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2)

if __name__ == "__main__":
    run()
