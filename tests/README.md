# 🧪 RP2040 Test Suite

## 📋 Overview

Automated test suite for RP2040 QEMU emulation validation.

---

## ⚡ Quick Start

### Run Tests

```powershell
# Default (uses C:\qemu-project\qemu-arm\build\qemu-system-arm.exe)
python tests\test_rp2040.py

# Custom QEMU path
python tests\test_rp2040.py --qemu-path "C:\path\to\qemu-system-arm.exe"

# Save report to custom location
python tests\test_rp2040.py --output my_report.json
```

---

## 📊 Test Coverage

### Test 1: Board Availability
- ✅ Verifies `raspberrypi-pico` board is registered
- ✅ Checks board appears in `-M help` output

### Test 2: Machine Initialization
- ✅ Tests machine starts without critical errors
- ✅ Validates no segmentation faults or assertion failures

### Test 3: Memory Regions
- ✅ Verifies ROM, SRAM, Flash regions configured
- ✅ Checks for memory allocation errors

### Test 4: Peripheral Registration
- ✅ Validates UART, GPIO, SIO peripherals present
- ✅ Checks device tree structure

### Test 5: Firmware Loading
- ✅ Tests ELF/binary loading mechanism
- ✅ Validates error handling for missing files

### Test 6: UART Configuration
- ✅ Verifies UART0/UART1 setup
- ✅ Tests serial port configuration

---

## 📄 Test Output

### Console Output

```
============================================================
  RP2040 QEMU Test Suite
============================================================

QEMU: C:\qemu-project\qemu-arm\build\qemu-system-arm.exe
Tests: 6 total

[TEST 1/6] Board Availability
  ✓ PASS - raspberrypi-pico board available

[TEST 2/6] Machine Initialization
  ✓ PASS - Machine initialized successfully

[TEST 3/6] Memory Regions
  ✓ PASS - Memory regions configured
    Found: rom, sram, flash

[TEST 4/6] Peripheral Registration
  ✓ PASS - Peripherals registered
    Detected: uart, gpio, sio

[TEST 5/6] Firmware Loading
  ✓ PASS - Firmware loader functional

[TEST 6/6] UART Configuration
  ✓ PASS - UART configured successfully

============================================================
  Test Summary
============================================================

Passed: 6/6
Failed: 0/6
Duration: 12.34s

✓ ALL TESTS PASSED!

Test report saved: test_report.json
```

### JSON Report (`test_report.json`)

```json
{
  "qemu_path": "C:\\qemu-project\\qemu-arm\\build\\qemu-system-arm.exe",
  "timestamp": "2026-02-07T10:30:00.123456",
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0
  },
  "tests": [
    {
      "name": "Board Availability",
      "passed": true,
      "message": "raspberrypi-pico board found",
      "duration": 1.23,
      "timestamp": "2026-02-07T10:30:01.234567"
    }
  ]
}
```

---

## 🔧 Requirements

### Python

- **Python 3.7+**
- No external dependencies (uses standard library only)

### QEMU

- **QEMU v9.x** with RP2040 support
- `qemu-system-arm` executable accessible

---

## 🐛 Troubleshooting

### "QEMU not found at ..."

**Solution:** Specify correct path:

```powershell
python tests\test_rp2040.py --qemu-path "C:\correct\path\qemu-system-arm.exe"
```

### "raspberrypi-pico board not available"

**Cause:** RP2040 not integrated into QEMU.

**Solution:** Run integration script:

```powershell
.\qemu\build\integrate-rp2040-windows.ps1
```

### Tests timeout

**Cause:** QEMU takes too long to start.

**Solution:** Increase timeout in `test_rp2040.py`:

```python
TEST_TIMEOUT = 10  # seconds (default: 5)
```

### Permission errors on Windows

**Solution:** Run PowerShell as Administrator:

```powershell
Start-Process powershell -Verb runAs
```

---

## 🚀 CI/CD Integration

### GitHub Actions Example

```yaml
name: RP2040 QEMU Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install QEMU
        run: |
          # Install QEMU (implement based on your setup)
      
      - name: Run Tests
        run: python tests\test_rp2040.py
      
      - name: Upload Test Report
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: test_report.json
```

---

## 📚 Extending Tests

### Adding New Test

Edit `test_rp2040.py`:

```python
def test_my_feature(self):
    """Test 7: My custom test"""
    print(f"\n{Colors.CYAN}[TEST 7/7] My Feature{Colors.RESET}")
    start = time.time()
    
    # Your test logic
    result = self.run_qemu(['-M', 'raspberrypi-pico', ...])
    duration = time.time() - start
    
    if result and some_condition:
        self.passed += 1
        self.results.append(TestResult(
            "My Feature",
            True,
            "Feature works correctly",
            duration
        ))
        print(f"  {Colors.GREEN}✓ PASS{Colors.RESET}")
        return True
    
    self.failed += 1
    self.results.append(TestResult(
        "My Feature",
        False,
        "Feature failed",
        duration
    ))
    print(f"  {Colors.RED}✗ FAIL{Colors.RESET}")
    return False
```

Then call it in `run_all_tests()`:

```python
self.test_my_feature()
```

---

## ✅ Success Criteria

**All tests passing means:**

- ✅ RP2040 board registered in QEMU
- ✅ Machine initializes without crashes
- ✅ Memory regions correctly mapped
- ✅ Peripherals (UART, GPIO) functional
- ✅ Firmware loading works
- ✅ Serial communication configured

**Ready to run real firmware!** 🎉
