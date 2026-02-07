cmake_minimum_required(VERSION 3.13)

# Incluir Pico SDK
include(pico_sdk_import.cmake)

# Nome do projeto
project(blink C CXX ASM)

# C/C++ standards
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Inicializar Pico SDK
pico_sdk_init()

# ═══════════════════════════════════════════════════════════════
# Firmware principal (usa pico_time - pode não funcionar no Renode)
# ═══════════════════════════════════════════════════════════════
add_executable(blink
    main.c
)

target_link_libraries(blink
    pico_stdlib
    hardware_gpio
    hardware_uart
    pico_time
)

pico_enable_stdio_usb(blink 0)
pico_enable_stdio_uart(blink 1)
pico_add_extra_outputs(blink)

# ═══════════════════════════════════════════════════════════════
# Firmware simples para Renode (NÃO usa pico_time)
# ═══════════════════════════════════════════════════════════════
add_executable(blink_simple
    main_simple.c
)

target_link_libraries(blink_simple
    pico_stdlib
    hardware_gpio
    hardware_uart
    # NÃO inclui pico_time para evitar dependência do hardware timer
)

pico_enable_stdio_usb(blink_simple 0)
pico_enable_stdio_uart(blink_simple 1)
pico_add_extra_outputs(blink_simple)

# Definições do projeto
target_compile_definitions(blink PRIVATE
    LED_PIN=25
    UART_ID=uart0
    BAUD_RATE=115200
)

target_compile_definitions(blink_simple PRIVATE
    LED_PIN=25
    UART_ID=uart0
    BAUD_RATE=115200
)
