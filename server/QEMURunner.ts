import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class QEMURunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private serialLogPath: string;
  private isRunning: boolean = false;
  private firmwarePath: string;
  private board: string;
  private serialBuffer: string = '';
  private gpioState: Map<string, number> = new Map();
  private qemuPath: string;

  constructor(
    firmwarePath: string,
    board: string = 'uno',
    qemuPath: string = 'qemu-system-avr'
  ) {
    super();
    this.firmwarePath = firmwarePath;
    this.board = board;
    this.qemuPath = qemuPath;
    this.serialLogPath = path.join(os.tmpdir(), `neuroforge_serial_${Date.now()}.log`);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('QEMU ja esta rodando');
    }

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

      console.log(`[QEMURunner] Iniciando: ${this.qemuPath} ${args.join(' ')}`);

      this.process = spawn(this.qemuPath, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.process.on('error', (error: Error) => {
        console.error('[QEMURunner] Erro:', error);
        this.isRunning = false;
        reject(error);
      });

      this.process.on('exit', (code: number | null) => {
        console.log(`[QEMURunner] Finalizou com codigo: ${code}`);
        this.isRunning = false;
        this.emit('stopped', code);
      });

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

  stop(): void {
    if (!this.isRunning || !this.process) {
      return;
    }

    console.log('[QEMURunner] Parando...');
    this.process.kill('SIGTERM');
    this.isRunning = false;

    if (fs.existsSync(this.serialLogPath)) {
      try {
        fs.unlinkSync(this.serialLogPath);
      } catch (err) {
        console.warn('[QEMURunner] Erro ao limpar log:', err);
      }
    }
  }

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

        stream.on('data', (chunk: string | Buffer) => {
          const data = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;
          this.serialBuffer += data;

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
    }, 50);
  }

  async readGPIO(port: 'B' | 'C' | 'D', pin: number): Promise<number> {
    const key = `PORT${port}_${pin}`;
    return this.gpioState.get(key) || 0;
  }

  async writeGPIO(port: 'B' | 'C' | 'D', pin: number, value: 0 | 1): Promise<void> {
    const key = `PORT${port}_${pin}`;
    this.gpioState.set(key, value);
    this.emit('gpio-write', { port, pin, value });
  }

  async sendSerial(data: string): Promise<void> {
    console.log(`[QEMURunner] Enviando: ${data}`);
    this.emit('serial-tx', data);
  }

  get running(): boolean {
    return this.isRunning;
  }

  get firmware(): string {
    return this.firmwarePath;
  }
}
