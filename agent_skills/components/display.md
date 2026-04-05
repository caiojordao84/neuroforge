# Display

> Code generation skill for display modules (OLED, LCD, TFT)

## Purpose

Generate code to control display modules (SSD1306 OLED, HD44780 LCD, ST7789 TFT, etc.).

## Hardware

- **Component**: `display`
- **Types**: OLED (I2C/SPI), LCD 16x2/20x4 (I2C/parallel), TFT (SPI)
- **Interfaces**: I2C, SPI, 8-bit parallel

## Code Generation Rules

### SSD1306 OLED (I2C) - Arduino

```c
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

void setup() {
    display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Hello!");
    display.display();
}
```

### HD44780 LCD (I2C) - Arduino

```c
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
    lcd.init();
    lcd.backlight();
    lcd.print("Hello World");
}
```

### ST7789 TFT (SPI) - CircuitPython

```python
import board
import displayio
import terminalio
from adafruit_st7789 import ST7789

displayio.release_displays()
spi = board.SPI()
tft_bus = displayio.FourWire(spi, command=board.D6, chip_select=board.D5)
display = ST7789(tft_bus, width=240, height=240, rowstart=80)

splash = displayio.Group()
display.show(splash)
```

## Confidence Modifiers

| Factor | Impact |
|--------|--------|
| Correct I2C/SPI address | +0.0 |
| Proper initialization | +0.1 |
| Backlight control | +0.05 |
| Font library included | +0.05 |

## Example Output

```c
#include <Wire.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 display(128, 64, &Wire);

void setup() {
    display.begin(0x3C);
    display.clearDisplay();
    display.setTextSize(2);
    display.setCursor(0, 0);
    display.print("NeuroForge");
    display.display();
}
```

## Related Skills
- i2c-sensor
- spi-sensor
- micropython-esp32