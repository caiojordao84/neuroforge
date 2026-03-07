## Table - ALL nodeTypes from Parsers:

| C Function | Python Function | Rust Function | ASL Node | Flow Node | Blockly Block | Description |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Program Structure** | | | | | | |
| void setup() {} | def setup(): | fn setup() | Function (name: setup) | ❌ | ❌ | |
| void loop() {} | while True: | #[entry] | Function (name: loop) | loop | nf_loop ✅ | |
| void main() {} | def main(): | fn main() | Function (name: main) | ❌ | ❌ | |
| void myFunc() {} | def myFunc(): | fn myFunc() | Function | ❌ | ❌ | |
| ❌ | class MyClass: | struct MyStruct | StructDeclaration | ❌ | ❌ | |
| ❌ | ❌ | enum MyEnum | EnumDeclaration | ❌ | ❌ | |
| **Control Flow** | | | | | | |
| if (cond) {} | if cond: | if | IfStatement | decision | controls_if ✅ | |
| while (cond) {} | while cond: | while | WhileLoop | decision | controls_whileUntil ✅ | |
| do {} while(cond) | while True: break if | loop { ... break_if } | DoWhileLoop | ❌ | ❌ | |
| for (;;) {} | for i in range(): | for i in 0.. | ForLoop | loop | controls_for ✅ | |
| for (x in arr) | for x in list: | for x in iter | ForIn | ❌ | controls_forEach ✅ | |
| switch (x) {} | match x: | match | SwitchStatement | ❌ | ❌ | |
| case x: | case x: | => | CaseClause | ❌ | ❌ | |
| break; | break | break | BreakStatement | ❌ | controls_flow_statements ✅ | |
| continue; | continue | continue | ContinueStatement | ❌ | controls_flow_statements ✅ | |
| return x; | return x | return | ReturnStatement | ❌ | ❌ | |
| {} (block) | indented block | { ... } | Block | ❌ (implicit) | ❌ | |
| **Variables** | | | | | | |
| int x = 5; | x = 5 / x: int = 5 | let x = 5 | VariableDeclaration | ❌ | variables_set ✅ | |
| x = 10; | x = 10 | x = 10 | BinaryExpression (=) / ExpressionStatement | ❌ | variables_set ✅ | |
| int arr[] = {1,2} | arr = [1,2] | let arr = vec![1,2] | ArrayInitializer | ❌ | lists_create_with ✅ | |
| arr[0] | arr[0] | arr[0] | SubscriptExpression | ❌ | lists_getIndex ✅ | |
| obj.prop | obj.prop | obj.prop | MemberExpression | ❌ | ❌ | |
| x ? a : b | ❌ | ❌ | ConditionalExpression | ❌ | ❌ | |
| int x[3] = {.a=1} | {'a': 1} | Struct { a: 1 } | DesignatedInitializer / ObjectInitializer | ❌ | ❌ | |
| (int)x | ❌ | x as i32 | CastExpression | ❌ | ❌ | |
| ❌ | ❌ | &x | UnaryExpression (ref) | ❌ | ❌ | |
| **Literals** | | | | | | |
| 123 | 123 | 123 | Literal | ❌ | math_number ✅ | |
| "hello" | 'hello' | "hello" | Literal (isString) | ❌ | text ✅ | |
| true / false | True / False | true / false | Literal (1/0) | ❌ | logic_boolean ✅ | |
| **GPIO** | | | | | | |
| digitalWrite(p, v) | Pin.value() | gpio_set | GpioSet | ladder_coil | nf_gpio_set ✅ | |
| analogWrite(p, v) | duty() | pwm_set_duty | AnalogWrite | ❌ | ❌ | |
| pinMode(p, MODE) | Pin(mode=) | into_push_pull_output | CallExpression (pinMode) | ❌ | ❌ | |
| digitalRead(p) | digitalRead() | gpio_get | GpioRead | ladder_contact | nf_digital_read ✅ | |
| analogRead(p) | analogRead() | adc_read | AnalogRead | ❌ | nf_analog_read ✅ | |
| **Timing** | | | | | | |
| delay(ms) | utime.sleep_ms() | delay_ms | DelayMs | process | nf_delay ✅ | |
| delayMicroseconds(us) | utime.sleep_us() | ❌ | CallExpression (delay_us) | ❌ | ❌ | |
| millis() | utime.ticks_ms() | millis | CallExpression (millis) | ❌ | ❌ | |
| micros() | utime.ticks_us() | micros | CallExpression (micros) | ❌ | ❌ | |
| **Serial** | | | | | | |
| Serial.begin(9600) | uart.init() | Serial.begin | CallExpression (Serial.begin) | ❌ | ❌ | |
| Serial.print(x) | print(x) | println! | Print | ❌ | text_print ✅ | |
| Serial.available() | uart.any() | Serial.available | CallExpression (Serial.available) | ❌ | ❌ | |
| Serial.readString() | uart.read() | Serial.read | CallExpression (Serial.readString) | ❌ | ❌ | |
| **Sensors** | | | | | | |
| servo.write(a) | Servo().angle() | ❌ | CallExpression (servo) | ❌ | nf_servo ✅ | |
| tone(p, f, d) | ❌ | ❌ | CallExpression (tone) | ❌ | nf_tone ✅ | |
| noTone(p) | ❌ | ❌ | CallExpression (noTone) | ❌ | nf_notone ✅ | |
| dht.readTemp() | ❌ | ❌ | CallExpression (dht.readTemp) | ❌ | nf_dht_temp ✅ | |
| dht.readHumidity() | ❌ | ❌ | CallExpression (dht.readHum) | ❌ | nf_dht_hum ✅ | |
| ultrasonic.read() | ❌ | ❌ | CallExpression (ultrasonic.read) | ❌ | nf_ultrasonic_read ✅ | |
| digitalRead(ldrPin) | ❌ | ❌ | CallExpression (ldr.read) | ❌ | nf_ldr_read ✅ | |
| ir.read() | ❌ | ❌ | ❌ | ❌ | nf_ir_read ✅ | |
| keypad.getKey() | ❌ | ❌ | KeypadRead | ❌ | nf_keypad_read ✅ | |
| analogRead(joystick) | ❌ | ❌ | AnalogRead | ❌ | nf_joystick_read ✅ | |
| mpu.getValue() | ❌ | ❌ | CallExpression (mpu.get) | ❌ | nf_mpu_get ✅ | |
| **Displays** | | | | | | |
| lcd.print(x) | ❌ | ❌ | LcdPrint | ❌ | nf_lcd_print ✅ | |
| lcd.clear() | ❌ | ❌ | LcdClear | ❌ | nf_lcd_clear ✅ | |
| lcd.setCursor(c, r) | ❌ | ❌ | LcdCursor | ❌ | ❌ | |
| oled.print() | ❌ | ❌ | OledText | ❌ | nf_oled_text ✅ | |
| oled.show() | ❌ | ❌ | OledShow | ❌ | nf_oled_show ✅ | |
| oled.clear() | ❌ | ❌ | OledClear | ❌ | nf_oled_clear ✅ | |
| sevenSegment.print() | ❌ | ❌ | SevSegPrint | ❌ | nf_sevseg_print ✅ | |
| **LEDs/Neopixel** | | | | | | |
| rgb.setColor(r,g,b) | ❌ | ❌ | CallExpression (rgb.setColor) | ❌ | nf_rgb_set ✅ | |
| neopixel.set() | ❌ | ❌ | CallExpression (neopixel.set) | ❌ | nf_neopixel_set ✅ | |
| neopixel.show() | ❌ | ❌ | CallExpression (neopixel.show) | ❌ | nf_neopixel_show ✅ | |
| neopixel.clear() | ❌ | ❌ | CallExpression (neopixel.clear) | ❌ | nf_neopixel_clear ✅ | |
| **Motors** | | | | | | |
| motors.move(l, r) | ❌ | ❌ | CallExpression (motors.move) | ❌ | nf_motors_move ✅ | |
| **WiFi/HTTP** | | | | | | |
| WiFi.begin(s, p) | ❌ | ❌ | CallExpression (WiFi.begin) | ❌ | nf_wifi_begin ✅ | |
| WiFi.status() | ❌ | ❌ | CallExpression (WiFi.status) | ❌ | ❌ | |
| HTTP.get(url) | ❌ | ❌ | CallExpression (HTTP.get) | ❌ | nf_http_get ✅ | |
| **File System** | | | | | | |
| SPIFFS.open() | ❌ | ❌ | CallExpression (SPIFFS.open) | ❌ | ❌ | |
| file.write() | ❌ | ❌ | CallExpression (file.write) | ❌ | nf_spiffs_open ✅ | |
| **Other Functions** | | | | | | |
| attachInterrupt() | ❌ | ❌ | CallExpression (attachInterrupt) | ❌ | ❌ | |
| detachInterrupt() | ❌ | ❌ | CallExpression (detachInterrupt) | ❌ | ❌ | |
| pulseIn(p, val) | ❌ | ❌ | CallExpression (pulseIn) | ❌ | ❌ | |
| shiftOut(...) | ❌ | ❌ | CallExpression (shiftOut) | ❌ | ❌ | |
| shiftIn(...) | ❌ | ❌ | CallExpression (shiftIn) | ❌ | ❌ | |
| random(min, max) | random() | rand | CallExpression (random) | ❌ | ❌ | |
| **Flow Only - Industrial** | | | | | | |
| ❌ | ❌ | ❌ | CallExpression (TON/TOF/TP) | ladder_timer | ❌ | Timer (TON, TOF, TP) |
| ❌ | ❌ | ❌ | CallExpression (CTU/CTD) | ladder_counter | ❌ | Counter (CTU, CTD) |
| ❌ | ❌ | ❌ | CallExpression (SR/RS) | ladder_latch | ❌ | Latch (SR, RS) |
| ❌ | ❌ | ❌ | CallExpression (R_TRIG/F_TRIG) | ladder_trig | ❌ | Trigger (R_TRIG, F_TRIG) |
| ❌ | ❌ | ❌ | BinaryExpression | ladder_math | ❌ | Math (ADD, SUB, MUL, DIV) |
| ❌ | ❌ | ❌ | BinaryExpression | ladder_compare | ❌ | Compare (EQ, NEQ, GT, LT) |
| **Flow Only - Structure** | | | | | | |
| ❌ | ❌ | ❌ | ❌ | start | ❌ | Start node |
| ❌ | ❌ | ❌ | ❌ | end | ❌ | End node |
| ❌ | ❌ | ❌ | ❌ | process | ❌ | Generic process block |
| ❌ | ❌ | ❌ | IfStatement | state | ❌ | State machine state |
| **Flow Only - Components** | | | | | | |
| ❌ | ❌ | ❌ | ❌ | mcu | ❌ | MCU component |
| ❌ | ❌ | ❌ | ❌ | led | ❌ | LED component |
| ❌ | ❌ | ❌ | ❌ | rgbLed | ❌ | RGB LED component |
| ❌ | ❌ | ❌ | ❌ | button | ❌ | Button component |
| ❌ | ❌ | ❌ | ❌ | servo | ❌ | Servo component |
| ❌ | ❌ | ❌ | ❌ | potentiometer | ❌ | Potentiometer component |

---

## Summary - Nodes in need of implementation:

| Category | ASL Node | Flow Node | Blockly Block |
| :---- | :---- | :---- | :---- |
| **Functions** | Function | ❌ | ❌ |
| **Struct/Enum** | StructDeclaration, EnumDeclaration | ❌ | ❌ |
| **Loop** | DoWhileLoop | ❌ | ❌ |
| **Switch** | SwitchStatement, CaseClause | ❌ | ❌ |
| **Return** | ReturnStatement | ❌ | ❌ |
| **Expressions** | ConditionalExpression, CastExpression | ❌ | ❌ |
| **Arrays** | DesignatedInitializer | ❌ | ❌ |
| **Objects** | ObjectInitializer | ❌ | ❌ |
| **GPIO** | AnalogWrite | ❌ | ❌ |
| **Timing** | millis, micros, delay_us | ❌ | ❌ |
| **Serial** | Serial.begin/available/read | ❌ | ❌ |
| **Various** | pinMode, pulseIn, attachInterrupt, etc. | ❌ | ❌ |
