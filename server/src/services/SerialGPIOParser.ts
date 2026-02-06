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
    private static readonly GPIO_FRAME_REGEX = /^G:.*pin=(\d+),v=([01])/;

    /**
     * Processes a line of serial output
     * If it matches a GPIO frame, emits 'pin-change'
     */
    processLine(line: string): boolean {
        const trimmed = line.trim();
        const match = trimmed.match(SerialGPIOParser.GPIO_FRAME_REGEX);

        if (match) {
            const pin = parseInt(match[1], 10);
            const value = parseInt(match[2], 10);

            this.emit('pin-change', {
                pin,
                value,
                mode: 'OUTPUT' // Default for Serial protocol triggers
            } as PinStateUpdate);

            return true;
        }

        return false;
    }
}
