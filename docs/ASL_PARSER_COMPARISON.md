# Tabela Comparativa: ASL Parser Implementation

> Documento actualizado em 28 Fevereiro 2026
> Comparação entre a documentação (`notyet/README.md`) e a implementação real dos parsers ASL
>
> 📋 **Para o plano de implementação padrão, consulte**: [IMPLEMENTATION_STANDARD.md](./IMPLEMENTATION_STANDARD.md)

---

## 🏁 Lista Crítica (branch `critical_Implementation`) — **100% CONCLUÍDA**

> Todos os itens abaixo foram verificados e/ou implementados na sessão de 28/02/2026.

| # | Tarefa | Ficheiro | Commit / Estado |
|---|---|---|---|
| 1.1 | `switch/case` no Executor (fall-through + default) | `ASLExecutor.ts` | ✅ Já existia |
| 1.2 | `sizeof` no Executor | `ASLExecutor.ts` | ✅ Implementado |
| 1.3 | `cast` (int/float/String) no Executor | `ASLExecutor.ts` | ✅ Já existia |
| 1.4 | `conditional` ternário no Executor | `ASLExecutor.ts` | ✅ Já existia |
| 1.5 | `delayMicroseconds` no Executor | `ASLExecutor.ts` | ✅ Implementado |
| 1.6 | Math Builtins (abs/sqrt/pow/sin/cos/tan/min/max/round/floor/ceil) | `ASLExecutor.ts` | ✅ Implementados |
| 1.7 | `float_literal` no RustParser | `RustParser.ts` | ✅ Implementado |
| 1.8 | `DelayMs` Embassy (`Timer::after_millis/secs`) | `RustParser.ts` | ✅ [b197562](https://github.com/caiojordao84/neuroforge/commit/b197562f2a1ce2f9b0214d688742852a07452422) |
| 1.9 | `Print` Embassy/defmt (`info!/warn!/uprintln!/rprintln!`) | `RustParser.ts` | ✅ [b197562](https://github.com/caiojordao84/neuroforge/commit/b197562f2a1ce2f9b0214d688742852a07452422) |
| 1.10 | `AnalogRead` MicroPython ADC | `PythonParser.ts` | ✅ Implementado |
| 1.11 | `SubscriptExpression` no RustParser | `RustParser.ts` | ✅ Implementado |
| 1.12 | `GpioRead` no RustParser | `RustParser.ts` | ✅ Implementado |
| 1.13 | `ForLoop` RustParser (`0..N` e `0..=N` inclusive) | `RustParser.ts` | ✅ [b197562](https://github.com/caiojordao84/neuroforge/commit/b197562f2a1ce2f9b0214d688742852a07452422) |
| 1.14 | `StructDeclaration` no RustParser | `RustParser.ts` | ✅ Implementado |
| 1.15 | `SwitchStatement` handler no `statementRegistry` | `statementRegistry.ts` | ✅ Já existia |
| 1.16 | `StructDeclaration` handler no `statementRegistry` (no-op explícito) | `statementRegistry.ts` | ✅ [87c43b8](https://github.com/caiojordao84/neuroforge/commit/87c43b8115e7eea0cb552e8aa85706719131beb7) |
| 1.17 | `CastExpression` + `ConditionalExpression` no `exprTransform` | `exprTransform.ts` | ✅ Já existia |
| 1.18 | `UnaryExpression` no RustParser (`!`, `-`, `*`, `&`, `&mut`) | `RustParser.ts` | ✅ [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02) |
| 1.19 | `MemberExpression` no RustParser (`struct.field`, `method_call`) | `RustParser.ts` | ✅ [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02) |
| 1.20 | `reference_expression` (`&x`, `&mut x`) no RustParser | `RustParser.ts` | ✅ [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02) |
| 1.21 | `DoWhileLoop` no RustGenerator (emulado: `loop { body; if !(cond) { break; } }`) | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.22 | `BreakStatement` / `ContinueStatement` / `ReturnStatement` no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.23 | `IfStatement` else / else-if no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.24 | `Loop` infinito no RustGenerator (`loop { ... }`) | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.25 | `Block`, `GpioRead` (stmt) no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.26 | `UnaryExpression`, `MemberExpression`, `ConditionalExpression`, `GpioRead` no RustGenerator `genExpr` | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.27 | `DoWhile` no CParser (`do_statement`) | `CParser.ts` | ✅ [060942cf](https://github.com/caiojordao84/neuroforge/commit/060942cf4be154ed76f358d373a66b819b59c865) |
| 1.28 | `ASLExecutor.ts` — `doWhile`, `switch`, `for`, todos os nós | `ASLExecutor.ts` | ✅ Já existia completo |

---

## Legenda

- ✅ Implementado
- ⚠️ Parcialmente implementado (com limitações)
- ❌ Não implementado / Gap
- 🔄 Diferença entre Tree-sitter e Regex (Python)

---

## 1. Estruturas de Controle

| Estrutura             | README.md | C/C++ (CParser) | Python Tree-sitter   | Python Regex               | RustParser           |
| --------------------- | --------- | --------------- | -------------------- | -------------------------- | -------------------- |
| **IfStatement**       | ✅         | ✅               | ✅ `if_statement`     | ✅                           | ✅ `if_expression`    |
| **WhileLoop**         | ✅         | ✅               | ✅ `while_statement`  | ⚠️ apenas `while True:` | ✅ `while_expression` |
| **ForLoop**           | ✅         | ✅               | ✅ `for_statement`    | ✅ `for ... in`             | ✅ `for_expression` (`0..N`, `0..=N`) |
| **Loop (infinito)**   | ✅         | ✅ `while(1)`    | ✅ `while_statement`  | ✅ `while True:`             | ✅ `loop_expression`  |
| **SwitchStatement**   | ✅         | ✅               | ✅ `match_statement`  | ✅ `match/case`             | ✅ `match_expression` |
| **CaseClause**        | ✅         | ✅               | ✅ `case_clause`      | ✅                          | ✅ `match_arm`        |
| **BreakStatement**    | ✅         | ✅               | ✅                    | ⚠️ auto-add                 | ✅ `break_expression`    |
| **ContinueStatement** | ✅         | ✅               | ✅                    | ✅                          | ✅ `continue_expression` |
| **ReturnStatement**   | ✅         | ✅               | ✅ `return_statement` | ✅                          | ✅ `return_expression`   |
| **DoWhile**           | ✅ 🟢      | ✅ `do_statement` | ❌ (inexistente em Python) | ❌ (inexistente em Python) | ✅ `RustGenerator` emula via `loop { if !(cond) { break; } }` |

---

## 2. Declarações

| Declaração              | README.md | C/C++ (CParser) | Python Tree-sitter      | Python Regex   | RustParser          |
| ----------------------- | --------- | --------------- | ----------------------- | -------------- | ------------------- |
| **VariableDeclaration** | ✅         | ✅               | ✅ `let_declaration`     | ✅ `var = expr` | ✅ `let_declaration` |
| **Function**            | ✅         | ✅               | ✅ `function_definition` | ✅ `def`        | ✅ `function_item`   |
| **StructDeclaration**   | ✅         | ✅               | ❌                       | ❌              | ✅ `struct_item`     |
| **EnumDeclaration**     | ✅         | ✅               | ❌                       | ❌              | ❌                   |
| **ArrayInitializer 1D** | ✅         | ✅               | ✅ `list`                | ❌              | ❌                   |
| **ArrayInitializer 2D** | ✅         | ✅               | ❌                       | ❌              | ❌                   |
| **ArrayInitializer 3D** | ✅         | ✅               | ❌                       | ❌              | ❌                   |
| **ObjectInitializer**   | ✅         | ❌               | ✅ `dictionary`          | ✅ `{k:v}`      | ❌                   |
| **ListComprehension**   | ✅         | ❌               | ✅                       | ❌              | ❌                   |

---

## 3. Expressões

| Expressão                         | README.md | C/C++ (CParser) | Python Tree-sitter  | Python Regex | RustParser          |
| --------------------------------- | --------- | --------------- | ------------------- | ------------ | ------------------- |
| **Literal (int)**                 | ✅         | ✅               | ✅ `integer`         | ✅            | ✅ `integer_literal` |
| **Literal (float)**               | ✅         | ✅               | ✅ `float`           | ✅            | ✅ `float_literal`   |
| **Literal (string)**              | ✅         | ✅               | ✅ `string`          | ✅            | ✅ `string_literal`  |
| **Boolean**                       | ✅         | ✅               | ✅ `true/False`      | ✅            | ✅                   |
| **Identifier**                    | ✅         | ✅               | ✅                   | ✅            | ✅                   |
| **BinaryExpression (+,-,\*,/,%)** | ✅         | ✅               | ✅ `binary_operator` | ⚠️ apenas `+` | ✅                   |
| **UnaryExpression (!,-,++,--)**   | ✅         | ✅               | ✅                   | ❌            | ✅ `unary_expression`, `reference_expression` |
| **ComparisonOperator**            | ✅         | ✅               | ✅                   | ❌            | ✅ (`binary_expression`) |
| **SubscriptExpression**           | ✅         | ✅               | ✅ `subscript`       | ✅            | ✅ `index_expression` |
| **MemberExpression**              | ✅         | ✅               | ✅ `attribute`       | ❌            | ✅ `field_expression`, `method_call_expression` |
| **ConditionalExpression (? :)**   | ✅         | ✅               | ❌                   | ❌            | ✅ RustGenerator: `(if cond { a } else { b })` |
| **CastExpression**                | ✅         | ✅               | ❌                   | ❌            | ❌                   |

---

## 4. Funções de Hardware (GPIO/Timing)

| Função ASL      | README.md | C/C++ (CParser)  | Python Tree-sitter | Python Regex | RustParser   |
| --------------- | --------- | ---------------- | ------------------ | ------------ | ------------ |
| **GpioSet**     | ✅         | ✅ `digitalWrite` | ✅ `pin.value(1)`   | ✅            | ✅ `gpio_set` / `digitalWrite` / `set_high` / `set_low` |
| **GpioRead**    | ✅         | ✅ `digitalRead`  | ❌                  | ❌            | ✅ `gpio_get` / `digitalRead` / `is_high` / `is_low` |
| **AnalogWrite** | ✅         | ✅ `analogWrite`  | ❌                  | ❌            | ❌            |
| **AnalogRead**  | ✅         | ✅ `analogRead`   | ✅ `ADC`            | ❌            | ✅ `adc_read` / `analogRead`   |
| **DelayMs**     | ✅         | ✅ `delay`        | ✅ `time.sleep_ms`  | ✅            | ✅ `delay` / `delay_ms` / `Timer::after_millis` / `Timer::after_secs` |
| **millis()**    | ✅         | ✅                | ❌                  | ❌            | ❌            |
| **micros()**    | ✅         | ✅                | ❌                  | ❌            | ❌            |
| **pinMode**     | ✅         | ✅                | ✅ `direction=`     | ✅            | ❌            |
| **random()**    | ✅         | ✅                | ❌                  | ❌            | ❌            |

---

## 5. Saída (Print/Serial)

| Função                | README.md | C/C++ (CParser)          | Python Tree-sitter | Python Regex | RustParser   |
| --------------------- | --------- | ------------------------ | ------------------ | ------------ | ------------ |
| **Print**             | ✅         | ✅ `Serial.print/println` | ✅ `print()`        | ✅            | ✅ `println!` / `print!` / `info!` / `warn!` / `error!` / `debug!` / `trace!` / `uprintln!` / `rprintln!` / `hprintln!` |
| **Serial.begin**      | ✅         | ✅                        | ❌                  | ❌            | ❌            |
| **Serial.available**  | ✅         | ✅                        | ❌                  | ❌            | ❌            |
| **Serial.readString** | ✅         | ✅                        | ❌                  | ❌            | ❌            |

---

## 6. Hardware Específico (C/Arduino Only)

| Módulo            | README.md | C/C++ (CParser) | Notas                            |
| ----------------- | --------- | --------------- | -------------------------------- |
| **LCD**           | ✅         | ✅               | `lcd.print/clear/setCursor`      |
| **OLED**          | ✅         | ✅               | `oled.text/show/clear`           |
| **Seven Segment** | ✅         | ✅               | `sevseg.print/setNumber`         |
| **Keypad**        | ✅         | ✅               | `keypad.getKey`                  |
| **DHT**           | ✅         | ✅               | `dht.readTemp/Hum`               |
| **Ultrasonic**    | ✅         | ✅               | `ultrasonic.read`                |
| **LDR**           | ✅         | ✅               | `ldr.read`                       |
| **IR**            | ✅         | ✅               | `ir.read`                        |
| **Motors**        | ✅         | ✅               | `motors.move`                    |
| **MPU (IMU)**     | ✅         | ✅               | `mpu.getX/Y/Z`                   |
| **RGB/NeoPixel**  | ✅         | ✅               | `rgb.setColor`, `neopixel.show`  |
| **WiFi**          | ✅         | ✅               | `WiFi.begin/status`              |
| **HTTP**          | ✅         | ✅               | `HTTP.get`                       |
| **SPIFFS/File**   | ✅         | ✅               | `SPIFFS.open`, `file.readString` |

---

## 7. Operadores Matemáticos (ASLExecutor)

| Operador           | README.md | Implementado |
| ------------------ | --------- | ------------ |
| `+ - * / %`        | ✅         | ✅            |
| `&& \|\|`          | ✅         | ✅            |
| `& \| ^` (bitwise) | ✅         | ✅            |
| `<< >>` (shift)    | ✅         | ✅            |
| `== != < > <= >=`  | ✅         | ✅            |

---

## 8. Builtins (ASLExecutor)

| Função                   | README.md | Implementado | Notas |
| ------------------------ | --------- | ------------ | ----- |
| **abs()**                | ✅         | ✅            | `Math.abs` |
| **sqrt()**               | ✅         | ✅            | `Math.sqrt` |
| **pow()**                | ✅         | ✅            | `Math.pow` |
| **sin/cos/tan**          | ✅         | ✅            | `Math.sin/cos/tan` |
| **log()**                | ✅         | ✅            | `Math.log` |
| **min/max**              | ✅         | ✅            | `Math.min/max` |
| **round/floor/ceil**     | ✅         | ✅            | `Math.round/floor/ceil` |
| **random(min,max)**      | ✅         | ✅            | |
| **random(max)**          | ✅         | ✅            | |
| **map()**                | ✅         | ✅            | |
| **constrain()**          | ✅         | ✅            | |
| **int()/float()/String()**| ✅        | ✅            | Cast / conversão de tipo |
| **sizeof()**             | ✅         | ✅            | Array.length / string.length / 4 para primitivos |
| **millis()**             | ✅         | ✅            | |
| **micros()**             | ✅         | ✅            | |
| **delayMicroseconds()**  | ✅         | ✅            | |
| **tone()** (parcial)     | ✅         | ⚠️            | Duration arg não implementado |
| **len()**                | ✅         | ✅            | Alias `__len` |
| **format()**             | ✅         | ✅            | Substituição `{}` |
| **enumerate()**          | ✅         | ✅            | Retorna `[idx, val][]` |
| **reversed()**           | ✅         | ✅            | |

---

## 9. Gaps Identificados (README vs Implementação)

> Items que ainda carecem de atenção após a lista crítica.

| Item                  | Status     | Ação Necessária                                      |
| --------------------- | ---------- | ---------------------------------------------------- |
| **Serial.write/read** | ⚠️ parcial  | Verificar cobertura no ASLExecutor                   |
| **Servo**             | ⚠️ parcial  | Implementar duration arg no tone/servo               |
| **EEPROM**            | ❌          | Implementar via hardwareCall                         |
| **Wire (I2C)**        | ❌          | Implementar via hardwareCall                         |
| **SPI**               | ❌          | Implementar via hardwareCall                         |
| **attachInterrupt**   | ❌          | Implementar modelo ISR                               |
| **pulseIn**           | ❌          | Implementar                                          |
| **shiftOut**          | ❌          | Implementar                                          |
| **EnumDeclaration**   | ❌          | Implementar em CParser (já suportado no executor via literal) |
| **CastExpression Rust** | ❌        | `as u8`, `as f32` no RustParser                      |
| **ArrayInitializer Rust** | ❌      | `[0u8; N]`, `vec![]` no RustParser                   |
| **AnalogWrite Rust**  | ❌          | PWM / `pwm.set_duty` no RustParser                   |
| **millis/micros Rust** | ❌         | `Instant::now()` no RustParser                       |

---

## 10. Matriz de Cobertura por Linguagem

> Actualizada em 28/02/2026 — sessão RustParser + RustGenerator.

| Categoria         | C/C++ | Python Tree | Python Regex | Rust |
| ----------------- | ----- | ----------- | ------------ | ---- |
| **Controle**      | 100%  | 60%         | 20%          | 95%  |
| **Declarações**   | 100%  | 70%         | 30%          | 65%  |
| **Expressões**    | 100%  | 80%         | 40%          | 90%  |
| **Hardware**      | 100%  | 40%         | 20%          | 55%  |
| **Display I/O**   | 100%  | 0%          | 0%           | 0%   |
| **Math Builtins** | 100%  | N/A         | N/A          | N/A  |

---

## 11. Próximos Passos

### 🟢 Lista Crítica — CONCLUÍDA (28/02/2026)
- [x] switch/case no Executor (fall-through + default)
- [x] sizeof no Executor
- [x] cast (int/float/String) no Executor
- [x] conditional ternário no Executor
- [x] delayMicroseconds no Executor
- [x] Math Builtins (abs, sqrt, pow, sin, cos, tan, log, min, max, round, floor, ceil)
- [x] float_literal no RustParser
- [x] Embassy delays (Timer::after_millis / Timer::after_secs) no RustParser
- [x] defmt/uprintln/rprintln macros no RustParser
- [x] AnalogRead MicroPython ADC no PythonParser
- [x] SubscriptExpression (index_expression) no RustParser
- [x] GpioRead no RustParser
- [x] ForLoop com range `0..N` e `0..=N` no RustParser
- [x] StructDeclaration no RustParser
- [x] SwitchStatement handler no statementRegistry
- [x] StructDeclaration no-op handler no statementRegistry
- [x] CastExpression + ConditionalExpression no exprTransform
- [x] DoWhile no CParser (`do_statement`) — [060942cf](https://github.com/caiojordao84/neuroforge/commit/060942cf4be154ed76f358d373a66b819b59c865)
- [x] UnaryExpression no RustParser (`!`, `-`, `*`, `&`, `&mut`) — [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02)
- [x] MemberExpression no RustParser (`struct.field`, `obj.method()`) — [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02)
- [x] reference_expression no RustParser (`&x`, `&mut x`) — [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02)
- [x] DoWhileLoop no RustGenerator (emulado) — [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121)
- [x] BreakStatement / ContinueStatement / ReturnStatement no RustGenerator — [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121)
- [x] IfStatement else / else-if no RustGenerator — [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121)
- [x] Loop infinito, Block, GpioRead no RustGenerator — [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121)
- [x] UnaryExpression / MemberExpression / ConditionalExpression no RustGenerator `genExpr` — [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121)
- [x] ASLExecutor.ts — verificado 100% completo (doWhile, switch, for, break/continue/return, todos os nós)

### 🔴 Prioridade Alta (próxima fase)
- [ ] CastExpression Rust (`as u8`, `as f32`) no RustParser
- [ ] ArrayInitializer Rust (`[0u8; N]`, `vec![]`) no RustParser
- [ ] AnalogWrite Rust (PWM) no RustParser
- [ ] millis/micros Rust (`Instant::now()`) no RustParser
- [ ] EnumDeclaration no CParser / RustParser

### 🟡 Prioridade Média
- [ ] Hardware periféricos (EEPROM, Wire/I2C, SPI) via hardwareCall
- [ ] attachInterrupt / pulseIn / shiftOut
- [ ] tone() duration arg
- [ ] Python Parser melhorias (BreakStatement, array literals, RegexParser completar operadores)

---

## 12. Arquivos Analisados

### Parsers
- `src/engine/asl/plugins/c/CParser.ts` (trata C e C++)
- `src/engine/asl/plugins/python/PythonParser.ts`
- `src/engine/asl/plugins/rust/RustParser.ts`

### Generators
- `src/engine/asl/plugins/c/CGenerator.ts`
- `src/engine/asl/plugins/rust/RustGenerator.ts`

### Executors e Simulation
- `src/engine/asl/ASLExecutor.ts`
- `src/engine/SimulationEngine.ts`

### Transformações
- `src/engine/asl/codeToASL.ts`
- `src/engine/asl/transforms/statementRegistry.ts`
- `src/engine/asl/transforms/exprTransform.ts`

### Referência
- `notyet/README.md`
- `docs/IMPLEMENTATION_STANDARD.md`
