/**
 * QEMU GPIO Monitor Test Script
 *
 * Starts QEMUSimulationEngine with a test firmware and
 * logs real GPIO state changes (via QEMU Monitor) for pin 13.
 *
 * Usage (from server/):
 *   npx tsx example-gpio.ts
 */

import { QEMUSimulationEngine } from './QEMUSimulationEngine';
import * as path from 'path';
import * as fs from 'fs';

function findFirmware(): string | null {
  const possiblePaths = [
    // Server test-firmware
    path.join(__dirname, 'test-firmware', 'blink.elf'),
    path.join(__dirname, 'test-firmware', 'blink.hex'),

    // POC build directory (output of compile.ps1 -Sketch blink)
    path.join(__dirname, '..', 'poc', 'build', 'blink', 'blink.ino.elf'),
    path.join(__dirname, '..', 'poc', 'build', 'blink', 'blink.ino.hex'),
  ];

  for (const firmwarePath of possiblePaths) {
    if (fs.existsSync(firmwarePath)) {
      return firmwarePath;
    }
  }

  return null;
}

async function testGPIO() {
  console.log('='.repeat(60));
  console.log('QEMU GPIO Monitor Test');
  console.log('='.repeat(60));
  console.log();

  const firmwarePath = findFirmware();

  if (!firmwarePath) {
    console.error('❌ No compiled firmware found for GPIO test!');
    console.error();
    console.error('🛠️  Please compile a test sketch first:');
    console.error('  cd poc');
    console.error('  .\\compile.ps1 -Sketch blink');
    console.error();
    console.error('📍 Expected firmware at:');
    console.error('  poc/build/blink/blink.ino.elf');
    console.error();
    process.exit(1);
  }

  console.log('✅ Found firmware:', path.basename(firmwarePath));
  console.log('📍 Location:', firmwarePath);
  console.log();

  const engine = new QEMUSimulationEngine();

  engine.on('started', () => {
    console.log('✅ QEMU simulation started');
  });

  engine.on('stopped', () => {
    console.log('🛑 QEMU simulation stopped');
  });

  engine.on('serial', (line: string) => {
    console.log('[Serial]', line);
  });

  engine.on('pin-change', (event: { pin: number; value: number }) => {
    if (event.pin === 13) {
      console.log(`[GPIO] Pin 13 changed to ${event.value}`);
    }
  });

  await engine.loadFirmware(firmwarePath, 'uno');
  await engine.start();

  let counter = 0;
  const interval = setInterval(() => {
    counter++;
    const state = engine.getState();
    const d13 = engine.getPinState(13);
    console.log(`[Snapshot] D13 = ${d13}, cycleCount = ${state.cycleCount}`);

    if (counter >= 10) {
      clearInterval(interval);
      console.log();
      console.log('✅ GPIO test completed, stopping simulation...');
      engine.stop();
      setTimeout(() => process.exit(0), 500);
    }
  }, 1000);
}

// Run the test
testGPIO().catch(err => {
  console.error('Fatal error in GPIO test:', err);
  process.exit(1);
});
