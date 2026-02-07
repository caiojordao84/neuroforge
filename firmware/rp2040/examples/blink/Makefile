# RP2040 Blink Firmware Makefile

# Toolchain
PREFIX = arm-none-eabi-
CC = $(PREFIX)gcc
AS = $(PREFIX)as
LD = $(PREFIX)ld
OBJCOPY = $(PREFIX)objcopy
SIZE = $(PREFIX)size

# Target
TARGET = blink

# Source files
C_SOURCES = main.c
ASM_SOURCES = startup.s

# Object files
OBJECTS = $(C_SOURCES:.c=.o) $(ASM_SOURCES:.s=.o)

# Flags
CPU = -mcpu=cortex-m0plus -mthumb
CFLAGS = $(CPU) -Wall -Wextra -O2 -g -ffunction-sections -fdata-sections
LDFLAGS = $(CPU) -T linker.ld -nostartfiles -Wl,--gc-sections -Wl,-Map=$(TARGET).map

# QEMU path (adjust if needed)
QEMU = qemu-system-arm.exe
QEMU_MACHINE = raspberrypi-pico

# ========== Build Rules ==========

.PHONY: all clean run debug size

all: $(TARGET).elf $(TARGET).bin
	@echo ""
	@echo "Build complete!"
	@echo ""
	@$(SIZE) $(TARGET).elf
	@echo ""
	@echo "To run in QEMU:"
	@echo "  make run"
	@echo ""

$(TARGET).elf: $(OBJECTS)
	$(CC) $(LDFLAGS) -o $@ $^

$(TARGET).bin: $(TARGET).elf
	$(OBJCOPY) -O binary $< $@

%.o: %.c
	$(CC) $(CFLAGS) -c -o $@ $<

%.o: %.s
	$(AS) $(CPU) -g -o $@ $<

size: $(TARGET).elf
	@$(SIZE) $<

clean:
	rm -f $(OBJECTS) $(TARGET).elf $(TARGET).bin $(TARGET).map
	@echo "Clean complete"

# ========== QEMU Targets ==========

run: $(TARGET).elf
	@echo "Starting QEMU (Ctrl+A X to quit)..."
	@echo ""
	$(QEMU) -M $(QEMU_MACHINE) -kernel $< -nographic -serial mon:stdio

debug: $(TARGET).elf
	@echo "Starting QEMU in debug mode..."
	@echo ""
	@echo "In another terminal, run:"
	@echo "  gdb-multiarch $(TARGET).elf"
	@echo "  (gdb) target remote :1234"
	@echo "  (gdb) continue"
	@echo ""
	$(QEMU) -M $(QEMU_MACHINE) -kernel $< -s -S -nographic

# ========== Help ==========

help:
	@echo "RP2040 Blink Firmware - Make Targets:"
	@echo ""
	@echo "  all     - Build firmware (default)"
	@echo "  clean   - Remove build artifacts"
	@echo "  run     - Run in QEMU"
	@echo "  debug   - Start QEMU with GDB server"
	@echo "  size    - Show binary size"
	@echo "  help    - Show this help"
	@echo ""
