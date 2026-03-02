// src/engine/asl/plugins/c/shims/display/liquid_crystal_i2c_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const liquid_crystal_i2c_shim: ShimDefinition = {
    name: 'LiquidCrystal_I2C',
    description: 'Injeta a importação da biblioteca LiquidCrystal_I2C',
    code: `#include <LiquidCrystal_I2C.h>`
};
