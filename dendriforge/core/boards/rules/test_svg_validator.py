#!/usr/bin/env python3
import sys
import os

# Reconfigure stdout/stderr to UTF-8 to support emojis on all platforms
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    pass
from svg_validator import validate_svg_against_toon

def test_reference_pairs():
    # Base directories relative to workspace root (we run from workspace root)
    toon_dir = r'd:\Documents\NeuroForge\dendriForge\dendriforge\core\boards'
    svg_dir = r'd:\Documents\NeuroForge\dendriForge\dendriforge\shared\src\styles'
    
    pairs = [
        (
            os.path.join(toon_dir, 'arduino-uno-r3.toon'),
            os.path.join(svg_dir, 'arduino-uno-r3.svg'),
            'Arduino Uno R3'
        ),
        (
            os.path.join(toon_dir, 'esp32-devkitc-v4.toon'),
            os.path.join(svg_dir, 'esp32-devkitc-v4.svg'),
            'ESP32 DevKitC V4'
        ),
        (
            os.path.join(toon_dir, 'siemens-s7-1200-cpu-1214c.toon'),
            os.path.join(svg_dir, 'siemens-s7-1200-cpu-1214c-corrigido.svg'),
            'Siemens S7-1200'
        )
    ]
    
    all_passed = True
    for toon_path, svg_path, label in pairs:
        print(f"\nVerifying {label}...")
        print(f"  TOON: {toon_path}")
        print(f"  SVG : {svg_path}")
        
        if not os.path.exists(toon_path):
            print(f"❌ Error: TOON file does not exist: {toon_path}")
            all_passed = False
            continue
        if not os.path.exists(svg_path):
            print(f"❌ Error: SVG file does not exist: {svg_path}")
            all_passed = False
            continue
            
        with open(toon_path, encoding='utf-8') as f:
            toon_content = f.read()
            
        result = validate_svg_against_toon(toon_content, svg_path)
        
        if result.valid:
            print(f"✅ {label} configuration matches perfectly!")
        else:
            print(f"❌ {label} alignment validation failed!")
            print(f"  Errors: {len(result.errors)}")
            for e in result.errors:
                print(f"    {e}")
            all_passed = False
            
        if result.warnings:
            print(f"  Warnings: {len(result.warnings)}")
            for w in result.warnings:
                print(f"    {w}")
                
    if all_passed:
        print("\n🎉 All 3 reference configurations validated successfully!")
        sys.exit(0)
    else:
        print("\n❌ Verification failed on one or more configurations.")
        sys.exit(1)

if __name__ == '__main__':
    test_reference_pairs()
