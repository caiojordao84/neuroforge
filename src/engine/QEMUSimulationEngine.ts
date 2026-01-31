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

/**
 * QEMUSimulationEngine - Motor de simulacao baseado em QEMU
 * 
 * Substitui o SimulationEngine custom por execucao real de firmware.
 * Gerencia lifecycle da simulacao e bridge com componentes visuais.
 */
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

  /**
   * Carrega firmware compilado
   */
  async loadFirmware(firmwarePath: string, board: string = 'uno'): Promise<void> {
    if (this.state.isRunning) {
      throw new Error('Pare a simulacao antes de carregar novo firmware');
    }

    this.state.firmwarePath = firmwarePath;
    this.state.board = board;
    this.emit('firmware-loaded', { firmwarePath, board });
  }

  /**
   * Inicia simulacao
   */
  async start(): Promise<void> {
    if (!this.state.firmwarePath) {
      throw new Error('Nenhum firmware carregado. Use loadFirmware() primeiro.');
    }

    if (this.state.isRunning) {
      console.warn('[QEMUSimulationEngine] Simulacao ja esta rodando');
      return;
    }

    // Criar runner QEMU
    this.runner = new QEMURunner(this.state.firmwarePath, this.state.board);

    // Escutar eventos do runner
    this.runner.on('serial', (line: string) => {
      this.state.serialOutput.push(line);
      this.emit('serial', line);
    });

    this.runner.on('started', () => {
      console.log('[QEMUSimulationEngine] QEMU iniciado');
      this.state.isRunning = true;
      this.startPolling();
      this.emit('started');
    });

    this.runner.on('stopped', () => {
      console.log('[QEMUSimulationEngine] QEMU parado');
      this.state.isRunning = false;
      this.stopPolling();
      this.emit('stopped');
    });

    // Iniciar QEMU
    await this.runner.start();
  }

  /**
   * Para simulacao
   */
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

  /**
   * Pausa/Resume simulacao
   * TODO: Implementar via QEMU monitor (stop/cont)
   */
  pause(): void {
    this.state.isPaused = true;
    this.emit('paused');
  }

  resume(): void {
    this.state.isPaused = false;
    this.emit('resumed');
  }

  /**
   * Polling de GPIO para atualizar componentes visuais
   */
  private startPolling(): void {
    // Poll GPIO a cada 50ms (20 FPS)
    this.pollInterval = setInterval(async () => {
      if (!this.runner || this.state.isPaused) {
        return;
      }

      // Ler pinos digitais Arduino Uno (D0-D13)
      // PORTB: pinos 8-13 (bits 0-5)
      // PORTC: pinos A0-A5 (bits 0-5) 
      // PORTD: pinos 0-7 (bits 0-7)

      try {
        // Exemplo: Ler pino 13 (PORTB bit 5)
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

  /**
   * Para polling de GPIO
   */
  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Simula input de botao/sensor
   */
  async setPin(pin: number, value: 0 | 1): Promise<void> {
    if (!this.runner) {
      throw new Error('Simulacao nao esta rodando');
    }

    // Mapear pino para porta/bit
    const { port, bit } = this.pinToPort(pin);
    await this.runner.writeGPIO(port, bit, value);
  }

  /**
   * Envia dados para Serial (RX)
   */
  async sendSerial(data: string): Promise<void> {
    if (!this.runner) {
      throw new Error('Simulacao nao esta rodando');
    }

    await this.runner.sendSerial(data);
  }

  /**
   * Mapeia numero do pino para porta/bit
   */
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

  /**
   * Obtem estado atual
   */
  getState(): SimulationState {
    return { ...this.state };
  }

  /**
   * Limpa output serial
   */
  clearSerial(): void {
    this.state.serialOutput = [];
    this.emit('serial-cleared');
  }
}
