from machine import Pin, ADC
import time

BUTTON_PIN = 2
LED_PIN = 3
POT_PIN = 26   # ADC0 no Pico

button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)
led = Pin(LED_PIN, Pin.OUT)
pot = ADC(POT_PIN)

blink_mode = False
last_button_state = 1
last_blink_time = time.ticks_ms()
led_output_state = False

print("MicroPython Test Started")

def map_range(value, in_min, in_max, out_min, out_max):
    return int((value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min)

while True:
    # --- 1. Botão com debounce ---
    current_button_state = button.value()

    if current_button_state == 0 and last_button_state == 1:
        time.sleep_ms(30)  # debounce
        if button.value() == 0:
            blink_mode = not blink_mode
            print("Blink Mode Enabled" if blink_mode else "Blink Mode Disabled")

    last_button_state = current_button_state

    # --- 2. LED comportamento ---
    if not blink_mode:
        led.value(1)
        led_output_state = True  # garante estado consistente

    else:
        pot_value = pot.read_u16()  # 0–65535

        # Mapeia para 200–2000 ms
        periodo = map_range(pot_value, 0, 65535, 200, 2000)
        half_period = periodo // 2

        now = time.ticks_ms()

        if time.ticks_diff(now, last_blink_time) >= half_period:
            last_blink_time = now
            led_output_state = not led_output_state
            led.value(led_output_state)

    time.sleep_ms(5)
