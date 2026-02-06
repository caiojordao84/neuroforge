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

# Criar executável
add_executable(blink
    main.c
)

# Linkar bibliotecas do Pico SDK
target_link_libraries(blink
    pico_stdlib          # Standard library (GPIO, UART, etc.)
    hardware_gpio        # GPIO API
    hardware_uart        # UART API
    pico_time            # Timer API
)

# Habilitar stdio via UART e USB (para hardware real)
pico_enable_stdio_usb(blink 1)
pico_enable_stdio_uart(blink 1)

# Criar arquivos de saída (.uf2, .bin, .hex)
pico_add_extra_outputs(blink)

# Definições do projeto
target_compile_definitions(blink PRIVATE
    LED_PIN=25
    UART_ID=uart0
    BAUD_RATE=115200
)
