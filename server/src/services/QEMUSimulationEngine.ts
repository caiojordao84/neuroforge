import { EventEmitter } from 'events';
import { QEMURunner } from './QEMURunner';
import { QEMUMonitorService } from './QEMUMonitorService';
import { Esp32Backend } from './Esp32Backend';
import { SerialGPIOParser, PinStateUpdate } from './SerialGPIOParser';
import type { BoardType } from './CompilerService';
import type { Esp32BackendConfig } from '../types/esp32.types';

export interface PinState {
  mode: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'UNKNOWN';
  value: number; // 0 or 1 for digital, 0-1023 for analog
}

/**
 * High-level API for QEMU simulation
 * Supports both AVR (Arduino Uno) and ESP32 backends
 */
export class QEMUSimulationEngine extends EventEmitter {
  private runner: QEMURunner;
  private monitor: QEMUMonitorService;
  private esp32Backend: Esp32Backend | null = null;
  private gpioParser: SerialGPIOParser;
  private backendType: 'avr' | 'esp32' | null = null;
  private pinStates: Map<number, PinState>;
  private serialBuffer: string[];
  private pollInterval: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private _isPaused = false;
  private _firmwarePath: string | null = null;
  private _board: BoardType = 'arduino-uno';
  private gpioErrorShown = false;

  constructor() {
    super();
    this.runner = new QEMURunner();
    this.monitor = new QEMUMonitorService();
    this.gpioParser = new SerialGPIOParser();
    this.pinStates = new Map();
    this.serialBuffer = [];
    this.setupRunnerEvents();
    this.setupGpioParserEvents();
  }

  /**
   * Load firmware into QEMU
   */
  async loadFirmware(
    firmwarePath: string,
    board: BoardType = 'arduino-uno'
  ): Promise<void> {
    this._firmwarePath = firmwarePath;
    this._board = board;

    // Detectar tipo de backend baseado na placa
    if (board === 'esp32' || board.includes('esp32')) {
      this.backendType = 'esp32';
      console.log(`📦 ESP32 Firmware loaded: ${firmwarePath}`);
    } else {
      this.backendType = 'avr';
      console.log(`📦 AVR Firmware loaded: ${firmwarePath} (${board})`);
    }

    this.emit('firmware-loaded', firmwarePath, board);
  }

  /**
   * Start QEMU simulation
   */
  async start(esp32Config?: Esp32BackendConfig): Promise<void> {
    if (!this._firmwarePath) {
      throw new Error('No firmware loaded. Call loadFirmware() first.');
    }

    try {
      this.gpioErrorShown = false;

      // Rotear para o backend correto
      if (this.backendType === 'esp32') {
        if (!esp32Config) {
          throw new Error('ESP32 config required for ESP32 board');
        }
        await this.startEsp32Backend(esp32Config);
      } else {
        await this.startAvrBackend();
      }

      this._isRunning = true;
      this._isPaused = false;
    } catch (error) {
      this._isRunning = false;
      throw error;
    }
  }

  /**
   * Inicia backend AVR (original)
   */
  private async startAvrBackend(): Promise<void> {
    await this.runner.start(this._firmwarePath!, this._board as any);

    const monitorInfo = this.runner.getMonitorInfo();
    if (monitorInfo) {
      try {
        await this.monitor.connect(monitorInfo.address);
        console.log(`✅ QEMU Monitor connected (${monitorInfo.type})`);
        // Desativado: Entra em conflito com o protocolo Serial customizado
        // this.startGPIOPolling(); 
      } catch (error) {
        console.error('⚠️ Failed to connect QEMU monitor:', error);
        console.log('⚠️ Continuing without GPIO monitoring...');
      }
    } else {
      console.warn('⚠️ No monitor available, GPIO polling disabled');
    }
  }

  /**
   * Inicia backend ESP32 (novo)
   */
  private async startEsp32Backend(config: Esp32BackendConfig): Promise<void> {
    this.esp32Backend = new Esp32Backend();

    // Forward eventos de serial para o buffer
    this.esp32Backend.on('serial', (line: string) => {
      // NeuroForge: Process line for GPIO first.
      // If it's a GPIO frame, it returns true and we DON'T echo it to serial monitor.
      const isGPIO = this.gpioParser.processLine(line);

      if (!isGPIO) {
        this.serialBuffer.push(line);
        this.emit('serial', line);
      }
    });

    this.esp32Backend.on('started', () => {
      this._isRunning = true;
      this.emit('started');
    });

    this.esp32Backend.on('stopped', (code) => {
      this._isRunning = false;
      this.emit('stopped', code);
    });

    this.esp32Backend.on('error', (error) => {
      this.emit('error', error);
    });

    await this.esp32Backend.start(config);
  }

  /**
   * Setup event forwarding from QEMURunner (AVR)
   */
  private setupRunnerEvents(): void {
    // Forward serial output
    this.runner.on('serial', (line: string) => {
      // 🔍 DEBUG: Log every line received from QEMU
      console.log('🔍 [QEMU Serial]:', line);
      
      // NeuroForge: Process line for GPIO first. 
      // If it's a GPIO frame, it returns true and we DON'T echo it to serial monitor.
      const isGPIO = this.gpioParser.processLine(line);

      if (isGPIO) {
        console.log('⚡ [GPIO Detected] Line matched GPIO protocol:', line);
      }

      if (!isGPIO) {
        this.serialBuffer.push(line);
        this.emit('serial', line);
      } else {
        // console.log('🛡️ [QEMU] Filtered GPIO frame from serial:', line);
      }
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
   * Listen for GPIO events from Serial protocol
   */
  private setupGpioParserEvents(): void {
    this.gpioParser.on('pin-change', (update: PinStateUpdate) => {
      const { pin, value, mode } = update;
      
      // 🔍 DEBUG: Log pin-change event
      console.log(`⚡ [GPIO pin-change] Pin ${pin} = ${value} (mode: ${mode || 'OUTPUT'})`);
      
      const state: PinState = {
        mode: mode || 'OUTPUT',
        value
      };

      this.pinStates.set(pin, state);
      
      // 🔍 DEBUG: About to emit pin-change
      console.log(`📡 [Engine] Emitting pin-change event to WebSocket...`);
      this.emit('pin-change', pin, state);
    });
  }

  /**
   * Stop QEMU simulation
   */
  stop(): void {
    this.stopGPIOPolling();

    if (this.backendType === 'esp32' && this.esp32Backend) {
      this.esp32Backend.stop();
      this.esp32Backend = null;
    } else {
      this.monitor.disconnect();
      this.runner.stop();
    }

    this._isRunning = false;
    this._isPaused = false;
    this.gpioErrorShown = false;
    this.backendType = null;
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
      // Write to QEMU via monitor (AVR only for now)
      if (this.backendType === 'avr') {
        await this.monitor.setGPIOPin(pin, value === 1 ? 'HIGH' : 'LOW');
      }

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
   * Currently only supported for AVR backend
   */
  private startGPIOPolling(): void {
    // GPIO polling apenas para backend AVR
    if (this.backendType !== 'avr') {
      return;
    }

    if (this.pollInterval) return;

    console.log('🔄 Starting GPIO polling at 20 FPS...');
    console.log('⚠️ Note: QEMU AVR GPIO monitoring is experimental. Serial output will work normally.');

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
        // QEMU AVR doesn't reliably support GPIO monitoring via 'info registers'
        // This is expected - show warning once, then silently continue
        if (!this.gpioErrorShown) {
          console.log('⚠️ GPIO monitoring not available in this QEMU build (continuing with serial only)');
          this.gpioErrorShown = true;
        }
        // Don't spam errors - GPIO monitoring is optional
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

  /**
   * Get current backend type
   */
  getBackendType(): 'avr' | 'esp32' | null {
    return this.backendType;
  }
}
