# ======================================================
# Integrate RP2040 into Existing QEMU Installation
# Windows PowerShell Script for QEMU v9.x
# ======================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  RP2040 Integration for Existing QEMU" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ========== Configuration ==========
$QEMU_PATH = "C:\qemu-project\qemu-arm"
$NEUROFORGE_ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PATCHES_DIR = Join-Path $PSScriptRoot "..\patches\rp2040"

Write-Host "[INFO] Configuration:" -ForegroundColor Yellow
Write-Host "  QEMU Path: $QEMU_PATH" -ForegroundColor Gray
Write-Host "  NeuroForge: $NEUROFORGE_ROOT" -ForegroundColor Gray
Write-Host "  Patches: $PATCHES_DIR" -ForegroundColor Gray
Write-Host ""

# ========== Validation ==========
Write-Host "[STEP 1/5] Validating environment..." -ForegroundColor Yellow

if (-Not (Test-Path $QEMU_PATH)) {
    Write-Host "ERROR: QEMU not found at $QEMU_PATH" -ForegroundColor Red
    Write-Host "Please update QEMU_PATH variable in this script." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ QEMU installation found" -ForegroundColor Green

if (-Not (Test-Path "$QEMU_PATH\hw\arm")) {
    Write-Host "ERROR: hw/arm directory not found" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ hw/arm directory exists" -ForegroundColor Green

if (-Not (Test-Path "$QEMU_PATH\build\build.ninja")) {
    Write-Host "ERROR: QEMU build directory not found" -ForegroundColor Red
    Write-Host "Please build QEMU first." -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ QEMU build system ready" -ForegroundColor Green
Write-Host ""

# ========== Copy RP2040 Files ==========
Write-Host "[STEP 2/5] Copying RP2040 source files..." -ForegroundColor Yellow

$files = @(
    "rp2040.h",
    "rp2040_soc.c",
    "raspberrypi_pico.c"
)

foreach ($file in $files) {
    $src = Join-Path $PATCHES_DIR $file
    $dst = Join-Path "$QEMU_PATH\hw\arm" $file
    
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "  ✓ Copied $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Missing $file" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# ========== Update meson.build ==========
Write-Host "[STEP 3/5] Updating meson.build..." -ForegroundColor Yellow

$mesonFile = "$QEMU_PATH\hw\arm\meson.build"
$mesonContent = Get-Content $mesonFile -Raw

if ($mesonContent -notmatch "rp2040_soc.c") {
    Write-Host "  Adding RP2040 to arm_ss.add()..." -ForegroundColor Gray
    
    # Find arm_ss.add() block and add RP2040 files
    $mesonContent = $mesonContent -replace "(arm_ss\.add\(when: 'CONFIG_ARM_VIRT'.*?\]\))", "`$1`narm_ss.add(files('rp2040_soc.c', 'raspberrypi_pico.c'))"
    
    Set-Content $mesonFile -Value $mesonContent
    Write-Host "  ✓ meson.build updated" -ForegroundColor Green
} else {
    Write-Host "  ✓ RP2040 already in meson.build" -ForegroundColor Green
}
Write-Host ""

# ========== Update Kconfig ==========
Write-Host "[STEP 4/5] Updating Kconfig..." -ForegroundColor Yellow

$kconfigFile = "$QEMU_PATH\hw\arm\Kconfig"
$kconfigContent = Get-Content $kconfigFile -Raw

if ($kconfigContent -notmatch "RP2040") {
    Write-Host "  Adding RP2040 configuration..." -ForegroundColor Gray
    
    $rp2040Config = @"

config RP2040
    bool
    default y
    depends on ARM
    select ARM_V7M
    select PL011
    select UNIMP
"@
    
    Add-Content $kconfigFile -Value $rp2040Config
    Write-Host "  ✓ Kconfig updated" -ForegroundColor Green
} else {
    Write-Host "  ✓ RP2040 already in Kconfig" -ForegroundColor Green
}
Write-Host ""

# ========== Rebuild QEMU ==========
Write-Host "[STEP 5/5] Rebuilding QEMU..." -ForegroundColor Yellow
Write-Host "  This may take 1-5 minutes (incremental build)..." -ForegroundColor Gray
Write-Host ""

Push-Location "$QEMU_PATH\build"

try {
    # Reconfigure to pick up new files
    & meson setup --reconfigure . 2>&1 | Out-Null
    
    # Build only changed files
    & ninja 2>&1 | ForEach-Object {
        if ($_ -match "\[\d+/\d+\]") {
            Write-Host "  $_" -ForegroundColor Gray
        }
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "  ✓ Build completed successfully" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "  ✗ Build failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  RP2040 Integration Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# ========== Verification ==========
Write-Host "[VERIFICATION] Testing RP2040 board..." -ForegroundColor Yellow
Write-Host ""

$qemuExe = "$QEMU_PATH\build\qemu-system-arm.exe"
$helpOutput = & $qemuExe -M help 2>&1 | Select-String "raspberrypi-pico"

if ($helpOutput) {
    Write-Host "  ✓ raspberrypi-pico board available!" -ForegroundColor Green
    Write-Host ""
    Write-Host "$helpOutput" -ForegroundColor Cyan
} else {
    Write-Host "  ✗ raspberrypi-pico board not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available ARM boards:" -ForegroundColor Yellow
    & $qemuExe -M help | Select-String "ARM"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Build firmware:" -ForegroundColor Yellow
Write-Host "   cd firmware\rp2040\examples\blink" -ForegroundColor Gray
Write-Host "   make" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run on QEMU:" -ForegroundColor Yellow
Write-Host "   $qemuExe ```" -ForegroundColor Gray
Write-Host "     -M raspberrypi-pico ```" -ForegroundColor Gray
Write-Host "     -kernel firmware\rp2040\examples\blink\blink.elf ```" -ForegroundColor Gray
Write-Host "     -nographic" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Exit QEMU: Ctrl+A, X" -ForegroundColor Yellow
Write-Host ""
