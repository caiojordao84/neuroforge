// src/engine/asl/plugins/python/shims/index.ts

import type { ShimDefinition } from '../../core/ShimManager';
import { sevseg_shim } from './display/sevseg_shim';
import { liquid_crystal_i2c_shim } from './display/liquid_crystal_i2c_shim';
import { keypad_shim } from './input/keypad_shim';
import { eeprom_shim } from './memory/eeprom_shim';

/**
 * Array containing all default Python shims.
 * These are registered with the ShimManager when the PythonGenerator is instantiated.
 */
export const pythonShims: ShimDefinition[] = [
    sevseg_shim,
    liquid_crystal_i2c_shim,
    keypad_shim,
    eeprom_shim,
];

// Re-export individually if needed
export * from './display/sevseg_shim';
export * from './display/liquid_crystal_i2c_shim';
export * from './input/keypad_shim';
export * from './memory/eeprom_shim';
