# Power Management

> Code generation skill for power saving modes and battery management

## Purpose

Generate code to implement power saving (sleep modes) and battery monitoring for embedded systems.

## Hardware

- **Component**: `power-management`
- **Modes**: Idle, Sleep, Deep Sleep, Hibernate
- **Monitoring**: ADC voltage reading, fuel gauge IC

## Code Generation Rules

### ESP32 Deep Sleep (Arduino)

```c
#include <esp_sleep.h>

void setup() {
    Serial.begin(115200);
    
    // Wake up after 10 seconds
    esp_sleep_enable_timer_wakeup(10000000);
    
    Serial.println("Going to deep sleep...");
    delay(100);
    esp_deep_sleep_start();
}

void loop() {
    // Never runs after deep sleep
}
```

### ESP32 Sleep with Wake Sources

```c
void setup() {
    // Wake from GPIO
    esp_sleep_enable_gpio_wakeup();
    // Wake from UART
    esp_sleep_enable_uart_wakeup(0);
    // Wake from timer
    esp_sleep_enable_timer_wakeup(60000000);
}

void loop() {
    delay(1000);
    esp_light_sleep_start();
}
```

### Arduino AVR Sleep

```c
#include <avr/sleep.h>

void setup() {
    set_sleep_mode(SLEEP_MODE_PWR_DOWN);
}

void sleepNow() {
    sleep_enable();
    sleep_mode();
    // CPU sleeps here
    sleep_disable();
}
```

### Battery Voltage Monitoring

```c
const int BATTERY_PIN = A0;
const float VOLTAGE_DIVIDER = 2.0;  // R1=R2 for simple divider

float readBatteryVoltage() {
    int raw = analogRead(BATTERY_PIN);
    float voltage = raw * (3.3 / 1023.0) * VOLTAGE_DIVIDER;
    return voltage;
}
```

### MicroPython

```python
import machine
import time

# Deep sleep (ESP32)
machine.deepsleep(10000)  # 10 seconds

# Light sleep
machine.lightsleep(5000)

# ADC for battery
adc = machine.ADC(Pin(34))
adc.atten(ADC.ATTN_11DB)
voltage = adc.read() * 3.3 / 4095 * 2
```

### CircuitPython

```python
import alarm
import time

# Wake on timeout
time_alarm = alarm.time.TimeAlarm(monotonic_time=time.monotonic() + 60)
alarm.exit_and_deep_sleep_until_alarms(time_alarm)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct wake source | +0.0 |
| Proper sleep mode | +0.1 |
| Save/restore state | +0.1 |
| No wake source configured | -0.2 |

## Example Output

```c
void enterDeepSleep(unsigned long ms) {
    esp_sleep_enable_timer_wakeup(ms * 1000);
    esp_deep_sleep_start();
}
```

## Constraints

- Deep sleep loses RAM (except RTC)
- Wake sources limited per mode
- Current: µA to mA range

## Related Skills
- analog-sensor
- arduino-cpp-esp32