/**
 * QEMU Monitor Connection Test Script
 * 
 * Tests the QEMU Monitor TCP connection by:
 * 1. Starting QEMU with a test firmware
 * 2. Connecting to the monitor via TCP
 * 3. Sending test commands (help, info registers)
 * 4. Displaying responses
 * 5. Cleanly stopping QEMU
 * 
 * Usage:
 *   npm run test:monitor
 */

import { QEMURunner } from './QEMURunner';
import * as path from 'path';
import * as fs from 'fs';

function findFirmware(): string | null {
  // Possible firmware locations (in order of preference)
  const possiblePaths = [
    // Server test-firmware
    path.join(__dirname, 'test-firmware', 'blink.elf'),
    path.join(__dirname, 'test-firmware', 'blink.hex'),

    // POC build directory (output of compile.ps1)
    path.join(__dirname, '..', 'poc', 'build', 'blink', 'blink.ino.elf'),
    path.join(__dirname, '..', 'poc', 'build', 'blink', 'blink.ino.hex'),
    path.join(__dirname, '..', 'poc', 'build', 'serial_test', 'serial_test.ino.elf'),
    path.join(__dirname, '..', 'poc', 'build', 'serial_test', 'serial_test.ino.hex'),
    path.join(__dirname, '..', 'poc', 'build', 'gpio_test', 'gpio_test.ino.elf'),
    path.join(__dirname, '..', 'poc', 'build', 'gpio_test', 'gpio_test.ino.hex'),

    // Original POC build directory (legacy support)
    path.join(__dirname, '..', 'poc', 'build', 'blink.ino.elf'),
    path.join(__dirname, '..', 'poc', 'blink', 'build', 'blink.ino.elf'),
    path.join(__dirname, '..', 'poc', 'blink', 'build', 'blink.ino.hex'),
    path.join(__dirname, '..', 'poc', 'serial_test', 'build', 'serial_test.ino.elf'),
    path.join(__dirname, '..', 'poc', 'serial_test', 'build', 'serial_test.ino.hex'),
    path.join(__dirname, '..', 'poc', 'gpio_test', 'build', 'gpio_test.ino.elf'),
    path.join(__dirname, '..', 'poc', 'gpio_test', 'build', 'gpio_test.ino.hex'),
  ];

  for (const firmwarePath of possiblePaths) {
    if (fs.existsSync(firmwarePath)) {
      return firmwarePath;
    }
  }

  return null;
}

async function testMonitor() {
  console.log('='.repeat(60));
  console.log('QEMU Monitor Connection Test');
  console.log('='.repeat(60));
  console.log();

  // Find a test firmware
  const firmwarePath = findFirmware();

  if (!firmwarePath) {
    console.error('❌ No compiled firmware found!');
    console.error();
    console.error('🛠️  Please compile a test sketch first:');
    console.error();
    console.error('Option 1 - Compile in POC directory:');
    console.error('  cd poc');
    console.error('  .\\compile.ps1 blink');
    console.error();
    console.error('Option 2 - Use Arduino CLI directly:');
    console.error('  cd poc/blink');
    console.error('  arduino-cli compile --fqbn arduino:avr:uno .');
    console.error();
    console.error('📍 The firmware will be created in:');
    console.error('  poc/build/blink.ino.elf');
    console.error();
    process.exit(1);
  }

  console.log('✅ Found firmware:', path.basename(firmwarePath));
  console.log('📍 Location:', firmwarePath);
  console.log();

  // Create QEMU runner with monitor on port 4444
  const runner = new QEMURunner(firmwarePath, 'uno', 'qemu-system-avr', 4444);

  // Listen for events
  runner.on('started', () => {
    console.log('✅ QEMU started');
  });

  runner.on('monitor-connected', () => {
    console.log('✅ Monitor connected');
  });

  runner.on('monitor-error', (err: Error) => {
    console.error('❌ Monitor error:', err.message);
  });

  runner.on('serial', (line: string) => {
    console.log('[Serial]', line);
  });

  runner.on('stopped', (code: number | null) => {
    console.log(`🛑 QEMU stopped with code: ${code}`);
  });

  try {
    // Start QEMU
    console.log('🚀 Starting QEMU...');
    await runner.start();
    console.log();

    // Wait a bit for everything to stabilize
    await sleep(1000);

    // Test 1: Send 'help' command
    console.log('📤 Sending command: help');
    console.log('-'.repeat(60));
    try {
      const helpResponse = await runner.sendMonitorCommand('help', 1000);
      const lines = helpResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log();
      console.log('First 10 lines:');
      lines.slice(0, 10).forEach(line => console.log('  ', line));
      console.log();
    } catch (err) {
      console.error('❌ Command "help" failed:', (err as Error).message);
      console.log();
    }

    // Wait a bit between commands
    await sleep(500);

    // Test 2: Send 'info registers' command
    console.log('📤 Sending command: info registers');
    console.log('-'.repeat(60));
    try {
      const registersResponse = await runner.sendMonitorCommand('info registers', 1000);
      const lines = registersResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log();
      console.log('First 10 lines:');
      lines.slice(0, 10).forEach(line => console.log('  ', line));
      console.log();
    } catch (err) {
      console.error('❌ Command "info registers" failed:', (err as Error).message);
      console.log();
    }

    // Wait a bit between commands
    await sleep(500);

    // Test 3: Send 'info qtree' command
    console.log('📤 Sending command: info qtree');
    console.log('-'.repeat(60));
    try {
      const qtreeResponse = await runner.sendMonitorCommand('info qtree', 1000);
      const lines = qtreeResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log();
    } catch (err) {
      console.error('❌ Command "info qtree" failed:', (err as Error).message);
      console.log();
    }

    // Test 4: Multiple rapid commands
    console.log('📤 Test 4: Multiple rapid commands');
    console.log('-'.repeat(60));
    try {
      const promises = [
        runner.sendMonitorCommand('info version'),
        runner.sendMonitorCommand('info network'),
        runner.sendMonitorCommand('info cpus'),
      ];
      await Promise.all(promises);
      console.log('✅ All rapid commands succeeded');
      console.log();
    } catch (err) {
      console.error('❌ Rapid commands failed:', (err as Error).message);
      console.log();
    }

    // Monitor status
    console.log('📊 Monitor Status:');
    console.log('  - Connected:', runner.isMonitorConnected);
    console.log('  - Running:', runner.running);
    console.log();

  } catch (err) {
    console.error('❌ Test failed:', (err as Error).message);
    console.error();
    console.error('🛠️  Troubleshooting:');
    console.error('  1. Make sure qemu-system-avr is installed and in PATH');
    console.error('  2. Check if port 4444 is available (netstat -an | findstr 4444)');
    console.error('  3. Try running: qemu-system-avr --version');
    console.error();
  } finally {
    // Always stop QEMU
    console.log('🛑 Stopping QEMU...');
    runner.stop();

    // Give it time to clean up
    await sleep(500);

    console.log();
    console.log('='.repeat(60));
    console.log('Test completed');
    console.log('='.repeat(60));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testMonitor().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
