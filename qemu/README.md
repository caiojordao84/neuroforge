# 🔧 QEMU Integration - NeuroForge

## 📋 Overview

This directory contains everything related to QEMU integration with NeuroForge, including custom board implementations, patches, and build scripts.

---

## 📁 Directory Structure

```
qemu/
├── README.md              # This file
├── patches/               # Patches for QEMU upstream
│   └── rp2040/            # RP2040-specific patches
├── build/                 # Build scripts and configurations
│   ├── build-qemu.sh      # Main build script
│   └── configure-qemu.sh  # Configuration script
├── src/                   # QEMU source (git submodule)
│   └── (QEMU upstream)
└── docs/                  # Additional QEMU-related docs
    └── building.md        # Build instructions
```

---

## ⚡ Quick Start

### 1. Clone QEMU Source

```bash
cd qemu
git submodule add https://gitlab.com/qemu-project/qemu.git src
cd src
git checkout v9.0.0  # or latest stable
cd ../..
```

### 2. Apply RP2040 Patches

```bash
cd qemu/src
for patch in ../patches/rp2040/*.patch; do
    git am < "$patch"
done
```

### 3. Build QEMU

```bash
cd qemu
./build/build-qemu.sh
```

### 4. Test RP2040 Board

```bash
qemu/src/build/qemu-system-arm \
  -M raspberrypi-pico \
  -kernel firmware/rp2040/examples/blink/blink.elf \
  -serial stdio \
  -nographic
```

---

## 🔧 Current Implementations

### 🎯 RP2040 (Raspberry Pi Pico)

**Status:** 🟡 In Development (MVP Phase)  
**Branch:** `feature/rp2040-qemu-mvp`  
**Specification:** [`docs/boards/rp2040-qemu-implementation.md`](../../docs/boards/rp2040-qemu-implementation.md)

**Implemented Peripherals:**
- [ ] Dual-Core ARM Cortex-M0+ @ 133MHz
- [ ] Memory (ROM, SRAM, Flash)
- [ ] GPIO (30 pins with atomic operations)
- [ ] UART (2 instances, PL011-compatible)
- [ ] Timer (64-bit @ 1MHz with 4 alarms)
- [ ] USB (basic device detection)

**Integration:**
- [ ] Board descriptor: `boards/raspberrypi-pico.json`
- [ ] CLI support: `neuroforge run --board raspberrypi-pico`
- [ ] Serial-GPIO protocol
- [ ] Example firmware (blink, uart_echo, gpio_test)

---

## 📄 Patch Workflow

### Creating Patches

1. Make changes to QEMU source:
```bash
cd qemu/src
# Edit files...
git add .
git commit -m "hw/arm: Add RP2040 SoC support"
```

2. Generate patch:
```bash
git format-patch -1 HEAD -o ../patches/rp2040/
```

3. Test patch applies cleanly:
```bash
git reset --hard HEAD~1
git am < ../patches/rp2040/0001-*.patch
```

### Submitting to QEMU Upstream

Once stable, patches can be submitted to QEMU mailing list:
```bash
git send-email \
  --to=qemu-devel@nongnu.org \
  --cc=qemu-arm@nongnu.org \
  ../patches/rp2040/*.patch
```

---

## 🛠️ Build Configuration

### Minimal Build (ARM only)

```bash
cd qemu/src
./configure \
  --target-list=arm-softmmu \
  --enable-debug \
  --disable-werror
make -j$(nproc)
```

### Full Build (All architectures)

```bash
cd qemu/src
./configure --enable-debug --disable-werror
make -j$(nproc)
```

---

## 📚 Additional Resources

- **QEMU Documentation:** https://www.qemu.org/docs/master/
- **QEMU Source:** https://gitlab.com/qemu-project/qemu
- **ARM System Emulation:** https://www.qemu.org/docs/master/system/arm/
- **Device Development Guide:** https://www.qemu.org/docs/master/devel/

---

## 📝 Notes

- QEMU source is tracked as a **git submodule**
- Always work on feature branches
- Test patches on clean QEMU checkout before committing
- Keep patches atomic and well-documented
- Follow QEMU coding standards: https://www.qemu.org/docs/master/devel/style.html

---

**Last Updated:** 2026-02-07  
**Status:** 🟡 Active Development - RP2040 MVP
