import { Socket } from 'net';
import * as net from 'net';
import * as fs from 'fs';

export interface PinState {
  pin: number;
  state: 'HIGH' | 'LOW';
  port: string;
  bit: number;
}

/**
 * QEMU Monitor Service
 * Connects to QEMU HMP (Human Monitor Protocol) to read/write GPIO state
 */
export class QEMUMonitorService {
  private socket: Socket | null = null;
  private socketPath: string | null = null;
  private responseBuffer: string = '';
  private pendingCommand: {
    resolve: (value: string) => void;
    reject: (error: Error) => void;
  } | null = null;

  /**
   * Connect to QEMU monitor socket
   */
  async connect(socketPath: string): Promise<void> {
    if (this.socket) {
      throw new Error('Already connected to QEMU monitor');
    }

    this.socketPath = socketPath;

    // Wait for socket file to exist (up to 5 seconds)
    await this.waitForSocket(socketPath, 5000);

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(socketPath);

      this.socket.on('connect', () => {
        console.log('✅ Connected to QEMU monitor:', socketPath);
        
        // Setup data handler
        this.socket!.on('data', (data) => this.handleData(data));
        
        resolve();
      });

      this.socket.on('error', (error) => {
        console.error('QEMU monitor connection error:', error);
        reject(error);
      });

      this.socket.on('close', () => {
        console.log('QEMU monitor connection closed');
        this.socket = null;
      });
    });
  }

  /**
   * Wait for socket file to exist
   */
  private async waitForSocket(socketPath: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (!fs.existsSync(socketPath)) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for QEMU monitor socket: ${socketPath}`);
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Disconnect from QEMU monitor
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
    }
  }

  /**
   * Handle incoming data from QEMU monitor
   */
  private handleData(data: Buffer): void {
    this.responseBuffer += data.toString();

    // Check if we have a complete response (ends with QEMU prompt)
    if (this.responseBuffer.includes('(qemu)')) {
      const response = this.responseBuffer.replace('(qemu)', '').trim();
      this.responseBuffer = '';

      if (this.pendingCommand) {
        this.pendingCommand.resolve(response);
        this.pendingCommand = null;
      }
    }
  }

  /**
   * Send command to QEMU monitor and wait for response
   */
  async sendCommand(command: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Not connected to QEMU monitor');
    }

    return new Promise((resolve, reject) => {
      this.pendingCommand = { resolve, reject };

      this.socket!.write(command + '\n', (error) => {
        if (error) {
          this.pendingCommand = null;
          reject(error);
        }
      });

      // Timeout after 2 seconds
      setTimeout(() => {
        if (this.pendingCommand) {
          this.pendingCommand.reject(new Error('Command timeout'));
          this.pendingCommand = null;
        }
      }, 2000);
    });
  }

  /**
   * Get GPIO state for all pins
   * Returns state of all 20 Arduino Uno pins (D0-D13, A0-A5)
   */
  async getGPIOState(): Promise<PinState[]> {
    try {
      // Get register dump from QEMU
      const output = await this.sendCommand('info registers');
      
      // Parse PORTB, PORTC, PORTD values
      const portB = this.parseRegister(output, 'PORTB');
      const portC = this.parseRegister(output, 'PORTC');
      const portD = this.parseRegister(output, 'PORTD');

      const pinStates: PinState[] = [];

      // PORTD: Arduino pins 0-7
      for (let bit = 0; bit < 8; bit++) {
        pinStates.push({
          pin: bit,
          state: (portD & (1 << bit)) ? 'HIGH' : 'LOW',
          port: 'PORTD',
          bit
        });
      }

      // PORTB: Arduino pins 8-13 (bits 0-5, bits 6-7 are crystal)
      for (let bit = 0; bit < 6; bit++) {
        pinStates.push({
          pin: 8 + bit,
          state: (portB & (1 << bit)) ? 'HIGH' : 'LOW',
          port: 'PORTB',
          bit
        });
      }

      // PORTC: Arduino pins A0-A5 (14-19)
      for (let bit = 0; bit < 6; bit++) {
        pinStates.push({
          pin: 14 + bit,
          state: (portC & (1 << bit)) ? 'HIGH' : 'LOW',
          port: 'PORTC',
          bit
        });
      }

      return pinStates;
    } catch (error) {
      console.error('Error getting GPIO state:', error);
      return [];
    }
  }

  /**
   * Parse register value from QEMU output
   */
  private parseRegister(output: string, registerName: string): number {
    // Look for pattern like "PORTB = 0x20" or "PORTB: 0x20"
    const patterns = [
      new RegExp(`${registerName}\\s*=\\s*0x([0-9a-fA-F]+)`, 'i'),
      new RegExp(`${registerName}\\s*:\\s*0x([0-9a-fA-F]+)`, 'i'),
      new RegExp(`${registerName}\\s+([0-9a-fA-F]+)h`, 'i')
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return parseInt(match[1], 16);
      }
    }

    // Default to 0 if not found
    return 0;
  }

  /**
   * Set GPIO pin state (write to QEMU)
   * @param pin Arduino pin number (0-19)
   * @param state 'HIGH' or 'LOW'
   */
  async setGPIOPin(pin: number, state: 'HIGH' | 'LOW'): Promise<void> {
    // Map pin to port and bit
    const { port, bit } = this.pinToPort(pin);
    const value = state === 'HIGH' ? 1 : 0;

    try {
      // Use QEMU monitor to write to GPIO register
      // This would require custom QEMU commands or using system_reset + memory write
      // For now, log it (will implement in future commits)
      console.log(`GPIO Write: ${port}.${bit} = ${value}`);
      
      // TODO: Implement actual GPIO write via QEMU monitor
      // await this.sendCommand(`writemem ${portAddress} ${value}`);
    } catch (error) {
      console.error('Error setting GPIO pin:', error);
      throw error;
    }
  }

  /**
   * Map Arduino pin number to AVR port and bit
   */
  private pinToPort(pin: number): { port: string; bit: number } {
    if (pin >= 0 && pin <= 7) {
      return { port: 'PORTD', bit: pin };
    } else if (pin >= 8 && pin <= 13) {
      return { port: 'PORTB', bit: pin - 8 };
    } else if (pin >= 14 && pin <= 19) {
      return { port: 'PORTC', bit: pin - 14 };
    }
    
    throw new Error(`Invalid pin number: ${pin}`);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }
}
