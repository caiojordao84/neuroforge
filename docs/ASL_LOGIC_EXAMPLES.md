# METADATA:
project_name: reservatorio-controle-logic
version: 12
editor: dendriForge
author: Caio Jordão Barradas
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[9|]{pin|type|io_mode|label|target_role}:
  0|digital|bi|"I2C0 SDA"|i2c-sda
  1|digital|bi|"I2C0 SCL"|i2c-scl
  15|digital|output|"Servo Válvula"|pwm-out
  16|digital|output|"HC-SR04 Trig"|digital-out
  17|digital|input|"HC-SR04 Echo"|digital-int
  18|digital|output|"Buzzer Alarme"|pwm-out
  19|digital|input|"Botão Manual"|int-rising
  20|digital|output|"LED Indicador"|digital-out
  26|analog|input|"Potenciômetro"|"adc:t"

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  H: 300
  M: 20
  L: 5
  CRIT_LOW: 10
  CRIT_HIGH: 10
  DEBOUNCE_TIME_MS: 300
  MIN_DUTY: 1966
  MAX_DUTY: 7864
  o: boolean
  set_valvula: boolean
  alarming: boolean
  last_toggle_time: 0
  t: 0
  n: 0

## 3. INITIALIZATION SYSTEM:
setup[12]:
  - initI2C(0, 0, 1, 400000)
  - initLCD(0x27, 16, 2)
  - pinMode(16, OUTPUT)
  - pinMode(17, INPUT)
  - pinMode(19, INPUT_PULLDOWN)
  - pinMode(20, OUTPUT)
  - pwmFreq(15, 50)
  - pwmFreq(18, 1000)
  - set_valvula(false)
  - lcdPrint(0, 0, "Iniciando...")
  - alarming (false)
  - o (false)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[18]:
  - t = int((readADC(26) / 65535) * H)
  - if t <= M: t = M + 1
  - sum_dist = 0
  - repeat(5): sum_dist = sum_dist + readDistanceCM(16, 17)
  - u = sum_dist / 5
  - n = int(H - u)
  - if n < 0: n = 0
  - if n > H: n = H
  - if not o and n <= M: set_valvula(true)
  - if o and n >= (t - L): set_valvula(false)
  - if n < CRIT_LOW or n > (t + CRIT_HIGH):
  - if not alarming: pwmWrite(18, 32768)
  - alarming = true
  - else:
  - if alarming: pwmWrite(18, 0)
  - alarming = false
  - update_display()
  - delay(500)

## 5. PROCEDURAL FUNCTIONS:
functions:
  set_servo_angle[3]:
    - angle = max(0, min(180, angle))
    - duty = int(MIN_DUTY + (MAX_DUTY - MIN_DUTY) * (angle / 180.0))
    - pwmWrite(15, duty)
    
  set_valvula[7]:
    - o = aberta
    - if o:
    - set_servo_angle(180)
    - digitalWrite(20, HIGH)
    - else:
    - set_servo_angle(0)
    - digitalWrite(20, LOW)
    
  toggle_valvula[1]:
    - set_valvula(not o)
    
  update_display[3]:
    - lcdClear()
    - lcdPrint(0, 0, "Pret: " + string(t) + "cm")
    - lcdPrint(0, 1, "Atual: " + string(n) + "cm")

  button_interrupt_handler[4]:
    - current_time = currentTime()
    - if (current_time - last_toggle_time) > DEBOUNCE_TIME_MS:
    - toggle_valvula()
    - last_toggle_time = current_time

	

# METADATA:
project_name: basic-blink-logic
version: 1
editor: dendriForge
author: USER_1129_20260519
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[1|]{pin|type|io_mode|label|target_role}:
  25|digital|output|"LED Integrado"|status-led

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  BLINK_INTERVAL: 500
  led_state: false

## 3. INITIALIZATION SYSTEM:
setup[3]:
  - pinMode(25, OUTPUT)
  - digitalWrite(25, LOW)
  - delay(1000)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[2]:
  - toggle_led()
  - delay(BLINK_INTERVAL)

## 5. PROCEDURAL FUNCTIONS:
functions:
  toggle_led[5]:
  - led_state = not led_state
  - if led_state:
  - digitalWrite(25, HIGH)
  - else:
  - digitalWrite(25, LOW)
  
  
# METADATA:
project_name: dual-button-led-control
version: 3
editor: dendriForge
author: SOGEKING
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[4|]{pin|type|io_mode|label|target_role}:
  2|digital|input|"Botao 1"|digital-in
  3|digital|input|"Botao 2"|digital-in
  4|digital|output|"LED 1"|digital-out
  5|digital|output|"LED 2"|digital-out

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  DEBOUNCE_TIME: 250
  led1_state: false
  led2_state: false

## 3. INITIALIZATION SYSTEM:
setup[6]:
  - pinMode(2, INPUT_PULLDOWN)
  - pinMode(3, INPUT_PULLDOWN)
  - pinMode(4, OUTPUT)
  - pinMode(5, OUTPUT)
  - digitalWrite(4, LOW)
  - digitalWrite(5, LOW)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[3]:
  - if digitalRead(2): toggle_led1()
  - if digitalRead(3): toggle_led2()
  - delay(DEBOUNCE_TIME)

## 5. PROCEDURAL FUNCTIONS:
functions:
  toggle_led1[5]:
    - led1_state = not led1_state
    - if led1_state:
    - digitalWrite(4, HIGH)
    - else:
    - digitalWrite(4, LOW)

  toggle_led2[5]:
    - led2_state = not led2_state
    - if led2_state:
    - digitalWrite(5, HIGH)
    - else:
    - digitalWrite(5, LOW)
	
	
# METADATA:
project_name: rain-alarm-analog-logic
version: 6
editor: dendriForge
author: Mugwara323
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[2|]{pin|type|io_mode|label|target_role}:
  26|analog|input|"Rain Sensor AOUT"|"adc:t"
  15|digital|output|"Buzzer VP"|pwm-out

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  RAIN_THRESHOLD: 30000
  BUZZER_DUTY: 32768
  rain_intensity: 0

## 3. INITIALIZATION SYSTEM:
setup[3]:
  - pinMode(15, OUTPUT)
  - pwmFreq(15, 1000)
  - pwmWrite(15, 0)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[3]:
  - rain_intensity = readADC(26)
  - set_buzzer_state(rain_intensity)
  - delay(100)

## 5. PROCEDURAL FUNCTIONS:
functions:
  set_buzzer_state(value)[4]:
    - if value > RAIN_THRESHOLD:
    - pwmWrite(15, BUZZER_DUTY)
    - else:
    - pwmWrite(15, 0)


# METADATA:
project_name: esp32c3-tft-i2c-th-meter
version: 1
editor: dendriForge
author: 123deoliveira4
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[8|]{pin|type|io_mode|label|target_role}:
  8|digital|bi|"I2C SDA (SIG1)"|i2c-sda
  9|digital|bi|"I2C SCL (SIG2)"|i2c-scl
  4|digital|output|"TFT MOSI"|spi-mosi
  6|digital|output|"TFT CLK"|spi-sck
  7|digital|output|"TFT CS"|spi-cs
  5|digital|output|"TFT DC"|digital-out
  3|digital|output|"TFT RST"|digital-out
  21|digital|output|"Serial TX via USB"|uart-tx

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  TEMP_UNIT: "C"
  HUMD_UNIT: "%"
  COLOR_BLACK: 0x0000
  COLOR_WHITE: 0xFFFF
  COLOR_RED: 0xF800
  center_x: 80
  center_y: 75
  humd: 0.0
  temp: 0.0

## 3. INITIALIZATION SYSTEM:
setup[8]:
  - initI2C(0, 8, 9, 100000)
  - initSPI(1, 4, -1, 6, 7)
  - initTFT(5, 3, 0)
  - initSensorI2C()
  - serialBegin(9600)
  - serialPrintln("Starting Universal I2C T/H Sensor")
  - tftFillScreen(COLOR_WHITE)
  - setup_the_screen()

## 4. BEHAVIORAL LOGIC (LOOP):
loop[14]:
  - temp = readTemperature()
  - humd = readHumidity()
  - delay(1000)
  - tftSetTextColor(COLOR_BLACK, COLOR_WHITE)
  - tftSetTextSize(2)
  - tftPrintText(center_x - 35, center_y + 29, string(humd, 1))
  - tftPrintText(center_x - 35, center_y - 27, string(temp, 1))
  - serialPrint("Time: ")
  - serialPrint(string(currentTime()))
  - serialPrint(" Temp: ")
  - serialPrint(string(temp, 1))
  - serialPrint(" Hum: ")
  - serialPrint(string(humd, 1))
  - serialPrintln(HUMD_UNIT)

## 5. PROCEDURAL FUNCTIONS:
functions:
  setup_the_screen()[10]:
    - tftDrawRoundRect(center_x - 75, center_y - 65, 120, 140, 4, COLOR_RED)
    - tftDrawRoundRect(center_x - 70, center_y - 35, 110, 30, 4, COLOR_RED)
    - tftDrawRoundRect(center_x - 70, center_y + 20, 110, 30, 4, COLOR_RED)
    - tftSetTextSize(1)
    - tftSetTextColor(COLOR_BLACK, COLOR_WHITE)
    - tftPrintText(center_x - 55, center_y - 48, "temperature")
    - tftPrintText(center_x + 15, center_y - 52, "o")
    - tftPrintText(center_x + 21, center_y - 48, TEMP_UNIT)
    - tftPrintText(center_x - 45, center_y + 10, "% humidity")
    - tftPrintText(center_x - 55, center_y + 63, "Universal T/H I2C")


	
# METADATA:
project_name: pong-game-logic
version: 19
editor: dendriForge
author: B3lly--BTN_2005
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[5|]{pin|type|io_mode|label|target_role}:
  2|digital|input|"Botao Cima"|btn-up
  3|digital|input|"Botao Baixo"|btn-down
  11|digital|output|"Buzzer Audio"|pwm-out
  0|digital|bi|"I2C SDA"|i2c-sda
  1|digital|bi|"I2C SCL"|i2c-scl

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  WHITE: 1
  BLACK: 0
  BALL_RATE: 30
  PADDLE_RATE: 20
  PADDLE_HEIGHT: 8
  SCORE_LIMIT: 5
  player_score: 0
  mcu_score: 0
  ball_x: 53
  ball_y: 26
  ball_dir_x: 1
  ball_dir_y: 1
  mcu_y: 16
  player_y: 16
  ball_update: 0
  paddle_update: 0
  game_over: false
  win: false

## 3. INITIALIZATION SYSTEM:
setup[7]:
  - initI2C(0, 0, 1, 400000)
  - initLCD(0x3C, 128, 64)
  - display.clearDisplay()
  - drawCourt()
  - display.display()
  - ball_update = currentTime()
  - paddle_update = ball_update

## 4. BEHAVIORAL LOGIC (LOOP):
loop[7]:
  - current_time = currentTime()
  - if current_time > ball_update: update_ball()
  - if current_time > paddle_update: update_paddles()
  - if game_over: reset_game()
  - draw_score()
  - display.display()
  - delay(10)

## 5. PROCEDURAL FUNCTIONS:
functions:
  drawCourt()[1]:
    - display.drawRect(0, 0, 128, 54, WHITE)

  update_ball()[27]:
    - new_x = ball_x + ball_dir_x
    - new_y = ball_y + ball_dir_y
    - if new_x == 0 or new_x == 127:
    - ball_dir_x = -ball_dir_x
    - if new_x < 64:
    - player_score = player_score + 1
    - play_score_tone()
    - else:
    - mcu_score = mcu_score + 1
    - play_score_tone()
    - if player_score == SCORE_LIMIT or mcu_score == SCORE_LIMIT:
    - win = player_score > mcu_score
    - game_over = true
    - if new_y == 0 or new_y == 53:
    - ball_dir_y = -ball_dir_y
    - play_wall_tone()
    - if new_x == 12 and new_y >= mcu_y and new_y <= mcu_y + PADDLE_HEIGHT:
    - ball_dir_x = -ball_dir_x
    - play_mcu_tone()
    - if new_x == 115 and new_y >= player_y and new_y <= player_y + PADDLE_HEIGHT:
    - ball_dir_x = -ball_dir_x
    - play_player_tone()
    - display.drawPixel(ball_x, ball_y, BLACK)
    - display.drawPixel(new_x, new_y, WHITE)
    - ball_x = new_x
    - ball_y = new_y
    - ball_update = ball_update + BALL_RATE

  update_paddles()[11]:
    - display.drawFastVLine(12, mcu_y, PADDLE_HEIGHT, BLACK)
    - display.drawFastVLine(115, player_y, PADDLE_HEIGHT, BLACK)
    - if digitalRead(2) == LOW: player_y = player_y - 2
    - if digitalRead(3) == LOW: player_y = player_y + 2
    - if player_y < 1: player_y = 1
    - if player_y + PADDLE_HEIGHT > 53: player_y = 53 - PADDLE_HEIGHT
    - if mcu_y + 4 > ball_y: mcu_y = mcu_y - 1
    - if mcu_y + 4 < ball_y: mcu_y = mcu_y + 1
    - display.drawFastVLine(12, mcu_y, PADDLE_HEIGHT, WHITE)
    - display.drawFastVLine(115, player_y, PADDLE_HEIGHT, WHITE)
    - paddle_update = paddle_update + PADDLE_RATE

  draw_score()[5]:
    - display.setTextColor(WHITE, BLACK)
    - display.setCursor(0, 56)
    - display.print(mcu_score)
    - display.setCursor(122, 56)
    - display.print(player_score)

  reset_game()[18]:
    - display.clearDisplay()
    - if win:
    - display.setCursor(40, 28)
    - display.print("YOU WIN!")
    - else:
    - display.setCursor(40, 28)
    - display.print("YOU LOSE!")
    - display.display()
    - delay(3000)
    - player_score = 0
    - mcu_score = 0
    - game_over = false
    - ball_x = 53
    - ball_y = 26
    - ball_dir_x = 1
    - ball_dir_y = 1
    - display.clearDisplay()
    - drawCourt()

  play_player_tone()[1]:
    - tone(11, 250, 25)
    
  play_mcu_tone()[1]:
    - tone(11, 225, 25)

  play_wall_tone()[1]:
    - tone(11, 200, 25)
    
  play_score_tone()[1]:
    - tone(11, 500, 100)


# METADATA:
project_name: plc-sequence-ap-bp-am-bm
version: 104
editor: dendriForge
author: TJUICE
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[9|]{pin|type|io_mode|label|target_role}:
  0|digital|input|"Start Button"|btn-start
  1|digital|input|"Sensor A0 (Retracted)"|sensor-a0
  2|digital|input|"Sensor A1 (Extended)"|sensor-a1
  3|digital|input|"Sensor B0 (Retracted)"|sensor-b0
  4|digital|input|"Sensor B1 (Extended)"|sensor-b1
  14|digital|output|"Valve A+ (Extend)"|valve-a-plus
  15|digital|output|"Valve A- (Retract)"|valve-a-minus
  16|digital|output|"Valve B+ (Extend)"|valve-b-plus
  17|digital|output|"Valve B- (Retract)"|valve-b-minus

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  step: 0
  start_btn: false
  a0: false
  a1: false
  b0: false
  b1: false
  out_a: false
  out_b: false

## 3. INITIALIZATION SYSTEM:
setup[9]:
  - pinMode(0, INPUT)
  - pinMode(1, INPUT)
  - pinMode(2, INPUT)
  - pinMode(3, INPUT)
  - pinMode(4, INPUT)
  - pinMode(14, OUTPUT)
  - pinMode(15, OUTPUT)
  - pinMode(16, OUTPUT)
  - pinMode(17, OUTPUT)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[4]:
  - read_inputs()
  - process_state_machine()
  - write_outputs()
  - delay(10)

## 5. PROCEDURAL FUNCTIONS:
functions:
  read_inputs()[5]:
    - start_btn = digitalRead(0)
    - a0 = digitalRead(1)
    - a1 = digitalRead(2)
    - b0 = digitalRead(3)
    - b1 = digitalRead(4)

  process_state_machine()[10]:
    - if step == 0 and start_btn and a0 and b0:
    - step = 1
    - if step == 1 and a1:
    - step = 2
    - if step == 2 and b1:
    - step = 3
    - if step == 3 and a0:
    - step = 4
    - if step == 4 and b0:
    - step = 0

  write_outputs()[14]:
    - out_a = (step == 1) or (step == 2)
    - out_b = (step == 2) or (step == 3)
    - if out_a:
    - digitalWrite(14, HIGH)
    - digitalWrite(15, LOW)
    - else:
    - digitalWrite(14, LOW)
    - digitalWrite(15, HIGH)
    - if out_b:
    - digitalWrite(16, HIGH)
    - digitalWrite(17, LOW)
    - else:
    - digitalWrite(16, LOW)
    - digitalWrite(17, HIGH)


# METADATA:
project_name: plc-elevator-advanced
version: 2222
editor: dendriForge
author: Elevator Operator
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[26|]{pin|type|io_mode|label|target_role}:
  0|digital|input|"Pos Sensor Floor 0"|sensor-pos
  1|digital|input|"Pos Sensor Floor 1"|sensor-pos
  2|digital|input|"Pos Sensor Floor 2"|sensor-pos
  3|digital|input|"Pos Sensor Floor 3"|sensor-pos
  4|digital|input|"Cabin Button 0"|btn-no
  5|digital|input|"Cabin Button 1"|btn-no
  6|digital|input|"Cabin Button 2"|btn-no
  7|digital|input|"Cabin Button 3"|btn-no
  8|digital|input|"Hall Button 0"|btn-no
  9|digital|input|"Hall Button 1"|btn-no
  10|digital|input|"Hall Button 2"|btn-no
  11|digital|input|"Hall Button 3"|btn-no
  12|digital|input|"IR Receiver (Curtain)"|ir-rx
  13|digital|output|"Cabin LED 0"|led-out
  14|digital|output|"Cabin LED 1"|led-out
  15|digital|output|"Cabin LED 2"|led-out
  16|digital|output|"Cabin LED 3"|led-out
  17|digital|output|"Hall LED 0"|led-out
  18|digital|output|"Hall LED 1"|led-out
  19|digital|output|"Hall LED 2"|led-out
  20|digital|output|"Hall LED 3"|led-out
  21|digital|output|"Up Motor Relay"|relay-coil
  22|digital|output|"Down Motor Relay"|relay-coil
  23|digital|output|"Door Open Relay"|relay-coil
  24|digital|output|"Door Close Relay"|relay-coil
  25|digital|output|"IR Transmitter"|ir-tx

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  DOOR_DELAY_MS: 3000
  state: 0
  current_floor: 0
  door_timer: 0
  call_0: false
  call_1: false
  call_2: false
  call_3: false
  ir_blocked: false

## 3. INITIALIZATION SYSTEM:
setup[27]:
  - pinMode(0, INPUT)
  - pinMode(1, INPUT)
  - pinMode(2, INPUT)
  - pinMode(3, INPUT)
  - pinMode(4, INPUT)
  - pinMode(5, INPUT)
  - pinMode(6, INPUT)
  - pinMode(7, INPUT)
  - pinMode(8, INPUT)
  - pinMode(9, INPUT)
  - pinMode(10, INPUT)
  - pinMode(11, INPUT)
  - pinMode(12, INPUT)
  - pinMode(13, OUTPUT)
  - pinMode(14, OUTPUT)
  - pinMode(15, OUTPUT)
  - pinMode(16, OUTPUT)
  - pinMode(17, OUTPUT)
  - pinMode(18, OUTPUT)
  - pinMode(19, OUTPUT)
  - pinMode(20, OUTPUT)
  - pinMode(21, OUTPUT)
  - pinMode(22, OUTPUT)
  - pinMode(23, OUTPUT)
  - pinMode(24, OUTPUT)
  - pinMode(25, OUTPUT)
  - digitalWrite(25, HIGH)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[8]:
  - read_sensors()
  - register_calls()
  - update_leds()
  - check_arrival()
  - decide_movement()
  - handle_doors()
  - write_outputs()
  - delay(10)

## 5. PROCEDURAL FUNCTIONS:
functions:
  read_sensors()[9]:
    - if digitalRead(0):
    - current_floor = 0
    - if digitalRead(1):
    - current_floor = 1
    - if digitalRead(2):
    - current_floor = 2
    - if digitalRead(3):
    - current_floor = 3
    - ir_blocked = digitalRead(12)

  register_calls()[8]:
    - if digitalRead(4) or digitalRead(8):
    - call_0 = true
    - if digitalRead(5) or digitalRead(9):
    - call_1 = true
    - if digitalRead(6) or digitalRead(10):
    - call_2 = true
    - if digitalRead(7) or digitalRead(11):
    - call_3 = true

  update_leds()[24]:
    - if call_0:
    - digitalWrite(13, HIGH)
    - digitalWrite(17, HIGH)
    - else:
    - digitalWrite(13, LOW)
    - digitalWrite(17, LOW)
    - if call_1:
    - digitalWrite(14, HIGH)
    - digitalWrite(18, HIGH)
    - else:
    - digitalWrite(14, LOW)
    - digitalWrite(18, LOW)
    - if call_2:
    - digitalWrite(15, HIGH)
    - digitalWrite(19, HIGH)
    - else:
    - digitalWrite(15, LOW)
    - digitalWrite(19, LOW)
    - if call_3:
    - digitalWrite(16, HIGH)
    - digitalWrite(20, HIGH)
    - else:
    - digitalWrite(16, LOW)
    - digitalWrite(20, LOW)

  check_arrival()[12]:
    - if current_floor == 0 and call_0:
    - call_0 = false
    - open_doors()
    - if current_floor == 1 and call_1:
    - call_1 = false
    - open_doors()
    - if current_floor == 2 and call_2:
    - call_2 = false
    - open_doors()
    - if current_floor == 3 and call_3:
    - call_3 = false
    - open_doors()

  open_doors()[2]:
    - state = 3
    - door_timer = currentTime()

  decide_movement()[13]:
    - if state == 0:
    - if current_floor == 0 and (call_1 or call_2 or call_3):
    - state = 1
    - if current_floor == 1 and (call_2 or call_3):
    - state = 1
    - if current_floor == 1 and call_0:
    - state = 2
    - if current_floor == 2 and call_3:
    - state = 1
    - if current_floor == 2 and (call_0 or call_1):
    - state = 2
    - if current_floor == 3 and (call_0 or call_1 or call_2):
    - state = 2

  handle_doors()[5]:
    - if state == 3:
    - if ir_blocked:
    - door_timer = currentTime()
    - if (currentTime() - door_timer) > DOOR_DELAY_MS:
    - state = 0

  write_outputs()[18]:
    - if state == 1:
    - digitalWrite(21, HIGH)
    - digitalWrite(22, LOW)
    - if state == 2:
    - digitalWrite(21, LOW)
    - digitalWrite(22, HIGH)
    - if state == 0 or state == 3:
    - digitalWrite(21, LOW)
    - digitalWrite(22, LOW)
    - if state == 3:
    - digitalWrite(23, HIGH)
    - digitalWrite(24, LOW)
    - if state == 0:
    - digitalWrite(23, LOW)
    - digitalWrite(24, HIGH)
    - if state == 1 or state == 2:
    - digitalWrite(23, LOW)
    - digitalWrite(24, LOW)


# METADATA:
project_name: advanced-robotic-scara-pid
version: 8
editor: dendriForge
author: ASLAgent#032
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
# Format: pin | type | io_mode | label | target_role
hardware[8|]{pin|type|io_mode|label|target_role}:
  2|digital|input|"E-STOP Emergency"|int-falling
  3|digital|input|"Axis-1 Index Encoder"|int-rising
  14|digital|output|"Axis-1 Step Pin"|pwm-out
  15|digital|output|"Axis-1 Dir Pin"|digital-out
  16|digital|output|"Tool Heater element"|pwm-out
  26|analog|input|"Tool Thermistor"|"adc:t"
  0|digital|bi|"I2C0 SDA"|i2c-sda
  1|digital|bi|"I2C0 SCL"|i2c-scl

## 2. SYSTEM DATA:
data:
  TIME_UNIT: ms
  KP: 25.5
  KI: 1.2
  KD: 5.0
  setpoint_temp: 210.0
  current_temp: 0.0
  pid_error: 0.0
  last_error: 0.0
  integral: 0.0
  derivative: 0.0
  pid_output: 0
  current_x: 120.5
  current_y: 85.0
  target_x: 0.0
  target_y: 0.0
  steps_per_mm: 80
  sys_safety_halt: false
  last_interrupt_time: 0
  delta_x: 0.0
  delta_y: 0.0
  distance: 0.0
  total_steps: 0
  count: 0
  raw_adc: 0
  resistance: 0.0
  calculated_temp: 0.0
  time_now: 0

## 3. INITIALIZATION SYSTEM:
setup[10]:
  - pinMode(2, INPUT_PULLUP)
  - pinMode(3, INPUT_PULLUP)
  - pinMode(15, OUTPUT)
  - pinMode(16, OUTPUT)
  - attachInterrupt(2, isr_emergency_halt, FALLING)
  - attachInterrupt(3, isr_encoder_pulse, RISING)
  - pwmFreq(14, 2000)
  - pwmFreq(16, 5000)
  - initI2C(0, 0, 1, 400000)
  - initLCD(0x27, 16, 2)

## 4. BEHAVIORAL LOGIC (LOOP):
loop[10]:
  - if sys_safety_halt:
  - delay(100)
  - current_temp = read_temperature_celsius()
  - compute_thermal_pid()
  - if not sys_safety_halt:
  - move_to_vpos(200.0, 150.0)
  - delay(50)
  - if not sys_safety_halt:
  - move_to_vpos(120.5, 85.0)
  - delay(2000)

## 5. PROCEDURAL FUNCTIONS:
functions:
  move_to_vpos(val_x, val_y)[14]:
    - target_x = val_x
    - target_y = val_y
    - delta_x = target_x - current_x
    - delta_y = target_y - current_y
    - distance = sqrt((delta_x * delta_x) + (delta_y * delta_y))
    - if distance > 0.1:
    - if delta_x >= 0:
    - digitalWrite(15, HIGH)
    - else:
    - digitalWrite(15, LOW)
    - total_steps = int(distance * steps_per_mm)
    - execute_trajectory_pulses(total_steps)
    - current_x = target_x
    - current_y = target_y

  execute_trajectory_pulses(pulses)[7]:
    - count = 0
    - repeat(pulses):
    - if not sys_safety_halt:
    - pwmWrite(14, 32768)
    - delay(2)
    - pwmWrite(14, 0)
    - delay(2)

  compute_thermal_pid()[11]:
    - pid_error = setpoint_temp - current_temp
    - integral = integral + pid_error
    - if integral > 1000:
    - integral = 1000
    - if integral < -1000:
    - integral = -1000
    - derivative = pid_error - last_error
    - pid_output = int((KP * pid_error) + (KI * integral) + (KD * derivative))
    - pid_output = max(0, min(65535, pid_output))
    - pwmWrite(16, pid_output)
    - last_error = pid_error

  read_temperature_celsius()[5]:
    - raw_adc = readADC(26)
    - resistance = (65535 / raw_adc) - 1
    - calculated_temp = 1 / (0.001129148 + (0.000234125 * log(resistance)))
    - calculated_temp = calculated_temp - 273.15
    - return(calculated_temp)

  isr_emergency_halt()[7]:
    - sys_safety_halt = true
    - pwmWrite(14, 0)
    - pwmWrite(16, 0)
    - digitalWrite(15, LOW)
    - lcdClear()
    - lcdPrint(0, 0, "## E-STOP ##")
    - lcdPrint(0, 1, "SYSTEM HALTED")

  isr_encoder_pulse()[3]:
    - time_now = currentTime()
    - if (time_now - last_interrupt_time) > 5:
    - last_interrupt_time = time_now
	

# METADATA:
project_name: multi-display-dashboard
version: 1
editor: dendriForge
author: GEMINI
ASLversion: 0.2.0

## 1. HARDWARE INTERFACE:
hardware[11|]{pin|type|io_mode|label|target_role}:
  21|digital|bi|"I2C SDA (LCD + OLED)"|i2c-sda
  22|digital|bi|"I2C SCL (LCD + OLED)"|i2c-scl
  23|digital|output|"TFT MOSI"|spi-mosi
  18|digital|output|"TFT CLK"|spi-sck
  5|digital|output|"TFT CS"|spi-cs
  2|digital|output|"TFT DC"|digital-out
  4|digital|output|"TFT RST"|digital-out
  34|analog|input|"Temperature Sensor (NTC)"|"adc:t"
  35|analog|input|"Light Sensor (LDR)"|"adc:t"
  32|digital|input_pullup|"Page Button"|btn-no
  33|digital|output|"Status LED"|status-led

## 2. SYSTEM DATA:
data:
  NTC_NOMINAL: 10000.0
  NTC_BCOEFF: 3950.0
  NTC_SERIES_R: 10000.0
  LDR_MAX: 65535.0
  COLOR_BG: 0x0000
  COLOR_FG: 0xFFFF
  COLOR_ACCENT: 0x07FF
  COLOR_WARN: 0xFBE0
  COLOR_ALERT: 0xF800
  TEMP_WARN_C: 40.0
  TEMP_ALERT_C: 60.0
  PAGE_COUNT: 3
  DEBOUNCE_MS: 200
  current_page: 0
  last_btn_time: 0
  temp_c: 0.0
  ldr_raw: 0
  ldr_pct: 0
  light_label: "---"
  last_page_drawn: 99
  raw_adc: 0
  r_ntc: 0.0
  log_r: 0.0
  inv_t: 0.0
  calculated_temp: 0.0
  bar_width: 0
  tft_color: 0
  current_time: 0

## 3. INITIALIZATION SYSTEM:
setup[14]:
  - initI2C(0, 21, 22, 400000)
  - initLCD(0x27, 16, 2)
  - initOLED(0x3C, 128, 64)
  - initSPI(1, 23, -1, 18, 5)
  - initTFT(2, 4, 1)
  - pinMode(32, INPUT_PULLUP)
  - pinMode(33, OUTPUT)
  - digitalWrite(33, LOW)
  - attachInterrupt(32, isr_page_button, FALLING)
  - tftFillScreen(COLOR_BG)
  - display.clearDisplay()
  - display.display()
  - lcdPrint(0, 0, "DendriForge")
  - lcdPrint(0, 1, "Dashboard v1")

## 4. BEHAVIORAL LOGIC (LOOP):
loop[8]:
  - temp_c = read_ntc_celsius()
  - ldr_raw = readADC(35)
  - ldr_pct = int((ldr_raw / LDR_MAX) * 100)
  - update_light_label()
  - update_status_led()
  - if current_page != last_page_drawn:
  - draw_page()
  - last_page_drawn = current_page

## 5. PROCEDURAL FUNCTIONS:
functions:
  read_ntc_celsius()[6]:
    - raw_adc = readADC(34)
    - r_ntc = NTC_SERIES_R * (65535.0 / raw_adc - 1.0)
    - log_r = log(r_ntc / NTC_NOMINAL)
    - inv_t = (1.0 / 298.15) + (log_r / NTC_BCOEFF)
    - calculated_temp = (1.0 / inv_t) - 273.15
    - return(calculated_temp)

  update_light_label()[6]:
    - if ldr_pct >= 75:
    - light_label = "Bright"
    - if ldr_pct >= 40 and ldr_pct < 75:
    - light_label = "Normal"
    - if ldr_pct < 40:
    - light_label = "Dark"

  update_status_led()[4]:
    - if temp_c >= TEMP_ALERT_C:
    - digitalWrite(33, HIGH)
    - else:
    - digitalWrite(33, LOW)

  draw_page()[6]:
    - display.clearDisplay()
    - lcdClear()
    - if current_page == 0: draw_page_temperature()
    - if current_page == 1: draw_page_light()
    - if current_page == 2: draw_page_system()
    - display.display()

  draw_page_temperature()[21]:
    - tft_color = COLOR_FG
    - if temp_c >= TEMP_ALERT_C:
    - tft_color = COLOR_ALERT
    - if temp_c >= TEMP_WARN_C and temp_c < TEMP_ALERT_C:
    - tft_color = COLOR_WARN
    - tftFillScreen(COLOR_BG)
    - tftSetTextColor(tft_color, COLOR_BG)
    - tftSetTextSize(3)
    - tftPrintText(10, 20, string(temp_c, 1))
    - tftSetTextSize(1)
    - tftPrintText(10, 70, "Celsius")
    - tftDrawLine(0, 80, 160, 80, COLOR_ACCENT)
    - tftPrintText(10, 90, "Threshold:")
    - tftPrintText(80, 90, string(TEMP_WARN_C, 0))
    - lcdPrint(0, 0, "Temp: " + string(temp_c, 1) + " C")
    - lcdPrint(0, 1, "Page 1/3 [TEMP]")
    - display.setTextColor(1, 0)
    - display.setCursor(0, 0)
    - display.print("TEMPERATURE")
    - display.setCursor(0, 16)
    - display.print(string(temp_c, 2) + " C")

  draw_page_light()[16]:
    - bar_width = int((ldr_pct / 100.0) * 100)
    - display.setTextColor(1, 0)
    - display.setCursor(0, 0)
    - display.print("LIGHT LEVEL")
    - display.setCursor(0, 12)
    - display.print(string(ldr_pct) + "% " + light_label)
    - display.drawRect(0, 28, 102, 10, 1)
    - display.fillRect(1, 29, bar_width, 8, 1)
    - display.setCursor(0, 44)
    - display.print("LDR raw: " + string(ldr_raw))
    - lcdPrint(0, 0, "Light: " + string(ldr_pct) + "% ")
    - lcdPrint(0, 1, light_label)
    - tftFillScreen(COLOR_BG)
    - tftSetTextColor(COLOR_ACCENT, COLOR_BG)
    - tftSetTextSize(2)
    - tftPrintText(10, 20, string(ldr_pct) + "%")

  draw_page_system()[9]:
    - lcdPrint(0, 0, "DendriForge v1")
    - lcdPrint(0, 1, "ASL 0.2.0 Ready")
    - display.setTextColor(1, 0)
    - display.setCursor(0, 0)
    - display.print("SYSTEM")
    - display.setCursor(0, 16)
    - display.print("ASL 0.2.0")
    - display.setCursor(0, 32)
    - display.print("t=" + string(currentTime()) + "ms")

  isr_page_button()[4]:
    - current_time = currentTime()
    - if (current_time - last_btn_time) > DEBOUNCE_MS:
    - current_page = (current_page + 1) % PAGE_COUNT
    - last_btn_time = current_time