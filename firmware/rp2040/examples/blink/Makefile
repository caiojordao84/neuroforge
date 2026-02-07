# Makefile for RP2040 Blink Example

# Toolchain
CC = arm-none-eabi-gcc
AS = arm-none-eabi-as
OBJCOPY = arm-none-eabi-objcopy
OBJDUMP = arm-none-eabi-objdump
SIZE = arm-none-eabi-size

# Target
TARGET = blink

# Sources
SOURCES = main.c ../../common/startup.s

# Compiler flags
CFLAGS  = -mcpu=cortex-m0plus
CFLAGS += -mthumb
CFLAGS += -O2
CFLAGS += -g
CFLAGS += -Wall
CFLAGS += -Wextra
CFLAGS += -ffunction-sections
CFLAGS += -fdata-sections

# Linker flags
LDFLAGS  = -T ../../common/link.ld
LDFLAGS += -nostdlib
LDFLAGS += -nostartfiles
LDFLAGS += -Wl,--gc-sections
LDFLAGS += -Wl,-Map=$(TARGET).map

# Build targets
.PHONY: all clean

all: $(TARGET).elf $(TARGET).bin $(TARGET).lst

$(TARGET).elf: $(SOURCES)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $^
	$(SIZE) $@

$(TARGET).bin: $(TARGET).elf
	$(OBJCOPY) -O binary $< $@

$(TARGET).lst: $(TARGET).elf
	$(OBJDUMP) -h -S $< > $@

clean:
	rm -f $(TARGET).elf $(TARGET).bin $(TARGET).map $(TARGET).lst

# Run on QEMU
run: $(TARGET).elf
	qemu-system-arm -M raspberrypi-pico -kernel $< -nographic

# Debug with GDB
debug: $(TARGET).elf
	qemu-system-arm -M raspberrypi-pico -kernel $< -s -S -nographic
