# QEMU Monitor Connection

## Overview

The `QEMURunner` now supports connecting to the QEMU Monitor via TCP socket. This allows sending commands to inspect and control the running QEMU instance in real-time.

## How It Works

1. **QEMU starts with monitor endpoint**
   ```bash
   qemu-system-avr -monitor tcp:127.0.0.1:4444,server,nowait ...
   ```

2. **Node.js connects to TCP socket**
   - Automatically connects after QEMU process starts
   - Retry logic (5 attempts with 200ms delay)
   - Emits `'monitor-connected'` event on success

3. **Send commands and receive responses**
   - Use `sendMonitorCommand(cmd)` method
   - Returns a Promise with the response string
   - Handles command queuing and timeouts

## API

### `sendMonitorCommand(cmd: string, timeoutMs = 500): Promise<string>`

Sends a command to the QEMU Monitor and waits for the response.

**Parameters:**
- `cmd`: Command to send (without trailing newline)
- `timeoutMs`: Timeout in milliseconds (default: 500ms)

**Returns:**
- Promise that resolves with the command output (cleaned of echo and prompt)

**Throws:**
- `Error('QEMU monitor not connected')` if monitor is not ready
- `Error('QEMU monitor command timeout')` if command exceeds timeout

**Example:**
```typescript
const registers = await runner.sendMonitorCommand('info registers');
console.log(registers);
```

## Useful Monitor Commands

### System Information
```
help                    # List all available commands
info version            # QEMU version
info status             # VM status (running/paused)
info cpus               # CPU information
```

### CPU and Registers
```
info registers          # Dump all CPU registers
info registers -a       # All registers including internal
print $r0               # Read specific register (AVR)
```

### Memory
```
info mem                # Memory mappings
x /10xb 0x800100        # Examine 10 bytes at address (hex)
xp /10xb 0x800100       # Examine physical memory
```

### Device Tree
```
info qtree              # Show device tree
info mtree              # Show memory tree
info irq                # Show IRQ statistics
```

### Control
```
stop                    # Pause execution
cont                    # Continue execution
quit                    # Terminate QEMU
```

## Testing

### Run the test script

```bash
cd server
npm run test:monitor
```

This will:
1. Find a test firmware in `server/test-firmware/`
2. Start QEMU with monitor enabled
3. Connect to the monitor
4. Execute test commands:
   - `help`
   - `info registers`
   - `info qtree`
   - Multiple rapid commands
5. Display results
6. Clean up and exit

### Expected Output

```
============================================================
QEMU Monitor Connection Test
============================================================

📦 Using firmware: blink.elf

🚀 Starting QEMU...
[QEMURunner] Iniciando: qemu-system-avr ...
✅ QEMU process started
[QEMURunner] Conectando ao QEMU Monitor em 127.0.0.1:4444...
[QEMURunner] Monitor conectado!
✅ QEMU Monitor connected

============================================================
Testing Monitor Commands
============================================================

📝 Test 1: help
------------------------------------------------------------
✅ Received 87 lines
First 5 lines:
   info version -- show the version of QEMU
   info network -- show the network state
   ...

📝 Test 2: info registers
------------------------------------------------------------
✅ Received 35 lines
First 10 lines:
   PC:    00000000
   SP:    00000000
   rampD: 00
   rampX: 00
   ...
```

## Events

The `QEMURunner` emits the following monitor-related events:

- **`'monitor-connected'`**: Monitor TCP connection established
- **`'monitor-error'`**: Monitor connection error (with Error object)

## Configuration

The monitor port can be configured via:

1. **Constructor parameter:**
   ```typescript
   const runner = new QEMURunner(firmware, 'arduino-uno', 'qemu-system-avr', 5555);
   ```

2. **Environment variable:**
   ```bash
   export QEMU_MONITOR_PORT=5555
   ```

3. **Default:** Port `4444`

## Error Handling

```typescript
try {
  const result = await runner.sendMonitorCommand('info registers');
  console.log(result);
} catch (err) {
  if (err.message === 'QEMU monitor not connected') {
    console.error('Monitor not ready yet');
  } else if (err.message === 'QEMU monitor command timeout') {
    console.error('Command took too long');
  } else {
    console.error('Unexpected error:', err);
  }
}
```

## Next Steps

With the monitor connection working, the next phase is:

1. **Parse GPIO registers** from `info registers` output
2. **Map AVR registers to Arduino pins** (PORTB → pins 8-13, etc.)
3. **Poll GPIO state periodically** (e.g., 20 FPS)
4. **Emit `pinChange` events** to update frontend LEDs in real-time
5. **Implement GPIO write** to simulate button presses

See `docs/fixes.md` → FIX 2.10 for the full roadmap.

## Troubleshooting

### Monitor not connecting

- Check if port 4444 is already in use
- Verify QEMU is compiled with monitor support
- Try increasing retry count or delay

### Commands timing out

- Some commands like `info qtree` can be slow
- Increase timeout: `sendMonitorCommand('info qtree', 2000)`

### Garbled responses

- Monitor might echo commands differently
- Check the response parsing logic in `processMonitorBuffer()`

## References

- [QEMU Monitor Documentation](https://qemu.readthedocs.io/en/latest/system/monitor.html)
- [QEMU AVR Documentation](https://qemu.readthedocs.io/en/latest/system/target-avr.html)
- [Arduino Uno Pin Mapping](https://www.arduino.cc/en/Hacking/PinMapping168)
