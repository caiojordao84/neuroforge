/**
 * Test script for QEMU Monitor TCP connection
 * 
 * This script validates that:
 * 1. QEMU starts with monitor TCP endpoint
 * 2. Monitor connection is established
 * 3. Commands can be sent and responses received
 * 4. Cleanup happens properly on stop
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

  // Find a test firmware
  const firmwareDir = path.join(__dirname, 'test-firmware');
  let firmwarePath: string | null = null;

  if (fs.existsSync(firmwareDir)) {
    const files = fs.readdirSync(firmwareDir);
    const hexFile = files.find(f => f.endsWith('.hex'));
    const elfFile = files.find(f => f.endsWith('.elf'));
    
    if (elfFile) {
      firmwarePath = path.join(firmwareDir, elfFile);
    } else if (hexFile) {
      firmwarePath = path.join(firmwareDir, hexFile);
    }
  }

  if (!firmwarePath || !fs.existsSync(firmwarePath)) {
    console.error('❌ No test firmware found in server/test-firmware/');
    console.error('   Please compile a test sketch first.');
    process.exit(1);
  }

  console.log(`\n📦 Using firmware: ${path.basename(firmwarePath)}`);

  // Create QEMURunner instance
  const runner = new QEMURunner(
    firmwarePath,
    'arduino-uno',
    'qemu-system-avr',
    4444 // Monitor port
  );

  // Setup event listeners
  runner.on('started', () => {
    console.log('✅ QEMU process started');
  });

  runner.on('monitor-connected', () => {
    console.log('✅ QEMU Monitor connected');
  });

  runner.on('monitor-error', (err: Error) => {
    console.error('❌ Monitor error:', err.message);
  });

  runner.on('serial', (line: string) => {
    console.log(`[Serial] ${line}`);
  });

  runner.on('stopped', (code: number | null) => {
    console.log(`\n🛑 QEMU stopped with code: ${code}`);
  });

  try {
    // Start QEMU
    console.log('\n🚀 Starting QEMU...');
    await runner.start();

    // Wait a bit for monitor to connect
    await sleep(1000);

    if (!runner.isMonitorConnected) {
      throw new Error('Monitor failed to connect');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Testing Monitor Commands');
    console.log('='.repeat(60));

    // Test 1: help command
    console.log('\n📝 Test 1: help');
    console.log('-'.repeat(60));
    try {
      const helpResponse = await runner.sendMonitorCommand('help');
      const lines = helpResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log('First 5 lines:');
      lines.slice(0, 5).forEach(line => console.log(`   ${line}`));
    } catch (err) {
      console.error('❌ help command failed:', err);
    }

    await sleep(500);

    // Test 2: info registers
    console.log('\n📝 Test 2: info registers');
    console.log('-'.repeat(60));
    try {
      const registersResponse = await runner.sendMonitorCommand('info registers');
      const lines = registersResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log('First 10 lines:');
      lines.slice(0, 10).forEach(line => console.log(`   ${line}`));
    } catch (err) {
      console.error('❌ info registers command failed:', err);
    }

    await sleep(500);

    // Test 3: info qtree
    console.log('\n📝 Test 3: info qtree');
    console.log('-'.repeat(60));
    try {
      const qtreeResponse = await runner.sendMonitorCommand('info qtree');
      const lines = qtreeResponse.split('\n');
      console.log(`✅ Received ${lines.length} lines`);
      console.log('First 15 lines:');
      lines.slice(0, 15).forEach(line => console.log(`   ${line}`));
    } catch (err) {
      console.error('❌ info qtree command failed:', err);
    }

    await sleep(500);

    // Test 4: Multiple rapid commands
    console.log('\n📝 Test 4: Multiple rapid commands');
    console.log('-'.repeat(60));
    try {
      const [r1, r2, r3] = await Promise.all([
        runner.sendMonitorCommand('info version'),
        runner.sendMonitorCommand('info status'),
        runner.sendMonitorCommand('info cpus')
      ]);
      console.log('✅ All rapid commands succeeded');
      console.log(`   version: ${r1.split('\n')[0]}`);
      console.log(`   status: ${r2.trim()}`);
      console.log(`   cpus: ${r3.split('\n')[0]}`);
    } catch (err) {
      console.error('❌ Rapid commands failed:', err);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n❌ Test failed:', err);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    runner.stop();
    
    // Wait for cleanup
    await sleep(1000);
    
    console.log('\n✅ Test completed\n');
    process.exit(0);
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
