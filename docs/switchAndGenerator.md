# switch/case — Plano de Integração ASL

> **Branch:** `ASL_Integration`
> **Data:** 25/02/2026
> **Status secção 4.1:** `[ ]` → após commit: `[x]`

---

## 0) Regras obrigatórias (ASL Integration)

> [!CAUTION]
> **ANTES de qualquer integração de código:**
> 1. **MOSTRAR TODO o código atual** dos ficheiros que serão modificados
> 2. **MOSTRAR TODAS as entradas** (variáveis, configs, types) que serão afectadas
> 3. **EXPLICAR detalhadamente** o que será alterado e porquê
> 4. **Aguardar aprovação** do developer
> 5. **A integração deverá ser feita em um ÚNICO COMMIT no GitHub** com mensagem descritiva

---

## 1) Diagnóstico — estado real no GitHub (25/02/2026)

### CParser.ts — `parseSwitch()` existe mas está errada

O método existe e recolhe os cases correctamente, mas no bloco final converte
tudo para uma cadeia de `IfStatement` (lowering):

```typescript
// ABORDAGEM ACTUAL — ERRADA
let result: BaseNode | null = elseNode;
for (let i = normalCases.length - 1; i >= 0; i--) {
  result = { nodeType: 'IfStatement', ... }; // ← nunca emite 'SwitchStatement'
}
return result;
```

**Bug crítico:** `break` dentro de cada case fica como `BreakStatement`
dentro de um bloco `if`. No executor, o `BreakSignal` não é capturado pelo
`if` — propaga até ao `while`/`for` externo, quebrando o loop pai.

```
// Exemplo do bug:
for (int i = 0; i < 3; i++) {
  switch (i) {
    case 0: digitalWrite(10, HIGH); break;  // ← este break quebra o for ← BUG
  }
}
```

### ASLTypes.ts
Sem `ASLSwitch`, sem `ASLSwitchCase` na union `ASLStatement`.

### statementRegistry.ts
Sem handler para `SwitchStatement`.

### ASLExecutor.ts
Sem `case 'switch'` no `executeStatement()`.

---

## 2) Estratégia: ASLSwitch nativo

Rejeitar o lowering. Implementar `switch` como statement nativo na ASL:

| Critério                 | Lowering para if/else | ASLSwitch nativo         |
| ------------------------ | --------------------- | ------------------------ |
| `break` dentro do switch | ❌ quebra loop externo | ✅ capturado no switch    |
| Round-trip generators    | ❌ perde estrutura     | ✅ regenera `switch/case` |
| Fall-through semântico   | ❌ impossível          | ✅ semântica C completa   |
| ASLViewer legível        | ❌ if/else gigante     | ✅ estrutura clara        |
| Enums como discriminant  | ❌ perde contexto      | ✅ preservado             |

---

## 3) Ficheiros a modificar

### Core (obrigatório — bloqueia simulação)

| #   | Ficheiro                                         | Alteração                                                                      |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | `src/engine/asl/ASLTypes.ts`                     | Adicionar `ASLSwitchCase`, `ASLSwitch`; incluir na union                       |
| 2   | `src/engine/asl/plugins/c/CParser.ts`            | Reescrever bloco final de `parseSwitch()` para emitir `SwitchStatement` nativo |
| 3   | `src/engine/asl/transforms/statementRegistry.ts` | Adicionar `SwitchStatement: handleSwitchStatement`                             |
| 4   | `src/engine/asl/ASLExecutor.ts`                  | Adicionar `case 'switch'` com captura de `BreakSignal`                         |

### Geradores (recomendado — permite CI-1..CI-21)

> **Nota crítica:** os geradores operam sobre o **AST** (`ProgramNode`/`BaseNode`),
> **não** sobre `ASLProgram`. Usar sempre `node.nodeType === 'SwitchStatement'`
> com `node.children[]`, seguindo o padrão dos outros statements.

| #   | Ficheiro                                           | Alteração                                                 |
| --- | -------------------------------------------------- | --------------------------------------------------------- |
| 5   | `src/engine/asl/plugins/c/CGenerator.ts`           | Emitir `switch/case/default` (C e C++)                    |
| 6   | `src/engine/asl/plugins/python/PythonGenerator.ts` | Emular switch com `if/elif` (MicroPython + CircuitPython) |
| 7   | `src/engine/asl/plugins/rust/RustGenerator.ts`     | Emular switch com `match` ou `loop` rotulado + flag       |

### Roadmap

| #   | Ficheiro           | Alteração                                         |
| --- | ------------------ | ------------------------------------------------- |
| 9   | `notyet/README.md` | Marcar secção 4.1 switch/case de `[ ]` para `[x]` |

---

## 4) Etapa 1 — `ASLTypes.ts`

### Código actual afectado (union ASLStatement)

```typescript
// ACTUAL — sem ASLSwitch
export type ASLStatement =
  | ASLPinMode | ASLDigitalWrite | ASLAnalogWrite | ASLRead
  | ASLIf | ASLWhile | ASLFor | ASLDelay | ASLAssign
  | ASLSetIndex | ASLSetIndex2D | ASLSetIndex3D | ASLSetMember
  | ASLSetPointer | ASLExpressionStmt | ASLReturn | ASLPrint
  | ASLBreak | ASLContinue | ASLComment;
```

### Tipos a adicionar (após `ASLContinue`)

```typescript
/**
 * Caso individual de switch/case.
 * test === null → cláusula 'default'
 */
export interface ASLSwitchCase {
  test: ASLExpr | null;
  body: ASLStatement[];
}

/**
 * Switch/case nativo ASL.
 * Preserva semântica de fall-through do C.
 * BreakSignal lançado dentro do corpo é capturado pelo executor de switch,
 * nunca pelo loop externo.
 */
export interface ASLSwitch {
  kind: 'switch';
  discriminant: ASLExpr;
  cases: ASLSwitchCase[];
}
```

### Union actualizada

```typescript
export type ASLStatement =
  | ASLPinMode | ASLDigitalWrite | ASLAnalogWrite | ASLRead
  | ASLIf | ASLWhile | ASLFor | ASLDelay | ASLAssign
  | ASLSetIndex | ASLSetIndex2D | ASLSetIndex3D | ASLSetMember
  | ASLSetPointer | ASLExpressionStmt | ASLReturn | ASLPrint
  | ASLBreak | ASLContinue | ASLComment
  | ASLSwitch;  // ← NOVO
```

**Entradas afectadas:**
- `ASLExecutor.executeStatement()` — precisa de `case 'switch'`
- Todos os geradores — precisam de suportar `kind: 'switch'`
- `ASLViewer` — reconhece automaticamente (renderiza por `kind`)

---

## 5) Etapa 2 — `CParser.ts`

### O que muda

Apenas o bloco final de `parseSwitch()` (o bloco de lowering).
O loop de recolha de cases mantém-se **idêntico**.

### parseSwitch() corrigida (versão completa)

```typescript
private parseSwitch(): BaseNode {
  const line = this.peek().line;
  this.consume('switch');
  this.consume('(');
  const discriminant = this.parseExpression(0);
  this.consume(')');
  this.consume('{');

  const cases: { test: BaseNode | null; body: BaseNode[] }[] = [];

  while (this.peek().value !== '}' && this.peek().type !== 'EOF') {
    if (this.peek().value === 'case') {
      this.consume('case');
      const test = this.parseExpression(0);
      this.consume(':');
      const body: BaseNode[] = [];
      while (
        !['case', 'default', '}'].includes(this.peek().value) &&
        this.peek().type !== 'EOF'
      ) {
        const s = this.parseStatement();
        if (s) body.push(s);
      }
      cases.push({ test, body });
    } else if (this.peek().value === 'default') {
      this.consume('default');
      this.consume(':');
      const body: BaseNode[] = [];
      while (
        !['case', 'default', '}'].includes(this.peek().value) &&
        this.peek().type !== 'EOF'
      ) {
        const s = this.parseStatement();
        if (s) body.push(s);
      }
      cases.push({ test: null, body });
    } else {
      this.consume(); // skip unexpected tokens
    }
  }

  this.consume('}');

  // ── NOVO: emitir SwitchStatement nativo (sem lowering para IfStatement) ──
  // Estrutura do nó:
  //   SwitchStatement
  //     children[0]   = discriminant (expr)
  //     children[1..] = CaseClause[]
  //
  //   CaseClause (attributes.isDefault = false)
  //     children[0]   = testExpr
  //     children[1..] = body statements
  //
  //   CaseClause (attributes.isDefault = true)
  //     children[0..] = body statements (sem testExpr)

  const caseNodes: BaseNode[] = cases.map(c => ({
    nodeType: 'CaseClause',
    id: this.genId(),
    attributes: { isDefault: c.test === null },
    children: c.test !== null ? [c.test, ...c.body] : [...c.body],
    metadata: { line },
  }));

  return {
    nodeType: 'SwitchStatement',
    id: this.genId(),
    attributes: { caseCount: cases.length },
    children: [discriminant, ...caseNodes],
    metadata: { line },
  };
}
```

---

## 6) Etapa 3 — `statementRegistry.ts`

### 6.1) Adicionar ao registry

```typescript
export const statementRegistry: Record<string, StatementHandler> = {
  IfStatement:       handleIfStatement,
  WhileLoop:         handleWhileLoop,
  ForLoop:           handleForLoop,
  SwitchStatement:   handleSwitchStatement,   // ← NOVO
  ReturnStatement:   handleReturnStatement,
  BreakStatement:    handleBreakStatement,
  ContinueStatement: handleContinueStatement,
  GpioSet:           handleGpioSet,
  AnalogWrite:       handleAnalogWrite,
  DelayMs:           handleDelayMs,
  VariableDeclaration: handleVariableDeclaration,
  ExpressionStatement: handleExpressionStatement,
  Print:             handlePrint,
  // ... hardware nodes (inalterado)
};
```

### 6.2) Função handler

Adicionar após `handleForLoop`, antes de `handleReturnStatement`:

```typescript
function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  // children[0] = discriminant expr
  // children[1..] = CaseClause nodes
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);

  const cases = caseNodes.map(caseNode => {
    const isDefault = !!caseNode.attributes.isDefault;

    let test: ASLExpr | null = null;
    let bodyChildren: BaseNode[] = [];

    if (isDefault) {
      // Sem testExpr — todos os children são body
      bodyChildren = caseNode.children;
    } else {
      // children[0] = testExpr, children[1..] = body
      test = transformExpr(caseNode.children[0]);
      bodyChildren = caseNode.children.slice(1);
    }

    const body = ctx.transformBlock ? ctx.transformBlock(bodyChildren, ctx) : [];
    return { test, body };
  });

  return [{
    kind: 'switch',
    discriminant,
    cases,
  } as ASLStatement];
}
```

**Entradas afectadas:** apenas o registry e o novo handler. Nenhuma função existente é modificada.

---

## 7) Etapa 4 — `ASLExecutor.ts`

> ⚠️ Fazer fetch do ficheiro actual antes do commit para confirmar assinaturas
> exactas de `evalExpr()` e `executeBlock()`. O pseudocódigo abaixo usa
> `(expr, localEnv)` — ajustar se necessário.

### Semântica a implementar

1. Avaliar `discriminant` → `discVal`
2. Percorrer `cases` sequencialmente:
   - `default` → guardar índice, não executar ainda
   - `case N` → se `discVal == testVal` (coerção `==`, não `===`): `matched = true`
   - Se `matched`: executar body → fall-through automático para case seguinte
3. Se nenhum case casou e existe `default`: executar a partir do `default` (com fall-through)
4. `BreakSignal` capturado **neste nível** → nunca propaga para `while`/`for` externos

### Adicionar ao `executeStatement()` após o handler de `for`

```typescript
case 'switch': {
  const discVal = await this.evalExpr(stmt.discriminant, localEnv);
  let matched = false;
  let defaultIdx = -1;

  try {
    for (let i = 0; i < stmt.cases.length; i++) {
      const c = stmt.cases[i];

      if (c.test === null) {
        defaultIdx = i;
        continue; // não executar default agora; só se nenhum case casar
      }

      if (!matched) {
        const testVal = await this.evalExpr(c.test, localEnv);
        if (discVal == testVal) matched = true; // == para semântica C (int/enum)
      }

      if (matched) {
        await this.executeBlock(c.body, localEnv);
        // fall-through: não sair — continuar para case seguinte
      }
    }

    // Se nenhum case casou, executar default e subsequentes (fall-through do default)
    if (!matched && defaultIdx >= 0) {
      for (let i = defaultIdx; i < stmt.cases.length; i++) {
        await this.executeBlock(stmt.cases[i].body, localEnv);
      }
    }
  } catch (e) {
    if (!(e instanceof BreakSignal)) throw e;
    // BreakSignal consumido aqui — NÃO propaga para loops externos
    // Este catch resolve o bug original.
  }

  break; // switch case do TypeScript
}
```

---

## 8) Etapa 5 — Geradores (AST → texto)

> **Regra fundamental:** geradores operam em **`ProgramNode`/`BaseNode`** (AST do parser).
> O switch chega como `node.nodeType === 'SwitchStatement'` com `node.children[]`.
> `children[0]` = discriminant, `children[1..]` = `CaseClause` nodes.
> **Nunca** usar `stmt.kind === 'switch'` nos geradores — isso é a camada ASLProgram
> (usada apenas no executor).

### 8.1) CGenerator — suporte nativo (C e C++)

**Ficheiro:** `src/engine/asl/plugins/c/CGenerator.ts`

C e C++ têm `switch/case` nativo com fall-through. Emitir directamente.

**Não inserir `break;` automático** — respeitar o que está no AST
(cada case contém `BreakStatement` como child se o código original o tinha).

**API real do CGenerator:** `genStmt(node: BaseNode, lines: string[], indent: string)`,
`addLn(lines: string[], text: string, node: BaseNode | null)`,
`genExpr(node: BaseNode): string`.

```typescript
else if (node.nodeType === 'SwitchStatement') {
  // children[0] = discriminant, children[1..] = CaseClause nodes
  const disc = this.genExpr(node.children[0]);
  this.addLn(lines, `${indent}switch (${disc}) {`, node);

  for (let i = 1; i < node.children.length; i++) {
    const caseNode = node.children[i];
    if (caseNode.attributes.isDefault) {
      this.addLn(lines, `${indent}  default:`, caseNode);
      // default: todos os children são body
      caseNode.children.forEach(c => this.genStmt(c, lines, indent + '    '));
    } else {
      // children[0] = testExpr, children[1..] = body
      this.addLn(lines, `${indent}  case ${this.genExpr(caseNode.children[0])}:`, caseNode);
      caseNode.children.slice(1).forEach(c => this.genStmt(c, lines, indent + '    '));
    }
  }

  this.addLn(lines, `${indent}}`, node);
}
```

**Tratamento de `BreakStatement` dentro do body:** o `genStmt` já emite `break;`
quando encontra `nodeType === 'BreakStatement'` — não fazer nada especial.

### 8.2) PythonGenerator — emulação com `if/elif` (MicroPython + CircuitPython)

**Ficheiro:** `src/engine/asl/plugins/python/PythonGenerator.ts`

> **Nota:** este gerador já suporta dois flavors (`'MICROPYTHON'` e `'CIRCUITPYTHON'`)
> via `PythonFlavor`. A emulação do switch aplica-se a ambos.

Python `match/case` (≥3.10) **não tem fall-through** e MicroPython pode não o suportar.
Emular com cadeia `if/elif`:

```typescript
if (n.nodeType === 'SwitchStatement') {
  // children[0] = discriminant, children[1..] = CaseClause nodes
  const disc = this.genExpr(n.children[0]);
  const discVar = `__sw_disc`;
  this.addLn(out, `${i}${discVar} = ${disc}`, n);

  let first = true;
  let defaultNode: BaseNode | null = null;

  for (let ci = 1; ci < n.children.length; ci++) {
    const caseNode = n.children[ci];
    if (caseNode.attributes.isDefault) {
      defaultNode = caseNode;
      continue;
    }
    // children[0] = testExpr, children[1..] = body (excluir BreakStatement)
    const testExpr = this.genExpr(caseNode.children[0]);
    const keyword = first ? 'if' : 'elif';
    this.addLn(out, `${i}${keyword} ${discVar} == ${testExpr}:`, caseNode);
    const body = caseNode.children.slice(1).filter(c => c.nodeType !== 'BreakStatement');
    if (body.length > 0) {
      body.forEach(c => this.genStmt(c, i + '    ', out));
    } else {
      this.addLn(out, `${i}    pass`, null);
    }
    first = false;
  }

  if (defaultNode) {
    this.addLn(out, `${i}else:`, defaultNode);
    const body = defaultNode.children.filter(c => c.nodeType !== 'BreakStatement');
    if (body.length > 0) {
      body.forEach(c => this.genStmt(c, i + '    ', out));
    } else {
      this.addLn(out, `${i}    pass`, null);
    }
  }
  return;
}
```

> **Nota:** esta emulação com `if/elif` **não preserva fall-through** — converte
> cada case num branch exclusivo. Para Arduino C/C++, 95%+ dos switch usam `break`
> em todos os cases, pelo que esta simplificação é aceitável. Se for necessário
> fall-through real, usar a abordagem `while True:` + flag descrita nos fixtures.

### 8.3) RustGenerator — emulação com `match`

**Ficheiro:** `src/engine/asl/plugins/rust/RustGenerator.ts`

Rust `match` **não tem fall-through**. A abordagem mais idiomática é emitir
um `match` simples (sem fall-through):

```typescript
else if (node.nodeType === 'SwitchStatement') {
  const disc = this.genExpr(node.children[0]);
  this.addLn(lines, `${indent}match ${disc} {`, node);

  for (let ci = 1; ci < node.children.length; ci++) {
    const caseNode = node.children[ci];
    if (caseNode.attributes.isDefault) {
      this.addLn(lines, `${indent}    _ => {`, caseNode);
      const body = caseNode.children.filter(c => c.nodeType !== 'BreakStatement');
      body.forEach(c => this.genStmt(c, lines, indent + '        '));
      this.addLn(lines, `${indent}    }`, null);
    } else {
      const testExpr = this.genExpr(caseNode.children[0]);
      this.addLn(lines, `${indent}    ${testExpr} => {`, caseNode);
      const body = caseNode.children.slice(1).filter(c => c.nodeType !== 'BreakStatement');
      body.forEach(c => this.genStmt(c, lines, indent + '        '));
      this.addLn(lines, `${indent}    }`, null);
    }
  }

  this.addLn(lines, `${indent}}`, node);
}
```

---

## 9) Fixtures de validação (T-SW1..T-SW4)

### T-SW1 — básico com default

```cpp
void setup() { Serial.begin(9600); }
void loop() {
  int state = 2;
  switch (state) {
    case 1: Serial.println("ONE");     break;
    case 2: Serial.println("TWO");     break;
    case 3: Serial.println("THREE");   break;
    default: Serial.println("UNKNOWN"); break;
  }
  delay(1000);
}
```

**ASLProgram esperado (fragmento):**
```json
{
  "kind": "switch",
  "discriminant": { "kind": "var", "name": "state" },
  "cases": [
    { "test": { "kind": "literal", "value": 1 }, "body": [ { "kind": "print", ... }, { "kind": "break" } ] },
    { "test": { "kind": "literal", "value": 2 }, "body": [ { "kind": "print", ... }, { "kind": "break" } ] },
    { "test": { "kind": "literal", "value": 3 }, "body": [ { "kind": "print", ... }, { "kind": "break" } ] },
    { "test": null,                               "body": [ { "kind": "print", ... }, { "kind": "break" } ] }
  ]
}
```

**Saída esperada:** `TWO` no terminal, uma vez por segundo.

---

### T-SW2 — switch dentro de for (validação do bug fix)

```cpp
void setup() { Serial.begin(9600); }
void loop() {
  for (int i = 0; i < 3; i++) {
    switch (i) {
      case 0: digitalWrite(10, HIGH); break;
      case 1: digitalWrite(11, HIGH); break;
      default: digitalWrite(12, HIGH); break;
    }
  }
  delay(500);
}
```

**Validação crítica:** o `for` completa as **3 iterações**.
- i=0 → pino 10 acende
- i=1 → pino 11 acende
- i=2 → pino 12 acende (default)

Se o `break` quebrar o `for`, apenas o pino 10 acende (1 iteração). Este fixture
é a prova directa de que o bug original está resolvido.

---

### T-SW3 — switch com enum

```cpp
enum Phase { IDLE, RUNNING, STOPPED };
Phase phase = RUNNING;

void setup() {
  pinMode(9, OUTPUT);
  Serial.begin(9600);
}
void loop() {
  switch (phase) {
    case IDLE:    digitalWrite(9, LOW);  Serial.println("IDLE");    break;
    case RUNNING: digitalWrite(9, HIGH); Serial.println("RUNNING"); break;
    case STOPPED: digitalWrite(9, LOW);  Serial.println("STOPPED"); break;
  }
  delay(1000);
}
```

**Saída esperada:** LED no pino 9 aceso, `RUNNING` no terminal.
Valida que enum members (`IDLE=0`, `RUNNING=1`, `STOPPED=2`) são correctamente
comparados com `==` no discriminant.

---

### T-SW4 — fall-through intencional (case vazio)

```cpp
void setup() { Serial.begin(9600); }
void loop() {
  int x = 1;
  switch (x) {
    case 1:
    case 2:
      Serial.println("ONE or TWO");
      break;
    default:
      Serial.println("OTHER");
  }
  delay(1000);
}
```

**Saída esperada:** `ONE or TWO`.
- `case 1` tem body vazio → fall-through automático para `case 2`.
- Valida que a lógica de fall-through (sem `break`) funciona correctamente.

---

## 10) Commit único

```
feat(asl): implement native switch/case end-to-end

- ASLTypes.ts: add ASLSwitchCase, ASLSwitch; extend ASLStatement union
- CParser.ts: rewrite parseSwitch() to emit SwitchStatement/CaseClause
  (removes broken if/else lowering that caused break to exit outer loops)
- statementRegistry.ts: add SwitchStatement handler → ASL kind:'switch'
- ASLExecutor.ts: execute 'switch' with fall-through + BreakSignal captured
  locally (fixes break escaping to enclosing for/while)
- plugins/c/CGenerator.ts: emit native switch/case (C/C++)
- plugins/python/PythonGenerator.ts: emulate switch via if/elif
  (MicroPython + CircuitPython)
- plugins/rust/RustGenerator.ts: emulate switch via match
- notyet/README.md: mark section 4.1 switch/case as [x]

Fixtures: T-SW1 (basic+default), T-SW2 (break isolation),
          T-SW3 (enum+switch), T-SW4 (fall-through)

Closes #4.1 (notyet/README.md)
```

---

## 11) Checklist de aprovação e validação

### Aprovação (antes do commit)
- [ ] `ASLTypes.ts` — interfaces `ASLSwitchCase` e `ASLSwitch` aprovadas
- [ ] `CParser.ts` — bloco final de `parseSwitch()` aprovado
- [ ] `statementRegistry.ts` — handler aprovado
- [ ] `ASLExecutor.ts` — assinaturas de `evalExpr()` / `executeStatements()` confirmadas; lógica aprovada
- [ ] `CGenerator.ts` — modelo com API `genStmt(node, lines, indent)` / `addLn(lines, text, node)` aprovado
- [ ] `PythonGenerator.ts` — emulação `if/elif` para MicroPython + CircuitPython aprovada
- [ ] `RustGenerator.ts` — emulação `match` com API `genStmt(node, lines, indent)` aprovada

### Validação pós-commit
- [ ] `ASLViewer` mostra `kind:'switch'` com `cases[]` e `test:null` para default
- [ ] **T-SW2** confirma que `break` dentro de switch **não quebra o `for`** (3 iterações)
- [ ] **T-SW4** confirma fall-through (case 1 vazio → cai em case 2)
- [ ] **T-SW3** confirma enum members como discriminant
- [ ] Smoke tests existentes (T1-T4 do AI_ASSISTANT_CONTEXT) sem regressão
- [ ] `notyet/README.md` secção 4.1 → `[x]`

---

## 12) Referências

| Ficheiro               | Path real                                          | Secção relevante                          |
| ---------------------- | -------------------------------------------------- | ----------------------------------------- |
| `ASLTypes.ts`          | `src/engine/asl/ASLTypes.ts`                       | union `ASLStatement` (linha ~90)          |
| `CParser.ts`           | `src/engine/asl/plugins/c/CParser.ts`              | `parseSwitch()` (linha ~227)              |
| `statementRegistry.ts` | `src/engine/asl/transforms/statementRegistry.ts`   | registry (linha ~23)                      |
| `ASLExecutor.ts`       | `src/engine/asl/ASLExecutor.ts`                    | `executeStatements()` + `BreakSignal`     |
| `CGenerator.ts`        | `src/engine/asl/plugins/c/CGenerator.ts`           | `genStmt()` (linha ~65)                   |
| `PythonGenerator.ts`   | `src/engine/asl/plugins/python/PythonGenerator.ts` | `genStmt()` — MicroPython + CircuitPython |
| `RustGenerator.ts`     | `src/engine/asl/plugins/rust/RustGenerator.ts`     | `genStmt()` (linha ~74)                   |
