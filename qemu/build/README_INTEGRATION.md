# 🔧 Integrating RP2040 into Existing QEMU

## 📋 Overview

This guide shows how to add RP2040 support to your **existing QEMU installation** without creating a separate build.

**Target environment:**
- Windows 11
- Existing QEMU v9.x at `C:\qemu-project\qemu-arm`
- Meson + Ninja build system

---

## ⚡ Quick Start

### 1. Run Integration Script

Open **PowerShell** in NeuroForge directory:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\qemu\build\integrate-rp2040-windows.ps1
```

**What it does:**
1. ✅ Copies RP2040 source files to `C:\qemu-project\qemu-arm\hw\arm\`
2. ✅ Updates `meson.build` automatically
3. ✅ Updates `Kconfig` with RP2040 configuration
4. ✅ Rebuilds QEMU (incremental - only ~1-2 minutes)
5. ✅ Verifies `raspberrypi-pico` board is available

### 2. Verify Installation

```powershell
C:\qemu-project\qemu-arm\build\qemu-system-arm.exe -M help | Select-String "pico"
```

**Expected output:**
```
raspberrypi-pico     Raspberry Pi Pico (RP2040)
```

### 3. Build Firmware

```bash
cd firmware/rp2040/examples/blink
make
```

### 4. Run on QEMU

```powershell
C:\qemu-project\qemu-arm\build\qemu-system-arm.exe `
  -M raspberrypi-pico `
  -kernel firmware\rp2040\examples\blink\blink.elf `
  -nographic
```

**Exit:** Press `Ctrl+A`, then `X`

---

## 📁 Files Added to Your QEMU

```
C:\qemu-project\qemu-arm\
├── hw\arm\
│   ├── rp2040.h              ← NEW
│   ├── rp2040_soc.c          ← NEW
│   ├── raspberrypi_pico.c    ← NEW
│   ├── meson.build           ← MODIFIED
│   └── Kconfig               ← MODIFIED
└── build\
    └── qemu-system-arm.exe   ← REBUILT
```

---

## 🔧 Manual Integration (If Script Fails)

### Step 1: Copy Files

```powershell
Copy-Item qemu\patches\rp2040\*.c C:\qemu-project\qemu-arm\hw\arm\
Copy-Item qemu\patches\rp2040\*.h C:\qemu-project\qemu-arm\hw\arm\
```

### Step 2: Edit `hw/arm/meson.build`

Add after existing `arm_ss.add()` calls:

```python
arm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))
```

### Step 3: Edit `hw/arm/Kconfig`

Add at the end:

```kconfig
config RP2040
    bool
    default y
    depends on ARM
    select ARM_V7M
    select PL011
    select UNIMP
```

### Step 4: Rebuild

```powershell
cd C:\qemu-project\qemu-arm\build
meson setup --reconfigure .
ninja
```

---

## 🐛 Troubleshooting

### "QEMU not found at C:\qemu-project\qemu-arm"

**Solution:** Edit `integrate-rp2040-windows.ps1`, line 13:

```powershell
$QEMU_PATH = "C:\your-actual-path\qemu-arm"
```

### "hw/arm directory not found"

**Cause:** Wrong QEMU path or QEMU not compiled from source.

**Solution:** Use Option B (standalone QEMU) instead.

### "Build failed"

**Check logs:**
```powershell
cd C:\qemu-project\qemu-arm\build
ninja
```

**Common issues:**
- Missing `PL011` dependency → Already in your QEMU
- Syntax error → Check file copies are complete

### "raspberrypi-pico board not found after build"

**Verify files copied:**
```powershell
Test-Path C:\qemu-project\qemu-arm\hw\arm\rp2040_soc.c
Test-Path C:\qemu-project\qemu-arm\hw\arm\raspberrypi_pico.c
```

**Check meson.build:**
```powershell
Select-String "rp2040" C:\qemu-project\qemu-arm\hw\arm\meson.build
```

Should show:
```
arm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))
```

---

## 🔄 Reverting Changes

### Remove RP2040 Support

```powershell
# Remove source files
Remove-Item C:\qemu-project\qemu-arm\hw\arm\rp2040*.c
Remove-Item C:\qemu-project\qemu-arm\hw\arm\raspberrypi_pico.c

# Remove from meson.build (manual edit)
# Remove from Kconfig (manual edit)

# Rebuild
cd C:\qemu-project\qemu-arm\build
meson setup --reconfigure .
ninja
```

---

## 📚 Resources

- **QEMU Documentation:** https://www.qemu.org/docs/master/
- **Meson Build System:** https://mesonbuild.com/
- **RP2040 Datasheet:** https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf

---

## ✅ Success Checklist

- [ ] Script completed without errors
- [ ] `qemu-system-arm -M help` shows `raspberrypi-pico`
- [ ] Firmware compiles (`make` in `firmware/rp2040/examples/blink`)
- [ ] QEMU runs firmware (`-M raspberrypi-pico -kernel blink.elf`)
- [ ] Can exit QEMU (Ctrl+A, X)

**If all checked → RP2040 integration successful!** 🎉
