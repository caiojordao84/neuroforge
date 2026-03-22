@echo off
setlocal enabledelayedexpansion

set "ARGS="
for %%A in (%*) do (
    set "ARG=%%A"
    if not "!ARG!"=="-utf-8" (
        set "ARGS=!ARGS! %%A"
    )
)

"C:\wasi-sdk\bin\clang.exe" --sysroot=C:\wasi-sdk\share\wasi-sysroot %ARGS%
