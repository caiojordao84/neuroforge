# Tabela Comparativa: ASL Parser Implementation

> Documento actualizado em 01 Março 2026
> Comparação entre a documentação (`notyet/README.md`) e a implementação real dos parsers ASL
>
> 📋 **Para o plano de implementação padrão, consulte**: [IMPLEMENTATION_STANDARD.md](./IMPLEMENTATION_STANDARD.md)

---

## 🏁 Lista Crítica (branch `critical_Implementation`) — **100% CONCLUÍDA**

> Todos os itens abaixo foram verificados e/ou implementados nas sessões de 28/02/2026 e 01/03/2026.

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
| 1.21 | `DoWhileLoop` no RustGenerator (emulado) | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.22 | `BreakStatement` / `ContinueStatement` / `ReturnStatement` no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.23 | `IfStatement` else / else-if no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.24 | `Loop` infinito no RustGenerator (`loop { ... }`) | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.25 | `Block`, `GpioRead` (stmt) no RustGenerator | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.26 | `UnaryExpression`, `MemberExpression`, `ConditionalExpression` no RustGenerator `genExpr` | `RustGenerator.ts` | ✅ [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) |
| 1.27 | `DoWhile` no CParser (`do_statement`) | `CParser.ts` | ✅ [060942cf](https://github.com/caiojordao84/neuroforge/commit/060942cf4be154ed76f358d373a66b819b59c865) |
| 1.28 | `ASLExecutor.ts` — todos os nós verificados | `ASLExecutor.ts` | ✅ Já existia completo |
| 1.29 | `EnumDeclaration` no RustParser (`enum_item`) | `RustParser.ts` | ✅ [342e8df3](https://github.com/caiojordao84/neuroforge/commit/342e8df3c599194cd00e4da0be3ee1daa37979a3) |
| 1.30 | `CastExpression` no RustParser (`type_cast_expression`) | `RustParser.ts` | ✅ [342e8df3](https://github.com/caiojordao84/neuroforge/commit/342e8df3c599194cd00e4da0be3ee1daa37979a3) |
| 1.31 | `ArrayInitializer` no RustParser (`array_expression`: `[a,b]` + `[val;N]`) | `RustParser.ts` | ✅ [342e8df3](https://github.com/caiojordao84/neuroforge/commit/342e8df3c599194cd00e4da0be3ee1daa37979a3) |
| 1.32 | `AnalogWrite` (PWM) no RustParser | `RustParser.ts` | ✅ [342e8df3](https://github.com/caiojordao84/neuroforge/commit/342e8df3c599194cd00e4da0be3ee1daa37979a3) |
| 1.33 | `EnumDeclaration` + `CastExpression` + `ArrayInitializer` repeat no RustGenerator | `RustGenerator.ts` | ✅ [ce046d9f](https://github.com/caiojordao84/neuroforge/commit/ce046d9f9b3322490459430920dc6b3b488dbe99) |
| 1.34 | `millis()` / `micros()` no RustParser (`visitCall` + `.as_millis()` method) | `RustParser.ts` | ✅ [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) |
| 1.35 | `ArrayInitializer 2D` no RustParser (detecção aninhamento) | `RustParser.ts` | ✅ [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) |
| 1.36 | `ObjectInitializer` Rust (`struct_expression` → `DesignatedInitializer`) | `RustParser.ts` | ✅ [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) |
| 1.37 | `DesignatedInitializer` genExpr + genStmt fix (children vs attributes.fields) | `RustGenerator.ts` | ✅ [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) |
| 1.38 | `ArrayInitializer 2D` no RustGenerator (`vec![vec![...]]`) | `RustGenerator.ts` | ✅ [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) |

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
| **DoWhile**           | ✅ 🟢      | ✅ `do_statement` | ❌ (inexistente em Python) | ❌ (inexistente em Python) | ✅ RustGenerator emula via `loop { if !(cond) { break; } }` |

---

## 2. Declarações

| Declaração              | README.md | C/C++ (CParser) | Python Tree-sitter      | Python Regex   | RustParser          |
| ----------------------- | --------- | --------------- | ----------------------- | -------------- | ------------------- |
| **VariableDeclaration** | ✅         | ✅               | ✅ `let_declaration`     | ✅ `var = expr` | ✅ `let_declaration` |
| **Function**            | ✅         | ✅               | ✅ `function_definition` | ✅ `def`        | ✅ `function_item`   |
| **StructDeclaration**   | ✅         | ✅               | ❌                       | ❌              | ✅ `struct_item`     |
| **EnumDeclaration**     | ✅         | ✅               | ❌                       | ❌              | ✅ `enum_item`       |
| **ArrayInitializer 1D** | ✅         | ✅               | ✅ `list`                | ❌              | ✅ `array_expression` (`[a,b]` + `[val;N]`) |
| **ArrayInitializer 2D** | ✅         | ✅               | ❌                       | ❌              | ✅ detecção aninhamento → `vec![vec![...]]` |
| **ArrayInitializer 3D** | ✅         | ✅               | ❌                       | ❌              | ❌                   |
| **ObjectInitializer**   | ✅         | ❌               | ✅ `dictionary`          | ✅ `{k:v}`      | ✅ `struct_expression` → `DesignatedInitializer` |
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
| **CastExpression**                | ✅         | ✅               | ❌                   | ❌            | ✅ `type_cast_expression` (`x as u8`) |

---

## 4. Funções de Hardware (GPIO/Timing)

| Função ASL      | README.md | C/C++ (CParser)  | Python Tree-sitter | Python Regex | RustParser   |
| --------------- | --------- | ---------------- | ------------------ | ------------ | ------------ |
| **GpioSet**     | ✅         | ✅ `digitalWrite` | ✅ `pin.value(1)`   | ✅            | ✅ `gpio_set` / `digitalWrite` / `set_high` / `set_low` |
| **GpioRead**    | ✅         | ✅ `digitalRead`  | ❌                  | ❌            | ✅ `gpio_get` / `digitalRead` / `is_high` / `is_low` |
| **AnalogWrite** | ✅         | ✅ `analogWrite`  | ❌                  | ❌            | ✅ `analogWrite` / `pwm_write` / `pwm.set_duty` / `pwm.set_duty_cycle` |
| **AnalogRead**  | ✅         | ✅ `analogRead`   | ✅ `ADC`            | ❌            | ✅ `adc_read` / `analogRead`   |
| **DelayMs**     | ✅         | ✅ `delay`        | ✅ `time.sleep_ms`  | ✅            | ✅ `delay` / `delay_ms` / `Timer::after_millis` / `Timer::after_secs` |
| **millis()**    | ✅         | ✅                | ❌                  | ❌            | ✅ `millis()` / `get_ms()` / `.elapsed().as_millis()` |
| **micros()**    | ✅         | ✅                | ❌                  | ❌            | ✅ `micros()` / `get_us()` / `.elapsed().as_micros()` |
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

## 9. Gaps Restantes

| Item                  | Status     | Notas                                                |
| --------------------- | ---------- | ---------------------------------------------------- |
| **ArrayInitializer 3D Rust** | ❌   | Raramente utilizado em embedded                      |
| **ListComprehension Rust** | ❌    | N/A para Rust                                        |
| **Serial.write/read** | ⚠️ parcial  | Verificar cobertura no ASLExecutor                   |
| **Servo / tone() duration** | ⚠️  | Implementar duration arg                             |
| **EEPROM**            | ❌          | Implementar via hardwareCall                         |
| **Wire (I2C)**        | ❌          | Implementar via hardwareCall                         |
| **SPI**               | ❌          | Implementar via hardwareCall                         |
| **attachInterrupt**   | ❌          | Implementar modelo ISR                               |
| **pulseIn**           | ❌          | Implementar                                          |
| **shiftOut**          | ❌          | Implementar                                          |
| **pinMode Rust**      | ❌          | `gpio.into_push_pull_output()` no RustParser         |
| **random() Rust**     | ❌          | `rand` crate no RustParser                           |
| **EnumDeclaration Python** | ❌    | Sem equivalente directo em Python                    |

---

## 10. Matriz de Cobertura por Linguagem

> Actualizada em 01/03/2026 — sessão millis/micros + ArrayInit 2D + ObjectInitializer.

| Categoria         | C/C++ | Python Tree | Python Regex | Rust |
| ----------------- | ----- | ----------- | ------------ | ---- |
| **Controle**      | 100%  | 60%         | 20%          | 95%  |
| **Declarações**   | 100%  | 70%         | 30%          | 90%  |
| **Expressões**    | 100%  | 80%         | 40%          | 95%  |
| **Hardware**      | 100%  | 40%         | 20%          | 70%  |
| **Display I/O**   | 100%  | 0%          | 0%           | 0%   |
| **Math Builtins** | 100%  | N/A         | N/A          | N/A  |

---

## 11. Histórico de Commits (branch `critical_Implementation`)

| Commit | Data | Descrição |
|--------|------|-----------|
| [b197562](https://github.com/caiojordao84/neuroforge/commit/b197562f2a1ce2f9b0214d688742852a07452422) | 28/02 | Embassy delays + defmt macros no RustParser |
| [65cc7c88](https://github.com/caiojordao84/neuroforge/commit/65cc7c880be122e50660059f33585e0f75ee5d02) | 28/02 | UnaryExpression + MemberExpression + reference_expression |
| [a6191adb](https://github.com/caiojordao84/neuroforge/commit/a6191adb7cc3170b3ee90e80916b465e929c5121) | 28/02 | RustGenerator: DoWhile, Break/Continue/Return, IfStatement, Loop |
| [060942cf](https://github.com/caiojordao84/neuroforge/commit/060942cf4be154ed76f358d373a66b819b59c865) | 28/02 | DoWhile no CParser |
| [87c43b8](https://github.com/caiojordao84/neuroforge/commit/87c43b8115e7eea0cb552e8aa85706719131beb7) | 28/02 | StructDeclaration no-op no statementRegistry |
| [342e8df3](https://github.com/caiojordao84/neuroforge/commit/342e8df3c599194cd00e4da0be3ee1daa37979a3) | 01/03 | RustParser: EnumDeclaration + CastExpression + ArrayInit + AnalogWrite |
| [ce046d9f](https://github.com/caiojordao84/neuroforge/commit/ce046d9f9b3322490459430920dc6b3b488dbe99) | 01/03 | RustGenerator: EnumDeclaration + CastExpression + ArrayInitializer repeat |
| [28177864](https://github.com/caiojordao84/neuroforge/commit/28177864fde9ed5972780923a0ff12c2f4204eec) | 01/03 | RustParser+Generator: millis/micros + ArrayInit 2D + ObjectInitializer |

---

## 12. Arquivos Analisados

### Parsers
- `src/engine/asl/plugins/c/CParser.ts`
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
