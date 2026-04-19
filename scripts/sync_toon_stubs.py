import os
import re

def parse_md_tables(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    boards = []
    current_category = "maker"
    current_family = "generic-mcu"

    for line in lines:
        line = line.strip()
        if not line: continue

        if '🟦' in line or 'MCU' in line: current_category = "maker"
        if '🟩' in line or 'PLC' in line: current_category = "industrial"
        if 'PLC' in line.upper(): current_family = "plc-family"
        if 'Arduino' in line: current_family = "avr-family"
        if 'ESP32' in line: current_family = "esp32-family"
        if 'Pico' in line: current_family = "rp2040-family"

        if line.startswith('|') and 'Placa' not in line and '---' not in line:
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 6:
                name = parts[1]
                chip = parts[2]
                flash = parts[3]
                ram = parts[4]
                clock = parts[5]
                
                clean_id = name.lower().strip()
                clean_id = re.sub(r'[^a-z0-9]+', '-', clean_id).strip('-')
                
                boards.append({
                    "id": clean_id,
                    "name": name,
                    "mcu": chip,
                    "flash": flash,
                    "ram": ram,
                    "clock": clock,
                    "category": current_category,
                    "family": current_family
                })
    return boards

def clean_value(val):
    num = re.findall(r'\d+', val)
    if not num: return 0
    mult = 1
    if 'KB' in val.upper(): mult = 1024
    if 'MB' in val.upper(): mult = 1024 * 1024
    if 'GB' in val.upper(): mult = 1024 * 1024 * 1024
    if 'MHz' in val: mult = 1000000
    if 'GHz' in val: mult = 1000000000
    return int(num[0]) * mult

def generate_toon(board, output_dir):
    flash = clean_value(board['flash'])
    ram = clean_value(board['ram'])
    clock = clean_value(board['clock'])
    mcu = board['mcu']
    category = board['category']
    family = board['family']

    lines = [
        f"id: {board['id']}",
        f"name: \"{board['name']}\"",
        "manufacturer: \"Generic\"",
        f"mcu: \"{mcu}\"",
        f"category: \"{category}\"",
        f"image: \"/boards/{board['id']}.svg\"",
        "bootloader: \"serial\"",
        "languages: [2]: \"rust\",\"arduino-cpp\"",
        f"flashMemory: {flash}",
        f"sram: {ram}",
        f"clock_hz: {clock}",
        "voltage_mv: 3300",
        "neuroforge:",
        f"  boardFamilySkillId: \"{family}\"",
        f"  boardProfileId: \"{board['id']}\"",
        "peripherals:",
        "  serial:",
        "    uarts: 1",
        "    pins: [2]: 0,1",
        "  i2c:",
        "    channels: 1",
        "    sda: 2",
        "    scl: 3",
        "  spi:",
        "    channels: 1",
        "    mosi: 11",
        "    miso: 12",
        "    sck: 13",
        "    ss: 10",
        "gpio: [8]{pin,label,type,pwm,adc,interrupt}:",
        "  0,D0,digital,true,false,true",
        "  1,D1,digital,true,false,true",
        "  2,D2,digital,false,false,true",
        "  3,D3,digital,false,false,true",
        "  4,D4,digital,false,false,false",
        "  5,D5,digital,true,false,false",
        "  6,D6,digital,true,false,false",
        "  14,A0,analog,false,true,false",
        ""
    ]
    
    with open(os.path.join(output_dir, f"{board['id']}.toon"), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lines))

def main():
    md_path = "docs/tabelas_MCU_PLC.md"
    output_dir = "apps/shared/static/boards"
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    boards = parse_md_tables(md_path)
    print(f"Found {len(boards)} boards. Generating optimized native TOON stubs...")
    
    for b in boards:
        generate_toon(b, output_dir)
    
    print("Generation complete.")

if __name__ == "__main__":
    main()