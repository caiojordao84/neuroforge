import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

/**
 * Low-level QEMU process manager
 */
export class QEMURunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private qemuPath: string;
  private firmwarePath: string | null = null;
  private monitorSocket: string | null = null;
  private monitorPort: number | null = null;
  private serialPort: number = 5555;
  private serialClient: net.Socket | null = null;
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

    // IMPORTANTE: Conectar ao serial TCP ANTES de iniciar o QEMU
    // Caso contrário, o QEMU aguarda conexão e trava
    await this.setupSerialTCPServer();

    this.process = spawn(this.qemuPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.on('error', (error) => {
      console.error('QEMU process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      console.log('QEMU process exited with code:', code);
      this.stopHealthCheck();
      this.disconnectSerial();
      this.process = null;
      this.emit('stopped', code);
    });

    // Capture stderr for errors
    if (this.process.stderr) {
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
   * Setup TCP server to receive serial data from QEMU
   * MUST be called BEFORE spawning QEMU (without nowait)
   */
  private async setupSerialTCPServer(): Promise<void> {
    console.log(`🏛️ [QEMURunner] Setting up serial TCP server on port ${this.serialPort}...`);

    return new Promise((resolve, reject) => {
      const server = net.createServer((socket) => {
        console.log(`✅ [QEMURunner] QEMU connected to serial TCP server`);
        this.serialClient = socket;

        socket.setEncoding('utf8');

        socket.on('data', (data: string) => {
          console.log(`📥 [QEMURunner] Serial TCP data (${data.length} bytes):`, data);
          this.handleSerialData(data);
        });

        socket.on('error', (error) => {
          console.error('❌ [QEMURunner] Serial socket error:', error);
        });

        socket.on('close', () => {
          console.log('🔌 [QEMURunner] Serial socket closed');
          this.serialClient = null;
        });
      });

      server.on('error', (error) => {
        console.error('❌ [QEMURunner] Serial TCP server error:', error);
        reject(error);
      });

      server.listen(this.serialPort, '127.0.0.1', () => {
        console.log(`✅ [QEMURunner] Serial TCP server listening on port ${this.serialPort}`);
        // Store server reference to close later
        (this as any).serialServer = server;
        resolve();
      });
    });
  }

  /**
   * Disconnect serial TCP
   */
  private disconnectSerial(): void {
    if (this.serialClient) {
      this.serialClient.destroy();
      this.serialClient = null;
    }

    // Close TCP server
    if ((this as any).serialServer) {
      (this as any).serialServer.close();
      (this as any).serialServer = null;
      console.log('🔌 [QEMURunner] Serial TCP server closed');
    }
  }

  /**
   * Handle serial data from TCP
   */
  private handleSerialData(data: string): void {
    const lines = data.split('\n');
    
    for (const line of lines) {
      if (line.trim()) {
        console.log('📤 [QEMURunner] Emitting serial event:', line.trim());
        this.emit('serial', line.trim());
      }
    }
  }

  /**
   * Start process health check
   */
  private startHealthCheck(): void {
    console.log('🏥 [QEMURunner] Starting health check (5s interval)...');
    this.healthCheckInterval = setInterval(() => {
      if (this.process) {
        const isAlive = this.process.killed === false && this.process.exitCode === null;
        console.log(`💓 [QEMURunner] Health check: PID=${this.process.pid}, alive=${isAlive}, serialConnected=${this.serialClient !== null}`);
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

    throw new Error(`Timeout waiting for TCP port ${port}`);
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
      // 🔧 NEUROFORGE FIX: TCP serial WITHOUT nowait (QEMU waits for connection)
      // This ensures we don't lose serial output during startup
      '-serial', `tcp:127.0.0.1:${this.serialPort},server`,
      // ⏱️ NEUROFORGE TIME: Enable real-time execution
      '-icount', 'shift=auto',
    ];

    // Add monitor (with nowait - monitor is optional)
    if (this.monitorPort) {
      args.push('-monitor', `tcp:127.0.0.1:${this.monitorPort},server,nowait`);
    } else if (this.monitorSocket) {
      args.push('-monitor', `unix:${this.monitorSocket},server,nowait`);
    }

    return args;
  }

  /**
   * Stop QEMU
   */
  stop(): void {
    this.stopHealthCheck();
    this.disconnectSerial();
    
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
   * Write GPIO pin via QEMU monitor
   */
  async writeGPIO(port: string, pin: number, value: number): Promise<void> {
    // TODO: Implement QEMU monitor communication
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
    if (this.serialClient) {
      this.serialClient.write(data);
    }
  }

  /**
   * Check if QEMU is running
   */
  isRunning(): boolean {
    return this.process !== null;
  }
}
