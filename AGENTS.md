# AGENTS.md - NeuroForge Development Guide

This document provides guidelines for agentic coding agents working on the NeuroForge project.

## Project Overview

NeuroForge is a web-based visual programming environment for embedded systems (Arduino, ESP32, Raspberry Pi Pico). It uses React 19, TypeScript, Vite, and tree-sitter for code parsing/transpilation.

## Build/Lint/Test Commands

```bash
# Development
npm run dev              # Start Vite dev server

# Build
npm run build            # TypeScript build + Vite production build
npm run build -- --watch # Watch mode for development

# Linting
npm run lint             # Run ESLint on entire project
npm run lint -- --fix    # Auto-fix ESLint issues

# Type Checking
npx tsc --noEmit         # TypeScript type checking (use tsc -b for project references)
```

**Note:** This project does NOT have a test framework set up yet. There are no test scripts in package.json. Tests should be added using Vitest or a similar framework if needed.

### Running TypeScript Type Check on Specific Files

```bash
npx tsc --noEmit src/engine/CodeParser.ts  # Check single file
```

## Code Style Guidelines

### TypeScript Configuration

- **Target:** ES2022
- **Strict mode:** OFF (`"strict": false`)
- **Module system:** ESNext with `verbatimModuleSyntax`
- **Path alias:** `@/*` maps to `./src/*`

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components (`.tsx`) | PascalCase | `CodeEditor.tsx`, `LEDNode.tsx` |
| Regular files (`.ts`) | camelCase | `codeParser.ts`, `transpile.ts` |
| Hooks | camelCase with `use` prefix | `useSimulationStore.ts`, `useQEMUSimulation.ts` |
| Stores | camelCase with `use*Store` suffix | `useSimulationStore.ts`, `useUIStore.ts` |
| Classes | PascalCase | `CodeParser`, `SimulationEngine` |
| Functions/variables | camelCase | `parseCode()`, `executionStack` |
| Constants | PascalCase (exported) or SCREAMING_SNAKE | `defaultCodeMap`, `boardConfigs` |
| Interfaces/Types | PascalCase | `SimulationStatus`, `Language` |

### Import Organization

1. **Type imports first** (using `import type`)
2. **Named imports** for regular imports
3. **Local imports** use `@/` path alias
4. **Group order:** External → Internal/Engine → Components → Hooks → Stores → Utils

```typescript
// Example import order
import { useState, useEffect } from 'react';
import type { Language, SimulationStatus } from '@/types';
import { simulationEngine } from '@/engine/SimulationEngine';
import { CodeEditor } from '@/components/CodeEditor';
import { useSimulationStore } from '@/stores/useSimulationStore';
import { cn } from '@/lib/utils';
```

### React Patterns

- **Hooks:** Use functional components with hooks. Follow React 19 patterns.
- **State:** Use Zustand stores for global state. Use `useState` for local component state.
- **Effects:** Use `useEffect` for side effects. Clean up subscriptions in return function.
- **Refs:** Use `useRef` for mutable refs that don't trigger re-renders.

```typescript
// Zustand store pattern
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MyStore {
  value: string;
  setValue: (val: string) => void;
}

export const useMyStore = create<MyStore>()(
  persist(
    (set) => ({
      value: '',
      setValue: (value) => set({ value }),
    }),
    { name: 'my-store-key' }
  )
);
```

### Component Structure

```typescript
import { useState, useEffect } from 'react';
import type { SomeType } from '@/types';
import { someHelper } from '@/engine/asl/helpers';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  initialValue?: string;
}

export function MyComponent({ className, initialValue = '' }: Props) {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // effect logic
    return () => {
      // cleanup
    };
  }, []);

  return (
    <div className={cn('base-classes', className)}>
      {state}
    </div>
  );
}
```

### Error Handling

- Use try/catch for async operations and parsing
- Log errors with `console.error()` for debugging
- Return null or appropriate defaults on failure rather than throwing
- Display user-friendly error messages in UI

```typescript
try {
  const result = parseCode(input);
  if (!result) {
    console.error('Parse failed');
    return null;
  }
  return result;
} catch (error) {
  console.error('Unexpected error:', error);
  return null;
}
```

### CSS/Styling

- Use **Tailwind CSS** for all styling
- Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- Use Radix UI components from `@radix-ui/*` for accessible UI primitives

```typescript
import { cn } from '@/lib/utils';

// Combine classes safely
<div className={cn(
  'flex items-center',
  isActive && 'bg-primary text-primary-foreground',
  className
)} />
```

### File Organization

```
src/
├── components/       # React components
│   ├── ui/          # Reusable UI primitives (buttons, dialogs, etc.)
│   └── nodes/       # Custom React Flow node components
├── engine/          # Core logic (parsers, transpilers, simulation)
│   └── asl/         # ASL (Abstract Syntax Language) system
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helper functions
├── services/        # API clients, WebSocket handlers
├── stores/          # Zustand state stores
├── system/          # System-level code (Lexer, SymbolTable, etc.)
└── types/           # TypeScript type definitions
```

### ESLint Configuration

The project uses:
- ESLint 9 with flat config
- `@eslint/js` for base rules
- `typescript-eslint` for TypeScript support
- `eslint-plugin-react-hooks` for React hooks rules
- `eslint-plugin-react-refresh` for HMR safety

Run `npm run lint` before committing to catch issues.

### Key Technologies

| Category | Technology |
|----------|------------|
| Framework | React 19 |
| Build Tool | Vite 6 |
| Language | TypeScript 5.7 |
| State | Zustand 5 |
| UI | Radix UI + Tailwind CSS |
| Code Parsing | tree-sitter (web-tree-sitter) |
| Visual Flow | @xyflow/react (React Flow) |

### Common Patterns

#### Async Operations in Components
```typescript
useEffect(() => {
  let cancelled = false;
  
  async function load() {
    const data = await fetchData();
    if (!cancelled) {
      setData(data);
    }
  }
  
  load();
  return () => { cancelled = true; };
}, []);
```

#### Event Handlers
```typescript
const handleClick = useCallback((event: React.MouseEvent) => {
  event.preventDefault();
  // handler logic
}, [deps]);
```

#### Map/Set for Collections
```typescript
const items = new Map<string, Item>();
items.set(key, value);
const result = items.get(key);
```

### Working with tree-sitter

The project uses `web-tree-sitter` for parsing C, C++, Python, Rust code. Parsers are loaded asynchronously:

```typescript
import { Parser } from 'web-tree-sitter';
import { LanguageRegistry } from '@/engine/asl/LanguageRegistry';

async function loadParser() {
  await LanguageRegistry.getLanguage('cpp');
  const parser = new Parser();
  parser.setLanguage(await LanguageRegistry.getLanguage('cpp'));
  return parser;
}
```

---

Last updated: March 2026
