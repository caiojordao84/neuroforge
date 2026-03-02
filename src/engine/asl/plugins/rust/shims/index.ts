// src/engine/asl/plugins/rust/shims/index.ts

import type { ShimDefinition } from '../../core/ShimManager';
import { eeprom_shim } from './memory/eeprom_shim';
import { keypad_shim } from './input/keypad_shim';
import { liquid_crystal_i2c_shim } from './display/liquid_crystal_i2c_shim';

/**
 * Array containing all default Rust shims.
 * These are registered with the ShimManager when the RustGenerator is instantiated.
 */
export const rustShims: ShimDefinition[] = [
    eeprom_shim,
    keypad_shim,
    liquid_crystal_i2c_shim
];

export * from './memory/eeprom_shim';
export * from './input/keypad_shim';
export * from './display/liquid_crystal_i2c_shim';
