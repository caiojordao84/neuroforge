# 🚀 ESP32 Setup Guide - NeuroForge

Complete guide to set up ESP32 simulation with QEMU in NeuroForge.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [ESP-IDF Installation](#esp-idf-installation)
3. [QEMU ESP32 Installation](#qemu-esp32-installation)
4. [Building ESP32 Firmware](#building-esp32-firmware)
5. [NeuroForge Configuration](#neuroforge-configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 1️⃣ Prerequisites

### System Requirements
- **Windows 10/11**, **Linux** (Ubuntu 20.04+), or **macOS** (10.15+)
- **Python 3.8+** (required for ESP-IDF)
- **Git** (for cloning ESP-IDF)
- **CMake** and **Ninja** (build tools)
- **Node.js 18+** (for NeuroForge backend)

### Disk Space
- ESP-IDF: ~2 GB
- QEMU ESP32: ~500 MB
- Toolchain: ~1 GB

---

## 2️⃣ ESP-IDF Installation

### Windows

```powershell
# Download ESP-IDF installer
# Visit: https://dl.espressif.com/dl/esp-idf/

# Or use Git (manual installation)
mkdir C:\esp
cd C:\esp
git clone -b v6.1 --recursive https://github.com/espressif/esp-idf.git

# Run installation script
cd esp-idf
.\install.ps1 esp32
```

### Linux / macOS

```bash
# Install dependencies (Ubuntu/Debian)
sudo apt-get install git wget flex bison gperf python3 python3-pip python3-venv cmake ninja-build ccache libffi-dev libssl-dev dfu-util libusb-1.0-0

# Clone ESP-IDF
mkdir -p ~/esp
cd ~/esp
git clone -b v6.1 --recursive https://github.com/espressif/esp-idf.git

# Run installation script
cd esp-idf
./install.sh esp32
```

### Activate ESP-IDF Environment

**Windows:**
```powershell
C:\esp\esp-idf\export.ps1
```

**Linux/Mac:**
```bash
. ~/esp/esp-idf/export.sh
```

---

## 3️⃣ QEMU ESP32 Installation

ESP-IDF includes a QEMU installation tool.

### Install via ESP-IDF Tools

```bash
# Activate ESP-IDF environment first (see above)

# Install QEMU
idf_tools.py install qemu-xtensa

# Verify installation
qemu-system-xtensa --version
```

### Expected Output
```
QEMU emulator version 8.2.0 (esp-develop-9.0.0-20240606)
```

### QEMU Data Path Detection

NeuroForge **auto-detects** the QEMU data path (ROM binaries location). However, if auto-detection fails:

**Windows:**
```
C:\Users\<user>\.espressif\tools\qemu-xtensa\esp_develop_9.0.0_20240606\qemu\share\qemu
```

**Linux:**
```
~/.espressif/tools/qemu-xtensa/esp_develop_9.0.0_20240606/qemu/share/qemu
```

**Mac:**
```
~/.espressif/tools/qemu-xtensa/esp_develop_9.0.0_20240606/qemu/share/qemu
```

---

## 4️⃣ Building ESP32 Firmware

### Option A: Use NeuroForge GPIO Blink Example

```bash
# Navigate to your ESP32 project
cd /path/to/your/esp32-project

# Configure for ESP32 target
idf.py set-target esp32

# Build firmware
idf.py build

# Generate QEMU images
idf.py qemu-flash
```

### Expected Output Files

After `idf.py qemu-flash`, you'll find in `build/`:
- `qemu_flash.bin` - Flash image (bootloader + app + partitions)
- `qemu_efuse.bin` - eFuse image (chip configuration)

### Option B: Start from Hello World Template

```bash
# Copy hello_world example
cp -r $IDF_PATH/examples/get-started/hello_world ~/my-esp32-project
cd ~/my-esp32-project

# Build
idf.py build
idf.py qemu-flash
```

### Copy Firmware to NeuroForge

```bash
# From your ESP32 project build directory:
cp build/qemu_flash.bin /path/to/neuroforge/server/test-firmware/esp32/
cp build/qemu_efuse.bin /path/to/neuroforge/server/test-firmware/esp32/
```

---

## 5️⃣ NeuroForge Configuration

### Update `.env` File

Navigate to `neuroforge/server/` and edit `.env`:

```bash
# ============================================================================
# QEMU ESP32 Configuration
# ============================================================================

# Path to qemu-system-xtensa (leave default if in PATH)
ESP32_QEMU_PATH=qemu-system-xtensa

# QEMU Data Path - LEAVE EMPTY FOR AUTO-DETECTION
# Only set if auto-detection fails
ESP32_QEMU_DATA_PATH=

# Serial port for UART communication
ESP32_SERIAL_PORT=5555

# ESP32 RAM size
ESP32_DEFAULT_MEMORY=4M
```

### Verify Auto-Detection

The backend will log the detected path:
```
📂 QEMU Data Path: /path/to/qemu/share (auto-detected from binary)
```

If you see:
```
📂 QEMU Data Path: using internal paths (no -L flag)
```

And QEMU fails to start, manually set `ESP32_QEMU_DATA_PATH`.

---

## 6️⃣ Testing

### Run Standalone Example

```bash
cd neuroforge/server
npx tsx example-gpio-esp32.ts
```

### Expected Output

```
╔════════════════════════════════════════════════════════╗
║   ESP32 Backend Test - NeuroForge QEMU Simulation     ║
╚════════════════════════════════════════════════════════╝

🔍 Validating prerequisites...

✅ Flash image: server/test-firmware/esp32/qemu_flash.bin
✅ eFuse image: server/test-firmware/esp32/qemu_efuse.bin
✅ Serial port: TCP 5555

🚀 Starting ESP32 Backend...

📂 QEMU Data Path: /path/to/qemu/share (auto-detected)
✅ ESP32 Backend started successfully

📡 Listening for serial output...
🔌 Watching for GPIO events (G:pin=X,v=Y)...

[Serial]: I (2840) neuroforge: 🚀 NeuroForge ESP32 GPIO Blink Example
🟢 GPIO Pin 13 = HIGH (OUTPUT)
🔴 GPIO Pin 13 = LOW (OUTPUT)
```

Press `Ctrl+C` to stop.

---

## 7️⃣ Troubleshooting

### ❌ QEMU Not Found

**Error:**
```
ENOENT: qemu-system-xtensa not found
```

**Solution:**
1. Activate ESP-IDF environment: `. ~/esp/esp-idf/export.sh`
2. Or set full path in `.env`: `ESP32_QEMU_PATH=/full/path/to/qemu-system-xtensa`

---

### ❌ ROM File Not Found

**Error:**
```
qemu-system-xtensa: Could not open ROM image 'esp32_rom.bin'
```

**Solution:**
Set `ESP32_QEMU_DATA_PATH` manually in `.env`:

**Windows:**
```bash
ESP32_QEMU_DATA_PATH=C:\Users\<user>\.espressif\tools\qemu-xtensa\...\share\qemu
```

**Linux/Mac:**
```bash
ESP32_QEMU_DATA_PATH=~/.espressif/tools/qemu-xtensa/.../qemu/share/qemu
```

---

### ❌ SLIRP Network Error

**Error:**
```
network backend 'user' is not compiled into this binary
```

**Solution:**
This is a known limitation of some QEMU builds. NeuroForge automatically uses `networkMode: 'none'` as fallback.

To force it in code:
```typescript
qemuOptions: {
  networkMode: 'none'
}
```

---

### ❌ Serial Port Timeout

**Error:**
```
Timeout waiting for ESP32 serial port 5555
```

**Solutions:**
1. Check if port 5555 is already in use: `netstat -an | grep 5555`
2. Change port in `.env`: `ESP32_SERIAL_PORT=5556`
3. Increase timeout (code modification required)

---

### ❌ Firmware Not Responding

**Symptoms:**
- QEMU starts but no serial output
- No GPIO events

**Checklist:**
1. ✅ Firmware built with `idf.py qemu-flash` (not regular `flash`)
2. ✅ Both `qemu_flash.bin` and `qemu_efuse.bin` present
3. ✅ Firmware includes GPIO protocol code (`G:pin=X,v=Y`)

---

## 📚 Additional Resources

- [ESP-IDF Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [QEMU ESP32 Repository](https://github.com/espressif/qemu)
- [NeuroForge Serial GPIO Protocol](../serial-gpio-protocol.md)
- [ESP32 Backend Architecture](../architecture/backends.md)

---

## 🎯 Next Steps

Once ESP32 backend is working:
1. Test with more complex firmwares
2. Integrate into `QEMUSimulationEngine`
3. Connect to frontend UI
4. Add more ESP32 boards (S3, C3, etc.)

---

**Last Updated:** February 6, 2026  
**Tested With:** ESP-IDF v6.1, QEMU 8.2.0 (esp-develop-9.0.0)
