import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Readable } from 'stream';

/**
 * Low-level QEMU process manager
 */
export class QEMURunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private qemuPath: string;
  private firmwarePath: string | null = null;
  private monitorSocket: string | null = null;

  constructor() {
    super();
    this.qemuPath = process.platform === 'win32' ? 'qemu-system-avr.exe' : 'qemu-system-avr';
  }

  /**
   * Start QEMU with firmware
   */
  async start(firmwarePath?: string, board: 'arduino-uno' | 'esp32' = 'arduino-uno'): Promise<void> {
    if (this.process) {
      throw new Error('QEMU is already running');
    }

    const firmware = firmwarePath || this.firmwarePath;
    if (!firmware) {
      throw new Error('No firmware specified');
    }

    if (!fs.existsSync(firmware)) {
      throw new Error(`Firmware not found: ${firmware}`);
    }

    this.firmwarePath = firmware;

    // Setup monitor socket for GPIO control
    this.monitorSocket = path.join(os.tmpdir(), `qemu-monitor-${Date.now()}.sock`);

    const args = this.buildQemuArgs(board);

    this.process = spawn(this.qemuPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.on('error', (error) => {
      console.error('QEMU process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      console.log('QEMU process exited with code:', code);
      this.process = null;
      this.emit('stopped', code);
    });

    if (this.process.stdout) {
      this.captureSerial(this.process.stdout);
    }

    this.emit('started');
  }

  /**
   * Build QEMU command line arguments
   */
  private buildQemuArgs(board: string): string[] {
    const args = [
      '-machine', 'arduino-uno',
      '-bios', this.firmwarePath!,
      '-nographic',
      '-serial', 'stdio'
    ];

    // Add monitor socket if available
    if (this.monitorSocket) {
      args.push('-monitor', `unix:${this.monitorSocket},server,nowait`);
    }

    return args;
  }

  /**
   * Stop QEMU
   */
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    // Clean up monitor socket
    if (this.monitorSocket && fs.existsSync(this.monitorSocket)) {
      fs.unlinkSync(this.monitorSocket);
      this.monitorSocket = null;
    }
  }

  /**
   * Capture serial output from QEMU stdout
   */
  private captureSerial(stream: Readable): void {
    let buffer = '';

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();

      // Split by newlines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          this.emit('serial', line.trim());
        }
      }
    });
  }

  /**
   * Write GPIO pin via QEMU monitor
   */
  async writeGPIO(port: string, pin: number, value: number): Promise<void> {
    // TODO: Implement QEMU monitor communication
    // This would use the monitor socket to send commands like:
    // system_reset, info registers, etc.
    console.log(`GPIO Write: ${port}.${pin} = ${value}`);
  }

  /**
   * Read GPIO pin via QEMU monitor
   */
  async readGPIO(port: string, pin: number): Promise<number> {
    // TODO: Implement QEMU monitor communication
    console.log(`GPIO Read: ${port}.${pin}`);
    return 0;
  }

  /**
   * Send data to serial input (UART RX)
   */
  sendSerialData(data: string): void {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(data);
    }
  }

  /**
   * Check if QEMU is running
   */
  isRunning(): boolean {
    return this.process !== null;
  }
}
