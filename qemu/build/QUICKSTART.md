# ⚡ Quick Start - RP2040 QEMU Integration

## 👉 **SINGLE COMMAND SOLUTION**

### **Open MSYS2 MINGW64**

1. Launch: `C:\msys64\mingw64.exe`
2. Run:

```bash
cd /d/Documents/NeuroForge
bash qemu/build/build-rp2040.sh
```

**That's it!** The script will:
- ✅ Auto-reset Git conflicts
- ✅ Pull latest changes
- ✅ Copy RP2040 files
- ✅ Update build configuration
- ✅ Rebuild QEMU (~2-5 minutes)
- ✅ Verify board availability
- ✅ Show full error details if build fails

---

## ✅ **Expected Output**

```
================================================
  RP2040 QEMU Complete Build Script
================================================

[CONFIG]
  QEMU: /c/qemu-project/qemu-arm
  NeuroForge: /d/Documents/NeuroForge
  Patches: /d/Documents/NeuroForge/qemu/patches/rp2040

[STEP 1/6] Cleaning Git repository...
  [OK] Git up to date

[STEP 2/6] Validating QEMU environment...
  [OK] QEMU found
  [OK] hw/arm exists
  [OK] Build system ready

[STEP 3/6] Copying RP2040 source files...
  [OK] rp2040.h
  [OK] rp2040_soc.c
  [OK] raspberrypi_pico.c

[STEP 4/6] Updating meson.build and Kconfig...
  [OK] meson.build already has RP2040
  [OK] Kconfig already has RP2040

[STEP 5/6] Reconfiguring Meson...
  [OK] Meson reconfigured

[STEP 6/6] Building QEMU (this may take 2-5 minutes)...
  Full output will be shown...

[1/450] Generating qemu-version.h
[2/450] Compiling C object...
...
[450/450] Linking target qemu-system-arm.exe

================================================
  BUILD SUCCESSFUL!
================================================

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

3. Exit QEMU: Ctrl+A then X
```

---

## 🐛 **If Build Fails**

The script will:
1. Show full error output
2. Analyze common problems
3. Provide specific fix instructions
4. Save logs to `/tmp/ninja-build.log`

**Common Errors:**

### "implicit declaration of get_system_memory"

**Fix:**
```bash
nano /c/qemu-project/qemu-arm/hw/arm/rp2040_soc.c
# Add: #include "exec/memory.h"
bash qemu/build/build-rp2040.sh  # Re-run
```

### "unknown type name 'RP2040State'"

**Fix:**
```bash
nano /c/qemu-project/qemu-arm/hw/arm/raspberrypi_pico.c
# Verify: #include "hw/arm/rp2040.h"
bash qemu/build/build-rp2040.sh  # Re-run
```

### "qemu_log_mask undeclared"

**Fix:**
```bash
nano /c/qemu-project/qemu-arm/hw/arm/rp2040_soc.c
# Add: #include "qemu/log.h"
bash qemu/build/build-rp2040.sh  # Re-run
```

---

## 🚀 **After Successful Build**

### **Build Blink Firmware**

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

## 📝 **Manual Build (If Script Fails)**

```bash
cd /c/qemu-project/qemu-arm

# Reconfigure
meson setup --reconfigure build

# Build with full output
cd build
ninja

# Check for errors
# Fix and repeat
```

---

## 🎉 **Success!**

When you see:
```
raspberrypi-pico     Raspberry Pi Pico (RP2040)
```

**RP2040 QEMU is ready to use!** 🌟
