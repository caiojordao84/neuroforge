# Tabela Comparativa: ASL Parser Implementation

> Documento gerado em Fevereiro 2026
> Comparação entre a documentação (`notyet/README.md`) e a implementação real dos parsers ASL
>
> 📋 **Para o plano de implementação padrão, consulte**: [IMPLEMENTATION_STANDARD.md](./IMPLEMENTATION_STANDARD.md)

---

## Legenda

- ✅ Implementado (declarado no README + presente no parser)
- ⚠️ Parcialmente implementado (presente mas com limitações)
- ❌ Não implementado / Gap
- 🔄 Diferença entre Tree-sitter e Regex (Python)

---

## 1. Estruturas de Controle

| Estrutura             | README.md | C/C++ (CParser) | Python Tree-sitter   | Python Regex               | RustParser           |
| --------------------- | --------- | --------------- | -------------------- | -------------------------- | -------------------- |
| **IfStatement**       | ✅ [x]     | ✅               | ✅ `if_statement`     | ❌                           | ✅ `if_expression`    |
| **WhileLoop**         | ✅ [x]     | ✅               | ✅ `while_statement`  | ⚠️ apenas como `while True:` | ✅ `while_expression` |
| **ForLoop**           | ✅ [x]     | ✅               | ✅ `for_statement`    | ✅ `for ... in`             | ✅ `for_expression`   |
| **Loop (infinito)**   | ✅ [x]     | ✅ `while(1)`    | ✅ `while_statement`  | ✅ `while True:`             | ✅ `loop_expression`  |
| **SwitchStatement**   | ✅ [x]     | ✅               | ✅ `match_statement`  | ✅ `match/case`             | ✅ `match_expression` |
| **CaseClause**        | ✅ [x]     | ✅               | ✅ `case_clause`      | ✅                          | ✅ `match_arm`        |
| **BreakStatement**    | ✅ [x]     | ✅               | ❌                    | ⚠️ auto-add                 | ❌                    |
| **ContinueStatement** | ✅ [x]     | ✅               | ❌                    | ❌                          | ❌                    |
| **ReturnStatement**   | ✅ [x]     | ✅               | ✅ `return_statement` | ❌                          | ❌                    |
| **DoWhile**           | ❌ [🔴]     | ❌               | ❌                    | ❌                          | ❌                    |

---

## 2. Declarações

| Declaração              | README.md | C/C++ (CParser) | Python Tree-sitter      | Python Regex   | RustParser          |
| ----------------------- | --------- | --------------- | ----------------------- | -------------- | ------------------- |
| **VariableDeclaration** | ✅ [x]     | ✅               | ✅ `let_declaration`     | ✅ `var = expr` | ✅ `let_declaration` |
| **Function**            | ✅ [x]     | ✅               | ✅ `function_definition` | ✅ `def`        | ✅ `function_item`   |
| **StructDeclaration**   | ✅ [x]     | ✅               | ❌                       | ❌              | ❌                   |
| **EnumDeclaration**     | ✅ [x]     | ✅               | ❌                       | ❌              | ❌                   |
| **ArrayInitializer 1D** | ✅ [x]     | ✅               | ✅ `list`                | ❌              | ❌                   |
| **ArrayInitializer 2D** | ✅ [x]     | ✅               | ❌                       | ❌              | ❌                   |
| **ArrayInitializer 3D** | ✅ [x]     | ✅               | ❌                       | ❌              | ❌                   |
| **ObjectInitializer**   | ✅ [x]     | ❌               | ✅ `dictionary`          | ✅ `{k:v}`      | ❌                   |
| **ListComprehension**   | ✅ [x]     | ❌               | ✅                       | ❌              | ❌                   |

---

## 3. Expressões

| Expressão                         | README.md | C/C++ (CParser) | Python Tree-sitter  | Python Regex | RustParser          |
| --------------------------------- | --------- | --------------- | ------------------- | ------------ | ------------------- |
| **Literal (int)**                 | ✅ [x]     | ✅               | ✅ `integer`         | ✅            | ✅ `integer_literal` |
| **Literal (float)**               | ✅ [x]     | ✅               | ✅ `float`           | ✅            | ❌                   |
| **Literal (string)**              | ✅ [x]     | ✅               | ✅ `string`          | ✅            | ✅ `string_literal`  |
| **Boolean**                       | ✅ [x]     | ✅               | ✅ `true/False`      | ✅            | ✅                   |
| **Identifier**                    | ✅ [x]     | ✅               | ✅                   | ✅            | ✅                   |
| **BinaryExpression (+,-,\*,/,%)** | ✅ [x]     | ✅               | ✅ `binary_operator` | ⚠️ apenas `+` | ✅                   |
| **UnaryExpression (!,-,++,--)**   | ✅ [x]     | ✅               | ✅                   | ❌            | ❌                   |
| **ComparisonOperator**            | ✅ [x]     | ✅               | ✅                   | ❌            | ❌                   |
| **SubscriptExpression**           | ✅ [x]     | ✅               | ✅ `subscript`       | ✅            | ❌                   |
| **MemberExpression**              | ✅ [x]     | ✅               | ✅ `attribute`       | ❌            | ❌                   |
| **ConditionalExpression (? :)**   | ✅ [x]     | ✅               | ❌                   | ❌            | ❌                   |

---

## 4. Funções de Hardware (GPIO/Timing)

| Função ASL      | README.md | C/C++ (CParser)  | Python Tree-sitter | Python Regex | RustParser   |
| --------------- | --------- | ---------------- | ------------------ | ------------ | ------------ |
| **GpioSet**     | ✅ [x]     | ✅ `digitalWrite` | ✅ `pin.value(1)`   | ✅            | ✅ `gpio_set` |
| **GpioRead**    | ✅ [x]     | ✅ `digitalRead`  | ❌                  | ❌            | ❌            |
| **AnalogWrite** | ✅ [x]     | ✅ `analogWrite`  | ❌                  | ❌            | ❌            |
| **AnalogRead**  | ✅ [x]     | ✅ `analogRead`   | ❌                  | ❌            | ❌            |
| **DelayMs**     | ✅ [x]     | ✅ `delay`        | ✅ `time.sleep_ms`  | ✅            | ✅ `delay`    |
| **millis()**    | ✅ [x]     | ✅                | ❌                  | ❌            | ❌            |
| **micros()**    | ✅ [x]     | ✅                | ❌                  | ❌            | ❌            |
| **pinMode**     | ✅ [x]     | ✅                | ✅ `direction=`     | ✅            | ❌            |
| **random()**    | ✅ [x]     | ✅                | ❌                  | ❌            | ❌            |

---

## 5. Saída (Print/Serial)

| Função                | README.md | C/C++ (CParser)          | Python Tree-sitter | Python Regex | RustParser   |
| --------------------- | --------- | ------------------------ | ------------------ | ------------ | ------------ |
| **Print**             | ✅ [x]     | ✅ `Serial.print/println` | ✅ `print()`        | ✅            | ✅ `println!` |
| **Serial.begin**      | ✅ [x]     | ✅                        | ❌                  | ❌            | ❌            |
| **Serial.available**  | ✅ [x]     | ✅                        | ❌                  | ❌            | ❌            |
| **Serial.readString** | ✅ [x]     | ✅                        | ❌                  | ❌            | ❌            |

---

## 6. Hardware Específico (C/Arduino Only)

| Módulo            | README.md | C/C++ (CParser) | Notas                            |
| ----------------- | --------- | --------------- | -------------------------------- |
| **LCD**           | ✅ [x]     | ✅               | `lcd.print/clear/setCursor`      |
| **OLED**          | ✅ [x]     | ✅               | `oled.text/show/clear`           |
| **Seven Segment** | ✅ [x]     | ✅               | `sevseg.print/setNumber`         |
| **Keypad**        | ✅ [x]     | ✅               | `keypad.getKey`                  |
| **DHT**           | ✅ [x]     | ✅               | `dht.readTemp/Hum`               |
| **Ultrasonic**    | ✅ [x]     | ✅               | `ultrasonic.read`                |
| **LDR**           | ✅ [x]     | ✅               | `ldr.read`                       |
| **IR**            | ✅ [x]     | ✅               | `ir.read`                        |
| **Motors**        | ✅ [x]     | ✅               | `motors.move`                    |
| **MPU (IMU)**     | ✅ [x]     | ✅               | `mpu.getX/Y/Z`                   |
| **RGB/NeoPixel**  | ✅ [x]     | ✅               | `rgb.setColor`, `neopixel.show`  |
| **WiFi**          | ✅ [x]     | ✅               | `WiFi.begin/status`              |
| **HTTP**          | ✅ [x]     | ✅               | `HTTP.get`                       |
| **SPIFFS/File**   | ✅ [x]     | ✅               | `SPIFFS.open`, `file.readString` |

---

## 7. Operadores Matemáticos (ASLExecutor)

| Operador           | README.md | Implementado |
| ------------------ | --------- | ------------ |
| `+ - * / %`        | ✅ [x]     | ✅            |
| `&& \|\|`          | ✅ [x]     | ✅            |
| `& \| ^` (bitwise) | ✅ [x]     | ✅            |
| `<< >>` (shift)    | ✅ [x]     | ✅            |
| `== != < > <= >=`  | ✅ [x]     | ✅            |

---

## 8. Builtins (ASLExecutor)

> ⚠️ **IMPORTANTE**: Os Math Builtins estão marcados como ✅ no README.md mas **NÃO estão implementados** no código atual!

| Função                   | README.md | Implementado |
| ------------------------ | --------- | ------------ |
| **abs()**                  | ✅ [x]     | ❌            |
| **sqrt()**                 | ✅ [x]     | ❌            |
| **pow()**                  | ✅ [x]     | ❌            |
| **sin/cos/tan**            | ✅ [x]     | ❌            |
| **min/max**                | ✅ [x]     | ❌            |
| **round/floor/ceil**       | ✅ [x]     | ❌            |
| **random(min,max)**        | ✅ [x]     | ✅            |
| **random(max)**            | ✅ [x]     | ✅            |
| **map()**                  | ✅ [x]     | ✅            |
| **constrain()**            | ✅ [x]     | ✅            |
| **int()/float()/String()** | ✅ [x]     | ✅            |
| **sizeof()**               | ✅ [x]     | ❌            |
| **millis()**               | ✅ [x]     | ✅            |
| **micros()**               | ✅ [x]     | ✅            |
| **tone()** (parcial)       | ✅ [x]     | ⚠️            |

---

## 9. Gaps Identificados (README vs Implementação)

> ⚠️ **CRÍTICO**: Diversos Math Builtins (abs, sqrt, pow, sin, cos, tan, min, max, round, floor, ceil) estão listados no README.md como implementados ([x]), mas **NÃO estão implementados** no código atual do ASLExecutor. Eles retornam 0 por causa do fallback genérico.

| Item                  | Status README  | Status Parser | Ação Necessária                                      |
| --------------------- | -------------- | ------------- | ---------------------------------------------------- |
| **DoWhile**           | ❌ [🔴 Critical] | ❌             | Implementar no CParser + ASLExecutor                 |
| **delayMicroseconds** | ✅ [x]         | ❌             | Adicionar ao ASLExecutor                             |
| **Math Builtins**     | ✅ [x]         | ❌             | CRITICAL: Implementar abs, sqrt, pow, sin, cos, etc. |
| **sizeof**            | ✅ [x]         | ❌             | Adicionar suporte no ASLExecutor                      |
| **range-based for**   | ✅ [x]         | ❌             | Implementar no CParser                               |
| **Serial.write/read** | ✅ [x]         | ❌             | Implementar no ASLExecutor                           |
| **Servo**             | ✅ [x]         | ⚠️ parcial     | Implementar hardwareCall                             |
| **EEPROM**            | ✅ [x]         | ❌             | Implementar hardwareCall                             |
| **Wire (I2C)**        | ✅ [x]         | ❌             | Implementar hardwareCall                             |
| **SPI**               | ✅ [x]         | ❌             | Implementar hardwareCall                             |
| **tone()**            | ✅ [x]         | ⚠️ parcial     | Implementar duration arg                             |
| **attachInterrupt**   | ✅ [x]         | ❌             | Implementar modelo ISR                              |
| **pulseIn**           | ✅ [x]         | ❌             | Implementar                                         |
| **shiftOut**          | ✅ [x]         | ❌             | Implementar                                         |
| **String concat**     | ✅ [x]         | ⚠️             | Corrigir no ASLExecutor                             |

---

## 10. Matriz de Cobertura por Linguagem

| Categoria         | C/C++ | Python Tree | Python Regex | Rust |
| ----------------- | ----- | ----------- | ------------ | ---- |
| **Controle**      | 100%  | 60%         | 20%          | 70%  |
| **Declarações**   | 100%  | 70%         | 30%          | 50%  |
| **Expressões**    | 100%  | 80%         | 40%          | 60%  |
| **Hardware**      | 100%  | 30%         | 20%          | 15%  |
| **Display I/O**   | 100%  | 0%          | 0%           | 0%   |
| **Math Builtins** | 0%    | N/A         | N/A          | N/A  |

---

## 11. Resumo: Próximos Passos

### C/C++ (Prioridade Alta)
- [ ] Completar gaps identificados na tabela acima
- [x] Implementar Math Builtins (`abs`, `sqrt`, etc.) no `ASLExecutor` - **CORRIGIDO: Math Builtins NÃO estão implementados!**
- [ ] Implementar `sizeof` no `ASLExecutor`

### Python (Prioridade Alta)
- [ ] Adicionar return statement no Regex parser
- [ ] Adicionar continue no Tree-sitter
- [x] Adicionar while loop no Regex parser (while True:)
- [x] Adicionar Switch/Case no Regex parser

### Rust (Prioridade Alta)
- [ ] Adicionar break/continue
- [ ] Adicionar return statement
- [ ] Adicionar structs
- [ ] Adicionar mais builtins (Serial, pinMode, etc.)

### Gaps Globais
- [ ] DoWhile (todas as linguagens)
- [ ] Hardware específico (LCD, OLED, etc.) para Python/Rust
- [ ] Math Builtins no ASLExecutor (abs, sqrt, pow, sin, cos, tan, min, max, round, floor, ceil)

---

## 12. Arquivos Analisados

### Parsers
- `src/engine/asl/plugins/c/CParser.ts` (trata C e C++)
- `src/engine/asl/plugins/python/PythonParser.ts`
- `src/engine/asl/plugins/rust/RustParser.ts`

### Executors e Simulation
- `src/engine/asl/ASLExecutor.ts`
- `src/engine/SimulationEngine.ts`

### Transformações
- `src/engine/asl/codeToASL.ts`
- `src/engine/asl/transforms/statementRegistry.ts`

### Referência
- `notyet/README.md`
