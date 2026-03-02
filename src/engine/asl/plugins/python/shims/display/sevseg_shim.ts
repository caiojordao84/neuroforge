// src/engine/asl/plugins/python/shims/display/sevseg_shim.ts

import type { ShimDefinition } from '../../../core/ShimManager';

export const sevseg_shim: ShimDefinition = {
    name: 'sevseg',
    description: 'Implementação de Display 7 Segmentos para MicroPyhon',
    code: `
# --- ASL SHIM: SevSeg (7-Segment Display) ---
class __ASL_SevSeg:
    def __init__(self):
        self.digit_pins = []
        self.segment_pins = []
        self.is_common_cathode = True
        self.current_number = 0
        self.chars = {
            '0': 0x3F, '1': 0x06, '2': 0x5B, '3': 0x4F,
            '4': 0x66, '5': 0x6D, '6': 0x7D, '7': 0x07,
            '8': 0x7F, '9': 0x6F, ' ': 0x00, '-': 0x40
        }

    def begin(self, hardware_config, num_digits, digit_pins, segment_pins, resistors_on_segments=True, update_with_delays=False, leading_zeros=False, disable_dec_point=False):
        self.is_common_cathode = (hardware_config == 0)
        
        # Setup digit pins
        for p in digit_pins:
            pin = machine.Pin(p, machine.Pin.OUT)
            pin.value(1 if self.is_common_cathode else 0) # Turn off initially
            self.digit_pins.append(pin)
            
        # Setup segment pins (A-G + DP)
        for p in segment_pins:
            pin = machine.Pin(p, machine.Pin.OUT)
            pin.value(0 if self.is_common_cathode else 1) # Turn off initially
            self.segment_pins.append(pin)

    def setNumber(self, num, dec_places=0):
        # Extremely simplified for Shim proof-of-concept
        self.current_number = num

    def refreshDisplay(self):
        # Multiplexing loop
        str_num = str(self.current_number)
        
        # Pad with spaces
        while len(str_num) < len(self.digit_pins):
            str_num = ' ' + str_num

        # Truncate if too long (simple handling)
        if len(str_num) > len(self.digit_pins):
            str_num = str_num[-len(self.digit_pins):]

        for i, char in enumerate(str_num):
            if i >= len(self.digit_pins): break
            
            # Turn off all digits
            for d_pin in self.digit_pins:
                d_pin.value(1 if self.is_common_cathode else 0)
                
            # Set segments for current char
            pattern = self.chars.get(char, 0x00)
            for s in range(8):
                if s < len(self.segment_pins):
                    bit = (pattern >> s) & 1
                    # If Common Cathode, 1 turns segment ON. If Anode, 0 turns ON.
                    self.segment_pins[s].value(bit if self.is_common_cathode else not bit)
                    
            # Turn on current digit
            # For Common Cathode, digit pin MUST BE GND (0) to sink current
            # For Common Anode, digit pin MUST BE VCC (1) to source current
            self.digit_pins[i].value(0 if self.is_common_cathode else 1)
            
            # Brief delay for multiplexing persistence of vision
            time.sleep_ms(2)

sevseg = __ASL_SevSeg()
# --------------------------------------------
`
};
