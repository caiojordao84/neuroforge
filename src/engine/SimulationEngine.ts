import { useSimulationStore } from '@/stores/useSimulationStore';
import { useSerialStore } from '@/stores/useSerialStore';
import type { PinState, PinMode } from '@/types';

// Event emitter for pin changes
type EventCallback = (data: unknown) => void;

class EventEmitter {
  private listeners: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  emit(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// Simulation Engine - Core Class
export class SimulationEngine extends EventEmitter {
  private isRunning = false;
  private isPaused = false;
  private loopIntervalId: number | null = null;
  private timeoutIds: number[] = [];
  private setupExecuted = false;
  private loopFunction: (() => void) | null = null;
  private speedMultiplier = 1;
  private pinCache: Map<number, PinState> = new Map();

  constructor() {
    super();
  }

  start(setupFn: () => void, loopFn: () => void, speed = 1): void {
    if (this.isRunning) {
      this.stop();
    }

    this.speedMultiplier = speed;
    this.isRunning = true;
    this.isPaused = false;
    this.setupExecuted = false;
    this.loopFunction = loopFn;

    const simulationStore = useSimulationStore.getState();
    const serialStore = useSerialStore.getState();

    simulationStore.startSimulation();
    serialStore.addTerminalLine('▶️ Simulation started', 'success');

    try {
      setupFn();
      this.setupExecuted = true;
    } catch (error) {
      serialStore.addTerminalLine(
        `❌ Setup error: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
      this.stop();
      return;
    }

    this.runLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.setupExecuted = false;
    this.loopFunction = null;

    this.timeoutIds.forEach((id) => clearTimeout(id));
    this.timeoutIds = [];

    if (this.loopIntervalId !== null) {
      clearTimeout(this.loopIntervalId);
      this.loopIntervalId = null;
    }

    const simulationStore = useSimulationStore.getState();
    const serialStore = useSerialStore.getState();

    simulationStore.stopSimulation();
    serialStore.addTerminalLine('⏹️ Simulation stopped', 'info');

    this.removeAllListeners();
    this.pinCache.clear();
  }

  pause(): void {
    if (!this.isRunning) return;

    this.isPaused = true;

    const simulationStore = useSimulationStore.getState();
    const serialStore = useSerialStore.getState();

    simulationStore.pauseSimulation();
    serialStore.addTerminalLine('⏸️ Simulation paused', 'warning');
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;

    this.isPaused = false;

    const simulationStore = useSimulationStore.getState();
    const serialStore = useSerialStore.getState();

    simulationStore.startSimulation();
    serialStore.addTerminalLine('▶️ Simulation resumed', 'success');

    this.runLoop();
  }

  reset(): void {
    this.stop();

    const simulationStore = useSimulationStore.getState();
    const serialStore = useSerialStore.getState();

    simulationStore.resetSimulation();
    serialStore.addTerminalLine('🔄 Simulation reset', 'info');
  }

  setSpeed(speed: number): void {
    this.speedMultiplier = speed;

    const serialStore = useSerialStore.getState();
    serialStore.addTerminalLine(`⚡ Simulation speed: ${speed}x`, 'info');
  }

  private runLoop(): void {
    if (!this.isRunning || this.isPaused || !this.loopFunction) {
      return;
    }

    try {
      this.loopFunction();
    } catch (error) {
      const serialStore = useSerialStore.getState();
      serialStore.addTerminalLine(
        `❌ Loop error: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
      this.stop();
      return;
    }

    this.loopIntervalId = window.setTimeout(() => {
      this.runLoop();
    }, 0);
  }

  pinMode(pin: number, mode: PinMode): void {
    const simulationStore = useSimulationStore.getState();
    simulationStore.setPinMode(pin, mode);

    const pinState = simulationStore.getPinState(pin);
    if (pinState) {
      this.pinCache.set(pin, pinState);
    }

    this.emit('pinMode', { pin, mode });
  }

  digitalWrite(pin: number, value: 'HIGH' | 'LOW'): void {
    const simulationStore = useSimulationStore.getState();
    const pinState = simulationStore.getPinState(pin);

    if (!pinState) {
      const serialStore = useSerialStore.getState();
      serialStore.addTerminalLine(
        `⚠️ Warning: Pin ${pin} mode not set. Call pinMode(${pin}, OUTPUT) first.`,
        'warning'
      );
      return;
    }

    if (pinState.mode !== 'OUTPUT') {
      const serialStore = useSerialStore.getState();
      serialStore.addTerminalLine(
        `⚠️ Warning: Pin ${pin} is not in OUTPUT mode`,
        'warning'
      );
      return;
    }

    simulationStore.digitalWrite(pin, value);

    const updatedPinState = simulationStore.getPinState(pin);
    if (updatedPinState) {
      this.pinCache.set(pin, updatedPinState);
    }

    this.emit('pinChange', { pin, value });
  }

  digitalRead(pin: number): 'HIGH' | 'LOW' {
    const simulationStore = useSimulationStore.getState();
    return simulationStore.digitalRead(pin);
  }

  analogWrite(pin: number, value: number): void {
    const simulationStore = useSimulationStore.getState();
    const pinState = simulationStore.getPinState(pin);

    if (!pinState) {
      const serialStore = useSerialStore.getState();
      serialStore.addTerminalLine(
        `⚠️ Warning: Pin ${pin} mode not set. Call pinMode(${pin}, OUTPUT) first.`,
        'warning'
      );
      return;
    }

    if (pinState.mode !== 'OUTPUT') {
      const serialStore = useSerialStore.getState();
      serialStore.addTerminalLine(
        `⚠️ Warning: Pin ${pin} is not in OUTPUT mode`,
        'warning'
      );
      return;
    }

    simulationStore.analogWrite(pin, value);

    const updatedPinState = simulationStore.getPinState(pin);
    if (updatedPinState) {
      this.pinCache.set(pin, updatedPinState);
    }

    this.emit('pinChange', { pin, value });
  }

  analogRead(pin: number): number {
    const simulationStore = useSimulationStore.getState();
    return simulationStore.analogRead(pin);
  }

  getPinState(pin: number): PinState | undefined {
    if (this.pinCache.has(pin)) {
      return this.pinCache.get(pin);
    }

    const simulationStore = useSimulationStore.getState();
    return simulationStore.getPinState(pin);
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const adjustedMs = Math.round(ms / this.speedMultiplier);
      const timeoutId = window.setTimeout(() => {
        const index = this.timeoutIds.indexOf(timeoutId);
        if (index > -1) {
          this.timeoutIds.splice(index, 1);
        }
        resolve();
      }, adjustedMs);

      this.timeoutIds.push(timeoutId);
    });
  }

  delayMicroseconds(): void {
    // Microsecond delays are essentially instant in simulation
  }

  millis(): number {
    return Date.now();
  }

  micros(): number {
    return Date.now() * 1000;
  }

  serialBegin(baudRate: number): void {
    const serialStore = useSerialStore.getState();
    serialStore.setBaudRate(baudRate);
    serialStore.addTerminalLine(`🔌 Serial initialized at ${baudRate} baud`, 'info');
  }

  serialPrint(text: string): void {
    const serialStore = useSerialStore.getState();
    serialStore.serialPrint(text);
  }

  serialPrintln(text: string): void {
    const serialStore = useSerialStore.getState();
    serialStore.serialPrintln(text);
  }

  serialAvailable(): number {
    return 0;
  }

  serialRead(): number {
    return -1;
  }

  tone(pin: number, frequency: number, duration?: number): void {
    this.emit('tone', { pin, frequency, duration });
  }

  noTone(pin: number): void {
    this.emit('noTone', { pin });
  }

  map(value: number, fromLow: number, fromHigh: number, toLow: number, toHigh: number): number {
    return Math.round(
      ((value - fromLow) * (toHigh - toLow)) / (fromHigh - fromLow) + toLow
    );
  }

  constrain(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  random(min?: number, max?: number): number {
    if (min === undefined) {
      return Math.random();
    }
    if (max === undefined) {
      return Math.floor(Math.random() * min);
    }
    return Math.floor(Math.random() * (max - min) + min);
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getSetupExecuted(): boolean {
    return this.setupExecuted;
  }
}

// Singleton instance
export const simulationEngine = new SimulationEngine();

// Hook for React components
export function useSimulationEngine(): SimulationEngine {
  return simulationEngine;
}
