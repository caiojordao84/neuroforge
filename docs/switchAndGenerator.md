# switch/case — Documento de Integração Completo

## Estado Real Confirmado (GitHub ASL_Integration)

### O que existe hoje — e por que está `[ ]`

**CParser.ts** — `parseSwitch()` **existe** mas implementa *lowering* para cadeia de `IfStatement`:

```typescript
// Linha atual em parseSwitch() — ABORDAGEM ERRADA
let result: BaseNode | null = elseNode;
for (let i = normalCases.length - 1; i >= 0; i--) {
  // ...
  result = { nodeType: 'IfStatement', ... }; // ← converte para if/else
}
return result; // ← nunca emite 'SwitchStatement'
```

**Bug crítico** : `break` dentro de cada case fica como `BreakStatement` dentro de um `if`. No executor, `BreakSignal` lançado por `break` **não é capturado pelo `if`** — propaga até ao `while` externo mais próximo, interrompendo o loop pai em vez de sair do switch.

```
switch(state) { case 1: ... break; }  ← break aqui "quebra" o for/while externo ← BUG
```

**ASLTypes.ts** — Sem `ASLSwitch`, sem `ASLSwitchCase`

**statementRegistry.ts** — Sem handler `SwitchStatement`

**ASLExecutor.ts** — Sem handler para `switch`

---

## Estratégia de Integração: Tipo ASL Nativo

Rejeitar o lowering para if/else. Implementar `ASLSwitch` nativo porque:

| Critério | Lowering para if/else | ASLSwitch nativo |
|---|---|---|
| Break inside switch | ❌ quebra loop externo | ✅ capturado no switch |
| Round-trip generators | ❌ perde estrutura | ✅ regenera `switch/case` |
| Fall-through semântico | ❌ impossível | ✅ semântica C completa |
| Depuração no ASLViewer | ❌ if/else gigante | ✅ legível |

---

## Ficheiros a Modificar

| # | Ficheiro | Alteração |
|---|---|---|
| 1 | `src/engine/asl/ASLTypes.ts` | Adicionar `ASLSwitchCase`, `ASLSwitch`, union |
| 2 | `src/engine/asl/plugins/c/CParser.ts` | Reescrever `parseSwitch()` para emitir `SwitchStatement` |
| 3 | `src/engine/asl/transforms/statementRegistry.ts` | Adicionar `SwitchStatement: handleSwitchStatement` |
| 4 | `src/engine/asl/ASLExecutor.ts` | Adicionar `case 'switch'` com catch de `BreakSignal` |
| 5 | `src/engine/asl/plugins/c/CGenerator.ts` | Adicionar geração de switch |
| 6 | `src/engine/asl/plugins/python/PythonGenerator.ts` | Adicionar geração de match/case |
| 7 | `src/engine/asl/plugins/rust/RustGenerator.ts` | Adicionar geração de match |

---

## Etapa 1 — `ASLTypes.ts`

### Código atual afectado

```typescript
// ACTUAL — union sem switch
export type ASLStatement =
  | ASLPinMode | ASLDigitalWrite | ASLAnalogWrite | ASLRead
  | ASLIf | ASLWhile | ASLFor | ASLDelay | ASLAssign
  | ASLSetIndex | ASLSetIndex2D | ASLSetIndex3D | ASLSetMember
  | ASLSetPointer | ASLExpressionStmt | ASLReturn | ASLPrint
  | ASLBreak | ASLContinue | ASLComment;
```

### Alteração proposta — ADICIONAR após `ASLContinue`:

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
 * Switch/case nativo — preserva semântica de fall-through do C.
 * BreakSignal lançado dentro do corpo é capturado pelo executor de switch.
 */
export interface ASLSwitch {
  kind: 'switch';
  discriminant: ASLExpr;
  cases: ASLSwitchCase[];
}
```

### Adicionar `ASLSwitch` à union:

```typescript
export type ASLStatement =
  | ASLPinMode | ASLDigitalWrite | ASLAnalogWrite | ASLRead
  | ASLIf | ASLWhile | ASLFor | ASLDelay | ASLAssign
  | ASLSetIndex | ASLSetIndex2D | ASLSetIndex3D | ASLSetMember
  | ASLSetPointer | ASLExpressionStmt | ASLReturn | ASLPrint
  | ASLBreak | ASLContinue | ASLComment
  | ASLSwitch;
```

---

## Etapa 2 — `CParser.ts`

### Método atual (linhas 227-307) — SUBSTITUIR blocofinal

O bloco de lowering para if/else (linhas 263-305) deve ser substituído por:

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

    // NOVO: emitir SwitchStatement nativo
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

## Etapa 3 — `statementRegistry.ts`

### Alteração 1 — adicionar ao registry:

```typescript
export const statementRegistry: Record<string, StatementHandler> = {
  IfStatement: handleIfStatement,
  WhileLoop: handleWhileLoop,
  ForLoop: handleForLoop,
  SwitchStatement: handleSwitchStatement,  // NOVO
  ReturnStatement: handleReturnStatement,
  BreakStatement: handleBreakStatement,
  ContinueStatement: handleContinueStatement,
  // ... restante inalterado
};
```

### Alteração 2 — adicionar função handler:

```typescript
function handleSwitchStatement(node: BaseNode, ctx: TransformContext): ASLStatement[] {
  const discriminant = transformExpr(node.children[0]);
  const caseNodes = node.children.slice(1);

  const cases = caseNodes.map(caseNode => {
    const isDefault = caseNode.attributes.isDefault as boolean;

    let test: ASLExpr | null = null;
    let bodyChildren: BaseNode[];

    if (isDefault) {
      bodyChildren = caseNode.children;
    } else {
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

---

## Etapa 4 — `ASLExecutor.ts`

### Adicionar ao `executeStatement()`, após o handler de `for`:

```typescript
case 'switch': {
  const discVal = await this.evalExpr(stmt.discriminant, localEnv, ctx);
  let matched = false;
  let defaultIdx = -1;

  try {
    for (let i = 0; i < stmt.cases.length; i++) {
      const c = stmt.cases[i];

      if (c.test === null) {
        defaultIdx = i;
        continue;
      }

      if (!matched) {
        const testVal = await this.evalExpr(c.test, localEnv, ctx);
        // == (não ===) para semântica C
        if (discVal == testVal) matched = true;
      }

      if (matched && c.body.length > 0) {
        await this.executeBlock(c.body, localEnv, ctx);
      }
      // Fall-through: se matched mas body vazio, continua para próximo case
    }

    // Se nenhum case casou, executar default
    if (!matched && defaultIdx >= 0) {
      for (let i = defaultIdx; i < stmt.cases.length; i++) {
        await this.executeBlock(stmt.cases[i].body, localEnv, ctx);
      }
    }
  } catch (e) {
    if (!(e instanceof BreakSignal)) throw e;
    // BreakSignal consumido aqui — não propaga para loops externos
  }
  break;
}
```

---

## Etapa 5 — Code Generators

### CGenerator.ts

```typescript
else if (node.nodeType === 'SwitchStatement') {
  const disc = this.genExpr(node.children[0]);
  const cases = node.children.slice(1);
  this.addLn(lines, `switch (${disc}) {`, node);
  for (const c of cases) {
    const isDefault = c.attributes.isDefault;
    if (isDefault) {
      this.addLn(lines, `  default:`, c);
    } else {
      const test = this.genExpr(c.children[0]);
      this.addLn(lines, `  case ${test}:`, c);
    }
    const body = c.children.slice(isDefault ? 0 : 1);
    for (const s of body) {
      this.genStmt(s, lines, indent + '  ');
    }
    if (body.length > 0 && !this.hasBreak(body[body.length-1])) {
      this.addLn(lines, `${indent}  break;`, null);
    }
  }
  this.addLn(lines, `}`, null);
}
```

### PythonGenerator.ts

```typescript
if (n.nodeType === 'SwitchStatement') {
  const disc = this.genExpr(n.children[0]);
  const cases = n.children.slice(1);
  this.addLn(out, `match ${disc}:`, n);
  for (const c of cases) {
    const isDefault = c.attributes.isDefault;
    if (isDefault) {
      this.addLn(out, `  _:`, c);
    } else {
      const test = this.genExpr(c.children[0]);
      this.addLn(out, `  case ${test}:`, c);
    }
    const body = c.children.slice(isDefault ? 0 : 1);
    for (const s of body) {
      this.genStmt(s, out, '    ');
    }
  }
}
```

### RustGenerator.ts

```typescript
else if (node.nodeType === 'SwitchStatement') {
  const disc = this.genExpr(node.children[0]);
  const cases = node.children.slice(1);
  this.addLn(lines, `match ${disc} {`, node);
  for (const c of cases) {
    const isDefault = c.attributes.isDefault;
    if (isDefault) {
      this.addLn(lines, `  _ => {`, c);
    } else {
      const test = this.genExpr(c.children[0]);
      this.addLn(lines, `  ${test} => {`, c);
    }
    const body = c.children.slice(isDefault ? 0 : 1);
    for (const s of body) {
      this.genStmt(s, lines, '    ');
    }
    this.addLn(lines, `  }`, null);
  }
  this.addLn(lines, `}`, null);
}
```

---

## Fixtures de Teste para Validação

### T-SW1 — switch/case básico com default

```cpp
void setup() { Serial.begin(9600); }
void loop() {
  int state = 2;
  switch (state) {
    case 1: Serial.println("ONE"); break;
    case 2: Serial.println("TWO"); break;
    case 3: Serial.println("THREE"); break;
    default: Serial.println("UNKNOWN"); break;
  }
  delay(1000);
}
```

**Saída esperada no terminal:** `TWO` (uma vez por segundo)

---

### T-SW2 — switch dentro de for (testa que break não quebra o loop)

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

**Validação crítica**: pino 10 acende na iteração 0, pino 11 na iteração 1, pino 12 na iteração 2. O `for` deve completar as 3 iterações — se `break` quebrar o `for`, apenas o pino 10 acende.

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

**Saída esperada**: LED no pino 9 aceso, `RUNNING` no terminal.

---

### T-SW4 — fall-through intencional

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

**Saída esperada**: `ONE or TWO` (case 1 não tem body, faz fall-through para case 2).

---

## Commits Planeados

```
Commit 1 (core):
feat(asl): implement native switch/case in ASL pipeline

- ASLTypes.ts: add ASLSwitchCase and ASLSwitch types; extend ASLStatement union
- CParser.ts: rewrite parseSwitch() to emit SwitchStatement node
  (replaces broken if/else lowering that caused break to exit outer loops)
- statementRegistry.ts: add SwitchStatement handler (handleSwitchStatement)
- ASLExecutor.ts: add 'switch' case with BreakSignal catch

Commit 2 (generators):
feat(generators): add switch/case support to code generators

- CGenerator.ts: emit switch/case
- PythonGenerator.ts: emit match/case  
- RustGenerator.ts: emit match expression

Commit 3 (tests):
test(asl): add switch/case fixtures T-SW1 to T-SW4
```

---

## Checklist de Aprovação

- [ ] ASLTypes.ts — adicionar interfaces ASLSwitchCase e ASLSwitch
- [ ] CParser.ts — substituir bloco de lowering por emissão de SwitchStatement
- [ ] statementRegistry.ts — adicionar handler SwitchStatement
- [ ] ASLExecutor.ts — adicionar caso 'switch' com BreakSignal catch
- [ ] CGenerator.ts — implementar geração de switch/case
- [ ] PythonGenerator.ts — implementar geração de match/case
- [ ] RustGenerator.ts — implementar geração de match
- [ ] Fixtures T-SW1 a T-SW4 validados
- [ ] notyet/README.md secção 4.1 — atualizar para [x]

---

## Referências

- ASLTypes.ts: linhas 90-110 (union ASLStatement)
- CParser.ts: linhas 173, 227-307 (parseSwitch)
- statementRegistry.ts: linhas 23-40 (registry)
- ASLExecutor.ts: linhas 23, 166-206 (BreakSignal e executores)
- AI_ASSISTANT_CONTEXT_ASL.md: documentação de contexto ASL
