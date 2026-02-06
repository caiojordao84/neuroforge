/**
 * Tipos específicos para ESP32 Backend
 */

import { ChildProcess } from 'child_process';

export interface Esp32FlashConfig {
  flashImagePath: string;      // qemu_flash.bin
  efuseImagePath: string;       // qemu_efuse.bin
  serialPort?: number;          // Porta TCP (default: 5555)
}

export interface Esp32QemuOptions {
  qemuPath?: string;            // Caminho para qemu-system-xtensa
  memory?: string;              // Tamanho da RAM (default: '4M')
  networkMode?: 'user' | 'tap' | 'none'; // Modo de rede (default: 'user')
  wdtDisable?: boolean;         // Desabilitar watchdog (default: true)
}

export interface Esp32BackendConfig {
  flash: Esp32FlashConfig;
  qemuOptions?: Esp32QemuOptions;
}

export interface Esp32RunnerHandle {
  process: ChildProcess;
  serialPort: number;
  flashPath: string;
  efusePath: string;
}
