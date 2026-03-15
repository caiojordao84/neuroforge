# TODO — Hardware Component Full Pipeline Integration

> **Auxiliar de memória** para integração completa de cada equipamento/sensor no pipeline NeuroForge.
>
> Padrão por componente (ref. `codeASLBlocklyFlow_Table.md` L139):
>
> | Camada            | Ficheiro                                                         |
> | :---------------- | :--------------------------------------------------------------- |
> | Node Visual       | `src/components/nodes/XxxNode.tsx`                               |
> | Properties Panel  | `src/components/XxxPropertiesPanel.tsx`                          |
> | ASL Type          | `src/engine/asl/ASLTypes.ts`                                     |
> | Executor          | `src/engine/asl/ASLExecutor.ts`                                  |
> | Transform         | `src/engine/asl/transforms/callTransform.ts`                     |
> | CGenerator        | `src/engine/asl/plugins/c/CGenerator.ts`                         |
> | PyGenerator       | `src/engine/asl/plugins/python/PythonGenerator.ts`               |
> | RsGenerator       | `src/engine/asl/plugins/rust/RustGenerator.ts`                   |
> | Shims (C/Py/Rs)   | `src/engine/asl/plugins/[c\|python\|rust]/shims/xxx_shim.ts`     |
> | CParser           | `src/engine/asl/plugins/c/CParser.ts`                            |
> | PyParser          | `src/engine/asl/plugins/python/PythonParser.ts`                  |
> | RsParser          | `src/engine/asl/plugins/rust/RustParser.ts`                      |

---

## 1. LED (single-color)

**Ficheiros:** `LEDNode.tsx` · `LEDPropertiesPanel.tsx`

| Camada      | Estado | Notas                                                             |
| :---------- | :----: | :---------------------------------------------------------------- |
| Node Visual |   ✅    | Implementado com física (Vf, corrente, burn-out, wiring check)    |
| Properties  |   ✅    | Painel completo com cores, resistência, preview                   |
| ASL Type    |   —    | Usa `ASLDigitalWrite` + `ASLAnalogWrite` existentes               |
| Executor    |   ⚠️    | `digitalWrite` ✅ · **`analogWrite` (PWM) não reflete brightness** |
| Transform   |   ✅    | Já existe para `digitalWrite` / `analogWrite`                     |
| CGenerator  |   ✅    | Via `digitalWrite` / `analogWrite`                                |
| PyGenerator |   ✅    | Via `pin.value()` / `pwm.duty()`                                  |
| RsGenerator |   ✅    | Via GPIO                                                          |
| Shims       |   —    | Não precisa (usa GPIO nativo)                                     |
| CParser     |   ✅    | Via GPIO calls                                                    |
| PyParser    |   ✅    | Via GPIO calls                                                    |
| RsParser    |   ✅    | Via GPIO calls                                                    |

### TODO LED
- [x] **Simulação PWM**: `LEDNode.tsx` → quando `pinChange` recebe valor numérico (0–255), calcular brightness proporcional via `recalcPhysics` com duty-cycle
- [ ] Testar: `analogWrite(pin, 128)` deve acender LED a ~50%

---

## 2. RGB LED

**Ficheiros:** `RGBLEDNode.tsx` · `RGBLEDPropertiesPanel.tsx`

| Camada      | Estado | Notas                                                          |
| :---------- | :----: | :------------------------------------------------------------- |
| Node Visual |   ✅    | Responde a `pinChange` por canal (R/G/B), suporta PWM numérico |
| Properties  |   ✅    | Painel com common anode/cathode                                |
| ASL Type    |   ❌    | **Não existe `ASLRGBSet` — depende de 3x `analogWrite`**       |
| Executor    |   ❌    | Sem handler nativo para `rgb.setColor(r,g,b)`                  |
| Transform   |   ❌    | `callTransform` sem regra `rgb.setColor`                       |
| CGenerator  |   ❌    | Sem geração `analogWrite` triplo para RGB                      |
| PyGenerator |   ❌    | Idem                                                           |
| RsGenerator |   ❌    | Idem                                                           |
| Shims       |   ❌    | Sem `rgb_shim.ts`                                              |
| CParser     |   ⚠️    | Detecta como `CallExpression` genérico                         |
| PyParser    |   ❌    | Não detecta                                                    |
| RsParser    |   ❌    | Não detecta                                                    |

### TODO RGB LED
- [ ] ASL Type: definir `ASLRGBSet { pin_r, pin_g, pin_b, r, g, b }`
- [ ] Executor: handler para `RGBSet` → 3× `analogWrite`
- [ ] Transform: `callTransform` → `rgb.setColor(r,g,b)` ↦ `ASLRGBSet`
- [ ] CGenerator: emitir 3× `analogWrite(pinR, r)` etc.
- [ ] PyGenerator: emitir 3× `pwm_r.duty(r)` etc.
- [ ] RsGenerator: emitir 3× PWM writes
- [ ] Shim C/Py/Rs: `rgb_shim.ts` com wrapper de conveniência
- [ ] CParser: detectar `analogWrite` triplo como RGB pattern
- [ ] PyParser: detectar `pwm.duty()` triplo como RGB pattern
- [ ] RsParser: detectar PWM triple-write como RGB pattern

---

## 3. Servo

**Ficheiros:** `ServoNode.tsx` · `ServoPropertiesPanel.tsx`

| Camada      | Estado | Notas                                                |
| :---------- | :----: | :--------------------------------------------------- |
| Node Visual |   ✅    | Animação do braço com ângulo, smooth interpolation   |
| Properties  |   ✅    | Min/max angle, label                                 |
| ASL Type    |   ❌    | **Não existe `ASLServoWrite`**                       |
| Executor    |   ⚠️    | Detecta `servo.write()` como CallExpression genérico |
| Transform   |   ❌    | Sem regra para `servo.write/attach/detach`           |
| CGenerator  |   ⚠️    | Fallback `CallExpression`                            |
| PyGenerator |   ❌    | Sem geração                                          |
| RsGenerator |   ❌    | Sem geração                                          |
| Shims       |   ❌    | Sem `servo_shim.ts`                                  |
| CParser     |   ✅    | Detecta como `CallExpression`                        |
| PyParser    |   ❌    | Não detecta                                          |
| RsParser    |   ❌    | Não detecta                                          |

### TODO Servo
- [ ] ASL Type: `ASLServoAttach { pin, varName }` + `ASLServoWrite { varName, angle }`
- [ ] Executor: handler → `emit('pinChange', { pin, value: angle_to_pwm })`
- [ ] Transform: `callTransform` → `servo.attach(pin)` / `servo.write(angle)` ↦ ASL nodes
- [ ] CGenerator: `#include <Servo.h>`, `Servo s; s.attach(pin); s.write(angle);`
- [ ] PyGenerator: `from machine import PWM` → duty-cycle mapping
- [ ] RsGenerator: PWM + duty-cycle mapping
- [ ] Shim C/Py/Rs: `servo_shim.ts`
- [ ] CParser: melhorar detecção de `Servo` → ASL node
- [ ] PyParser: detectar `Servo` / `PWM` pattern
- [ ] RsParser: detectar servo PWM pattern

---

## 4. Button / Push-Button

**Ficheiros:** `ButtonNode.tsx` · `ButtonPropertiesPanel.tsx`

| Camada      | Estado | Notas                                                      |
| :---------- | :----: | :--------------------------------------------------------- |
| Node Visual |   ✅    | Interactivo (press/release), pull-up/down, debounce visual |
| Properties  |   ✅    | Pull resistor config, debounce time                        |
| ASL Type    |   ✅    | Usa `ASLRead` (DIGITAL) existente ← `digitalRead(pin)`     |
| Executor    |   ✅    | `digitalRead` funciona + `externalDigitalWrite` do node    |
| Transform   |   ✅    | Via `tryTransformRead`                                     |
| CGenerator  |   ✅    | `digitalRead(pin)`                                         |
| PyGenerator |   ✅    | `pin.value()`                                              |
| RsGenerator |   ✅    | GPIO read                                                  |
| Shims       |   —    | Não precisa                                                |
| CParser     |   ✅    | Via `digitalRead` detection                                |
| PyParser    |   ✅    | Via `pin.value()` detection                                |
| RsParser    |   ✅    | Via GPIO read detection                                    |

### TODO Button
- [ ] **Verificar simulação**: confirmar que clicar no botão → `externalDigitalWrite` → `digitalRead` no código ASL retorna o valor correcto
- [ ] Testar cenário pull-up: `pinMode(pin, INPUT_PULLUP)` + button pressed → `digitalRead == LOW`
- [ ] Testar cenário sem pull: floating warning exibido correctamente

---

## 5. Potentiometer

**Ficheiros:** `PotentiometerNode.tsx` · `PotentiometerPropertiesPanel.tsx`

| Camada      | Estado | Notas                                                 |
| :---------- | :----: | :---------------------------------------------------- |
| Node Visual |   ✅    | Slider interactivo, emite `analogChange` event        |
| Properties  |   ✅    | Label, pin mapping                                    |
| ASL Type    |   ✅    | Usa `ASLRead` (ANALOG) existente ← `analogRead(pin)`  |
| Executor    |   ✅    | `analogRead` funciona, mas **precisa ligar ao event** |
| Transform   |   ✅    | Via `tryTransformRead`                                |
| CGenerator  |   ✅    | `analogRead(pin)`                                     |
| PyGenerator |   ✅    | `adc.read()`                                          |
| RsGenerator |   ✅    | ADC read                                              |
| Shims       |   —    | Não precisa                                           |
| CParser     |   ✅    | Via `analogRead` detection                            |
| PyParser    |   ✅    | Via ADC detection                                     |
| RsParser    |   ✅    | Via ADC detection                                     |

### TODO Potentiometer
- [ ] **Verificar simulação**: confirmar que `analogChange` event do slider → `analogRead(pin)` no executor retorna o valor correcto (0–1023)
- [ ] Validar que o FlowEditor wiring para pinos analógicos (A0–A5) funciona

---

## 6. Tone / noTone (Buzzer/Piezo)

**Ficheiros:** Não tem Node visual (→ criar `BuzzerNode.tsx`)

| Camada      | Estado | Notas                                   |
| :---------- | :----: | :-------------------------------------- |
| Node Visual |   ❌    | **Criar `BuzzerNode.tsx`**              |
| Properties  |   ❌    | **Criar `BuzzerPropertiesPanel.tsx`**   |
| ASL Type    |   ❌    | Criar `ASLTone { pin, freq, duration }` |
| Executor    |   ⚠️    | CallExpression fallback                 |
| Transform   |   ❌    | Sem regra                               |
| CGenerator  |   ❌    | Sem geração                             |
| PyGenerator |   ❌    | Sem geração                             |
| RsGenerator |   ❌    | Sem geração                             |
| Shims       |   ❌    | Sem shim                                |
| CParser     |   ✅    | Detecta como CallExpression             |
| PyParser    |   ✅    | Detecta como CallExpression             |
| RsParser    |   ❌    |                                         |

### TODO Buzzer / Tone
- [ ] Node Visual: `BuzzerNode.tsx` (visualização de som, animação de onda)
- [ ] Properties: `BuzzerPropertiesPanel.tsx` (frequency, pin)
- [ ] ASL Type: `ASLTone { pin, frequency, duration? }` + `ASLNoTone { pin }`
- [ ] Executor: handler → emit event `toneStart`/`toneStop`
- [ ] Transform: `callTransform` → `tone(pin, freq)` / `noTone(pin)` ↦ ASL nodes
- [ ] CGenerator: `tone(pin, freq, duration);` / `noTone(pin);`
- [ ] PyGenerator: `PWM(Pin(pin), freq=freq)` / `pwm.deinit()`
- [ ] RsGenerator: PWM com frequência
- [ ] Shim C/Py/Rs: `tone_shim.ts`
- [ ] CParser: melhorar detecção → ASL node nativo
- [ ] PyParser: melhorar detecção → ASL node nativo
- [ ] RsParser: adicionar detecção

---

## 7. DHT (Temperature + Humidity)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                              |
| :---------- | :----: | :--------------------------------- |
| Node Visual |   ❌    | **Criar `DHTNode.tsx`**            |
| Properties  |   ❌    | **Criar `DHTPropertiesPanel.tsx`** |
| ASL Type    |   ❌    | Criar `ASLDHTRead`                 |
| Executor    |   ❌    |                                    |
| Transform   |   ❌    |                                    |
| CGenerator  |   ❌    |                                    |
| PyGenerator |   ❌    |                                    |
| RsGenerator |   ❌    |                                    |
| Shims       |   ❌    | `dht_shim.ts`                      |
| CParser     |   ✅    | Detecta CallExpression             |
| PyParser    |   ❌    |                                    |
| RsParser    |   ❌    |                                    |

### TODO DHT
- [ ] Node Visual: `DHTNode.tsx` (mostrar temp/humidity, slider para simular)
- [ ] Properties: `DHTPropertiesPanel.tsx` (tipo DHT11/DHT22, pin)
- [ ] ASL Type: `ASLDHTRead { pin, varName, reading: 'temperature' | 'humidity' }`
- [ ] Executor: handler → retornar valor simulado (slider do node)
- [ ] Transform: `dht.readTemperature()` / `dht.readHumidity()` ↦ `ASLDHTRead`
- [ ] CGenerator: `#include <DHT.h>`, `dht.readTemperature()`
- [ ] PyGenerator: `import dht`, `d.measure()`, `d.temperature()`
- [ ] RsGenerator: DHT crate
- [ ] Shim C/Py/Rs: `dht_shim.ts`
- [ ] CParser: converter CallExpression → ASL node
- [ ] PyParser: adicionar detecção
- [ ] RsParser: adicionar detecção

---

## 8. Ultrasonic (HC-SR04)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                                     |
| :---------- | :----: | :---------------------------------------- |
| Node Visual |   ❌    | **Criar `UltrasonicNode.tsx`**            |
| Properties  |   ❌    | **Criar `UltrasonicPropertiesPanel.tsx`** |
| ASL Type    |   ❌    | Criar `ASLUltrasonicRead`                 |
| Executor    |   ❌    |                                           |
| Transform   |   ❌    |                                           |
| CGenerator  |   ❌    |                                           |
| PyGenerator |   ❌    |                                           |
| RsGenerator |   ❌    |                                           |
| Shims       |   ❌    | `ultrasonic_shim.ts`                      |
| CParser     |   ✅    | Detecta CallExpression                    |
| PyParser    |   ❌    |                                           |
| RsParser    |   ❌    |                                           |

### TODO Ultrasonic
- [ ] Node Visual: `UltrasonicNode.tsx` (slider distância 2–400 cm)
- [ ] Properties: `UltrasonicPropertiesPanel.tsx` (trigPin, echoPin)
- [ ] ASL Type: `ASLUltrasonicRead { trigPin, echoPin }`
- [ ] Executor: handler → retornar valor do slider
- [ ] Transform: `ultrasonic.read()` ↦ `ASLUltrasonicRead`
- [ ] CGenerator: `pulseIn(echoPin, HIGH)` + cálculo distância
- [ ] PyGenerator: `time_pulse_us(echo, 1)` + cálculo
- [ ] RsGenerator: pulse timing
- [ ] Shim C/Py/Rs: `ultrasonic_shim.ts`
- [ ] Parsers: C/Py/Rs → detectar pattern

---

## 9. LDR (Light Dependent Resistor)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                                  |
| :---------- | :----: | :------------------------------------- |
| Node Visual |   ❌    | **Criar `LDRNode.tsx`**                |
| Properties  |   ❌    | **Criar `LDRPropertiesPanel.tsx`**     |
| ASL Type    |   ❌    | Pode usar `ASLRead (ANALOG)` existente |
| Executor    |   ✅    | Via `analogRead` (se wired ao slider)  |
| Transform   |   ✅    | Via `tryTransformRead`                 |
| CGenerator  |   ✅    | Via `analogRead(pin)`                  |
| PyGenerator |   ✅    | Via `adc.read()`                       |
| RsGenerator |   ✅    | Via ADC                                |
| Shims       |   —    | Não precisa (é analogRead puro)        |
| CParser     |   ✅    | Via analogRead                         |
| PyParser    |   ✅    | Via ADC                                |
| RsParser    |   ✅    | Via ADC                                |

### TODO LDR
- [ ] Node Visual: `LDRNode.tsx` (slider luminosidade 0–1023, ícone sol/lua)
- [ ] Properties: `LDRPropertiesPanel.tsx` (pin analógico)
- [ ] **ASL/Generators/Parsers já cobertos** via `analogRead` — só precisa de Node+Panel

---

## 10. IR Receiver

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                          |
| :---------- | :----: | :----------------------------- |
| Node Visual |   ❌    | **Criar `IRReceiverNode.tsx`** |
| Properties  |   ❌    |                                |
| ASL Type    |   ❌    |                                |
| Executor    |   ❌    |                                |
| Transform   |   ❌    |                                |
| Generators  |   ❌    |                                |
| Shims       |   ❌    | `ir_shim.ts`                   |
| CParser     |   ✅    | Detecta CallExpression         |
| PyParser    |   ❌    |                                |
| RsParser    |   ❌    |                                |

### TODO IR Receiver
- [ ] Node Visual: `IRReceiverNode.tsx` (botões de remote control para simular)
- [ ] Properties: `IRReceiverPropertiesPanel.tsx` (pin, protocolo NEC/RC5)
- [ ] ASL Type: `ASLIRRead { pin }`
- [ ] Executor: handler → retornar código do botão pressionado no node
- [ ] Transform + Generators + Shims
- [ ] Parsers: C/Py/Rs

---

## 11. Keypad (4×4 / 4×3)

**Ficheiros:** Não tem Node visual (shim já existe)

| Camada      | Estado | Notas                      |
| :---------- | :----: | :------------------------- |
| Node Visual |   ❌    | **Criar `KeypadNode.tsx`** |
| Properties  |   ❌    |                            |
| ASL Type    |   ❌    |                            |
| Executor    |   ❌    |                            |
| Transform   |   ❌    |                            |
| Generators  |   ❌    |                            |
| Shims       |   ✅    | `keypad_shim.ts` (C/Py/Rs) |
| CParser     |   ✅    | Detecta `KeypadRead`       |
| PyParser    |   ❌    |                            |
| RsParser    |   ❌    |                            |

### TODO Keypad
- [ ] Node Visual: `KeypadNode.tsx` (grid de botões clicáveis 4×4)
- [ ] Properties: `KeypadPropertiesPanel.tsx` (layout 4×4 ou 4×3, pins)
- [ ] ASL Type: `ASLKeypadRead { varName }`
- [ ] Executor: handler → retornar tecla pressionada no node
- [ ] Transform + Generators (já tem shim!)
- [ ] PyParser/RsParser: adicionar detecção

---

## 12. Joystick

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                        |
| :---------- | :----: | :--------------------------- |
| Node Visual |   ❌    | **Criar `JoystickNode.tsx`** |
| Properties  |   ❌    |                              |
| ASL Type    |   ✅    | Usa `ASLRead` (ANALOG) ×2    |
| Executor    |   ✅    | Via `analogRead`             |
| Transform   |   ✅    |                              |
| Generators  |   ✅    | Via `analogRead`             |
| Parsers     |   ✅    | Via `analogRead`             |
| Shims       |   ❌    |                              |

### TODO Joystick
- [ ] Node Visual: `JoystickNode.tsx` (thumb-stick interactivo X/Y + button)
- [ ] Properties: `JoystickPropertiesPanel.tsx` (pinX, pinY, pinBtn)
- [ ] **ASL/Generators/Parsers já cobertos** via `analogRead` — só precisa de Node+Panel

---

## 13. MPU6050 (Accelerometer/Gyro)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                   |
| :---------- | :----: | :---------------------- |
| Node Visual |   ❌    | **Criar `MPUNode.tsx`** |
| Properties  |   ❌    |                         |
| ASL Type    |   ❌    |                         |
| Executor    |   ❌    |                         |
| Transform   |   ❌    |                         |
| Generators  |   ❌    |                         |
| Shims       |   ❌    | `mpu_shim.ts`           |
| CParser     |   ✅    | Detecta CallExpression  |
| PyParser    |   ❌    |                         |
| RsParser    |   ❌    |                         |

### TODO MPU6050
- [ ] Node Visual: `MPUNode.tsx` (sliders para accel X/Y/Z, gyro X/Y/Z)
- [ ] Properties: `MPUPropertiesPanel.tsx` (I2C address)
- [ ] ASL Type: `ASLMPURead { axis: 'accelX'|'accelY'|... }`
- [ ] Executor + Transform + Generators + Shims + Parsers

---

## 14. LCD I2C (16×2 / 20×4)

**Ficheiros:** Não tem Node visual (shim já existe)

| Camada      | Estado | Notas                                  |
| :---------- | :----: | :------------------------------------- |
| Node Visual |   ❌    | **Criar `LCDNode.tsx`**                |
| Properties  |   ❌    |                                        |
| ASL Type    |   ❌    |                                        |
| Executor    |   ❌    |                                        |
| Transform   |   ❌    |                                        |
| Generators  |   ❌    |                                        |
| Shims       |   ✅    | `liquid_crystal_i2c_shim.ts` (C/Py/Rs) |
| CParser     |   ✅    | Detecta `LcdPrint/LcdClear/LcdCursor`  |
| PyParser    |   ✅    | Detecta via CallExpression             |
| RsParser    |   ❌    |                                        |

### TODO LCD I2C
- [ ] Node Visual: `LCDNode.tsx` (ecrã 16×2 simulado com texto)
- [ ] Properties: `LCDPropertiesPanel.tsx` (I2C addr, rows, cols)
- [ ] ASL Type: `ASLLCDPrint { text, row, col }` + `ASLLCDClear` + `ASLLCDSetCursor { row, col }`
- [ ] Executor: handler → manter buffer de texto 16×2, emit `lcdUpdate`
- [ ] Transform: `lcd.print(text)` / `lcd.clear()` / `lcd.setCursor(col, row)` ↦ ASL
- [ ] Generators: usar shim existente
- [ ] RsParser: adicionar detecção

---

## 15. OLED (SSD1306)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                                 |
| :---------- | :----: | :------------------------------------ |
| Node Visual |   ❌    | **Criar `OLEDNode.tsx`**              |
| Properties  |   ❌    |                                       |
| ASL Type    |   ❌    |                                       |
| Executor    |   ❌    |                                       |
| Transform   |   ❌    |                                       |
| Generators  |   ❌    |                                       |
| Shims       |   ❌    | `oled_shim.ts`                        |
| CParser     |   ✅    | Detecta `OledText/OledShow/OledClear` |
| PyParser    |   ✅    | Via CallExpression                    |
| RsParser    |   ❌    |                                       |

### TODO OLED
- [ ] Node Visual: `OLEDNode.tsx` (canvas 128×64 simulado)
- [ ] Properties: `OLEDPropertiesPanel.tsx` (I2C addr, width, height)
- [ ] ASL Types: `ASLOledText`, `ASLOledShow`, `ASLOledClear`
- [ ] Executor: handler → canvas buffer, emit `oledUpdate`
- [ ] Transform + Generators + Shims + Parsers

---

## 16. Seven Segment Display

**Ficheiros:** Não tem Node visual (shim Python já existe)

| Camada      | Estado | Notas                        |
| :---------- | :----: | :--------------------------- |
| Node Visual |   ❌    | **Criar `SevenSegNode.tsx`** |
| Properties  |   ❌    |                              |
| ASL Type    |   ❌    |                              |
| Executor    |   ❌    |                              |
| Transform   |   ❌    |                              |
| CGenerator  |   ⚠️    | `scanForShims` parcial       |
| PyGenerator |   ✅    | Via `sevseg_shim`            |
| RsGenerator |   ❌    |                              |
| Shims       |   ⚠️    | Só Python (`sevseg_shim.ts`) |
| CParser     |   ✅    | `SevSegPrint`                |
| PyParser    |   ✅    | Via CallExpression           |
| RsParser    |   ❌    |                              |

### TODO Seven Segment
- [ ] Node Visual: `SevenSegNode.tsx` (segmentos A-G, ponto decimal)
- [ ] Properties: `SevenSegPropertiesPanel.tsx` (num dígitos, pins)
- [ ] ASL Type: `ASLSevSegPrint { value }`
- [ ] Executor: handler → activar segmentos, emit `sevSegUpdate`
- [ ] Transform + Generators
- [ ] Shim: adicionar C + Rust (Python já existe)
- [ ] RsParser: adicionar detecção

---

## 17. NeoPixel (WS2812B)

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                        |
| :---------- | :----: | :--------------------------- |
| Node Visual |   ❌    | **Criar `NeoPixelNode.tsx`** |
| Properties  |   ❌    |                              |
| ASL Type    |   ❌    |                              |
| Executor    |   ❌    |                              |
| Transform   |   ❌    |                              |
| Generators  |   ❌    |                              |
| Shims       |   ❌    | `neopixel_shim.ts`           |
| CParser     |   ✅    | Detecta CallExpression       |
| PyParser    |   ❌    |                              |
| RsParser    |   ❌    |                              |

### TODO NeoPixel
- [ ] Node Visual: `NeoPixelNode.tsx` (strip de LEDs coloridos, configurável N pixels)
- [ ] Properties: `NeoPixelPropertiesPanel.tsx` (pin, numPixels)
- [ ] ASL Types: `ASLNeoPixelSet { index, r, g, b }` + `ASLNeoPixelShow` + `ASLNeoPixelClear`
- [ ] Executor: handler → array de cores, emit `neopixelUpdate`
- [ ] Transform + Generators + Shims + Parsers

---

## 18. DC Motor / Motor Driver

**Ficheiros:** Não tem Node visual

| Camada      | Estado | Notas                     |
| :---------- | :----: | :------------------------ |
| Node Visual |   ❌    | **Criar `MotorNode.tsx`** |
| Properties  |   ❌    |                           |
| ASL Type    |   ❌    |                           |
| Executor    |   ❌    |                           |
| Transform   |   ❌    |                           |
| Generators  |   ❌    |                           |
| Shims       |   ❌    | `motor_shim.ts`           |
| CParser     |   ✅    | Detecta CallExpression    |
| PyParser    |   ❌    |                           |
| RsParser    |   ❌    |                           |

### TODO Motor
- [ ] Node Visual: `MotorNode.tsx` (roda com animação de rotação, velocidade)
- [ ] Properties: `MotorPropertiesPanel.tsx` (pins IN1/IN2/EN, tipo L293D/L298N)
- [ ] ASL Type: `ASLMotorMove { direction, speed }`
- [ ] Executor + Transform + Generators + Shims + Parsers

---

## 19. WiFi

**Ficheiros:** Não tem Node visual (conceito de serviço, não hardware)

| Camada     | Estado | Notas                  |
| :--------- | :----: | :--------------------- |
| ASL Type   |   ❌    |                        |
| Executor   |   ❌    |                        |
| Transform  |   ❌    |                        |
| Generators |   ❌    |                        |
| Shims      |   ❌    | `wifi_shim.ts`         |
| CParser    |   ✅    | Detecta CallExpression |
| PyParser   |   ❌    |                        |
| RsParser   |   ❌    |                        |

### TODO WiFi
- [ ] ASL Types: `ASLWiFiBegin { ssid, password }` + `ASLWiFiStatus`
- [ ] Executor: handler simulado → emitir connected/disconnected
- [ ] Transform + Generators + Shims
- [ ] Parsers: C/Py/Rs

---

## 20. HTTP Client

**Ficheiros:** Não tem Node visual (conceito de serviço)

| Camada     | Estado | Notas                  |
| :--------- | :----: | :--------------------- |
| ASL Type   |   ❌    |                        |
| Executor   |   ❌    |                        |
| Transform  |   ❌    |                        |
| Generators |   ❌    |                        |
| Shims      |   ❌    | `http_shim.ts`         |
| CParser    |   ✅    | Detecta CallExpression |
| PyParser   |   ❌    |                        |
| RsParser   |   ❌    |                        |

### TODO HTTP
- [ ] ASL Types: `ASLHTTPGet { url }` + `ASLHTTPPost { url, body }`
- [ ] Executor: handler simulado → mock response
- [ ] Transform + Generators + Shims
- [ ] Parsers: C/Py/Rs

---

## 21. SPIFFS / File System

**Ficheiros:** Não tem Node visual (conceito de serviço)

| Camada     | Estado | Notas                  |
| :--------- | :----: | :--------------------- |
| ASL Type   |   ❌    |                        |
| Executor   |   ❌    |                        |
| Transform  |   ❌    |                        |
| Generators |   ❌    |                        |
| Shims      |   ❌    | `spiffs_shim.ts`       |
| CParser    |   ✅    | Detecta CallExpression |
| PyParser   |   ❌    |                        |
| RsParser   |   ❌    |                        |

### TODO SPIFFS
- [ ] ASL Types: `ASLSPIFFSOpen { path, mode }` + `ASLFileWrite { content }`
- [ ] Executor: handler simulado → in-memory filesystem
- [ ] Transform + Generators + Shims
- [ ] Parsers: C/Py/Rs

---

## MCU (already exists)

**Ficheiros:** `MCUNode.tsx` · `MCUPropertiesPanel.tsx`

| Camada      | Estado | Notas                                  |
| :---------- | :----: | :------------------------------------- |
| Node Visual |   ✅    | Pin layout completo com board profiles |
| Properties  |   ✅    | Board selection (Uno/Mega/ESP32/Pico)  |

> ✅ **Completo** — não precisa de trabalho adicional no pipeline.

---

## Resumo de Prioridades

| Prioridade | Componente    | Razão                                            |
| :--------: | :------------ | :----------------------------------------------- |
|  🔴 **P0**  | LED PWM       | Já tem tudo, falta só a simulação PWM            |
|  🔴 **P0**  | Button verif. | Já tem tudo, precisa validar simulação           |
|  🔴 **P0**  | Pot verif.    | Já tem tudo, precisa validar analogRead + slider |
|  🟠 **P1**  | Servo         | Node existe, falta pipeline ASL                  |
|  🟠 **P1**  | RGB LED       | Node existe, falta pipeline ASL                  |
|  🟡 **P2**  | Buzzer/Tone   | Muito usado em projetos Arduino                  |
|  🟡 **P2**  | LCD I2C       | Shim já existe, popular                          |
|  🟡 **P2**  | DHT           | Muito popular                                    |
|  🟢 **P3**  | Ultrasonic    | Popular em robótica                              |
|  🟢 **P3**  | LDR           | Simples (só Node, ASL via analogRead)            |
|  🟢 **P3**  | Joystick      | Simples (só Node, ASL via analogRead)            |
|  🟢 **P3**  | Seven Segment | Shim parcial existe                              |
|  🔵 **P4**  | NeoPixel      | Complexo mas popular                             |
|  🔵 **P4**  | Keypad        | Shim existe                                      |
|  🔵 **P4**  | Motor         |                                                  |
|  🔵 **P4**  | OLED          |                                                  |
|  ⚪ **P5**  | IR Receiver   |                                                  |
|  ⚪ **P5**  | MPU6050       |                                                  |
|  ⚪ **P5**  | WiFi          | Serviço, não hardware visual                     |
|  ⚪ **P5**  | HTTP          | Serviço                                          |
|  ⚪ **P5**  | SPIFFS        | Serviço                                          |
