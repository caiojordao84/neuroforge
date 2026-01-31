import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * QEMURunner - Gerencia execucao do QEMU e comunicacao com firmware
 * 
 * Responsabilidades:
 * - Spawn processo QEMU com firmware compilado
 * - Capturar output serial (UART)
 * - Ler estado de GPIO via QEMU monitor
 * - Injetar input em pinos (botoes, sensores)
 * - Controlar lifecycle (start, stop, restart)
 */
export class QEMURunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private serialLogPath: string;
  private isRunning: boolean = false;
  private firmwarePath: string;
  private board: string;
  private serialBuffer: string = '';
  private gpioState: Map<string, number> = new Map();

  constructor(
    firmwarePath: string,
    board: string = 'uno',
    private qemuPath: string = 'qemu-system-avr'
  ) {
    super();
    this.firmwarePath = firmwarePath;
    this.board = board;
    this.serialLogPath = path.join(os.tmpdir(), `neuroforge_serial_${Date.now()}.log`);
  }

  /**
   * Inicia processo QEMU
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('QEMU ja esta rodando');
    }

    // Verificar se firmware existe
    if (!fs.existsSync(this.firmwarePath)) {
      throw new Error(`Firmware nao encontrado: ${this.firmwarePath}`);
    }

    return new Promise((resolve, reject) => {
      const args = [
        '-machine', this.board,
        '-bios', this.firmwarePath,
        '-serial', `file:${this.serialLogPath}`,
        '-nographic',
        '-d', 'guest_errors'
      ];

      console.log(`[QEMURunner] Iniciando QEMU: ${this.qemuPath} ${args.join(' ')}`);

      this.process = spawn(this.qemuPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.process.on('error', (error) => {
        console.error('[QEMURunner] Erro ao iniciar QEMU:', error);
        this.isRunning = false;
        reject(error);
      });

      this.process.on('exit', (code) => {
        console.log(`[QEMURunner] QEMU finalizou com codigo: ${code}`);
        this.isRunning = false;
        this.emit('stopped', code);
      });

      // Aguardar processo iniciar
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.isRunning = true;
          this.startSerialMonitor();
          this.emit('started');
          resolve();
        } else {
          reject(new Error('QEMU falhou ao iniciar'));
        }
      }, 500);
    });
  }

  /**
   * Para processo QEMU
   */
  stop(): void {
    if (!this.isRunning || !this.process) {
      return;
    }

    console.log('[QEMURunner] Parando QEMU...');
    this.process.kill('SIGTERM');
    this.isRunning = false;

    // Limpar arquivo de log
    if (fs.existsSync(this.serialLogPath)) {
      try {
        fs.unlinkSync(this.serialLogPath);
      } catch (err) {
        console.warn('[QEMURunner] Erro ao limpar log:', err);
      }
    }
  }

  /**
   * Monitora arquivo de log serial em tempo real
   */
  private startSerialMonitor(): void {
    let lastSize = 0;

    const checkInterval = setInterval(() => {
      if (!this.isRunning) {
        clearInterval(checkInterval);
        return;
      }

      if (!fs.existsSync(this.serialLogPath)) {
        return;
      }

      const stats = fs.statSync(this.serialLogPath);
      const currentSize = stats.size;

      if (currentSize > lastSize) {
        const stream = fs.createReadStream(this.serialLogPath, {
          start: lastSize,
          end: currentSize
        });

        stream.on('data', (chunk) => {
          const data = chunk.toString('utf-8');
          this.serialBuffer += data;

          // Emitir linhas completas
          const lines = this.serialBuffer.split('\n');
          this.serialBuffer = lines.pop() || '';

          lines.forEach(line => {
            if (line.trim()) {
              this.emit('serial', line.trim());
            }
          });
        });

        lastSize = currentSize;
      }
    }, 50); // Poll a cada 50ms
  }

  /**
   * Le estado de um pino GPIO
   * TODO: Implementar leitura via QEMU monitor ou memory dump
   */
  async readGPIO(port: 'B' | 'C' | 'D', pin: number): Promise<number> {
    const key = `PORT${port}_${pin}`;
    return this.gpioState.get(key) || 0;
  }

  /**
   * Injeta valor em um pino GPIO (simular botao, sensor)
   * TODO: Implementar escrita via QEMU monitor
   */
  async writeGPIO(port: 'B' | 'C' | 'D', pin: number, value: 0 | 1): Promise<void> {
    const key = `PORT${port}_${pin}`;
    this.gpioState.set(key, value);
    this.emit('gpio-write', { port, pin, value });
  }

  /**
   * Envia dados para serial (RX)
   * TODO: Implementar via pipe ou QEMU monitor
   */
  async sendSerial(data: string): Promise<void> {
    console.log(`[QEMURunner] Enviando para serial: ${data}`);
    this.emit('serial-tx', data);
    // TODO: Implementar escrita no UART via QEMU
  }

  /**
   * Verifica se QEMU esta rodando
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Caminho do firmware carregado
   */
  get firmware(): string {
    return this.firmwarePath;
  }
}
