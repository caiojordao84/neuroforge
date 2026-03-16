// src/engine/asl/plugins/c/shims/index.ts

import type { ShimDefinition } from '../../core/ShimManager';
import { eeprom_shim } from './memory/eeprom_shim';
import { keypad_shim } from './input/keypad_shim';
import { liquid_crystal_i2c_shim } from './display/liquid_crystal_i2c_shim';
import { servo_shim } from './actuator/servo_shim';

/**
 * Array containing all default C/C++ shims.
 * In C/C++, shims usually translate to an early `#include <Library.h>` and potential global initialization structs.
 */
export const cShims: ShimDefinition[] = [
    eeprom_shim,
    keypad_shim,
    liquid_crystal_i2c_shim,
    servo_shim,
];

export * from './memory/eeprom_shim';
export * from './input/keypad_shim';
export * from './display/liquid_crystal_i2c_shim';
export * from './actuator/servo_shim';
