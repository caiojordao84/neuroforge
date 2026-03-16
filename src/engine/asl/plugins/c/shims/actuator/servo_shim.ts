// src/engine/asl/plugins/c/shims/actuator/servo_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const servo_shim: ShimDefinition = {
    name: 'servo',
    description: 'Injeta #include <Servo.h> para uso de servos no Arduino/C++',
    code: `#include <Servo.h>`
};
