// src/engine/asl/plugins/python/shims/input/keypad_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const keypad_shim: ShimDefinition = {
    name: 'Keypad',
    description: 'Implementação de teclado matricial (Keypad) para MicroPython',
    code: `
# --- ASL SHIM: Keypad ---
import machine
import time

class Keypad:
    def __init__(self, makeKeymap, rowPins, colPins, numRows, numCols):
        self.keymap = makeKeymap
        self.rowPins = [machine.Pin(p, machine.Pin.IN, machine.Pin.PULL_UP) for p in rowPins]
        self.colPins = [machine.Pin(p, machine.Pin.OUT) for p in colPins]
        
        # Initialize colPins to HIGH
        for col in self.colPins:
            col.value(1)
            
    def getKey(self):
        key = None
        for col_idx, col in enumerate(self.colPins):
            col.value(0) # Drive column low
            time.sleep_us(10) # Settle time
            
            for row_idx, row in enumerate(self.rowPins):
                if row.value() == 0: # Key pressed
                    # Mapping matrix index to flat map array index (simplified)
                    # Actual standard lib assumes a 2D array matrix matching
                    key_idx = row_idx * len(self.colPins) + col_idx
                    if key_idx < len(self.keymap):
                        key = self.keymap[key_idx]
                    # Wait for release (blocking - simplified for shim)
                    while row.value() == 0:
                        time.sleep_ms(10)
            
            col.value(1) # Drive back high
            if key is not None:
                break
                
        return key

def makeKeymap(keys):
    # Flatten the 2D tuple/list into 1D for our simplified shim logic
    flat = []
    for row in keys:
        for char in row:
            flat.append(char)
    return flat
# --------------------------------------------
`
};
