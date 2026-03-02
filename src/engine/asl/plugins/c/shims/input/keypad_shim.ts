// src/engine/asl/plugins/c/shims/input/keypad_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const keypad_shim: ShimDefinition = {
    name: 'Keypad',
    description: 'Injeta a importação da biblioteca Keypad',
    code: `#include <Keypad.h>`
};
