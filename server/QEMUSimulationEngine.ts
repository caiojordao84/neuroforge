import { QEMURunner } from './QEMURunner';
import { EventEmitter } from 'events';

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
  private state: SimulationState;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.state = {
      isRunning: false,
      isPaused: false,
      board: 'uno',
      firmwarePath: null,
      serialOutput: [],
      gpioStates: {},
      cycleCount: 0
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

    this.runner.on('serial', (line: string) => {
      this.state.serialOutput.push(line);
      this.emit('serial', line);
    });

    this.runner.on('started', () => {
      this.state.isRunning = true;
      this.startPolling();
      this.emit('started');
    });

    this.runner.on('stopped', () => {
      this.state.isRunning = false;
      this.stopPolling();
      this.emit('stopped');
    });

    await this.runner.start();
  }

  stop(): void {
    if (!this.state.isRunning || !this.runner) {
      return;
    }

    this.runner.stop();
    this.stopPolling();
    this.state.isRunning = false;
    this.state.serialOutput = [];
    this.state.cycleCount = 0;
  }

  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
  }

  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
  }

  private startPolling(): void {
    this.pollInterval = setInterval(async () => {
      if (!this.runner || this.state.isPaused) {
        return;
      }

      try {
        const pin13 = await this.runner.readGPIO('B', 5);
        const key = 'D13';
        
        if (this.state.gpioStates[key] !== pin13) {
          this.state.gpioStates[key] = pin13;
          this.emit('pin-change', { pin: 13, value: pin13 });
        }

        this.state.cycleCount++;
      } catch (err) {
        console.error('[QEMUSimulationEngine] Erro ao ler GPIO:', err);
      }
    }, 50);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
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

  private pinToPort(pin: number): { port: 'B' | 'C' | 'D', bit: number } {
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

  clearSerial(): void {
    this.state.serialOutput = [];
    this.emit('serial-cleared');
  }
}
