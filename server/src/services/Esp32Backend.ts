import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { Esp32BackendConfig, Esp32RunnerHandle } from '../types/esp32.types';
import { Esp32SerialClient } from './Esp32SerialClient';

/**
 * Backend para executar QEMU ESP32 (qemu-system-xtensa)
 * Análogo ao QEMURunner, mas específico para arquitetura Xtensa
 */
export class Esp32Backend extends EventEmitter {
  private process: ChildProcess | null = null;
  private serialClient: Esp32SerialClient | null = null;
  private config: Esp32BackendConfig | null = null;
  private qemuPath: string;

  constructor(qemuPath?: string) {
    super();
    // Default: buscar no PATH ou usar variável de ambiente
    this.qemuPath = qemuPath 
      || process.env.ESP32_QEMU_PATH 
      || (process.platform === 'win32' 
        ? 'qemu-system-xtensa.exe' 
        : 'qemu-system-xtensa');
  }

  /**
   * Inicia o QEMU ESP32 com as imagens de flash e eFuse
   */
  async start(config: Esp32BackendConfig): Promise<void> {
    if (this.process) {
      throw new Error('ESP32 Backend is already running');
    }

    // Validar imagens
    if (!fs.existsSync(config.flash.flashImagePath)) {
      throw new Error(`Flash image not found: ${config.flash.flashImagePath}`);
    }
    if (!fs.existsSync(config.flash.efuseImagePath)) {
      throw new Error(`eFuse image not found: ${config.flash.efuseImagePath}`);
    }

    this.config = config;
    const serialPort = config.flash.serialPort || parseInt(process.env.ESP32_SERIAL_PORT || '5555');

    const args = this.buildQemuArgs(config, serialPort);

    console.log('🚀 Starting QEMU ESP32:', this.qemuPath);
    console.log('📋 Args:', args.join(' '));

    this.process = spawn(this.qemuPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.setupProcessHandlers();

    // Aguardar QEMU inicializar e abrir o socket TCP
    await this.waitForSerialPort(serialPort);

    // Conectar ao socket serial
    this.serialClient = new Esp32SerialClient(serialPort);
    await this.serialClient.connect();

    // Forward eventos de linha para o backend
    this.serialClient.on('line', (line: string) => {
      this.emit('serial', line);
    });

    this.emit('started');
  }

  /**
   * Configura handlers para eventos do processo QEMU
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.on('error', (error) => {
      console.error('❌ QEMU ESP32 process error:', error);
      this.emit('error', error);
    });

    this.process.on('exit', (code) => {
      console.log(`⏹️ QEMU ESP32 exited with code: ${code}`);
      this.cleanup();
      this.emit('stopped', code);
    });

    // Capturar stderr (avisos/erros do QEMU)
    if (this.process.stderr) {
      this.process.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          console.log(`[QEMU ESP32 stderr]: ${msg}`);
        }
      });
    }

    // Capturar stdout (diagnósticos do QEMU, não serial do firmware)
    if (this.process.stdout) {
      this.process.stdout.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          console.log(`[QEMU ESP32 stdout]: ${msg}`);
        }
      });
    }
  }

  /**
   * Constrói argumentos da linha de comando do QEMU ESP32
   */
  private buildQemuArgs(config: Esp32BackendConfig, serialPort: number): string[] {
    const memory = config.qemuOptions?.memory || process.env.ESP32_DEFAULT_MEMORY || '4M';
    const wdtDisable = config.qemuOptions?.wdtDisable !== false; // Default true
    const networkMode = config.qemuOptions?.networkMode || 'user';

    return [
      '-M', 'esp32',
      '-m', memory,
      '-drive', `file=${config.flash.flashImagePath},if=mtd,format=raw`,
      '-drive', `file=${config.flash.efuseImagePath},if=none,format=raw,id=efuse`,
      '-global', 'driver=nvram.esp32.efuse,property=drive,value=efuse',
      ...(wdtDisable ? ['-global', 'driver=timer.esp32.timg,property=wdt_disable,value=true'] : []),
      '-nic', `${networkMode},model=open_eth`,
      '-nographic',
      '-serial', `tcp::${serialPort},server,nowait`
    ];
  }

  /**
   * Aguarda o socket serial TCP estar disponível
   */
  private async waitForSerialPort(port: number, timeout: number = 5000): Promise<void> {
    const net = await import('net');
    const startTime = Date.now();

    console.log(`⏳ Waiting for ESP32 serial port ${port}...`);

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

        console.log(`✅ ESP32 serial port ${port} is ready`);
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    throw new Error(`Timeout waiting for ESP32 serial port ${port}`);
  }

  /**
   * Para o QEMU ESP32
   */
  stop(): void {
    console.log('⏹️ Stopping ESP32 Backend...');
    
    if (this.serialClient) {
      this.serialClient.disconnect();
      this.serialClient = null;
    }

    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }

    this.cleanup();
  }

  /**
   * Limpa recursos
   */
  private cleanup(): void {
    this.process = null;
    if (this.serialClient) {
      this.serialClient.disconnect();
      this.serialClient = null;
    }
  }

  /**
   * Verifica se está rodando
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Retorna informações de conexão serial
   */
  getSerialInfo(): { port: number; host: string } | null {
    if (!this.config) return null;
    return {
      port: this.config.flash.serialPort || 5555,
      host: '127.0.0.1'
    };
  }

  /**
   * Envia dados para o serial (UART RX do ESP32)
   */
  writeSerial(data: string): boolean {
    if (!this.serialClient || !this.serialClient.isConnected()) {
      console.error('Serial client not connected');
      return false;
    }
    return this.serialClient.write(data);
  }
}
