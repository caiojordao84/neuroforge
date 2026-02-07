#!/bin/bash
# ======================================================
# Integrate RP2040 into Existing QEMU Installation
# MSYS2 Bash Script for QEMU v9.x
# ======================================================

set -e  # Exit on error

echo ""
echo "================================================"
echo "  RP2040 Integration for Existing QEMU"
echo "================================================"
echo ""

# ========== Configuration ==========
QEMU_PATH="/c/qemu-project/qemu-arm"
NEUROFORGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PATCHES_DIR="$NEUROFORGE_ROOT/qemu/patches/rp2040"

echo "[INFO] Configuration:"
echo "  QEMU Path: $QEMU_PATH"
echo "  NeuroForge: $NEUROFORGE_ROOT"
echo "  Patches: $PATCHES_DIR"
echo ""

# ========== Validation ==========
echo "[STEP 1/5] Validating environment..."

if [ ! -d "$QEMU_PATH" ]; then
    echo "  [FAIL] QEMU not found at $QEMU_PATH"
    echo "  Please update QEMU_PATH in this script."
    exit 1
fi
echo "  [OK] QEMU installation found"

if [ ! -d "$QEMU_PATH/hw/arm" ]; then
    echo "  [FAIL] hw/arm directory not found"
    exit 1
fi
echo "  [OK] hw/arm directory exists"

if [ ! -f "$QEMU_PATH/build/build.ninja" ]; then
    echo "  [FAIL] QEMU build directory not configured"
    echo "  Please build QEMU first."
    exit 1
fi
echo "  [OK] QEMU build system ready"
echo ""

# ========== Copy RP2040 Files ==========
echo "[STEP 2/5] Copying RP2040 source files..."

for file in rp2040.h rp2040_soc.c raspberrypi_pico.c; do
    if [ -f "$PATCHES_DIR/$file" ]; then
        cp "$PATCHES_DIR/$file" "$QEMU_PATH/hw/arm/"
        echo "  [OK] Copied $file"
    else
        echo "  [FAIL] Missing $file"
        exit 1
    fi
done
echo ""

# ========== Update meson.build ==========
echo "[STEP 3/5] Updating meson.build..."

MESON_FILE="$QEMU_PATH/hw/arm/meson.build"

if ! grep -q "rp2040_soc.c" "$MESON_FILE"; then
    echo "  Adding RP2040 to arm_ss.add()..."
    
    # Insert before the last line (hw_arch += {'arm': arm_ss})
    sed -i "$ i\\\n# RP2040 support\narm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))" "$MESON_FILE"
    
    echo "  [OK] meson.build updated"
else
    echo "  [OK] RP2040 already in meson.build"
fi
echo ""

# ========== Update Kconfig ==========
echo "[STEP 4/5] Updating Kconfig..."

KCONFIG_FILE="$QEMU_PATH/hw/arm/Kconfig"

if ! grep -q "config RP2040" "$KCONFIG_FILE"; then
    echo "  Adding RP2040 configuration..."
    
    cat >> "$KCONFIG_FILE" << 'EOF'

config RP2040
    bool
    default y
    depends on ARM
    select ARM_V7M
    select PL011
    select UNIMP
EOF
    
    echo "  [OK] Kconfig updated"
else
    echo "  [OK] RP2040 already in Kconfig"
fi
echo ""

# ========== Rebuild QEMU ==========
echo "[STEP 5/5] Rebuilding QEMU..."
echo "  This may take 1-5 minutes (incremental build)..."
echo ""

cd "$QEMU_PATH"

# Reconfigure
echo "  Reconfiguring Meson..."
meson setup --reconfigure build > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "  [FAIL] Meson reconfiguration failed"
    exit 1
fi

# Build
echo "  Building with Ninja..."
cd build
ninja 2>&1 | grep -E "^\[|error:|FAILED"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "  [OK] Build completed successfully"
else
    echo ""
    echo "  [FAIL] Build failed"
    exit 1
fi

echo ""
echo "================================================"
echo "  RP2040 Integration Complete!"
echo "================================================"
echo ""

# ========== Verification ==========
echo "[VERIFICATION] Testing RP2040 board..."
echo ""

QEMU_EXE="$QEMU_PATH/build/qemu-system-arm.exe"

if "$QEMU_EXE" -M help 2>&1 | grep -q "raspberrypi-pico"; then
    echo "  [OK] raspberrypi-pico board available!"
    echo ""
    "$QEMU_EXE" -M help 2>&1 | grep "raspberrypi-pico"
else
    echo "  [FAIL] raspberrypi-pico board not found"
    echo ""
    echo "Available ARM boards:"
    "$QEMU_EXE" -M help 2>&1 | grep -i "arm" | head -10
    exit 1
fi

echo ""
echo "================================================"
echo "  NEXT STEPS"
echo "================================================"
echo ""
echo "1. Build firmware:"
echo "   cd /d/Documents/NeuroForge/firmware/rp2040/examples/blink"
echo "   make"
echo ""
echo "2. Run on QEMU:"
echo "   $QEMU_EXE -M raspberrypi-pico -kernel blink.elf -nographic"
echo ""
echo "3. Exit QEMU: Press Ctrl+A then X"
echo ""
