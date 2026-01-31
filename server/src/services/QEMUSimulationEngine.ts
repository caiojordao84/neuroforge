import { EventEmitter } from 'events';
import { QEMURunner } from './QEMURunner';
import { QEMUMonitorService } from './QEMUMonitorService';
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
  private monitor: QEMUMonitorService;
  private pinStates: Map<number, PinState>;
  private serialBuffer: string[];
  private pollInterval: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _isPaused = false;
  private _firmwarePath: string | null = null;
  private _board: BoardType = 'arduino-uno';

  constructor() {
    super();
    this.runner = new QEMURunner();
    this.monitor = new QEMUMonitorService();
    this.pinStates = new Map();
    this.serialBuffer = [];
    this.setupRunnerEvents();
  }

  /**
   * Load firmware into QEMU
   */
  async loadFirmware(firmwarePath: string, board: BoardType = 'arduino-uno'): Promise<void> {
    this._firmwarePath = firmwarePath;
    this._board = board;
    console.log(`📦 Firmware loaded: ${firmwarePath} (${board})`);
    this.emit('firmware-loaded', firmwarePath, board);
  }

  /**
   * Start QEMU simulation
   */
  async start(): Promise<void> {
    if (!this._firmwarePath) {
      throw new Error('No firmware loaded. Call loadFirmware() first.');
    }

    try {
      // Start QEMU with firmware
      await this.runner.start(this._firmwarePath, this._board as any);
      this._isRunning = true;
      this._isPaused = false;

      // Connect to QEMU monitor
      const monitorInfo = this.runner.getMonitorInfo();
      if (monitorInfo) {
        try {
          await this.monitor.connect(monitorInfo.address);
          console.log(`✅ QEMU Monitor connected (${monitorInfo.type}), starting GPIO polling...`);
          this.startGPIOPolling();
        } catch (error) {
          console.error('⚠️ Failed to connect QEMU monitor:', error);
          console.log('⚠️ Continuing without GPIO monitoring...');
        }
      } else {
        console.warn('⚠️ No monitor available, GPIO polling disabled');
      }
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
      this.stopGPIOPolling();
      this.emit('stopped');
    });
  }

  /**
   * Stop QEMU simulation
   */
  stop(): void {
    this.stopGPIOPolling();
    this.monitor.disconnect();
    this.runner.stop();
    this._isRunning = false;
    this._isPaused = false;
  }

  /**
   * Pause simulation
   */
  pause(): void {
    this.stopGPIOPolling();
    this._isPaused = true;
    this.emit('paused');
  }

  /**
   * Resume simulation
   */
  resume(): void {
    this.startGPIOPolling();
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
    try {
      // Write to QEMU via monitor
      await this.monitor.setGPIOPin(pin, value === 1 ? 'HIGH' : 'LOW');
      
      // Update local cache
      const currentState = this.pinStates.get(pin) || { mode: 'INPUT', value: 0 };
      currentState.value = value;
      this.pinStates.set(pin, currentState);
      
      this.emit('pin-change', pin, currentState);
    } catch (error) {
      console.error('Error setting pin state:', error);
      throw error;
    }
  }

  /**
   * Start polling GPIO pins from QEMU (20 FPS)
   */
  private startGPIOPolling(): void {
    if (this.pollInterval) return;

    console.log('🔄 Starting GPIO polling at 20 FPS...');

    this.pollInterval = setInterval(async () => {
      try {
        // Get all pin states from QEMU monitor
        const pinStates = await this.monitor.getGPIOState();

        // Update local cache and emit changes
        for (const { pin, state } of pinStates) {
          const currentState = this.pinStates.get(pin);
          const newValue = state === 'HIGH' ? 1 : 0;

          // Check if state changed
          if (!currentState || currentState.value !== newValue) {
            const updatedState: PinState = {
              mode: 'OUTPUT', // Assume OUTPUT for now (can be refined)
              value: newValue
            };

            this.pinStates.set(pin, updatedState);
            this.emit('pin-change', pin, updatedState);
          }
        }
      } catch (error) {
        // Don't spam errors if polling fails
        // console.error('GPIO polling error:', error);
      }
    }, 50); // 20 FPS (1000ms / 20 = 50ms)
  }

  /**
   * Stop polling GPIO pins
   */
  private stopGPIOPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('⏸️ GPIO polling stopped');
    }
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
