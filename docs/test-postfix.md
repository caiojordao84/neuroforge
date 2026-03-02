# Teste: Postfix ++/-- Desugar (i++ / i-- como expressão)

## Testes Criados

O ficheiro `docs/test-postfix.mjs` contém 6 testes para verificar a funcionalidade:

### Test 1: `arr[i++]`
- **Input:** `Serial.print(arr[i++]);`
- **Esperado:** 
  - Temp assignment `__tmp_i = i`
  - Increment `i = i + 1`
  - Use `arr[__tmp_i]`
- **Verificação:** Procura `__tmp` e incremento no loop

### Test 2: `x = i++`
- **Input:** `int x = i++;`
- **Esperado:**
  - Temp assignment `__tmp_i = i`
  - Increment `i = i + 1`
  - Assignment `x = __tmp_i`
- **Verificação:** Procura `__tmp` e incremento no setup

### Test 3: `++i` (prefix)
- **Input:** `int x = ++i;`
- **Esperado:** NÃO deve criar temp var (prefix não precisa)
- **Verificação:** Procura `__tmp` - não deve existir

### Test 4: `arr[i--]`
- **Input:** `Serial.print(arr[i--]);`
- **Esperado:**
  - Temp assignment `__tmp_i = i`
  - Decrement `i = i - 1`
  - Use `arr[__tmp_i]`
- **Verificação:** Procura `__tmp` e decremento no loop

### Test 5: Múltiplos postfix `i++`, `j++`
- **Input:** `int a = i++; int b = j++;`
- **Esperado:** 2 temp assignments
- **Verificação:** Conta temp assignments >= 2

### Test 6: Postfix aninhado `arr[i++ + j++]`
- **Input:** `int x = arr[i++ + j++];`
- **Esperado:** `__tmp_i` e `__tmp_j`
- **Verificação:** Procura ambos os temps

---

## Como Executar

Devido à configuração de módulos do projeto (ESM + path aliases), os testes devem ser executados via:

```bash
# Opção 1: Via Vite dev server
npm run dev

# Os testes podem ser verificados manualmente no browser console
# ou através de um componente de teste React
```

---

## Verificação Alternativa

Para verificar manualmente a transformação, adicione código de teste no editor:

```cpp
void setup() {
  int i = 5;
  int x = i++;  // Deve criar: __tmp_i = i; i = i + 1; x = __tmp_i
  Serial.print(x);  // Deve imprimir 5
  Serial.print(i);  // Deve imprimir 6
}
```

Verifique no painel de debug AST se os nós são expandidos corretamente.

---

## Resultados Esperados

| Teste | Descrição | Status Esperado |
|-------|-----------|----------------|
| 1 | arr[i++] | PASS |
| 2 | x = i++ | PASS |
| 3 | ++i (prefix) | PASS |
| 4 | arr[i--] | PASS |
| 5 | Múltiplos postfix | PASS |
| 6 | Postfix aninhado | PASS |
