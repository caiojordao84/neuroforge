# Plano de Implementação: Modularização do codeToASL.ts

## Visão Geral

Este documento descreve o plano para modularizar o arquivo `src/engine/asl/codeToASL.ts`, que atualmente contém 967 linhas com múltiplas responsabilidades. O objetivo é aplicar o padrão **Handler Registry** para permitir extensão sem modificar o código core.

**Branch alvo:** `ASL_Integration_codeToASL_Modular`

---

## 1. Estrutura Proposta

```
src/engine/asl/
├── codeToASL.ts              # Entry point + orchestration (~150 linhas)
│
├── transforms/
│   ├── index.ts              # Barrel exports
│   ├── context.ts            # TransformContext interface
│   ├── statementRegistry.ts  # Registry de handlers
│   ├── blockTransform.ts     # transformBlock (~200 linhas)
│   ├── exprTransform.ts      # transformExpr (~100 linhas)
│   └── callTransform.ts      # transformCallToStmt + tryTransformRead (~100 linhas)
│
├── helpers/
│   ├── index.ts              # Barrel exports
│   ├── arrayUtils.ts         # resolveSize, buildEmptyArray, deepCopyValue
│   └── typeUtils.ts          # mapToASLType
│
├── ASLExecutor.ts            # Mantém como está
├── ASLTypes.ts               # Mantém como está
└── index.ts                  # Barrel exports
```

---

## 2. Definição de Interfaces

### 2.1 TransformContext (`transforms/context.ts`)

```typescript
import type { Language } from '@/types';

export interface TransformContext {
  globalsMap: Map<string, any>;
  language?: Language;
}

export function createTransformContext(language?: Language): TransformContext {
  return {
    globalsMap: new Map(),
    language,
  };
}
```

### 2.2 StatementHandler (`transforms/statementRegistry.ts`)

```typescript
import type { BaseNode } from '@/system/types';
import type { ASLStatement } from '../ASLTypes';
import type { TransformContext } from './context';

export type StatementHandler = (
  node: BaseNode,
  ctx: TransformContext
) => ASLStatement[];
```

---

## 3. Módulos a Criar

### 3.1 `transforms/context.ts` (NOVO)

- Interface `TransformContext`
- Factory function `createTransformContext`

### 3.2 `transforms/statementRegistry.ts` (NOVO)

- Registry de handlers: `Record<string, StatementHandler>`
- Factory functions para handlers repetitivos (ex.: `handleHardware`)
- Duplicação do `calleeMap` eliminada - usar helper único

### 3.3 `transforms/blockTransform.ts` (NOVO)

- Função `transformBlock(nodes, ctx)` - orchestrator que usa o registry
- ~200 linhas (reduzido de ~460)

### 3.4 `transforms/exprTransform.ts` (NOVO)

- Função `transformExpr(node)` - atual
- ~100 linhas

### 3.5 `transforms/callTransform.ts` (NOVO)

- Função `transformCallToStmt(node)` (~75 linhas)
- Função `tryTransformRead(target, valueNode)` (~50 linhas)
- ~125 linhas combinadas

### 3.6 `helpers/typeUtils.ts` (NOVO)

```typescript
import type { ASLType } from '../ASLTypes';

export function mapToASLType(cppType: string): ASLType {
  const lower = cppType.toLowerCase();
  if (lower.includes('int') || lower.includes('long') || lower === 'short' || 
      lower === 'byte' || lower === 'char') return 'int';
  if (lower.includes('float') || lower === 'double') return 'float';
  if (lower === 'bool' || lower === 'boolean') return 'bool';
  if (lower === 'string') return 'string';
  return 'int';
}
```

### 3.7 `helpers/arrayUtils.ts` (NOVO)

- `resolveSize(expr, globalsMap)`
- `buildEmptyArray(sizeExpr, size2Expr, globalsMap)`
- `deepCopyValue(val)`

### 3.8 `transforms/index.ts` e `helpers/index.ts`

Barrel exports para imports mais limpos.

---

## 4. códigoToASL.ts Refatorado

Após a refatoração, `codeToASL.ts` deve ficar com ~150 linhas:

```typescript
// src/engine/asl/codeToASL.ts

import type { Language } from '@/types';
import type { ProgramNode } from '../../system/types';
import type { ASLProgram, ASLGlobalVar, ASLFunction, ASLTask } from './ASLTypes';
import { RecursiveDescentCParser } from './plugins/c/CParser';
import { PythonParser } from './plugins/python/PythonParser';

import { createTransformContext } from './transforms/context';
import { transformBlock } from './transforms/blockTransform';
import { mapToASLType } from './helpers/typeUtils';
import { buildEmptyArray, deepCopyValue } from './helpers/arrayUtils';

export async function codeToASL(source: string, language: Language): Promise<ASLProgram> {
  const programAst = await parseToProgramNode(source, language);
  return astToASL(programAst, language);
}

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

export function astToASL(program: ProgramNode, language?: Language): ASLProgram {
  const ctx = createTransformContext(language);
  const globals: ASLGlobalVar[] = [];
  const functions: ASLFunction[] = [];
  const tasks: ASLTask[] = [];

  const topLevelNodes: BaseNode[] = [];
  const isPython = language === 'micropython' || language === 'circuitpython' || language === 'python';

  program.children.forEach((node) => {
    if (!node) return;

    if (node.nodeType === 'EnumDeclaration') {
      const members = node.attributes.members || [];
      members.forEach((m: { name: string, value: number }) => {
        globals.push({ name: m.name, type: 'int', initialValue: m.value });
        ctx.globalsMap.set(m.name, m.value);
      });
      return;
    }

    if (node.nodeType === 'Function') {
      const name = node.attributes.name;
      const params = node.attributes.params || [];
      const body = transformBlock(node.children, ctx);

      if (node.leadingComments) {
        for (let i = node.leadingComments.length - 1; i >= 0; i--) {
          body.unshift({ kind: 'comment', text: node.leadingComments[i] });
        }
      }

      if (name === 'loop') {
        tasks.push({ name: 'mainLoop', body });
      } else {
        functions.push({
          name,
          params: params.map((p: any) => ({ name: p.name, type: p.type || 'int' })),
          body,
        });
      }
    } else {
      topLevelNodes.push(node);

      if (node.nodeType === 'VariableDeclaration') {
        const name = node.attributes.name;
        const type = mapToASLType(node.attributes.type || 'int');
        const isArray = node.attributes.isArray;
        const isArray2D = node.attributes.isArray2D;
        let initialValue: any = 0;

        // ... lógica de inicialização ...
        // (extraída para helpers se necessário)

        globals.push({
          name,
          type: type as any,
          initialValue: deepCopyValue(initialValue),
          comments: node.leadingComments,
        } as any);
        ctx.globalsMap.set(name, deepCopyValue(initialValue));
      }
    }
  });

  // ... resto da lógica de top-level nodes ...
  // (mantém a estrutura atual)

  return { metadata: { name: 'AST Generated' }, globals, functions, tasks };
}
```

---

## 5. Passos de Implementação

### Passo 1: Criar estrutura de diretórios

```bash
mkdir -p src/engine/asl/transforms
mkdir -p src/engine/asl/helpers
```

### Passo 2: Criar interfaces e helpers básicos

1. `transforms/context.ts`
2. `helpers/arrayUtils.ts`
3. `helpers/typeUtils.ts`

### Passo 3: Criar módulo de expressões

1. `transforms/exprTransform.ts` - mover `transformExpr`

### Passo 4: Criar módulo de chamadas

1. `transforms/callTransform.ts` - mover `transformCallToStmt` e `tryTransformRead`

### Passo 5: Criar o Statement Registry

1. `transforms/statementRegistry.ts`
2. Definir todos os handlers
3. Criar factory functions para casos repetitivos

### Passo 6: Criar Block Transform

1. `transforms/blockTransform.ts` - orchestrator usando registry

### Passo 7: Refatorar codeToASL.ts

1. Reduzir para entry + orchestration
2. Importar dos novos módulos
3. Testar compilação

### Passo 8: Criar barrel exports

1. `transforms/index.ts`
2. `helpers/index.ts`
3. `index.ts` (raiz)

### Passo 9: Verificar e testar

1. Executar `npm run build` ou equivalente
2. Executar testes existentes
3. Verificar se todas as funcionalidades continuam funcionando

---

## 6. Benefícios Esperados

| Métrica | Antes | Depois |
|---------|-------|--------|
| Linhas em codeToASL.ts | 967 | ~150 |
| Duplicação calleeMap | 2x | 0x |
| Tamanho máximo de arquivo | 967 linhas | ~200 linhas |
| Adicionar novo statement | Editar if/else | Adicionar handler |
| Testabilidade | Difícil | Por handler |

---

## 7. Considerações Técnicas

### 7.1 Padrão Registry vs Switch

O padrão registry foi escolhido porque:

- **Extensibilidade**: Novos handlers podem ser adicionados sem modificar `transformBlock`
- **Plugin system**: Permite que bibliotecas externas registrem handlers
- **Testabilidade**: Cada handler pode ser testado isoladamente

### 7.2 Context Passing

O `TransformContext` é passado explicitamente para evitar:

- Variáveis globais
- Closure complexity
- Dificuldade de mock em testes

### 7.3 Backward Compatibility

Manter os exports existentes:

```typescript
// codeToASL.ts
export { transformBlock } from './transforms/blockTransform';
export { transformExpr } from './transforms/exprTransform';
// etc.
```

### 7.4 ESLint/Prettier

Verificar se há regras específicas para imports barrel vs imports diretos.

---

## 8. Histórico de Mudanças

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-02-22 | 1.0 | Versão inicial do plano |

---

## 9. Referências

- Arquivo atual: `src/engine/asl/codeToASL.ts`
- Tipos: `src/engine/asl/ASLTypes.ts`
- Executor: `src/engine/asl/ASLExecutor.ts` (referência de estrutura)
