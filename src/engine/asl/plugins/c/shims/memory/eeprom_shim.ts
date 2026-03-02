// src/engine/asl/plugins/c/shims/memory/eeprom_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const eeprom_shim: ShimDefinition = {
    name: 'EEPROM',
    description: 'Injeta a importação da biblioteca EEPROM padrão do Arduino',
    code: `#include <EEPROM.h>`
};
