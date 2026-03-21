# Script para rodar localmente os mesmos testes feitos no GitHub Actions (CI)
# Este script verifica os crates ASL, Transport e Firmware, e constroi o WASM.

$ErrorActionPreference = "Stop"

Write-Host "`n=== [1/4] Cargo Check ===" -ForegroundColor Cyan
cargo check -p neuroforge-asl -p neuroforge-transport -p neuroforge-firmware

Write-Host "`n=== [2/4] Cargo Clippy ===" -ForegroundColor Cyan
cargo clippy -p neuroforge-asl -p neuroforge-transport -p neuroforge-firmware -- -D warnings

Write-Host "`n=== [3/4] Cargo Test ===" -ForegroundColor Cyan
cargo test -p neuroforge-asl

Write-Host "`n=== [4/4] Build WASM Bundle ===" -ForegroundColor Cyan
# Configurando o WASI-SDK local que instalamos na unidade C:
$WasiSdkPath = "C:\wasi-sdk"

if (-Not (Test-Path $WasiSdkPath)) {
    Write-Host "AVISO: $WasiSdkPath não foi encontrado. Baixe o wasi-sdk e extraia em C:\wasi-sdk para compilar o WASM localmente." -ForegroundColor Yellow
    exit 1
}

$env:CC_wasm32_unknown_unknown = "$WasiSdkPath\bin\clang.exe"
$env:AR_wasm32_unknown_unknown = "$WasiSdkPath\bin\llvm-ar.exe"
$env:NM_wasm32_unknown_unknown = "$WasiSdkPath\bin\llvm-nm.exe"
$env:STRIP_wasm32_unknown_unknown = "$WasiSdkPath\bin\llvm-strip.exe"
$env:RANLIB_wasm32_unknown_unknown = "$WasiSdkPath\bin\llvm-ranlib.exe"
$env:CFLAGS_wasm32_unknown_unknown = "--target=wasm32-wasip1 --sysroot=$WasiSdkPath\share\wasi-sysroot"

Push-Location crates/neuroforge-asl
try {
    wasm-pack build --target web --out-dir ../../apps/webapp/src/lib/wasm
    Write-Host "`n=== [SUCESSO] Bundle WASM compilado em ./apps/webapp/src/lib/wasm ===" -ForegroundColor Green
} finally {
    Pop-Location
}

Write-Host "`n✓ Todos os testes do CI passaram localmente!" -ForegroundColor Green
