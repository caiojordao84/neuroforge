import { EventEmitter } from 'events';
import { QEMURunner } from './QEMURunner';
import type { BoardType } from './CompilerService';

export interface PinState {
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'UNKNOWN';
  value: number; // 0 or 1 for digital, 0-1023 for analog
}

/**
 * High-level API for QEMU simulation
 */
export class QEMUSimulationEngine extends EventEmitter {
  private runner: QEMURunner;
  private pinStates: Map<number, PinState>;
  private serialBuffer: string[];
  private pollInterval: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _isPaused = false;

  constructor() {
    super();
    this.runner = new QEMURunner();
    this.pinStates = new Map();
    this.serialBuffer = [];
    this.setupRunnerEvents();
  }

  /**
   * Load firmware into QEMU
   */
  async loadFirmware(firmwarePath: string, board: BoardType = 'arduino-uno'): Promise<void> {
    this.emit('firmware-loaded', firmwarePath, board);
  }

  /**
   * Start QEMU simulation
   */
  async start(): Promise<void> {
    try {
      await this.runner.start();
      this._isRunning = true;
      this._isPaused = false;
      this.startPinPolling();
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  /**
   * Setup event forwarding from QEMURunner
   */
  private setupRunnerEvents(): void {
    // Forward serial output
    this.runner.on('serial', (line: string) => {
      this.serialBuffer.push(line);
      this.emit('serial', line);
    });

    // Forward started event
    this.runner.on('started', () => {
      this._isRunning = true;
      this.emit('started');
    });

    // Forward stopped event
    this.runner.on('stopped', () => {
      this._isRunning = false;
      this.emit('stopped');
    });
  }

  /**
   * Stop QEMU simulation
   */
  stop(): void {
    this.stopPinPolling();
    this.runner.stop();
    this._isRunning = false;
    this._isPaused = false;
  }

  /**
   * Pause simulation
   */
  pause(): void {
    this.stopPinPolling();
    this._isPaused = true;
    this.emit('paused');
  }

  /**
   * Resume simulation
   */
  resume(): void {
    this.startPinPolling();
    this._isPaused = false;
    this.emit('resumed');
  }

  /**
   * Get pin state
   */
  getPinState(pin: number): PinState {
    return this.pinStates.get(pin) || {
      mode: 'UNKNOWN',
      value: 0
    };
  }

  /**
   * Set pin state (simulate input, e.g. button press)
   */
  async setPinState(pin: number, value: number): Promise<void> {
    // Simulate external input to QEMU
    const port = this.pinToPort(pin);
    const pinBit = pin % 8;
    await this.runner.writeGPIO(port, pinBit, value);
    
    // Update local cache
    const currentState = this.pinStates.get(pin) || { mode: 'INPUT', value: 0 };
    currentState.value = value;
    this.pinStates.set(pin, currentState);
    
    this.emit('pin-change', pin, currentState);
  }

  /**
   * Start polling GPIO pins from QEMU
   */
  private startPinPolling(): void {
    if (this.pollInterval) return;

    this.pollInterval = setInterval(async () => {
      // Poll pin 13 (LED on Arduino Uno)
      const pin13 = await this.pollPin(13);
      if (pin13 !== null) {
        const currentState = this.pinStates.get(13) || { mode: 'OUTPUT', value: 0 };
        if (currentState.value !== pin13) {
          currentState.value = pin13;
          this.pinStates.set(13, currentState);
          this.emit('pin-change', 13, currentState);
        }
      }

      // TODO: Poll other pins as needed
    }, 100); // Poll every 100ms
  }

  /**
   * Stop polling GPIO pins
   */
  private stopPinPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Poll a single pin from QEMU
   */
  private async pollPin(pin: number): Promise<number | null> {
    try {
      const port = this.pinToPort(pin);
      const pinBit = pin % 8;
      return await this.runner.readGPIO(port, pinBit);
    } catch {
      return null;
    }
  }

  /**
   * Convert Arduino pin number to AVR port (PORTB, PORTC, PORTD)
   */
  private pinToPort(pin: number): string {
    if (pin >= 8 && pin <= 13) return 'PORTB';
    if (pin >= 14 && pin <= 19) return 'PORTC';
    return 'PORTD';
  }

  /**
   * Get serial buffer
   */
  getSerialBuffer(): string[] {
    return [...this.serialBuffer];
  }

  /**
   * Clear serial buffer
   */
  clearSerial(): void {
    this.serialBuffer = [];
    this.emit('serial-cleared');
  }

  /**
   * Check if simulation is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Check if simulation is paused
   */
  isPaused(): boolean {
    return this._isPaused;
  }
}
