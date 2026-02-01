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

async function testMonitor() {
  console.log('='.repeat(60));
  console.log('QEMU Monitor Connection Test');
  console.log('='.repeat(60));
  console.log();

  // Find a test firmware
  const firmwarePath = path.join(__dirname, 'test-firmware', 'blink.hex');
  
  if (!fs.existsSync(firmwarePath)) {
    console.error('❌ Test firmware not found:', firmwarePath);
    console.error('Please compile a test sketch first.');
    console.error('Example: cd poc/qemu-avr-test && .\\compile.ps1');
    process.exit(1);
  }

  console.log('📁 Using firmware:', firmwarePath);
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
      console.log(helpResponse);
      console.log('-'.repeat(60));
      console.log('✅ Command "help" succeeded');
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
      console.log(registersResponse);
      console.log('-'.repeat(60));
      console.log('✅ Command "info registers" succeeded');
      console.log();
    } catch (err) {
      console.error('❌ Command "info registers" failed:', (err as Error).message);
      console.log();
    }

    // Wait a bit before stopping
    await sleep(500);

    // Monitor status
    console.log('📊 Monitor Status:');
    console.log('  - Connected:', runner.isMonitorConnected);
    console.log('  - Running:', runner.running);
    console.log();

  } catch (err) {
    console.error('❌ Test failed:', (err as Error).message);
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
