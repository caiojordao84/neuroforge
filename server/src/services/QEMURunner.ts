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
  private monitorPort: number | null = null;

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

    // Setup monitor socket
    // Windows doesn't support Unix sockets, use TCP instead
    if (process.platform === 'win32') {
      this.monitorPort = 4444;
      this.monitorSocket = null;
    } else {
      this.monitorSocket = path.join(os.tmpdir(), `qemu-monitor-${Date.now()}.sock`);
      this.monitorPort = null;
    }

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

    // Wait for monitor socket/port to be ready
    await this.waitForMonitor();

    this.emit('started');
  }

  /**
   * Wait for monitor to be ready (socket file or TCP port)
   */
  private async waitForMonitor(timeout: number = 2000): Promise<void> {
    // Windows: Wait for TCP port to be listening
    if (this.monitorPort) {
      await this.waitForTcpPort(this.monitorPort, timeout);
      console.log(`✅ QEMU monitor ready on TCP port: ${this.monitorPort}`);
      return;
    }

    // Unix: Wait for socket file
    if (this.monitorSocket) {
      const startTime = Date.now();
      
      while (!fs.existsSync(this.monitorSocket)) {
        if (Date.now() - startTime > timeout) {
          console.warn(`⚠️ Timeout waiting for QEMU monitor socket: ${this.monitorSocket}`);
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('✅ QEMU monitor socket ready:', this.monitorSocket);
    }
  }

  /**
   * Wait for TCP port to be listening
   */
  private async waitForTcpPort(port: number, timeout: number): Promise<void> {
    const net = await import('net');
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await new Promise<void>((resolve, reject) => {
          const client = net.connect({ port, host: '127.0.0.1' }, () => {
            client.end();
            resolve();
          });

          client.on('error', reject);
          client.setTimeout(100);
        });

        // If connection succeeded, port is ready
        return;
      } catch {
        // Port not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.warn(`⚠️ Timeout waiting for QEMU monitor TCP port: ${port}`);
  }

  /**
   * Get monitor connection info
   */
  getMonitorInfo(): { type: 'tcp' | 'unix'; address: string } | null {
    if (this.monitorPort) {
      return { type: 'tcp', address: `127.0.0.1:${this.monitorPort}` };
    }
    if (this.monitorSocket) {
      return { type: 'unix', address: this.monitorSocket };
    }
    return null;
  }

  /**
   * Get monitor socket path (deprecated, use getMonitorInfo)
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
      '-serial', 'stdio',
      // ⏱️ NEUROFORGE TIME: Enable real-time execution
      // Without this, QEMU runs as fast as possible (millions of instructions/sec)
      // With this, QEMU throttles to match real hardware timing (16MHz ATmega328P)
      '-icount', 'shift=auto',
    ];

    // Add monitor
    if (this.monitorPort) {
      // TCP socket for Windows
      args.push('-monitor', `tcp:127.0.0.1:${this.monitorPort},server,nowait`);
    } else if (this.monitorSocket) {
      // Unix socket for Linux/Mac
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

    // Clean up monitor socket (Unix only)
    if (this.monitorSocket && fs.existsSync(this.monitorSocket)) {
      try {
        fs.unlinkSync(this.monitorSocket);
        console.log('🧹 Cleaned up monitor socket:', this.monitorSocket);
      } catch (error) {
        console.error('Error cleaning up monitor socket:', error);
      }
      this.monitorSocket = null;
    }

    this.monitorPort = null;
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
