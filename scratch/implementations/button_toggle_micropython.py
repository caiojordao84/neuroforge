from machine import Pin
import time

# Define the LED and Button pins
led = Pin(2, Pin.OUT)       # LED on GPIO 2
button = Pin(14, Pin.IN, Pin.PULL_DOWN) # Button on GPIO 14 with pull-down

led_state = False
last_button_state = 0

while True:
    # Read the current button state
    current_button_state = button.value()

    # Check if the button state has changed (edge detection)
    if current_button_state != last_button_state:
        # If the button was pressed (transition from 0 to 1)
        if current_button_state == 1:
            led_state = not led_state
            led.value(led_state)
        
        # Small delay for debouncing
        time.sleep(0.05)

    # Save the current state for the next iteration
    last_button_state = current_button_state
    
    # Small sleep to prevent high CPU usage
    time.sleep(0.01)
