  
**ASL Semantic Dictionary**

Version 1.2.3

Normative Reference Document

Abstract Semantic Language for the NeuroForge Project

Transpilation between C++/Arduino, MicroPython, Rust Embassy,

and IEC 61131-3 Structured Text

June 2025

NeuroForge Project

# **1\. Philosophy and Fundamental Rules** {#1.-philosophy-and-fundamental-rules}

The ASL (Abstract Semantic Language) is an intermediate representation used in the NeuroForge project to enable transpilation between C++/Arduino, MicroPython, Rust Embassy, and IEC 61131-3 Structured Text. The following rules govern all parsers and generators.

| # | Rule | Description |
| :--- | :--- | :--- |
| **1** | **Semantic names, never API names.** | `digitalOutput`, not `digitalWrite`. `delay`, not `_sleep`. The name describes *what*, not *how* the source language writes it. |
| **2** | **Simple camelCase names for compound terms.** | `forRange`, `elseIf`, `thenBody`, `pinMode`. |
| **3** | **kind is the discriminant key.** | Every statement and expression uses the `kind` field as its discriminator. |
| **4** | **Native Booleans.** | `HIGH` / `True` / `TRUE` / `set_high()` all map to `{ "kind": "literal", "value": true }`. `LOW` / `False` / `FALSE` map to `{ "kind": "literal", "value": false }`. |
| **5** | **Operators as direct symbols.** | `"op": "+"`, `"op": ">"`, `"op": "&&"`. Never `"op": "add"`. |
| **6** | **Explicit includes and dependencies.** | Since v1.2, libraries are represented in an optional `includes` array at the root level. Explicit declarations take precedence over inference. |
| **7** | **Standard Tasks (setup/loop).** | Every program carries **at least** `setup` and `loop` in its `tasks` array. Parsers must normalize missing tasks. |
| **8** | **Documented IR.** | Functions and structs have an optional `doc` field for semantic preservation of comments. |

> [!NOTE]
> **Normalization Rule (R4):** While generators and parsers may accept `0/1` or `HIGH/LOW` for developer ergonomics, the **ASL Intermediate Representation (JSON)** must always store these as native JSON `true` or `false`.

# **2\. Root Structure — AslProgram** {#2.-root-structure-—-aslprogram}

Every ASL program is a single JSON object representing the root node.

```json
{
  "asl_version": "4.0.0",
  "metadata": {
    "name": "Blink",
    "description": "Standard LED blink example",
    "version": "1.0.0",
    "targetBoard": "esp32"
  },
  "includes": ["wire"],
  "structs": [],
  "enums": [],
  "globals": [],
  "functions": [],
  "functionBlocks": [],
  "tasks": [
    { "name": "setup", "body": [] },
    { "name": "loop", "body": [] }
  ]
}
```

## **2.1 Field Descriptions** {#2.1-field-descriptions}

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `asl_version` | string | Yes | Version of the ASL specification (e.g., "4.0.0"). |
| `metadata` | object | Yes | Program metadata. Fields are `null` if omitted. |
| `includes` | array | No | Explicit identifiers: `"wire"`, `"spi"`, `"servo"`, etc. |
| `structs` | array | Yes | Composite types. May be empty. |
| `enums` | array | No | Enumeration definitions. **(NEW in v1.2)** |
| `globals` | array | Yes | Global variable declarations. |
| `functions` | array | Yes | Pure stateless functions. |
| `functionBlocks` | array | No | Stateful IEC components. **(NEW in v1.2)** |
| `tasks` | array | Yes | Main execution units (at least `setup` and `loop`). |

## **2.2 Common Library Mappings** {#2.2-common-library-mappings}

| Include ID | C++ | MicroPython | Rust | ST |
| :--- | :--- | :--- | :--- | :--- |
| `"wire"` | `#include <Wire.h>` | `import machine` | `use embassy_stm32::i2c` | `USE_LIB WIRE` |
| `"spi"` | `#include <SPI.h>` | `import spi` | `use embassy_stm32::spi` | `USE_LIB SPI` |
| `"servo"` | `#include <Servo.h>` | `import servo` | `use servo::Servo` | `FB_SERVO` |
| `"mqtt"` | `#include <PubSubClient.h>` | `import umqtt.simple` | `use embassy_net::mqtt` | `USE_LIB MQTT` |

# **3\. Type System — AslType** {#3.-type-system-—-asltype}

## **3.1 Explicit Width Integers** {#3.1-explicit-width-integers}

| ASL Type | C++ | MicroPython | Rust | ST (IEC 61131-3) |
| :--- | :--- | :--- | :--- | :--- |
| `sint8` | `int8_t` | `int` | `i8` | `SINT` |
| `int16` | `int16_t` | `int` | `i16` | `INT` |
| `int32` | `int32_t` | `int` | `i32` | `DINT` |
| `int64` | `int64_t` | `int` | `i64` | `LINT` |
| `uint8` | `uint8_t` | `int` | `u8` | `USINT` |
| `uint16` | `uint16_t` | `int` | `u16` | `UINT` |
| `uint32` | `uint32_t` | `int` | `u32` | `UDINT` |
| `uint64` | `uint64_t` | `int` | `u64` | `ULINT` |

## **3.2 Float, Logic, and Character Types** {#3.3-float-logic-and-character-types}

| ASL Type | Description | C++ | MicroPython | Rust | ST |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `float` | 32-bit FP | `float` | `float` | `f32` | `REAL` |
| `double` | 64-bit FP | `double` | `float` | `f64` | `LREAL` |
| `bool` | Boolean | `bool` | `bool` | `bool` | `BOOL` |
| `string` | Text | `String` | `str` | `String` | `STRING` |
| `void` | No return | `void` | `None` | `()` | (none) |

## **3.3 IEC Time and Date Types (NEW in v1.2)** {#3.5-iec-time-and-date-types-new-in-v1.2}

ASL v1.2 introduces native support for industrial time types based on IEC 61131-3.

| ASL Type | Description | C++ | MicroPython | Rust | ST |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `time` | Duration | `uint64_t` | `timedelta` | `Duration` | `TIME` |
| `date` | Calendar | `struct tm` | `date` | `NaiveDate` | `DATE` |
| `timeOfDay` | Time | `struct tm` | `time` | `NaiveTime` | `TOD` |
| `dateTime` | Combined | `struct tm` | `datetime` | `NaiveDateTime` | `DT` |

Duration values in ASL use the structured "duration" kind (see Section 7), while date/time types are represented as strings in ISO 8601 format for literals, or as structured objects with fields (year, month, day, hour, minute, second, millise# **4\. Enums** {#4.-enums}

Enumerations define a set of named integer constants.

```json
{
  "name": "State",
  "doc": "Machine states",
  "variants": [
    { "name": "IDLE", "value": 0 },
    { "name": "RUN", "value": 1 },
    { "name": "ERROR", "value": 2 }
  ]
}
```

# **5\. Function Blocks (NEW in v1.2)** {#5.-function-blocks-new-in-v1.2}

Function Blocks (FBs) encapsulate both state and behavior. Unlike functions, FBs maintain internal state across invocations.

## **5.1 Schema** {#5.1-schema}

```json
{
  "name": "PID_Controller",
  "doc": "PID controller function block",
  "inputs": [
    { "name": "setpoint", "type": "float" },
    { "name": "processVar", "type": "float" }
  ],
  "outputs": [
    { "name": "output", "type": "float" }
  ],
  "internals": [
    { "name": "integral", "type": "float", "mutable": true },
    { "name": "prevError", "type": "float", "mutable": true }
  ],
  "body": [ ... ]
}
```

## **5.2 Instantiation Pattern** {#5.3-instantiation-pattern}

Function Blocks are instantiated as variables and called by name.

```json
// Declare instance:
{ 
  "kind": "declare", 
  "name": "pid1", 
  "type": "PID_Controller", 
  "mutable": true, 
  "scope": "local" 
}
// Call the FB (invoke its body):
{ "kind": "call", "callee": "pid1", "args": [] }
```

# **6\. Pin Configuration** {#6.-pin-configuration}

## **6.1 pinMode** {#6.1-pinmode}

```json
{ 
  "kind": "pinMode", 
  "pin": { "kind": "literal", "value": 13 }, 
  "mode": "OUTPUT" 
}
```

## **6.3 digitalOutput** {#6.3-digitaloutput}

```json
{ 
  "kind": "digitalOutput", 
  "pin": { "kind": "literal", "value": 13 }, 
  "value": { "kind": "literal", "value": true } 
}
```

## **6.4 digitalInput** {#6.4-digitalinput}

```json
{ 
  "kind": "digitalInput", 
  "pin": { "kind": "literal", "value": 12 }, 
  "target": "val" 
}
```

# **7\. Timing — Duration and Delay** {#7.-timing-duration-and-delay}

## **7.1 Duration Structure** {#7.1-duration-structure}

Durations use a structured object to enable idiomatic time generation (e.g., `T#500ms` in ST, `delay(500)` in C++).

```json
{
  "kind": "duration",
  "days": 0,
  "hours": 0,
  "minutes": 0,
  "seconds": 0,
  "milliseconds": 500,
  "microseconds": 0
}
```

## **7.2 delay** {#7.2-delay}

```json
{
  "kind": "delay",
  "duration": { 
    "kind": "duration", 
    "milliseconds": 500 
  }
}
```

## **7.3 millis / micros** {#7.3-millis-micros}

Expression kinds that return the elapsed time since program start:

```json
{ "kind": "millis" }   // Milliseconds since start
# **8\. Flow Control** {#8.-flow-control}

## **8.1 if / elseIf / else** {#8.1-if-elseif-else}

```json
{
  "kind": "if",
  "condition": { "kind": "binary", "op": ">", "left": { "kind": "var", "name": "x" }, "right": { "kind": "literal", "value": 10 } },
  "thenBody": [...],
  "elseIf": [
    { "condition": { ... }, "body": [...] }
  ],
  "elseBody": [...]
}
```

## **8.4 for — range** {#8.4-for-range}

```json
{ 
  "kind": "for", 
  "pattern": "range", 
  "var": "i",
  "from": { "kind": "literal", "value": 0 },
  "to": { "kind": "literal", "value": 10 },
  "step": { "kind": "literal", "value": 1 },
  "body": [...] 
}
```

> [!IMPORTANT]
> **Boundary Convention:** AS `to` is always **exclusive** (`i < to`).

## **8.7 switch** {#8.7-switch}

```json
{ 
  "kind": "switch", 
  "discriminant": { "kind": "var", "name": "estado" },
  "cases": [
    { "test": { "kind": "literal", "value": 1 }, "body": [...] },
    { "test": { "kind": "literal", "value": 2 }, "body": [...] },
    { "test": null, "body": [...] } 
  ] 
}
```

## **8.8 break / continue / return** {#8.8-break-continue-return}

```json
{ "kind": "break" }
{ "kind": "continue" }
{ "kind": "return", "value": { "kind": "var", "name": "result" } }
{ "kind": "return", "value": null } 
```

# **9\. Variables** {#9.-variables}

## **9.1 declare** {#9.1-declare}

```json
{
  "kind": "declare",
  "name": "counter",
  "type": "int",
  "value": { "kind": "literal", "value": 0 },
  "mutable": true,
  "scope": "local",
  "lifecycle": "retain"
}
```

| Lifecycle | Description | ST Mapping |
| :--- | :--- | :--- |
| `normal` | Standard variable | `VAR` |
| `retain` | Survives warm restart | `VAR RETAIN` |
| `persistent` | Survives cold restart | `VAR PERSISTENT` |

## **9.3 assign** {#9.3-assign}

```json
{ 
  "kind": "assign", 
  "target": "x", 
  "value": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "x" }, "right": { "kind": "literal", "value": 1 } } 
}
```

## **9.4 setIndex — Array Assignment** {#9.4-setindex-array-assignment}

```json
{ 
  "kind": "setIndex", 
  "target": "arr", 
  "index": { "kind": "var", "name": "i" }, 
  "value": { "kind": "literal", "value": 42 } 
}
```

## **9.5 setMember — Struct Assignment** {#9.5-setmember-struct-assignment}

```json
{ 
  "kind": "setMember", 
  "target": { "kind": "var", "name": "point" }, 
  "property": "x", 
  "value": { "kind": "literal", "value": 10 } 
}
```

# **10\. Arrays** {#10.-arrays}

```json
{ 
  "kind": "declare", 
  "name": "data", 
  "type": "array", 
  "subtype": "float", 
  "size": { "kind": "literal", "value": 3 },
  "value": { 
    "kind": "array", 
    "elements": [
      { "kind": "literal", "value": 1.0 }, 
      { "kind": "literal", "value": 2.0 }, 
      { "kind": "literal", "value": 3.0 }
    ] 
  },
  "mutable": true, 
  "scope": "local" 
}
```

## **10.2 Index Access** {#10.2-index-access}

```json
{ 
  "kind": "index", 
  "target": { "kind": "var", "name": "arr" }, 
  "index": { "kind": "var", "name": "i" } 
}
```

# **11\. Functions** {#11.-functions}

```json
{
  "name": "sum",
  "params": [
    { "name": "a", "type": "int" },
    { "name": "b", "type": "int" }
  ],
  "returnType": "int",
  "body": [
    { "kind": "return", "value": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "a" }, "right": { "kind": "var", "name": "b" } } }
  ]
}
```

## **11.2 Function Call** {#11.2-function-call}

```json
{ 
  "kind": "call", 
  "callee": "sum", 
  "args": [ { "kind": "literal", "value": 3 }, { "kind": "literal", "value": 4 } ] 
}
```

# **12\. Structs** {#12.-structs}

```json
{ 
  "kind": "newStruct", 
  "struct": "Point",
  "fields": [
    { "name": "x", "value": { "kind": "literal", "value": 3 } },
    { "name": "y", "value": { "kind": "literal", "value": 7 } }
  ] 
}
```

# **13\. Print / Serial** {#13.-print-serial}

```json
{ 
  "kind": "print", 
  "args": [ { "kind": "var", "name": "value" } ], 
  "newline": true 
}
```

## **13.2 Serial Communication** {#13.2-serial-communication}

```json
{ "kind": "serialBegin", "baud": { "kind": "literal", "value": 9600 } }
{ "kind": "serialAvailable" }
{ "kind": "serialReadString" }
```

# **14\. Expressions** {#14.-expressions}

## **14.1 Literal** {#14.1-literal}

```json
{ "kind": "literal", "value": 42 }
{ "kind": "literal", "value": 3.14 }
{ "kind": "literal", "value": true } 
{ "kind": "literal", "value": "hello" }
{ "kind": "literal", "value": null }
```

## **14.9 Advanced Expressions (NEW in v1.2)** {#14.9-advanced-expressions-new-in-v1.2}

| Kind | Description | Example |
| :--- | :--- | :--- |
| `millis` | MS since start | `{ "kind": "millis" }` |
| `micros` | US since start | `{ "kind": "micros" }` |
| `arrayLength` | Length of target | `{ "kind": "arrayLength", "target": { "kind": "var", "name": "arr" } }` |
| `postfixInc` | i++ | `{ "kind": "postfixInc", "name": "i" }` |
| `postfixDec` | i-- | `{ "kind": "postfixDec", "name": "i" }` |
| `object` | Object literal | `{ "kind": "object", "fields": [...] }` |

# **15\. Math — Built-in Functions** {#15.-math-—-built-in-functions}

| { "kind": "cast", "targetType": "int", "expr": { "kind": "var", "name": "x" } } |  |
| ----- | ----- |
| **Language** | **Syntax** |
| C++ | (int)x / static\_cast\<int\>(x) |
| MicroPython | int(x) / float(x) |
| Rust | x as i32 |
| IEC 61131-3 ST | INT\_TO\_REAL(x) / REAL\_TO\_INT(x) |

*Table 20: Type Cast by Language*

## **14.7 Member Access** {#14.7-member-access}

| { "kind": "member", "target": { "kind": "var", "name": "point" }, "property": "x" } |
| :---- |

## **14.8 Compound Expressions** {#14.8-compound-expressions}

ASL supports nested and compound expressions. The following patterns are normalized into canonical ASL forms:

| // Array element access: { "kind": "index", "target": { "kind": "var", "name": "arr" }, "index": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "base" }, "right": { "kind": "literal", "value": 1 } } }   // Struct member of array element: { "kind": "member", "target": { "kind": "index", "target": { "kind": "var", "name": "points" }, "index": { "kind": "literal", "value": 0 } }, "property": "x" }   // Chained binary: { "kind": "binary", "op": "+",   "left": { "kind": "binary", "op": "\*", "left": { "kind": "var", "name": "a" }, "right": { "kind": "literal", "value": 2 } },   "right": { "kind": "literal", "value": 3 } } // Represents: (a \* 2\) \+ 3 |
| :---- |

# **15\. Math — Built-in Functions** {#15.-math-—-built-in-functions}

All mathematical functions are represented as call expressions with a canonical callee name. The following tables provide complete mappings for all four target languages.

## **15.1 Core, Trigonometric, and Logarithmic Functions** {#15.1-core,-trigonometric,-and-logarithmic-functions}

| ASL Function | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- |
| abs(x) | abs(x) | abs(x) | x.abs() | ABS(x) |
| sqrt(x) | sqrt(x) | math.sqrt(x) | f32::sqrt(x) | SQRT(x) |
| pow(x, n) | pow(x, n) | x\*\*n / math.pow(x,n) | f32::powi(x, n) | EXPT(x, n) |
| floor(x) | floor(x) | math.floor(x) | x.floor() | FLOOR(x) |
| ceil(x) | ceil(x) | math.ceil(x) | x.ceil() | CEIL(x) |
| round(x) | round(x) | round(x) | x.round() | ROUND(x) |
| min(a, b) | min(a, b) | min(a, b) | a.min(b) | MIN(a, b) |
| max(a, b) | max(a, b) | max(a, b) | a.max(b) | MAX(a, b) |
| sin(x) | sin(x) | math.sin(x) | f32::sin(x) | SIN(x) |
| cos(x) | cos(x) | math.cos(x) | f32::cos(x) | COS(x) |
| tan(x) | tan(x) | math.tan(x) | f32::tan(x) | TAN(x) |
| asin(x) | asin(x) | math.asin(x) | f32::asin(x) | ASIN(x) |
| acos(x) | acos(x) | math.acos(x) | f32::acos(x) | ACOS(x) |
| atan(x) | atan(x) | math.atan(x) | f32::atan(x) | ATAN(x) |
| atan2(y, x) | atan2(y, x) | math.atan2(y, x) | f32::atan2(y, x) | ATAN2(y, x) |
| log(x) | log(x) | math.log(x) | f32::ln(x) | LN(x) |
| log10(x) | log10(x) | math.log10(x) | f32::log10(x) | LOG(x) |
| log2(x) | log2(x) | math.log2(x) | f32::log2(x) | LOG2(x) |

*Table 21: Core, Trigonometric, and Logarithmic Functions*

## **15.2 Embedded Utilities and Bit Manipulation** {#15.2-embedded-utilities-and-bit-manipulation}

| ASL Function | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- |
| constrain(x, a, b) | constrain(x, a, b) | max(a, min(b, x)) | x.clamp(a, b) | (inline) |
| map(val, a, b, c, d) | (inline formula) | (inline formula) | (inline formula) | (inline formula) |
| random() | random() | random.random() | (rand crate) | (inline) |
| randomSeed(s) | randomSeed(s) | random.seed(s) | (rand crate) | (inline) |
| pulseIn(pin, val) | pulseIn(pin, val) | machine.time\_pulse\_us(pin, val) | (embassy crate) | (inline) |
| tone(pin, freq) | tone(pin, freq) | (PWM freq set) | (PWM set) | (inline) |
| noTone(pin) | noTone(pin) | (PWM stop) | (PWM stop) | (inline) |
| bitSet(x, n) | x |= (1 \<\< n) | x | (1 \<\< n) | x | (1 \<\< n) | x OR SHL(1, n) |
| bitClear(x, n) | x &= \~(1 \<\< n) | x & \~(1 \<\< n) | x & \!(1 \<\< n) | x AND SHL(NOT(1), n) |
| bitRead(x, n) | (x \>\> n) & 1 | (x \>\> n) & 1 | (x \>\> n) & 1 | SHR(x, n) AND 1 |
| bitWrite(x, n, b) | (inline) | (inline) | (inline) | (inline) |
| highByte(x) | (x \>\> 8\) & 0xFF | (x \>\> 8\) & 0xFF | (x \>\> 8\) & 0xFF | SHR(x, 8\) AND 16\#FF |
| lowByte(x) | x & 0xFF | x & 0xFF | x & 0xFF | x AND 16\#FF |

*Table 22: Embedded Utilities and Bit Manipulation*

## **15.3 Mathematical Constants** {#15.3-mathematical-constants}

Constants are accessed as variable references. Generators emit the appropriate literal or symbol:

| { "kind": "var", "name": "PI" }   // C++: M\_PI | Python: math.pi | Rust: core::f32::consts::PI | ST: 3.14159 { "kind": "var", "name": "E" }    // Euler's number { "kind": "var", "name": "PHI" }  // Golden ratio (1.618...) |
| :---- |

# **16\. Strings** {#16.-strings}

String operations in ASL provide a cross-language abstraction for common text manipulations. The following table lists all supported string operations with their canonical ASL representation and per-language mappings.

| Operation | ASL Kind / Syntax | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Length | call stringLength | s.length() | len(s) | s.len() | LEN(s) |
| Concatenation | binary op "+" | s1 \+ s2 | s1 \+ s2 | s1 \+ s2 | CONCAT(s1, s2) |
| Substring | call stringSubstring | s.substr(pos, len) | s\[pos:pos+len\] | \&s\[pos..pos+len\] | MID(s, pos, len) |
| Index Of | call stringIndexOf | s.find(sub) | s.find(sub) | s.find(sub) | FIND(s, sub) |
| Compare | call stringCompare | s1.compare(s2) | s1 \== s2 | s1.cmp(\&s2) | strcmp(s1, s2) |
| Split | call stringSplit | (manual loop) | s.split(delim) | s.split(delim) | (manual) |
| Trim | call stringTrim | (manual) | s.strip() | s.trim() | (manual) |
| Upper Case | call stringUpper | (transform) | s.upper() | s.to\_uppercase() | UPPER(s) |
| Lower Case | call stringLower | (transform) | s.lower() | s.to\_lowercase() | LOWER(s) |
| Format | call stringFormat | sprintf(buf, fmt, ...) | fmt % vals | format\!(...) | (concat) |
| Cast to String | cast string | String(x) / to\_string(x) | str(x) | x.to\_string() | INT\_TO\_STRING(x) |
| Cast to Int | cast int | stoi(s) | int(s) | s.parse::\<i32\>() | STRING\_TO\_INT(s) |
| Cast to Float | cast float | stof(s) | float(s) | s.parse::\<f32\>() | STRING\_TO\_REAL(s) |

*Table 23: String Operations*

| // String length: { "kind": "stringLength", "target": { "kind": "var", "name": "msg" } }   // Concatenation (binary with \+): { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "name" }, "right": { "kind": "literal", "value": "\!" } }   // Cast to string: { "kind": "cast", "targetType": "string", "expr": { "kind": "var", "name": "val" } }   // Cast from string to int: { "kind": "cast", "targetType": "int", "expr": { "kind": "var", "name": "s" } } |
| :---- |

# **17\. Comments** {#17.-comments}

Comments are preserved as inline statements and can be single-line or block:

| // Single-line comment: { "kind": "comment", "text": "Turn on LED", "block": false }   // Block comment: { "kind": "comment", "text": "Initialization block", "block": true } |
| :---- |

Functions and structs also support a "doc" field for documentation:

| { "name": "sum", "doc": "Returns the sum of a and b", "params": \[...\], "body": \[...\] } |
| :---- |

# **18\. IEC 61131-3 Timers** {#18.-iec-61131-3-timers}

All preset times (pt) use the structured duration kind (Section 7.1). Generators emit idiomatic time literals: ST → T\#500ms, C++ → delay(500) equivalent, Rust → Duration::from\_millis(500).

## **18.1 TON — Timer On Delay** {#18.1-ton-—-timer-on-delay}

| {   "kind":    "timerTON",   "instance": "T1",   "in":  { "kind": "var", "name": "button" },   "pt":  { "kind": "duration", "days": 0, "hours": 0, "minutes": 0,            "seconds": 0, "milliseconds": 500, "microseconds": 0 },   "outQ":  "T1\_Q",   "outET": "T1\_ET" } |
| :---- |

## **18.2 TOF — Timer Off Delay** {#18.2-tof-—-timer-off-delay}

| {   "kind":    "timerTOF",   "instance": "T2",   "in":  { "kind": "var", "name": "sensor" },   "pt":  { "kind": "duration", "days": 0, "hours": 0, "minutes": 0,            "seconds": 1, "milliseconds": 0, "microseconds": 0 },   "outQ":  "T2\_Q",   "outET": "T2\_ET" } |
| :---- |

## **18.3 TP — Timer Pulse** {#18.3-tp-—-timer-pulse}

| {   "kind":    "timerTP",   "instance": "T3",   "in":  { "kind": "var", "name": "trigger" },   "pt":  { "kind": "duration", "days": 0, "hours": 0, "minutes": 0,            "seconds": 0, "milliseconds": 200, "microseconds": 0 },   "outQ":  "T3\_Q",   "outET": "T3\_ET" } |
| :---- |

## **18.4 Timer Comparison** {#18.4-timer-comparison}

| Timer | Behavior | IN=TRUE triggers | IN=FALSE resets |
| ----- | ----- | ----- | ----- |
| TON | Output Q goes TRUE after PT elapsed while IN is TRUE | Starts timing | Resets Q and ET |
| TOF | Output Q stays TRUE for PT after IN goes FALSE | Sets Q immediately | Starts timing, Q goes FALSE after PT |
| TP | Output Q pulses TRUE for PT when IN rises | Generates pulse of PT | No effect during pulse |

*Table 24: IEC Timer Behavior Comparison*

# **19\. IEC 61131-3 Counters** {#19.-iec-61131-3-counters}

## **19.1 CTU — Count Up** {#19.1-ctu-—-count-up}

| {   "kind": "counterCTU",   "instance": "C1",   "cu": { "kind": "var", "name": "button" },   "r": { "kind": "var", "name": "reset" },   "pv": { "kind": "literal", "value": 10 },   "outQ": "C1\_Q",   "outCV": "C1\_CV" } |
| :---- |

## **19.2 CTD — Count Down** {#19.2-ctd-—-count-down}

| {   "kind": "counterCTD",   "instance": "C2",   "cd": { "kind": "var", "name": "pulse" },   "ld": { "kind": "var", "name": "load" },   "pv": { "kind": "literal", "value": 5 },   "outQ": "C2\_Q",   "outCV": "C2\_CV" } |
| :---- |

## **19.3 CTUD — Count Up/Down** {#19.3-ctud-—-count-up/down}

| {   "kind": "counterCTUD",   "instance": "C3",   "cu": { "kind": "var", "name": "upBtn" },   "cd": { "kind": "var", "name": "dnBtn" },   "r": { "kind": "var", "name": "reset" },   "ld": { "kind": "var", "name": "load" },   "pv": { "kind": "literal", "value": 100 },   "outQ": "C3\_Q",   "outCV": "C3\_CV" } |
| :---- |

## **19.4 Counter Comparison** {#19.4-counter-comparison}

| Counter | Increment | Decrement | Reset/Load | Q Output |
| ----- | ----- | ----- | ----- | ----- |
| CTU | CU rising edge | (none) | R resets CV to 0 | CV \>= PV |
| CTD | (none) | CD rising edge | LD loads CV \= PV | CV \<= PV |
| CTUD | CU rising edge | CD rising edge | R resets, LD loads | CV \>= PV |

*Table 25: IEC Counter Behavior Comparison*

# **20\. IEC Latches and Triggers** {#20.-iec-latches-and-triggers}

## **20.1 Latches (SR / RS)** {#20.1-latches-(sr-/-rs)}

| // SR Latch (Set dominant): { "kind": "latchSR", "instance": "L1", "s": { "kind": "var", "name": "set" }, "r": { "kind": "var", "name": "reset" }, "outQ": "L1\_Q" }   // RS Latch (Reset dominant): { "kind": "latchRS", "instance": "L2", "s": { "kind": "var", "name": "set" }, "r": { "kind": "var", "name": "reset" }, "outQ": "L2\_Q" } |
| :---- |

## **20.2 Edge Detection Triggers (R\_TRIG / F\_TRIG)** {#20.2-edge-detection-triggers-(r_trig-/-f_trig)}

| // Rising edge detection: { "kind": "trigR", "instance": "TR1", "in": { "kind": "var", "name": "button" }, "outQ": "TR1\_Q" }   // Falling edge detection: { "kind": "trigF", "instance": "TF1", "in": { "kind": "var", "name": "button" }, "outQ": "TF1\_Q" } |
| :---- |

# **21\. PWM** {#21.-pwm}

| // Initialize PWM: { "kind": "pwmInit", "pin": { "kind": "literal", "value": 9 }, "freq": { "kind": "literal", "value": 1000 }, "duty": { "kind": "literal", "value": 0 } }   // Set duty cycle: { "kind": "pwmSetDuty", "pin": { "kind": "literal", "value": 9 }, "duty": { "kind": "literal", "value": 128 } }   // Set frequency: { "kind": "pwmSetFreq", "pin": { "kind": "literal", "value": 9 }, "freq": { "kind": "literal", "value": 500 } }   // Stop PWM: { "kind": "pwmStop", "pin": { "kind": "literal", "value": 9 } } |
| :---- |

# **22\. Communication** {#22.-communication}

## **22.1 I2C** {#22.1-i2c}

| // I2C Write: { "kind": "i2cWrite", "bus": { "kind": "literal", "value": 0 }, "address": { "kind": "literal", "value": 60 }, "data": { "kind": "var", "name": "payload" } }   // I2C Read: { "kind": "i2cRead", "bus": { "kind": "literal", "value": 0 }, "address": { "kind": "literal", "value": 60 }, "length": { "kind": "literal", "value": 2 }, "target": "result" } |
| :---- |

## **22.2 SPI** {#22.2-spi}

| { "kind": "spiTransfer", "bus": { "kind": "literal", "value": 0 }, "csPin": { "kind": "literal", "value": 10 }, "txData": { "kind": "var", "name": "cmd" }, "target": "response" } |
| :---- |

## **22.3 UART** {#22.3-uart}

| // UART Write: { "kind": "uartWrite", "port": { "kind": "literal", "value": 0 }, "data": { "kind": "var", "name": "msg" } }   // UART Read: { "kind": "uartRead", "port": { "kind": "literal", "value": 0 }, "length": { "kind": "literal", "value": 64 }, "target": "buffer" } |
| :---- |

## **22.4 Modbus (NEW in v1.2)** {#22.4-modbus-(new-in-v1.2)}

Modbus is the most widely used industrial communication protocol, present in PLCs, variable frequency drives, remote I/O modules, and instrumentation. ASL v1.2 introduces native Modbus operations to faithfully represent industrial programs.

| Operation | ASL Kind | Key Fields | Description |
| ----- | ----- | ----- | ----- |
| Read Holding Registers | modbusReadHoldingRegisters | unitId, address, quantity, target | Function code 03: Read from server holding registers |
| Read Input Registers | modbusReadInputRegisters | unitId, address, quantity, target | Function code 04: Read from server input registers |
| Write Single Register | modbusWriteSingleRegister | unitId, address, value | Function code 06: Write to a single holding register |
| Write Multiple Registers | modbusWriteMultipleRegisters | unitId, address, data | Function code 16: Write to multiple holding registers |
| Read Coils | modbusReadCoils | unitId, address, quantity, target | Function code 01: Read coils (discrete outputs) |
| Write Single Coil | modbusWriteSingleCoil | unitId, address, value | Function code 05: Write a single coil |

*Table 26: Modbus Operations*

Example schema for reading holding registers:

| {   "kind": "modbusReadHoldingRegisters",   "unitId": { "kind": "literal", "value": 1 },   "address": { "kind": "literal", "value": 40001 },   "quantity": { "kind": "literal", "value": 10 },   "target": "registerData" } |  |
| ----- | ----- |
| **Target** | **Library / Approach** |
| C++/Arduino | ModbusMaster library (e.g., node/ModbusMaster) |
| MicroPython | umodbus / micropython-modbus |
| Rust Embassy | modbus-rs / embassy-modbus crate |
| IEC 61131-3 ST | Modbus Function Block (vendor-specific) |

*Table 27: Modbus Library Mappings*

# **23\. Servo** {#23.-servo}

| // Attach servo: { "kind": "servoAttach", "varName": "s1", "pin": { "kind": "literal", "value": 9 }, "minPulse": null, "maxPulse": null }   // Write angle: { "kind": "servoWrite", "varName": "s1", "angle": { "kind": "literal", "value": 90 } }   // Detach: { "kind": "servoDetach", "varName": "s1" } |
| :---- |

# **24\. RGB / NeoPixel** {#24.-rgb-/-neopixel}

| {   "kind": "rgbSet",   "pinR": { "kind": "literal", "value": 9 },   "pinG": { "kind": "literal", "value": 10 },   "pinB": { "kind": "literal", "value": 11 },   "r": { "kind": "literal", "value": 255 },   "g": { "kind": "literal", "value": 0 },   "b": { "kind": "literal", "value": 0 } } |
| :---- |

# **25\. Async Tasks** {#25.-async-tasks}

Asynchronous tasks enable concurrent execution. Tasks are defined with isAsync: true and may include priority and stack size hints:

| {   "name": "sensorTask",   "isAsync": true,   "priority": null,   "stackSize": null,   "params": \[\],   "returnType": "void",   "body": \[ ... statements ... \] } |  |
| ----- | ----- |
| **Language** | **Approach** |
| C++/Arduino | Simulated with millis() or FreeRTOS tasks |
| MicroPython | async def task(): await asyncio.sleep\_ms(100) |
| Rust Embassy | \#\[embassy\_executor::task\] async fn task() { ... } |
| IEC 61131-3 ST | PROGRAM with cyclic timer |

*Table 28: Async Task Approach by Language*

# **26\. Interrupts** {#26.-interrupts}

## **26.1 attachInterrupt** {#26.1-attachinterrupt}

| { "kind": "attachInterrupt", "pin": { "kind": "literal", "value": 2 }, "handler": "onButton", "trigger": "RISING" } |
| :---- |

Valid trigger values: "RISING", "FALLING", "CHANGE", "LOW", "HIGH".

## **26.2 timerInterrupt** {#26.2-timerinterrupt}

| { "kind": "timerInterrupt", "periodMs": { "kind": "literal", "value": 10 }, "handler": "onTimer" } |
| :---- |

# **27\. Concurrency and Synchronization (NEW in v1.2)** {#27.-concurrency-and-synchronization-(new-in-v1.2)}

Multi-task systems require synchronization primitives for safe inter-task communication. ASL v1.2 introduces kinds for mutex, queue, semaphore, and event group operations, mapping to FreeRTOS, Embassy, and ST environments.

## **27.1 Mutex** {#27.1-mutex}

| // Lock: { "kind": "mutexLock", "mutexName": "sharedMutex" }   // Unlock: { "kind": "mutexUnlock", "mutexName": "sharedMutex" } |
| :---- |

## **27.2 Queue** {#27.2-queue}

| // Send: { "kind": "queueSend", "queueName": "dataQueue", "value": { "kind": "var", "name": "sensorData" } }   // Receive: { "kind": "queueReceive", "queueName": "dataQueue", "target": "receivedData" } |
| :---- |

## **27.3 Semaphore** {#27.3-semaphore}

| // Give (release): { "kind": "semaphoreGive", "semaphoreName": "dataReady" }   // Take (acquire): { "kind": "semaphoreTake", "semaphoreName": "dataReady" } |
| :---- |

## **27.4 Event Group** {#27.4-event-group}

| // Set bits: { "kind": "eventGroupSetBits", "group": "systemEvents", "bits": { "kind": "literal", "value": 1 } }   // Wait bits: { "kind": "eventGroupWaitBits", "group": "systemEvents", "bits": { "kind": "literal", "value": 1 }, "target": "received" } |
| :---- |

## **27.5 Synchronization Primitives Overview** {#27.5-synchronization-primitives-overview}

| Primitive | ASL Kinds | Description |
| ----- | ----- | ----- |
| Mutex | mutexLock, mutexUnlock | Exclusive lock for protecting shared resources |
| Queue | queueSend, queueReceive | FIFO message passing between tasks |
| Semaphore | semaphoreGive, semaphoreTake | Signaling mechanism (counting or binary) |
| Event Group | eventGroupSetBits, eventGroupWaitBits | Multi-bit flags for complex event coordination |

*Table 29: Synchronization Primitives*

| Primitive | C++ (FreeRTOS) | MicroPython | Rust (Embassy) | ST |
| ----- | ----- | ----- | ----- | ----- |
| Mutex | xSemaphoreCreateMutex() | (threading.Lock) | embassy\_sync::Mutex | (vendor FB) |
| Queue | xQueueCreate() / xQueueSend() | (queue.Queue) | embassy\_sync::Channel | (vendor FB) |
| Semaphore | xSemaphoreCreateCounting() | (threading.Semaphore) | embassy\_sync::Signal | (vendor FB) |
| Event Group | xEventGroupCreate() | (manual flags) | (manual flags) | (vendor FB) |

*Table 30: Synchronization Library Mappings*

# **28\. Industrial Sensors — sensorRead** {#28.-industrial-sensors-—-sensorread}

The sensorRead kind provides a unified interface for reading industrial sensor values with signal type classification, linear interpolation, and fault detection.

| {   "kind": "sensorRead",   "name": "temperature",   "pin": { "kind": "literal", "value": 0 },   "signalType": "analog",   "rangeMin": 0,   "rangeMax": 1023,   "unitMin": \-40,   "unitMax": 125,   "unit": "C",   "interpolation": "linear",   "target": "tempValue",   "faultDetect": { "threshold": 3, "mode": "outOfRange" } } |
| :---- |

Signal types: "analog" (ADC), "digital" (0/1), "pulse" (frequency/PWM). Interpolation modes: "linear", "none", "lookup".

# **29\. Energy Management** {#29.-energy-management}

## **29.1 sleepMode** {#29.1-sleepmode}

| { "kind": "sleepMode", "mode": "DEEP\_SLEEP", "duration": { "kind": "literal", "value": 5000 } } |
| :---- |

Modes: "IDLE", "LIGHT\_SLEEP", "DEEP\_SLEEP".

## **29.2 watchdogTimer** {#29.2-watchdogtimer}

| { "kind": "watchdogTimer", "timeout": { "kind": "literal", "value": 8000 }, "enable": true } |
| :---- |

# **30\. Persistent Storage** {#30.-persistent-storage}

Persistent storage operations provide explicit read/write/commit semantics for EEPROM or Flash storage:

| { "kind": "storageWrite", "address": { "kind": "literal", "value": 0 }, "data": { "kind": "var", "name": "configData" } } { "kind": "storageRead", "address": { "kind": "literal", "value": 0 }, "length": { "kind": "literal", "value": 64 }, "target": "configData" } { "kind": "storageCommit" } |
| :---- |

# **31\. Network Communication** {#31.-network-communication}

## **31.1 WiFi** {#31.1-wifi}

| { "kind": "wifiConnect", "ssid": { "kind": "literal", "value": "MyNetwork" }, "password": { "kind": "literal", "value": "secret" } } { "kind": "wifiDisconnect" } { "kind": "wifiStatus", "target": "status" } |
| :---- |

## **31.2 MQTT** {#31.2-mqtt}

| { "kind": "mqttConnect", "broker": { "kind": "literal", "value": "broker.hivemq.com" }, "port": { "kind": "literal", "value": 1883 } } { "kind": "mqttSubscribe", "topic": { "kind": "literal", "value": "sensor/data" } } { "kind": "mqttPublish", "topic": { "kind": "literal", "value": "sensor/data" }, "payload": { "kind": "var", "name": "data" } } { "kind": "mqttDisconnect" } |
| :---- |

## **31.3 HTTP** {#31.3-http}

| { "kind": "httpGet", "url": { "kind": "literal", "value": "http://api.example.com/data" }, "target": "response" } { "kind": "httpPost", "url": { "kind": "literal", "value": "http://api.example.com/data" }, "body": { "kind": "var", "name": "payload" }, "target": "response" } |
| :---- |

# **32\. Displays** {#32.-displays}

| // LCD: { "kind": "lcdInit", "address": { "kind": "literal", "value": 39 }, "cols": 16, "rows": 2 } { "kind": "lcdPrint", "col": 0, "row": 0, "text": { "kind": "literal", "value": "Hello World" } } { "kind": "lcdClear" } { "kind": "lcdSetCursor", "col": 0, "row": 1 }   // OLED (SSD1306): { "kind": "oledInit", "width": 128, "height": 64, "address": { "kind": "literal", "value": 60 } } { "kind": "oledDrawText", "x": 0, "y": 0, "text": { "kind": "literal", "value": "ASL v1.2" } } { "kind": "oledDisplay" } { "kind": "oledClear" } |
| :---- |

# **33\. SFC — State Machines** {#33.-sfc--state-machines}

State Machines in ASL represent Sequential Function Charts (SFC) or Finite State Machines (FSM).

```json
{
  "kind": "stateMachine",
  "name": "HeaterControl",
  "stateVar": "currentState",
  "initialStep": "IDLE",
  "steps": [
    {
      "name": "IDLE",
      "actions": [
        { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 }, "value": { "kind": "literal", "value": false } }
      ],
      "transitions": [
        {
          "condition": { "kind": "var", "name": "startButton" },
          "targetStep": "HEATING",
          "priority": 1
        }
      ]
    },
    {
      "name": "HEATING",
      "actions": [
        { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 }, "value": { "kind": "literal", "value": true } }
      ],
      "transitions": [
        {
          "condition": { "kind": "binary", "op": ">", "left": { "kind": "var", "name": "temp" }, "right": { "kind": "literal", "value": 100 } },
          "targetStep": "IDLE"
        }
      ]
    }
  ]
}
```

# **34\. Logging (NEW in v1.2)** {#34.-logging}

Logging provides standardized diagnostic messages.

```json
{
  "kind": "log",
  "message": { "kind": "literal", "value": "System initialized" },
  "level": "INFO"
}
```

| Level | Description | Mapping |
| :--- | :--- | :--- |
| `DEBUG` | Verbose debug info | `Serial.print` (C++), `logging.debug` (Py) |
| `INFO` | General information | `Serial.print` (C++), `logging.info` (Py) |
| `WARN` | Potential issues | `Serial.print` (C++), `logging.warning` (Py) |
| `ERROR` | Critical failures | `Serial.print` (C++), `logging.error` (Py) |

| Note: print is for basic debug output during development; log is for structured, level-filtered logging in production systems. Generators may compile log statements to no-ops when level filtering is applied. |
| :---- |

# **35\. Testing and Simulation (NEW in v1.2)** {#35.-testing-and-simulation}

## **35.1 assert** {#35.1-assert}

```json
{
  "kind": "assert",
  "condition": { "kind": "binary", "op": "==", "left": { "kind": "var", "name": "x" }, "right": { "kind": "literal", "value": 10 } },
  "message": "x must be 10"
}
```

## **35.2 simProbe** {#35.2-simprobe}

Exposes internal values to simulation tools.

```json
{
  "kind": "simProbe",
  "name": "internalPressure",
  "value": { "kind": "var", "name": "p" }
}
```

# **36\. Common Algorithms** {#36.-common-algorithms}

## **36.1 Arithmetic Mean** {#36.1-arithmetic-mean}

```json
{ 
  "kind": "declare", 
  "name": "mean", 
  "type": "float", 
  "value": { 
    "kind": "binary", "op": "/", 
    "left": { 
      "kind": "binary", "op": "+", "left": { "kind": "var", "name": "a" }, "right": { "kind": "var", "name": "b" } 
    }, 
    "right": { "kind": "literal", "value": 2 } 
  } 
}
```

# **37\. Complete Example — Blink** {#37.-complete-example-blink}

```json
{
  "kind": "task",
  "name": "loop",
  "body": [
    { 
      "kind": "digitalOutput", 
      "pin": { "kind": "literal", "value": 13 }, 
      "value": { "kind": "literal", "value": true } 
    },
    { "kind": "delay", "duration": { "kind": "duration", "milliseconds": 500 } },
    { 
      "kind": "digitalOutput", 
      "pin": { "kind": "literal", "value": 13 }, 
      "value": { "kind": "literal", "value": false } 
    },
    { "kind": "delay", "duration": { "kind": "duration", "milliseconds": 500 } }
  ]
}

# **Appendix A: Operator Precedence** {#appendix-a-operator-precedence}

| Precedence | ASL |
| :--- | :--- |
| 1 (highest) | `() . []` |
| 2 | `! ~ - + (unary)` |
| 3 | `* / % //` |
| 4 | `+ -` |
| 5 | `<< >>` |
| 6 | `&` |
| 7 | `^` |
| 8 | `|` |
| 9 | `< <= > >=` |
| 10 | `== !=` |
| 11 | `&&` |
| 12 (lowest) | `||` |