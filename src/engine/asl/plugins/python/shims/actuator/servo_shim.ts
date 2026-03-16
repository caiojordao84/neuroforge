// src/engine/asl/plugins/python/shims/actuator/servo_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const servo_shim: ShimDefinition = {
    name: 'servo',
    description: 'Registo do shim servo para MicroPython/CircuitPython. '
               + 'Os imports (PWM/adafruit_motor) são emitidos dinamicamente pelo PythonGenerator.',
    code: ``
};
