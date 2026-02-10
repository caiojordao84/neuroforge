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
  private healthCheckInterval: NodeJS.Timeout | null = null;

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

    // Force unbuffered output
    const spawnOptions: any = {
      stdio: ['ignore', 'pipe', 'pipe']
    };

    // Windows: Set environment to force unbuffered output
    if (process.platform === 'win32') {
      spawnOptions.env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        QEMU_AUDIO_DRV: 'none'
      };
    }

    this.process = spawn(this.qemuPath, args, spawnOptions);

    this.process.on('error', (error) => {
      console.error('QEMU process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      console.log('QEMU process exited with code:', code);
      this.stopHealthCheck();
      this.process = null;
      this.emit('stopped', code);
    });

    // 🔍 DEBUG: Check if stdout exists
    if (this.process.stdout) {
      console.log('✅ [QEMURunner] stdout stream exists, setting up capture...');
      
      // Set encoding to utf8 to avoid buffering
      this.process.stdout.setEncoding('utf8');
      
      this.captureSerial(this.process.stdout);
    } else {
      console.error('❌ [QEMURunner] stdout is NULL! Cannot capture serial output.');
    }

    // 🔍 DEBUG: Also capture stderr
    if (this.process.stderr) {
      console.log('✅ [QEMURunner] stderr stream exists, setting up capture...');
      this.process.stderr.setEncoding('utf8');
      this.process.stderr.on('data', (data: string) => {
        console.error('🔴 [QEMU stderr]:', data);
      });
    }

    // Start health check
    this.startHealthCheck();

    // Wait for monitor socket/port to be ready
    await this.waitForMonitor();

    this.emit('started');
  }

  /**
   * Start process health check
   */
  private startHealthCheck(): void {
    console.log('🏥 [QEMURunner] Starting health check (5s interval)...');
    this.healthCheckInterval = setInterval(() => {
      if (this.process) {
        const isAlive = this.process.killed === false && this.process.exitCode === null;
        console.log(`💓 [QEMURunner] Health check: PID=${this.process.pid}, alive=${isAlive}, killed=${this.process.killed}, exitCode=${this.process.exitCode}`);
        
        if (!isAlive) {
          console.error('❌ [QEMURunner] Process is dead but exit event not fired!');
          this.stopHealthCheck();
        }
      } else {
        console.log('⚠️ [QEMURunner] Process is null in health check');
        this.stopHealthCheck();
      }
    }, 5000);
  }

  /**
   * Stop health check
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🛑 [QEMURunner] Health check stopped');
    }
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
    this.stopHealthCheck();
    
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
    let dataReceivedCount = 0;

    console.log('🎧 [QEMURunner] captureSerial() called, listening for stdout data...');

    stream.on('data', (chunk: string) => {
      dataReceivedCount++;
      console.log(`📥 [QEMURunner] Data event #${dataReceivedCount}: Received ${chunk.length} bytes`);
      console.log(`📥 [QEMURunner] Raw data:`, JSON.stringify(chunk));
      
      buffer += chunk;

      // Split by newlines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          console.log('📤 [QEMURunner] Emitting serial event:', line.trim());
          this.emit('serial', line.trim());
        }
      }
    });

    stream.on('error', (error) => {
      console.error('❌ [QEMURunner] stdout error:', error);
    });

    stream.on('end', () => {
      console.log('🏁 [QEMURunner] stdout stream ended');
    });

    // Emit a test after 2 seconds to see if stream is working
    setTimeout(() => {
      if (dataReceivedCount === 0) {
        console.error('⚠️ [QEMURunner] NO DATA received from stdout after 2 seconds!');
        console.error('⚠️ [QEMURunner] QEMU may be frozen or not executing firmware');
        console.error('⚠️ [QEMURunner] Check if QEMU process is running in Task Manager');
      } else {
        console.log(`✅ [QEMURunner] Received ${dataReceivedCount} data events so far`);
      }
    }, 2000);
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
