  
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

| \# | Rule | Description |
| ----- | ----- | ----- |
| 1 | Semantic names, never API names. | digitalOutput, not digitalWrite. delay, not \_sleep. The name describes what, not how the source language writes it. |
| 2 | Simple camelCase names for compound terms. | forRange, elseIf, thenBody, pinMode. |
| 3 | kind is the discriminant key. | Every statement and expression uses the "kind" field as its discriminator. |
| 4 | Numeric values, never named constants. | HIGH / True / set\_high() / TRUE all map to { "kind": "literal", "value": 1 }. LOW / False / set\_low() / FALSE map to { "kind": "literal", "value": 0 }. |
| 5 | Operators as direct symbols. | "op": "+", "op": "\>", "op": "&&". Never "op": "add". |
| 6 | Explicit includes and dependencies. | As of v1.2, libraries and includes are represented in an optional "includes" array at the root level. The generator may still infer implicit dependencies from kinds present, but explicit declarations take precedence. |
| 7 | Every program has setup and loop in tasks. | If the language does not distinguish them explicitly, the parser separates them by heuristic (code before the infinite loop \= setup). |
| 8 | Comments preserved as inline statements. | Functions and structs have an optional "doc" field for documentation. |

*Table 1: Fundamental Rules*

# **2\. Root Structure — AslProgram** {#2.-root-structure-—-aslprogram}

Every ASL program is a single JSON object representing the root node. The following schema defines the top-level fields:

| {   "asl\_version": "4.0.0",   "metadata": { "name": "Blink", "description": null, "version": null, "targetBoard": null },   "includes": \[\],   "structs": \[\],   "enums": \[\],   "globals": \[\],   "functions": \[\],   "functionBlocks": \[\],   "tasks": \[     { "name": "setup", "body": \[...\] },     { "name": "loop",  "body": \[...\] }   \] } |
| :---- |

## **2.1 Field Descriptions** {#2.1-field-descriptions}

| Field | Type | Required | Description |
| ----- | ----- | ----- | ----- |
| asl\_version | string | Yes | Version of the ASL specification (e.g., "4.0.0") |
| metadata | object | Yes | Program metadata: name, description, version, targetBoard. Fields are null if omitted. |
| includes | array | No | Explicit library/include dependencies. Each entry is a string identifier. |
| structs | array | Yes | Type definitions (composite structs). May be empty. |
| enums | array | No | Enumeration type definitions. Each entry has name, doc, and variants. May be empty. |
| globals | array | Yes | Global variable declarations. May be empty. |
| functions | array | Yes | User-defined pure functions (stateless, with params, returnType, body). May be empty. |
| functionBlocks | array | No | IEC Function Block definitions (stateful, with inputs, outputs, internals, body). May be empty. |

*Table 2: AslProgram Field Descriptions*

## **2.2 Includes and Library Dependencies** {#2.2-includes-and-library-dependencies}

The optional "includes" array allows explicit declaration of library dependencies. Coexistence rules:

**Coexistence Rule:** If both explicit includes and implicit inference are present, explicit declarations take precedence. Generators should emit \#include/import/use statements for declared libraries first, then append any inferred dependencies.

| Include ID | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- |
| "wire" | \#include \<Wire.h\> | import machine | use embassy\_stm32::i2c | USE\_LIB WIRE |
| "spi" | \#include \<SPI.h\> | import spi | use embassy\_stm32::spi | USE\_LIB SPI |
| "servo" | \#include \<Servo.h\> | import servo | use servo::Servo | FB\_SERVO |
| "mqtt" | \#include \<PubSubClient.h\> | import umqtt.simple | use embassy\_net::mqtt | USE\_LIB MQTT |
| "wifi" | \#include \<WiFi.h\> | import network | use embassy\_net | USE\_LIB WIFI |
| "modbus" | \#include \<ModbusMaster.h\> | import umodbus | use modbus::ModbusClient | USE\_LIB MODBUS |

*Table 3: Common Library Mappings*

## **2.3 Task Structure** {#2.3-task-structure}

Tasks represent the main execution units. Each task is an object with a name and body array of statements. The setup task runs once at startup; the loop task runs continuously.

| {   "name": "setup",   "isAsync": false,   "priority": null,   "stackSize": null,   "params": \[\],   "returnType": "void",   "body": \[ ... statements ... \] } |
| :---- |

# **3\. Type System — AslType** {#3.-type-system-—-asltype}

ASL defines a comprehensive type system that maps to all four target languages. Types are used in declarations, function parameters, return types, and cast expressions.

## **3.1 Integer Types** {#3.1-integer-types}

Explicit-width integer types guarantee consistent bit-width across all targets:

| ASL Type | C++ | MicroPython | Rust | ST (IEC 61131-3) |
| ----- | ----- | ----- | ----- | ----- |
| sint8 | int8\_t | int (range-clamped) | i8 | SINT |
| int16 | int16\_t | int (range-clamped) | i16 | INT |
| int32 | int32\_t | int | i32 | DINT |
| int64 | int64\_t | int | i64 | LINT |
| uint8 | uint8\_t | int (range-clamped) | u8 | USINT |
| uint16 | uint16\_t | int (range-clamped) | u16 | UINT |
| uint32 | uint32\_t | int | u32 | UDINT |
| uint64 | uint64\_t | int | u64 | ULINT |

*Table 4: Integer Types — Explicit Width*

## **3.2 Generic Integer Aliases** {#3.2-generic-integer-aliases}

The following aliases are provided for convenience. They map to their explicit-width equivalents:

| Alias | Equivalent | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| int | int32 | int | int | i32 | DINT |
| uint | uint32 | unsigned int | int | u32 | UDINT |
| short | int16 | short / int16\_t | int | i16 | INT |
| long | int64 | long long / int64\_t | int | i64 | LINT |
| byte | uint8 | byte / uint8\_t | int | u8 | BYTE |

*Table 5: Generic Integer Aliases*

| Note: Recommendation: For ST targets, prefer explicit-width types (int32, uint16, etc.) to ensure consistent data sizing. Generic aliases may map to platform-dependent widths in C++ and Python. |
| :---- |

## **3.3 Float, Logic, Character, String, and Void Types** {#3.3-float,-logic,-character,-string,-and-void-types}

| ASL Type | Description | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| float | 32-bit floating point | float | float | f32 | REAL |
| double | 64-bit floating point | double | float | f64 | LREAL |
| bool | Boolean | bool | bool | bool | BOOL |
| char | Single character | char | str (1 char) | char | CHAR / WCHAR |
| string | String | String / char\* | str | String / \&str | STRING |
| void | No return | void | None | () | (none) |
| auto | Type inference | (N/A) | (inferred) | (inferred) | (N/A) |

*Table 6: Float, Logic, Character, String, and Void Types*

## **3.4 Composite and Special Types** {#3.4-composite-and-special-types}

| ASL Type | Description | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| array | Fixed-size array | std::array / T\[\] | list / array | \[T; N\] | ARRAY \[a..b\] OF T |
| struct | Composite structure | struct | class | struct | STRUCT ... END\_STRUCT |
| enum | Enumeration | enum | Enum class | enum | TYPE ... : (val1, val2); END\_TYPE |
| option | Nullable value | std::optional\<T\> | Optional / None | Option\<T\> | (inlined via NULL) |

*Table 7: Composite and Special Types*

## **3.5 IEC Time and Date Types (NEW in v1.2)** {#3.5-iec-time-and-date-types-(new-in-v1.2)}

IEC 61131-3 defines several time-related types for industrial applications. ASL v1.2 introduces native support for these types to improve fidelity when transpiling to and from Structured Text.

| ASL Type | Description | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| time | Duration (ms precision) | uint64\_t (ms) | timedelta | core::time::Duration | TIME / LTIME |
| date | Calendar date | struct tm | datetime.date | chrono::NaiveDate | DATE / LDATE |
| timeOfDay | Time of day | struct tm | datetime.time | chrono::NaiveTime | TOD / LTOD |
| dateTime | Combined date+time | struct tm | datetime.datetime | chrono::NaiveDateTime | DT / LDT |

*Table 8: IEC Time/Date Types*

Duration values in ASL use the structured "duration" kind (see Section 7), while date/time types are represented as strings in ISO 8601 format for literals, or as structured objects with fields (year, month, day, hour, minute, second, millisecond).

# **4\. Enums** {#4.-enums}

Enumerations define a set of named integer constants. In ASL, enums are defined in the structs array and referenced by name.

## **4.1 Definition** {#4.1-definition}

| {   "name": "State",   "doc": "Machine states",   "kind": "enum",   "variants": \[     { "name": "IDLE",   "value": 0 },     { "name": "RUN",    "value": 1 },     { "name": "ERROR",  "value": 2 }   \] } |
| :---- |

## **4.2 Usage in Expressions** {#4.2-usage-in-expressions}

Enum values are accessed as member expressions:

| { "kind": "member", "target": { "kind": "var", "name": "State" }, "property": "RUN" } // Evaluates to literal 1 in C++, Python, Rust; maps to State\#RUN in ST |
| :---- |

# **5\. Function Blocks (NEW in v1.2)** {#5.-function-blocks-(new-in-v1.2)}

Function Blocks are a core IEC 61131-3 concept that encapsulates both state and behavior. Unlike functions, Function Blocks maintain internal state across invocations, making them ideal for PID controllers, communication handlers, motor drivers, and other stateful components.

## **5.1 Schema** {#5.1-schema}

*A Function Block is represented as an entry in the dedicated functionBlocks array at the root level. Entries in this array do not carry a "kind" discriminant field — their position in functionBlocks is itself the discriminant.*

| {   "name": "PID\_Controller",   "doc": "PID controller function block",   "inputs": \[     { "name": "setpoint",   "type": "float" },     { "name": "processVar", "type": "float" }   \],   "outputs": \[     { "name": "output", "type": "float" }   \],   "internals": \[     { "name": "integral",  "type": "float", "mutable": true },     { "name": "prevError", "type": "float", "mutable": true }   \],   "body": \[ ... statements ... \] } |
| :---- |

## **5.2 Language Mappings** {#5.2-language-mappings}

| Target | Mapping |
| ----- | ----- |
| C++/Arduino | Class with private member variables for internals, public methods for inputs/outputs, and an update() method for the body. |
| MicroPython | Class with \_\_init\_\_ setting internals, and an update() method containing the body. |
| Rust Embassy | Struct for state (inputs, outputs, internals) \+ impl block with an update() method. |
| IEC 61131-3 ST | FUNCTION\_BLOCK declaration with VAR\_INPUT, VAR\_OUTPUT, VAR sections and the body. |

*Table 9: Function Block Language Mappings*

## **5.3 Instantiation Pattern** {#5.3-instantiation-pattern}

Function Blocks are instantiated as global or local variables using the newStruct expression, then called by name:

| // Declare instance (in globals or as a local declare): { "kind": "declare", "name": "pid1", "type": "PID\_Controller", "value": null, "mutable": true, "scope": "local" }   // Call the function block (invoke its body): { "kind": "call", "callee": "pid1", "args": \[\] }   // Set inputs before calling: { "kind": "setMember", "target": { "kind": "var", "name": "pid1" }, "property": "setpoint", "value": { "kind": "literal", "value": 100.0 } }   // Read outputs after calling: { "kind": "member", "target": { "kind": "var", "name": "pid1" }, "property": "output" } |
| :---- |
| **Note:** Function Block instances are always mutable. The generator ensures proper initialization of internal state on first call. |

# **6\. Pin Configuration** {#6.-pin-configuration}

## **6.1 pinMode** {#6.1-pinmode}

Configures a pin's electrical mode. All source languages map to the same ASL representation:

| { "kind": "pinMode", "pin": { "kind": "literal", "value": 13 }, "mode": "OUTPUT" } |
| :---- |

Valid mode values: "INPUT", "OUTPUT", "INPUT\_PULLUP", "INPUT\_PULLDOWN", "ANALOG", "OPEN\_DRAIN".

| Source Language | Syntax Example |
| ----- | ----- |
| C++/Arduino | pinMode(13, OUTPUT); |
| MicroPython | Pin(13, Pin.OUT) |
| Rust Embassy | p.PA5.into\_push\_pull\_output() |
| IEC 61131-3 ST | %QX0.0 (OUTPUT implicit) |

*Table 10: pinMode Source Syntax*

## **6.2 Pin Mode Mapping** {#6.2-pin-mode-mapping}

| ASL Mode | C++ | MicroPython | Rust Embassy | ST |
| ----- | ----- | ----- | ----- | ----- |
| INPUT | INPUT | Pin.IN | into\_floating\_input() | %IX (input) |
| OUTPUT | OUTPUT | Pin.OUT | into\_push\_pull\_output() | %QX (output) |
| INPUT\_PULLUP | INPUT\_PULLUP | Pin.PULL\_UP | into\_pull\_up\_input() | (custom config) |
| INPUT\_PULLDOWN | INPUT\_PULLDOWN | Pin.PULL\_DOWN | into\_pull\_down\_input() | (custom config) |
| ANALOG | ANALOG | ADC(Pin(n)) | into\_analog() | %IW (analog in) |
| OPEN\_DRAIN | OUTPUT\_OPEN\_DRAIN | Pin.OPEN\_DRAIN | into\_open\_drain\_output() | (custom config) |

*Table 11: Pin Mode Cross-Language Mapping*

## **6.3 digitalOutput** {#6.3-digitaloutput}

| { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 }, "value": { "kind": "literal", "value": 1 } } |
| :---- |

Toggle pattern uses unary NOT:

| { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 },   "value": { "kind": "unary", "op": "\!", "expr": { "kind": "var", "name": "ledState" } } } |
| :---- |

## **6.4 digitalInput** {#6.4-digitalinput}

| { "kind": "digitalInput", "pin": { "kind": "literal", "value": 12 }, "target": "val" } |
| :---- |

## **6.5 analogOutput** {#6.5-analogoutput}

| { "kind": "analogOutput", "pin": { "kind": "literal", "value": 9 }, "value": { "kind": "literal", "value": 128 } } |
| :---- |

## **6.6 analogInput** {#6.6-analoginput}

| { "kind": "analogInput", "pin": { "kind": "literal", "value": 0 }, "target": "val" } |
| :---- |

# **7\. Timing — Duration and Delay** {#7.-timing-—-duration-and-delay}

## **7.1 Duration Structure** {#7.1-duration-structure}

Durations are represented with a structured object rather than a raw millisecond value, enabling generators to emit idiomatic time literals for each target language:

| {   "kind": "duration",   "days": 0, "hours": 0, "minutes": 1, "seconds": 30,   "milliseconds": 500, "microseconds": 0 } |
| :---- |

Generators compute the total and emit: C++ delay(ms), Python sleep\_ms(ms), Rust Timer::after\_millis(ms).await, ST T\#1M30S500ms.

## **7.2 delay** {#7.2-delay}

| // Delay of 500 ms: |
| :---- |
| { |
|   "kind": "delay", |
|   "duration": { "kind": "duration", "days": 0, "hours": 0, "minutes": 0, |
|                 "seconds": 0, "milliseconds": 500, "microseconds": 0 } |
| } |
|  |
| // Delay of 200 us: |
| { |
|   "kind": "delay", |
|   "duration": { "kind": "duration", "days": 0, "hours": 0, "minutes": 0, |
|                 "seconds": 0, "milliseconds": 0, "microseconds": 200 } |
| } |

***Note:** delay accepts only a duration object. Raw milliseconds expressions are not permitted. All generators compute total microseconds from the duration fields and emit idiomatic calls: C++ delay(ms) / delayMicroseconds(us), Python sleep\_ms(ms) / sleep\_us(us), Rust Timer::after\_millis(ms).await / Timer::after\_micros(us).await, ST T\#....*

## **7.3 millis / micros** {#7.3-millis-/-micros}

These are expression kinds that return the elapsed time since program start:

| { "kind": "millis" }   // Milliseconds since start { "kind": "micros" }   // Microseconds since start   // Used in expressions: { "kind": "binary", "op": "-",   "left": { "kind": "millis" },   "right": { "kind": "var", "name": "start" } } |
| :---- |

# **8\. Flow Control** {#8.-flow-control}

## **8.1 if / elseIf / else** {#8.1-if-/-elseif-/-else}

| {   "kind": "if",   "condition": { "kind": "binary", "op": "\>", "left": { "kind": "var", "name": "x" }, "right": { "kind": "literal", "value": 10 } },   "thenBody": \[...\],   "elseIf": \[     { "condition": { ... }, "body": \[...\] }   \],   "elseBody": \[...\]   // null if absent } |
| :---- |

elseIf is always an array (empty \[\] if none). elseBody is null if absent.

| Language | else if / elif Syntax |
| ----- | ----- |
| C++/Arduino | else if (cond) { ... } |
| MicroPython | elif cond: |
| Rust | else if cond { ... } |
| IEC 61131-3 ST | ELSIF cond THEN ... END\_IF |

*Table 12: elseIf Syntax by Language*

## **8.2 while** {#8.2-while}

| { "kind": "while", "condition": { "kind": "literal", "value": 1 }, "body": \[...\] } // Infinite loop: condition is literal 1 |
| :---- |

## **8.3 doWhile** {#8.3-dowhile}

| { "kind": "doWhile", "body": \[...\],   "condition": { "kind": "binary", "op": "\<", "left": { "kind": "var", "name": "i" }, "right": { "kind": "literal", "value": 10 } } } |
| :---- |

MicroPython and Rust lack native do-while; the parser detects while True: ... if not cond: break and emits doWhile.

## **8.4 for — range** {#8.4-for-—-range}

| { "kind": "for", "pattern": "range", "var": "i",   "from": { "kind": "literal", "value": 0 },   "to": { "kind": "literal", "value": 10 },   "step": { "kind": "literal", "value": 1 },   "body": \[...\] } |
| :---- |
| ***Range Boundary Convention:** ASL to is always exclusive (i \< to). This is the canonical form stored in the ASL node regardless of source language.* *ST Parser (ST → ASL): When parsing FOR i := 0 TO 9 BY 1, the ST parser normalises the inclusive bound by adding 1: "to": { "kind": "literal", "value": 10 }. The ASL node always holds the exclusive value.* *ST Generator (ASL → ST): The ST generator emits TO (to \- 1\) unconditionally, since to in ASL is always exclusive. No flag or metadata is needed.* *All other parsers/generators (C++, MicroPython, Rust): use to directly as an exclusive bound — no adjustment.* *This ensures a single unambiguous representation in ASL regardless of which language was parsed.* |

## **8.5 for — each** {#8.5-for-—-each}

| { "kind": "for", "pattern": "each", "var": "x",   "iterable": { "kind": "var", "name": "lista" }, "body": \[...\] } |
| :---- |

ST has no native for-each; the generator expands to a range-based FOR with index.

## **8.6 for — cStyle** {#8.6-for-—-cstyle}

Used only when the expression does not map to range or each patterns.

| { "kind": "for", "pattern": "cStyle",   "init": \[{ "kind": "declare", "name": "i", "type": "int", "value": { "kind": "literal", "value": 0 } }\],   "condition": { "kind": "binary", "op": "\<", "left": { "kind": "var", "name": "i" }, "right": { "kind": "var", "name": "n" } },   "update": \[{ "kind": "assign", "target": "i", "value": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "i" }, "right": { "kind": "literal", "value": 2 } } }\],   "body": \[...\] } |
| :---- |

## **8.7 switch** {#8.7-switch}

| { "kind": "switch", "discriminant": { "kind": "var", "name": "estado" },   "cases": \[     { "test": { "kind": "literal", "value": 1 }, "body": \[...\] },     { "test": { "kind": "literal", "value": 2 }, "body": \[...\] },     { "test": null, "body": \[...\] }  // default case   \] } |
| :---- |

## **8.8 break / continue / return** {#8.8-break-/-continue-/-return}

| { "kind": "break" } { "kind": "continue" } { "kind": "return", "value": { "kind": "var", "name": "result" } } { "kind": "return", "value": null }   // void return |
| :---- |

## **8.9 tryCatch** {#8.9-trycatch}

| { "kind": "tryCatch",   "tryBody": \[...\],   "catchParam": "e",   "catchType": "string",   "catchBody": \[...\] } |
| :---- |

# **9\. Variables** {#9.-variables}

## **9.1 declare** {#9.1-declare}

The declare statement creates a new variable. In v1.2, a new "lifecycle" field is introduced to support IEC RETAIN/PERSISTENT semantics:

| {   "kind":      "declare",   "name":      "counter",   "type":      "int",   "value":     { "kind": "literal", "value": 0 },   "mutable":   true,   "scope":     "local",   "lifecycle": "retain" } |  |  |
| ----- | ----- | ----- |
| **Field** | **Type** | **Description** |
| kind | string | Always "declare" |
| name | string | Variable identifier |
| type | AslType | Type of the variable |
| value | Expr | null | Initial value expression, or null for uninitialized |
| mutable | boolean | false \= const, true \= mutable |
| scope | string | "local" | "global" | "const" |
| lifecycle | string | "normal" | "retain" | "persistent" (default: "normal") |

*Table 13: declare Statement Schema (v1.2)*

## **9.2 Variable Lifecycle** {#9.2-variable-lifecycle}

The lifecycle field controls variable persistence across restarts:

| Lifecycle | Description | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| normal | Standard variable (default) | Standard variable | Standard variable | Standard variable | VAR |
| retain | Survives warm restart | Simulated NVRAM | RTC memory (ESP32) | Simulated NVRAM | VAR RETAIN |
| persistent | Survives cold restart/power cycle | EEPROM/Flash | Flash storage | Flash storage | VAR PERSISTENT |

*Table 14: Variable Lifecycle Mapping*

| Note: For C++/MicroPython/Rust targets, RETAIN and PERSISTENT variables are implemented through the storage API (Section 30). Generators emit initialization code that reads from NVRAM/Flash at startup and writes back on change. |
| :---- |

## **9.3 assign** {#9.3-assign}

| { "kind": "assign", "target": "x", "value": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "x" }, "right": { "kind": "literal", "value": 1 } } } |
| :---- |

Compound operators (+=, \-=, \*=, etc.) and postfix (i++, i--) are expanded into assign with binary expressions.

## **9.4 setIndex — Array Assignment** {#9.4-setindex-—-array-assignment}

| { "kind": "setIndex", "target": "arr", "index": { "kind": "var", "name": "i" }, "value": { "kind": "literal", "value": 42 } } |
| :---- |

2D arrays use setIndex2D with rowIndex and colIndex fields.

## **9.5 setMember — Struct Assignment** {#9.5-setmember-—-struct-assignment}

| { "kind": "setMember", "target": { "kind": "var", "name": "point" }, "property": "x", "value": { "kind": "literal", "value": 10 } } |
| :---- |

# **10\. Arrays** {#10.-arrays}

## **10.1 Declaration** {#10.1-declaration}

| // Empty array: { "kind": "declare", "name": "arr", "type": "array", "subtype": "int", "size": { "kind": "literal", "value": 10 }, "value": null, "mutable": true, "scope": "local" }   // With initial values: { "kind": "declare", "name": "data", "type": "array", "subtype": "float", "size": { "kind": "literal", "value": 3 },   "value": { "kind": "array", "elements": \[{ "kind": "literal", "value": 1.0 }, { "kind": "literal", "value": 2.0 }, { "kind": "literal", "value": 3.0 }\] },   "mutable": true, "scope": "local" }   // 2D array: { "kind": "declare", "name": "matrix", "type": "array", "subtype": "int", "size": { "kind": "literal", "value": 3 }, "size2": { "kind": "literal", "value": 3 }, "value": null, "mutable": true, "scope": "local" } |
| :---- |

## **10.2 Index Access (expression)** {#10.2-index-access-(expression)}

| { "kind": "index", "target": { "kind": "var", "name": "arr" }, "index": { "kind": "var", "name": "i" } } |
| :---- |

## **10.3 arrayLength (expression)** {#10.3-arraylength-(expression)}

| Language | Syntax |
| ----- | ----- |
| C++ | sizeof(arr) / sizeof(arr\[0\]) |
| MicroPython | len(arr) |
| Rust | arr.len() |
| IEC 61131-3 ST | SIZEOF(arr) |

*Table 15: arrayLength by Language*

| { "kind": "arrayLength", "target": { "kind": "var", "name": "arr" } } |
| :---- |

# **11\. Functions** {#11.-functions}

***Note:** The functions array contains only pure functions (stateless, with params, returnType, body). Function Blocks, which maintain internal state across invocations, are defined in the functionBlocks array (Section 5). Do not mix the two.*

## **11.1 Declaration** {#11.1-declaration}

| {   "name": "sum",   "doc": "Returns the sum of two integers",   "params": \[     { "name": "a", "type": "int" },     { "name": "b", "type": "int" }   \],   "returnType": "int",   "body": \[     { "kind": "return", "value": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "a" }, "right": { "kind": "var", "name": "b" } } }   \] } |
| :---- |

Functions without a return value use returnType "void" and may omit return statements.

Default parameter values are supported: { "name": "x", "type": "int", "default": { "kind": "literal", "value": 0 } }.

## **11.2 Function Call (expression)** {#11.2-function-call-(expression)}

| // As expression: { "kind": "call", "callee": "sum", "args": \[ { "kind": "literal", "value": 3 }, { "kind": "literal", "value": 4 } \] }   // As statement: { "kind": "expr", "expr": { "kind": "call", "callee": "blink", "args": \[\] } } |
| :---- |

# **12\. Structs** {#12.-structs}

## **12.1 Definition** {#12.1-definition}

| { "name": "Point", "doc": "2D point with integer coordinates",   "fields": \[     { "name": "x", "type": "int", "default": null },     { "name": "y", "type": "int", "default": null }   \] } |  |
| ----- | ----- |
| **Language** | **Syntax** |
| C++/Arduino | struct Point { int x; int y; }; |
| MicroPython | class Point: with \_\_init\_\_ |
| Rust | struct Point { x: i32, y: i32 } |
| IEC 61131-3 ST | TYPE Point: STRUCT x: INT; y: INT; END\_STRUCT END\_TYPE |

*Table 16: Struct Definition by Language*

## **12.2 Instantiation (expression)** {#12.2-instantiation-(expression)}

| { "kind": "newStruct", "struct": "Point",   "fields": \[     { "name": "x", "value": { "kind": "literal", "value": 3 } },     { "name": "y", "value": { "kind": "literal", "value": 7 } }   \] } |
| :---- |

# **13\. Print / Serial** {#13.-print-/-serial}

## **13.1 print** {#13.1-print}

| // Single value: { "kind": "print", "args": \[ { "kind": "var", "name": "value" } \], "newline": true }   // Formatted (multiple args): { "kind": "print",   "args": \[     { "kind": "literal", "value": "reading: " },     { "kind": "var", "name": "val" },     { "kind": "literal", "value": " ms" }   \], "newline": true } |  |
| ----- | ----- |
| **Language** | **Syntax** |
| C++/Arduino | Serial.print(x) / Serial.println(x) |
| MicroPython | print(x) |
| Rust | println\!("{}", x) |
| IEC 61131-3 ST | WRITE(x) |

*Table 17: Print Syntax by Language*

## **13.2 Serial Communication** {#13.2-serial-communication}

| { "kind": "serialBegin", "baud": { "kind": "literal", "value": 9600 }, "port": 0 } { "kind": "serialAvailable" } { "kind": "serialReadString" } { "kind": "serialReadByte" } { "kind": "serialWrite", "data": { "kind": "literal", "value": "hello" } } |
| :---- |

# **14\. Expressions** {#14.-expressions}

## **14.1 Literal** {#14.1-literal}

| { "kind": "literal", "value": 42 } { "kind": "literal", "value": 3.14 } { "kind": "literal", "value": true } { "kind": "literal", "value": "hello" } { "kind": "literal", "value": null }   // NULL / None / Option::None |
| :---- |

## **14.2 Variable — var** {#14.2-variable-—-var}

| { "kind": "var", "name": "x" } |
| :---- |

## **14.3 Binary Operators** {#14.3-binary-operators}

| { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "a" }, "right": { "kind": "literal", "value": 1 } } |  |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- | ----- |
| **Category** | **ASL Symbols** | **C++** | **MicroPython** | **Rust** | **ST** |
| Arithmetic | \+ \- \* / % | same | same | same | \+ \- \* / MOD |
| Integer Division | // | / (int/int) | // | / (i32/i32) | / |
| Power | \*\* | pow() | \*\* | f32::powi() | EXPT() |
| Comparison | \== \!= \< \<= \> \>= | same | same | same | \= \<\> \< \<= \> \>= |
| Logical | && || | same | and or | same | AND OR |
| Bitwise | & | ^ \~ | same | same | same | AND OR XOR NOT |
| Shift | \<\< \>\> | same | same | same | SHL SHR |

*Table 18: Binary Operator Cross-Language Mapping*

***ST Note:** In IEC 61131-3, AND and OR are overloaded — they serve as both logical (BOOL operands) and bitwise (BYTE/WORD operands) operators. The ST generator selects the correct form by inspecting the operand type in the ASL node. No disambiguation keyword exists; correctness is enforced by type context.*

## **14.4 Unary Operator** {#14.4-unary-operator}

| { "kind": "unary", "op": "-", "expr": { "kind": "var", "name": "x" } } { "kind": "unary", "op": "\!", "expr": { "kind": "var", "name": "flag" } } { "kind": "unary", "op": "\~", "expr": { "kind": "var", "name": "mask" } } |
| :---- |

Operators: \- (negation), \! (logical NOT), \~ (bitwise NOT), \+ (positive), & (address-of), \* (dereference).

## **14.5 Ternary — conditional** {#14.5-ternary-—-conditional}

| { "kind": "conditional",   "condition": { "kind": "binary", "op": "\>", "left": { "kind": "var", "name": "a" }, "right": { "kind": "literal", "value": 0 } },   "whenTrue": { "kind": "literal", "value": 1 },   "whenFalse": { "kind": "literal", "value": 0 } } |  |
| ----- | ----- |
| **Language** | **Syntax** |
| C++ | a \> 0 ? 1 : 0 |
| MicroPython | 1 if a \> 0 else 0 |
| Rust | if a \> 0 { 1 } else { 0 } (as expression) |
| IEC 61131-3 ST | SEL(a \> 0, 0, 1\) |

*Table 19: Ternary Expression by Language*

## **14.6 Type Cast** {#14.6-type-cast}

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

# **33\. SFC / State Machines (NEW in v1.2)** {#33.-sfc-/-state-machines-(new-in-v1.2)}

Sequential Function Chart (SFC) is an IEC 61131-3 graphical language for representing sequential processes. ASL v1.2 introduces an optional stateMachine kind as syntactic sugar for defining state machines more declaratively. Parsers can always fall back to switch \+ enum \+ variable if needed.

## **33.1 Schema** {#33.1-schema}

| {   "kind": "stateMachine",   "name": "ConveyorBelt",   "initial": "IDLE",   "states": {     "IDLE": {       "onEnter": \[         { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 }, "value": { "kind": "literal", "value": 0 } }       \],       "transitions": \[         { "event": "startButton", "target": "RUNNING" }       \]     },     "RUNNING": {       "onEnter": \[         { "kind": "digitalOutput", "pin": { "kind": "literal", "value": 13 }, "value": { "kind": "literal", "value": 1 } }       \],       "transitions": \[         { "event": "stopButton", "target": "IDLE" },         { "event": "error", "target": "FAULT" }       \]     },     "FAULT": {       "onEnter": \[         { "kind": "print", "args": \[ { "kind": "literal", "value": "Fault detected" } \], "newline": true }       \],       "transitions": \[         { "event": "reset", "target": "IDLE" }       \]     }   } } |
| :---- |

## **33.2 Language Mappings** {#33.2-language-mappings}

| Target | Mapping |
| ----- | ----- |
| C++/Arduino | switch statement \+ enum for states, with a state variable updated on transitions |
| MicroPython | dict-based state table with while loop, or if/elif chain |
| Rust Embassy | match expression on an enum, with async transitions |
| IEC 61131-3 ST | SFC (Sequential Function Chart) graphical language, or CASE statement |

*Table 31: State Machine Language Mappings*

| Note: The stateMachine kind is optional sugar. Parsers and generators can always fall back to the switch \+ enum \+ variable pattern described in Section 8 (Flow Control). This kind is provided for convenience and improved readability of sequential processes. |
| :---- |

# **34\. Logging (NEW in v1.2)** {#34.-logging-(new-in-v1.2)}

While print (Section 13\) covers basic debug output, the log kind provides structured logging with severity levels and module identification, essential for industrial systems and diagnostics.

## **34.1 Schema** {#34.1-schema}

| {   "kind": "log",   "level": "INFO",   "module": "sensor\_manager",   "message": { "kind": "binary", "op": "+",     "left": { "kind": "literal", "value": "Temperature reading: " },     "right": { "kind": "var", "name": "temp" } } } |
| :---- |

Valid levels: "DEBUG", "INFO", "WARN", "ERROR".

| Target | Mapping |
| ----- | ----- |
| C++/Arduino | Conditional Serial.print with level prefix: \[INFO\] \[sensor\_manager\] Temperature reading: 25.3 |
| MicroPython | logging module: logging.getLogger("sensor\_manager").info("Temperature reading: %s", temp) |
| Rust Embassy | log crate macros: log::info\!(target: "sensor\_manager", "Temperature reading: {}", temp) |
| IEC 61131-3 ST | SystemLog function block or vendor-specific logging: LOG(level, module, message) |

*Table 32: Logging Language Mappings*

| Note: print is for basic debug output during development; log is for structured, level-filtered logging in production systems. Generators may compile log statements to no-ops when level filtering is applied. |
| :---- |

# **35\. Testing and Simulation (NEW in v1.2)** {#35.-testing-and-simulation-(new-in-v1.2)}

ASL v1.2 introduces kinds for testing assertions and simulation instrumentation, supporting the NeuroForge simulation environment and unit testing frameworks.

## **35.1 assert** {#35.1-assert}

| {   "kind": "assert",   "condition": { "kind": "binary", "op": "\>", "left": { "kind": "var", "name": "sensorValue" }, "right": { "kind": "literal", "value": 0 } },   "message": { "kind": "literal", "value": "Sensor value must be positive" } } |
| :---- |

## **35.2 simProbe** {#35.2-simprobe}

The simProbe kind is used to mark variables for data collection during simulation runs. It has no effect in production code:

| { "kind": "simProbe", "name": "pid\_output", "value": { "kind": "member", "target": { "kind": "var", "name": "pid1" }, "property": "output" } } |  |  |  |  |
| ----- | ----- | ----- | ----- | ----- |
| **Kind** | **C++** | **MicroPython** | **Rust** | **ST** |
| assert | assert(condition) \+ Serial.println | assert condition, message | assert\!(condition) | ASSERT(condition, message) |
| simProbe | // no-op (stripped by preprocessor) | // no-op (stripped) | // no-op (cfg(sim)) | (stripped) |

*Table 33: Testing and Simulation Mappings*

# **36\. Common Algorithms** {#36.-common-algorithms}

## **36.1 Arithmetic Mean** {#36.1-arithmetic-mean}

| // mean \= (a \+ b) / 2 {   "kind": "declare", "name": "mean", "type": "float", "mutable": true, "scope": "local",   "value": { "kind": "binary", "op": "/",     "left": { "kind": "binary", "op": "+", "left": { "kind": "var", "name": "a" }, "right": { "kind": "var", "name": "b" } },     "right": { "kind": "literal", "value": 2 } } } |
| :---- |

## **36.2 Exponential Moving Average (EMA)** {#36.2-exponential-moving-average-(ema)}

The EMA filter is commonly used for sensor smoothing:

| // ema \= alpha \* reading \+ (1 \- alpha) \* ema {   "kind": "assign", "target": "ema",   "value": { "kind": "binary", "op": "+",     "left": { "kind": "binary", "op": "\*", "left": { "kind": "var", "name": "alpha" }, "right": { "kind": "var", "name": "reading" } },     "right": { "kind": "binary", "op": "\*",       "left": { "kind": "binary", "op": "-", "left": { "kind": "literal", "value": 1 }, "right": { "kind": "var", "name": "alpha" } },       "right": { "kind": "var", "name": "ema" } } } } |
| :---- |

# **37\. Complete Example — Blink with Metadata** {#37.-complete-example-—-blink-with-metadata}

The following example demonstrates a complete ASL program for the classic LED blink, including proper metadata and duration structure:

| { "kind": "delay", "duration": { "kind": "duration", "days": 0, "hours": 0, |
| :---- |
|   "minutes": 0, "seconds": 0, "milliseconds": 500, "microseconds": 0 } } |
| **Note:** All four source languages (C++/Arduino, MicroPython, Rust Embassy, IEC 61131-3 ST) produce exactly this ASL output for a basic blink program. |

# **Appendix A: Operator Precedence by Language** {#appendix-a:-operator-precedence-by-language}

The following table summarizes operator precedence from highest to lowest binding for each target language. Generators must use explicit parentheses when the precedence differs between source and target.

| Precedence | ASL | C++ | MicroPython | Rust | ST |
| ----- | ----- | ----- | ----- | ----- | ----- |
| 1 (highest) | () . \[\] | () . \[\] \-\> | () . \[\] \*\* | () . \[\] :: | () |
| 2 | \! \~ \- \+ (unary) | \! \~ \- \+ \++ \-- | not \- \+ \~ | \! \~ \- \* (deref) & | NOT \- \+ |
| 3 | \* / % // | \* / % | \* / // % | \* / % | \* / MOD |
| 4 | \+ \- | \+ \- | \+ \- | \+ \- | \+ \- |
| 5 | \<\< \>\> | \<\< \>\> | \<\< \>\> | \<\< \>\> | SHL SHR |
| 6 | & | & | & | & | AND (bitwise — BYTE/WORD/DWORD) |
| 7 | ^ | ^ | ^ | ^ | XOR (bitwise) |
| 8 | | | | | | | | | OR (bitwise — BYTE/WORD/DWORD) |
| 9 | \< \<= \> \>= | \< \<= \> \>= | \< \<= \> \>= | \< \<= \> \>= | \< \<= \> \>= |
| 10 | \== \!= | \== \!= | \== \!= | \== \!= | \= \<\> |
| 11 | &&& | && | and | && | AND (logical — BOOL) |
| 12 (lowest) | || | || | or | || | OR (logical — BOOL) |

*Table 34: Operator Precedence by Language*

***ST Overload Rule:** AND/OR at precedence 6/8 are bitwise (integer operands); at 11/12 are logical (BOOL operands). The ST generator must emit the same keyword in both cases — correctness is guaranteed by the operand type, not by a different symbol.*