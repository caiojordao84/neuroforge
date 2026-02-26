# Parser to ASL Integration — Estado Real vs Documentação

> **Data:** 25/02/2026
> **Objetivo:** Consolidar `parserToASL.md` e `parserIntegration.md` com a realidade verificada do projeto.

---

## 1. Estado Verificado do Projeto

### 1.1 Ficheiros Analisados

| Ficheiro               | Caminho                                          | Estado Real |
| ---------------------- | ------------------------------------------------ | ----------- |
| `codeToASL.ts`         | `src/engine/asl/codeToASL.ts`                    | ✅ Completo  |
| `LanguageRegistry.ts`  | `src/engine/asl/LanguageRegistry.ts`             | ✅ Completo  |
| `statementRegistry.ts` | `src/engine/asl/transforms/statementRegistry.ts` | ✅ Completo  |
| `callTransform.ts`     | `src/engine/asl/transforms/callTransform.ts`     | ✅ Completo  |
| `PythonParser.ts`      | `src/engine/asl/plugins/python/PythonParser.ts`  | ✅ Completo  |
| `RustParser.ts`        | `src/engine/asl/plugins/rust/RustParser.ts`      | ✅ Completo  |

### 1.2 Comparação: Documentação vs Realidade

| Aspeto                     | parserToASL.md | parserIntegration.md | Realidade               |
| -------------------------- | -------------- | -------------------- | ----------------------- |
| `case 'rust'` em codeToASL | ⚠️ Faltando     | ✅ Mencionado         | ✅ **Completo**          |
| Rust `isASLSupported`      | ❌ `false`      | ✅ Mencionado         | ✅ **Completo** (`true`) |
| statementRegistry handlers | ✅ Completo     | ⚠️ Menciona falta     | ✅ **Completo**          |
| callTransform Pin mappings | ✅ Completo     | ⚠️ Menciona falta     | ✅ **Completo**          |
| Python match/case          | ❌ Não existe   | ❌ Não menciona       | ✅ **Completo**          |
| Rust match_expression      | ❌ Não existe   | ❌ Não menciona       | ✅ **Completo**          |

---

## 2. O Que Já Funciona

### 2.1 MicroPython / CircuitPython → ASL

```
✅ codeToASL.ts: case 'micropython'/'circuitpython' → PythonParser
✅ statementRegistry: IfStatement, WhileLoop, ForLoop, SwitchStatement, GpioSet, DelayMs, Print, VariableDeclaration
✅ callTransform: Pin.on, Pin.off, Pin.value, pinMode
✅ PythonParser (tree-sitter): function_definition, if_statement, while_statement, for_statement, assignment, return_statement
✅ PythonParser (regex fallback): while True, print, delay, Pin setup, GPIO ops
```

### 2.2 Rust → ASL

```
✅ codeToASL.ts: Existe case 'rust' → RustParser
✅ LanguageRegistry.ts: isASLSupported = true
✅ statementRegistry: Todos os handlers existem
✅ callTransform: Mapeamentos completos
✅ RustParser: match_expression, function_item, if_expression, loop_expression, while_expression, for_expression, let_declaration, call_expression
```

---

## 3. Implementações Recentes (✅ Concluído)

| #   | Ficheiro              | Ação                                         | Status           |
| --- | --------------------- | -------------------------------------------- | ---------------- |
| 1   | `codeToASL.ts`        | Adicionar `case 'rust'`                      | ✅ Pronto         |
| 2   | `LanguageRegistry.ts` | Mudar `isASLSupported: true` para Rust       | ✅ Pronto         |
| 3   | `PythonParser.ts`     | Adicionar `visitMatch()` → `SwitchStatement` | ✅ Pronto         |
| 4   | `PythonParser.ts`     | Adicionar parsing de `match/case`            | ✅ Pronto (Regex) |
| 5   | `RustParser.ts`       | Adicionar `visitMatch()` → `SwitchStatement` | ✅ Pronto         |  |

### 3.2 Verificado como Completo (NÃO precisa implementação)

| Ficheiro               | Funcionalidade           | Status                          |
| ---------------------- | ------------------------ | ------------------------------- |
| `statementRegistry.ts` | SwitchStatement handler  | ✅ Já existe (linha 27, 43-75)   |
| `statementRegistry.ts` | GpioSet handler          | ✅ Já existe (linha 31, 168-174) |
| `statementRegistry.ts` | DelayMs handler          | ✅ Já existe (linha 33, 184-189) |
| `statementRegistry.ts` | Print handler            | ✅ Já existe (linha 36, 551-557) |
| `callTransform.ts`     | Pin.on/off/value mapping | ✅ Já existe (linhas 41-63)      |
| `callTransform.ts`     | pinMode mapping          | ✅ Já existe (linhas 8-23)       |

---

## 4. Código Existente Relevante

### 4.1 codeToASL.ts — parseToProgramNode() (linhas 26-47)

```typescript
async function parseToProgramNode(source: string, language: Language): Promise<ProgramNode> {
  switch (language) {
    case 'c':
    case 'cpp': {
      const parser = new RecursiveDescentCParser();
      const { ast } = parser.parse(source);
      return ast;
    }

    case 'micropython':
    case 'circuitpython':
    case 'python': {
      const parser = new PythonParser();
      await parser.init();
      const { ast } = parser.parse(source);
      return ast;
    }

    default:
      return { nodeType: 'Program', id: 'root', attributes: {}, children: [] };
  }
}
```

**Falta:** `case 'rust':` com RustParser

### 4.2 LanguageRegistry.ts — Rust entry (linhas 54-60)

```typescript
{
    id: 'rust',
    label: 'Rust',
    extension: '.rs',
    monacoLanguage: 'rust',
    isASLSupported: false, // ← Mudar para true
},
```

### 4.3 statementRegistry.ts — SwitchStatement handler (linhas 27, 43-75)

```typescript
SwitchStatement: handleSwitchStatement,  // ← Já existe

function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);
  // ... implementação completa
}
```

### 4.4 callTransform.ts — Pin mappings (linhas 41-63)

```typescript
if (callee === 'Pin.value' && node.children.length === 2) {
  return { kind: 'digitalWrite', pin: transformExpr(node.children[0]), value: transformExpr(node.children[1]) };
}
if (callee === 'Pin.on') { return { kind: 'digitalWrite', pin: transformExpr(node.children[0]), value: { kind: 'literal', value: 1 } }; }
if (callee === 'Pin.off') { return { kind: 'digitalWrite', pin: transformExpr(node.children[0]), value: { kind: 'literal', value: 0 } }; }
```

### 4.5 PythonParser.ts — visit() switch (linhas 392-414)

```typescript
visit(node: any): BaseNode | null {
    switch (node.type) {
        case 'function_definition': return this.visitFunction(node);
        case 'expression_statement': { /* ... */ }
        case 'if_statement': return this.visitIf(node);
        case 'while_statement': return this.visitWhile(node);
        case 'for_statement': return this.visitFor(node);
        case 'assignment': return this.visitAssignment(node);
        case 'augmented_assignment': return this.visitAssignment(node);
        case 'return_statement': return this.visitReturn(node);
        // FALTA: case 'match_statement': return this.visitMatch(node);
        default:
            return { nodeType: 'Empty', id: `e-${node.id}`, attributes: {}, children: [] };
    }
}
```

### 4.6 RustParser.ts — visit() switch (linhas 56-73)

```typescript
visit(node: any): BaseNode | null {
    switch (node.type) {
        case 'function_item': return this.visitFunction(node);
        case 'expression_statement': return this.visitExpressionStatement(node);
        case 'let_declaration': return this.visitLet(node);
        case 'block': return this.visitBlock(node);
        case 'if_expression': return this.visitIf(node);
        case 'loop_expression': return this.visitLoop(node);
        case 'while_expression': return this.visitWhile(node);
        case 'for_expression': return this.visitFor(node);
        case 'call_expression':
        case 'binary_expression':
        case 'assignment_expression':
            return this.visitExpr(node);
        // FALTA: case 'match_expression': return this.visitMatch(node);
        default:
            return null;
    }
}
```

---

## 5. Plano de Implementação Consolidado

### Fase 1 — Ativar Rust no Pipeline (1 commit)

```
Ficheiros:
- src/engine/asl/codeToASL.ts: + case 'rust'
- src/engine/asl/LanguageRegistry.ts: isASLSupported: true

Testes:
- T-RS-1 (Rust blink básico)
- T-RS-2 (Rust println)
- T-RS-3 (Rust loop {})
```

### Fase 2 — Adicionar match/case aos Parsers (1 commit)

```
Ficheiros:
- src/engine/asl/plugins/python/PythonParser.ts: + visitMatch() (tree-sitter)
- src/engine/asl/plugins/python/PythonParser.ts: + match/case parsing (regex)
- src/engine/asl/plugins/rust/RustParser.ts: + visitMatch()

Testes:
- T-PY1 (Python match básico)
- T-PY2 (Python match com enum)
- T-RS1 (Rust match básico)
- T-RS2 (Rust match com enum)
```

---

## 6. Fixtures de Teste

### T-RS-1 — Rust blink básico

```rust
fn setup() {
    gpio_set(25, 1);
    delay(500);
    gpio_set(25, 0);
    delay(500);
}

fn loop() {
    delay(1000);
}
```

### T-PY1 — Python match/case básico

```python
def setup():
    state = 2
    match state:
        case 1:
            print("ONE")
        case 2:
            print("TWO")
        case _:
            print("UNKNOWN")

def loop():
    delay(1000)
```

---

## 7. Resumo

| Tarefa                                             | Estado   | Esforço |
| -------------------------------------------------- | -------- | ------- |
| Ativar Rust em codeToASL                           | ❌ Falta  | 5 min   |
| Ativar isASLSupported para Rust                    | ❌ Falta  | 1 min   |
| Adicionar visitMatch ao PythonParser (tree-sitter) | ❌ Falta  | 30 min  |
| Adicionar match/case ao PythonParser (regex)       | ❌ Falta  | 30 min  |
| Adicionar visitMatch ao RustParser                 | ❌ Falta  | 30 min  |
| Verificar statementRegistry (SwitchStatement)      | ✅ Pronto | —       |
| Verificar callTransform (Pin mappings)             | ✅ Pronto | —       |

---

## 8. Commit Messages Sugeridos

### Commit 1 (Fase 1)

```
feat(asl): enable Rust language support in ASL pipeline

- codeToASL.ts: add case 'rust' → RustParser
- LanguageRegistry.ts: set isASLSupported: true for Rust

Enables: Rust → ASL simulation and code generation
Tests: T-RS-1, T-RS-2, T-RS-3
```

### Commit 2 (Fase 2)

```
feat(parsers): add switch/match support to Python and Rust parsers

- PythonParser.ts (tree-sitter): add visitMatch() → SwitchStatement
- PythonParser.ts (regex): add match/case parsing for MicroPython
- RustParser.ts: add visitMatch() → SwitchStatement

Tests: T-PY1, T-PY2, T-RS1, T-RS2
```
