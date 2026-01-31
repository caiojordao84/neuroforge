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

    console.log('🚀 Starting QEMU with args:', args.join(' '));

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

    // Wait for monitor socket to be ready
    await this.waitForMonitorSocket();

    this.emit('started');
  }

  /**
   * Wait for monitor socket to be created by QEMU
   */
  private async waitForMonitorSocket(timeout: number = 5000): Promise<void> {
    if (!this.monitorSocket) {
      return;
    }

    const startTime = Date.now();
    
    while (!fs.existsSync(this.monitorSocket)) {
      if (Date.now() - startTime > timeout) {
        console.warn(`⚠️ Timeout waiting for QEMU monitor socket: ${this.monitorSocket}`);
        return; // Don't throw, just warn (QEMU might still work)
      }
      
      // Wait 50ms before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('✅ QEMU monitor socket ready:', this.monitorSocket);
  }

  /**
   * Get monitor socket path
   */
  getMonitorSocket(): string | null {
    return this.monitorSocket;
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
      try {
        fs.unlinkSync(this.monitorSocket);
        console.log('🧹 Cleaned up monitor socket:', this.monitorSocket);
      } catch (error) {
        console.error('Error cleaning up monitor socket:', error);
      }
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
