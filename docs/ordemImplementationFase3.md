# Fase 3 — Plano de Implementação (Documento de Revisão)

## Contexto: pipeline actual vs. pipeline alvo

### Pipeline actual (a eliminar para C e Rust)

```
source (&str)
  → CParser / RustParser     → ProgramNode          (types/nodes.rs)
  → nodes_to_typed()         → typed_nodes::ProgramNode  (types/typed_nodes.rs)
  → ast_to_asl()             → AslProgram
```

Esta cadeia tem **3 representações intermédias** entre o source e o `AslProgram`.  O `nodes_to_typed.rs` (19 KB) e o `code_to_asl.rs` / `statement_registry.rs` existem exclusivamente para servir C e Rust — são eliminados do caminho activo depois da Fase 2.

### Pipeline alvo (uniforme para todos os parsers)

```
source (&str)
  → XxxParser::parse()       → AslProgram      ← único output possível
```

O `AslExecutor` passa a receber `AslProgram` directamente de qualquer parser, sem transformações intermédias.

***

## Contrato obrigatório — todos os parsers

Cada parser deve:

1. **Implementar `NeuroParser`** — `type Error`, `fn parse()`, `fn source_language()`
2. **Emitir `AslProgram` directamente** — nunca `ProgramNode` nem outro IR
3. **Respeitar `asl_version: "4.0.0"`** no `AslProgram` produzido
4. **R1** — statements com nomes semânticos do Dicionário (`DigitalOutput`, `AnalogOutput`, `DigitalInput`, `AnalogInput`)
5. **R4** — `HIGH`/`LOW`/`True`/`False`/`true`/`false` → `normalize::bool_like()` → `AslExpr::Literal { value: 1/0 }`
6. **R5** — operadores emitidos como `BinaryOp`/`UnaryOp` via enum — nunca strings de debug
7. **R7** — `AslProgram.tasks` contém sempre `"setup"` e `"loop"` (ou heurística equivalente)
8. **`AslDelay`** usa `AslDuration` estruturado via `normalize::duration_from_ms()` — nunca campo `milliseconds: AslExpr` raw

***

## Parser 1 — `CParser` (`plugins/c/c_parser.rs`)

### Tecnologia

`tree-sitter-arduino` (primário) com fallback `tree-sitter-cpp`. Mantido.

### O que muda

| Elemento                           | Antes                                 | Depois                                                                              |
| :--------------------------------- | :------------------------------------ | :---------------------------------------------------------------------------------- |
| Tipo de saída                      | `ProgramNode`                         | `AslProgram`                                                                        |
| `CVisitor` emite                   | `BaseNode` com `NodeType::*`          | `AslStatement` / `AslExpr` directamente                                             |
| `visit_call` → `digitalWrite`      | `NodeType::GpioSet`                   | `AslStatement::DigitalOutput { pin, value }` com R4                                 |
| `visit_call` → `analogWrite`       | `NodeType::AnalogWrite`               | `AslStatement::AnalogOutput { pin, value }`                                         |
| `visit_call` → `digitalRead`       | `NodeType::GpioRead`                  | `AslStatement::DigitalInput { pin, target }`                                        |
| `visit_call` → `analogRead`        | `NodeType::AnalogRead`                | `AslStatement::AnalogInput { pin, target }`                                         |
| `visit_call` → `delay`             | `NodeType::DelayMs`                   | `AslStatement::Delay(AslDelay { duration: normalize::duration_from_ms(...) })`      |
| `visit_call` → `delayMicroseconds` | `NodeType::DelayUs`                   | `AslStatement::Delay` com `normalize::duration_from_us(...)`                        |
| `visit_program` separa setup/loop  | em `ProgramNode.setup_body/loop_body` | em `AslProgram.tasks[{name:"setup",...}, {name:"loop",...}]`                        |
| `CParseError`                      | tipo próprio sem `From<ParseError>`   | adicionar `impl From<CParseError> for ParseError` ou usar `ParseError` directamente |

### Fluxo interno pós-mudança

```
source
  → tree_sitter::Parser (arduino ou cpp)   ← sem alteração
  → Tree (CST)                              ← sem alteração
  → CVisitor::visit_program()              ← reescrito: emite AslStatement
  → AslProgram { tasks: [setup, loop], functions, globals, ... }
```


### Camada eliminada

`nodes_to_typed(&prog)` e `ast_to_asl(&typed, Language::Cpp)` removidos do `AslExecutor`.

***

## Parser 2 — `RustParser` (`plugins/rust_std/rust_parser.rs`)

### Tecnologia

`tree-sitter-rust`. Mantido.

### O que muda

| Elemento                      | Antes                             | Depois                                                                       |
| :---------------------------- | :-------------------------------- | :--------------------------------------------------------------------------- |
| Tipo de saída                 | `ProgramNode`                     | `AslProgram`                                                                 |
| `RustVisitor` emite           | `BaseNode` com `NodeType::*`      | `AslStatement` / `AslExpr` directamente                                      |
| `visit_call` → `gpio_set`     | `NodeType::GpioSet`               | `AslStatement::DigitalOutput`                                                |
| `visit_call` → `gpio_get`     | `NodeType::GpioRead`              | `AslStatement::DigitalInput`                                                 |
| `visit_call` → `delay_ms`     | `NodeType::DelayMs`               | `AslStatement::Delay` com `AslDuration`                                      |
| `visit_call` → `delay_us`     | `NodeType::DelayUs`               | `AslStatement::Delay` com `normalize::duration_from_us()`                    |
| `visit_loop` (Rust `loop {}`) | `WhileLoop` com cond `"true"` raw | `AslStatement::While { condition: AslExpr::Literal { value: 1 }, ... }` (R4) |
| `visit_match`                 | `NodeType::SwitchStatement`       | `AslStatement::Switch(AslSwitch { discriminant, cases })`                    |
| `visit_source_file`           | `ProgramNode`                     | `AslProgram` com tasks heurísticas (ver nota R7 abaixo)                      |

**Nota R7 para Rust:** Rust não tem `setup()`/`loop()` nativos. A heurística é:

- Função `main()` com um `loop {}` no corpo → `setup` = tudo antes do `loop`, `loop` = interior do `loop {}`
- Ausência de `main()` → uma única task `"main"` com aviso `W007` via `ParseDiagnostic`


### Camada eliminada

`nodes_to_typed(&prog)` e `ast_to_asl(&typed, Language::Rust)` removidos do `AslExecutor`.

***

## Parser 3 — `PythonParser` (`plugins/python/python_parser.rs`)

### Tecnologia

`tree-sitter-python`. Mantido.

### O que muda (já emite `AslProgram` — delta menor)

| Elemento                             | Antes                              | Depois                                                                                               |
| :----------------------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `AslStatement::DigitalWrite`         | usado com `DigitalValue::High/Low` | substituído por `AslStatement::DigitalOutput { pin, value: normalize::bool_like("HIGH") }` (R1 + R4) |
| `AslIf` campos                       | `then_branch`, `else_branch`       | `then_body`, `else_body` (alinhamento com `asl_types.rs`)                                            |
| `AslDelay { milliseconds: AslExpr }` | campo raw                          | `AslDelay { duration: AslDuration }` via `normalize::duration_from_ms()`                             |
| `AslExpr::bool_val(true/false)`      | emitido directamente               | `normalize::from_bool(true/false)` → `Literal { value: 1/0 }` (R4)                                   |
| `DigitalValue` enum                  | usado internamente                 | eliminado — `value` passa a ser `AslExpr::Literal`                                                   |
| `impl NeuroParser`                   | ausente                            | adicionado                                                                                           |

**Nota R7 para Python:** O visitor já cria `tasks` com `"main"`. Acrescentar separação `"setup"` se existir função `setup()` no source, `"loop"` se existir `while True:` no top-level.

***

## Parser 4 — `StParser` (`plugins/plc/st_parser.rs`)

### Tecnologia

Crate `iec61131` v0.7. **Mantido sem tree-sitter** — grammar do EBNF oficial IEC 61131-3:2013, mais completa que qualquer grammar tree-sitter disponível.

### O que muda (o mais próximo do alvo — delta mínimo)

| Elemento                             | Antes                                  | Depois                                                                                                          |
| :----------------------------------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `Expression::Literal` `true`/`false` | `serde_json::json!(true/false)`        | `normalize::bool_like("True")` → `json!(1/0)` (R4)                                                              |
| `Statement::For`                     | lowered para `While` + `Assign`        | emite `AslStatement::For(AslForRange { ... })` com `to` exclusivo via `normalize::st_for_to_exclusive()` (§8.4) |
| `map_bin_op_str`                     | mapeia strings debug → `BinaryOp` enum | verificar que as variantes do enum ainda existem no `asl_types.rs` final; ajustar nomes se necessário           |
| `impl NeuroParser`                   | ausente                                | adicionado                                                                                                      |


***

## `AslExecutor` — ajustes pós-Fase 2

O executor simplifica-se substancialmente:

```rust
// ANTES (C/Rust)
let prog = CParser::parse(source)?;
let typed = nodes_to_typed(&prog);      // ← eliminado
ast_to_asl(&typed, Language::Cpp)       // ← eliminado

// DEPOIS (todos)
CParser::parse(source)?                 // devolve AslProgram directamente
```

Os imports `nodes_to_typed`, `ast_to_asl`, `Language`, `code_to_asl` são removidos do executor. As camadas `transforms/code_to_asl.rs`, `transforms/statement_registry.rs`, `transforms/context.rs`, `types/nodes_to_typed.rs`, `types/typed_nodes.rs` e `types/nodes.rs` ficam **marcadas como `#[deprecated]`** nesta fase (não apagadas — podem ser úteis para testes de regressão) e removidas na Fase 3.

***

## Ficheiros modificados nesta Fase 2

| Ficheiro                           | Acção                                              |
| :--------------------------------- | :------------------------------------------------- |
| `plugins/c/c_parser.rs`            | Reescrita do visitor — saída `AslProgram`          |
| `plugins/rust_std/rust_parser.rs`  | Reescrita do visitor — saída `AslProgram`          |
| `plugins/python/python_parser.rs`  | Correcções R1/R4/R7 + `NeuroParser`                |
| `plugins/plc/st_parser.rs`         | R4 literal + `AslFor` + `NeuroParser`              |
| `executor/asl_executor.rs`         | Remove `nodes_to_typed` / `ast_to_asl` do pipeline |
| `types/nodes.rs`                   | `#[deprecated]`                                    |
| `types/nodes_to_typed.rs`          | `#[deprecated]`                                    |
| `types/typed_nodes.rs`             | `#[deprecated]`                                    |
| `transforms/code_to_asl.rs`        | `#[deprecated]`                                    |
| `transforms/statement_registry.rs` | `#[deprecated]`                                    |


***

Revê este documento. Se estiver alinhado, a implementação pode começar por `StParser` (delta mínimo, valida o padrão) e depois `PythonParser`, `CParser`, `RustParser`.

