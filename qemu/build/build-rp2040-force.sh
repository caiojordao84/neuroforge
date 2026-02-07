#!/bin/bash
# ======================================================
# FORCE RP2040 Files into QEMU (with verification)
# Ensures corrected files are actually used
# ======================================================

set -e

echo ""
echo "================================================"
echo "  FORCE RP2040 Integration (Verified)"
echo "================================================"
echo ""

# ========== Configuration ==========
QEMU_PATH="/c/qemu-project/qemu-arm"
NEUROFORGE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PATCHES_DIR="$NEUROFORGE_ROOT/qemu/patches/rp2040"

echo "[CONFIG]"
echo "  QEMU: $QEMU_PATH"
echo "  NeuroForge: $NEUROFORGE_ROOT"
echo "  Patches: $PATCHES_DIR"
echo ""

# ========== Step 1: Git Reset ==========
echo "[STEP 1/7] Resetting Git..."
cd "$NEUROFORGE_ROOT"
git reset --hard HEAD > /dev/null 2>&1
git pull origin feature/rp2040-qemu-mvp
echo "  [OK] Git updated"
echo ""

# ========== Step 2: Validate ==========
echo "[STEP 2/7] Validating environment..."

if [ ! -d "$QEMU_PATH" ]; then
    echo "  [FAIL] QEMU not found at $QEMU_PATH"
    exit 1
fi
echo "  [OK] QEMU found"

if [ ! -d "$QEMU_PATH/hw/arm" ]; then
    echo "  [FAIL] hw/arm missing"
    exit 1
fi
echo "  [OK] hw/arm exists"
echo ""

# ========== Step 3: Verify Source Files ==========
echo "[STEP 3/7] Verifying source files have includes..."

for file in rp2040_soc.c raspberrypi_pico.c; do
    echo "  Checking $file..."
    
    if [ "$file" = "rp2040_soc.c" ]; then
        if ! grep -q '#include "qemu/log.h"' "$PATCHES_DIR/$file"; then
            echo "  [FAIL] Missing #include \"qemu/log.h\" in $file"
            exit 1
        fi
        if ! grep -q '#include "exec/memory.h"' "$PATCHES_DIR/$file"; then
            echo "  [FAIL] Missing #include \"exec/memory.h\" in $file"
            exit 1
        fi
        if ! grep -q '#include "qapi/error.h"' "$PATCHES_DIR/$file"; then
            echo "  [FAIL] Missing #include \"qapi/error.h\" in $file"
            exit 1
        fi
        echo "    [OK] All includes present"
    fi
    
    if [ "$file" = "raspberrypi_pico.c" ]; then
        if ! grep -q '#include "exec/memory.h"' "$PATCHES_DIR/$file"; then
            echo "  [FAIL] Missing #include \"exec/memory.h\" in $file"
            exit 1
        fi
        if ! grep -q '#include "qapi/error.h"' "$PATCHES_DIR/$file"; then
            echo "  [FAIL] Missing #include \"qapi/error.h\" in $file"
            exit 1
        fi
        echo "    [OK] All includes present"
    fi
done
echo ""

# ========== Step 4: DELETE Old Files ==========
echo "[STEP 4/7] Removing old QEMU files..."

for file in rp2040.h rp2040_soc.c raspberrypi_pico.c; do
    if [ -f "$QEMU_PATH/hw/arm/$file" ]; then
        rm -f "$QEMU_PATH/hw/arm/$file"
        echo "  [DELETED] $file"
    fi
done
echo ""

# ========== Step 5: Copy New Files ==========
echo "[STEP 5/7] Copying corrected files..."

for file in rp2040.h rp2040_soc.c raspberrypi_pico.c; do
    if [ -f "$PATCHES_DIR/$file" ]; then
        cp -v "$PATCHES_DIR/$file" "$QEMU_PATH/hw/arm/"
        echo "  [COPIED] $file"
    else
        echo "  [FAIL] Missing $file in patches dir"
        exit 1
    fi
done
echo ""

# ========== Step 6: Verify Copied Files ==========
echo "[STEP 6/7] Verifying copied files..."

for file in rp2040_soc.c raspberrypi_pico.c; do
    echo "  Verifying $QEMU_PATH/hw/arm/$file..."
    
    if [ "$file" = "rp2040_soc.c" ]; then
        if ! grep -q '#include "qemu/log.h"' "$QEMU_PATH/hw/arm/$file"; then
            echo "  [FAIL] Include missing after copy!"
            echo "  File contents:"
            head -20 "$QEMU_PATH/hw/arm/$file"
            exit 1
        fi
        if ! grep -q '#include "exec/memory.h"' "$QEMU_PATH/hw/arm/$file"; then
            echo "  [FAIL] Include missing after copy!"
            exit 1
        fi
        echo "    [OK] Includes verified"
    fi
    
    if [ "$file" = "raspberrypi_pico.c" ]; then
        if ! grep -q '#include "exec/memory.h"' "$QEMU_PATH/hw/arm/$file"; then
            echo "  [FAIL] Include missing after copy!"
            echo "  File contents:"
            head -20 "$QEMU_PATH/hw/arm/$file"
            exit 1
        fi
        echo "    [OK] Includes verified"
    fi
done
echo ""

# ========== Step 7: Update Build Config ==========
echo "[STEP 7/7] Updating meson.build and Kconfig..."

MESON_FILE="$QEMU_PATH/hw/arm/meson.build"
KCONFIG_FILE="$QEMU_PATH/hw/arm/Kconfig"

if ! grep -q "rp2040_soc.c" "$MESON_FILE"; then
    sed -i "$ i\\\n# RP2040 support\narm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))" "$MESON_FILE"
    echo "  [OK] meson.build updated"
else
    echo "  [OK] meson.build already configured"
fi

if ! grep -q "config RP2040" "$KCONFIG_FILE"; then
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
    echo "  [OK] Kconfig already configured"
fi
echo ""

# ========== Build ==========
echo "================================================"
echo "  FILES VERIFIED - STARTING BUILD"
echo "================================================"
echo ""

cd "$QEMU_PATH"

echo "[BUILD] Reconfiguring Meson..."
meson setup --reconfigure build 2>&1 | grep -E "^Program|^Found|^Build|ERROR"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "  [OK] Meson configured"
else
    echo "  [FAIL] Meson failed"
    exit 1
fi
echo ""

echo "[BUILD] Compiling with Ninja..."
echo "  (showing progress and errors only)"
echo ""

cd "$QEMU_PATH/build"
ninja 2>&1 | tee /tmp/ninja-build-verified.log | grep -E "^\[|FAILED|error:"
BUILD_RESULT=${PIPESTATUS[0]}

echo ""

if [ $BUILD_RESULT -eq 0 ]; then
    echo "================================================"
    echo "  BUILD SUCCESSFUL!"
    echo "================================================"
    echo ""
    
    QEMU_EXE="$QEMU_PATH/build/qemu-system-arm.exe"
    
    if "$QEMU_EXE" -M help 2>&1 | grep -q "raspberrypi-pico"; then
        echo "  [SUCCESS] raspberrypi-pico board available!"
        echo ""
        "$QEMU_EXE" -M help 2>&1 | grep "raspberrypi-pico"
        echo ""
        echo "================================================"
        echo "  READY TO USE!"
        echo "================================================"
        echo ""
        echo "Next: Build and run firmware"
        echo ""
        echo "  cd /d/Documents/NeuroForge/firmware/rp2040/examples/blink"
        echo "  make"
        echo "  $QEMU_EXE -M raspberrypi-pico -kernel blink.elf -nographic"
        echo ""
        exit 0
    else
        echo "  [WARNING] Board not showing in help"
        exit 1
    fi
else
    echo "================================================"
    echo "  BUILD STILL FAILED"
    echo "================================================"
    echo ""
    echo "  Full log: /tmp/ninja-build-verified.log"
    echo ""
    echo "  Show first errors:"
    echo ""
    grep -A 3 "error:" /tmp/ninja-build-verified.log | head -30
    echo ""
    echo "  If errors persist, the source files in GitHub"
    echo "  may still be missing the required includes."
    echo ""
    echo "  Check actual file contents:"
    echo "    head -20 $QEMU_PATH/hw/arm/rp2040_soc.c"
    echo "    head -20 $QEMU_PATH/hw/arm/raspberrypi_pico.c"
    echo ""
    exit 1
fi
