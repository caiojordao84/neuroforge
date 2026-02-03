import { EventEmitter } from 'events';
import { QEMURunner } from './QEMURunner';
import type { GPIOState, PinChange, PortName, PortValues } from './QEMUGPIOService';

// Mesmo mapeamento de pins utilizado pelo QEMUGPIOService
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

const GPIO_FRAME_REGEX = /^G:(.+)$/;
const PORT_PATTERN = /([BCD])=0x([0-9a-fA-F]{2})/g;
const PIN_PATTERN = /pin=(\d+),v=([01])/g;

type ParsedUpdate = {
  ports: Partial<Record<PortName, number>>;
  pins: Record<number, 0 | 1>;
};

function parseGPIOFrame(line: string): ParsedUpdate | null {
  const match = line.match(GPIO_FRAME_REGEX);
  if (!match) return null;

  const payload = match[1];
  const ports: Partial<Record<PortName, number>> = {};
  const pins: Record<number, 0 | 1> = {};

  for (const m of payload.matchAll(PORT_PATTERN)) {
    const [, port, hex] = m;
    const value = parseInt(hex, 16);
    if (!Number.isNaN(value)) {
      ports[port as PortName] = value & 0xff;
    }
  }

  for (const m of payload.matchAll(PIN_PATTERN)) {
    const [, pinStr, vStr] = m;
    const pin = parseInt(pinStr, 10);
    const v = parseInt(vStr, 10) as 0 | 1;
    if (!Number.isNaN(pin)) {
      pins[pin] = v;
    }
  }

  if (Object.keys(ports).length === 0 && Object.keys(pins).length === 0) {
    return null;
  }

  return { ports, pins };
}

export class SerialGPIOService extends EventEmitter {
  private runner: QEMURunner;
  private lastState: GPIOState | null = null;

  constructor(runner: QEMURunner) {
    super();
    this.runner = runner;
  }

  /**
   * Processa uma linha vinda da Serial do firmware.
   * Se for um frame GPIO ("G:..."), atualiza o estado e emite eventos.
   */
  processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    const update = parseGPIOFrame(trimmed);
    if (!update) return;

    this.applyUpdate(update);
  }

  private applyUpdate(update: ParsedUpdate): void {
    const prev = this.lastState;
    const ports: PortValues = prev
      ? { ...prev.ports }
      : { B: 0, C: 0, D: 0 };
    const pins: Map<number, 0 | 1> = prev
      ? new Map(prev.pins)
      : new Map<number, 0 | 1>();

    // 1) Atualiza ports completos (ex: G:B=0xFF)
    for (const [portKey, value] of Object.entries(update.ports)) {
      const port = portKey as PortName;
      if (value == null) continue;
      const v = value & 0xff;
      ports[port] = v;

      // Recalcula todos os pinos mapeados para este port
      for (const [pinStr, mapping] of Object.entries(PIN_MAP)) {
        const pin = Number(pinStr);
        if (mapping.port !== port) continue;
        const bitMask = 1 << mapping.bit;
        const bitValue: 0 | 1 = (v & bitMask) ? 1 : 0;
        pins.set(pin, bitValue);
      }
    }

    // 2) Atualiza pinos individuais (ex: G:pin=13,v=1)
    for (const [pinStr, v] of Object.entries(update.pins)) {
      const pin = Number(pinStr);
      const value = v as 0 | 1;
      pins.set(pin, value);

      // Mantem ports consistentes com o pin
      const mapping = PIN_MAP[pin];
      if (mapping) {
        const { port, bit } = mapping;
        const mask = 1 << bit;
        if (value === 1) {
          ports[port] |= mask;
        } else {
          ports[port] &= ~mask;
        }
      }
    }

    const next: GPIOState = {
      ports,
      pins,
      timestamp: Date.now(),
    };

    const changes = this.diffStates(prev, next);
    this.lastState = next;

    this.emit('gpio-snapshot', next);
    if (changes.length > 0) {
      this.emit('gpio-changes', changes);
    }
  }

  private diffStates(prev: GPIOState | null, next: GPIOState): PinChange[] {
    // Se nao havia estado anterior, consideramos que todos os pinos
    // com valor diferente de 0 mudaram de 0 -> valor_atual.
    if (!prev) {
      const initialChanges: PinChange[] = [];
      next.pins.forEach((value, pin) => {
        const to = (value ?? 0) as 0 | 1;
        if (to !== 0) {
          initialChanges.push({ pin, from: 0, to });
        }
      });
      return initialChanges;
    }

    const changes: PinChange[] = [];
    const allPins = new Set<number>();
    prev.pins.forEach((_v, pin) => allPins.add(pin));
    next.pins.forEach((_v, pin) => allPins.add(pin));

    for (const pin of allPins) {
      const before = (prev.pins.get(pin) ?? 0) as 0 | 1;
      const after = (next.pins.get(pin) ?? 0) as 0 | 1;
      if (before !== after) {
        changes.push({ pin, from: before, to: after });
      }
    }

    return changes;
  }

  startPolling(): void {
    // Nao ha polling aqui; os updates sao dirigidos por eventos de Serial.
  }

  stopPolling(): void {
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
