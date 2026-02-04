/**
 * Exemplo completo de integração ESP32 + QEMU + SerialGPIO
 * 
 * PASSO 1: Compilar firmware ESP-IDF:
 *   cd /path/to/esp-idf/examples/get-started/hello_world
 *   idf.py set-target esp32
 *   idf.py build
 *   idf.py qemu --no-monitor
 * 
 * PASSO 2: Copiar qemu_flash.bin e qemu_efuse.bin para server/test-firmware/esp32/
 * 
 * PASSO 3: Rodar este exemplo:
 *   cd server
 *   tsx example-gpio-esp32.ts
 */

import { QEMUSimulationEngine } from './src/services/QEMUSimulationEngine';
import { SerialGPIOService } from './SerialGPIOService';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('🚀 ESP32 + QEMU + SerialGPIO Example\n');

  // Configurar caminhos (ajustar para o seu ambiente)
  const flashPath = path.join(__dirname, 'test-firmware', 'esp32', 'qemu_flash.bin');
  const efusePath = path.join(__dirname, 'test-firmware', 'esp32', 'qemu_efuse.bin');

  // Validar existência dos arquivos
  if (!fs.existsSync(flashPath)) {
    console.error(`❌ Flash image not found: ${flashPath}`);
    console.log('\n📄 Please follow these steps:');
    console.log('1. Compile an ESP-IDF project with: idf.py build');
    console.log('2. Generate QEMU images with: idf.py qemu --no-monitor');
    console.log('3. Copy build/qemu_flash.bin and build/qemu_efuse.bin to server/test-firmware/esp32/');
    process.exit(1);
  }

  if (!fs.existsSync(efusePath)) {
    console.error(`❌ eFuse image not found: ${efusePath}`);
    process.exit(1);
  }

  const engine = new QEMUSimulationEngine();

  // Integrar SerialGPIOService
  const gpioService = new SerialGPIOService(engine as any); // Cast temporário

  // Eventos de GPIO
  gpioService.on('gpio-snapshot', (state) => {
    console.log('📊 [GPIO Snapshot]', {
      ports: state.ports,
      pins: Array.from(state.pins.entries()).slice(0, 5) // Mostrar apenas primeiros 5 pins
    });
  });

  gpioService.on('gpio-changes', (changes) => {
    for (const change of changes) {
      console.log(`🔄 [GPIO] Pin ${change.pin} changed: ${change.from} → ${change.to}`);
    }
  });

  // Eventos de serial
  engine.on('serial', (line) => {
    console.log(`📡 [Serial] ${line}`);
    
    // Processar protocolo GPIO
    gpioService.processLine(line);
  });

  engine.on('started', () => {
    console.log('✅ ESP32 simulation started!\n');
  });

  engine.on('stopped', () => {
    console.log('\n⏹️ ESP32 simulation stopped');
  });

  engine.on('error', (error) => {
    console.error('❌ Error:', error);
  });

  // Carregar firmware ESP32
  await engine.loadFirmware('dummy-path', 'esp32');

  // Configuração ESP32
  const esp32Config = {
    flash: {
      flashImagePath: flashPath,
      efuseImagePath: efusePath,
      serialPort: 5555
    },
    qemuOptions: {
      memory: '4M',
      wdtDisable: true,
      networkMode: 'user' as const
    }
  };

  // Iniciar simulação
  console.log('⚙️ Starting ESP32 backend...\n');
  await engine.start(esp32Config);

  // Aguardar 30 segundos
  console.log('⏳ Simulation running for 30 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Parar
  console.log('\n🛭 Stopping simulation...');
  engine.stop();
  
  console.log('✅ Example completed successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
