Tenho informação suficiente. Agora posso fazer a análise **definitiva e completa**.

***

## 📋 Mapa de Cobertura Total — Equivalências Reais por Gap

A filosofia é: **cada construção de qualquer linguagem tem um equivalente ASL canónico**. Se não existe na linguagem alvo, **inventamos a implementação** — exactamente como o ASL em si foi criado do zero.

***

### 🔴 GAP 1 — LCD (HD44780 / I2C)

**Equivalências reais encontradas:**

| Linguagem | API real | Nó ASL alvo |
|---|---|---|
| **Arduino/C** | `lcd.begin(16,2)` / `lcd.print("texto")` / `lcd.setCursor(0,1)` / `lcd.clear()` | `CallExpression { callee: 'lcd.begin' }` etc. |
| **MicroPython** | `from lcd_api import LcdApi` + `lcd.putstr("texto")` / `lcd.clear()` / `lcd.move_to(col, row)` | idem |
| **Rust (ESP32)** | `hd44780_driver::HD44780::new(...)` + `lcd.write_str(...)` / `lcd.clear(...)` / `lcd.set_cursor_xy(...)`  | já detectado parcialmente |
| **Rust (RP2040)** | Não existe biblioteca padrão — **criar stub** `lcd_write_str(str)` com comentário HAL | `CallExpression { callee: 'lcd.write_str' }` via hardwareCall |

**Conclusão:** O `RustParser` já detecta `method_call` como `CallExpression` genérico. Falta apenas o **`RustGenerator`** emitir o código correcto com `&mut delay` e `.unwrap()`. O padrão `let Ok(mut lcd) = ... else { panic!() }` precisa de handler `visitLetElse` no parser. [github](https://github.com/idubrov/lcd)

***

### 🔴 GAP 2 — `tone()` / PIO Assembly (MicroPython RP2040)

**Esta é a situação mais complexa.** O código PIO é:

```python
@rp2.asm_pio(set_init=rp2.PIO.OUT_LOW)
def wave_prog(): pull(block); mov(x, osr); ...
sm = rp2.StateMachine(0, wave_prog, freq=1953125, set_base=Pin(5))
```

**Equivalências reais:**

| Linguagem | API real | Mecanismo |
|---|---|---|
| **Arduino/C (RP2040)** | `tone(pin, freq, duration)` nativo | Timer hardware PWM  [github](https://github.com/earlephilhower/arduino-pico/discussions/184) |
| **Arduino/C (ESP32)** | `ledcWriteTone(channel, freq)` + `ledcAttachPin(pin, channel)` | LEDC PWM |
| **MicroPython (simples)** | `machine.PWM(Pin(5)).freq(262).duty_u16(32768)` | PWM hardware directo |
| **MicroPython (PIO)** | `@rp2.asm_pio` + `StateMachine` | PIO — não transpilável 1:1 |
| **Rust (RP2040)** | `rp2040_hal::pwm::Slices` + `pwm.channel_b.set_duty(freq)` | PWM HAL  [docs](https://docs.rs/rp2040-hal/latest/rp2040_hal/pwm/index.html) |
| **Rust (Embassy RP2040)** | `embassy_rp::pwm::Pwm::new_output_b(...)` | Embassy PWM async |

**Decisão para o ASL:**
- O `@rp2.asm_pio` + `def wave_prog()` deve ser detectado como **bloco PIO** e convertido para o nó `CallExpression { callee: 'tone', args: [pin, freq, duration] }` — perdendo os detalhes de baixo nível mas preservando a **intenção semântica** (gerar tom).
- A função `HWPlayTone(freq, duration)` é detectável e mapeável directamente para `tone(pin, freq, duration)`.
- O `rp2.StateMachine(...)` → `hardwareCall` com metadados PIO. [instructables](https://www.instructables.com/Respberry-Pi-Pico-W-Generating-Tones-With-Programm/)

***

### 🔴 GAP 3 — `EEPROM`

**Equivalências reais:**

| Linguagem | API real | Nó ASL |
|---|---|---|
| **Arduino/C** | `EEPROM.read(addr)` / `EEPROM.write(addr, val)` / `EEPROM.update(addr, val)` | `CallExpression { callee: 'EEPROM.read' }` |
| **MicroPython** | `import uos; uos.stat(...)` / ficheiro JSON / `machine.Flash()` | mapear para `EEPROM.read/write` via stub |
| **Rust (ESP32)** | `esp-storage` crate → `EspFlashStorage` + `embedded-storage::Storage::write(...)`  [lib](https://lib.rs/crates/esp-storage) | `CallExpression { callee: 'EEPROM.write' }` |
| **Rust (RP2040)** | Não existe EEPROM — **inventar**: `flash_write(addr, val)` via `rp2040-flash` crate, ou sequential sector write | Stub gerado: `/* EEPROM.write */ flash.write_sector(addr, &[val]);` |

**Rust RP2040 sem EEPROM — solução criada de raiz:** O RP2040 não tem EEPROM física. O gerador Rust vai emitir um bloco que usa a última sector de flash como storage simulado, com comentário explicativo. [reddit](https://www.reddit.com/r/rust/comments/18qsfo9/embedded_file_system_for_onboard_flash/)

***

### 🔴 GAP 4 — `Wire / I2C`

**Equivalências reais:**

| Linguagem | API real | Nó ASL |
|---|---|---|
| **Arduino/C** | `Wire.begin()` / `Wire.beginTransmission(addr)` / `Wire.write(val)` / `Wire.endTransmission()` / `Wire.requestFrom(addr, n)` / `Wire.read()` | `CallExpression { callee: 'Wire.X' }` |
| **MicroPython** | `machine.I2C(0, scl=Pin(1), sda=Pin(0))` + `i2c.writeto(addr, bytes)` / `i2c.readfrom(addr, n)` | mapear para `Wire.X` |
| **Rust (ESP32)** | `esp_hal::i2c::master::I2c::new(...)` + `.write(addr, &[val])` / `.read(addr, buf)`  | gerado como `I2c::new(...).write(addr, &[val]).ok()` |
| **Rust (RP2040)** | `rp2040_hal::I2C::new(i2c0, sda, scl, freq, &mut resets, clocks)` | gerado com struct HAL completo |

***

### 🔴 GAP 5 — `SPI`

**Equivalências reais:**

| Linguagem | API real | Nó ASL |
|---|---|---|
| **Arduino/C** | `SPI.begin()` / `SPI.transfer(val)` / `SPI.end()` / `SPI.beginTransaction(SPISettings(...))` | `CallExpression { callee: 'SPI.X' }` |
| **MicroPython** | `machine.SPI(0, baudrate=1000000, polarity=0, phase=0)` + `spi.write(b'\xAB')` / `spi.read(n)` | mapear para `SPI.X` |
| **Rust (ESP32)** | `esp_hal::spi::master::Spi::new(...)` + `.transfer(&mut buf)` | gerado com `spi.transfer(&mut [val]).ok()` |
| **Rust (RP2040)** | `rp2040_hal::spi::Spi::new_enabled(...)` + `.write(&[val])` | gerado completo |

***

### 🔴 GAP 6 — `SevSeg` (Display 7 segmentos)

**Rust sem biblioteca standard — inventar de raiz:** [github](https://github.com/therealprof/sevensegment)

| Linguagem | API real | Nó ASL |
|---|---|---|
| **Arduino/C** | `SevSeg.begin(COMMON_CATHODE, numDigits, digitPins, segmentPins)` / `SevSeg.setNumber(num, dots)` / `SevSeg.refreshDisplay()` | `CallExpression { callee: 'sevseg.X' }` |
| **MicroPython** | Não existe biblioteca padrão — implementar com GPIOs directos | Stub via `hardwareCall` com GPIOs |
| **Rust** | `sevensegment` crate (embedded-hal)  [github](https://github.com/therealprof/sevensegment) + `display.set_digit(n)` | Gerado: `sevseg.set_number(val);` com stub HAL |

**Para Python e Rust sem lib — criar implementação de raiz** que usa `digitalWrite` nos segmentos individuais com uma lookup table `[0x3F, 0x06, 0x5B, ...]` (encoding 7-seg).

***

### 🔴 GAP 7 — `Keypad`

| Linguagem | API real | Nó ASL |
|---|---|---|
| **Arduino/C** | `Keypad keypad(makeKeymap(keys), rowPins, colPins, rows, cols)` / `keypad.getKey()` | `CallExpression { callee: 'KeypadRead' }` |
| **MicroPython** | Não existe — scan manual de matrix de pinos | Stub gerado com scan GPIO |
| **Rust** | Não existe lib standard — **criar de raiz**: scan de matriz com `gpio_in`/`gpio_out` + debounce | Gerado como função `keypad_scan()` completa |

***

### 🔴 GAP 8 — `attachInterrupt` / `pulseIn` / `shiftOut` em Rust

| Gap | Equivalente Rust real | Nó ASL | Código gerado |
|---|---|---|---|
| `attachInterrupt(pin, ISR, RISING)` | `cortex_m::interrupt::free(\|cs\| { ... })` + NVIC | `CallExpression { callee: 'attachInterrupt' }` | Stub com `// ISR via NVIC` |
| `pulseIn(pin, HIGH)` | Ler `timer.get_counter()` antes/depois de borda GPIO | `CallExpression { callee: 'pulseIn' }` | `/* pulseIn */ let _pulse = timer.get_counter();` |
| `shiftOut(pin, clock, MSBFIRST, val)` | `spi.write(&[val]).ok()` ou bit-bang loop | `CallExpression { callee: 'shiftOut' }` | `spi.write(&[val]).ok();` |

***

### 🔴 GAP 9 — `CastExpression` Python

**Confirmado:** `int(x)`, `float(x)`, `str(x)` já são detectados como `CallExpression`. Será adicionado **comentário no código** a indicar que pode vir a ter nó `CastExpression` próprio se surgir sintaxe Python não coberta (ex: `x.__int__()`). ✅

***

### 🔴 GAP 10 — Decoradores Python (`@rp2.asm_pio`)

**Não transpilável directamente.** Estratégia:
- Detectar `@rp2.asm_pio` → marcar a função seguinte como `PIO_BLOCK`
- O corpo da função PIO é **ignorado semanticamente** mas emitido como comentário
- A intenção é capturada via `HWPlayTone` / chamadas à `StateMachine` → mapeadas para `tone(pin, freq, dur)`

***

## ✅ Plano de Commits por Grupo

| Commit | Ficheiros | Conteúdo |
|---|---|---|
| **A** | `RustParser.ts` | `let_else`, LCD methods, I2C chain, keyword args |
| **B** | `PythonParser.ts` (Tree + Regex) | `@decorator` PIO, `StateMachine`, `AnalogWrite` Regex, `tone()` directo |
| **C** | `RustGenerator.ts` | LCD, I2C, SPI, EEPROM, SevSeg stub, tone, attachInterrupt, shiftOut |
| **D** | `PythonGenerator.ts` + `CGenerator.ts` | SevSeg lookup table, Keypad scan, EEPROM stub |
| **E** | `ASLExecutor.ts` | EEPROM, Wire, SPI handlers completos |

***

Confirmas este plano? Se sim, avanço imediatamente para o **Commit A — `RustParser.ts`**, mostrando todo o código actual das secções a modificar antes de qualquer alteração.