import { QEMURunner } from './QEMURunner';
import { EventEmitter } from 'events';
import { QEMUGPIOService, PinChange } from './QEMUGPIOService';
import { SerialGPIOService } from './SerialGPIOService';

export interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  board: string;
  firmwarePath: string | null;
  serialOutput: string[];
  gpioStates: Record<string, number>;
  cycleCount: number;
}

export class QEMUSimulationEngine extends EventEmitter {
  private runner: QEMURunner | null = null;
  private gpioService: QEMUGPIOService | SerialGPIOService | null = null;
  private state: SimulationState;

  constructor() {
    super();
    this.state = {
      isRunning: false,
      isPaused: false,
      board: 'uno',
      firmwarePath: null,
      serialOutput: [],
      gpioStates: {},
      cycleCount: 0,
    };
  }

  async loadFirmware(firmwarePath: string, board: string = 'uno'): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Pare a simulacao antes de carregar novo firmware');
    }

    this.state.firmwarePath = firmwarePath;
    this.state.board = board;
    this.emit('firmware-loaded', { firmwarePath, board });
  }

  async start(): Promise<void> {
    if (!this.state.firmwarePath) {
      throw new Error('Nenhum firmware carregado');
    }

    if (this.state.isRunning) {
      return;
    }

    this.runner = new QEMURunner(this.state.firmwarePath, this.state.board);

    // Escolha do backend de GPIO: por default usamos o SerialGPIOService
    const gpioMode = process.env.NF_GPIO_MODE || 'serial';
    if (gpioMode === 'serial') {
      this.gpioService = new SerialGPIOService(this.runner);
    } else {
      this.gpioService = new QEMUGPIOService(this.runner);
    }

    this.runner.on('serial', (line: string) => {
      this.state.serialOutput.push(line);
      this.emit('serial', line);

      // Se o serviço de GPIO suportar processLine (SerialGPIOService), alimentamos com a linha
      if (this.gpioService && (this.gpioService as any).processLine) {
        (this.gpioService as any).processLine(line);
      }
    });

    this.runner.on('started', () => {
      this.state.isRunning = true;
      if (this.gpioService) {
        this.gpioService.startPolling();
      }
      this.emit('started');
    });

    this.runner.on('stopped', () => {
      this.state.isRunning = false;
      if (this.gpioService) {
        this.gpioService.stopPolling();
      }
      this.emit('stopped');
    });

    if (this.gpioService) {
      this.gpioService.on('gpio-changes', (changes: PinChange[]) => {
        changes.forEach(change => {
          const key = `D${change.pin}`;
          this.state.gpioStates[key] = change.to;
          this.emit('pin-change', { pin: change.pin, value: change.to });
        });
        this.state.cycleCount++;
      });
    }

    await this.runner.start();
  }

  stop(): void {
    if (!this.state.isRunning || !this.runner) {
      return;
    }

    this.runner.stop();
    if (this.gpioService) {
      this.gpioService.stopPolling();
    }
    this.state.isRunning = false;
    this.state.serialOutput = [];
    this.state.cycleCount = 0;
    this.state.gpioStates = {};
  }

  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
  }

  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
  }

  async setPin(pin: number, value: 0 | 1): Promise<void> {
    if (!this.runner) {
      throw new Error('Simulacao nao esta rodando');
    }

    const { port, bit } = this.pinToPort(pin);
    await this.runner.writeGPIO(port, bit, value);
  }

  async sendSerial(data: string): Promise<void> {
    if (!this.runner) {
      throw new Error('Simulacao nao esta rodando');
    }

    await this.runner.sendSerial(data);
  }

  private pinToPort(pin: number): { port: 'B' | 'C' | 'D'; bit: number } {
    if (pin >= 8 && pin <= 13) {
      return { port: 'B', bit: pin - 8 };
    } else if (pin >= 0 && pin <= 7) {
      return { port: 'D', bit: pin };
    } else if (pin >= 14 && pin <= 19) {
      return { port: 'C', bit: pin - 14 };
    }
    throw new Error(`Pino invalido: ${pin}`);
  }

  getState(): SimulationState {
    return { ...this.state };
  }

  getPinState(pin: number): 0 | 1 {
    if (this.gpioService) {
      return this.gpioService.getPinState(pin);
    }
    const key = `D${pin}`;
    return (this.state.gpioStates[key] ?? 0) as 0 | 1;
  }

  clearSerial(): void {
    this.state.serialOutput = [];
    this.emit('serial-cleared');
  }
}
