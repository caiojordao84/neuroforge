## Table \- ALL nodeTypes from Parsers:

| C Function | Python Function | Rust Function | ASL Node | Blockly Block | Description |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Program Structure |  |  |  |  |  |
| void setup() {} | def setup(): | fn setup() | Function (name: setup) | ❌ |  |
| void loop() {} | while True: | \#\[entry\] | Function (name: loop) | nf\_loop ✅ |  |
| void main() {} | def main(): | fn main() | Function (name: main) | ❌ |  |
| void myFunc() {} | def myFunc(): | fn myFunc() | Function | ❌ |  |
| ❌ | class MyClass: | struct MyStruct | StructDeclaration | ❌ |  |
| ❌ | ❌ | enum MyEnum | EnumDeclaration | ❌ |  |
| Control Flow |  |  |  |  |  |
| if (cond) {} | if cond: | if | IfStatement | controls\_if ✅ |  |
| while (cond) {} | while cond: | while | WhileLoop | controls\_whileUntil ✅ |  |
| do {} while(cond) | while True: break if | loop { ... break\_if } | DoWhileLoop | ❌ |  |
| for (;;) {} | for i in range(): | for i in 0.. | ForLoop | controls\_for ✅ |  |
| for (x in arr) | for x in list: | for x in iter | ForIn | controls\_forEach ✅ |  |
| switch (x) {} | match x: | match | SwitchStatement | ❌ |  |
| case x: | case x: | \=\> | CaseClause | ❌ |  |
| break; | break | break | BreakStatement | controls\_flow\_statements ✅ |  |
| continue; | continue | continue | ContinueStatement | controls\_flow\_statements ✅ |  |
| return x; | return x | return | ReturnStatement | ❌ |  |
| {} (block) | indented block | { ... } | Block | ❌ (implicit) |  |
| Variables |  |  |  |  |  |
| int x \= 5; | x \= 5 / x: int \= 5 | let x \= 5 | VariableDeclaration | variables\_set ✅ |  |
| x \= 10; | x \= 10 | x \= 10 | BinaryExpression (=) / ExpressionStatement | variables\_set ✅ |  |
| int arr\[\] \= {1,2} | arr \= \[1,2\] | let arr \= vec\!\[1,2\] | ArrayInitializer | lists\_create\_with ✅ |  |
| arr\[0\] | arr\[0\] | arr\[0\] | SubscriptExpression | lists\_getIndex ✅ |  |
| obj.prop | obj.prop | obj.prop | MemberExpression | ❌ |  |
| x ? a : b | ❌ | ❌ | ConditionalExpression | ❌ |  |
| int x\[3\] \= {.a=1} | {'a': 1} | Struct { a: 1 } | DesignatedInitializer / ObjectInitializer | ❌ |  |
| (int)x | ❌ | x as i32 | CastExpression | ❌ |  |
| ❌ | ❌ | \&x | UnaryExpression (ref) | ❌ |  |
| Literals |  |  |  |  |  |
| 123 | 123 | 123 | Literal | math\_number ✅ |  |
| "hello" | 'hello' | "hello" | Literal (isString) | text ✅ |  |
| true / false | True / False | true / false | Literal (1/0) | logic\_boolean ✅ |  |
| GPIO |  |  |  |  |  |
| digitalWrite(p, v) | Pin.value() | gpio\_set | GpioSet | nf\_gpio\_set ✅ |  |
| analogWrite(p, v) | duty() | pwm\_set\_duty | AnalogWrite | ❌ |  |
| pinMode(p, MODE) | Pin(mode=) | into\_push\_pull\_output | CallExpression (pinMode) | ❌ |  |
| digitalRead(p) | digitalRead() | gpio\_get | GpioRead | nf\_digital\_read ✅ |  |
| analogRead(p) | analogRead() | adc\_read | AnalogRead | nf\_analog\_read ✅ |  |
| Timing |  |  |  |  |  |
| delay(ms) | utime.sleep\_ms() | delay\_ms | DelayMs | nf\_delay ✅ |  |
| delayMicroseconds(us) | utime.sleep\_us() |  | CallExpression (delay\_us) | ❌ |  |
| millis() | utime.ticks\_ms() | millis | CallExpression (millis) | ❌ |  |
| micros() | utime.ticks\_us() | micros | CallExpression (micros) | ❌ |  |
| Serial |  |  |  |  |  |
| Serial.begin(9600) | uart.init() | Serial.begin | CallExpression (Serial.begin) | ❌ |  |
| Serial.print(x) | print(x) | println\! | Print | text\_print ✅ |  |
| Serial.available() | uart.any() | Serial.available | CallExpression (Serial.available) | ❌ |  |
| Serial.readString() | uart.read() | Serial.read | CallExpression (Serial.readString) | ❌ |  |
| Sensors |  |  |  |  |  |
| servo.write(a) | Servo().angle() |  | CallExpression (servo) | nf\_servo ✅ |  |
| tone(p, f, d) | ❌ | ❌ | CallExpression (tone) | nf\_tone ✅ |  |
| noTone(p) | ❌ | ❌ | CallExpression (noTone) | nf\_notone ✅ |  |
| dht.readTemp() | ❌ | ❌ | CallExpression (dht.readTemp) | nf\_dht\_temp ✅ |  |
| dht.readHumidity() | ❌ | ❌ | CallExpression (dht.readHum) | nf\_dht\_hum ✅ |  |
| ultrasonic.read() | ❌ | ❌ | CallExpression (ultrasonic.read) | nf\_ultrasonic\_read ✅ |  |
| digitalRead(ldrPin) | ❌ | ❌ | CallExpression (ldr.read) | nf\_ldr\_read ✅ |  |
| ir.read() | ❌ | ❌ | ❌ | nf\_ir\_read ✅ |  |
| keypad.getKey() | ❌ | ❌ | KeypadRead | nf\_keypad\_read ✅ |  |
| analogRead(joystick) | ❌ | ❌ | AnalogRead | nf\_joystick\_read ✅ |  |
| mpu.getValue() | ❌ | ❌ | CallExpression (mpu.get) | nf\_mpu\_get ✅ |  |
| Displays |  |  |  |  |  |
| lcd.print(x) | ❌ | ❌ | LcdPrint | nf\_lcd\_print ✅ |  |
| lcd.clear() | ❌ | ❌ | LcdClear | nf\_lcd\_clear ✅ |  |
| lcd.setCursor(c, r) | ❌ | ❌ | LcdCursor | ❌ |  |
| oled.print() | ❌ | ❌ | OledText | nf\_oled\_text ✅ |  |
| oled.show() | ❌ | ❌ | OledShow | nf\_oled\_show ✅ |  |
| oled.clear() | ❌ | ❌ | OledClear | nf\_oled\_clear ✅ |  |
| sevenSegment.print() | ❌ | ❌ | SevSegPrint | nf\_sevseg\_print ✅ |  |
| LEDs/Neopixel | ❌ | ❌ | ❌ | ❌ |  |
| rgb.setColor(r,g,b) | ❌ | ❌ | CallExpression (rgb.setColor) | nf\_rgb\_set ✅ |  |
| neopixel.set() | ❌ | ❌ | CallExpression (neopixel.set) | nf\_neopixel\_set ✅ |  |
| neopixel.show() | ❌ | ❌ | CallExpression (neopixel.show) | nf\_neopixel\_show ✅ |  |
| neopixel.clear() | ❌ | ❌ | CallExpression (neopixel.clear) | nf\_neopixel\_clear ✅ |  |
| Motors |  |  |  |  |  |
| motors.move(l, r) | ❌ | ❌ | CallExpression (motors.move) | nf\_motors\_move ✅ |  |
| WiFi/HTTP |  |  |  |  |  |
| WiFi.begin(s, p) | ❌ | ❌ | CallExpression (WiFi.begin) | nf\_wifi\_begin ✅ |  |
| WiFi.status() | ❌ | ❌ | CallExpression (WiFi.status) | ❌ |  |
| HTTP.get(url) | ❌ | ❌ | CallExpression (HTTP.get) | nf\_http\_get ✅ |  |
| File System |  |  |  |  |  |
| SPIFFS.open() | ❌ | ❌ | CallExpression (SPIFFS.open) | ❌ |  |
| file.write() | ❌ | ❌ | CallExpression (file.write) | nf\_spiffs\_open ✅ |  |
| Other Functions |  |  |  |  |  |
| attachInterrupt() | ❌ | ❌ | CallExpression (attachInterrupt) | ❌ |  |
| detachInterrupt() | ❌ | ❌ | CallExpression (detachInterrupt) | ❌ |  |
| pulseIn(p, val) | ❌ | ❌ | CallExpression (pulseIn) | ❌ |  |
| shiftOut(...) | ❌ | ❌ | CallExpression (shiftOut) | ❌ |  |
| shiftIn(...) | ❌ | ❌ | CallExpression (shiftIn) | ❌ |  |
| random(min, max) | random() | rand | CallExpression (random) | ❌ |  |

---

## Summary \- Blockly Blocks in need of implementation:

| Category | ASL Node | Status |
| :---- | :---- | :---- |
| Functions | Function | ❌ |
| Struct/Enum | StructDeclaration, EnumDeclaration | ❌ |
| Loop | DoWhileLoop | ❌ |
| Switch | SwitchStatement, CaseClause | ❌ |
| Return | ReturnStatement | ❌ |
| Expressions | ConditionalExpression, CastExpression | ❌ |
| Arrays | DesignatedInitializer | ❌ |
| Objects | ObjectInitializer | ❌ |
| GPIO | AnalogWrite | ❌ |
| Timing | CallExpression (millis, micros, delay\_us) | ❌ |
| Serial | Serial.begin/available/read | ❌ |
| Various | pinMode, pulseIn, attachInterrupt, etc. | ❌ |

