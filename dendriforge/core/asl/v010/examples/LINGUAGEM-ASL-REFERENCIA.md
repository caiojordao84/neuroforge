# ASL Referência Rápida

> Compilado de 10 `.toon`. Itens ★ são extrapolados seguindo o padrão.

---

## METADATA

```toon
# METADATA:
project_name: nome
version: 1
editor: dendriForge
author: Nome
ASLversion: 0.1.0
```

**Comentários:** `# linha` · `## seção`
**Shebang:** ★ `#! /usr/bin/env asl` (não existe em ASL atual)

---

## 1. HARDWARE INTERFACE

```toon
hardware[N|]{pin|type|io_mode|label|target_role}:
  pin|tipo|modo|"label"|role
```
- `type`: `digital` · `analog`
- `io_mode`: `input` · `output` · `bi` · `input_pullup`
- `role`: vide Roles abaixo

```toon
hardware[4|]{pin|type|io_mode|label|target_role}:
  2|digital|input|"Botao 1"|digital-in
  3|digital|input|"Botao 2"|digital-in
  4|digital|output|"LED 1"|digital-out
  5|digital|output|"LED 2"|digital-out
```

### Roles observados

| Role | Descrição |
|------|-----------|
| `status-led` | LED de status |
| `digital-in` / `digital-out` | E/S digital genérica |
| `pwm-out` | Saída PWM |
| `btn-up` / `btn-down` / `btn-start` / `btn-no` | Botões |
| `i2c-sda` / `i2c-scl` | I2C |
| `spi-mosi` / `spi-sck` / `spi-cs` | SPI |
| `uart-tx` | Serial |
| `adc:t` | ADC temperatura |
| `sensor-pos` / `sensor-a0` / `sensor-a1` | Sensores |
| `relay-coil` | Relé |
| `ir-rx` / `ir-tx` | IV |
| `led-out` | LED saída |
| `int-falling` / `int-rising` / `digital-int` | Interrupção |

### Pin Modes (hardware + setup)

| hardware | setup |
|----------|-------|
| `input` / `output` / `bi` / `input_pullup` | `INPUT` / `OUTPUT` / `INPUT_PULLUP` / `INPUT_PULLDOWN` |

---

## 2. SYSTEM DATA

```toon
data:
  CONSTANTE: valor         # MAIÚSCULAS p/ constantes
  variavel: valor          # snake_case p/ variáveis
```

**Tipos:** `int` · `float` · `bool` · `string` · `hex`
**Tipo explícito:** `var: boolean`

```toon
data:
  TIME_UNIT: ms
  RAIN_THRESHOLD: 30000
  BLINK_INTERVAL: 500
  KP: 25.5
  led_state: false
  ball_x: 53
  light_label: "---"
  COLOR_BLACK: 0x0000
  o: boolean
  set_valvula: boolean
```

★ **Extrapolações:**
```toon
  sensor_readings: [0, 0, 0, 0]       # array
  contador: int = 0                   # tipo + valor
  PI: 3.14159                         # constante float
```

---

## 3. INITIALIZATION SYSTEM

```toon
setup[N]:
  - comando()
```
Executa **uma vez** no boot. `N` = número de comandos.

### Configuração de pinos
```toon
  - pinMode(25, OUTPUT)
  - pinMode(2, INPUT_PULLDOWN)
  - digitalWrite(25, LOW)
```

### Periféricos
```toon
  - initI2C(0, 8, 9, 100000)           # id, sda, scl, freq
  - initSPI(1, 4, -1, 6, 7)           # id, mosi, miso, clk, cs
  - initLCD(0x27, 16, 2)              # endereço, col, lin
  - initOLED(0x3C, 128, 64)           # endereço, w, h
  - initTFT(5, 3, 0)                  # dc, rst, spi_id
  - initSensorI2C()
  - serialBegin(9600)
```

### Interrupções e PWM
```toon
  - attachInterrupt(2, isr_handler, FALLING)   # FALLING / RISING / CHANGE★ / LOW★
  - pwmFreq(15, 50)                             # pino, freq Hz
```

### Valores iniciais
```toon
  - set_valvula(false)
```

---

## 4. BEHAVIORAL LOGIC (LOOP)

```toon
loop[N]:
  - comando()
```
Executa **ciclicamente**. `N` = número de comandos.

```toon
loop[3]:
  - rain_intensity = readADC(26)
  - set_buzzer_state(rain_intensity)
  - delay(100)
```

### Entrada de Dados

| Função | Exemplo |
|--------|---------|
| `digitalRead(pin)` | `start_btn = digitalRead(0)` |
| `readADC(pin)` | `raw_adc = readADC(34)` |
| `readTemperature()` | `temp = readTemperature()` |
| `readHumidity()` | `humd = readHumidity()` |
| `readDistanceCM(trig, echo)` | `readDistanceCM(16, 17)` |

### Saída de Dados

| Função | Exemplo |
|--------|---------|
| `digitalWrite(pin, val)` | `digitalWrite(25, HIGH)` |
| `pwmWrite(pin, duty)` | `pwmWrite(15, 32768)` |
| `tone(pin, freq, dur)` | `tone(11, 250, 25)` |
| `serialPrint(texto)` | `serialPrint("Temp: ")` |
| `serialPrintln(texto)` | `serialPrintln("OK")` |
| `lcdClear()` / `lcdPrint(col, lin, txt)` | `lcdPrint(0, 0, "Oi")` |
| `display.clearDisplay()` / `.display()` / `.setCursor(x,y)` / `.setTextColor(fg,bg)` / `.print(txt)` / `.drawPixel(x,y,c)` / `.drawRect(x,y,w,h,c)` / `.fillRect(x,y,w,h,c)` / `.drawFastVLine(x,y,h,c)` | OLED |
| `tftFillScreen(c)` / `tftSetTextColor(fg,bg)` / `tftSetTextSize(n)` / `tftPrintText(x,y,txt)` / `tftDrawLine(x1,y1,x2,y2,c)` / `tftDrawRoundRect(x,y,w,h,r,c)` | TFT |

### Operadores

**Atribuição:** `=`
★: `+=` · `-=` · `*=` · `/=` · `%=`

**Aritméticos:** `+` · `-` · `*` · `/` · `%`
★: `**` · `//`

**Comparação:** `==` · `!=` · `>` · `<` · `>=` · `<=`

**Lógicos:** `and` · `or` · `not`
★: `xor`

**Built-in math:** `int()` · `string(val, casas)` · `log()` · `sqrt()` · `max(a,b)` · `min(a,b)` · `currentTime()`

### Condicionais

**if / else:**
```toon
if led_state:
  - digitalWrite(25, HIGH)
else:
  - digitalWrite(25, LOW)
```

**Inline:**
```toon
if digitalRead(2): toggle_led1()
if not o and n <= M: set_valvula(true)
```

**Aninhado:**
```toon
if state == 3:
  - if ir_blocked:
  - door_timer = currentTime()
```

**Cascata (simula elif):**
```toon
if ldr_pct >= 75: light_label = "Bright"
if ldr_pct >= 40 and ldr_pct < 75: light_label = "Normal"
if ldr_pct < 40: light_label = "Dark"
```

★ **Extrapolado:**
```toon
if temp_c >= TEMP_ALERT_C:
  - digitalWrite(33, HIGH)
elif temp_c >= TEMP_WARN_C:
  - digitalWrite(33, LOW)

switch state:
  case 0: - idle()
  case 1: - going_up()
  default: - fault()

led_state = (temp >= limite) ? true : false
```

### Laços

**`repeat(n):`** — único laço explícito em ASL:
```toon
repeat(5): sum_dist = sum_dist + readDistanceCM(16, 17)

repeat(pulses):
  - pwmWrite(14, 32768)
  - delay(2)
  - pwmWrite(14, 0)
```

**`delay(ms)`** — pausa: `delay(100)` · `delay(BLINK_INTERVAL)`

★ **Extrapolados:**
```toon
while condicao:
  - comando()

for i in range(0, 10):
  - total = total + readSensor(i)

for x in 0..100 step 2:
  - tftDrawPixel(x, y, WHITE)

repeat:
  - read_sensor()
until sensor_ready()

repeat(100):
  - if digitalRead(stop_pin): break
  - if buffer[i] == 0: continue
```

---

## 5. PROCEDURAL FUNCTIONS

```toon
functions:
  nome_funcao[N]:
    - comando()
```
`N` = número de linhas no corpo.

### Sem parâmetros
```toon
toggle_led[5]:
  - led_state = not led_state
  - if led_state:
  - digitalWrite(25, HIGH)
  - else:
  - digitalWrite(25, LOW)
```

### Com parâmetros
```toon
set_buzzer_state(value)[4]:
  - if value > RAIN_THRESHOLD:
  - pwmWrite(15, BUZZER_DUTY)
  - else:
  - pwmWrite(15, 0)
```

### Com retorno
```toon
read_temperature_celsius()[5]:
  - raw_adc = readADC(26)
  - resistance = (65535 / raw_adc) - 1
  - calculated_temp = 1 / (0.001129148 + (0.000234125 * log(resistance)))
  - calculated_temp = calculated_temp - 273.15
  - return(calculated_temp)
```

### Chamando funções
```toon
toggle_valvula[1]:
  - set_valvula(not o)

draw_page()[6]:
  - display.clearDisplay()
  - if current_page == 0: draw_page_temperature()
  - display.display()
```

### Interrupt Handlers
```toon
isr_emergency_halt()[7]:
  - sys_safety_halt = true
  - pwmWrite(14, 0)
  - lcdPrint(0, 0, "## E-STOP ##")

isr_page_button()[4]:
  - current_time = currentTime()
  - if (current_time - last_btn_time) > DEBOUNCE_MS:
  - current_page = (current_page + 1) % PAGE_COUNT
  - last_btn_time = current_time
```

★ **Extrapolações:**
```toon
ler_sensor(modo="single", pin=26)[4]:      # valor padrão
  - if modo == "single": return(readADC(pin))
  - else:
  - total = 0
  - repeat(10): total = total + readADC(pin)
  - return(total / 10)

fatorial(n)[3]:                              # recursão
  - if n <= 1: return(1)
  - else: return(n * fatorial(n - 1))

min_max(a, b)[2]:                            # múltiplos retornos
  - return(min(a, b), max(a, b))

compute_media(pin)[6]:                       # variável local
  - local soma = 0
  - repeat(10): soma = soma + readADC(pin)
  - local media = soma / 10
  - return(media)
```

---

## Glossário Built-in

### Setup
| Função | Exemplo |
|--------|---------|
| `pinMode(pin, modo)` | `pinMode(25, OUTPUT)` |
| `initI2C(id, sda, scl, freq)` | `initI2C(0, 8, 9, 100000)` |
| `initSPI(id, mosi, miso, clk, cs)` | `initSPI(1, 4, -1, 6, 7)` |
| `initLCD(end, col, lin)` | `initLCD(0x27, 16, 2)` |
| `initOLED(end, w, h)` | `initOLED(0x3C, 128, 64)` |
| `initTFT(dc, rst, spi_id)` | `initTFT(5, 3, 0)` |
| `initSensorI2C()` | `initSensorI2C()` |
| `serialBegin(baud)` | `serialBegin(9600)` |
| `attachInterrupt(pin, handler, modo)` | `attachInterrupt(2, isr, FALLING)` |
| `pwmFreq(pin, freq)` | `pwmFreq(15, 50)` |

### Loop
| Função | Exemplo |
|--------|---------|
| `digitalRead(pin)` | `digitalRead(0)` |
| `digitalWrite(pin, val)` | `digitalWrite(25, HIGH)` |
| `readADC(pin)` | `readADC(26)` |
| `pwmWrite(pin, duty)` | `pwmWrite(15, 32768)` |
| `tone(pin, freq, dur)` | `tone(11, 250, 25)` |
| `delay(ms)` | `delay(100)` |
| `currentTime()` | `currentTime()` |
| `lcdClear()` / `lcdPrint(c, l, t)` | `lcdPrint(0, 0, "Oi")` |
| `serialPrint(t)` / `serialPrintln(t)` | `serialPrint("Temp")` |
| `tftFillScreen(c)` / `tftSetTextColor(fg,bg)` / `tftSetTextSize(n)` / `tftPrintText(x,y,t)` / `tftDrawLine(x1,y1,x2,y2,c)` / `tftDrawRoundRect(x,y,w,h,r,c)` | TFT |
| `readTemperature()` / `readHumidity()` | sensor I2C |
| `readDistanceCM(trig, echo)` | ultrassom |
| `int(v)` / `string(v, casas)` | conversão |
| `log(x)` / `sqrt(x)` / `max(a,b)` / `min(a,b)` | math |

### ★ Extrapolados
| Função | Exemplo |
|--------|---------|
| `delayMicroseconds(us)` | `delayMicroseconds(500)` |
| `millis()` / `micros()` | `millis()` |
| `dacWrite(pin, val)` | `dacWrite(26, 2048)` |
| `map(x, imin, imax, omin, omax)` | `map(raw, 0, 1023, 0, 100)` |
| `random(min, max)` | `random(0, 100)` |
| `constrain(v, min, max)` | `constrain(pid_out, 0, 255)` |
| `abs(x)` / `pow(x, y)` | `abs(delta_x)` |
| `reset()` / `watchdogReset()` / `yield()` | sistema |

---

## Estrutura do Arquivo .toon

```
# METADATA:
project_name: nome
version: N
editor: dendriForge
author: Nome
ASLversion: 0.1.0

## 1. HARDWARE INTERFACE:
hardware[N|]{pin|type|io_mode|label|target_role}:
  pin|tipo|modo|"label"|role

## 2. SYSTEM DATA:
data:
  CONSTANTE: valor
  variavel: valor

## 3. INITIALIZATION SYSTEM:
setup[N]:
  - comando()

## 4. BEHAVIORAL LOGIC (LOOP):
loop[N]:
  - comando()

## 5. PROCEDURAL FUNCTIONS:
functions:
  nome_funcao[N]:
    - comando()
```

---

> **DEPRECATED** — This informal reference is superseded by `core/asl/v010/rules/asl-program-profile.md`.
> This file is retained as a developer reference only and will be removed in a future version.

*Gerado em 2026-06-09 de 10 arquivos `.toon` de exemplo.**
