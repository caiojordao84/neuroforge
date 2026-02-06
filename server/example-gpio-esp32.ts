/**
 * Exemplo standalone para testar ESP32 Backend
 * 
 * Este script testa o Esp32Backend e Esp32SerialClient isoladamente,
 * sem depender do QEMUSimulationEngine (que já tem AVR funcionando).
 * 
 * PRÉ-REQUISITOS:
 * 1. QEMU ESP32 instalado (qemu-system-xtensa)
 * 2. Firmware compilado em server/test-firmware/esp32/
 *    - qemu_flash.bin
 *    - qemu_efuse.bin
 * 
 * USO:
 *   cd server
 *   npx tsx example-gpio-esp32.ts
 * 
 * O que este exemplo faz:
 * - Inicia o QEMU ESP32 com firmware de teste
 * - Conecta ao serial TCP (porta 5555)
 * - Parseia linhas do protocolo GPIO (G:pin=X,v=Y)
 * - Exibe eventos de mudança de pinos no console
 * - Mantém rodando até Ctrl+C
 */

import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente do .env
dotenv.config();

import { Esp32Backend } from './src/services/Esp32Backend';
import { SerialGPIOParser } from './src/services/SerialGPIOParser';
import type { Esp32BackendConfig } from './src/types/esp32.types';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const FIRMWARE_DIR = path.join(__dirname, 'test-firmware', 'esp32');
const FLASH_IMAGE = path.join(FIRMWARE_DIR, 'qemu_flash.bin');
const EFUSE_IMAGE = path.join(FIRMWARE_DIR, 'qemu_efuse.bin');
const SERIAL_PORT = 5555;

// ============================================================================
// VALIDAÇÃO DE PRÉ-REQUISITOS
// ============================================================================

function validatePrerequisites(): void {
  console.log('🔍 Validating prerequisites...\n');

  // 1. Verificar se diretório de firmware existe
  if (!fs.existsSync(FIRMWARE_DIR)) {
    console.error(`❌ Firmware directory not found: ${FIRMWARE_DIR}`);
    console.log('\n📝 Create it with:');
    console.log(`   mkdir -p ${FIRMWARE_DIR}`);
    process.exit(1);
  }

  // 2. Verificar imagens de firmware
  const missingFiles: string[] = [];

  if (!fs.existsSync(FLASH_IMAGE)) {
    missingFiles.push('qemu_flash.bin');
  }

  if (!fs.existsSync(EFUSE_IMAGE)) {
    missingFiles.push('qemu_efuse.bin');
  }

  if (missingFiles.length > 0) {
    console.error(`❌ Missing firmware files in ${FIRMWARE_DIR}:`);
    missingFiles.forEach(file => console.error(`   - ${file}`));
    console.log('\n📝 Build ESP32 firmware with:');
    console.log('   idf.py build');
    console.log('   idf.py qemu-flash');
    console.log(`\n   Then copy the files to ${FIRMWARE_DIR}`);
    process.exit(1);
  }

  console.log(`✅ Flash image: ${FLASH_IMAGE}`);
  console.log(`✅ eFuse image: ${EFUSE_IMAGE}`);
  console.log(`✅ Serial port: TCP ${SERIAL_PORT}\n`);
}

// ============================================================================
// EXEMPLO PRINCIPAL
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   ESP32 Backend Test - NeuroForge QEMU Simulation     ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Validar pré-requisitos
  validatePrerequisites();

  // Criar instâncias
  const backend = new Esp32Backend();
  const gpioParser = new SerialGPIOParser();

  // ====================================
  // Event Handlers: Backend
  // ====================================

  backend.on('started', () => {
    console.log('\n✅ ESP32 Backend started successfully\n');
    console.log('📡 Listening for serial output...');
    console.log('🔌 Watching for GPIO events (G:pin=X,v=Y)...');
    console.log('⏹️  Press Ctrl+C to stop\n');
    console.log('─'.repeat(60));
  });

  backend.on('stopped', (code) => {
    console.log(`\n⏹️  ESP32 Backend stopped (exit code: ${code})`);
    process.exit(code || 0);
  });

  backend.on('error', (error) => {
    console.error('\n❌ Backend error:', error);
    process.exit(1);
  });

  backend.on('serial', (line: string) => {
    // Exibir todas as linhas serial (incluindo debug do ESP32)
    console.log(`[Serial]: ${line}`);

    // Enviar para parser GPIO
    gpioParser.processLine(line);
  });

  // ====================================
  // Event Handlers: GPIO Parser
  // ====================================

  gpioParser.on('pin-change', (update) => {
    const { pin, value, mode } = update;
    const emoji = value === 1 ? '🟢' : '🔴';
    const state = value === 1 ? 'HIGH' : 'LOW';

    console.log(`${emoji} GPIO Pin ${pin} = ${state}${mode ? ` (${mode})` : ''}`);
  });

  // ====================================
  // Configuração do Backend
  // ====================================

  const config: Esp32BackendConfig = {
    flash: {
      flashImagePath: FLASH_IMAGE,
      efuseImagePath: EFUSE_IMAGE,
      serialPort: SERIAL_PORT
    },
    qemuOptions: {
      memory: '4M',
      networkMode: 'none',
      wdtDisable: true
    }
  };

  // ====================================
  // Graceful Shutdown
  // ====================================

  const shutdown = () => {
    console.log('\n\n🛑 Shutting down...');
    backend.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // ====================================
  // Iniciar Backend
  // ====================================

  try {
    console.log('🚀 Starting ESP32 Backend...\n');
    await backend.start(config);
  } catch (error) {
    console.error('\n❌ Failed to start ESP32 Backend:', error);

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.log('\n💡 Tip: Make sure qemu-system-xtensa is in your PATH');
        console.log('   Or set ESP32_QEMU_PATH in your .env file');
      } else if (error.message.includes('not found')) {
        console.log('\n💡 Tip: Check if firmware files exist:');
        console.log(`   ${FLASH_IMAGE}`);
        console.log(`   ${EFUSE_IMAGE}`);
      }
    }

    process.exit(1);
  }
}

// ============================================================================
// EXECUTAR
// ============================================================================

main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
