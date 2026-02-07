# -*- coding: utf-8 -*-
# RP2040 Timer Patch for Renode (Safe & Minimal)

def update_timer_registers(cpu, address):
    try:
        # Estimate microseconds (125 instructions = 1 us)
        total_us = cpu.ExecutedInstructions // 125
        val_l = total_us & 0xFFFFFFFF
        val_h = (total_us >> 32) & 0xFFFFFFFF
        
        cpu.SystemBus.WriteDoubleWord(0x40054024, val_l)
        cpu.SystemBus.WriteDoubleWord(0x40054028, val_h)
        cpu.SystemBus.WriteDoubleWord(0x4005400c, val_l)
        cpu.SystemBus.WriteDoubleWord(0x40054008, val_h)
    except Exception as e:
        pass

def log_point(cpu, address):
    print("[CPU] Reached address: 0x{:08X}".format(address))

def register_patch():
    try:
        machine = self.Machine
        cpu = machine["sysbus.cpu0"]
        
        # Addresses from all_symbols.txt
        time_us_64_addr = 0x10001038
        busy_wait_us_addr = 0x1000104c
        reset_addr = 0x100001f6
        main_addr = 0x100002d4
        panic_addr = 0x100004b4
        
        # Timer hooks
        cpu.AddHook(time_us_64_addr, update_timer_registers)
        cpu.AddHook(busy_wait_us_addr, update_timer_registers)
        
        # Basic trace hooks
        cpu.AddHook(reset_addr, log_point)
        cpu.AddHook(main_addr, log_point)
        cpu.AddHook(panic_addr, log_point)
        
        print("[TimerPatch] Registration successful.")
    except Exception as e:
        print("[TimerPatch] Registration error: {}".format(e))

register_patch()
