import { EventEmitter } from 'events';
import { QEMURunner } from './QEMURunner';

export type PortName = 'B' | 'C' | 'D';

export interface PortValues {
  B: number;
  C: number;
  D: number;
}

export interface GPIOState {
  ports: PortValues;
  pins: Map<number, 0 | 1>;
  timestamp: number;
}

export interface PinChange {
  pin: number;
  from: 0 | 1;
  to: 0 | 1;
}

const PIN_MAP: Record<number, { port: PortName; bit: number }> = {
  // Digital pins
  0: { port: 'D', bit: 0 },
  1: { port: 'D', bit: 1 },
  2: { port: 'D', bit: 2 },
  3: { port: 'D', bit: 3 },
  4: { port: 'D', bit: 4 },
  5: { port: 'D', bit: 5 },
  6: { port: 'D', bit: 6 },
  7: { port: 'D', bit: 7 },
  8: { port: 'B', bit: 0 },
  9: { port: 'B', bit: 1 },
  10: { port: 'B', bit: 2 },
  11: { port: 'B', bit: 3 },
  12: { port: 'B', bit: 4 },
  13: { port: 'B', bit: 5 },
  // Analog pins A0-A5
  14: { port: 'C', bit: 0 },
  15: { port: 'C', bit: 1 },
  16: { port: 'C', bit: 2 },
  17: { port: 'C', bit: 3 },
  18: { port: 'C', bit: 4 },
  19: { port: 'C', bit: 5 },
};

// AVR ATmega328P I/O addresses for ports
const PORT_ADDRESSES: Record<PortName, number> = {
  B: 0x25, // PORTB
  C: 0x28, // PORTC
  D: 0x2b, // PORTD
};

export class QEMUGPIOService extends EventEmitter {
  private runner: QEMURunner;
  private pollIntervalMs: number;
  private pollHandle: NodeJS.Timeout | null = null;
  private lastState: GPIOState | null = null;

  constructor(runner: QEMURunner, pollIntervalMs: number = 50) {
    super();
    this.runner = runner;
    this.pollIntervalMs = pollIntervalMs;
  }

  private async readPortByte(address: number): Promise<number> {
    // QEMU monitor: examine 1 byte of memory at given address
    // Example response (varies by build):
    //   "0x25: 0x20"
    //   "0x00000025: 0x20 0x00"
    const cmd = `x/1b 0x${address.toString(16)}`;
    const output = await this.runner.sendMonitorCommand(cmd, 1000);

    const lines = output
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    // Prefer a line that is not just a QEMU prompt
    const valueLine =
      lines.find(l => !l.startsWith('(qemu)')) ?? lines[0] ?? '';

    if (valueLine) {
      let token: string | null = null;

      // Prefer value after ':' if present
      if (valueLine.includes(':')) {
        const afterColon = valueLine.split(':').slice(1).join(':').trim();
        token = afterColon.split(/\s+/)[0] || null;
      }

      // Fallback: last hex-like token on the line
      if (!token) {
        const hexMatches = valueLine.match(/0x[0-9a-fA-F]+/g);
        if (hexMatches && hexMatches.length > 0) {
          token = hexMatches[hexMatches.length - 1];
        }
      }

      if (token) {
        const normalized = token.toLowerCase().startsWith('0x')
          ? token.slice(2)
          : token;
        const value = parseInt(normalized, 16);
        if (!Number.isNaN(value)) {
          return value & 0xff;
        }
      }

      console.warn(
        `[QEMUGPIOService] Nao foi possivel fazer parse de byte em 0x${address.toString(
          16,
        )}. Linha: "${valueLine}"`,
      );
    } else {
      console.warn(
        `[QEMUGPIOService] Resposta vazia ao ler byte em 0x${address.toString(16)}`,
      );
    }

    return 0;
  }

  async readGPIORegisters(): Promise<PortValues> {
    // Ler PORTB, PORTC, PORTD diretamente da memoria I/O
    const [portB, portC, portD] = await Promise.all<Promise<number>>([
      this.readPortByte(PORT_ADDRESSES.B),
      this.readPortByte(PORT_ADDRESSES.C),
      this.readPortByte(PORT_ADDRESSES.D),
    ]);

    const ports: PortValues = {
      B: portB,
      C: portC,
      D: portD,
    };

    return ports;
  }

  private buildPinSnapshot(ports: PortValues): Map<number, 0 | 1> {
    const pins = new Map<number, 0 | 1>();
    for (const [pinStr, { port, bit }] of Object.entries(PIN_MAP)) {
      const pin = Number(pinStr);
      const portValue = ports[port];
      const value: 0 | 1 = (portValue & (1 << bit)) ? 1 : 0;
      pins.set(pin, value);
    }
    return pins;
  }

  private diffStates(prev: GPIOState | null, next: GPIOState): PinChange[] {
    if (!prev) {
      return [];
    }
    const changes: PinChange[] = [];
    for (const [pin, value] of next.pins.entries()) {
      const prevValue = prev.pins.get(pin) ?? 0;
      if (prevValue !== value) {
        changes.push({ pin, from: prevValue, to: value });
      }
    }
    return changes;
  }

  private async pollOnce(): Promise<void> {
    const ports = await this.readGPIORegisters();
    const pins = this.buildPinSnapshot(ports);

    const next: GPIOState = {
      ports,
      pins,
      timestamp: Date.now(),
    };

    const changes = this.diffStates(this.lastState, next);
    this.lastState = next;

    this.emit('gpio-snapshot', next);
    if (changes.length > 0) {
      this.emit('gpio-changes', changes);
    }
  }

  startPolling(): void {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => {
      if (!this.runner.running || !this.runner.isMonitorConnected) {
        return;
      }
      this.pollOnce().catch(err => {
        console.error('[QEMUGPIOService] Erro no polling de GPIO:', err);
      });
    }, this.pollIntervalMs);
  }

  stopPolling(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.lastState = null;
  }

  getLastState(): GPIOState | null {
    return this.lastState;
  }

  getPinState(pin: number): 0 | 1 {
    if (!this.lastState) {
      return 0;
    }
    return (this.lastState.pins.get(pin) ?? 0) as 0 | 1;
  }
}
