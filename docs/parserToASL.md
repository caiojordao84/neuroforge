# Parser to ASL Integration Plan
## MicroPython → ASL, CircuitPython → ASL, Rust → ASL

> **Branch:** `ASL_Integration`
> **Data:** 25/02/2026
> **Status:** `[ ]` → após commit: `[x]`

---

## 0) Regras Obrigatórias

> [!CAUTION]
> **ANTES de qualquer integração:**
> 1. **MOSTRAR TODO o código atual** dos ficheiros que serão modificados
> 2. **MOSTRAR TODAS as entradas** que serão afectadas
> 3. **EXPLICAR detalhadamente** o que será alterado e porquê
> 4. **Aguardar aprovação** do developer
> 5. **Integração em ÚNICO COMMIT** no GitHub

---

## 1) Diagnóstico — Estado Real

### 1.1 PythonParser.ts

**Localização:** `src/engine/asl/plugins/python/PythonParser.ts`

**Arquitetura atual:**
```
PythonParser
├── _parseWithTreeSitter() → PythonCstToAst
└── _parseWithRegex() → RegexPythonParser (fallback)
```

**Suporte atual (PythonCstToAst):**
| Node Type | Status | Notas |
|-----------|--------|-------|
| function_definition | ✅ | setup(), loop(), user functions |
| if_statement | ✅ | if/elif/else |
| while_statement | ✅ | while True / while cond |
| for_statement | ✅ | for i in range(n) |
| assignment | ✅ | x = expr, x += 1 |
| return_statement | ✅ | return value |
| print | ✅ | print() |
| delay | ✅ | time.sleep_ms(), utime.sleep() |
| Pin setup | ✅ | Pin(), machine.Pin() |
| GPIO operations | ✅ | led.on(), pin.value() |
| **match_statement** | ❌ | Python 3.10+ match/case |

**Suporte atual (RegexPythonParser - fallback):**
| Node Type | Status | Notas |
|-----------|--------|-------|
| while True | ✅ | Detectado como loop principal |
| print | ✅ | print(...) |
| delay | ✅ | sleep_ms(), sleep() |
| Pin setup | ✅ | Pin(), DigitalInOut |
| GPIO ops | ✅ | led.on/off, pin.value() |
| assignments | ✅ | x = expr |
| **match** | ❌ | Não suportado |

**Gap identificado:** `match` (Python 3.10+) não existe no parser.

---

### 1.2 RustParser.ts

**Localização:** `src/engine/asl/plugins/rust/RustParser.ts`

**Arquitetura atual:**
```
RustParser
└── _parseWithTreeSitter() → RustCstToAst (tree-sitter only)
```

**Suporte atual (RustCstToAst):**
| Node Type | Status | Notas |
|-----------|--------|-------|
| function_item | ✅ | fn setup(), fn loop() |
| if_expression | ✅ | if/else |
| loop_expression | ✅ | loop { } → while true |
| while_expression | ✅ | while cond { } |
| for_expression | ✅ | for i in 0..n |
| let_declaration | ✅ | let x = value |
| call_expression | ✅ | gpio_set(), delay() |
| macro_invocation | ✅ | println!() |
| **match_expression** | ❌ | Rust match { } |
| struct | ❌ | struct definitions |
| enum | ❌ | enum definitions |

**Gap identificado:** `match_expression` (Rust equivalent de switch/case) não existe no parser.

---

### 1.3 Common AST NodeTypes (expectativas do pipeline)

O `statementRegistry` espera estes nodeTypes do parser:

```typescript
// statementRegistry.ts - nós suportados atualmente
'IfStatement'
'WhileLoop'
'ForLoop'
'SwitchStatement'  // ← Precisamos adicionar aos parsers
'ReturnStatement'
'BreakStatement'
'ContinueStatement'
'GpioSet'
'AnalogWrite'
'DelayMs'
'VariableDeclaration'
'ExpressionStatement'
'Print'
```

**Problema:** Nem Python nem Rust emitem `SwitchStatement`. Precisamos adicionar.

---

## 2) Estratégia: Parser Emit SwitchStatement

### 2.1 Princípio Fundamental

**Quando um parser encontra `match` (Python) ou `match` (Rust), deve emitir `SwitchStatement` no AST中间 (IR).**

Isso permite:
- Reutilizar o handler existente no `statementRegistry` (após adicionarmos SwitchStatement)
- Reutilizar o executor ASL (`case 'switch'`)
- Reutilizar os code generators (C, Python, Rust)

### 2.2 Arquitetura da Solução

```
Python/Rust Code
       │
       ▼
   Parser AST
   (SwitchStatement nodes)
       │
       ▼
codeToASL (transforms)
   │
   ├─ statementRegistry: SwitchStatement → ASLSwitch
   │
   ▼
ASLProgram
   │
   ├─ ASLExecutor: case 'switch'
   │
   └─ Generators: CGenerator, PythonGenerator, RustGenerator
```

---

## 3) Ficheiros a Modificar

| # | Ficheiro | Alteração |
|---|---|---|
| 1 | `PythonParser.ts` (PythonCstToAst) | Adicionar `visitMatch()` → `SwitchStatement` |
| 2 | `PythonParser.ts` (RegexPythonParser) | Adicionar parsing de `match/case` |
| 3 | `RustParser.ts` (RustCstToAst) | Adicionar `visitMatch()` → `SwitchStatement` |
| 4 | `notyet/README.md` | Atualizar secção 7.x Python/Rust para `[x]` |

**Nota:** ASLTypes, statementRegistry e ASLExecutor já estarão funcionando após o commit do switch/case (docs/switchAndGenerator.md). Esta integração depende daquele commit.

---

## 4) Etapa 1 — PythonParser.ts (Tree-sitter)

### 4.1 Adicionar case no switch do visit()

Em `PythonCstToAst.visit()` (linha ~393):

```typescript
visit(node: any): BaseNode | null {
    switch (node.type) {
        // ... existing cases ...
        case 'function_definition': return this.visitFunction(node);
        case 'expression_statement': { /* ... */ }
        case 'if_statement': return this.visitIf(node);
        case 'while_statement': return this.visitWhile(node);
        case 'for_statement': return this.visitFor(node);
        case 'match_statement': return this.visitMatch(node);  // ← NOVO
        case 'assignment': return this.visitAssignment(node);
        case 'augmented_assignment': return this.visitAssignment(node);
        case 'return_statement': return this.visitReturn(node);
        // ...
    }
}
```

### 4.2 Adicionar visitMatch()

Adicionar método após `visitFor()`:

```typescript
visitMatch(node: any): BaseNode {
    const subjectNode = node.childForFieldName('subject');
    const subject = subjectNode ? this.visitExpr(subjectNode) : null;
    const casesNode = node.childForFieldName('cases');
    
    const caseNodes: BaseNode[] = [];
    
    if (casesNode) {
        casesNode.children.forEach((c: any) => {
            if (c.type === 'match_case') {
                const pattern = c.childForFieldName('pattern');
                const body = c.childForFieldName('body');
                
                let testExpr: BaseNode | null = null;
                
                // pattern pode ser: literal, identifier, '_' (wildcard)
                if (pattern) {
                    if (pattern.type === '_') {
                        // Wildcard = default
                        testExpr = null;
                    } else if (pattern.type === 'integer') {
                        testExpr = { 
                            nodeType: 'Literal', 
                            id: `lit-${pattern.id}`, 
                            attributes: { value: parseInt(pattern.text) }, 
                            children: [] 
                        };
                    } else if (pattern.type === 'identifier') {
                        testExpr = { 
                            nodeType: 'Identifier', 
                            id: `id-${pattern.id}`, 
                            attributes: { name: pattern.text }, 
                            children: [] 
                        };
                    }
                }
                
                const bodyStmts = body ? this.visitBlockChildren(body) : [];
                
                caseNodes.push({
                    nodeType: 'CaseClause',
                    id: `case-${c.id}`,
                    attributes: { isDefault: testExpr === null },
                    children: testExpr ? [testExpr, ...bodyStmts] : bodyStmts,
                    metadata: { line: c.startPosition.row + 1 }
                });
            }
        });
    }
    
    return {
        nodeType: 'SwitchStatement',
        id: `sw-${node.id}`,
        attributes: { caseCount: caseNodes.length },
        children: [subject!, ...caseNodes],
        metadata: { line: node.startPosition.row + 1 }
    };
}
```

---

## 5) Etapa 2 — PythonParser.ts (Regex Fallback)

### 5.1 Adicionar parsing de match/case

Em `RegexPythonParser._parseLine()` (após os handlers existentes):

```typescript
private _parseLine(trimmed: string, lineNum: number): BaseNode | null {
    const meta = { line: lineNum };
    
    // ... existing handlers ...
    
    // ── match subject: ─────────────────────────────────────────────────────
    const matchStartM = trimmed.match(/^match\s+(\w+)\s*:\s*$/);
    if (matchStartM) {
        return {
            nodeType: 'MatchStart',
            id: `match-${lineNum}`,
            attributes: { subject: matchStartM[1] },
            children: [],
            metadata: meta
        };
    }
    
    // ── case pattern: ────────────────────────────────────────────────────
    const caseM = trimmed.match(/^case\s+(.+?)\s*:/);
    if (caseM) {
        const pattern = caseM[1].trim();
        let testExpr: BaseNode;
        
        if (pattern === '_') {
            testExpr = { nodeType: 'Identifier', id: `wild-${lineNum}`, attributes: { name: '_' }, children: [], metadata: meta };
        } else if (/^\d+$/.test(pattern)) {
            testExpr = { nodeType: 'Literal', id: `lit-${lineNum}`, attributes: { value: parseInt(pattern) }, children: [], metadata: meta };
        } else {
            testExpr = { nodeType: 'Identifier', id: `id-${lineNum}`, attributes: { name: pattern }, children: [], metadata: meta };
        }
        
        return {
            nodeType: 'CaseClause',
            id: `case-${lineNum}`,
            attributes: { isDefault: pattern === '_' },
            children: [testExpr],
            metadata: meta
        };
    }
    
    // ... continue with other handlers ...
}
```

### 5.2 Tratamento de match no parse()

O RegexPythonParser precisa coletar os cases após `match subject:`:

```typescript
// Em RegexPythonParser.parse() - dentro do loop principal
let inMatch = false;
let matchSubject = '';
let matchIndent = 0;
let matchCases: BaseNode[] = [];

// Detectar match:
if (/^match\s+\w+\s*:\s*$/.test(trimmed)) {
    inMatch = true;
    matchSubject = trimmed.match(/^match\s+(\w+)/)![1];
    matchIndent = indent;
    this.pos++;
    continue;
}

// Coletar cases:
if (inMatch) {
    if (trimmed && indent <= matchIndent && !trimmed.startsWith('#')) {
        // Fim do match - emitir SwitchStatement
        const discVar: BaseNode = { 
            nodeType: 'Identifier', 
            id: `disc-${lineNum}`, 
            attributes: { name: matchSubject }, 
            children: [],
            metadata: meta 
        };
        
        const switchNode: BaseNode = {
            nodeType: 'SwitchStatement',
            id: `sw-${lineNum}`,
            attributes: { caseCount: matchCases.length },
            children: [discVar, ...matchCases],
            metadata: meta
        };
        
        // Reset e retornar
        inMatch = false;
        matchCases = [];
        return switchNode;
    }
    
    // Parse case line
    const caseNode = this._parseMatchCaseLine(trimmed, lineNum);
    if (caseNode) matchCases.push(caseNode);
    this.pos++;
    continue;
}
```

---

## 6) Etapa 3 — RustParser.ts

### 6.1 Adicionar case no switch do visit()

Em `RustCstToAst.visit()` (linha ~56):

```typescript
visit(node: any): BaseNode | null {
    switch (node.type) {
        case 'function_item': return this.visitFunction(node);
        case 'expression_statement': return this.visitExpressionStatement(node);
        case 'let_declaration': return this.visitLet(node);
        case 'block': return this.visitBlock(node);
        case 'if_expression': return this.visitIf(node);
        case 'match_expression': return this.visitMatch(node);  // ← NOVO
        case 'loop_expression': return this.visitLoop(node);
        case 'while_expression': return this.visitWhile(node);
        case 'for_expression': return this.visitFor(node);
        case 'call_expression':
        case 'binary_expression':
        case 'assignment_expression':
            return this.visitExpr(node);
        default:
            return null;
    }
}
```

### 6.2 Adicionar visitMatch()

Adicionar método após `visitFor()`:

```typescript
visitMatch(node: any): BaseNode {
    const scrutineeNode = node.childForFieldName('scrutinee');
    const scrutinee = scrutineeNode ? this.visitExpr(scrutineeNode) : null;
    const armsNode = node.childForFieldName('arms');
    
    const caseNodes: BaseNode[] = [];
    
    if (armsNode) {
        armsNode.children.forEach((arm: any) => {
            if (arm.type === 'match_arm') {
                const pattern = arm.childForFieldName('pattern');
                const body = arm.childForFieldName('expression');
                
                let testExpr: BaseNode | null = null;
                
                // Pattern pode ser: identifier, '_' (wildcard), integer, enum pattern
                if (pattern) {
                    if (pattern.type === '_') {
                        testExpr = null; // default/wildcard
                    } else if (pattern.type === 'identifier' && pattern.text !== '_') {
                        testExpr = {
                            nodeType: 'Identifier',
                            id: `pat-${pattern.id}`,
                            attributes: { name: pattern.text },
                            children: [],
                            metadata: { line: pattern.startPosition.row + 1 }
                        };
                    } else if (pattern.type === 'integer') {
                        testExpr = {
                            nodeType: 'Literal',
                            id: `lit-${pattern.id}`,
                            attributes: { value: parseInt(pattern.text) },
                            children: [],
                            metadata: { line: pattern.startPosition.row + 1 }
                        };
                    } else if (pattern.type === 'enum_pattern') {
                        // Enum::Variant como identifier
                        testExpr = {
                            nodeType: 'Identifier',
                            id: `pat-${pattern.id}`,
                            attributes: { name: pattern.text },
                            children: [],
                            metadata: { line: pattern.startPosition.row + 1 }
                        };
                    }
                }
                
                const bodyExpr = body ? this.visitExpr(body) : null;
                const bodyStmts = bodyExpr ? [bodyExpr] : [];
                
                caseNodes.push({
                    nodeType: 'CaseClause',
                    id: `arm-${arm.id}`,
                    attributes: { isDefault: testExpr === null },
                    children: testExpr ? [testExpr, ...bodyStmts] : bodyStmts,
                    metadata: { line: arm.startPosition.row + 1 }
                });
            }
        });
    }
    
    return {
        nodeType: 'SwitchStatement',
        id: `sw-${node.id}`,
        attributes: { caseCount: caseNodes.length },
        children: [scrutinee!, ...caseNodes],
        metadata: { line: node.startPosition.row + 1 }
    };
}
```

---

## 7) Fixtures de Teste

### T-PY1 — Python match/case básico

```python
# MicroPython / CircuitPython
def setup():
    state = 2
    match state:
        case 1:
            print("ONE")
        case 2:
            print("TWO")
        case 3:
            print("THREE")
        case _:
            print("UNKNOWN")

def loop():
    delay(1000)
```

**Esperado:** ASL com `SwitchStatement` → `ASLSwitch` → execução prints `TWO`

---

### T-PY2 — Python match com enum

```python
from enum import Enum

class Phase(Enum):
    IDLE = 0
    RUNNING = 1
    STOPPED = 2

phase = Phase.RUNNING

def loop():
    match phase:
        case Phase.IDLE:
            print("IDLE")
        case Phase.RUNNING:
            print("RUNNING")
        case Phase.STOPPED:
            print("STOPPED")
    delay(1000)
```

**Esperado:** Enum member como pattern, print `RUNNING`

---

### T-RS1 — Rust match básico

```rust
fn setup() {
    let state = 2;
    match state {
        1 => println!("ONE"),
        2 => println!("TWO"),
        3 => println!("THREE"),
        _ => println!("UNKNOWN"),
    }
}

fn loop() {
    delay(1000);
}
```

**Esperado:** ASL com `SwitchStatement` → `ASLSwitch` → execução prints `TWO`

---

### T-RS2 — Rust match com enum

```rust
enum Phase {
    Idle,
    Running,
    Stopped,
}

fn setup() {
    let phase = Phase::Running;
    match phase {
        Phase::Idle => gpio_set(9, 0),
        Phase::Running => gpio_set(9, 1),
        Phase::Stopped => gpio_set(9, 0),
    }
}

fn loop() {
    delay(1000);
}
```

**Esperado:** Enum variant como pattern, GPIO seta pino 9 para HIGH

---

## 8) Framework para Futuras Linguagens

### 8.1 Contrato do Parser

Cada parser que deseje integrar com ASL deve:

1. **Emitir nodeTypes padronizados** no AST:
   - `SwitchStatement` para switch/match/case
   - `IfStatement` para if/elif/else
   - `WhileLoop` para while/loop
   - `ForLoop` para for/loop
   - `VariableDeclaration` para declarações
   - `ExpressionStatement` para expressões
   - `BreakStatement`, `ContinueStatement`, `ReturnStatement`

2. **Estrutura do SwitchStatement:**
   ```typescript
   {
     nodeType: 'SwitchStatement',
     id: string,
     attributes: { caseCount: number },
     children: [
       discriminant,  // children[0] - expressão avaliada
       case1,         // children[1] - CaseClause
       case2,         // children[2] - CaseClause
       ...
     ]
   }
   
   {
     nodeType: 'CaseClause',
     id: string,
     attributes: { isDefault: boolean },  // true se for default/_
     children: [
       testExpr?,     // se não for default: children[0] = pattern
       ...body        // statements do case
     ]
   }
   ```

### 8.2 Mapeamento Linguagem → NodeType

| Linguagem | switch equivalent | Parser handler |
|-----------|-------------------|----------------|
| C/C++ | `switch/case` | `CParser.parseSwitch()` |
| Python | `match/case` (3.10+) | `PythonCstToAst.visitMatch()` |
| Rust | `match` | `RustCstToAst.visitMatch()` |
| Zig | `switch` | **TODO: adicionar** |
| Ada | `case` | **TODO: adicionar** |
| JavaScript | `switch/case` | **TODO: adicionar** |

### 8.3 Template para Nova Linguagem

Para adicionar suporte a uma nova linguagem `XParser`:

```typescript
class XCstToAst {
    visit(node: any): BaseNode | null {
        switch (node.type) {
            // ... existing handlers ...
            case 'switch_expression':
            case 'match_expression':
                return this.visitMatch(node);  // Emitir SwitchStatement
            // ...
        }
    }
    
    visitMatch(node: any): BaseNode {
        // 1. Obter discriminant (subject/scrutinee)
        // 2. Iterar sobre cases/arms
        // 3. Para cada case:
        //    - Extrair pattern/test
        //    - Extrair body
        //    - Definir isDefault (wildcard/_/default)
        // 4. Retornar SwitchStatement
    }
}
```

---

## 9) Commit Único

```
feat(parsers): add switch/match support to Python and Rust parsers

- PythonParser.ts (tree-sitter): add visitMatch() → SwitchStatement
  (Python 3.10+ match/case)
- PythonParser.ts (regex fallback): add match/case parsing
  (for MicroPython without tree-sitter)
- RustParser.ts: add visitMatch() → SwitchStatement
  (Rust match expressions)

Dependents: requires switch/case pipeline (ASLTypes, statementRegistry,
ASLExecutor, generators) from docs/switchAndGenerator.md

Fixtures: T-PY1 (Python match basic), T-PY2 (Python match enum),
T-RS1 (Rust match basic), T-RS2 (Rust match enum)

Closes: Python→ASL section 7.2, Rust→ASL section 7.4
```

---

## 10) Checklist de Aprovação

### Pré-commit
- [ ] PythonParser.ts (tree-sitter) — `visitMatch()` aprovado
- [ ] PythonParser.ts (regex) — parsing de `match/case` aprovado
- [ ] RustParser.ts — `visitMatch()` aprovado

### Pós-commit
- [ ] T-PY1 executa corretamente (Python match → ASL → output)
- [ ] T-PY2 executa corretamente (Python match com enum)
- [ ] T-RS1 executa corretamente (Rust match → ASL → output)
- [ ] T-RS2 executa corretamente (Rust match com enum)
- [ ] notyet/README.md secções 7.2 e 7.4 → `[x]`

---

## 11) Referências

| Ficheiro | Path | Secção relevante |
|----------|------|------------------|
| PythonParser.ts | `src/engine/asl/plugins/python/PythonParser.ts` | PythonCstToAst.visit() (linha ~393) |
| PythonParser.ts | `src/engine/asl/plugins/python/PythonParser.ts` | RegexPythonParser._parseLine() (linha ~153) |
| RustParser.ts | `src/engine/asl/plugins/rust/RustParser.ts` | RustCstToAst.visit() (linha ~56) |
| switchAndGenerator.md | `docs/switchAndGenerator.md` | Etapa 2-4 (CParser, Registry, Executor) |
| statementRegistry.ts | `src/engine/asl/transforms/statementRegistry.ts` | SwitchStatement handler |
