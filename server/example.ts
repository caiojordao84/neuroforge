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

  // Caminho correto: poc/ está na raiz do projeto, não dentro de server/
  const firmwarePath = path.join(
    __dirname,
    '../../poc/build/serial_test_serial_test/serial_test.ino.elf'
  );

  console.log(`[Engine] Carregando: ${firmwarePath}\n`);
  
  try {
    await engine.loadFirmware(firmwarePath, 'uno');
  } catch (err) {
    console.error('[Engine] ERRO ao carregar firmware:', err);
    console.log('\n[Engine] Certifique-se de que o firmware foi compilado:');
    console.log('  cd ../poc');
    console.log('  arduino-cli compile --fqbn arduino:avr:uno serial_test');
    console.log('\n[Engine] Ou use um firmware de exemplo existente.');
    process.exit(1);
  }

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
