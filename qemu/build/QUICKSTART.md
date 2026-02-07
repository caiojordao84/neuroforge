# ⚡ Quick Start - RP2040 QEMU Integration

## 👉 **SINGLE COMMAND SOLUTION**

### **Step 1: Open MSYS2 MINGW64**

1. Launch: `C:\msys64\mingw64.exe`
2. Navigate to NeuroForge:

```bash
cd /d/Documents/NeuroForge
```

### **Step 2: Run Integration Script**

```bash
bash qemu/build/integrate-rp2040-msys2.sh
```

**That's it!** The script will:
- ✅ Validate environment
- ✅ Copy RP2040 source files
- ✅ Update meson.build
- ✅ Update Kconfig
- ✅ Rebuild QEMU (~1-2 minutes)
- ✅ Verify board availability

---

## ✅ **Expected Output**

```
================================================
  RP2040 Integration for Existing QEMU
================================================

[INFO] Configuration:
  QEMU Path: /c/qemu-project/qemu-arm
  NeuroForge: /d/Documents/NeuroForge
  Patches: /d/Documents/NeuroForge/qemu/patches/rp2040

[STEP 1/5] Validating environment...
  [OK] QEMU installation found
  [OK] hw/arm directory exists
  [OK] QEMU build system ready

[STEP 2/5] Copying RP2040 source files...
  [OK] Copied rp2040.h
  [OK] Copied rp2040_soc.c
  [OK] Copied raspberrypi_pico.c

[STEP 3/5] Updating meson.build...
  [OK] meson.build updated

[STEP 4/5] Updating Kconfig...
  [OK] Kconfig updated

[STEP 5/5] Rebuilding QEMU...
  This may take 1-5 minutes (incremental build)...

  Reconfiguring Meson...
  Building with Ninja...
  [458/458] Linking target qemu-system-arm.exe

  [OK] Build completed successfully

================================================
  RP2040 Integration Complete!
================================================

[VERIFICATION] Testing RP2040 board...

  [OK] raspberrypi-pico board available!

raspberrypi-pico     Raspberry Pi Pico (RP2040)

================================================
  NEXT STEPS
================================================

1. Build firmware:
   cd /d/Documents/NeuroForge/firmware/rp2040/examples/blink
   make

2. Run on QEMU:
   /c/qemu-project/qemu-arm/build/qemu-system-arm.exe -M raspberrypi-pico -kernel blink.elf -nographic

3. Exit QEMU: Press Ctrl+A then X
```

---

## 🐛 **Troubleshooting**

### "QEMU not found at /c/qemu-project/qemu-arm"

**Edit script line 13:**
```bash
nano qemu/build/integrate-rp2040-msys2.sh
# Change QEMU_PATH to your actual path
```

### "Build failed"

**Check compilation errors:**
```bash
cd /c/qemu-project/qemu-arm/build
ninja 2>&1 | less
```

### "raspberrypi-pico board not found"

**Verify files copied:**
```bash
ls -la /c/qemu-project/qemu-arm/hw/arm/rp2040*
```

**Check meson.build:**
```bash
grep rp2040 /c/qemu-project/qemu-arm/hw/arm/meson.build
```

---

## 🚀 **Next: Build and Run Firmware**

### **Build Blink Example**

```bash
cd /d/Documents/NeuroForge/firmware/rp2040/examples/blink
make
```

### **Run on QEMU**

```bash
/c/qemu-project/qemu-arm/build/qemu-system-arm.exe \
  -M raspberrypi-pico \
  -kernel blink.elf \
  -nographic
```

**Exit:** `Ctrl+A` then `X`

---

## 🧪 **Run Tests**

```bash
# From NeuroForge root
python tests/test_rp2040.py --qemu-path "/c/qemu-project/qemu-arm/build/qemu-system-arm.exe"
```

---

## 🎉 **Success Criteria**

- ✅ Script completes without errors
- ✅ `qemu-system-arm -M help` shows `raspberrypi-pico`
- ✅ Firmware compiles without errors
- ✅ QEMU runs firmware successfully
- ✅ All tests pass

**Congratulations! RP2040 QEMU is ready!** 🌟
