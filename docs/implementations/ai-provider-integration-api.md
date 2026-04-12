# AI Provider Integration - Technical Specification

**Document Version:** 1.0  
**Date:** April 12, 2026  
**Related To:** ai-provider-integration-plan.md

---

## 1. API Reference

### 1.1 Core Module Exports

```typescript
// apps/webapp/src/lib/ai/provider/index.ts

export { 
  createProvider, 
  isProviderConfigured,
  getAvailableProviders 
} from './provider.factory';

export { 
  APIKeyManager,
  STORAGE_KEYS 
} from './api-key.manager';

export type {
  AIProviderType,
  AIProviderConfig,
  AIProvider,
  ProviderCapability
} from './types';
```

```typescript
// apps/webapp/src/lib/ai/orchestration/index.ts

import { TranspilationOrchestrator } from './orchestrator';

export { TranspilationOrchestrator };

export { buildTranspilePrompt } from './prompt.builder';
export { parseTranspileResponse } from './response';

export type { TranspilePrompt, ToolDefinition } from './types';
```

### 1.2 TypeScript Interfaces

```typescript
// apps/webapp/src/lib/ai/provider/types.ts

/**
 * Supported AI provider types
 */
export type AIProviderType = 'openai' | 'anthropic' | 'local' | 'none';

/**
 * Provider configuration
 */
export interface AIProviderConfig {
  type: AIProviderType;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Provider capability metadata
 */
export interface ProviderCapability {
  supportsStreaming: boolean;
  supportsTools: boolean;
  maxTokens: number;
  supportsVision?: boolean;
}

/**
 * OpenCode client wrapper interface
 */
export interface AIProvider {
  sendMessage(params: {
    system?: string;
    message: string;
    temperature?: number;
  }): Promise<{
    text: string;
    toolCalls?: ToolCall[];
  }>;
  
  streamMessage(params: {
    system?: string;
    message: string;
  }): AsyncGenerator<string>;
  
  getCapability(): ProviderCapability;
}
```

```typescript
// apps/webapp/src/lib/ai/orchestration/types.ts

/**
 * Built transpilation prompt
 */
export interface TranspilePrompt {
  system: string;
  user: string;
}

/**
 * Tool definition for AI execution
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

/**
 * Tool call result
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

---

## 2. Usage Examples

### 2.1 Basic Transpilation

```typescript
import { TranspilationOrchestrator } from '$lib/ai/orchestration';

const orchestrator = new TranspilationOrchestrator();

const result = await orchestrator.transpile({
  sourceLang: 'Arduino',
  targetLang: 'Rust',
  targetPlatform: 'ESP32',
  code: `void setup() { pinMode(LED_BUILTIN, OUTPUT); }`
});

console.log(result.code);
console.log(result.notes);
```

### 2.2 Custom Provider

```typescript
import { createProvider } from '$lib/ai/provider';

const provider = await createProvider({
  type: 'anthropic',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await provider.sendMessage({
  system: 'You are a helpful assistant.',
  message: 'Translate this Arduino code to Rust: void setup() {}',
});
```

### 2.3 Streaming Response

```typescript
import { createProvider } from '$lib/ai/provider';

const provider = await createProvider({
  type: 'openai',
  model: 'openai/gpt-4o',
});

for await (const chunk of provider.streamMessage({
  message: 'Write hello world in Rust',
})) {
  process.stdout.write(chunk);
}
```

### 2.4 Settings UI Integration

```typescript
import { ProviderSettings } from '$lib/components/provider/ProviderSettings.svelte';
import { onMount } from 'svelte';

let showSettings = $state(false);

onMount(() => {
  // Load persisted provider on mount
});
```

---

## 3. Configuration Schema

### 3.1 User Preferences (localStorage)

```typescript
// Key: neuroforge_ai_preferences
interface UserPreferences {
  provider: 'openai' | 'anthropic' | 'local' | 'none';
  model: string;
  temperature: number;
  streaming: boolean;
}
```

### 3.2 Environment Variables (Optional)

```bash
# .env (for development only!)
VITE_OPENAI_API_KEY=sk-...
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_OPENCODE_SERVER_URL=http://localhost:4096
```

---

## 4. State Management

### 4.1 Provider State

```typescript
// apps/webapp/src/lib/ai/state/provider.svelte.ts

import { writable, derived } from 'svelte/store';
import { APIKeyManager } from '$lib/ai/provider/api-key.manager';

function createProviderStore() {
  const { subscribe, set, update } = writable({
    type: APIKeyManager.getProviderType(),
    configured: false,
    error: null as string | null,
  });
  
  return {
    subscribe,
    setType: (type: AIProviderType) => {
      APIKeyManager.setProviderType(type);
      update(s => ({ ...s, type }));
    },
    setConfigured: (configured: boolean) => {
      update(s => ({ ...s, configured }));
    },
    setError: (error: string | null) => {
      update(s => ({ ...s, error }));
    },
  };
}

export const providerState = createProviderStore();
```

---

## 5. Error Codes

| Code | HTTP | Description | Recovery |
|------|------|-------------|----------|
| `PROVIDER_NOT_CONFIGURED` | - | No API key set | Prompt user |
| `INVALID_API_KEY` | 401 | Key rejected | Re-prompt key |
| `RATE_LIMITED` | 429 | Too many requests | Wait + retry |
| `MODEL_UNAVAILABLE` | 400 | Model not found | Use fallback model |
| `CONTENT_FILTERED` | 400 | Content blocked | Simplify prompt |
| `TIMEOUT` | 504 | Request timeout | Retry |
| `NETWORK_ERROR` | - | Connection fail | Retry |

---

## 6. Migration Checklist

### 6.1 Pre-Migration

- [ ] Audit all `transpileCode` calls
- [ ] Document feature flags needed
- [ ] Prepare rollback plan

### 6.2 During Migration

- [ ] Keep both systems running
- [ ] Log comparison metrics
- [ ] Test error paths

### 6.3 Post-Migration

- [ ] Remove old code
- [ ] Clean up dependencies
- [ ] Update documentation

---

## 7. Performance Targets

| Metric | Target | Maximum |
|-------|--------|---------|
| First token (streaming) | < 1s | 3s |
| Full transpilation (AI) | < 10s | 30s |
| Full transpilation (WASM) | < 1s | 2s |
| Error recovery | < 500ms | 1s |

---

## 8. Logging Strategy

```typescript
// Logger interface
const logger = {
  info: (msg: string, meta?: Record<string, any>) => void,
  warn: (msg: string, meta?: Record<string, any>) => void,
  error: (msg: string, meta?: Record<string, any>) => void,
  
  // Structured logging for observability
  logTranspile: (input: {
    sourceLang: string;
    targetLang: string;
    provider: string;
    duration: number;
    success: boolean;
  }) => void,
};
```

---

**End of Technical Specification**