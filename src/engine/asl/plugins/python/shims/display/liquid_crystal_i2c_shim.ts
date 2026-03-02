// src/engine/asl/plugins/python/shims/display/liquid_crystal_i2c_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const liquid_crystal_i2c_shim: ShimDefinition = {
    name: 'LiquidCrystal_I2C',
    description: 'Implementação do Display LCD I2C para MicroPython',
    code: `
# --- ASL SHIM: LiquidCrystal_I2C ---
class LiquidCrystal_I2C:
    def __init__(self, addr, cols, rows):
        self.addr = addr
        self.cols = cols
        self.rows = rows
        self.cursor_col = 0
        self.cursor_row = 0
        self._backlight = True
        
    def init(self):
        self.begin()
        
    def begin(self):
        # In simulation mode, we just track the state
        self.clear()
        
    def clear(self):
        self.cursor_col = 0
        self.cursor_row = 0
        
    def setCursor(self, col, row):
        self.cursor_col = col
        self.cursor_row = row
        
    def print(self, text):
        # Na engine de simulação os buffers estao isolados, o shim só simula chamadas vazias 
        # para nao quebrar AST python gerada do ASL caso n tenha hook C++.
        pass
        
    def backlight(self):
        self._backlight = True
        
    def noBacklight(self):
        self._backlight = False
        
    def blink(self):
        pass
        
    def noBlink(self):
        pass

    def cursor(self):
        pass

    def noCursor(self):
        pass
# --------------------------------------------
`
};
