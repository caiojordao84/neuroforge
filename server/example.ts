import { QEMUSimulationEngine } from './QEMUSimulationEngine';
import * as path from 'path';

async function main() {
  console.log('=== NeuroForge QEMU Example ===\n');

  const engine = new QEMUSimulationEngine();

  engine.on('started', () => {
    console.log('[Engine] Iniciado');
  });

  engine.on('stopped', () => {
    console.log('[Engine] Parado');
  });

  engine.on('serial', (line: string) => {
    console.log('[Serial]', line);
  });

  engine.on('pin-change', ({ pin, value }: { pin: number, value: number }) => {
    console.log(`[GPIO] Pino ${pin} = ${value ? 'HIGH' : 'LOW'}`);
  });

  const firmwarePath = path.join(
    __dirname,
    '../poc/build/serial_test_serial_test/serial_test.ino.elf'
  );

  console.log(`[Engine] Carregando: ${firmwarePath}\n`);
  await engine.loadFirmware(firmwarePath, 'uno');

  console.log('[Engine] Iniciando...\n');
  await engine.start();

  console.log('[Engine] Rodando por 10 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n[Engine] Parando...');
  engine.stop();

  const state = engine.getState();
  console.log('\n=== Estado Final ===');
  console.log('Linhas serial:', state.serialOutput.length);
  console.log('Ciclos:', state.cycleCount);
}

main().catch(console.error);
