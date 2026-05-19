import machine
import time

# On many MicroPython boards, the onboard LED is connected to pin 2 or 'LED'
led = machine.Pin('LED', machine.Pin.OUT)

while True:
    led.value(1)  # Turn LED on
    time.sleep(1) # Wait for 1 second
    led.value(0)  # Turn LED off
    time.sleep(1) # Wait for 1 second
