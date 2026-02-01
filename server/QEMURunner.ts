import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MonitorRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  accumulator: string;
  timeoutId: NodeJS.Timeout;
}

export class QEMURunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private serialLogPath: string;
  private isRunning: boolean = false;
  private firmwarePath: string;
  private board: string;
  private serialBuffer: string = '';
  private gpioState: Map<string, number> = new Map();
  private qemuPath: string;
  
  // Monitor TCP connection
  private monitorPort: number;
  private monitorSocket: net.Socket | null = null;
  private monitorBuffer: string = '';
  private monitorConnected: boolean = false;
  private pendingRequests: MonitorRequest[] = [];

  constructor(
    firmwarePath: string,
    board: string = 'uno',
    qemuPath: string = 'qemu-system-avr',
    monitorPort?: number
  ) {
    super();
    this.firmwarePath = firmwarePath;
    this.board = board;
    this.qemuPath = qemuPath;
    this.monitorPort = monitorPort || parseInt(process.env.QEMU_MONITOR_PORT || '4444', 10);
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
        '-monitor', `tcp:127.0.0.1:${this.monitorPort},server,nowait`,
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
        this.disconnectMonitor();
        this.emit('stopped', code);
      });

      // Wait for QEMU to start, then connect to monitor
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.isRunning = true;
          this.startSerialMonitor();
          this.connectMonitor();
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
    
    // Disconnect monitor first
    this.disconnectMonitor();
    
    // Kill QEMU process
    this.process.kill('SIGTERM');
    this.isRunning = false;

    // Cleanup serial log after a delay (Windows file locks)
    setTimeout(() => {
      if (fs.existsSync(this.serialLogPath)) {
        try {
          fs.unlinkSync(this.serialLogPath);
        } catch (err: any) {
          // Ignore EBUSY errors on Windows - file is still locked
          if (err.code !== 'EBUSY' && err.code !== 'EPERM') {
            console.warn('[QEMURunner] Erro ao limpar log:', err);
          }
        }
      }
    }, 1000);
  }

  private connectMonitor(): void {
    console.log(`[QEMURunner] Conectando ao QEMU Monitor em 127.0.0.1:${this.monitorPort}...`);
    
    // Try to connect with retry logic
    let retries = 0;
    const maxRetries = 5;
    const retryDelay = 200;

    const attemptConnection = () => {
      this.monitorSocket = net.createConnection(this.monitorPort, '127.0.0.1');

      this.monitorSocket.on('connect', () => {
        console.log('[QEMURunner] Monitor conectado!');
        this.monitorConnected = true;
        this.monitorBuffer = '';
        this.emit('monitor-connected');
      });

      this.monitorSocket.on('data', (chunk: Buffer) => {
        const data = chunk.toString('utf-8');
        this.monitorBuffer += data;
        this.processMonitorBuffer();
      });

      this.monitorSocket.on('error', (err: Error) => {
        if (!this.monitorConnected && retries < maxRetries) {
          retries++;
          console.log(`[QEMURunner] Monitor connection retry ${retries}/${maxRetries}...`);
          setTimeout(attemptConnection, retryDelay);
        } else {
          console.error('[QEMURunner] Monitor error:', err.message);
          this.emit('monitor-error', err);
        }
      });

      this.monitorSocket.on('close', () => {
        console.log('[QEMURunner] Monitor desconectado');
        this.monitorConnected = false;
        this.failPendingRequests(new Error('Monitor connection closed'));
      });
    };

    attemptConnection();
  }

  private disconnectMonitor(): void {
    if (this.monitorSocket) {
      this.monitorSocket.destroy();
      this.monitorSocket = null;
    }
    this.monitorConnected = false;
    this.monitorBuffer = '';
    this.failPendingRequests(new Error('Monitor disconnected'));
  }

  private processMonitorBuffer(): void {
    // Check if we have a pending request
    if (this.pendingRequests.length === 0) {
      return;
    }

    const request = this.pendingRequests[0];
    request.accumulator += this.monitorBuffer;
    this.monitorBuffer = '';

    // Check if response is complete (ends with "(qemu) " prompt)
    if (request.accumulator.includes('(qemu)')) {
      // Remove the request from queue
      this.pendingRequests.shift();
      
      // Clear timeout
      clearTimeout(request.timeoutId);
      
      // Clean up the response
      let response = request.accumulator;
      
      // Remove the command echo (first line)
      const lines = response.split('\n');
      if (lines.length > 0) {
        lines.shift(); // Remove echoed command
      }
      
      // Remove the final (qemu) prompt
      response = lines.join('\n').replace(/\(qemu\)\s*$/, '').trim();
      
      // Resolve the promise
      request.resolve(response);
    }
  }

  private failPendingRequests(error: Error): void {
    while (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift()!;
      clearTimeout(request.timeoutId);
      request.reject(error);
    }
  }

  /**
   * Send a command to the QEMU Monitor and wait for response
   */
  async sendMonitorCommand(cmd: string, timeoutMs: number = 500): Promise<string> {
    if (!this.monitorConnected || !this.monitorSocket) {
      throw new Error('QEMU monitor not connected');
    }

    return new Promise((resolve, reject) => {
      // Create timeout
      const timeoutId = setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }
        reject(new Error('QEMU monitor command timeout'));
      }, timeoutMs);

      // Add to pending requests queue
      const request: MonitorRequest = {
        resolve,
        reject,
        accumulator: '',
        timeoutId
      };
      this.pendingRequests.push(request);

      // Send command
      const commandLine = cmd.endsWith('\n') ? cmd : cmd + '\n';
      this.monitorSocket!.write(commandLine);
    });
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

  get isMonitorConnected(): boolean {
    return this.monitorConnected;
  }
}
