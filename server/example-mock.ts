/**
 * Exemplo MOCK - Simulação sem QEMU real
 * Use quando não tiver arduino-cli ou QEMU instalado
 */

import { QEMUSimulationEngine } from './QEMUSimulationEngine';
import { EventEmitter } from 'events';

// Mock do QEMURunner
class MockQEMURunner extends EventEmitter {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private ledState = false;

  async start(): Promise<void> {
    console.log('[MockQEMU] Iniciando simulação mock...');
    this.isRunning = true;
    this.emit('started');

    // Simular serial output
    setTimeout(() => this.emit('serial', 'Arduino iniciado!'), 100);

    // Simular blink
    this.intervalId = setInterval(() => {
      this.ledState = !this.ledState;
      this.emit('serial', this.ledState ? 'LED ON' : 'LED OFF');
      this.emit('gpio-change', { pin: 13, value: this.ledState ? 1 : 0 });
    }, 1000);
  }

  stop(): void {
    console.log('[MockQEMU] Parando...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.isRunning = false;
    this.emit('stopped', 0);
  }

  get running(): boolean {
    return this.isRunning;
  }
}

async function main() {
  console.log('=== NeuroForge MOCK Example ===');
  console.log('(Simulação sem QEMU real)\n');

  const mockRunner = new MockQEMURunner();

  mockRunner.on('started', () => {
    console.log('[Engine] Iniciado');
  });

  mockRunner.on('stopped', () => {
    console.log('[Engine] Parado');
  });

  mockRunner.on('serial', (line: string) => {
    console.log('[Serial]', line);
  });

  mockRunner.on('gpio-change', ({ pin, value }: { pin: number, value: number }) => {
    console.log(`[GPIO] Pino ${pin} = ${value ? 'HIGH' : 'LOW'}`);
  });

  console.log('[Engine] Iniciando mock...\n');
  await mockRunner.start();

  console.log('[Engine] Rodando por 10 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n[Engine] Parando...');
  mockRunner.stop();

  console.log('\n=== Mock Concluído ===');
  console.log('\nPara usar QEMU real:');
  console.log('  1. Instale arduino-cli e QEMU');
  console.log('  2. Compile o firmware: cd test-firmware && arduino-cli compile --fqbn arduino:avr:uno blink');
  console.log('  3. Execute: npm run dev');
}

main().catch(console.error);
