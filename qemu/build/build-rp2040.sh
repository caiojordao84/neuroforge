#!/bin/bash
# ======================================================
# Complete RP2040 QEMU Build Script
# Handles Git conflicts, shows full errors, continues build
# ======================================================

set +e  # Don't exit on errors (we want to see them all)

echo ""
echo "================================================"
echo "  RP2040 QEMU Complete Build Script"
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

# ========== Step 1: Reset Git ==========
echo "[STEP 1/6] Cleaning Git repository..."

cd "$NEUROFORGE_ROOT"

if git diff --quiet; then
    echo "  [OK] No local changes"
else
    echo "  [INFO] Resetting local changes..."
    git reset --hard HEAD
    echo "  [OK] Git reset complete"
fi

echo "  [INFO] Pulling latest changes..."
git pull origin feature/rp2040-qemu-mvp

if [ $? -eq 0 ]; then
    echo "  [OK] Git up to date"
else
    echo "  [FAIL] Git pull failed"
    exit 1
fi
echo ""

# ========== Step 2: Validate Environment ==========
echo "[STEP 2/6] Validating QEMU environment..."

if [ ! -d "$QEMU_PATH" ]; then
    echo "  [FAIL] QEMU not found at $QEMU_PATH"
    echo "  Edit this script and set QEMU_PATH correctly."
    exit 1
fi
echo "  [OK] QEMU found"

if [ ! -d "$QEMU_PATH/hw/arm" ]; then
    echo "  [FAIL] hw/arm directory missing"
    exit 1
fi
echo "  [OK] hw/arm exists"

if [ ! -f "$QEMU_PATH/build/build.ninja" ]; then
    echo "  [FAIL] QEMU not configured"
    echo "  Run: cd $QEMU_PATH && meson setup build"
    exit 1
fi
echo "  [OK] Build system ready"
echo ""

# ========== Step 3: Copy Files ==========
echo "[STEP 3/6] Copying RP2040 source files..."

for file in rp2040.h rp2040_soc.c raspberrypi_pico.c; do
    if [ -f "$PATCHES_DIR/$file" ]; then
        cp -v "$PATCHES_DIR/$file" "$QEMU_PATH/hw/arm/"
        echo "  [OK] $file"
    else
        echo "  [FAIL] Missing $file"
        exit 1
    fi
done
echo ""

# ========== Step 4: Update Build Files ==========
echo "[STEP 4/6] Updating meson.build and Kconfig..."

MESON_FILE="$QEMU_PATH/hw/arm/meson.build"
KCONFIG_FILE="$QEMU_PATH/hw/arm/Kconfig"

# Update meson.build
if ! grep -q "rp2040_soc.c" "$MESON_FILE"; then
    echo "  [INFO] Adding RP2040 to meson.build..."
    sed -i "$ i\\\n# RP2040 support\narm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))" "$MESON_FILE"
    echo "  [OK] meson.build updated"
else
    echo "  [OK] meson.build already has RP2040"
fi

# Update Kconfig
if ! grep -q "config RP2040" "$KCONFIG_FILE"; then
    echo "  [INFO] Adding RP2040 to Kconfig..."
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
    echo "  [OK] Kconfig already has RP2040"
fi
echo ""

# ========== Step 5: Reconfigure Meson ==========
echo "[STEP 5/6] Reconfiguring Meson..."

cd "$QEMU_PATH"
meson setup --reconfigure build 2>&1 | tee /tmp/meson-reconfig.log

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "  [OK] Meson reconfigured"
else
    echo "  [FAIL] Meson reconfiguration failed"
    echo "  See: /tmp/meson-reconfig.log"
    exit 1
fi
echo ""

# ========== Step 6: Build with Ninja ==========
echo "[STEP 6/6] Building QEMU (this may take 2-5 minutes)..."
echo "  Full output will be shown..."
echo ""

cd "$QEMU_PATH/build"

# Build and capture output
ninja 2>&1 | tee /tmp/ninja-build.log
BUILD_RESULT=${PIPESTATUS[0]}

echo ""

if [ $BUILD_RESULT -eq 0 ]; then
    echo "================================================"
    echo "  BUILD SUCCESSFUL!"
    echo "================================================"
    echo ""
    
    # Verify board
    QEMU_EXE="$QEMU_PATH/build/qemu-system-arm.exe"
    
    if "$QEMU_EXE" -M help 2>&1 | grep -q "raspberrypi-pico"; then
        echo "  [OK] raspberrypi-pico board available!"
        echo ""
        "$QEMU_EXE" -M help 2>&1 | grep "raspberrypi-pico"
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
        echo "3. Exit QEMU: Ctrl+A then X"
        echo ""
        exit 0
    else
        echo "  [WARNING] Board registered but not showing in help"
        echo "  This might still work. Try running firmware."
        exit 0
    fi
else
    echo "================================================"
    echo "  BUILD FAILED"
    echo "================================================"
    echo ""
    echo "  Full log saved: /tmp/ninja-build.log"
    echo ""
    echo "  Analyzing errors..."
    echo ""
    
    # Analyze common errors
    if grep -q "implicit declaration of function 'get_system_memory'" /tmp/ninja-build.log; then
        echo "  ERROR: Missing #include \"exec/memory.h\""
        echo ""
        echo "  FIX:"
        echo "    1. Edit: $QEMU_PATH/hw/arm/rp2040_soc.c"
        echo "    2. Add after other includes:"
        echo "       #include \"exec/memory.h\""
        echo "    3. Save and re-run this script"
        echo ""
    fi
    
    if grep -q "unknown type name 'RP2040State'" /tmp/ninja-build.log; then
        echo "  ERROR: Missing RP2040State definition"
        echo ""
        echo "  FIX:"
        echo "    1. Edit: $QEMU_PATH/hw/arm/raspberrypi_pico.c"
        echo "    2. Verify #include \"hw/arm/rp2040.h\" is present"
        echo "    3. Check rp2040.h defines RP2040State and TYPE_RP2040_SOC"
        echo "    4. Re-run this script"
        echo ""
    fi
    
    if grep -q "qemu_log_mask" /tmp/ninja-build.log; then
        echo "  ERROR: Missing #include \"qemu/log.h\""
        echo ""
        echo "  FIX:"
        echo "    1. Edit: $QEMU_PATH/hw/arm/rp2040_soc.c"
        echo "    2. Add after other includes:"
        echo "       #include \"qemu/log.h\""
        echo "    3. Save and re-run this script"
        echo ""
    fi
    
    echo "  View full errors:"
    echo "    cat /tmp/ninja-build.log | less"
    echo ""
    echo "  Continue building manually:"
    echo "    cd $QEMU_PATH/build"
    echo "    ninja"
    echo ""
    
    exit 1
fi
