import { EventEmitter } from 'events';
import * as net from 'net';

/**
 * Cliente TCP para conectar ao socket serial do QEMU ESP32
 * Converte stream TCP em eventos de linha (similar ao stdout do AVR)
 */
export class Esp32SerialClient extends EventEmitter {
  private client: net.Socket | null = null;
  private buffer: string = '';
  private port: number;
  private host: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(port: number = 5555, host: string = '127.0.0.1') {
    super();
    this.port = port;
    this.host = host;
  }

  /**
   * Conecta ao socket TCP do QEMU ESP32
   */
  async connect(timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.disconnect();
        reject(new Error(`Timeout connecting to ESP32 serial on ${this.host}:${this.port}`));
      }, timeout);

      this.client = net.connect({ port: this.port, host: this.host }, () => {
        clearTimeout(timeoutId);
        this.reconnectAttempts = 0;
        console.log(`✅ Connected to ESP32 serial: ${this.host}:${this.port}`);
        this.emit('connected');
        resolve();
      });

      this.setupClientHandlers();

      this.client.on('error', (error) => {
        clearTimeout(timeoutId);
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.warn(`⚠️ Serial connection error, retrying... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          this.reconnectAttempts++;
          setTimeout(() => this.connect(timeout), this.reconnectDelay);
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Configura handlers para eventos do socket
   */
  private setupClientHandlers(): void {
    if (!this.client) return;

    this.client.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();

      // Quebrar por linhas
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || ''; // Última linha incompleta volta pro buffer

      for (const line of lines) {
        if (line.trim()) {
          this.emit('line', line.trim());
        }
      }
    });

    this.client.on('close', () => {
      console.log('🔌 ESP32 serial disconnected');
      this.emit('disconnected');
    });

    this.client.on('error', (error) => {
      // Se ainda não estiver conectado, deixamos o handler do connect() cuidar do erro/retry
      if (!this.isConnected()) {
        return;
      }
      console.error('ESP32 serial error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Envia dados para o ESP32 (UART RX)
   */
  write(data: string): boolean {
    if (!this.client || this.client.destroyed) {
      console.error('Cannot write to disconnected serial');
      return false;
    }
    return this.client.write(data);
  }

  /**
   * Desconecta do socket TCP
   */
  disconnect(): void {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.buffer = '';
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.client !== null && !this.client.destroyed;
  }
}
