/**
 * Exemplo de uso do QEMUSimulationEngine
 * 
 * Este arquivo demonstra como integrar o QEMU no NeuroForge.
 */

import { QEMUSimulationEngine } from './QEMUSimulationEngine';
import * as path from 'path';

async function main() {
  console.log('=== NeuroForge QEMU Example ===\n');

  // 1. Criar engine
  const engine = new QEMUSimulationEngine();

  // 2. Configurar listeners
  engine.on('started', () => {
    console.log('[Engine] Simulação iniciada');
  });

  engine.on('stopped', () => {
    console.log('[Engine] Simulação parada');
  });

  engine.on('serial', (line) => {
    console.log('[Serial]', line);
  });

  engine.on('pin-change', ({ pin, value }) => {
    console.log(`[GPIO] Pino ${pin} = ${value ? 'HIGH' : 'LOW'}`);
  });

  // 3. Carregar firmware (do POC)
  const firmwarePath = path.join(
    __dirname,
    '../../poc/build/serial_test_serial_test/serial_test.ino.elf'
  );

  console.log(`[Engine] Carregando firmware: ${firmwarePath}\n`);
  await engine.loadFirmware(firmwarePath, 'uno');

  // 4. Iniciar simulação
  console.log('[Engine] Iniciando simulação...\n');
  await engine.start();

  // 5. Deixar rodar por 10 segundos
  console.log('[Engine] Rodando por 10 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // 6. Testar injeção de input (botão no pino 2)
  console.log('\n[Engine] Simulando botão pressionado no pino 2');
  await engine.setPin(2, 1);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await engine.setPin(2, 0);

  // 7. Enviar dados para Serial RX
  console.log('[Engine] Enviando dados para Serial RX');
  await engine.sendSerial('Hello from NeuroForge!\n');

  // 8. Esperar mais 5 segundos
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 9. Parar simulação
  console.log('\n[Engine] Parando simulação...');
  engine.stop();

  // 10. Mostrar estado final
  const state = engine.getState();
  console.log('\n=== Estado Final ===');
  console.log('Serial output lines:', state.serialOutput.length);
  console.log('Cycles executed:', state.cycleCount);
  console.log('GPIO states:', state.gpioStates);
}

// Executar
if (require.main === module) {
  main().catch(console.error);
}
