import { EventEmitter } from 'events';

export interface PinStateUpdate {
    pin: number;
    value: number;
    mode?: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP';
}

/**
 * Parses Serial-encoded GPIO frames from QEMU output
 * Protocol v1.0: G:pin=13,v=1
 */
export class SerialGPIOParser extends EventEmitter {
    private static readonly GPIO_REGEX = /G:.*?pin=(\d+),v=([01])/;
    private static readonly MODE_REGEX = /M:.*?pin=(\d+),m=([0-2])/;

    /**
     * Processes a line of serial output
     * If it matches a GPIO frame, emits 'pin-change'
     */
    processLine(line: string): boolean {
        // 1. Detect Value Changes (G:pin=13,v=1)
        const gMatch = line.match(SerialGPIOParser.GPIO_REGEX);
        if (gMatch) {
            const pin = parseInt(gMatch[1], 10);
            const value = parseInt(gMatch[2], 10);

            this.emit('pin-change', {
                pin,
                value,
                // mode: 'OUTPUT' // Keep current mode if known, otherwise default to OUTPUT
            } as PinStateUpdate);

            return true;
        }

        // 2. Detect Mode Changes (M:pin=13,m=1)
        const mMatch = line.match(SerialGPIOParser.MODE_REGEX);
        if (mMatch) {
            const pin = parseInt(mMatch[1], 10);
            const m = parseInt(mMatch[2], 10);

            // Mapping: 0=INPUT, 1=OUTPUT, 2=INPUT_PULLUP
            const modes: ('INPUT' | 'OUTPUT' | 'INPUT_PULLUP')[] = ['INPUT', 'OUTPUT', 'INPUT_PULLUP'];
            const mode = modes[m] || 'OUTPUT';

            this.emit('pin-change', {
                pin,
                mode
            } as PinStateUpdate);

            return true;
        }

        return false;
    }
}
